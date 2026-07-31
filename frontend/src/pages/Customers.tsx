import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Customer, CustomerDetail } from '../api/types';
import { money } from '../lib/format';

export function CustomersPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const { data: customers } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => api.get<Customer[]>(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  });

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden">
      <div className="md:w-96 border-r flex flex-col bg-white">
        <header className="px-5 py-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold">💳 Mijozlar</h1>
            <button className="btn-primary text-sm py-1.5" onClick={() => setShowNew(true)}>
              + Yangi
            </button>
          </div>
          <input
            className="input"
            placeholder="Ism yoki telefon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </header>
        <div className="flex-1 overflow-auto">
          {customers?.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`w-full text-left px-5 py-3 border-b border-slate-100 hover:bg-slate-50 ${
                selected === c.id ? 'bg-brand-50' : ''
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="font-semibold">{c.fullName}</div>
                <div className="text-sm font-bold text-brand-700">{money(c.bonusBalance)}</div>
              </div>
              <div className="text-xs text-slate-400">
                {c.phone || 'telefon yo\'q'} {Number(c.discountPct) > 0 && `· ${Number(c.discountPct)}% chegirma`}
              </div>
            </button>
          ))}
          {!customers?.length && <div className="p-5 text-sm text-slate-400">Mijoz topilmadi</div>}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-50">
        {selected ? (
          <CustomerDetailView id={selected} />
        ) : (
          <div className="h-full grid place-items-center text-slate-400">Mijozni tanlang</div>
        )}
      </div>

      {showNew && <NewCustomerModal onClose={() => setShowNew(false)} />}
    </div>
  );
}

function CustomerDetailView({ id }: { id: string }) {
  const qc = useQueryClient();
  const [bonus, setBonus] = useState('');
  const { data: c } = useQuery({ queryKey: ['customer', id], queryFn: () => api.get<CustomerDetail>(`/customers/${id}`) });

  const adjust = useMutation({
    mutationFn: (amount: number) => api.post(`/customers/${id}/bonus`, { amount, note: 'Qo\'lda tuzatish' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer', id] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      setBonus('');
    },
  });

  if (!c) return <div className="p-8 text-slate-400">Yuklanmoqda...</div>;

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <div className="card p-5">
        <h2 className="text-2xl font-extrabold">{c.fullName}</h2>
        <div className="text-slate-500 text-sm mt-1">
          {c.phone && <span>📞 {c.phone} </span>}
          {c.cardNumber && <span>· 💳 {c.cardNumber}</span>}
        </div>
        {c.address && <div className="text-slate-500 text-sm">📍 {c.address}</div>}

        <div className="grid grid-cols-3 gap-3 mt-4">
          <Stat label="Bonus balans" value={money(c.bonusBalance)} accent="text-brand-600" />
          <Stat label="Chegirma" value={`${Number(c.discountPct)}%`} />
          <Stat label="Jami xarid" value={money(c.totalSpent)} />
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-bold mb-3">Bonusni tuzatish</h3>
        <div className="flex gap-2">
          <input
            type="number"
            className="input flex-1"
            placeholder="Miqdor (+ qo'shish, − ayirish)"
            value={bonus}
            onChange={(e) => setBonus(e.target.value)}
          />
          <button className="btn-primary" disabled={!bonus || adjust.isPending} onClick={() => adjust.mutate(Number(bonus))}>
            Qo'llash
          </button>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-bold mb-3">Bonus tarixi</h3>
        <div className="space-y-2">
          {c.bonusTransactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2">
              <div>
                <div className="font-semibold">
                  {t.type === 'EARN' ? '➕ To\'plandi' : t.type === 'REDEEM' ? '➖ Ishlatildi' : '✏️ Tuzatish'}
                </div>
                <div className="text-xs text-slate-400">
                  {t.note} · {new Date(t.createdAt).toLocaleString('uz-UZ', { dateStyle: 'short', timeStyle: 'short' })}
                </div>
              </div>
              <div className={`font-bold ${Number(t.amount) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {Number(t.amount) >= 0 ? '+' : ''}
                {money(t.amount)}
              </div>
            </div>
          ))}
          {!c.bonusTransactions.length && <div className="text-sm text-slate-400">Tarix bo'sh</div>}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="text-xs text-slate-400 font-semibold uppercase">{label}</div>
      <div className={`text-lg font-extrabold ${accent ?? 'text-slate-800'}`}>{value}</div>
    </div>
  );
}

function NewCustomerModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ fullName: '', phone: '', cardNumber: '', address: '', discountPct: '' });
  const create = useMutation({
    mutationFn: () =>
      api.post('/customers', {
        fullName: form.fullName,
        phone: form.phone || undefined,
        cardNumber: form.cardNumber || undefined,
        address: form.address || undefined,
        discountPct: form.discountPct ? Number(form.discountPct) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Yangi mijoz</h2>
        <div className="space-y-3">
          <div>
            <label className="label">To'liq ism</label>
            <input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Telefon</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Karta raqami</label>
              <input className="input" value={form.cardNumber} onChange={(e) => setForm({ ...form, cardNumber: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Manzil</label>
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="label">Doimiy chegirma (%)</label>
            <input type="number" className="input" value={form.discountPct} onChange={(e) => setForm({ ...form, discountPct: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button className="btn-ghost flex-1" onClick={onClose}>
            Bekor qilish
          </button>
          <button className="btn-primary flex-1" disabled={!form.fullName || create.isPending} onClick={() => create.mutate()}>
            Saqlash
          </button>
        </div>
      </div>
    </div>
  );
}
