import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Category, Hall, Order, Product } from '../api/types';
import { money, num } from '../lib/format';
import { PayModal } from '../components/PayModal';

export function PosPage() {
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  if (activeOrderId) {
    return <OrderView orderId={activeOrderId} onBack={() => setActiveOrderId(null)} />;
  }
  return <FloorView onOpenOrder={setActiveOrderId} />;
}

/* ---------------- Zallar va stollar ---------------- */
function FloorView({ onOpenOrder }: { onOpenOrder: (id: string) => void }) {
  const qc = useQueryClient();
  const [hallIdx, setHallIdx] = useState(0);
  const { data: halls } = useQuery({ queryKey: ['halls'], queryFn: () => api.get<Hall[]>('/tables/halls') });

  const createOrder = useMutation({
    mutationFn: (body: { tableId?: string; type?: string }) => api.post<Order>('/orders', body),
    onSuccess: (o) => {
      qc.invalidateQueries({ queryKey: ['halls'] });
      onOpenOrder(o.id);
    },
  });

  const hall = halls?.[hallIdx];

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 bg-white border-b flex items-center justify-between">
        <h1 className="text-xl font-bold">Zallar va stollar</h1>
        <button
          className="btn-primary"
          title="Stolsiz (o'zi bilan olib ketish)"
          onClick={() => createOrder.mutate({ type: 'TAKEAWAY' })}
        >
          + Olib ketish
        </button>
      </header>

      <div className="px-6 pt-4 flex gap-2 flex-wrap">
        {halls?.map((h, i) => (
          <button
            key={h.id}
            onClick={() => setHallIdx(i)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              i === hallIdx ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200'
            }`}
          >
            {h.name}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {hall?.tables.map((t) => {
            const order = t.orders[0];
            const busy = !!order;
            return (
              <button
                key={t.id}
                onClick={() => (busy ? onOpenOrder(order.id) : createOrder.mutate({ tableId: t.id }))}
                className={`aspect-square rounded-2xl border-2 p-3 flex flex-col items-center justify-center transition hover:scale-[1.03] ${
                  busy
                    ? 'bg-brand-50 border-brand-400 text-brand-800'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-brand-300'
                }`}
              >
                <div className="text-2xl mb-1">{busy ? '🍽' : '🪑'}</div>
                <div className="font-bold">{t.name}</div>
                <div className="text-[11px] text-slate-400">{t.seats} o'rin</div>
                {busy && (
                  <div className="mt-1 text-xs font-semibold text-brand-700">{money(order.total)}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Faol buyurtma (menyu + hisob) ---------------- */
function OrderView({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [catId, setCatId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showPay, setShowPay] = useState(false);

  const { data: order } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => api.get<Order>(`/orders/${orderId}`),
    refetchInterval: 5000,
  });
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/catalog/categories'),
  });
  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get<Product[]>('/catalog/products?activeOnly=true'),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['order', orderId] });
    qc.invalidateQueries({ queryKey: ['halls'] });
  };

  const addItem = useMutation({
    mutationFn: (productId: string) => api.post(`/orders/${orderId}/items`, { productId, quantity: 1 }),
    onSuccess: invalidate,
  });
  const removeItem = useMutation({
    mutationFn: (itemId: string) => api.del(`/orders/${orderId}/items/${itemId}`),
    onSuccess: invalidate,
  });
  const changeQty = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      api.patch(`/orders/${orderId}/items/${itemId}`, { quantity }),
    onSuccess: invalidate,
  });
  const send = useMutation({
    mutationFn: () => api.post(`/orders/${orderId}/send`),
    onSuccess: invalidate,
  });
  const setDiscount = useMutation({
    mutationFn: (discountPct: number) => api.post(`/orders/${orderId}/discount`, { discountPct }),
    onSuccess: invalidate,
  });
  const cancel = useMutation({
    mutationFn: () => api.post(`/orders/${orderId}/cancel`, { reason: 'Bekor qilindi' }),
    onSuccess: () => {
      invalidate();
      onBack();
    },
  });

  const filtered = useMemo(() => {
    let list = products ?? [];
    if (catId) list = list.filter((p) => p.categoryId === catId);
    if (search) list = list.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [products, catId, search]);

  if (!order) return <div className="p-8 text-slate-400">Yuklanmoqda...</div>;

  const activeItems = order.items.filter((i) => i.status !== 'CANCELLED');
  const hasNew = order.items.some((i) => i.status === 'NEW');

  return (
    <div className="h-full flex">
      {/* Menyu */}
      <div className="flex-1 flex flex-col border-r">
        <header className="px-5 py-3 bg-white border-b flex items-center gap-3">
          <button className="btn-ghost" onClick={onBack}>
            ← Stollar
          </button>
          <input
            className="input flex-1"
            placeholder="Taom qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </header>
        <div className="px-5 py-3 flex gap-2 flex-wrap bg-white border-b">
          <button
            onClick={() => setCatId(null)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${!catId ? 'bg-brand-600 text-white' : 'bg-slate-100'}`}
          >
            Hammasi
          </button>
          {categories?.map((c) => (
            <button
              key={c.id}
              onClick={() => setCatId(c.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                catId === c.id ? 'text-white' : 'bg-slate-100'
              }`}
              style={catId === c.id ? { background: c.color } : undefined}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-auto p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((p) => (
              <button
                key={p.id}
                disabled={p.inStopList || addItem.isPending}
                onClick={() => addItem.mutate(p.id)}
                className="card p-3 text-left hover:border-brand-400 hover:shadow-md transition relative disabled:opacity-40"
              >
                <div
                  className="w-full h-16 rounded-lg mb-2 grid place-items-center text-2xl"
                  style={{ background: (p.category?.color ?? '#e2e8f0') + '22' }}
                >
                  🍽
                </div>
                <div className="font-semibold text-sm leading-tight line-clamp-2">{p.name}</div>
                <div className="text-brand-700 font-bold text-sm mt-1">{money(p.price)}</div>
                {p.inStopList && (
                  <span className="absolute top-2 right-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                    STOP
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Hisob (chek) */}
      <div className="w-96 flex flex-col bg-white">
        <div className="px-5 py-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Buyurtma #{order.number}</div>
              <div className="font-bold text-lg">{order.table?.name ?? 'Olib ketish'}</div>
            </div>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                order.status === 'OPEN'
                  ? 'bg-slate-100 text-slate-600'
                  : order.status === 'SENT'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-green-100 text-green-700'
              }`}
            >
              {order.status}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-2">
          {activeItems.length === 0 && (
            <div className="text-center text-slate-400 py-10 text-sm">Taom qo'shish uchun menyudan tanlang</div>
          )}
          {activeItems.map((it) => (
            <div key={it.id} className="border border-slate-100 rounded-lg p-3">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <div className="font-semibold text-sm">{it.name}</div>
                  <div className="text-xs text-slate-400">{money(it.unitPrice)}</div>
                  {it.status !== 'NEW' && (
                    <span className="text-[10px] text-amber-600 font-semibold">● {it.status}</span>
                  )}
                </div>
                <div className="text-sm font-bold">{money(Number(it.unitPrice) * Number(it.quantity))}</div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <button
                    className="w-7 h-7 rounded-md bg-slate-100 font-bold"
                    onClick={() =>
                      Number(it.quantity) > 1
                        ? changeQty.mutate({ itemId: it.id, quantity: Number(it.quantity) - 1 })
                        : removeItem.mutate(it.id)
                    }
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-semibold">{num(it.quantity)}</span>
                  <button
                    className="w-7 h-7 rounded-md bg-slate-100 font-bold"
                    onClick={() => changeQty.mutate({ itemId: it.id, quantity: Number(it.quantity) + 1 })}
                  >
                    +
                  </button>
                </div>
                <button className="text-xs text-red-500" onClick={() => removeItem.mutate(it.id)}>
                  o'chirish
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t p-4 space-y-1.5 text-sm">
          <Row label="Oraliq summa" value={money(order.subtotal)} />
          {Number(order.discountAmt) > 0 && (
            <Row label={`Chegirma (${num(order.discountPct)}%)`} value={'−' + money(order.discountAmt)} red />
          )}
          <div className="flex justify-between items-center pt-2 border-t mt-2">
            <span className="font-bold text-base">Jami</span>
            <span className="font-extrabold text-xl text-brand-700">{money(order.total)}</span>
          </div>

          <div className="flex gap-2 pt-3">
            {[0, 5, 10, 15].map((d) => (
              <button
                key={d}
                onClick={() => setDiscount.mutate(d)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${
                  num(order.discountPct) === String(d) ? 'bg-brand-600 text-white' : 'bg-slate-100'
                }`}
              >
                {d}%
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              className="btn-ghost"
              disabled={!hasNew || send.isPending}
              onClick={() => send.mutate()}
            >
              👨‍🍳 Oshxonaga
            </button>
            <button
              className="btn-primary"
              disabled={activeItems.length === 0}
              onClick={() => setShowPay(true)}
            >
              💵 To'lov
            </button>
          </div>
          <button className="w-full text-xs text-red-500 pt-1" onClick={() => cancel.mutate()}>
            Buyurtmani bekor qilish
          </button>
        </div>
      </div>

      {showPay && (
        <PayModal
          order={order}
          onClose={() => setShowPay(false)}
          onPaid={() => {
            setShowPay(false);
            invalidate();
            onBack();
          }}
        />
      )}
    </div>
  );
}

function Row({ label, value, red }: { label: string; value: string; red?: boolean }) {
  return (
    <div className="flex justify-between text-slate-600">
      <span>{label}</span>
      <span className={red ? 'text-red-500' : ''}>{value}</span>
    </div>
  );
}
