import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Category, Product } from '../api/types';
import { money } from '../lib/format';
import { ProductEditor } from '../components/ProductEditor';

export function MenuPage() {
  const qc = useQueryClient();
  const [catId, setCatId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ productId: string | null } | null>(null);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/catalog/categories'),
  });
  const { data: products } = useQuery({
    queryKey: ['products-admin'],
    queryFn: () => api.get<Product[]>('/catalog/products'),
  });

  const toggleStop = useMutation({
    mutationFn: ({ id, inStopList }: { id: string; inStopList: boolean }) =>
      api.post(`/catalog/products/${id}/stop-list`, { inStopList }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products-admin'] }),
  });

  const list = (products ?? []).filter((p) => !catId || p.categoryId === catId);

  return (
    <div className="h-full overflow-auto">
      <header className="px-6 py-4 bg-white border-b flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">🍽 Menyu boshqaruvi</h1>
          <p className="text-sm text-slate-400">Taomlar, rasmlar, narxlar va texnologik kartalar</p>
        </div>
        <button className="btn-primary" onClick={() => setEditor({ productId: null })}>
          + Taom qo'shish
        </button>
      </header>

      <div className="p-6">
        <div className="flex gap-2 flex-wrap mb-4">
          <CatChip active={!catId} onClick={() => setCatId(null)} label="Hammasi" />
          {categories?.map((c) => (
            <CatChip key={c.id} active={catId === c.id} onClick={() => setCatId(c.id)} label={c.name} color={c.color} />
          ))}
        </div>

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Taom</th>
                <th className="px-4 py-3">Kategoriya</th>
                <th className="px-4 py-3">Turi</th>
                <th className="px-4 py-3 text-right">Narx</th>
                <th className="px-4 py-3 text-center">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((p) => (
                <tr
                  key={p.id}
                  className={`cursor-pointer hover:bg-slate-50 ${p.inStopList ? 'bg-red-50/40' : ''}`}
                  onClick={() => setEditor({ productId: p.id })}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-lg bg-slate-100 overflow-hidden grid place-items-center text-lg shrink-0">
                        {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" /> : '🍽'}
                      </div>
                      <span className="font-semibold">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{p.category?.name}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {p.type === 'DISH' ? 'Taom' : p.type === 'GOODS' ? 'Tovar' : 'Yarim tayyor'}
                  </td>
                  <td className="px-4 py-3 text-right font-bold">{money(p.price)}</td>
                  <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => toggleStop.mutate({ id: p.id, inStopList: !p.inStopList })}
                      className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                        p.inStopList ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {p.inStopList ? 'Stop-list' : 'Mavjud'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editor && (
        <ProductEditor productId={editor.productId} categories={categories ?? []} onClose={() => setEditor(null)} />
      )}
    </div>
  );
}

function CatChip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${active ? 'text-white' : 'bg-white border border-slate-200'}`}
      style={active ? { background: color ?? '#dd5911' } : undefined}
    >
      {label}
    </button>
  );
}
