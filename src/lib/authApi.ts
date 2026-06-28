// authApi.ts — client calls for the single-superuser gate.
// The session lives in an HttpOnly cookie set by the server, so there is no token
// for JS to read or store; same-origin requests send the cookie automatically.

export interface AuthStatus {
  required: boolean; // server has a password configured
  authed: boolean;   // current request carries a valid session (or auth is off)
  error?: string;
}

export async function fetchAuthStatus(): Promise<AuthStatus> {
  try {
    const r = await fetch('/api/auth');
    const j = await r.json().catch(() => ({}));
    if (j?.ok) return { required: !!j.required, authed: !!j.authed };
    if (j?.error) return { required: true, authed: false, error: j.error };
  } catch {
    /* fall through */
  }
  // If we can't reach the status endpoint, fail closed: show the login screen.
  return { required: true, authed: false };
}

export async function login(
  username: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j?.ok) return { ok: true };
    return { ok: false, error: j?.error || `Login failed (${r.status}).` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error.' };
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } catch {
    /* ignore */
  }
}
