/**
 * Refaey Farm Tracker - Application Controller & UI Logic
 * Handles interactive views, modal dialogs, validations, calculations, and local persistence.
 */

// Global UI State
let S = {
  v: 'list',          // 'list' for all cycles or cycle ID
  tab: 'exp',         // 'exp', 'inc', 'dead', 'feed', 'debt', 'ch'
  feedFilter: 'all',  // 'all', 'consumed', 'purchased'
  debtFilter: 'all',  // 'all', 'us', 'them', 'unpaid'
  openPayments: {}    // tracks expanded payment histories: { [debtId]: true }
};

// Field Schemas and Display Helpers
const K = {
  exp: {
    t: 'مصروف',
    icon: '💸',
    f: [
      ['cat', 'select', cats, 'نوع المصروف'],
      ['amt', 'number', '', 'المبلغ المدفوع (جنيه)'],
      ['note', 'text', '', 'ملاحظة أو بيان (اختياري)']
    ],
    r: e => [e.cat + (e.note ? ' - ' + e.note : ''), f(e.amt) + ' ج']
  },
  inc: {
    t: 'حركة بيع طيور (إيراد)',
    icon: '📈',
    f: [
      ['cnt', 'number', '', 'عدد الطيور المباعة'],
      ['kg', 'number', '', 'الوزن الإجمالي (كجم)'],
      ['amt', 'number', '', 'إجمالي قيمة البيع (جنيه)'],
      ['paidAmt', 'number', '', 'المبلغ المحصل نقداً الآن (كاش)'],
      ['buyer', 'text', '', 'اسم المشتري / التاجر']
    ],
    r: e => {
      const isPartial = e.paidAmt !== undefined && e.paidAmt < e.amt;
      return [
        `بيع ${e.cnt} طائر ${e.buyer ? '(' + e.buyer + ')' : ''}`,
        `${f(e.amt)} ج`
      ];
    }
  },
  dead: {
    t: 'طيور نافقة',
    icon: '⚠️',
    f: [
      ['n', 'number', '', 'عدد الطيور النافقة'],
      ['note', 'text', '', 'سبب النفوق / ملاحظة (اختياري)']
    ],
    r: e => ['نفوق ' + e.n + ' طائر' + (e.note ? ' - ' + e.note : ''), e.n + ' طيور']
  },
  feed: {
    t: 'حركة علف',
    icon: '🌾',
    f: [
      ['type', 'select', ['consumed', 'purchased'], 'نوع حركة العلف'],
      ['unit', 'select', ['شكارة', 'كيلو'], 'الوحدة'],
      ['q', 'number', '', 'الكمية'],
      ['note', 'text', '', 'نوع العلف / بيان (بادي، نامي، ناهي...)']
    ],
    r: e => {
      const typeLabel = e.type === 'purchased' ? 'وارد للمخزن' : 'مستهلك للطيور';
      return [`علف (${typeLabel}): ` + e.txt, f(e.kg) + ' كجم'];
    }
  },
  debt: {
    t: 'مديونية',
    icon: '📝',
    f: [
      ['dir', 'select', ['لنا', 'علينا'], 'نوع المديونية'],
      ['who', 'text', '', 'اسم الطرف الآخر (التاجر أو المورد)'],
      ['amt', 'number', '', 'المبلغ الإجمالي (جنيه)'],
      ['paidAmt', 'number', '', 'المبلغ المسدد مقدماً إن وجد (اختياري)'],
      ['note', 'text', '', 'بيان المديونية أو سببها']
    ],
    r: e => {
      const dirText = e.dir === 'لنا' ? 'مستحق لنا عنده' : 'مستحق علينا له';
      return [e.who + ' (' + dirText + ')', f(e.amt) + ' ج'];
    }
  }
};

const tabs = [
  ['exp', '💸 المصروفات'],
  ['inc', '📈 المبيعات والتحصيل'],
  ['dead', '⚠️ النفوق'],
  ['feed', '🌾 العلف والمخزون'],
  ['debt', '📝 الديون والتحصيل'],
  ['ch', '📊 التحليل والتقارير']
];

// Helper: Get currently selected cycle
const cur = () => C.find(c => c.id === S.v);

// Helper: Render Metric Card HTML
function statBox(label, val, hint, icon, colorCls = '') {
  return `
    <div class="stat-box">
      <div class="stat-header">
        <span class="stat-label">${label}</span>
        <span class="stat-icon">${icon}</span>
      </div>
      <div class="stat-value ${colorCls}">${val}</div>
      <div class="stat-hint">${hint}</div>
    </div>
  `;
}

