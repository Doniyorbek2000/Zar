import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { asyncHandler, ok } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { authenticate, authorize } from '../../middleware/auth';
import { prisma } from '../../lib/prisma';

export const usersRouter = Router();
usersRouter.use(authenticate, authorize('ADMIN', 'MANAGER'));

const ROLE = z.enum(['ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'COOK']);
const SELECT = {
  id: true,
  fullName: true,
  username: true,
  role: true,
  phone: true,
  isActive: true,
  branchId: true,
} as const;

usersRouter.get(
  '/',
  asyncHandler(async (_req, res) =>
    ok(res, await prisma.user.findMany({ select: SELECT, orderBy: { fullName: 'asc' } })),
  ),
);

usersRouter.post(
  '/',
  validate({
    body: z.object({
      fullName: z.string().min(1),
      username: z.string().min(3),
      password: z.string().min(6),
      role: ROLE,
      phone: z.string().optional(),
      branchId: z.string().optional(),
      pin: z.string().regex(/^\d{4,6}$/).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { password, pin, ...rest } = req.body;
    const user = await prisma.user.create({
      data: {
        ...rest,
        passwordHash: await bcrypt.hash(password, 10),
        pinHash: pin ? await bcrypt.hash(pin, 10) : null,
      },
      select: SELECT,
    });
    ok(res, user, 201);
  }),
);

usersRouter.patch(
  '/:id',
  validate({
    body: z.object({
      fullName: z.string().optional(),
      role: ROLE.optional(),
      phone: z.string().optional(),
      branchId: z.string().optional(),
      isActive: z.boolean().optional(),
      password: z.string().min(6).optional(),
      pin: z.string().regex(/^\d{4,6}$/).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { password, pin, ...rest } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
        ...(pin ? { pinHash: await bcrypt.hash(pin, 10) } : {}),
      },
      select: SELECT,
    });
    ok(res, user);
  }),
);
