import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

async function main() {
  console.log('🌱 Seed boshlandi...');

  // Tozalash (idempotent seed)
  await prisma.$transaction([
    prisma.orderItemModifier.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.order.deleteMany(),
    prisma.bonusTransaction.deleteMany(),
    prisma.setting.deleteMany(),
    prisma.stockMovement.deleteMany(),
    prisma.supplyItem.deleteMany(),
    prisma.supply.deleteMany(),
    prisma.stock.deleteMany(),
    prisma.recipeItem.deleteMany(),
    prisma.productModifierGroup.deleteMany(),
    prisma.modifier.deleteMany(),
    prisma.modifierGroup.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.ingredient.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.table.deleteMany(),
    prisma.hall.deleteMany(),
    prisma.shift.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.user.deleteMany(),
    prisma.branch.deleteMany(),
    prisma.company.deleteMany(),
  ]);

  // Tashkilot va filial
  const company = await prisma.company.create({
    data: { name: 'ZarPOS Demo Restoran', currency: 'UZS' },
  });
  const branch = await prisma.branch.create({
    data: { companyId: company.id, name: 'Markaziy filial', address: 'Toshkent sh.', phone: '+998 90 123 45 67' },
  });

  // Foydalanuvchilar
  const hash = (p: string) => bcrypt.hash(p, 10);
  await prisma.user.createMany({
    data: [
      {
        branchId: branch.id,
        fullName: 'Administrator',
        username: 'admin',
        passwordHash: await hash('admin123'),
        role: 'ADMIN',
      },
      {
        branchId: branch.id,
        fullName: 'Menejer Aziz',
        username: 'menejer',
        passwordHash: await hash('menejer123'),
        role: 'MANAGER',
      },
      {
        branchId: branch.id,
        fullName: 'Kassir Dilnoza',
        username: 'kassir',
        passwordHash: await hash('kassir123'),
        pinHash: await hash('1111'),
        role: 'CASHIER',
      },
      {
        branchId: branch.id,
        fullName: 'Ofitsiant Sardor',
        username: 'ofitsiant',
        passwordHash: await hash('ofitsiant123'),
        pinHash: await hash('1234'),
        role: 'WAITER',
      },
      {
        branchId: branch.id,
        fullName: 'Oshpaz Jamshid',
        username: 'oshpaz',
        passwordHash: await hash('oshpaz123'),
        pinHash: await hash('2222'),
        role: 'COOK',
      },
      {
        branchId: branch.id,
        fullName: 'Kuryer Bekzod',
        username: 'kuryer',
        passwordHash: await hash('kuryer123'),
        pinHash: await hash('3333'),
        role: 'COURIER',
        phone: '+998 93 555 44 33',
      },
    ],
  });

  // Loyalty / dostavka sozlamalari
  await prisma.setting.createMany({
    data: [
      { key: 'loyalty.earnPct', value: '5' },
      { key: 'loyalty.redeemEnabled', value: 'true' },
      { key: 'loyalty.minRedeem', value: '1000' },
      { key: 'delivery.defaultFee', value: '15000' },
    ],
  });

  // Zallar va stollar
  const mainHall = await prisma.hall.create({ data: { branchId: branch.id, name: 'Asosiy zal', sortOrder: 1 } });
  const vipHall = await prisma.hall.create({ data: { branchId: branch.id, name: 'VIP zal', sortOrder: 2 } });
  const terrace = await prisma.hall.create({ data: { branchId: branch.id, name: 'Terrasa', sortOrder: 3 } });

  const makeTables = (hallId: string, count: number, prefix: string, seats = 4) =>
    prisma.table.createMany({
      data: Array.from({ length: count }, (_, i) => ({
        hallId,
        name: `${prefix}${i + 1}`,
        seats,
        posX: (i % 4) * 120 + 20,
        posY: Math.floor(i / 4) * 120 + 20,
      })),
    });
  await makeTables(mainHall.id, 8, 'Stol ');
  await makeTables(vipHall.id, 3, 'VIP-', 6);
  await makeTables(terrace.id, 4, 'T-', 4);

  // Ingredientlar
  const ing = async (name: string, unit: 'GRAM' | 'MILLILITER' | 'PIECE', cost: number, min = 0) =>
    prisma.ingredient.create({ data: { name, unit, costPerUnit: D(cost), minQuantity: D(min) } });

  const beef = await ing('Mol go\'shti', 'GRAM', 75, 2000);
  const chicken = await ing('Tovuq filesi', 'GRAM', 42, 2000);
  const rice = await ing('Gurunch (devzira)', 'GRAM', 18, 5000);
  const carrot = await ing('Sabzi', 'GRAM', 6, 3000);
  const onion = await ing('Piyoz', 'GRAM', 5, 3000);
  const oil = await ing('O\'simlik yog\'i', 'MILLILITER', 22, 2000);
  const flour = await ing('Un', 'GRAM', 7, 5000);
  const cheese = await ing('Mozzarella pishloq', 'GRAM', 95, 1000);
  const tomato = await ing('Pomidor', 'GRAM', 12, 2000);
  const potato = await ing('Kartoshka', 'GRAM', 8, 5000);
  const cola = await ing('Coca-Cola 0.5', 'PIECE', 6000, 24);
  const water = await ing('Suv 0.5', 'PIECE', 2500, 24);
  const tea = await ing('Choy (quruq)', 'GRAM', 120, 500);
  const salt = await ing('Tuz/ziravor', 'GRAM', 3, 1000);
  const bread = await ing('Non', 'PIECE', 2000, 20);

  // Boshlang'ich qoldiq (kirim orqali)
  const supplier = await prisma.supplier.create({ data: { name: 'Oziq-ovqat Baza MChJ', phone: '+998 71 200 00 00' } });
  const initialStock: [string, number][] = [
    [beef.id, 15000], [chicken.id, 12000], [rice.id, 30000], [carrot.id, 10000],
    [onion.id, 10000], [oil.id, 8000], [flour.id, 20000], [cheese.id, 5000],
    [tomato.id, 8000], [potato.id, 25000], [cola.id, 100], [water.id, 100],
    [tea.id, 2000], [salt.id, 5000], [bread.id, 80],
  ];
  await prisma.supply.create({
    data: {
      branchId: branch.id,
      supplierId: supplier.id,
      docNumber: 'INIT-001',
      note: 'Boshlang\'ich qoldiq',
      total: D(0),
      items: {
        create: initialStock.map(([ingredientId, quantity]) => ({
          ingredientId,
          quantity: D(quantity),
          unitPrice: D(0),
        })),
      },
    },
  });
  for (const [ingredientId, quantity] of initialStock) {
    await prisma.stock.create({ data: { branchId: branch.id, ingredientId, quantity: D(quantity) } });
  }

  // Kategoriyalar
  const catMain = await prisma.category.create({ data: { name: 'Milliy taomlar', color: '#f59e0b', sortOrder: 1 } });
  const catFast = await prisma.category.create({ data: { name: 'Fast Food', color: '#ef4444', sortOrder: 2 } });
  const catGrill = await prisma.category.create({ data: { name: 'Grill / Mangal', color: '#dc2626', sortOrder: 3 } });
  const catDrink = await prisma.category.create({ data: { name: 'Ichimliklar', color: '#3b82f6', sortOrder: 4 } });
  const catSalad = await prisma.category.create({ data: { name: 'Salatlar', color: '#22c55e', sortOrder: 5 } });

  // Modifikator guruhi
  const extras = await prisma.modifierGroup.create({
    data: {
      name: 'Qo\'shimchalar',
      minSelect: 0,
      maxSelect: 3,
      modifiers: {
        create: [
          { name: 'Qo\'shimcha pishloq', price: D(8000) },
          { name: 'Achchiq sous', price: D(3000) },
          { name: 'Qo\'shimcha go\'sht', price: D(15000) },
        ],
      },
    },
    include: { modifiers: true },
  });

  // Taom + texkarta yaratuvchi yordamchi
  const dish = async (
    categoryId: string,
    name: string,
    price: number,
    recipe: [string, number][],
    opts: { modifiers?: boolean; type?: 'DISH' | 'GOODS'; unit?: string } = {},
  ) => {
    const product = await prisma.product.create({
      data: {
        categoryId,
        name,
        price: D(price),
        type: opts.type ?? 'DISH',
        unit: opts.unit ?? 'porsiya',
        recipeItems: { create: recipe.map(([ingredientId, quantity]) => ({ ingredientId, quantity: D(quantity) })) },
      },
    });
    if (opts.modifiers) {
      await prisma.productModifierGroup.create({ data: { productId: product.id, groupId: extras.id } });
    }
    return product;
  };

  // Milliy taomlar
  await dish(catMain.id, 'Osh (palov)', 32000, [
    [rice.id, 200], [beef.id, 120], [carrot.id, 100], [onion.id, 50], [oil.id, 40], [salt.id, 10],
  ]);
  await dish(catMain.id, 'Lag\'mon', 28000, [
    [flour.id, 150], [beef.id, 100], [carrot.id, 60], [onion.id, 40], [tomato.id, 80], [oil.id, 30],
  ]);
  await dish(catMain.id, 'Manti (5 dona)', 30000, [
    [flour.id, 200], [beef.id, 150], [onion.id, 80], [salt.id, 10],
  ]);
  await dish(catMain.id, 'Sho\'rva', 22000, [
    [beef.id, 120], [potato.id, 150], [carrot.id, 60], [onion.id, 40], [tomato.id, 50],
  ]);

  // Fast food
  await dish(catFast.id, 'Cheeseburger', 35000, [
    [bread.id, 1], [beef.id, 120], [cheese.id, 40], [tomato.id, 40], [onion.id, 20],
  ], { modifiers: true });
  await dish(catFast.id, 'Hot-dog', 22000, [[bread.id, 1], [chicken.id, 80], [onion.id, 20]], { modifiers: true });
  await dish(catFast.id, 'Fri kartoshka', 18000, [[potato.id, 250], [oil.id, 50], [salt.id, 5]]);
  await dish(catFast.id, 'Lavash (tovuqli)', 30000, [
    [flour.id, 120], [chicken.id, 150], [tomato.id, 50], [onion.id, 30], [cheese.id, 30],
  ], { modifiers: true });

  // Grill
  await dish(catGrill.id, 'Tovuq shashlik', 26000, [[chicken.id, 200], [onion.id, 40], [salt.id, 10]]);
  await dish(catGrill.id, 'Mol go\'sht shashlik', 38000, [[beef.id, 200], [onion.id, 40], [salt.id, 10]]);

  // Salatlar
  await dish(catSalad.id, 'Achichuk', 12000, [[tomato.id, 150], [onion.id, 80]]);
  await dish(catSalad.id, 'Sezar (tovuqli)', 28000, [[chicken.id, 100], [cheese.id, 40], [tomato.id, 60]]);

  // Ichimliklar (tovar)
  await dish(catDrink.id, 'Coca-Cola 0.5', 10000, [[cola.id, 1]], { type: 'GOODS', unit: 'dona' });
  await dish(catDrink.id, 'Suv 0.5', 5000, [[water.id, 1]], { type: 'GOODS', unit: 'dona' });
  await dish(catDrink.id, 'Ko\'k choy', 8000, [[tea.id, 10]]);

  // Demo mijoz
  await prisma.customer.create({
    data: { fullName: 'Doimiy mijoz', phone: '+998901112233', cardNumber: 'ZP-0001', discountPct: D(10) },
  });

  console.log('✅ Seed tugadi!');
  console.log('   Kirish: admin / admin123 (Admin)');
  console.log('           kassir / kassir123 (PIN 1111)');
  console.log('           ofitsiant / ofitsiant123 (PIN 1234)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
