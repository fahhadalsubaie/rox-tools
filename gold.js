'use strict';

// ── Conversion ────────────────────────────────────────────────────────────────
// Selling a gold item on the EC pays out in Diamonds, which convert to Crystals.
// Rate: 1 Diamond = 10 Crystals (confirmed: 50,000 ◆ → 500,000 ✦).
const DIAMOND_TO_CRYSTAL = 10;

// ── Tax Brackets ──────────────────────────────────────────────────────────────
// Progressive/marginal EC market tax (amounts in Diamonds ◆).
const TAX_BRACKETS = [
  { floor:      0, ceil:   50000, rate: 0.10, label: '0 – 50,000'          },
  { floor:  50000, ceil:  100000, rate: 0.20, label: '50,001 – 100,000'    },
  { floor: 100000, ceil:  200000, rate: 0.30, label: '100,001 – 200,000'   },
  { floor: 200000, ceil: Infinity, rate: 0.40, label: 'Above 200,000'      },
];

function calcTax(gross) {
  if (!gross || gross <= 0) return 0;
  let tax = 0;
  for (const { floor, ceil, rate } of TAX_BRACKETS) {
    if (gross <= floor) break;
    tax += (Math.min(gross, ceil) - floor) * rate;
  }
  return Math.round(tax);
}

function getTaxTiers(gross) {
  const tiers = [];
  for (const { floor, ceil, rate, label } of TAX_BRACKETS) {
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

// ── Helpers ───────────────────────────────────────────────────────────────────
// grossDiamonds  — value in ◆ used to compute bracket slices
// totalTax       — pre-calculated total tax in display currency
// multiplier     — converts each bracket's ◆ tax into display currency (1 for ✦ dismantle, DIAMOND_TO_CRYSTAL for ✦ direct sale)
function taxBreakdownHTML(grossDiamonds, totalTax, panelVisible, toggleFn, currency = '◆', multiplier = 1) {
  const btn = `<button class="tax-toggle" onclick="${toggleFn}()">${panelVisible ? '▲ Hide' : '▼ Show'} tax breakdown</button>`;
  if (!panelVisible) return btn;

  const tiers = getTaxTiers(grossDiamonds);
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

// ── Render ────────────────────────────────────────────────────────────────────
function calculate() {
  const directPrice  = parseFloat(document.getElementById('directPrice').value)  || 0;
  const dismantleAmt = parseFloat(document.getElementById('dismantleAmt').value) || 0;
  const coinPrice    = parseFloat(document.getElementById('coinPrice').value)     || 0;
  const coinType     = document.getElementById('coinType').value;

  const dismantleGross = dismantleAmt * coinPrice;

  // Direct sale: tax brackets are applied on the Diamond value,
  // then the tax and gross are both converted to Crystals for display.
  const directGrossCrystals = directPrice * DIAMOND_TO_CRYSTAL;          // 50k ◆ → 500k ✦
  const directTaxDiamonds   = calcTax(directPrice);                       // e.g. 5,000 ◆
  const directTax           = directTaxDiamonds * DIAMOND_TO_CRYSTAL;     // → 50,000 ✦
  const directNetCrystals   = directGrossCrystals - directTax;            // → 450,000 ✦

  // Dismantle: coins sell directly for Crystals, tax applied on crystal value
  const dismantleTax         = calcTax(dismantleGross);
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
      ${taxBreakdownHTML(directPrice, directTax, showTaxDirect, 'toggleTaxDirect', '✦', DIAMOND_TO_CRYSTAL)}
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
      <div class="rc-title">🔨 Dismantle &amp; Sell ${winBadge}</div>
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
      ${taxBreakdownHTML(dismantleGross, dismantleTax, showTaxDismantle, 'toggleTaxDismantle', '✦')}
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

// ── Bootstrap ─────────────────────────────────────────────────────────────────
loadTheme();

document.getElementById('directPrice').addEventListener('input',  calculate);
document.getElementById('coinType').addEventListener('change',    calculate);
document.getElementById('dismantleAmt').addEventListener('input', calculate);
document.getElementById('coinPrice').addEventListener('input',    calculate);
