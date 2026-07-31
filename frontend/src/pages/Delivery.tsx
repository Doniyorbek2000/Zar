import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Courier, DeliveryOrder } from '../api/types';
import { money, timeAgo } from '../lib/format';

const STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Kutilmoqda', color: 'bg-slate-100 text-slate-600' },
  ASSIGNED: { label: 'Kuryer tayinlandi', color: 'bg-blue-100 text-blue-700' },
  ON_WAY: { label: 'Yo\'lda', color: 'bg-amber-100 text-amber-700' },
  DELIVERED: { label: 'Yetkazildi', color: 'bg-green-100 text-green-700' },
};

export function DeliveryPage() {
  const qc = useQueryClient();
  const { data: orders } = useQuery({
    queryKey: ['delivery'],
    queryFn: () => api.get<DeliveryOrder[]>('/delivery'),
    refetchInterval: 15000,
  });
  const { data: couriers } = useQuery({ queryKey: ['couriers'], queryFn: () => api.get<Courier[]>('/delivery/couriers') });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.post(`/orders/${id}/delivery-status`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delivery'] }),
  });

  return (
    <div className="h-full overflow-auto">
      <header className="px-6 py-4 bg-white border-b flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">🛵 Dostavka</h1>
          <p className="text-sm text-slate-400">Yetkazib berish buyurtmalari</p>
        </div>
        <span className="text-sm text-slate-500">{orders?.length ?? 0} ta faol</span>
      </header>

      <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {orders?.map((o) => {
          const st = STATUS[o.deliveryStatus ?? 'PENDING'];
          return (
            <div key={o.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-lg">#{o.number}</div>
                  <div className="text-xs text-slate-400">{timeAgo(o.openedAt)}</div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.color}`}>{st.label}</span>
              </div>

              <div className="mt-3 space-y-1 text-sm">
                <div className="font-semibold">{o.customerName || o.customer?.fullName || 'Mijoz'}</div>
                <div className="text-slate-500">📞 {o.customerPhone || o.customer?.phone || '—'}</div>
                <div className="text-slate-500">📍 {o.deliveryAddress || '—'}</div>
              </div>

              <div className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500 space-y-0.5">
                {o.items.slice(0, 4).map((it) => (
                  <div key={it.id}>
                    {Number(it.quantity)}× {it.name}
                  </div>
                ))}
                {o.items.length > 4 && <div>+{o.items.length - 4} ta...</div>}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-400">Yetkazish: {money(o.deliveryFee)}</span>
                <span className="font-bold text-brand-700">{money(o.total)}</span>
              </div>

              <div className="mt-3 space-y-2">
                <select
                  className="input text-sm"
                  value={o.courier?.id ?? ''}
                  onChange={(e) => update.mutate({ id: o.id, body: { courierId: e.target.value || null } })}
                >
                  <option value="">Kuryer tanlang...</option>
                  {couriers?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-3 gap-1.5">
                  <StatusBtn active={o.deliveryStatus === 'ASSIGNED'} onClick={() => update.mutate({ id: o.id, body: { deliveryStatus: 'ASSIGNED' } })} label="Tayinlandi" />
                  <StatusBtn active={o.deliveryStatus === 'ON_WAY'} onClick={() => update.mutate({ id: o.id, body: { deliveryStatus: 'ON_WAY' } })} label="Yo'lda" />
                  <StatusBtn active={o.deliveryStatus === 'DELIVERED'} onClick={() => update.mutate({ id: o.id, body: { deliveryStatus: 'DELIVERED' } })} label="Yetkazildi" />
                </div>
              </div>
            </div>
          );
        })}
        {!orders?.length && (
          <div className="col-span-full text-center text-slate-400 py-16">Faol dostavka buyurtmalari yo'q</div>
        )}
      </div>
    </div>
  );
}

function StatusBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`py-1.5 rounded-md text-xs font-semibold ${active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}
    >
      {label}
    </button>
  );
}
