// A small static server for local checks. Serves _site/ (run the build first)
// the way GitHub Pages does, under /geldfluss/, so relative paths are tested
// for real.
//
//   node tools/serve.mjs [--port 4173] [--dir _site]

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const dir = join(root, arg('dir', '_site'));
const port = Number(arg('port', 4173));
const base = '/geldfluss/';

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.avif': 'image/avif', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/' ) { res.writeHead(302, { location: base }); return res.end(); }
  if (!url.pathname.startsWith(base)) { res.writeHead(404); return res.end('not found'); }
  let path = normalize(join(dir, decodeURIComponent(url.pathname.slice(base.length))));
  if (!path.startsWith(dir)) { res.writeHead(403); return res.end(); }
  try {
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(body);
  } catch {
    try {
      const body = await readFile(join(dir, '404.html'));
      res.writeHead(404, { 'content-type': types['.html'] });
      res.end(body);
    } catch { res.writeHead(404); res.end('not found'); }
  }
}).listen(port, () => console.log(`http://localhost:${port}${base}`));
