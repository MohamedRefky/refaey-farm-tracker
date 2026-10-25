/**
 * Refaey Farm Tracker - Tab Content Renderers
 * Renders individual feature tabs: Sales, Feed & Stock, Debts, Expenses, Mortalities, and Analytics.
 */

// 1. Sales Tab with clear differentiation between Sale Value & Collected Cash
function renderSalesTab(c, k) {
  const arr = c.inc || [];

  return `
    <div class="tab-summary-grid">
      <div class="tab-summary-card">
        <span class="tab-summary-label">إجمالي قيمة المبيعات</span>
        <span class="tab-summary-val color-emerald">${f(k.totalSales)} ج</span>
        <span class="tab-summary-sub">القيمة الإجمالية للمبيعات</span>
      </div>
      <div class="tab-summary-card">
        <span class="tab-summary-label">المحصل نقداً (كاش)</span>
        <span class="tab-summary-val color-emerald">${f(k.collectedCash)} ج</span>
        <span class="tab-summary-sub">السيولة المستلمة فعلياً</span>
      </div>
      <div class="tab-summary-card">
        <span class="tab-summary-label">المتبقي آجل (ديون مشتري)</span>
        <span class="tab-summary-val ${k.uncollectedSales > 0 ? 'color-amber' : ''}">${f(k.uncollectedSales)} ج</span>
        <span class="tab-summary-sub">مرحلة تلقائياً لحسابات المشترين</span>
      </div>
      <div class="tab-summary-card">
        <span class="tab-summary-label">إجمالي الطيور المباعة</span>
        <span class="tab-summary-val">${f(k.sold)} طائر</span>
        <span class="tab-summary-sub">بإجمالي وزن ${f(k.kgS)} كجم</span>
      </div>
    </div>

    <button class="btn btn-primary btn-full" onclick="openForm('inc')">
      <span>+</span> تسجيل حركة بيع جديدة
    </button>

    <div class="card" style="margin-top: 14px;">
      ${arr.length ? arr.slice().reverse().map(e => {
        const i = arr.indexOf(e);
        const total = +e.amt || 0;
        const paid = e.paidAmt !== undefined ? +e.paidAmt : total;
        const remaining = Math.max(0, total - paid);
        const avgWeight = e.cnt && e.kg ? (e.kg / e.cnt).toFixed(2) : null;
        const pricePerKg = e.kg && total ? (total / e.kg).toFixed(1) : null;

        return `
          <div class="record-item">
            <div>
              <div class="record-title">
                بيع ${e.cnt} طائر ${e.buyer ? '(' + e.buyer + ')' : '<span style="color:var(--text-dim);">(بدون اسم)</span>'}
              </div>
              <div class="record-date">
                ${fd(e.d)} ${e.kg ? `• الوزن: <b>${f(e.kg)} كجم</b>` : ''} ${avgWeight ? `• متوسط: <b>${avgWeight} كجم/طائر</b>` : ''} ${pricePerKg ? `• سعر الكيلو: <b>${pricePerKg} ج</b>` : ''}
              </div>
              <div>
                ${remaining > 0 ? `
                  <span class="sale-debt-tag">محصل كاش: ${f(paid)} ج • متبقي آجل: ${f(remaining)} ج ⏳ (مسجل بالديون)</span>
                ` : `
                  <span class="sale-paid-tag">مدفوع كاش بالكامل ✓</span>
                `}
              </div>
            </div>
            <div class="record-value-group">
              <span class="record-value color-emerald">${f(total)} ج</span>
              <div class="record-actions">
                <button class="btn btn-sm btn-outline" onclick="openForm('inc', ${i})" title="تعديل هذا البيع">✏️ تعديل</button>
                <button class="btn btn-sm btn-danger" onclick="delSale(${i})">حذف</button>
              </div>
            </div>
          </div>
        `;
      }).join('') : `
        <div class="empty-state">
          <div class="empty-state-icon">📈</div>
          مفيش حركات بيع مسجلة حتى الآن
        </div>
      `}
    </div>
  `;
}

