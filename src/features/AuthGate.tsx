import { useEffect, useState } from 'react';
import { fetchAuthStatus } from '../lib/authApi';
import Login from './Login';

// Gates the whole app behind the superuser login. Children (and therefore the
// store's init() / API reads) only mount once authenticated, so no request races
// ahead of the gate. When auth is disabled on the server, status comes back
// authed:true and this is a transparent pass-through.
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'login' | 'authed' | 'blocked'>('checking');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetchAuthStatus().then(s => {
      if (!alive) return;
      if (s.error) {
        setError(s.error);
        setStatus('blocked');
      } else {
        setStatus(s.authed ? 'authed' : 'login');
      }
    });
    return () => { alive = false; };
  }, []);

  if (status === 'checking') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--ink-soft)', fontFamily: 'var(--sans)', fontSize: 14 }}>
        Checking access…
      </div>
    );
  }

  if (status === 'login') {
    return <Login onSuccess={() => setStatus('authed')} />;
  }

  if (status === 'blocked') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24, color: 'var(--ink)', fontFamily: 'var(--sans)' }}>
        <div style={{ maxWidth: 420, padding: 20, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--paper)' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>AutoBrowse is locked</div>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{error}</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
