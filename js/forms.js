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
        <span>${esc(msg)}</span>
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
  document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
}

// Validation function returning detailed error message or null if valid
function validateTransaction(kind, data, isEdit, editIndex, cycle) {
  const k = calc(cycle);

  if (kind === 'inc') {
    const flockId = +data.flockId;
    const flock = (cycle.flocks || []).find(fl => fl.id === flockId);
    if (!flock) {
      return { valid: false, field: null, message: 'يرجى اختيار نوع الفراخ المباعة أولاً.' };
    }

    // 1. Bird Count Validation per selected flock type
    if (!data.cnt || isNaN(data.cnt) || +data.cnt <= 0 || !Number.isInteger(+data.cnt)) {
      return { valid: false, field: 'f_cnt', message: 'يرجى إدخال عدد صحيح للطيور المباعة أكبر من الصفر (بدون كسور).' };
    }
    const availBirds = flockAvailability(cycle, flockId, 'inc', editIndex);
    if (+data.cnt > availBirds) {
      return {
        valid: false,
        field: 'f_cnt',
        message: `عفواً، عدد الطيور المباعة (${data.cnt}) أكبر من المتبقي المتاح من نوع "${flock.name}" (${availBirds} طائر).`
      };
    }

    // 2. Sale Amount Validation
    if (!data.amt || isNaN(data.amt) || +data.amt <= 0) {
      return { valid: false, field: 'f_amt', message: 'يرجى إدخال قيمة البيع بمبلغ صحيح أكبر من الصفر.' };
    }
  }

  if (kind === 'dead') {
    const flockId = +data.flockId;
    const flock = (cycle.flocks || []).find(fl => fl.id === flockId);
    if (!flock) {
      return { valid: false, field: null, message: 'يرجى اختيار نوع الفراخ النافقة أولاً.' };
    }

    if (!data.n || isNaN(data.n) || +data.n <= 0 || !Number.isInteger(+data.n)) {
      return { valid: false, field: 'f_n', message: 'يرجى إدخال عدد صحيح للطيور النافقة أكبر من الصفر (بدون كسور).' };
    }
    const availLive = flockAvailability(cycle, flockId, 'dead', editIndex);
    if (+data.n > availLive) {
      return {
        valid: false,
        field: 'f_n',
        message: `عفواً، عدد النافق (${data.n}) أكبر من المتبقي الحي من نوع "${flock.name}" (${availLive} طائر).`
      };
    }
  }

  if (kind === 'exp' || kind === 'feed') {
    if (!data.amt || isNaN(data.amt) || +data.amt <= 0) {
      return { valid: false, field: 'f_amt', message: 'يرجى إدخال المبلغ المدفوع بشكل صحيح (أكبر من الصفر).' };
    }
    if (data.cat === 'علف') {
      if (!data.feed_q || isNaN(data.feed_q) || +data.feed_q <= 0) {
        return { valid: false, field: 'f_feed_q', message: 'يرجى إدخال كمية العلف المشتراة برقم صحيح أكبر من الصفر.' };
      }
    }
  }

  if (kind === 'debt') {
    if (!data.who || !data.who.trim()) {
      return { valid: false, field: 'f_who', message: 'يرجى كتابة تفاصيل المستحق أو اسم التاجر.' };
    }
    if (!data.amt || isNaN(data.amt) || +data.amt <= 0) {
      return { valid: false, field: 'f_amt', message: 'يرجى إدخال المبلغ بشكل صحيح (أكبر من الصفر).' };
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

  let catVal = 'علف';
  if (isUnified) {
    if (isEdit) {
      if (isFeedKind) {
        catVal = 'علف';
      } else if (existing) {
        catVal = existing.cat || 'علف';
      }
    } else if (prefillData) {
      if (typeof prefillData === 'string') {
        catVal = prefillData;
      } else if (prefillData.cat) {
        catVal = prefillData.cat;
      }
    }

    // Normalize to 4 shared cycle expense categories
    if (catVal === 'أدوية وتحصينات' || catVal === 'بيطري' || catVal === 'أدوية') catVal = 'دواء';
    else if (catVal === 'كهرباء وغاز' || catVal === 'تدفئة' || catVal === 'كهرباء') catVal = 'غاز';
    else if (catVal === 'أخرى' || catVal === 'مصاريف أخرى') catVal = 'مصاريف أخرى';
    else if (!['علف', 'دواء', 'غاز', 'مصاريف أخرى'].includes(catVal)) catVal = 'مصاريف أخرى';
  }

  let titleText = '';
  if (isUnified) {
    const catTitles = {
      'علف': 'شراء وتوريد علف 🌾',
      'دواء': 'مصروف أدوية وبيطري 💊',
      'غاز': 'مصروف غاز وتدفئة 🔥',
      'مصاريف أخرى': 'مصاريف أخرى 📦'
    };
    titleText = (isEdit ? 'تعديل ' : 'تسجيل ') + (catTitles[catVal] || 'مصروف');
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
  } else if (isUnified && catVal === 'علف') {
    h += `
      <div class="form-hint-banner">
        <span>🏬</span>
        <span>رصيد العلف المشترى بالدورة: <b>${f(k.feedPurchasedKg)} كجم</b> (${(k.feedPurchasedKg / bagKg).toFixed(1)} شكارة)</span>
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
    const amtVal = isEdit ? (existing && existing.amt !== undefined ? existing.amt : (linkedRef ? linkedRef.amt : '')) : '';
    const feedUnitVal = (linkedRef && linkedRef.unit) || (existing && existing.unit) || 'شكارة (50 كجم)';
    const feedQVal = isEdit ? ((linkedRef && linkedRef.q !== undefined) ? linkedRef.q : (existing && existing.q !== undefined ? existing.q : '')) : '';
    const feedNoteVal = (linkedRef && (linkedRef.note || linkedRef.txt)) || (existing && (existing.note || existing.txt)) || '';
    const stdNoteVal = isEdit && existing ? (existing.note || '') : '';

    let noteLabel = 'ملاحظة أو بيان (اختياري)';
    let notePlaceholder = 'مثلاً: تفاصيل المصروف...';
    if (catVal === 'دواء') {
      noteLabel = 'اسم الدواء أو التحصين (اختياري)';
      notePlaceholder = 'مثال: فيتامينات، مضاد سموم، جمبورو...';
    } else if (catVal === 'غاز') {
      noteLabel = 'بيان الغاز / التدفئة (اختياري)';
      notePlaceholder = 'مثال: شحن أنبوبة، غاز صب...';
    } else if (catVal === 'مصاريف أخرى') {
      noteLabel = 'بيان المصروف (اختياري)';
      notePlaceholder = 'اكتب بيان أو تفاصيل المصروف...';
    }

    h += `
      <input type="hidden" id="f_cat" value="${catVal}">

      <!-- Money Amount Field -->
      <div id="f_amt_wrapper">
        <label>المبلغ المدفوع (جنيه) *</label>
        <input id="f_amt" type="number" inputmode="decimal" step="any" value="${amtVal}" placeholder="المبلغ المدفوع بالجنيه">
      </div>

      <!-- Feed Specialization Section -->
      <div id="feed_sub_section" style="display: ${catVal === 'علف' ? 'block' : 'none'};">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
          <div>
            <label>الوحدة</label>
            <select id="f_feed_unit" onchange="updateFeedLiveHint()">
              <option value="شكارة (50 كجم)" ${(!feedUnitVal || feedUnitVal === 'شكارة' || feedUnitVal.includes('50')) ? 'selected' : ''}>شكارة (50 كجم)</option>
              <option value="شكارة (100 كجم)" ${feedUnitVal && feedUnitVal.includes('100') ? 'selected' : ''}>شكارة (100 كجم)</option>
              <option value="كيلوجرام (كجم)" ${feedUnitVal && feedUnitVal.includes('كيلو') ? 'selected' : ''}>كيلوجرام (كجم)</option>
            </select>
          </div>
          <div>
            <label>كمية العلف المشتراة *</label>
            <input id="f_feed_q" type="number" inputmode="decimal" step="any" value="${feedQVal}" placeholder="مثلاً: 20" oninput="updateFeedLiveHint()">
          </div>
        </div>
        <div id="feed_live_hint" style="margin: 6px 0 12px; font-size: 12px; font-weight: 700; color: var(--emerald);"></div>

        <label>نوع العلف أو بيان (اختياري)</label>
        <input id="f_feed_note" type="text" value="${esc(feedNoteVal)}" placeholder="مثال: بادي 23%، نامي 21%، ناهي 19%...">
      </div>

      <!-- Standard Note Field (Visible when category is NOT feed) -->
      <div id="std_note_wrapper" style="display: ${catVal !== 'علف' ? 'block' : 'none'};">
        <label id="std_note_label">${noteLabel}</label>
        <input id="f_std_note" type="text" value="${esc(stdNoteVal)}" placeholder="${notePlaceholder}">
      </div>
    `;
  } else if (kind === 'inc') {
    // Simplified Sales Form: Flock Type Buttons + Count + Sale Amount + Optional Buyer
    const flocks = cycle.flocks || [];
    const availFlocks = flocks.filter(fl => flockAvailability(cycle, fl.id, 'inc', editIndex) > 0);
    let selectedFlockId = isEdit && existing && existing.flockId
      ? existing.flockId
      : (prefillData && prefillData.flockId ? prefillData.flockId : '');
    if (!selectedFlockId) {
      if (flocks.length === 1) selectedFlockId = flocks[0].id;
      else if (availFlocks.length === 1) selectedFlockId = availFlocks[0].id;
    }

    const cntVal = isEdit && existing ? existing.cnt : '';
    const amtVal = isEdit && existing ? existing.amt : '';
    const buyerVal = isEdit && existing ? (existing.buyer || '') : '';
    const selectedAvail = selectedFlockId ? flockAvailability(cycle, +selectedFlockId, 'inc', editIndex) : 0;

    h += `
      ${buildFlockPickerHtml(cycle, selectedFlockId, 'inc', editIndex)}

      <label>عدد الطيور المباعة *</label>
      <input id="f_cnt" type="number" inputmode="numeric" value="${cntVal}" placeholder="مثلاً: 250" oninput="updateSaleCalculations()">

      <div class="quick-fill-row" id="sell_all_flock_row" style="display: ${selectedAvail > 0 ? 'flex' : 'none'};">
        <button type="button" class="quick-fill-btn" id="sell_all_flock_btn" onclick="fillRemainingFlockBirds(${selectedAvail})">
          ⚡ بيع كل المتبقي من هذا النوع (${f(selectedAvail)} طائر)
        </button>
      </div>

      <label>قيمة البيع (جنيه) *</label>
      <input id="f_amt" type="number" inputmode="decimal" step="any" value="${amtVal}" placeholder="مثلاً: 24000" oninput="updateSaleCalculations()">

      <!-- Live Simple Average Price Hint -->
      <div id="sale_status_box" style="margin-bottom: 14px;"></div>

      <label>اسم المشتري / ملاحظة (اختياري)</label>
      <input id="f_buyer" type="text" value="${esc(buyerVal)}" placeholder="مثال: تاجر الأحد، محل البركة...">
    `;
  } else if (kind === 'dead') {
    // Simplified Mortality Form: Flock Type Buttons + Dead Count only
    const flocks = cycle.flocks || [];
    const availFlocks = flocks.filter(fl => flockAvailability(cycle, fl.id, 'dead', editIndex) > 0);
    let selectedFlockId = isEdit && existing && existing.flockId
      ? existing.flockId
      : (prefillData && prefillData.flockId ? prefillData.flockId : '');
    if (!selectedFlockId) {
      if (flocks.length === 1) selectedFlockId = flocks[0].id;
      else if (availFlocks.length === 1) selectedFlockId = availFlocks[0].id;
    }
    const nVal = isEdit && existing ? existing.n : '';

    h += `
      ${buildFlockPickerHtml(cycle, selectedFlockId, 'dead', editIndex)}

      <label>عدد الطيور النافقة *</label>
      <input id="f_n" type="number" inputmode="numeric" value="${nVal}" placeholder="مثلاً: 5">
    `;
  } else if (kind === 'debt') {
    // Simplified Receivables Form: Receivable owed to us ONLY (Note + Amount)
    const combinedWhoVal = isEdit && existing
      ? (existing.who + (existing.note ? ' - ' + existing.note : ''))
      : '';
    const amtVal = isEdit && existing ? existing.amt : '';

    h += `
      <div class="form-hint-banner emerald" style="margin: 8px 0 6px;">
        <span>🟢</span>
        <span>مستحق لنا عند الغير</span>
      </div>

      <label>المستحقات / التفاصيل (اكتب براحتك كأنها نوتة) *</label>
      <textarea id="f_who" rows="3" placeholder="مثال: أبو علي التاجر - باقي حساب بيع فراخ ساسو..." oninput="detectAmountInDebtNote()">${esc(combinedWhoVal)}</textarea>

      <label>المبلغ (جنيه) *</label>
      <input id="f_amt" type="number" inputmode="decimal" step="any" value="${amtVal}" placeholder="مثلاً: 2000" oninput="clearDebtAmountHint()">
      <div id="debt_amt_hint" class="quick-fill-row" style="display: none;"></div>
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
      dataObj.cat = document.getElementById('f_cat').value || 'علف';
      dataObj.amt = document.getElementById('f_amt') ? document.getElementById('f_amt').value.trim() : '';
      dataObj.feed_unit = document.getElementById('f_feed_unit') ? document.getElementById('f_feed_unit').value : 'شكارة (50 كجم)';
      dataObj.feed_q = document.getElementById('f_feed_q') ? document.getElementById('f_feed_q').value.trim() : '';
      dataObj.feed_note = document.getElementById('f_feed_note') ? document.getElementById('f_feed_note').value.trim() : '';
      dataObj.std_note = document.getElementById('f_std_note') ? document.getElementById('f_std_note').value.trim() : '';
      dataObj.note = dataObj.cat === 'علف' ? dataObj.feed_note : dataObj.std_note;
    } else if (kind === 'inc') {
      dataObj.flockId = document.getElementById('f_flock') ? document.getElementById('f_flock').value : '';
      dataObj.cnt = document.getElementById('f_cnt').value.trim();
      dataObj.amt = document.getElementById('f_amt').value.trim();
      dataObj.buyer = document.getElementById('f_buyer').value.trim();
    } else if (kind === 'dead') {
      dataObj.flockId = document.getElementById('f_flock') ? document.getElementById('f_flock').value : '';
      dataObj.n = document.getElementById('f_n').value.trim();
    } else if (kind === 'debt') {
      dataObj.who = document.getElementById('f_who').value.trim();
      dataObj.amt = document.getElementById('f_amt').value.trim();
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
        const factor = getUnitKgFactor(dataObj.feed_unit);
        const totalKg = qNum * factor;
        const feedTxt = qNum + ' ' + dataObj.feed_unit + (dataObj.feed_note ? ' (' + dataObj.feed_note + ')' : '');
        const amtNum = +dataObj.amt;
        let targetExp = isExpKind && isEdit ? cycle.exp[editIndex] : linkedRef;
        let targetFeed = isFeedKind && isEdit ? cycle.feed[editIndex] : linkedRef;
        let expToastMsg = '';

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
          expToastMsg = 'تم تعديل شراء العلف بنجاح ✓';
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
          expToastMsg = 'تم تحديث المصروف وتوريد العلف بنجاح ✓';
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
            feedRefId: targetFeed.id,
            seq: nextCycleSeq(cycle)
          });
          expToastMsg = 'تم تحديث شراء العلف والمصروف المالي ✓';
        } else {
          const newExpId = Date.now() + Math.floor(Math.random() * 1000);
          const newFeedId = newExpId + 1;
          cycle.exp.push({
            id: newExpId,
            d: dataObj.d,
            cat: 'علف',
            amt: amtNum,
            note: dataObj.feed_note,
            feedRefId: newFeedId,
            seq: nextCycleSeq(cycle)
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
          expToastMsg = 'تم تسجيل شراء وتوريد العلف بنجاح ✓';
        }

        if (!isEdit && S.expFilter && S.expFilter !== 'all' && S.expFilter !== dataObj.cat) {
          S.expFilter = 'all';
        }
        if (saveAndNotify(expToastMsg)) {
          closeM();
          render();
        }
        return;
      } else {
        // Standard expense
        const amtNum = +dataObj.amt;
        let expToastMsg = '';
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
          expToastMsg = `تم تعديل مصروف (${targetExp.cat}) بنجاح ✓`;
        } else {
          cycle.exp.push({
            id: Date.now() + Math.floor(Math.random() * 1000),
            d: dataObj.d,
            cat: dataObj.cat,
            amt: amtNum,
            note: dataObj.note,
            seq: nextCycleSeq(cycle)
          });
          expToastMsg = `تمت إضافة مصروف (${dataObj.cat}) بنجاح ✓`;
        }

        if (!isEdit && S.expFilter && S.expFilter !== 'all' && S.expFilter !== dataObj.cat) {
          S.expFilter = 'all';
        }
        if (saveAndNotify(expToastMsg)) {
          closeM();
          render();
        }
        return;
      }
    }

    // Kind is inc, dead, or debt
    const o = isEdit ? { ...existing } : { id: Date.now() + Math.floor(Math.random() * 1000) };
    o.d = dataObj.d;

    if (kind === 'inc') {
      o.flockId = +dataObj.flockId;
      o.cnt = +dataObj.cnt;
      o.amt = +dataObj.amt;
      o.buyer = dataObj.buyer;
      if (!isEdit) o.seq = nextCycleSeq(cycle);
      delete o.kg;
      delete o.paidAmt;
      delete o.debtRefId;
    } else if (kind === 'dead') {
      o.flockId = +dataObj.flockId;
      o.n = +dataObj.n;
      if (!isEdit) o.seq = nextCycleSeq(cycle);
      delete o.note;
    } else if (kind === 'debt') {
      o.dir = 'لنا';
      o.who = dataObj.who;
      o.amt = +dataObj.amt;
      o.paidAmt = isEdit ? +(existing.paidAmt || 0) : 0;
      delete o.note;
      o.payments = isEdit && Array.isArray(existing.payments) ? existing.payments.map(p => ({ ...p })) : [];
      syncDebtPaymentsToAmount(o);
    }

    let toastMsg = '';
    if (isEdit) {
      cycle[kind][editIndex] = o;
      toastMsg = `تم تعديل ${K[kind].t} بنجاح ✓`;
    } else {
      cycle[kind].push(o);
      if (kind === 'inc' && S.incFilter !== 'all' && String(S.incFilter) !== String(o.flockId)) S.incFilter = 'all';
      if (kind === 'debt' && S.debtFilter === 'unpaid') S.debtFilter = 'all';
      toastMsg = `تمت إضافة ${K[kind].t} بنجاح ✓`;
    }

    if (saveAndNotify(toastMsg)) {
      closeM();
      render();
      if (kind === 'inc' && !isEdit && o.d === today()
        && (cycle.feed || []).some(x => x.type === 'purchased')
        && !(cycle.feedStocktakes || []).some(x => x.d === today() && (+x.seq || 0) >= (+o.seq || 0))) {
        showToast('سجّل جرد العلف الآن لتقدير تكلفة البيع حتى اليوم.', 3600);
        openFeedStocktakeModal();
      }
    }
  };

  modal.classList.add('on');
}

