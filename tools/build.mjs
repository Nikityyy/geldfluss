// Assembles the GitHub Pages site in _site/: the landing page at the root and
// the app under app/. Stamps the version into the app and writes the list of
// files the service worker keeps for offline use.
//
//   node tools/build.mjs [--version 42] [--commit <sha>] [--out _site]

import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const out = join(root, arg('out', '_site'));
const build = arg('version', 'dev');
const commit = arg('commit', '').slice(0, 7);
const date = new Date().toISOString().slice(0, 10);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(join(root, 'landing'), out, { recursive: true });
await cp(join(root, 'app'), join(out, 'app'), { recursive: true });
await writeFile(join(out, '.nojekyll'), '');

// Everything in app/ except the worker itself is precached. The hash of all
// file contents names the cache, so a changed file always means a new cache.
const appDir = join(out, 'app');
const files = (await walk(appDir))
  .map((file) => relative(appDir, file).split(sep).join('/'))
  .filter((file) => file !== 'sw.js')
  .sort();

const versionFile = join(appDir, 'js', 'version.js');
await writeFile(versionFile, `export const VERSION = ${JSON.stringify({ build, commit, date })};\n`);

const hash = createHash('sha256');
for (const file of files) hash.update(file).update(await readFile(join(appDir, file)));
const cacheName = `geldfluss-${build}-${hash.digest('hex').slice(0, 10)}`;

const swPath = join(appDir, 'sw.js');
const sw = (await readFile(swPath, 'utf8'))
  .replace("'__CACHE__'", JSON.stringify(cacheName))
  .replace("['__FILES__']", JSON.stringify(['./', ...files.filter((f) => f !== 'index.html')], null, 2));
await writeFile(swPath, sw);

const size = (await Promise.all(files.map(async (f) => (await stat(join(appDir, f))).size))).reduce((a, b) => a + b, 0);
console.log(`Built ${out}: ${files.length} app files (${(size / 1024).toFixed(0)} KB), cache ${cacheName}`);
