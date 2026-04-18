'use strict';

// ── Conversion ────────────────────────────────────────────────────────────────
// Selling a gold item on the EC pays out in Diamonds, which convert to Crystals.
// Rate: 1 Diamond = 10 Crystals (confirmed: 50,000 ◆ → 500,000 ✦).
const DIAMOND_TO_CRYSTAL = 10;

// ── Tax Brackets ──────────────────────────────────────────────────────────────

// Direct Sale brackets — applied on the Diamond (◆) listing price.
const DIRECT_BRACKETS = [
  { floor:      0, ceil:   50000, rate: 0.10, label: '0 – 50,000'          },
  { floor:  50000, ceil:  100000, rate: 0.20, label: '50,001 – 100,000'    },
  { floor: 100000, ceil:  200000, rate: 0.30, label: '100,001 – 200,000'   },
  { floor: 200000, ceil: Infinity, rate: 0.40, label: 'Above 200,000'      },
];

// Dismantle & Sell brackets — applied on the Crystal (✦) transaction total.
const DISMANTLE_BRACKETS = {
  standard: [
    { floor:       0, ceil:   500000, rate: 0.05, label: '0 – 500,000'            },
    { floor:  500000, ceil:  1500000, rate: 0.10, label: '500,001 – 1,500,000'    },
    { floor: 1500000, ceil:  2500000, rate: 0.15, label: '1,500,001 – 2,500,000'  },
    { floor: 2500000, ceil: Infinity, rate: 0.15, label: 'Above 2,500,000'        },
  ],
  vip: [
    { floor:       0, ceil:   500000, rate: 0.05, label: '0 – 500,000'            },
    { floor:  500000, ceil:  1500000, rate: 0.05, label: '500,001 – 1,500,000'    },
    { floor: 1500000, ceil:  2500000, rate: 0.10, label: '1,500,001 – 2,500,000'  },
    { floor: 2500000, ceil: Infinity, rate: 0.15, label: 'Above 2,500,000'        },
  ],
};

function calcTax(brackets, gross) {
  if (!gross || gross <= 0) return 0;
  let tax = 0;
  for (const { floor, ceil, rate } of brackets) {
    if (gross <= floor) break;
    tax += (Math.min(gross, ceil) - floor) * rate;
  }
  return Math.round(tax);
}

function getTaxTiers(brackets, gross) {
  const tiers = [];
  for (const { floor, ceil, rate, label } of brackets) {
    if (gross <= floor) break;
    const slice = Math.min(gross, ceil) - floor;
    tiers.push({ label, slice, rate, tax: Math.round(slice * rate) });
  }
  return tiers;
}

// ── Formatting ────────────────────────────────────────────────────────────────
const fmt    = n => Math.round(n).toLocaleString();
const fmtPct = r => `${(r * 100).toFixed(0)}%`;

// ── State ─────────────────────────────────────────────────────────────────────
let showTaxDirect    = false;
let showTaxDismantle = false;
let vipCard          = false;

// ── Helpers ───────────────────────────────────────────────────────────────────
// brackets   — which bracket table to slice against
// gross      — raw value in the bracket's currency
// totalTax   — pre-calculated total tax (in display currency)
// multiplier — scale each bracket slice's tax for display (e.g. ×10 for direct sale ◆→✦)
// currency   — symbol shown after amounts
function taxBreakdownHTML(brackets, gross, totalTax, panelVisible, toggleFn, currency = '✦', multiplier = 1) {
  const btn = `<button class="tax-toggle" onclick="${toggleFn}()">${panelVisible ? '▲ Hide' : '▼ Show'} tax breakdown</button>`;
  if (!panelVisible) return btn;

  const tiers = getTaxTiers(brackets, gross);
  const rows  = tiers.map(t =>
    `<div class="tb-row">
      <span class="tb-tier">${t.label} &times; ${fmtPct(t.rate)}</span>
      <span class="tb-amt">${fmt(t.tax * multiplier)} ${currency}</span>
    </div>`
  ).join('');

  return `${btn}
    <div class="tax-breakdown">
      <div class="tb-head">Tax Breakdown</div>
      ${rows}
      <div class="tb-row tb-total">
        <span>Total Tax</span><span class="tb-amt">${fmt(totalTax)} ${currency}</span>
      </div>
    </div>`;
}