// Build mobile-friendly flock selector buttons for Sales & Mortality
function buildFlockPickerHtml(cycle, selectedFlockId, kind, editIndex) {
  const flocks = cycle.flocks || [];
  const labelText = kind === 'inc' ? 'اختر نوع الفراخ المباعة *' : 'اختر نوع الفراخ النافقة *';
  const availWord = kind === 'inc' ? 'متبقي' : 'حي';

  if (flocks.length === 1) {
    const fl = flocks[0];
    const avail = flockAvailability(cycle, fl.id, kind, editIndex);
    return `
      <input type="hidden" id="f_flock" value="${fl.id}">
      <div class="form-hint-banner" style="margin: 8px 0 6px;">
        <span>🐣</span>
        <span>النوع: <b>${esc(fl.name)}</b> (${availWord}: <b>${f(avail)} طائر</b>)</span>
      </div>
    `;
  }

  return `
    <label>${labelText}</label>
    <input type="hidden" id="f_flock" value="${selectedFlockId || ''}">
    <div class="flock-picker-grid">
      ${flocks.map(fl => {
        const avail = flockAvailability(cycle, fl.id, kind, editIndex);
        const isActive = String(selectedFlockId) === String(fl.id);
        const isDisabled = avail <= 0 && !isActive;
        return `
          <button type="button"
            class="flock-pick-btn ${isActive ? 'active' : ''}"
            data-flock-id="${fl.id}"
            ${isDisabled ? 'disabled' : ''}
            onclick="selectFlockOption(${fl.id}, '${kind}', ${avail})">
            <span class="flock-pick-name">🐣 ${esc(fl.name)}</span>
            <span class="flock-pick-meta">${avail > 0 ? `${availWord}: ${f(avail)} طائر` : 'لا يوجد متبقي (0)'}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function selectFlockOption(flockId, kind, avail) {
  const inputEl = document.getElementById('f_flock');
  if (inputEl) inputEl.value = flockId;

  document.querySelectorAll('.flock-pick-btn').forEach(btn => {
    btn.classList.toggle('active', String(btn.dataset.flockId) === String(flockId));
  });

  if (kind === 'inc') {
    const row = document.getElementById('sell_all_flock_row');
    const btn = document.getElementById('sell_all_flock_btn');
    if (row && btn) {
      if (avail > 0) {
        row.style.display = 'flex';
        btn.setAttribute('onclick', `fillRemainingFlockBirds(${avail})`);
        btn.textContent = `⚡ بيع كل المتبقي من هذا النوع (${f(avail)} طائر)`;
      } else {
        row.style.display = 'none';
      }
    }
    updateSaleCalculations();
  }
}

function fillRemainingFlockBirds(avail) {
  const cntEl = document.getElementById('f_cnt');
  if (cntEl) {
    cntEl.value = avail;
    updateSaleCalculations();
  }
}

// Live calculation updater for simplified sales form
function updateSaleCalculations() {
  const box = document.getElementById('sale_status_box');
  if (!box) return;

  const cntEl = document.getElementById('f_cnt');
  const amtEl = document.getElementById('f_amt');
  const cnt = cntEl ? (+cntEl.value || 0) : 0;
  const amt = amtEl ? (+amtEl.value || 0) : 0;

  if (cnt > 0 && amt > 0) {
    box.innerHTML = `
      <div class="form-hint-banner emerald" style="margin: 6px 0;">
        <span>💰</span>
        <span>متوسط سعر الطائر: <b>${f(amt / cnt)} ج</b></span>
      </div>
    `;
  } else {
    box.innerHTML = '';
  }
}

// Interactive handlers for unified Expense & Feed Form
function selectExpenseCat(cat) {
  const catInput = document.getElementById('f_cat');
  if (catInput) catInput.value = cat;

  document.querySelectorAll('.expense-cat-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === cat);
  });

  const feedSec = document.getElementById('feed_sub_section');
  const stdNoteWrapper = document.getElementById('std_note_wrapper');
  const stdNoteLabel = document.getElementById('std_note_label');
  const stdNoteInput = document.getElementById('f_std_note');

  if (cat === 'علف') {
    if (feedSec) feedSec.style.display = 'block';
    if (stdNoteWrapper) stdNoteWrapper.style.display = 'none';
    updateFeedLiveHint();
  } else {
    if (feedSec) feedSec.style.display = 'none';
    if (stdNoteWrapper) stdNoteWrapper.style.display = 'block';
    if (stdNoteLabel && stdNoteInput) {
      if (cat === 'دواء') {
        stdNoteLabel.textContent = 'نوع الدواء أو التحصين (اختياري)';
        stdNoteInput.placeholder = 'مثال: مضاد سموم، فيتامينات، تحصينة...';
      } else if (cat === 'غاز') {
        stdNoteLabel.textContent = 'بيان الغاز / التدفئة (اختياري)';
        stdNoteInput.placeholder = 'مثال: شحن أنبوبة، غاز صب...';
      } else {
        stdNoteLabel.textContent = 'ملاحظة أو بيان (اختياري)';
        stdNoteInput.placeholder = 'اكتب أي ملاحظة أو بيان...';
      }
    }
  }
}

