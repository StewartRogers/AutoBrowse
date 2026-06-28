// auth.js — single-superuser gate for the AutoBrowse API.
//
// This app is a single-user workbook, so there is no user table and no
// registration: one set of credentials lives in environment variables.
//
//   AUTH_USERNAME       superuser name (default "admin")
//   AUTH_PASSWORD       superuser password (plaintext env var), OR
//   AUTH_PASSWORD_HASH  scrypt hash "salt:hash" (preferred — see scripts/hash-password.mjs)
//   AUTH_SECRET         HMAC key for signing session cookies (optional; falls back to
//                       the password hash/password so sessions are still signed)
//   AUTH_SESSION_DAYS   session lifetime in days (default 30)
//
// The gate is ENABLED when a password is configured. With no password set, local
// dev stays open by default; production fails closed unless AUTH_DISABLED=true is
// set deliberately.
//
// Sessions are stateless: a signed, expiring token in an HttpOnly cookie. No
// server-side session store is needed, which is what makes this work across
// ephemeral serverless instances on Vercel.

import crypto from 'node:crypto';

const USERNAME = process.env.AUTH_USERNAME || 'admin';
const PASSWORD = process.env.AUTH_PASSWORD || '';
const PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH || ''; // "saltHex:hashHex"
const SECRET = process.env.AUTH_SECRET || PASSWORD_HASH || PASSWORD;
const SESSION_DAYS = Number(process.env.AUTH_SESSION_DAYS) || 30;
const COOKIE = 'ab_session';
const AUTH_DISABLED = process.env.AUTH_DISABLED === 'true';
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

export const authMisconfigured = IS_PRODUCTION && !AUTH_DISABLED && !PASSWORD && !PASSWORD_HASH;
export const authEnabled = !AUTH_DISABLED && Boolean(PASSWORD || PASSWORD_HASH);

if (authMisconfigured) {
  console.error('Auth: MISCONFIGURED — set AUTH_PASSWORD_HASH/AUTH_PASSWORD or explicit AUTH_DISABLED=true.');
} else if (!authEnabled) {
  console.warn('Auth: DISABLED (no AUTH_PASSWORD / AUTH_PASSWORD_HASH set) — API is open.');
} else {
  console.log(`Auth: enabled for user "${USERNAME}".`);
}

// ─── Credential checking ──────────────────────────────────────────────────────

// Length-independent constant-time string compare. Hashing both sides to a fixed
// length means the comparison itself never leaks the secret's length via timing.
function safeEqual(a, b) {
  const ah = crypto.createHash('sha256').update(String(a)).digest();
  const bh = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ah, bh);
}

function verifyPassword(password) {
  if (PASSWORD_HASH) {
    const [salt, hash] = PASSWORD_HASH.split(':');
    if (!salt || !hash) return false;
    const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
    return safeEqual(derived, hash);
  }
  if (PASSWORD) return safeEqual(password, PASSWORD);
  return false;
}

// ─── Stateless signed session tokens ──────────────────────────────────────────

function sign(data) {
  return crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
}

function createToken() {
  const exp = Date.now() + SESSION_DAYS * 86400 * 1000;
  const payload = Buffer.from(JSON.stringify({ u: USERNAME, exp })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const dot = token.indexOf('.');
  if (dot === -1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof exp === 'number' && exp > Date.now();
  } catch {
    return false;
  }
}

// ─── Cookies ──────────────────────────────────────────────────────────────────

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

// Secure flag only over HTTPS, so a local http dev session still works if someone
// sets a password locally. Vercel terminates TLS and sets x-forwarded-proto.
function isHttps(req) {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

function setSessionCookie(req, res, token) {
  const secure = isHttps(req) ? ' Secure;' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${token}; Max-Age=${SESSION_DAYS * 86400}; Path=/; HttpOnly; SameSite=Lax;${secure}`,
  );
}

function clearSessionCookie(req, res) {
  const secure = isHttps(req) ? ' Secure;' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax;${secure}`);
}

// ─── Brute-force throttle ─────────────────────────────────────────────────────
// Best-effort, per-instance (serverless may run several instances, so this is
// defence-in-depth on top of a strong password — not a hard guarantee). For a
// hard limit, put Vercel WAF rate limiting in front of /api/login.

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 10;
const fails = new Map(); // ip -> { count, first }

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(ip) {
  const rec = fails.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.first > WINDOW_MS) {
    fails.delete(ip);
    return false;
  }
  return rec.count >= MAX_FAILS;
}

function recordFail(ip) {
  const now = Date.now();
  const rec = fails.get(ip);
  if (!rec || now - rec.first > WINDOW_MS) fails.set(ip, { count: 1, first: now });
  else rec.count += 1;
}

// ─── Express wiring ───────────────────────────────────────────────────────────

// Middleware that rejects unauthenticated requests. No-op when auth is disabled.
export function requireAuth(req, res, next) {
  if (authMisconfigured) {
    return res.status(503).json({ ok: false, error: 'Authentication is not configured on this deployment.' });
  }
  if (!authEnabled) return next();
  const cookies = parseCookies(req);
  if (verifyToken(cookies[COOKIE])) return next();
  return res.status(401).json({ ok: false, error: 'Unauthorized.' });
}

// Registers the public auth endpoints. Call BEFORE mounting requireAuth so these
// stay reachable without a session.
export function installAuthRoutes(app) {
  // GET /api/auth — session/config status used by the frontend gate.
  app.get('/api/auth', (req, res) => {
    const cookies = parseCookies(req);
    if (authMisconfigured) {
      return res.status(503).json({
        ok: false,
        required: true,
        authed: false,
        error: 'Authentication is not configured on this deployment.',
      });
    }
    res.json({ ok: true, required: authEnabled, authed: !authEnabled || verifyToken(cookies[COOKIE]) });
  });

  // POST /api/login — { username?, password } → sets the session cookie.
  app.post('/api/login', (req, res) => {
    if (authMisconfigured) {
      return res.status(503).json({ ok: false, error: 'Authentication is not configured on this deployment.' });
    }
    if (!authEnabled) return res.json({ ok: true, authed: true });

    const ip = clientIp(req);
    if (isRateLimited(ip)) {
      return res.status(429).json({ ok: false, error: 'Too many attempts. Try again later.' });
    }

    const username = String(req.body?.username ?? USERNAME);
    const password = String(req.body?.password ?? '');
    const ok = safeEqual(username, USERNAME) && verifyPassword(password);
    if (!ok) {
      recordFail(ip);
      return res.status(401).json({ ok: false, error: 'Invalid username or password.' });
    }

    fails.delete(ip);
    setSessionCookie(req, res, createToken());
    res.json({ ok: true, authed: true });
  });

  // POST /api/logout — clears the session cookie.
  app.post('/api/logout', (req, res) => {
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });
}
