/**
 * Refaey Farm Tracker - Application Controller & UI Logic
 */

let S = { v: 'list', tab: 'exp' };

// Field schemas and render helpers for each transaction type
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
    t: 'إيراد (حركة بيع)',
    icon: '📈',
    f: [
      ['cnt', 'number', '', 'عدد الطيور المباعة'],
      ['kg', 'number', '', 'الوزن الإجمالي (كجم)'],
      ['amt', 'number', '', 'المبلغ المحصل (جنيه)'],
      ['buyer', 'text', '', 'اسم المشتري / التاجر']
    ],
    r: e => ['بيع ' + e.cnt + ' طائر ' + (e.buyer ? '(' + e.buyer + ')' : ''), f(e.amt) + ' ج']
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
    t: 'علف مستهلك',
    icon: '🌾',
    f: [
      ['unit', 'select', ['شكارة', 'كيلو'], 'الوحدة المستلمة'],
      ['q', 'number', '', 'الكمية']
    ],
    r: e => ['علف: ' + e.txt, f(e.kg) + ' كجم']
  },
  debt: {
    t: 'مديونية',
    icon: '📝',
    f: [
      ['dir', 'select', ['ليا عنده', 'عليا لحد'], 'نوع المديونية'],
      ['who', 'text', '', 'اسم الطرف الآخر (التاجر أو المورد)'],
      ['amt', 'number', '', 'المبلغ (جنيه)']
    ],
    r: e => [e.who + ' (' + e.dir + ')', f(e.amt) + ' ج']
  }
};

const tabs = [
  ['exp', '💸 المصروفات'],
  ['inc', '📈 المبيعات والإيراد'],
  ['dead', '⚠️ النفوق'],
  ['feed', '🌾 العلف'],
  ['debt', '📝 الديون'],
  ['ch', '📊 التحليل والتقارير']
];

// Helper: Get currently viewed cycle
const cur = () => C.find(c => c.id === S.v);

