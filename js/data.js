/**
 * Refaey Farm Tracker - Data Layer & Persistence
 */

// Available expense categories
const cats = ['علف', 'كتاكيت', 'أدوية وتحصينات', 'كهرباء وغاز', 'عمالة', 'نقل', 'أخرى'];

// Default sample data for demo/new users
const initialCycles = [
  {
    id: 1,
    name: 'دورة أغسطس',
    start: '2026-08-01',
    end: '2026-09-10',
    n: 1000,
    exp: [
      { d: '2026-08-01', cat: 'كتاكيت', amt: 18000, note: '1000 كتكوت ساسو' },
      { d: '2026-08-05', cat: 'علف', amt: 22000, note: 'علف بادي 23%' },
      { d: '2026-08-20', cat: 'أدوية وتحصينات', amt: 3500, note: 'تحصينات واستقبال' },
      { d: '2026-08-25', cat: 'علف', amt: 26000, note: 'علف نامي 21%' },
      { d: '2026-09-01', cat: 'عمالة', amt: 4000, note: 'يوميات وعمالة' }
    ],
    inc: [
      { id: 1, d: '2026-09-08', cnt: 480, kg: 960, amt: 43200, paidAmt: 43200, buyer: 'تاجر الأحد' },
      { id: 2, d: '2026-09-10', cnt: 490, kg: 990, amt: 44500, paidAmt: 40000, buyer: 'محل الشرقية', debtRefId: 101 }
    ],
    dead: [
      { d: '2026-08-12', n: 18, note: 'نافق الأسبوع الأول' },
      { d: '2026-08-28', n: 12, note: 'موجة حر' }
    ],
    feed: [
      { id: 11, d: '2026-08-05', type: 'purchased', kg: 1500, q: 30, unit: 'شكارة', txt: '30 شكارة (بادي 23%)' },
      { id: 12, d: '2026-08-06', type: 'consumed', kg: 1400, q: 28, unit: 'شكارة', txt: '28 شكارة (استهلاك أسبوعي)' },
      { id: 13, d: '2026-08-25', type: 'purchased', kg: 1700, q: 34, unit: 'شكارة', txt: '34 شكارة (نامي 21%)' },
      { id: 14, d: '2026-08-26', type: 'consumed', kg: 1600, q: 32, unit: 'شكارة', txt: '32 شكارة (استهلاك أسبوعي)' }
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
    exp: [
      { d: '2026-10-01', cat: 'كتاكيت', amt: 15200, note: '800 كتكوت أبيض' },
      { d: '2026-10-04', cat: 'علف', amt: 9000, note: 'علف بادي' },
      { d: '2026-10-12', cat: 'أدوية وتحصينات', amt: 1800, note: 'فيتامينات ومضاد سموم' }
    ],
    inc: [],
    dead: [{ d: '2026-10-10', n: 9, note: 'فرز طبيعي' }],
    feed: [
      { id: 21, d: '2026-10-04', type: 'purchased', kg: 600, q: 12, unit: 'شكارة', txt: '12 شكارة بادي' },
      { id: 22, d: '2026-10-05', type: 'consumed', kg: 350, q: 7, unit: 'شكارة', txt: '7 شكارة مستهلك' }
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
const STORAGE_KEY = 'refaey_farm_cycles_v6';
let C = [];

function normalizeData(cycles) {
  if (!Array.isArray(cycles)) return [];
  cycles.forEach(c => {
    c.exp = c.exp || [];
    c.dead = c.dead || [];
    
    // Normalize sales
    c.inc = (c.inc || []).map(e => {
      const amt = +e.amt || +e.totalAmt || 0;
      const paidAmt = e.paidAmt !== undefined ? +e.paidAmt : amt;
      return {
        ...e,
        id: e.id || Date.now() + Math.random(),
        amt,
        paidAmt
      };
    });

    // Normalize feed
    c.feed = (c.feed || []).map(e => ({
      ...e,
      id: e.id || Date.now() + Math.random(),
      type: e.type || 'consumed',
      kg: +e.kg || 0,
      q: e.q !== undefined ? +e.q : (+e.kg || 0) / (bagKg || 50),
      unit: e.unit || 'شكارة'
    }));

    // Normalize debts
    c.debt = (c.debt || []).map(d => {
      const amt = +d.amt || 0;
      let dir = d.dir;
      if (dir === 'ليا عنده' || dir === 'لنا') dir = 'لنا';
      else if (dir === 'عليا لحد' || dir === 'علينا') dir = 'علينا';
      else dir = 'لنا';

      const paidAmt = d.paidAmt !== undefined ? +d.paidAmt : (d.paid ? amt : 0);
      return {
        ...d,
        id: d.id || Date.now() + Math.random(),
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
    // Also check older v5 storage if v6 not yet set
    const oldSaved = !saved ? localStorage.getItem('refaey_farm_cycles_v5') : null;
    const raw = saved ? JSON.parse(saved) : (oldSaved ? JSON.parse(oldSaved) : JSON.parse(JSON.stringify(initialCycles)));
    C = normalizeData(raw);
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

// Local date formatted as YYYY-MM-DD (safe against UTC timezone shifts)
function today() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
