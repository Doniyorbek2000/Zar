import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ReceiptDto } from '../api/types';
import { buildReceiptHtml } from '../lib/receiptHtml';
import { printHtml } from '../lib/print';

export function ReceiptModal({
  orderId,
  kind,
  onClose,
  autoPrint = false,
}: {
  orderId: string;
  kind: 'precheck' | 'fiscal';
  onClose: () => void;
  autoPrint?: boolean;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['receipt', orderId, kind],
    queryFn: async () => {
      const dto = await api.get<ReceiptDto>(`/receipts/order/${orderId}?kind=${kind}`);
      if (autoPrint) setTimeout(() => printHtml(buildReceiptHtml(dto), 'Chek'), 200);
      return dto;
    },
  });

  const html = data ? buildReceiptHtml(data) : '';

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm p-5 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold">{kind === 'fiscal' ? '🧾 Fiskal chek' : '🧾 Hisob (pre-check)'}</h2>
          <button onClick={onClose} className="text-slate-400 text-xl">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-slate-100 rounded-lg p-4 grid place-items-center">
          {isLoading ? (
            <div className="text-slate-400 py-10 text-sm">Yuklanmoqda...</div>
          ) : (
            <div
              className="bg-white shadow-sm"
              style={{ width: 280 }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <button className="btn-ghost flex-1" onClick={onClose}>
            Yopish
          </button>
          <button
            className="btn-primary flex-1"
            disabled={!data}
            onClick={() => data && printHtml(html, 'Chek')}
          >
            🖨 Chop etish
          </button>
        </div>
      </div>
    </div>
  );
}
