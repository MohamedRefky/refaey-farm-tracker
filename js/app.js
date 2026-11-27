/**
 * Refaey Farm Tracker - Application Main Controller
 * Coordinates Application State, View Rendering, Schema Mappings, and Event Listeners.
 */

// Global UI State
let S = {
  v: 'list',          // 'list' for all cycles or cycle ID
  summary: false,     // dedicated full-page cycle summary view
  editCycle: false,   // dedicated full-page cycle edit view
  restock: false,     // dedicated full-page add/restock chicks view
  restockFlockId: null, // optional preselected flock id when restocking
  tab: 'exp',         // 'exp', 'inc', 'dead', 'debt'
  expFilter: 'all',   // 'all', 'علف', 'دواء', 'غاز', 'مصاريف أخرى'
  incFilter: 'all',   // 'all' or a flock type id
  debtFilter: 'all',  // 'all', 'unpaid'
  openPayments: {},   // tracks expanded payment histories: { [debtId]: true }
  openFlocks: {}      // tracks expanded flock detail rows: { [flockId]: true }
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
    r: e => [esc(e.cat) + (e.note ? ' - ' + esc(e.note) : ''), f(e.amt) + ' ج']
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
        `بيع ${e.cnt} طائر${flock ? ' - ' + esc(flock) : ''}${e.buyer ? ' (' + esc(e.buyer) + ')' : ''}`,
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
        'نفوق ' + e.n + ' طائر' + (flock ? ' - ' + esc(flock) : ''),
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
    r: e => [`شراء علف: ` + esc(e.txt || (e.q ? `${e.q} ${e.unit || 'شكارة'}` : 'علف')), f(e.kg) + ' كجم']
  },
  debt: {
    t: 'مستحق لنا عند الغير',
    icon: '📝',
    f: [
      ['who', 'text', '', 'المستحقات / التفاصيل'],
      ['amt', 'number', '', 'المبلغ (جنيه)']
    ],
    r: e => [esc(e.who), f(e.amt) + ' ج']
  }
};

const tabs = [
  ['exp', '💸 المصروفات'],
  ['inc', '📈 المبيعات'],
  ['dead', '⚠️ النفوق'],
  ['debt', '📝 المستحقات']
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

// Prevent mouse-wheel scrolling from accidentally changing numbers inside focused <input type="number">
document.addEventListener('wheel', () => {
  const active = document.activeElement;
  if (active && active.tagName === 'INPUT' && active.type === 'number') {
    active.blur();
  }
}, { passive: true });

// Sync data automatically across open browser tabs & handle network reconnects
window.addEventListener('storage', e => {
  if (e.key === STORAGE_KEY && e.newValue) {
    try {
      C = normalizeData(JSON.parse(e.newValue));
      updateNid();
      render();
      showToast('🔄 تم تحديث البيانات تلقائياً من تبويب آخر');
    } catch (err) {
      console.error('Tab sync parse error', err);
    }
  }
});

window.addEventListener('offline', () => {
  if (typeof updateSyncStatusBanner === 'function') updateSyncStatusBanner();
  showToast('📡 انقطع الإنترنت — لا تقلق، تسجيلاتك ستُحفظ على الجهاز بأمان', 3200);
});

window.addEventListener('online', () => {
  if (typeof flushPendingSync === 'function') flushPendingSync();
  if (typeof updateSyncStatusBanner === 'function') updateSyncStatusBanner();
});

// Run Initial App Render
render();
