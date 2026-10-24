/**
 * Refaey Farm Tracker - Calculations & Formatting Engine
 */

// Formats number with commas: 10000 -> 10,000
const f = n => Math.round(n || 0).toLocaleString('en-US');

// Formats date into readable Arabic date
const fd = d => {
  if (!d) return '';
  return new Date(d + 'T00:00').toLocaleDateString('ar-EG-u-nu-latn', {
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
  const i = sum(c.inc, 'amt');
  const dead = sum(c.dead, 'n');
  const sold = sum(c.inc, 'cnt');
  const kgS = sum(c.inc, 'kg');
  const fk = sum(c.feed, 'kg');
  const p = i - e;
  const live = Math.max(0, (c.n || 0) - dead);
  const remaining = Math.max(0, live - sold);

  return {
    e,
    i,
    p,
    dead,
    sold,
    kgS,
    fk,
    live,
    remaining,
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
