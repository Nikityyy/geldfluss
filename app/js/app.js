// The running app: the current state, saving with undo, the route and the
// theme. Views and sheets read from `app` and change things only through
// `app.commit`, so every change is saved, can be undone and redraws the view.

import { monthOf, todayISO } from './dates.js';
import { save, persist } from './store.js';
import { toast } from './ui.js';

export const app = {
  state: null,
  today: todayISO(),
  route: { name: 'month', month: null },
  storage: 'indexeddb',
  persisted: null,
  installPrompt: null,
  render: () => {},
  saving: Promise.resolve(),
};

let firstSave = true;

/**
 * Replaces the state, saves it and redraws. With `undo`, the toast offers to
 * go back to the state before this change.
 */
export function commit(next, { message, undo = true, render = true, quiet = false } = {}) {
  const before = app.state;
  app.state = next;
  app.saving = app.saving.then(() => save(next)).then((where) => {
    app.storage = where;
    if (firstSave) {
      firstSave = false;
      persist().then((ok) => { app.persisted = ok; });
    }
  }).catch(() => {
    toast('Speichern hat nicht geklappt. Der Speicher des Browsers ist voll oder gesperrt.');
  });
  if (render) app.render({ animate: true });
  if (message && !quiet) {
    toast(message, undo ? { label: 'Rückgängig', run: () => commit(before, { message: 'Rückgängig gemacht.', undo: false }) } : null);
  }
  return next;
}

export function currentMonth() {
  return monthOf(app.today);
}

/** The month the person is looking at (on the month view), else this month. */
export function viewedMonth() {
  return app.route.month || currentMonth();
}

export function go(hash, { replace = false } = {}) {
  if (location.hash === hash) return app.render({ animate: false });
  if (replace) history.replaceState(history.state, '', hash);
  else history.pushState(null, '', hash);
  dispatchEvent(new HashChangeEvent('hashchange'));
}

export function category(id) {
  return app.state.categories.find((c) => c.id === id);
}

// ---------------------------------------------------------------------------
// Theme: system, light or dark. The browser chrome follows the ground colour.

export function applyTheme() {
  const t = app.state?.settings.theme || 'system';
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('geldfluss:theme', JSON.stringify(t)); } catch { /* blocked */ }
  const water = getComputedStyle(document.documentElement).getPropertyValue('--ground').trim() || '#F2F2F7';
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.remove();
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = water;
  document.head.append(meta);
}