function updateFeedLiveHint() {
  const hintEl = document.getElementById('feed_live_hint');
  if (!hintEl) return;

  const unitEl = document.getElementById('f_feed_unit');
  const qEl = document.getElementById('f_feed_q');
  if (!unitEl || !qEl) return;

  const unit = unitEl.value;
  const q = +qEl.value || 0;
  const factor = getUnitKgFactor(unit);
  const totalKg = q * factor;

  if (q > 0) {
    hintEl.innerHTML = `📦 الكمية تعادل: <b>${f(totalKg)} كجم</b> (${f(q)} ${unit})`;
    hintEl.style.color = 'var(--emerald)';
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

function detectAmountInDebtNote() {
  const whoEl = document.getElementById('f_who');
  const amtEl = document.getElementById('f_amt');
  const hintEl = document.getElementById('debt_amt_hint');
  if (!whoEl || !amtEl || !hintEl) return;
  if (amtEl.value.trim() !== '') {
    hintEl.style.display = 'none';
    return;
  }

  // Detect explicit currency numbers like "2000 ج" or "2000 جنيه"
  const m = whoEl.value.match(/(\d+(?:\.\d+)?)\s*(?:جنيهاً|جنيها|جنيه|ج(?=$|\s|[.،,]))/);
  if (m && +m[1] > 0) {
    const val = +m[1];
    hintEl.style.display = 'flex';
    hintEl.innerHTML = `
      <button type="button" class="quick-fill-btn" onclick="document.getElementById('f_amt').value=${val}; clearDebtAmountHint();">
        💡 هل المبلغ ${f(val)} ج؟ اضغط لتعبئة خانة المبلغ تلقائياً
      </button>
    `;
  } else {
    hintEl.style.display = 'none';
  }
}

function clearDebtAmountHint() {
  const hintEl = document.getElementById('debt_amt_hint');
  if (hintEl) hintEl.style.display = 'none';
}

// ==========================================================================
// DEBT PARTIAL / FULL PAYMENT MODAL
// ==========================================================================
function openPaymentModal(debtIndex, paymentIndex = null) {
  const cycle = cur();
  if (!cycle || !cycle.debt || !cycle.debt[debtIndex]) return;
  const d = cycle.debt[debtIndex];
  const { m: modal, fm: formEl } = ensureModalElements();
  if (!modal || !formEl) return;

  const isEditPayment = paymentIndex !== null && d.payments && d.payments[paymentIndex];
  const existingPayment = isEditPayment ? d.payments[paymentIndex] : null;

  const total = Math.round((+d.amt || 0) * 100) / 100;
  const paid = Math.round((+d.paidAmt || (d.paid ? total : 0)) * 100) / 100;
  const remaining = Math.round(Math.max(0, total - paid) * 100) / 100;
  const maxAllowed = Math.round((isEditPayment ? (remaining + (+existingPayment.amt || 0)) : remaining) * 100) / 100;
  const dateVal = isEditPayment && existingPayment.d ? existingPayment.d : today();
  const amtVal = isEditPayment ? existingPayment.amt : '';

  formEl.innerHTML = `
    <div class="form-header">
      <div class="form-title">${isEditPayment ? 'تعديل دفعة التحصيل ✏️' : 'تسجيل تحصيل / دفعة 💵'}</div>
      <button type="button" class="btn btn-sm btn-outline" onclick="closeM()">✕</button>
    </div>

    <div id="form_error_container"></div>

    <div class="card" style="margin-bottom: 16px; padding: 14px; background: rgba(0,0,0,0.2);">
      <div style="font-size: 15px; font-weight: 800; color: var(--text-title); margin-bottom: 4px;">
        ${esc(d.who)}
      </div>
      <div style="font-size: 13px; color: var(--emerald); margin-bottom: 8px;">
        🟢 مستحق لنا عند الغير
      </div>
      <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--border-subtle); padding-top: 8px;">
        <span>الإجمالي: <b>${f(total)} ج</b></span>
        <span>المحصل: <b style="color:var(--emerald);">${f(paid)} ج</b></span>
        <span>المتبقي: <b style="color:var(--amber); font-size:16px;">${f(remaining)} ج</b></span>
      </div>
    </div>

    <label>تاريخ السداد</label>
    <input type="date" id="p_d" value="${dateVal}">

    <label>${isEditPayment ? 'مبلغ الدفعة الجديد (جنيه) *' : 'المبلغ المسدد الآن (جنيه) *'}</label>
    <input type="number" id="p_amt" inputmode="decimal" step="any" value="${amtVal}" placeholder="المبلغ المدفوع بالجنيه">

    ${maxAllowed > 0 ? `
      <div class="quick-fill-row">
        <button type="button" class="quick-fill-btn" onclick="document.getElementById('p_amt').value = ${maxAllowed};">
          ⚡ سداد كامل المتاح (${f(maxAllowed)} ج)
        </button>
      </div>
    ` : ''}

    <div class="form-actions-row">
      <button class="btn btn-primary" style="flex: 2;" type="submit">${isEditPayment ? 'حفظ تعديل الدفعة' : 'تسجيل السداد والحفظ'}</button>
      <button class="btn btn-outline" style="flex: 1;" type="button" onclick="closeM()">إلغاء</button>
    </div>
  `;

  formEl.onsubmit = ev => {
    ev.preventDefault();
    clearFormErrors();

    const pAmtVal = document.getElementById('p_amt').value.trim();
    const pDVal = document.getElementById('p_d').value || today();

    if (!pAmtVal || isNaN(pAmtVal) || +pAmtVal <= 0) {
      showFormError('يرجى إدخال مبلغ صحيح أكبر من الصفر.', 'p_amt');
      return;
    }

    const paymentAmt = +pAmtVal;
    if (paymentAmt > maxAllowed) {
      showFormError(`عفواً، المبلغ (${f(paymentAmt)} ج) أكبر من الحد المسموح (${f(maxAllowed)} ج).`, 'p_amt');
      return;
    }

    d.payments = d.payments || [];
    if (isEditPayment) {
      d.payments[paymentIndex].d = pDVal;
      d.payments[paymentIndex].amt = paymentAmt;
    } else {
      d.payments.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        d: pDVal,
        amt: paymentAmt
      });
    }

    syncDebtPaymentsToAmount(d);

    const pMsg = isEditPayment ? `تم تعديل الدفعة إلى ${f(paymentAmt)} ج ✓` : `تم تسجيل سداد مبلغ ${f(paymentAmt)} ج بنجاح ✓`;
    if (saveAndNotify(pMsg)) {
      closeM();
      render();
    }
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
      d.payments.splice(paymentIndex, 1);
      syncDebtPaymentsToAmount(d);

      if (saveAndNotify('تم إلغاء الدفعة واسترجاع الرصيد بنجاح')) {
        render();
      }
    }
  });
}

