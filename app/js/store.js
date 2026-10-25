// Keeps the state in this browser: IndexedDB first, localStorage if
// IndexedDB is unavailable. Other open tabs hear about every save and reload,
// so two windows never overwrite each other.

import { emptyState, normalize } from './model.js';

const DB = 'geldfluss';
const STORE = 'kv';
const KEY = 'state';
const LS_KEY = 'geldfluss:state';

let dbPromise = null;
let channel = null;
let listeners = [];

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('no indexedDB'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked'));
  }).catch((err) => {
    dbPromise = null;
    throw err;
  });
  return dbPromise;
}

function idb(mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('aborted'));
  }));
}

/** Loads the saved state, or a fresh one. Never throws. */
export async function load() {
  let raw = null;
  let where = 'indexeddb';
  try {
    raw = await idb('readonly', (s) => s.get(KEY));
  } catch {
    where = 'localstorage';
  }
  if (raw == null) {
    try {
      const text = localStorage.getItem(LS_KEY);
      if (text) raw = JSON.parse(text);
    } catch { /* private mode or blocked storage */ }
  }
  if (raw == null) return { state: emptyState(), where, fresh: true };
  try {
    return { state: normalize(raw), where, fresh: false };
  } catch {
    // Damaged data is kept aside rather than lost, and the app starts clean.
    try { localStorage.setItem(`${LS_KEY}:damaged:${Date.now()}`, JSON.stringify(raw)); } catch { /* full */ }
    return { state: emptyState(), where, fresh: true, damaged: true };
  }
}

/** Saves the state. Resolves to where it went; rejects if nowhere worked. */
export async function save(state) {
  const plain = JSON.parse(JSON.stringify(state));
  try {
    await idb('readwrite', (s) => s.put(plain, KEY));
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
    announce();
    return 'indexeddb';
  } catch {
    localStorage.setItem(LS_KEY, JSON.stringify(plain));
    announce();
    return 'localstorage';
  }
}

export async function wipe() {
  try { await idb('readwrite', (s) => s.delete(KEY)); } catch { /* ignore */ }
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  announce();
}

function announce() {
  try {
    channel ??= new BroadcastChannel('geldfluss');
    channel.postMessage({ type: 'saved', at: Date.now() });
  } catch { /* old browser */ }
}

/** Calls `fn` when another tab saved. */
export function onExternalChange(fn) {
  listeners.push(fn);
  try {
    channel ??= new BroadcastChannel('geldfluss');
    channel.onmessage = (event) => {
      if (event.data?.type === 'saved') for (const l of listeners) l();
    };
  } catch { /* old browser */ }
  globalThis.addEventListener?.('storage', (event) => {
    if (event.key === LS_KEY) for (const l of listeners) l();
  });
}

/** Asks the browser to keep the data even when space runs low. */
export async function persist() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function persisted() {
  try {
    return navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  } catch {
    return null;
  }
}
