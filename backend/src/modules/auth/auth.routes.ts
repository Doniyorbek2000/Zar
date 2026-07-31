import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authService } from './auth.service';

export const authRouter = Router();

authRouter.post(
  '/login',
  validate({ body: z.object({ username: z.string().min(1), password: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body.username, req.body.password);
    ok(res, result);
  }),
);

authRouter.post(
  '/pin',
  validate({ body: z.object({ pin: z.string(), branchId: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const result = await authService.loginWithPin(req.body.pin, req.body.branchId);
    ok(res, result);
  }),
);

authRouter.post(
  '/refresh',
  validate({ body: z.object({ refreshToken: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const result = await authService.refresh(req.body.refreshToken);
    ok(res, result);
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await authService.me(req.user!.sub);
    ok(res, result);
  }),
);
