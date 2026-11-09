#!/usr/bin/env node
// Builds dist/ — the static assets Cloudflare serves for palmleafpartners.com.
//
//   node tools/build-cloudflare.mjs     (run by `npm run build` / `npm run deploy`)
//
// What it does:
//   1. Copies every git-TRACKED file (so untracked work-in-progress media is
//      never published), minus repo plumbing that should not be public.
//   2. Writes dist/_headers (security + cache headers; was vercel.json).
//   3. Writes dist/assets/maps-config.js from $GOOGLE_MAPS_API_KEY, falling
//      back to the local, gitignored assets/maps-config.js.
//   4. Refuses to build if any file exceeds the Workers 25 MiB per-asset limit.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const MAX_ASSET_BYTES = 25 * 1024 * 1024;

// Not part of the public site.
const EXCLUDE = [
  /^\./, // .gitignore, .assetsignore, .github/ …
  /^worker\//,
  /^tools\//,
  /^wrangler\.jsonc$/,
  /^package(-lock)?\.json$/,
  /^README\.md$/,
  /^middleware\.js$/, // replaced by worker/index.js
  /^vercel\.json$/,
  // Over the 25 MiB per-file limit and not linked from any page.
  /^assets\/videos\/mboka-trailer-v3l\.mp4$/,
  /^assets\/videos\/mboka-teaser-trailer-v5b\.mp4$/,
  /^assets\/videos\/mboka-teaser-trailer\.mp4$/,
];

const HEADERS = `/*
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin

/assets/images/*
  Cache-Control: public, max-age=31536000, immutable

/css/*
  Cache-Control: public, max-age=86400, must-revalidate

/js/*
  Cache-Control: public, max-age=86400, must-revalidate
`;

rmSync(dist, { recursive: true, force: true });

// `git ls-files --eol` lines look like "i/lf    w/crlf  attr/   <TAB>path".
// Files stored with LF but checked out with CRLF (core.autocrlf on Windows)
// are written back with LF, so the bytes match what git — and a Linux CI —
// would publish.
const crlfToLf = new Set();
const tracked = execFileSync('git', ['ls-files', '--eol', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .map((line) => {
    const tab = line.indexOf('\t');
    const info = line.slice(0, tab);
    const f = line.slice(tab + 1);
    if (/^i\/lf\s+w\/crlf/.test(info)) crlfToLf.add(f);
    return f;
  })
  .filter((f) => !EXCLUDE.some((re) => re.test(f)))
  .filter((f) => existsSync(join(root, f))); // skip tracked-but-deleted files

const tooBig = [];
for (const f of tracked) {
  const src = join(root, f);
  if (statSync(src).size > MAX_ASSET_BYTES) tooBig.push(f);
  const dest = join(dist, f);
  mkdirSync(dirname(dest), { recursive: true });
  if (crlfToLf.has(f)) writeFileSync(dest, readFileSync(src, 'utf8').replace(/\r\n/g, '\n'));
  else copyFileSync(src, dest);
}
if (tooBig.length) {
  console.error(`These files exceed the 25 MiB Workers asset limit:\n  ${tooBig.join('\n  ')}`);
  process.exit(1);
}

writeFileSync(join(dist, '_headers'), HEADERS);

let mapsKey = process.env.GOOGLE_MAPS_API_KEY;
if (!mapsKey) {
  const local = join(root, 'assets', 'maps-config.js');
  const m = existsSync(local) && readFileSync(local, 'utf8').match(/__plpMapsKey\s*=\s*["']([^"']+)["']/);
  mapsKey = m ? m[1] : '';
}
if (!mapsKey) console.warn('WARNING: no Google Maps key (set GOOGLE_MAPS_API_KEY) — maps will not load.');
mkdirSync(join(dist, 'assets'), { recursive: true });
writeFileSync(join(dist, 'assets', 'maps-config.js'), `window.__plpMapsKey = '${mapsKey}';\n`);

console.log(`dist/ built: ${tracked.length} files + _headers + assets/maps-config.js`);
