'use strict';

// ── Config ────────────────────────────────────────────────────────────────────
const SERVER_TZ = 'Europe/Berlin';
const LOCAL_TZ  = Intl.DateTimeFormat().resolvedOptions().timeZone;

// ── Alert Sound ───────────────────────────────────────────────────────────────
const ALERT = new Audio('assets/sounds/ultra.mp3');
ALERT.volume = 0.8;

function playAlert() {
  ALERT.currentTime = 0;
  ALERT.play().catch(() => {
    // Autoplay blocked (no prior user interaction) — visual notification still shows
  });
}

function previewSound() {
  const btn = document.querySelector('.alert-preview-btn');

  if (!ALERT.paused) {
    // Currently playing — stop it
    ALERT.pause();
    ALERT.currentTime = 0;
    if (btn) btn.textContent = '▶ Preview Sound';
    return;
  }

  // Start playing
  ALERT.currentTime = 0;
  ALERT.play().catch(() => {});

  if (btn) btn.textContent = '■ Stop';

  // Reset label when the track ends naturally
  ALERT.onended = () => {
    if (btn) btn.textContent = '▶ Preview Sound';
  };
}

// ── Event Definitions ─────────────────────────────────────────────────────────
// days: 0=Sun … 6=Sat, null = every day
const EVENTS = [
  {
    id: 'gvg',
    name: 'Guild War',
    tag:  'GVG',
    icon: '⚔️',
    schedule: 'Every Saturday',
    days: [6],
    startH: 21, startM: 0,
    durationMin: 60,
  },
  {
    id: 'arcade',
    name: 'Abyssal Arcade',
    tag:  '',
    icon: '🌀',
    schedule: 'Wed & Fri',
    days: [3, 5],
    startH: 20, startM: 0,
    durationMin: 60,
  },
  {
    id: 'kvm',
    name: 'KVM',
    tag:  '',
    icon: '🏟️',
    schedule: 'Every Day',
    days: null,
    startH: 20, startM: 30,
    durationMin: 60,
  },
];

// ── Timezone Math ─────────────────────────────────────────────────────────────

function pad(n) { return String(n).padStart(2, '0'); }

// Returns UTC offset in minutes where local = UTC + offset.
// Europe/Berlin winter → +60, summer (DST) → +120.
function tzOffsetMin(date, tz) {
  const p = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false,
  }).formatToParts(date).forEach(x => { if (x.type !== 'literal') p[x.type] = x.value; });

  let h = +p.hour;
  if (h === 24) h = 0;
  const wallAsUTC = Date.UTC(+p.year, +p.month - 1, +p.day, h, +p.minute, +p.second);
  return (wallAsUTC - date.getTime()) / 60000;
}

// Convert a server-TZ wall-clock time to a real UTC Date.
// Probes at noon of that calendar day to avoid DST ambiguity.
function serverWallToDate(year, month, day, hour, minute) {
  const noon   = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const offset = tzOffsetMin(noon, SERVER_TZ);      // e.g. +60 or +120
  const wallMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  return new Date(wallMs - offset * 60000);          // UTC = wall − offset
}

// Get date components (year, month, day, dow) as seen in SERVER_TZ.
function serverDateParts(date) {
  const p = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: SERVER_TZ,
    year: 'numeric', month: 'numeric', day: 'numeric',
    weekday: 'short', hour12: false,
  }).formatToParts(date).forEach(x => { if (x.type !== 'literal') p[x.type] = x.value; });

  const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { year: +p.year, month: +p.month, day: +p.day, dow: DOW[p.weekday] };
}

// Returns { start, end, live } for the next occurrence of ev, or null.
function nextOccurrence(ev, now) {
  for (let d = 0; d <= 7; d++) {
    const sp = serverDateParts(new Date(now.getTime() + d * 86400000));
    if (ev.days !== null && !ev.days.includes(sp.dow)) continue;

    const start = serverWallToDate(sp.year, sp.month, sp.day, ev.startH, ev.startM);
    const end   = new Date(start.getTime() + ev.durationMin * 60000);

    if (now < end) return { start, end, live: now >= start };
  }
  return null;
}

