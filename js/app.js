/**
 * Refaey Farm Tracker - Application Main Controller
 * Coordinates Application State, View Rendering, Schema Mappings, and Event Listeners.
 */

// Global UI State
let S = {
  v: 'list',          // 'list' for all cycles or cycle ID
  tab: 'exp',         // 'exp', 'inc', 'dead', 'feed', 'debt', 'ch'
  feedFilter: 'all',  // 'all', 'consumed', 'purchased'
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
    t: 'حركة بيع طيور (إيراد)',
    icon: '📈',
    f: [
      ['cnt', 'number', '', 'عدد الطيور المباعة'],
      ['kg', 'number', '', 'الوزن الإجمالي (كجم)'],
      ['amt', 'number', '', 'إجمالي قيمة البيع (جنيه)'],
      ['paidAmt', 'number', '', 'المبلغ المحصل نقداً الآن (كاش)'],
      ['buyer', 'text', '', 'اسم المشتري / التاجر']
    ],
    r: e => [
      `بيع ${e.cnt} طائر ${e.buyer ? '(' + e.buyer + ')' : ''}`,
      `${f(e.amt)} ج`
    ]
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
    t: 'حركة علف',
    icon: '🌾',
    f: [
      ['type', 'select', ['consumed', 'purchased'], 'نوع حركة العلف'],
      ['unit', 'select', ['شكارة', 'كيلو'], 'الوحدة'],
      ['q', 'number', '', 'الكمية'],
      ['note', 'text', '', 'نوع العلف / بيان (بادي، نامي، ناهي...)']
    ],
    r: e => {
      const typeLabel = e.type === 'purchased' ? 'وارد للمخزن' : 'مستهلك للطيور';
      return [`علف (${typeLabel}): ` + e.txt, f(e.kg) + ' كجم'];
    }
  },
  debt: {
    t: 'مديونية',
    icon: '📝',
    f: [
      ['dir', 'select', ['لنا', 'علينا'], 'نوع المديونية'],
      ['who', 'text', '', 'اسم الطرف الآخر (التاجر أو المورد)'],
      ['amt', 'number', '', 'المبلغ الإجمالي (جنيه)'],
      ['paidAmt', 'number', '', 'المبلغ المسدد مقدماً إن وجد (اختياري)'],
      ['note', 'text', '', 'بيان المديونية أو سببها']
    ],
    r: e => {
      const dirText = e.dir === 'لنا' ? 'مستحق لنا عنده' : 'مستحق علينا له';
      return [e.who + ' (' + dirText + ')', f(e.amt) + ' ج'];
    }
  }
};

const tabs = [
  ['exp', '💸 المصروفات'],
  ['inc', '📈 المبيعات والتحصيل'],
  ['dead', '⚠️ النفوق'],
  ['feed', '🌾 العلف والمخزون'],
  ['debt', '📝 الديون والتحصيل'],
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
