/**
 * Chekni yashirin iframe orqali chop etadi.
 * Bu usul asosiy sahifa stillariga ta'sir qilmaydi va popup bloklanmaydi.
 * 80mm termal printer uchun @page o'lchami beriladi.
 */
export function printHtml(bodyHtml: string, title = 'Chek'): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>
      @page { size: 80mm auto; margin: 0; }
      html, body { margin: 0; padding: 0; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    </style>
  </head><body>${bodyHtml}</body></html>`);
  doc.close();

  const win = iframe.contentWindow;
  if (!win) return;

  // Kontent to'liq yuklanishini kutamiz, so'ng chop etamiz
  const run = () => {
    win.focus();
    win.print();
    setTimeout(() => iframe.remove(), 1000);
  };
  if (doc.readyState === 'complete') setTimeout(run, 150);
  else win.onload = () => setTimeout(run, 150);
}
