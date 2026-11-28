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

// Default cycles list (starts empty with no demo data)
const initialCycles = [];

// Persistent State Storage
const STORAGE_KEY = 'refaey_farm_cycles_v8';
const PENDING_SYNC_KEY = 'refaey_pending_sync_v1';
const LEGACY_STORAGE_KEYS = [];
let C = [];
let storageWriteFailed = false;
let hasPendingSync = false;
let hasLocalSavedData = false;
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

// Keeps the flock's count/cost in sync with its batches, and cycle count in sync with flocks
function syncFlockFromBatches(fl) {
  if (!fl) return fl;
  if (Array.isArray(fl.batches) && fl.batches.length > 0) {
    fl.count = fl.batches.reduce((s, b) => s + (+b.count || 0), 0);
    fl.cost = Math.round(fl.batches.reduce((s, b) => s + (+b.cost || 0), 0) * 100) / 100;
  }
  return fl;
}

function syncCycleCount(c) {
  if (!c) return 0;
  (c.flocks || []).forEach(syncFlockFromBatches);
  c.n = (c.flocks || []).reduce((s, f) => s + (+f.count || 0), 0);
  return c.n;
}

// Monotonic sequence generator per cycle for exact chronological expense allocation
function nextCycleSeq(c) {
  if (!c) return Date.now();
  c.nextSeq = (+c.nextSeq || 0) + 1;
  return c.nextSeq;
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

    // Normalize flock types & batches
    if (!Array.isArray(c.flocks) || c.flocks.length === 0) {
      const legacyCount = +c.n || 0;
      c.flocks = [{
        id: Date.now() + Math.floor(Math.random() * 1000),
        name: 'الدفعة الأساسية',
        count: legacyCount,
        cost: legacyChickCost,
        batches: [{
          id: Date.now() + Math.floor(Math.random() * 1000) + 1,
          d: c.start || today(),
          count: legacyCount,
          cost: legacyChickCost,
          seq: 1,
          includeOld: true
        }]
      }];
    } else {
      c.flocks = c.flocks.map((f, i) => {
        const flId = f.id || Date.now() + i;
        let batches = Array.isArray(f.batches) && f.batches.length > 0
          ? f.batches.map((b, bIdx) => ({
              id: b.id || (flId * 100 + bIdx + 1),
              d: b.d || c.start || today(),
              count: +b.count || 0,
              cost: +b.cost || 0,
              seq: +b.seq || 0,
              includeOld: b.includeOld !== false
            }))
          : [{
              id: flId * 100 + 1,
              d: c.start || today(),
              count: +f.count || 0,
              cost: +f.cost || 0,
              seq: +f.seq || 0,
              includeOld: true
            }];

        return syncFlockFromBatches({
          ...f,
          id: flId,
          name: (f.name || '').trim() || ('نوع ' + (i + 1)),
          batches
        });
      });
    }

    const flockIds = c.flocks.map(f => f.id);
    syncCycleCount(c);

    // Normalize mortalities (always attached to a flock type)
    c.dead = (c.dead || []).map((d, i) => ({
      ...d,
      id: d.id || Date.now() + i,
      flockId: flockIds.includes(d.flockId) ? d.flockId : flockIds[0],
      n: +d.n || 0,
      seq: +d.seq || 0
    }));

    // Normalize sales (count-based and total sale value only)
    c.inc = (c.inc || []).map((e, i) => {
      const amt = +e.amt || +e.totalAmt || 0;
      return {
        ...e,
        id: e.id || Date.now() + i,
        flockId: flockIds.includes(e.flockId) ? e.flockId : flockIds[0],
        cnt: +e.cnt || 0,
        amt,
        seq: +e.seq || 0
      };
    });

    // Normalize expense seq if missing
    c.exp = (c.exp || []).map(e => ({ ...e, seq: +e.seq || 0 }));

    // Ensure every batch, exp, inc, dead item has a deterministic sequence number
    let maxSeq = +c.nextSeq || 0;
    c.flocks.forEach(fl => fl.batches.forEach(b => { if (b.seq > maxSeq) maxSeq = b.seq; }));
    [...c.exp, ...c.inc, ...c.dead].forEach(x => { if (x.seq > maxSeq) maxSeq = x.seq; });

    const missingBatches = [];
    c.flocks.forEach(fl => fl.batches.forEach(b => { if (!b.seq) missingBatches.push(b); }));
    missingBatches.sort((a, b) => String(a.d || '').localeCompare(String(b.d || '')));
    missingBatches.forEach(b => { b.seq = ++maxSeq; });

    const missingEvents = [...c.exp, ...c.inc, ...c.dead].filter(x => !x.seq);
    missingEvents.sort((a, b) => String(a.d || '').localeCompare(String(b.d || '')));
    missingEvents.forEach(x => { x.seq = ++maxSeq; });

    c.nextSeq = maxSeq;

    // Normalize feed (purchased / incoming feed only)
    c.feed = (c.feed || [])
      .filter(e => e.type !== 'consumed')
      .map((e, i) => {
        const linkedExp = (c.exp || []).find(x => x.id === e.expRefId || x.feedRefId === e.id);
        return {
          ...e,
          id: e.id || Date.now() + i,
          type: 'purchased',
          kg: +e.kg || 0,
          q: e.q !== undefined ? +e.q : (+e.kg || 0) / (bagKg || 50),
          unit: e.unit || 'شكارة',
          seq: +e.seq || +(linkedExp && linkedExp.seq) || 0
        };
      });

    // Feed stocktakes are snapshots of remaining stock, not purchases.
    c.feedStocktakes = (c.feedStocktakes || []).map((x, i) => {
      const rawOpenKg = +x.openingKg || 0;
      const rawOpenVal = +x.openingValue || 0;
      const openingKg = rawOpenKg > 0
        ? rawOpenKg
        : (x.openingKg === undefined || (+c.feedOpeningKg || 0) > 0 ? (+c.feedOpeningKg || 0) : 0);
      const openingValue = rawOpenVal > 0
        ? rawOpenVal
        : (x.openingValue === undefined || (+c.feedOpeningValue || 0) > 0 ? (+c.feedOpeningValue || 0) : 0);
      return {
        ...x,
        id: x.id || Date.now() + i,
        d: x.d || c.start || today(),
        kg: Math.max(0, +x.kg || 0),
        openingKg: Math.max(0, openingKg),
        openingValue: Math.max(0, openingValue),
        seq: +x.seq || 0
      };
    });

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

function isLegacyDemoCycle(c) {
  if (!c || typeof c !== 'object') return false;
  return (
    (c.id === 1 && c.name === 'دورة أغسطس' && c.start === '2026-08-01') ||
    (c.id === 2 && c.name === 'دورة أكتوبر' && c.start === '2026-10-01')
  );
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = normalizeData(JSON.parse(saved));
      const filtered = parsed.filter(c => !isLegacyDemoCycle(c));
      if (filtered.length !== parsed.length) {
        C = filtered;
        hasLocalSavedData = filtered.length > 0;
        saveData({ skipCloud: true, keepInitialFlag: filtered.length === 0 });
      } else {
        hasLocalSavedData = true;
        C = parsed;
      }
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

    hasLocalSavedData = Boolean(raw);
    C = normalizeData(raw || JSON.parse(JSON.stringify(initialCycles)));
    saveData({ skipCloud: true, keepInitialFlag: !raw });
  } catch (e) {
    C = normalizeData(JSON.parse(JSON.stringify(initialCycles)));
  }
}

