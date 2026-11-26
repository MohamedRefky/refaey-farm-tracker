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
    <!-- Top Nav with Edit Support -->
    <div class="detail-top-nav">
      <button class="back-btn" onclick="S.v='list'; render()">
        <span>→</span> <span class="nav-text">العودة لكل الدورات</span>
      </button>
      <div class="detail-nav-actions">
        <button class="print-btn" onclick="editCycle()" title="تعديل بيانات الدورة">
          <span>✏️</span> <span>تعديل</span>
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

    <!-- 💸 EXPENSES QUICK ACTIONS (تسجيل المصروفات لوحدها بره) -->
    <div class="section-title" style="margin-top: 24px;">
      <span>💸 تسجيل المصروفات</span>
    </div>
    <div class="quick-actions-bar expense-quick-actions">
      <button class="quick-action-btn" onclick="openExpenseWithCat('علف')" title="تسجيل شراء علف">
        <span class="quick-action-icon">🌾</span>
        <span>+ علف</span>
      </button>
      <button class="quick-action-btn" onclick="openExpenseWithCat('كتاكيت')" title="تسجيل شراء كتاكيت">
        <span class="quick-action-icon">🐣</span>
        <span>+ كتاكيت</span>
      </button>
      <button class="quick-action-btn" onclick="openExpenseWithCat('دواء')" title="تسجيل شراء أدوية وبيطري">
        <span class="quick-action-icon">💊</span>
        <span>+ دواء</span>
      </button>
      <button class="quick-action-btn" onclick="openExpenseWithCat('غاز')" title="تسجيل غاز وتدفئة">
        <span class="quick-action-icon">🔥</span>
        <span>+ غاز</span>
      </button>
      <button class="quick-action-btn" onclick="openExpenseWithCat('مصاريف أخرى')" title="تسجيل مصاريف ونثريات أخرى">
        <span class="quick-action-icon">📦</span>
        <span>+ مصاريف أخرى</span>
      </button>
    </div>

    <!-- ⚡ OTHER ACTIONS BAR (تسجيل المعاملات) -->
    <div class="section-title">
      <span>⚡ تسجيل المعاملات</span>
    </div>
    <div class="quick-actions-bar">
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

    <!-- Production Efficiency & Cost Grid -->
    <div class="section-title">مؤشرات الكفاءة والتكلفة الحيوية</div>
    <div class="stats-grid">
      ${statBox('تكلفة الطائر الحي', f(k.cpb) + ' ج', 'المصروف ÷ الحي', '💵')}
      ${statBox('ربح الطائر المباع', f(k.ppb) + ' ج', (k.ppb >= 0 ? 'صافي مكسب الفرخة' : 'صافي عجز الفرخة'), '📈', k.ppb >= 0 ? 'color-emerald' : 'color-rose')}
      ${statBox('العلف المشترى', f(k.feedPurchasedKg) + ' كجم', ((k.feedPurchasedKg / bagKg).toFixed(1)) + ' شكارة تم شراؤها', '🌾')}
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
