import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Category, Hall, Order, Product } from '../api/types';
import { money, num } from '../lib/format';
import { PayModal } from '../components/PayModal';
import { ReceiptModal } from '../components/ReceiptModal';

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
      <header className="px-4 sm:px-6 py-4 bg-white border-b flex items-center justify-between gap-2">
        <h1 className="text-lg sm:text-xl font-bold">Zallar va stollar</h1>
        <div className="flex gap-2">
          <button className="btn-ghost text-sm" onClick={() => createOrder.mutate({ type: 'TAKEAWAY' })}>
            🥡 Olib ketish
          </button>
          <button className="btn-primary text-sm" onClick={() => createOrder.mutate({ type: 'DELIVERY' })}>
            🛵 Dostavka
          </button>
        </div>
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
  const [showCustomer, setShowCustomer] = useState(false);
  const [receipt, setReceipt] = useState<null | { kind: 'precheck' | 'fiscal'; auto: boolean }>(null);

  const { data: order } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => api.get<Order>(`/orders/${orderId}`),
    refetchInterval: 15000, // real-time zaxirasi (asosiy yangilanish WebSocket orqali)
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
  const setCustomer = useMutation({
    mutationFn: (customerId: string | null) => api.post(`/orders/${orderId}/customer`, { customerId }),
    onSuccess: () => {
      invalidate();
      setShowCustomer(false);
    },
  });
  const setDelivery = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post(`/orders/${orderId}/delivery`, body),
    onSuccess: invalidate,
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
      <div className="w-full sm:w-96 flex flex-col bg-white">
        <div className="px-5 py-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">
                Buyurtma #{order.number}
                {order.type === 'DELIVERY' && ' · 🛵 Dostavka'}
                {order.type === 'TAKEAWAY' && ' · 🥡 Olib ketish'}
                {order.source === 'QR' && ' · 📱 QR'}
              </div>
              <div className="font-bold text-lg">
                {order.table?.name ?? (order.type === 'DELIVERY' ? 'Yetkazib berish' : 'Olib ketish')}
              </div>
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

          {/* Mijoz (loyalty) */}
          <div className="mt-3">
            {order.customer ? (
              <div className="flex items-center justify-between rounded-lg bg-brand-50 border border-brand-200 px-3 py-2">
                <div className="text-sm">
                  <span className="font-semibold">💳 {order.customer.fullName}</span>
                  <span className="text-xs text-slate-500 ml-2">Bonus: {money(order.customer.bonusBalance)}</span>
                </div>
                <button className="text-xs text-red-500" onClick={() => setCustomer.mutate(null)}>
                  olib tashlash
                </button>
              </div>
            ) : (
              <button className="btn-ghost w-full text-sm" onClick={() => setShowCustomer(true)}>
                + Mijoz biriktirish (bonus)
              </button>
            )}
          </div>

          {/* Dostavka ma'lumotlari */}
          {order.type === 'DELIVERY' && <DeliveryForm order={order} onSave={(b) => setDelivery.mutate(b)} />}
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
          {Number(order.deliveryFee) > 0 && <Row label="Yetkazish narxi" value={money(order.deliveryFee)} />}
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

          <button
            className="btn-ghost w-full mt-2"
            disabled={activeItems.length === 0}
            onClick={() => setReceipt({ kind: 'precheck', auto: false })}
          >
            🧾 Hisob (chek)
          </button>
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
            // To'lovdan keyin fiskal chek avtomatik chop etiladi
            setReceipt({ kind: 'fiscal', auto: true });
          }}
        />
      )}

      {receipt && (
        <ReceiptModal
          orderId={orderId}
          kind={receipt.kind}
          autoPrint={receipt.auto}
          onClose={() => {
            const wasFiscal = receipt.kind === 'fiscal';
            setReceipt(null);
            if (wasFiscal) onBack(); // to'lov yakunlandi — stollarga qaytamiz
          }}
        />
      )}

      {showCustomer && (
        <CustomerPicker onClose={() => setShowCustomer(false)} onPick={(id) => setCustomer.mutate(id)} />
      )}
    </div>
  );
}

/* ---------------- Dostavka formasi ---------------- */
function DeliveryForm({ order, onSave }: { order: Order; onSave: (b: Record<string, unknown>) => void }) {
  const [f, setF] = useState({
    customerName: order.customerName ?? '',
    customerPhone: order.customerPhone ?? '',
    deliveryAddress: order.deliveryAddress ?? '',
    deliveryFee: order.deliveryFee,
  });
  const save = () =>
    onSave({
      customerName: f.customerName,
      customerPhone: f.customerPhone,
      deliveryAddress: f.deliveryAddress,
      deliveryFee: Number(f.deliveryFee),
    });
  return (
    <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
      <div className="text-xs font-semibold text-slate-500">🛵 Yetkazib berish</div>
      <input className="input text-sm" placeholder="Mijoz ismi" value={f.customerName} onChange={(e) => setF({ ...f, customerName: e.target.value })} onBlur={save} />
      <input className="input text-sm" placeholder="Telefon" value={f.customerPhone} onChange={(e) => setF({ ...f, customerPhone: e.target.value })} onBlur={save} />
      <input className="input text-sm" placeholder="Manzil" value={f.deliveryAddress} onChange={(e) => setF({ ...f, deliveryAddress: e.target.value })} onBlur={save} />
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 whitespace-nowrap">Yetkazish narxi:</span>
        <input type="number" className="input text-sm" value={f.deliveryFee} onChange={(e) => setF({ ...f, deliveryFee: e.target.value })} onBlur={save} />
      </div>
    </div>
  );
}

/* ---------------- Mijoz tanlash modali ---------------- */
function CustomerPicker({ onClose, onPick }: { onClose: () => void; onPick: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const { data: customers } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => api.get<import('../api/types').Customer[]>(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  });
  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-5 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-3">Mijozni tanlash</h2>
        <input className="input mb-3" placeholder="Ism yoki telefon..." value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        <div className="flex-1 overflow-auto space-y-1">
          {customers?.map((c) => (
            <button
              key={c.id}
              onClick={() => onPick(c.id)}
              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 border border-slate-100"
            >
              <div className="flex justify-between">
                <span className="font-semibold">{c.fullName}</span>
                <span className="text-sm text-brand-700 font-bold">{money(c.bonusBalance)}</span>
              </div>
              <div className="text-xs text-slate-400">
                {c.phone || 'telefon yo\'q'} {Number(c.discountPct) > 0 && `· ${Number(c.discountPct)}% chegirma`}
              </div>
            </button>
          ))}
          {!customers?.length && <div className="text-sm text-slate-400 text-center py-6">Mijoz topilmadi</div>}
        </div>
        <button className="btn-ghost w-full mt-3" onClick={onClose}>
          Yopish
        </button>
      </div>
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
