// Einstellungen, the first start, backups and the explanation of the numbers.

import { app, applyTheme, commit, currentMonth, go } from './app.js';
import { addMonths, monthLabel, monthOf, todayISO } from './dates.js';
import { withDemo } from './demo.js';
import { addRecurring, DataError, emptyState, FALLBACK, merge, normalize, removeDemo, toCSV } from './model.js';
import { formatMoney, formatPlain, parseAmount } from './money.js';
import { confirm, editCategory, newCategory, openRecurring } from './sheets.js';
import { wipe } from './store.js';
import { h, haptic, icon, mark, saveFile, sheet, toast } from './ui.js';
import { VERSION } from './version.js';

const REPO = 'https://github.com/Nikityyy/geldfluss';

// ---------------------------------------------------------------------------
// Backups

export async function exportBackup() {
  const date = todayISO();
  const data = { ...app.state, exported: new Date().toISOString(), version: VERSION.build };
  const result = await saveFile(`geldfluss-sicherung-${date}.json`, JSON.stringify(data, null, 2), 'application/json');
  if (result === 'cancelled') return;
  commit({ ...app.state, settings: { ...app.state.settings, lastBackup: Date.now(), backupSnooze: null } }, { undo: false, render: true });
  toast(result === 'shared' ? 'Sicherung übergeben. Leg sie zum Beispiel in „Dateien“ ab.' : 'Sicherung gespeichert. Sie liegt in deinen Downloads.');
}

export async function exportCSV() {
  const result = await saveFile(`geldfluss-buchungen-${todayISO()}.csv`, toCSV(app.state, app.today), 'text/csv;charset=utf-8');
  if (result !== 'cancelled') toast('Tabelle gespeichert. Sie öffnet sich in Excel, Numbers und LibreOffice.');
}

export function importBackup() {
  const input = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
  document.body.append(input);
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.remove();
    if (!file) return;
    let incoming;
    try {
      if (file.size > 20 * 1024 * 1024) throw new DataError('Die Datei ist zu groß für eine Geldfluss-Sicherung.');
      const text = await file.text();
      let raw;
      try { raw = JSON.parse(text); } catch { throw new DataError('Diese Datei ist keine Geldfluss-Sicherung.'); }
      incoming = normalize(raw);
    } catch (err) {
      toast(err instanceof DataError ? err.message : 'Die Datei ließ sich nicht lesen.');
      return;
    }
    const hasOwn = app.state.entries.length + app.state.recurring.length > 0;
    const counts = `${incoming.entries.length} Buchungen und ${incoming.recurring.length} Fixposten`;
    const replace = () => {
      const next = { ...incoming, settings: { ...incoming.settings, theme: app.state.settings.theme, onboarded: true, lastBackup: Date.now() } };
      commit(next, { message: `Sicherung geladen: ${counts}.` });
      applyTheme();
      go('#/', { replace: true });
    };
    if (!hasOwn) return replace();
    const s = sheet({
      title: 'Sicherung laden',
      body: h('div', {},
        h('p', { class: 'lede', style: { marginTop: 0 } }, `In der Datei sind ${counts}. Hier im Browser liegen ${app.state.entries.length} Buchungen und ${app.state.recurring.length} Fixposten.`),
        h('p', { class: 'help', style: { marginTop: '12px' } }, 'Zusammenführen behält beides; was in beiden steckt, kommt aus der Datei. Ersetzen löscht, was hier liegt.')),
      foot: [
        h('button', { type: 'button', class: 'btn ghost', onclick: () => { s.close(); replace(); } }, 'Ersetzen'),
        h('button', { type: 'button', class: 'btn primary', onclick: () => { s.close(); commit(merge(app.state, incoming), { message: `Zusammengeführt: ${counts}.` }); } }, 'Zusammenführen'),
      ],
    });
  });
  input.click();
}

// ---------------------------------------------------------------------------
// How the numbers are made

export function openExplain() {
  sheet({
    title: 'So rechnet Geldfluss',
    body: h('div', { class: 'lede', style: { marginTop: 0 } },
      h('p', {}, 'Übrig ist, was von den Einnahmen eines Monats bleibt, wenn alle Ausgaben und alles Gesparte abgezogen sind.'),
      h('p', { style: { marginTop: '12px' } }, 'Fixposten, die im Monat noch fällig werden, sind schon abgezogen. So springt die Zahl nicht, wenn am 28. die Versicherung abgeht.'),
      h('p', { style: { marginTop: '12px' } }, 'Der Betrag pro Tag teilt das Übrige durch die verbleibenden Tage, heute mitgezählt.'),
      h('p', { style: { marginTop: '12px' } }, 'Jährliche oder vierteljährliche Fixposten zählen in dem Monat, in dem sie fällig sind. Unter Fixkosten siehst du sie zusätzlich auf einen Monat umgerechnet.')),
  });
}

