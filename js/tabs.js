/**
 * Refaey Farm Tracker - Tab Content Renderers
 * Renders individual feature tabs: Sales, Feed & Stock, Debts, Expenses, Mortalities, and Analytics.
 */

// 1. Sales Tab (Simplified: by flock type, total value only, no weight or auto-debt)
function renderSalesTab(c, k) {
  const arr = c.inc || [];
  const flocks = c.flocks || [];
  const activeFilter = S.incFilter || 'all';
  const filtered = activeFilter === 'all'
    ? arr
    : arr.filter(x => x.flockId === activeFilter);

  return `
    <div class="tab-summary-grid">
      <div class="tab-summary-card">
        <span class="tab-summary-label">إجمالي قيمة المبيعات</span>
        <span class="tab-summary-val color-emerald">${f(k.totalSales)} ج</span>
        <span class="tab-summary-sub">${arr.length} حركة بيع مسجلة</span>
      </div>
      <div class="tab-summary-card">
        <span class="tab-summary-label">إجمالي الطيور المباعة</span>
        <span class="tab-summary-val">${f(k.sold)} طائر</span>
        <span class="tab-summary-sub">متوسط ${f(k.avg)} ج/طائر</span>
      </div>
    </div>

    ${flocks.length > 1 ? `
      <div class="filter-chips" style="margin-top: 0;">
        <button class="filter-chip ${activeFilter === 'all' ? 'active' : ''}" onclick="S.incFilter='all'; render()">
          الكل (${arr.length})
        </button>
        ${flocks.map(fl => {
          const count = arr.filter(x => x.flockId === fl.id).length;
          return `
            <button class="filter-chip ${activeFilter === fl.id ? 'active' : ''}" onclick="S.incFilter=${fl.id}; render()">
              🐣 ${fl.name} (${count})
            </button>
          `;
        }).join('')}
      </div>
    ` : ''}

    <div class="card" style="margin-top: 8px;">
      ${filtered.length ? filtered.slice().reverse().map(e => {
        const i = arr.indexOf(e);
        const total = +e.amt || 0;
        const avgPerBird = e.cnt ? (total / e.cnt) : 0;
        const typeName = flockName(c, e.flockId);

        return `
          <div class="record-item">
            <div>
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 3px;">
                <span class="badge badge-feed-in">🐣 ${typeName}</span>
                <span class="record-title">بيع ${f(e.cnt)} طائر ${e.buyer ? '(' + e.buyer + ')' : ''}</span>
              </div>
              <div class="record-date">
                ${fd(e.d)} ${avgPerBird > 0 ? `• متوسط سعر الطائر: <b>${f(avgPerBird)} ج</b>` : ''}
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

// 2. Feed Tab: Purchased Feed Tracking
function renderFeedTab(c, k) {
  const allFeed = c.feed || [];
  const feedCost = (c.exp || []).filter(x => x.cat === 'علف').reduce((s, x) => s + (+x.amt || 0), 0);

  return `
    <div class="tab-summary-grid">
      <div class="tab-summary-card">
        <span class="tab-summary-label">إجمالي العلف المشترى</span>
        <span class="tab-summary-val color-emerald">${f(k.feedPurchasedKg)} كجم</span>
        <span class="tab-summary-sub">${allFeed.length} حركة شراء</span>
      </div>
      <div class="tab-summary-card">
        <span class="tab-summary-label">إجمالي تكلفة العلف</span>
        <span class="tab-summary-val color-rose">${f(feedCost)} ج</span>
        <span class="tab-summary-sub">إجمالي المدفوع للعلف</span>
      </div>
    </div>

    <!-- Feed Records List -->
    <div class="card">
      ${allFeed.length ? allFeed.slice().reverse().map(e => {
        const i = allFeed.indexOf(e);
        const linkedExp = (c.exp || []).find(x => x.id === e.expRefId || x.feedRefId === e.id);
        const amt = linkedExp ? linkedExp.amt : 0;
        return `
          <div class="record-item">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span class="badge badge-feed-in">📦 علف مشترى</span>
                <span class="record-title">${e.txt || (e.q ? `${e.q} ${e.unit || 'شكارة'}` : 'علف')} ${e.note ? `(${e.note})` : ''}</span>
              </div>
              <div class="record-date">${fd(e.d)} • <b>${f(e.kg)} كجم</b> (${(e.kg / bagKg).toFixed(1)} شكارة)</div>
            </div>
            <div class="record-value-group">
              ${amt > 0 ? `<span class="record-value color-rose">${f(amt)} ج</span>` : ''}
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
          لا توجد مشتريات علف مسجلة حتى الآن
        </div>
      `}
    </div>
  `;
}

// 3. Receivables Tab (مستحق لنا عند الغير فقط - مبسط كأنها نوتة)
function renderDebtTab(c, k) {
  const allDebts = c.debt || [];
  let filtered = allDebts;
  if (S.debtFilter === 'unpaid') filtered = allDebts.filter(d => !d.paid);
  const collectedDebt = Math.max(0, (k.debtUsTotal || 0) - (k.debtUsRemaining || 0));

  return `
    <div class="tab-summary-grid" style="grid-template-columns: repeat(2, 1fr);">
      <div class="tab-summary-card">
        <span class="tab-summary-label">🟢 المتبقي المطلوب تحصيله</span>
        <span class="tab-summary-val color-emerald">${f(k.debtUsRemaining)} ج</span>
        <span class="tab-summary-sub">من أصل ${f(k.debtUsTotal)} ج مستحقات لنا</span>
      </div>
      <div class="tab-summary-card">
        <span class="tab-summary-label">✅ ما تم تحصيله</span>
        <span class="tab-summary-val">${f(collectedDebt)} ج</span>
        <span class="tab-summary-sub">${allDebts.length} بنود مسجلة</span>
      </div>
    </div>

    <!-- Filter Chips for Receivables -->
    <div class="filter-chips" style="margin-top: 0;">
      <button class="filter-chip ${S.debtFilter !== 'unpaid' ? 'active' : ''}" onclick="S.debtFilter='all'; render()">الكل (${allDebts.length})</button>
      <button class="filter-chip ${S.debtFilter === 'unpaid' ? 'active' : ''}" onclick="S.debtFilter='unpaid'; render()">⏳ متبقي للتحصيل</button>
    </div>

    <!-- Receivables List -->
    <div class="card">
      ${filtered.length ? filtered.slice().reverse().map(e => {
        const i = allDebts.indexOf(e);
        const total = +e.amt || 0;
        const paidAmt = +e.paidAmt || (e.paid ? total : 0);
        const remaining = Math.max(0, total - paidAmt);
        const isPaid = e.paid || remaining === 0;
        const isPartial = paidAmt > 0 && remaining > 0;
        const percent = total > 0 ? Math.min(100, Math.round((paidAmt / total) * 100)) : 0;
        const isHistoryOpen = !!S.openPayments[e.id || i];
        const payments = e.payments || [];

        return `
          <div class="record-item" style="flex-direction: column; align-items: stretch; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
              <div>
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span class="record-title" style="font-size: 16px;">${e.who}</span>
                  <span class="badge ${isPaid ? 'badge-paid' : (isPartial ? 'badge-partial' : 'badge-debt-us')}">
                    ${isPaid ? 'تم التحصيل بالكامل ✓' : (isPartial ? `تحصيل جزئي (باقي ${f(remaining)} ج)` : '🟢 مستحق لنا')}
                  </span>
                </div>
                <div class="record-date">${fd(e.d)} ${e.note ? '• ' + e.note : ''}</div>
              </div>
              <div style="text-align: left; flex-shrink: 0;">
                <span class="record-value color-emerald">${f(total)} ج</span>
                ${!isPaid && paidAmt > 0 ? `
                  <div style="font-size: 12px; color: var(--text-dim); font-weight: 700;">
                    المتبقي: <b style="color:var(--amber);">${f(remaining)} ج</b>
                  </div>
                ` : ''}
              </div>
            </div>

            ${paidAmt > 0 ? `
              <!-- Progress Bar -->
              <div class="debt-progress-track">
                <div class="debt-progress-bar" style="width: ${percent}%; background: ${isPaid ? 'var(--emerald)' : 'var(--amber)'};"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); font-weight: 600;">
                <span>تم تحصيله: ${f(paidAmt)} ج (${percent}%)</span>
                <span>المتبقي: ${f(remaining)} ج</span>
              </div>
            ` : ''}

            <!-- Action Buttons -->
            <div class="debt-actions-row">
              ${!isPaid ? `
                <button class="btn btn-sm btn-primary" onclick="openPaymentModal(${i})">
                  💵 تسجيل تحصيل / دفعة
                </button>
              ` : ''}
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
                  <span>سجل الدفعات المحصلة:</span>
                  <button type="button" class="btn btn-sm btn-outline" onclick="togglePaymentsHistory('${e.id || i}')" style="padding: 2px 8px; font-size: 11px;">إخفاء</button>
                </div>
                ${payments.map((p, pIdx) => `
                  <div class="payment-history-item">
                    <div>
                      <b>${fd(p.d)}</b>: تحصيل مبلغ <span class="num color-emerald">${f(p.amt)} ج</span> ${p.note ? `(${p.note})` : ''}
                    </div>
                    <button class="btn btn-sm btn-danger" onclick="deletePayment(${i}, ${pIdx})" title="حذف هذه الدفعة والتراجع عن التحصيل" style="padding: 2px 6px; font-size: 11px;">
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
          لا توجد مستحقات مسجلة حتى الآن
        </div>
      `}
    </div>
  `;
}

// 4. Generic Tab for Expenses & Mortalities (Clean list without duplicate action buttons)
function renderGenericTab(c, k) {
  const T = K[S.tab];
  const arr = c[S.tab] || [];

  return `
    ${S.tab === 'exp' ? `
      <div class="tab-summary-grid" style="margin-bottom: 10px;">
        <div class="tab-summary-card">
          <span class="tab-summary-label">مصاريف التشغيل المشتركة</span>
          <span class="tab-summary-val color-rose">${f(k.otherExp)} ج</span>
          <span class="tab-summary-sub">علف + دواء + غاز + أخرى</span>
        </div>
        <div class="tab-summary-card">
          <span class="tab-summary-label">تكلفة الكتاكيت</span>
          <span class="tab-summary-val">${f(k.chickCost)} ج</span>
          <span class="tab-summary-sub">${f(c.n)} كتكوت في البداية</span>
        </div>
      </div>
    ` : ''}

    <div class="card">
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
  if (k.chickCost > 0) {
    by['كتاكيت (بداية الدورة)'] = k.chickCost;
  }
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
  const flockProfitBars = (k.flockStats || []).length > 1
    ? bars(
        k.flockStats.map(fs => ({
          n: fs.name,
          v: fs.profit,
          c: fs.profit >= 0 ? 'var(--emerald)' : 'var(--rose)',
          cls: fs.profit >= 0 ? 'color-emerald' : 'color-rose',
          t: (fs.profit >= 0 ? 'ربح ' : 'خسارة ') + f(Math.abs(fs.profit)) + ' ج'
        })),
        x => x.t
      )
    : '';

  return `
    <div class="card">
      <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 12px; color: var(--text-title);">
        صرفت فلوسك على إيه؟ (توزيع التكاليف)
      </h3>
      ${it.length ? bars(it, x => x.t) : '<div class="empty-state"><div class="empty-state-icon">💸</div>مفيش مصروفات مسجلة بعد</div>'}
    </div>

    ${flockProfitBars ? `
      <div class="card">
        <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 12px; color: var(--text-title);">
          مقارنة ربحية كل نوع في هذه الدورة
        </h3>
        ${flockProfitBars}
      </div>
    ` : ''}

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

// Quick expense form with predefined category
function openExpenseWithCat(cat) {
  S.tab = (cat === 'علف') ? 'feed' : 'exp';
  openForm('exp', null, { cat: cat });
}

// Quick Feed form
function openFeedForm() {
  openExpenseWithCat('علف');
}

function togglePaymentsHistory(id) {
  S.openPayments[id] = !S.openPayments[id];
  render();
}
