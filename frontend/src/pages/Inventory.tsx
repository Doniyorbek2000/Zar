import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Ingredient, StockLevel } from '../api/types';
import { money, num } from '../lib/format';

const UNIT_LABEL: Record<string, string> = {
  GRAM: 'g',
  KILOGRAM: 'kg',
  MILLILITER: 'ml',
  LITER: 'l',
  PIECE: 'dona',
};

export function InventoryPage() {
  const { data: stock } = useQuery({ queryKey: ['stock'], queryFn: () => api.get<StockLevel[]>('/inventory/stock') });
  const [writeOff, setWriteOff] = useState(false);

  const totalValue = (stock ?? []).reduce((s, x) => s + Number(x.value), 0);
  const lowCount = (stock ?? []).filter((x) => x.lowStock).length;

  return (
    <div className="h-full overflow-auto">
      <header className="px-6 py-4 bg-white border-b flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Ombor</h1>
          <p className="text-sm text-slate-400">Ingredient qoldiqlari va harakati</p>
        </div>
        <button className="btn-danger" onClick={() => setWriteOff(true)}>
          − Spisaniye
        </button>
      </header>

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4">
            <div className="text-xs font-semibold text-slate-400 uppercase">Ombor qiymati</div>
            <div className="text-2xl font-extrabold mt-1">{money(totalValue)}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs font-semibold text-slate-400 uppercase">Pozitsiyalar</div>
            <div className="text-2xl font-extrabold mt-1">{stock?.length ?? 0}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs font-semibold text-slate-400 uppercase">Kam qolgan</div>
            <div className={`text-2xl font-extrabold mt-1 ${lowCount ? 'text-red-600' : 'text-green-600'}`}>
              {lowCount}
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Ingredient</th>
                <th className="px-4 py-3 text-right">Qoldiq</th>
                <th className="px-4 py-3 text-right">Min.</th>
                <th className="px-4 py-3 text-right">Tannarx</th>
                <th className="px-4 py-3 text-right">Qiymat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stock?.map((s) => (
                <tr key={s.ingredientId} className={s.lowStock ? 'bg-red-50/50' : ''}>
                  <td className="px-4 py-3 font-semibold">
                    {s.name}
                    {s.lowStock && <span className="ml-2 text-[10px] text-red-600 font-bold">⚠ KAM</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-bold">
                    {num(s.quantity)} <span className="text-slate-400 font-normal">{UNIT_LABEL[s.unit]}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400">{num(s.minQuantity)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{money(s.costPerUnit)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{money(s.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {writeOff && <WriteOffModal onClose={() => setWriteOff(false)} />}
    </div>
  );
}

function WriteOffModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: ingredients } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => api.get<Ingredient[]>('/inventory/ingredients'),
  });
  const [ingredientId, setIngredientId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('Yaroqsiz holga keldi');

  const submit = useMutation({
    mutationFn: () =>
      api.post('/inventory/write-off', { ingredientId, quantity: Number(quantity), reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Spisaniye (hisobdan chiqarish)</h2>
        <div className="space-y-3">
          <div>
            <label className="label">Ingredient</label>
            <select className="input" value={ingredientId} onChange={(e) => setIngredientId(e.target.value)}>
              <option value="">Tanlang...</option>
              {ingredients?.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Miqdor</label>
            <input type="number" className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div>
            <label className="label">Sabab</label>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button className="btn-ghost flex-1" onClick={onClose}>
            Bekor qilish
          </button>
          <button
            className="btn-danger flex-1"
            disabled={!ingredientId || !quantity || submit.isPending}
            onClick={() => submit.mutate()}
          >
            Hisobdan chiqarish
          </button>
        </div>
      </div>
    </div>
  );
}
