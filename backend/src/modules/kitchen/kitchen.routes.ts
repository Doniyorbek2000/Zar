import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { authenticate, authorize } from '../../middleware/auth';
import { BadRequest } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { realtime } from '../../realtime/realtime';

// Kitchen Display System (KDS) — oshxona ekrani
export const kitchenRouter = Router();
kitchenRouter.use(authenticate);

function branchOf(req: { user?: { branchId: string | null }; query: Record<string, unknown> }) {
  const branchId = (req.query.branchId as string) || req.user?.branchId;
  if (!branchId) throw BadRequest('branchId aniqlanmadi');
  return branchId;
}

// Oshxonaga yuborilgan, hali tayyor bo'lmagan taomlar
kitchenRouter.get(
  '/queue',
  asyncHandler(async (req, res) => {
    const branchId = branchOf(req);
    const orders = await prisma.order.findMany({
      where: {
        branchId,
        status: { in: ['SENT', 'READY'] },
        items: { some: { status: { in: ['SENT', 'READY'] } } },
      },
      select: {
        id: true,
        number: true,
        type: true,
        openedAt: true,
        table: { select: { name: true } },
        waiter: { select: { fullName: true } },
        items: {
          where: { status: { in: ['SENT', 'READY'] } },
          select: { id: true, name: true, quantity: true, status: true, note: true, createdAt: true },
        },
      },
      orderBy: { openedAt: 'asc' },
    });
    ok(res, orders);
  }),
);

// Taom holatini o'zgartirish (oshpaz: tayyor / berildi)
kitchenRouter.post(
  '/items/:itemId/status',
  authorize('ADMIN', 'MANAGER', 'COOK', 'WAITER'),
  validate({ body: z.object({ status: z.enum(['SENT', 'READY', 'SERVED']) }) }),
  asyncHandler(async (req, res) => {
    const item = await prisma.orderItem.update({
      where: { id: req.params.itemId },
      data: { status: req.body.status },
    });

    // Buyurtmadagi barcha taomlar tayyor bo'lsa, buyurtmani READY qilamiz
    const remaining = await prisma.orderItem.count({
      where: { orderId: item.orderId, status: { in: ['NEW', 'SENT'] } },
    });
    if (remaining === 0) {
      await prisma.order.updateMany({
        where: { id: item.orderId, status: 'SENT' },
        data: { status: 'READY' },
      });
    }

    // Real-time: oshxona ekrani, stollar va buyurtma jonli yangilanadi
    const order = await prisma.order.findUnique({
      where: { id: item.orderId },
      select: { branchId: true },
    });
    realtime.emitToBranch(order?.branchId, 'kds:changed');
    realtime.emitToBranch(order?.branchId, 'order:changed', { orderId: item.orderId });
    realtime.emitToBranch(order?.branchId, 'tables:changed');
    ok(res, item);
  }),
);
