import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { TopProduct } from '../api/types';
import { money } from '../lib/format';

interface SalesDay {
  date: string;
  total: string;
}
interface WaiterStat {
  waiterId: string;
  name: string;
  orders: number;
  revenue: string;
}

export function ReportsPage() {
  const { data: sales } = useQuery({
    queryKey: ['sales-by-day'],
    queryFn: () => api.get<SalesDay[]>('/reports/sales-by-day'),
  });
  const { data: waiters } = useQuery({
    queryKey: ['waiters'],
    queryFn: () => api.get<WaiterStat[]>('/reports/waiters'),
  });
  const { data: top } = useQuery({
    queryKey: ['top-products-full'],
    queryFn: () => api.get<TopProduct[]>('/reports/top-products'),
  });

  const maxSale = Math.max(1, ...(sales ?? []).map((s) => Number(s.total)));

  return (
    <div className="h-full overflow-auto">
      <header className="px-6 py-4 bg-white border-b">
        <h1 className="text-xl font-bold">Hisobotlar</h1>
        <p className="text-sm text-slate-400">Sotuv tahlili · oxirgi 30 kun</p>
      </header>

      <div className="p-6 space-y-6">
        <div className="card p-5">
          <h2 className="font-bold mb-4">📈 Kunlik sotuv dinamikasi</h2>
          <div className="flex items-end gap-1.5 h-48">
            {sales?.length ? (
              sales.map((s) => (
                <div key={s.date} className="flex-1 flex flex-col items-center justify-end group">
                  <div className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 mb-1 whitespace-nowrap">
                    {money(s.total)}
                  </div>
                  <div
                    className="w-full bg-brand-500 rounded-t hover:bg-brand-600 transition"
                    style={{ height: `${(Number(s.total) / maxSale) * 100}%` }}
                    title={`${s.date}: ${money(s.total)}`}
                  />
                  <div className="text-[9px] text-slate-400 mt-1 rotate-45 origin-left">{s.date.slice(5)}</div>
                </div>
              ))
            ) : (
              <div className="w-full text-center text-slate-400 self-center">Ma'lumot yo'q</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-5">
            <h2 className="font-bold mb-4">🏆 Ofitsiantlar reytingi</h2>
            <div className="space-y-2">
              {waiters?.map((w, i) => (
                <div key={w.waiterId} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 grid place-items-center font-bold text-sm">
                    {i + 1}
                  </div>
                  <div className="flex-1 font-semibold text-sm">{w.name}</div>
                  <div className="text-right">
                    <div className="font-bold text-sm">{money(w.revenue)}</div>
                    <div className="text-xs text-slate-400">{w.orders} buyurtma</div>
                  </div>
                </div>
              ))}
              {!waiters?.length && <div className="text-sm text-slate-400">Ma'lumot yo'q</div>}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-bold mb-4">💹 Foyda bo'yicha top taomlar</h2>
            <div className="space-y-2">
              {top?.slice(0, 8).map((p) => (
                <div key={p.productId} className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{p.name}</span>
                  <span className="font-bold text-green-600">{money(p.profit)}</span>
                </div>
              ))}
              {!top?.length && <div className="text-sm text-slate-400">Ma'lumot yo'q</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
