import { Prisma } from '@prisma/client';
import { round2 } from '../../lib/money';

const Z = () => new Prisma.Decimal(0);

export interface OrderItemLike {
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  status: string;
  modifiers: { price: Prisma.Decimal }[];
}

export interface OrderLike {
  discountPct: Prisma.Decimal;
  serviceFeePct: Prisma.Decimal;
  items: OrderItemLike[];
}

export interface Totals {
  subtotal: Prisma.Decimal;
  discountAmt: Prisma.Decimal;
  serviceFeeAmt: Prisma.Decimal;
  total: Prisma.Decimal;
}

// Buyurtma summalarini qayta hisoblaydi (bekor qilinganlarni hisobga olmaydi)
export function computeTotals(order: OrderLike): Totals {
  const subtotal = order.items.reduce((sum, item) => {
    if (item.status === 'CANCELLED') return sum;
    const mods = item.modifiers.reduce((s, m) => s.add(m.price), Z());
    const line = item.unitPrice.add(mods).mul(item.quantity);
    return sum.add(line);
  }, Z());

  const discountAmt = round2(subtotal.mul(order.discountPct).div(100));
  const afterDiscount = subtotal.sub(discountAmt);
  const serviceFeeAmt = round2(afterDiscount.mul(order.serviceFeePct).div(100));
  const total = round2(afterDiscount.add(serviceFeeAmt));

  return { subtotal: round2(subtotal), discountAmt, serviceFeeAmt, total };
}