// 2. Feed Tab with Purchased vs Consumed separation and Warehouse Stock
function renderFeedTab(c, k) {
  const allFeed = c.feed || [];
  let filtered = allFeed;
  if (S.feedFilter === 'consumed') filtered = allFeed.filter(x => x.type === 'consumed');
  if (S.feedFilter === 'purchased') filtered = allFeed.filter(x => x.type === 'purchased');

  return `
    <div class="tab-summary-grid">
      <div class="tab-summary-card">
        <span class="tab-summary-label">العلف المستهلك (أكلته الطيور)</span>
        <span class="tab-summary-val color-sky">${f(k.feedConsumedKg)} كجم</span>
        <span class="tab-summary-sub">${(k.feedConsumedKg / bagKg).toFixed(1)} شكارة تم استهلاكها</span>
      </div>
      <div class="tab-summary-card">
        <span class="tab-summary-label">العلف المشترى (الوارد)</span>
        <span class="tab-summary-val color-emerald">${f(k.feedPurchasedKg)} كجم</span>
        <span class="tab-summary-sub">${(k.feedPurchasedKg / bagKg).toFixed(1)} شكارة استلام مخزن</span>
      </div>
      <div class="tab-summary-card">
        <span class="tab-summary-label">رصيد المخزن المتبقي</span>
        <span class="tab-summary-val ${k.feedStockKg > 0 ? 'color-emerald' : 'color-rose'}">${f(k.feedStockKg)} كجم</span>
        <span class="tab-summary-sub">${(k.feedStockKg / bagKg).toFixed(1)} شكارة حالياً بالمخزن</span>
      </div>
      <div class="tab-summary-card" onclick="showFcrModal()" style="cursor: pointer;" title="اضغط لمعرفة شرح وتفاصيل معامل التحويل">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="tab-summary-label">معامل التحويل (FCR)</span>
          <span style="font-size: 11px; color: var(--emerald); font-weight: 700;">اضغط للشرح ℹ️</span>
        </div>
        <span class="tab-summary-val ${k.fcr && k.fcr <= 1.6 ? 'color-emerald' : 'color-amber'}">${k.fcr ? k.fcr.toFixed(2) : '-'}</span>
        <span class="tab-summary-sub">
          ${(() => {
            if (!k.fcr) return 'المستهلك ÷ وزن المباع • اضغط للشرح ℹ️';
            const val = k.fcr.toFixed(2);
            if (k.fcr <= 1.55) return `🟢 ممتاز (${val} كجم علف/كجم لحم) • تفاصيل`;
            if (k.fcr <= 1.65) return `🟢 طبيعي ومربح (${val} كجم علف/كجم لحم) • تفاصيل`;
            if (k.fcr <= 1.80) return `🟠 متوسط وفيه هدر (${val} كجم علف/كجم لحم) • تفاصيل`;
            return `🔴 مرتفع وهدر علف (${val} كجم علف/كجم لحم) • تفاصيل`;
          })()}
        </span>
      </div>
    </div>

    <!-- Dual Action Buttons: Feed Consumed vs Feed Purchased -->
    <div class="dual-action-row">
      <button class="btn btn-primary" onclick="openFeedForm('consumed')">
        <span>🌾</span> + تسجيل استهلاك علف (أكلته الطيور)
      </button>
      <button class="btn btn-outline" onclick="openFeedForm('purchased')">
        <span>📦</span> + توريد / شراء علف للمخزن
      </button>
    </div>

    <!-- Filter Chips for Feed -->
    <div class="filter-chips">
      <button class="filter-chip ${S.feedFilter === 'all' ? 'active' : ''}" onclick="S.feedFilter='all'; render()">الكل (${allFeed.length})</button>
      <button class="filter-chip ${S.feedFilter === 'consumed' ? 'active' : ''}" onclick="S.feedFilter='consumed'; render()">🌾 علف مستهلك فقط</button>
      <button class="filter-chip ${S.feedFilter === 'purchased' ? 'active' : ''}" onclick="S.feedFilter='purchased'; render()">📦 وارد للمخزن فقط</button>
    </div>

    <!-- Bag Weight Config -->
    <div class="card" style="padding: 14px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
      <span style="font-weight: 700; font-size: 13px; color: var(--text-muted);">وزن الشكارة الافتراضي:</span>
      <div style="display: flex; align-items: center; gap: 8px;">
        <input type="number" value="${bagKg}" onchange="bagKg = +this.value || 50; render();" style="width: 80px; padding: 6px 10px;">
        <span style="font-weight: 700; font-size: 13px;">كجم</span>
      </div>
    </div>

    <!-- Feed Records List -->
    <div class="card">
      ${filtered.length ? filtered.slice().reverse().map(e => {
        const i = allFeed.indexOf(e);
        const isPurchased = e.type === 'purchased';
        return `
          <div class="record-item">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span class="badge ${isPurchased ? 'badge-feed-in' : 'badge-feed-out'}">
                  ${isPurchased ? '📦 وارد للمخزن' : '🌾 مستهلك للطيور'}
                </span>
                <span class="record-title">${e.txt || (e.q + ' ' + (e.unit || 'شكارة'))}</span>
              </div>
              <div class="record-date">${fd(e.d)}</div>
            </div>
            <div class="record-value-group">
              <span class="record-value ${isPurchased ? 'color-emerald' : 'color-sky'}">${f(e.kg)} كجم</span>
              <div class="record-actions">
                <button class="btn btn-sm btn-outline" onclick="openForm('feed', ${i})" title="تعديل">✏️ تعديل</button>
                <button class="btn btn-sm btn-danger" onclick="del(${i})">حذف</button>
              </div>
            </div>
          </div>
        `;
      }).join('') : `
        <div class="empty-state">
          <div class="empty-state-icon">🌾</div>
          لا توجد حركات علف مسجلة في هذا القسم
        </div>
      `}
    </div>
  `;
}

