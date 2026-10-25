/** Direct PDF export for a complete cycle report (no print dialog). */
async function downloadCyclePdf() {
  const c = cur();
  if (!c || window.__cyclePdfBusy) return;
  if (typeof window.html2pdf !== 'function') {
    showToast('تعذر تحميل أداة PDF. تأكد من اتصال الإنترنت وحاول مرة أخرى.');
    return;
  }

  window.__cyclePdfBusy = true;
  showToast('جاري تجهيز ملف PDF للدورة…');

  const k = calc(c);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const money = value => `${f(value)} ج`;
  const reportDate = value => safe(fd(value) || '—');
  const rows = (items, renderRow, emptyText, colSpan) => items && items.length
    ? items.map(renderRow).join('')
    : `<tr><td colspan="${colSpan}" class="empty">${emptyText}</td></tr>`;

  const expenseRows = rows(c.exp, e => `
    <tr><td>${reportDate(e.d)}</td><td>${safe(e.cat || '—')}</td><td>${safe(e.note || '—')}</td><td class="num">${money(e.amt)}</td></tr>
  `, 'لا توجد مصروفات مسجلة', 4);

  const saleRows = rows(c.inc, e => {
    const total = +e.amt || +e.totalAmt || 0;
    const paid = e.paidAmt !== undefined ? +e.paidAmt : total;
    return `<tr><td>${reportDate(e.d)}</td><td>${safe(e.buyer || '—')}</td><td class="num">${f(e.cnt)} طائر</td><td class="num">${f(e.kg)} كجم</td><td class="num">${money(total)}</td><td class="num">${money(paid)}</td><td class="num">${money(Math.max(0, total - paid))}</td></tr>`;
  }, 'لا توجد مبيعات مسجلة', 7);

  const deathRows = rows(c.dead, e => `
    <tr><td>${reportDate(e.d)}</td><td class="num">${f(e.n)} طائر</td><td>${safe(e.note || '—')}</td></tr>
  `, 'لا يوجد نفوق مسجل', 3);

  const feedRows = rows(c.feed, e => {
    const type = e.type === 'purchased' ? 'وارد للمخزن' : e.type === 'consumed' ? 'مستهلك للطيور' : 'علف (سجل قديم)';
    const quantity = e.txt || `${e.q || ''} ${e.unit || ''}`.trim() || '—';
    return `<tr><td>${reportDate(e.d)}</td><td>${type}</td><td>${safe(quantity)}</td><td class="num">${f(e.kg)} كجم</td></tr>`;
  }, 'لا توجد حركات علف مسجلة', 4);

  const debtRows = rows(c.debt, e => {
    const total = +e.amt || 0;
    const paid = e.paidAmt !== undefined ? +e.paidAmt : (e.paid ? total : 0);
    const direction = e.dir === 'لنا' || e.dir === 'ليا عنده' ? 'مستحق لنا عند الغير' : 'مستحق علينا للغير';
    const payments = (e.payments || []).map(p => `${reportDate(p.d)}: ${money(p.amt)}${p.note ? ` (${safe(p.note)})` : ''}`).join('<br>') || '—';
    return `<tr><td>${reportDate(e.d)}</td><td>${safe(e.who || '—')}<br><small>${direction}</small></td><td class="num">${money(total)}</td><td class="num">${money(paid)}</td><td class="num">${money(Math.max(0, total - paid))}</td><td>${payments}</td></tr>`;
  }, 'لا توجد ديون مسجلة', 6);

  const filename = `كشف دورة - ${String(c.name || 'دورة بدون اسم').replace(/[\\/:*?"<>|]/g, '-').trim()}.pdf`;
  const status = c.end ? `مكتملة — ${fd(c.end)}` : 'جارية';
  const stage = document.createElement('div');
  stage.id = 'cycle-pdf-export';
  stage.innerHTML = `
    <main class="report">
      <header class="head"><div><h1>كشف الدورة: ${safe(c.name || 'دورة بدون اسم')}</h1><div class="meta">تاريخ البداية: ${reportDate(c.start)} · الحالة: ${safe(status)}</div></div><span class="status">${c.end ? 'مكتملة' : 'جارية'}</span></header>
      <section class="metrics">
        <div class="metric">العدد الأصلي<b>${f(c.n)} طائر</b></div><div class="metric">النافق<b>${f(k.dead)} طائر (${k.mort.toFixed(1)}%)</b></div>
        <div class="metric">المباع<b>${f(k.sold)} طائر · ${f(k.kgS)} كجم</b></div><div class="metric">المتبقي الحي<b>${f(k.remaining)} طائر</b></div>
        <div class="metric">إجمالي المبيعات<b>${money(k.totalSales)}</b></div><div class="metric">المحصل نقدًا<b>${money(k.collectedCash)}</b></div>
        <div class="metric">المتبقي من المبيعات<b>${money(k.uncollectedSales)}</b></div><div class="metric">إجمالي المصروفات<b>${money(k.e)}</b></div>
        <div class="metric">صافي الربح<b>${money(k.p)}</b></div><div class="metric">صافي النقدية بعد المصروفات<b>${money(k.cashProfit)}</b></div>
        <div class="metric">متوسط البيع للطائر<b>${money(k.avg)}</b></div><div class="metric">تكلفة الطائر الحي<b>${money(k.cpb)}</b></div>
        <div class="metric">ربح الطائر المباع<b>${money(k.ppb)}</b></div><div class="metric">مستحق لنا عند الغير<b>${money(k.debtUsRemaining)}</b></div>
        <div class="metric">مستحق علينا للغير<b>${money(k.debtThemRemaining)}</b></div><div class="metric">العلف المشترى<b>${f(k.feedPurchasedKg)} كجم</b></div>
        <div class="metric">العلف المستهلك والمخزون<b>${f(k.feedConsumedKg)} / ${f(k.feedStockKg)} كجم</b></div><div class="metric">معامل التحويل (FCR)<b>${k.fcr ? k.fcr.toFixed(2) : '—'}</b></div>
      </section>
      <section class="report-section"><h2>المصروفات (${(c.exp || []).length})</h2><table><thead><tr><th>التاريخ</th><th>البند</th><th>البيان</th><th>المبلغ</th></tr></thead><tbody>${expenseRows}</tbody></table></section>
      <section class="report-section"><h2>المبيعات (${(c.inc || []).length})</h2><table><thead><tr><th>التاريخ</th><th>المشتري</th><th>العدد</th><th>الوزن</th><th>قيمة البيع</th><th>المحصل</th><th>المتبقي</th></tr></thead><tbody>${saleRows}</tbody></table></section>
      <section class="report-section"><h2>النفوق (${(c.dead || []).length})</h2><table><thead><tr><th>التاريخ</th><th>العدد</th><th>السبب / البيان</th></tr></thead><tbody>${deathRows}</tbody></table></section>
      <section class="report-section"><h2>حركات العلف (${(c.feed || []).length})</h2><table><thead><tr><th>التاريخ</th><th>نوع الحركة</th><th>الكمية المسجلة</th><th>الوزن</th></tr></thead><tbody>${feedRows}</tbody></table></section>
      <section class="report-section"><h2>الديون والدفعات (${(c.debt || []).length})</h2><table><thead><tr><th>التاريخ</th><th>الطرف / الاتجاه</th><th>أصل الدين</th><th>المسدد</th><th>المتبقي</th><th>تفاصيل الدفعات</th></tr></thead><tbody>${debtRows}</tbody></table></section>
      <footer>تم إنشاء الكشف من دفتر رفاعي · ${reportDate(today())}</footer>
    </main>`;

  const style = document.createElement('style');
  style.id = 'cycle-pdf-export-style';
  style.textContent = `
    #cycle-pdf-export { position:absolute; left:-12000px; top:0; width:1200px; padding:32px; direction:rtl; color:#17212b; background:#fff; font:14px/1.6 Cairo,Tahoma,Arial,sans-serif; }
    #cycle-pdf-export * { box-sizing:border-box; }
    #cycle-pdf-export .report { width:100%; }
    #cycle-pdf-export h1 { margin:0; font-size:26px; }
    #cycle-pdf-export h2 { margin:24px 0 8px; padding-bottom:5px; border-bottom:2px solid #334155; font-size:18px; }
    #cycle-pdf-export .meta, #cycle-pdf-export small { color:#526171; }
    #cycle-pdf-export .head { display:flex; justify-content:space-between; gap:20px; align-items:flex-start; border-bottom:3px solid #0f766e; padding-bottom:14px; }
    #cycle-pdf-export .status { border:1px solid #0f766e; border-radius:20px; padding:3px 12px; white-space:nowrap; color:#0f766e; font-weight:700; }
    #cycle-pdf-export .metrics { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin:16px 0; }
    #cycle-pdf-export .metric { border:1px solid #cbd5e1; border-radius:8px; padding:9px; break-inside:avoid; }
    #cycle-pdf-export .metric b { display:block; font-size:16px; }
    #cycle-pdf-export table { width:100%; border-collapse:collapse; margin:7px 0 16px; font-size:12px; }
    #cycle-pdf-export th, #cycle-pdf-export td { border:1px solid #cbd5e1; padding:6px 7px; text-align:right; vertical-align:top; }
    #cycle-pdf-export th { background:#f1f5f9; }
    #cycle-pdf-export .num { white-space:nowrap; }
    #cycle-pdf-export .empty { text-align:center; color:#64748b; }
    #cycle-pdf-export footer { margin-top:26px; padding-top:8px; border-top:1px solid #cbd5e1; color:#64748b; font-size:11px; text-align:center; }
    #cycle-pdf-export h2, #cycle-pdf-export tr, #cycle-pdf-export .metric { break-inside:avoid; }
  `;

  document.head.appendChild(style);
  document.body.appendChild(stage);

  try {
    if (document.fonts?.ready) await document.fonts.ready;
    await window.html2pdf().set({
      filename,
      margin: [8, 8, 8, 8],
      image: { type: 'jpeg', quality: 0.96 },
      html2canvas: { scale: 1.5, useCORS: true, backgroundColor: '#ffffff', logging: false, windowWidth: 1200 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.metric', 'h2'] }
    }).from(stage).save();
    showToast('تم تنزيل كشف الدورة بصيغة PDF ✓');
  } catch (error) {
    console.error('PDF export failed', error);
    showToast('تعذر إنشاء ملف PDF. حاول مرة أخرى.');
  } finally {
    stage.remove();
    style.remove();
    window.__cyclePdfBusy = false;
  }
}
