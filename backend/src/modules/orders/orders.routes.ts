import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { BadRequest } from '../../lib/errors';
import { ordersService } from './orders.service';

export const ordersRouter = Router();
ordersRouter.use(authenticate);

function branchOf(req: { user?: { branchId: string | null }; query: Record<string, unknown> }) {
  const branchId = (req.query.branchId as string) || req.user?.branchId;
  if (!branchId) throw BadRequest('branchId aniqlanmadi');
  return branchId;
}

ordersRouter.get(
  '/',
  asyncHandler(async (req, res) => ok(res, await ordersService.listActive(branchOf(req)))),
);

ordersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => ok(res, await ordersService.get(req.params.id))),
);

ordersRouter.post(
  '/',
  validate({
    body: z.object({
      type: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY']).optional(),
      tableId: z.string().optional(),
      waiterId: z.string().optional(),
      guests: z.number().int().positive().optional(),
      customerId: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const order = await ordersService.create(branchOf(req), req.user!.sub, req.body);
    ok(res, order, 201);
  }),
);

ordersRouter.post(
  '/:id/items',
  validate({
    body: z.object({
      productId: z.string().min(1),
      quantity: z.number().positive().optional(),
      modifierIds: z.array(z.string()).optional(),
      note: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => ok(res, await ordersService.addItem(req.params.id, req.body))),
);

ordersRouter.patch(
  '/:id/items/:itemId',
  validate({ body: z.object({ quantity: z.number().positive().optional(), note: z.string().optional() }) }),
  asyncHandler(async (req, res) =>
    ok(res, await ordersService.updateItem(req.params.id, req.params.itemId, req.body)),
  ),
);

ordersRouter.delete(
  '/:id/items/:itemId',
  asyncHandler(async (req, res) => ok(res, await ordersService.removeItem(req.params.id, req.params.itemId))),
);

ordersRouter.post(
  '/:id/discount',
  validate({ body: z.object({ discountPct: z.number().min(0).max(100) }) }),
  asyncHandler(async (req, res) => ok(res, await ordersService.setDiscount(req.params.id, req.body.discountPct))),
);

ordersRouter.post(
  '/:id/service-fee',
  validate({ body: z.object({ serviceFeePct: z.number().min(0).max(100) }) }),
  asyncHandler(async (req, res) =>
    ok(res, await ordersService.setServiceFee(req.params.id, req.body.serviceFeePct)),
  ),
);

ordersRouter.post(
  '/:id/send',
  asyncHandler(async (req, res) => ok(res, await ordersService.sendToKitchen(req.params.id))),
);

ordersRouter.post(
  '/:id/pay',
  validate({
    body: z.object({
      payments: z
        .array(
          z.object({
            method: z.enum(['CASH', 'CARD', 'TRANSFER', 'BONUS']),
            amount: z.number().positive(),
          }),
        )
        .min(1),
    }),
  }),
  asyncHandler(async (req, res) =>
    ok(res, await ordersService.pay(req.params.id, req.user!.sub, req.body.payments)),
  ),
);

ordersRouter.post(
  '/:id/move',
  validate({ body: z.object({ tableId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => ok(res, await ordersService.moveTable(req.params.id, req.body.tableId))),
);

ordersRouter.post(
  '/:id/cancel',
  validate({ body: z.object({ reason: z.string().optional() }) }),
  asyncHandler(async (req, res) => ok(res, await ordersService.cancel(req.params.id, req.body.reason))),
);
