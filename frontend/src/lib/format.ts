// Pul formati (UZS)
export const money = (v: string | number | null | undefined): string => {
  const n = typeof v === 'string' ? Number(v) : (v ?? 0);
  return new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(n) + ' so\'m';
};

export const num = (v: string | number | null | undefined): string => {
  const n = typeof v === 'string' ? Number(v) : (v ?? 0);
  return new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 2 }).format(n);
};

export const timeAgo = (iso: string): string => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'hozir';
  if (mins < 60) return `${mins} daq`;
  const h = Math.floor(mins / 60);
  return `${h} soat ${mins % 60} daq`;
};

export const roleName: Record<string, string> = {
  ADMIN: 'Administrator',
  MANAGER: 'Menejer',
  CASHIER: 'Kassir',
  WAITER: 'Ofitsiant',
  COOK: 'Oshpaz',
};
