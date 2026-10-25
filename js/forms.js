/**
 * Refaey Farm Tracker - Forms & Transaction Modals Module
 * Handles entry forms, input validation, payment logging, and cycle modifications.
 */

// Modal Container Elements
let m = document.getElementById('m');
let fm = document.getElementById('fm');

function ensureModalElements() {
  if (!m) m = document.getElementById('m');
  if (!fm) fm = document.getElementById('fm');
  return { m, fm };
}

function closeM() {
  const { m: modal } = ensureModalElements();
  if (modal) modal.classList.remove('on');
}

// Helper: Show formatted validation alert in modal
function showFormError(msg, fieldId) {
  const container = document.getElementById('form_error_container');
  if (container) {
    container.innerHTML = `
      <div class="form-error-alert">
        <span style="font-size: 18px;">⚠️</span>
        <span>${msg}</span>
      </div>
    `;
  }
  if (fieldId) {
    const el = document.getElementById(fieldId);
    if (el) {
      el.classList.add('input-error');
      el.focus();
    }
  }
}

// Helper: Clear form error states
function clearFormErrors() {
  const container = document.getElementById('form_error_container');
  if (container) container.innerHTML = '';
  const { fm: formEl } = ensureModalElements();
  if (formEl) {
    const inputs = formEl.querySelectorAll('.input-error');
    inputs.forEach(el => el.classList.remove('input-error'));
  }
}

// Validation function returning detailed error message or null if valid
function validateTransaction(kind, data, isEdit, editIndex, cycle) {
  const k = calc(cycle);

  if (kind === 'inc') {
    // 1. Bird Count Validation
    if (!data.cnt || isNaN(data.cnt) || +data.cnt <= 0) {
      return { valid: false, field: 'f_cnt', message: 'يرجى إدخال عدد صحيح للطيور المباعة أكبر من الصفر.' };
    }
    const availBirds = k.remaining + (isEdit && cycle.inc[editIndex] ? (+cycle.inc[editIndex].cnt || 0) : 0);
    if (+data.cnt > availBirds) {
      return {
        valid: false,
        field: 'f_cnt',
        message: `عفواً، عدد الطيور المباعة (${data.cnt}) أكبر من الطيور الحية المتاحة حالياً بالمزرعة (${availBirds} طائر).`
      };
    }

    // 2. Total Amount Validation
    if (!data.amt || isNaN(data.amt) || +data.amt <= 0) {
      return { valid: false, field: 'f_amt', message: 'يرجى إدخال إجمالي قيمة البيع بمبلغ صحيح أكبر من الصفر.' };
    }

    // 3. Collected Amount Validation
    if (data.paidAmt !== undefined && data.paidAmt !== '') {
      if (isNaN(data.paidAmt) || +data.paidAmt < 0) {
        return { valid: false, field: 'f_paidAmt', message: 'المبلغ المحصل نقداً لا يمكن أن يكون سالباً.' };
      }
      if (+data.paidAmt > +data.amt) {
        return {
          valid: false,
          field: 'f_paidAmt',
          message: `المبلغ المحصل (${f(+data.paidAmt)} ج) لا يمكن أن يتجاوز إجمالي قيمة البيع (${f(+data.amt)} ج).`
        };
      }
    }

    // 4. Weight Validation
    if (data.kg !== '' && data.kg !== undefined) {
      if (isNaN(data.kg) || +data.kg <= 0) {
        return { valid: false, field: 'f_kg', message: 'الوزن الإجمالي يجب أن يكون رقماً أكبر من الصفر.' };
      }
    }

    // 5. Buyer Name for Partial/Deferred Sales
    const remaining = +data.amt - (+data.paidAmt || 0);
    if (remaining > 0 && (!data.buyer || !data.buyer.trim())) {
      return {
        valid: false,
        field: 'f_buyer',
        message: 'يوجد متبقي آجل؛ يرجى كتابة اسم المشتري / التاجر لربط هذا المتبقي بحسابه في الديون تلقائياً.'
      };
    }
  }

  if (kind === 'dead') {
    if (!data.n || isNaN(data.n) || +data.n <= 0) {
      return { valid: false, field: 'f_n', message: 'يرجى إدخال عدد طيور نافقة صحيح أكبر من الصفر.' };
    }
    const availLive = k.remaining + (isEdit && cycle.dead[editIndex] ? (+cycle.dead[editIndex].n || 0) : 0);
    if (+data.n > availLive) {
      return {
        valid: false,
        field: 'f_n',
        message: `عفواً، عدد النافق (${data.n}) أكبر من الطيور الحية المتبقية بالمزرعة (${availLive} طائر).`
      };
    }
  }

  if (kind === 'exp' || kind === 'feed') {
    if (data.cat === 'علف') {
      if (data.feed_mode === 'purchased') {
        if (!data.amt || isNaN(data.amt) || +data.amt <= 0) {
          return { valid: false, field: 'f_amt', message: 'يرجى إدخال المبلغ المدفوع لشراء العلف بشكل صحيح (أكبر من الصفر).' };
        }
        if (!data.feed_q || isNaN(data.feed_q) || +data.feed_q <= 0) {
          return { valid: false, field: 'f_feed_q', message: 'يرجى إدخال كمية العلف المشتراة برقم صحيح أكبر من الصفر.' };
        }
      } else {
        // Consumed feed (وجبة أكلتها الطيور)
        if (!data.feed_q || isNaN(data.feed_q) || +data.feed_q <= 0) {
          return { valid: false, field: 'f_feed_q', message: 'يرجى إدخال كمية العلف التي أكلتها الطيور اليوم برقم صحيح أكبر من الصفر.' };
        }
      }
    } else {
      if (!data.amt || isNaN(data.amt) || +data.amt <= 0) {
        return { valid: false, field: 'f_amt', message: 'يرجى إدخال مبلغ المصروف بشكل صحيح (أكبر من الصفر).' };
      }
    }
  }

  if (kind === 'debt') {
    if (!data.who || !data.who.trim()) {
      return { valid: false, field: 'f_who', message: 'يرجى كتابة اسم الطرف الآخر (التاجر أو المورد).' };
    }
    if (!data.amt || isNaN(data.amt) || +data.amt <= 0) {
      return { valid: false, field: 'f_amt', message: 'يرجى إدخال مبلغ المديونية بشكل صحيح (أكبر من الصفر).' };
    }
    if (data.paidAmt !== '' && data.paidAmt !== undefined) {
      if (isNaN(data.paidAmt) || +data.paidAmt < 0) {
        return { valid: false, field: 'f_paidAmt', message: 'المبلغ المسدد لا يمكن أن يكون سالباً.' };
      }
      if (+data.paidAmt > +data.amt) {
        return { valid: false, field: 'f_paidAmt', message: 'المبلغ المسدد لا يمكن أن يتجاوز أصل المديونية.' };
      }
    }
  }

  return { valid: true };
}

