// ════════════════════════════════════════════════════════════════════
// Cloudflare Worker for palmleafpartners.com.
//
// The site is static and is served by Workers Static Assets (see
// wrangler.jsonc and tools/build-cloudflare.mjs). This Worker only sees
// requests under /pages/mboka/ (wrangler.jsonc → assets.run_worker_first),
// where it enforces HTTP Basic Auth for the PRIVATE Mboka showcase. It
// replaces the old Vercel Edge Middleware (middleware.js).
//
//   • /pages/mboka            → PUBLIC  (pages/mboka.html)     → never gated
//   • /pages/mboka/           → redirects to /pages/mboka       → never gated
//   • /pages/mboka/<anything> → PRIVATE (showcase, academy-demo) → gated
//
// Password source (this repo is PUBLIC — never commit the plaintext):
//   • Primary:  the MBOKA_PAGE_PASSWORD Worker secret
//              (`npx wrangler secret put MBOKA_PAGE_PASSWORD`). If set, it wins.
//   • Fallback: the SHA-256 hash below of the agreed preview password.
// Username: any (suggested "mboka"); only the password is checked.
// ════════════════════════════════════════════════════════════════════

const EXPECTED_HASH = '31cbfdd56ca883a2e8afb5aef335135591d18c3a69ce0a9bd61eacb8422f431c';

// The same security headers the static assets get from _headers, so the
// Worker's own 401 responses carry them too.
const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

function isPrivatePath(pathname) {
  return pathname.startsWith('/pages/mboka/') && pathname !== '/pages/mboka/';
}

function unauthorized() {
  return new Response('Authentication required.', {
    status: 401,
    headers: {
      ...SECURITY_HEADERS,
      'WWW-Authenticate': 'Basic realm="Mboka - Private Preview", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

// Constant-time comparison over the longer input.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

async function sha256hex(input) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function isAuthorized(request, env) {
  const header = request.headers.get('authorization') || '';
  if (!header.toLowerCase().startsWith('basic ')) return false;

  let decoded;
  try {
    decoded = atob(header.slice(6).trim());
  } catch {
    return false;
  }
  const sep = decoded.indexOf(':');
  if (sep < 0) return false;

  const expectedHash = env.MBOKA_PAGE_PASSWORD
    ? await sha256hex(env.MBOKA_PAGE_PASSWORD)
    : EXPECTED_HASH;
  return safeEqual(await sha256hex(decoded.slice(sep + 1)), expectedHash);
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (isPrivatePath(pathname)) {
      if (!(await isAuthorized(request, env))) return unauthorized();
      // Never let a shared cache hold a gated page.
      const res = await env.ASSETS.fetch(request);
      const out = new Response(res.body, res);
      out.headers.set('Cache-Control', 'private, no-store');
      return out;
    }
    return env.ASSETS.fetch(request);
  },
};