// ── Input Helpers ─────────────────────────────────────────────────────────────
// Clamp numeric inputs to a safe positive range regardless of DOM manipulation.
const MAX_INPUT = 100_000_000;
function safeNum(id) {
  const v = parseFloat(document.getElementById(id).value);
  if (!isFinite(v) || v < 0) return 0;
  return Math.min(v, MAX_INPUT);
}

// ── Render ────────────────────────────────────────────────────────────────────
function calculate() {
  const directPrice  = safeNum('directPrice');
  const dismantleAmt = safeNum('dismantleAmt');
  const coinPrice    = safeNum('coinPrice');
  const coinType     = document.getElementById('coinType').value;

  const dismantleGross = dismantleAmt * coinPrice;

  // Direct sale: tax brackets applied on the Diamond (◆) value, then converted to ✦.
  const directGrossCrystals = directPrice * DIAMOND_TO_CRYSTAL;
  const directTaxDiamonds   = calcTax(DIRECT_BRACKETS, directPrice);
  const directTax           = directTaxDiamonds * DIAMOND_TO_CRYSTAL;
  const directNetCrystals   = directGrossCrystals - directTax;

  // Dismantle: coins sell natively in ✦; use the correct bracket set based on VIP status.
  const dismantleBrackets    = vipCard ? DISMANTLE_BRACKETS.vip : DISMANTLE_BRACKETS.standard;
  const dismantleTax         = calcTax(dismantleBrackets, dismantleGross);
  const dismantleNetCrystals = dismantleGross - dismantleTax;

  const out = document.getElementById('giResults');

  if (!directPrice && !dismantleGross) {
    out.innerHTML = '<p class="empty">Enter values above to see the comparison.</p>';
    return;
  }

  const bothEntered   = directPrice > 0 && dismantleGross > 0;
  const directWins    = bothEntered && directNetCrystals >= dismantleNetCrystals;
  const dismantleWins = bothEntered && dismantleNetCrystals > directNetCrystals;

  // ── Verdict ──
  let verdictHTML = '';
  if (bothEntered) {
    const diffCrystals = Math.abs(directNetCrystals - dismantleNetCrystals);
    if (directWins) {
      verdictHTML = `<div class="verdict win-direct">
        <div class="verdict-icon">💰</div>
        <div class="verdict-body">
          <div class="verdict-label">Recommendation</div>
          <div class="verdict-action">Sell Directly on the Exchange</div>
          <div class="verdict-diff">Nets <strong>${fmt(diffCrystals)} ✦ more</strong> than the dismantle path</div>
        </div>
      </div>`;
    } else if (dismantleWins) {
      verdictHTML = `<div class="verdict win-dismantle">
        <div class="verdict-icon">🔨</div>
        <div class="verdict-body">
          <div class="verdict-label">Recommendation</div>
          <div class="verdict-action">Dismantle &amp; Sell the Coins</div>
          <div class="verdict-diff">Nets <strong>${fmt(diffCrystals)} ✦ more</strong> than a direct listing</div>
        </div>
      </div>`;
    } else {
      verdictHTML = `<div class="verdict tie">
        <div class="verdict-icon">⚖️</div>
        <div class="verdict-body">
          <div class="verdict-label">Result</div>
          <div class="verdict-action">Both paths yield the same net return</div>
          <div class="verdict-diff">No advantage either way — choose freely</div>
        </div>
      </div>`;
    }
  }

  // ── Direct Sale Card ──
  let directCardHTML;
  if (directPrice > 0) {
    const winClass = directWins ? 'win-direct' : '';
    const winBadge = directWins ? '<span class="rc-win-badge gold-badge">Best Option</span>' : '';
    directCardHTML = `<div class="result-card ${winClass}">
      <div class="rc-title">💰 Direct Sale ${winBadge}</div>
      <div class="rc-row">
        <span class="rc-key">EC Listing Price</span>
        <span class="rc-val">${fmt(directPrice)} ◆</span>
      </div>
      <div class="rc-row">
        <span class="rc-key">Converted to Crystals <span style="font-weight:400;font-size:.68rem">(×10)</span></span>
        <span class="rc-val">${fmt(directGrossCrystals)} ✦</span>
      </div>
      <div class="rc-row">
        <span class="rc-key">Market Tax</span>
        <span class="rc-val deduct">− ${fmt(directTax)} ✦</span>
      </div>
      <div class="rc-row total-row">
        <span class="rc-key">Net Crystals</span>
        <span class="rc-val net-gold">${fmt(directNetCrystals)} ✦</span>
      </div>
      ${taxBreakdownHTML(DIRECT_BRACKETS, directPrice, directTax, showTaxDirect, 'toggleTaxDirect', '✦', DIAMOND_TO_CRYSTAL)}
    </div>`;
  } else {
    directCardHTML = `<div class="result-card">
      <div class="rc-title">💰 Direct Sale</div>
      <p class="empty" style="padding:.5rem 0">No EC listing price entered.</p>
    </div>`;
  }

  // ── Dismantle & Sell Card ──
  let dismantleCardHTML;
  if (dismantleGross > 0) {
    const winClass  = dismantleWins ? 'win-dismantle' : '';
    const winBadge  = dismantleWins ? '<span class="rc-win-badge">Best Option</span>' : '';
    dismantleCardHTML = `<div class="result-card ${winClass}">
      <div class="rc-title">🔨 Dismantle &amp; Sell ${winBadge}<span style="font-weight:400;font-size:.65rem;text-transform:none;letter-spacing:0;margin-left:auto;color:var(--muted)">${vipCard ? 'VIP Rate' : 'Standard Rate'}</span></div>
      <div class="rc-row">
        <span class="rc-key">Coins Received</span>
        <span class="rc-val">${fmt(dismantleAmt)} <span class="dim" style="font-size:.78rem;font-weight:400">${coinType}</span></span>
      </div>
      <div class="rc-row">
        <span class="rc-key">Coin Market Price</span>
        <span class="rc-val">${fmt(coinPrice)} ✦ each</span>
      </div>
      <div class="rc-row">
        <span class="rc-key">Gross Coin Value</span>
        <span class="rc-val">${fmt(dismantleGross)} ✦</span>
      </div>
      <div class="rc-row">
        <span class="rc-key">Market Tax</span>
        <span class="rc-val deduct">− ${fmt(dismantleTax)} ✦</span>
      </div>
      <div class="rc-row total-row">
        <span class="rc-key">Net Crystals</span>
        <span class="rc-val net-green">${fmt(dismantleNetCrystals)} ✦</span>
      </div>
      ${taxBreakdownHTML(dismantleBrackets, dismantleGross, dismantleTax, showTaxDismantle, 'toggleTaxDismantle', '✦')}
    </div>`;
  } else {
    dismantleCardHTML = `<div class="result-card">
      <div class="rc-title">🔨 Dismantle &amp; Sell</div>
      <p class="empty" style="padding:.5rem 0">No dismantle values entered.</p>
    </div>`;
  }

  out.innerHTML = verdictHTML + `<div class="result-row">${directCardHTML}${dismantleCardHTML}</div>`;
}

// ── Toggle Tax Panels ─────────────────────────────────────────────────────────
function toggleTaxDirect()    { showTaxDirect    = !showTaxDirect;    calculate(); }
function toggleTaxDismantle() { showTaxDismantle = !showTaxDismantle; calculate(); }

function setVip(on) {
  vipCard = on;
  document.getElementById('tabStandard').classList.toggle('active', !on);
  document.getElementById('tabVip').classList.toggle('active',  on);
  calculate();
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
loadTheme();

document.getElementById('directPrice').addEventListener('input',  calculate);
document.getElementById('coinType').addEventListener('change',    calculate);
document.getElementById('dismantleAmt').addEventListener('input', calculate);
document.getElementById('coinPrice').addEventListener('input',    calculate);
