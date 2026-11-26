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
                ${(c.flocks && c.flocks.length) ? `
                  <div class="cycle-flocks-pills">
                    ${c.flocks.map(fl => `<span class="cycle-flock-pill">🐣 ${fl.name} (${f(fl.count)})</span>`).join('')}
                  </div>
                ` : ''}
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
  S.expFilter = 'all';
  S.incFilter = 'all';
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
  if (!['exp', 'inc', 'dead', 'debt'].includes(S.tab)) {
    S.tab = 'exp';
  }
  const k = calc(c);
  const isOngoing = !c.end;

  let h = `
    <!-- Top Nav with Reports & Edit Support -->
    <div class="detail-top-nav">
      <button class="back-btn" onclick="S.v='list'; render()">
        <span>→</span> <span class="nav-text">الدورات</span>
      </button>
      <div class="detail-nav-actions">
        <button class="print-btn" onclick="openReportsModal()" title="التقارير والرسوم البيانية">
          <span>📊</span> <span>التقارير</span>
        </button>
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
        </div>
        <div class="hero-substat">
          <span class="hero-substat-label">إجمالي المصروفات</span>
          <span class="hero-substat-value color-rose">${f(k.e)} ج</span>
          <small style="display:block; font-size:11px; color:var(--text-dim); margin-top:2px;">
            (كتاكيت: ${f(k.chickCost)} + تشغيل: ${f(k.otherExp)})
          </small>
        </div>
      </div>

      <div class="hero-flock-strip">
        <div class="hero-strip-item">
          <span>🐣 الأصل</span>
          <b>${f(c.n)}</b>
        </div>
        <div class="hero-strip-item">
          <span>🏠 متبقي</span>
          <b class="color-emerald">${f(k.remaining)}</b>
        </div>
        <div class="hero-strip-item">
          <span>⚠️ نافق</span>
          <b class="${k.mort > 5 ? 'color-rose' : ''}">${f(k.dead)} (${k.mort.toFixed(1)}%)</b>
        </div>
        <div class="hero-strip-item">
          <span>🌾 علف</span>
          <b>${f(k.feedPurchasedKg)} كجم</b>
        </div>
      </div>
    </div>

    <!-- ⚡ UNIFIED QUICK ACTION HUB (بدون تكرار - كل الأزرار في مكان واحد واضح) -->
    <div class="card action-hub-card">
      <div class="action-hub-group">
        <div class="action-hub-label">
          <span>💸 تسجيل مصروف للدورة</span>
          <small>يتقسم على الأنواع تلقائياً</small>
        </div>
        <div class="quick-actions-bar expense-quick-actions">
          <button class="quick-action-btn" onclick="openExpenseWithCat('علف')">
            <span class="quick-action-icon">🌾</span>
            <span>+ علف</span>
          </button>
          <button class="quick-action-btn" onclick="openExpenseWithCat('دواء')">
            <span class="quick-action-icon">💊</span>
            <span>+ دواء</span>
          </button>
          <button class="quick-action-btn" onclick="openExpenseWithCat('غاز')">
            <span class="quick-action-icon">🔥</span>
            <span>+ غاز</span>
          </button>
          <button class="quick-action-btn" onclick="openExpenseWithCat('مصاريف أخرى')">
            <span class="quick-action-icon">📦</span>
            <span>+ أخرى</span>
          </button>
        </div>
      </div>

      <div class="action-hub-group" style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--border-subtle);">
        <div class="action-hub-label">
          <span>⚡ تسجيل حركة</span>
        </div>
        <div class="quick-actions-bar other-quick-actions">
          <button class="quick-action-btn" onclick="quickAdd('inc')">
            <span class="quick-action-icon">📈</span>
            <span>+ بيع</span>
          </button>
          <button class="quick-action-btn" onclick="quickAdd('dead')">
            <span class="quick-action-icon">⚠️</span>
            <span>+ نافق</span>
          </button>
          <button class="quick-action-btn" onclick="quickAdd('debt')">
            <span class="quick-action-icon">📝</span>
            <span>+ مستحقات</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 🐔 COMPACT PER-FLOCK BREAKDOWN CARD (2 slim lines per type, tap for details) -->
    <div class="card flock-summary-card">
      <div class="flock-card-top">
        <span style="font-size: 15px; font-weight: 800; color: var(--text-title);">🐔 أنواع الفراخ بالقطيع</span>
        <button type="button" class="btn btn-sm btn-outline" onclick="openAddFlockModal()" style="border-color: var(--emerald); color: var(--emerald);">
          + نوع جديد
        </button>
      </div>

      <div class="flock-slim-list">
        ${k.flockStats.map(fs => {
          const hasSales = fs.sold > 0 || fs.revenue > 0;
          const isExpanded = !!S.openFlocks[fs.id];
          const rightText = !hasSales
            ? 'لم يُبع بعد'
            : (fs.profit >= 0 ? `+${f(fs.profit)} ج` : `-${f(Math.abs(fs.profit))} ج`);
          const rightCls = !hasSales
            ? 'flock-status-muted'
            : (fs.profit >= 0 ? 'color-emerald' : 'color-rose');

          return `
            <div class="flock-slim-item ${isExpanded ? 'expanded' : ''}" onclick="toggleFlockDetails(${fs.id})">
              <div class="flock-slim-main">
                <div class="flock-slim-name">
                  <span>🐣</span>
                  <b>${fs.name}</b>
                  <span class="flock-rem-pill ${fs.remaining === 0 ? 'done' : ''}">
                    ${fs.remaining > 0 ? `متبقي ${f(fs.remaining)} / ${f(fs.count)}` : `تم البيع ✓`}
                  </span>
                </div>
                <div class="flock-slim-result ${rightCls}">
                  <span>${rightText}</span>
                  <span class="flock-chevron">${isExpanded ? '▴' : '▾'}</span>
                </div>
              </div>

              <div class="flock-slim-sub">
                ${hasSales
                  ? `بيع: <b class="color-emerald">${f(fs.revenue)} ج</b> • تكلفة: <b>${f(fs.totalCost)} ج</b>`
                  : `تكلفة حتى الآن: <b>${f(fs.totalCost)} ج</b> • نافق: <b class="${fs.mort > 5 ? 'color-rose' : ''}">${f(fs.dead)}</b>`
                }
              </div>

              ${isExpanded ? `
                <div class="flock-slim-details">
                  <span>الأصل: <b>${f(fs.count)}</b></span>
                  <span>•</span>
                  <span>مباع: <b class="color-emerald">${f(fs.sold)}</b></span>
                  <span>•</span>
                  <span>نافق: <b class="${fs.mort > 5 ? 'color-rose' : ''}">${f(fs.dead)}</b></span>
                  <span class="flock-details-break">ثمن الكتاكيت: <b>${f(fs.cost)} ج</b> • نصيب المصاريف: <b>${f(fs.sharedCost)} ج</b></span>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Navigation Tabs (All 6 tabs visible in a clean grid) -->
    <div class="tabs-container">
      ${tabs.map(t => `
        <button class="tab-pill ${S.tab === t[0] ? 'active' : ''}" onclick="S.tab='${t[0]}'; render()">
          ${t[1]}
        </button>
      `).join('')}
    </div>
  `;

  // Render Content based on Active Tab (4 clean core tabs)
  if (S.tab === 'inc') {
    h += renderSalesTab(c, k);
  } else if (S.tab === 'debt') {
    h += renderDebtTab(c, k);
  } else if (S.tab === 'dead') {
    h += renderDeadTab(c, k);
  } else {
    h += renderExpensesTab(c, k);
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

function toggleFlockDetails(id) {
  S.openFlocks[id] = !S.openFlocks[id];
  render();
}

function openReportsModal() {
  const c = cur();
  if (!c) return;
  const k = calc(c);
  const { m: modal, fm: formEl } = ensureModalElements();
  if (!modal || !formEl) return;

  formEl.innerHTML = `
    <div class="form-header">
      <div class="form-title">📊 تقارير وملخص الدورة</div>
      <button type="button" class="btn btn-sm btn-outline" onclick="closeM()">✕</button>
    </div>
    ${renderAnalyticsTab(c, k)}
    <div class="form-actions-row">
      <button class="btn btn-outline btn-full" type="button" onclick="closeM()">إغلاق</button>
    </div>
  `;
  formEl.onsubmit = ev => { ev.preventDefault(); closeM(); };
  modal.classList.add('on');
}
