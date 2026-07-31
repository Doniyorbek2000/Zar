import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { authenticate, authorize } from '../../middleware/auth';
import { catalogService } from './catalog.service';

export const catalogRouter = Router();
catalogRouter.use(authenticate);

const manage = authorize('ADMIN', 'MANAGER');

// ---------------- Kategoriyalar ----------------
catalogRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => ok(res, await catalogService.listCategories())),
);

catalogRouter.post(
  '/categories',
  manage,
  validate({
    body: z.object({ name: z.string().min(1), color: z.string().optional(), sortOrder: z.number().optional() }),
  }),
  asyncHandler(async (req, res) => ok(res, await catalogService.createCategory(req.body), 201)),
);

catalogRouter.patch(
  '/categories/:id',
  manage,
  validate({
    body: z.object({
      name: z.string().min(1).optional(),
      color: z.string().optional(),
      sortOrder: z.number().optional(),
      isActive: z.boolean().optional(),
    }),
  }),
  asyncHandler(async (req, res) => ok(res, await catalogService.updateCategory(req.params.id, req.body))),
);

catalogRouter.delete(
  '/categories/:id',
  manage,
  asyncHandler(async (req, res) => ok(res, await catalogService.deleteCategory(req.params.id))),
);

// ---------------- Taomlar ----------------
catalogRouter.get(
  '/products',
  validate({
    query: z.object({
      categoryId: z.string().optional(),
      activeOnly: z.coerce.boolean().optional(),
      search: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => ok(res, await catalogService.listProducts(req.query as never))),
);

catalogRouter.get(
  '/products/:id',
  asyncHandler(async (req, res) => ok(res, await catalogService.getProduct(req.params.id))),
);

catalogRouter.post(
  '/products',
  manage,
  validate({
    body: z.object({
      categoryId: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      type: z.enum(['DISH', 'GOODS', 'PREPARATION']).optional(),
      price: z.number().nonnegative(),
      unit: z.string().optional(),
      imageUrl: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => ok(res, await catalogService.createProduct(req.body), 201)),
);

catalogRouter.patch(
  '/products/:id',
  manage,
  validate({
    body: z.object({
      categoryId: z.string().optional(),
      name: z.string().optional(),
      description: z.string().optional(),
      type: z.enum(['DISH', 'GOODS', 'PREPARATION']).optional(),
      price: z.number().nonnegative().optional(),
      unit: z.string().optional(),
      imageUrl: z.string().optional(),
      isActive: z.boolean().optional(),
      inStopList: z.boolean().optional(),
    }),
  }),
  asyncHandler(async (req, res) => ok(res, await catalogService.updateProduct(req.params.id, req.body))),
);

// Stop-list (ofitsiant/kassir ham qo'yishi mumkin)
catalogRouter.post(
  '/products/:id/stop-list',
  validate({ body: z.object({ inStopList: z.boolean() }) }),
  asyncHandler(async (req, res) => ok(res, await catalogService.setStopList(req.params.id, req.body.inStopList))),
);

catalogRouter.delete(
  '/products/:id',
  manage,
  asyncHandler(async (req, res) => ok(res, await catalogService.deleteProduct(req.params.id))),
);

// ---------------- Texkarta ----------------
catalogRouter.put(
  '/products/:id/recipe',
  manage,
  validate({
    body: z.object({
      items: z.array(z.object({ ingredientId: z.string(), quantity: z.number().positive() })),
    }),
  }),
  asyncHandler(async (req, res) => ok(res, await catalogService.setRecipe(req.params.id, req.body.items))),
);

catalogRouter.get(
  '/products/:id/cost',
  asyncHandler(async (req, res) => ok(res, { cost: (await catalogService.calcProductCost(req.params.id)).toFixed(2) })),
);

// ---------------- Modifikatorlar ----------------
catalogRouter.get(
  '/modifier-groups',
  asyncHandler(async (_req, res) => ok(res, await catalogService.listModifierGroups())),
);

catalogRouter.post(
  '/modifier-groups',
  manage,
  validate({
    body: z.object({
      name: z.string().min(1),
      minSelect: z.number().int().min(0).optional(),
      maxSelect: z.number().int().min(1).optional(),
      isRequired: z.boolean().optional(),
      modifiers: z.array(z.object({ name: z.string(), price: z.number().nonnegative() })).optional(),
    }),
  }),
  asyncHandler(async (req, res) => ok(res, await catalogService.createModifierGroup(req.body), 201)),
);

catalogRouter.post(
  '/products/:id/modifier-groups/:groupId',
  manage,
  asyncHandler(async (req, res) =>
    ok(res, await catalogService.attachModifierGroup(req.params.id, req.params.groupId)),
  ),
);

catalogRouter.delete(
  '/products/:id/modifier-groups/:groupId',
  manage,
  asyncHandler(async (req, res) =>
    ok(res, await catalogService.detachModifierGroup(req.params.id, req.params.groupId)),
  ),
);
