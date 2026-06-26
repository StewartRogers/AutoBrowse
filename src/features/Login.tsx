import { useState } from 'react';
import { login } from '../lib/authApi';
import Icon from '../components/Icon';
import styles from './Login.module.css';

// Superuser login screen. Username defaults to "admin" but stays editable in case
// AUTH_USERNAME was customised. The password is never stored client-side — on
// success the server sets an HttpOnly session cookie and we drop into the app.
export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const res = await login(username.trim(), password);
    setBusy(false);
    if (res.ok) {
      setPassword('');
      onSuccess();
    } else {
      setError(res.error || 'Login failed.');
      setPassword('');
    }
  }

  return (
    <div className={styles.wrap}>
      <form className={styles.card} onSubmit={submit}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <Icon name="car" size={22} style={{ color: '#fff' }} />
          </div>
          <div>
            <div className={styles.brandName}>AutoBrowse</div>
            <div className={styles.brandSub}>sign in to continue</div>
          </div>
        </div>

        <label className={styles.field}>
          <span>Username</span>
          <input
            className={styles.input}
            type="text"
            autoComplete="username"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>Password</span>
          <input
            className={styles.input}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
          />
        </label>

        {error && <div className={styles.error}>{error}</div>}

        <button className={`btn btn-primary ${styles.submit}`} type="submit" disabled={busy || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
