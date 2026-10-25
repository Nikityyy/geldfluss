// The flow: one stream as wide as the income, splitting into arms as wide as
// the money that went each way. Layout is pure (and tested); drawing and the
// signature animation (the arms re-route when an amount changes) are below.

import { formatPlain } from './money.js';

const MIN_SLOT = 32;     // room for one label row
const GAP = 6;           // between arms
const KEEP_GAP = 18;     // before what is kept (saving, left)
const MAX_ARMS = 7;      // more than this and the rest becomes "n weitere"

/**
 * Builds the arms from a month summary.
 * Returns { total, sources, sinks } in cents, or null if nothing flows.
 */
export function flowData(summary) {
  const { income, out, left } = summary;
  if (income === 0 && out === 0) return null;

  const spentRows = summary.expenses.filter((r) => r.cents > 0 && r.category.kind !== 'saving');
  const savingRows = summary.expenses.filter((r) => r.cents > 0 && r.category.kind === 'saving');

  let arms = spentRows.map((r) => ({ key: r.category.id, label: r.category.name, cents: r.cents, kind: 'expense' }));
  if (arms.length > MAX_ARMS) {
    const keep = arms.slice(0, MAX_ARMS - 1);
    const rest = arms.slice(MAX_ARMS - 1);
    keep.push({ key: '__more', label: `${rest.length} weitere`, cents: rest.reduce((s, a) => s + a.cents, 0), kind: 'more', members: rest.map((a) => a.key) });
    arms = keep;
  }
  for (const r of savingRows) arms.push({ key: r.category.id, label: r.category.name, cents: r.cents, kind: 'saving' });
  if (left > 0) arms.push({ key: '__left', label: 'Übrig', cents: left, kind: 'left' });

  const sources = summary.incomes.filter((r) => r.cents > 0).map((r) => ({ key: r.category.id, label: r.category.name, cents: r.cents, kind: 'income' }));
  if (left < 0) sources.push({ key: '__deficit', label: 'Fehlt', cents: -left, kind: 'deficit' });

  const total = Math.max(income, 0) + Math.max(-left, 0);
  return { total, sources, sinks: arms };
}

/**
 * Positions in px. The source bar is scaled so the whole stream is about
 * `target` px tall; each arm gets at least one label row, so small arms stay
 * readable while their ribbons stay true to size.
 */
export function layout(data, { width, target = 300 }) {
  const k = target / data.total;
  const sinkX = Math.round(Math.max(96, Math.min(width * 0.4, width - 200)));
  const barW = 6;
  const armW = 5;

  let y = 0;
  const sinks = data.sinks.map((s, i) => {
    const h = s.cents * k;
    const kept = s.kind === 'saving' || s.kind === 'left';
    const prevKept = i > 0 && (data.sinks[i - 1].kind === 'saving' || data.sinks[i - 1].kind === 'left');
    if (i > 0) y += kept && !prevKept ? KEEP_GAP : GAP;
    const slot = Math.max(h, MIN_SLOT);
    const node = { ...s, h, slotY: y, slot, ty: y + (slot - h) / 2 };
    y += slot;
    return node;
  });
  const sinkHeight = y;
  const sourceHeight = data.total * k;
  const height = Math.max(sinkHeight, sourceHeight);
  const sy0 = (height - sourceHeight) / 2;

  // Ribbons leave the source in the order of the arms.
  let sy = sy0;
  for (const s of sinks) {
    s.sy = sy;
    sy += s.h;
  }
  let qy = sy0;
  const sources = data.sources.map((s) => {
    const h = s.cents * k;
    const node = { ...s, y: qy, h };
    qy += h;
    return node;
  });

  return { width, height, sinkX, barW, armW, sy0, sourceHeight, sinks, sources };
}

function ribbon(L, s) {
  const x0 = L.barW;
  const x1 = L.sinkX;
  const c = (x0 + x1) / 2;
  const h = Math.max(s.h, 0);
  return `M${x0} ${s.sy}C${c} ${s.sy} ${c} ${s.ty} ${x1} ${s.ty}L${x1} ${s.ty + h}C${c} ${s.ty + h} ${c} ${s.sy + h} ${x0} ${s.sy + h}Z`;
}

// ---------------------------------------------------------------------------
// Drawing

const SVG = 'http://www.w3.org/2000/svg';
const reduce = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// The last layout shown, so the next one can grow out of it.
let previous = null;

/**
 * Renders the flow into `host`. `onPick(key, arm)` is called when an arm or
 * its label is chosen. Returns a function that redraws on resize.
 */
