import type { ReceiptDto } from '../api/types';

const fmt = (n: number) => new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(n);
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dt = (iso: string) => new Date(iso).toLocaleString('uz-UZ', { dateStyle: 'short', timeStyle: 'short' });

/**
 * 80mm termal printer uchun chek HTML'ini generatsiya qiladi.
 * Barcha stillar inline — brauzer print oynasida to'g'ri chiqishi uchun.
 */
export function buildReceiptHtml(r: ReceiptDto): string {
  const row = (l: string, right: string, bold = false) =>
    `<div style="display:flex;justify-content:space-between;gap:8px;${bold ? 'font-weight:700;' : ''}">
      <span>${esc(l)}</span><span style="white-space:nowrap">${esc(right)}</span>
    </div>`;
  const hr = `<div style="border-top:1px dashed #000;margin:6px 0"></div>`;

  const items = r.items
    .map((it) => {
      const mods = it.modifiers
        .map(
          (m) =>
            `<div style="display:flex;justify-content:space-between;padding-left:10px;color:#333">
              <span>+ ${esc(m.name)}</span><span>${fmt(m.price)}</span></div>`,
        )
        .join('');
      return `<div style="margin-bottom:4px">
        <div style="font-weight:600">${esc(it.name)}</div>
        <div style="display:flex;justify-content:space-between">
          <span>${it.quantity} x ${fmt(it.unitPrice)}</span><span>${fmt(it.total)}</span>
        </div>${mods}
      </div>`;
    })
    .join('');

  const payments =
    r.kind === 'FISCAL'
      ? hr +
        r.payments.map((p) => row(p.methodLabel, fmt(p.amount))).join('') +
        (r.change > 0 ? row('Qaytim', fmt(r.change), true) : '')
      : '';

  return `<div style="font-family:'Courier New',monospace;font-size:12px;color:#000;width:280px;padding:8px;line-height:1.35">
    <div style="text-align:center">
      <div style="font-size:16px;font-weight:800">${esc(r.company.name)}</div>
      <div>${esc(r.branch.name)}</div>
      ${r.branch.address ? `<div>${esc(r.branch.address)}</div>` : ''}
      ${r.branch.phone ? `<div>${esc(r.branch.phone)}</div>` : ''}
    </div>
    ${hr}
    <div style="text-align:center;font-weight:800;font-size:14px;letter-spacing:1px">${esc(r.title)}</div>
    ${hr}
    ${row(`Buyurtma #${r.order.number}`, r.order.typeLabel)}
    ${r.order.table ? row('Stol', r.order.table) : ''}
    ${r.order.waiter ? row('Ofitsiant', r.order.waiter) : ''}
    ${row('Mehmonlar', String(r.order.guests))}
    ${row('Sana', dt(r.printedAt))}
    ${hr}
    ${items}
    ${hr}
    ${row('Oraliq summa', fmt(r.subtotal))}
    ${r.discountAmt > 0 ? row(`Chegirma ${r.discountPct}%`, '-' + fmt(r.discountAmt)) : ''}
    ${r.serviceFeeAmt > 0 ? row(`Xizmat haqi ${r.serviceFeePct}%`, fmt(r.serviceFeeAmt)) : ''}
    <div style="border-top:1px solid #000;margin:4px 0"></div>
    ${row('JAMI', fmt(r.total) + ' ' + r.currency, true)}
    ${payments}
    ${r.cashier ? `<div style="margin-top:4px">Kassir: ${esc(r.cashier)}</div>` : ''}
    ${hr}
    <div style="text-align:center;margin-top:4px">${esc(r.footer)}</div>
    <div style="text-align:center;font-size:10px;color:#555;margin-top:6px">ZarPOS</div>
  </div>`;
}
