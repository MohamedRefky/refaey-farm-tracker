/**
 * Refaey Farm Tracker - UI Core Module
 * Handles Theme, Real-time Clock, Money Privacy Shield, and Confirmation Modals.
 */

// ==========================================================================
// 1. MONEY PRIVACY SHIELD
// ==========================================================================
const MONEY_VISIBILITY_KEY = 'refaey_money_visibility_v1';
let moneyValuesHidden = false;
try {
  const savedMoneyVisibility = localStorage.getItem(MONEY_VISIBILITY_KEY);
  if (savedMoneyVisibility !== null) moneyValuesHidden = savedMoneyVisibility === 'hidden';
} catch (e) {
  // Keep default when storage is unavailable
}

const moneyTextOriginals = new WeakMap();

function applyMoneyPrivacy(root = document.body) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;

  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!parent || parent.closest('script, style, textarea, input, #cycle-pdf-export')) continue;

    const original = moneyTextOriginals.has(node) ? moneyTextOriginals.get(node) : node.nodeValue;
    moneyTextOriginals.set(node, original);

    let display = original;
    if (moneyValuesHidden && parent.closest('.money-privacy-value')) {
      display = original.replace(/[+-]?[\d,]+(?:\.\d+)?/g, '••••');
    } else if (moneyValuesHidden) {
      display = original.replace(/[+-]?\s*[\d,]+(?:\.\d+)?(?=\s*(?:جنيه(?:\s*مصري)?|ج(?:\s*\/\s*[\u0600-\u06FF]+)?)(?=$|[\s).،•:;]))/g, '••••');
    }

    if (node.nodeValue !== display) node.nodeValue = display;
  }
}

function updateMoneyPrivacyButton() {
  const button = document.getElementById('money-privacy-toggle');
  const icon = document.getElementById('money-privacy-icon');
  const label = document.getElementById('money-privacy-label');
  if (!button) return;

  button.setAttribute('aria-pressed', String(moneyValuesHidden));
  button.setAttribute('aria-label', 'تبديل إخفاء وإظهار المبالغ المالية');
  button.title = moneyValuesHidden
    ? 'المبالغ مخفية لحماية الخصوصية. اضغط لإظهارها؛ وسيتذكر الدفتر اختيارك في المرة القادمة.'
    : 'المبالغ ظاهرة. اضغط لإخفائها؛ وسيتذكر الدفتر اختيارك في المرة القادمة.';
  if (icon) icon.textContent = moneyValuesHidden ? '🙈' : '👁️';
  if (label) label.textContent = moneyValuesHidden ? 'إظهار المبالغ' : 'إخفاء المبالغ';
}

function toggleMoneyPrivacy() {
  moneyValuesHidden = !moneyValuesHidden;
  try {
    localStorage.setItem(MONEY_VISIBILITY_KEY, moneyValuesHidden ? 'hidden' : 'visible');
  } catch (e) {
    // Current session still works
  }
  updateMoneyPrivacyButton();
  applyMoneyPrivacy(document.body);
  showToast(moneyValuesHidden
    ? 'تم إخفاء المبالغ، وسيُحفظ اختيارك للزيارة القادمة'
    : 'تم إظهار المبالغ، وسيُحفظ اختيارك للزيارة القادمة');
}

