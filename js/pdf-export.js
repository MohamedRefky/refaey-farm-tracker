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
  const money = value => `<bdi class="pdf-money" dir="ltr">${f(value)} ج</bdi>`;
  const formatQuantity = (value, unit) => `<bdi class="pdf-quantity" dir="ltr">${f(value)} ${unit}</bdi>`;
  const reportDate = value => `<bdi class="report-date" dir="auto">${safe(fd(value) || '—')}</bdi>`;
  const rows = (items, renderRow, emptyText, colSpan) => items && items.length
    ? items.map(renderRow).join('')
    : `<tr><td colspan="${colSpan}" class="empty">${emptyText}</td></tr>`;

  const expenseRows = rows(c.exp, e => `
    <tr><td>${reportDate(e.d)}</td><td>${safe(e.cat || '—')}</td><td dir="auto">${safe(e.note || '—')}</td><td class="num">${money(e.amt)}</td></tr>
  `, 'لا توجد مصروفات مسجلة', 4);

  const saleRows = rows(c.inc, e => {
    const total = +e.amt || +e.totalAmt || 0;
    const paid = e.paidAmt !== undefined ? +e.paidAmt : total;
    return `<tr><td>${reportDate(e.d)}</td><td dir="auto">${safe(e.buyer || '—')}</td><td class="num">${formatQuantity(e.cnt, 'طائر')}</td><td class="num">${formatQuantity(e.kg, 'كجم')}</td><td class="num">${money(total)}</td><td class="num">${money(paid)}</td><td class="num">${money(Math.max(0, total - paid))}</td></tr>`;
  }, 'لا توجد مبيعات مسجلة', 7);

  const deathRows = rows(c.dead, e => `
    <tr><td>${reportDate(e.d)}</td><td class="num">${formatQuantity(e.n, 'طائر')}</td><td dir="auto">${safe(e.note || '—')}</td></tr>
  `, 'لا يوجد نفوق مسجل', 3);

  const feedRows = rows(c.feed, e => {
    const type = e.type === 'purchased' ? 'وارد للمخزن' : e.type === 'consumed' ? 'مستهلك للطيور' : 'علف (سجل قديم)';
    const feedQuantity = e.txt || `${e.q || ''} ${e.unit || ''}`.trim() || '—';
    return `<tr><td>${reportDate(e.d)}</td><td>${type}</td><td dir="auto">${safe(feedQuantity)}</td><td class="num">${formatQuantity(e.kg, 'كجم')}</td></tr>`;
  }, 'لا توجد حركات علف مسجلة', 4);

  const debtRows = rows(c.debt, e => {
    const total = +e.amt || 0;
    const paid = e.paidAmt !== undefined ? +e.paidAmt : (e.paid ? total : 0);
    const direction = e.dir === 'لنا' || e.dir === 'ليا عنده' ? 'مستحق لنا عند الغير' : 'مستحق علينا للغير';
    const payments = (e.payments || []).map(p => `<span class="payment-line">${reportDate(p.d)}: ${money(p.amt)}${p.note ? ` (${safe(p.note)})` : ''}</span>`).join('') || '—';
    return `<tr><td>${reportDate(e.d)}</td><td dir="auto">${safe(e.who || '—')}<br><small>${direction}</small></td><td class="num">${money(total)}</td><td class="num">${money(paid)}</td><td class="num">${money(Math.max(0, total - paid))}</td><td dir="auto">${payments}</td></tr>`;
  }, 'لا توجد ديون مسجلة', 6);

  const filename = `كشف دورة - ${String(c.name || 'دورة بدون اسم').replace(/[\\/:*?"<>|]/g, '-').trim()}.pdf`;
  const status = c.end ? `مكتملة — ${fd(c.end)}` : 'جارية';
  const stage = document.createElement('div');
  stage.id = 'cycle-pdf-export';
  stage.innerHTML = `
    <main class="report">
      <header class="head">
        <div>
          <h1><span>كشف الدورة</span><bdi class="title-name" dir="auto">${safe(c.name || 'دورة بدون اسم')}</bdi></h1>
          <div class="meta"><span>تاريخ البداية</span>${reportDate(c.start)}<span class="meta-separator">·</span><span>الحالة</span><span>${safe(status)}</span></div>
        </div>
        <span class="status">${c.end ? 'مكتملة' : 'جارية'}</span>
      </header>

      <section class="metrics">
        <div class="metric"><span class="metric-label">العدد الأصلي</span><b class="metric-value">${formatQuantity(c.n, 'طائر')}</b></div>
        <div class="metric"><span class="metric-label">النافق</span><b class="metric-value">${formatQuantity(k.dead, 'طائر')} (${k.mort.toFixed(1)}%)</b></div>
        <div class="metric"><span class="metric-label">المباع والوزن</span><b class="metric-value">${formatQuantity(k.sold, 'طائر')} · ${formatQuantity(k.kgS, 'كجم')}</b></div>
        <div class="metric"><span class="metric-label">المتبقي الحي</span><b class="metric-value">${formatQuantity(k.remaining, 'طائر')}</b></div>
        <div class="metric"><span class="metric-label">إجمالي المبيعات</span><b class="metric-value">${money(k.totalSales)}</b></div>
        <div class="metric"><span class="metric-label">المحصل نقدًا</span><b class="metric-value">${money(k.collectedCash)}</b></div>
        <div class="metric"><span class="metric-label">المتبقي من المبيعات</span><b class="metric-value">${money(k.uncollectedSales)}</b></div>
        <div class="metric"><span class="metric-label">إجمالي المصروفات</span><b class="metric-value">${money(k.e)}</b></div>
        <div class="metric"><span class="metric-label">صافي الربح</span><b class="metric-value">${money(k.p)}</b></div>
        <div class="metric"><span class="metric-label">صافي النقدية بعد المصروفات</span><b class="metric-value">${money(k.cashProfit)}</b></div>
        <div class="metric"><span class="metric-label">متوسط البيع للطائر</span><b class="metric-value">${money(k.avg)}</b></div>
        <div class="metric"><span class="metric-label">تكلفة الطائر الحي</span><b class="metric-value">${money(k.cpb)}</b></div>
        <div class="metric"><span class="metric-label">ربح الطائر المباع</span><b class="metric-value">${money(k.ppb)}</b></div>
        <div class="metric"><span class="metric-label">مستحق لنا عند الغير</span><b class="metric-value">${money(k.debtUsRemaining)}</b></div>
        <div class="metric"><span class="metric-label">مستحق علينا للغير</span><b class="metric-value">${money(k.debtThemRemaining)}</b></div>
        <div class="metric"><span class="metric-label">العلف المشترى</span><b class="metric-value">${formatQuantity(k.feedPurchasedKg, 'كجم')}</b></div>
        <div class="metric"><span class="metric-label">العلف المستهلك / المخزون</span><b class="metric-value">${formatQuantity(k.feedConsumedKg, 'كجم')} / ${formatQuantity(k.feedStockKg, 'كجم')}</b></div>
        <div class="metric"><span class="metric-label">معامل التحويل (FCR)</span><b class="metric-value"><bdi dir="ltr">${k.fcr ? k.fcr.toFixed(2) : '—'}</bdi></b></div>
      </section>

      <section class="report-section">
        <h2><span>المصروفات</span><bdi dir="ltr">(${(c.exp || []).length})</bdi></h2>
        <table class="expenses-table">
          <thead><tr><th>التاريخ</th><th>البند</th><th>البيان</th><th>المبلغ</th></tr></thead>
          <tbody>${expenseRows}</tbody>
        </table>
      </section>

      <section class="report-section">
        <h2><span>المبيعات</span><bdi dir="ltr">(${(c.inc || []).length})</bdi></h2>
        <table class="sales-table">
          <thead><tr><th>التاريخ</th><th>المشتري</th><th>العدد</th><th>الوزن</th><th>قيمة البيع</th><th>المحصل</th><th>المتبقي</th></tr></thead>
          <tbody>${saleRows}</tbody>
        </table>
      </section>

      <section class="report-section">
        <h2><span>النفوق</span><bdi dir="ltr">(${(c.dead || []).length})</bdi></h2>
        <table class="deaths-table">
          <thead><tr><th>التاريخ</th><th>العدد</th><th>السبب / البيان</th></tr></thead>
          <tbody>${deathRows}</tbody>
        </table>
      </section>

      <section class="report-section">
        <h2><span>حركات العلف</span><bdi dir="ltr">(${(c.feed || []).length})</bdi></h2>
        <table class="feed-table">
          <thead><tr><th>التاريخ</th><th>نوع الحركة</th><th>الكمية المسجلة</th><th>الوزن</th></tr></thead>
          <tbody>${feedRows}</tbody>
        </table>
      </section>

      <section class="report-section">
        <h2><span>الديون والدفعات</span><bdi dir="ltr">(${(c.debt || []).length})</bdi></h2>
        <table class="debts-table">
          <thead><tr><th>التاريخ</th><th>الطرف / الاتجاه</th><th>أصل الدين</th><th>المسدد</th><th>المتبقي</th><th>تفاصيل الدفعات</th></tr></thead>
          <tbody>${debtRows}</tbody>
        </table>
      </section>

      <footer>تم إنشاء الكشف من دفتر رفاعي · ${reportDate(today())}</footer>
    </main>`;

  const style = document.createElement('style');
  style.id = 'cycle-pdf-export-style';
  style.textContent = `
    #cycle-pdf-export {
      position: relative;
      width: 1000px;
      max-width: none;
      margin: 0 auto;
      padding: 24px;
      direction: rtl;
      text-align: right;
      unicode-bidi: isolate;
      color: #17212b !important;
      background: #ffffff !important;
      font: 13px/1.5 'Cairo', Tahoma, Arial, sans-serif;
      box-sizing: border-box;
      opacity: 1;
      visibility: visible;
    }
    #cycle-pdf-export * { box-sizing: border-box; color: #17212b; }
    #cycle-pdf-export .report { width: 100%; background: #fff; }
    #cycle-pdf-export h1 { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 8px; margin: 0; font-size: 24px; color: #0f172a; font-weight: 800; }
    #cycle-pdf-export h1 > * { unicode-bidi: isolate; }
    #cycle-pdf-export h2 { display: flex; align-items: baseline; gap: 6px; margin: 20px 0 8px; padding-bottom: 5px; border-bottom: 2px solid #334155; font-size: 16px; color: #0f172a; font-weight: 800; break-inside: avoid; page-break-inside: avoid; }
    #cycle-pdf-export .meta, #cycle-pdf-export small { color: #526171; }
    #cycle-pdf-export .meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 5px; margin-top: 3px; }
    #cycle-pdf-export .meta > * { unicode-bidi: isolate; }
    #cycle-pdf-export .meta-separator { padding: 0 3px; }
    #cycle-pdf-export .head { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; border-bottom: 3px solid #0f766e; padding-bottom: 12px; }
    #cycle-pdf-export .status { border: 1px solid #0f766e; border-radius: 20px; padding: 3px 12px; white-space: nowrap; color: #0f766e; font-weight: 700; }
    #cycle-pdf-export .metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 14px 0; }
    #cycle-pdf-export .metric { min-width: 0; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background: #f8fafc; break-inside: avoid; page-break-inside: avoid; }
    #cycle-pdf-export .metric-label { display: block; min-height: 1.5em; line-height: 1.5; color: #526171; }
    #cycle-pdf-export .metric-value { display: block; margin-top: 5px; font-size: 15px; line-height: 1.5; color: #0f172a; unicode-bidi: isolate; }
    #cycle-pdf-export .pdf-money, #cycle-pdf-export .pdf-quantity, #cycle-pdf-export .report-date { unicode-bidi: isolate; }
    #cycle-pdf-export table { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 6px 0 14px; font-size: 12px; }
    #cycle-pdf-export th, #cycle-pdf-export td { border: 1px solid #cbd5e1; padding: 6px 7px; text-align: right; vertical-align: top; overflow-wrap: anywhere; }
    #cycle-pdf-export th { background: #f1f5f9; color: #0f172a; font-weight: 700; }
    #cycle-pdf-export .num { font-weight: 600; unicode-bidi: plaintext; }
    #cycle-pdf-export .empty { text-align: center; color: #64748b; padding: 12px; }
    #cycle-pdf-export footer { margin-top: 22px; padding-top: 8px; border-top: 1px solid #cbd5e1; color: #64748b; font-size: 11px; text-align: center; }
    #cycle-pdf-export tr { break-inside: avoid; page-break-inside: avoid; }
    #cycle-pdf-export .report-section { break-inside: auto; page-break-inside: auto; }
  `;

  document.head.appendChild(style);
  document.body.appendChild(stage);

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    // Brief layout and paint delay so the browser fully renders the report stage
    await new Promise(resolve => setTimeout(resolve, 250));

    const opt = {
      filename,
      margin: [8, 8, 8, 8],
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        scrollY: 0,
        scrollX: 0,
        windowWidth: 1000,
        logging: false
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    await window.html2pdf().set(opt).from(stage).save();
    showToast('تم تنزيل كشف الدورة بصيغة PDF بنجاح ✓');
  } catch (error) {
    console.error('PDF export failed', error);
    showToast('تعذر إنشاء ملف PDF. حاول مرة أخرى بعد تحديث الصفحة.');
  } finally {
    stage.remove();
    style.remove();
    window.__cyclePdfBusy = false;
  }
}
