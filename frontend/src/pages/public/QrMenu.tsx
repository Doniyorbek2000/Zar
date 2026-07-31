import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { Category } from '../../api/types';
import { money } from '../../lib/format';

interface PublicProduct {
  id: string;
  categoryId: string;
  name: string;
  description?: string | null;
  price: string;
  imageUrl?: string | null;
  inStopList: boolean;
}
interface TableInfo {
  tableId: string;
  tableName: string;
  branchId: string;
  branchName: string;
  companyName: string;
}
interface MenuData {
  company: { name: string };
  branch: { id: string; name: string };
  categories: Category[];
  products: PublicProduct[];
}

export function QrMenuPage() {
  const { tableId = '' } = useParams();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [catId, setCatId] = useState<string | null>(null);
  const [sent, setSent] = useState<null | { number: number }>(null);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');

  const { data: table } = useQuery({
    queryKey: ['pub-table', tableId],
    queryFn: () => api.get<TableInfo>(`/public/table/${tableId}`),
  });
  const { data: menu } = useQuery({
    queryKey: ['pub-menu', table?.branchId],
    enabled: !!table?.branchId,
    queryFn: () => api.get<MenuData>(`/public/menu?branchId=${table!.branchId}`),
  });

  const products = useMemo(() => {
    let list = menu?.products ?? [];
    if (catId) list = list.filter((p) => p.categoryId === catId);
    return list;
  }, [menu, catId]);

  const cartItems = Object.entries(cart).filter(([, q]) => q > 0);
  const total = cartItems.reduce((s, [id, q]) => {
    const p = menu?.products.find((x) => x.id === id);
    return s + (p ? Number(p.price) * q : 0);
  }, 0);
  const count = cartItems.reduce((s, [, q]) => s + q, 0);

  const add = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const sub = (id: string) => setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) - 1) }));

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await api.post<{ order: { number: number } }>(
        '/public/orders',
        {
          tableId,
          customerName: name || undefined,
          items: cartItems.map(([productId, quantity]) => ({ productId, quantity })),
        },
        false,
      );
      setSent({ number: res.order.number });
      setCart({});
    } catch {
      alert('Buyurtma yuborishda xatolik. Qayta urinib ko\'ring.');
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 p-6 text-center">
        <div>
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-extrabold mb-2">Buyurtma qabul qilindi!</h1>
          <p className="text-slate-500 mb-1">Buyurtma raqami: #{sent.number}</p>
          <p className="text-slate-500">Ofitsiant tez orada keladi. Rahmat! 🙏</p>
          <button className="btn-primary mt-6" onClick={() => setSent(null)}>
            Yana buyurtma berish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <header className="bg-gradient-to-br from-brand-600 to-brand-800 text-white px-5 pt-6 pb-5 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs opacity-80">{table?.branchName ?? '...'}</div>
            <h1 className="text-xl font-extrabold">{table?.companyName ?? 'Menyu'}</h1>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-80">Stol</div>
            <div className="font-bold text-lg">{table?.tableName ?? '—'}</div>
          </div>
        </div>
      </header>

      <div className="px-4 py-3 flex gap-2 overflow-x-auto sticky top-[76px] bg-slate-50/95 backdrop-blur z-10">
        <Chip active={!catId} onClick={() => setCatId(null)} label="Hammasi" />
        {menu?.categories.map((c) => (
          <Chip key={c.id} active={catId === c.id} onClick={() => setCatId(c.id)} label={c.name} color={c.color} />
        ))}
      </div>

      <div className="px-4 space-y-3">
        {products.map((p) => (
          <div key={p.id} className={`card p-3 flex gap-3 ${p.inStopList ? 'opacity-50' : ''}`}>
            <div className="w-20 h-20 rounded-lg bg-slate-100 shrink-0 overflow-hidden grid place-items-center text-3xl">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                '🍽'
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold leading-tight">{p.name}</div>
              {p.description && <div className="text-xs text-slate-400 line-clamp-2">{p.description}</div>}
              <div className="text-brand-700 font-extrabold mt-1">{money(p.price)}</div>
            </div>
            <div className="flex flex-col items-center justify-center">
              {cart[p.id] ? (
                <div className="flex items-center gap-2">
                  <button className="w-8 h-8 rounded-full bg-slate-100 font-bold" onClick={() => sub(p.id)}>
                    −
                  </button>
                  <span className="w-5 text-center font-bold">{cart[p.id]}</span>
                  <button className="w-8 h-8 rounded-full bg-brand-600 text-white font-bold" onClick={() => add(p.id)}>
                    +
                  </button>
                </div>
              ) : (
                <button
                  disabled={p.inStopList}
                  className="w-9 h-9 rounded-full bg-brand-600 text-white text-xl font-bold disabled:bg-slate-300"
                  onClick={() => add(p.id)}
                >
                  +
                </button>
              )}
            </div>
          </div>
        ))}
        {!products.length && <div className="text-center text-slate-400 py-10">Menyu yuklanmoqda...</div>}
      </div>

      {count > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t shadow-2xl p-4 space-y-3">
          <input
            className="input"
            placeholder="Ismingiz (ixtiyoriy)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn-primary w-full py-3.5 text-base" disabled={submitting} onClick={submit}>
            {submitting ? 'Yuborilmoqda...' : `Buyurtma berish · ${count} ta · ${money(total)}`}
          </button>
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${active ? 'text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
      style={active ? { background: color ?? '#dd5911' } : undefined}
    >
      {label}
    </button>
  );
}