function saveData(options = {}) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(C));
    storageWriteFailed = false;
    if (!options.keepInitialFlag) {
      hasLocalSavedData = true;
    }

    if (!options.skipCloud) {
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

function applyRemoteCycles(remoteCycles) {
  const normalized = normalizeData(Array.isArray(remoteCycles) ? remoteCycles : []);
  const nextJson = JSON.stringify(normalized);
  const currentJson = JSON.stringify(C);
  if (nextJson === currentJson) return false;

  C = normalized;
  hasLocalSavedData = true;
  saveData({ skipCloud: true });
  clearPendingSync();
  updateNid();
  if (typeof render === 'function') render();
  return true;
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
      title: 'مسح جميع البيانات',
      subtitle: 'هل أنت متأكد من رغبتك في مسح جميع الدورات والبيانات؟ لا يمكن التراجع عن هذه الخطوة.',
      itemIcon: '🗑️',
      itemTitle: 'بدء دفتر جديد فارغ',
      itemMeta: 'سيتم حذف جميع الدورات المسجلة محلياً وسحابياً.',
      confirmBtnText: 'نعم، امسح جميع البيانات',
      onConfirm: () => {
        C = [];
        if (saveAndNotify('تم مسح جميع البيانات بنجاح')) {
          render();
        }
      }
    });
  } else if (confirm('هل أنت متأكد من مسح جميع الدورات والبيانات؟')) {
    C = [];
    if (saveAndNotify('تم مسح جميع البيانات بنجاح')) {
      render();
    }
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