// Helper: Metric Box HTML
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
        <span>→</span> العودة لكل الدورات
      </button>
      <div style="display: flex; gap: 8px;">
        <button class="print-btn" onclick="editCycle()" title="تعديل بيانات الدورة">
          <span>✏️</span> تعديل الدورة
        </button>
        <button class="print-btn" onclick="window.print()" title="طباعة تقرير الدورة">
          <span>🖨️</span> طباعة كشف الدورة
        </button>
      </div>
    </div>

    <!-- Cycle Hero Summary -->
    <div class="card hero-card">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="cycle-icon-box" style="width: 50px; height: 50px; font-size: 24px;">🐔</div>
          <div>
            <h2 style="font-size: 24px; font-weight: 800; color: var(--text-title);">${c.name}</h2>
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
        ${k.p >= 0 ? 'صافي أرباح الدورة حتى الآن' : 'صافي الخسارة حتى الآن'}
      </div>
      <div class="hero-big-number ${k.p >= 0 ? 'color-emerald' : 'color-rose'}">
        ${f(Math.abs(k.p))} <small>جنيه مصري</small>
      </div>

      <div class="hero-stats-row">
        <div class="hero-substat">
          <span class="hero-substat-label">إجمالي المبيعات (وارد)</span>
          <span class="hero-substat-value color-emerald">${f(k.i)} ج</span>
        </div>
        <div class="hero-substat">
          <span class="hero-substat-label">إجمالي المصروفات (منصرف)</span>
          <span class="hero-substat-value color-rose">${f(k.e)} ج</span>
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
      <button class="quick-action-btn" onclick="quickAdd('feed')">
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
      ${statBox('المتبقي بالمزرعة', f(k.remaining), 'طيور حية', '🏠')}
    </div>

    <!-- Production Efficiency & Cost Grid -->
    <div class="section-title">
      <span>مؤشرات الكفاءة والتكلفة الحيوية</span>
    </div>
    <div class="stats-grid">
      ${statBox('تكلفة الطائر', f(k.cpb) + ' ج', 'المصروف ÷ الحي', '💵')}
      ${statBox('ربح الطائر', f(k.ppb) + ' ج', 'الربح ÷ المباع', '📈', k.ppb >= 0 ? 'color-emerald' : 'color-rose')}
      ${statBox('العلف المستهلك', f(k.fk) + ' كجم', 'إجمالي المشترى', '🌾')}
      ${statBox('معامل التحويل (FCR)', k.fcr ? k.fcr.toFixed(2) : '-', 'المثالي أقل من 1.6', '⚖️', k.fcr && k.fcr <= 1.6 ? 'color-emerald' : 'color-amber')}
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

  // Render Active Tab Content
  if (S.tab === 'ch') {
    const by = {};
    c.exp.forEach(e => {
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

    h += `
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
  } else {
    const T = K[S.tab];
    const arr = c[S.tab] || [];

    h += `
      <button class="btn btn-primary btn-full" onclick="openForm('${S.tab}')">
        <span>+</span> إضافة ${T.t} جديد
      </button>
    `;

    if (S.tab === 'feed') {
      h += `
        <div class="card" style="margin-top: 14px; padding: 16px;">
          <label style="margin-top: 0;">وزن الشكارة الافتراضي (كجم):</label>
          <input type="number" value="${bagKg}" onchange="bagKg = +this.value || 50" style="max-width: 140px;">
        </div>
      `;
    }

    h += `
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
                <span class="record-value">${r[1]}</span>
                <div class="record-actions">
                  <button class="btn btn-sm btn-outline" onclick="openForm('${S.tab}', ${i})" title="تعديل هذا التسجيل">✏️ تعديل</button>
                  ${S.tab === 'debt' ? `
                    <button class="btn btn-sm ${e.paid ? 'btn-outline' : 'btn-primary'}" onclick="pay(${i})">
                      ${e.paid ? 'اتسدد ✓' : 'سدّد الآن'}
                    </button>
                  ` : ''}
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

// Quick 1-tap add handler: switches tab and opens form immediately
function quickAdd(kind) {
  S.tab = kind;
  openForm(kind);
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
// 3. MODAL & FORMS (Simple, Fast & Guided)
// ==========================================================================
const m = document.getElementById('m');
const fm = document.getElementById('fm');

function openForm(kind, editIndex = null) {
  const T = K[kind];
  const isEdit = editIndex !== null;
  const existing = isEdit ? cur()[kind][editIndex] : null;

  let h = `
    <div class="form-header">
      <div class="form-title">${isEdit ? 'تعديل' : 'إضافة'} ${T.t}</div>
      <button type="button" class="btn btn-sm btn-outline" onclick="closeM()">✕</button>
    </div>
    
    <label>التاريخ</label>
    <input type="date" id="f_d" value="${isEdit && existing && existing.d ? existing.d : today()}">
  `;

  T.f.forEach(x => {
    h += `<label>${x[3]}</label>`;
    let val = isEdit && existing && existing[x[0]] !== undefined ? existing[x[0]] : '';

    if (kind === 'feed' && isEdit && existing) {
      if (x[0] === 'unit') {
        val = existing.unit || (existing.txt && existing.txt.includes('شكارة') ? 'شكارة' : 'كيلو');
      } else if (x[0] === 'q') {
        val = existing.q !== undefined ? existing.q : (val === 'شكارة' || (existing.txt && existing.txt.includes('شكارة')) ? existing.kg / bagKg : existing.kg);
      }
    }

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

  h += `
    <div style="display: flex; gap: 10px; margin-top: 24px;">
      <button class="btn btn-primary" style="flex: 2;" type="submit">${isEdit ? 'حفظ التعديلات' : 'حفظ البيانات'}</button>
      <button class="btn btn-outline" style="flex: 1;" type="button" onclick="closeM()">إلغاء</button>
    </div>
  `;

  fm.innerHTML = h;
  fm.onsubmit = ev => {
    ev.preventDefault();
    const o = isEdit ? { ...existing } : {};
    o.d = document.getElementById('f_d').value || today();

    T.f.forEach(x => {
      const el = document.getElementById('f_' + x[0]);
      o[x[0]] = x[1] === 'number' ? (+el.value || 0) : el.value;
    });

    if (kind === 'feed') {
      o.kg = o.unit === 'شكارة' ? o.q * bagKg : o.q;
      o.txt = o.q + ' ' + o.unit;
    }
    if (kind === 'debt' && !isEdit) {
      o.paid = false;
    }

    if (isEdit) {
      cur()[kind][editIndex] = o;
      showToast(`تم تعديل ${T.t} بنجاح ✓`);
    } else {
      cur()[kind].push(o);
      showToast(`تمت إضافة ${T.t} بنجاح ✓`);
    }

    saveData();
    closeM();
    render();
  };

  m.classList.add('on');
}

function editCycle() {
  const c = cur();
  if (!c) return;

  fm.innerHTML = `
    <div class="form-header">
      <div class="form-title">تعديل بيانات الدورة ✏️</div>
      <button type="button" class="btn btn-sm btn-outline" onclick="closeM()">✕</button>
    </div>

    <label>اسم الدورة</label>
    <input id="edit_nn" value="${c.name || ''}" placeholder="اسم الدورة">

    <label>تاريخ البدء</label>
    <input type="date" id="edit_ns" value="${c.start || today()}">

    <label>عدد الكتاكيت الأصلي المستلم</label>
    <input type="number" id="edit_nc" value="${c.n || 0}" inputmode="numeric" placeholder="مثلاً: 1000">

    <label>حالة الدورة</label>
    <select id="edit_status">
      <option value="ongoing" ${!c.end ? 'selected' : ''}>شغالة الآن (جارية)</option>
      <option value="closed" ${c.end ? 'selected' : ''}>مقفولة (مكتملة)</option>
    </select>

    <div style="display: flex; gap: 10px; margin-top: 24px;">
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
    const nn = document.getElementById('edit_nn');
    const ns = document.getElementById('edit_ns');
    const nc = document.getElementById('edit_nc');
    const st = document.getElementById('edit_status');

    c.name = nn.value.trim() || c.name;
    c.start = ns.value || c.start;
    c.n = +nc.value || 0;

    if (st.value === 'closed' && !c.end) {
      c.end = today();
    } else if (st.value === 'ongoing') {
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

    <label>اسم الدورة (مثال: دورة نوفمبر، دفعة رقم 3)</label>
    <input id="nn" value="دورة جديدة" placeholder="اسم الدورة">

    <label>تاريخ استلام الكتاكيت (البداية)</label>
    <input type="date" id="ns" value="${today()}">

    <label>عدد الكتاكيت المستلمة</label>
    <input type="number" id="nc" inputmode="numeric" placeholder="مثلاً: 1000">

    <div style="display: flex; gap: 10px; margin-top: 24px;">
      <button class="btn btn-primary" style="flex: 2;" type="submit">إنشاء الدورة</button>
      <button class="btn btn-outline" style="flex: 1;" type="button" onclick="closeM()">إلغاء</button>
    </div>
  `;

  fm.onsubmit = ev => {
    ev.preventDefault();
    const nn = document.getElementById('nn');
    const ns = document.getElementById('ns');
    const nc = document.getElementById('nc');

    const newObj = {
      id: nid++,
      name: nn.value.trim() || 'دورة بدون اسم',
      start: ns.value || today(),
      end: null,
      n: +nc.value || 0,
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

function pay(i) {
  const e = cur().debt[i];
  e.paid = !e.paid;
  saveData();
  showToast(e.paid ? 'تم تسجيل سداد الدين بنجاح ✓' : 'تم إلغاء السداد');
  render();
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
// 4. LIVE REAL-TIME DATE & CLOCK (تحديث التاريخ والساعة لحظياً)
// ==========================================================================
function updateLiveClock() {
  const now = new Date();
  
  // Format Date (العربية المحلية بدقة)
  const dateFormatted = now.toLocaleDateString('ar-EG-u-nu-latn', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  // Format Time (الساعة والدقيقة الحية)
  const timeFormatted = now.toLocaleTimeString('ar-EG-u-nu-latn', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const dt = document.getElementById('dt');
  if (dt) {
    dt.textContent = `${dateFormatted} • ${timeFormatted}`;
  }

  // Live Greeting based on current hour
  const gr = document.getElementById('gr');
  if (gr) {
    const hours = now.getHours();
    const greetingText = hours < 12 ? 'صباح الخير والرزق' : 'مساء الخير والبركة';
    gr.innerHTML = `${greetingText} يا رفاعي <span class="chick-anim">🐥</span>`;
  }
}

// Run immediately and update every 10 seconds
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
