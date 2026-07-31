import { Prisma } from '@prisma/client';

// Pul bilan ishlash uchun Decimal yordamchilari (float xatolaridan qochish)
export type Money = Prisma.Decimal;
export const D = (v: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(v);
export const ZERO = new Prisma.Decimal(0);

export const round2 = (v: Prisma.Decimal): Prisma.Decimal =>
  v.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

// Decimal -> number (JSON javob uchun)
export const toNum = (v: Prisma.Decimal | number | null | undefined): number =>
  v == null ? 0 : Number(v);
