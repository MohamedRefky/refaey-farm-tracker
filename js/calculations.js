/**
 * Refaey Farm Tracker - Calculations & Formatting Engine
 */

// Formats number with commas: 10000 -> 10,000
const f = n => Math.round(n || 0).toLocaleString('en-US');

// Formats date into readable Arabic date (ensures Egypt Africa/Cairo timezone)
const fd = d => {
  if (!d) return '';
  const parts = String(d).split('-');
  if (parts.length === 3) {
    const dateObj = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    return dateObj.toLocaleDateString('ar-EG-u-nu-latn', {
      timeZone: 'Africa/Cairo',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
  return new Date(d).toLocaleDateString('ar-EG-u-nu-latn', {
    timeZone: 'Africa/Cairo',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

// Safe array property summation
const sum = (arr, key) => (arr || []).reduce((s, x) => s + (+x[key] || 0), 0);

// Look up a flock type name safely
function flockName(c, id) {
  const flock = ((c && c.flocks) || []).find(x => x.id === id);
  return flock ? flock.name : 'نوع غير محدد';
}

// Available birds in a flock type (excludes the record being edited)
function flockAvailability(c, flockId, kind, editIndex) {
  if (!c) return 0;
  const flock = (c.flocks || []).find(x => x.id === flockId);
  if (!flock) return 0;

  let used = 0;
  (c.inc || []).forEach((x, i) => {
    if (x.flockId === flockId && !(kind === 'inc' && i === editIndex)) used += +x.cnt || 0;
  });
  (c.dead || []).forEach((x, i) => {
    if (x.flockId === flockId && !(kind === 'dead' && i === editIndex)) used += +x.n || 0;
  });

  return Math.max(0, (+flock.count || 0) - used);
}

// Number of linked records for a flock type
function flockRecordCounts(c, flockId) {
  const sales = ((c && c.inc) || []).filter(x => x.flockId === flockId).length;
  const deaths = ((c && c.dead) || []).filter(x => x.flockId === flockId).length;
  return { sales, deaths, total: sales + deaths };
}

// Key Poultry Production & Financial Metrics
function calc(c) {
  if (!c) return {};
  const flocks = c.flocks || [];
  const chickCount = flocks.reduce((s, x) => s + (+x.count || 0), 0);
  const chickCost = flocks.reduce((s, x) => s + (+x.cost || 0), 0);
  const otherExp = sum(c.exp, 'amt');
  const e = chickCost + otherExp;          // إجمالي تكلفة الدورة
  const n = chickCount || (+c.n || 0);     // إجمالي الكتاكيت

  // 1. Sales & Revenue Metrics (الفصل بين قيمة البيع والمبلغ المحصل نقداً)
  const incList = c.inc || [];
  const totalSales = incList.reduce((s, x) => s + (+x.amt || +x.totalAmt || 0), 0);
  const collectedCash = incList.reduce((s, x) => s + (x.paidAmt !== undefined ? +x.paidAmt : (+x.amt || 0)), 0);
  const uncollectedSales = Math.max(0, totalSales - collectedCash);
  const i = totalSales; // إجمالي الإيراد الاستحقاقي
  const p = i - e; // صافي الربح المحسوب على إجمالي المبيعات
  const cashProfit = collectedCash - e; // صافي السيولة النقدية المحصلة فعلياً

  // 2. Flock Status (القطيع والنفوق والمتبقي)
  const dead = sum(c.dead, 'n');
  const sold = sum(c.inc, 'cnt');
  const kgS = sum(c.inc, 'kg');
  const live = Math.max(0, n - dead);
  const remaining = Math.max(0, live - sold);

  // 3. Per-type metrics (costs are allocated by chick count)
  const flockStats = flocks.map(flock => {
    const count = +flock.count || 0;
    const cost = +flock.cost || 0;
    const sales = incList.filter(x => x.flockId === flock.id);
    const soldCnt = sales.reduce((s, x) => s + (+x.cnt || 0), 0);
    const revenue = sales.reduce((s, x) => s + (+x.amt || 0), 0);
    const deadCnt = (c.dead || []).filter(x => x.flockId === flock.id).reduce((s, x) => s + (+x.n || 0), 0);
    const sharedCost = n > 0 ? otherExp * (count / n) : 0;
    const totalCost = cost + sharedCost;

    return {
      id: flock.id,
      name: flock.name,
      count,
      cost,
      sold: soldCnt,
      dead: deadCnt,
      remaining: Math.max(0, count - soldCnt - deadCnt),
      revenue,
      avgPrice: soldCnt ? revenue / soldCnt : 0,
      sharedCost,
      totalCost,
      profit: revenue - totalCost,
      mort: count ? (deadCnt / count) * 100 : 0,
      share: n ? (count / n) * 100 : 0
    };
  });

  // 4. Feed Metrics (إجمالي العلف المشترى للدورة)
  const feedPurchasedKg = (c.feed || []).reduce((s, x) => s + (+x.kg || 0), 0);

  // 5. Debt Metrics (تفصيل الديون واتجاهاتها: لنا عند الغير وعلينا للغير)
  const debtList = c.debt || [];
  let debtUsTotal = 0;
  let debtUsRemaining = 0;
  let debtThemTotal = 0;
  let debtThemRemaining = 0;

  debtList.forEach(d => {
    const isUs = d.dir === 'لنا' || d.dir === 'ليا عنده';
    const amt = +d.amt || 0;
    const paidAmt = d.paidAmt !== undefined ? +d.paidAmt : (d.paid ? amt : 0);
    const rem = Math.max(0, amt - paidAmt);

    if (isUs) {
      debtUsTotal += amt;
      debtUsRemaining += rem;
    } else {
      debtThemTotal += amt;
      debtThemRemaining += rem;
    }
  });

  return {
    e,
    chickCost,
    otherExp,
    chickCount: n,
    i,
    totalSales,
    collectedCash,
    uncollectedSales,
    p,
    cashProfit,
    dead,
    sold,
    kgS,
    feedPurchasedKg,
    live,
    remaining,
    flockStats,
    debtUsTotal,
    debtUsRemaining,
    debtThemTotal,
    debtThemRemaining,
    mort: n ? (dead / n) * 100 : 0,
    cpb: live > 0 ? e / live : 0,
    avg: sold ? i / sold : 0,
    ppb: sold ? p / sold : 0
  };
}

// Generate animated bar chart elements
function bars(items, fmt) {
  const m = Math.max(1, ...items.map(x => Math.abs(x.v)));
  return items.map(x => `
    <div class="chart-row">
      <div class="chart-header">
        <span>${x.n}</span>
        <span class="num ${x.cls || ''}">${fmt(x)}</span>
      </div>
      <div class="bar-track">
        <div class="bar-segment" style="width: ${Math.max(2, (Math.abs(x.v) / m) * 100)}%; background: ${x.c};"></div>
      </div>
    </div>
  `).join('');
}

// Profit vs Loss comparison chart
function profitChart() {
  return bars(
    C.map(c => {
      const p = calc(c).p;
      return {
        n: c.name,
        v: p,
        c: p >= 0 ? 'var(--emerald)' : 'var(--rose)',
        cls: p >= 0 ? 'color-emerald' : 'color-rose',
        t: (p >= 0 ? 'ربح ' : 'خسارة ') + f(Math.abs(p)) + ' ج'
      };
    }),
    x => x.t
  );
}
