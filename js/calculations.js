/**
 * Refaey Farm Tracker - Calculations & Formatting Engine
 */

// Formats number with commas: 10000 -> 10,000
const f = n => Math.round(n || 0).toLocaleString('en-US');

// Formats per-bird unit price with up to 2 decimal places (20 -> 20, 19.50 -> 19.5)
const fp = n => (+(n || 0).toFixed(2)).toLocaleString('en-US', { maximumFractionDigits: 2 });

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

// Integer UTC day number from YYYY-MM-DD (avoids DST/timezone drift)
const toDayNum = d => {
  if (!d) return null;
  const parts = String(d).split('-');
  if (parts.length === 3 && !isNaN(+parts[0]) && !isNaN(+parts[1]) && !isNaN(+parts[2])) {
    return Math.floor(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]) / 86400000);
  }
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return Math.floor(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()) / 86400000);
};

// Safe array property summation
const sum = (arr, key) => (arr || []).reduce((s, x) => s + (+x[key] || 0), 0);

// Estimate feed consumed between stocktakes using opening stock + purchases - closing stock.
// The stock is valued at a moving weighted-average price; this is an estimate, not a scale reading.
function calculateFeedInventory(c) {
  const checks = Array.isArray(c.feedStocktakes) ? c.feedStocktakes.slice() : [];
  const purchases = (c.feed || []).filter(x => x.type === 'purchased');
  if (!checks.length) return { enabled: false, periods: [], consumedKg: 0, consumedCost: 0, pendingPurchaseIds: [], pendingPurchaseCost: 0, stockKg: 0, stockValue: 0, hasShortage: false };

  checks.sort((a, b) => String(a.d || '').localeCompare(String(b.d || '')) || (+a.seq || 0) - (+b.seq || 0));
  const expForPurchase = purchase => (c.exp || []).find(e => e.id === purchase.expRefId || e.feedRefId === purchase.id);
  const included = new Set();
  let stockKg = Math.max(0, +checks[0].openingKg || 0);
  let stockValue = Math.max(0, +checks[0].openingValue || 0);
  let previousDate = c.start || checks[0].d;
  let consumedKg = 0;
  let consumedCost = 0;
  let hasShortage = false;
  const periods = [];

  checks.forEach((check, idx) => {
    const arriving = purchases.filter(p => {
      if (included.has(p.id)) return false;
      const purchaseDate = String(p.d || c.start || '');
      const checkDate = String(check.d || '');
      const purchaseSeq = +p.seq || +((expForPurchase(p) || {}).seq) || 0;
      return purchaseDate < checkDate || (purchaseDate === checkDate && (!check.seq || !purchaseSeq || purchaseSeq <= (+check.seq || 0)));
    });
    arriving.forEach(p => included.add(p.id));
    const purchasedKg = arriving.reduce((s, p) => s + (+p.kg || 0), 0);
    const purchasedValue = arriving.reduce((s, p) => s + (+((expForPurchase(p) || {}).amt) || 0), 0);
    const availableKg = stockKg + purchasedKg;
    const availableValue = stockValue + purchasedValue;
    const avgCostPerKg = availableKg > 0 ? availableValue / availableKg : 0;
    const requestedEndKg = Math.max(0, +check.kg || 0);
    const shortage = requestedEndKg > availableKg + 0.01;
    if (shortage) hasShortage = true;
    // Do not let an impossible snapshot create phantom inventory/value for later periods.
    const endKg = Math.min(requestedEndKg, availableKg);
    const usedKg = shortage ? 0 : Math.max(0, availableKg - endKg);
    const usedCost = usedKg * avgCostPerKg;
    const endValue = endKg * avgCostPerKg;
    periods.push({
      id: check.id,
      from: previousDate,
      to: check.d || previousDate,
      kg: usedKg,
      cost: usedCost,
      endKg,
      endValue,
      shortage,
      checkIndex: idx
    });
    consumedKg += usedKg;
    consumedCost += usedCost;
    stockKg = endKg;
    stockValue = endValue;
    previousDate = check.d || previousDate;
  });

  // Purchases after the last stocktake remain inventory until the next count.
  const uncountedPurchases = purchases.filter(p => !included.has(p.id));
  let pendingPurchaseCost = 0;
  let pendingPurchaseKg = 0;
  if (uncountedPurchases.length) {
    const pendingKg = uncountedPurchases.reduce((s, p) => s + (+p.kg || 0), 0);
    const pendingValue = uncountedPurchases.reduce((s, p) => s + (+((expForPurchase(p) || {}).amt) || 0), 0);
    pendingPurchaseCost = pendingValue;
    pendingPurchaseKg = pendingKg;
    const totalKg = stockKg + pendingKg;
    const weightedValue = stockValue + pendingValue;
    stockKg = totalKg;
    stockValue = weightedValue;
  }

  return {
    enabled: true,
    periods,
    consumedKg,
    consumedCost,
    pendingPurchaseIds: uncountedPurchases.map(p => p.id),
    pendingPurchaseCost,
    pendingPurchaseKg,
    stockKg,
    stockValue,
    hasShortage
  };
}

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
  const feedInventory = calculateFeedInventory(c);
  const linkedFeedExpIds = new Set((c.feed || []).map(p => {
    const e = (c.exp || []).find(x => x.id === p.expRefId || x.feedRefId === p.id);
    return e && e.id;
  }).filter(Boolean));
  const pendingPurchaseIds = new Set(feedInventory.pendingPurchaseIds || []);
  const pendingFeedExpIds = new Set((c.feed || [])
    .filter(p => pendingPurchaseIds.has(p.id))
    .map(p => (c.exp || []).find(x => x.id === p.expRefId || x.feedRefId === p.id))
    .filter(Boolean)
    .map(e => e.id));
  const rawOtherExp = sum(c.exp, 'amt');
  const otherExp = feedInventory.enabled
    ? rawOtherExp - (c.exp || []).filter(e => e.cat === 'علف' && linkedFeedExpIds.has(e.id)).reduce((s, e) => s + (+e.amt || 0), 0) + feedInventory.consumedCost + feedInventory.pendingPurchaseCost
    : rawOtherExp;
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

  // 3. Per-type metrics: Bird-Days allocation across the cycle timeline
  const deadList = c.dead || [];
  const expList = c.exp || [];
  const sharedCostByFlock = {};
  const sharedByCatByFlock = {};
  const expByCat = {};
  const feedSoldCostByFlock = {};
  const feedRemainingCostByFlock = {};
  const pendingFeedSoldCostByFlock = {};
  const pendingFeedRemainingCostByFlock = {};
  flocks.forEach(fl => {
    sharedCostByFlock[fl.id] = 0;
    sharedByCatByFlock[fl.id] = {};
    pendingFeedSoldCostByFlock[fl.id] = 0;
    pendingFeedRemainingCostByFlock[fl.id] = 0;
  });

  const addFlockExpShare = (flockId, cat, shareAmt) => {
    sharedCostByFlock[flockId] += shareAmt;
    sharedByCatByFlock[flockId][cat] = (sharedByCatByFlock[flockId][cat] || 0) + shareAmt;
  };

  // Determine exact integer day bounds [cycleStartDay .. cycleEndDay]
  const todayDay = toDayNum(typeof today === 'function' ? today() : null) ?? toDayNum(new Date().toISOString().slice(0, 10));
  const candidateDays = [];
  const pushDay = d => {
    const dn = toDayNum(d);
    if (dn !== null) candidateDays.push(dn);
  };
  pushDay(c.start);
  flocks.forEach(fl => (fl.batches || []).forEach(b => pushDay(b.d)));
  expList.forEach(x => pushDay(x.d));
  incList.forEach(x => pushDay(x.d));
  deadList.forEach(x => pushDay(x.d));

  const cycleStartDay = candidateDays.length ? Math.min(...candidateDays) : todayDay;
  let cycleEndDay;
  if (c.end) {
    cycleEndDay = Math.max(cycleStartDay, toDayNum(c.end) ?? todayDay);
  } else if (remaining > 0) {
    cycleEndDay = Math.max(cycleStartDay, todayDay, ...(candidateDays.length ? candidateDays : [todayDay]));
  } else {
    // All birds exited (sold or dead): end timeline at last activity day
    cycleEndDay = Math.max(cycleStartDay, ...(candidateDays.length ? candidateDays : [todayDay]));
  }
  if (cycleEndDay - cycleStartDay > 730) {
    cycleEndDay = cycleStartDay + 730;
  }

  // Helper: whether an exit event (sale or mortality) has already removed the bird on day `d`
  // Option 1: stop counting from sale/death day onward (unless evaluating an expense recorded earlier on the same day)
  const isExitedOnDay = (ev, d, eDay, eSeq) => {
    const evDay = toDayNum(ev.d || c.start) ?? cycleStartDay;
    const evSeq = +ev.seq || 0;
    if (evDay < d) return true;
    if (evDay > d) return false;
    if (eDay !== null && d === eDay && eSeq > 0 && evSeq > 0) {
      return evSeq < eSeq;
    }
    return true;
  };

  // Precompute per-flock Bird-Days over the whole cycle (used as late-expense fallback & for sold vs remaining cost split)
  const cycleBirdDaysByFlock = {};
  const soldBirdDaysByFlock = {};
  const remainingBirdDaysByFlock = {};

  flocks.forEach(fl => {
    const batches = Array.isArray(fl.batches) && fl.batches.length > 0
      ? fl.batches
      : [{ count: +fl.count || 0, d: c.start, seq: 0, includeOld: true }];
    const flSales = incList.filter(x => x.flockId === fl.id);
    const flDeads = deadList.filter(x => x.flockId === fl.id);

    let totalBD = 0;
    let exitedBDForSales = 0;
    let remainingBD = 0;

    for (let d = cycleStartDay; d <= cycleEndDay; d++) {
      let added = 0;
      batches.forEach(b => {
        const bDay = toDayNum(b.d || c.start) ?? cycleStartDay;
        if (bDay <= d) added += +b.count || 0;
      });
      let soldOut = 0;
      flSales.forEach(x => { if (isExitedOnDay(x, d, null, 0)) soldOut += +x.cnt || 0; });
      let deadOut = 0;
      flDeads.forEach(x => { if (isExitedOnDay(x, d, null, 0)) deadOut += +x.n || 0; });

      const liveOnDay = Math.max(0, added - soldOut - deadOut);
      totalBD += liveOnDay;
    }

    // Exact bird-days for surviving birds (sold vs remaining) for partial-sale unit cost split
    const flCount = +fl.count || 0;
    const flSold = flSales.reduce((s, x) => s + (+x.cnt || 0), 0);
    const flDead = flDeads.reduce((s, x) => s + (+x.n || 0), 0);
    const flRem = Math.max(0, flCount - flSold - flDead);

    // Each sold event's birds lived from average batch arrival (or batch-by-batch FIFO) until sale day (min 1 day)
    const arrivalWeightedSum = batches.reduce((s, b) => s + (+b.count || 0) * (toDayNum(b.d || c.start) ?? cycleStartDay), 0);
    const avgStartDay = flCount > 0 ? Math.round(arrivalWeightedSum / flCount) : cycleStartDay;

    flSales.forEach(x => {
      const sDay = toDayNum(x.d || c.start) ?? cycleStartDay;
      const daysLived = Math.max(1, sDay - avgStartDay);
      exitedBDForSales += (+x.cnt || 0) * daysLived;
    });
    if (flRem > 0) {
      const remDays = Math.max(1, (cycleEndDay - avgStartDay) + 1);
      remainingBD = flRem * remDays;
    }

    cycleBirdDaysByFlock[fl.id] = totalBD;
    soldBirdDaysByFlock[fl.id] = exitedBDForSales;
    remainingBirdDaysByFlock[fl.id] = remainingBD;
  });

  const cycleTotalBirdDays = Object.values(cycleBirdDaysByFlock).reduce((s, v) => s + v, 0);

  // Distribute each expense across flocks using Bird-Days from expense date to cycleEndDay
  expList.forEach(expItem => {
    // In stocktake mode, linked feed purchases are charged only as stock is consumed below.
    const isPendingFeedPurchase = feedInventory.enabled
      && expItem.cat === 'علف'
      && linkedFeedExpIds.has(expItem.id)
      && pendingFeedExpIds.has(expItem.id);
    if (feedInventory.enabled && expItem.cat === 'علف' && linkedFeedExpIds.has(expItem.id) && !isPendingFeedPurchase) return;
    const expAmt = +expItem.amt || 0;
    const cat = expItem.cat || 'مصاريف أخرى';
    if (expAmt !== 0) {
      expByCat[cat] = (expByCat[cat] || 0) + expAmt;
    }
    if (expAmt === 0 || flocks.length === 0) return;

    const eSeq = +expItem.seq || 0;
    const rawEDay = toDayNum(expItem.d || c.start) ?? cycleStartDay;
    const eDay = Math.max(cycleStartDay, Math.min(cycleEndDay, rawEDay));

    const expBirdDays = {};
    const eligibleBatchWeights = {};
    let totalExpBirdDays = 0;
    let totalEligibleBatchWeight = 0;

    flocks.forEach(fl => {
      const batches = Array.isArray(fl.batches) && fl.batches.length > 0
        ? fl.batches
        : [{ count: +fl.count || 0, d: c.start, seq: 0, includeOld: true }];
      const flSales = incList.filter(x => x.flockId === fl.id);
      const flDeads = deadList.filter(x => x.flockId === fl.id);

      const eligibleBatches = batches.filter(b => {
        const bSeq = +b.seq || 0;
        return b.includeOld !== false || !eSeq || eSeq >= bSeq;
      });
      const eligibleSum = eligibleBatches.reduce((s, b) => s + (+b.count || 0), 0);
      eligibleBatchWeights[fl.id] = eligibleSum;
      totalEligibleBatchWeight += eligibleSum;

      let flBirdDays = 0;
      for (let d = eDay; d <= cycleEndDay; d++) {
        let added = 0;
        eligibleBatches.forEach(b => {
          const bDay = toDayNum(b.d || c.start) ?? cycleStartDay;
          if (bDay <= d) added += +b.count || 0;
        });

        let soldBefore = 0;
        flSales.forEach(x => { if (isExitedOnDay(x, d, eDay, eSeq)) soldBefore += +x.cnt || 0; });
        let deadBefore = 0;
        flDeads.forEach(x => { if (isExitedOnDay(x, d, eDay, eSeq)) deadBefore += +x.n || 0; });

        flBirdDays += Math.max(0, added - soldBefore - deadBefore);
      }

      expBirdDays[fl.id] = flBirdDays;
      totalExpBirdDays += flBirdDays;
    });

    if (totalExpBirdDays > 0) {
      flocks.forEach(fl => {
        const flockShare = expAmt * (expBirdDays[fl.id] / totalExpBirdDays);
        addFlockExpShare(fl.id, cat, flockShare);
        if (isPendingFeedPurchase) {
          const batches = Array.isArray(fl.batches) && fl.batches.length
            ? fl.batches
            : [{ count: +fl.count || 0, d: c.start, seq: 0 }];
          const flCount = +fl.count || 0;
          const arrivalWeightedSum = batches.reduce((s, b) => s + (+b.count || 0) * (toDayNum(b.d || c.start) ?? cycleStartDay), 0);
          const avgStartDay = flCount > 0 ? Math.round(arrivalWeightedSum / flCount) : cycleStartDay;
          const sales = incList.filter(x => x.flockId === fl.id);
          const soldBirdDays = sales.reduce((s, sale) => {
            const saleDay = toDayNum(sale.d || c.start) ?? cycleStartDay;
            if (saleDay < eDay) return s;
            const liveFrom = Math.max(eDay, avgStartDay);
            const saleAfterExpenseSameDay = saleDay === eDay && +sale.seq > 0 && eSeq > 0 && +sale.seq > eSeq;
            const liveTo = Math.min(cycleEndDay, saleDay - (saleAfterExpenseSameDay ? 0 : 1));
            return s + (+sale.cnt || 0) * Math.max(0, liveTo - liveFrom + 1);
          }, 0);
          const deadCount = deadList.filter(x => x.flockId === fl.id).reduce((s, death) => s + (+death.n || 0), 0);
          const soldCount = sales.reduce((s, sale) => s + (+sale.cnt || 0), 0);
          const remainingCount = Math.max(0, flCount - soldCount - deadCount);
          const remainingBirdDays = remainingCount * Math.max(0, cycleEndDay - Math.max(eDay, avgStartDay) + 1);
          const survivorBirdDays = soldBirdDays + remainingBirdDays;
          if (survivorBirdDays > 0) {
            const soldShare = flockShare * (soldBirdDays / survivorBirdDays);
            pendingFeedSoldCostByFlock[fl.id] += soldShare;
            pendingFeedRemainingCostByFlock[fl.id] += flockShare - soldShare;
          } else if (remainingCount > 0) {
            pendingFeedRemainingCostByFlock[fl.id] += flockShare;
          } else if (soldCount > 0) {
            pendingFeedSoldCostByFlock[fl.id] += flockShare;
          }
        }
      });
    } else if (cycleTotalBirdDays > 0) {
      // Late expense after all birds exited: distribute over total cycle bird-days of eligible flocks
      const eligibleCycleBD = {};
      let sumEligibleCycleBD = 0;
      flocks.forEach(fl => {
        const w = eligibleBatchWeights[fl.id] > 0 ? cycleBirdDaysByFlock[fl.id] : 0;
        eligibleCycleBD[fl.id] = w;
        sumEligibleCycleBD += w;
      });
      if (sumEligibleCycleBD > 0) {
        flocks.forEach(fl => {
          const flockShare = expAmt * (eligibleCycleBD[fl.id] / sumEligibleCycleBD);
          addFlockExpShare(fl.id, cat, flockShare);
          if (isPendingFeedPurchase) {
            const sales = incList.filter(x => x.flockId === fl.id);
            const soldCount = sales.reduce((s, sale) => s + (+sale.cnt || 0), 0);
            const deadCount = deadList.filter(x => x.flockId === fl.id).reduce((s, death) => s + (+death.n || 0), 0);
            const remainingCount = Math.max(0, (+fl.count || 0) - soldCount - deadCount);
            const soldShare = soldCount + remainingCount > 0 ? flockShare * soldCount / (soldCount + remainingCount) : flockShare;
            pendingFeedSoldCostByFlock[fl.id] += soldShare;
            pendingFeedRemainingCostByFlock[fl.id] += flockShare - soldShare;
          }
        });
      } else {
        flocks.forEach(fl => {
          const flockShare = expAmt * (cycleBirdDaysByFlock[fl.id] / cycleTotalBirdDays);
          addFlockExpShare(fl.id, cat, flockShare);
          if (isPendingFeedPurchase) {
            const sales = incList.filter(x => x.flockId === fl.id);
            const soldCount = sales.reduce((s, sale) => s + (+sale.cnt || 0), 0);
            const deadCount = deadList.filter(x => x.flockId === fl.id).reduce((s, death) => s + (+death.n || 0), 0);
            const remainingCount = Math.max(0, (+fl.count || 0) - soldCount - deadCount);
            const soldShare = soldCount + remainingCount > 0 ? flockShare * soldCount / (soldCount + remainingCount) : flockShare;
            pendingFeedSoldCostByFlock[fl.id] += soldShare;
            pendingFeedRemainingCostByFlock[fl.id] += flockShare - soldShare;
          }
        });
      }
    } else if (totalEligibleBatchWeight > 0) {
      flocks.forEach(fl => {
        addFlockExpShare(fl.id, cat, expAmt * (eligibleBatchWeights[fl.id] / totalEligibleBatchWeight));
      });
    } else if (n > 0) {
      flocks.forEach(fl => {
        addFlockExpShare(fl.id, cat, expAmt * ((+fl.count || 0) / n));
      });
    } else {
      flocks.forEach(fl => {
        addFlockExpShare(fl.id, cat, expAmt / flocks.length);
      });
    }
  });

  // Allocate consumed feed cost only across bird-days in the period covered by each stocktake.
  if (feedInventory.enabled) {
    feedInventory.periods.forEach(period => {
      if (period.cost <= 0) return;
      expByCat['علف'] = (expByCat['علف'] || 0) + period.cost;
      const fromDay = toDayNum(period.from) ?? cycleStartDay;
      const toDay = toDayNum(period.to) ?? fromDay;
      const startDay = Math.max(cycleStartDay, fromDay + (period.checkIndex > 0 ? 1 : 0));
      const endDay = Math.min(cycleEndDay, Math.max(startDay, toDay));
      const weights = {};
      let totalBirdDays = 0;
      flocks.forEach(fl => {
        const batches = Array.isArray(fl.batches) && fl.batches.length
          ? fl.batches
          : [{ count: +fl.count || 0, d: c.start, seq: 0 }];
        const sales = incList.filter(x => x.flockId === fl.id);
        const deaths = deadList.filter(x => x.flockId === fl.id);
        let bd = 0;
        for (let d = startDay; d <= endDay; d++) {
          const added = batches.reduce((s, b) => s + ((toDayNum(b.d || c.start) ?? cycleStartDay) <= d ? (+b.count || 0) : 0), 0);
          const soldOut = sales.reduce((s, x) => s + (isExitedOnDay(x, d, null, 0) ? (+x.cnt || 0) : 0), 0);
          const deadOut = deaths.reduce((s, x) => s + (isExitedOnDay(x, d, null, 0) ? (+x.n || 0) : 0), 0);
          bd += Math.max(0, added - soldOut - deadOut);
        }
        weights[fl.id] = bd;
        totalBirdDays += bd;
      });
      if (totalBirdDays > 0) {
        flocks.forEach(fl => {
          const flockFeedCost = period.cost * (weights[fl.id] / totalBirdDays);
          addFlockExpShare(fl.id, 'علف', flockFeedCost);

          const batches = Array.isArray(fl.batches) && fl.batches.length
            ? fl.batches
            : [{ count: +fl.count || 0, d: c.start }];
          const flCount = +fl.count || 0;
          const arrivalWeightedSum = batches.reduce((s, b) => s + (+b.count || 0) * (toDayNum(b.d || c.start) ?? cycleStartDay), 0);
          const avgStartDay = flCount > 0 ? Math.round(arrivalWeightedSum / flCount) : cycleStartDay;
          const flSales = incList.filter(x => x.flockId === fl.id);
          const flDead = deadList.filter(x => x.flockId === fl.id).reduce((s, x) => s + (+x.n || 0), 0);
          const remCnt = Math.max(0, flCount - flDead - flSales.reduce((s, x) => s + (+x.cnt || 0), 0));
          let soldBD = 0;
          flSales.forEach(sale => {
            const saleDay = toDayNum(sale.d || c.start) ?? cycleStartDay;
            const liveFrom = Math.max(startDay, avgStartDay);
            const liveTo = Math.min(endDay, saleDay - 1);
            soldBD += (+sale.cnt || 0) * Math.max(0, liveTo - liveFrom + 1);
          });
          const remainFrom = Math.max(startDay, avgStartDay);
          const remainingBD = remCnt * Math.max(0, endDay - remainFrom + 1);
          const survivorBD = soldBD + remainingBD;
          if (survivorBD > 0) {
            const soldShare = flockFeedCost * (soldBD / survivorBD);
            feedSoldCostByFlock[fl.id] = (feedSoldCostByFlock[fl.id] || 0) + soldShare;
            feedRemainingCostByFlock[fl.id] = (feedRemainingCostByFlock[fl.id] || 0) + (flockFeedCost - soldShare);
          } else if (flSales.length && remCnt === 0) {
            feedSoldCostByFlock[fl.id] = (feedSoldCostByFlock[fl.id] || 0) + flockFeedCost;
          } else if (flSales.length && remCnt > 0) {
            const soldShare = flockFeedCost * (flSales.reduce((s, x) => s + (+x.cnt || 0), 0) / (flSales.reduce((s, x) => s + (+x.cnt || 0), 0) + remCnt));
            feedSoldCostByFlock[fl.id] = (feedSoldCostByFlock[fl.id] || 0) + soldShare;
            feedRemainingCostByFlock[fl.id] = (feedRemainingCostByFlock[fl.id] || 0) + (flockFeedCost - soldShare);
          } else {
            feedRemainingCostByFlock[fl.id] = (feedRemainingCostByFlock[fl.id] || 0) + flockFeedCost;
          }
        });
      } else if (flocks.length) {
        // Keep cycle and flock totals reconciled for a late/invalid consumption period
        // after all birds exited; the allocation is historical and therefore approximate.
        const fallbackTotal = cycleTotalBirdDays || n || flocks.length;
        flocks.forEach(fl => {
          const weight = cycleTotalBirdDays
            ? (cycleBirdDaysByFlock[fl.id] || 0)
            : (n ? (+fl.count || 0) : 1);
          const flockFeedCost = period.cost * (weight / fallbackTotal);
          addFlockExpShare(fl.id, 'علف', flockFeedCost);
          const sales = incList.filter(x => x.flockId === fl.id);
          const soldCount = sales.reduce((s, x) => s + (+x.cnt || 0), 0);
          const deadCount = deadList.filter(x => x.flockId === fl.id).reduce((s, x) => s + (+x.n || 0), 0);
          const remainingCount = Math.max(0, (+fl.count || 0) - soldCount - deadCount);
          if (soldCount > 0 && remainingCount === 0) {
            feedSoldCostByFlock[fl.id] = (feedSoldCostByFlock[fl.id] || 0) + flockFeedCost;
          } else if (soldCount > 0 && remainingCount > 0) {
            const soldShare = flockFeedCost * soldCount / (soldCount + remainingCount);
            feedSoldCostByFlock[fl.id] = (feedSoldCostByFlock[fl.id] || 0) + soldShare;
            feedRemainingCostByFlock[fl.id] = (feedRemainingCostByFlock[fl.id] || 0) + flockFeedCost - soldShare;
          } else {
            feedRemainingCostByFlock[fl.id] = (feedRemainingCostByFlock[fl.id] || 0) + flockFeedCost;
          }
        });
      }
    });
  }

  const flockStats = flocks.map(flock => {
    const count = +flock.count || 0;
    const cost = +flock.cost || 0;
    const sales = incList.filter(x => x.flockId === flock.id);
    const soldCnt = sales.reduce((s, x) => s + (+x.cnt || 0), 0);
    const revenue = sales.reduce((s, x) => s + (+x.amt || 0), 0);
    const deadCnt = deadList.filter(x => x.flockId === flock.id).reduce((s, x) => s + (+x.n || 0), 0);
    const liveCnt = Math.max(0, count - deadCnt);
    const remCnt = Math.max(0, count - soldCnt - deadCnt);
    const sharedCost = sharedCostByFlock[flock.id] || 0;
    const sharedByCat = sharedByCatByFlock[flock.id] || {};
    const feedCost = sharedByCat['علف'] || 0;
    const otherOpsCost = sharedCost - feedCost;
    const totalCost = cost + sharedCost;

    const buyPerChick = count > 0 ? cost / count : 0;
    const buyPerLive = liveCnt > 0 ? cost / liveCnt : 0;
    const feedPerLive = liveCnt > 0 ? feedCost / liveCnt : 0;
    const otherOpsPerLive = liveCnt > 0 ? otherOpsCost / liveCnt : 0;
    const opsPerLive = liveCnt > 0 ? sharedCost / liveCnt : 0;
    const costPerLive = liveCnt > 0 ? totalCost / liveCnt : 0;

    // Partial-sale cost split: sold birds vs remaining birds weighted by their lived days
    const sBD = soldBirdDaysByFlock[flock.id] || 0;
    const rBD = remainingBirdDaysByFlock[flock.id] || 0;
    const totSurvBD = sBD + rBD;

    let soldCostPerBird = costPerLive;
    let soldFeedPerBird = feedPerLive;
    let soldOtherOpsPerBird = otherOpsPerLive;
    let remainingCostPerBird = costPerLive;
    let remainingFeedPerBird = feedPerLive;
    let remainingOtherOpsPerBird = otherOpsPerLive;

    if (soldCnt > 0 && remCnt > 0 && totSurvBD > 0) {
      const soldRatio = sBD / totSurvBD;
      const remRatio = rBD / totSurvBD;
      soldFeedPerBird = (feedCost * soldRatio) / soldCnt;
      soldOtherOpsPerBird = (otherOpsCost * soldRatio) / soldCnt;
      soldCostPerBird = buyPerLive + (sharedCost * soldRatio) / soldCnt;

      remainingFeedPerBird = (feedCost * remRatio) / remCnt;
      remainingOtherOpsPerBird = (otherOpsCost * remRatio) / remCnt;
      remainingCostPerBird = buyPerLive + (sharedCost * remRatio) / remCnt;
    }

    if (feedInventory.enabled) {
      soldFeedPerBird = soldCnt > 0
        ? ((feedSoldCostByFlock[flock.id] || 0) + (pendingFeedSoldCostByFlock[flock.id] || 0)) / soldCnt
        : 0;
      remainingFeedPerBird = remCnt > 0
        ? ((feedRemainingCostByFlock[flock.id] || 0) + (pendingFeedRemainingCostByFlock[flock.id] || 0)) / remCnt
        : 0;
      if (soldCnt > 0 && remCnt > 0) {
        soldCostPerBird = buyPerLive + soldFeedPerBird + soldOtherOpsPerBird;
        remainingCostPerBird = buyPerLive + remainingFeedPerBird + remainingOtherOpsPerBird;
      }
    }

    return {
      id: flock.id,
      name: flock.name,
      count,
      cost,
      batches: flock.batches || [],
      sold: soldCnt,
      dead: deadCnt,
      live: liveCnt,
      remaining: remCnt,
      revenue,
      avgPrice: soldCnt ? revenue / soldCnt : 0,
      sharedCost,
      sharedByCat,
      feedCost,
      otherOpsCost,
      totalCost,
      buyPerChick,
      buyPerLive,
      feedPerLive,
      otherOpsPerLive,
      opsPerLive,
      costPerLive,
      soldCostPerBird,
      soldFeedPerBird,
      soldOtherOpsPerBird,
      remainingCostPerBird,
      remainingFeedPerBird,
      remainingOtherOpsPerBird,
      birdDays: cycleBirdDaysByFlock[flock.id] || 0,
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

  const feedCostTotal = expByCat['علف'] || 0;
  const otherOpsCostTotal = otherExp - feedCostTotal;
  const buyPerChick = n > 0 ? chickCost / n : 0;
  const buyPerLive = live > 0 ? chickCost / live : 0;
  const feedPerLive = live > 0 ? feedCostTotal / live : 0;
  const otherOpsPerLive = live > 0 ? otherOpsCostTotal / live : 0;
  const opsPerLive = live > 0 ? otherExp / live : 0;

  return {
    e,
    chickCost,
    otherExp,
    expByCat,
    feedCostTotal,
    otherOpsCostTotal,
    chickCount: n,
    i,
    totalSales,
    p,
    dead,
    sold,
    feedPurchasedKg,
    feedInventory,
    live,
    remaining,
    flockStats,
    debtUsTotal,
    debtUsRemaining,
    debtThemTotal,
    debtThemRemaining,
    mort: n ? (dead / n) * 100 : 0,
    buyPerChick,
    buyPerLive,
    feedPerLive,
    otherOpsPerLive,
    opsPerLive,
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
