// Start-up: load the data, route, render, and keep the app current (another
// tab saved, the day changed, a new version arrived).

import { app, applyTheme, commit, go } from './app.js';
import { addMonths, isMonthKey, monthOf, todayISO, useAustrianMonths } from './dates.js';
import { resetFlow } from './flow.js';
import { load, onExternalChange, persisted } from './store.js';
import { openEntry } from './sheets.js';
import { openExplain, renderSettings, renderWelcome } from './settings.js';
import { closeAllSheets, closeTopSheet, h, hasSheet, icon, mark, toast } from './ui.js';
import { onResize, renderFixed, renderHistory, renderMonth } from './views.js';

useAustrianMonths(/^de-AT/i.test(navigator.language || '') || (navigator.languages || []).some((l) => /^de-AT/i.test(l)));

const root = document.getElementById('app');

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [name, arg] = parts;
  if (!app.state.settings.onboarded && name !== 'einstellungen') return { name: 'welcome', step: name === 'start' && arg === '2' ? 2 : 1 };
  switch (name) {
    case 'monat': return { name: 'month', month: isMonthKey(arg) ? arg : null };
    case 'fixkosten': return { name: 'fixed' };
    case 'verlauf': return { name: 'history' };
    case 'einstellungen': return { name: 'settings', sub: arg || null };
    case 'start': return { name: 'welcome', step: arg === '2' ? 2 : 1 };
    case 'neu': return { name: 'month', month: null, add: true };
    default: return { name: 'month', month: null };
  }
}

function tabbar(active) {
  const tab = (href, name, label, ic) => h('a', { href, 'aria-current': active === name ? 'page' : null }, icon(ic), h('span', {}, label));
  return h('nav', { class: 'tabbar', 'aria-label': 'Bereiche' },
    tab('#/', 'month', 'Monat', 'flow'),
    tab('#/fixkosten', 'fixed', 'Fixkosten', 'fixed'),
    tab('#/verlauf', 'history', 'Verlauf', 'history'));
}

let lastRouteKey = null;

app.render = ({ animate = false } = {}) => {
  const route = parseRoute();
  app.route = route;
  const routeKey = `${route.name}:${route.month || ''}`;
  // The flow only morphs within the month view; arriving from elsewhere it
  // just appears.
  if (!lastRouteKey || !lastRouteKey.startsWith('month:') || !routeKey.startsWith('month:')) resetFlow();
  const sameView = routeKey === lastRouteKey;
  lastRouteKey = routeKey;
  const scroll = sameView ? scrollY : 0;

  root.replaceChildren();
  if (route.name === 'welcome') {
    renderWelcome(root, route.step);
    document.title = 'Geldfluss';
    window.scrollTo(0, 0);
    return;
  }

  root.append(h('a', { class: 'brand', href: '#/' }, mark(), 'Geldfluss'));
  const key = route.month || monthOf(app.today);
  if (route.name === 'month') renderMonth(root, key, { animate });
  else if (route.name === 'fixed') renderFixed(root);
  else if (route.name === 'history') renderHistory(root);
  else if (route.name === 'settings') renderSettings(root, route.sub);

  if (route.name !== 'settings') {
    root.append(tabbar(route.name));
    const isFixed = route.name === 'fixed';
    root.append(h('button', {
      type: 'button', class: 'fab', 'aria-keyshortcuts': 'n',
      onclick: () => (isFixed ? import('./sheets.js').then((m) => m.openRecurring()) : openEntry()),
    }, icon('plus'), h('span', { class: 'lbl' }, isFixed ? 'Fixposten' : 'Eintrag')));
  }

  const titles = { fixed: 'Fixkosten · Geldfluss', history: 'Verlauf · Geldfluss', settings: 'Einstellungen · Geldfluss' };
  document.title = route.name === 'month' ? 'Geldfluss' : titles[route.name];
  if (sameView) window.scrollTo(0, scroll); else if (route.name !== 'settings' || !route.sub) window.scrollTo(0, 0);
  document.documentElement.classList.toggle('scrolled', scrollY > 56);
};

// ---------------------------------------------------------------------------

function refreshToday() {
  const t = todayISO();
  if (t !== app.today) {
    app.today = t;
    if (!hasSheet()) app.render({ animate: false });
  }
}

async function start() {
  const { state, where, damaged } = await load();
  app.state = state;
  app.storage = where;
  app.persisted = await persisted();
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

  // ?demo shows sample data on a fresh start (used for screenshots).
  const params = new URLSearchParams(location.search);
  if (params.has('demo') && state.entries.length === 0 && state.recurring.length === 0) {
    const { withDemo } = await import('./demo.js');
    app.state = withDemo(app.state, app.today);
  }

  app.render({ animate: false });
  if (app.route.add) { history.replaceState(null, '', '#/'); app.route.add = false; openEntry(); }
  if (damaged) toast('Die gespeicherten Daten waren beschädigt. Sie liegen beiseite, die App startet leer. Lade eine Sicherung, wenn du eine hast.', { label: 'OK', run: () => {}, long: true });

  addEventListener('hashchange', () => {
    closeAllSheets();
    const before = app.route.name;
    const next = parseRoute().name;
    // Between places the page cross-fades; within the month the flow morphs.
    if (before !== next && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.startViewTransition(() => app.render({ animate: true }));
    } else {
      app.render({ animate: true });
    }
  });

  const onScroll = () => document.documentElement.classList.toggle('scrolled', scrollY > 56);
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('popstate', (e) => {
    if (!e.state?.sheet) closeTopSheet();
  });

  let resizeTimer = null;
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(onResize, 80); });

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshToday(); });
  setInterval(refreshToday, 60_000);

  onExternalChange(async () => {
    const fresh = await load();
    app.state = fresh.state;
    applyTheme();
    if (!hasSheet()) app.render({ animate: true });
  });

  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || hasSheet()) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (!app.state.settings.onboarded) return;
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openEntry(); }
    if (app.route.name === 'month' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const key = app.route.month || monthOf(app.today);
      go(`#/monat/${addMonths(key, e.key === 'ArrowLeft' ? -1 : 1)}`);
    }
    if (e.key === '?') openExplain();
  });

  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    app.installPrompt = e;
    if (app.route.name === 'settings') app.render({ animate: false });
  });

  registerWorker();
}

function registerWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  if (/^(localhost|127\.)/.test(location.hostname) && new URLSearchParams(location.search).has('nosw')) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const offer = (worker) => {
      toast('Eine neue Version von Geldfluss ist da.', {
        label: 'Neu laden', long: true,
        run: () => worker.postMessage({ type: 'skip-waiting' }),
      });
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
      });
    });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch(() => {});
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}

start();

export { commit };
