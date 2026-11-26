/**
 * Refaey Farm Tracker - Calculations & Formatting Engine
 */

// Formats number with commas: 10000 -> 10,000
const f = n => Math.round(n || 0).toLocaleString('en-US');

// Formats date into readable Arabic date (ensures Egypt Africa/Cairo timezone)
const fd = d => {
  if (!d) return '';
  const parts = String(d).split('-');
  const dateObj = parts.length === 3
    ? new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2], 12, 0, 0))
    : new Date(d);
  return dateObj.toLocaleDateString('ar-EG-u-nu-latn', {
    timeZone: 'Africa/Cairo',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

// Short mobile-friendly Arabic date (e.g. "12 أكتوبر")
const fds = d => {
  if (!d) return '';
  const parts = String(d).split('-');
  const dateObj = parts.length === 3
    ? new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2], 12, 0, 0))
    : new Date(d);
  return dateObj.toLocaleDateString('ar-EG-u-nu-latn', {
    timeZone: 'Africa/Cairo',
    day: 'numeric',
    month: 'short'
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

  // 1. Sales & Revenue Metrics
  const incList = c.inc || [];
  const totalSales = incList.reduce((s, x) => s + (+x.amt || +x.totalAmt || 0), 0);
  const i = totalSales; // إجمالي الإيرادات
  const p = i - e; // صافي الربح

  // 2. Flock Status (القطيع والنفوق والمتبقي)
  const dead = sum(c.dead, 'n');
  const sold = sum(c.inc, 'cnt');
  const live = Math.max(0, n - dead);
  const remaining = Math.max(0, live - sold);

  // 3. Per-type metrics: each expense is split across the LIVE eligible birds at that expense's seq
  const deadList = c.dead || [];
  const expList = c.exp || [];
  const sharedCostByFlock = {};
  flocks.forEach(fl => { sharedCostByFlock[fl.id] = 0; });

  expList.forEach(expItem => {
    const expAmt = +expItem.amt || 0;
    if (expAmt === 0 || flocks.length === 0) return;

    const eSeq = +expItem.seq || 0;
    const liveWeights = {};
    const batchWeights = {};
    let totalLiveWeight = 0;
    let totalBatchWeight = 0;

    flocks.forEach(fl => {
      const batches = Array.isArray(fl.batches) && fl.batches.length > 0
        ? fl.batches
        : [{ count: +fl.count || 0, seq: 0, includeOld: true }];

      let eligibleAdded = 0;
      batches.forEach(b => {
        const bSeq = +b.seq || 0;
        if (b.includeOld !== false || !eSeq || eSeq >= bSeq) {
          eligibleAdded += +b.count || 0;
        }
      });

      const soldBefore = eSeq
        ? incList.filter(x => x.flockId === fl.id && (+x.seq || 0) < eSeq).reduce((s, x) => s + (+x.cnt || 0), 0)
        : 0;
      const deadBefore = eSeq
        ? deadList.filter(x => x.flockId === fl.id && (+x.seq || 0) < eSeq).reduce((s, x) => s + (+x.n || 0), 0)
        : 0;

      const liveAtExp = Math.max(0, eligibleAdded - soldBefore - deadBefore);
      liveWeights[fl.id] = liveAtExp;
      batchWeights[fl.id] = eligibleAdded;
      totalLiveWeight += liveAtExp;
      totalBatchWeight += eligibleAdded;
    });

    if (totalLiveWeight > 0) {
      flocks.forEach(fl => {
        sharedCostByFlock[fl.id] += expAmt * (liveWeights[fl.id] / totalLiveWeight);
      });
    } else if (totalBatchWeight > 0) {
      flocks.forEach(fl => {
        sharedCostByFlock[fl.id] += expAmt * (batchWeights[fl.id] / totalBatchWeight);
      });
    } else if (n > 0) {
      flocks.forEach(fl => {
        sharedCostByFlock[fl.id] += expAmt * ((+fl.count || 0) / n);
      });
    } else {
      flocks.forEach(fl => {
        sharedCostByFlock[fl.id] += expAmt / flocks.length;
      });
    }
  });

  const flockStats = flocks.map(flock => {
    const count = +flock.count || 0;
    const cost = +flock.cost || 0;
    const sales = incList.filter(x => x.flockId === flock.id);
    const soldCnt = sales.reduce((s, x) => s + (+x.cnt || 0), 0);
    const revenue = sales.reduce((s, x) => s + (+x.amt || 0), 0);
    const deadCnt = deadList.filter(x => x.flockId === flock.id).reduce((s, x) => s + (+x.n || 0), 0);
    const sharedCost = sharedCostByFlock[flock.id] || 0;
    const totalCost = cost + sharedCost;

    return {
      id: flock.id,
      name: flock.name,
      count,
      cost,
      batches: flock.batches || [],
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
    p,
    dead,
    sold,
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
        <span>${esc(x.n)}</span>
        <span class="num ${x.cls || ''}">${esc(fmt(x))}</span>
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
