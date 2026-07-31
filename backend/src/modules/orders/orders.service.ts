import { DeliveryStatus, OrderSource, OrderType, PaymentMethod, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, Conflict, NotFound } from '../../lib/errors';
import { D } from '../../lib/money';
import { computeTotals } from './orders.totals';
import { realtime } from '../../realtime/realtime';
import { settingsService } from '../settings/settings.service';

const ORDER_INCLUDE = {
  items: { include: { modifiers: true, product: { select: { id: true, name: true, type: true } } } },
  table: { select: { id: true, name: true, hallId: true } },
  waiter: { select: { id: true, fullName: true } },
  courier: { select: { id: true, fullName: true, phone: true } },
  customer: { select: { id: true, fullName: true, phone: true, discountPct: true, bonusBalance: true } },
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

  // Yangi buyurtma ochish (POS, telefon, QR)
  async create(
    branchId: string,
    userId: string | null,
    data: {
      type?: OrderType;
      source?: OrderSource;
      tableId?: string;
      waiterId?: string;
      guests?: number;
      customerId?: string;
      customerName?: string;
      customerPhone?: string;
      deliveryAddress?: string;
      deliveryFee?: number;
      note?: string;
    },
  ) {
    const isDelivery = data.type === 'DELIVERY';
    const defaultFee = isDelivery ? await settingsService.getNumber('delivery.defaultFee') : 0;

    // Mijoz biriktirilsa — chegirmasini avtomatik qo'llaymiz
    let discountPct = 0;
    if (data.customerId) {
      const c = await prisma.customer.findUnique({ where: { id: data.customerId } });
      discountPct = c ? Number(c.discountPct) : 0;
    }

    const order = await prisma.$transaction(async (tx) => {
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

      const created = await tx.order.create({
        data: {
          branchId,
          number,
          type: data.type ?? 'DINE_IN',
          source: data.source ?? 'POS',
          tableId: data.tableId,
          waiterId: data.waiterId ?? userId ?? undefined,
          openedById: userId ?? undefined,
          guests: data.guests ?? 1,
          customerId: data.customerId,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          deliveryAddress: data.deliveryAddress,
          deliveryFee: D(data.deliveryFee ?? defaultFee),
          deliveryStatus: isDelivery ? 'PENDING' : null,
          discountPct: D(discountPct),
          note: data.note,
        },
        include: ORDER_INCLUDE,
      });

      if (data.tableId) {
        await tx.table.update({ where: { id: data.tableId }, data: { status: 'OCCUPIED' } });
      }
      // Yetkazish narxi total'da darhol aks etishi uchun qayta hisoblaymiz
      return recalc(tx, created.id);
    });

    realtime.emitToBranch(branchId, 'tables:changed');
    realtime.emitToBranch(branchId, 'order:changed', { orderId: order.id });
    if (isDelivery) realtime.emitToBranch(branchId, 'delivery:changed');
    return order;
  },

  // Mijozni biriktirish + chegirmani qo'llash
  async setCustomer(orderId: string, customerId: string | null) {
    const customer = customerId ? await prisma.customer.findUnique({ where: { id: customerId } }) : null;
    if (customerId && !customer) throw NotFound('Mijoz topilmadi');
    await prisma.order.update({
      where: { id: orderId },
      data: {
        customerId,
        discountPct: customer ? customer.discountPct : new Prisma.Decimal(0),
        ...(customer?.phone ? { customerPhone: customer.phone } : {}),
        ...(customer ? { customerName: customer.fullName } : {}),
      },
    });
    const result = await prisma.$transaction((tx) => recalc(tx, orderId));
    realtime.emitToBranch(result.branchId, 'order:changed', { orderId });
    return result;
  },

  // Dostavka ma'lumotlarini yangilash
  async setDelivery(
    orderId: string,
    data: { customerName?: string; customerPhone?: string; deliveryAddress?: string; deliveryFee?: number },
  ) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        ...(data.customerName != null ? { customerName: data.customerName } : {}),
        ...(data.customerPhone != null ? { customerPhone: data.customerPhone } : {}),
        ...(data.deliveryAddress != null ? { deliveryAddress: data.deliveryAddress } : {}),
        ...(data.deliveryFee != null ? { deliveryFee: D(data.deliveryFee) } : {}),
      },
    });
    const result = await prisma.$transaction((tx) => recalc(tx, orderId));
    realtime.emitToBranch(result.branchId, 'order:changed', { orderId });
    realtime.emitToBranch(result.branchId, 'delivery:changed');
    return result;
  },

  // Kuryer tayinlash / yetkazish holatini o'zgartirish
  async updateDelivery(orderId: string, data: { courierId?: string | null; deliveryStatus?: DeliveryStatus }) {
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        ...(data.courierId !== undefined ? { courierId: data.courierId } : {}),
        ...(data.deliveryStatus ? { deliveryStatus: data.deliveryStatus } : {}),
        ...(data.courierId && !data.deliveryStatus ? { deliveryStatus: 'ASSIGNED' } : {}),
      },
      include: ORDER_INCLUDE,
    });
    realtime.emitToBranch(updated.branchId, 'delivery:changed');
    realtime.emitToBranch(updated.branchId, 'order:changed', { orderId });
    return updated;
  },

  // Buyurtmaga taom qo'shish (narx va tannarx "surat" sifatida saqlanadi)
  async addItem(
    orderId: string,
    data: { productId: string; quantity?: number; modifierIds?: string[]; note?: string },
  ) {
    const result = await prisma.$transaction(async (tx) => {
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

    realtime.emitToBranch(result.branchId, 'order:changed', { orderId });
    return result;
  },

  async updateItem(orderId: string, itemId: string, data: { quantity?: number; note?: string }) {
    const result = await prisma.$transaction(async (tx) => {
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

    realtime.emitToBranch(result.branchId, 'order:changed', { orderId });
    return result;
  },

  async removeItem(orderId: string, itemId: string) {
    const result = await prisma.$transaction(async (tx) => {
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

    realtime.emitToBranch(result.branchId, 'order:changed', { orderId });
    realtime.emitToBranch(result.branchId, 'kds:changed');
    return result;
  },

  async setDiscount(orderId: string, discountPct: number) {
    if (discountPct < 0 || discountPct > 100) throw BadRequest('Chegirma 0-100% oralig\'ida bo\'lishi kerak');
    await prisma.order.update({ where: { id: orderId }, data: { discountPct: D(discountPct) } });
    const result = await prisma.$transaction((tx) => recalc(tx, orderId));
    realtime.emitToBranch(result.branchId, 'order:changed', { orderId });
    return result;
  },

  async setServiceFee(orderId: string, serviceFeePct: number) {
    if (serviceFeePct < 0 || serviceFeePct > 100) throw BadRequest('Xizmat haqi 0-100% oralig\'ida bo\'lishi kerak');
    await prisma.order.update({ where: { id: orderId }, data: { serviceFeePct: D(serviceFeePct) } });
    const result = await prisma.$transaction((tx) => recalc(tx, orderId));
    realtime.emitToBranch(result.branchId, 'order:changed', { orderId });
    return result;
  },

  // Oshxonaga yuborish (KDS)
  async sendToKitchen(orderId: string) {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      if (order.status === 'PAID' || order.status === 'CANCELLED') throw Conflict('Buyurtma yopilgan');
      await tx.orderItem.updateMany({ where: { orderId, status: 'NEW' }, data: { status: 'SENT' } });
      await tx.order.update({ where: { id: orderId }, data: { status: 'SENT' } });
      return recalc(tx, orderId);
    });

    realtime.emitToBranch(result.branchId, 'order:changed', { orderId });
    realtime.emitToBranch(result.branchId, 'kds:changed');
    realtime.emitToBranch(result.branchId, 'tables:changed');
    return result;
  },

  // To'lov qabul qilish; to'liq to'langanda ombordan hisobdan chiqaradi va yopadi
  async pay(
    orderId: string,
    userId: string,
    payments: { method: PaymentMethod; amount: number }[],
  ) {
    // Loyalty sozlamalari
    const earnPct = await settingsService.getNumber('loyalty.earnPct');
    const redeemEnabled = await settingsService.getBool('loyalty.redeemEnabled');

    const result = await prisma.$transaction(async (tx) => {
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

      // Bonus bilan to'lov (REDEEM) tekshiruvi
      const bonusRedeemed = payments
        .filter((p) => p.method === 'BONUS')
        .reduce((s, p) => s.add(D(p.amount)), new Prisma.Decimal(0));
      if (bonusRedeemed.greaterThan(0)) {
        if (!redeemEnabled) throw BadRequest('Bonus bilan to\'lov o\'chirilgan');
        if (!order.customerId) throw BadRequest('Bonus ishlatish uchun mijoz biriktirilishi kerak');
        const c = await tx.customer.findUniqueOrThrow({ where: { id: order.customerId } });
        if (c.bonusBalance.lessThan(bonusRedeemed)) throw BadRequest('Bonus balansi yetarli emas');
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

      // Loyalty: bonus ishlatish (REDEEM) va to'plash (EARN)
      let earned = new Prisma.Decimal(0);
      if (order.customerId) {
        const customer = await tx.customer.findUniqueOrThrow({ where: { id: order.customerId } });
        let balance = customer.bonusBalance;

        if (bonusRedeemed.greaterThan(0)) {
          balance = balance.sub(bonusRedeemed);
          await tx.bonusTransaction.create({
            data: {
              customerId: order.customerId,
              orderId,
              type: 'REDEEM',
              amount: bonusRedeemed.negated(),
              balanceAfter: balance,
              note: `Buyurtma #${order.number}`,
            },
          });
        }

        // Cashback faqat bonusdan tashqari to'langan qismga
        const earnBase = totals.total.sub(bonusRedeemed);
        earned = earnBase.mul(earnPct).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
        if (earned.greaterThan(0)) {
          balance = balance.add(earned);
          await tx.bonusTransaction.create({
            data: {
              customerId: order.customerId,
              orderId,
              type: 'EARN',
              amount: earned,
              balanceAfter: balance,
              note: `Buyurtma #${order.number} · cashback ${earnPct}%`,
            },
          });
        }
        await tx.customer.update({ where: { id: order.customerId }, data: { bonusBalance: balance } });
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'PAID',
          closedAt: new Date(),
          bonusEarned: earned,
          bonusRedeemed,
          ...(order.type === 'DELIVERY' ? { deliveryStatus: 'DELIVERED' } : {}),
        },
        include: ORDER_INCLUDE,
      });

      if (order.tableId) {
        await tx.table.update({ where: { id: order.tableId }, data: { status: 'FREE' } });
      }

      const change = totalPaid.sub(totals.total);
      return { order: updated, change: change.toFixed(2), bonusEarned: earned.toFixed(2) };
    });

    const branchId = result.order.branchId;
    realtime.emitToBranch(branchId, 'tables:changed');
    realtime.emitToBranch(branchId, 'order:changed', { orderId });
    realtime.emitToBranch(branchId, 'kds:changed');
    realtime.emitToBranch(branchId, 'stock:changed');
    realtime.emitToBranch(branchId, 'delivery:changed');
    return result;
  },

  async cancel(orderId: string, reason?: string) {
    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      if (order.status === 'PAID') throw Conflict('To\'langan buyurtmani bekor qilib bo\'lmaydi');
      const res = await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED', closedAt: new Date(), note: reason ?? order.note },
        include: ORDER_INCLUDE,
      });
      if (order.tableId) {
        await tx.table.update({ where: { id: order.tableId }, data: { status: 'FREE' } });
      }
      return res;
    });

    realtime.emitToBranch(updated.branchId, 'tables:changed');
    realtime.emitToBranch(updated.branchId, 'order:changed', { orderId });
    realtime.emitToBranch(updated.branchId, 'kds:changed');
    return updated;
  },

  // Stolni ko'chirish
  async moveTable(orderId: string, tableId: string) {
    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      const busy = await tx.order.findFirst({
        where: { tableId, status: { in: ['OPEN', 'SENT', 'READY'] }, id: { not: orderId } },
      });
      if (busy) throw Conflict('Maqsad stol band');
      if (order.tableId) await tx.table.update({ where: { id: order.tableId }, data: { status: 'FREE' } });
      await tx.table.update({ where: { id: tableId }, data: { status: 'OCCUPIED' } });
      return tx.order.update({ where: { id: orderId }, data: { tableId }, include: ORDER_INCLUDE });
    });

    realtime.emitToBranch(updated.branchId, 'tables:changed');
    realtime.emitToBranch(updated.branchId, 'order:changed', { orderId });
    return updated;
  },
};
