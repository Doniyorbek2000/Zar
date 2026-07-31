import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { authenticate, authorize } from '../../middleware/auth';
import { BadRequest } from '../../lib/errors';
import { tablesService } from './tables.service';

export const tablesRouter = Router();
tablesRouter.use(authenticate);

const manage = authorize('ADMIN', 'MANAGER');

// Joriy foydalanuvchi filialini yoki so'rovdagi branchId ni oladi
function resolveBranch(req: { user?: { branchId: string | null }; query: Record<string, unknown> }) {
  const branchId = (req.query.branchId as string) || req.user?.branchId;
  if (!branchId) throw BadRequest('branchId aniqlanmadi');
  return branchId;
}

tablesRouter.get(
  '/halls',
  asyncHandler(async (req, res) => ok(res, await tablesService.listHalls(resolveBranch(req)))),
);

tablesRouter.post(
  '/halls',
  manage,
  validate({ body: z.object({ name: z.string().min(1), sortOrder: z.number().optional() }) }),
  asyncHandler(async (req, res) => ok(res, await tablesService.createHall(resolveBranch(req), req.body), 201)),
);

tablesRouter.patch(
  '/halls/:id',
  manage,
  validate({ body: z.object({ name: z.string().optional(), sortOrder: z.number().optional() }) }),
  asyncHandler(async (req, res) => ok(res, await tablesService.updateHall(req.params.id, req.body))),
);

tablesRouter.delete(
  '/halls/:id',
  manage,
  asyncHandler(async (req, res) => ok(res, await tablesService.deleteHall(req.params.id))),
);

tablesRouter.post(
  '/tables',
  manage,
  validate({
    body: z.object({
      hallId: z.string().min(1),
      name: z.string().min(1),
      seats: z.number().int().positive().optional(),
      posX: z.number().optional(),
      posY: z.number().optional(),
    }),
  }),
  asyncHandler(async (req, res) => ok(res, await tablesService.createTable(req.body), 201)),
);

tablesRouter.patch(
  '/tables/:id',
  manage,
  validate({
    body: z.object({
      name: z.string().optional(),
      seats: z.number().int().positive().optional(),
      posX: z.number().optional(),
      posY: z.number().optional(),
      hallId: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => ok(res, await tablesService.updateTable(req.params.id, req.body))),
);

tablesRouter.delete(
  '/tables/:id',
  manage,
  asyncHandler(async (req, res) => ok(res, await tablesService.deleteTable(req.params.id))),
);
