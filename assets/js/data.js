'use strict';

// ── Enchant Calculator — Game Data ────────────────────────────────────────────

const CITIES      = ['Pront','Izlude','Morroc','Alberta','Payon','Geffen','Glast Heim'];
const NON_PRONT   = ['Izlude','Morroc','Alberta','Payon','Geffen','Glast Heim'];
const EQUIP_TYPES = ['Dagger','Off Hand','1 Hand','2 Hand','Armor','Accessory'];
const WEAPON_TYPES = new Set(['Dagger','Off Hand','1 Hand','2 Hand']);

// EXP ratios relative to the 2H Weapon baseline (1.0).
// 2H / Armor / Accessory share the same EXP table.
// Verified at lv1→2 Prontera: 2H=300 Musp, Armor=300, Acc=300, 1H=200, Dagger=150, OffHand=100.
const ENCHANT_RATIOS = {
  '2 Hand':    1,      // baseline
  '1 Hand':    2/3,    // 66.7%
  'Dagger':    1/2,    // 50%
  'Off Hand':  1/3,    // 33.3%
  'Armor':     1,      // same table as 2H
  'Accessory': 1,      // same table as 2H
};

// Material units consumed per EXP point, per city.
// Prontera uses Muspellium (raw material); all other cities use Crafted Enchant Stones.
const STONES_PER_EXP = {
  'Pront':      30,
  'Izlude':      2,
  'Morroc':      1,
  'Alberta':     0.5,
  'Payon':       0.25,
  'Geffen':      0.125,
  'Glast Heim':  0.0625,
};

// Incremental EXP required per enchant level (2H / Armor / Accessory baseline).
const LVL_EXP = {
   2:10,  3:30,  4:60,  5:100, 6:150,  7:250,  8:400,
   9:600, 10:850,11:1150,12:1550,13:2050,14:2800,
  15:3800,16:5050,17:6550,18:8300,19:10300,20:12550,
};

const MAT_LABEL = c => c === 'Pront' ? 'Muspellium' : 'stones';

// Default market prices — community-tracked values (Apr 9, 2026).
// pront     = Muspellium price (◆ each)
// cities[c] = { weapon, armor, accessory } stone prices (◆ each)
const DEFAULTS = {
  pront: 88,
  cities: {
    'Izlude':     { weapon:1400,  armor:1440,  accessory:1440  },
    'Morroc':     { weapon:2740,  armor:2740,  accessory:2740  },
    'Alberta':    { weapon:5480,  armor:5650,  accessory:5650  },
    'Payon':      { weapon:20200, armor:21800, accessory:21800 },
    'Geffen':     { weapon:47000, armor:47000, accessory:47000 },
    'Glast Heim': { weapon:null,  armor:null,  accessory:null  },
  },
};