// Display Form Modal with Rich Context and Guidance
function openForm(kind, editIndex = null, prefillData = null) {
  const isEdit = editIndex !== null;
  const cycle = cur();
  const k = calc(cycle);
  const { m: modal, fm: formEl } = ensureModalElements();
  if (!modal || !formEl) return;

  const isFeedKind = kind === 'feed';
  const isExpKind = kind === 'exp';
  const isUnified = isFeedKind || isExpKind;

  let existing = null;
  let linkedRef = null;

  if (isEdit) {
    if (isFeedKind) {
      existing = cycle.feed[editIndex];
      linkedRef = existing && existing.expRefId ? cycle.exp.find(x => x.id === existing.expRefId) : (existing ? cycle.exp.find(x => x.feedRefId === existing.id) : null);
    } else {
      existing = cycle[kind] ? cycle[kind][editIndex] : null;
      if (isExpKind && existing && (existing.cat === 'علف' || existing.feedRefId)) {
        linkedRef = existing.feedRefId ? cycle.feed.find(f => f.id === existing.feedRefId) : cycle.feed.find(f => f.expRefId === existing.id);
      }
    }
  }

  let titleText = '';
  if (isUnified) {
    titleText = isEdit ? 'تعديل المصروف أو العلف' : 'تسجيل مصروف أو حركة علف';
  } else {
    titleText = (isEdit ? 'تعديل ' : 'تسجيل ') + (K[kind] ? K[kind].t : '');
  }

  let h = `
    <div class="form-header">
      <div class="form-title">${titleText}</div>
      <button type="button" class="btn btn-sm btn-outline" onclick="closeM()">✕</button>
    </div>

    <!-- Dynamic Error Alert Placeholder -->
    <div id="form_error_container"></div>
  `;

  // Context-aware helpful guidance banners
  if (kind === 'inc') {
    const avail = k.remaining + (isEdit && existing ? (+existing.cnt || 0) : 0);
    h += `
      <div class="form-hint-banner emerald">
        <span>🐔</span>
        <span>الطيور الحية المتاحة للبيع حالياً: <b>${f(avail)} طائر</b></span>
      </div>
    `;
  } else if (kind === 'dead') {
    const avail = k.remaining + (isEdit && existing ? (+existing.n || 0) : 0);
    h += `
      <div class="form-hint-banner amber">
        <span>⚠️</span>
        <span>الطيور الحية المتبقية بالدورة: <b>${f(avail)} طائر</b></span>
      </div>
    `;
  } else if (isUnified) {
    h += `
      <div class="form-hint-banner">
        <span>🏬</span>
        <span>رصيد العلف بالمخزن حالياً: <b>${f(k.feedStockKg)} كجم</b> (${(k.feedStockKg / bagKg).toFixed(1)} شكارة)</span>
      </div>
    `;
  }

  // Date Field (Always First, with live Egyptian time indication)
  const dateVal = isEdit && existing && existing.d ? existing.d : today();
  h += `
    <div style="display: flex; justify-content: space-between; align-items: center; margin: 14px 0 6px;">
      <label style="margin: 0;">التاريخ *</label>
      <span style="font-size: 11px; color: var(--emerald); font-weight: 700;">🇪🇬 توقيت مصر الفعلي</span>
    </div>
    <input type="date" id="f_d" value="${dateVal}" onchange="updateDateDisplay(this.value)">
    <div id="f_d_display" style="font-size: 11px; color: var(--text-muted); margin: 3px 0 10px; font-weight: 600;">
      ${fd(dateVal)}
    </div>
  `;

  if (isUnified) {
    let catVal = 'علف';
    let feedMode = 'purchased';

    if (isEdit) {
      if (isFeedKind) {
        catVal = 'علف';
        feedMode = existing ? (existing.type || 'consumed') : 'consumed';
      } else if (existing) {
        catVal = existing.cat || 'علف';
        feedMode = (existing.cat === 'علف') ? 'purchased' : 'purchased';
      }
    } else if (prefillData) {
      if (typeof prefillData === 'string') {
        catVal = 'علف';
        feedMode = prefillData;
      } else {
        catVal = prefillData.cat || 'علف';
        feedMode = prefillData.mode || 'purchased';
      }
    }

    const amtVal = isEdit ? (existing && existing.amt !== undefined ? existing.amt : (linkedRef ? linkedRef.amt : '')) : '';
    const feedUnitVal = (linkedRef && linkedRef.unit) || (existing && existing.unit) || 'شكارة';
    const feedQVal = isEdit ? ((linkedRef && linkedRef.q !== undefined) ? linkedRef.q : (existing && existing.q !== undefined ? existing.q : '')) : '';
    const feedNoteVal = (linkedRef && (linkedRef.note || linkedRef.txt)) || (existing && (existing.note || existing.txt)) || '';
    const stdNoteVal = isEdit && existing ? (existing.note || '') : '';

    h += `
      <label>تصنيف المصروف أو المعاملة *</label>
      <select id="f_cat" onchange="onExpenseCatChange()">
        <option value="علف" ${catVal === 'علف' ? 'selected' : ''}>🌾 علف (شراء للمخزن أو وجبة أكلتها الطيور)</option>
        <option value="كتاكيت" ${catVal === 'كتاكيت' ? 'selected' : ''}>🐣 كتاكيت (شراء دفعة كتاكيت)</option>
        <option value="أدوية وتحصينات" ${catVal === 'أدوية وتحصينات' ? 'selected' : ''}>💊 أدوية وتحصينات وبيطري</option>
        <option value="كهرباء وغاز" ${catVal === 'كهرباء وغاز' ? 'selected' : ''}>⚡ كهرباء وغاز وتدفئة ومياه</option>
        <option value="نشارة وفرشة" ${catVal === 'نشارة وفرشة' ? 'selected' : ''}>🪵 نشارة وفرشة تبن</option>
        <option value="عمالة" ${catVal === 'عمالة' ? 'selected' : ''}>👷 عمالة وإشراف</option>
        <option value="نقل" ${catVal === 'نقل' ? 'selected' : ''}>🚚 نقل ومشال</option>
        <option value="أخرى" ${catVal === 'أخرى' ? 'selected' : ''}>📦 مصاريف ونثريات أخرى</option>
      </select>

      <!-- Feed Specialization Section -->
      <div id="feed_sub_section" style="display: ${catVal === 'علف' ? 'block' : 'none'};">
        <label style="margin-top: 10px;">نوع حركة العلف *</label>
        <div class="feed-choice-container">
          <div class="feed-choice-card ${feedMode === 'purchased' ? 'active' : ''}" id="feed_choice_purchased" onclick="selectFeedMode('purchased')">
            <span class="feed-choice-icon">📦</span>
            <div class="feed-choice-text">
              <div class="feed-choice-title">شراء وتوريد للمخزن</div>
              <div class="feed-choice-desc">دفع فلوس كاش + إضافة شكاير للمخزن</div>
            </div>
          </div>
          <div class="feed-choice-card ${feedMode === 'consumed' ? 'active feed-consumed' : ''}" id="feed_choice_consumed" onclick="selectFeedMode('consumed')">
            <span class="feed-choice-icon">🌾</span>
            <div class="feed-choice-text">
              <div class="feed-choice-title">علف أكلته الطيور اليوم</div>
              <div class="feed-choice-desc">وجبة اليوم - بدون دفع كاش اليوم</div>
            </div>
          </div>
        </div>
        <input type="hidden" id="f_feed_mode" value="${feedMode}">

        <div id="consumed_info_banner" class="form-hint-banner" style="background: rgba(14,165,233,0.12); border-color: var(--sky); color: var(--sky); margin: 6px 0 14px; display: ${feedMode === 'consumed' ? 'flex' : 'none'};">
          <span style="font-size: 18px;">💡</span>
          <span style="font-size: 12px; line-height: 1.4;"><b>وجبة استهلاك يومية:</b> لا تتطلب دفع كاش اليوم؛ لأن العلف مسحوب من مخزن المزرعة مسبقاً. سيتم خصمها من رصيد المخزن واحتسابها في معامل التحويل (FCR).</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <label>الوحدة</label>
            <select id="f_feed_unit" onchange="updateFeedLiveHint()">
              <option value="شكارة" ${feedUnitVal === 'شكارة' ? 'selected' : ''}>شكارة (${bagKg} كجم)</option>
              <option value="كيلو" ${feedUnitVal === 'كيلو' ? 'selected' : ''}>كيلوجرام (كجم)</option>
            </select>
          </div>
          <div>
            <label>الكمية *</label>
            <input id="f_feed_q" type="number" inputmode="decimal" step="any" value="${feedQVal}" placeholder="الكمية" oninput="updateFeedLiveHint()">
          </div>
        </div>
        <div id="feed_live_hint" style="margin: 6px 0 12px; font-size: 12px; font-weight: 700; color: var(--text-muted);"></div>

        <label>نوع العلف أو بيان (اختياري)</label>
        <input id="f_feed_note" type="text" value="${feedNoteVal}" placeholder="مثال: بادي 23%، نامي 21%، ناهي 19%...">
      </div>

      <!-- Money Amount Field (Hidden only when Feed Consumed is active) -->
      <div id="f_amt_wrapper" style="display: ${catVal === 'علف' && feedMode === 'consumed' ? 'none' : 'block'};">
        <label>المبلغ المدفوع (جنيه) *</label>
        <input id="f_amt" type="number" inputmode="decimal" step="any" value="${amtVal}" placeholder="المبلغ المدفوع بالجنيه">
      </div>

      <!-- Standard Note Field (Visible when category is NOT feed) -->
      <div id="std_note_wrapper" style="display: ${catVal !== 'علف' ? 'block' : 'none'};">
        <label>ملاحظة أو بيان (اختياري)</label>
        <input id="f_std_note" type="text" value="${stdNoteVal}" placeholder="مثلاً: دفعة كتاكيت ساسو، فاتورة كهرباء...">
      </div>
    `;
  } else if (kind === 'inc') {
    // Specialized Sales Form with Cash Collection & Debt Separation
    const cntVal = isEdit && existing ? existing.cnt : '';
    const kgVal = isEdit && existing ? (existing.kg || '') : '';
    const amtVal = isEdit && existing ? existing.amt : '';
    const paidVal = isEdit && existing ? (existing.paidAmt !== undefined ? existing.paidAmt : existing.amt) : '';
    const buyerVal = isEdit && existing ? (existing.buyer || '') : '';

    h += `
      <label>عدد الطيور المباعة *</label>
      <input id="f_cnt" type="number" inputmode="numeric" value="${cntVal}" placeholder="مثلاً: 250" oninput="updateSaleCalculations()">

      <label>الوزن الإجمالي للطيور (كجم) (اختياري)</label>
      <input id="f_kg" type="number" inputmode="decimal" step="any" value="${kgVal}" placeholder="مثلاً: 520" oninput="updateSaleCalculations()">

      <label>إجمالي قيمة البيع (جنيه) *</label>
      <input id="f_amt" type="number" inputmode="decimal" step="any" value="${amtVal}" placeholder="مثلاً: 24000" oninput="updateSaleCalculations()">

      <label>المبلغ المحصل نقداً الآن (كاش) *</label>
      <input id="f_paidAmt" type="number" inputmode="decimal" step="any" value="${paidVal}" placeholder="المبلغ المستلم كاش بالفعل" oninput="updateSaleCalculations()">
      
      <div class="quick-fill-row">
        <button type="button" class="quick-fill-btn" onclick="fillFullCash()">
          💵 تم تحصيل كامل المبلغ كاش (بدون آجل)
        </button>
      </div>

      <!-- Live Dynamic Sale Status Banner -->
      <div id="sale_status_box" style="margin-bottom: 14px;"></div>

      <label>اسم المشتري / التاجر (مطلوب إذا كان هناك متبقي آجل)</label>
      <input id="f_buyer" type="text" value="${buyerVal}" placeholder="مثال: تاجر الأحد، محل البركة...">
    `;
  } else if (kind === 'dead') {
    const nVal = isEdit && existing ? existing.n : '';
    const noteVal = isEdit && existing ? (existing.note || '') : '';

    h += `
      <label>عدد الطيور النافقة *</label>
      <input id="f_n" type="number" inputmode="numeric" value="${nVal}" placeholder="مثلاً: 5">

      <label>سبب النفوق / ملاحظة (اختياري)</label>
      <input id="f_note" type="text" value="${noteVal}" placeholder="مثلاً: موجة حر، فرز أولي...">
    `;
  } else if (kind === 'debt') {
    // Specialized Debt Form
    const dirVal = isEdit && existing ? existing.dir : 'لنا';
    const whoVal = isEdit && existing ? existing.who : '';
    const amtVal = isEdit && existing ? existing.amt : '';
    const paidVal = isEdit && existing ? (existing.paidAmt || '') : '';
    const noteVal = isEdit && existing ? (existing.note || '') : '';

    h += `
      <label>نوع المديونية *</label>
      <select id="f_dir">
        <option value="لنا" ${dirVal === 'لنا' ? 'selected' : ''}>🟢 مستحق لنا عند الغير (دين لنا على تاجر أو مشتري)</option>
        <option value="علينا" ${dirVal === 'علينا' ? 'selected' : ''}>🔴 مستحق علينا للغير (دين علينا لمورد علف أو كتاكيت)</option>
      </select>

      <label>اسم الطرف الآخر (التاجر أو المورد) *</label>
      <input id="f_who" type="text" value="${whoVal}" placeholder="مثال: أبو علي التاجر، شركة الأعلاف...">

      <label>المبلغ الإجمالي للمديونية (جنيه) *</label>
      <input id="f_amt" type="number" inputmode="decimal" step="any" value="${amtVal}" placeholder="المبلغ الأصلي">

      <label>ما تم سداده مقدماً إن وجد (جنيه)</label>
      <input id="f_paidAmt" type="number" inputmode="decimal" step="any" value="${paidVal}" placeholder="المبلغ المسدد حتى الآن (إن وجد)">

      <label>بيان المديونية أو ملاحظة (اختياري)</label>
      <input id="f_note" type="text" value="${noteVal}" placeholder="مثلاً: باقي دفعة بيع، حساب توريد كتاكيت...">
    `;
  }

  h += `
    <div class="form-actions-row">
      <button class="btn btn-primary" style="flex: 2;" type="submit">${isEdit ? 'حفظ التعديلات' : 'حفظ البيانات'}</button>
      <button class="btn btn-outline" style="flex: 1;" type="button" onclick="closeM()">إلغاء</button>
    </div>
  `;

  formEl.innerHTML = h;

  // Trigger live calculation hints
  if (kind === 'inc') updateSaleCalculations();
  if (isUnified) updateFeedLiveHint();

  // Form Submit Handler with Solid Validation
  formEl.onsubmit = ev => {
    ev.preventDefault();
    clearFormErrors();

    const dVal = document.getElementById('f_d').value || today();
    let dataObj = { d: dVal };

    if (isUnified) {
      dataObj.cat = document.getElementById('f_cat').value;
      dataObj.feed_mode = document.getElementById('f_feed_mode') ? document.getElementById('f_feed_mode').value : 'purchased';
      dataObj.amt = document.getElementById('f_amt') ? document.getElementById('f_amt').value.trim() : '';
      dataObj.feed_unit = document.getElementById('f_feed_unit') ? document.getElementById('f_feed_unit').value : 'شكارة';
      dataObj.feed_q = document.getElementById('f_feed_q') ? document.getElementById('f_feed_q').value.trim() : '';
      dataObj.feed_note = document.getElementById('f_feed_note') ? document.getElementById('f_feed_note').value.trim() : '';
      dataObj.std_note = document.getElementById('f_std_note') ? document.getElementById('f_std_note').value.trim() : '';
      dataObj.note = dataObj.cat === 'علف' ? dataObj.feed_note : dataObj.std_note;
    } else if (kind === 'inc') {
      dataObj.cnt = document.getElementById('f_cnt').value.trim();
      dataObj.kg = document.getElementById('f_kg').value.trim();
      dataObj.amt = document.getElementById('f_amt').value.trim();
      dataObj.paidAmt = document.getElementById('f_paidAmt').value.trim();
      dataObj.buyer = document.getElementById('f_buyer').value.trim();
    } else if (kind === 'dead') {
      dataObj.n = document.getElementById('f_n').value.trim();
      dataObj.note = document.getElementById('f_note').value.trim();
    } else if (kind === 'debt') {
      dataObj.dir = document.getElementById('f_dir').value;
      dataObj.who = document.getElementById('f_who').value.trim();
      dataObj.amt = document.getElementById('f_amt').value.trim();
      dataObj.paidAmt = document.getElementById('f_paidAmt').value.trim();
      dataObj.note = document.getElementById('f_note').value.trim();
    }

    // Run strict validation
    const valRes = validateTransaction(isUnified ? 'exp' : kind, dataObj, isEdit, editIndex, cycle);
    if (!valRes.valid) {
      showFormError(valRes.message, valRes.field);
      return;
    }

    if (isUnified) {
      if (dataObj.cat === 'علف') {
        const qNum = +dataObj.feed_q;
        const totalKg = dataObj.feed_unit === 'شكارة' ? qNum * bagKg : qNum;
        const feedTxt = qNum + ' ' + dataObj.feed_unit + (dataObj.feed_note ? ' (' + dataObj.feed_note + ')' : '');

        if (dataObj.feed_mode === 'purchased') {
          const amtNum = +dataObj.amt;
          let targetExp = isExpKind && isEdit ? cycle.exp[editIndex] : linkedRef;
          let targetFeed = isFeedKind && isEdit ? cycle.feed[editIndex] : linkedRef;

          if (targetExp && targetFeed) {
            targetExp.d = dataObj.d;
            targetExp.amt = amtNum;
            targetExp.cat = 'علف';
            targetExp.note = dataObj.feed_note;

            targetFeed.d = dataObj.d;
            targetFeed.type = 'purchased';
            targetFeed.q = qNum;
            targetFeed.unit = dataObj.feed_unit;
            targetFeed.kg = totalKg;
            targetFeed.note = dataObj.feed_note;
            targetFeed.txt = feedTxt;
            showToast('تم تعديل شراء العلف ورصيد المخزن بنجاح ✓');
          } else if (targetExp && !targetFeed) {
            targetExp.d = dataObj.d;
            targetExp.amt = amtNum;
            targetExp.cat = 'علف';
            targetExp.note = dataObj.feed_note;
            const newFeedId = Date.now() + Math.floor(Math.random() * 1000);
            targetExp.feedRefId = newFeedId;
            cycle.feed.push({
              id: newFeedId,
              d: dataObj.d,
              type: 'purchased',
              q: qNum,
              unit: dataObj.feed_unit,
              kg: totalKg,
              note: dataObj.feed_note,
              txt: feedTxt,
              expRefId: targetExp.id
            });
            showToast('تم تحديث المصروف وإضافة العلف للمخزن ✓');
          } else if (!targetExp && targetFeed) {
            targetFeed.d = dataObj.d;
            targetFeed.type = 'purchased';
            targetFeed.q = qNum;
            targetFeed.unit = dataObj.feed_unit;
            targetFeed.kg = totalKg;
            targetFeed.note = dataObj.feed_note;
            targetFeed.txt = feedTxt;
            const newExpId = Date.now() + Math.floor(Math.random() * 1000);
            targetFeed.expRefId = newExpId;
            cycle.exp.push({
              id: newExpId,
              d: dataObj.d,
              cat: 'علف',
              amt: amtNum,
              note: dataObj.feed_note,
              feedRefId: targetFeed.id
            });
            showToast('تم تحديث حركة العلف والمصروف المالي ✓');
          } else {
            const newExpId = Date.now() + Math.floor(Math.random() * 1000);
            const newFeedId = newExpId + 1;
            cycle.exp.push({
              id: newExpId,
              d: dataObj.d,
              cat: 'علف',
              amt: amtNum,
              note: dataObj.feed_note,
              feedRefId: newFeedId
            });
            cycle.feed.push({
              id: newFeedId,
              d: dataObj.d,
              type: 'purchased',
              q: qNum,
              unit: dataObj.feed_unit,
              kg: totalKg,
              note: dataObj.feed_note,
              txt: feedTxt,
              expRefId: newExpId
            });
            showToast('تم تسجيل شراء وتوريد العلف للمخزن بنجاح ✓');
          }
        } else {
          // Consumed feed
          let targetFeed = isFeedKind && isEdit ? cycle.feed[editIndex] : null;
          if (targetFeed) {
            targetFeed.d = dataObj.d;
            targetFeed.type = 'consumed';
            targetFeed.q = qNum;
            targetFeed.unit = dataObj.feed_unit;
            targetFeed.kg = totalKg;
            targetFeed.note = dataObj.feed_note;
            targetFeed.txt = feedTxt;
            if (targetFeed.expRefId) {
              const oldExpIdx = cycle.exp.findIndex(x => x.id === targetFeed.expRefId);
              if (oldExpIdx !== -1) cycle.exp.splice(oldExpIdx, 1);
              delete targetFeed.expRefId;
            }
            showToast('تم حفظ تعديل استهلاك العلف اليومي ✓');
          } else {
            const newFeedId = Date.now() + Math.floor(Math.random() * 1000);
            cycle.feed.push({
              id: newFeedId,
              d: dataObj.d,
              type: 'consumed',
              q: qNum,
              unit: dataObj.feed_unit,
              kg: totalKg,
              note: dataObj.feed_note,
              txt: feedTxt
            });
            showToast('تم تسجيل استهلاك وجبة العلف بنجاح 🌾');
          }
        }
      } else {
        // Standard expense
        const amtNum = +dataObj.amt;
        if (isExpKind && isEdit) {
          const targetExp = cycle.exp[editIndex];
          targetExp.d = dataObj.d;
          targetExp.cat = dataObj.cat;
          targetExp.amt = amtNum;
          targetExp.note = dataObj.note;
          if (targetExp.feedRefId) {
            const oldFeedIdx = cycle.feed.findIndex(f => f.id === targetExp.feedRefId);
            if (oldFeedIdx !== -1) cycle.feed.splice(oldFeedIdx, 1);
            delete targetExp.feedRefId;
          }
          showToast(`تم تعديل مصروف (${targetExp.cat}) بنجاح ✓`);
        } else {
          cycle.exp.push({
            id: Date.now() + Math.floor(Math.random() * 1000),
            d: dataObj.d,
            cat: dataObj.cat,
            amt: amtNum,
            note: dataObj.note
          });
          showToast(`تمت إضافة مصروف (${dataObj.cat}) بنجاح ✓`);
        }
      }

      saveData();
      closeM();
      render();
      return;
    }

    // Kind is inc, dead, or debt
    const o = isEdit ? { ...existing } : { id: Date.now() + Math.floor(Math.random() * 1000) };
    o.d = dataObj.d;

    if (kind === 'inc') {
      o.cnt = +dataObj.cnt;
      o.kg = dataObj.kg !== '' ? +dataObj.kg : 0;
      o.amt = +dataObj.amt;
      o.paidAmt = dataObj.paidAmt !== '' ? +dataObj.paidAmt : o.amt;
      o.buyer = dataObj.buyer;

      const remainingSaleAmt = Math.max(0, o.amt - o.paidAmt);

      if (remainingSaleAmt > 0) {
        let linkedDebt = null;
        if (isEdit && o.debtRefId) {
          linkedDebt = cycle.debt.find(d => d.id === o.debtRefId);
        }
        if (!linkedDebt && o.id) {
          linkedDebt = cycle.debt.find(d => d.saleId === o.id);
        }

        if (linkedDebt) {
          linkedDebt.who = o.buyer || 'مشتري آجل';
          linkedDebt.amt = remainingSaleAmt;
          linkedDebt.paid = (linkedDebt.paidAmt || 0) >= remainingSaleAmt;
          linkedDebt.d = o.d;
          linkedDebt.note = `باقي بيع ${o.cnt} طائر بتاريخ ${o.d}`;
        } else {
          const newDebtId = Date.now() + Math.floor(Math.random() * 1000);
          const newDebt = {
            id: newDebtId,
            d: o.d,
            dir: 'لنا',
            who: o.buyer || 'مشتري آجل',
            amt: remainingSaleAmt,
            paidAmt: 0,
            paid: false,
            note: `باقي بيع ${o.cnt} طائر بتاريخ ${o.d}`,
            saleId: o.id,
            payments: []
          };
          cycle.debt.push(newDebt);
          o.debtRefId = newDebtId;
        }
      } else if (remainingSaleAmt === 0 && (o.debtRefId || o.id)) {
        const linkedDebt = cycle.debt.find(d => d.id === o.debtRefId || d.saleId === o.id);
        if (linkedDebt) {
          linkedDebt.paidAmt = linkedDebt.amt;
          linkedDebt.paid = true;
        }
      }
    } else if (kind === 'dead') {
      o.n = +dataObj.n;
      o.note = dataObj.note;
    } else if (kind === 'debt') {
      o.dir = dataObj.dir;
      o.who = dataObj.who;
      o.amt = +dataObj.amt;
      o.paidAmt = dataObj.paidAmt !== '' ? +dataObj.paidAmt : (isEdit ? (existing.paidAmt || 0) : 0);
      o.paid = o.paidAmt >= o.amt;
      o.note = dataObj.note;
      o.payments = isEdit && existing.payments ? existing.payments : [];
    }

    if (isEdit) {
      cycle[kind][editIndex] = o;
      showToast(`تم تعديل ${K[kind].t} بنجاح ✓`);
    } else {
      cycle[kind].push(o);
      showToast(`تمت إضافة ${K[kind].t} بنجاح ✓`);
    }

    saveData();
    closeM();
    render();
  };

  modal.classList.add('on');
}

