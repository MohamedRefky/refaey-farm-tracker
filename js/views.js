/**
 * Refaey Farm Tracker - Views & Screens Module
 * Handles top-level page views: Cycles Master List, Cycle Detail Dashboard, and Metric Cards.
 */

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
        <span class="money-privacy-value">${f(tot)}</span> <small>جنيه مصري</small>
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
        <span class="money-privacy-value">${f(Math.abs(k.p))}</span> <small>جنيه مصري</small>
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
