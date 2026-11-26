/**
 * Refaey Farm Tracker - Data Layer & Persistence
 */

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
      { id: 1, d: '2026-09-08', flockId: 101, cnt: 480, amt: 43200, paidAmt: 43200, buyer: 'تاجر الأحد' },
      { id: 2, d: '2026-09-10', flockId: 102, cnt: 488, amt: 44500, paidAmt: 40000, buyer: 'محل الشرقية', debtRefId: 101 }
    ],
    dead: [
      { id: 1, d: '2026-08-12', flockId: 101, n: 18, note: 'نافق الأسبوع الأول' },
      { id: 2, d: '2026-08-28', flockId: 102, n: 12, note: 'موجة حر' }
    ],
    feed: [
      { id: 11, d: '2026-08-05', type: 'purchased', kg: 1500, q: 30, unit: 'شكارة', txt: '30 شكارة (بادي 23%)', note: 'بادي 23%', expRefId: 10 },
      { id: 13, d: '2026-08-25', type: 'purchased', kg: 1700, q: 34, unit: 'شكارة', txt: '34 شكارة (نامي 21%)', note: 'نامي 21%', expRefId: 20 }
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
        note: 'باقي بيع طيور دفعة 10 سبتمبر',
        saleId: 2,
        payments: [{ d: '2026-09-12', amt: 1500, note: 'دفعة نقدية' }]
      }
    ]
  },
  {
    id: 2,
    name: 'دورة أكتوبر',
    start: '2026-10-01',
    end: null,
    n: 800,
    flocks: [
      { id: 201, name: 'أبيض', count: 500, cost: 9500 },
      { id: 202, name: 'ساسو', count: 300, cost: 5700 }
    ],
    exp: [
      { id: 30, d: '2026-10-04', cat: 'علف', amt: 9000, note: 'علف بادي', feedRefId: 21 },
      { id: 31, d: '2026-10-12', cat: 'دواء', amt: 1800, note: 'فيتامينات ومضاد سموم' }
    ],
    inc: [],
    dead: [{ id: 21, d: '2026-10-10', flockId: 201, n: 9, note: 'فرز طبيعي' }],
    feed: [
      { id: 21, d: '2026-10-04', type: 'purchased', kg: 600, q: 12, unit: 'شكارة', txt: '12 شكارة بادي', note: 'بادي', expRefId: 30 }
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
const STORAGE_KEY = 'refaey_farm_cycles_v7';
const LEGACY_STORAGE_KEYS = ['refaey_farm_cycles_v6', 'refaey_farm_cycles_v5'];
let C = [];

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

    // Normalize sales (count-based only)
    c.inc = (c.inc || []).map((e, i) => {
      const amt = +e.amt || +e.totalAmt || 0;
      const paidAmt = e.paidAmt !== undefined ? +e.paidAmt : amt;
      return {
        ...e,
        id: e.id || Date.now() + i,
        flockId: flockIds.includes(e.flockId) ? e.flockId : flockIds[0],
        cnt: +e.cnt || 0,
        amt,
        paidAmt
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

    // Normalize debts
    c.debt = (c.debt || []).map((d, i) => {
      const amt = +d.amt || 0;
      let dir = d.dir;
      if (dir === 'ليا عنده' || dir === 'لنا') dir = 'لنا';
      else if (dir === 'عليا لحد' || dir === 'علينا') dir = 'علينا';
      else dir = 'لنا';

      const paidAmt = d.paidAmt !== undefined ? +d.paidAmt : (d.paid ? amt : 0);
      return {
        ...d,
        id: d.id || Date.now() + i,
        dir,
        amt,
        paidAmt,
        paid: paidAmt >= amt,
        payments: Array.isArray(d.payments) ? d.payments : []
      };
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
  } catch (err) {
    console.error('Storage error', err);
  }
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
function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2400);
}

// Initial Load
loadData();
updateNid();
