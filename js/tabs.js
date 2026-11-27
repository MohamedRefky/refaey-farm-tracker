/**
 * Refaey Farm Tracker - Tab Content Renderers
 * Renders individual feature tabs: Sales, Feed & Stock, Debts, Expenses, Mortalities, and Analytics.
 */

// 1. Sales Tab (Simplified: slim summary + flock filter + compact rows)
function renderSalesTab(c, k) {
  const arr = c.inc || [];
  const flocks = c.flocks || [];
  let activeFilter = S.incFilter || 'all';
  if (activeFilter !== 'all' && !flocks.some(fl => fl.id === activeFilter)) {
    activeFilter = 'all';
    S.incFilter = 'all';
  }
  const filtered = activeFilter === 'all'
    ? arr
    : arr.filter(x => x.flockId === activeFilter);
  const filteredAmt = filtered.reduce((s, x) => s + (+x.amt || 0), 0);
  const filteredCnt = filtered.reduce((s, x) => s + (+x.cnt || 0), 0);

  return `
    ${flocks.length > 1 ? `
      <div class="filter-chips" style="margin-top: 0;">
        <button class="filter-chip ${activeFilter === 'all' ? 'active' : ''}" onclick="S.incFilter='all'; render()">
          الكل (${arr.length})
        </button>
        ${flocks.map(fl => {
          const count = arr.filter(x => x.flockId === fl.id).length;
          return `
            <button class="filter-chip ${activeFilter === fl.id ? 'active' : ''}" onclick="S.incFilter=${fl.id}; render()">
              🐣 ${esc(fl.name)} (${count})
            </button>
          `;
        }).join('')}
      </div>
    ` : ''}

    <div class="tab-inline-summary">
      <span>المبيعات: <b class="color-emerald">${f(filteredAmt)} ج</b></span>
      <span>•</span>
      <span>${f(filteredCnt)} طائر ${filteredCnt > 0 ? `(متوسط ${f(filteredAmt / filteredCnt)} ج)` : ''}</span>
    </div>

    <div class="card">
      ${filtered.length ? filtered.slice().reverse().map(e => {
        const i = arr.indexOf(e);
        const total = +e.amt || 0;
        const typeName = flockName(c, e.flockId);

        return `
          <div class="record-item record-clean">
            <div class="record-clean-top">
              <div class="record-main">
                <div class="record-title">
                  <span class="record-cat-badge">🐣 ${esc(typeName)}</span>
                  <span>بيع ${f(e.cnt)} طائر${e.buyer ? ' • ' + esc(e.buyer) : ''}</span>
                </div>
                <div class="record-date">${fds(e.d)}${e.cnt ? ` • متوسط ${f(total / e.cnt)} ج/طائر` : ''}</div>
              </div>
              <span class="record-value color-emerald">${f(total)} ج</span>
            </div>
            <div class="record-labeled-actions">
              <button class="labeled-action-btn" onclick="openForm('inc', ${i})">✏️ تعديل</button>
              <button class="labeled-action-btn danger" onclick="delSale(${i})">🗑️ حذف</button>
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

// 2. Expenses Tab (Unified with Feed + Chick Purchases + Category Filter Chips + Slim Rows)
function renderExpensesTab(c, k) {
  const allExp = c.exp || [];
  const activeFilter = S.expFilter || 'all';

  const catIcons = {
    'علف': '🌾',
    'دواء': '💊',
    'غاز': '🔥',
    'مصاريف أخرى': '📦'
  };

  // Build chick purchase rows from flocks & their batches (never duplicates calc sums)
  const chickEntries = [];
  (c.flocks || []).forEach((fl, flIdx) => {
    const batches = Array.isArray(fl.batches) && fl.batches.length > 0
      ? fl.batches
      : [{ id: fl.id, d: c.start, count: +fl.count || 0, cost: +fl.cost || 0, seq: flIdx + 1 }];
    const multiBatch = batches.length > 1;
    batches.forEach((b, bIdx) => {
      chickEntries.push({
        kind: 'chick',
        seq: +b.seq || 0,
        d: b.d || c.start || '',
        flockId: fl.id,
        flockName: fl.name || 'كتاكيت',
        batchIdx: bIdx,
        multiBatch,
        count: +b.count || 0,
        amt: +b.cost || 0
      });
    });
  });

  const expEntries = allExp.map((e, idx) => ({
    kind: 'exp',
    seq: +e.seq || 0,
    d: e.d || '',
    expIndex: idx,
    exp: e,
    amt: +e.amt || 0
  }));

  let filteredEntries = [];
  if (activeFilter === 'كتاكيت') {
    filteredEntries = chickEntries.slice().reverse();
  } else if (activeFilter === 'all') {
    filteredEntries = [...chickEntries, ...expEntries].sort((a, b) => {
      if (b.seq !== a.seq) return b.seq - a.seq;
      const dCmp = String(b.d || '').localeCompare(String(a.d || ''));
      if (dCmp !== 0) return dCmp;
      return (b.expIndex ?? b.batchIdx ?? 0) - (a.expIndex ?? a.batchIdx ?? 0);
    });
  } else {
    filteredEntries = expEntries.filter(item => item.exp.cat === activeFilter).reverse();
  }

  let filteredExpSum = filteredEntries
    .filter(item => item.kind === 'exp')
    .reduce((s, item) => s + item.amt, 0);
  if (activeFilter === 'علف' && k.feedInventory && k.feedInventory.enabled) filteredExpSum = k.feedCostTotal;

  let summaryHtml = `<span>إجمالي المصاريف: <b class="color-rose">${f(k.e)} ج</b></span><span>•</span><span>كتاكيت: <b>${f(k.chickCost)} ج</b> + تشغيل: <b>${f(k.otherExp)} ج</b></span>`;
  if (activeFilter === 'كتاكيت') {
    summaryHtml = `<span>🐣 شراء الكتاكيت: <b class="color-rose">${f(k.chickCost)} ج</b></span><span>•</span><span>${f(k.chickCount)} طائر (متوسط <b>${k.chickCount > 0 ? fp(k.buyPerChick) : 0} ج</b>/كتكوت)</span>`;
  } else if (activeFilter === 'علف') {
    summaryHtml = `<span>مشتَرى: <b class="color-emerald">${f(k.feedPurchasedKg)} كجم</b></span><span>•</span><span>${k.feedInventory && k.feedInventory.enabled ? 'تكلفة المستهلك تقديريًا' : 'تكلفة المشتريات'}: <b class="color-rose">${f(filteredExpSum)} ج</b></span>`;
  } else if (activeFilter !== 'all') {
    summaryHtml = `<span>${catIcons[activeFilter] || ''} ${activeFilter}: <b class="color-rose">${f(filteredExpSum)} ج</b></span><span>•</span><span>${filteredEntries.length} بنود</span>`;
  }

  return `
    <div class="filter-chips" style="margin-top: 0;">
      <button class="filter-chip ${activeFilter === 'all' ? 'active' : ''}" onclick="S.expFilter='all'; render()">
        الكل (${allExp.length + chickEntries.length})
      </button>
      <button class="filter-chip ${activeFilter === 'كتاكيت' ? 'active' : ''}" onclick="S.expFilter='كتاكيت'; render()">
        🐣 كتاكيت (${chickEntries.length})
      </button>
      <button class="filter-chip ${activeFilter === 'علف' ? 'active' : ''}" onclick="S.expFilter='علف'; render()">
        🌾 علف (${allExp.filter(e => e.cat === 'علف').length})
      </button>
      <button class="filter-chip ${activeFilter === 'دواء' ? 'active' : ''}" onclick="S.expFilter='دواء'; render()">
        💊 دواء
      </button>
      <button class="filter-chip ${activeFilter === 'غاز' ? 'active' : ''}" onclick="S.expFilter='غاز'; render()">
        🔥 غاز
      </button>
      <button class="filter-chip ${activeFilter === 'مصاريف أخرى' ? 'active' : ''}" onclick="S.expFilter='مصاريف أخرى'; render()">
        📦 أخرى
      </button>
    </div>

    <div class="tab-inline-summary">
      ${summaryHtml}
    </div>

    ${renderFeedInventoryCard(c, k)}

    <div class="card">
      ${filteredEntries.length ? filteredEntries.map(item => {
        if (item.kind === 'chick') {
          const unitPrice = item.count > 0 ? item.amt / item.count : 0;
          const title = item.multiBatch
            ? `شراء كتاكيت: ${item.flockName} (دفعة ${item.batchIdx + 1})`
            : `شراء كتاكيت: ${item.flockName}`;
          const editCall = item.multiBatch
            ? `openEditBatchModal(${item.flockId}, ${item.batchIdx})`
            : `openFlockModal(${item.flockId})`;

          return `
            <div class="record-item record-clean">
              <div class="record-clean-top">
                <div class="record-main">
                  <div class="record-title">
                    <span>🐣</span>
                    <span>${esc(title)}</span>
                  </div>
                  <div class="record-date">${fds(item.d)} • <b>${f(item.count)} طائر</b> • سعر الكتكوت: <b>${fp(unitPrice)} ج</b></div>
                </div>
                <span class="record-value color-rose">${f(item.amt)} ج</span>
              </div>
              <div class="record-labeled-actions">
                <button class="labeled-action-btn" onclick="${editCall}">✏️ تعديل السعر / العدد</button>
                ${item.multiBatch ? `<button class="labeled-action-btn danger" onclick="delBatch(${item.flockId}, ${item.batchIdx})">🗑️ حذف الدفعة</button>` : ''}
              </div>
            </div>
          `;
        }

        const e = item.exp;
        const i = item.expIndex;
        const icon = catIcons[e.cat] || '💸';
        const linkedFeed = e.cat === 'علف'
          ? (c.feed || []).find(fl => fl.id === e.feedRefId || fl.expRefId === e.id)
          : null;
        const label = linkedFeed
          ? `${linkedFeed.txt || (linkedFeed.q ? `${linkedFeed.q} ${linkedFeed.unit || 'شكارة'}` : 'علف')}`
          : (e.note ? `${e.cat} - ${e.note}` : e.cat);
        const subInfo = linkedFeed ? ` • <b>${f(linkedFeed.kg)} كجم</b>` : '';

        return `
          <div class="record-item record-clean">
            <div class="record-clean-top">
              <div class="record-main">
                <div class="record-title">
                  <span>${icon}</span>
                  <span>${esc(label)}</span>
                </div>
                <div class="record-date">${fds(e.d)}${subInfo}</div>
              </div>
              <span class="record-value color-rose">${f(e.amt)} ج</span>
            </div>
            <div class="record-labeled-actions">
              <button class="labeled-action-btn" onclick="openForm('exp', ${i})">✏️ تعديل</button>
              <button class="labeled-action-btn danger" onclick="del(${i})">🗑️ حذف</button>
            </div>
          </div>
        `;
      }).join('') : `
        <div class="empty-state">
          <div class="empty-state-icon">💸</div>
          لا توجد مصاريف مسجلة في هذا التصنيف
        </div>
      `}
    </div>
  `;
}

function renderFeedInventoryCard(c, k) {
  const inv = k.feedInventory || { enabled: false, periods: [] };
  const checks = (c.feedStocktakes || []).slice().sort((a, b) => String(a.d || '').localeCompare(String(b.d || '')) || (+a.seq || 0) - (+b.seq || 0));
  const hasFeedPurchases = (c.feed || []).some(x => x.type === 'purchased');
  return `
    <div class="card feed-inventory-card">
      <div class="feed-inventory-head">
        <div>
          <h3>📦 جرد العلف</h3>
          <small>سجّل الشكاير المتبقية عند البيع أو إغلاق الدفعة؛ لا تحتاج لوزن الجردل.</small>
        </div>
        <button class="btn btn-primary btn-sm" type="button" onclick="openFeedStocktakeModal()">+ تسجيل جرد</button>
      </div>
      <div class="feed-inventory-note">⚠️ تكلفة العلف هنا تقديرية حسب وزن الشكارة المسجل والرصيد بالجرد. الكمية المستهلكة تتحسب من: رصيد البداية + المشتريات − المتبقي.</div>
      ${inv.enabled ? `
        <div class="feed-inventory-stats">
          <span>المستهلك المقدر: <b>${fp(inv.consumedKg)} كجم</b></span>
          <span>تكلفته: <b>${f(inv.consumedCost)} ج</b></span>
          <span>المتبقي: <b>${fp(inv.stockKg)} كجم</b></span>
          <span>قيمة المتبقي التقديرية: <b>${f(inv.stockValue)} ج</b></span>
        </div>
        ${inv.hasShortage ? '<div class="feed-inventory-warning">فيه جرد مسجل أكبر من الرصيد المتاح حسب المشتريات. راجع تواريخ الشراء أو أضف الرصيد الافتتاحي؛ لم تُحسب تكلفة استهلاك للفترة المتعارضة.</div>' : ''}
        <div class="feed-stocktake-list">
          ${checks.map(check => {
            const idx = (c.feedStocktakes || []).indexOf(check);
            const period = inv.periods.find(x => x.id === check.id);
            const canEdit = check === checks[checks.length - 1];
            return `<div class="feed-stocktake-row"><span><b>${fds(check.d)}</b> • متبقي ${fp(check.kg)} كجم${period ? ` • استهلاك الفترة ${fp(period.kg)} كجم / ${f(period.cost)} ج` : ''}</span><span>${canEdit ? `<button type="button" class="labeled-action-btn" onclick="openFeedStocktakeModal(${idx})">تعديل</button>` : ''}<button type="button" class="labeled-action-btn danger" onclick="deleteFeedStocktake(${idx})">حذف</button></span></div>`;
          }).join('')}
        </div>
      ` : `
        <div class="feed-inventory-empty">${hasFeedPurchases ? 'ابدأ بأول جرد لتقدير المستهلك والمتبقي. المشتريات السابقة ستدخل في الحساب من تاريخ الدورة.' : 'سجّل مشتريات العلف أولًا، ثم اعمل جردًا عند البيع أو إغلاق الدفعة.'}</div>
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
    <div class="filter-chips" style="margin-top: 0;">
      <button class="filter-chip ${S.debtFilter !== 'unpaid' ? 'active' : ''}" onclick="S.debtFilter='all'; render()">الكل (${allDebts.length})</button>
      <button class="filter-chip ${S.debtFilter === 'unpaid' ? 'active' : ''}" onclick="S.debtFilter='unpaid'; render()">⏳ متبقي للتحصيل</button>
    </div>

    <div class="tab-inline-summary">
      <span>المتبقي لنا: <b class="color-emerald">${f(k.debtUsRemaining)} ج</b></span>
      <span>•</span>
      <span>محصل: <b>${f(collectedDebt)} ج</b></span>
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
          <div class="record-item record-clean">
            <div class="record-clean-top">
              <div class="record-main">
                <div class="record-title">
                  <span>📝</span>
                  <span>${esc(e.who)}</span>
                </div>
                <div class="record-date">
                  ${fds(e.d)}${e.note ? ' • ' + esc(e.note) : ''} •
                  <b class="${isPaid ? 'color-emerald' : 'color-amber'}">
                    ${isPaid ? 'تم التحصيل ✓' : (isPartial ? `باقي ${f(remaining)} ج` : 'متبقي بالكامل')}
                  </b>
                </div>
              </div>
              <span class="record-value color-emerald">${f(total)} ج</span>
            </div>

            ${paidAmt > 0 ? `
              <div class="debt-progress-track" style="margin: 2px 0;">
                <div class="debt-progress-bar" style="width: ${percent}%; background: ${isPaid ? 'var(--emerald)' : 'var(--amber)'};"></div>
              </div>
            ` : ''}

            <div class="record-labeled-actions">
              ${!isPaid ? `<button class="labeled-action-btn pay" onclick="openPaymentModal(${i})">💵 تحصيل</button>` : ''}
              ${payments.length > 0 ? `<button class="labeled-action-btn" onclick="togglePaymentsHistory('${e.id || i}')">📜 الدفعات (${payments.length})</button>` : ''}
              <button class="labeled-action-btn" onclick="openForm('debt', ${i})">✏️ تعديل</button>
              <button class="labeled-action-btn danger" onclick="delDebt(${i})">🗑️ حذف</button>
            </div>

            ${isHistoryOpen && payments.length > 0 ? `
              <div class="payment-history-box">
                <div class="payment-history-header">
                  <span>سجل الدفعات المحصلة:</span>
                  <button type="button" class="btn btn-sm btn-outline" onclick="togglePaymentsHistory('${e.id || i}')" style="padding: 2px 8px; font-size: 11px;">إخفاء</button>
                </div>
                ${payments.map((p, pIdx) => `
                  <div class="payment-history-item">
                    <div>
                      <b>${fds(p.d)}</b>: تحصيل <span class="num color-emerald">${f(p.amt)} ج</span> ${p.note ? `(${esc(p.note)})` : ''}
                    </div>
                    <div class="record-icon-actions">
                      <button class="labeled-action-btn" onclick="openPaymentModal(${i}, ${pIdx})" style="padding: 3px 8px; font-size: 11px;">✏️ تعديل</button>
                      <button class="labeled-action-btn danger" onclick="deletePayment(${i}, ${pIdx})" style="padding: 3px 8px; font-size: 11px;">🗑️ إلغاء</button>
                    </div>
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

// 4. Mortality Tab (Slim rows)
function renderDeadTab(c, k) {
  const arr = c.dead || [];

  return `
    <div class="tab-inline-summary">
      <span>إجمالي النافق: <b class="${k.mort > 5 ? 'color-rose' : ''}">${f(k.dead)} طائر</b></span>
      <span>•</span>
      <span>النسبة: <b>${k.mort.toFixed(1)}%</b></span>
    </div>

    <div class="card">
      ${arr.length ? arr.slice().reverse().map(e => {
        const i = arr.indexOf(e);
        const typeName = flockName(c, e.flockId);

        return `
          <div class="record-item record-clean">
            <div class="record-clean-top">
              <div class="record-main">
                <div class="record-title">
                  <span class="record-cat-badge">🐣 ${esc(typeName)}</span>
                  <span>نفوق ${f(e.n)} طائر</span>
                </div>
                <div class="record-date">${fds(e.d)}</div>
              </div>
              <span class="record-value color-rose">${f(e.n)} طيور</span>
            </div>
            <div class="record-labeled-actions">
              <button class="labeled-action-btn" onclick="openForm('dead', ${i})">✏️ تعديل</button>
              <button class="labeled-action-btn danger" onclick="del(${i})">🗑️ حذف</button>
            </div>
          </div>
        `;
      }).join('') : `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          مفيش نافق مسجل حتى الآن
        </div>
      `}
    </div>
  `;
}

// 5. Cycle Summary Breakdown Charts (Plain, easy-to-read Arabic)
function renderAnalyticsTab(c, k) {
  const by = {};
  if (k.chickCost > 0) {
    by['ثمن الكتاكيت'] = k.chickCost;
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
        k.flockStats.map(fs => {
          const hasSales = fs.sold > 0 || fs.revenue > 0;
          if (!hasSales) {
            return {
              n: fs.name,
              v: fs.totalCost,
              c: 'var(--sky)',
              cls: '',
              t: 'صرفت عليه ' + f(fs.totalCost) + ' ج (لم يُبع بعد)'
            };
          }
          return {
            n: fs.name,
            v: fs.profit,
            c: fs.profit >= 0 ? 'var(--emerald)' : 'var(--rose)',
            cls: fs.profit >= 0 ? 'color-emerald' : 'color-rose',
            t: (fs.profit >= 0 ? 'مكسب +' : 'خسارة -') + f(Math.abs(fs.profit)) + ' ج'
          };
        }),
        x => x.t
      )
    : '';

  return `
    <div class="card">
      <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 12px; color: var(--text-title);">
        💸 فلوسك اتصرفت على إيه؟
      </h3>
      ${it.length ? bars(it, x => x.t) : '<div class="empty-state"><div class="empty-state-icon">💸</div>مفيش مصروفات مسجلة بعد</div>'}
    </div>

    ${flockProfitBars ? `
      <div class="card">
        <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 12px; color: var(--text-title);">
          🐔 موقف كل نوع فراخ في الدورة
        </h3>
        ${flockProfitBars}
      </div>
    ` : ''}

    <div class="card">
      <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 12px; color: var(--text-title);">
        📦 حساب الطيور (اتباع ونافق وباقي)
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

    ${C.length > 1 ? `
      <div class="card">
        <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 12px; color: var(--text-title);">
          📊 مقارنة مكسب الدورات
        </h3>
        ${profitChart()}
      </div>
    ` : ''}
  `;
}

// Quick 1-tap add handler: switches tab and opens form immediately
function quickAdd(kind) {
  S.tab = kind;
  openForm(kind);
}

// Quick expense form with predefined category
function openExpenseWithCat(cat) {
  S.tab = 'exp';
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