// ---------------------------------------------------------------------------
// Einstellungen

export function renderSettings(root, sub) {
  const s = app.state;
  const view = h('main', { class: 'view narrow', id: 'main' });
  root.append(view);
  view.append(h('div', { class: 'top top-row' }, h('a', { class: 'ibtn', href: '#/', 'aria-label': 'Zurück zum Monat', style: { marginLeft: '-10px' } }, icon('back')), h('span')));
  view.append(h('h1', { class: 'title' }, 'Einstellungen'));

  const item = (t, sub2, v, onclick, extra = '') => h('li', {}, h(onclick ? 'button' : 'div', { type: onclick ? 'button' : null, class: `item ${extra}`, onclick },
    h('span', {}, h('span', { class: 't' }, t), sub2 ? h('span', { class: 's' }, sub2) : null),
    v != null ? h('span', { class: 'v' }, v) : onclick ? icon('chevron', 's') : null));

  // Look
  const theme = h('div', { class: 'seg', role: 'group', 'aria-label': 'Darstellung' }, [['system', 'Wie das Gerät'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([v, t]) => h('button', {
    type: 'button', 'aria-pressed': String(s.settings.theme === v),
    onclick: () => { commit({ ...app.state, settings: { ...app.state.settings, theme: v } }, { undo: false }); applyTheme(); },
  }, t)));
  view.append(h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('h2', {}, 'Darstellung')), theme));

  // Categories
  const groups = [['expense', 'Ausgaben'], ['saving', 'Sparen'], ['income', 'Einnahmen']];
  const catList = h('ul', { class: 'set' });
  for (const [kind, label] of groups) {
    for (const c of s.categories.filter((x) => x.kind === kind)) {
      catList.append(item(c.name, `${label}${Object.values(FALLBACK).includes(c.id) ? ' · nimmt Buchungen gelöschter Kategorien auf' : ''}`, c.budget ? `Budget ${formatPlain(c.budget)}` : null, () => editCategory(c.id)));
    }
  }
  view.append(h('section', { class: 'sec' },
    h('div', { class: 'sec-h' }, h('h2', {}, 'Kategorien'), h('span', { class: 'aside' }, `${s.categories.length}`)),
    catList,
    h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px' } },
      h('button', { type: 'button', class: 'btn ghost small', onclick: () => newCategory('expense') }, icon('plus', 's'), 'Ausgabe-Kategorie'),
      h('button', { type: 'button', class: 'btn ghost small', onclick: () => newCategory('income') }, icon('plus', 's'), 'Einnahme-Kategorie'))));

  // Data
  const last = s.settings.lastBackup;
  const storageLine = app.persisted === true
    ? 'Der Browser hält die Daten dauerhaft.'
    : 'Der Browser darf die Daten löschen, wenn der Speicher knapp wird oder die Seite lange nicht geöffnet war. Eine Sicherung schützt davor.';
  const dataSec = h('section', { class: 'sec', id: 'sicherung' },
    h('div', { class: 'sec-h' }, h('h2', {}, 'Deine Daten')),
    h('p', { class: 'hero-s', style: { marginTop: 0, marginBottom: '14px' } }, `Alles liegt nur in diesem Browser, auf diesem Gerät. Kein Konto, kein Server, niemand sonst sieht es. ${storageLine}`),
    h('ul', { class: 'set' },
      item('Sicherung speichern', last ? `Zuletzt am ${new Date(last).toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Noch nie gesichert', null, exportBackup),
      item('Sicherung laden', 'Aus einer Geldfluss-Datei, auch von einem anderen Gerät', null, importBackup),
      item('Als Tabelle exportieren', 'Alle Buchungen als CSV für Excel oder Numbers', null, exportCSV),
      s.settings.demo
        ? item('Beispieldaten entfernen', 'Deine eigenen Einträge bleiben', null, () => {
          commit(removeDemo(app.state), { message: 'Beispieldaten entfernt.' });
        })
        : item('Beispieldaten laden', 'Sechs Monate zum Ansehen, jederzeit wieder entfernbar', null, () => {
          commit(withDemo(app.state, app.today), { message: 'Beispieldaten geladen.' });
          go('#/');
        }),
      item('Alles löschen', 'Buchungen, Fixposten und Kategorien in diesem Browser', null, () => confirm({
        title: 'Alles löschen?',
        text: 'Alle Buchungen, Fixposten und eigenen Kategorien in diesem Browser verschwinden. Das lässt sich nicht rückgängig machen. Wenn du sie behalten willst, speichere vorher eine Sicherung.',
        action: 'Alles löschen',
        run: async () => {
          await wipe();
          app.state = emptyState();
          commit(app.state, { undo: false });
          applyTheme();
          go('#/', { replace: true });
          toast('Alles gelöscht.');
        },
      }), 'danger')));
  view.append(dataSec);

  // Install
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (!standalone) {
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    let line;
    let action = null;
    if (app.installPrompt) {
      line = 'Geldfluss öffnet sich dann wie eine App, ohne Browserleiste, auch offline.';
      action = async () => {
        app.installPrompt.prompt();
        await app.installPrompt.userChoice.catch(() => null);
        app.installPrompt = null;
        app.render({ animate: false });
      };
    } else if (ios) {
      line = 'In Safari: Teilen, dann „Zum Home-Bildschirm“. Auf dem iPhone hält das die Daten auch länger.';
    } else {
      line = 'Im Browsermenü „App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen.';
    }
    view.append(h('section', { class: 'sec' },
      h('div', { class: 'sec-h' }, h('h2', {}, 'Als App')),
      h('ul', { class: 'set' }, item('Auf dem Gerät installieren', line, null, action))));
  }

  view.append(h('div', { class: 'about n' },
    h('p', {}, `Geldfluss ${VERSION.build === 'dev' ? 'Entwicklungsstand' : `Version ${VERSION.build}`}${VERSION.date ? ` vom ${VERSION.date.split('-').reverse().join('.')}` : ''}${VERSION.commit ? ` · ${VERSION.commit}` : ''}`),
    h('p', {}, 'Kostenlos und quelloffen unter der MIT-Lizenz. ', h('a', { class: 'link', href: REPO, target: '_blank', rel: 'noopener' }, 'Quellcode auf GitHub')),
    h('p', {}, h('button', { type: 'button', class: 'link', onclick: openExplain }, 'So rechnet Geldfluss'))));

  if (sub === 'sicherung') requestAnimationFrame(() => dataSec.scrollIntoView({ block: 'start' }));
}

// ---------------------------------------------------------------------------
// First start: two questions, then the flow.

const COMMON = [
  ['Miete', 'wohnen', 'inklusive Betriebskosten'],
  ['Strom & Gas', 'energie', null],
  ['Internet', 'handy-internet', null],
  ['Handy', 'handy-internet', null],
  ['Versicherungen', 'versicherungen', 'zusammen'],
  ['Öffis oder Auto', 'mobilitaet', 'Monatskarte, Leasing, Tanken'],
  ['Streaming und Abos', 'abos', 'Spotify, Netflix und so weiter'],
  ['Sparplan', 'sparen', 'was du jeden Monat zur Seite legst'],
];

export function renderWelcome(root, step = 1) {
  const view = h('main', { class: 'welcome', id: 'main' });
  root.append(view);
  if (step === 1) {
    const input = h('input', { type: 'text', inputmode: 'decimal', placeholder: '2.900', autocomplete: 'off', 'aria-label': 'Nettoeinkommen pro Monat in Euro', enterkeyhint: 'next', id: 'w-income' });
    const err = h('p', { class: 'w-err', hidden: true, role: 'alert' });
    const next = () => {
      const v = parseAmount(input.value);
      if (v == null || v === 0) {
        err.textContent = input.value.trim() ? 'Das ist kein Betrag. Schreib ihn zum Beispiel so: 2.900' : 'Gib dein Nettoeinkommen ein, zum Beispiel 2.900.';
        err.hidden = false;
        input.focus();
        return;
      }
      sessionStorage.setItem('geldfluss:welcome-income', String(v));
      go('#/start/2');
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') next(); });
    input.addEventListener('input', () => { err.hidden = true; });
    const saved = sessionStorage.getItem('geldfluss:welcome-income');
    if (saved) input.value = formatPlain(Number(saved)).replace(/,00$/, '');
    view.append(
      h('div', { class: 'art' }, welcomeArt()),
      h('h1', {}, 'Wohin fließt dein Geld?'),
      h('p', { class: 'lede' }, 'Geldfluss zeigt jeden Monat, was reinkommt, wohin es geht und was übrig bleibt. Alles bleibt in diesem Browser.'),
      h('p', { class: 'step-k' }, '1 von 2'),
      h('label', { for: 'w-income', style: { display: 'block', fontWeight: 650, marginTop: '6px' } }, 'Wie viel bekommst du im Monat netto?'),
      h('div', { class: 'w-amount' }, input, h('span', { class: 'cur', 'aria-hidden': 'true' }, '€')),
      err,
      h('div', { class: 'acts' },
        h('button', { type: 'button', class: 'btn primary', onclick: next }, 'Weiter'),
        h('button', { type: 'button', class: 'link', onclick: () => { commit(withDemo(app.state, app.today), { undo: false }); go('#/', { replace: true }); } }, 'Erst mit Beispieldaten ansehen'),
        h('button', { type: 'button', class: 'link', onclick: () => { commit({ ...app.state, settings: { ...app.state.settings, onboarded: true } }, { undo: false }); go('#/', { replace: true }); } }, 'Überspringen')));
    setTimeout(() => input.focus({ preventScroll: true }), 50);
    return;
  }

  const income = Number(sessionStorage.getItem('geldfluss:welcome-income'));
  if (!income) return go('#/start', { replace: true });
  const fields = COMMON.map(([name, cat, hint]) => {
    const input = h('input', { type: 'text', inputmode: 'decimal', placeholder: '0', autocomplete: 'off', 'aria-label': `${name} pro Monat in Euro`, enterkeyhint: 'next' });
    input.addEventListener('input', () => { input.value = input.value.replace(/[^\d.,]/g, ''); update(); });
    return { name, cat, hint, input };
  });
  const sum = h('p', { class: 'w-sum n', 'aria-live': 'polite' });
  const update = () => {
    let fixed = 0;
    for (const f of fields) fixed += parseAmount(f.input.value) || 0;
    const free = income - fixed;
    sum.replaceChildren('Fix ', h('b', {}, formatMoney(fixed)), ' · ', ...(free >= 0 ? ['frei ', h('b', { class: 'free' }, formatMoney(free))] : ['es fehlen ', h('b', { class: 'neg' }, formatMoney(-free))]));
  };
  update();
  const finish = () => {
    const start = currentMonth();
    let s = addRecurring(app.state, { name: 'Gehalt', type: 'income', categoryId: 'gehalt', cents: income, start, day: 1 });
    for (const f of fields) {
      const v = parseAmount(f.input.value);
      if (v) s = addRecurring(s, { name: f.name, type: 'expense', categoryId: f.cat, cents: v, start, day: 1 });
    }
    s.settings.onboarded = true;
    sessionStorage.removeItem('geldfluss:welcome-income');
    haptic(18);
    commit(s, { undo: false, render: false });
    go('#/', { replace: true });
    toast('Fertig. Trag ab jetzt ein, was du ausgibst.');
  };
  view.append(
    h('p', { class: 'step-k', style: { marginTop: '8px' } }, '2 von 2'),
    h('h1', {}, 'Was geht jeden Monat fix weg?'),
    h('p', { class: 'lede' }, 'Ungefähre Beträge reichen. Was nicht passt, lass leer. Ändern kannst du alles später unter Fixkosten.'),
    h('div', { class: 'w-list' }, fields.map((f, i) => h('div', { class: 'w-row' },
      h('label', { for: `w-f${i}` }, f.name, f.hint ? h('span', {}, f.hint) : null),
      h('div', { class: 'w-in' }, Object.assign(f.input, { id: `w-f${i}` }), h('span', { class: 'cur', 'aria-hidden': 'true' }, '€'))))),
    sum,
    h('div', { class: 'acts' },
      h('button', { type: 'button', class: 'btn primary', onclick: finish }, 'Fertig'),
      h('a', { class: 'link', href: '#/start' }, 'Zurück')));
}

function welcomeArt() {
  // The flow in miniature: one stream, five arms, the last one kept.
  const div = h('div');
  div.innerHTML = `<svg viewBox="0 0 400 172" aria-hidden="true">
    <rect x="20" y="18" width="6" height="114" fill="var(--ink)"/>
    <path d="M26 18C150 18 150 8 250 8L250 44C150 44 150 53 26 53Z" fill="var(--stream)"/>
    <path d="M26 53C150 53 150 54 250 54L250 70C150 70 150 69 26 69Z" fill="var(--stream)"/>
    <path d="M26 69C150 69 150 80 250 80L250 92C150 92 150 81 26 81Z" fill="var(--stream)"/>
    <path d="M26 81C150 81 150 102 250 102L250 110C150 110 150 89 26 89Z" fill="var(--stream)"/>
    <path d="M26 89C150 89 150 122 250 122L250 165C150 165 150 132 26 132Z" fill="var(--accent)"/>
    <rect x="250" y="8" width="5" height="36" fill="var(--ink)"/><rect x="250" y="54" width="5" height="16" fill="var(--ink)"/>
    <rect x="250" y="80" width="5" height="12" fill="var(--ink)"/><rect x="250" y="102" width="5" height="8" fill="var(--ink)"/>
    <rect x="250" y="122" width="5" height="43" fill="var(--accent)"/>
  </svg>`;
  return div.firstChild;
}

export { mark, monthLabel, addMonths, monthOf, openRecurring };
