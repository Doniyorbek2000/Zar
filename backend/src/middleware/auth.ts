import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { Forbidden, Unauthorized } from '../lib/errors';
import { verifyAccessToken, type JwtPayload } from '../lib/jwt';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// Access tokenni tekshiradi va req.user ga yozadi
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(Unauthorized('Token topilmadi'));
  }
  const token = header.slice(7);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(Unauthorized('Token yaroqsiz yoki muddati o\'tgan'));
  }
}

// Faqat berilgan rollarga ruxsat beradi
export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Unauthorized());
    if (roles.length && !roles.includes(req.user.role)) {
      return next(Forbidden('Ushbu amal uchun ruxsat yetarli emas'));
    }
    next();
  };
}