// Delete sale record (debts are managed independently)
function delSale(i) {
  const cycle = cur();
  const sale = cycle.inc[i];
  const typeName = flockName(cycle, sale.flockId);

  showConfirmModal({
    icon: '🗑️',
    title: 'تأكيد حذف حركة البيع ⚠️',
    subtitle: 'هل أنت متأكد من حذف حركة البيع هذه؟ سيتم خصم هذا المبلغ من إجمالي المبيعات وإعادة عدد الطيور المباعة إلى المتبقي من هذا النوع.',
    itemIcon: '📈',
    itemTitle: `بيع ${f(sale.cnt)} طائر (${typeName}) ${sale.buyer ? '• ' + sale.buyer : ''}`,
    itemMeta: `قيمة البيع: ${f(sale.amt)} ج • التاريخ: ${fd(sale.d)}`,
    confirmBtnText: 'نعم، حذف حركة البيع نهائياً',
    onConfirm: () => {
      cycle.inc.splice(i, 1);
      if (saveAndNotify('تم حذف حركة البيع وتحديث الأرصدة')) {
        render();
      }
    }
  });
}

// Delete debt record
function delDebt(i) {
  const cycle = cur();
  const d = cycle.debt[i];
  const rem = Math.max(0, d.amt - (d.paidAmt || 0));

  showConfirmModal({
    icon: '🗑️',
    title: 'تأكيد حذف المستحق ⚠️',
    subtitle: 'هل أنت متأكد من رغبتك في حذف هذا السجل نهائياً؟',
    itemIcon: '📝',
    itemTitle: `${d.who}`,
    itemMeta: `المبلغ: ${f(d.amt)} ج • المحصل: ${f(d.paidAmt || 0)} ج • المتبقي: ${f(rem)} ج`,
    warningNote: (d.payments && d.payments.length > 0) ? `تحذير: يحتوي هذا السجل على (${d.payments.length}) دفعات محصلة مسجلة سيتم مسحها بالكامل مع السجل.` : '',
    confirmBtnText: 'نعم، احذف نهائياً',
    onConfirm: () => {
      cycle.debt.splice(i, 1);
      if (saveAndNotify('تم الحذف بنجاح')) {
        render();
      }
    }
  });
}

// Record a feed-stock snapshot. Consumption and its estimated cost are derived from
// opening stock + purchases - the remaining balance; no daily weighing is needed.
function openFeedStocktakeModal(editIndex = null) {
  const cycle = cur();
  if (!cycle) return;
  const checks = cycle.feedStocktakes || (cycle.feedStocktakes = []);
  const editing = editIndex !== null && !!checks[editIndex];
  const current = editing ? checks[editIndex] : null;
  const others = checks.filter((_, i) => !editing || i !== editIndex).slice()
    .sort((a, b) => String(a.d || '').localeCompare(String(b.d || '')) || (+a.seq || 0) - (+b.seq || 0));
  const latest = others[others.length - 1];
  const firstCheck = !others.length;
  const { m: modal, fm: formEl } = ensureModalElements();
  if (!modal || !formEl) return;

  const unit = current && current.unit ? current.unit : 'شكارة (50 كجم)';
  const remQty = current ? (+current.kg || 0) / getUnitKgFactor(unit) : '';
  const openingUnit = current && current.openingUnit ? current.openingUnit : 'شكارة (50 كجم)';
  const openingQty = current && current.openingKg ? (+current.openingKg || 0) / getUnitKgFactor(openingUnit) : '';
  const hasOpeningFeed = !!(current && (+current.openingKg || 0) > 0);

  formEl.innerHTML = `
    <div class="form-header">
      <div class="form-title">${editing ? 'تعديل جرد العلف' : 'جرد رصيد العلف'} 🌾</div>
      <button type="button" class="btn btn-sm btn-outline" onclick="closeM()">✕</button>
    </div>
    <div id="form_error_container"></div>
    <div class="form-hint-banner amber"><span>ℹ️</span><span>اكتب الموجود في المخزن الآن بعد مشتريات الدورة. لا تكتب المستهلك؛ التطبيق يقدّره تلقائيًا من المشتريات والرصيد، والحساب تقريبي.</span></div>
    <label>تاريخ الجرد *</label>
    <input id="fst_date" type="date" value="${current ? current.d : today()}">
    <label>كم شكارة فاضلة الآن؟ *</label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <input id="fst_qty" type="number" inputmode="decimal" min="0" step="0.25" value="${remQty}" placeholder="عدد الشكاير (مثلاً 1.5)" required>
      <select id="fst_unit">
        <option value="شكارة (50 كجم)" ${unit.includes('50') ? 'selected' : ''}>شكارة 50 كجم</option>
        <option value="شكارة (100 كجم)" ${unit.includes('100') ? 'selected' : ''}>شكارة 100 كجم</option>
        <option value="كيلوجرام (كجم)" ${unit.includes('كيلو') ? 'selected' : ''}>كيلوجرام</option>
      </select>
    </div>
    ${firstCheck ? `
      <label style="margin-top:12px;">هل كان عندك علف من قبل بداية الدورة؟</label>
      <select id="fst_has_opening" onchange="toggleOpeningFeedFields()">
        <option value="no" ${hasOpeningFeed ? '' : 'selected'}>لا، بدأت من غير علف قديم</option>
        <option value="yes" ${hasOpeningFeed ? 'selected' : ''}>أيوة، عندي علف مُرحّل من قبل الدورة</option>
      </select>
      <div id="fst_opening_fields" style="display:${hasOpeningFeed ? 'block' : 'none'};">
        <div class="form-hint-banner" style="margin-top:10px;">استخدم الجزء ده فقط للعلف اللي كان موجودًا قبل الدورة ولم تسجّل شراءه فيها. المشتريات اللي سجلتها أثناء الدورة لا تدخلها هنا.</div>
        <label>كم شكارة كانت موجودة؟</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <input id="fst_open_qty" type="number" inputmode="decimal" min="0" step="0.25" value="${openingQty}" placeholder="مثلاً 1">
          <select id="fst_open_unit">
            <option value="شكارة (50 كجم)" ${openingUnit.includes('50') ? 'selected' : ''}>شكارة 50 كجم</option>
            <option value="شكارة (100 كجم)" ${openingUnit.includes('100') ? 'selected' : ''}>شكارة 100 كجم</option>
            <option value="كيلوجرام (كجم)" ${openingUnit.includes('كيلو') ? 'selected' : ''}>كيلوجرام</option>
          </select>
        </div>
        <label>قيمة العلف القديم التقديرية (جنيه)</label>
        <input id="fst_open_value" type="number" inputmode="decimal" min="0" step="any" value="${current ? (+current.openingValue || 0) : ''}" placeholder="مثلاً 1500">
      </div>
    ` : ''}
    <div class="form-actions-row">
      <button class="btn btn-primary" style="flex:2;" type="submit">${editing ? 'حفظ الجرد' : 'حفظ الجرد وحساب المستهلك'}</button>
      <button class="btn btn-outline" style="flex:1;" type="button" onclick="closeM()">إلغاء</button>
    </div>
  `;

  formEl.onsubmit = ev => {
    ev.preventDefault();
    clearFormErrors();
    const date = document.getElementById('fst_date').value || today();
    const qtyRaw = document.getElementById('fst_qty').value.trim();
    const qty = +qtyRaw;
    const qtyUnit = document.getElementById('fst_unit').value;
    const remainingKg = qty * getUnitKgFactor(qtyUnit);
    if (qtyRaw === '' || !Number.isFinite(qty) || qty < 0) {
      showFormError('أدخل رصيدًا صحيحًا (صفر أو أكثر).', 'fst_qty');
      return;
    }
    if (!date || date < (cycle.start || date)) {
      showFormError('تاريخ الجرد لا يمكن أن يسبق بداية الدورة.', 'fst_date');
      return;
    }
    if (cycle.end && date > cycle.end) {
      showFormError('تاريخ الجرد لا يمكن أن يتجاوز تاريخ إغلاق الدورة.', 'fst_date');
      return;
    }
    if (latest && date < latest.d) {
      showFormError('سجّل الجرد بترتيب التواريخ؛ لا يمكن أن يسبق آخر جرد مسجل.', 'fst_date');
      return;
    }

    let openingKg = current ? (+current.openingKg || 0) : 0;
    let openingValue = current ? (+current.openingValue || 0) : 0;
    let openingUnitValue = current && current.openingUnit ? current.openingUnit : 'شكارة (50 كجم)';
    if (firstCheck) {
      const hasOpening = document.getElementById('fst_has_opening').value === 'yes';
      if (hasOpening) {
        const openQty = +(document.getElementById('fst_open_qty').value || 0);
        const openUnit = document.getElementById('fst_open_unit').value;
        openingKg = openQty * getUnitKgFactor(openUnit);
        openingValue = +(document.getElementById('fst_open_value').value || 0);
        openingUnitValue = openUnit;
        if (!Number.isFinite(openQty) || openQty <= 0 || !Number.isFinite(openingValue) || openingValue < 0) {
          showFormError('أدخل كمية علف قديم صحيحة وقيمته التقديرية.', 'fst_open_qty');
          return;
        }
        if (openingValue <= 0) {
          showFormError('اكتب قيمة تقديرية للعلف القديم حتى تدخل تكلفته في الحساب.', 'fst_open_value');
          return;
        }
      } else {
        openingKg = 0;
        openingValue = 0;
        openingUnitValue = 'شكارة (50 كجم)';
      }
    }

    const checkSeq = current ? (+current.seq || 0) : nextCycleSeq(cycle);
    const priorKg = latest ? (+latest.kg || 0) : openingKg;
    const arrivals = (cycle.feed || []).filter(p => {
      const linkedExp = (cycle.exp || []).find(x => x.id === p.expRefId || x.feedRefId === p.id);
      const purchaseSeq = +p.seq || +(linkedExp && linkedExp.seq) || 0;
      return p.type === 'purchased'
        && (String(p.d || cycle.start || '') < date || (String(p.d || cycle.start || '') === date && (!purchaseSeq || purchaseSeq <= checkSeq)))
        && (!latest || String(p.d || '') > latest.d || (String(p.d || '') === latest.d && purchaseSeq > (+latest.seq || 0)));
    });
    const availableKg = priorKg + arrivals.reduce((s, p) => s + (+p.kg || 0), 0);
    if (remainingKg > availableKg + 0.01) {
      showFormError(`الرصيد المتبقي (${fp(remainingKg)} كجم) أكبر من الكمية المتاحة المقدرة (${fp(availableKg)} كجم). راجع تاريخ وكمية الشراء أو الجرد.`, 'fst_qty');
      return;
    }

    const record = {
      ...(current || {}),
      id: current ? current.id : Date.now() + Math.floor(Math.random() * 1000),
      d: date,
      kg: remainingKg,
      unit: qtyUnit,
      seq: checkSeq,
      openingKg,
      openingValue,
      openingUnit: openingUnitValue
    };
    if (editing) checks[editIndex] = record;
    else checks.push(record);

    if (saveAndNotify('تم حفظ الجرد وتحديث تقدير استهلاك العلف ✓')) {
      closeM();
      render();
    }
  };
  modal.classList.add('on');
}

