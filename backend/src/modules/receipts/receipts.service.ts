import { prisma } from '../../lib/prisma';
import { NotFound } from '../../lib/errors';
import { toNum } from '../../lib/money';

export type ReceiptKind = 'PRECHECK' | 'FISCAL';

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Naqd',
  CARD: 'Karta',
  TRANSFER: 'O\'tkazma',
  BONUS: 'Bonus',
};
const TYPE_LABEL: Record<string, string> = {
  DINE_IN: 'Zalda',
  TAKEAWAY: 'Olib ketish',
  DELIVERY: 'Yetkazib berish',
};

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  modifiers: { name: string; price: number }[];
}

export interface ReceiptDto {
  kind: ReceiptKind;
  title: string;
  currency: string;
  company: { name: string };
  branch: { name: string; address?: string | null; phone?: string | null };
  order: {
    number: number;
    typeLabel: string;
    table?: string | null;
    waiter?: string | null;
    guests: number;
    openedAt: string;
    closedAt?: string | null;
  };
  items: ReceiptItem[];
  subtotal: number;
  discountPct: number;
  discountAmt: number;
  serviceFeePct: number;
  serviceFeeAmt: number;
  total: number;
  payments: { methodLabel: string; amount: number }[];
  paid: number;
  change: number;
  cashier?: string | null;
  printedAt: string;
  footer: string;
}

export const receiptsService = {
  async build(orderId: string, kind: ReceiptKind): Promise<ReceiptDto> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        branch: { include: { company: true } },
        table: true,
        waiter: true,
        openedBy: true,
        customer: true,
        items: {
          where: { status: { not: 'CANCELLED' } },
          include: { modifiers: true },
          orderBy: { createdAt: 'asc' },
        },
        payments: { include: { user: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order) throw NotFound('Buyurtma topilmadi');

    const items: ReceiptItem[] = order.items.map((it) => {
      const modsPrice = it.modifiers.reduce((s, m) => s + toNum(m.price), 0);
      const line = (toNum(it.unitPrice) + modsPrice) * toNum(it.quantity);
      return {
        name: it.name,
        quantity: toNum(it.quantity),
        unitPrice: toNum(it.unitPrice),
        total: line,
        modifiers: it.modifiers.map((m) => ({ name: m.name, price: toNum(m.price) })),
      };
    });

    const paid = order.payments.reduce((s, p) => s + toNum(p.amount), 0);
    const total = toNum(order.total);
    const cashier =
      order.payments[order.payments.length - 1]?.user?.fullName ?? order.openedBy?.fullName ?? null;

    return {
      kind,
      title: kind === 'FISCAL' ? 'CHEK' : 'HISOB (pre-check)',
      currency: order.branch.company.currency,
      company: { name: order.branch.company.name },
      branch: { name: order.branch.name, address: order.branch.address, phone: order.branch.phone },
      order: {
        number: order.number,
        typeLabel: TYPE_LABEL[order.type] ?? order.type,
        table: order.table?.name ?? null,
        waiter: order.waiter?.fullName ?? null,
        guests: order.guests,
        openedAt: order.openedAt.toISOString(),
        closedAt: order.closedAt?.toISOString() ?? null,
      },
      items,
      subtotal: toNum(order.subtotal),
      discountPct: toNum(order.discountPct),
      discountAmt: toNum(order.discountAmt),
      serviceFeePct: toNum(order.serviceFeePct),
      serviceFeeAmt: toNum(order.serviceFeeAmt),
      total,
      payments: order.payments.map((p) => ({
        methodLabel: METHOD_LABEL[p.method] ?? p.method,
        amount: toNum(p.amount),
      })),
      paid,
      change: kind === 'FISCAL' ? Math.max(0, paid - total) : 0,
      cashier,
      printedAt: new Date().toISOString(),
      footer: kind === 'FISCAL' ? 'Xaridingiz uchun rahmat!' : 'Bu fiskal chek emas',
    };
  },

  // Termal printer (58/80mm) uchun ESC/POS matn oqimini generatsiya qiladi
  renderEscPos(dto: ReceiptDto, width = 42): string {
    const ESC = '\x1B';
    const GS = '\x1D';
    const init = ESC + '@'; // printerni tiklash
    const center = ESC + 'a' + '\x01';
    const left = ESC + 'a' + '\x00';
    const boldOn = ESC + 'E' + '\x01';
    const boldOff = ESC + 'E' + '\x00';
    const cut = GS + 'V' + '\x00';

    const line = (ch = '-') => ch.repeat(width);
    // Chap va o'ng tomonga tekislangan qator
    const lr = (l: string, r: string) => {
      const space = Math.max(1, width - l.length - r.length);
      return l + ' '.repeat(space) + r;
    };
    // Printer-xavfsiz: minglik ajratgich sifatida oddiy bo'shliq (nbsp emas)
    const money = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    let out = init + center + boldOn + dto.company.name + '\n' + boldOff;
    out += dto.branch.name + '\n';
    if (dto.branch.phone) out += dto.branch.phone + '\n';
    out += line() + '\n' + boldOn + dto.title + '\n' + boldOff + left;
    out += lr(`Buyurtma #${dto.order.number}`, dto.order.typeLabel) + '\n';
    if (dto.order.table) out += `Stol: ${dto.order.table}\n`;
    if (dto.order.waiter) out += `Ofitsiant: ${dto.order.waiter}\n`;
    out += `Sana: ${new Date(dto.printedAt).toLocaleString('uz-UZ')}\n`;
    out += line() + '\n';

    for (const it of dto.items) {
      out += it.name + '\n';
      out += lr(`  ${it.quantity} x ${money(it.unitPrice)}`, money(it.total)) + '\n';
      for (const m of it.modifiers) out += lr(`  + ${m.name}`, money(m.price)) + '\n';
    }

    out += line() + '\n';
    out += lr('Oraliq summa', money(dto.subtotal)) + '\n';
    if (dto.discountAmt > 0) out += lr(`Chegirma ${dto.discountPct}%`, '-' + money(dto.discountAmt)) + '\n';
    if (dto.serviceFeeAmt > 0) out += lr(`Xizmat haqi ${dto.serviceFeePct}%`, money(dto.serviceFeeAmt)) + '\n';
    out += boldOn + lr('JAMI', money(dto.total) + ' ' + dto.currency) + '\n' + boldOff;

    if (dto.kind === 'FISCAL') {
      out += line() + '\n';
      for (const p of dto.payments) out += lr(p.methodLabel, money(p.amount)) + '\n';
      if (dto.change > 0) out += lr('Qaytim', money(dto.change)) + '\n';
    }
    if (dto.cashier) out += `Kassir: ${dto.cashier}\n`;

    out += line() + '\n' + center + dto.footer + '\n\n\n' + cut;
    return out;
  },
};
