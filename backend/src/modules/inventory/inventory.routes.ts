import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { authenticate, authorize } from '../../middleware/auth';
import { BadRequest } from '../../lib/errors';
import { inventoryService } from './inventory.service';

export const inventoryRouter = Router();
inventoryRouter.use(authenticate);

const manage = authorize('ADMIN', 'MANAGER');
const UNIT = z.enum(['GRAM', 'KILOGRAM', 'MILLILITER', 'LITER', 'PIECE']);

function branchOf(req: { user?: { branchId: string | null }; query: Record<string, unknown> }) {
  const branchId = (req.query.branchId as string) || req.user?.branchId;
  if (!branchId) throw BadRequest('branchId aniqlanmadi');
  return branchId;
}

// ---------------- Ingredientlar ----------------
inventoryRouter.get(
  '/ingredients',
  validate({ query: z.object({ search: z.string().optional() }) }),
  asyncHandler(async (req, res) => ok(res, await inventoryService.listIngredients(req.query.search as string))),
);

inventoryRouter.post(
  '/ingredients',
  manage,
  validate({
    body: z.object({
      name: z.string().min(1),
      unit: UNIT.optional(),
      costPerUnit: z.number().nonnegative().optional(),
      minQuantity: z.number().nonnegative().optional(),
    }),
  }),
  asyncHandler(async (req, res) => ok(res, await inventoryService.createIngredient(req.body), 201)),
);

inventoryRouter.patch(
  '/ingredients/:id',
  manage,
  validate({
    body: z.object({
      name: z.string().optional(),
      unit: UNIT.optional(),
      costPerUnit: z.number().nonnegative().optional(),
      minQuantity: z.number().nonnegative().optional(),
      isActive: z.boolean().optional(),
    }),
  }),
  asyncHandler(async (req, res) => ok(res, await inventoryService.updateIngredient(req.params.id, req.body))),
);

// ---------------- Qoldiqlar ----------------
inventoryRouter.get(
  '/stock',
  asyncHandler(async (req, res) => ok(res, await inventoryService.stockLevels(branchOf(req)))),
);

inventoryRouter.get(
  '/movements',
  validate({ query: z.object({ branchId: z.string().optional(), ingredientId: z.string().optional() }) }),
  asyncHandler(async (req, res) =>
    ok(res, await inventoryService.movements(branchOf(req), req.query.ingredientId as string | undefined)),
  ),
);

// ---------------- Kirim ----------------
inventoryRouter.post(
  '/supplies',
  manage,
  validate({
    body: z.object({
      supplierId: z.string().optional(),
      docNumber: z.string().optional(),
      note: z.string().optional(),
      items: z
        .array(
          z.object({
            ingredientId: z.string(),
            quantity: z.number().positive(),
            unitPrice: z.number().nonnegative(),
          }),
        )
        .min(1),
    }),
  }),
  asyncHandler(async (req, res) =>
    ok(res, await inventoryService.createSupply(branchOf(req), req.user!.sub, req.body), 201),
  ),
);

// ---------------- Spisaniye ----------------
inventoryRouter.post(
  '/write-off',
  manage,
  validate({
    body: z.object({
      ingredientId: z.string(),
      quantity: z.number().positive(),
      reason: z.string().min(1),
    }),
  }),
  asyncHandler(async (req, res) =>
    ok(res, await inventoryService.writeOff(branchOf(req), req.user!.sub, req.body), 201),
  ),
);

// ---------------- Inventarizatsiya ----------------
inventoryRouter.post(
  '/inventory-count',
  manage,
  validate({
    body: z.object({
      items: z.array(z.object({ ingredientId: z.string(), actualQuantity: z.number().nonnegative() })).min(1),
    }),
  }),
  asyncHandler(async (req, res) =>
    ok(res, await inventoryService.inventoryCount(branchOf(req), req.user!.sub, req.body.items)),
  ),
);

// ---------------- Yetkazib beruvchilar ----------------
inventoryRouter.get(
  '/suppliers',
  asyncHandler(async (_req, res) => ok(res, await inventoryService.listSuppliers())),
);

inventoryRouter.post(
  '/suppliers',
  manage,
  validate({ body: z.object({ name: z.string().min(1), phone: z.string().optional(), inn: z.string().optional() }) }),
  asyncHandler(async (req, res) => ok(res, await inventoryService.createSupplier(req.body), 201)),
);
