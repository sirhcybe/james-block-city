import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/** Every file under a folder, as forward-slash paths relative to it. */
function filesIn(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(dir, p).replace(/\\/g, '/'));
    }
  };
  try {
    walk(dir);
  } catch {
    // no public folder
  }
  return out;
}

/**
 * Offline play (spec 007, ADR-010): writes `sw.js` into the build with every built file in its
 * precache list. The cache name carries a hash of that list, so each new build replaces the old
 * cache. The worker serves from the cache first and falls back to the network.
 */
function serviceWorker(): Plugin {
  return {
    name: 'jbc-service-worker',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = ['./', 'index.html', ...Object.keys(bundle), ...filesIn('public')];
      const list = [...new Set(files)].filter((f) => f !== 'sw.js');
      const version = createHash('sha256').update(list.join('\n')).digest('hex').slice(0, 12);
      const source = `// Generated at build time (vite.config.ts). Do not edit.
const CACHE = 'jbc-${version}';
const FILES = ${JSON.stringify(list)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('jbc-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: e.request.mode === 'navigate', ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(e.request).catch(() =>
          e.request.mode === 'navigate' ? caches.match('index.html') : Response.error(),
        ),
    ),
  );
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [serviceWorker()],
  build: {
    target: 'es2022',
    // Phaser alone is ~1.2 MB minified; that is expected.
    chunkSizeWarningLimit: 1600,
  },
  server: { host: true, port: 5173 },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
