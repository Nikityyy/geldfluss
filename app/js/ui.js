// Small DOM helpers: elements, icons, sheets, the toast and the rolling
// number. No framework: each view renders its markup from the state.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string' && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

// One icon set, drawn for the app: 24px grid, 1.8 stroke, round joins.
const PATHS = {
  flow: '<path d="M3 6.5c5 0 5.5 5.5 9 5.5s4-5.5 9-5.5"/><path d="M3 17.5c5 0 5.5-5.5 9-5.5"/><path d="M12 12h9"/>',
  fixed: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h4"/>',
  history: '<path d="M5 20V11M10 20V6M15 20v-9M20 20V8"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2 1.2M17.8 15.3l2 1.2M4.2 16.5l2-1.2M17.8 8.7l2-1.2"/><circle cx="12" cy="12" r="7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  left: '<path d="M14.5 6l-6 6 6 6"/>',
  right: '<path d="M9.5 6l6 6-6 6"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  chevron: '<path d="M9.5 6l6 6-6 6"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 13.5l5-5 5 5M5 4h14"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>',
  back: '<path d="M14.5 6l-6 6 6 6"/>',
};

export function icon(name, cls = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', `icon ${cls}`.trim());
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = PATHS[name] || '';
  return s;
}

/** The brand mark: one stream splitting in three, the lowest arm kept. */
export function mark() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 32 32');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<rect width="32" height="32" rx="8" fill="var(--ink)"/><path d="M6 9h3c6 0 7 2.5 17 2.5v3C16 14.5 15 12 9 12H6z" fill="var(--water)"/><path d="M6 12h3c6 0 8 4 17 4v3c-9 0-11-4-17-4H6z" fill="var(--water)" opacity=".55"/><path d="M6 15h3c6 0 8 6.5 17 6.5V25c-9 0-11-7-17-7H6z" fill="var(--accent)" stroke="var(--water)" stroke-width=".6"/>';
  return s;
}

export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function haptic(ms = 12) {
  try { if (!reduceMotion()) navigator.vibrate?.(ms); } catch { /* not supported */ }
}

// ---------------------------------------------------------------------------
// Sheets: a native <dialog>, so focus, Escape and the screen reader behave.
// Each open sheet adds a history entry, so the Android back button closes it.

const openSheets = [];

export function sheet({ title, body, foot, onClose, label }) {
  const close = h('button', { class: 'ibtn', type: 'button', 'aria-label': 'Schließen' }, icon('close'));
  const head = h('div', { class: 'sheet-head' }, h('h2', { id: `s-${Date.now()}` }, title), close);
  const grab = h('div', { class: 'grab', 'aria-hidden': 'true' });
  const bodyEl = h('div', { class: 'sheet-body' }, body);
  const footEl = foot ? h('div', { class: 'sheet-foot' }, foot) : null;
  const dlg = h('dialog', { class: 'sheet', 'aria-labelledby': head.firstChild.id, 'aria-label': label }, grab, head, bodyEl, footEl);
  document.body.append(dlg);

  let closed = false;
  const api = {
    el: dlg,
    body: bodyEl,
    close(fromHistory = false) {
      if (closed) return;
      closed = true;
      const i = openSheets.indexOf(api);
      if (i >= 0) openSheets.splice(i, 1);
      dlg.classList.remove('in');
      const done = () => { dlg.close(); dlg.remove(); };
      if (reduceMotion()) done(); else setTimeout(done, 280);
      if (!fromHistory && history.state?.sheet) history.back();
      onClose?.();
    },
  };
  close.addEventListener('click', () => api.close());
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); api.close(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) api.close(); });

  // Drag the grabber (or the head) down to dismiss.
  let startY = null;
  let dy = 0;
  const down = (e) => { startY = e.clientY; dy = 0; dlg.style.transition = 'none'; e.target.setPointerCapture?.(e.pointerId); };
  const move = (e) => { if (startY == null) return; dy = Math.max(0, e.clientY - startY); dlg.style.transform = `translateY(${dy}px)`; };
  const up = () => {
    if (startY == null) return;
    startY = null;
    dlg.style.transition = '';
    dlg.style.transform = '';
    if (dy > 90) api.close();
  };
  for (const el of [grab, head.firstChild]) {
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  dlg.showModal();
  requestAnimationFrame(() => requestAnimationFrame(() => dlg.classList.add('in')));
  history.pushState({ ...(history.state || {}), sheet: true }, '');
  openSheets.push(api);
  return api;
}

/** Closes the top sheet when the browser goes back. */
export function closeTopSheet() {
  const top = openSheets.at(-1);
  if (top) { top.close(true); return true; }
  return false;
}

export function closeAllSheets() {
  while (openSheets.length) openSheets.at(-1).close(true);
}

export function hasSheet() {
  return openSheets.length > 0;
}

// ---------------------------------------------------------------------------
// Toast: one at a time, for confirmations that can be undone.

let toastEl = null;
let toastTimer = null;

export function toast(text, action) {
  if (!toastEl) {
    toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastEl);
  }
  clearTimeout(toastTimer);
  toastEl.replaceChildren(h('span', {}, text));
  toastEl.classList.toggle('plain', !action);
  if (action) {
    toastEl.append(h('button', { type: 'button', onclick: () => { hideToast(); action.run(); } }, action.label));
  }
  // Re-trigger the transition when a toast replaces another.
  toastEl.classList.remove('on');
  requestAnimationFrame(() => toastEl.classList.add('on'));
  toastTimer = setTimeout(hideToast, action?.long ? 12000 : action ? 6000 : 3200);
}

export function hideToast() {
  clearTimeout(toastTimer);
  toastEl?.classList.remove('on');
}

// ---------------------------------------------------------------------------
// A number that counts to its new value (the hero, after a change).

export function roll(el, from, to, render, dur = 650) {
  if (from == null || from === to || reduceMotion()) { render(to); return; }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const e = 1 - (1 + 7 * t) * Math.exp(-7 * t);
    render(Math.round(from + (to - from) * e));
    if (t < 1 && el.isConnected) requestAnimationFrame(step);
    else render(to);
  };
  requestAnimationFrame(step);
}

/** Saves a text file: share sheet where it helps (iPhone), download elsewhere. */
export async function saveFile(name, text, type) {
  const blob = new Blob([text], { type });
  const file = typeof File === 'function' ? new File([blob], name, { type }) : null;
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch && file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name, style: { display: 'none' } });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  return 'downloaded';
}
