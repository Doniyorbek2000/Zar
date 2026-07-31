import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { authenticate, authorize } from '../../middleware/auth';
import { BadRequest } from '../../lib/errors';
import { shiftsService } from './shifts.service';

export const shiftsRouter = Router();
shiftsRouter.use(authenticate);

function branchOf(req: { user?: { branchId: string | null }; query: Record<string, unknown> }) {
  const branchId = (req.query.branchId as string) || req.user?.branchId;
  if (!branchId) throw BadRequest('branchId aniqlanmadi');
  return branchId;
}

shiftsRouter.get(
  '/current',
  asyncHandler(async (req, res) => ok(res, await shiftsService.current(branchOf(req)))),
);

shiftsRouter.post(
  '/open',
  authorize('ADMIN', 'MANAGER', 'CASHIER'),
  validate({ body: z.object({ openingCash: z.number().nonnegative() }) }),
  asyncHandler(async (req, res) =>
    ok(res, await shiftsService.open(branchOf(req), req.user!.sub, req.body.openingCash), 201),
  ),
);

shiftsRouter.post(
  '/:id/close',
  authorize('ADMIN', 'MANAGER', 'CASHIER'),
  validate({ body: z.object({ closingCash: z.number().nonnegative() }) }),
  asyncHandler(async (req, res) => ok(res, await shiftsService.close(req.params.id, req.body.closingCash))),
);

shiftsRouter.get(
  '/:id/x-report',
  asyncHandler(async (req, res) => ok(res, await shiftsService.xReport(req.params.id))),
);
