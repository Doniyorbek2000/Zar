import type { NextFunction, Request, Response } from 'express';

// Async route handlerlarni try/catch bilan o'rab beruvchi yordamchi
export const asyncHandler =
  <T = unknown>(fn: (req: Request, res: Response, next: NextFunction) => Promise<T>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };

// Standart muvaffaqiyatli javob
export const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data });
