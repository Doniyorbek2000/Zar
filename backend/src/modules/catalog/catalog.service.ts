import { Prisma, ProductType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFound } from '../../lib/errors';
import { D } from '../../lib/money';

export const catalogService = {
  // ---------- Kategoriyalar ----------
  listCategories() {
    return prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  },

  createCategory(data: { name: string; color?: string; sortOrder?: number }) {
    return prisma.category.create({ data });
  },

  async updateCategory(id: string, data: Partial<{ name: string; color: string; sortOrder: number; isActive: boolean }>) {
    await prisma.category.findUniqueOrThrow({ where: { id } }).catch(() => {
      throw NotFound('Kategoriya topilmadi');
    });
    return prisma.category.update({ where: { id }, data });
  },

  deleteCategory(id: string) {
    return prisma.category.delete({ where: { id } });
  },

  // ---------- Taomlar (menyu) ----------
  listProducts(params: { categoryId?: string; activeOnly?: boolean; search?: string }) {
    return prisma.product.findMany({
      where: {
        ...(params.categoryId ? { categoryId: params.categoryId } : {}),
        ...(params.activeOnly ? { isActive: true } : {}),
        ...(params.search ? { name: { contains: params.search, mode: 'insensitive' } } : {}),
      },
      include: {
        category: { select: { id: true, name: true, color: true } },
        modifierGroups: { include: { group: { include: { modifiers: true } } } },
      },
      orderBy: { name: 'asc' },
    });
  },

  async getProduct(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        modifierGroups: { include: { group: { include: { modifiers: true } } } },
        recipeItems: { include: { ingredient: true } },
      },
    });
    if (!product) throw NotFound('Taom topilmadi');
    return product;
  },

  createProduct(data: {
    categoryId: string;
    name: string;
    description?: string;
    type?: ProductType;
    price: number;
    unit?: string;
    imageUrl?: string;
  }) {
    return prisma.product.create({
      data: { ...data, price: D(data.price) },
    });
  },

  updateProduct(
    id: string,
    data: Partial<{
      categoryId: string;
      name: string;
      description: string;
      type: ProductType;
      price: number;
      unit: string;
      imageUrl: string;
      isActive: boolean;
      inStopList: boolean;
    }>,
  ) {
    const { price, ...rest } = data;
    return prisma.product.update({
      where: { id },
      data: { ...rest, ...(price != null ? { price: D(price) } : {}) },
    });
  },

  async setStopList(id: string, inStopList: boolean) {
    return prisma.product.update({ where: { id }, data: { inStopList } });
  },

  deleteProduct(id: string) {
    return prisma.product.update({ where: { id }, data: { isActive: false } });
  },

  // ---------- Texnologik karta (retsept) ----------
  async setRecipe(productId: string, items: { ingredientId: string; quantity: number }[]) {
    return prisma.$transaction(async (tx) => {
      await tx.recipeItem.deleteMany({ where: { productId } });
      if (items.length) {
        await tx.recipeItem.createMany({
          data: items.map((i) => ({ productId, ingredientId: i.ingredientId, quantity: D(i.quantity) })),
        });
      }
      return tx.recipeItem.findMany({ where: { productId }, include: { ingredient: true } });
    });
  },

  // Taom tannarxini texkarta bo'yicha hisoblash
  async calcProductCost(productId: string): Promise<Prisma.Decimal> {
    const items = await prisma.recipeItem.findMany({
      where: { productId },
      include: { ingredient: true },
    });
    return items.reduce(
      (sum, item) => sum.add(item.quantity.mul(item.ingredient.costPerUnit)),
      new Prisma.Decimal(0),
    );
  },

  // ---------- Modifikatorlar ----------
  listModifierGroups() {
    return prisma.modifierGroup.findMany({ include: { modifiers: true }, orderBy: { name: 'asc' } });
  },

  async createModifierGroup(data: {
    name: string;
    minSelect?: number;
    maxSelect?: number;
    isRequired?: boolean;
    modifiers?: { name: string; price: number }[];
  }) {
    const { modifiers, ...group } = data;
    return prisma.modifierGroup.create({
      data: {
        ...group,
        modifiers: modifiers ? { create: modifiers.map((m) => ({ name: m.name, price: D(m.price) })) } : undefined,
      },
      include: { modifiers: true },
    });
  },

  attachModifierGroup(productId: string, groupId: string) {
    return prisma.productModifierGroup.upsert({
      where: { productId_groupId: { productId, groupId } },
      create: { productId, groupId },
      update: {},
    });
  },

  detachModifierGroup(productId: string, groupId: string) {
    return prisma.productModifierGroup.delete({
      where: { productId_groupId: { productId, groupId } },
    });
  },
};
