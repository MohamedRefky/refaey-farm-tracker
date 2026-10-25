/**
 * Refaey Farm Tracker - Professional PDF & Print Export Module
 * Generates clean, un-clipped A4 PDFs with perfect Arabic typography and proper margins.
 */

async function downloadCyclePdf() {
  const c = cur();
  if (!c || window.__cyclePdfBusy) return;

  window.__cyclePdfBusy = true;
  showToast('جاري تجهيز وتنزيل كشف الدورة PDF…');

  const k = calc(c);
  const safe = v => String(v ?? '').trim() || '—';
  const isOngoing = !c.end;
  const cycleDays = Math.max(1, Math.floor((new Date(c.end || today()) - new Date(c.start)) / (1000 * 60 * 60 * 24)) + 1);

  // Build the dedicated A4 print/PDF container
  const container = document.createElement('div');
  container.id = 'cycle-pdf-export-container';

  container.innerHTML = `
    <style>
      #cycle-pdf-export-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 750px;
        max-width: 750px;
        min-width: 750px;
        background: #ffffff !important;
        color: #0f172a !important;
        padding: 24px 28px !important;
        box-sizing: border-box !important;
        direction: rtl !important;
        text-align: right !important;
        font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif !important;
        z-index: 9999999 !important;
        overflow: visible !important;
      }
      #cycle-pdf-export-container * {
        box-sizing: border-box !important;
        font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif !important;
        word-spacing: 1px !important;
      }
      .pdf-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 3px solid #10b981;
        padding-bottom: 12px;
        margin-bottom: 16px;
      }
      .pdf-title-box h1 {
        margin: 0 0 6px 0;
        font-size: 22px;
        font-weight: 800;
        color: #0f172a;
        line-height: 1.3;
      }
      .pdf-meta-text {
        font-size: 11px;
        color: #64748b;
        font-weight: 600;
        line-height: 1.4;
      }
      .pdf-status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 700;
        background: ${isOngoing ? '#ecfdf5' : '#f1f5f9'};
        color: ${isOngoing ? '#059669' : '#475569'};
        border: 1px solid ${isOngoing ? '#10b981' : '#cbd5e1'};
      }
      .pdf-section-title {
        font-size: 14px;
        font-weight: 800;
        color: #0f172a;
        margin: 18px 0 8px 0;
        padding-bottom: 4px;
        border-bottom: 2px solid #e2e8f0;
        page-break-after: avoid;
        break-after: avoid;
      }
      .pdf-metrics-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin-bottom: 14px;
        width: 100%;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .pdf-card {
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 8px 10px;
        min-width: 0;
        overflow: hidden;
      }
      .pdf-card-label {
        font-size: 10px;
        font-weight: 700;
        color: #64748b;
        margin-bottom: 3px;
        display: block;
      }
      .pdf-card-value {
        font-size: 13px;
        font-weight: 800;
        color: #0f172a;
        display: block;
      }
      .pdf-val-emerald { color: #059669 !important; }
      .pdf-val-rose { color: #dc2626 !important; }
      .pdf-val-amber { color: #d97706 !important; }
      .pdf-val-sky { color: #0284c7 !important; }

      .pdf-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        margin: 6px 0 16px 0;
        font-size: 10.5px;
        page-break-inside: auto;
        break-inside: auto;
      }
      .pdf-table th {
        background: #1e293b;
        color: #ffffff;
        padding: 6px 8px;
        font-weight: 700;
        border: 1px solid #334155;
        text-align: right;
      }
      .pdf-table td {
        padding: 5px 8px;
        border: 1px solid #cbd5e1;
        color: #0f172a;
        text-align: right;
        vertical-align: top;
        word-wrap: break-word;
        overflow-wrap: break-word;
        background: #ffffff;
      }
      .pdf-table tr {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .pdf-table tr:nth-child(even) td {
        background: #f8fafc;
      }
      .pdf-footer {
        margin-top: 24px;
        padding-top: 10px;
        border-top: 1px dashed #cbd5e1;
        font-size: 10px;
        color: #94a3b8;
        display: flex;
        justify-content: space-between;
        align-items: center;
        page-break-inside: avoid;
        break-inside: avoid;
      }
    </style>

    <!-- Header Box -->
    <div class="pdf-header">
      <div class="pdf-title-box">
        <h1>كشف حساب الدورة : ${safe(c.name)}</h1>
        <div class="pdf-meta-text">
          تاريخ البداية : ${fd(c.start)} • 
          ${c.end ? `تاريخ الانتهاء : ${fd(c.end)} (استغرقت ${cycleDays} يوم)` : `عمر الدورة الحالي : اليوم الـ ${cycleDays}`}
        </div>
      </div>
      <div>
        <span class="pdf-status-badge">
          ${isOngoing ? 'الدورة جارية الآن 🐥' : 'الدورة مكتملة ومغلقة ✓'}
        </span>
      </div>
    </div>

    <!-- Summary Metrics Grid (3 balanced columns fitting A4 perfectly) -->
    <div class="pdf-section-title">📊 الملخص المالي والإنتاجي للدورة</div>
    <div class="pdf-metrics-grid">
      <!-- Row 1 -->
      <div class="pdf-card">
        <span class="pdf-card-label">عدد الكتاكيت المستلمة</span>
        <span class="pdf-card-value">${f(c.n)} طائر</span>
      </div>
      <div class="pdf-card">
        <span class="pdf-card-label">النافق الإجمالي</span>
        <span class="pdf-card-value ${k.mort > 5 ? 'pdf-val-rose' : ''}">
          ${f(k.dead)} طائر (${k.mort.toFixed(1)}%)
        </span>
      </div>
      <div class="pdf-card">
        <span class="pdf-card-label">الطيور المباعة</span>
        <span class="pdf-card-value pdf-val-emerald">
          ${f(k.sold)} طائر (${f(k.kgS)} كجم)
        </span>
      </div>

      <!-- Row 2 -->
      <div class="pdf-card">
        <span class="pdf-card-label">الطيور الحية المتبقية</span>
        <span class="pdf-card-value pdf-val-sky">${f(k.remaining)} طائر</span>
      </div>
      <div class="pdf-card">
        <span class="pdf-card-label">إجمالي قيمة المبيعات</span>
        <span class="pdf-card-value pdf-val-emerald">${f(k.totalSales)} جنيه</span>
      </div>
      <div class="pdf-card">
        <span class="pdf-card-label">المحصل نقداً (كاش)</span>
        <span class="pdf-card-value pdf-val-emerald">${f(k.collectedCash)} جنيه</span>
      </div>

      <!-- Row 3 -->
      <div class="pdf-card">
        <span class="pdf-card-label">المتبقي آجل (ديون مشتري)</span>
        <span class="pdf-card-value ${k.uncollectedSales > 0 ? 'pdf-val-amber' : ''}">
          ${f(k.uncollectedSales)} جنيه
        </span>
      </div>
      <div class="pdf-card">
        <span class="pdf-card-label">إجمالي المصروفات</span>
        <span class="pdf-card-value pdf-val-rose">${f(k.e)} جنيه</span>
      </div>
      <div class="pdf-card">
        <span class="pdf-card-label">صافي الربح / الخسارة</span>
        <span class="pdf-card-value ${k.p >= 0 ? 'pdf-val-emerald' : 'pdf-val-rose'}">
          ${f(k.p)} جنيه
        </span>
      </div>

      <!-- Row 4 -->
      <div class="pdf-card">
        <span class="pdf-card-label">السيولة النقدية (كاش - مصاريف)</span>
        <span class="pdf-card-value ${k.cashProfit >= 0 ? 'pdf-val-emerald' : 'pdf-val-amber'}">
          ${f(k.cashProfit)} جنيه
        </span>
      </div>
      <div class="pdf-card">
        <span class="pdf-card-label">متوسط سعر بيع الطائر</span>
        <span class="pdf-card-value">${f(k.avg)} جنيه</span>
      </div>
      <div class="pdf-card">
        <span class="pdf-card-label">تكلفة الطائر الحي بالمزرعة</span>
        <span class="pdf-card-value">${f(k.cpb)} جنيه</span>
      </div>

      <!-- Row 5 -->
      <div class="pdf-card">
        <span class="pdf-card-label">صافي ربح الطائر المباع</span>
        <span class="pdf-card-value ${k.ppb >= 0 ? 'pdf-val-emerald' : 'pdf-val-rose'}">
          ${f(k.ppb)} جنيه
        </span>
      </div>
      <div class="pdf-card">
        <span class="pdf-card-label">دين لنا عند الغير (مستحق لنا)</span>
        <span class="pdf-card-value pdf-val-emerald">${f(k.debtUsRemaining)} جنيه</span>
      </div>
      <div class="pdf-card">
        <span class="pdf-card-label">دين علينا للغير (مستحق علينا)</span>
        <span class="pdf-card-value pdf-val-rose">${f(k.debtThemRemaining)} جنيه</span>
      </div>

      <!-- Row 6 -->
      <div class="pdf-card">
        <span class="pdf-card-label">العلف المشترى (الوارد)</span>
        <span class="pdf-card-value">${f(k.feedPurchasedKg)} كجم</span>
      </div>
      <div class="pdf-card">
        <span class="pdf-card-label">العلف المستهلك (أكلته الطيور)</span>
        <span class="pdf-card-value pdf-val-sky">${f(k.feedConsumedKg)} كجم (${(k.feedConsumedKg / bagKg).toFixed(1)} شكارة)</span>
      </div>
      <div class="pdf-card">
        <span class="pdf-card-label">معامل التحويل الغذائي (FCR)</span>
        <span class="pdf-card-value ${k.fcr && k.fcr <= 1.6 ? 'pdf-val-emerald' : 'pdf-val-amber'}">
          ${k.fcr ? k.fcr.toFixed(2) + ' كجم/كجم لحم' : '—'}
        </span>
      </div>
    </div>

    <!-- 1. Expenses Table -->
    ${c.exp && c.exp.length ? `
      <div class="pdf-section-title">💸 سجل المصروفات (${c.exp.length} حركة)</div>
      <table class="pdf-table">
        <thead>
          <tr>
            <th style="width: 20%;">التاريخ</th>
            <th style="width: 22%;">البند</th>
            <th style="width: 38%;">البيان / ملاحظات</th>
            <th style="width: 20%; text-align: left;">المبلغ (جنيه)</th>
          </tr>
        </thead>
        <tbody>
          ${c.exp.map(e => `
            <tr>
              <td>${fd(e.d)}</td>
              <td><b>${safe(e.cat)}</b></td>
              <td>${safe(e.note)}</td>
              <td style="text-align: left; font-weight: 700; color: #dc2626;">${f(e.amt)} ج</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}

    <!-- 2. Sales Table -->
    ${c.inc && c.inc.length ? `
      <div class="pdf-section-title">📈 سجل المبيعات والتحصيل (${c.inc.length} حركة)</div>
      <table class="pdf-table">
        <thead>
          <tr>
            <th style="width: 17%;">التاريخ</th>
            <th style="width: 20%;">المشتري</th>
            <th style="width: 15%;">العدد والوزن</th>
            <th style="width: 16%; text-align: left;">إجمالي القيمة</th>
            <th style="width: 16%; text-align: left;">المحصل كاش</th>
            <th style="width: 16%; text-align: left;">المتبقي آجل</th>
          </tr>
        </thead>
        <tbody>
          ${c.inc.map(e => {
            const total = +e.amt || 0;
            const paid = e.paidAmt !== undefined ? +e.paidAmt : total;
            const rem = Math.max(0, total - paid);
            return `
              <tr>
                <td>${fd(e.d)}</td>
                <td><b>${safe(e.buyer)}</b></td>
                <td>${f(e.cnt)} طائر ${e.kg ? `(${f(e.kg)} كجم)` : ''}</td>
                <td style="text-align: left; font-weight: 700; color: #059669;">${f(total)} ج</td>
                <td style="text-align: left;">${f(paid)} ج</td>
                <td style="text-align: left; color: ${rem > 0 ? '#d97706' : '#64748b'};">${f(rem)} ج</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    ` : ''}

    <!-- 3. Mortalities Table -->
    ${c.dead && c.dead.length ? `
      <div class="pdf-section-title">⚠️ سجل النافق (${c.dead.length} تسجيل)</div>
      <table class="pdf-table">
        <thead>
          <tr>
            <th style="width: 25%;">التاريخ</th>
            <th style="width: 25%;">العدد النافق</th>
            <th style="width: 50%;">سبب النفوق والملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${c.dead.map(e => `
            <tr>
              <td>${fd(e.d)}</td>
              <td style="font-weight: 700; color: #dc2626;">${f(e.n)} طائر</td>
              <td>${safe(e.note)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}

    <!-- 4. Feed Movements Table -->
    ${c.feed && c.feed.length ? `
      <div class="pdf-section-title">🌾 حركات العلف والمخزن (${c.feed.length} حركة)</div>
      <table class="pdf-table">
        <thead>
          <tr>
            <th style="width: 22%;">التاريخ</th>
            <th style="width: 25%;">نوع الحركة</th>
            <th style="width: 28%;">الكمية والبيان</th>
            <th style="width: 25%; text-align: left;">الوزن الصافي</th>
          </tr>
        </thead>
        <tbody>
          ${c.feed.map(e => {
            const isPurchased = e.type === 'purchased';
            return `
              <tr>
                <td>${fd(e.d)}</td>
                <td><b>${isPurchased ? '📦 وارد للمخزن' : '🌾 مستهلك للطيور'}</b></td>
                <td>${safe(e.txt || (e.q + ' ' + (e.unit || 'شكارة')))}</td>
                <td style="text-align: left; font-weight: 700; color: ${isPurchased ? '#059669' : '#0284c7'};">
                  ${f(e.kg)} كجم
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    ` : ''}

    <!-- 5. Debts Table -->
    ${c.debt && c.debt.length ? `
      <div class="pdf-section-title">📝 الديون والمستحقات المالية (${c.debt.length} حساب)</div>
      <table class="pdf-table">
        <thead>
          <tr>
            <th style="width: 17%;">التاريخ</th>
            <th style="width: 25%;">الطرف / الاتجاه</th>
            <th style="width: 18%; text-align: left;">المبلغ الأصلي</th>
            <th style="width: 18%; text-align: left;">المسدد</th>
            <th style="width: 22%; text-align: left;">المتبقي المطلوب</th>
          </tr>
        </thead>
        <tbody>
          ${c.debt.map(e => {
            const total = +e.amt || 0;
            const paid = e.paidAmt !== undefined ? +e.paidAmt : (e.paid ? total : 0);
            const rem = Math.max(0, total - paid);
            const isUs = e.dir === 'لنا';
            return `
              <tr>
                <td>${fd(e.d)}</td>
                <td>
                  <b>${safe(e.who)}</b> 
                  <small style="display:block; color:${isUs ? '#059669' : '#dc2626'};">${isUs ? '🟢 دين لنا عنده' : '🔴 دين علينا له'}</small>
                </td>
                <td style="text-align: left;">${f(total)} ج</td>
                <td style="text-align: left;">${f(paid)} ج</td>
                <td style="text-align: left; font-weight: 700; color: ${rem > 0 ? '#d97706' : '#059669'};">
                  ${rem > 0 ? `${f(rem)} ج` : 'مسدد بالكامل ✓'}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    ` : ''}

    <!-- Footer -->
    <div class="pdf-footer">
      <span>تطبيق دفتر رفاعي لمزارع الدواجن © ${new Date().getFullYear()}</span>
      <span>تاريخ استخراج الكشف : ${fd(today())} (بتوقيت مصر)</span>
    </div>
  `;

  document.body.appendChild(container);

  try {
    if (typeof window.html2pdf !== 'function') {
      throw new Error('html2pdf library is not loaded');
    }

    const opt = {
      margin: [8, 6, 8, 6],
      filename: `كشف دورة - ${safe(c.name).replace(/[\\/:*?"<>|]/g, '-')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        scrollY: 0,
        scrollX: 0,
        windowWidth: 780,
        letterRendering: true
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      },
      pagebreak: {
        mode: ['avoid-all', 'css', 'legacy']
      }
    };

    await window.html2pdf().set(opt).from(container).save();
    showToast('تم تنزيل كشف الدورة PDF بنجاح وبكامل البيانات ✓');

  } catch (error) {
    console.error('Direct PDF export error, falling back to print view', error);
    // Graceful native print fallback if canvas export was blocked
    window.print();
    showToast('تم فتح نافذة الطباعة / الحفظ كـ PDF للمتصفح ✓');
  } finally {
    if (container.parentNode) container.parentNode.removeChild(container);
    window.__cyclePdfBusy = false;
  }
}
