import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { AppError, NotFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { ordersService } from '../orders/orders.service';

// Public API — QR menyu va mijozning o'z-o'zi zakaz berishi (auth talab qilinmaydi)
export const publicRouter = Router();

// Stol ma'lumoti (QR faqat tableId ni kodlaydi)
publicRouter.get(
  '/table/:tableId',
  asyncHandler(async (req, res) => {
    const table = await prisma.table.findUnique({
      where: { id: req.params.tableId },
      include: { hall: { include: { branch: { include: { company: true } } } } },
    });
    if (!table) throw NotFound('Stol topilmadi');
    ok(res, {
      tableId: table.id,
      tableName: table.name,
      branchId: table.hall.branchId,
      branchName: table.hall.branch.name,
      companyName: table.hall.branch.company.name,
    });
  }),
);

// Ochiq menyu (kategoriyalar + faol taomlar)
publicRouter.get(
  '/menu',
  validate({ query: z.object({ branchId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const branchId = req.query.branchId as string;
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, include: { company: true } });
    if (!branch) throw NotFound('Filial topilmadi');

    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        categoryId: true,
        name: true,
        description: true,
        price: true,
        imageUrl: true,
        unit: true,
        inStopList: true,
      },
      orderBy: { name: 'asc' },
    });

    ok(res, {
      company: { name: branch.company.name },
      branch: { id: branch.id, name: branch.name },
      categories,
      products,
    });
  }),
);

// Mijozning o'z-o'zi zakaz berishi (stol QR orqali)
publicRouter.post(
  '/orders',
  validate({
    body: z.object({
      tableId: z.string().min(1),
      customerName: z.string().optional(),
      customerPhone: z.string().optional(),
      note: z.string().optional(),
      items: z
        .array(z.object({ productId: z.string(), quantity: z.number().int().positive().max(50), note: z.string().optional() }))
        .min(1)
        .max(50),
    }),
  }),
  asyncHandler(async (req, res) => {
    const table = await prisma.table.findUnique({
      where: { id: req.body.tableId },
      include: { hall: true },
    });
    if (!table) throw NotFound('Stol topilmadi');
    const branchId = table.hall.branchId;

    // Mavjud ochiq buyurtmaga qo'shamiz yoki yangi ochamiz
    let order = await prisma.order.findFirst({
      where: { tableId: table.id, status: { in: ['OPEN', 'SENT', 'READY'] } },
    });
    if (!order) {
      order = await ordersService.create(branchId, null, {
        type: 'DINE_IN',
        source: 'QR',
        tableId: table.id,
        customerName: req.body.customerName,
        customerPhone: req.body.customerPhone,
        note: req.body.note,
      });
    }

    for (const item of req.body.items) {
      try {
        await ordersService.addItem(order.id, {
          productId: item.productId,
          quantity: item.quantity,
          note: item.note,
        });
      } catch (e) {
        // stop-listdagi yoki nofaol taomlarni e'tiborsiz qoldiramiz
        if (e instanceof AppError && e.statusCode < 500) continue;
        throw e;
      }
    }

    const fresh = await prisma.order.findUnique({
      where: { id: order.id },
      select: { id: true, number: true, total: true, status: true },
    });
    ok(res, { message: 'Buyurtma qabul qilindi', order: fresh }, 201);
  }),
);
