/**
 * Refaey Farm Tracker - Data Layer & Persistence (Offline-First & Firebase-Ready)
 */

// HTML-escape user-entered strings before inserting into templates
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);
}

// Available expense categories (chick cost is tracked per flock type, not here)
const cats = ['علف', 'دواء', 'غاز', 'مصاريف أخرى'];

// Default sample data for demo/new users
const initialCycles = [
  {
    id: 1,
    name: 'دورة أغسطس',
    start: '2026-08-01',
    end: '2026-09-10',
    n: 1000,
    flocks: [
      { id: 101, name: 'ساسو', count: 500, cost: 9000 },
      { id: 102, name: 'كوب', count: 500, cost: 9000 }
    ],
    exp: [
      { id: 10, d: '2026-08-05', cat: 'علف', amt: 22000, note: '30 شكارة (بادي 23%)', feedRefId: 11 },
      { id: 3, d: '2026-08-20', cat: 'دواء', amt: 3500, note: 'تحصينات واستقبال' },
      { id: 20, d: '2026-08-25', cat: 'علف', amt: 26000, note: '34 شكارة (نامي 21%)', feedRefId: 13 },
      { id: 5, d: '2026-09-01', cat: 'مصاريف أخرى', amt: 4000, note: 'يوميات وعمالة' }
    ],
    inc: [
      { id: 1, d: '2026-09-08', flockId: 101, cnt: 480, amt: 43200, buyer: 'تاجر الأحد' },
      { id: 2, d: '2026-09-10', flockId: 102, cnt: 488, amt: 44500, buyer: 'محل الشرقية' }
    ],
    dead: [
      { id: 1, d: '2026-08-12', flockId: 101, n: 18 },
      { id: 2, d: '2026-08-28', flockId: 102, n: 12 }
    ],
    feed: [
      { id: 11, d: '2026-08-05', type: 'purchased', kg: 1500, q: 30, unit: 'شكارة (50 كجم)', txt: '30 شكارة (50 كجم) (بادي 23%)', note: 'بادي 23%', expRefId: 10 },
      { id: 13, d: '2026-08-25', type: 'purchased', kg: 1700, q: 34, unit: 'شكارة (50 كجم)', txt: '34 شكارة (50 كجم) (نامي 21%)', note: 'نامي 21%', expRefId: 20 }
    ],
    debt: [
      {
        id: 101,
        d: '2026-09-10',
        who: 'محل الشرقية',
        dir: 'لنا',
        amt: 4500,
        paidAmt: 1500,
        paid: false,
        note: 'باقي حساب بيع دفعة سبتمبر',
        payments: [{ d: '2026-09-12', amt: 1500, note: 'دفعة نقدية' }]
      }
    ]
  },
  {
    id: 2,
    name: 'دورة أكتوبر',
    start: '2026-10-01',
    end: null,
    n: 1000,
    flocks: [
      { id: 201, name: 'أبيض', count: 500, cost: 9500 },
      { id: 202, name: 'ساسو', count: 300, cost: 5700 },
      { id: 203, name: 'بلدي', count: 200, cost: 3600 }
    ],
    exp: [
      { id: 30, d: '2026-10-04', cat: 'علف', amt: 9000, note: 'علف بادي', feedRefId: 21 },
      { id: 31, d: '2026-10-12', cat: 'دواء', amt: 1800, note: 'فيتامينات ومضاد سموم' }
    ],
    inc: [],
    dead: [{ id: 21, d: '2026-10-10', flockId: 201, n: 9 }],
    feed: [
      { id: 21, d: '2026-10-04', type: 'purchased', kg: 600, q: 12, unit: 'شكارة (50 كجم)', txt: '12 شكارة (50 كجم) (بادي)', note: 'بادي', expRefId: 30 }
    ],
    debt: [
      {
        id: 201,
        d: '2026-10-15',
        who: 'أبو علي التاجر',
        dir: 'لنا',
        amt: 2000,
        paidAmt: 0,
        paid: false,
        note: 'حساب سابق',
        payments: []
      }
    ]
  }
];

