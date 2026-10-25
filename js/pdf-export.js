/**
 * Professional PDF Export using jsPDF + autoTable (native RTL/Arabic support)
 * Creates real text-based PDFs with proper Arabic rendering
 */
async function downloadCyclePdf() {
  const c = cur();
  if (!c || window.__cyclePdfBusy) return;

  window.__cyclePdfBusy = true;
  showToast('جاري تجهيز ملف PDF للدورة…');

  try {
    // Load jsPDF + autoTable from CDN if not already loaded
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.autoTable === 'undefined') {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.1/jspdf.plugin.autotable.min.js');
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      unit: 'mm',
      format: 'a4',
      orientation: 'landscape',
      putOnlyUsedFonts: true
    });

    // Register Arabic font (Cairo) for proper RTL rendering
    await registerArabicFont(doc);

    // Set RTL direction globally
    doc.setR2L(true);

    const k = calc(c);
    const safe = v => String(v ?? '').trim() || '—';
    const money = v => `${f(v)} ج`;
    const qty = (v, u) => `${f(v)} ${u}`;
    const dateStr = d => fd(d) || '—';
    const status = c.end ? `مكتملة — ${fd(c.end)}` : 'جارية';

    // ---- Helper: Add section header ----
    const addSectionTitle = (title, count) => {
      doc.setFontSize(13);
      doc.setFont('Cairo', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${title} (${count})`, doc.internal.pageSize.getWidth() - 20, doc.getY() + 8, { align: 'right' });
      doc.setDrawColor(51, 65, 85);
      doc.setLineWidth(0.5);
      doc.line(20, doc.getY() + 10, doc.internal.pageSize.getWidth() - 20, doc.getY() + 10);
      doc.setY(doc.getY() + 14);
    };

    // ---- HEADER ----
    doc.setFontSize(22);
    doc.setFont('Cairo', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`كشف الدورة: ${safe(c.name)}`, doc.internal.pageSize.getWidth() - 20, 20, { align: 'right' });

    doc.setFontSize(10);
    doc.setFont('Cairo', 'normal');
    doc.setTextColor(82, 100, 139);
    const metaY = 28;
    doc.text(`تاريخ البداية: ${dateStr(c.start)}  •  الحالة: ${status}`, doc.internal.pageSize.getWidth() - 20, metaY, { align: 'right' });

    // Status badge
    doc.setFillColor(16, 185, 129);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('Cairo', 'bold');
    const badgeText = c.end ? 'مكتملة' : 'جارية';
    const badgeW = doc.getTextWidth(badgeText) + 8;
    doc.roundedRect(doc.internal.pageSize.getWidth() - 20 - badgeW, 14, badgeW, 7, 2, 2, 'F');
    doc.text(badgeText, doc.internal.pageSize.getWidth() - 20 - badgeW/2, 19, { align: 'center' });

    doc.setY(metaY + 8);

    // ---- METRICS GRID (2 columns) ----
    const metrics = [
      ['العدد الأصلي', qty(c.n, 'طائر')],
      ['النافق', `${qty(k.dead, 'طائر')} (${k.mort.toFixed(1)}%)`],
      ['المباع', `${qty(k.sold, 'طائر')} · ${qty(k.kgS, 'كجم')}`],
      ['المتبقي الحي', qty(k.remaining, 'طائر')],
      ['إجمالي المبيعات', money(k.totalSales)],
      ['المحصل نقدًا', money(k.collectedCash)],
      ['المتبقي من المبيعات', money(k.uncollectedSales)],
      ['إجمالي المصروفات', money(k.e)],
      ['صافي الربح', money(k.p)],
      ['صافي النقدية بعد المصروفات', money(k.cashProfit)],
      ['متوسط البيع للطائر', money(k.avg)],
      ['تكلفة الطائر الحي', money(k.cpb)],
      ['ربح الطائر المباع', money(k.ppb)],
      ['مستحق لنا عند الغير', money(k.debtUsRemaining)],
      ['مستحق علينا للغير', money(k.debtThemRemaining)],
      ['العلف المشترى', qty(k.feedPurchasedKg, 'كجم')],
      ['العلف المستهلك / المخزون', `${qty(k.feedConsumedKg, 'كجم')} / ${qty(k.feedStockKg, 'كجم')}`],
      ['معامل التحويل (FCR)', k.fcr ? k.fcr.toFixed(2) : '—']
    ];

    const colW = (doc.internal.pageSize.getWidth() - 50) / 2;
    let startY = doc.getY();
    let maxY = startY;

    metrics.forEach(([label, value], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 20 + col * (colW + 10);
      const y = startY + row * 22;

      // Box background
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(x, y, colW, 18, 2, 2, 'FD');

      // Label
      doc.setFontSize(8);
      doc.setFont('Cairo', 'normal');
      doc.setTextColor(82, 100, 139);
      doc.text(label, x + colW - 4, y + 6, { align: 'right' });

      // Value
      doc.setFontSize(11);
      doc.setFont('Cairo', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(value, x + colW - 4, y + 14, { align: 'right' });

      maxY = Math.max(maxY, y + 18);
    });

    doc.setY(maxY + 10);

    // ---- EXPENSES TABLE ----
    if (c.exp && c.exp.length) {
      addSectionTitle('المصروفات', c.exp.length);
      doc.autoTable({
        head: [['التاريخ', 'البند', 'البيان', 'المبلغ']],
        body: c.exp.map(e => [
          dateStr(e.d),
          safe(e.cat),
          safe(e.note),
          money(e.amt)
        ]),
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: 255, font: 'Cairo', fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { font: 'Cairo', fontSize: 8.5, textColor: [15, 23, 42] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 20, right: 20 },
        tableWidth: 'auto',
        didParseCell: ({ cell, column }) => { if (column.index === 3) cell.styles.halign = 'right'; }
      });
    }

    // ---- SALES TABLE ----
    if (c.inc && c.inc.length) {
      addSectionTitle('المبيعات', c.inc.length);
      doc.autoTable({
        head: [['التاريخ', 'المشتري', 'العدد', 'الوزن (كجم)', 'قيمة البيع', 'المحصل', 'المتبقي']],
        body: c.inc.map(e => {
          const total = +e.amt || +e.totalAmt || 0;
          const paid = e.paidAmt !== undefined ? +e.paidAmt : total;
          return [
            dateStr(e.d),
            safe(e.buyer),
            qty(e.cnt, 'طائر'),
            qty(e.kg, 'كجم'),
            money(total),
            money(paid),
            money(Math.max(0, total - paid))
          ];
        }),
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: 255, font: 'Cairo', fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { font: 'Cairo', fontSize: 8.5, textColor: [15, 23, 42] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
        margin: { left: 20, right: 20 },
        tableWidth: 'auto'
      });
    }

    // ---- DEATHS TABLE ----
    if (c.dead && c.dead.length) {
      addSectionTitle('النفوق', c.dead.length);
      doc.autoTable({
        head: [['التاريخ', 'العدد', 'السبب / البيان']],
        body: c.dead.map(e => [dateStr(e.d), qty(e.n, 'طائر'), safe(e.note)]),
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: 255, font: 'Cairo', fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { font: 'Cairo', fontSize: 8.5, textColor: [15, 23, 42] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 1: { halign: 'right' } },
        margin: { left: 20, right: 20 },
        tableWidth: 'auto'
      });
    }

    // ---- FEED TABLE ----
    if (c.feed && c.feed.length) {
      addSectionTitle('حركات العلف', c.feed.length);
      doc.autoTable({
        head: [['التاريخ', 'نوع الحركة', 'الكمية المسجلة', 'الوزن (كجم)']],
        body: c.feed.map(e => {
          const type = e.type === 'purchased' ? 'وارد للمخزن' : e.type === 'consumed' ? 'مستهلك للطيور' : 'علف (سجل قديم)';
          const feedQty = e.txt || `${e.q || ''} ${e.unit || ''}`.trim() || '—';
          return [dateStr(e.d), type, safe(feedQty), qty(e.kg, 'كجم')];
        }),
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: 255, font: 'Cairo', fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { font: 'Cairo', fontSize: 8.5, textColor: [15, 23, 42] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 3: { halign: 'right' } },
        margin: { left: 20, right: 20 },
        tableWidth: 'auto'
      });
    }

    // ---- DEBTS TABLE ----
    if (c.debt && c.debt.length) {
      addSectionTitle('الديون والدفعات', c.debt.length);
      doc.autoTable({
        head: [['التاريخ', 'الطرف / الاتجاه', 'أصل الدين', 'المسدد', 'المتبقي', 'تفاصيل الدفعات']],
        body: c.debt.map(e => {
          const total = +e.amt || 0;
          const paid = e.paidAmt !== undefined ? +e.paidAmt : (e.paid ? total : 0);
          const direction = e.dir === 'لنا' || e.dir === 'ليا عنده' ? 'مستحق لنا عند الغير' : 'مستحق علينا للغير';
          const payments = (e.payments || []).map(p => `${dateStr(p.d)}: ${money(p.amt)}${p.note ? ` (${safe(p.note)})` : ''}`).join('\n') || '—';
          return [
            dateStr(e.d),
            `${safe(e.who)}\n${direction}`,
            money(total),
            money(paid),
            money(Math.max(0, total - paid)),
            payments
          ];
        }),
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: 255, font: 'Cairo', fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { font: 'Cairo', fontSize: 8.5, textColor: [15, 23, 42], cellPadding: 3 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
        margin: { left: 20, right: 20 },
        tableWidth: 'auto'
      });
    }

    // ---- FOOTER ----
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('Cairo', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`تم إنشاء الكشف من دفتر رفاعي · ${dateStr(today())} · صفحة ${i} من ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    }

    // Save
    const filename = `كشف دورة - ${safe(c.name).replace(/[\\/:*?"<>|]/g, '-')}.pdf`;
    doc.save(filename);
    showToast('تم تنزيل كشف الدورة بصيغة PDF بنجاح ✓');

  } catch (error) {
    console.error('PDF export failed', error);
    showToast('تعذر إنشاء ملف PDF. حاول مرة أخرى بعد تحديث الصفحة.');
  } finally {
    window.__cyclePdfBusy = false;
  }
}

