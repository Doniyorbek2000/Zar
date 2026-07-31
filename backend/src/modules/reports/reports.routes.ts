import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { authenticate, authorize } from '../../middleware/auth';
import { BadRequest } from '../../lib/errors';
import { reportsService } from './reports.service';

export const reportsRouter = Router();
reportsRouter.use(authenticate, authorize('ADMIN', 'MANAGER'));

function branchOf(req: { user?: { branchId: string | null }; query: Record<string, unknown> }) {
  const branchId = (req.query.branchId as string) || req.user?.branchId;
  if (!branchId) throw BadRequest('branchId aniqlanmadi');
  return branchId;
}

// So'rovdan sana oralig'ini oladi (standart: oxirgi 30 kun)
function rangeOf(query: Record<string, unknown>) {
  const to = query.to ? new Date(query.to as string) : new Date();
  const from = query.from
    ? new Date(query.from as string)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

const rangeQuery = z.object({ from: z.string().optional(), to: z.string().optional(), branchId: z.string().optional() });

reportsRouter.get(
  '/dashboard',
  validate({ query: rangeQuery }),
  asyncHandler(async (req, res) => ok(res, await reportsService.dashboard(branchOf(req), rangeOf(req.query)))),
);

reportsRouter.get(
  '/sales-by-day',
  validate({ query: rangeQuery }),
  asyncHandler(async (req, res) => ok(res, await reportsService.salesByDay(branchOf(req), rangeOf(req.query)))),
);

reportsRouter.get(
  '/top-products',
  validate({ query: rangeQuery }),
  asyncHandler(async (req, res) => ok(res, await reportsService.topProducts(branchOf(req), rangeOf(req.query)))),
);

reportsRouter.get(
  '/waiters',
  validate({ query: rangeQuery }),
  asyncHandler(async (req, res) => ok(res, await reportsService.waiterPerformance(branchOf(req), rangeOf(req.query)))),
);