// Persistent State Storage
const STORAGE_KEY = 'refaey_farm_cycles_v8';
const PENDING_SYNC_KEY = 'refaey_pending_sync_v1';
const LEGACY_STORAGE_KEYS = [];
let C = [];
let storageWriteFailed = false;
let hasPendingSync = false;
let cloudSyncHandler = null; // Future Firebase hook: setCloudSyncHandler(fn)

try {
  hasPendingSync = localStorage.getItem(PENDING_SYNC_KEY) === '1';
} catch (e) {
  hasPendingSync = false;
}

function setCloudSyncHandler(fn) {
  cloudSyncHandler = typeof fn === 'function' ? fn : null;
}

function markPendingSync() {
  hasPendingSync = true;
  try {
    localStorage.setItem(PENDING_SYNC_KEY, '1');
  } catch (e) {
    // Ignore secondary storage errors
  }
  if (typeof updateSyncStatusBanner === 'function') updateSyncStatusBanner();
}

function clearPendingSync() {
  hasPendingSync = false;
  try {
    localStorage.removeItem(PENDING_SYNC_KEY);
  } catch (e) {
    // Ignore
  }
  if (typeof updateSyncStatusBanner === 'function') updateSyncStatusBanner();
}

function flushPendingSync() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (typeof cloudSyncHandler === 'function') {
    Promise.resolve(cloudSyncHandler(C))
      .then(() => {
        const hadPending = hasPendingSync;
        clearPendingSync();
        if (hadPending && typeof showToast === 'function') {
          showToast('✅ عاد الإنترنت وتمت مزامنة البيانات المحفوظة');
        }
      })
      .catch(() => markPendingSync());
  } else if (hasPendingSync) {
    clearPendingSync();
    if (typeof showToast === 'function') {
      showToast('🟢 عاد الاتصال بالإنترنت — بياناتك محفوظة بأمان على جهازك');
    }
  } else if (typeof updateSyncStatusBanner === 'function') {
    updateSyncStatusBanner();
  }
}

// Keeps the legacy total count in sync with the flock types
function syncCycleCount(c) {
  if (!c) return 0;
  c.n = (c.flocks || []).reduce((s, f) => s + (+f.count || 0), 0);
  return c.n;
}

// Unique flock type names used before (for input suggestions)
function allFlockNames() {
  const names = [];
  C.forEach(c => (c.flocks || []).forEach(f => {
    const name = (f.name || '').trim();
    if (name && !names.includes(name)) names.push(name);
  }));
  return names;
}

// Keeps debt payments list, paidAmt, and paid status strictly consistent with total amt
function syncDebtPaymentsToAmount(debtObj) {
  if (!debtObj) return debtObj;
  const round2 = v => Math.round((+v || 0) * 100) / 100;
  const totalAmt = round2(Math.max(0, +debtObj.amt || 0));
  debtObj.amt = totalAmt;

  if (Array.isArray(debtObj.payments) && debtObj.payments.length > 0) {
    let payments = debtObj.payments
      .map(p => ({ ...p, amt: round2(Math.max(0, +p.amt || 0)) }))
      .filter(p => p.amt > 0);
    let sumPayments = round2(payments.reduce((s, p) => s + p.amt, 0));

    if (sumPayments > totalAmt) {
      let excess = round2(sumPayments - totalAmt);
      for (let idx = payments.length - 1; idx >= 0 && excess > 0; idx--) {
        const cut = round2(Math.min(payments[idx].amt, excess));
        payments[idx].amt = round2(payments[idx].amt - cut);
        excess = round2(excess - cut);
      }
      payments = payments.filter(p => p.amt > 0);
    }

    debtObj.payments = payments;
    debtObj.paidAmt = round2(payments.reduce((s, p) => s + p.amt, 0));
  } else {
    debtObj.payments = [];
    debtObj.paidAmt = round2(Math.min(totalAmt, Math.max(0, +(debtObj.paidAmt || 0))));
  }

  debtObj.paid = debtObj.paidAmt >= totalAmt;
  return debtObj;
}

