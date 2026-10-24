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
      { d: '2026-09-08', cnt: 480, kg: 960, amt: 43200, buyer: 'تاجر الأحد' },
      { d: '2026-09-10', cnt: 490, kg: 990, amt: 44500, buyer: 'محل الشرقية' }
    ],
    dead: [
      { d: '2026-08-12', n: 18, note: 'نافق الأسبوع الأول' },
      { d: '2026-08-28', n: 12, note: 'موجة حر' }
    ],
    feed: [
      { d: '2026-08-05', kg: 1500, txt: '30 شكارة' },
      { d: '2026-08-25', kg: 1700, txt: '34 شكارة' }
    ],
    debt: []
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
    feed: [{ d: '2026-10-04', kg: 600, txt: '12 شكارة' }],
    debt: [{ d: '2026-10-15', who: 'أبو علي التاجر', dir: 'ليا عنده', amt: 2000, paid: false }]
  }
];

// Persistent State Storage
const STORAGE_KEY = 'refaey_farm_cycles_v5';
let C = [];

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    C = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(initialCycles));
  } catch (e) {
    C = JSON.parse(JSON.stringify(initialCycles));
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
  if (confirm('هل أنت متأكد من استعادة البيانات الافتراضية؟ سيتم مسح التعديلات المحلية.')) {
    C = JSON.parse(JSON.stringify(initialCycles));
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
