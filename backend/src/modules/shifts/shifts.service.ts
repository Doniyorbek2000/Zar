import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { Conflict, NotFound } from '../../lib/errors';
import { D } from '../../lib/money';

const Z = () => new Prisma.Decimal(0);

export const shiftsService = {
  async current(branchId: string) {
    return prisma.shift.findFirst({
      where: { branchId, status: 'OPEN' },
      include: { user: { select: { id: true, fullName: true } } },
      orderBy: { openedAt: 'desc' },
    });
  },

  async open(branchId: string, userId: string, openingCash: number) {
    const existing = await prisma.shift.findFirst({ where: { branchId, status: 'OPEN' } });
    if (existing) throw Conflict('Ushbu filialda smena allaqachon ochiq');
    return prisma.shift.create({
      data: { branchId, userId, openingCash: D(openingCash) },
    });
  },

  // Smenani yopish va Z-hisobotni qaytarish
  async close(shiftId: string, closingCash: number) {
    const shift = await prisma.shift.findUnique({ where: { id: shiftId }, include: { payments: true } });
    if (!shift) throw NotFound('Smena topilmadi');
    if (shift.status === 'CLOSED') throw Conflict('Smena allaqachon yopilgan');

    const byMethod = shift.payments.reduce<Record<string, Prisma.Decimal>>((acc, p) => {
      acc[p.method] = (acc[p.method] ?? Z()).add(p.amount);
      return acc;
    }, {});
    const cashSales = byMethod.CASH ?? Z();
    const expectedCash = shift.openingCash.add(cashSales);

    const updated = await prisma.shift.update({
      where: { id: shiftId },
      data: { status: 'CLOSED', closingCash: D(closingCash), closedAt: new Date() },
    });

    return {
      shift: updated,
      report: {
        openingCash: shift.openingCash.toFixed(2),
        cashSales: cashSales.toFixed(2),
        cardSales: (byMethod.CARD ?? Z()).toFixed(2),
        transferSales: (byMethod.TRANSFER ?? Z()).toFixed(2),
        totalSales: shift.payments.reduce((s, p) => s.add(p.amount), Z()).toFixed(2),
        expectedCash: expectedCash.toFixed(2),
        countedCash: D(closingCash).toFixed(2),
        difference: D(closingCash).sub(expectedCash).toFixed(2),
      },
    };
  },

  // X-hisobot (smenani yopmasdan joriy holat)
  async xReport(shiftId: string) {
    const shift = await prisma.shift.findUnique({ where: { id: shiftId }, include: { payments: true } });
    if (!shift) throw NotFound('Smena topilmadi');
    const byMethod = shift.payments.reduce<Record<string, Prisma.Decimal>>((acc, p) => {
      acc[p.method] = (acc[p.method] ?? Z()).add(p.amount);
      return acc;
    }, {});
    return {
      openingCash: shift.openingCash.toFixed(2),
      cash: (byMethod.CASH ?? Z()).toFixed(2),
      card: (byMethod.CARD ?? Z()).toFixed(2),
      transfer: (byMethod.TRANSFER ?? Z()).toFixed(2),
      total: shift.payments.reduce((s, p) => s.add(p.amount), Z()).toFixed(2),
      paymentsCount: shift.payments.length,
    };
  },
};