function normalizeData(cycles) {
  if (!Array.isArray(cycles)) return [];
  cycles.forEach(c => {
    // Old versions stored chick cost as an expense. Capture it before normalizing.
    const legacyChickExpenses = (c.exp || []).filter(e => e.cat === 'كتاكيت');
    const legacyChickCost = legacyChickExpenses.reduce((s, e) => s + (+e.amt || 0), 0);

    // Normalize expenses to the 4 shared categories (chicks live in flocks now)
    c.exp = (c.exp || []).filter(e => e.cat !== 'كتاكيت').map(e => {
      let cat = e.cat;
      if (cat === 'أدوية وتحصينات' || cat === 'بيطري' || cat === 'أدوية') cat = 'دواء';
      else if (cat === 'كهرباء وغاز' || cat === 'تدفئة' || cat === 'كهرباء') cat = 'غاز';
      else if (cat === 'علف' || cat === 'دواء' || cat === 'غاز' || cat === 'مصاريف أخرى') { /* keep */ }
      else cat = 'مصاريف أخرى';
      return { ...e, cat };
    });

    // Normalize flock types (create one legacy type when upgrading old data)
    if (!Array.isArray(c.flocks) || c.flocks.length === 0) {
      const legacyCount = +c.n || 0;
      c.flocks = [{
        id: Date.now() + Math.floor(Math.random() * 1000),
        name: 'الدفعة الأساسية',
        count: legacyCount,
        cost: legacyChickCost
      }];
    } else {
      c.flocks = c.flocks.map((f, i) => ({
        ...f,
        id: f.id || Date.now() + i,
        name: (f.name || '').trim() || ('نوع ' + (i + 1)),
        count: +f.count || 0,
        cost: +f.cost || 0
      }));
    }

    const flockIds = c.flocks.map(f => f.id);
    syncCycleCount(c);

    // Normalize mortalities (always attached to a flock type)
    c.dead = (c.dead || []).map((d, i) => ({
      ...d,
      id: d.id || Date.now() + i,
      flockId: flockIds.includes(d.flockId) ? d.flockId : flockIds[0],
      n: +d.n || 0
    }));

    // Normalize sales (count-based and total sale value only)
    c.inc = (c.inc || []).map((e, i) => {
      const amt = +e.amt || +e.totalAmt || 0;
      return {
        ...e,
        id: e.id || Date.now() + i,
        flockId: flockIds.includes(e.flockId) ? e.flockId : flockIds[0],
        cnt: +e.cnt || 0,
        amt
      };
    });

    // Normalize feed (purchased / incoming feed only)
    c.feed = (c.feed || [])
      .filter(e => e.type !== 'consumed')
      .map((e, i) => ({
        ...e,
        id: e.id || Date.now() + i,
        type: 'purchased',
        kg: +e.kg || 0,
        q: e.q !== undefined ? +e.q : (+e.kg || 0) / (bagKg || 50),
        unit: e.unit || 'شكارة'
      }));

    // Normalize debts (receivables owed to us only)
    c.debt = (c.debt || []).map((d, i) => {
      const amt = +d.amt || 0;
      const paidAmt = d.paidAmt !== undefined ? +d.paidAmt : (d.paid ? amt : 0);
      return syncDebtPaymentsToAmount({
        ...d,
        id: d.id || Date.now() + i,
        dir: 'لنا',
        amt,
        paidAmt,
        payments: Array.isArray(d.payments) ? d.payments : []
      });
    });
  });
  return cycles;
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      C = normalizeData(JSON.parse(saved));
      return;
    }

    // First run on v7: migrate old data and keep a safety backup
    let raw = null;
    for (const key of LEGACY_STORAGE_KEYS) {
      const legacy = localStorage.getItem(key);
      if (legacy) {
        try {
          localStorage.setItem(key + '_backup', legacy);
        } catch (backupErr) {
          // Backup is best-effort; migration still proceeds
        }
        raw = JSON.parse(legacy);
        break;
      }
    }

    C = normalizeData(raw || JSON.parse(JSON.stringify(initialCycles)));
    saveData();
  } catch (e) {
    C = normalizeData(JSON.parse(JSON.stringify(initialCycles)));
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(C));
    storageWriteFailed = false;

    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (isOffline) {
      markPendingSync();
    } else if (typeof cloudSyncHandler === 'function') {
      Promise.resolve(cloudSyncHandler(C))
        .then(() => clearPendingSync())
        .catch(() => markPendingSync());
    } else if (typeof updateSyncStatusBanner === 'function') {
      updateSyncStatusBanner();
    }
    return true;
  } catch (err) {
    console.error('Storage error', err);
    storageWriteFailed = true;
    if (typeof updateSyncStatusBanner === 'function') updateSyncStatusBanner();
    if (typeof showToast === 'function') {
      showToast('⚠️ تعذر الحفظ في ذاكرة الجهاز! تأكد من مساحة المتصفح أو الخروج من التصفح الخفي.', 4500);
    }
    return false;
  }
}