// ==========================================================================
// 2. LIVE REAL-TIME CLOCK (Africa/Cairo)
// ==========================================================================
function updateLiveClock() {
  const now = new Date();
  
  const dateFormatted = now.toLocaleDateString('ar-EG-u-nu-latn', {
    timeZone: 'Africa/Cairo',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  const timeFormatted = now.toLocaleTimeString('ar-EG-u-nu-latn', {
    timeZone: 'Africa/Cairo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const dt = document.getElementById('dt');
  if (dt) {
    dt.textContent = `${dateFormatted} • ${timeFormatted} (توقيت مصر 🇪🇬)`;
  }

  const gr = document.getElementById('gr');
  if (gr) {
    const cairoHourStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      hour: 'numeric',
      hour12: false
    }).format(now);
    const hours = parseInt(cairoHourStr, 10);
    const greetingText = (hours >= 4 && hours < 12) ? 'صباح الخير والرزق' : 'مساء الخير والبركة';
    gr.innerHTML = `${greetingText} يا رفاعي <span class="chick-anim">🐥</span>`;
  }
}

// ==========================================================================
// 3. THEME SWITCHER (Dark & Light)
// ==========================================================================
function updateThemeUI(theme) {
  document.documentElement.dataset.theme = theme;
  const thIcon = document.getElementById('th-icon');
  const thText = document.getElementById('th-text');
  if (theme === 'light') {
    if (thIcon) thIcon.textContent = '☾';
    if (thText) thText.textContent = 'داكن';
  } else {
    if (thIcon) thIcon.textContent = '☀︎';
    if (thText) thText.textContent = 'فاتح';
  }
}

// ==========================================================================
// 4. CONFIRMATION & WARNING MODAL
// ==========================================================================
function showConfirmModal({
  icon = '🗑️',
  title = 'تأكيد الحذف ⚠️',
  subtitle = 'هل أنت متأكد من رغبتك في حذف هذا العنصر؟',
  itemIcon = '📄',
  itemTitle = '',
  itemMeta = '',
  warningNote = '',
  confirmBtnText = 'نعم، احذف نهائياً',
  onConfirm = () => {}
}) {
  const cm = document.getElementById('cm');
  if (!cm) return;

  cm.innerHTML = `
    <div class="confirm-box" onclick="event.stopPropagation()">
      <div class="confirm-icon-badge">${icon}</div>
      <div class="confirm-title">${title}</div>
      <div class="confirm-subtitle">${subtitle}</div>

      <div class="confirm-item-card">
        <div class="confirm-item-icon">${itemIcon}</div>
        <div style="flex: 1; text-align: right; min-width: 0;">
          <div class="confirm-item-text">${itemTitle}</div>
          ${itemMeta ? `<div class="confirm-item-meta">${itemMeta}</div>` : ''}
        </div>
      </div>

      ${warningNote ? `
        <div class="confirm-warning-tag">
          ⚠️ ${warningNote}
        </div>
      ` : ''}

      <div class="confirm-actions">
        <button type="button" class="btn btn-danger" id="cm_confirm_btn" style="flex: 1;">
          ${confirmBtnText}
        </button>
        <button type="button" class="btn btn-outline" id="cm_cancel_btn" style="flex: 1;" onclick="closeConfirmModal()">
          إلغاء وتراجع
        </button>
      </div>
    </div>
  `;

  document.getElementById('cm_confirm_btn').onclick = () => {
    closeConfirmModal();
    onConfirm();
  };

  cm.onclick = e => {
    if (e.target === cm) closeConfirmModal();
  };

  cm.classList.add('on');
}

function closeConfirmModal() {
  const cm = document.getElementById('cm');
  if (cm) cm.classList.remove('on');
}

// Initialize UI Core Events & Observers
document.addEventListener('DOMContentLoaded', () => {
  updateLiveClock();
  setInterval(updateLiveClock, 10000);

  const savedTheme = localStorage.getItem('refaey_theme') || 'dark';
  updateThemeUI(savedTheme);

  const thBtn = document.getElementById('th');
  if (thBtn) {
    thBtn.onclick = () => {
      const current = document.documentElement.dataset.theme;
      const target = current === 'light' ? 'dark' : 'light';
      localStorage.setItem('refaey_theme', target);
      updateThemeUI(target);
    };
  }

  const moneyPrivacyButton = document.getElementById('money-privacy-toggle');
  if (moneyPrivacyButton) moneyPrivacyButton.onclick = toggleMoneyPrivacy;
  updateMoneyPrivacyButton();

  const moneyPrivacyObserver = new MutationObserver(() => {
    if (moneyValuesHidden) applyMoneyPrivacy(document.body);
  });
  ['app', 'm', 'cm'].forEach(id => {
    const root = document.getElementById(id);
    if (root) moneyPrivacyObserver.observe(root, { childList: true, subtree: true });
  });
});
