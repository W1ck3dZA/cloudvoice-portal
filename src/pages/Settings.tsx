import { useState, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi, errorMessage } from '../lib/api';
import { humanize } from '../lib/labels';
import { useSession } from '../lib/session';
import { useTheme, type ThemePreference } from '../lib/theme';
import { showToast } from '../lib/toast';
import { Card, ErrorBox, Field, PageHeader } from '../components/UI';
type Editing = 'name' | 'email' | 'password' | null;
const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];
/** One setting: what it is, its current value, and an inline editor. */
function SettingRow({
  label,
  description,
  value,
  open,
  onOpen,
  children,
}: {
  label: string;
  description?: string;
  value?: ReactNode;
  open?: boolean;
  onOpen?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className={'set-row' + (open ? ' open' : '')}>
      <div className="set-head">
        <div className="set-label">
          <strong>{label}</strong>
          {description && <p>{description}</p>}
        </div>
        {value !== undefined && <div className="set-value">{value}</div>}
        {onOpen && !open && (
          <button
            type="button"
            className="btn"
            onClick={onOpen}
            aria-label={`Change ${label.toLowerCase()}`}
          >
            Change
          </button>
        )}
      </div>
      {open && <div className="set-edit">{children}</div>}
    </div>
  );
}
export default function Settings() {
  const { session, setSession } = useSession();
  const { preference, setPreference } = useTheme();
  const user = session?.user;
  const [editing, setEditing] = useState<Editing>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState({ new_email: '', current_password: '' });
  const [pass, setPass] = useState({
    current_password: '',
    new_password: '',
    confirm: '',
  });
  const [err, setErr] = useState('');
  function open(which: Editing) {
    setErr('');
    setName(user?.name || '');
    setEmail({ new_email: user?.email || '', current_password: '' });
    setPass({ current_password: '', new_password: '', confirm: '' });
    setEditing(which);
  }
  const close = () => {
    setErr('');
    setEditing(null);
  };
  const profile = useMutation({
    mutationFn: () => authApi.updateMe({ name: name.trim() }),
    onSuccess: (u) => {
      setSession({ ...session!, user: u });
      close();
      showToast({ kind: 'success', message: 'Name updated.' });
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const changeEmail = useMutation({
    mutationFn: () =>
      authApi.changeEmail({ ...email, new_email: email.new_email.trim() }),
    onSuccess: (u) => {
      setSession({ ...session!, user: { ...session!.user, email: u.email } });
      close();
      showToast({
        kind: 'success',
        message: 'Email updated. Use it the next time you sign in.',
      });
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const password = useMutation({
    mutationFn: () =>
      authApi.changePassword({
        current_password: pass.current_password,
        new_password: pass.new_password,
      }),
    onSuccess: () => {
      close();
      showToast({ kind: 'success', message: 'Password changed.' });
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const initial = (user?.name || user?.email || '?').trim()[0]?.toUpperCase();
  const nameUnchanged = !name.trim() || name.trim() === user?.name;
  const emailUnchanged =
    email.new_email.trim().toLowerCase() === user?.email?.toLowerCase();
  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Your profile, how you sign in, and how the portal looks."
      />
      <div className="settings-page">
        <Card>
          <div className="account-head">
            <span className="account-avatar" aria-hidden="true">
              {initial}
            </span>
            <div className="account-copy">
              <strong>{user?.name || 'Your account'}</strong>
              <span>{user?.email}</span>
            </div>
            {session?.role && (
              <span className="badge">
                <span />
                {humanize(session.role)}
              </span>
            )}
          </div>
        </Card>

        <Card>
          <section className="set-section" aria-labelledby="set-profile">
            <h2 id="set-profile">Profile</h2>
            <SettingRow
              label="Name"
              description="Shown to your team in the portal."
              value={user?.name || '—'}
              open={editing === 'name'}
              onOpen={() => open('name')}
            >
              <form
                className="form-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  setErr('');
                  profile.mutate();
                }}
              >
                <ErrorBox message={err} />
                <Field label="Name">
                  <input
                    autoFocus
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                <div className="set-actions">
                  <button
                    className="btn primary"
                    disabled={profile.isPending || nameUnchanged}
                  >
                    {profile.isPending ? 'Saving…' : 'Save name'}
                  </button>
                  <button type="button" className="btn" onClick={close}>
                    Cancel
                  </button>
                </div>
              </form>
            </SettingRow>
          </section>
        </Card>

        <Card>
          <section className="set-section" aria-labelledby="set-signin">
            <h2 id="set-signin">Sign-in and security</h2>
            <SettingRow
              label="Email"
              description="The address you sign in with."
              value={user?.email || '—'}
              open={editing === 'email'}
              onOpen={() => open('email')}
            >
              <form
                className="form-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  setErr('');
                  changeEmail.mutate();
                }}
              >
                <ErrorBox message={err} />
                <Field
                  label="New email"
                  hint="You'll sign in with this address from now on."
                >
                  <input
                    autoFocus
                    required
                    type="email"
                    autoComplete="email"
                    value={email.new_email}
                    onChange={(e) =>
                      setEmail((v) => ({ ...v, new_email: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Current password" hint="To confirm it's you.">
                  <input
                    required
                    type="password"
                    autoComplete="current-password"
                    value={email.current_password}
                    onChange={(e) =>
                      setEmail((v) => ({
                        ...v,
                        current_password: e.target.value,
                      }))
                    }
                  />
                </Field>
                <div className="set-actions">
                  <button
                    className="btn primary"
                    disabled={changeEmail.isPending || emailUnchanged}
                  >
                    {changeEmail.isPending ? 'Saving…' : 'Save email'}
                  </button>
                  <button type="button" className="btn" onClick={close}>
                    Cancel
                  </button>
                </div>
              </form>
            </SettingRow>
            <SettingRow
              label="Password"
              description="Use a password you don't use anywhere else."
              value="••••••••"
              open={editing === 'password'}
              onOpen={() => open('password')}
            >
              <form
                className="form-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (pass.new_password !== pass.confirm) {
                    setErr("The new passwords don't match.");
                    return;
                  }
                  setErr('');
                  password.mutate();
                }}
              >
                <ErrorBox message={err} />
                <Field label="Current password">
                  <input
                    autoFocus
                    required
                    type="password"
                    autoComplete="current-password"
                    value={pass.current_password}
                    onChange={(e) =>
                      setPass((p) => ({
                        ...p,
                        current_password: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="New password" hint="At least 8 characters.">
                  <input
                    required
                    minLength={8}
                    type="password"
                    autoComplete="new-password"
                    value={pass.new_password}
                    onChange={(e) =>
                      setPass((p) => ({ ...p, new_password: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Confirm new password">
                  <input
                    required
                    minLength={8}
                    type="password"
                    autoComplete="new-password"
                    value={pass.confirm}
                    onChange={(e) =>
                      setPass((p) => ({ ...p, confirm: e.target.value }))
                    }
                  />
                </Field>
                <div className="set-actions">
                  <button className="btn primary" disabled={password.isPending}>
                    {password.isPending ? 'Saving…' : 'Change password'}
                  </button>
                  <button type="button" className="btn" onClick={close}>
                    Cancel
                  </button>
                </div>
              </form>
            </SettingRow>
          </section>
        </Card>

        <Card>
          <section className="set-section" aria-labelledby="set-appearance">
            <h2 id="set-appearance">Appearance</h2>
            <SettingRow
              label="Theme"
              description="System follows your device's light or dark setting. Saved in this browser."
              value={
                <div className="segmented" role="radiogroup" aria-label="Theme">
                  {THEMES.map((t) => (
                    <label
                      key={t.value}
                      className={preference === t.value ? 'on' : ''}
                    >
                      <input
                        type="radio"
                        name="theme"
                        value={t.value}
                        checked={preference === t.value}
                        onChange={() => setPreference(t.value)}
                      />
                      {t.label}
                    </label>
                  ))}
                </div>
              }
            />
          </section>
        </Card>
      </div>
    </>
  );
}
