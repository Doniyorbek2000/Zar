import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { BadRequest } from '../../lib/errors';
import { prisma } from '../../lib/prisma';

export const deliveryRouter = Router();
deliveryRouter.use(authenticate);

function branchOf(req: { user?: { branchId: string | null }; query: Record<string, unknown> }) {
  const branchId = (req.query.branchId as string) || req.user?.branchId;
  if (!branchId) throw BadRequest('branchId aniqlanmadi');
  return branchId;
}

// Faol dostavka buyurtmalari (yetkazilmagan)
deliveryRouter.get(
  '/',
  validate({ query: z.object({ branchId: z.string().optional(), all: z.coerce.boolean().optional() }) }),
  asyncHandler(async (req, res) => {
    const branchId = branchOf(req);
    const all = (req.query.all as unknown as boolean) === true;
    const orders = await prisma.order.findMany({
      where: {
        branchId,
        type: 'DELIVERY',
        ...(all ? {} : { OR: [{ status: { in: ['OPEN', 'SENT', 'READY'] } }, { deliveryStatus: { not: 'DELIVERED' } }] }),
        status: { not: 'CANCELLED' },
      },
      include: {
        items: { select: { id: true, name: true, quantity: true, status: true } },
        courier: { select: { id: true, fullName: true, phone: true } },
        customer: { select: { id: true, fullName: true, phone: true } },
      },
      orderBy: { openedAt: 'desc' },
      take: 100,
    });
    ok(res, orders);
  }),
);

// Kuryerlar ro'yxati
deliveryRouter.get(
  '/couriers',
  asyncHandler(async (_req, res) => {
    const couriers = await prisma.user.findMany({
      where: { role: 'COURIER', isActive: true },
      select: { id: true, fullName: true, phone: true },
      orderBy: { fullName: 'asc' },
    });
    ok(res, couriers);
  }),
);
