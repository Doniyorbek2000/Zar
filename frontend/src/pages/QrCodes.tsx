import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { api } from '../api/client';
import type { Hall } from '../api/types';
import { printHtml } from '../lib/print';

export function QrCodesPage() {
  const { data: halls } = useQuery({ queryKey: ['halls'], queryFn: () => api.get<Hall[]>('/tables/halls') });
  const [qrMap, setQrMap] = useState<Record<string, string>>({});

  const tables = (halls ?? []).flatMap((h) => h.tables.map((t) => ({ ...t, hall: h.name })));
  const menuUrl = (tableId: string) => `${window.location.origin}/m/${tableId}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map: Record<string, string> = {};
      for (const t of tables) {
        map[t.id] = await QRCode.toDataURL(menuUrl(t.id), { width: 240, margin: 1 });
      }
      if (!cancelled) setQrMap(map);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [halls]);

  const printAll = () => {
    const cards = tables
      .map(
        (t) => `<div style="display:inline-block;width:280px;text-align:center;margin:12px;padding:16px;border:1px solid #ddd;border-radius:12px;font-family:sans-serif;page-break-inside:avoid">
          <div style="font-size:12px;color:#888">${t.hall}</div>
          <div style="font-size:22px;font-weight:800;margin-bottom:8px">${t.name}</div>
          <img src="${qrMap[t.id] ?? ''}" style="width:220px;height:220px" />
          <div style="font-size:12px;color:#888;margin-top:8px">Menyu uchun skanerlang</div>
        </div>`,
      )
      .join('');
    printHtml(`<div style="text-align:center">${cards}</div>`, 'QR menyu kodlari');
  };

  return (
    <div className="h-full overflow-auto">
      <header className="px-6 py-4 bg-white border-b flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">📱 QR menyu kodlari</h1>
          <p className="text-sm text-slate-400">Har stol uchun QR — mijoz skanerlab o'zi zakaz beradi</p>
        </div>
        <button className="btn-primary" onClick={printAll} disabled={!tables.length}>
          🖨 Hammasini chop etish
        </button>
      </header>

      <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {tables.map((t) => (
          <div key={t.id} className="card p-4 text-center">
            <div className="text-xs text-slate-400">{t.hall}</div>
            <div className="font-bold text-lg mb-2">{t.name}</div>
            {qrMap[t.id] ? (
              <img src={qrMap[t.id]} alt={t.name} className="w-full rounded-lg" />
            ) : (
              <div className="aspect-square bg-slate-100 rounded-lg animate-pulse" />
            )}
            <a
              href={menuUrl(t.id)}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-brand-600 mt-2 block truncate hover:underline"
            >
              Menyuni ochish ↗
            </a>
          </div>
        ))}
        {!tables.length && <div className="col-span-full text-center text-slate-400 py-16">Stollar topilmadi</div>}
      </div>
    </div>
  );
}
