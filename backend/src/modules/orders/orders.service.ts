import { OrderType, PaymentMethod, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, Conflict, NotFound } from '../../lib/errors';
import { D } from '../../lib/money';
import { computeTotals } from './orders.totals';

const ORDER_INCLUDE = {
  items: { include: { modifiers: true, product: { select: { id: true, name: true, type: true } } } },
  table: { select: { id: true, name: true, hallId: true } },
  waiter: { select: { id: true, fullName: true } },
  customer: { select: { id: true, fullName: true, discountPct: true } },
  payments: true,
} satisfies Prisma.OrderInclude;

type Tx = Prisma.TransactionClient;

// Buyurtma summalarini DB da yangilaydi
async function recalc(tx: Tx, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { include: { modifiers: true } } },
  });
  const totals = computeTotals(order);
  return tx.order.update({
    where: { id: orderId },
    data: {
      subtotal: totals.subtotal,
      discountAmt: totals.discountAmt,
      serviceFeeAmt: totals.serviceFeeAmt,
      total: totals.total,
    },
    include: ORDER_INCLUDE,
  });
}

export const ordersService = {
  listActive(branchId: string) {
    return prisma.order.findMany({
      where: { branchId, status: { in: ['OPEN', 'SENT', 'READY'] } },
      include: ORDER_INCLUDE,
      orderBy: { openedAt: 'asc' },
    });
  },

  async get(id: string) {
    const order = await prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!order) throw NotFound('Buyurtma topilmadi');
    return order;
  },

  // Yangi buyurtma ochish
  async create(
    branchId: string,
    userId: string,
    data: { type?: OrderType; tableId?: string; waiterId?: string; guests?: number; customerId?: string },
  ) {
    return prisma.$transaction(async (tx) => {
      if (data.tableId) {
        const busy = await tx.order.findFirst({
          where: { tableId: data.tableId, status: { in: ['OPEN', 'SENT', 'READY'] } },
        });
        if (busy) throw Conflict('Bu stol allaqachon band');
      }

      const last = await tx.order.findFirst({
        where: { branchId },
        orderBy: { number: 'desc' },
        select: { number: true },
      });
      const number = (last?.number ?? 0) + 1;

      const order = await tx.order.create({
        data: {
          branchId,
          number,
          type: data.type ?? 'DINE_IN',
          tableId: data.tableId,
          waiterId: data.waiterId ?? userId,
          openedById: userId,
          guests: data.guests ?? 1,
          customerId: data.customerId,
        },
        include: ORDER_INCLUDE,
      });

      if (data.tableId) {
        await tx.table.update({ where: { id: data.tableId }, data: { status: 'OCCUPIED' } });
      }
      return order;
    });
  },

  // Buyurtmaga taom qo'shish (narx va tannarx "surat" sifatida saqlanadi)
  async addItem(
    orderId: string,
    data: { productId: string; quantity?: number; modifierIds?: string[]; note?: string },
  ) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      if (order.status === 'PAID' || order.status === 'CANCELLED') {
        throw Conflict('Yopilgan buyurtmani o\'zgartirib bo\'lmaydi');
      }

      const product = await tx.product.findUnique({ where: { id: data.productId } });
      if (!product) throw NotFound('Taom topilmadi');
      if (!product.isActive || product.inStopList) throw BadRequest('Taom hozircha mavjud emas (stop-list)');

      // Texkarta bo'yicha tannarxni hisoblash
      const recipe = await tx.recipeItem.findMany({
        where: { productId: product.id },
        include: { ingredient: true },
      });
      const cost = recipe.reduce(
        (sum, r) => sum.add(r.quantity.mul(r.ingredient.costPerUnit)),
        new Prisma.Decimal(0),
      );

      const modifiers = data.modifierIds?.length
        ? await tx.modifier.findMany({ where: { id: { in: data.modifierIds } } })
        : [];

      await tx.orderItem.create({
        data: {
          orderId,
          productId: product.id,
          name: product.name,
          quantity: D(data.quantity ?? 1),
          unitPrice: product.price,
          cost,
          note: data.note,
          modifiers: {
            create: modifiers.map((m) => ({ modifierId: m.id, name: m.name, price: m.price })),
          },
        },
      });

      return recalc(tx, orderId);
    });
  },

  async updateItem(orderId: string, itemId: string, data: { quantity?: number; note?: string }) {
    return prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.findUnique({ where: { id: itemId } });
      if (!item || item.orderId !== orderId) throw NotFound('Buyurtma qatori topilmadi');
      await tx.orderItem.update({
        where: { id: itemId },
        data: {
          ...(data.quantity != null ? { quantity: D(data.quantity) } : {}),
          ...(data.note != null ? { note: data.note } : {}),
        },
      });
      return recalc(tx, orderId);
    });
  },

  async removeItem(orderId: string, itemId: string) {
    return prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.findUnique({ where: { id: itemId } });
      if (!item || item.orderId !== orderId) throw NotFound('Buyurtma qatori topilmadi');
      // Oshxonaga yuborilgan taomni o'chirmaymiz, bekor qilamiz (audit uchun)
      if (item.status === 'SENT' || item.status === 'READY' || item.status === 'SERVED') {
        await tx.orderItem.update({ where: { id: itemId }, data: { status: 'CANCELLED' } });
      } else {
        await tx.orderItem.delete({ where: { id: itemId } });
      }
      return recalc(tx, orderId);
    });
  },

  async setDiscount(orderId: string, discountPct: number) {
    if (discountPct < 0 || discountPct > 100) throw BadRequest('Chegirma 0-100% oralig\'ida bo\'lishi kerak');
    await prisma.order.update({ where: { id: orderId }, data: { discountPct: D(discountPct) } });
    return prisma.$transaction((tx) => recalc(tx, orderId));
  },

  async setServiceFee(orderId: string, serviceFeePct: number) {
    if (serviceFeePct < 0 || serviceFeePct > 100) throw BadRequest('Xizmat haqi 0-100% oralig\'ida bo\'lishi kerak');
    await prisma.order.update({ where: { id: orderId }, data: { serviceFeePct: D(serviceFeePct) } });
    return prisma.$transaction((tx) => recalc(tx, orderId));
  },

  // Oshxonaga yuborish (KDS)
  async sendToKitchen(orderId: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      if (order.status === 'PAID' || order.status === 'CANCELLED') throw Conflict('Buyurtma yopilgan');
      await tx.orderItem.updateMany({ where: { orderId, status: 'NEW' }, data: { status: 'SENT' } });
      await tx.order.update({ where: { id: orderId }, data: { status: 'SENT' } });
      return recalc(tx, orderId);
    });
  },

  // To'lov qabul qilish; to'liq to'langanda ombordan hisobdan chiqaradi va yopadi
  async pay(
    orderId: string,
    userId: string,
    payments: { method: PaymentMethod; amount: number }[],
  ) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: { include: { modifiers: true } }, payments: true },
      });
      if (order.status === 'PAID') throw Conflict('Buyurtma allaqachon to\'langan');
      if (order.status === 'CANCELLED') throw Conflict('Buyurtma bekor qilingan');

      const totals = computeTotals(order);
      const alreadyPaid = order.payments.reduce((s, p) => s.add(p.amount), new Prisma.Decimal(0));
      const nowPaid = payments.reduce((s, p) => s.add(D(p.amount)), new Prisma.Decimal(0));
      const totalPaid = alreadyPaid.add(nowPaid);

      if (totalPaid.lessThan(totals.total)) {
        throw BadRequest(
          `To'lov yetarli emas: kerak ${totals.total.toFixed(2)}, to'landi ${totalPaid.toFixed(2)}`,
        );
      }

      // Ochiq smenani topish (naqd to'lovlarni bog'lash uchun)
      const shift = await tx.shift.findFirst({
        where: { branchId: order.branchId, status: 'OPEN' },
        orderBy: { openedAt: 'desc' },
      });

      await tx.payment.createMany({
        data: payments.map((p) => ({
          orderId,
          shiftId: shift?.id,
          userId,
          method: p.method,
          amount: D(p.amount),
        })),
      });

      // Ombordan hisobdan chiqarish: har bir (bekor qilinmagan) qator uchun texkarta
      for (const item of order.items) {
        if (item.status === 'CANCELLED') continue;
        const recipe = await tx.recipeItem.findMany({ where: { productId: item.productId } });
        for (const r of recipe) {
          const qtyOut = r.quantity.mul(item.quantity);
          await tx.stock.upsert({
            where: { branchId_ingredientId: { branchId: order.branchId, ingredientId: r.ingredientId } },
            create: { branchId: order.branchId, ingredientId: r.ingredientId, quantity: qtyOut.negated() },
            update: { quantity: { decrement: qtyOut } },
          });
          await tx.stockMovement.create({
            data: {
              branchId: order.branchId,
              ingredientId: r.ingredientId,
              type: 'SALE',
              quantity: qtyOut.negated(),
              orderId,
              userId,
              reason: `Sotuv #${order.number}`,
            },
          });
        }
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: 'PAID', closedAt: new Date() },
        include: ORDER_INCLUDE,
      });

      if (order.tableId) {
        await tx.table.update({ where: { id: order.tableId }, data: { status: 'FREE' } });
      }

      const change = totalPaid.sub(totals.total);
      return { order: updated, change: change.toFixed(2) };
    });
  },

  async cancel(orderId: string, reason?: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      if (order.status === 'PAID') throw Conflict('To\'langan buyurtmani bekor qilib bo\'lmaydi');
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED', closedAt: new Date(), note: reason ?? order.note },
        include: ORDER_INCLUDE,
      });
      if (order.tableId) {
        await tx.table.update({ where: { id: order.tableId }, data: { status: 'FREE' } });
      }
      return updated;
    });
  },

  // Stolni ko'chirish
  async moveTable(orderId: string, tableId: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      const busy = await tx.order.findFirst({
        where: { tableId, status: { in: ['OPEN', 'SENT', 'READY'] }, id: { not: orderId } },
      });
      if (busy) throw Conflict('Maqsad stol band');
      if (order.tableId) await tx.table.update({ where: { id: order.tableId }, data: { status: 'FREE' } });
      await tx.table.update({ where: { id: tableId }, data: { status: 'OCCUPIED' } });
      return tx.order.update({ where: { id: orderId }, data: { tableId }, include: ORDER_INCLUDE });
    });
  },
};
