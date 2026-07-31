import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler, ok } from '../../lib/http';
import { BadRequest } from '../../lib/errors';

// Yuklangan rasmlar papkasi (backend/uploads)
export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const uploadsRouter = Router();
uploadsRouter.use(authenticate, authorize('ADMIN', 'MANAGER'));

// Base64 data URL sifatida rasm qabul qiladi va URL qaytaradi (multipart kerak emas)
uploadsRouter.post(
  '/image',
  validate({ body: z.object({ dataUrl: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const match = /^data:(image\/[a-z+]+);base64,(.+)$/s.exec(req.body.dataUrl);
    if (!match) throw BadRequest('Rasm formati noto\'g\'ri (data URL kutilyapti)');
    const ext = EXT[match[1]];
    if (!ext) throw BadRequest('Faqat png, jpg, webp yoki gif qabul qilinadi');

    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 3 * 1024 * 1024) throw BadRequest('Rasm hajmi 3MB dan oshmasligi kerak');

    const filename = crypto.randomBytes(10).toString('hex') + '.' + ext;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
    ok(res, { url: `/uploads/${filename}` }, 201);
  }),
);
