import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { num, timeAgo } from '../lib/format';

interface KdsItem {
  id: string;
  name: string;
  quantity: string;
  status: string;
  note?: string;
}
interface KdsOrder {
  id: string;
  number: number;
  type: string;
  openedAt: string;
  table?: { name: string };
  waiter?: { fullName: string };
  items: KdsItem[];
}

export function KitchenPage() {
  const qc = useQueryClient();
  const { data: queue } = useQuery({
    queryKey: ['kds'],
    queryFn: () => api.get<KdsOrder[]>('/kitchen/queue'),
    refetchInterval: 15000, // real-time zaxirasi (asosiy yangilanish WebSocket orqali)
  });

  const setStatus = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: string }) =>
      api.post(`/kitchen/items/${itemId}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kds'] }),
  });

  return (
    <div className="h-full overflow-auto bg-slate-900">
      <header className="px-6 py-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-xl font-bold text-white">👨‍🍳 Oshxona ekrani (KDS)</h1>
        <span className="text-sm text-slate-400">{queue?.length ?? 0} ta faol buyurtma</span>
      </header>

      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {queue?.map((o) => {
          const mins = Math.floor((Date.now() - new Date(o.openedAt).getTime()) / 60000);
          const urgent = mins > 15;
          return (
            <div
              key={o.id}
              className={`rounded-xl overflow-hidden border-2 ${urgent ? 'border-red-500' : 'border-slate-700'}`}
            >
              <div className={`px-4 py-2 flex justify-between items-center ${urgent ? 'bg-red-600' : 'bg-slate-700'}`}>
                <span className="font-bold text-white">
                  #{o.number} · {o.table?.name ?? 'Olib ketish'}
                </span>
                <span className="text-xs text-white/80">{timeAgo(o.openedAt)}</span>
              </div>
              <div className="bg-slate-800 p-3 space-y-2">
                {o.items.map((it) => (
                  <div key={it.id} className="bg-slate-700/50 rounded-lg p-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-white font-semibold text-sm">
                        {num(it.quantity)}× {it.name}
                      </span>
                      {it.status === 'READY' && <span className="text-green-400 text-xs font-bold">TAYYOR</span>}
                    </div>
                    {it.note && <div className="text-xs text-amber-300 mt-1">📝 {it.note}</div>}
                    <div className="flex gap-1.5 mt-2">
                      {it.status !== 'READY' ? (
                        <button
                          className="flex-1 py-1.5 rounded-md bg-green-600 text-white text-xs font-semibold"
                          onClick={() => setStatus.mutate({ itemId: it.id, status: 'READY' })}
                        >
                          ✓ Tayyor
                        </button>
                      ) : (
                        <button
                          className="flex-1 py-1.5 rounded-md bg-slate-600 text-white text-xs font-semibold"
                          onClick={() => setStatus.mutate({ itemId: it.id, status: 'SERVED' })}
                        >
                          Berildi
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {!queue?.length && (
          <div className="col-span-full text-center text-slate-500 py-20">Oshxonada faol buyurtmalar yo'q ✨</div>
        )}
      </div>
    </div>
  );
}
