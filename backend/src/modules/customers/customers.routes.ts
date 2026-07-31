import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, ok } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { authenticate, authorize } from '../../middleware/auth';
import { NotFound } from '../../lib/errors';
import { D } from '../../lib/money';
import { prisma } from '../../lib/prisma';

export const customersRouter = Router();
customersRouter.use(authenticate);

// Mijozlarni qidirish (ism yoki telefon)
customersRouter.get(
  '/',
  validate({ query: z.object({ search: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const search = req.query.search as string | undefined;
    const customers = await prisma.customer.findMany({
      where: search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
              { cardNumber: { contains: search } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    ok(res, customers);
  }),
);

// Bitta mijoz + bonus tarixi + statistika
customersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        bonusTransactions: { orderBy: { createdAt: 'desc' }, take: 30 },
        orders: {
          where: { status: 'PAID' },
          select: { total: true },
        },
      },
    });
    if (!customer) throw NotFound('Mijoz topilmadi');
    const totalSpent = customer.orders.reduce((s, o) => s.add(o.total), new Prisma.Decimal(0));
    const { orders, ...rest } = customer;
    ok(res, { ...rest, ordersCount: orders.length, totalSpent: totalSpent.toFixed(2) });
  }),
);

customersRouter.post(
  '/',
  validate({
    body: z.object({
      fullName: z.string().min(1),
      phone: z.string().optional(),
      cardNumber: z.string().optional(),
      address: z.string().optional(),
      discountPct: z.number().min(0).max(100).optional(),
      note: z.string().optional(),
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

customersRouter.patch(
  '/:id',
  validate({
    body: z.object({
      fullName: z.string().optional(),
      phone: z.string().optional(),
      cardNumber: z.string().optional(),
      address: z.string().optional(),
      discountPct: z.number().min(0).max(100).optional(),
      note: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { discountPct, ...rest } = req.body;
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: { ...rest, ...(discountPct != null ? { discountPct: D(discountPct) } : {}) },
    });
    ok(res, customer);
  }),
);

// Bonusni qo'lda tuzatish (qo'shish/ayirish)
customersRouter.post(
  '/:id/bonus',
  authorize('ADMIN', 'MANAGER'),
  validate({ body: z.object({ amount: z.number(), note: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUniqueOrThrow({ where: { id: req.params.id } });
      const balance = customer.bonusBalance.add(D(req.body.amount));
      await tx.bonusTransaction.create({
        data: {
          customerId: customer.id,
          type: 'ADJUST',
          amount: D(req.body.amount),
          balanceAfter: balance,
          note: req.body.note ?? 'Qo\'lda tuzatish',
        },
      });
      return tx.customer.update({ where: { id: customer.id }, data: { bonusBalance: balance } });
    });
    ok(res, result);
  }),
);