// Helper: Fill full cash amount in sales form
function fillFullCash() {
  const amtEl = document.getElementById('f_amt');
  const paidEl = document.getElementById('f_paidAmt');
  if (amtEl && paidEl) {
    paidEl.value = amtEl.value;
    updateSaleCalculations();
  }
}

// Live calculation updater for sales form
function updateSaleCalculations() {
  const box = document.getElementById('sale_status_box');
  if (!box) return;

  const cnt = +document.getElementById('f_cnt').value || 0;
  const kg = +document.getElementById('f_kg').value || 0;
  const amt = +document.getElementById('f_amt').value || 0;
  const paidVal = document.getElementById('f_paidAmt').value;
  const paid = paidVal !== '' ? +paidVal : amt;

  let details = [];
  if (cnt > 0 && kg > 0) {
    details.push(`متوسط وزن الطائر: <b>${(kg / cnt).toFixed(2)} كجم</b>`);
  }
  if (kg > 0 && amt > 0) {
    details.push(`سعر الكيلو التقديري: <b>${(amt / kg).toFixed(1)} ج</b>`);
  }

  let statusHtml = '';
  if (amt > 0) {
    if (paid >= amt) {
      statusHtml = `<div class="form-hint-banner emerald" style="margin: 6px 0;">✓ تم التحصيل بالكامل كاش (لا توجد مديونية).</div>`;
    } else if (paid < amt && paid >= 0) {
      const rem = amt - paid;
      statusHtml = `
        <div class="form-hint-banner amber" style="margin: 6px 0;">
          <span>⏳ المتبقي كمديونية آجل: <b>${f(rem)} ج</b> (سيتم تسجيلها تلقائياً على المشتري في قسم الديون).</span>
        </div>
      `;
    } else {
      statusHtml = `<div class="form-hint-banner" style="margin: 6px 0; color:var(--rose); background:rgba(244,63,94,0.12); border-color:var(--rose);">⚠️ المبلغ المحصل لا يمكن أن يتجاوز إجمالي البيع.</div>`;
    }
  }

  box.innerHTML = `
    ${details.length ? `<div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">${details.join(' • ')}</div>` : ''}
    ${statusHtml}
  `;
}

// Interactive handlers for unified Expense & Feed Form
function onExpenseCatChange() {
  const catEl = document.getElementById('f_cat');
  if (!catEl) return;
  const cat = catEl.value;
  const feedSec = document.getElementById('feed_sub_section');
  const amtWrapper = document.getElementById('f_amt_wrapper');
  const stdNoteWrapper = document.getElementById('std_note_wrapper');
  const feedMode = document.getElementById('f_feed_mode') ? document.getElementById('f_feed_mode').value : 'purchased';

  if (cat === 'علف') {
    if (feedSec) feedSec.style.display = 'block';
    if (stdNoteWrapper) stdNoteWrapper.style.display = 'none';
    if (amtWrapper) amtWrapper.style.display = feedMode === 'consumed' ? 'none' : 'block';
    updateFeedLiveHint();
  } else {
    if (feedSec) feedSec.style.display = 'none';
    if (stdNoteWrapper) stdNoteWrapper.style.display = 'block';
    if (amtWrapper) amtWrapper.style.display = 'block';
  }
}

function selectFeedMode(mode) {
  const modeInput = document.getElementById('f_feed_mode');
  if (modeInput) modeInput.value = mode;

  const cardPurchased = document.getElementById('feed_choice_purchased');
  const cardConsumed = document.getElementById('feed_choice_consumed');
  const amtWrapper = document.getElementById('f_amt_wrapper');
  const banner = document.getElementById('consumed_info_banner');

  if (cardPurchased && cardConsumed) {
    if (mode === 'purchased') {
      cardPurchased.classList.add('active');
      cardConsumed.classList.remove('active', 'feed-consumed');
      if (amtWrapper) amtWrapper.style.display = 'block';
      if (banner) banner.style.display = 'none';
    } else {
      cardPurchased.classList.remove('active');
      cardConsumed.classList.add('active', 'feed-consumed');
      if (amtWrapper) amtWrapper.style.display = 'none';
      if (banner) banner.style.display = 'flex';
    }
  }

  updateFeedLiveHint();
}

function updateFeedLiveHint() {
  const hintEl = document.getElementById('feed_live_hint');
  if (!hintEl) return;

  const unitEl = document.getElementById('f_feed_unit');
  const qEl = document.getElementById('f_feed_q');
  const modeEl = document.getElementById('f_feed_mode');
  if (!unitEl || !qEl) return;

  const unit = unitEl.value;
  const q = +qEl.value || 0;
  const mode = modeEl ? modeEl.value : 'purchased';
  const totalKg = unit === 'شكارة' ? q * bagKg : q;
  const totalBags = (totalKg / bagKg).toFixed(1);

  const cycle = cur();
  const k = calc(cycle);

  if (q > 0) {
    if (mode === 'purchased') {
      hintEl.innerHTML = `📦 الكمية تعادل: <b>${f(totalKg)} كجم</b> (${totalBags} شكارة) ستضاف إلى رصيد المخزن.`;
      hintEl.style.color = 'var(--emerald)';
    } else {
      hintEl.innerHTML = `🌾 الكمية تعادل: <b>${f(totalKg)} كجم</b> (${totalBags} شكارة) ستخصم من المخزن (المتبقي الحالي بالمخزن: ${f(k.feedStockKg)} كجم).`;
      hintEl.style.color = 'var(--sky)';
    }
  } else {
    hintEl.textContent = '';
  }
}

// Live date text updater for Egypt local date display
function updateDateDisplay(val) {
  const disp = document.getElementById('f_d_display');
  if (disp && val) {
    disp.textContent = fd(val);
  }
}

function updateFeedHint() {
  updateFeedLiveHint();
}

// ==========================================================================
// DEBT PARTIAL / FULL PAYMENT MODAL
// ==========================================================================
function openPaymentModal(debtIndex) {
  const cycle = cur();
  if (!cycle || !cycle.debt || !cycle.debt[debtIndex]) return;
  const d = cycle.debt[debtIndex];
  const { m: modal, fm: formEl } = ensureModalElements();
  if (!modal || !formEl) return;

  const total = +d.amt || 0;
  const paid = +d.paidAmt || (d.paid ? total : 0);
  const remaining = Math.max(0, total - paid);
  const isUs = d.dir === 'لنا';

  formEl.innerHTML = `
    <div class="form-header">
      <div class="form-title">تسجيل سداد دين 💵</div>
      <button type="button" class="btn btn-sm btn-outline" onclick="closeM()">✕</button>
    </div>

    <div id="form_error_container"></div>

    <div class="card" style="margin-bottom: 16px; padding: 14px; background: rgba(0,0,0,0.2);">
      <div style="font-size: 15px; font-weight: 800; color: var(--text-title); margin-bottom: 4px;">
        الطرف: ${d.who}
      </div>
      <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">
        ${isUs ? '🟢 مستحق لنا عنده (دين لنا)' : '🔴 مستحق علينا له (دين علينا)'}
      </div>
      <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--border-subtle); padding-top: 8px;">
        <span>إجمالي الدين: <b>${f(total)} ج</b></span>
        <span>المسدد سابقاً: <b style="color:var(--emerald);">${f(paid)} ج</b></span>
        <span>المتبقي المطلوب: <b style="color:var(--amber); font-size:16px;">${f(remaining)} ج</b></span>
      </div>
    </div>

    <label>تاريخ السداد</label>
    <input type="date" id="p_d" value="${today()}">

    <label>المبلغ المسدد الآن (جنيه) *</label>
    <input type="number" id="p_amt" inputmode="decimal" step="any" placeholder="المبلغ المدفوع بالجنيه">

    <div class="quick-fill-row">
      <button type="button" class="quick-fill-btn" onclick="document.getElementById('p_amt').value = ${remaining};">
        ⚡ سداد كامل المبلغ المتبقي (${f(remaining)} ج)
      </button>
    </div>

    <label>طريقة الدفع أو بيان (اختياري)</label>
    <input type="text" id="p_note" placeholder="مثال: نقداً كاش، فودافون كاش، تحويل بنكي...">

    <div class="form-actions-row">
      <button class="btn btn-primary" style="flex: 2;" type="submit">تسجيل السداد والحفظ</button>
      <button class="btn btn-outline" style="flex: 1;" type="button" onclick="closeM()">إلغاء</button>
    </div>
  `;

  formEl.onsubmit = ev => {
    ev.preventDefault();
    clearFormErrors();

    const pAmtVal = document.getElementById('p_amt').value.trim();
    const pDVal = document.getElementById('p_d').value || today();
    const pNoteVal = document.getElementById('p_note').value.trim();

    if (!pAmtVal || isNaN(pAmtVal) || +pAmtVal <= 0) {
      showFormError('يرجى إدخال مبلغ سداد صحيح أكبر من الصفر.', 'p_amt');
      return;
    }

    const paymentAmt = +pAmtVal;
    if (paymentAmt > remaining) {
      showFormError(`عفواً، مبلغ السداد (${f(paymentAmt)} ج) أكبر من المبلغ المتبقي المطلوب (${f(remaining)} ج).`, 'p_amt');
      return;
    }

    // Record payment
    d.payments = d.payments || [];
    d.payments.push({
      id: Date.now() + Math.floor(Math.random() * 1000),
      d: pDVal,
      amt: paymentAmt,
      note: pNoteVal
    });

    d.paidAmt = (d.paidAmt || 0) + paymentAmt;
    d.paid = d.paidAmt >= d.amt;

    saveData();
    closeM();
    showToast(`تم تسجيل سداد مبلغ ${f(paymentAmt)} ج بنجاح ✓`);
    render();
  };

  modal.classList.add('on');
}

// Delete an individual payment record from debt history
function deletePayment(debtIndex, paymentIndex) {
  const cycle = cur();
  if (!cycle || !cycle.debt || !cycle.debt[debtIndex]) return;
  const d = cycle.debt[debtIndex];
  const payment = d.payments[paymentIndex];

  showConfirmModal({
    icon: '↩️',
    title: 'تأكيد إلغاء دفعة السداد ⚠️',
    subtitle: 'هل تريد إلغاء هذه الدفعة المسددة؟ سيتم إعادة المبلغ تلقائياً لرصيد المديونية المتبقي.',
    itemIcon: '💵',
    itemTitle: `دفعة سداد: ${f(payment.amt)} ج (${d.who})`,
    itemMeta: `تاريخ السداد: ${fd(payment.d)} ${payment.note ? '• البيان: ' + payment.note : ''}`,
    confirmBtnText: 'نعم، إلغاء الدفعة واسترجاع الرصيد',
    onConfirm: () => {
      d.paidAmt = Math.max(0, (d.paidAmt || 0) - payment.amt);
      d.paid = d.paidAmt >= d.amt;
      d.payments.splice(paymentIndex, 1);

      saveData();
      showToast('تم إلغاء الدفعة واسترجاع الرصيد بنجاح');
      render();
    }
  });
}

// Delete sale with automatic handling of linked debt
function delSale(i) {
  const cycle = cur();
  const sale = cycle.inc[i];
  const hasLinkedDebt = sale.debtRefId || sale.id;
  const linkedDebt = hasLinkedDebt ? cycle.debt.find(d => d.id === sale.debtRefId || d.saleId === sale.id) : null;

  showConfirmModal({
    icon: '🗑️',
    title: 'تأكيد حذف حركة البيع ⚠️',
    subtitle: 'هل أنت متأكد من حذف حركة البيع هذه؟ سيتم خصم هذا المبلغ من إجمالي المبيعات وإعادة عدد الطيور المباعة إلى القطيع الحي بالمزرعة.',
    itemIcon: '📈',
    itemTitle: `بيع ${sale.cnt} طائر ${sale.buyer ? '(' + sale.buyer + ')' : ''}`,
    itemMeta: `إجمالي القيمة: ${f(sale.amt)} ج • محصل كاش: ${f(sale.paidAmt)} ج • التاريخ: ${fd(sale.d)}`,
    warningNote: linkedDebt ? `تنبيه: سيتم أيضاً حذف المديونية المرتبطة بهذا البيع (${f(linkedDebt.amt)} ج على ${linkedDebt.who}) تلقائياً منعاً لتكرار الديون.` : '',
    confirmBtnText: 'نعم، حذف حركة البيع نهائياً',
    onConfirm: () => {
      if (linkedDebt) {
        const debtIdx = cycle.debt.indexOf(linkedDebt);
        if (debtIdx !== -1) {
          cycle.debt.splice(debtIdx, 1);
        }
      }
      cycle.inc.splice(i, 1);
      saveData();
      showToast('تم حذف حركة البيع وتحديث الأرصدة والديون');
      render();
    }
  });
}

// Delete debt record
function delDebt(i) {
  const cycle = cur();
  const d = cycle.debt[i];
  const isUs = d.dir === 'لنا';
  const rem = Math.max(0, d.amt - (d.paidAmt || 0));

  showConfirmModal({
    icon: '🗑️',
    title: 'تأكيد حذف المديونية ⚠️',
    subtitle: 'هل أنت متأكد من رغبتك في حذف هذا السجل للمديونية نهائياً؟',
    itemIcon: '📝',
    itemTitle: `${d.who} (${isUs ? '🟢 مستحق لنا عنده' : '🔴 مستحق علينا له'})`,
    itemMeta: `المبلغ الأصلي: ${f(d.amt)} ج • المسدد: ${f(d.paidAmt || 0)} ج • المتبقي: ${f(rem)} ج`,
    warningNote: (d.payments && d.payments.length > 0) ? `تحذير: يحتوي هذا السجل على (${d.payments.length}) دفعات مسددة مسجلة سيتم مسحها بالكامل مع السجل.` : '',
    confirmBtnText: 'نعم، احذف المديونية نهائياً',
    onConfirm: () => {
      cycle.debt.splice(i, 1);
      saveData();
      showToast('تم حذف المديونية بنجاح');
      render();
    }
  });
}

// Generic delete for expenses, mortality, or feed
function del(i) {
  const cycle = cur();
  if (!cycle) return;
  const kind = S.tab;

  if (kind === 'exp') {
    const e = cycle.exp[i];
    const isFeed = e.cat === 'علف' || e.feedRefId;
    const linkedFeed = isFeed ? (cycle.feed.find(f => f.id === e.feedRefId || f.expRefId === e.id)) : null;

    showConfirmModal({
      icon: '🗑️',
      title: 'تأكيد حذف المصروف ⚠️',
      subtitle: 'هل أنت متأكد من رغبتك في حذف هذا المصروف؟ سيتم خصم هذا المبلغ من إجمالي التكاليف.',
      itemIcon: isFeed ? '🌾' : '💸',
      itemTitle: `مصروف: ${e.cat} ${e.note ? '(' + e.note + ')' : ''}`,
      itemMeta: `المبلغ: ${f(e.amt)} ج • التاريخ: ${fd(e.d)}`,
      warningNote: linkedFeed ? `تنبيه: سيتم أيضاً حذف حركة توريد العلف من المخزن (${f(linkedFeed.kg)} كجم) تلقائياً لتحديث رصيد المخزن بدقة.` : '',
      confirmBtnText: 'نعم، احذف المصروف',
      onConfirm: () => {
        if (linkedFeed) {
          const feedIdx = cycle.feed.indexOf(linkedFeed);
          if (feedIdx !== -1) cycle.feed.splice(feedIdx, 1);
        }
        cycle.exp.splice(i, 1);
        saveData();
        showToast('تم حذف المصروف وتحديث رصيد المخزن بنجاح');
        render();
      }
    });
  } else if (kind === 'dead') {
    const e = cycle.dead[i];
    showConfirmModal({
      icon: '🗑️',
      title: 'تأكيد حذف تسجيل النافق ⚠️',
      subtitle: 'هل أنت متأكد من حذف هذا السجل للنافق؟ سيتم استرجاع عدد هذه الطيور للرصيد الحي المتبقي بالمزرعة.',
      itemIcon: '⚠️',
      itemTitle: `تسجيل نافق: ${e.n} طائر ${e.note ? '(' + e.note + ')' : ''}`,
      itemMeta: `التاريخ: ${fd(e.d)}`,
      confirmBtnText: 'نعم، احذف السجل',
      onConfirm: () => {
        cycle.dead.splice(i, 1);
        saveData();
        showToast('تم حذف تسجيل النافق واسترجاع الطيور');
        render();
      }
    });
  } else if (kind === 'feed') {
    const e = cycle.feed[i];
    const isPurchased = e.type === 'purchased';
    const linkedExp = isPurchased ? (cycle.exp.find(x => x.id === e.expRefId || x.feedRefId === e.id)) : null;

    showConfirmModal({
      icon: '🗑️',
      title: 'تأكيد حذف حركة العلف ⚠️',
      subtitle: 'هل أنت متأكد من حذف هذه الحركة؟ سيتم تحديث رصيد المخزن ومعامل التحويل تلقائياً.',
      itemIcon: isPurchased ? '📦' : '🌾',
      itemTitle: `${isPurchased ? 'علف وارد للمخزن' : 'علف مستهلك للطيور'}: ${e.txt || (e.q + ' ' + (e.unit || 'شكارة'))}`,
      itemMeta: `الكمية: ${f(e.kg)} كجم • التاريخ: ${fd(e.d)}`,
      warningNote: linkedExp ? `تنبيه: سيتم أيضاً حذف المصروف المالي المرتبط بهذا العلف (${f(linkedExp.amt)} ج) من المصروفات تلقائياً منعاً للازدواج.` : '',
      confirmBtnText: 'نعم، احذف حركة العلف',
      onConfirm: () => {
        if (linkedExp) {
          const expIdx = cycle.exp.indexOf(linkedExp);
          if (expIdx !== -1) cycle.exp.splice(expIdx, 1);
        }
        cycle.feed.splice(i, 1);
        saveData();
        showToast('تم حذف حركة العلف وتحديث المصروفات بنجاح');
        render();
      }
    });
  } else {
    cycle[kind].splice(i, 1);
    saveData();
    showToast('تم الحذف بنجاح');
    render();
  }
}

// ==========================================================================
// CYCLE MANAGEMENT (Edit, Create, Delete, Close)
// ==========================================================================
function editCycle() {
  const c = cur();
  if (!c) return;
  const { m: modal, fm: formEl } = ensureModalElements();
  if (!modal || !formEl) return;

  formEl.innerHTML = `
    <div class="form-header">
      <div class="form-title">تعديل بيانات الدورة ✏️</div>
      <button type="button" class="btn btn-sm btn-outline" onclick="closeM()">✕</button>
    </div>

    <div id="form_error_container"></div>

    <label>اسم الدورة *</label>
    <input id="edit_nn" value="${c.name || ''}" placeholder="اسم الدورة">

    <label>تاريخ البدء</label>
    <input type="date" id="edit_ns" value="${c.start || today()}">

    <label>عدد الكتاكيت الأصلي المستلم *</label>
    <input type="number" id="edit_nc" value="${c.n || 0}" inputmode="numeric" placeholder="مثلاً: 1000">

    <label>حالة الدورة</label>
    <select id="edit_status">
      <option value="ongoing" ${!c.end ? 'selected' : ''}>شغالة الآن (جارية)</option>
      <option value="closed" ${c.end ? 'selected' : ''}>مقفولة (مكتملة)</option>
    </select>

    <div class="form-actions-row">
      <button class="btn btn-primary" style="flex: 2;" type="submit">حفظ تعديلات الدورة</button>
      <button class="btn btn-outline" style="flex: 1;" type="button" onclick="closeM()">إلغاء</button>
    </div>

    <div style="margin-top: 20px; border-top: 1px solid var(--border-subtle); padding-top: 14px; text-align: center;">
      <button type="button" class="btn btn-sm btn-danger" onclick="deleteCycle(${c.id})">
        حذف هذه الدورة وكافة سجلاتها نهائياً 🗑️
      </button>
    </div>
  `;

  formEl.onsubmit = ev => {
    ev.preventDefault();
    clearFormErrors();

    const nn = document.getElementById('edit_nn').value.trim();
    const ns = document.getElementById('edit_ns').value;
    const ncVal = document.getElementById('edit_nc').value.trim();
    const st = document.getElementById('edit_status').value;

    if (!nn) {
      showFormError('يرجى إدخال اسم الدورة.', 'edit_nn');
      return;
    }
    if (!ncVal || isNaN(ncVal) || +ncVal <= 0) {
      showFormError('يرجى إدخال عدد كتاكيت صحيح أكبر من الصفر.', 'edit_nc');
      return;
    }

    c.name = nn;
    c.start = ns || c.start;
    c.n = +ncVal;

    if (st === 'closed' && !c.end) {
      c.end = today();
    } else if (st === 'ongoing') {
      c.end = null;
    }

    saveData();
    closeM();
    showToast('تم حفظ تعديلات الدورة بنجاح ✓');
    render();
  };

  modal.classList.add('on');
}

function deleteCycle(id) {
  const cycle = C.find(x => x.id === id);
  if (!cycle) return;

  showConfirmModal({
    icon: '🚨',
    title: 'تحذير شديد: حذف دورة كاملة 🗑️',
    subtitle: 'أنت على وشك حذف هذه الدورة بالكامل بكافة مصروفاتها ومبيعاتها وسجلاتها. لا يمكن استرجاع هذه البيانات بعد الحذف!',
    itemIcon: '🐔',
    itemTitle: `دورة: ${cycle.name}`,
    itemMeta: `العدد المستلم: ${f(cycle.n)} طائر • بدأت: ${fd(cycle.start)}`,
    warningNote: 'سيتم مسح كافة سجلات المصروفات، المبيعات، النافق، العلف، والديون المرتبطة بهذه الدورة نهائياً.',
    confirmBtnText: 'نعم، أنا متأكد - احذف الدورة بالكامل',
    onConfirm: () => {
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
  });
}

function newCycle() {
  const { m: modal, fm: formEl } = ensureModalElements();
  if (!modal || !formEl) return;

  formEl.innerHTML = `
    <div class="form-header">
      <div class="form-title">بدء دورة تسمين جديدة 🐣</div>
      <button type="button" class="btn btn-sm btn-outline" onclick="closeM()">✕</button>
    </div>

    <div id="form_error_container"></div>

    <label>اسم الدورة (مثال: دورة نوفمبر، دفعة رقم 3) *</label>
    <input id="nn" value="دورة جديدة" placeholder="اسم الدورة">

    <label>تاريخ استلام الكتاكيت (البداية)</label>
    <input type="date" id="ns" value="${today()}">

    <label>عدد الكتاكيت المستلمة *</label>
    <input type="number" id="nc" inputmode="numeric" placeholder="مثلاً: 1000">

    <div class="form-actions-row">
      <button class="btn btn-primary" style="flex: 2;" type="submit">إنشاء الدورة</button>
      <button class="btn btn-outline" style="flex: 1;" type="button" onclick="closeM()">إلغاء</button>
    </div>
  `;

  formEl.onsubmit = ev => {
    ev.preventDefault();
    clearFormErrors();

    const nn = document.getElementById('nn').value.trim();
    const ns = document.getElementById('ns').value;
    const ncVal = document.getElementById('nc').value.trim();

    if (!nn) {
      showFormError('يرجى إدخال اسم الدورة.', 'nn');
      return;
    }
    if (!ncVal || isNaN(ncVal) || +ncVal <= 0) {
      showFormError('يرجى إدخال عدد كتاكيت صحيح أكبر من الصفر.', 'nc');
      return;
    }

    const newObj = {
      id: nid++,
      name: nn,
      start: ns || today(),
      end: null,
      n: +ncVal,
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

  modal.classList.add('on');
}

function closeC() {
  const cycle = cur();
  if (!cycle) return;

  showConfirmModal({
    icon: '🔒',
    title: 'تأكيد إغلاق الدورة رسمياً',
    subtitle: 'هل أنت متأكد من قفل هذه الدورة؟ سيتم تسجيل تاريخ اليوم كنهاية رسمية لانتهاء عمليات البيع والتسمين. (يمكنك دائماً مراجعة سجلاتها وأرباحها في أي وقت)',
    itemIcon: '🐔',
    itemTitle: `دورة: ${cycle.name}`,
    itemMeta: `عمر الدورة حتى اليوم: ${Math.max(1, Math.floor((new Date(today()) - new Date(cycle.start))/(1000*60*60*24))+1)} يوم`,
    confirmBtnText: 'نعم، إغلاق وقفل الدورة',
    onConfirm: () => {
      cycle.end = today();
      saveData();
      showToast('تم إغلاق الدورة بنجاح ✓');
      render();
    }
  });
}