function saveAndNotify(successMsg) {
  if (!saveData()) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    showToast('📡 لا يوجد نت: تم الحفظ على جهازك بأمان وسيرتفع عند عودة النت', 3600);
  } else {
    showToast(successMsg);
  }
  return true;
}

function resetDataPrompt() {
  if (typeof showConfirmModal === 'function') {
    showConfirmModal({
      icon: '⚠️',
      title: 'استعادة البيانات الافتراضية',
      subtitle: 'هل أنت متأكد من رغبتك في استعادة البيانات الافتراضية؟ سيتم مسح أي تعديلات محلية قمت بها.',
      itemIcon: '🔄',
      itemTitle: 'إعادة ضبط المصنع للبيانات',
      itemMeta: 'سيتم استرجاع الدورات التجريبية الافتراضية وتحديث الصفحة.',
      confirmBtnText: 'نعم، استعادة البيانات الافتراضية',
      onConfirm: () => {
        C = normalizeData(JSON.parse(JSON.stringify(initialCycles)));
        saveData();
        showToast('تمت استعادة البيانات الافتراضية بنجاح');
        render();
      }
    });
  } else if (confirm('هل أنت متأكد من استعادة البيانات الافتراضية؟ سيتم مسح التعديلات المحلية.')) {
    C = normalizeData(JSON.parse(JSON.stringify(initialCycles)));
    saveData();
    showToast('تمت استعادة البيانات الافتراضية بنجاح');
    render();
  }
}

let bagKg = 50;

function getUnitKgFactor(unit) {
  if (!unit) return bagKg || 50;
  if (typeof unit === 'string') {
    if (unit.includes('100')) return 100;
    if (unit.includes('25')) return 25;
    if (unit.includes('كيلو')) return 1;
    if (unit.includes('50')) return 50;
    if (unit === 'شكارة') return bagKg || 50;
  }
  return bagKg || 50;
}

let nid = 100;

function updateNid() {
  nid = C.reduce((m, x) => Math.max(m, x.id), 0) + 1;
}

// Local date formatted as YYYY-MM-DD locked to Egypt real-time (Africa/Cairo)
function today() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  } catch (e) {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

// Sleek Toast Notification
let toastTimerId = null;
function showToast(message, durationMs = 2400) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  if (toastTimerId) clearTimeout(toastTimerId);
  toastTimerId = setTimeout(() => {
    toast.classList.remove('show');
  }, durationMs);
}

// Initial Load
loadData();
updateNid();
