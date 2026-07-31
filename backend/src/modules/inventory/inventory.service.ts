import { Prisma, StockUnit } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/errors';
import { D } from '../../lib/money';
import { realtime } from '../../realtime/realtime';

export const inventoryService = {
  // ---------- Ingredientlar ----------
  listIngredients(search?: string) {
    return prisma.ingredient.findMany({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
      orderBy: { name: 'asc' },
    });
  },

  createIngredient(data: { name: string; unit?: StockUnit; costPerUnit?: number; minQuantity?: number }) {
    return prisma.ingredient.create({
      data: {
        name: data.name,
        unit: data.unit ?? 'GRAM',
        costPerUnit: D(data.costPerUnit ?? 0),
        minQuantity: D(data.minQuantity ?? 0),
      },
    });
  },

  updateIngredient(
    id: string,
    data: Partial<{ name: string; unit: StockUnit; costPerUnit: number; minQuantity: number; isActive: boolean }>,
  ) {
    const { costPerUnit, minQuantity, ...rest } = data;
    return prisma.ingredient.update({
      where: { id },
      data: {
        ...rest,
        ...(costPerUnit != null ? { costPerUnit: D(costPerUnit) } : {}),
        ...(minQuantity != null ? { minQuantity: D(minQuantity) } : {}),
      },
    });
  },

  // ---------- Qoldiqlar ----------
  async stockLevels(branchId: string) {
    const stocks = await prisma.stock.findMany({
      where: { branchId },
      include: { ingredient: true },
      orderBy: { ingredient: { name: 'asc' } },
    });
    return stocks.map((s) => ({
      ingredientId: s.ingredientId,
      name: s.ingredient.name,
      unit: s.ingredient.unit,
      quantity: s.quantity,
      minQuantity: s.ingredient.minQuantity,
      costPerUnit: s.ingredient.costPerUnit,
      value: s.quantity.mul(s.ingredient.costPerUnit).toFixed(2),
      lowStock: s.quantity.lessThanOrEqualTo(s.ingredient.minQuantity),
    }));
  },

  // ---------- Kirim (prixod) ----------
  // Kirim ingredientlar qoldig'ini oshiradi va o'rtacha tannarxni yangilaydi
  async createSupply(
    branchId: string,
    userId: string,
    data: {
      supplierId?: string;
      docNumber?: string;
      note?: string;
      items: { ingredientId: string; quantity: number; unitPrice: number }[];
    },
  ) {
    if (!data.items.length) throw BadRequest('Kamida bitta pozitsiya kerak');

    const supply = await prisma.$transaction(async (tx) => {
      const total = data.items.reduce((s, i) => s.add(D(i.quantity).mul(D(i.unitPrice))), new Prisma.Decimal(0));

      const supply = await tx.supply.create({
        data: {
          branchId,
          supplierId: data.supplierId,
          docNumber: data.docNumber,
          note: data.note,
          total,
          items: {
            create: data.items.map((i) => ({
              ingredientId: i.ingredientId,
              quantity: D(i.quantity),
              unitPrice: D(i.unitPrice),
            })),
          },
        },
        include: { items: true },
      });

      for (const item of data.items) {
        const qty = D(item.quantity);

        // O'rtacha vaznli tannarxni yangilash
        const stock = await tx.stock.findUnique({
          where: { branchId_ingredientId: { branchId, ingredientId: item.ingredientId } },
        });
        const ingredient = await tx.ingredient.findUniqueOrThrow({ where: { id: item.ingredientId } });
        const oldQty = stock?.quantity ?? new Prisma.Decimal(0);
        const newQty = oldQty.add(qty);
        let newCost = D(item.unitPrice);
        if (oldQty.greaterThan(0)) {
          const oldValue = oldQty.mul(ingredient.costPerUnit);
          const addValue = qty.mul(D(item.unitPrice));
          newCost = oldValue.add(addValue).div(newQty);
        }

        await tx.stock.upsert({
          where: { branchId_ingredientId: { branchId, ingredientId: item.ingredientId } },
          create: { branchId, ingredientId: item.ingredientId, quantity: qty },
          update: { quantity: { increment: qty } },
        });
        await tx.ingredient.update({
          where: { id: item.ingredientId },
          data: { costPerUnit: newCost.toDecimalPlaces(4) },
        });
        await tx.stockMovement.create({
          data: {
            branchId,
            ingredientId: item.ingredientId,
            type: 'SUPPLY',
            quantity: qty,
            cost: qty.mul(D(item.unitPrice)),
            userId,
            reason: data.docNumber ? `Kirim ${data.docNumber}` : 'Kirim',
          },
        });
      }

      return supply;
    });

    realtime.emitToBranch(branchId, 'stock:changed');
    return supply;
  },

  // ---------- Spisaniye (write-off) ----------
  async writeOff(
    branchId: string,
    userId: string,
    data: { ingredientId: string; quantity: number; reason: string },
  ) {
    const movement = await prisma.$transaction(async (tx) => {
      const ingredient = await tx.ingredient.findUnique({ where: { id: data.ingredientId } });
      if (!ingredient) throw NotFound('Ingredient topilmadi');
      const qty = D(data.quantity);

      await tx.stock.upsert({
        where: { branchId_ingredientId: { branchId, ingredientId: data.ingredientId } },
        create: { branchId, ingredientId: data.ingredientId, quantity: qty.negated() },
        update: { quantity: { decrement: qty } },
      });
      return tx.stockMovement.create({
        data: {
          branchId,
          ingredientId: data.ingredientId,
          type: 'WRITE_OFF',
          quantity: qty.negated(),
          cost: qty.mul(ingredient.costPerUnit),
          reason: data.reason,
          userId,
        },
      });
    });

    realtime.emitToBranch(branchId, 'stock:changed');
    return movement;
  },

  // ---------- Inventarizatsiya ----------
  // Haqiqiy qoldiqni belgilaydi va farqni harakat sifatida yozadi
  async inventoryCount(
    branchId: string,
    userId: string,
    items: { ingredientId: string; actualQuantity: number }[],
  ) {
    const results = await prisma.$transaction(async (tx) => {
      const adjustments = [];
      for (const item of items) {
        const stock = await tx.stock.findUnique({
          where: { branchId_ingredientId: { branchId, ingredientId: item.ingredientId } },
        });
        const current = stock?.quantity ?? new Prisma.Decimal(0);
        const actual = D(item.actualQuantity);
        const diff = actual.sub(current);

        await tx.stock.upsert({
          where: { branchId_ingredientId: { branchId, ingredientId: item.ingredientId } },
          create: { branchId, ingredientId: item.ingredientId, quantity: actual },
          update: { quantity: actual },
        });
        if (!diff.isZero()) {
          await tx.stockMovement.create({
            data: {
              branchId,
              ingredientId: item.ingredientId,
              type: 'INVENTORY',
              quantity: diff,
              reason: 'Inventarizatsiya tuzatishi',
              userId,
            },
          });
        }
        adjustments.push({ ingredientId: item.ingredientId, diff: diff.toFixed(3) });
      }
      return adjustments;
    });

    realtime.emitToBranch(branchId, 'stock:changed');
    return results;
  },

  movements(branchId: string, ingredientId?: string) {
    return prisma.stockMovement.findMany({
      where: { branchId, ...(ingredientId ? { ingredientId } : {}) },
      include: { ingredient: { select: { name: true, unit: true } }, user: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  },

  // ---------- Yetkazib beruvchilar ----------
  listSuppliers() {
    return prisma.supplier.findMany({ orderBy: { name: 'asc' } });
  },

  createSupplier(data: { name: string; phone?: string; inn?: string }) {
    return prisma.supplier.create({ data });
  },
};
