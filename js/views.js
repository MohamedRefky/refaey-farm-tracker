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
                <div class="cycle-name">${esc(c.name)}</div>
                <div class="cycle-date">بدأت: ${fd(c.start)} ${isOngoing ? `• <b style="color:var(--emerald);">اليوم الـ ${Math.max(1, Math.floor((new Date(today()) - new Date(c.start)) / (1000 * 60 * 60 * 24)) + 1)}</b>` : (c.end ? `• استغرقت ${Math.max(1, Math.floor((new Date(c.end) - new Date(c.start)) / (1000 * 60 * 60 * 24)) + 1)} يوم` : '')}</div>
                ${(c.flocks && c.flocks.length) ? `
                  <div class="cycle-flocks-pills">
                    ${c.flocks.map(fl => `<span class="cycle-flock-pill">🐣 ${esc(fl.name)} (${f(fl.count)})</span>`).join('')}
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
  S.summary = false;
  S.editCycle = false;
  S.restock = false;
  S.restockFlockId = null;
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
    S.summary = false;
    S.editCycle = false;
    S.restock = false;
    S.restockFlockId = null;
    return list(a);
  }
  const k = calc(c);
  if (S.editCycle) {
    return editCyclePage(a, c);
  }
  if (S.restock) {
    return restockPage(a, c);
  }
  if (S.summary) {
    return summaryPage(a, c, k);
  }
  if (!['exp', 'inc', 'dead', 'debt'].includes(S.tab)) {
    S.tab = 'exp';
  }
  const isOngoing = !c.end;

  let h = `
    <!-- Top Nav with Summary & Edit Support -->
    <div class="detail-top-nav">
      <button class="back-btn" onclick="S.v='list'; S.summary=false; S.editCycle=false; S.restock=false; S.restockFlockId=null; render()">
        <span>→</span> <span class="nav-text">الدورات</span>
      </button>
      <div class="detail-nav-actions">
        <button class="print-btn" onclick="openCycleSummary()" title="ملخص وحسابات الدورة">
          <span>📊</span> <span>ملخص الدورة</span>
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
            <h2 class="hero-cycle-name">${esc(c.name)}</h2>
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
            (كتاكيت: ${f(k.chickCost)} ج + تشغيل: ${f(k.otherExp)} ج)
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

      ${renderPerChickHeroBox(k)}
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
          <button class="quick-action-btn" onclick="openFeedStocktakeModal()">
            <span class="quick-action-icon">📦</span>
            <span>جرد علف</span>
          </button>
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
        <button type="button" class="btn btn-sm btn-outline" onclick="openRestockModal()" style="border-color: var(--emerald); color: var(--emerald);">
          + إضافة كتاكيت
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
                  <b>${esc(fs.name)}</b>
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
                  ? `بيع: <b class="color-emerald">${f(fs.revenue)} ج</b> • تكلفة: <b>${f(fs.totalCost)} ج</b>${fs.remaining > 0 && fs.sold > 0 ? ` • المتبقي: <b class="color-amber">${fp(fs.remainingCostPerBird)} ج</b>` : (fs.live > 0 ? ` • الكتكوت: <b class="color-amber">${fp(fs.costPerLive)} ج</b>` : '')}`
                  : `تكلفة حتى الآن: <b>${f(fs.totalCost)} ج</b>${fs.live > 0 ? ` • الكتكوت: <b class="color-amber">${fp(fs.costPerLive)} ج</b>` : ''} • نافق: <b class="${fs.mort > 5 ? 'color-rose' : ''}">${f(fs.dead)}</b>`
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
                  ${renderFlockPerChickBox(fs)}
                  ${(fs.batches && fs.batches.length > 1) ? `
                    <div class="flock-batches-box" onclick="event.stopPropagation()">
                      <div class="flock-batches-title">📦 الدفعات المسجلة لهذا النوع (${fs.batches.length}):</div>
                      ${fs.batches.map((b, bIdx) => `
                        <div class="flock-batch-row">
                          <div class="flock-batch-info">
                            <b>دفعة ${bIdx + 1}</b> (${fds(b.d)}): ${f(b.count)} طائر • ${f(b.cost)} ج (${fp(b.count > 0 ? b.cost / b.count : 0)} ج/كتكوت)
                            ${bIdx > 0 || b.includeOld === false ? `
                              <span class="flock-batch-tag ${b.includeOld === false ? 'new-only' : 'with-old'}">
                                ${b.includeOld === false ? 'من الجاي بس' : 'شامل القديم'}
                              </span>
                            ` : ''}
                          </div>
                          <div class="record-icon-actions">
                            <button type="button" class="icon-action-btn" onclick="openEditBatchModal(${fs.id}, ${bIdx})" title="تعديل هذه الدفعة" aria-label="تعديل الدفعة" style="width:26px;height:26px;font-size:11px;">✏️</button>
                            <button type="button" class="icon-action-btn danger" onclick="delBatch(${fs.id}, ${bIdx})" title="حذف هذه الدفعة" aria-label="حذف الدفعة" style="width:26px;height:26px;font-size:11px;">🗑️</button>
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}
                  <div class="flock-details-actions" onclick="event.stopPropagation()">
                    <button type="button" class="labeled-action-btn pay" onclick="openRestockModal(${fs.id})">➕ زيادة عدد</button>
                    <button type="button" class="labeled-action-btn" onclick="openFlockModal(${fs.id})">✏️ تعديل</button>
                    ${((c.flocks || []).length > 1 && flockRecordCounts(c, fs.id).total === 0) ? `
                      <button type="button" class="labeled-action-btn danger" onclick="delFlock(${fs.id})">🗑️ حذف</button>
                    ` : ''}
                  </div>
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

// Helpers: Per-Chick Unit Cost Breakdown (Cycle Hero + Per-Flock Expanded)
function formatFlockChickPartsLine(fs, compact = false) {
  if (!fs || fs.live <= 0) return '<span class="color-rose">لا توجد طيور حية</span>';
  const catIcons = { 'دواء': '💊', 'غاز': '🔥', 'مصاريف أخرى': '📦' };
  const buyPart = fs.dead > 0
    ? `شراء: ${fp(fs.buyPerChick)} ج (بعد النافق: <b>${fp(fs.buyPerLive)} ج</b>)`
    : `شراء: <b>${fp(fs.buyPerChick)} ج</b>`;

  if (fs.sold > 0 && fs.remaining > 0) {
    if (compact) {
      return `
        <div class="per-chick-partial-split">
          <div>🟢 <b>المتبقي (${f(fs.remaining)} حي): ${fp(fs.remainingCostPerBird)} ج / كتكوت</b></div>
          <div>✅ <b>اللي اتباع (${f(fs.sold)} طائر): ${fp(fs.soldCostPerBird)} ج / كتكوت</b></div>
        </div>
      `;
    }
    return `
      <div class="per-chick-partial-split">
        <div>🟢 <b>المتبقي (${f(fs.remaining)} حي): ${fp(fs.remainingCostPerBird)} ج / كتكوت</b> <small>(${buyPart} • علف: <b>${fp(fs.remainingFeedPerBird)} ج</b>${fs.remainingOtherOpsPerBird > 0 ? ` • أخرى: <b>${fp(fs.remainingOtherOpsPerBird)} ج</b>` : ''})</small></div>
        <div>✅ <b>اللي اتباع (${f(fs.sold)} طائر): ${fp(fs.soldCostPerBird)} ج / كتكوت</b> <small>(${buyPart} • علف: <b>${fp(fs.soldFeedPerBird)} ج</b>${fs.soldOtherOpsPerBird > 0 ? ` • أخرى: <b>${fp(fs.soldOtherOpsPerBird)} ج</b>` : ''})</small></div>
      </div>
    `;
  }

  const parts = [
    buyPart,
    `علف: <b>${fp(fs.feedPerLive)} ج</b>`
  ];

  const extraCats = Object.entries(fs.sharedByCat || {})
    .filter(([cat, val]) => cat !== 'علف' && val > 0);
  if (extraCats.length) {
    extraCats.forEach(([cat, val]) => {
      parts.push(`${catIcons[cat] || '💸'} ${esc(cat)}: <b>${fp(val / fs.live)} ج</b>`);
    });
  } else if (fs.otherOpsPerLive > 0) {
    parts.push(`مصاريف أخرى: <b>${fp(fs.otherOpsPerLive)} ج</b>`);
  }
  return parts.join(' • ');
}

function renderPerChickHeroBox(k) {
  if (!k || k.chickCount <= 0) return '';
  if (k.live <= 0) {
    return `
      <div class="per-chick-summary-box">
        <div class="per-chick-summary-top">
          <span>💵 تكلفة الكتكوت الواحد</span>
          <span class="color-rose">لا توجد طيور حية (الكل نافق)</span>
        </div>
      </div>
    `;
  }

  const isMultiFlock = (k.flockStats || []).length > 1;
  if (isMultiFlock) {
    return `
      <div class="per-chick-summary-box">
        <div class="per-chick-summary-top" style="margin-bottom: 8px;">
          <div class="per-chick-summary-label">
            <span>💵 تكلفة الكتكوت الواحد لكل نوع</span>
            <small>كل نوع محسوب لوحده بمصاريفه ونافقُه</small>
          </div>
        </div>
        <div class="per-chick-multi-list">
          ${k.flockStats.map(fs => `
            <div class="per-chick-multi-card">
              <div class="per-chick-multi-head">
                <div class="per-chick-multi-name">
                  <b>🐣 ${esc(fs.name)}</b>
                  <small>${f(fs.live)} حي${fs.dead > 0 ? ` • <span class="color-rose">نافق ${f(fs.dead)}</span>` : ''}</small>
                </div>
                <div class="per-chick-total-badge">
                  <b>${fs.live > 0 ? fp(fs.remaining > 0 && fs.sold > 0 ? fs.remainingCostPerBird : fs.costPerLive) + ' ج' : '—'}</b>
                  <span>${fs.remaining > 0 && fs.sold > 0 ? '/ متبقي' : '/ كتكوت'}</span>
                </div>
              </div>
              <div class="per-chick-multi-parts">
                ${formatFlockChickPartsLine(fs, true)}
                ${fs.dead > 0 && fs.live > 0 ? `<div style="margin-top:3px; color:var(--text-dim); font-size:10.5px;">💡 نصيب الكتكوت من الشراء والمصاريف زاد بسبب النافق (${f(fs.dead)} طائر)</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  const singleFs = (k.flockStats && k.flockStats[0]) || null;
  if (singleFs && singleFs.sold > 0 && singleFs.remaining > 0) {
    return `
      <div class="per-chick-summary-box">
        <div class="per-chick-summary-top" style="margin-bottom: 8px;">
          <div class="per-chick-summary-label">
            <span>💵 تكلفة الكتكوت الواحد (قبل وبعد البيع الجزئي)</span>
            <small>المتبقي قعد أيام أكتر فبيزيد نصيبه من المصاريف</small>
          </div>
          <div class="per-chick-total-badge">
            <b>${fp(singleFs.remainingCostPerBird)} ج</b>
            <span>/ متبقي</span>
          </div>
        </div>
        ${formatFlockChickPartsLine(singleFs, true)}
        ${k.dead > 0 ? `
          <div class="per-chick-mort-note">
            💡 نصيب الكتكوت من الشراء والمصاريف زاد بسبب النافق (${f(k.dead)} طائر) لأن التكلفة اتقسمت على الـ ${f(k.live)} كتكوت الحي الآن.
          </div>
        ` : ''}
      </div>
    `;
  }

  const catIcons = { 'دواء': '💊', 'غاز': '🔥', 'مصاريف أخرى': '📦' };
  const otherCatsParts = Object.entries(k.expByCat || {})
    .filter(([cat, val]) => cat !== 'علف' && val > 0)
    .map(([cat, val]) => `${catIcons[cat] || '💸'} ${esc(cat)}: ${fp(val / k.live)} ج`);

  return `
    <div class="per-chick-summary-box">
      <div class="per-chick-summary-top">
        <div class="per-chick-summary-label">
          <span>💵 تكلفة الكتكوت الواحد حتى الآن</span>
          <small>محسوبة على الـ ${f(k.live)} كتكوت الحي الآن</small>
        </div>
        <div class="per-chick-total-badge">
          <b>${fp(k.cpb)} ج</b>
          <span>/ كتكوت</span>
        </div>
      </div>

      <div class="per-chick-grid">
        <div class="per-chick-cell">
          <span class="per-chick-cell-lbl">🐣 شراء الكتكوت</span>
          <b class="per-chick-cell-val">${fp(k.buyPerLive)} ج</b>
          <small class="per-chick-cell-sub">${k.dead > 0 ? `اشتريته بـ ${fp(k.buyPerChick)} ج وزاد بعد النافق` : `من ${f(k.chickCost)} ج`}</small>
        </div>
        <div class="per-chick-cell">
          <span class="per-chick-cell-lbl">🌾 نصيب العلف</span>
          <b class="per-chick-cell-val">${fp(k.feedPerLive)} ج</b>
          <small class="per-chick-cell-sub">من ${f(k.feedCostTotal)} ج علف</small>
        </div>
        <div class="per-chick-cell">
          <span class="per-chick-cell-lbl">💊 باقي المصاريف</span>
          <b class="per-chick-cell-val">${fp(k.otherOpsPerLive)} ج</b>
          <small class="per-chick-cell-sub">${otherCatsParts.length ? otherCatsParts.join(' • ') : 'دواء / غاز / أخرى'}</small>
        </div>
      </div>

      ${k.dead > 0 ? `
        <div class="per-chick-mort-note">
          💡 نصيب الكتكوت من الشراء والمصاريف زاد بسبب النافق (${f(k.dead)} طائر) لأن التكلفة اتقسمت على الـ ${f(k.live)} كتكوت الحي الآن.
        </div>
      ` : ''}
    </div>
  `;
}

function renderFlockPerChickBox(fs) {
  if (!fs || fs.live <= 0) {
    return `
      <div class="flock-perchick-box" onclick="event.stopPropagation()">
        <div class="flock-perchick-head">
          <span>💵 تكلفة الكتكوت الواحد (${esc(fs.name)}):</span>
          <b class="color-rose">لا توجد طيور حية</b>
        </div>
      </div>
    `;
  }

  if (fs.sold > 0 && fs.remaining > 0) {
    return `
      <div class="flock-perchick-box" onclick="event.stopPropagation()">
        <div class="flock-perchick-head">
          <span>💵 تكلفة الكتكوت (${esc(fs.name)}) — قبل وبعد البيع الجزئي</span>
          <b class="flock-perchick-total">${fp(fs.remainingCostPerBird)} ج / متبقي</b>
        </div>
        <div class="flock-perchick-rows">
          <div class="flock-perchick-row">
            <span>🟢 <b>الكتكوت المتبقي الآن (${f(fs.remaining)} حي):</b></span>
            <span><b>${fp(fs.remainingCostPerBird)} ج</b></span>
          </div>
          <div class="flock-perchick-row" style="padding-inline-start: 10px;">
            <span>شراء: ${fs.dead > 0 ? `${fp(fs.buyPerChick)} ج ← ${fp(fs.buyPerLive)} ج` : `${fp(fs.buyPerChick)} ج`} • علف: ${fp(fs.remainingFeedPerBird)} ج • مصاريف أخرى: ${fp(fs.remainingOtherOpsPerBird)} ج</span>
          </div>
          <div class="flock-perchick-row" style="margin-top:4px; padding-top:4px; border-top:1px dashed var(--border-subtle);">
            <span>✅ <b>الكتكوت اللي اتباع (${f(fs.sold)} طائر):</b></span>
            <span><b>${fp(fs.soldCostPerBird)} ج</b></span>
          </div>
          <div class="flock-perchick-row" style="padding-inline-start: 10px;">
            <span>شراء: ${fs.dead > 0 ? `${fp(fs.buyPerChick)} ج ← ${fp(fs.buyPerLive)} ج` : `${fp(fs.buyPerChick)} ج`} • علف: ${fp(fs.soldFeedPerBird)} ج • مصاريف أخرى: ${fp(fs.soldOtherOpsPerBird)} ج</span>
          </div>
          ${fs.dead > 0 ? `
            <div class="per-chick-mort-note" style="margin-top:4px;">
              💡 نصيب الكتكوت زاد بسبب النافق (${f(fs.dead)} طائر) لأن التكلفة اتقسمت على الـ ${f(fs.live)} كتكوت الحي بدل ${f(fs.count)}.
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  const catIcons = { 'دواء': '💊', 'غاز': '🔥', 'مصاريف أخرى': '📦' };
  const extraCats = Object.entries(fs.sharedByCat || {})
    .filter(([cat, val]) => cat !== 'علف' && val > 0);

  return `
    <div class="flock-perchick-box" onclick="event.stopPropagation()">
      <div class="flock-perchick-head">
        <span>💵 تكلفة الكتكوت الواحد (${esc(fs.name)}) على الـ ${f(fs.live)} كتكوت الحي الآن</span>
        <b class="flock-perchick-total">${fp(fs.costPerLive)} ج</b>
      </div>
      <div class="flock-perchick-rows">
        <div class="flock-perchick-row">
          <span>🐣 نصيب الكتكوت من الشراء</span>
          <span>
            ${fs.dead > 0
              ? `<small>اشتريت بـ ${fp(fs.buyPerChick)} ج ← بعد النافق:</small> <b>${fp(fs.buyPerLive)} ج</b>`
              : `<b>${fp(fs.buyPerChick)} ج</b> <small>(${f(fs.cost)} ج إجمالي)</small>`
            }
          </span>
        </div>
        <div class="flock-perchick-row">
          <span>🌾 نصيب الكتكوت من العلف</span>
          <span><b>${fp(fs.feedPerLive)} ج</b> <small>(${f(fs.feedCost)} ج إجمالي)</small></span>
        </div>
        ${extraCats.length ? extraCats.map(([cat, val]) => `
          <div class="flock-perchick-row">
            <span>${catIcons[cat] || '💸'} نصيب الكتكوت من ${esc(cat)}</span>
            <span><b>${fp(val / fs.live)} ج</b> <small>(${f(val)} ج إجمالي)</small></span>
          </div>
        `).join('') : `
          <div class="flock-perchick-row">
            <span>💊 باقي المصاريف (دواء/غاز/أخرى)</span>
            <span><b>${fp(fs.otherOpsPerLive)} ج</b></span>
          </div>
        `}
        ${fs.dead > 0 ? `
          <div class="per-chick-mort-note" style="margin-top:4px;">
            💡 نصيب الكتكوت زاد بسبب النافق (${f(fs.dead)} طائر) لأن التكلفة اتقسمت على الـ ${f(fs.live)} كتكوت الحي الآن بدل ${f(fs.count)}.
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function toggleFlockDetails(id) {
  S.openFlocks[id] = !S.openFlocks[id];
  render();
}

function openCycleSummary() {
  S.editCycle = false;
  S.restock = false;
  S.restockFlockId = null;
  S.summary = true;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeCycleSummary() {
  S.summary = false;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Full-page clean Cycle Summary view (replaces cramped reports modal)
function summaryPage(a, c, k) {
  const hasSales = k.sold > 0 || k.totalSales > 0;
  const netLabel = !hasSales
    ? 'المصروف حتى الآن (لم تبدأ المبيعات)'
    : (k.p >= 0 ? 'صافي المكسب حتى الآن' : 'صافي الخسارة حتى الآن');
  const netVal = !hasSales ? f(k.e) : f(Math.abs(k.p));
  const netCls = !hasSales ? '' : (k.p >= 0 ? 'color-emerald' : 'color-rose');

  a.innerHTML = `
    <div class="detail-top-nav">
      <button class="back-btn" onclick="closeCycleSummary()">
        <span>→</span> <span>رجوع للدورة</span>
      </button>
      <span class="badge ${!c.end ? 'badge-active' : 'badge-closed'}">
        ${!c.end ? 'شغالة الآن' : 'مكتملة'}
      </span>
    </div>

    <div class="card hero-card">
      <div class="hero-label">
        <span>📊</span> ملخص حسابات: ${esc(c.name)}
      </div>
      <div class="hero-substat-label" style="margin-bottom: 10px;">
        ${netLabel}
      </div>
      <div class="hero-big-number ${netCls}">
        <span class="money-privacy-value">${netVal}</span> <small>جنيه مصري</small>
      </div>

      <div class="hero-stats-row">
        <div class="hero-substat">
          <span class="hero-substat-label">إجمالي المبيعات</span>
          <span class="hero-substat-value color-emerald">${f(k.totalSales)} ج</span>
        </div>
        <div class="hero-substat">
          <span class="hero-substat-label">إجمالي التكلفة</span>
          <span class="hero-substat-value color-rose">${f(k.e)} ج</span>
          <small style="display:block; font-size:11px; color:var(--text-dim); margin-top:2px;">
            (كتاكيت: ${f(k.chickCost)} ج + مصاريف: ${f(k.otherExp)} ج)
          </small>
        </div>
        ${k.debtUsRemaining > 0 ? `
          <div class="hero-substat">
            <span class="hero-substat-label">مستحقات لينا بره</span>
            <span class="hero-substat-value color-amber">${f(k.debtUsRemaining)} ج</span>
          </div>
        ` : ''}
      </div>
    </div>

    <div class="card">
      <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 12px; color: var(--text-title);">
        💵 تكلفة الكتكوت الواحد لكل نوع
      </h3>
      <div class="summary-perchick-list">
        ${(k.flockStats || []).map(fs => `
          <div class="summary-perchick-row">
            <div class="summary-perchick-title">
              <b>🐣 ${esc(fs.name)}${fs.dead > 0 ? ` <small class="color-rose" style="font-weight:700;">(نافق ${f(fs.dead)})</small>` : ''}</b>
              <span class="summary-perchick-badge">${fs.live > 0 ? fp(fs.costPerLive) + ' ج / كتكوت' : '—'}</span>
            </div>
            <div class="summary-perchick-meta">
              ${formatFlockChickPartsLine(fs)}
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    ${renderAnalyticsTab(c, k)}

    <button class="btn btn-outline btn-full" onclick="closeCycleSummary()" style="margin-top: 8px;">
      → العودة لصفحة الدورة
    </button>
  `;
}