// ── Formatting ────────────────────────────────────────────────────────────────

const fmtHM   = (d, tz) => new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
const fmtHMS  = (d, tz) => new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).format(d);
const fmtDay  = (d, tz) => new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(d);
const fmtDate = (d, tz) => new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'short', day: 'numeric' }).format(d);

function fmtCountdown(ms) {
  if (ms <= 0) return '0s';
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000) % 24;
  const d = Math.floor(ms / 86400000);
  if (d > 0) return `${d}d ${h}h ${pad(m)}m`;
  if (h > 0) return `${h}h ${pad(m)}m`;
  return `${m}m ${pad(s)}s`;
}

// Always includes seconds — used for the Upcoming Event card
function fmtCountdownSec(ms) {
  if (ms <= 0) return '0s';
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000) % 24;
  const d = Math.floor(ms / 86400000);
  if (d > 0) return `${d}d ${h}h ${pad(m)}m ${pad(s)}s`;
  if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`;
  return `${m}m ${pad(s)}s`;
}

// ── Render ────────────────────────────────────────────────────────────────────
// Track previous live states to detect transitions and fire the alert.
const _prevLive = {};

function renderCards(now) {
  const container = document.getElementById('eventCards');
  if (!container) return;

  let html = '<div class="ev-grid">';

  for (const ev of EVENTS) {
    const occ = nextOccurrence(ev, now);
    if (!occ) continue;

    // Fire alert sound on live transition (false → true)
    if (occ.live && _prevLive[ev.id] === false) playAlert();
    _prevLive[ev.id] = occ.live;

    const sStart = fmtHM(occ.start, SERVER_TZ);
    const sEnd   = fmtHM(occ.end,   SERVER_TZ);
    const lStart = fmtHM(occ.start, LOCAL_TZ);
    const lEnd   = fmtHM(occ.end,   LOCAL_TZ);

    const sDay = fmtDay(occ.start, SERVER_TZ);
    const lDay = fmtDay(occ.start, LOCAL_TZ);
    const dayBadge = lDay !== sDay
      ? `<span class="ev-daynote">${lDay.slice(0, 3)}</span>`
      : '';

    const cdTarget = occ.live ? occ.end.getTime() : occ.start.getTime();
    const cdMs     = cdTarget - now.getTime();

    html += `
    <div class="ev-card${occ.live ? ' ev-live' : ''}">
      <div class="ev-header">
        <span class="ev-icon">${ev.icon}</span>
        <div class="ev-title">
          <span class="ev-name">${ev.name}</span>
          ${ev.tag ? `<span class="ev-tag">${ev.tag}</span>` : ''}
        </div>
        ${occ.live ? '<span class="live-pill"><span class="live-dot"></span>LIVE</span>' : ''}
      </div>
      <div class="ev-rows">
        <div class="ev-row">
          <span class="ev-key">Schedule</span>
          <span class="ev-val">${ev.schedule}</span>
        </div>
        <div class="ev-row">
          <span class="ev-key">Server Realm</span>
          <span class="ev-val mono">${sStart} – ${sEnd}</span>
        </div>
        <div class="ev-row">
          <span class="ev-key">Your Realm</span>
          <span class="ev-val mono">${lStart} – ${lEnd} ${dayBadge}</span>
        </div>
        <div class="ev-row">
          <span class="ev-key">${occ.live ? '⚔️ Battle Ends' : '⏳ Battle Begins'}</span>
          <span class="ev-val ev-countdown${occ.live ? ' ev-cd-live' : ''}" data-target="${cdTarget}">${fmtCountdown(cdMs)}</span>
        </div>
      </div>
    </div>`;
  }

  html += '</div>';
  container.innerHTML = html;
}

// ── Up Next ───────────────────────────────────────────────────────────────────
function renderUpNext(now) {
  const container = document.getElementById('upNextCard');
  if (!container) return;

  // Pick the soonest event that hasn't started yet
  const next = EVENTS
    .map(ev => {
      const occ = nextOccurrence(ev, now);
      return occ && !occ.live ? { ev, occ } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.occ.start - b.occ.start)[0];

  if (!next) {
    container.innerHTML = '<p class="empty">All events are currently active.</p>';
    return;
  }

  const { ev, occ } = next;
  const cdMs   = occ.start - now;
  const sStart = fmtHM(occ.start, SERVER_TZ);
  const sEnd   = fmtHM(occ.end,   SERVER_TZ);
  const lStart = fmtHM(occ.start, LOCAL_TZ);
  const lEnd   = fmtHM(occ.end,   LOCAL_TZ);
  const sDay   = fmtDay(occ.start, SERVER_TZ);
  const lDay   = fmtDay(occ.start, LOCAL_TZ);
  const dayBadge = lDay !== sDay
    ? `<span class="ev-daynote">${lDay.slice(0, 3)}</span>` : '';

  container.innerHTML = `
    <div class="upnext-inner">
      <div class="upnext-identity">
        <div class="upnext-icon">${ev.icon}</div>
        <div class="upnext-name">${ev.name}${ev.tag ? ` <span class="ev-tag">${ev.tag}</span>` : ''}</div>
        <div class="upnext-schedule">${ev.schedule}</div>
      </div>
      <span class="upnext-sep"></span>
      <div class="upnext-center">
        <div class="upnext-countdown" data-target="${occ.start.getTime()}">${fmtCountdownSec(cdMs)}</div>
        <div class="upnext-label">until ${ev.name} begins</div>
      </div>
      <span class="upnext-sep"></span>
      <div class="upnext-times">
        <div class="upnext-time-row">
          <span class="upnext-tz">Server</span>
          <span class="upnext-time mono">${sStart} – ${sEnd}</span>
        </div>
        <div class="upnext-time-row">
          <span class="upnext-tz">Your Realm</span>
          <span class="upnext-time mono">${lStart} – ${lEnd} ${dayBadge}</span>
        </div>
      </div>
    </div>`;
}

// ── Tick ──────────────────────────────────────────────────────────────────────
function tick() {
  const now = new Date();

  // Clocks
  const cs = document.getElementById('clockServer');
  const ds = document.getElementById('dateServer');
  const cl = document.getElementById('clockLocal');
  const dl = document.getElementById('dateLocal');
  if (cs) cs.textContent = fmtHMS(now, SERVER_TZ);
  if (ds) ds.textContent = fmtDate(now, SERVER_TZ);
  if (cl) cl.textContent = fmtHMS(now, LOCAL_TZ);
  if (dl) dl.textContent = fmtDate(now, LOCAL_TZ);

  // Detect live-state changes → full re-render (also fires alert sound)
  for (const ev of EVENTS) {
    const occ  = nextOccurrence(ev, now);
    const live = occ?.live ?? false;
    if (_prevLive[ev.id] !== live) {
      renderCards(now);
      renderUpNext(now);
      return;
    }
  }

  // Otherwise update countdowns in-place (no DOM rebuild)
  let needsRebuild = false;

  document.querySelectorAll('.ev-countdown[data-target]').forEach(el => {
    const ms = +el.dataset.target - now.getTime();
    if (ms <= 0) { needsRebuild = true; return; }
    el.textContent = fmtCountdown(ms);
  });

  const upNextEl = document.querySelector('.upnext-countdown[data-target]');
  if (upNextEl) {
    const ms = +upNextEl.dataset.target - now.getTime();
    if (ms <= 0) { needsRebuild = true; }
    else { upNextEl.textContent = fmtCountdownSec(ms); }
  }

  if (needsRebuild) { renderCards(now); renderUpNext(now); }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
loadTheme();

const tzLabel = document.getElementById('localTzLabel');
if (tzLabel) tzLabel.textContent = LOCAL_TZ.replace(/_/g, ' ');

// Seed _prevLive before first render so we don't fire spurious alerts on load
const _seedNow = new Date();
EVENTS.forEach(ev => {
  const occ = nextOccurrence(ev, _seedNow);
  _prevLive[ev.id] = occ?.live ?? false;
});

renderCards(_seedNow);
renderUpNext(_seedNow);
tick();
setInterval(tick, 1000);
