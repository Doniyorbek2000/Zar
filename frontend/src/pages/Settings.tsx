import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { AppSettings } from '../api/types';

export function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['settings'], queryFn: () => api.get<AppSettings>('/settings') });
  const [form, setForm] = useState<AppSettings>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.put('/settings', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="h-full overflow-auto">
      <header className="px-6 py-4 bg-white border-b">
        <h1 className="text-xl font-bold">⚙️ Sozlamalar</h1>
        <p className="text-sm text-slate-400">Loyalty va dostavka konfiguratsiyasi</p>
      </header>

      <div className="p-6 max-w-2xl space-y-6">
        <div className="card p-5 space-y-4">
          <h2 className="font-bold">💳 Loyalty / Bonus dasturi</h2>
          <Field label="Cashback foizi (%)" hint="Har to'lovda mijozga qaytariladigan bonus foizi">
            <input
              type="number"
              className="input"
              value={form['loyalty.earnPct'] ?? ''}
              onChange={(e) => set('loyalty.earnPct', e.target.value)}
            />
          </Field>
          <Field label="Minimal ishlatiladigan bonus" hint="Bir marta ishlatish uchun minimal bonus miqdori">
            <input
              type="number"
              className="input"
              value={form['loyalty.minRedeem'] ?? ''}
              onChange={(e) => set('loyalty.minRedeem', e.target.value)}
            />
          </Field>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-5 h-5 accent-brand-600"
              checked={form['loyalty.redeemEnabled'] === 'true'}
              onChange={(e) => set('loyalty.redeemEnabled', e.target.checked ? 'true' : 'false')}
            />
            <span className="text-sm font-medium">Bonus bilan to'lovga ruxsat berish</span>
          </label>
        </div>

        <div className="card p-5 space-y-4">
          <h2 className="font-bold">🛵 Dostavka</h2>
          <Field label="Standart yetkazish narxi (so'm)" hint="Yangi dostavka buyurtmalariga avtomatik qo'yiladi">
            <input
              type="number"
              className="input"
              value={form['delivery.defaultFee'] ?? ''}
              onChange={(e) => set('delivery.defaultFee', e.target.value)}
            />
          </Field>
        </div>

        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
          {saved && <span className="text-green-600 text-sm font-semibold">✓ Saqlandi</span>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}
