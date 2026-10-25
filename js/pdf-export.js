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
      <header class="head">
        <div>
          <h1>كشف الدورة: ${safe(c.name || 'دورة بدون اسم')}</h1>
          <div class="meta">تاريخ البداية: ${reportDate(c.start)} · الحالة: ${safe(status)}</div>
        </div>
        <span class="status">${c.end ? 'مكتملة' : 'جارية'}</span>
      </header>

      <section class="metrics">
        <div class="metric">العدد الأصلي<b>${f(c.n)} طائر</b></div>
        <div class="metric">النافق<b>${f(k.dead)} طائر (${k.mort.toFixed(1)}%)</b></div>
        <div class="metric">المباع<b>${f(k.sold)} طائر · ${f(k.kgS)} كجم</b></div>
        <div class="metric">المتبقي الحي<b>${f(k.remaining)} طائر</b></div>
        <div class="metric">إجمالي المبيعات<b>${money(k.totalSales)}</b></div>
        <div class="metric">المحصل نقدًا<b>${money(k.collectedCash)}</b></div>
        <div class="metric">المتبقي من المبيعات<b>${money(k.uncollectedSales)}</b></div>
        <div class="metric">إجمالي المصروفات<b>${money(k.e)}</b></div>
        <div class="metric">صافي الربح<b>${money(k.p)}</b></div>
        <div class="metric">صافي النقدية بعد المصروفات<b>${money(k.cashProfit)}</b></div>
        <div class="metric">متوسط البيع للطائر<b>${money(k.avg)}</b></div>
        <div class="metric">تكلفة الطائر الحي<b>${money(k.cpb)}</b></div>
        <div class="metric">ربح الطائر المباع<b>${money(k.ppb)}</b></div>
        <div class="metric">مستحق لنا عند الغير<b>${money(k.debtUsRemaining)}</b></div>
        <div class="metric">مستحق علينا للغير<b>${money(k.debtThemRemaining)}</b></div>
        <div class="metric">العلف المشترى<b>${f(k.feedPurchasedKg)} كجم</b></div>
        <div class="metric">العلف المستهلك والمخزون<b>${f(k.feedConsumedKg)} / ${f(k.feedStockKg)} كجم</b></div>
        <div class="metric">معامل التحويل (FCR)<b>${k.fcr ? k.fcr.toFixed(2) : '—'}</b></div>
      </section>

      <section class="report-section">
        <h2>المصروفات (${(c.exp || []).length})</h2>
        <table>
          <thead><tr><th>التاريخ</th><th>البند</th><th>البيان</th><th>المبلغ</th></tr></thead>
          <tbody>${expenseRows}</tbody>
        </table>
      </section>

      <section class="report-section">
        <h2>المبيعات (${(c.inc || []).length})</h2>
        <table>
          <thead><tr><th>التاريخ</th><th>المشتري</th><th>العدد</th><th>الوزن</th><th>قيمة البيع</th><th>المحصل</th><th>المتبقي</th></tr></thead>
          <tbody>${saleRows}</tbody>
        </table>
      </section>

      <section class="report-section">
        <h2>النفوق (${(c.dead || []).length})</h2>
        <table>
          <thead><tr><th>التاريخ</th><th>العدد</th><th>السبب / البيان</th></tr></thead>
          <tbody>${deathRows}</tbody>
        </table>
      </section>

      <section class="report-section">
        <h2>حركات العلف (${(c.feed || []).length})</h2>
        <table>
          <thead><tr><th>التاريخ</th><th>نوع الحركة</th><th>الكمية المسجلة</th><th>الوزن</th></tr></thead>
          <tbody>${feedRows}</tbody>
        </table>
      </section>

      <section class="report-section">
        <h2>الديون والدفعات (${(c.debt || []).length})</h2>
        <table>
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
      position: absolute;
      left: 0;
      top: 0;
      z-index: 2147483647;
      width: 1120px;
      padding: 30px;
      direction: rtl;
      color: #17212b !important;
      background: #ffffff !important;
      font: 13px/1.5 'Cairo', Tahoma, Arial, sans-serif;
      box-sizing: border-box;
      opacity: 1;
      visibility: visible;
    }
    #cycle-pdf-export * { box-sizing: border-box; color: #17212b; }
    #cycle-pdf-export .report { width: 100%; background: #fff; }
    #cycle-pdf-export h1 { margin: 0; font-size: 24px; color: #0f172a; font-weight: 800; }
    #cycle-pdf-export h2 { margin: 20px 0 8px; padding-bottom: 5px; border-bottom: 2px solid #334155; font-size: 16px; color: #0f172a; font-weight: 800; break-inside: avoid; page-break-inside: avoid; }
    #cycle-pdf-export .meta, #cycle-pdf-export small { color: #526171; }
    #cycle-pdf-export .head { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; border-bottom: 3px solid #0f766e; padding-bottom: 12px; }
    #cycle-pdf-export .status { border: 1px solid #0f766e; border-radius: 20px; padding: 3px 12px; white-space: nowrap; color: #0f766e; font-weight: 700; }
    #cycle-pdf-export .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 14px 0; }
    #cycle-pdf-export .metric { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background: #f8fafc; break-inside: avoid; page-break-inside: avoid; }
    #cycle-pdf-export .metric b { display: block; font-size: 15px; color: #0f172a; margin-top: 2px; }
    #cycle-pdf-export table { width: 100%; border-collapse: collapse; margin: 6px 0 14px; font-size: 12px; }
    #cycle-pdf-export th, #cycle-pdf-export td { border: 1px solid #cbd5e1; padding: 6px 7px; text-align: right; vertical-align: top; }
    #cycle-pdf-export th { background: #f1f5f9; color: #0f172a; font-weight: 700; }
    #cycle-pdf-export .num { white-space: nowrap; font-weight: 600; }
    #cycle-pdf-export .empty { text-align: center; color: #64748b; padding: 12px; }
    #cycle-pdf-export footer { margin-top: 22px; padding-top: 8px; border-top: 1px solid #cbd5e1; color: #64748b; font-size: 11px; text-align: center; }
    #cycle-pdf-export tr { break-inside: avoid; page-break-inside: avoid; }
    #cycle-pdf-export .report-section { break-inside: auto; page-break-inside: auto; }
  `;

  document.head.appendChild(style);
  document.body.appendChild(stage);

  const prevScrollY = window.scrollY;
  const prevScrollX = window.scrollX;
  window.scrollTo(0, 0);

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    // Brief layout and paint delay so the browser fully renders the 1120px stage
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
        windowWidth: 1120,
        logging: false
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    await window.html2pdf().set(opt).from(stage).save();
    showToast('تم تنزيل كشف الدورة بصيغة PDF بنجاح ✓');
  } catch (error) {
    console.error('PDF export failed', error);
    showToast('تعذر إنشاء ملف PDF تلقائياً. جاري فتح خيار الطباعة...');
    window.print();
  } finally {
    stage.remove();
    style.remove();
    window.scrollTo(prevScrollX, prevScrollY);
    window.__cyclePdfBusy = false;
  }
}
