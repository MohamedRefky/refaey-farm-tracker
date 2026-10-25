/**
 * Refaey Farm Tracker - Educational & Analytical Guides
 * Interactive explanations for Feed Conversion Ratio (FCR) and flock efficiency indicators.
 */

// ==========================================================================
// 1. FCR & EFFICIENCY GUIDE MODAL
// ==========================================================================
function showFcrModal() {
  showEfficiencyGuideModal('fcr');
}

function showEfficiencyGuideModal(activeTab = 'fcr') {
  const cycle = cur();
  if (!cycle) return;
  const k = calc(cycle);
  const cm = document.getElementById('cm');
  if (!cm) return;

  const isOngoing = !cycle.end;
  const fcrVal = k.fcr ? k.fcr.toFixed(2) : null;

  let statusBadge = '';
  let statusText = '';
  let statusColor = 'var(--emerald)';

  if (!fcrVal) {
    statusBadge = '⏳ بانتظار تسجيل أوزان البيع';
    statusText = 'لم يتم تسجيل أوزان بيع بالكيلو بعد. سيبدأ حساب معامل التحويل تلقائياً بمجرد تسجيل أول حركة بيع طيور مع وزنها الإجمالي.';
    statusColor = 'var(--text-muted)';
  } else if (isOngoing && k.remaining > 0) {
    statusBadge = `⏳ دورة جارية مؤقت (${fcrVal} كجم علف/كجم لحم)`;
    statusText = `الرقم الحالي (${fcrVal}) يمثل استهلاك العلف للقطيع كله مقسوماً على ما تم بيعه فقط حتى الآن. سيعتدل الرقم تدريجياً مع بيع باقي القطيع (${f(k.remaining)} طائر).`;
    statusColor = 'var(--sky)';
  } else if (k.fcr <= 1.55) {
    statusBadge = '🌟 سوبر ممتاز (أعلى كفاءة وأقصى ربح)';
    statusText = `كل 1 كيلو لحم انتجته دورتك كلفك ${fcrVal} كجم علف فقط. هذا أداء استثنائي وتوفير كبير جداً في تكلفة العلف.`;
    statusColor = 'var(--emerald)';
  } else if (k.fcr <= 1.65) {
    statusBadge = '🟢 طبيعي ومربح (ضمن المعدل القياسي)';
    statusText = `كل 1 كيلو لحم انتجته دورتك كلفك ${fcrVal} كجم علف. هذا هو المعدل الطبيعي والمربح لمعظم مزارع التسمين الناجحة.`;
    statusColor = 'var(--emerald)';
  } else if (k.fcr <= 1.80) {
    statusBadge = '🟠 متوسط وفيه هدر نسبي في العلف';
    statusText = `كل 1 كيلو لحم كلفك ${fcrVal} كجم علف. الفراخ تستهلك علف زيادة مقارنة بالوزن المكتسب، يُفضل مراجعة التهوية والتدفئة ومنع هدر العلافات.`;
    statusColor = 'var(--amber)';
  } else {
    statusBadge = '🔴 مرتفع جداً (هدر في العلف وخسارة)';
    statusText = `كل 1 كيلو لحم أخذ ${fcrVal} كجم علف! الفراخ تستهلك علفاً كبيراً دون تحقيق وزن مناسب. قد يكون السبب برودة العنبر، أو علف رديء، أو إصابة معوية (كوكسيديا/كلوسترديا).`;
    statusColor = 'var(--rose)';
  }

  // Active Tab Rendering
  const currentTab = (activeTab === 'all' || !activeTab) ? 'fcr' : activeTab;

  let tabContent = '';

  if (currentTab === 'fcr') {
    tabContent = `
      <!-- FCR Spotlight -->
      <div class="card" style="margin-bottom: 12px; padding: 16px; background: rgba(0,0,0,0.25); border-color: ${statusColor};">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
          <span style="font-size: 13px; font-weight: 700; color: var(--text-muted);">معامل التحويل لدورتك الحالية:</span>
          <span style="font-size: 28px; font-weight: 800; font-family: var(--font-num); color: ${statusColor};">
            ${fcrVal ? fcrVal : '-'}
          </span>
        </div>
        <div style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 800; margin-bottom: 8px; background: rgba(255,255,255,0.06); color: ${statusColor}; border: 1px solid ${statusColor};">
          ${statusBadge}
        </div>
        <div style="font-size: 13px; line-height: 1.5; color: var(--text-main);">
          ${statusText}
        </div>
        ${fcrVal ? `
          <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--border-subtle); font-size: 11px; color: var(--text-muted);">
            📊 تم حسابه من: علف مستهلك (<b>${f(k.feedConsumedKg)} كجم</b>) ÷ إجمالي وزن البيع (<b>${f(k.kgS)} كجم</b>).
          </div>
        ` : ''}
      </div>

      ${isOngoing && k.remaining > 0 && fcrVal ? `
        <div class="form-hint-banner" style="background: rgba(14,165,233,0.12); border-color: var(--sky); color: var(--sky); margin-bottom: 12px; font-size: 12px;">
          <span>⏳</span>
          <span><b>ملحوظة للمربي:</b> الدورة ما زالت جارية ويوجد <b>${f(k.remaining)} طائر</b> في العنبر، الرقم سيعتدل تدريجياً ليصبح دقيقاً مع نهاية تسويق باقي الطيور.</span>
        </div>
      ` : ''}

      <!-- Golden Rule -->
      <div class="form-hint-banner emerald" style="margin-bottom: 14px;">
        <span>💰</span>
        <span><b>القاعدة الذهبية:</b> كل ما الرقم <u>يقل</u>، كل ما أرباحك <u>تزيد</u>! (علف قليل = لحم كثير = توفير فلوس).</span>
      </div>

      <!-- Visual Color Gauge Meter -->
      <div class="fcr-meter-container">
        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; margin-bottom: 4px;">
          <span style="color: var(--emerald);">ممتاز (&lt; 1.55)</span>
          <span style="color: var(--sky);">طبيعي ومربح (1.60)</span>
          <span style="color: var(--amber);">هدر نسبي (1.75)</span>
          <span style="color: var(--rose);">خسارة (&gt; 1.80)</span>
        </div>
        <div class="fcr-meter-bar"></div>
        <div class="fcr-meter-legend">
          <span>1.40 كجم</span>
          <span>1.55 كجم</span>
          <span>1.65 كجم</span>
          <span>1.80+ كجم</span>
        </div>
      </div>

      <!-- Benchmark Table -->
      <div style="font-size: 13px; font-weight: 800; color: var(--text-title); margin: 12px 0 8px;">
        📌 دليل تقييم معامل التحويل في السوق المصري:
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; font-size: 12px;">
        <div style="display: flex; justify-content: space-between; padding: 7px 12px; border-radius: 6px; background: rgba(16,185,129,0.12); border: 1px solid var(--emerald); color: var(--text-main);">
          <span>🌟 <b>أقل من 1.55</b>: سوبر ممتاز</span>
          <span style="color: var(--emerald); font-weight: 700;">أقصى ربحية وتوفير كبير</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 7px 12px; border-radius: 6px; background: rgba(16,185,129,0.06); border: 1px solid var(--border-subtle); color: var(--text-main);">
          <span>🟢 <b>1.55 إلى 1.65</b>: طبيعي ومربح</span>
          <span style="color: var(--emerald); font-weight: 700;">المعدل القياسي للمزارع</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 7px 12px; border-radius: 6px; background: rgba(245,158,11,0.08); border: 1px solid var(--amber); color: var(--text-main);">
          <span>🟠 <b>1.65 إلى 1.80</b>: متوسط وفيه هدر</span>
          <span style="color: var(--amber); font-weight: 700;">راجع التدفئة والعلافات</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 7px 12px; border-radius: 6px; background: rgba(244,63,94,0.08); border: 1px solid var(--rose); color: var(--text-main);">
          <span>🔴 <b>أكثر من 1.80</b>: خسارة وهدر علف</span>
          <span style="color: var(--rose); font-weight: 700;">افحص الأمراض والسموم</span>
        </div>
      </div>

      <!-- Farm Practical Tips -->
      <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px; margin-bottom: 16px; font-size: 12px; line-height: 1.6;">
        <div style="font-weight: 800; color: var(--emerald); margin-bottom: 4px;">🚜 نصائح عملية من واقع المزارع لتنزيل المعامل وزيادة أرباحك:</div>
        <div>• <b>التدفئة الجيدة:</b> البرودة تجعل الطائر يحرق العلف للتدفئة بدلاً من تحويله للحم.</div>
        <div>• <b>ارتفاع العلافات:</b> اضبط حافة العلافة في مستوى ظهر الطائر لمنع نثر وهدر العلف في الفرشة.</div>
        <div>• <b>صحة الأمعاء:</b> مكافحة الكوكسيديا والكلوسترديا تضمن امتصاص الطائر لكل حبة علف.</div>
        <div>• <b>مضادات السموم:</b> استخدام مضاد سموم فطرية قوي دورياً يحافظ على الكبد وكفاءة الهضم.</div>
      </div>
    `;
  } else if (currentTab === 'cpb') {
    tabContent = `
      <div class="card" style="margin-bottom: 14px; padding: 16px; background: rgba(0,0,0,0.25); border-color: var(--sky);">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
          <span style="font-size: 13px; font-weight: 700; color: var(--text-muted);">تكلفة الطائر الحي في دورتك:</span>
          <span style="font-size: 28px; font-weight: 800; font-family: var(--font-num); color: var(--sky);">
            ${f(k.cpb)} ج
          </span>
        </div>
        <div style="font-size: 13px; line-height: 1.5; color: var(--text-main);">
          كل فرخة باقية عايشة في عنبرك مكلفاك حتى هذه اللحظة <b>${f(k.cpb)} جنيه مصري</b>.
        </div>
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--border-subtle); font-size: 11px; color: var(--text-muted);">
          📊 تم حسابه من: إجمالي المصروفات (<b>${f(k.e)} ج</b>) ÷ عدد الطيور الحية المتبقية (<b>${f(k.remaining)} طائر</b>).
        </div>
      </div>

      <div class="form-hint-banner emerald" style="margin-bottom: 14px;">
        <span>💡</span>
        <span><b>ما فائدة هذا الرقم للمربي؟</b> يحدد لك «حد الأمان» عند البيع! إذا بعت الفرخة بأعلى من ${f(k.cpb)} ج تكون رابحاً، وإذا بعت بأقل تخسر.</span>
      </div>

      <div style="font-size: 12px; color: var(--text-muted); line-height: 1.6; margin-bottom: 14px;">
        📌 <b>ماذا تشمل تكلفة الطائر؟</b>
        تشمل كل قرش صرفته على الدورة مقسوماً على الطيور الحية: (سعر الكتكوت + العلف + الأدوية والتحصينات + الغاز والكهرباء والفرشة + العمالة والنقل).
      </div>
    `;
  } else if (currentTab === 'ppb') {
    tabContent = `
      <div class="card" style="margin-bottom: 14px; padding: 16px; background: rgba(0,0,0,0.25); border-color: ${k.ppb >= 0 ? 'var(--emerald)' : 'var(--rose)'};">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
          <span style="font-size: 13px; font-weight: 700; color: var(--text-muted);">صافي ربح الطائر المباع:</span>
          <span style="font-size: 28px; font-weight: 800; font-family: var(--font-num); color: ${k.ppb >= 0 ? 'var(--emerald)' : 'var(--rose)'};">
            ${f(k.ppb)} ج
          </span>
        </div>
        <div style="font-size: 13px; line-height: 1.5; color: var(--text-main);">
          ${k.ppb >= 0 
            ? `ما شاء الله! كل فرخة خرجت من باب المزرعة وتباعت حطت في جيبك صافي مكسب <b>${f(k.ppb)} ج</b> بعد خصم كل التكاليف.`
            : `الرقم بالسالب حالياً (${f(k.ppb)} ج)؛ إما لأن البيع في بدايته ولم يغطِ تكلفة الكتاكيت والعلف بعد، أو لأن سعر البيع كان منخفضاً.`}
        </div>
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--border-subtle); font-size: 11px; color: var(--text-muted);">
          📊 تم حسابه من: صافي أرباح الدورة (<b>${f(k.p)} ج</b>) ÷ عدد الطيور المباعة (<b>${f(k.sold)} طائر</b>).
        </div>
      </div>

      <div class="form-hint-banner" style="margin-bottom: 14px;">
        <span>📈</span>
        <span><b>توضيح هام:</b> في بداية أيام البيع، قد يظهر ربح الطائر بالسالب لأن المبيعات الأولى لم تغطِ بعد تكاليف الدورة الكلية. مع استمرار تسليم باقي الفراخ يتحول الرقم للموجب والربح الصافي الحقيقي.</span>
      </div>
    `;
  } else if (currentTab === 'feed') {
    tabContent = `
      <div class="card" style="margin-bottom: 14px; padding: 16px; background: rgba(0,0,0,0.25); border-color: var(--sky);">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
          <span style="font-size: 13px; font-weight: 700; color: var(--text-muted);">إجمالي العلف المستهلك:</span>
          <span style="font-size: 28px; font-weight: 800; font-family: var(--font-num); color: var(--sky);">
            ${f(k.feedConsumedKg)} كجم
          </span>
        </div>
        <div style="font-size: 13px; line-height: 1.5; color: var(--text-main);">
          ما يعادل <b>${(k.feedConsumedKg / bagKg).toFixed(1)} شكارة</b> (${bagKg} كجم) تم سحبها من المخزن وأكلتها الطيور فعلياً.
        </div>
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--border-subtle); font-size: 11px; color: var(--text-muted);">
          🏬 رصيد المخزن المتبقي الحالي: <b>${f(k.feedStockKg)} كجم</b> (${(k.feedStockKg / bagKg).toFixed(1)} شكارة جاهزة للاستخدام).
        </div>
      </div>

      <div class="form-hint-banner emerald" style="margin-bottom: 14px;">
        <span>🌾</span>
        <span><b>لماذا نفرق بين العلف المشتري والمستهلك؟</b> لأن الشكاير الموجودة بالمخزن هي أصل ورصيد ملكك لم تأكله الطيور بعد، فلا تُحسب ضمن معامل التحويل حتى يتم استهلاكها للطيور.</span>
      </div>
    `;
  }

  cm.innerHTML = `
    <div class="guide-box" onclick="event.stopPropagation()">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px; margin-bottom: 14px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 24px;">💡</span>
          <div>
            <div style="font-size: 17px; font-weight: 800; color: var(--text-title);">دليل مؤشرات الكفاءة والأرباح لمربي الدواجن</div>
            <div style="font-size: 12px; color: var(--text-muted);">شرح مبسط وواضح لكل رقم في شاشتك وتأثيره على جيبك</div>
          </div>
        </div>
        <button type="button" class="btn btn-sm btn-outline" onclick="closeConfirmModal()">✕</button>
      </div>

      <!-- Guide Sub-tabs -->
      <div class="guide-tab-pills">
        <button type="button" class="guide-tab-btn ${currentTab === 'fcr' ? 'active' : ''}" onclick="showEfficiencyGuideModal('fcr')">
          ⚖️ معامل التحويل (FCR)
        </button>
        <button type="button" class="guide-tab-btn ${currentTab === 'cpb' ? 'active' : ''}" onclick="showEfficiencyGuideModal('cpb')">
          💵 تكلفة الطائر
        </button>
        <button type="button" class="guide-tab-btn ${currentTab === 'ppb' ? 'active' : ''}" onclick="showEfficiencyGuideModal('ppb')">
          📈 ربح الطائر
        </button>
        <button type="button" class="guide-tab-btn ${currentTab === 'feed' ? 'active' : ''}" onclick="showEfficiencyGuideModal('feed')">
          🌾 العلف المستهلك
        </button>
      </div>

      <!-- Tab Content Placeholder -->
      ${tabContent}

      <div style="text-align: center; margin-top: 10px;">
        <button type="button" class="btn btn-primary btn-full" onclick="closeConfirmModal()">
          فهمت ذلك تماماً ✓
        </button>
      </div>
    </div>
  `;

  cm.onclick = e => {
    if (e.target === cm) closeConfirmModal();
  };

  cm.classList.add('on');
}
