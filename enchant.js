'use strict';

// ── State ─────────────────────────────────────────────────────────────────────
let PRICES    = JSON.parse(JSON.stringify(DEFAULTS));
let equip     = 'Off Hand';
let category  = 'Weapon';
let tableMode = 'crystal';
let showQty   = false;
let showRef   = false;

// ── Persistence ───────────────────────────────────────────────────────────────
function savePrices() {
  try { localStorage.setItem('rox-prices2', JSON.stringify(PRICES)); } catch(_) {}
  const pill = document.getElementById('savedPill');
  pill.classList.add('show');
  clearTimeout(pill._t);
  pill._t = setTimeout(() => pill.classList.remove('show'), 1800);
}

function loadPrices() {
  try {
    const raw = localStorage.getItem('rox-prices2');
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s.pront != null) PRICES.pront = s.pront;
    NON_PRONT.forEach(city => {
      if (s.cities?.[city]) {
        ['weapon', 'armor', 'accessory'].forEach(t => {
          if (s.cities[city][t] !== undefined) PRICES.cities[city][t] = s.cities[city][t];
        });
      }
    });
  } catch(_) {}
}

// ── Calculation ───────────────────────────────────────────────────────────────

// Total materials to accumulate reqExp at a given city.
// Formula: EXP_needed × type_ratio × stones_per_exp
function getMat(city, eq, reqExp) {
  return reqExp * STONES_PER_EXP[city];
}

function getPrice(city, eq) {
  if (city === 'Pront') return PRICES.pront;
  const key = WEAPON_TYPES.has(eq) ? 'weapon' : eq.toLowerCase();
  return PRICES.cities[city]?.[key] ?? null;
}

function getCost(city, eq, reqExp) {
  const p = getPrice(city, eq);
  return p != null ? getMat(city, eq, reqExp) * p : null;
}

function optimalMix(levels) {
  const perLvl  = [];
  const counts  = Object.fromEntries(CITIES.map(c => [c, 0]));
  let total     = 0;
  let incomplete = false;

  for (const lvl of levels) {
    const exp = LVL_EXP[lvl];
    let best = null, bestCost = Infinity;
    CITIES.forEach(c => {
      const cost = getCost(c, equip, exp);
      if (cost != null && cost < bestCost) { bestCost = cost; best = c; }
    });
    if (!best) {
      incomplete = true;
      perLvl.push({ lvl, city: null, cost: null });
    } else {
      counts[best] += getMat(best, equip, exp);
      total        += bestCost;
      perLvl.push({ lvl, city: best, cost: bestCost });
    }
  }
  return { total: incomplete ? null : total, perLvl, counts };
}

// ── Formatting ────────────────────────────────────────────────────────────────
const fmtC = n =>
  n == null ? '<span class="cell-na">—</span>' : Math.ceil(n).toLocaleString();

const fmtM = n => {
  if (n == null) return '<span class="cell-na">—</span>';
  if (n < 1)    return n.toPrecision(4).replace(/\.?0+$/, '');
  if (n % 1)    return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return n.toLocaleString();
};

const fmtMP = n => {
  if (n < 1) return n.toPrecision(4).replace(/\.?0+$/, '');
  if (n % 1) return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return n.toLocaleString();
};

