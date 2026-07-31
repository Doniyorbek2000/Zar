import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const Z = () => new Prisma.Decimal(0);

interface Range {
  from: Date;
  to: Date;
}

export const reportsService = {
  // Umumiy dashboard: bugungi sotuv, buyurtmalar, o'rtacha chek
  async dashboard(branchId: string, range: Range) {
    const paidOrders = await prisma.order.findMany({
      where: { branchId, status: 'PAID', closedAt: { gte: range.from, lte: range.to } },
      include: { items: true },
    });

    const revenue = paidOrders.reduce((s, o) => s.add(o.total), Z());
    const cost = paidOrders.reduce(
      (s, o) => s.add(o.items.reduce((is, it) => is.add(it.cost.mul(it.quantity)), Z())),
      Z(),
    );
    const profit = revenue.sub(cost);
    const guests = paidOrders.reduce((s, o) => s + o.guests, 0);
    const ordersCount = paidOrders.length;

    return {
      revenue: revenue.toFixed(2),
      cost: cost.toFixed(2),
      profit: profit.toFixed(2),
      marginPct: revenue.greaterThan(0) ? profit.div(revenue).mul(100).toFixed(1) : '0.0',
      ordersCount,
      guests,
      averageCheck: ordersCount > 0 ? revenue.div(ordersCount).toFixed(2) : '0.00',
    };
  },

  // Kunlik sotuv dinamikasi (grafik uchun)
  async salesByDay(branchId: string, range: Range) {
    const orders = await prisma.order.findMany({
      where: { branchId, status: 'PAID', closedAt: { gte: range.from, lte: range.to } },
      select: { total: true, closedAt: true },
    });
    const byDay = new Map<string, Prisma.Decimal>();
    for (const o of orders) {
      const key = (o.closedAt ?? new Date()).toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? Z()).add(o.total));
    }
    return [...byDay.entries()]
      .map(([date, total]) => ({ date, total: total.toFixed(2) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  // Taomlar bo'yicha ABC-analiz (sotuv summasi va soni)
  async topProducts(branchId: string, range: Range, limit = 20) {
    const items = await prisma.orderItem.findMany({
      where: {
        status: { not: 'CANCELLED' },
        order: { branchId, status: 'PAID', closedAt: { gte: range.from, lte: range.to } },
      },
      select: { productId: true, name: true, quantity: true, unitPrice: true, cost: true },
    });

    const map = new Map<
      string,
      { name: string; qty: Prisma.Decimal; revenue: Prisma.Decimal; cost: Prisma.Decimal }
    >();
    for (const it of items) {
      const cur = map.get(it.productId) ?? { name: it.name, qty: Z(), revenue: Z(), cost: Z() };
      cur.qty = cur.qty.add(it.quantity);
      cur.revenue = cur.revenue.add(it.unitPrice.mul(it.quantity));
      cur.cost = cur.cost.add(it.cost.mul(it.quantity));
      map.set(it.productId, cur);
    }

    return [...map.entries()]
      .map(([productId, v]) => ({
        productId,
        name: v.name,
        quantity: v.qty.toFixed(2),
        revenue: v.revenue.toFixed(2),
        profit: v.revenue.sub(v.cost).toFixed(2),
      }))
      .sort((a, b) => Number(b.revenue) - Number(a.revenue))
      .slice(0, limit);
  },

  // Ofitsiantlar reytingi
  async waiterPerformance(branchId: string, range: Range) {
    const orders = await prisma.order.findMany({
      where: { branchId, status: 'PAID', closedAt: { gte: range.from, lte: range.to }, waiterId: { not: null } },
      select: { total: true, waiter: { select: { id: true, fullName: true } } },
    });
    const map = new Map<string, { name: string; revenue: Prisma.Decimal; orders: number }>();
    for (const o of orders) {
      if (!o.waiter) continue;
      const cur = map.get(o.waiter.id) ?? { name: o.waiter.fullName, revenue: Z(), orders: 0 };
      cur.revenue = cur.revenue.add(o.total);
      cur.orders += 1;
      map.set(o.waiter.id, cur);
    }
    return [...map.entries()]
      .map(([waiterId, v]) => ({
        waiterId,
        name: v.name,
        orders: v.orders,
        revenue: v.revenue.toFixed(2),
      }))
      .sort((a, b) => Number(b.revenue) - Number(a.revenue));
  },
};
