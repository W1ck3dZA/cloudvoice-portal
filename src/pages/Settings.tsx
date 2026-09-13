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
            <Field label="Email">
              <input disabled value={session?.user.email || ''} />
            </Field>
            <button className="btn primary">Save profile</button>
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