function deleteFeedStocktake(index) {
  const cycle = cur();
  if (!cycle || !cycle.feedStocktakes || !cycle.feedStocktakes[index]) return;
  const check = cycle.feedStocktakes[index];
  showConfirmModal({
    icon: '🌾',
    title: 'حذف جرد العلف؟',
    subtitle: 'سيُعاد تقدير العلف المستهلك والمخزون بعد حذف هذا الجرد.',
    itemIcon: '📦',
    itemTitle: `جرد ${fd(check.d)}`,
    itemMeta: `الرصيد: ${fp(check.kg)} كجم`,
    confirmBtnText: 'نعم، احذف الجرد',
    onConfirm: () => {
      const sortedChecks = cycle.feedStocktakes.slice().sort((a, b) => String(a.d || '').localeCompare(String(b.d || '')) || (+a.seq || 0) - (+b.seq || 0));
      const checkPosition = sortedChecks.findIndex(x => x.id === check.id);
      if (checkPosition === 0 && sortedChecks.length > 1) {
        const nextCheck = sortedChecks[1];
        nextCheck.openingKg = +check.openingKg || 0;
        nextCheck.openingValue = +check.openingValue || 0;
        nextCheck.openingUnit = check.openingUnit || 'شكارة (50 كجم)';
      }
      cycle.feedStocktakes.splice(index, 1);
      if (saveAndNotify('تم حذف الجرد وإعادة حساب تقدير العلف')) render();
    }
  });
}

function toggleOpeningFeedFields() {
  const selector = document.getElementById('fst_has_opening');
  const fields = document.getElementById('fst_opening_fields');
  if (selector && fields) fields.style.display = selector.value === 'yes' ? 'block' : 'none';
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
        if (saveAndNotify('تم حذف المصروف وتحديث رصيد المخزن بنجاح')) {
          render();
        }
      }
    });
  } else if (kind === 'dead') {
    const e = cycle.dead[i];
    const typeName = flockName(cycle, e.flockId);
    showConfirmModal({
      icon: '🗑️',
      title: 'تأكيد حذف تسجيل النافق ⚠️',
      subtitle: 'هل أنت متأكد من حذف هذا السجل للنافق؟ سيتم استرجاع عدد هذه الطيور للرصيد الحي المتبقي من هذا النوع.',
      itemIcon: '⚠️',
      itemTitle: `تسجيل نافق: ${e.n} طائر (${typeName})`,
      itemMeta: `التاريخ: ${fd(e.d)}`,
      confirmBtnText: 'نعم، احذف السجل',
      onConfirm: () => {
        cycle.dead.splice(i, 1);
        if (saveAndNotify('تم حذف تسجيل النافق واسترجاع الطيور')) {
          render();
        }
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
        if (saveAndNotify('تم حذف حركة العلف وتحديث المصروفات بنجاح')) {
          render();
        }
      }
    });
  } else {
    cycle[kind].splice(i, 1);
    if (saveAndNotify('تم الحذف بنجاح')) {
      render();
    }
  }
}

// ==========================================================================
// CYCLE & MULTI-FLOCK MANAGEMENT (Create, Edit, Add Flock, Delete, Close)
// ==========================================================================
function buildFlockRowHtml(idx, flock = {}, isLocked = false, lockCount = 0) {
  const safeName = esc(flock.name || '');
  const countVal = flock.count !== undefined && flock.count !== '' ? flock.count : '';
  const costVal = flock.cost !== undefined && flock.cost !== '' ? flock.cost : '';
  const idVal = flock.id || '';
  const batchCount = Array.isArray(flock.batches) ? flock.batches.length : 0;
  const isMultiBatch = batchCount > 1;

  return `
    <div class="flock-row-card" data-flock-id="${idVal}" data-multi-batch="${isMultiBatch ? '1' : '0'}">
      <div class="flock-row-header">
        <span class="flock-row-title">🐣 النوع ${idx + 1}</span>
        ${isLocked ? `
          <span style="font-size: 11px; color: var(--text-dim); font-weight: 600;">مرتبط بـ ${lockCount} حركة (لا يمكن حذفه)</span>
        ` : `
          <button type="button" class="btn btn-sm btn-danger flock-remove-btn" onclick="removeFlockRow(this)" style="padding: 3px 9px; font-size: 11.5px;">حذف</button>
        `}
      </div>
      <label>اسم النوع (كتابة باليد) *</label>
      <input type="text" class="flock-name-input" value="${safeName}" placeholder="اكتب اسم النوع هنا...">
      ${isMultiBatch ? `
        <div class="form-hint-banner" style="margin: 8px 0 0; font-size: 12px;">
          <span>📦</span>
          <span>إجمالي <b>${f(countVal)} طائر</b> بتكلفة <b>${f(costVal)} ج</b> (مجمع من ${batchCount} دفعات — يمكنك تعديل كل دفعة من صفحة الدورة).</span>
        </div>
        <input type="hidden" class="flock-count-input" value="${countVal}">
        <input type="hidden" class="flock-cost-input" value="${costVal}">
      ` : `
        <div class="flock-row-inputs-grid">
          <div>
            <label>العدد (طائر) *</label>
            <input type="number" class="flock-count-input" inputmode="numeric" value="${countVal}" placeholder="مثلاً: 500" oninput="updateFlocksModalSummary()">
          </div>
          <div>
            <label>تكلفة الكتاكيت (ج) *</label>
            <input type="number" class="flock-cost-input" inputmode="decimal" step="any" value="${costVal}" placeholder="مثلاً: 9000" oninput="updateFlocksModalSummary()">
          </div>
        </div>
      `}
    </div>
  `;
}

function addFlockRow(containerId) {
  const listEl = document.getElementById(containerId);
  if (!listEl) return;
  const idx = listEl.querySelectorAll('.flock-row-card').length;
  listEl.insertAdjacentHTML('beforeend', buildFlockRowHtml(idx, {}, false, 0));
  refreshFlockRowLabels(containerId);
  updateFlocksModalSummary();
  const rows = listEl.querySelectorAll('.flock-row-card');
  const lastInput = rows[rows.length - 1]?.querySelector('.flock-name-input');
  if (lastInput) lastInput.focus();
}

function removeFlockRow(btn) {
  const row = btn.closest('.flock-row-card');
  const listEl = row ? row.parentElement : null;
  if (!listEl) return;
  if (listEl.querySelectorAll('.flock-row-card').length <= 1) {
    showToast('يجب وجود نوع كتاكيت واحد على الأقل في الدورة');
    return;
  }
  row.remove();
  refreshFlockRowLabels(listEl.id);
  updateFlocksModalSummary();
}

function refreshFlockRowLabels(containerId) {
  const listEl = document.getElementById(containerId);
  if (!listEl) return;
  const rows = listEl.querySelectorAll('.flock-row-card');
  rows.forEach((r, idx) => {
    const titleEl = r.querySelector('.flock-row-title');
    if (titleEl) titleEl.textContent = `🐣 النوع ${idx + 1}`;
    const rmBtn = r.querySelector('.flock-remove-btn');
    if (rmBtn) rmBtn.style.display = rows.length > 1 ? 'inline-flex' : 'none';
  });
}

function updateFlocksModalSummary() {
  const sumEl = document.getElementById('flocks_modal_summary');
  if (!sumEl) return;
  let totalCount = 0;
  let totalCost = 0;
  document.querySelectorAll('.flock-row-card').forEach(r => {
    totalCount += +(r.querySelector('.flock-count-input')?.value || 0);
    totalCost += +(r.querySelector('.flock-cost-input')?.value || 0);
  });
  sumEl.innerHTML = `
    <span>إجمالي الكتاكيت: <b>${f(totalCount)} طائر</b></span>
    <span>إجمالي التكلفة: <b class="color-emerald">${f(totalCost)} ج</b></span>
  `;
}

function collectAndValidateFlockRows(cycleForEdit = null, cycleStartDate = null) {
  const rows = Array.from(document.querySelectorAll('.flock-row-card'));
  const collected = [];
  const existingFlocks = cycleForEdit && Array.isArray(cycleForEdit.flocks) ? cycleForEdit.flocks : [];
  const existingIds = existingFlocks.map(fl => +fl.id || 0);
  let nextNewId = Math.max(Date.now(), ...existingIds, 0) + 1;
  let seqBase = cycleForEdit ? (+cycleForEdit.nextSeq || 0) : 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const existingId = row.dataset.flockId ? +row.dataset.flockId : 0;
    const prevFlock = existingId ? existingFlocks.find(fl => fl.id === existingId) : null;
    const isMultiBatch = row.dataset.multiBatch === '1' && prevFlock && Array.isArray(prevFlock.batches) && prevFlock.batches.length > 1;
    const nameEl = row.querySelector('.flock-name-input');
    const countEl = row.querySelector('.flock-count-input');
    const costEl = row.querySelector('.flock-cost-input');

    const name = nameEl ? nameEl.value.trim() : '';
    if (!name) {
      if (nameEl) { nameEl.classList.add('input-error'); nameEl.focus(); }
      showFormError(`يرجى كتابة اسم النوع رقم ${i + 1}.`, null);
      return null;
    }

    if (isMultiBatch) {
      collected.push(syncFlockFromBatches({
        ...prevFlock,
        name,
        batches: prevFlock.batches.map(b => ({ ...b }))
      }));
      continue;
    }

    const countStr = countEl ? countEl.value.trim() : '';
    const costStr = costEl ? costEl.value.trim() : '';

    if (!countStr || isNaN(countStr) || +countStr <= 0 || !Number.isInteger(+countStr)) {
      if (countEl) { countEl.classList.add('input-error'); countEl.focus(); }
      showFormError(`يرجى إدخال عدد صحيح أكبر من الصفر لنوع "${name}" (بدون كسور).`, null);
      return null;
    }
    if (costStr === '' || isNaN(costStr) || +costStr < 0) {
      if (costEl) { costEl.classList.add('input-error'); costEl.focus(); }
      showFormError(`يرجى إدخال تكلفة الكتاكيت لنوع "${name}" (0 أو أكبر).`, null);
      return null;
    }

    if (cycleForEdit && existingId) {
      const usedBirds = (cycleForEdit.inc || []).filter(x => x.flockId === existingId).reduce((s, x) => s + (+x.cnt || 0), 0)
        + (cycleForEdit.dead || []).filter(x => x.flockId === existingId).reduce((s, x) => s + (+x.n || 0), 0);
      if (+countStr < usedBirds) {
        if (countEl) { countEl.classList.add('input-error'); countEl.focus(); }
        showFormError(`عفواً، عدد "${name}" (${countStr}) أقل من الطيور المسجل بيعها ونفوقها بالفعل (${usedBirds} طائر).`, null);
        return null;
      }
    }

    const flId = existingId || nextNewId++;
    let batches;
    if (prevFlock && Array.isArray(prevFlock.batches) && prevFlock.batches.length === 1) {
      batches = [{
        ...prevFlock.batches[0],
        count: +countStr,
        cost: +costStr
      }];
    } else {
      batches = [{
        id: flId * 100 + 1,
        d: cycleStartDate || (cycleForEdit ? cycleForEdit.start : today()) || today(),
        count: +countStr,
        cost: +costStr,
        seq: ++seqBase,
        includeOld: !cycleForEdit || (cycleForEdit.exp || []).length === 0
      }];
    }

    collected.push(syncFlockFromBatches({
      id: flId,
      name,
      count: +countStr,
      cost: +costStr,
      batches
    }));
  }

  if (cycleForEdit) {
    cycleForEdit.nextSeq = seqBase;
  }

  return collected;
}

