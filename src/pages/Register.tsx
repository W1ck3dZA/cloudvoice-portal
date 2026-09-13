import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { authApi, errorMessage } from '../lib/api';
import { useSession } from '../lib/session';
export default function Register() {
  const [name, setName] = useState('');
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
      const d = await authApi.register(email, name, password);
      localStorage.setItem('cv_token', d.token);
      setSession({ user: d.user, orgId: d.orgId, role: d.role as any });
      nav('/');
    } catch (e: any) {
      setError(errorMessage(e));
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
            Your voice platform,
            <br />
            one workspace.
          </h1>
          <p>
            Create your Cloudvoice account and start managing communications
            infrastructure.
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
          <div className="eyebrow">Get started</div>
          <h2>Create your account</h2>
          <p>Register a Cloudvoice user account.</p>
          {error && <div className="alert">{error}</div>}
          <label>
            Full name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Email address
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="btn primary wide" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
          <small>
            Already registered? <Link to="/login">Sign in</Link>
          </small>
        </form>
      </div>
    </div>
  );
}
