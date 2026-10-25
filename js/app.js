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
function statBox(label, val, hint, icon, colorCls = '', onclickAttr = '') {
  return `
    <div class="stat-box" ${onclickAttr ? `onclick="${onclickAttr}" style="cursor: pointer;" title="اضغط للتفاصيل والشرح"` : ''}>
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
        <button class="print-btn" onclick="downloadCyclePdf()" title="تنزيل كشف الدورة بصيغة PDF">
          <span>📄</span> <span>تنزيل PDF</span>
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
        <span>+ مصروف / علف</span>
      </button>
      <button class="quick-action-btn" onclick="quickAdd('inc')">
        <span class="quick-action-icon">📈</span>
        <span>+ بيع طيور</span>
      </button>
      <button class="quick-action-btn" onclick="quickAdd('dead')">
        <span class="quick-action-icon">⚠️</span>
        <span>+ نافق</span>
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

    <!-- Production Efficiency & Cost Grid with Interactive Explanations -->
    <div class="section-title" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
      <span>مؤشرات الكفاءة والتكلفة الحيوية</span>
      <button type="button" class="btn btn-sm btn-outline" onclick="showEfficiencyGuideModal('all')" style="font-size: 11px; padding: 4px 10px; border-color: var(--primary); color: var(--emerald); font-weight: 700;">
        💡 دليل فهم الأرقام للمربي
      </button>
    </div>
    <div class="stats-grid">
      ${statBox('تكلفة الطائر الحي', f(k.cpb) + ' ج', 'المصروف ÷ الحي • اضغط للشرح ℹ️', '💵', '', 'showEfficiencyGuideModal("cpb")')}
      ${statBox('ربح الطائر المباع', f(k.ppb) + ' ج', (k.ppb >= 0 ? 'صافي مكسب الفرخة' : 'صافي عجز الفرخة') + ' • اضغط للشرح ℹ️', '📈', k.ppb >= 0 ? 'color-emerald' : 'color-rose', 'showEfficiencyGuideModal("ppb")')}
      ${statBox('العلف المستهلك', f(k.feedConsumedKg) + ' كجم', ((k.feedConsumedKg / bagKg).toFixed(1)) + ' شكارة أكلتها الطيور • اضغط للشرح ℹ️', '🌾', '', 'showEfficiencyGuideModal("feed")')}
      ${(() => {
        const fcrVal = k.fcr ? k.fcr.toFixed(2) : null;
        let hint = 'العلف المستهلك ÷ وزن البيع • اضغط للشرح ℹ️';
        if (!fcrVal) {
          hint = 'بانتظار تسجيل أوزان البيع • اضغط للشرح ℹ️';
        } else if (isOngoing && k.remaining > 0) {
          hint = `⏳ دورة جارية (${fcrVal} كجم/كجم لحم) • اضغط للشرح ℹ️`;
        } else {
          if (k.fcr <= 1.55) hint = `🟢 ممتاز (${fcrVal} كجم علف/كجم لحم) • اضغط للشرح ℹ️`;
          else if (k.fcr <= 1.65) hint = `🟢 طبيعي ومربح (${fcrVal} كجم علف/كجم لحم) • اضغط للشرح ℹ️`;
          else if (k.fcr <= 1.80) hint = `🟠 متوسط وفيه هدر (${fcrVal} كجم علف/كجم لحم) • اضغط للشرح ℹ️`;
          else hint = `🔴 مرتفع وهدر علف (${fcrVal} كجم علف/كجم لحم) • اضغط للشرح ℹ️`;
        }
        return statBox('معامل التحويل (FCR)', fcrVal || '-', hint, '⚖️', k.fcr && k.fcr <= 1.6 ? 'color-emerald' : (isOngoing && k.remaining > 0 ? 'color-sky' : 'color-amber'), 'showFcrModal()');
      })()}
    </div>

    <!-- Quick Educational Explainer Banner Directly in UI -->
    <div class="card" style="padding: 14px 16px; margin: 10px 0 16px; background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: var(--radius-md);">
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <span style="font-size: 24px; flex-shrink: 0; line-height: 1;">💡</span>
        <div style="flex: 1; font-size: 13px; line-height: 1.5;">
          <div style="font-weight: 800; color: var(--emerald); font-size: 14px; margin-bottom: 3px;">
            يعني إيه «معامل التحويل الغذائي (FCR)» بالبلدي؟
          </div>
          <div style="color: var(--text-main);">
            هو المقياس الأهم لمكسب المزرعة: <b>«الفراخ أكلت كام كيلو علف عشان تديك 1 كيلو لحم؟»</b>
          </div>
          <div style="margin-top: 6px; font-size: 12px; color: var(--text-muted); display: flex; flex-wrap: wrap; gap: 12px;">
            <span>🎯 <b>المعدل المربح القياسي:</b> من 1.50 إلى 1.65 كجم علف/كيلو لحم.</span>
            <span>💰 <b>القاعدة الذهبية:</b> كل ما الرقم يقل... أرباحك تزيد!</span>
          </div>
          ${isOngoing && k.remaining > 0 && k.fcr ? `
            <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed var(--border-subtle); font-size: 11px; color: var(--amber);">
              ⏳ <b>تنبيه لدورتك الحالية:</b> ما زال عندك <b>${f(k.remaining)} طائر</b> في العنبر لم يُباعوا بعد. الرقم الحالي (${k.fcr.toFixed(2)}) سيعتدل تلقائياً ليصبح دقيقاً عند بيع باقي الفراخ.
            </div>
          ` : ''}
        </div>
        <button type="button" class="btn btn-sm btn-outline" onclick="showFcrModal()" style="flex-shrink: 0; font-size: 11px; padding: 6px 12px; align-self: center;">
          شرح كامل ℹ️
        </button>
      </div>
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

  if (kind === 'exp' || kind === 'feed') {
    if (data.cat === 'علف') {
      if (data.feed_mode === 'purchased') {
        if (!data.amt || isNaN(data.amt) || +data.amt <= 0) {
          return { valid: false, field: 'f_amt', message: 'يرجى إدخال المبلغ المدفوع لشراء العلف بشكل صحيح (أكبر من الصفر).' };
        }
        if (!data.feed_q || isNaN(data.feed_q) || +data.feed_q <= 0) {
          return { valid: false, field: 'f_feed_q', message: 'يرجى إدخال كمية العلف المشتراة برقم صحيح أكبر من الصفر.' };
        }
      } else {
        // Consumed feed (وجبة أكلتها الطيور)
        if (!data.feed_q || isNaN(data.feed_q) || +data.feed_q <= 0) {
          return { valid: false, field: 'f_feed_q', message: 'يرجى إدخال كمية العلف التي أكلتها الطيور اليوم برقم صحيح أكبر من الصفر.' };
        }
      }
    } else {
      if (!data.amt || isNaN(data.amt) || +data.amt <= 0) {
        return { valid: false, field: 'f_amt', message: 'يرجى إدخال مبلغ المصروف بشكل صحيح (أكبر من الصفر).' };
      }
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
function openForm(kind, editIndex = null, prefillData = null) {
  const isEdit = editIndex !== null;
  const cycle = cur();
  const k = calc(cycle);

  const isFeedKind = kind === 'feed';
  const isExpKind = kind === 'exp';
  const isUnified = isFeedKind || isExpKind;

  let existing = null;
  let linkedRef = null;

  if (isEdit) {
    if (isFeedKind) {
      existing = cycle.feed[editIndex];
      linkedRef = existing && existing.expRefId ? cycle.exp.find(x => x.id === existing.expRefId) : (existing ? cycle.exp.find(x => x.feedRefId === existing.id) : null);
    } else {
      existing = cycle[kind] ? cycle[kind][editIndex] : null;
      if (isExpKind && existing && (existing.cat === 'علف' || existing.feedRefId)) {
        linkedRef = existing.feedRefId ? cycle.feed.find(f => f.id === existing.feedRefId) : cycle.feed.find(f => f.expRefId === existing.id);
      }
    }
  }

  let titleText = '';
  if (isUnified) {
    titleText = isEdit ? 'تعديل المصروف أو العلف' : 'تسجيل مصروف أو حركة علف';
  } else {
    titleText = (isEdit ? 'تعديل ' : 'تسجيل ') + (K[kind] ? K[kind].t : '');
  }

  let h = `
    <div class="form-header">
      <div class="form-title">${titleText}</div>
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
  } else if (isUnified) {
    h += `
      <div class="form-hint-banner">
        <span>🏬</span>
        <span>رصيد العلف بالمخزن حالياً: <b>${f(k.feedStockKg)} كجم</b> (${(k.feedStockKg / bagKg).toFixed(1)} شكارة)</span>
      </div>
    `;
  }

  // Date Field (Always First, with live Egyptian time indication)
  const dateVal = isEdit && existing && existing.d ? existing.d : today();
  h += `
    <div style="display: flex; justify-content: space-between; align-items: center; margin: 14px 0 6px;">
      <label style="margin: 0;">التاريخ *</label>
      <span style="font-size: 11px; color: var(--emerald); font-weight: 700;">🇪🇬 توقيت مصر الفعلي</span>
    </div>
    <input type="date" id="f_d" value="${dateVal}" onchange="updateDateDisplay(this.value)">
    <div id="f_d_display" style="font-size: 11px; color: var(--text-muted); margin: 3px 0 10px; font-weight: 600;">
      ${fd(dateVal)}
    </div>
  `;

  if (isUnified) {
    let catVal = 'علف';
    let feedMode = 'purchased';

    if (isEdit) {
      if (isFeedKind) {
        catVal = 'علف';
        feedMode = existing ? (existing.type || 'consumed') : 'consumed';
      } else if (existing) {
        catVal = existing.cat || 'علف';
        feedMode = (existing.cat === 'علف') ? 'purchased' : 'purchased';
      }
    } else if (prefillData) {
      if (typeof prefillData === 'string') {
        catVal = 'علف';
        feedMode = prefillData;
      } else {
        catVal = prefillData.cat || 'علف';
        feedMode = prefillData.mode || 'purchased';
      }
    }

    const amtVal = isEdit ? (existing && existing.amt !== undefined ? existing.amt : (linkedRef ? linkedRef.amt : '')) : '';
    const feedUnitVal = (linkedRef && linkedRef.unit) || (existing && existing.unit) || 'شكارة';
    const feedQVal = isEdit ? ((linkedRef && linkedRef.q !== undefined) ? linkedRef.q : (existing && existing.q !== undefined ? existing.q : '')) : '';
    const feedNoteVal = (linkedRef && (linkedRef.note || linkedRef.txt)) || (existing && (existing.note || existing.txt)) || '';
    const stdNoteVal = isEdit && existing ? (existing.note || '') : '';

    h += `
      <label>تصنيف المصروف أو المعاملة *</label>
      <select id="f_cat" onchange="onExpenseCatChange()">
        <option value="علف" ${catVal === 'علف' ? 'selected' : ''}>🌾 علف (شراء للمخزن أو وجبة أكلتها الطيور)</option>
        <option value="كتاكيت" ${catVal === 'كتاكيت' ? 'selected' : ''}>🐣 كتاكيت (شراء دفعة كتاكيت)</option>
        <option value="أدوية وتحصينات" ${catVal === 'أدوية وتحصينات' ? 'selected' : ''}>💊 أدوية وتحصينات وبيطري</option>
        <option value="كهرباء وغاز" ${catVal === 'كهرباء وغاز' ? 'selected' : ''}>⚡ كهرباء وغاز وتدفئة ومياه</option>
        <option value="نشارة وفرشة" ${catVal === 'نشارة وفرشة' ? 'selected' : ''}>🪵 نشارة وفرشة تبن</option>
        <option value="عمالة" ${catVal === 'عمالة' ? 'selected' : ''}>👷 عمالة وإشراف</option>
        <option value="نقل" ${catVal === 'نقل' ? 'selected' : ''}>🚚 نقل ومشال</option>
        <option value="أخرى" ${catVal === 'أخرى' ? 'selected' : ''}>📦 مصاريف ونثريات أخرى</option>
      </select>

      <!-- Feed Specialization Section -->
      <div id="feed_sub_section" style="display: ${catVal === 'علف' ? 'block' : 'none'};">
        <label style="margin-top: 10px;">نوع حركة العلف *</label>
        <div class="feed-choice-container">
          <div class="feed-choice-card ${feedMode === 'purchased' ? 'active' : ''}" id="feed_choice_purchased" onclick="selectFeedMode('purchased')">
            <span class="feed-choice-icon">📦</span>
            <div class="feed-choice-text">
              <div class="feed-choice-title">شراء وتوريد للمخزن</div>
              <div class="feed-choice-desc">دفع فلوس كاش + إضافة شكاير للمخزن</div>
            </div>
          </div>
          <div class="feed-choice-card ${feedMode === 'consumed' ? 'active feed-consumed' : ''}" id="feed_choice_consumed" onclick="selectFeedMode('consumed')">
            <span class="feed-choice-icon">🌾</span>
            <div class="feed-choice-text">
              <div class="feed-choice-title">علف أكلته الطيور اليوم</div>
              <div class="feed-choice-desc">وجبة اليوم - بدون دفع كاش اليوم</div>
            </div>
          </div>
        </div>
        <input type="hidden" id="f_feed_mode" value="${feedMode}">

        <div id="consumed_info_banner" class="form-hint-banner" style="background: rgba(14,165,233,0.12); border-color: var(--sky); color: var(--sky); margin: 6px 0 14px; display: ${feedMode === 'consumed' ? 'flex' : 'none'};">
          <span style="font-size: 18px;">💡</span>
          <span style="font-size: 12px; line-height: 1.4;"><b>وجبة استهلاك يومية:</b> لا تتطلب دفع كاش اليوم؛ لأن العلف مسحوب من مخزن المزرعة مسبقاً. سيتم خصمها من رصيد المخزن واحتسابها في معامل التحويل (FCR).</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <label>الوحدة</label>
            <select id="f_feed_unit" onchange="updateFeedLiveHint()">
              <option value="شكارة" ${feedUnitVal === 'شكارة' ? 'selected' : ''}>شكارة (${bagKg} كجم)</option>
              <option value="كيلو" ${feedUnitVal === 'كيلو' ? 'selected' : ''}>كيلوجرام (كجم)</option>
            </select>
          </div>
          <div>
            <label>الكمية *</label>
            <input id="f_feed_q" type="number" inputmode="decimal" step="any" value="${feedQVal}" placeholder="الكمية" oninput="updateFeedLiveHint()">
          </div>
        </div>
        <div id="feed_live_hint" style="margin: 6px 0 12px; font-size: 12px; font-weight: 700; color: var(--text-muted);"></div>

        <label>نوع العلف أو بيان (اختياري)</label>
        <input id="f_feed_note" type="text" value="${feedNoteVal}" placeholder="مثال: بادي 23%، نامي 21%، ناهي 19%...">
      </div>

      <!-- Money Amount Field (Hidden only when Feed Consumed is active) -->
      <div id="f_amt_wrapper" style="display: ${catVal === 'علف' && feedMode === 'consumed' ? 'none' : 'block'};">
        <label>المبلغ المدفوع (جنيه) *</label>
        <input id="f_amt" type="number" inputmode="decimal" step="any" value="${amtVal}" placeholder="المبلغ المدفوع بالجنيه">
      </div>

      <!-- Standard Note Field (Visible when category is NOT feed) -->
      <div id="std_note_wrapper" style="display: ${catVal !== 'علف' ? 'block' : 'none'};">
        <label>ملاحظة أو بيان (اختياري)</label>
        <input id="f_std_note" type="text" value="${stdNoteVal}" placeholder="مثلاً: دفعة كتاكيت ساسو، فاتورة كهرباء...">
      </div>
    `;
  } else if (kind === 'inc') {
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
  } else if (kind === 'dead') {
    const nVal = isEdit && existing ? existing.n : '';
    const noteVal = isEdit && existing ? (existing.note || '') : '';

    h += `
      <label>عدد الطيور النافقة *</label>
      <input id="f_n" type="number" inputmode="numeric" value="${nVal}" placeholder="مثلاً: 5">

      <label>سبب النفوق / ملاحظة (اختياري)</label>
      <input id="f_note" type="text" value="${noteVal}" placeholder="مثلاً: موجة حر، فرز أولي...">
    `;
  } else if (kind === 'debt') {
    // Specialized Debt Form
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
  if (isUnified) updateFeedLiveHint();

  // Form Submit Handler with Solid Validation
  fm.onsubmit = ev => {
    ev.preventDefault();
    clearFormErrors();

    const dVal = document.getElementById('f_d').value || today();
    let dataObj = { d: dVal };

    if (isUnified) {
      dataObj.cat = document.getElementById('f_cat').value;
      dataObj.feed_mode = document.getElementById('f_feed_mode') ? document.getElementById('f_feed_mode').value : 'purchased';
      dataObj.amt = document.getElementById('f_amt') ? document.getElementById('f_amt').value.trim() : '';
      dataObj.feed_unit = document.getElementById('f_feed_unit') ? document.getElementById('f_feed_unit').value : 'شكارة';
      dataObj.feed_q = document.getElementById('f_feed_q') ? document.getElementById('f_feed_q').value.trim() : '';
      dataObj.feed_note = document.getElementById('f_feed_note') ? document.getElementById('f_feed_note').value.trim() : '';
      dataObj.std_note = document.getElementById('f_std_note') ? document.getElementById('f_std_note').value.trim() : '';
      dataObj.note = dataObj.cat === 'علف' ? dataObj.feed_note : dataObj.std_note;
    } else if (kind === 'inc') {
      dataObj.cnt = document.getElementById('f_cnt').value.trim();
      dataObj.kg = document.getElementById('f_kg').value.trim();
      dataObj.amt = document.getElementById('f_amt').value.trim();
      dataObj.paidAmt = document.getElementById('f_paidAmt').value.trim();
      dataObj.buyer = document.getElementById('f_buyer').value.trim();
    } else if (kind === 'dead') {
      dataObj.n = document.getElementById('f_n').value.trim();
      dataObj.note = document.getElementById('f_note').value.trim();
    } else if (kind === 'debt') {
      dataObj.dir = document.getElementById('f_dir').value;
      dataObj.who = document.getElementById('f_who').value.trim();
      dataObj.amt = document.getElementById('f_amt').value.trim();
      dataObj.paidAmt = document.getElementById('f_paidAmt').value.trim();
      dataObj.note = document.getElementById('f_note').value.trim();
    }

    // Run strict validation
    const valRes = validateTransaction(isUnified ? 'exp' : kind, dataObj, isEdit, editIndex, cycle);
    if (!valRes.valid) {
      showFormError(valRes.message, valRes.field);
      return;
    }

    if (isUnified) {
      if (dataObj.cat === 'علف') {
        const qNum = +dataObj.feed_q;
        const totalKg = dataObj.feed_unit === 'شكارة' ? qNum * bagKg : qNum;
        const feedTxt = qNum + ' ' + dataObj.feed_unit + (dataObj.feed_note ? ' (' + dataObj.feed_note + ')' : '');

        if (dataObj.feed_mode === 'purchased') {
          const amtNum = +dataObj.amt;
          let targetExp = isExpKind && isEdit ? cycle.exp[editIndex] : linkedRef;
          let targetFeed = isFeedKind && isEdit ? cycle.feed[editIndex] : linkedRef;

          if (targetExp && targetFeed) {
            targetExp.d = dataObj.d;
            targetExp.amt = amtNum;
            targetExp.cat = 'علف';
            targetExp.note = dataObj.feed_note;

            targetFeed.d = dataObj.d;
            targetFeed.type = 'purchased';
            targetFeed.q = qNum;
            targetFeed.unit = dataObj.feed_unit;
            targetFeed.kg = totalKg;
            targetFeed.note = dataObj.feed_note;
            targetFeed.txt = feedTxt;
            showToast('تم تعديل شراء العلف ورصيد المخزن بنجاح ✓');
          } else if (targetExp && !targetFeed) {
            targetExp.d = dataObj.d;
            targetExp.amt = amtNum;
            targetExp.cat = 'علف';
            targetExp.note = dataObj.feed_note;
            const newFeedId = Date.now() + Math.floor(Math.random() * 1000);
            targetExp.feedRefId = newFeedId;
            cycle.feed.push({
              id: newFeedId,
              d: dataObj.d,
              type: 'purchased',
              q: qNum,
              unit: dataObj.feed_unit,
              kg: totalKg,
              note: dataObj.feed_note,
              txt: feedTxt,
              expRefId: targetExp.id
            });
            showToast('تم تحديث المصروف وإضافة العلف للمخزن ✓');
          } else if (!targetExp && targetFeed) {
            targetFeed.d = dataObj.d;
            targetFeed.type = 'purchased';
            targetFeed.q = qNum;
            targetFeed.unit = dataObj.feed_unit;
            targetFeed.kg = totalKg;
            targetFeed.note = dataObj.feed_note;
            targetFeed.txt = feedTxt;
            const newExpId = Date.now() + Math.floor(Math.random() * 1000);
            targetFeed.expRefId = newExpId;
            cycle.exp.push({
              id: newExpId,
              d: dataObj.d,
              cat: 'علف',
              amt: amtNum,
              note: dataObj.feed_note,
              feedRefId: targetFeed.id
            });
            showToast('تم تحديث حركة العلف والمصروف المالي ✓');
          } else {
            const newExpId = Date.now() + Math.floor(Math.random() * 1000);
            const newFeedId = newExpId + 1;
            cycle.exp.push({
              id: newExpId,
              d: dataObj.d,
              cat: 'علف',
              amt: amtNum,
              note: dataObj.feed_note,
              feedRefId: newFeedId
            });
            cycle.feed.push({
              id: newFeedId,
              d: dataObj.d,
              type: 'purchased',
              q: qNum,
              unit: dataObj.feed_unit,
              kg: totalKg,
              note: dataObj.feed_note,
              txt: feedTxt,
              expRefId: newExpId
            });
            showToast('تم تسجيل شراء وتوريد العلف للمخزن بنجاح ✓');
          }
        } else {
          // Consumed feed
          let targetFeed = isFeedKind && isEdit ? cycle.feed[editIndex] : null;
          if (targetFeed) {
            targetFeed.d = dataObj.d;
            targetFeed.type = 'consumed';
            targetFeed.q = qNum;
            targetFeed.unit = dataObj.feed_unit;
            targetFeed.kg = totalKg;
            targetFeed.note = dataObj.feed_note;
            targetFeed.txt = feedTxt;
            if (targetFeed.expRefId) {
              const oldExpIdx = cycle.exp.findIndex(x => x.id === targetFeed.expRefId);
              if (oldExpIdx !== -1) cycle.exp.splice(oldExpIdx, 1);
              delete targetFeed.expRefId;
            }
            showToast('تم حفظ تعديل استهلاك العلف اليومي ✓');
          } else {
            const newFeedId = Date.now() + Math.floor(Math.random() * 1000);
            cycle.feed.push({
              id: newFeedId,
              d: dataObj.d,
              type: 'consumed',
              q: qNum,
              unit: dataObj.feed_unit,
              kg: totalKg,
              note: dataObj.feed_note,
              txt: feedTxt
            });
            showToast('تم تسجيل استهلاك وجبة العلف بنجاح 🌾');
          }
        }
      } else {
        // Standard expense
        const amtNum = +dataObj.amt;
        if (isExpKind && isEdit) {
          const targetExp = cycle.exp[editIndex];
          targetExp.d = dataObj.d;
          targetExp.cat = dataObj.cat;
          targetExp.amt = amtNum;
          targetExp.note = dataObj.note;
          if (targetExp.feedRefId) {
            const oldFeedIdx = cycle.feed.findIndex(f => f.id === targetExp.feedRefId);
            if (oldFeedIdx !== -1) cycle.feed.splice(oldFeedIdx, 1);
            delete targetExp.feedRefId;
          }
          showToast(`تم تعديل مصروف (${targetExp.cat}) بنجاح ✓`);
        } else {
          cycle.exp.push({
            id: Date.now() + Math.floor(Math.random() * 1000),
            d: dataObj.d,
            cat: dataObj.cat,
            amt: amtNum,
            note: dataObj.note
          });
          showToast(`تمت إضافة مصروف (${dataObj.cat}) بنجاح ✓`);
        }
      }

      saveData();
      closeM();
      render();
      return;
    }

    // Kind is inc, dead, or debt
    const o = isEdit ? { ...existing } : { id: Date.now() + Math.floor(Math.random() * 1000) };
    o.d = dataObj.d;

    if (kind === 'inc') {
      o.cnt = +dataObj.cnt;
      o.kg = dataObj.kg !== '' ? +dataObj.kg : 0;
      o.amt = +dataObj.amt;
      o.paidAmt = dataObj.paidAmt !== '' ? +dataObj.paidAmt : o.amt;
      o.buyer = dataObj.buyer;

      const remainingSaleAmt = Math.max(0, o.amt - o.paidAmt);

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
        const linkedDebt = cycle.debt.find(d => d.id === o.debtRefId || d.saleId === o.id);
        if (linkedDebt) {
          linkedDebt.paidAmt = linkedDebt.amt;
          linkedDebt.paid = true;
        }
      }
    } else if (kind === 'dead') {
      o.n = +dataObj.n;
      o.note = dataObj.note;
    } else if (kind === 'debt') {
      o.dir = dataObj.dir;
      o.who = dataObj.who;
      o.amt = +dataObj.amt;
      o.paidAmt = dataObj.paidAmt !== '' ? +dataObj.paidAmt : (isEdit ? (existing.paidAmt || 0) : 0);
      o.paid = o.paidAmt >= o.amt;
      o.note = dataObj.note;
      o.payments = isEdit && existing.payments ? existing.payments : [];
    }

    if (isEdit) {
      cycle[kind][editIndex] = o;
      showToast(`تم تعديل ${K[kind].t} بنجاح ✓`);
    } else {
      cycle[kind].push(o);
      showToast(`تمت إضافة ${K[kind].t} بنجاح ✓`);
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

// Interactive handlers for unified Expense & Feed Form
function onExpenseCatChange() {
  const catEl = document.getElementById('f_cat');
  if (!catEl) return;
  const cat = catEl.value;
  const feedSec = document.getElementById('feed_sub_section');
  const amtWrapper = document.getElementById('f_amt_wrapper');
  const stdNoteWrapper = document.getElementById('std_note_wrapper');
  const feedMode = document.getElementById('f_feed_mode') ? document.getElementById('f_feed_mode').value : 'purchased';

  if (cat === 'علف') {
    if (feedSec) feedSec.style.display = 'block';
    if (stdNoteWrapper) stdNoteWrapper.style.display = 'none';
    if (amtWrapper) amtWrapper.style.display = feedMode === 'consumed' ? 'none' : 'block';
    updateFeedLiveHint();
  } else {
    if (feedSec) feedSec.style.display = 'none';
    if (stdNoteWrapper) stdNoteWrapper.style.display = 'block';
    if (amtWrapper) amtWrapper.style.display = 'block';
  }
}

function selectFeedMode(mode) {
  const modeInput = document.getElementById('f_feed_mode');
  if (modeInput) modeInput.value = mode;

  const cardPurchased = document.getElementById('feed_choice_purchased');
  const cardConsumed = document.getElementById('feed_choice_consumed');
  const amtWrapper = document.getElementById('f_amt_wrapper');
  const banner = document.getElementById('consumed_info_banner');

  if (cardPurchased && cardConsumed) {
    if (mode === 'purchased') {
      cardPurchased.classList.add('active');
      cardConsumed.classList.remove('active', 'feed-consumed');
      if (amtWrapper) amtWrapper.style.display = 'block';
      if (banner) banner.style.display = 'none';
    } else {
      cardPurchased.classList.remove('active');
      cardConsumed.classList.add('active', 'feed-consumed');
      if (amtWrapper) amtWrapper.style.display = 'none';
      if (banner) banner.style.display = 'flex';
    }
  }

  updateFeedLiveHint();
}

function updateFeedLiveHint() {
  const hintEl = document.getElementById('feed_live_hint');
  if (!hintEl) return;

  const unitEl = document.getElementById('f_feed_unit');
  const qEl = document.getElementById('f_feed_q');
  const modeEl = document.getElementById('f_feed_mode');
  if (!unitEl || !qEl) return;

  const unit = unitEl.value;
  const q = +qEl.value || 0;
  const mode = modeEl ? modeEl.value : 'purchased';
  const totalKg = unit === 'شكارة' ? q * bagKg : q;
  const totalBags = (totalKg / bagKg).toFixed(1);

  const cycle = cur();
  const k = calc(cycle);

  if (q > 0) {
    if (mode === 'purchased') {
      hintEl.innerHTML = `📦 الكمية تعادل: <b>${f(totalKg)} كجم</b> (${totalBags} شكارة) ستضاف إلى رصيد المخزن.`;
      hintEl.style.color = 'var(--emerald)';
    } else {
      const remAfter = Math.max(0, k.feedStockKg - totalKg);
      hintEl.innerHTML = `🌾 الكمية تعادل: <b>${f(totalKg)} كجم</b> (${totalBags} شكارة) ستخصم من المخزن (المتبقي الحالي بالمخزن: ${f(k.feedStockKg)} كجم).`;
      hintEl.style.color = 'var(--sky)';
    }
  } else {
    hintEl.textContent = '';
  }
}

// Live date text updater for Egypt local date display
function updateDateDisplay(val) {
  const disp = document.getElementById('f_d_display');
  if (disp && val) {
    disp.textContent = fd(val);
  }
}

function updateFeedHint() {
  updateFeedLiveHint();
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

// ==========================================================================
// 4.1 CUSTOM CONFIRMATION & WARNING MODAL (نافذة تحذير وتأكيد الحذف المخصصة)
// ==========================================================================
function showConfirmModal({
  icon = '🗑️',
  title = 'تأكيد الحذف ⚠️',
  subtitle = 'هل أنت متأكد من رغبتك في حذف هذا العنصر؟',
  itemIcon = '📄',
  itemTitle = '',
  itemMeta = '',
  warningNote = '',
  confirmBtnText = 'نعم، احذف نهائياً',
  onConfirm = () => {}
}) {
  const cm = document.getElementById('cm');
  if (!cm) return;

  cm.innerHTML = `
    <div class="confirm-box" onclick="event.stopPropagation()">
      <div class="confirm-icon-badge">${icon}</div>
      <div class="confirm-title">${title}</div>
      <div class="confirm-subtitle">${subtitle}</div>

      <div class="confirm-item-card">
        <div class="confirm-item-icon">${itemIcon}</div>
        <div style="flex: 1; text-align: right; min-width: 0;">
          <div class="confirm-item-text">${itemTitle}</div>
          ${itemMeta ? `<div class="confirm-item-meta">${itemMeta}</div>` : ''}
        </div>
      </div>

      ${warningNote ? `
        <div class="confirm-warning-tag">
          ⚠️ ${warningNote}
        </div>
      ` : ''}

      <div class="confirm-actions">
        <button type="button" class="btn btn-danger" id="cm_confirm_btn" style="flex: 1;">
          ${confirmBtnText}
        </button>
        <button type="button" class="btn btn-outline" id="cm_cancel_btn" style="flex: 1;" onclick="closeConfirmModal()">
          إلغاء وتراجع
        </button>
      </div>
    </div>
  `;

  document.getElementById('cm_confirm_btn').onclick = () => {
    closeConfirmModal();
    onConfirm();
  };

  cm.onclick = e => {
    if (e.target === cm) closeConfirmModal();
  };

  cm.classList.add('on');
}

function closeConfirmModal() {
  const cm = document.getElementById('cm');
  if (cm) cm.classList.remove('on');
}

// ==========================================================================
// 4.2 EDUCATIONAL & INTERACTIVE EFFICIENCY GUIDE MODAL (دليل مؤشرات الكفاءة)
// ==========================================================================
function showFcrModal() {
  showEfficiencyGuideModal('fcr');
}

function showEfficiencyGuideModal(activeTab = 'fcr') {
  const cycle = cur();
  if (!cycle) return;
  const k = calc(cycle);
  const cm = document.getElementById('cm');
  if (!cm) return;

  const isOngoing = !cycle.end;
  const fcrVal = k.fcr ? k.fcr.toFixed(2) : null;

  let statusBadge = '';
  let statusText = '';
  let statusColor = 'var(--emerald)';

  if (!fcrVal) {
    statusBadge = '⏳ بانتظار تسجيل أوزان البيع';
    statusText = 'لم يتم تسجيل أوزان بيع بالكيلو بعد. سيبدأ حساب معامل التحويل تلقائياً بمجرد تسجيل أول حركة بيع طيور مع وزنها الإجمالي.';
    statusColor = 'var(--text-muted)';
  } else if (isOngoing && k.remaining > 0) {
    statusBadge = `⏳ دورة جارية مؤقت (${fcrVal} كجم علف/كجم لحم)`;
    statusText = `الرقم الحالي (${fcrVal}) يمثل استهلاك العلف للقطيع كله مقسوماً على ما تم بيعه فقط حتى الآن. سيعتدل الرقم تدريجياً مع بيع باقي القطيع (${f(k.remaining)} طائر).`;
    statusColor = 'var(--sky)';
  } else if (k.fcr <= 1.55) {
    statusBadge = '🌟 سوبر ممتاز (أعلى كفاءة وأقصى ربح)';
    statusText = `كل 1 كيلو لحم انتجته دورتك كلفك ${fcrVal} كجم علف فقط. هذا أداء استثنائي وتوفير كبير جداً في تكلفة العلف.`;
    statusColor = 'var(--emerald)';
  } else if (k.fcr <= 1.65) {
    statusBadge = '🟢 طبيعي ومربح (ضمن المعدل القياسي)';
    statusText = `كل 1 كيلو لحم انتجته دورتك كلفك ${fcrVal} كجم علف. هذا هو المعدل الطبيعي والمربح لمعظم مزارع التسمين الناجحة.`;
    statusColor = 'var(--emerald)';
  } else if (k.fcr <= 1.80) {
    statusBadge = '🟠 متوسط وفيه هدر نسبي في العلف';
    statusText = `كل 1 كيلو لحم كلفك ${fcrVal} كجم علف. الفراخ تستهلك علف زيادة مقارنة بالوزن المكتسب، يُفضل مراجعة التهوية والتدفئة ومنع هدر العلافات.`;
    statusColor = 'var(--amber)';
  } else {
    statusBadge = '🔴 مرتفع جداً (هدر في العلف وخسارة)';
    statusText = `كل 1 كيلو لحم أخذ ${fcrVal} كجم علف! الفراخ تستهلك علفاً كبيراً دون تحقيق وزن مناسب. قد يكون السبب برودة العنبر، أو علف رديء، أو إصابة معوية (كوكسيديا/كلوسترديا).`;
    statusColor = 'var(--rose)';
  }

  // Active Tab Rendering
  const currentTab = (activeTab === 'all' || !activeTab) ? 'fcr' : activeTab;

  let tabContent = '';

  if (currentTab === 'fcr') {
    tabContent = `
      <!-- FCR Spotlight -->
      <div class="card" style="margin-bottom: 12px; padding: 16px; background: rgba(0,0,0,0.25); border-color: ${statusColor};">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
          <span style="font-size: 13px; font-weight: 700; color: var(--text-muted);">معامل التحويل لدورتك الحالية:</span>
          <span style="font-size: 28px; font-weight: 800; font-family: var(--font-num); color: ${statusColor};">
            ${fcrVal ? fcrVal : '-'}
          </span>
        </div>
        <div style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 800; margin-bottom: 8px; background: rgba(255,255,255,0.06); color: ${statusColor}; border: 1px solid ${statusColor};">
          ${statusBadge}
        </div>
        <div style="font-size: 13px; line-height: 1.5; color: var(--text-main);">
          ${statusText}
        </div>
        ${fcrVal ? `
          <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--border-subtle); font-size: 11px; color: var(--text-muted);">
            📊 تم حسابه من: علف مستهلك (<b>${f(k.feedConsumedKg)} كجم</b>) ÷ إجمالي وزن البيع (<b>${f(k.kgS)} كجم</b>).
          </div>
        ` : ''}
      </div>

      ${isOngoing && k.remaining > 0 && fcrVal ? `
        <div class="form-hint-banner" style="background: rgba(14,165,233,0.12); border-color: var(--sky); color: var(--sky); margin-bottom: 12px; font-size: 12px;">
          <span>⏳</span>
          <span><b>ملحوظة للمربي:</b> الدورة ما زالت جارية ويوجد <b>${f(k.remaining)} طائر</b> في العنبر، الرقم سيعتدل تدريجياً ليصبح دقيقاً مع نهاية تسويق باقي الطيور.</span>
        </div>
      ` : ''}

      <!-- Golden Rule -->
      <div class="form-hint-banner emerald" style="margin-bottom: 14px;">
        <span>💰</span>
        <span><b>القاعدة الذهبية:</b> كل ما الرقم <u>يقل</u>، كل ما أرباحك <u>تزيد</u>! (علف قليل = لحم كثير = توفير فلوس).</span>
      </div>

      <!-- Visual Color Gauge Meter -->
      <div class="fcr-meter-container">
        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; margin-bottom: 4px;">
          <span style="color: var(--emerald);">ممتاز (&lt; 1.55)</span>
          <span style="color: var(--sky);">طبيعي ومربح (1.60)</span>
          <span style="color: var(--amber);">هدر نسبي (1.75)</span>
          <span style="color: var(--rose);">خسارة (&gt; 1.80)</span>
        </div>
        <div class="fcr-meter-bar"></div>
        <div class="fcr-meter-legend">
          <span>1.40 كجم</span>
          <span>1.55 كجم</span>
          <span>1.65 كجم</span>
          <span>1.80+ كجم</span>
        </div>
      </div>

      <!-- Benchmark Table -->
      <div style="font-size: 13px; font-weight: 800; color: var(--text-title); margin: 12px 0 8px;">
        📌 دليل تقييم معامل التحويل في السوق المصري:
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; font-size: 12px;">
        <div style="display: flex; justify-content: space-between; padding: 7px 12px; border-radius: 6px; background: rgba(16,185,129,0.12); border: 1px solid var(--emerald); color: var(--text-main);">
          <span>🌟 <b>أقل من 1.55</b>: سوبر ممتاز</span>
          <span style="color: var(--emerald); font-weight: 700;">أقصى ربحية وتوفير كبير</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 7px 12px; border-radius: 6px; background: rgba(16,185,129,0.06); border: 1px solid var(--border-subtle); color: var(--text-main);">
          <span>🟢 <b>1.55 إلى 1.65</b>: طبيعي ومربح</span>
          <span style="color: var(--emerald); font-weight: 700;">المعدل القياسي للمزارع</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 7px 12px; border-radius: 6px; background: rgba(245,158,11,0.08); border: 1px solid var(--amber); color: var(--text-main);">
          <span>🟠 <b>1.65 إلى 1.80</b>: متوسط وفيه هدر</span>
          <span style="color: var(--amber); font-weight: 700;">راجع التدفئة والعلافات</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 7px 12px; border-radius: 6px; background: rgba(244,63,94,0.08); border: 1px solid var(--rose); color: var(--text-main);">
          <span>🔴 <b>أكثر من 1.80</b>: خسارة وهدر علف</span>
          <span style="color: var(--rose); font-weight: 700;">افحص الأمراض والسموم</span>
        </div>
      </div>

      <!-- Farm Practical Tips -->
      <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px; margin-bottom: 16px; font-size: 12px; line-height: 1.6;">
        <div style="font-weight: 800; color: var(--emerald); margin-bottom: 4px;">🚜 نصائح عملية من واقع المزارع لتنزيل المعامل وزيادة أرباحك:</div>
        <div>• <b>التدفئة الجيدة:</b> البرودة تجعل الطائر يحرق العلف للتدفئة بدلاً من تحويله للحم.</div>
        <div>• <b>ارتفاع العلافات:</b> اضبط حافة العلافة في مستوى ظهر الطائر لمنع نثر وهدر العلف في الفرشة.</div>
        <div>• <b>صحة الأمعاء:</b> مكافحة الكوكسيديا والكلوسترديا تضمن امتصاص الطائر لكل حبة علف.</div>
        <div>• <b>مضادات السموم:</b> استخدام مضاد سموم فطرية قوي دورياً يحافظ على الكبد وكفاءة الهضم.</div>
      </div>
    `;
  } else if (currentTab === 'cpb') {
    tabContent = `
      <div class="card" style="margin-bottom: 14px; padding: 16px; background: rgba(0,0,0,0.25); border-color: var(--sky);">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
          <span style="font-size: 13px; font-weight: 700; color: var(--text-muted);">تكلفة الطائر الحي في دورتك:</span>
          <span style="font-size: 28px; font-weight: 800; font-family: var(--font-num); color: var(--sky);">
            ${f(k.cpb)} ج
          </span>
        </div>
        <div style="font-size: 13px; line-height: 1.5; color: var(--text-main);">
          كل فرخة باقية عايشة في عنبرك مكلفاك حتى هذه اللحظة <b>${f(k.cpb)} جنيه مصري</b>.
        </div>
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--border-subtle); font-size: 11px; color: var(--text-muted);">
          📊 تم حسابه من: إجمالي المصروفات (<b>${f(k.e)} ج</b>) ÷ عدد الطيور الحية المتبقية (<b>${f(k.remaining)} طائر</b>).
        </div>
      </div>

      <div class="form-hint-banner emerald" style="margin-bottom: 14px;">
        <span>💡</span>
        <span><b>ما فائدة هذا الرقم للمربي؟</b> يحدد لك «حد الأمان» عند البيع! إذا بعت الفرخة بأعلى من ${f(k.cpb)} ج تكون رابحاً، وإذا بعت بأقل تخسر.</span>
      </div>

      <div style="font-size: 12px; color: var(--text-muted); line-height: 1.6; margin-bottom: 14px;">
        📌 <b>ماذا تشمل تكلفة الطائر؟</b>
        تشمل كل قرش صرفته على الدورة مقسوماً على الطيور الحية: (سعر الكتكوت + العلف + الأدوية والتحصينات + الغاز والكهرباء والفرشة + العمالة والنقل).
      </div>
    `;
  } else if (currentTab === 'ppb') {
    tabContent = `
      <div class="card" style="margin-bottom: 14px; padding: 16px; background: rgba(0,0,0,0.25); border-color: ${k.ppb >= 0 ? 'var(--emerald)' : 'var(--rose)'};">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
          <span style="font-size: 13px; font-weight: 700; color: var(--text-muted);">صافي ربح الطائر المباع:</span>
          <span style="font-size: 28px; font-weight: 800; font-family: var(--font-num); color: ${k.ppb >= 0 ? 'var(--emerald)' : 'var(--rose)'};">
            ${f(k.ppb)} ج
          </span>
        </div>
        <div style="font-size: 13px; line-height: 1.5; color: var(--text-main);">
          ${k.ppb >= 0 
            ? `ما شاء الله! كل فرخة خرجت من باب المزرعة وتباعت حطت في جيبك صافي مكسب <b>${f(k.ppb)} ج</b> بعد خصم كل التكاليف.`
            : `الرقم بالسالب حالياً (${f(k.ppb)} ج)؛ إما لأن البيع في بدايته ولم يغطِ تكلفة الكتاكيت والعلف بعد، أو لأن سعر البيع كان منخفضاً.`}
        </div>
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--border-subtle); font-size: 11px; color: var(--text-muted);">
          📊 تم حسابه من: صافي أرباح الدورة (<b>${f(k.p)} ج</b>) ÷ عدد الطيور المباعة (<b>${f(k.sold)} طائر</b>).
        </div>
      </div>

      <div class="form-hint-banner" style="margin-bottom: 14px;">
        <span>📈</span>
        <span><b>توضيح هام:</b> في بداية أيام البيع، قد يظهر ربح الطائر بالسالب لأن المبيعات الأولى لم تغطِ بعد تكاليف الدورة الكلية. مع استمرار تسليم باقي الفراخ يتحول الرقم للموجب والربح الصافي الحقيقي.</span>
      </div>
    `;
  } else if (currentTab === 'feed') {
    tabContent = `
      <div class="card" style="margin-bottom: 14px; padding: 16px; background: rgba(0,0,0,0.25); border-color: var(--sky);">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
          <span style="font-size: 13px; font-weight: 700; color: var(--text-muted);">إجمالي العلف المستهلك:</span>
          <span style="font-size: 28px; font-weight: 800; font-family: var(--font-num); color: var(--sky);">
            ${f(k.feedConsumedKg)} كجم
          </span>
        </div>
        <div style="font-size: 13px; line-height: 1.5; color: var(--text-main);">
          ما يعادل <b>${(k.feedConsumedKg / bagKg).toFixed(1)} شكارة</b> (${bagKg} كجم) تم سحبها من المخزن وأكلتها الطيور فعلياً.
        </div>
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--border-subtle); font-size: 11px; color: var(--text-muted);">
          🏬 رصيد المخزن المتبقي الحالي: <b>${f(k.feedStockKg)} كجم</b> (${(k.feedStockKg / bagKg).toFixed(1)} شكارة جاهزة للاستخدام).
        </div>
      </div>

      <div class="form-hint-banner emerald" style="margin-bottom: 14px;">
        <span>🌾</span>
        <span><b>لماذا نفرق بين العلف المشتري والمستهلك؟</b> لأن الشكاير الموجودة بالمخزن هي أصل ورصيد ملكك لم تأكله الطيور بعد، فلا تُحسب ضمن معامل التحويل حتى يتم استهلاكها للطيور.</span>
      </div>
    `;
  }

  cm.innerHTML = `
    <div class="guide-box" onclick="event.stopPropagation()">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px; margin-bottom: 14px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 24px;">💡</span>
          <div>
            <div style="font-size: 17px; font-weight: 800; color: var(--text-title);">دليل مؤشرات الكفاءة والأرباح لمربي الدواجن</div>
            <div style="font-size: 12px; color: var(--text-muted);">شرح مبسط وواضح لكل رقم في شاشتك وتأثيره على جيبك</div>
          </div>
        </div>
        <button type="button" class="btn btn-sm btn-outline" onclick="closeConfirmModal()">✕</button>
      </div>

      <!-- Guide Sub-tabs -->
      <div class="guide-tab-pills">
        <button type="button" class="guide-tab-btn ${currentTab === 'fcr' ? 'active' : ''}" onclick="showEfficiencyGuideModal('fcr')">
          ⚖️ معامل التحويل (FCR)
        </button>
        <button type="button" class="guide-tab-btn ${currentTab === 'cpb' ? 'active' : ''}" onclick="showEfficiencyGuideModal('cpb')">
          💵 تكلفة الطائر
        </button>
        <button type="button" class="guide-tab-btn ${currentTab === 'ppb' ? 'active' : ''}" onclick="showEfficiencyGuideModal('ppb')">
          📈 ربح الطائر
        </button>
        <button type="button" class="guide-tab-btn ${currentTab === 'feed' ? 'active' : ''}" onclick="showEfficiencyGuideModal('feed')">
          🌾 العلف المستهلك
        </button>
      </div>

      <!-- Tab Content Placeholder -->
      ${tabContent}

      <div style="text-align: center; margin-top: 10px;">
        <button type="button" class="btn btn-primary btn-full" onclick="closeConfirmModal()">
          فهمت ذلك تماماً ✓
        </button>
      </div>
    </div>
  `;

  cm.onclick = e => {
    if (e.target === cm) closeConfirmModal();
  };

  cm.classList.add('on');
}


// Delete an individual payment record from debt history
function deletePayment(debtIndex, paymentIndex) {
  const cycle = cur();
  if (!cycle || !cycle.debt || !cycle.debt[debtIndex]) return;
  const d = cycle.debt[debtIndex];
  const payment = d.payments[paymentIndex];

  showConfirmModal({
    icon: '↩️',
    title: 'تأكيد إلغاء دفعة السداد ⚠️',
    subtitle: 'هل تريد إلغاء هذه الدفعة المسددة؟ سيتم إعادة المبلغ تلقائياً لرصيد المديونية المتبقي.',
    itemIcon: '💵',
    itemTitle: `دفعة سداد: ${f(payment.amt)} ج (${d.who})`,
    itemMeta: `تاريخ السداد: ${fd(payment.d)} ${payment.note ? '• البيان: ' + payment.note : ''}`,
    confirmBtnText: 'نعم، إلغاء الدفعة واسترجاع الرصيد',
    onConfirm: () => {
      d.paidAmt = Math.max(0, (d.paidAmt || 0) - payment.amt);
      d.paid = d.paidAmt >= d.amt;
      d.payments.splice(paymentIndex, 1);

      saveData();
      showToast('تم إلغاء الدفعة واسترجاع الرصيد بنجاح');
      render();
    }
  });
}

// Delete sale with automatic handling of linked debt
function delSale(i) {
  const cycle = cur();
  const sale = cycle.inc[i];
  const hasLinkedDebt = sale.debtRefId || sale.id;
  const linkedDebt = hasLinkedDebt ? cycle.debt.find(d => d.id === sale.debtRefId || d.saleId === sale.id) : null;

  showConfirmModal({
    icon: '🗑️',
    title: 'تأكيد حذف حركة البيع ⚠️',
    subtitle: 'هل أنت متأكد من حذف حركة البيع هذه؟ سيتم خصم هذا المبلغ من إجمالي المبيعات وإعادة عدد الطيور المباعة إلى القطيع الحي بالمزرعة.',
    itemIcon: '📈',
    itemTitle: `بيع ${sale.cnt} طائر ${sale.buyer ? '(' + sale.buyer + ')' : ''}`,
    itemMeta: `إجمالي القيمة: ${f(sale.amt)} ج • محصل كاش: ${f(sale.paidAmt)} ج • التاريخ: ${fd(sale.d)}`,
    warningNote: linkedDebt ? `تنبيه: سيتم أيضاً حذف المديونية المرتبطة بهذا البيع (${f(linkedDebt.amt)} ج على ${linkedDebt.who}) تلقائياً منعاً لتكرار الديون.` : '',
    confirmBtnText: 'نعم، حذف حركة البيع نهائياً',
    onConfirm: () => {
      if (linkedDebt) {
        const debtIdx = cycle.debt.indexOf(linkedDebt);
        if (debtIdx !== -1) {
          cycle.debt.splice(debtIdx, 1);
        }
      }
      cycle.inc.splice(i, 1);
      saveData();
      showToast('تم حذف حركة البيع وتحديث الأرصدة والديون');
      render();
    }
  });
}

// Delete debt record
function delDebt(i) {
  const cycle = cur();
  const d = cycle.debt[i];
  const isUs = d.dir === 'لنا';
  const rem = Math.max(0, d.amt - (d.paidAmt || 0));

  showConfirmModal({
    icon: '🗑️',
    title: 'تأكيد حذف المديونية ⚠️',
    subtitle: 'هل أنت متأكد من رغبتك في حذف هذا السجل للمديونية نهائياً؟',
    itemIcon: '📝',
    itemTitle: `${d.who} (${isUs ? '🟢 مستحق لنا عنده' : '🔴 مستحق علينا له'})`,
    itemMeta: `المبلغ الأصلي: ${f(d.amt)} ج • المسدد: ${f(d.paidAmt || 0)} ج • المتبقي: ${f(rem)} ج`,
    warningNote: (d.payments && d.payments.length > 0) ? `تحذير: يحتوي هذا السجل على (${d.payments.length}) دفعات مسددة مسجلة سيتم مسحها بالكامل مع السجل.` : '',
    confirmBtnText: 'نعم، احذف المديونية نهائياً',
    onConfirm: () => {
      cycle.debt.splice(i, 1);
      saveData();
      showToast('تم حذف المديونية بنجاح');
      render();
    }
  });
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
  const cycle = C.find(x => x.id === id);
  if (!cycle) return;

  showConfirmModal({
    icon: '🚨',
    title: 'تحذير شديد: حذف دورة كاملة 🗑️',
    subtitle: 'أنت على وشك حذف هذه الدورة بالكامل بكافة مصروفاتها ومبيعاتها وسجلاتها. لا يمكن استرجاع هذه البيانات بعد الحذف!',
    itemIcon: '🐔',
    itemTitle: `دورة: ${cycle.name}`,
    itemMeta: `العدد المستلم: ${f(cycle.n)} طائر • بدأت: ${fd(cycle.start)}`,
    warningNote: 'سيتم مسح كافة سجلات المصروفات، المبيعات، النافق، العلف، والديون المرتبطة بهذه الدورة نهائياً.',
    confirmBtnText: 'نعم، أنا متأكد - احذف الدورة بالكامل',
    onConfirm: () => {
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
  });
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
  const cycle = cur();
  if (!cycle) return;
  const kind = S.tab;

  if (kind === 'exp') {
    const e = cycle.exp[i];
    const isFeed = e.cat === 'علف' || e.feedRefId;
    const linkedFeed = isFeed ? (cycle.feed.find(f => f.id === e.feedRefId || f.expRefId === e.id)) : null;

    showConfirmModal({
      icon: '🗑️',
      title: 'تأكيد حذف المصروف ⚠️',
      subtitle: 'هل أنت متأكد من رغبتك في حذف هذا المصروف؟ سيتم خصم هذا المبلغ من إجمالي التكاليف.',
      itemIcon: isFeed ? '🌾' : '💸',
      itemTitle: `مصروف: ${e.cat} ${e.note ? '(' + e.note + ')' : ''}`,
      itemMeta: `المبلغ: ${f(e.amt)} ج • التاريخ: ${fd(e.d)}`,
      warningNote: linkedFeed ? `تنبيه: سيتم أيضاً حذف حركة توريد العلف من المخزن (${f(linkedFeed.kg)} كجم) تلقائياً لتحديث رصيد المخزن بدقة.` : '',
      confirmBtnText: 'نعم، احذف المصروف',
      onConfirm: () => {
        if (linkedFeed) {
          const feedIdx = cycle.feed.indexOf(linkedFeed);
          if (feedIdx !== -1) cycle.feed.splice(feedIdx, 1);
        }
        cycle.exp.splice(i, 1);
        saveData();
        showToast('تم حذف المصروف وتحديث رصيد المخزن بنجاح');
        render();
      }
    });
  } else if (kind === 'dead') {
    const e = cycle.dead[i];
    showConfirmModal({
      icon: '🗑️',
      title: 'تأكيد حذف تسجيل النافق ⚠️',
      subtitle: 'هل أنت متأكد من حذف هذا السجل للنافق؟ سيتم استرجاع عدد هذه الطيور للرصيد الحي المتبقي بالمزرعة.',
      itemIcon: '⚠️',
      itemTitle: `تسجيل نافق: ${e.n} طائر ${e.note ? '(' + e.note + ')' : ''}`,
      itemMeta: `التاريخ: ${fd(e.d)}`,
      confirmBtnText: 'نعم، احذف السجل',
      onConfirm: () => {
        cycle.dead.splice(i, 1);
        saveData();
        showToast('تم حذف تسجيل النافق واسترجاع الطيور');
        render();
      }
    });
  } else if (kind === 'feed') {
    const e = cycle.feed[i];
    const isPurchased = e.type === 'purchased';
    const linkedExp = isPurchased ? (cycle.exp.find(x => x.id === e.expRefId || x.feedRefId === e.id)) : null;

    showConfirmModal({
      icon: '🗑️',
      title: 'تأكيد حذف حركة العلف ⚠️',
      subtitle: 'هل أنت متأكد من حذف هذه الحركة؟ سيتم تحديث رصيد المخزن ومعامل التحويل تلقائياً.',
      itemIcon: isPurchased ? '📦' : '🌾',
      itemTitle: `${isPurchased ? 'علف وارد للمخزن' : 'علف مستهلك للطيور'}: ${e.txt || (e.q + ' ' + (e.unit || 'شكارة'))}`,
      itemMeta: `الكمية: ${f(e.kg)} كجم • التاريخ: ${fd(e.d)}`,
      warningNote: linkedExp ? `تنبيه: سيتم أيضاً حذف المصروف المالي المرتبط بهذا العلف (${f(linkedExp.amt)} ج) من المصروفات تلقائياً منعاً للازدواج.` : '',
      confirmBtnText: 'نعم، احذف حركة العلف',
      onConfirm: () => {
        if (linkedExp) {
          const expIdx = cycle.exp.indexOf(linkedExp);
          if (expIdx !== -1) cycle.exp.splice(expIdx, 1);
        }
        cycle.feed.splice(i, 1);
        saveData();
        showToast('تم حذف حركة العلف وتحديث المصروفات بنجاح');
        render();
      }
    });
  } else {
    cycle[kind].splice(i, 1);
    saveData();
    showToast('تم الحذف بنجاح');
    render();
  }
}

function closeC() {
  const cycle = cur();
  if (!cycle) return;

  showConfirmModal({
    icon: '🔒',
    title: 'تأكيد إغلاق الدورة رسمياً',
    subtitle: 'هل أنت متأكد من قفل هذه الدورة؟ سيتم تسجيل تاريخ اليوم كنهاية رسمية لانتهاء عمليات البيع والتسمين. (يمكنك دائماً مراجعة سجلاتها وأرباحها في أي وقت)',
    itemIcon: '🐔',
    itemTitle: `دورة: ${cycle.name}`,
    itemMeta: `عمر الدورة حتى اليوم: ${Math.max(1, Math.floor((new Date(today()) - new Date(cycle.start))/(1000*60*60*24))+1)} يوم`,
    confirmBtnText: 'نعم، إغلاق وقفل الدورة',
    onConfirm: () => {
      cycle.end = today();
      saveData();
      showToast('تم إغلاق الدورة بنجاح ✓');
      render();
    }
  });
}

// ==========================================================================
// 6. LIVE REAL-TIME CLOCK & THEME SWITCHER
// ==========================================================================
function updateLiveClock() {
  const now = new Date();
  
  const dateFormatted = now.toLocaleDateString('ar-EG-u-nu-latn', {
    timeZone: 'Africa/Cairo',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  const timeFormatted = now.toLocaleTimeString('ar-EG-u-nu-latn', {
    timeZone: 'Africa/Cairo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const dt = document.getElementById('dt');
  if (dt) {
    dt.textContent = `${dateFormatted} • ${timeFormatted} (توقيت مصر 🇪🇬)`;
  }

  const gr = document.getElementById('gr');
  if (gr) {
    const cairoHourStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      hour: 'numeric',
      hour12: false
    }).format(now);
    const hours = parseInt(cairoHourStr, 10);
    const greetingText = (hours >= 4 && hours < 12) ? 'صباح الخير والرزق' : 'مساء الخير والبركة';
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
  if (e.key === 'Escape') {
    closeM();
    closeConfirmModal();
  }
});

// Run Initial Render
render();
