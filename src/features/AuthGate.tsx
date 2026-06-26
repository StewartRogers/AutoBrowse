import { useEffect, useState } from 'react';
import { fetchAuthStatus } from '../lib/authApi';
import Login from './Login';

// Gates the whole app behind the superuser login. Children (and therefore the
// store's init() / API reads) only mount once authenticated, so no request races
// ahead of the gate. When auth is disabled on the server, status comes back
// authed:true and this is a transparent pass-through.
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'login' | 'authed'>('checking');

  useEffect(() => {
    let alive = true;
    fetchAuthStatus().then(s => {
      if (alive) setStatus(s.authed ? 'authed' : 'login');
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

  return <>{children}</>;
}
