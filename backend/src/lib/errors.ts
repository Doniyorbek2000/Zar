// Markazlashtirilgan xato turlari

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code = 'ERROR',
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const BadRequest = (msg: string, details?: unknown) =>
  new AppError(400, msg, 'BAD_REQUEST', details);

export const Unauthorized = (msg = 'Avtorizatsiya talab qilinadi') =>
  new AppError(401, msg, 'UNAUTHORIZED');

export const Forbidden = (msg = 'Ruxsat yo\'q') => new AppError(403, msg, 'FORBIDDEN');

export const NotFound = (msg = 'Topilmadi') => new AppError(404, msg, 'NOT_FOUND');

export const Conflict = (msg: string) => new AppError(409, msg, 'CONFLICT');