// ── Price Table ───────────────────────────────────────────────────────────────
function initPriceTable() {
  const tbl = document.getElementById('pricesTable');

  const hdr = document.createElement('thead');
  hdr.innerHTML = `<tr>
    <th>Material</th>
    <th>Prontera<br><span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:.65rem">(Muspellium)</span></th>
    ${NON_PRONT.map(c => `<th>${c}</th>`).join('')}
  </tr>`;
  tbl.appendChild(hdr);

  const tbody = document.createElement('tbody');

  // Muspellium row (Prontera only)
  const trMus = document.createElement('tr');
  trMus.innerHTML = `<td>Muspellium</td>`;
  const tdMus = document.createElement('td');
  tdMus.appendChild(mkInput(PRICES.pront, v => { PRICES.pront = v; savePrices(); calculate(); }));
  trMus.appendChild(tdMus);
  NON_PRONT.forEach(() => {
    const td  = document.createElement('td');
    const inp = document.createElement('input');
    inp.className = 'price-input'; inp.disabled = true; inp.placeholder = '—';
    td.appendChild(inp); trMus.appendChild(td);
  });
  tbody.appendChild(trMus);

  // Weapon / Armor / Accessory stone rows
  [['Weapon Stone', 'weapon'], ['Armor Stone', 'armor'], ['Accessory Stone', 'accessory']].forEach(([label, key]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${label}</td>`;

    const tdP = document.createElement('td');
    const inP = document.createElement('input');
    inP.className = 'price-input'; inP.disabled = true; inP.placeholder = '—';
    tdP.appendChild(inP); tr.appendChild(tdP);

    NON_PRONT.forEach(city => {
      const td = document.createElement('td');
      td.appendChild(mkInput(PRICES.cities[city][key], v => {
        PRICES.cities[city][key] = v; savePrices(); calculate();
      }));
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  tbl.appendChild(tbody);
}

function mkInput(defaultVal, onChange) {
  const inp = document.createElement('input');
  inp.type = 'number'; inp.className = 'price-input'; inp.min = 0; inp.step = 1;
  if (defaultVal != null) inp.value = defaultVal; else inp.placeholder = '—';
  inp.addEventListener('input', () => {
    const n = parseFloat(inp.value);
    onChange(inp.value === '' || isNaN(n) ? null : n);
  });
  return inp;
}

// ── Level Selectors ───────────────────────────────────────────────────────────
function initLevels() {
  const from = document.getElementById('fromLevel');
  const to   = document.getElementById('toLevel');
  for (let i = 1; i <= 19; i++) from.appendChild(new Option(`Level ${i}`, i));
  from.value = 1;
  for (let i = 2; i <= 20; i++) to.appendChild(new Option(`Level ${i}`, i));
  to.value = 20;
}

// ── Controls ──────────────────────────────────────────────────────────────────
function setCategory(btn) {
  category = btn.dataset.category;
  document.querySelectorAll('#categoryBtns .btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const sub = document.getElementById('weaponSubSelector');
  if (category === 'Weapon') {
    sub.style.display = '';
    equip = document.querySelector('#weaponTypeBtns .btn.active').dataset.equip;
  } else {
    sub.style.display = 'none';
    equip = category;
  }
  calculate();
}

function setWeaponType(btn) {
  equip = btn.dataset.equip;
  document.querySelectorAll('#weaponTypeBtns .btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  calculate();
}

function setMode(mode) {
  tableMode = mode;
  document.getElementById('tabCrystal').classList.toggle('active', mode === 'crystal');
  document.getElementById('tabMat').classList.toggle('active', mode === 'mat');
  calculate();
}

function onLevelChange() {
  const f = +document.getElementById('fromLevel').value;
  const t = +document.getElementById('toLevel').value;
  if (t <= f) document.getElementById('toLevel').value = Math.min(f + 1, 20);
  calculate();
}

function toggleRef() {
  showRef = !showRef;
  document.getElementById('refPanel').style.display = showRef ? 'block' : 'none';
  document.querySelector('.ref-toggle').textContent =
    (showRef ? '▲ Hide' : '▼ Show') + ' attempts per enchant (reference)';
}

function toggleQty() { showQty = !showQty; calculate(); }

// ── Render ────────────────────────────────────────────────────────────────────
function calculate() {
  const from = +document.getElementById('fromLevel').value;
  const to   = +document.getElementById('toLevel').value;

  if (from >= to) {
    document.getElementById('resultsContent').innerHTML =
      '<p class="warn">⚠ Target level must be higher than current level.</p>';
    return;
  }

  const levels   = [];
  for (let l = from + 1; l <= to; l++) levels.push(l);
  const totalEXP = levels.reduce((s, l) => s + LVL_EXP[l], 0);

  // Per-city totals
  const totals = {};
  CITIES.forEach(city => {
    let mat = 0;
    levels.forEach(l => { mat += getMat(city, equip, LVL_EXP[l]); });
    const p = getPrice(city, equip);
    totals[city] = { mat, cost: p != null ? mat * p : null };
  });

  // Cheapest single city
  let bestCity = null, bestCost = Infinity;
  CITIES.forEach(c => {
    if (totals[c].cost != null && totals[c].cost < bestCost) {
      bestCost = totals[c].cost; bestCity = c;
    }
  });

  const mix = optimalMix(levels);

  // Range label
  const categoryLabel = category === 'Weapon'
    ? `Weapon <span class="range-equip-detail">(enchanting with ${equip})</span>`
    : equip;
  const rangeHTML = `<div class="range-label">
    <strong>${categoryLabel}</strong><span class="range-sep">|</span>
    Level <strong>${from}</strong> → Level <strong>${to}</strong>
    <span class="range-sep">|</span>${levels.length} level${levels.length > 1 ? 's' : ''}
    <span class="range-sep">|</span>${totalEXP.toLocaleString()} total EXP
  </div>`;

  // Optimal mix card
  let mixHTML = '';
  if (mix.total != null) {
    const used = CITIES.filter(c => mix.counts[c] > 0);
    mixHTML = `<div class="mix-card">
      <div class="mix-main">
        <div class="mix-badge">⚡ Optimal Mix</div>
        <div class="mix-label">Cheapest city per level</div>
        <div class="mix-cost">${Math.ceil(mix.total).toLocaleString()}</div>
        <div class="mix-sub">crystals total</div>
      </div>
      <div class="mix-chips">${used.map(c => `
        <div class="mix-chip">
          <div class="chip-name">${c}</div>
          <div class="chip-count">${fmtMP(mix.counts[c])}<span class="chip-unit">${MAT_LABEL(c)}</span></div>
        </div>`).join('')}
      </div>
    </div>`;
  }

  // City summary cards
  let cardsHTML = `<div class="summary-grid">`;
  CITIES.forEach(c => {
    const t = totals[c], best = c === bestCity;
    cardsHTML += `<div class="summary-card ${best ? 'cheapest' : ''} ${t.cost == null ? 'no-price' : ''}">
      ${best ? '<div class="badge">Cheapest</div>' : ''}
      <div class="s-city">${c}</div>
      <div class="s-cost ${best ? 'green' : ''}">${t.cost != null ? Math.ceil(t.cost).toLocaleString() : '—'}</div>
      <div class="s-sub">${fmtMP(t.mat)} ${MAT_LABEL(c)}</div>
    </div>`;
  });
  cardsHTML += `</div>`;

  // Breakdown table
  const isCrystal = tableMode === 'crystal';
  let tbl = `<div class="table-wrap"><table class="breakdown"><thead><tr>
    <th>Level</th><th>EXP</th>
    ${isCrystal ? '<th class="th-mix">Best Mix</th>' : ''}
    ${CITIES.map(c => `<th>${c}${c === 'Pront' ? '<br><span style="font-weight:400;letter-spacing:0;text-transform:none;font-size:.6rem">Muspel</span>' : ''}</th>`).join('')}
  </tr></thead><tbody>`;

  levels.forEach((lvl, i) => {
    const exp = LVL_EXP[lvl];
    tbl += `<tr><td>${lvl - 1} → ${lvl}</td><td>${exp.toLocaleString()}</td>`;
    if (isCrystal) {
      const m = mix.perLvl[i];
      tbl += m?.cost != null
        ? `<td class="cell-best">${Math.ceil(m.cost).toLocaleString()}<span class="mix-tag">${m.city}</span></td>`
        : `<td>${fmtC(null)}</td>`;
    }
    CITIES.forEach(c => {
      const best = c === bestCity;
      tbl += isCrystal
        ? `<td class="${best ? 'cell-best' : ''}">${fmtC(getCost(c, equip, exp))}</td>`
        : `<td class="${best ? 'cell-best' : ''}">${fmtM(getMat(c, equip, exp))}</td>`;
    });
    tbl += `</tr>`;
  });

  tbl += `</tbody><tfoot><tr><td>Total</td><td>${totalEXP.toLocaleString()}</td>`;
  if (isCrystal) {
    tbl += mix.total != null
      ? `<td class="td-mix">${Math.ceil(mix.total).toLocaleString()}</td>`
      : `<td>${fmtC(null)}</td>`;
  }
  CITIES.forEach(c => {
    const t = totals[c], best = c === bestCity;
    tbl += isCrystal
      ? `<td class="${best ? 'cell-best' : ''}">${fmtC(t.cost)}</td>`
      : `<td class="${best ? 'cell-best' : ''}">${fmtM(t.mat)}</td>`;
  });
  tbl += `</tr></tfoot></table></div>`;

  // Material quantities panel (crystal mode only)
  let qtyHTML = '';
  if (isCrystal) {
    const inner = showQty ? `
      ${mix.total != null ? `
        <div class="stones-lbl">Optimal Mix — materials to buy</div>
        <div class="stones-grid">${CITIES.filter(c => mix.counts[c] > 0).map(c => `
          <div class="stone-qty hl">
            <div class="sq-name">${c}</div>
            <div class="sq-mat">${MAT_LABEL(c)}</div>
            <div class="sq-qty green">${fmtMP(mix.counts[c])}</div>
          </div>`).join('')}</div>` : ''}
      <div class="stones-lbl">All cities — total materials</div>
      <div class="stones-grid">${CITIES.map(c => `
        <div class="stone-qty ${c === bestCity ? 'hl' : ''}">
          <div class="sq-name">${c}</div>
          <div class="sq-mat">${MAT_LABEL(c)}</div>
          <div class="sq-qty ${c === bestCity ? 'green' : ''}">${fmtMP(totals[c].mat)}</div>
        </div>`).join('')}</div>` : '';
    qtyHTML = `<div class="stones-panel">
      <button class="stones-toggle" onclick="toggleQty()">${showQty ? '▲ Hide' : '▼ Show'} material quantities</button>
      ${inner}</div>`;
  }

  document.getElementById('resultsContent').innerHTML =
    rangeHTML + mixHTML + cardsHTML + tbl + qtyHTML;
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
loadPrices();
loadTheme();
initPriceTable();
initLevels();
calculate();
