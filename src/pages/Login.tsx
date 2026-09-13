import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { authApi } from '../lib/api';
import { useSession } from '../lib/session';
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const { setSession } = useSession();
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const d = await authApi.login(email, password);
      localStorage.setItem('cv_token', d.token);
      setSession({ user: d.user, orgId: d.orgId, role: d.role as any });
      nav('/');
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-art">
        <div className="login-brand">
          <Brand />
          <h1>
            Voice infrastructure,
            <br />
            beautifully simple.
          </h1>
          <p>
            Manage numbers, calls, applications and customer communications from
            one workspace.
          </p>
        </div>
        <div className="signal-grid">
          {Array.from({ length: 30 }).map((_, i) => (
            <i key={i} />
          ))}
        </div>
      </div>
      <div className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="mobile login-mobile-brand">
            <Brand />
          </div>
          <div className="eyebrow">Welcome back</div>
          <h2>Sign in to Cloudvoice</h2>
          <p>Use your Cloudvoice account credentials.</p>
          {error && <div className="alert">{error}</div>}
          <label>
            Email address
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
            />
          </label>
          <button className="btn primary wide" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <small>
            Authentication is handled securely by the Cloudvoice API.
            <br />
            Need an account? <Link to="/register">Register</Link>
          </small>
        </form>
      </div>
    </div>
  );
}