// 3. Debt Tab with Direction Clarity & Partial Payments History
function renderDebtTab(c, k) {
  const allDebts = c.debt || [];
  let filtered = allDebts;
  if (S.debtFilter === 'us') filtered = allDebts.filter(d => d.dir === 'لنا');
  if (S.debtFilter === 'them') filtered = allDebts.filter(d => d.dir === 'علينا');
  if (S.debtFilter === 'unpaid') filtered = allDebts.filter(d => !d.paid);

  return `
    <div class="tab-summary-grid" style="grid-template-columns: repeat(2, 1fr);">
      <div class="tab-summary-card">
        <span class="tab-summary-label">🟢 مستحق لنا عند الغير (دين لنا)</span>
        <span class="tab-summary-val color-emerald">${f(k.debtUsRemaining)} ج</span>
        <span class="tab-summary-sub">المتبقي المطلوب تحصيله (من أصل ${f(k.debtUsTotal)} ج)</span>
      </div>
      <div class="tab-summary-card">
        <span class="tab-summary-label">🔴 مستحق علينا للغير (دين علينا)</span>
        <span class="tab-summary-val color-rose">${f(k.debtThemRemaining)} ج</span>
        <span class="tab-summary-sub">المتبقي المطلوب سداده (من أصل ${f(k.debtThemTotal)} ج)</span>
      </div>
    </div>

    <button class="btn btn-primary btn-full" onclick="openForm('debt')">
      <span>+</span> إضافة مديونية جديدة
    </button>

    <!-- Filter Chips for Debts -->
    <div class="filter-chips">
      <button class="filter-chip ${S.debtFilter === 'all' ? 'active' : ''}" onclick="S.debtFilter='all'; render()">الكل (${allDebts.length})</button>
      <button class="filter-chip ${S.debtFilter === 'us' ? 'active' : ''}" onclick="S.debtFilter='us'; render()">🟢 لنا عند الغير</button>
      <button class="filter-chip ${S.debtFilter === 'them' ? 'active' : ''}" onclick="S.debtFilter='them'; render()">🔴 علينا للغير</button>
      <button class="filter-chip ${S.debtFilter === 'unpaid' ? 'active' : ''}" onclick="S.debtFilter='unpaid'; render()">⏳ غير مسددة فقط</button>
    </div>

    <!-- Debts List -->
    <div class="card">
      ${filtered.length ? filtered.slice().reverse().map(e => {
        const i = allDebts.indexOf(e);
        const total = +e.amt || 0;
        const paidAmt = +e.paidAmt || (e.paid ? total : 0);
        const remaining = Math.max(0, total - paidAmt);
        const isPaid = e.paid || remaining === 0;
        const isPartial = paidAmt > 0 && remaining > 0;
        const percent = total > 0 ? Math.min(100, Math.round((paidAmt / total) * 100)) : 0;
        const isUs = e.dir === 'لنا';
        const isHistoryOpen = !!S.openPayments[e.id || i];
        const payments = e.payments || [];

        return `
          <div class="record-item" style="flex-direction: column; align-items: stretch; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span class="record-title" style="font-size: 16px;">${e.who}</span>
                  <span class="badge ${isUs ? 'badge-debt-us' : 'badge-debt-them'}">
                    ${isUs ? '🟢 مستحق لنا عنده' : '🔴 مستحق علينا له'}
                  </span>
                  <span class="badge ${isPaid ? 'badge-paid' : (isPartial ? 'badge-partial' : 'badge-unpaid')}">
                    ${isPaid ? 'مسدد بالكامل ✓' : (isPartial ? `سداد جزئي (باقي ${f(remaining)} ج)` : `غير مسدد (مطلوب ${f(remaining)} ج)`)}
                  </span>
                </div>
                <div class="record-date">${fd(e.d)} ${e.note ? '• ' + e.note : ''}</div>
              </div>
              <div style="text-align: left;">
                <span class="record-value ${isUs ? 'color-emerald' : 'color-rose'}">${f(total)} ج</span>
                <div style="font-size: 12px; color: var(--text-dim); font-weight: 700;">
                  المتبقي: <b style="color:${remaining > 0 ? 'var(--amber)' : 'var(--emerald)'};">${f(remaining)} ج</b>
                </div>
              </div>
            </div>

            <!-- Progress Bar -->
            <div class="debt-progress-track">
              <div class="debt-progress-bar" style="width: ${percent}%; background: ${isPaid ? 'var(--emerald)' : (isPartial ? 'var(--amber)' : 'var(--rose)')};"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); font-weight: 600;">
              <span>تم سداد: ${f(paidAmt)} ج (${percent}%)</span>
              <span>المتبقي: ${f(remaining)} ج</span>
            </div>

            <!-- Action Buttons for Debt -->
            <div class="debt-actions-row">
              ${!isPaid ? `
                <button class="btn btn-sm btn-primary" onclick="openPaymentModal(${i})">
                  💵 تسجيل سداد / دفعة
                </button>
              ` : `
                <button class="btn btn-sm btn-outline" onclick="openPaymentModal(${i})">
                  + سداد إضافي
                </button>
              `}
              ${payments.length > 0 ? `
                <button class="btn btn-sm btn-outline" onclick="togglePaymentsHistory('${e.id || i}')">
                  📜 سجل الدفعات (${payments.length})
                </button>
              ` : ''}
              <button class="btn btn-sm btn-outline" onclick="openForm('debt', ${i})">✏️ تعديل</button>
              <button class="btn btn-sm btn-danger" onclick="delDebt(${i})">حذف</button>
            </div>

            <!-- Payment History Sub-Panel -->
            ${isHistoryOpen && payments.length > 0 ? `
              <div class="payment-history-box">
                <div class="payment-history-header">
                  <span>سجل الدفعات المسددة لهذا الدين:</span>
                  <button type="button" class="btn btn-sm btn-outline" onclick="togglePaymentsHistory('${e.id || i}')" style="padding: 2px 8px; font-size: 11px;">إخفاء</button>
                </div>
                ${payments.map((p, pIdx) => `
                  <div class="payment-history-item">
                    <div>
                      <b>${fd(p.d)}</b>: سداد مبلغ <span class="num color-emerald">${f(p.amt)} ج</span> ${p.note ? `(${p.note})` : ''}
                    </div>
                    <button class="btn btn-sm btn-danger" onclick="deletePayment(${i}, ${pIdx})" title="حذف هذه الدفعة والتراجع عن السداد" style="padding: 2px 6px; font-size: 11px;">
                      🗑️ إلغاء الدفعة
                    </button>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `;
      }).join('') : `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          لا توجد مديونيات مسجلة في هذا القسم
        </div>
      `}
    </div>
  `;
}