export function mountFlow(host, summary, { onPick, animate = true } = {}) {
  const data = flowData(summary);
  host.replaceChildren();
  if (!data) return () => {};

  const wrap = document.createElement('div');
  wrap.className = 'flow';
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<defs>
    <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--stream)"/><rect width="2.2" height="6" fill="var(--stream-hi)"/></pattern>
    <pattern id="hatch-hi" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--stream-hi)"/><rect width="2.2" height="6" fill="var(--ink-3)"/></pattern>
  </defs>`;
  wrap.append(svg);
  host.append(wrap);

  const paths = new Map();
  const sinkBars = new Map();
  const labels = new Map();
  const srcBars = [];

  const width = () => Math.max(220, host.clientWidth || 340);
  let L = layout(data, { width: width() });

  for (const s of L.sources) {
    const r = document.createElementNS(SVG, 'rect');
    r.setAttribute('class', `src ${s.kind}`);
    svg.append(r);
    srcBars.push(r);
  }
  for (const s of L.sinks) {
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('class', `rb ${s.kind}`);
    p.dataset.key = s.key;
    svg.append(p);
    paths.set(s.key, p);
    const b = document.createElementNS(SVG, 'rect');
    b.setAttribute('class', `snk ${s.kind === 'left' ? 'left' : ''}`);
    svg.append(b);
    sinkBars.set(s.key, b);

    // Without a handler (the landing page) the labels are plain text.
    const btn = document.createElement(onPick ? 'button' : 'span');
    if (onPick) btn.type = 'button';
    btn.className = `flow-label ${s.kind}`;
    btn.dataset.key = s.key;
    btn.innerHTML = `<span class="nm"></span><span class="am n"></span>`;
    btn.querySelector('.nm').textContent = s.label;
    btn.querySelector('.am').textContent = formatPlain(s.cents);
    if (onPick) btn.setAttribute('aria-label', `${s.label}: ${formatPlain(s.cents)} Euro`);
    btn.addEventListener('click', () => onPick?.(s.key, s));
    const hot = (on) => { p.classList.toggle('hot', on); };
    btn.addEventListener('pointerenter', () => hot(true));
    btn.addEventListener('pointerleave', () => hot(false));
    btn.addEventListener('focus', () => hot(true));
    btn.addEventListener('blur', () => hot(false));
    p.addEventListener('click', () => onPick?.(s.key, s));
    p.style.cursor = 'pointer';
    wrap.append(btn);
    labels.set(s.key, btn);
  }

  function draw(T) {
    wrap.style.height = `${Math.ceil(T.height)}px`;
    svg.setAttribute('viewBox', `0 0 ${T.width} ${Math.ceil(T.height)}`);
    svg.setAttribute('width', T.width);
    svg.setAttribute('height', Math.ceil(T.height));
    T.sources.forEach((s, i) => {
      const r = srcBars[i];
      if (!r) return;
      r.setAttribute('x', 0); r.setAttribute('width', T.barW);
      r.setAttribute('y', s.y); r.setAttribute('height', Math.max(s.h, 0.5));
    });
    for (const s of T.sinks) {
      const p = paths.get(s.key);
      if (!p) continue;
      p.setAttribute('d', ribbon(T, s));
      const b = sinkBars.get(s.key);
      b.setAttribute('x', T.sinkX); b.setAttribute('width', T.armW);
      b.setAttribute('y', s.ty); b.setAttribute('height', Math.max(s.h, 1.5));
      const lab = labels.get(s.key);
      lab.style.transform = `translate(${T.sinkX + T.armW + 10}px, ${s.slotY + s.slot / 2}px)`;
      lab.style.maxWidth = `${T.width - T.sinkX - T.armW - 10}px`;
      lab.style.opacity = s.fade ?? 1;
    }
  }

  // Grow out of the previous layout where the arms match (same month view).
  const from = animate && !reduce() && previous ? previous : null;
  if (from) {
    const to = L;
    const start = performance.now();
    const dur = 650;
    const fromSinks = new Map(from.sinks.map((s) => [s.key, s]));
    const tween = (t) => {
      const e = 1 - (1 + 7 * t) * Math.exp(-7 * t); // critically damped spring
      const lerp = (a, b) => a + (b - a) * e;
      const sinks = to.sinks.map((s) => {
        const f = fromSinks.get(s.key) || { ...s, h: 0, sy: s.sy, ty: s.ty + s.h / 2, slotY: s.slotY, slot: s.slot, fade: 0 };
        return { ...s, h: lerp(f.h, s.h), sy: lerp(f.sy, s.sy), ty: lerp(f.ty, s.ty), slotY: lerp(f.slotY, s.slotY), slot: lerp(f.slot, s.slot), fade: f.fade === 0 ? e : 1 };
      });
      const sources = to.sources.map((s, i) => {
        const f = from.sources[i] || s;
        return { ...s, y: lerp(f.y, s.y), h: lerp(f.h, s.h) };
      });
      return { ...to, height: lerp(from.height, to.height), sinkX: to.sinkX, sinks, sources };
    };
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      draw(tween(t));
      if (t < 1 && wrap.isConnected) requestAnimationFrame(step);
    };
    draw(tween(0));
    requestAnimationFrame(step);
  } else {
    draw(L);
  }
  previous = L;

  const redraw = () => {
    const w = width();
    if (Math.abs(w - L.width) < 1) return;
    L = layout(data, { width: w });
    previous = L;
    draw(L);
  };
  return redraw;
}

/** Forget the last layout, so the next flow appears without morphing. */
export function resetFlow() {
  previous = null;
}

/** Plain-language description for screen readers. */
export function describeFlow(summary) {
  const data = flowData(summary);
  if (!data) return 'Noch kein Geldfluss in diesem Monat.';
  const parts = data.sinks.map((s) => `${s.label} ${formatPlain(s.cents)} Euro`);
  return `Geldfluss: ${formatPlain(summary.income)} Euro Einnahmen, aufgeteilt in ${parts.join(', ')}.`;
}
