import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { apiKeysApi, errorMessage } from '../lib/api';
import { useSession } from '../lib/session';
import type { ApiKey } from '../types/api';
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
} from '../components/UI';
export default function ApiKeys() {
  const { session } = useSession();
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ['api-keys'], queryFn: apiKeysApi.list });
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ApiKey | null>(null);
  const [limitsOpen, setLimitsOpen] = useState<ApiKey | null>(null);
  const [limits, setLimits] = useState({
    requests_per_minute: '',
    requests_per_day: '',
  });
  const [secret, setSecret] = useState('');
  const [err, setErr] = useState('');
  const [form, setForm] = useState({
    name: '',
    scopes: 'read',
    expires_at: '',
  });
  const create = useMutation({
    mutationFn: () =>
      apiKeysApi.create({
        name: form.name,
        org_id: session?.orgId,
        scopes: form.scopes
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        expires_at: form.expires_at || null,
      }),
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ['api-keys'] });
      setOpen(false);
      setSecret(d?.key || d?.token || '');
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: apiKeysApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });
  return (
    <>
      <PageHeader
        eyebrow="Developers"
        title="API Keys"
        description="Create scoped credentials for server-to-server integrations."
        action={
          <AddButton onClick={() => setOpen(true)}>Create API key</AddButton>
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
                  <th>Name</th>
                  <th>Prefix</th>
                  <th>Scopes</th>
                  <th>Status</th>
                  <th>Last used</th>
                  <th>Expires</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.data!.map((k) => (
                  <tr key={k.id}>
                    <td>
                      <strong>{k.name}</strong>
                    </td>
                    <td>
                      <code>{k.prefix}</code>
                    </td>
                    <td>{k.scopes.join(', ')}</td>
                    <td>
                      <Status value={k.status} />
                    </td>
                    <td>
                      {k.last_used_at
                        ? new Date(k.last_used_at).toLocaleString()
                        : 'Never'}
                    </td>
                    <td>
                      {k.expires_at
                        ? new Date(k.expires_at).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="table-action"
                          onClick={() => {
                            setLimitsOpen(k);
                            setLimits({
                              requests_per_minute: '',
                              requests_per_day: '',
                            });
                          }}
                        >
                          Limits
                        </button>
                        <RowActions
                          onView={() => setView(k)}
                          onDelete={() =>
                            confirm(`Revoke ${k.name}?`) && del.mutate(k.id)
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={<KeyRound size={16} />}
            text="No API keys have been created."
          />
        )}
      </Card>
      <Drawer open={open} onClose={() => setOpen(false)} title="Create API key">
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setErr('');
            create.mutate();
          }}
        >
          <ErrorBox message={err} />
          <Field label="Name">
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label="Scopes" hint="Comma-separated">
            <input
              value={form.scopes}
              onChange={(e) =>
                setForm((f) => ({ ...f, scopes: e.target.value }))
              }
            />
          </Field>
          <Field label="Expires at">
            <input
              type="datetime-local"
              value={form.expires_at}
              onChange={(e) =>
                setForm((f) => ({ ...f, expires_at: e.target.value }))
              }
            />
          </Field>
          <button className="btn primary" disabled={create.isPending}>
            Create key
          </button>
        </form>
      </Drawer>
      <Drawer
        open={!!view}
        onClose={() => setView(null)}
        title={view?.name || 'API key'}
      >
        {view && (
          <div className="detail-grid">
            <div className="detail-item">
              <span>Prefix</span>
              <strong>{view.prefix}</strong>
            </div>
            <div className="detail-item">
              <span>Status</span>
              <Status value={view.status} />
            </div>
            <div className="detail-item full">
              <span>Scopes</span>
              <strong>{view.scopes.join(', ')}</strong>
            </div>
          </div>
        )}
      </Drawer>
      <Drawer
        open={!!limitsOpen}
        onClose={() => setLimitsOpen(null)}
        title="API key limits"
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            apiKeysApi
              .limits(limitsOpen!.id, {
                requests_per_minute: limits.requests_per_minute
                  ? +limits.requests_per_minute
                  : undefined,
                requests_per_day: limits.requests_per_day
                  ? +limits.requests_per_day
                  : undefined,
              })
              .then(() => setLimitsOpen(null));
          }}
        >
          <Field label="Requests per minute">
            <input
              type="number"
              value={limits.requests_per_minute}
              onChange={(e) =>
                setLimits((v) => ({
                  ...v,
                  requests_per_minute: e.target.value,
                }))
              }
            />
          </Field>
          <Field label="Requests per day">
            <input
              type="number"
              value={limits.requests_per_day}
              onChange={(e) =>
                setLimits((v) => ({ ...v, requests_per_day: e.target.value }))
              }
            />
          </Field>
          <button className="btn primary">Update limits</button>
        </form>
      </Drawer>
      <Drawer open={!!secret} onClose={() => setSecret('')} title="API key">
        <SecretReveal
          title="New API key"
          value={secret}
          onClose={() => setSecret('')}
        />
      </Drawer>
    </>
  );
}