// 4. Generic Tab for Expenses & Mortalities
function renderGenericTab(c, k) {
  const T = K[S.tab];
  const arr = c[S.tab] || [];

  return `
    <button class="btn btn-primary btn-full" onclick="openForm('${S.tab}')">
      <span>+</span> إضافة ${T.t} جديد
    </button>

    <div class="card" style="margin-top: 14px;">
      ${arr.length ? arr.slice().reverse().map(e => {
        const r = T.r(e);
        const i = arr.indexOf(e);
        return `
          <div class="record-item">
            <div>
              <div class="record-title">${r[0]}</div>
              <div class="record-date">${fd(e.d)}</div>
            </div>
            <div class="record-value-group">
              <span class="record-value ${S.tab === 'exp' ? 'color-rose' : ''}">${r[1]}</span>
              <div class="record-actions">
                <button class="btn btn-sm btn-outline" onclick="openForm('${S.tab}', ${i})" title="تعديل هذا التسجيل">✏️ تعديل</button>
                <button class="btn btn-sm btn-danger" onclick="del(${i})">حذف</button>
              </div>
            </div>
          </div>
        `;
      }).join('') : `
        <div class="empty-state">
          <div class="empty-state-icon">${T.icon}</div>
          مفيش تسجيلات مسجلة في هذا القسم بعد
        </div>
      `}
    </div>
  `;
}

