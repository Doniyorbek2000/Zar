import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { DashboardStats, Shift, TopProduct } from '../api/types';
import { money } from '../lib/format';

export function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardStats>('/reports/dashboard'),
  });
  const { data: top } = useQuery({
    queryKey: ['top-products'],
    queryFn: () => api.get<TopProduct[]>('/reports/top-products'),
  });

  return (
    <div className="h-full overflow-auto">
      <header className="px-6 py-4 bg-white border-b">
        <h1 className="text-xl font-bold">Boshqaruv paneli</h1>
        <p className="text-sm text-slate-400">Oxirgi 30 kunlik ko'rsatkichlar</p>
      </header>

      <div className="p-6 space-y-6">
        <ShiftWidget />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat title="Tushum" value={money(stats?.revenue)} accent="text-brand-600" icon="💰" />
          <Stat title="Sof foyda" value={money(stats?.profit)} accent="text-green-600" icon="📈" />
          <Stat title="Buyurtmalar" value={String(stats?.ordersCount ?? 0)} icon="🧾" />
          <Stat title="O'rtacha chek" value={money(stats?.averageCheck)} icon="🎯" />
          <Stat title="Tannarx" value={money(stats?.cost)} icon="📦" />
          <Stat title="Margin" value={(stats?.marginPct ?? '0') + '%'} accent="text-blue-600" icon="⚖️" />
          <Stat title="Mehmonlar" value={String(stats?.guests ?? 0)} icon="👥" />
        </div>

        <div className="card p-5">
          <h2 className="font-bold mb-4">🔥 Eng ko'p sotilgan taomlar</h2>
          <div className="space-y-2">
            {top?.slice(0, 8).map((p, i) => (
              <div key={p.productId} className="flex items-center gap-3">
                <div className="w-6 text-center font-bold text-slate-400">{i + 1}</div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">{p.name}</div>
                  <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full"
                      style={{
                        width: `${top[0] ? (Number(p.revenue) / Number(top[0].revenue)) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm">{money(p.revenue)}</div>
                  <div className="text-xs text-slate-400">{p.quantity} dona</div>
                </div>
              </div>
            ))}
            {!top?.length && <div className="text-sm text-slate-400">Ma'lumot yo'q</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ title, value, accent, icon }: { title: string; value: string; accent?: string; icon: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase">{title}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className={`text-2xl font-extrabold mt-2 ${accent ?? 'text-slate-800'}`}>{value}</div>
    </div>
  );
}

function ShiftWidget() {
  const qc = useQueryClient();
  const [cash, setCash] = useState('500000');
  const { data: shift } = useQuery({ queryKey: ['shift'], queryFn: () => api.get<Shift | null>('/shifts/current') });

  const open = useMutation({
    mutationFn: () => api.post('/shifts/open', { openingCash: Number(cash) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shift'] }),
  });
  const close = useMutation({
    mutationFn: () => api.post(`/shifts/${shift!.id}/close`, { closingCash: Number(cash) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shift'] }),
  });

  return (
    <div className="card p-5 flex items-center justify-between flex-wrap gap-3">
      <div>
        <h2 className="font-bold">Kassa smenasi</h2>
        {shift ? (
          <p className="text-sm text-green-600 font-semibold">
            ● Ochiq · {shift.user?.fullName} · boshlang'ich {money(shift.openingCash)}
          </p>
        ) : (
          <p className="text-sm text-slate-400">Smena yopiq</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          className="input w-40"
          value={cash}
          onChange={(e) => setCash(e.target.value)}
          placeholder="Naqd summa"
        />
        {shift ? (
          <button className="btn-danger" onClick={() => close.mutate()}>
            Smenani yopish (Z-hisobot)
          </button>
        ) : (
          <button className="btn-primary" onClick={() => open.mutate()}>
            Smenani ochish
          </button>
        )}
      </div>
    </div>
  );
}
