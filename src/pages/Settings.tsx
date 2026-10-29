import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, errorMessage } from '../lib/api';
import { useSession } from '../lib/session';
import { Card, ErrorBox, Field, PageHeader } from '../components/UI';
export default function Settings() {
  const { session, setSession } = useSession();
  const qc = useQueryClient();
  const [name, setName] = useState(session?.user.name || '');
  const [pass, setPass] = useState({ current_password: '', new_password: '' });
  const [email, setEmail] = useState({
    new_email: session?.user.email || '',
    current_password: '',
  });
  const [emailErr, setEmailErr] = useState('');
  const [emailOk, setEmailOk] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const profile = useMutation({
    mutationFn: () => authApi.updateMe({ name }),
    onSuccess: (u) => {
      setSession({ ...session!, user: u });
      setOk('Profile updated');
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const changeEmail = useMutation({
    mutationFn: () => authApi.changeEmail(email),
    onSuccess: (u) => {
      setSession({ ...session!, user: { ...session!.user, email: u.email } });
      setEmail({ new_email: u.email, current_password: '' });
      setEmailOk('Email updated. Use it the next time you sign in.');
    },
    onError: (e) => setEmailErr(errorMessage(e)),
  });
  const password = useMutation({
    mutationFn: () => authApi.changePassword(pass),
    onSuccess: () => {
      setPass({ current_password: '', new_password: '' });
      setOk('Password changed');
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage your Cloudvoice profile and sign-in security."
      />
      <div className="settings-grid">
        <Card>
          <div className="card-title">
            <div>
              <span className="eyebrow">Profile</span>
              <h2>Personal details</h2>
            </div>
          </div>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              setErr('');
              setOk('');
              profile.mutate();
            }}
          >
            <Field label="Name">
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <button className="btn primary">Save profile</button>
          </form>
        </Card>
        <Card>
          <div className="card-title">
            <div>
              <span className="eyebrow">Sign-in</span>
              <h2>Change email</h2>
            </div>
          </div>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              setEmailErr('');
              setEmailOk('');
              changeEmail.mutate();
            }}
          >
            <ErrorBox message={emailErr} />
            {emailOk && (
              <div className="success-box" role="status">
                {emailOk}
              </div>
            )}
            <Field label="Email" hint="You sign in with this address.">
              <input
                required
                type="email"
                autoComplete="email"
                value={email.new_email}
                onChange={(e) =>
                  setEmail((v) => ({ ...v, new_email: e.target.value }))
                }
              />
            </Field>
            <Field label="Current password">
              <input
                required
                type="password"
                autoComplete="current-password"
                value={email.current_password}
                onChange={(e) =>
                  setEmail((v) => ({ ...v, current_password: e.target.value }))
                }
              />
            </Field>
            <button
              className="btn primary"
              disabled={
                changeEmail.isPending ||
                email.new_email.trim().toLowerCase() === session?.user.email
              }
            >
              Save email
            </button>
          </form>
        </Card>
        <Card>
          <div className="card-title">
            <div>
              <span className="eyebrow">Security</span>
              <h2>Change password</h2>
            </div>
          </div>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              setErr('');
              setOk('');
              password.mutate();
            }}
          >
            <ErrorBox message={err} />
            {ok && <div className="success-box">{ok}</div>}
            <Field label="Current password">
              <input
                required
                type="password"
                value={pass.current_password}
                onChange={(e) =>
                  setPass((p) => ({ ...p, current_password: e.target.value }))
                }
              />
            </Field>
            <Field label="New password">
              <input
                required
                minLength={8}
                type="password"
                value={pass.new_password}
                onChange={(e) =>
                  setPass((p) => ({ ...p, new_password: e.target.value }))
                }
              />
            </Field>
            <button className="btn primary">Change password</button>
          </form>
        </Card>
      </div>
    </>
  );
}