// 5. Analytics Tab
function renderAnalyticsTab(c, k) {
  const by = {};
  (c.exp || []).forEach(e => {
    by[e.cat] = (by[e.cat] || 0) + e.amt;
  });
  const col = ['var(--emerald)', 'var(--sky)', 'var(--amber)', 'var(--rose)', '#8b5cf6', '#6366f1', 'var(--text-muted)'];
  const it = Object.entries(by)
    .sort((x, y) => y[1] - x[1])
    .map(([n, v], i) => ({
      n,
      v,
      c: col[i % col.length],
      t: f(v) + ' ج (' + (k.e ? Math.round((v / k.e) * 100) : 0) + '%)'
    }));

  const rem = k.remaining;
  const T = c.n || 1;

  return `
    <div class="card">
      <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 12px; color: var(--text-title);">
        صرفت فلوسك على إيه؟ (توزيع المصاريف)
      </h3>
      ${it.length ? bars(it, x => x.t) : '<div class="empty-state"><div class="empty-state-icon">💸</div>مفيش مصروفات مسجلة بعد</div>'}
    </div>

    <div class="card">
      <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 12px; color: var(--text-title);">
        الطيور راحت فين؟ (توزيع القطيع)
      </h3>
      <div class="bar-track" style="height: 16px; border-radius: 8px;">
        <div class="bar-segment" style="width: ${(k.sold / T) * 100}%; background: var(--emerald);" title="مباع"></div>
        <div class="bar-segment" style="width: ${(k.dead / T) * 100}%; background: var(--rose);" title="نافق"></div>
        <div class="bar-segment" style="width: ${(rem / T) * 100}%; background: var(--sky);" title="باقي"></div>
      </div>
      <div class="legend-wrapper">
        <span class="legend-item"><span class="legend-dot" style="background: var(--emerald);"></span> اتباع: ${f(k.sold)} (${Math.round((k.sold / T) * 100)}%)</span>
        <span class="legend-item"><span class="legend-dot" style="background: var(--rose);"></span> نافق: ${f(k.dead)} (${Math.round((k.dead / T) * 100)}%)</span>
        <span class="legend-item"><span class="legend-dot" style="background: var(--sky);"></span> باقي بالمزرعة: ${f(rem)} (${Math.round((rem / T) * 100)}%)</span>
      </div>
    </div>

    <div class="card">
      <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 12px; color: var(--text-title);">
        مقارنة ربحية هذه الدورة مع الدورات الأخرى
      </h3>
      ${profitChart()}
    </div>
  `;
}

// Quick 1-tap add handler: switches tab and opens form immediately
function quickAdd(kind) {
  S.tab = kind;
  openForm(kind);
}

// Quick Feed form with predefined movement type
function openFeedForm(type = 'consumed') {
  S.tab = 'feed';
  openForm('exp', null, { cat: 'علف', mode: type });
}

function togglePaymentsHistory(id) {
  S.openPayments[id] = !S.openPayments[id];
  render();
}
