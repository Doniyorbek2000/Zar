import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { authenticate, authorize } from '../../middleware/auth';
import { settingsService } from './settings.service';

export const settingsRouter = Router();
settingsRouter.use(authenticate);

settingsRouter.get(
  '/',
  asyncHandler(async (_req, res) => ok(res, await settingsService.getAll())),
);

settingsRouter.put(
  '/',
  authorize('ADMIN', 'MANAGER'),
  validate({ body: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])) }),
  asyncHandler(async (req, res) => {
    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.body)) values[k] = String(v);
    ok(res, await settingsService.setMany(values));
  }),
);