function editCycle() {
  S.summary = false;
  S.restock = false;
  S.restockFlockId = null;
  S.editCycle = true;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeEditCyclePage() {
  S.editCycle = false;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function editCyclePage(a, c) {
  if (!c) return;
  const flocks = c.flocks || [];

  a.innerHTML = `
    <div class="detail-top-nav">
      <button class="back-btn" onclick="closeEditCyclePage()">
        <span>→</span> <span>رجوع للدورة</span>
      </button>
      <span class="badge ${!c.end ? 'badge-active' : 'badge-closed'}">
        ${!c.end ? 'شغالة الآن' : 'مكتملة'}
      </span>
    </div>

    <div class="card">
      <form id="edit_cycle_form" autocomplete="off">
        <div class="form-header">
          <div class="form-title">تعديل بيانات الدورة والأنواع ✏️</div>
        </div>

        <div id="form_error_container"></div>

        <label>اسم الدورة *</label>
        <input id="edit_nn" value="${esc(c.name || '')}" placeholder="اسم الدورة">

        <label>تاريخ البدء</label>
        <input type="date" id="edit_ns" value="${c.start || today()}">

        <label>حالة الدورة</label>
        <select id="edit_status">
          <option value="ongoing" ${!c.end ? 'selected' : ''}>شغالة الآن (جارية)</option>
          <option value="closed" ${c.end ? 'selected' : ''}>مقفولة (مكتملة)</option>
        </select>

        <label style="margin-top: 16px;">🐣 أنواع الكتاكيت في الدورة</label>
        <div class="flock-rows-list" id="edit_flocks_list">
          ${flocks.map((fl, idx) => {
            const rec = flockRecordCounts(c, fl.id);
            return buildFlockRowHtml(idx, fl, rec.total > 0, rec.total);
          }).join('')}
        </div>

        <button type="button" class="btn btn-outline btn-full" onclick="addFlockRow('edit_flocks_list')" style="border-style: dashed; border-color: var(--emerald); color: var(--emerald); margin-bottom: 10px;">
          + إضافة نوع كتكوت آخر
        </button>

        <div class="flock-total-bar" id="flocks_modal_summary"></div>

        <div class="form-actions-row">
          <button class="btn btn-primary" style="flex: 2;" type="submit">حفظ تعديلات الدورة</button>
          <button class="btn btn-outline" style="flex: 1;" type="button" onclick="closeEditCyclePage()">إلغاء</button>
        </div>

        <div style="margin-top: 20px; border-top: 1px solid var(--border-subtle); padding-top: 14px; text-align: center;">
          <button type="button" class="btn btn-sm btn-danger" onclick="deleteCycle(${c.id})">
            حذف هذه الدورة وكافة سجلاتها نهائياً 🗑️
          </button>
        </div>
      </form>
    </div>
  `;

  refreshFlockRowLabels('edit_flocks_list');
  updateFlocksModalSummary();

  const editFormEl = document.getElementById('edit_cycle_form');
  if (editFormEl) {
    editFormEl.onsubmit = ev => {
      ev.preventDefault();
      clearFormErrors();

      const nn = document.getElementById('edit_nn').value.trim();
      const ns = document.getElementById('edit_ns').value;
      const st = document.getElementById('edit_status').value;

      if (!nn) {
        showFormError('يرجى إدخال اسم الدورة.', 'edit_nn');
        return;
      }

      const nextStart = ns || c.start;
      const targetEnd = st === 'closed' ? (c.end || today()) : null;
      if (targetEnd && nextStart && nextStart > targetEnd) {
        showFormError(`تاريخ بداية الدورة (${fd(nextStart)}) لا يمكن أن يكون بعد تاريخ إغلاقها (${fd(targetEnd)}).`, 'edit_ns');
        return;
      }

      const updatedFlocks = collectAndValidateFlockRows(c, nextStart);
      if (!updatedFlocks) return;

      c.name = nn;
      c.start = nextStart;
      c.flocks = updatedFlocks;
      syncCycleCount(c);
      c.end = targetEnd;

      if (saveAndNotify('تم حفظ تعديلات الدورة بنجاح ✓')) {
        S.editCycle = false;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
  }
}

// Full-page Add / Restock Chicks View: add chicks to an existing type OR add a brand-new type
// with explicit Yes/No selection on whether past expenses apply to this new batch.
function openAddFlockModal() {
  openRestockModal(null);
}

function openRestockModal(preselectedFlockId = null) {
  closeM();
  S.summary = false;
  S.editCycle = false;
  S.restock = true;
  S.restockFlockId = preselectedFlockId;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeRestockPage() {
  S.restock = false;
  S.restockFlockId = null;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function restockPage(a, c) {
  if (!a || !c) return;
  const preselectedFlockId = S.restockFlockId;
  const flocks = c.flocks || [];
  const k = calc(c);
  const hasOldExp = (c.exp || []).length > 0 && k.otherExp > 0;

  const initialMode = preselectedFlockId !== null
    ? 'existing'
    : (flocks.length > 0 ? 'existing' : 'new');
  const defaultExistingId = preselectedFlockId !== null
    ? preselectedFlockId
    : (flocks.length === 1 ? flocks[0].id : '');

  a.innerHTML = `
    <div class="detail-top-nav">
      <button class="back-btn" onclick="closeRestockPage()">
        <span>→</span> <span>رجوع للدورة</span>
      </button>
      <span class="badge ${!c.end ? 'badge-active' : 'badge-closed'}">
        ${!c.end ? 'شغالة الآن' : 'مكتملة'}
      </span>
    </div>

    <div class="card">
      <form id="restock_form" autocomplete="off">
        <div class="form-header">
          <div class="form-title">إضافة كتاكيت جديدة للدورة 🐣</div>
        </div>

        <div id="form_error_container"></div>

        ${flocks.length > 0 ? `
          <input type="hidden" id="rs_mode" value="${initialMode}">
          <div class="restock-mode-tabs">
            <button type="button" class="restock-mode-btn ${initialMode === 'existing' ? 'active' : ''}" data-mode="existing" onclick="switchRestockMode('existing')">
              <span>➕ زيادة على نوع موجود</span>
            </button>
            <button type="button" class="restock-mode-btn ${initialMode === 'new' ? 'active' : ''}" data-mode="new" onclick="switchRestockMode('new')">
              <span>🐣 نوع جديد مختلف</span>
            </button>
          </div>
        ` : `<input type="hidden" id="rs_mode" value="new">`}

        <div id="rs_existing_section" style="display: ${initialMode === 'existing' ? 'block' : 'none'};">
          <label>اختر النوع اللي هتزود عليه *</label>
          <input type="hidden" id="rs_flock_id" value="${defaultExistingId}">
          <div class="flock-picker-grid">
            ${flocks.map(fl => {
              const avail = flockAvailability(c, fl.id, 'inc', null);
              const isActive = String(defaultExistingId) === String(fl.id);
              return `
                <button type="button" class="flock-pick-btn rs-flock-btn ${isActive ? 'active' : ''}" data-flock-id="${fl.id}" onclick="selectRestockFlock(${fl.id})">
                  <span class="flock-pick-name">🐣 ${esc(fl.name)}</span>
                  <span class="flock-pick-meta">متبقي حالياً: ${f(avail)} طائر</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <div id="rs_new_section" style="display: ${initialMode === 'new' ? 'block' : 'none'};">
          <label>اسم النوع الجديد (كتابة باليد) *</label>
          <input id="rs_new_name" type="text" placeholder="اكتب اسم النوع هنا...">
        </div>

        <div class="flock-row-inputs-grid" style="margin-top: 6px;">
          <div>
            <label>العدد الجديد (طائر) *</label>
            <input id="rs_count" type="number" inputmode="numeric" placeholder="مثلاً: 100">
          </div>
          <div>
            <label>ثمن الكتاكيت الجديدة (ج) *</label>
            <input id="rs_cost" type="number" inputmode="decimal" step="any" placeholder="مثلاً: 1200">
          </div>
        </div>

        <label>تاريخ استلام الدفعة (للعلم)</label>
        <input type="date" id="rs_d" value="${today()}">

        ${hasOldExp ? `
          <label style="margin-top: 14px;">المصاريف اللي اتصرفت قبل كدا (${f(k.otherExp)} ج) تتحسب على الكتاكيت الجديدة دي كمان؟ *</label>
          <input type="hidden" id="rs_include_old" value="">
          <div id="rs_choice_status" class="restock-choice-status pending">
            <span>⏳ لسه مختارتش — اضغط على واحد من الاختيارين تحت عشان تقدر تحفظ</span>
          </div>
          <div class="restock-choice-list" id="rs_choice_list">
            <button type="button" class="restock-choice-btn choice-no" data-val="no" aria-pressed="false" onclick="selectRestockOldExp('no')">
              <span class="restock-choice-radio" aria-hidden="true"></span>
              <span class="restock-choice-body">
                <span class="restock-choice-title">لا — احسب عليهم المصاريف الجديدة اللي جاية بس</span>
                <span class="restock-choice-desc">الأكل والمصاريف القديمة كانت للطيور الموجودة قبل كده، والجداد دول يتحسبوا في المصاريف الجاية بس.</span>
              </span>
            </button>
            <button type="button" class="restock-choice-btn choice-yes" data-val="yes" aria-pressed="false" onclick="selectRestockOldExp('yes')">
              <span class="restock-choice-radio" aria-hidden="true"></span>
              <span class="restock-choice-body">
                <span class="restock-choice-title">أيوة — احسب عليهم من المصاريف القديمة كمان</span>
                <span class="restock-choice-desc">لسه فيه علف وأكل موجود في المزرعة من قبل كده، والكتاكيت الجديدة دي هتاكل منه معاهم.</span>
              </span>
            </button>
          </div>
        ` : `<input type="hidden" id="rs_include_old" value="no">`}

        <div class="form-actions-row">
          <button id="rs_submit_btn" class="btn btn-primary" style="flex: 2;" type="submit" ${hasOldExp ? 'disabled aria-disabled="true"' : ''}>
            ${hasOldExp ? '🔒 اختر أيوة أو لا أولاً' : 'إضافة وحفظ'}
          </button>
          <button class="btn btn-outline" style="flex: 1;" type="button" onclick="closeRestockPage()">إلغاء</button>
        </div>
      </form>
    </div>
  `;

  const restockFormEl = document.getElementById('restock_form');
  if (restockFormEl) {
    restockFormEl.onsubmit = ev => {
      ev.preventDefault();
      clearFormErrors();

      const mode = document.getElementById('rs_mode').value;
      const countStr = document.getElementById('rs_count').value.trim();
      const costStr = document.getElementById('rs_cost').value.trim();
      const dVal = document.getElementById('rs_d').value || today();
      const includeOldChoice = document.getElementById('rs_include_old').value;

      let targetFlock = null;
      let newName = '';
      if (mode === 'existing') {
        const fId = +document.getElementById('rs_flock_id').value;
        targetFlock = (c.flocks || []).find(fl => fl.id === fId);
        if (!targetFlock) {
          showFormError('يرجى اختيار نوع الفراخ اللي هتزود عليه أولاً.', null);
          return;
        }
      } else {
        newName = document.getElementById('rs_new_name').value.trim();
        if (!newName) {
          showFormError('يرجى كتابة اسم النوع الجديد.', 'rs_new_name');
          return;
        }
      }

      if (!countStr || isNaN(countStr) || +countStr <= 0 || !Number.isInteger(+countStr)) {
        showFormError('يرجى إدخال عدد صحيح أكبر من الصفر (بدون كسور).', 'rs_count');
        return;
      }
      if (costStr === '' || isNaN(costStr) || +costStr < 0) {
        showFormError('يرجى إدخال ثمن الكتاكيت الجديدة (0 أو أكبر).', 'rs_cost');
        return;
      }
      if (hasOldExp && includeOldChoice !== 'yes' && includeOldChoice !== 'no') {
        showFormError('يرجى اختيار "أيوة" أو "لا" بخصوص حساب المصاريف القديمة على الكتاكيت الجديدة.', null);
        return;
      }

      const batchSeq = nextCycleSeq(c);
      const newBatch = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        d: dVal,
        count: +countStr,
        cost: +costStr,
        seq: batchSeq,
        includeOld: includeOldChoice === 'yes'
      };

      if (mode === 'existing') {
        targetFlock.batches = Array.isArray(targetFlock.batches) ? targetFlock.batches : [];
        targetFlock.batches.push(newBatch);
        syncFlockFromBatches(targetFlock);
        S.openFlocks[targetFlock.id] = true;
      } else {
        c.flocks = c.flocks || [];
        const maxFlockId = c.flocks.reduce((m, fl) => Math.max(m, +fl.id || 0), 0);
        const createdFlock = syncFlockFromBatches({
          id: Math.max(Date.now(), maxFlockId) + 1,
          name: newName,
          count: +countStr,
          cost: +costStr,
          batches: [newBatch]
        });
        c.flocks.push(createdFlock);
        targetFlock = createdFlock;
      }

      syncCycleCount(c);
      const toastMsg = mode === 'existing'
        ? `تمت إضافة ${f(+countStr)} طائر على "${targetFlock.name}" بنجاح 🐥`
        : `تمت إضافة نوع "${targetFlock.name}" للدورة بنجاح 🐥`;

      if (saveAndNotify(toastMsg)) {
        S.restock = false;
        S.restockFlockId = null;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
  }
}

function switchRestockMode(mode) {
  const modeEl = document.getElementById('rs_mode');
  if (modeEl) modeEl.value = mode;
  document.querySelectorAll('.restock-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  const exSec = document.getElementById('rs_existing_section');
  const newSec = document.getElementById('rs_new_section');
  if (exSec) exSec.style.display = mode === 'existing' ? 'block' : 'none';
  if (newSec) newSec.style.display = mode === 'new' ? 'block' : 'none';
}

function selectRestockFlock(flockId) {
  const input = document.getElementById('rs_flock_id');
  if (input) input.value = flockId;
  document.querySelectorAll('.rs-flock-btn').forEach(btn => {
    btn.classList.toggle('active', String(btn.dataset.flockId) === String(flockId));
  });
}

function selectRestockOldExp(val) {
  const input = document.getElementById('rs_include_old');
  if (input) input.value = val;

  const list = document.getElementById('rs_choice_list');
  if (list) list.classList.add('has-selection');

  document.querySelectorAll('.restock-choice-btn').forEach(btn => {
    const isMatch = btn.dataset.val === val;
    btn.classList.toggle('active', isMatch);
    btn.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
  });

  const statusEl = document.getElementById('rs_choice_status');
  if (statusEl) {
    statusEl.className = `restock-choice-status ${val === 'yes' ? 'selected-yes' : 'selected-no'}`;
    statusEl.innerHTML = val === 'yes'
      ? '<span>✓ اختيارك: أيوة — تشمل المصاريف القديمة كمان</span>'
      : '<span>✓ اختيارك: لا — المصاريف الجديدة اللي جاية بس</span>';
  }

  const submitBtn = document.getElementById('rs_submit_btn');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.setAttribute('aria-disabled', 'false');
    submitBtn.textContent = 'إضافة وحفظ ✓';
  }
}

function openEditBatchModal(flockId, batchIdx) {
  const c = cur();
  if (!c) return;
  const fl = (c.flocks || []).find(x => x.id === flockId);
  if (!fl || !Array.isArray(fl.batches) || !fl.batches[batchIdx]) return;
  const b = fl.batches[batchIdx];
  const hasEarlierExp = (c.exp || []).some(e => (+e.seq || 0) < (+b.seq || 0));

  const { m: modal, fm: formEl } = ensureModalElements();
  if (!modal || !formEl) return;

  formEl.innerHTML = `
    <div class="form-header">
      <div class="form-title">تعديل دفعة ${batchIdx + 1} (${esc(fl.name)}) ✏️</div>
      <button type="button" class="btn btn-sm btn-outline" onclick="closeM()">✕</button>
    </div>

    <div id="form_error_container"></div>

    <label>العدد (طائر) *</label>
    <input id="eb_count" type="number" inputmode="numeric" value="${b.count}">

    <label>ثمن الكتاكيت (جنيه) *</label>
    <input id="eb_cost" type="number" inputmode="decimal" step="any" value="${b.cost}">

    <label>تاريخ الاستلام</label>
    <input id="eb_d" type="date" value="${b.d || c.start || today()}">

    ${hasEarlierExp ? `
      <label style="margin-top: 12px;">هل تتحمل هذه الدفعة من المصاريف التي سبقتها؟ *</label>
      <input type="hidden" id="rs_include_old" value="${b.includeOld === false ? 'no' : 'yes'}">
      <div class="restock-choice-list has-selection" id="rs_choice_list">
        <button type="button" class="restock-choice-btn choice-no ${b.includeOld === false ? 'active' : ''}" data-val="no" aria-pressed="${b.includeOld === false ? 'true' : 'false'}" onclick="selectRestockOldExp('no')">
          <span class="restock-choice-radio" aria-hidden="true"></span>
          <span class="restock-choice-body">
            <span class="restock-choice-title">لا — المصاريف الجديدة اللي بعدها بس</span>
          </span>
        </button>
        <button type="button" class="restock-choice-btn choice-yes ${b.includeOld !== false ? 'active' : ''}" data-val="yes" aria-pressed="${b.includeOld !== false ? 'true' : 'false'}" onclick="selectRestockOldExp('yes')">
          <span class="restock-choice-radio" aria-hidden="true"></span>
          <span class="restock-choice-body">
            <span class="restock-choice-title">أيوة — تشمل المصاريف القديمة كمان</span>
          </span>
        </button>
      </div>
    ` : ''}

    <div class="form-actions-row">
      <button class="btn btn-primary" style="flex: 2;" type="submit">حفظ تعديل الدفعة</button>
      <button class="btn btn-outline" style="flex: 1;" type="button" onclick="closeM()">إلغاء</button>
    </div>
  `;

  formEl.onsubmit = ev => {
    ev.preventDefault();
    clearFormErrors();

    const countStr = document.getElementById('eb_count').value.trim();
    const costStr = document.getElementById('eb_cost').value.trim();
    const dVal = document.getElementById('eb_d').value || b.d || today();
    const incEl = document.getElementById('rs_include_old');

    if (!countStr || isNaN(countStr) || +countStr <= 0 || !Number.isInteger(+countStr)) {
      showFormError('يرجى إدخال عدد صحيح أكبر من الصفر (بدون كسور).', 'eb_count');
      return;
    }
    if (costStr === '' || isNaN(costStr) || +costStr < 0) {
      showFormError('يرجى إدخال تكلفة الكتاكيت (0 أو أكبر).', 'eb_cost');
      return;
    }

    const usedBirds = (c.inc || []).filter(x => x.flockId === fl.id).reduce((s, x) => s + (+x.cnt || 0), 0)
      + (c.dead || []).filter(x => x.flockId === fl.id).reduce((s, x) => s + (+x.n || 0), 0);
    const otherBatchesCount = fl.batches.reduce((s, item, idx) => s + (idx === batchIdx ? 0 : (+item.count || 0)), 0);
    if (otherBatchesCount + (+countStr) < usedBirds) {
      showFormError(`عفواً، إجمالي النوع بعد التعديل (${otherBatchesCount + (+countStr)}) أقل من الطيور المسجل بيعها ونفوقها (${usedBirds} طائر).`, 'eb_count');
      return;
    }

    b.count = +countStr;
    b.cost = +costStr;
    b.d = dVal;
    if (incEl) b.includeOld = incEl.value === 'yes';

    syncFlockFromBatches(fl);
    syncCycleCount(c);

    if (saveAndNotify('تم تعديل الدفعة بنجاح ✓')) {
      closeM();
      render();
    }
  };

  modal.classList.add('on');
}

function delBatch(flockId, batchIdx) {
  const c = cur();
  if (!c) return;
  const fl = (c.flocks || []).find(x => x.id === flockId);
  if (!fl || !Array.isArray(fl.batches) || fl.batches.length <= 1 || !fl.batches[batchIdx]) return;

  const b = fl.batches[batchIdx];
  const usedBirds = (c.inc || []).filter(x => x.flockId === fl.id).reduce((s, x) => s + (+x.cnt || 0), 0)
    + (c.dead || []).filter(x => x.flockId === fl.id).reduce((s, x) => s + (+x.n || 0), 0);
  const remainingCountAfterDel = fl.count - (+b.count || 0);
  if (remainingCountAfterDel < usedBirds) {
    showToast(`⚠️ لا يمكن حذف الدفعة لأن المتبقي (${remainingCountAfterDel}) أقل من المباع والنافق (${usedBirds} طائر)`, 3600);
    return;
  }

  showConfirmModal({
    icon: '🗑️',
    title: `تأكيد حذف دفعة ${batchIdx + 1} (${fl.name})`,
    subtitle: 'هل تريد حذف هذه الدفعة؟ سيتم تحديث إجمالي أعداد وتكلفة النوع تلقائياً.',
    itemIcon: '🐣',
    itemTitle: `${fl.name} — دفعة ${batchIdx + 1}`,
    itemMeta: `العدد: ${f(b.count)} طائر • التكلفة: ${f(b.cost)} ج • ${fds(b.d)}`,
    confirmBtnText: 'نعم، احذف الدفعة',
    onConfirm: () => {
      fl.batches.splice(batchIdx, 1);
      syncFlockFromBatches(fl);
      syncCycleCount(c);
      if (saveAndNotify('تم حذف الدفعة وتحديث الحسابات ✓')) {
        render();
      }
    }
  });
}

function openFlockModal(flockId = null) {
  if (flockId === null) return openRestockModal(null);
  const c = cur();
  if (!c) return;
  const existingFlock = (c.flocks || []).find(fl => fl.id === flockId);
  if (!existingFlock) return;
  const isMultiBatch = Array.isArray(existingFlock.batches) && existingFlock.batches.length > 1;

  const { m: modal, fm: formEl } = ensureModalElements();
  if (!modal || !formEl) return;

  formEl.innerHTML = `
    <div class="form-header">
      <div class="form-title">تعديل بيانات النوع ✏️</div>
      <button type="button" class="btn btn-sm btn-outline" onclick="closeM()">✕</button>
    </div>

    <div id="form_error_container"></div>

    <label>اسم النوع (كتابة باليد) *</label>
    <input id="af_name" type="text" value="${esc(existingFlock.name)}" placeholder="اكتب اسم النوع هنا...">

    ${isMultiBatch ? `
      <div class="form-hint-banner" style="margin-top: 10px;">
        <span>📦</span>
        <span>هذا النوع مكون من <b>${existingFlock.batches.length} دفعات</b> بإجمالي <b>${f(existingFlock.count)} طائر</b>. يمكنك تعديل أو حذف كل دفعة من قائمة الدفعات داخل النوع.</span>
      </div>
    ` : `
      <label>عدد الكتاكيت *</label>
      <input id="af_count" type="number" inputmode="numeric" value="${existingFlock.count}" placeholder="مثلاً: 200">

      <label>تكلفة شراء الكتاكيت (جنيه) *</label>
      <input id="af_cost" type="number" inputmode="decimal" step="any" value="${existingFlock.cost}" placeholder="مثلاً: 3800">
    `}

    <div class="form-actions-row">
      <button class="btn btn-primary" style="flex: 2;" type="submit">حفظ التعديلات</button>
      <button class="btn btn-outline" style="flex: 1;" type="button" onclick="closeM()">إلغاء</button>
    </div>
  `;

  formEl.onsubmit = ev => {
    ev.preventDefault();
    clearFormErrors();

    const name = document.getElementById('af_name').value.trim();
    if (!name) {
      showFormError('يرجى كتابة اسم نوع الكتاكيت.', 'af_name');
      return;
    }

    if (!isMultiBatch) {
      const countStr = document.getElementById('af_count').value.trim();
      const costStr = document.getElementById('af_cost').value.trim();

      if (!countStr || isNaN(countStr) || +countStr <= 0 || !Number.isInteger(+countStr)) {
        showFormError('يرجى إدخال عدد صحيح أكبر من الصفر (بدون كسور).', 'af_count');
        return;
      }
      if (costStr === '' || isNaN(costStr) || +costStr < 0) {
        showFormError('يرجى إدخال تكلفة الكتاكيت (0 أو أكبر).', 'af_cost');
        return;
      }

      const usedBirds = (c.inc || []).filter(x => x.flockId === existingFlock.id).reduce((s, x) => s + (+x.cnt || 0), 0)
        + (c.dead || []).filter(x => x.flockId === existingFlock.id).reduce((s, x) => s + (+x.n || 0), 0);
      if (+countStr < usedBirds) {
        showFormError(`عفواً، العدد (${countStr}) أقل من الطيور المسجل بيعها ونفوقها بالفعل (${usedBirds} طائر).`, 'af_count');
        return;
      }

      if (Array.isArray(existingFlock.batches) && existingFlock.batches.length === 1) {
        existingFlock.batches[0].count = +countStr;
        existingFlock.batches[0].cost = +costStr;
      } else {
        existingFlock.batches = [{
          id: existingFlock.id * 100 + 1,
          d: c.start || today(),
          count: +countStr,
          cost: +costStr,
          seq: nextCycleSeq(c),
          includeOld: true
        }];
      }
      syncFlockFromBatches(existingFlock);
    }

    existingFlock.name = name;
    syncCycleCount(c);

    if (saveAndNotify(`تم تعديل نوع "${name}" بنجاح ✓`)) {
      closeM();
      render();
    }
  };

  modal.classList.add('on');
}

function delFlock(flockId) {
  const c = cur();
  if (!c || !Array.isArray(c.flocks) || c.flocks.length <= 1) return;
  const idx = c.flocks.findIndex(fl => fl.id === flockId);
  if (idx === -1) return;
  const fl = c.flocks[idx];

  if (flockRecordCounts(c, flockId).total > 0) {
    showToast('⚠️ لا يمكن حذف نوع مرتبط بحركات بيع أو نافق مسجلة', 3200);
    return;
  }

  showConfirmModal({
    icon: '🗑️',
    title: 'تأكيد حذف نوع الكتاكيت ⚠️',
    subtitle: 'هل تريد حذف هذا النوع من الدورة؟ سيتم تحديث إجمالي أعداد وتكلفة الدورة تلقائياً.',
    itemIcon: '🐣',
    itemTitle: `${fl.name}`,
    itemMeta: `العدد: ${f(fl.count)} طائر • التكلفة: ${f(fl.cost)} ج`,
    confirmBtnText: 'نعم، احذف هذا النوع',
    onConfirm: () => {
      c.flocks.splice(idx, 1);
      syncCycleCount(c);
      if (saveAndNotify(`تم حذف نوع "${fl.name}" بنجاح`)) {
        render();
      }
    }
  });
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
        if (saveAndNotify('تم حذف الدورة بنجاح')) {
          closeM();
          S.editCycle = false;
          S.restock = false;
          S.restockFlockId = null;
          S.summary = false;
          S.v = 'list';
          render();
        }
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

    <div class="form-hint-banner" style="margin-top: 14px; margin-bottom: 6px;">
      <span>🐣</span>
      <span>سجل كل نوع كتاكيت اشتريته وعدده وتكلفته. باقي المصاريف (علف، غاز، دواء...) هتتسجل للدورة كلها بعدين.</span>
    </div>

    <div class="flock-rows-list" id="new_flocks_list">
      ${buildFlockRowHtml(0, {}, false, 0)}
    </div>

    <button type="button" class="btn btn-outline btn-full" onclick="addFlockRow('new_flocks_list')" style="border-style: dashed; border-color: var(--emerald); color: var(--emerald); margin-bottom: 10px;">
      + إضافة نوع كتكوت آخر
    </button>

    <div class="flock-total-bar" id="flocks_modal_summary"></div>

    <div class="form-actions-row">
      <button class="btn btn-primary" style="flex: 2;" type="submit">إنشاء الدورة</button>
      <button class="btn btn-outline" style="flex: 1;" type="button" onclick="closeM()">إلغاء</button>
    </div>
  `;

  refreshFlockRowLabels('new_flocks_list');
  updateFlocksModalSummary();

  formEl.onsubmit = ev => {
    ev.preventDefault();
    clearFormErrors();

    const nn = document.getElementById('nn').value.trim();
    const ns = document.getElementById('ns').value;

    if (!nn) {
      showFormError('يرجى إدخال اسم الدورة.', 'nn');
      return;
    }

    const cycleStart = ns || today();
    const flocks = collectAndValidateFlockRows(null, cycleStart);
    if (!flocks) return;

    const newObj = {
      id: nid++,
      name: nn,
      start: cycleStart,
      end: null,
      n: 0,
      nextSeq: flocks.length,
      flocks,
      exp: [],
      inc: [],
      dead: [],
      feed: [],
      debt: []
    };
    syncCycleCount(newObj);

    C.push(newObj);
    if (saveAndNotify('تم إنشاء الدورة الجديدة بنجاح 🐥')) {
      closeM();
      S.v = newObj.id;
      S.tab = 'exp';
      render();
    }
  };

  modal.classList.add('on');
}

function closeC() {
  const cycle = cur();
  if (!cycle) return;

  if (cycle.start && cycle.start > today()) {
    showToast('⚠️ لا يمكن إغلاق دورة تاريخ بدايتها في المستقبل!', 3200);
    return;
  }

  const hasFeedPurchases = (cycle.feed || []).some(x => x.type === 'purchased');
  const lastPurchaseTodaySeq = (cycle.feed || []).filter(x => x.d === today()).reduce((max, p) => {
    const e = (cycle.exp || []).find(item => item.id === p.expRefId || item.feedRefId === p.id);
    return Math.max(max, +p.seq || +(e && e.seq) || 0);
  }, 0);
  const lastSaleTodaySeq = (cycle.inc || []).filter(x => x.d === today()).reduce((max, x) => Math.max(max, +x.seq || 0), 0);
  const requiredStocktakeSeq = Math.max(lastPurchaseTodaySeq, lastSaleTodaySeq);
  const hasTodayStocktake = (cycle.feedStocktakes || []).some(x => x.d === today() && (+x.seq || 0) >= requiredStocktakeSeq);
  if (hasFeedPurchases && !hasTodayStocktake) {
    S.tab = 'exp';
    render();
    showToast('قبل إغلاق الدورة، سجّل جرد العلف النهائي (حتى لو الرصيد صفر).', 3600);
    openFeedStocktakeModal();
    return;
  }

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
      if (saveAndNotify('تم إغلاق الدورة بنجاح ✓')) {
        render();
      }
    }
  });
}