// ---- Helpers ----
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function registerArabicFont(doc) {
  // Use Cairo font from Google Fonts via VFS (base64 embedded)
  if (doc.getFontList()['Cairo']) return; // Already registered

  try {
    // Load Regular weight
    const fontResponse = await fetch('https://fonts.gstatic.com/s/cairo/v24/SLXGc1nY6HkvalIqQGjGsS4.ttf');
    const arrayBuffer = await fontResponse.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);
    doc.addFileToVFS('Cairo-Regular.ttf', base64);
    doc.addFont('Cairo-Regular.ttf', 'Cairo', 'normal');

    // Load Bold weight (Cairo 700)
    const boldResponse = await fetch('https://fonts.gstatic.com/s/cairo/v24/SLXGc1nY6HkvalIqQGjGsS4.ttf');
    const boldBuffer = await boldResponse.arrayBuffer();
    const boldBase64 = arrayBufferToBase64(boldBuffer);
    doc.addFileToVFS('Cairo-Bold.ttf', boldBase64);
    doc.addFont('Cairo-Bold.ttf', 'Cairo', 'bold');
  } catch (e) {
    console.warn('Could not load Cairo font, falling back to Helvetica', e);
    // Fallback: use built-in font that supports Arabic (limited)
    doc.setFont('helvetica');
  }
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
