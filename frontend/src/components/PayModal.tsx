import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Order } from '../api/types';
import { money } from '../lib/format';

type Method = 'CASH' | 'CARD' | 'TRANSFER';
const METHODS: { key: Method; label: string; icon: string }[] = [
  { key: 'CASH', label: 'Naqd', icon: '💵' },
  { key: 'CARD', label: 'Karta', icon: '💳' },
  { key: 'TRANSFER', label: 'O\'tkazma', icon: '📱' },
];

export function PayModal({
  order,
  onClose,
  onPaid,
}: {
  order: Order;
  onClose: () => void;
  onPaid: () => void;
}) {
  const total = Number(order.total);
  const bonusBalance = Number(order.customer?.bonusBalance ?? 0);
  const [method, setMethod] = useState<Method>('CASH');
  const [useBonus, setUseBonus] = useState(false);
  const [error, setError] = useState('');

  const bonusApplied = useBonus ? Math.min(bonusBalance, total) : 0;
  const remaining = Math.max(0, total - bonusApplied);
  const [received, setReceived] = useState<number>(total);

  const changeBase = method === 'CASH' ? received : remaining;
  const change = Math.max(0, changeBase - remaining);

  const pay = useMutation({
    mutationFn: () => {
      const payments: { method: string; amount: number }[] = [];
      if (bonusApplied > 0) payments.push({ method: 'BONUS', amount: bonusApplied });
      if (remaining > 0) payments.push({ method, amount: method === 'CASH' ? received : remaining });
      return api.post(`/orders/${order.id}/pay`, { payments });
    },
    onSuccess: onPaid,
    onError: (e) => setError(e instanceof Error ? e.message : 'Xatolik'),
  });

  const quick = [remaining, 50000, 100000, 200000, 500000];

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">To'lov · #{order.number}</h2>
          <button onClick={onClose} className="text-slate-400 text-xl">
            ✕
          </button>
        </div>

        <div className="bg-slate-900 text-white rounded-xl p-4 mb-4 text-center">
          <div className="text-xs text-slate-400">To'lash uchun</div>
          <div className="text-3xl font-extrabold">{money(order.total)}</div>
        </div>

        {order.customer && (
          <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <div className="font-semibold">💳 {order.customer.fullName}</div>
                <div className="text-xs text-slate-500">Bonus: {money(bonusBalance)}</div>
              </div>
              {bonusBalance > 0 && (
                <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold">
                  <input type="checkbox" className="w-4 h-4 accent-brand-600" checked={useBonus} onChange={(e) => setUseBonus(e.target.checked)} />
                  Bonus ishlatish
                </label>
              )}
            </div>
            {bonusApplied > 0 && (
              <div className="text-xs text-brand-700 mt-1">−{money(bonusApplied)} bonusdan · qoldiq {money(remaining)}</div>
            )}
          </div>
        )}

        {remaining > 0 && (
          <>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {METHODS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => {
                    setMethod(m.key);
                    setReceived(remaining);
                  }}
                  className={`py-3 rounded-lg text-sm font-semibold border-2 ${
                    method === m.key ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200'
                  }`}
                >
                  <div className="text-xl">{m.icon}</div>
                  {m.label}
                </button>
              ))}
            </div>

            {method === 'CASH' && (
              <>
                <label className="label">Qabul qilingan summa</label>
                <input
                  type="number"
                  className="input text-lg font-bold text-center mb-2"
                  value={received}
                  onChange={(e) => setReceived(Number(e.target.value))}
                />
                <div className="grid grid-cols-5 gap-1.5 mb-3">
                  {quick.map((q, i) => (
                    <button key={i} onClick={() => setReceived(q)} className="py-1.5 rounded-md bg-slate-100 text-xs font-semibold">
                      {i === 0 ? 'Aniq' : new Intl.NumberFormat('uz').format(q)}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-lg font-bold mb-4">
                  <span className="text-slate-500">Qaytim</span>
                  <span className="text-green-600">{money(change)}</span>
                </div>
              </>
            )}
          </>
        )}

        {remaining === 0 && bonusApplied > 0 && (
          <div className="mb-4 text-center text-green-600 font-semibold">To'liq bonus bilan qoplanadi ✓</div>
        )}

        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</div>}

        <button
          className="btn-primary w-full py-3 text-base"
          disabled={pay.isPending || (remaining > 0 && method === 'CASH' && received < remaining)}
          onClick={() => {
            setError('');
            pay.mutate();
          }}
        >
          {pay.isPending ? 'Bajarilmoqda...' : `To'lovni tasdiqlash · ${money(order.total)}`}
        </button>
      </div>
    </div>
  );
}
