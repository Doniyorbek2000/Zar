import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { D } from '../../lib/money';
import { prisma } from '../../lib/prisma';

export const customersRouter = Router();
customersRouter.use(authenticate);

customersRouter.get(
  '/',
  validate({ query: z.object({ search: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const search = req.query.search as string | undefined;
    const customers = await prisma.customer.findMany({
      where: search
        ? { OR: [{ fullName: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] }
        : undefined,
      orderBy: { fullName: 'asc' },
      take: 50,
    });
    ok(res, customers);
  }),
);

customersRouter.post(
  '/',
  validate({
    body: z.object({
      fullName: z.string().min(1),
      phone: z.string().optional(),
      cardNumber: z.string().optional(),
      discountPct: z.number().min(0).max(100).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { discountPct, ...rest } = req.body;
    const customer = await prisma.customer.create({
      data: { ...rest, ...(discountPct != null ? { discountPct: D(discountPct) } : {}) },
    });
    ok(res, customer, 201);
  }),
);
