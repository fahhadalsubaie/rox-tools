'use strict';

// ── Theme ─────────────────────────────────────────────────────────────────────

function saveTheme(on) {
  try { localStorage.setItem('rox-theme', on ? 'light' : 'dark'); } catch(_) {}
}

function loadTheme() {
  try {
    if (localStorage.getItem('rox-theme') === 'light') applyLight(true, false);
  } catch(_) {}
}

function applyLight(on, save = true) {
  document.body.classList.toggle('light', on);
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = on ? '🌙 Dark' : '☀️ Light';
  if (save) saveTheme(on);
}

function toggleTheme() {
  applyLight(!document.body.classList.contains('light'));
}
