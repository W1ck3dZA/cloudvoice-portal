import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { appsApi, errorMessage, sipUsersApi } from '../lib/api';
import type { SipUser } from '../types/api';
import {
  AddButton,
  Card,
  Drawer,
  Empty,
  ErrorBox,
  Field,
  PageHeader,
  RowActions,
  SecretReveal,
  Spinner,
  StatusToggle,
  Toggle,
} from '../components/UI';
const blank = {
  extension: '',
  realm: '',
  password: '',
  display_name: '',
  voicemail_enabled: false,
  application_id: '',
  active: true,
};
export default function SipUsers() {
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ['sip-users'], queryFn: sipUsersApi.list });
  const apps = useQuery({ queryKey: ['apps'], queryFn: appsApi.list });
  const [mode, setMode] = useState<'add' | 'edit' | 'view' | null>(null);
  const [selected, setSelected] = useState<SipUser | null>(null);
  const [form, setForm] = useState(blank);
  const [err, setErr] = useState('');
  const [secret, setSecret] = useState('');
  const close = () => {
    setMode(null);
    setSelected(null);
    setErr('');
  };
  const save = useMutation({
    mutationFn: async () =>
      mode === 'add'
        ? sipUsersApi.create({
            ...form,
            realm: form.realm || undefined,
            password: form.password || undefined,
            application_id: form.application_id || null,
          })
        : sipUsersApi.update(selected!.id, {
            display_name: form.display_name,
            voicemail_enabled: form.voicemail_enabled,
            application_id: form.application_id || null,
            active: form.active,
          }),
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ['sip-users'] });
      if (d?.password) setSecret(d.password);
      close();
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: sipUsersApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sip-users'] });
      close();
    },
  });
  const rotate = useMutation({
    mutationFn: (id: string) => sipUsersApi.rotate(id),
    onSuccess: (d: any) => {
      setSecret(d?.password || d?.new_password || '');
      qc.invalidateQueries({ queryKey: ['sip-users'] });
    },
  });
  const toggleActive = useMutation({
    mutationFn: (u: SipUser) => sipUsersApi.update(u.id, { active: !u.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sip-users'] }),
  });
  function edit(u: SipUser) {
    setSelected(u);
    setForm({
      extension: u.extension,
      realm: u.realm,
      password: '',
      display_name: u.display_name || '',
      voicemail_enabled: u.voicemail_enabled,
      application_id: u.application_id || '',
      active: u.active,
    });
    setMode('edit');
  }
  return (
    <>
      <PageHeader
        eyebrow="Voice"
        title="SIP Users"
        description="Manage registered extensions, voicemail and default inbound applications."
        action={
          <AddButton
            onClick={() => {
              setForm(blank);
              setMode('add');
            }}
          >
            Add SIP user
          </AddButton>
        }
      />
      <Card>
        {data.isLoading ? (
          <Spinner />
        ) : (data.data || []).length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Extension</th>
                  <th>Display name</th>
                  <th>Realm</th>
                  <th>Voicemail</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.data!.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.extension}</strong>
                    </td>
                    <td>{u.display_name || '—'}</td>
                    <td>{u.realm}</td>
                    <td>{u.voicemail_enabled ? 'Enabled' : 'Off'}</td>
                    <td>
                      <StatusToggle
                        checked={u.active}
                        onChange={() => toggleActive.mutate(u)}
                        disabled={
                          toggleActive.isPending &&
                          toggleActive.variables?.id === u.id
                        }
                      />
                    </td>
                    <td>
                      <RowActions
                        onView={() => {
                          setSelected(u);
                          setMode('view');
                        }}
                        onEdit={() => edit(u)}
                        onDelete={() =>
                          confirm(`Delete SIP user ${u.extension}?`) &&
                          del.mutate(u.id)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={<Users size={16} />}
            text="No SIP users have been created."
          />
        )}
      </Card>
      <Drawer
        open={!!mode}
        onClose={close}
        title={
          mode === 'add'
            ? 'Add SIP user'
            : mode === 'edit'
              ? 'Edit SIP user'
              : selected?.extension || 'SIP user'
        }
      >
        {mode === 'view' && selected ? (
          <>
            <div className="detail-grid">
              <div className="detail-item">
                <span>Extension</span>
                <strong>{selected.extension}</strong>
              </div>
              <div className="detail-item">
                <span>Realm</span>
                <strong>{selected.realm}</strong>
              </div>
              <div className="detail-item">
                <span>Display name</span>
                <strong>{selected.display_name || '—'}</strong>
              </div>
              <div className="detail-item">
                <span>Voicemail</span>
                <strong>
                  {selected.voicemail_enabled ? 'Enabled' : 'Disabled'}
                </strong>
              </div>
            </div>
            <div className="button-row">
              <button className="btn primary" onClick={() => edit(selected)}>
                Edit
              </button>
              <button
                className="btn"
                onClick={() => rotate.mutate(selected.id)}
              >
                Rotate password
              </button>
            </div>
          </>
        ) : (
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <ErrorBox message={err} />
            <Field label="Extension">
              <input
                value={form.extension}
                disabled={mode === 'edit'}
                required
                onChange={(e) =>
                  setForm((f) => ({ ...f, extension: e.target.value }))
                }
              />
            </Field>
            {mode === 'add' && (
              <>
                <Field
                  label="Realm"
                  hint="Leave blank to use the platform default"
                >
                  <input
                    value={form.realm}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, realm: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Password" hint="Leave blank to auto-generate">
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                  />
                </Field>
              </>
            )}
            <Field label="Display name">
              <input
                value={form.display_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, display_name: e.target.value }))
                }
              />
            </Field>
            <Field label="Default application">
              <select
                value={form.application_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, application_id: e.target.value }))
                }
              >
                <option value="">None</option>
                {(apps.data || []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Toggle
              checked={form.voicemail_enabled}
              onChange={(v) => setForm((f) => ({ ...f, voicemail_enabled: v }))}
              label="Voicemail enabled"
            />
            {mode === 'edit' && (
              <Toggle
                checked={form.active}
                onChange={(v) => setForm((f) => ({ ...f, active: v }))}
                label="SIP user active"
              />
            )}
            <button className="btn primary" disabled={save.isPending}>
              Save SIP user
            </button>
          </form>
        )}
      </Drawer>
      <Drawer
        open={!!secret}
        onClose={() => setSecret('')}
        title="SIP password"
      >
        <SecretReveal
          title="New SIP password"
          value={secret}
          onClose={() => setSecret('')}
        />
      </Drawer>
    </>
  );
}
