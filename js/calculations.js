/**
 * Refaey Farm Tracker - Calculations & Formatting Engine
 */

// Formats number with commas: 10000 -> 10,000
const f = n => Math.round(n || 0).toLocaleString('en-US');

// Formats date into readable Arabic date (ensures local midnight parsing)
const fd = d => {
  if (!d) return '';
  const parts = String(d).split('-');
  if (parts.length === 3) {
    const dateObj = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    return dateObj.toLocaleDateString('ar-EG-u-nu-latn', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
  return new Date(d).toLocaleDateString('ar-EG-u-nu-latn', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

// Safe array property summation
const sum = (arr, key) => (arr || []).reduce((s, x) => s + (+x[key] || 0), 0);

// Key Poultry Production & Financial Metrics
function calc(c) {
  if (!c) return {};
  const e = sum(c.exp, 'amt');

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
  const live = Math.max(0, (c.n || 0) - dead);
  const remaining = Math.max(0, live - sold);

  // 3. Feed Metrics (الفصل بين العلف المشترى والمستهلك والمتبقي بالمخزن)
  const feedList = c.feed || [];
  const hasPurchased = feedList.some(x => x.type === 'purchased');
  const hasConsumed = feedList.some(x => x.type === 'consumed');

  let feedConsumedKg = 0;
  let feedPurchasedKg = 0;

  if (hasPurchased || hasConsumed) {
    feedConsumedKg = feedList.filter(x => x.type === 'consumed').reduce((s, x) => s + (+x.kg || 0), 0);
    feedPurchasedKg = feedList.filter(x => x.type === 'purchased').reduce((s, x) => s + (+x.kg || 0), 0);
  } else {
    // للتوافق مع البيانات القديمة التي لم تحدد نوع الحركة
    feedConsumedKg = sum(feedList, 'kg');
    feedPurchasedKg = feedConsumedKg;
  }

  const feedStockKg = Math.max(0, feedPurchasedKg - feedConsumedKg);
  // معامل التحويل يُحسب على العلف المستهلك الفعلي للطيور
  const fk = feedConsumedKg || (feedPurchasedKg && !hasConsumed ? feedPurchasedKg : 0);

  // 4. Debt Metrics (تفصيل الديون واتجاهاتها: لنا عند الغير وعلينا للغير)
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
    i,
    totalSales,
    collectedCash,
    uncollectedSales,
    p,
    cashProfit,
    dead,
    sold,
    kgS,
    fk,
    feedConsumedKg,
    feedPurchasedKg,
    feedStockKg,
    live,
    remaining,
    debtUsTotal,
    debtUsRemaining,
    debtThemTotal,
    debtThemRemaining,
    mort: c.n ? (dead / c.n) * 100 : 0,
    cpb: live > 0 ? e / live : 0,
    avg: sold ? i / sold : 0,
    ppb: sold ? p / sold : 0,
    fcr: kgS ? fk / kgS : 0
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