// ==========================================================================
// 1. MASTER VIEW (All Cycles Overview)
// ==========================================================================
function list(a) {
  const tot = C.reduce((s, c) => s + calc(c).p, 0);
  const activeCount = C.filter(c => !c.end).length;
  const totalBirds = C.reduce((s, c) => s + (c.n || 0), 0);

  a.innerHTML = `
    <!-- Top Hero Overview Card -->
    <div class="card hero-card">
      <div class="hero-label">
        <span>📊</span> إجمالي صافي أرباح جميع الدورات
      </div>
      <div class="hero-big-number ${tot >= 0 ? 'color-emerald' : 'color-rose'}">
        ${f(tot)} <small>جنيه مصري</small>
      </div>

      <div class="hero-stats-row">
        <div class="hero-substat">
          <span class="hero-substat-label">الدورات الجارية</span>
          <span class="hero-substat-value color-emerald">${activeCount} شغالين</span>
        </div>
        <div class="hero-substat">
          <span class="hero-substat-label">إجمالي الدورات</span>
          <span class="hero-substat-value">${C.length} دورات</span>
        </div>
        <div class="hero-substat">
          <span class="hero-substat-label">إجمالي الكتاكيت</span>
          <span class="hero-substat-value">${f(totalBirds)} طائر</span>
        </div>
      </div>
    </div>

    <!-- Quick Action to Start New Batch -->
    <button class="btn btn-primary btn-full" onclick="newCycle()">
      <span>+</span> بدء دورة تسمين جديدة
    </button>

    <!-- Cycle List Header -->
    <div class="section-title">
      <span>دوراتي المسجلة</span>
      <span class="badge ${activeCount > 0 ? 'badge-active' : 'badge-closed'}">
        ${activeCount > 0 ? activeCount + ' جارية الآن' : 'مكتملة'}
      </span>
    </div>

    <!-- Cycle Cards -->
    ${C.slice().reverse().map(c => {
      const k = calc(c);
      const isOngoing = !c.end;
      return `
        <div class="card cycle-card" onclick="openCycle(${c.id})">
          <div class="cycle-card-header">
            <div class="cycle-title-group">
              <div class="cycle-icon-box">🐔</div>
              <div>
                <div class="cycle-name">${c.name}</div>
                <div class="cycle-date">بدأت: ${fd(c.start)} ${isOngoing ? `• <b style="color:var(--emerald);">اليوم الـ ${Math.max(1, Math.floor((new Date(today()) - new Date(c.start)) / (1000 * 60 * 60 * 24)) + 1)}</b>` : (c.end ? `• استغرقت ${Math.max(1, Math.floor((new Date(c.end) - new Date(c.start)) / (1000 * 60 * 60 * 24)) + 1)} يوم` : '')}</div>
              </div>
            </div>
            <!-- The Glowing Green Light Beacon -->
            <span class="badge ${isOngoing ? 'badge-active' : 'badge-closed'}">
              ${isOngoing ? 'شغالة الآن' : 'مكتملة'}
            </span>
          </div>

          <div class="cycle-details-grid">
            <div>
              <span class="hero-substat-label">العدد الأصلي</span>
              <div class="num" style="font-size: 17px; font-weight: 700;">${f(c.n)} طائر</div>
            </div>
            <div>
              <span class="hero-substat-label">النافق</span>
              <div class="num ${k.mort > 5 ? 'color-rose' : ''}" style="font-size: 16px; font-weight: 700;">
                ${k.dead} (${k.mort.toFixed(1)}%)
              </div>
            </div>
            <div style="text-align: left;">
              <span class="hero-substat-label">${k.p >= 0 ? 'صافي الربح' : 'الخسارة'}</span>
              <div class="num ${k.p >= 0 ? 'color-emerald' : 'color-rose'}" style="font-size: 20px; font-weight: 800;">
                ${f(Math.abs(k.p))} ج
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('')}

    <!-- Performance Comparison Chart -->
    <div class="section-title">
      <span>مقارنة أرباح وخسائر الدورات</span>
    </div>
    <div class="card">
      ${profitChart()}
    </div>
  `;
}

function openCycle(id) {
  S.v = id;
  S.tab = 'exp';
  S.feedFilter = 'all';
  S.debtFilter = 'all';
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================================================
// 2. DETAIL VIEW (Single Batch Deep Dive & Daily Operations)
// ==========================================================================
function detail(a) {
  const c = cur();
  if (!c) {
    S.v = 'list';
    return list(a);
  }
  const k = calc(c);
  const isOngoing = !c.end;

  let h = `
    <!-- Top Nav with Print and Edit Support -->
    <div class="detail-top-nav">
      <button class="back-btn" onclick="S.v='list'; render()">
        <span>→</span> <span class="nav-text">العودة لكل الدورات</span>
      </button>
      <div class="detail-nav-actions">
        <button class="print-btn" onclick="editCycle()" title="تعديل بيانات الدورة">
          <span>✏️</span> <span>تعديل</span>
        </button>
        <button class="print-btn" onclick="window.print()" title="طباعة تقرير الدورة">
          <span>🖨️</span> <span>طباعة</span>
        </button>
      </div>
    </div>

    <!-- Cycle Hero Summary -->
    <div class="card hero-card">
      <div class="hero-cycle-header">
        <div class="hero-cycle-info">
          <div class="cycle-icon-box hero-icon" style="width: 50px; height: 50px; font-size: 24px;">🐔</div>
          <div>
            <h2 class="hero-cycle-name">${c.name}</h2>
            <div class="hero-substat-label">
              بدأت: ${fd(c.start)} ${c.end ? ' • انتهت: ' + fd(c.end) + ' (استغرقت ' + (Math.max(1, Math.floor((new Date(c.end) - new Date(c.start))/(1000*60*60*24))+1)) + ' يوم)' : ' • <b style="color:var(--emerald);">عمر الدورة: اليوم الـ ' + (Math.max(1, Math.floor((new Date(today()) - new Date(c.start))/(1000*60*60*24))+1)) + '</b>'}
            </div>
          </div>
        </div>
        <span class="badge ${isOngoing ? 'badge-active' : 'badge-closed'}">
          ${isOngoing ? 'شغالة الآن' : 'مكتملة'}
        </span>
      </div>

      <div class="hero-label" style="margin-top: 16px;">
        ${k.p >= 0 ? 'صافي أرباح الدورة حتى الآن (إجمالي)' : 'صافي الخسارة حتى الآن'}
      </div>
      <div class="hero-big-number ${k.p >= 0 ? 'color-emerald' : 'color-rose'}">
        ${f(Math.abs(k.p))} <small>جنيه مصري</small>
      </div>

      <div class="hero-stats-row">
        <div class="hero-substat">
          <span class="hero-substat-label">إجمالي المبيعات</span>
          <span class="hero-substat-value color-emerald">${f(k.totalSales)} ج</span>
          <small style="display:block; font-size:11px; color:var(--text-dim); margin-top:2px;">
            (كاش: ${f(k.collectedCash)} ج ${k.uncollectedSales > 0 ? `• آجل: <b style="color:var(--amber);">${f(k.uncollectedSales)} ج</b>` : '• مدفوع كاش'})
          </small>
        </div>
        <div class="hero-substat">
          <span class="hero-substat-label">إجمالي المصروفات</span>
          <span class="hero-substat-value color-rose">${f(k.e)} ج</span>
        </div>
        <div class="hero-substat">
          <span class="hero-substat-label">السيولة النقدية المحصلة</span>
          <span class="hero-substat-value ${k.cashProfit >= 0 ? 'color-emerald' : 'color-amber'}">${f(k.cashProfit)} ج</span>
          <small style="display:block; font-size:11px; color:var(--text-dim); margin-top:2px;">(المحصل نقداً - المصروفات)</small>
        </div>
      </div>
    </div>

    <!-- ⚡ QUICK ACTION BUTTONS BAR (لتسهيل التسجيل بنقرة واحدة) -->
    <div class="section-title" style="margin-top: 24px;">
      <span>⚡ تسجيل عملية سريعة</span>
    </div>
    <div class="quick-actions-bar">
      <button class="quick-action-btn" onclick="quickAdd('exp')">
        <span class="quick-action-icon">💸</span>
        <span>+ مصروف</span>
      </button>
      <button class="quick-action-btn" onclick="quickAdd('inc')">
        <span class="quick-action-icon">📈</span>
        <span>+ بيع طيور</span>
      </button>
      <button class="quick-action-btn" onclick="quickAdd('dead')">
        <span class="quick-action-icon">⚠️</span>
        <span>+ نافق</span>
      </button>
      <button class="quick-action-btn" onclick="openFeedForm('consumed')">
        <span class="quick-action-icon">🌾</span>
        <span>+ استهلاك علف</span>
      </button>
      <button class="quick-action-btn" onclick="quickAdd('debt')">
        <span class="quick-action-icon">📝</span>
        <span>+ مديونية</span>
      </button>
    </div>

    <!-- Flock Status Statistics Grid -->
    <div class="section-title">
      <span>حالة القطيع والطيور</span>
    </div>
    <div class="stats-grid">
      ${statBox('العدد الأصلي', f(c.n), 'بداية الدورة', '🐣')}
      ${statBox('النافق', f(k.dead), 'نسبة ' + k.mort.toFixed(1) + '% ' + (k.mort > 5 ? '(مرتفعة)' : '(طبيعية)'), '⚠️', k.mort > 5 ? 'color-rose' : '')}
      ${statBox('المباع', f(k.sold), 'بمتوسط ' + f(k.avg) + ' ج/طائر', '💰', 'color-emerald')}
      ${statBox('المتبقي بالمزرعة', f(k.remaining), 'طيور حية متاحة', '🏠')}
    </div>

    <!-- Production Efficiency & Cost Grid -->
    <div class="section-title">
      <span>مؤشرات الكفاءة والتكلفة الحيوية</span>
    </div>
    <div class="stats-grid">
      ${statBox('تكلفة الطائر', f(k.cpb) + ' ج', 'المصروف ÷ الحي', '💵')}
      ${statBox('ربح الطائر', f(k.ppb) + ' ج', 'الربح ÷ المباع', '📈', k.ppb >= 0 ? 'color-emerald' : 'color-rose')}
      ${statBox('العلف المستهلك', f(k.feedConsumedKg) + ' كجم', ((k.feedConsumedKg / bagKg).toFixed(1)) + ' شكارة أكلتها الطيور', '🌾')}
      ${statBox('معامل التحويل (FCR)', k.fcr ? k.fcr.toFixed(2) : '-', 'العلف المستهلك ÷ وزن البيع', '⚖️', k.fcr && k.fcr <= 1.6 ? 'color-emerald' : 'color-amber')}
    </div>

    <!-- Navigation Tabs -->
    <div class="tabs-container">
      ${tabs.map(t => `
        <button class="tab-pill ${S.tab === t[0] ? 'active' : ''}" onclick="S.tab='${t[0]}'; render()">
          ${t[1]}
        </button>
      `).join('')}
    </div>
  `;

  // Render Content based on Active Tab
  if (S.tab === 'ch') {
    // Analytics & Reporting Tab
    h += renderAnalyticsTab(c, k);
  } else if (S.tab === 'inc') {
    // Sales & Collection Tab
    h += renderSalesTab(c, k);
  } else if (S.tab === 'feed') {
    // Feed & Stock Tab
    h += renderFeedTab(c, k);
  } else if (S.tab === 'debt') {
    // Debt & Payment Tracking Tab
    h += renderDebtTab(c, k);
  } else {
    // Default Expenses or Mortality Tab
    h += renderGenericTab(c, k);
  }

  if (!c.end) {
    h += `
      <div style="margin-top: 24px;">
        <button class="btn btn-outline btn-full btn-danger" onclick="closeC()">
          قفل هذه الدورة رسمياً (انتهاء البيع)
        </button>
      </div>
    `;
  }

  a.innerHTML = h;
}

// --------------------------------------------------------------------------
// Tab Renderers
// --------------------------------------------------------------------------

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
      <div class="tab-summary-card">
        <span class="tab-summary-label">معامل التحويل (FCR)</span>
        <span class="tab-summary-val ${k.fcr && k.fcr <= 1.6 ? 'color-emerald' : 'color-amber'}">${k.fcr ? k.fcr.toFixed(2) : '-'}</span>
        <span class="tab-summary-sub">المستهلك ÷ وزن المباع</span>
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
function openFeedForm(type) {
  S.tab = 'feed';
  openForm('feed', null, type);
}

function togglePaymentsHistory(id) {
  S.openPayments[id] = !S.openPayments[id];
  render();
}

function render() {
  const a = document.getElementById('app');
  if (S.v === 'list') {
    list(a);
  } else {
    detail(a);
  }
}

// ==========================================================================
// 3. FORM VALIDATION & MODAL MANAGEMENT (Zero Confusion, Solid Safeguards)
// ==========================================================================
const m = document.getElementById('m');
const fm = document.getElementById('fm');

// Validation function returning detailed error message or null if valid
function validateTransaction(kind, data, isEdit, editIndex, cycle) {
  const k = calc(cycle);

  if (kind === 'inc') {
    // 1. Bird Count Validation
    if (!data.cnt || isNaN(data.cnt) || +data.cnt <= 0) {
      return { valid: false, field: 'f_cnt', message: 'يرجى إدخال عدد صحيح للطيور المباعة أكبر من الصفر.' };
    }
    const availBirds = k.remaining + (isEdit && cycle.inc[editIndex] ? (+cycle.inc[editIndex].cnt || 0) : 0);
    if (+data.cnt > availBirds) {
      return {
        valid: false,
        field: 'f_cnt',
        message: `عفواً، عدد الطيور المباعة (${data.cnt}) أكبر من الطيور الحية المتاحة حالياً بالمزرعة (${availBirds} طائر).`
      };
    }

    // 2. Total Amount Validation
    if (!data.amt || isNaN(data.amt) || +data.amt <= 0) {
      return { valid: false, field: 'f_amt', message: 'يرجى إدخال إجمالي قيمة البيع بمبلغ صحيح أكبر من الصفر.' };
    }

    // 3. Collected Amount Validation
    if (data.paidAmt !== undefined && data.paidAmt !== '') {
      if (isNaN(data.paidAmt) || +data.paidAmt < 0) {
        return { valid: false, field: 'f_paidAmt', message: 'المبلغ المحصل نقداً لا يمكن أن يكون سالباً.' };
      }
      if (+data.paidAmt > +data.amt) {
        return {
          valid: false,
          field: 'f_paidAmt',
          message: `المبلغ المحصل (${f(+data.paidAmt)} ج) لا يمكن أن يتجاوز إجمالي قيمة البيع (${f(+data.amt)} ج).`
        };
      }
    }

    // 4. Weight Validation
    if (data.kg !== '' && data.kg !== undefined) {
      if (isNaN(data.kg) || +data.kg <= 0) {
        return { valid: false, field: 'f_kg', message: 'الوزن الإجمالي يجب أن يكون رقماً أكبر من الصفر.' };
      }
    }

    // 5. Buyer Name for Partial/Deferred Sales
    const remaining = +data.amt - (+data.paidAmt || 0);
    if (remaining > 0 && (!data.buyer || !data.buyer.trim())) {
      return {
        valid: false,
        field: 'f_buyer',
        message: 'يوجد متبقي آجل؛ يرجى كتابة اسم المشتري / التاجر لربط هذا المتبقي بحسابه في الديون تلقائياً.'
      };
    }
  }

  if (kind === 'dead') {
    if (!data.n || isNaN(data.n) || +data.n <= 0) {
      return { valid: false, field: 'f_n', message: 'يرجى إدخال عدد طيور نافقة صحيح أكبر من الصفر.' };
    }
    const availLive = k.remaining + (isEdit && cycle.dead[editIndex] ? (+cycle.dead[editIndex].n || 0) : 0);
    if (+data.n > availLive) {
      return {
        valid: false,
        field: 'f_n',
        message: `عفواً، عدد النافق (${data.n}) أكبر من الطيور الحية المتبقية بالمزرعة (${availLive} طائر).`
      };
    }
  }

  if (kind === 'exp') {
    if (!data.amt || isNaN(data.amt) || +data.amt <= 0) {
      return { valid: false, field: 'f_amt', message: 'يرجى إدخال مبلغ المصروف بشكل صحيح (أكبر من الصفر).' };
    }
  }

  if (kind === 'feed') {
    if (!data.q || isNaN(data.q) || +data.q <= 0) {
      return { valid: false, field: 'f_q', message: 'يرجى إدخال كمية العلف برقم صحيح أكبر من الصفر.' };
    }
  }

  if (kind === 'debt') {
    if (!data.who || !data.who.trim()) {
      return { valid: false, field: 'f_who', message: 'يرجى كتابة اسم الطرف الآخر (التاجر أو المورد).' };
    }
    if (!data.amt || isNaN(data.amt) || +data.amt <= 0) {
      return { valid: false, field: 'f_amt', message: 'يرجى إدخال مبلغ المديونية بشكل صحيح (أكبر من الصفر).' };
    }
    if (data.paidAmt !== '' && data.paidAmt !== undefined) {
      if (isNaN(data.paidAmt) || +data.paidAmt < 0) {
        return { valid: false, field: 'f_paidAmt', message: 'المبلغ المسدد لا يمكن أن يكون سالباً.' };
      }
      if (+data.paidAmt > +data.amt) {
        return { valid: false, field: 'f_paidAmt', message: 'المبلغ المسدد لا يمكن أن يتجاوز أصل المديونية.' };
      }
    }
  }

  return { valid: true };
}

// Display Form Modal with Rich Context and Guidance
function openForm(kind, editIndex = null, prefillType = null) {
  const T = K[kind];
  const isEdit = editIndex !== null;
  const cycle = cur();
  const existing = isEdit ? cycle[kind][editIndex] : null;
  const k = calc(cycle);

  let h = `
    <div class="form-header">
      <div class="form-title">${isEdit ? 'تعديل' : 'إضافة'} ${T.t}</div>
      <button type="button" class="btn btn-sm btn-outline" onclick="closeM()">✕</button>
    </div>

    <!-- Dynamic Error Alert Placeholder -->
    <div id="form_error_container"></div>
  `;

  // Context-aware helpful guidance banners
  if (kind === 'inc') {
    const avail = k.remaining + (isEdit && existing ? (+existing.cnt || 0) : 0);
    h += `
      <div class="form-hint-banner emerald">
        <span>🐔</span>
        <span>الطيور الحية المتاحة للبيع حالياً: <b>${f(avail)} طائر</b></span>
      </div>
    `;
  } else if (kind === 'dead') {
    const avail = k.remaining + (isEdit && existing ? (+existing.n || 0) : 0);
    h += `
      <div class="form-hint-banner amber">
        <span>⚠️</span>
        <span>الطيور الحية المتبقية بالدورة: <b>${f(avail)} طائر</b></span>
      </div>
    `;
  } else if (kind === 'feed') {
    h += `
      <div class="form-hint-banner">
        <span>🏬</span>
        <span>رصيد العلف بالمخزن حالياً: <b>${f(k.feedStockKg)} كجم</b> (${(k.feedStockKg / bagKg).toFixed(1)} شكارة)</span>
      </div>
    `;
  }

  // Date Field (Always First)
  h += `
    <label>التاريخ</label>
    <input type="date" id="f_d" value="${isEdit && existing && existing.d ? existing.d : today()}">
  `;

  // Render fields according to kind
  if (kind === 'inc') {
    // Specialized Sales Form with Cash Collection & Debt Separation
    const cntVal = isEdit && existing ? existing.cnt : '';
    const kgVal = isEdit && existing ? (existing.kg || '') : '';
    const amtVal = isEdit && existing ? existing.amt : '';
    const paidVal = isEdit && existing ? (existing.paidAmt !== undefined ? existing.paidAmt : existing.amt) : '';
    const buyerVal = isEdit && existing ? (existing.buyer || '') : '';

    h += `
      <label>عدد الطيور المباعة *</label>
      <input id="f_cnt" type="number" inputmode="numeric" value="${cntVal}" placeholder="مثلاً: 250" oninput="updateSaleCalculations()">

      <label>الوزن الإجمالي للطيور (كجم) (اختياري)</label>
      <input id="f_kg" type="number" inputmode="decimal" step="any" value="${kgVal}" placeholder="مثلاً: 520" oninput="updateSaleCalculations()">

      <label>إجمالي قيمة البيع (جنيه) *</label>
      <input id="f_amt" type="number" inputmode="decimal" step="any" value="${amtVal}" placeholder="مثلاً: 24000" oninput="updateSaleCalculations()">

      <label>المبلغ المحصل نقداً الآن (كاش) *</label>
      <input id="f_paidAmt" type="number" inputmode="decimal" step="any" value="${paidVal}" placeholder="المبلغ المستلم كاش بالفعل" oninput="updateSaleCalculations()">
      
      <div class="quick-fill-row">
        <button type="button" class="quick-fill-btn" onclick="fillFullCash()">
          💵 تم تحصيل كامل المبلغ كاش (بدون آجل)
        </button>
      </div>

      <!-- Live Dynamic Sale Status Banner -->
      <div id="sale_status_box" style="margin-bottom: 14px;"></div>

      <label>اسم المشتري / التاجر (مطلوب إذا كان هناك متبقي آجل)</label>
      <input id="f_buyer" type="text" value="${buyerVal}" placeholder="مثال: تاجر الأحد، محل البركة...">
    `;
  } else if (kind === 'feed') {
    // Specialized Feed Form separating Purchased vs Consumed
    const defaultType = prefillType || (isEdit && existing ? existing.type : 'consumed');
    const unitVal = isEdit && existing ? (existing.unit || 'شكارة') : 'شكارة';
    const qVal = isEdit && existing ? (existing.q !== undefined ? existing.q : (existing.kg / bagKg)) : '';
    const noteVal = isEdit && existing ? (existing.note || '') : '';

    h += `
      <label>نوع حركة العلف *</label>
      <select id="f_type" onchange="updateFeedHint()">
        <option value="consumed" ${defaultType === 'consumed' ? 'selected' : ''}>🌾 علف مستهلك للطيور (أكلته الطيور - يدخل في معامل التحويل FCR)</option>
        <option value="purchased" ${defaultType === 'purchased' ? 'selected' : ''}>📦 علف مشترى / وارد للمخزن (استلام وتوريد للمزرعة)</option>
      </select>

      <label>الوحدة</label>
      <select id="f_unit" onchange="updateFeedHint()">
        <option value="شكارة" ${unitVal === 'شكارة' ? 'selected' : ''}>شكارة (${bagKg} كجم)</option>
        <option value="كيلو" ${unitVal === 'كيلو' ? 'selected' : ''}>كيلوجرام (كجم)</option>
      </select>

      <label>الكمية *</label>
      <input id="f_q" type="number" inputmode="decimal" step="any" value="${qVal}" placeholder="الكمية بالشكارة أو الكيلو" oninput="updateFeedHint()">

      <div id="feed_hint_box" style="margin-bottom: 12px; font-size: 13px; font-weight: 700; color: var(--text-muted);"></div>

      <label>نوع العلف أو بيان (اختياري)</label>
      <input id="f_note" type="text" value="${noteVal}" placeholder="مثال: بادي 23%، نامي 21%، ناهي 19%...">
    `;
  } else if (kind === 'debt') {
    // Specialized Debt Form with simplified direction
    const dirVal = isEdit && existing ? existing.dir : 'لنا';
    const whoVal = isEdit && existing ? existing.who : '';
    const amtVal = isEdit && existing ? existing.amt : '';
    const paidVal = isEdit && existing ? (existing.paidAmt || '') : '';
    const noteVal = isEdit && existing ? (existing.note || '') : '';

    h += `
      <label>نوع المديونية *</label>
      <select id="f_dir">
        <option value="لنا" ${dirVal === 'لنا' ? 'selected' : ''}>🟢 مستحق لنا عند الغير (دين لنا على تاجر أو مشتري)</option>
        <option value="علينا" ${dirVal === 'علينا' ? 'selected' : ''}>🔴 مستحق علينا للغير (دين علينا لمورد علف أو كتاكيت)</option>
      </select>

      <label>اسم الطرف الآخر (التاجر أو المورد) *</label>
      <input id="f_who" type="text" value="${whoVal}" placeholder="مثال: أبو علي التاجر، شركة الأعلاف...">

      <label>المبلغ الإجمالي للمديونية (جنيه) *</label>
      <input id="f_amt" type="number" inputmode="decimal" step="any" value="${amtVal}" placeholder="المبلغ الأصلي">

      <label>ما تم سداده مقدماً إن وجد (جنيه)</label>
      <input id="f_paidAmt" type="number" inputmode="decimal" step="any" value="${paidVal}" placeholder="المبلغ المسدد حتى الآن (إن وجد)">

      <label>بيان المديونية أو ملاحظة (اختياري)</label>
      <input id="f_note" type="text" value="${noteVal}" placeholder="مثلاً: باقي دفعة بيع، حساب توريد كتاكيت...">
    `;
  } else {
    // Standard Expense or Dead Bird Form
    T.f.forEach(x => {
      h += `<label>${x[3]}</label>`;
      let val = isEdit && existing && existing[x[0]] !== undefined ? existing[x[0]] : '';

      if (x[1] === 'select') {
        h += `
          <select id="f_${x[0]}">
            ${x[2].map(o => `<option value="${o}" ${String(val) === String(o) ? 'selected' : ''}>${o}</option>`).join('')}
          </select>
        `;
      } else {
        h += `
          <input id="f_${x[0]}" type="${x[1]}" value="${val !== undefined ? val : ''}" ${x[1] === 'number' ? 'inputmode="decimal" step="any"' : ''} placeholder="${x[3]}">
        `;
      }
    });
  }

  h += `
    <div class="form-actions-row">
      <button class="btn btn-primary" style="flex: 2;" type="submit">${isEdit ? 'حفظ التعديلات' : 'حفظ البيانات'}</button>
      <button class="btn btn-outline" style="flex: 1;" type="button" onclick="closeM()">إلغاء</button>
    </div>
  `;

  fm.innerHTML = h;

  // Trigger live calculation hints
  if (kind === 'inc') updateSaleCalculations();
  if (kind === 'feed') updateFeedHint();

  // Form Submit Handler with Solid Validation
  fm.onsubmit = ev => {
    ev.preventDefault();
    clearFormErrors();

    const dVal = document.getElementById('f_d').value || today();
    let dataObj = { d: dVal };

    if (kind === 'inc') {
      dataObj.cnt = document.getElementById('f_cnt').value.trim();
      dataObj.kg = document.getElementById('f_kg').value.trim();
      dataObj.amt = document.getElementById('f_amt').value.trim();
      dataObj.paidAmt = document.getElementById('f_paidAmt').value.trim();
      dataObj.buyer = document.getElementById('f_buyer').value.trim();
    } else if (kind === 'feed') {
      dataObj.type = document.getElementById('f_type').value;
      dataObj.unit = document.getElementById('f_unit').value;
      dataObj.q = document.getElementById('f_q').value.trim();
      dataObj.note = document.getElementById('f_note').value.trim();
    } else if (kind === 'debt') {
      dataObj.dir = document.getElementById('f_dir').value;
      dataObj.who = document.getElementById('f_who').value.trim();
      dataObj.amt = document.getElementById('f_amt').value.trim();
      dataObj.paidAmt = document.getElementById('f_paidAmt').value.trim();
      dataObj.note = document.getElementById('f_note').value.trim();
    } else {
      T.f.forEach(x => {
        dataObj[x[0]] = document.getElementById('f_' + x[0]).value.trim();
      });
    }

    // Run strict validation
    const valRes = validateTransaction(kind, dataObj, isEdit, editIndex, cycle);
    if (!valRes.valid) {
      showFormError(valRes.message, valRes.field);
      return;
    }

    // Construct final record
    const o = isEdit ? { ...existing } : { id: Date.now() + Math.floor(Math.random() * 1000) };
    o.d = dataObj.d;

    if (kind === 'inc') {
      o.cnt = +dataObj.cnt;
      o.kg = dataObj.kg !== '' ? +dataObj.kg : 0;
      o.amt = +dataObj.amt; // Total Sale Value
      o.paidAmt = dataObj.paidAmt !== '' ? +dataObj.paidAmt : o.amt;
      o.buyer = dataObj.buyer;

      const remainingSaleAmt = Math.max(0, o.amt - o.paidAmt);

      // Auto-link remaining debt to buyer in Debt section
      if (remainingSaleAmt > 0) {
        let linkedDebt = null;
        if (isEdit && o.debtRefId) {
          linkedDebt = cycle.debt.find(d => d.id === o.debtRefId);
        }
        if (!linkedDebt && o.id) {
          linkedDebt = cycle.debt.find(d => d.saleId === o.id);
        }

        if (linkedDebt) {
          linkedDebt.who = o.buyer || 'مشتري آجل';
          linkedDebt.amt = remainingSaleAmt;
          linkedDebt.paid = (linkedDebt.paidAmt || 0) >= remainingSaleAmt;
          linkedDebt.d = o.d;
          linkedDebt.note = `باقي بيع ${o.cnt} طائر بتاريخ ${o.d}`;
        } else {
          const newDebtId = Date.now() + Math.floor(Math.random() * 1000);
          const newDebt = {
            id: newDebtId,
            d: o.d,
            dir: 'لنا',
            who: o.buyer || 'مشتري آجل',
            amt: remainingSaleAmt,
            paidAmt: 0,
            paid: false,
            note: `باقي بيع ${o.cnt} طائر بتاريخ ${o.d}`,
            saleId: o.id,
            payments: []
          };
          cycle.debt.push(newDebt);
          o.debtRefId = newDebtId;
        }
      } else if (remainingSaleAmt === 0 && (o.debtRefId || o.id)) {
        // If sale was edited and fully settled, update or mark linked debt as paid
        const linkedDebt = cycle.debt.find(d => d.id === o.debtRefId || d.saleId === o.id);
        if (linkedDebt) {
          linkedDebt.paidAmt = linkedDebt.amt;
          linkedDebt.paid = true;
        }
      }
    } else if (kind === 'feed') {
      o.type = dataObj.type;
      o.unit = dataObj.unit;
      o.q = +dataObj.q;
      o.note = dataObj.note;
      o.kg = o.unit === 'شكارة' ? o.q * bagKg : o.q;
      o.txt = o.q + ' ' + o.unit + (o.note ? ' (' + o.note + ')' : '');
    } else if (kind === 'debt') {
      o.dir = dataObj.dir;
      o.who = dataObj.who;
      o.amt = +dataObj.amt;
      o.paidAmt = dataObj.paidAmt !== '' ? +dataObj.paidAmt : (isEdit ? (existing.paidAmt || 0) : 0);
      o.paid = o.paidAmt >= o.amt;
      o.note = dataObj.note;
      o.payments = isEdit && existing.payments ? existing.payments : [];
    } else if (kind === 'dead') {
      o.n = +dataObj.n;
      o.note = dataObj.note;
    } else if (kind === 'exp') {
      o.cat = dataObj.cat;
      o.amt = +dataObj.amt;
      o.note = dataObj.note;
    }

    if (isEdit) {
      cycle[kind][editIndex] = o;
      showToast(`تم تعديل ${T.t} بنجاح ✓`);
    } else {
      cycle[kind].push(o);
      showToast(`تمت إضافة ${T.t} بنجاح ✓`);
    }

    saveData();
    closeM();
    render();
  };

  m.classList.add('on');
}

// Helper: Fill full cash amount in sales form
function fillFullCash() {
  const amtEl = document.getElementById('f_amt');
  const paidEl = document.getElementById('f_paidAmt');
  if (amtEl && paidEl) {
    paidEl.value = amtEl.value;
    updateSaleCalculations();
  }
}

// Live calculation updater for sales form
function updateSaleCalculations() {
  const box = document.getElementById('sale_status_box');
  if (!box) return;

  const cnt = +document.getElementById('f_cnt').value || 0;
  const kg = +document.getElementById('f_kg').value || 0;
  const amt = +document.getElementById('f_amt').value || 0;
  const paidVal = document.getElementById('f_paidAmt').value;
  const paid = paidVal !== '' ? +paidVal : amt;

  let details = [];
  if (cnt > 0 && kg > 0) {
    details.push(`متوسط وزن الطائر: <b>${(kg / cnt).toFixed(2)} كجم</b>`);
  }
  if (kg > 0 && amt > 0) {
    details.push(`سعر الكيلو التقديري: <b>${(amt / kg).toFixed(1)} ج</b>`);
  }

  let statusHtml = '';
  if (amt > 0) {
    if (paid >= amt) {
      statusHtml = `<div class="form-hint-banner emerald" style="margin: 6px 0;">✓ تم التحصيل بالكامل كاش (لا توجد مديونية).</div>`;
    } else if (paid < amt && paid >= 0) {
      const rem = amt - paid;
      statusHtml = `
        <div class="form-hint-banner amber" style="margin: 6px 0;">
          <span>⏳ المتبقي كمديونية آجل: <b>${f(rem)} ج</b> (سيتم تسجيلها تلقائياً على المشتري في قسم الديون).</span>
        </div>
      `;
    } else {
      statusHtml = `<div class="form-hint-banner" style="margin: 6px 0; color:var(--rose); background:rgba(244,63,94,0.12); border-color:var(--rose);">⚠️ المبلغ المحصل لا يمكن أن يتجاوز إجمالي البيع.</div>`;
    }
  }

  box.innerHTML = `
    ${details.length ? `<div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">${details.join(' • ')}</div>` : ''}
    ${statusHtml}
  `;
}

// Live helper text for feed form
function updateFeedHint() {
  const hintEl = document.getElementById('feed_hint_box');
  if (!hintEl) return;
  const unit = document.getElementById('f_unit').value;
  const q = +document.getElementById('f_q').value || 0;
  const totalKg = unit === 'شكارة' ? q * bagKg : q;
  const totalBags = (totalKg / bagKg).toFixed(1);

  if (q > 0) {
    hintEl.textContent = `الكمية الإجمالية تعادل: ${f(totalKg)} كجم (${totalBags} شكارة على وزن ${bagKg} كجم/شكارة)`;
  } else {
    hintEl.textContent = '';
  }
}

// Helper: Show formatted validation alert in modal
function showFormError(msg, fieldId) {
  const container = document.getElementById('form_error_container');
  if (container) {
    container.innerHTML = `
      <div class="form-error-alert">
        <span style="font-size: 18px;">⚠️</span>
        <span>${msg}</span>
      </div>
    `;
  }
  if (fieldId) {
    const el = document.getElementById(fieldId);
    if (el) {
      el.classList.add('input-error');
      el.focus();
    }
  }
}

// Helper: Clear form error states
function clearFormErrors() {
  const container = document.getElementById('form_error_container');
  if (container) container.innerHTML = '';
  const inputs = fm.querySelectorAll('.input-error');
  inputs.forEach(el => el.classList.remove('input-error'));
}

// ==========================================================================
// 4. DEBT PARTIAL / FULL PAYMENT MODAL
// ==========================================================================
function openPaymentModal(debtIndex) {
  const cycle = cur();
  if (!cycle || !cycle.debt || !cycle.debt[debtIndex]) return;
  const d = cycle.debt[debtIndex];

  const total = +d.amt || 0;
  const paid = +d.paidAmt || (d.paid ? total : 0);
  const remaining = Math.max(0, total - paid);
  const isUs = d.dir === 'لنا';

  fm.innerHTML = `
    <div class="form-header">
      <div class="form-title">تسجيل سداد دين 💵</div>
      <button type="button" class="btn btn-sm btn-outline" onclick="closeM()">✕</button>
    </div>

    <div id="form_error_container"></div>

    <div class="card" style="margin-bottom: 16px; padding: 14px; background: rgba(0,0,0,0.2);">
      <div style="font-size: 15px; font-weight: 800; color: var(--text-title); margin-bottom: 4px;">
        الطرف: ${d.who}
      </div>
      <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">
        ${isUs ? '🟢 مستحق لنا عنده (دين لنا)' : '🔴 مستحق علينا له (دين علينا)'}
      </div>
      <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--border-subtle); padding-top: 8px;">
        <span>إجمالي الدين: <b>${f(total)} ج</b></span>
        <span>المسدد سابقاً: <b style="color:var(--emerald);">${f(paid)} ج</b></span>
        <span>المتبقي المطلوب: <b style="color:var(--amber); font-size:16px;">${f(remaining)} ج</b></span>
      </div>
    </div>

    <label>تاريخ السداد</label>
    <input type="date" id="p_d" value="${today()}">

    <label>المبلغ المسدد الآن (جنيه) *</label>
    <input type="number" id="p_amt" inputmode="decimal" step="any" placeholder="المبلغ المدفوع بالجنيه">

    <div class="quick-fill-row">
      <button type="button" class="quick-fill-btn" onclick="document.getElementById('p_amt').value = ${remaining};">
        ⚡ سداد كامل المبلغ المتبقي (${f(remaining)} ج)
      </button>
    </div>

    <label>طريقة الدفع أو بيان (اختياري)</label>
    <input type="text" id="p_note" placeholder="مثال: نقداً كاش، فودافون كاش، تحويل بنكي...">

    <div class="form-actions-row">
      <button class="btn btn-primary" style="flex: 2;" type="submit">تسجيل السداد والحفظ</button>
      <button class="btn btn-outline" style="flex: 1;" type="button" onclick="closeM()">إلغاء</button>
    </div>
  `;

  fm.onsubmit = ev => {
    ev.preventDefault();
    clearFormErrors();

    const pAmtVal = document.getElementById('p_amt').value.trim();
    const pDVal = document.getElementById('p_d').value || today();
    const pNoteVal = document.getElementById('p_note').value.trim();

    if (!pAmtVal || isNaN(pAmtVal) || +pAmtVal <= 0) {
      showFormError('يرجى إدخال مبلغ سداد صحيح أكبر من الصفر.', 'p_amt');
      return;
    }

    const paymentAmt = +pAmtVal;
    if (paymentAmt > remaining) {
      showFormError(`عفواً، مبلغ السداد (${f(paymentAmt)} ج) أكبر من المبلغ المتبقي المطلوب (${f(remaining)} ج).`, 'p_amt');
      return;
    }

    // Record payment
    d.payments = d.payments || [];
    d.payments.push({
      id: Date.now() + Math.floor(Math.random() * 1000),
      d: pDVal,
      amt: paymentAmt,
      note: pNoteVal
    });

    d.paidAmt = (d.paidAmt || 0) + paymentAmt;
    d.paid = d.paidAmt >= d.amt;

    saveData();
    closeM();
    showToast(`تم تسجيل سداد مبلغ ${f(paymentAmt)} ج بنجاح ✓`);
    render();
  };

  m.classList.add('on');
}

// Delete an individual payment record from debt history
function deletePayment(debtIndex, paymentIndex) {
  const cycle = cur();
  if (!cycle || !cycle.debt || !cycle.debt[debtIndex]) return;
  const d = cycle.debt[debtIndex];
  const payment = d.payments[paymentIndex];

  if (confirm(`هل تريد إلغاء هذه الدفعة المسددة بقيمة (${f(payment.amt)} ج)؟ سيتم استرجاع المبلغ للمديونية المتبقية.`)) {
    d.paidAmt = Math.max(0, (d.paidAmt || 0) - payment.amt);
    d.paid = d.paidAmt >= d.amt;
    d.payments.splice(paymentIndex, 1);

    saveData();
    showToast('تم إلغاء الدفعة واسترجاع الرصيد');
    render();
  }
}

// Delete sale with automatic handling of linked debt
function delSale(i) {
  const cycle = cur();
  const sale = cycle.inc[i];
  if (confirm('هل أنت متأكد من حذف حركة البيع هذه؟')) {
    // If there is an associated buyer debt that was generated automatically, delete it as well
    if (sale.debtRefId || sale.id) {
      const debtIdx = cycle.debt.findIndex(d => d.id === sale.debtRefId || d.saleId === sale.id);
      if (debtIdx !== -1) {
        cycle.debt.splice(debtIdx, 1);
      }
    }
    cycle.inc.splice(i, 1);
    saveData();
    showToast('تم حذف حركة البيع وتحديث الأرصدة والديون');
    render();
  }
}

// Delete debt record
function delDebt(i) {
  if (confirm('هل أنت متأكد من حذف هذا السجل للمديونية نهائياً؟')) {
    cur().debt.splice(i, 1);
    saveData();
    showToast('تم حذف المديونية بنجاح');
    render();
  }
}

// ==========================================================================
// 5. CYCLE MANAGEMENT (Edit, Create, Delete, Close)
// ==========================================================================
function editCycle() {
  const c = cur();
  if (!c) return;

  fm.innerHTML = `
    <div class="form-header">
      <div class="form-title">تعديل بيانات الدورة ✏️</div>
      <button type="button" class="btn btn-sm btn-outline" onclick="closeM()">✕</button>
    </div>

    <div id="form_error_container"></div>

    <label>اسم الدورة *</label>
    <input id="edit_nn" value="${c.name || ''}" placeholder="اسم الدورة">

    <label>تاريخ البدء</label>
    <input type="date" id="edit_ns" value="${c.start || today()}">

    <label>عدد الكتاكيت الأصلي المستلم *</label>
    <input type="number" id="edit_nc" value="${c.n || 0}" inputmode="numeric" placeholder="مثلاً: 1000">

    <label>حالة الدورة</label>
    <select id="edit_status">
      <option value="ongoing" ${!c.end ? 'selected' : ''}>شغالة الآن (جارية)</option>
      <option value="closed" ${c.end ? 'selected' : ''}>مقفولة (مكتملة)</option>
    </select>

    <div class="form-actions-row">
      <button class="btn btn-primary" style="flex: 2;" type="submit">حفظ تعديلات الدورة</button>
      <button class="btn btn-outline" style="flex: 1;" type="button" onclick="closeM()">إلغاء</button>
    </div>

    <div style="margin-top: 20px; border-top: 1px solid var(--border-subtle); padding-top: 14px; text-align: center;">
      <button type="button" class="btn btn-sm btn-danger" onclick="deleteCycle(${c.id})">
        حذف هذه الدورة وكافة سجلاتها نهائياً 🗑️
      </button>
    </div>
  `;

  fm.onsubmit = ev => {
    ev.preventDefault();
    clearFormErrors();

    const nn = document.getElementById('edit_nn').value.trim();
    const ns = document.getElementById('edit_ns').value;
    const ncVal = document.getElementById('edit_nc').value.trim();
    const st = document.getElementById('edit_status').value;

    if (!nn) {
      showFormError('يرجى إدخال اسم الدورة.', 'edit_nn');
      return;
    }
    if (!ncVal || isNaN(ncVal) || +ncVal <= 0) {
      showFormError('يرجى إدخال عدد كتاكيت صحيح أكبر من الصفر.', 'edit_nc');
      return;
    }

    c.name = nn;
    c.start = ns || c.start;
    c.n = +ncVal;

    if (st === 'closed' && !c.end) {
      c.end = today();
    } else if (st === 'ongoing') {
      c.end = null;
    }

    saveData();
    closeM();
    showToast('تم حفظ تعديلات الدورة بنجاح ✓');
    render();
  };

  m.classList.add('on');
}

function deleteCycle(id) {
  if (confirm('تحذير: هل أنت متأكد تماماً من حذف هذه الدورة بالكامل وكافة مصروفاتها ومبيعاتها؟ لا يمكن التراجع عن هذا الإجراء.')) {
    const idx = C.findIndex(x => x.id === id);
    if (idx !== -1) {
      C.splice(idx, 1);
      saveData();
      closeM();
      S.v = 'list';
      showToast('تم حذف الدورة بنجاح');
      render();
    }
  }
}

function newCycle() {
  fm.innerHTML = `
    <div class="form-header">
      <div class="form-title">بدء دورة تسمين جديدة 🐣</div>
      <button type="button" class="btn btn-sm btn-outline" onclick="closeM()">✕</button>
    </div>

    <div id="form_error_container"></div>

    <label>اسم الدورة (مثال: دورة نوفمبر، دفعة رقم 3) *</label>
    <input id="nn" value="دورة جديدة" placeholder="اسم الدورة">

    <label>تاريخ استلام الكتاكيت (البداية)</label>
    <input type="date" id="ns" value="${today()}">

    <label>عدد الكتاكيت المستلمة *</label>
    <input type="number" id="nc" inputmode="numeric" placeholder="مثلاً: 1000">

    <div class="form-actions-row">
      <button class="btn btn-primary" style="flex: 2;" type="submit">إنشاء الدورة</button>
      <button class="btn btn-outline" style="flex: 1;" type="button" onclick="closeM()">إلغاء</button>
    </div>
  `;

  fm.onsubmit = ev => {
    ev.preventDefault();
    clearFormErrors();

    const nn = document.getElementById('nn').value.trim();
    const ns = document.getElementById('ns').value;
    const ncVal = document.getElementById('nc').value.trim();

    if (!nn) {
      showFormError('يرجى إدخال اسم الدورة.', 'nn');
      return;
    }
    if (!ncVal || isNaN(ncVal) || +ncVal <= 0) {
      showFormError('يرجى إدخال عدد كتاكيت صحيح أكبر من الصفر.', 'nc');
      return;
    }

    const newObj = {
      id: nid++,
      name: nn,
      start: ns || today(),
      end: null,
      n: +ncVal,
      exp: [],
      inc: [],
      dead: [],
      feed: [],
      debt: []
    };

    C.push(newObj);
    saveData();
    closeM();
    S.v = newObj.id;
    S.tab = 'exp';
    showToast('تم إنشاء الدورة الجديدة بنجاح 🐥');
    render();
  };

  m.classList.add('on');
}

function closeM() {
  m.classList.remove('on');
}

function del(i) {
  if (confirm('هل أنت متأكد من حذف هذا التسجيل نهائياً؟')) {
    cur()[S.tab].splice(i, 1);
    saveData();
    showToast('تم الحذف بنجاح');
    render();
  }
}

function closeC() {
  if (confirm('هل أنت متأكد من إغلاق هذه الدورة؟ (يمكنك دائماً مراجعة سجلاتها وأرباحها في أي وقت)')) {
    cur().end = today();
    saveData();
    showToast('تم إغلاق الدورة بنجاح');
    render();
  }
}

// ==========================================================================
// 6. LIVE REAL-TIME CLOCK & THEME SWITCHER
// ==========================================================================
function updateLiveClock() {
  const now = new Date();
  
  const dateFormatted = now.toLocaleDateString('ar-EG-u-nu-latn', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  const timeFormatted = now.toLocaleTimeString('ar-EG-u-nu-latn', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const dt = document.getElementById('dt');
  if (dt) {
    dt.textContent = `${dateFormatted} • ${timeFormatted}`;
  }

  const gr = document.getElementById('gr');
  if (gr) {
    const hours = now.getHours();
    const greetingText = hours < 12 ? 'صباح الخير والرزق' : 'مساء الخير والبركة';
    gr.innerHTML = `${greetingText} يا رفاعي <span class="chick-anim">🐥</span>`;
  }
}

updateLiveClock();
setInterval(updateLiveClock, 10000);

const thBtn = document.getElementById('th');
const thIcon = document.getElementById('th-icon');
const thText = document.getElementById('th-text');

function updateThemeUI(theme) {
  document.documentElement.dataset.theme = theme;
  if (theme === 'light') {
    if (thIcon) thIcon.textContent = '☾';
    if (thText) thText.textContent = 'داكن';
  } else {
    if (thIcon) thIcon.textContent = '☀︎';
    if (thText) thText.textContent = 'فاتح';
  }
}

const savedTheme = localStorage.getItem('refaey_theme') || 'dark';
updateThemeUI(savedTheme);

if (thBtn) {
  thBtn.onclick = () => {
    const current = document.documentElement.dataset.theme;
    const target = current === 'light' ? 'dark' : 'light';
    localStorage.setItem('refaey_theme', target);
    updateThemeUI(target);
  };
}

if (m) {
  m.onclick = e => {
    if (e.target === m) closeM();
  };
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeM();
});

// Run Initial Render
render();
