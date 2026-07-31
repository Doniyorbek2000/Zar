import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { receiptsService, type ReceiptKind } from './receipts.service';

export const receiptsRouter = Router();
receiptsRouter.use(authenticate);

const kindOf = (q: unknown): ReceiptKind => (q === 'fiscal' ? 'FISCAL' : 'PRECHECK');

// Chek ma'lumotini (DTO) qaytaradi — frontend HTML chekni chizadi
receiptsRouter.get(
  '/order/:id',
  validate({ query: z.object({ kind: z.enum(['precheck', 'fiscal']).optional() }) }),
  asyncHandler(async (req, res) => {
    const dto = await receiptsService.build(req.params.id, kindOf(req.query.kind));
    ok(res, dto);
  }),
);

// Termal printer uchun tayyor ESC/POS matn oqimi (network/USB printerga yuborish uchun)
receiptsRouter.get(
  '/order/:id/escpos',
  validate({ query: z.object({ kind: z.enum(['precheck', 'fiscal']).optional(), width: z.coerce.number().optional() }) }),
  asyncHandler(async (req, res) => {
    const dto = await receiptsService.build(req.params.id, kindOf(req.query.kind));
    const text = receiptsService.renderEscPos(dto, Number(req.query.width) || 42);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(text);
  }),
);
