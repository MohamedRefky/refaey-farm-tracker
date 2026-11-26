/**
 * Refaey Farm Tracker - Application Main Controller
 * Coordinates Application State, View Rendering, Schema Mappings, and Event Listeners.
 */

// Global UI State
let S = {
  v: 'list',          // 'list' for all cycles or cycle ID
  tab: 'exp',         // 'exp', 'inc', 'dead', 'feed', 'debt', 'ch'
  incFilter: 'all',   // 'all' or a flock type id
  debtFilter: 'all',  // 'all', 'us', 'them', 'unpaid'
  openPayments: {}    // tracks expanded payment histories: { [debtId]: true }
};

// Field Schemas and Display Helpers
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
    t: 'حركة بيع طيور',
    icon: '📈',
    f: [
      ['flockId', 'select', '', 'نوع الفراخ المباعة'],
      ['cnt', 'number', '', 'عدد الطيور المباعة'],
      ['amt', 'number', '', 'قيمة البيع (جنيه)'],
      ['buyer', 'text', '', 'اسم المشتري / ملاحظة (اختياري)']
    ],
    r: e => {
      const flock = e.flockId ? flockName(cur(), e.flockId) : '';
      return [
        `بيع ${e.cnt} طائر${flock ? ' - ' + flock : ''}${e.buyer ? ' (' + e.buyer + ')' : ''}`,
        `${f(e.amt)} ج`
      ];
    }
  },
  dead: {
    t: 'طيور نافقة',
    icon: '⚠️',
    f: [
      ['flockId', 'select', '', 'نوع الفراخ النافقة'],
      ['n', 'number', '', 'عدد الطيور النافقة']
    ],
    r: e => {
      const flock = e.flockId ? flockName(cur(), e.flockId) : '';
      return [
        'نفوق ' + e.n + ' طائر' + (flock ? ' - ' + flock : ''),
        e.n + ' طيور'
      ];
    }
  },
  feed: {
    t: 'شراء علف',
    icon: '🌾',
    f: [
      ['unit', 'select', ['شكارة', 'كيلو'], 'الوحدة'],
      ['q', 'number', '', 'الكمية'],
      ['note', 'text', '', 'نوع العلف / بيان (بادي، نامي، ناهي...)']
    ],
    r: e => [`شراء علف: ` + (e.txt || (e.q ? `${e.q} ${e.unit || 'شكارة'}` : 'علف')), f(e.kg) + ' كجم']
  },
  debt: {
    t: 'مستحق لنا عند الغير',
    icon: '📝',
    f: [
      ['who', 'text', '', 'المستحقات / التفاصيل'],
      ['amt', 'number', '', 'المبلغ (جنيه)']
    ],
    r: e => [e.who, f(e.amt) + ' ج']
  }
};

const tabs = [
  ['exp', '💸 المصروفات'],
  ['inc', '📈 المبيعات'],
  ['dead', '⚠️ النفوق'],
  ['feed', '🌾 العلف والمخزون'],
  ['debt', '📝 المستحقات (الديون)'],
  ['ch', '📊 التحليل والتقارير']
];

// Helper: Get currently selected cycle
function cur() {
  return C.find(c => c.id === S.v);
}

// Master Application Render Coordinator
function render() {
  const a = document.getElementById('app');
  if (!a) return;
  if (S.v === 'list') {
    list(a);
  } else {
    detail(a);
  }
  applyMoneyPrivacy(a);
}

// Modal Dismissal Backdrop & Global Keyboard Shortcuts
document.addEventListener('DOMContentLoaded', () => {
  const modalEl = document.getElementById('m');
  if (modalEl) {
    modalEl.onclick = e => {
      if (e.target === modalEl) closeM();
    };
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeM();
    closeConfirmModal();
  }
});

// Run Initial App Render
render();
