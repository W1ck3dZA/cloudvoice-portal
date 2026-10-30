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
  Status,
  StatusToggle,
  Toggle,
} from '../components/UI';
import {
  CopyValue,
  DetailRow,
  DetailRows,
  DetailSection,
  DetailSummary,
  DetailView,
  DrawerActions,
  FormSection,
} from '../components/Details';
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
              : 'SIP user details'
        }
      >
        {mode === 'view' && selected ? (
          <DetailView>
            <DetailSummary
              kind="SIP user"
              title={selected.display_name || selected.extension}
              subtitle={`${selected.extension}@${selected.realm}`}
              facts={
                <>
                  <Status value={selected.active ? 'active' : 'inactive'} />
                  <span>
                    {selected.voicemail_enabled
                      ? 'Voicemail on'
                      : 'Voicemail off'}
                  </span>
                </>
              }
            >
              <button className="btn primary" onClick={() => edit(selected)}>
                Edit SIP user
              </button>
              <button
                className="btn"
                disabled={rotate.isPending}
                onClick={() =>
                  confirm(
                    `Rotate the password for ${selected.extension}? Phones using the old password stop registering until you update them.`,
                  ) && rotate.mutate(selected.id)
                }
              >
                {rotate.isPending ? 'Rotating…' : 'Rotate password'}
              </button>
              <p className="dv-note">
                Rotating sets a new password. Phones using the old one stop
                registering until you update them.
              </p>
            </DetailSummary>
            <DetailSection title="Registration">
              <DetailRows>
                <DetailRow label="SIP username">
                  <CopyValue
                    value={`${selected.extension}@${selected.realm}`}
                    label="SIP username"
                  />
                </DetailRow>
                <DetailRow label="Extension">{selected.extension}</DetailRow>
                <DetailRow label="Realm">{selected.realm}</DetailRow>
                <DetailRow label="Password">Saved</DetailRow>
              </DetailRows>
            </DetailSection>
            <DetailSection title="Calling">
              <DetailRows>
                <DetailRow label="Default application">
                  {apps.data?.find((a) => a.id === selected.application_id)
                    ?.name || 'None'}
                </DetailRow>
                <DetailRow label="Voicemail">
                  {selected.voicemail_enabled ? 'On' : 'Off'}
                </DetailRow>
              </DetailRows>
            </DetailSection>
            <DetailSection title="Details">
              <DetailRows>
                <DetailRow label="SIP user ID">
                  <CopyValue value={selected.id} label="SIP user ID" />
                </DetailRow>
                <DetailRow label="Created">
                  {new Date(selected.created_at).toLocaleString()}
                </DetailRow>
                <DetailRow label="Last updated">
                  {new Date(selected.updated_at).toLocaleString()}
                </DetailRow>
              </DetailRows>
            </DetailSection>
          </DetailView>
        ) : (
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <ErrorBox message={err} />
            <FormSection title="Account">
              <Field
                label="Extension"
                hint={
                  mode === 'edit'
                    ? "Can't be changed once created"
                    : 'The number phones register with, e.g. 1001'
                }
              >
                <input
                  value={form.extension}
                  disabled={mode === 'edit'}
                  required
                  inputMode="numeric"
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
                  <Field
                    label="Password"
                    hint="Leave blank to generate a strong one. It's shown once after saving."
                  >
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, password: e.target.value }))
                      }
                    />
                  </Field>
                </>
              )}
            </FormSection>
            <FormSection title="Profile">
              <Field
                label="Display name"
                hint="Shown as the caller name on internal calls"
              >
                <input
                  value={form.display_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, display_name: e.target.value }))
                  }
                />
              </Field>
            </FormSection>
            <FormSection title="Calling">
              <Field
                label="Default application"
                hint="Runs for calls this user makes"
              >
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
                onChange={(v) =>
                  setForm((f) => ({ ...f, voicemail_enabled: v }))
                }
                label="Voicemail"
              />
              {mode === 'edit' && (
                <Toggle
                  checked={form.active}
                  onChange={(v) => setForm((f) => ({ ...f, active: v }))}
                  label="Allow this user to register and make calls"
                />
              )}
            </FormSection>
            <DrawerActions>
              <button className="btn primary" disabled={save.isPending}>
                {save.isPending
                  ? 'Saving…'
                  : mode === 'add'
                    ? 'Add SIP user'
                    : 'Save changes'}
              </button>
              <button type="button" className="btn" onClick={close}>
                Cancel
              </button>
              {mode === 'edit' && selected && (
                <button
                  type="button"
                  className="btn danger"
                  onClick={() =>
                    confirm(
                      `Delete SIP user ${selected.extension}? Phones using it stop working, and this can't be undone.`,
                    ) && del.mutate(selected.id)
                  }
                >
                  Delete
                </button>
              )}
            </DrawerActions>
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
