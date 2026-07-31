import { prisma } from '../../lib/prisma';

export const tablesService = {
  // Zalni stollari va joriy ochiq buyurtmalari bilan qaytaradi
  async listHalls(branchId: string) {
    return prisma.hall.findMany({
      where: { branchId },
      orderBy: { sortOrder: 'asc' },
      include: {
        tables: {
          orderBy: { name: 'asc' },
          include: {
            orders: {
              where: { status: { in: ['OPEN', 'SENT', 'READY'] } },
              select: { id: true, number: true, total: true, guests: true, openedAt: true },
            },
          },
        },
      },
    });
  },

  createHall(branchId: string, data: { name: string; sortOrder?: number }) {
    return prisma.hall.create({ data: { branchId, ...data } });
  },

  updateHall(id: string, data: Partial<{ name: string; sortOrder: number }>) {
    return prisma.hall.update({ where: { id }, data });
  },

  deleteHall(id: string) {
    return prisma.hall.delete({ where: { id } });
  },

  createTable(data: { hallId: string; name: string; seats?: number; posX?: number; posY?: number }) {
    return prisma.table.create({ data });
  },

  updateTable(
    id: string,
    data: Partial<{ name: string; seats: number; posX: number; posY: number; hallId: string }>,
  ) {
    return prisma.table.update({ where: { id }, data });
  },

  deleteTable(id: string) {
    return prisma.table.delete({ where: { id } });
  },
};
