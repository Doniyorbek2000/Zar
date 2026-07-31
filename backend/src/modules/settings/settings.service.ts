import { prisma } from '../../lib/prisma';

// Standart qiymatlar
export const DEFAULT_SETTINGS: Record<string, string> = {
  'loyalty.earnPct': '5', // har to'lovda cashback foizi
  'loyalty.redeemEnabled': 'true', // bonusni to'lovda ishlatish mumkinmi
  'loyalty.minRedeem': '1000', // minimal ishlatiladigan bonus
  'delivery.defaultFee': '15000', // standart yetkazish narxi
  'service.defaultFeePct': '0', // standart xizmat haqi
};

export const settingsService = {
  async getAll(): Promise<Record<string, string>> {
    const rows = await prisma.setting.findMany();
    const map: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const r of rows) map[r.key] = r.value;
    return map;
  },

  async get(key: string): Promise<string> {
    const row = await prisma.setting.findUnique({ where: { key } });
    return row?.value ?? DEFAULT_SETTINGS[key] ?? '';
  },

  async getNumber(key: string): Promise<number> {
    return Number(await settingsService.get(key)) || 0;
  },

  async getBool(key: string): Promise<boolean> {
    return (await settingsService.get(key)) === 'true';
  },

  async setMany(values: Record<string, string>) {
    const entries = Object.entries(values);
    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.setting.upsert({ where: { key }, create: { key, value: String(value) }, update: { value: String(value) } }),
      ),
    );
    return settingsService.getAll();
  },
};
