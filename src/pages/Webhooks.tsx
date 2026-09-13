import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Webhook as WebhookIcon } from 'lucide-react';
import { errorMessage, webhooksApi } from '../lib/api';
import type { WebhookEndpoint } from '../types/api';
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
const blank = { url: '', description: '', event_types: '', active: true };
export default function Webhooks() {
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ['webhooks'], queryFn: webhooksApi.list });
  const [mode, setMode] = useState<'add' | 'edit' | 'view' | null>(null);
  const [selected, setSelected] = useState<WebhookEndpoint | null>(null);
  const [form, setForm] = useState(blank);
  const [err, setErr] = useState('');
  const [secret, setSecret] = useState('');
  const deliveries = useQuery({
    queryKey: ['webhook-deliveries', selected?.id],
    queryFn: () => webhooksApi.deliveries(selected!.id),
    enabled: mode === 'view' && !!selected,
  });
  const close = () => {
    setMode(null);
    setSelected(null);
    setErr('');
  };
  const save = useMutation({
    mutationFn: () => {
      const b = {
        url: form.url,
        description: form.description,
        event_types: form.event_types
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        active: form.active,
      };
      return mode === 'add'
        ? webhooksApi.create(b)
        : webhooksApi.update(selected!.id, b);
    },
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      if (d?.secret) setSecret(d.secret);
      close();
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: webhooksApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });
  const rotate = useMutation({
    mutationFn: webhooksApi.rotate,
    onSuccess: (d: any) => setSecret(d?.secret || ''),
  });
  const toggleActive = useMutation({
    mutationFn: (w: WebhookEndpoint) =>
      webhooksApi.update(w.id, { active: !w.active }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      setSelected((s) => (s && s.id === updated.id ? updated : s));
    },
  });
  function edit(w: WebhookEndpoint) {
    setSelected(w);
    setForm({
      url: w.url,
      description: w.description || '',
      event_types: (w.event_types || []).join(','),
      active: w.active,
    });
    setMode('edit');
  }
  return (
    <>
      <PageHeader
        eyebrow="Developers"
        title="Webhooks"
        description="Manage event subscriptions, signing secrets and delivery attempts."
        action={
          <AddButton
            onClick={() => {
              setForm(blank);
              setMode('add');
            }}
          >
            Add webhook
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
                  <th>Endpoint</th>
                  <th>Events</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.data!.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <strong>{w.description || 'Webhook'}</strong>
                      <div className="muted truncate">{w.url}</div>
                    </td>
                    <td>
                      {w.event_types?.length
                        ? w.event_types.join(', ')
                        : 'All events'}
                    </td>
                    <td>
                      <StatusToggle
                        checked={w.active}
                        onChange={() => toggleActive.mutate(w)}
                        disabled={
                          toggleActive.isPending &&
                          toggleActive.variables?.id === w.id
                        }
                      />
                    </td>
                    <td>{new Date(w.updated_at).toLocaleString()}</td>
                    <td>
                      <RowActions
                        onView={() => {
                          setSelected(w);
                          setMode('view');
                        }}
                        onEdit={() => edit(w)}
                        onDelete={() =>
                          confirm('Delete this webhook?') && del.mutate(w.id)
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
            icon={<WebhookIcon size={16} />}
            text="No webhooks configured."
          />
        )}
      </Card>
      <Drawer
        open={!!mode}
        onClose={close}
        title={
          mode === 'add'
            ? 'Add webhook'
            : mode === 'edit'
              ? 'Edit webhook'
              : 'Webhook details'
        }
        size="lg"
      >
        {mode === 'view' && selected ? (
          <>
            <div className="detail-grid">
              <div className="detail-item full">
                <span>URL</span>
                <strong>{selected.url}</strong>
              </div>
              <div className="detail-item">
                <span>Events</span>
                <strong>
                  {selected.event_types?.length
                    ? selected.event_types.join(', ')
                    : 'All'}
                </strong>
              </div>
              <div className="detail-item">
                <span>Status</span>
                <StatusToggle
                  checked={selected.active}
                  onChange={() => toggleActive.mutate(selected)}
                  disabled={
                    toggleActive.isPending &&
                    toggleActive.variables?.id === selected.id
                  }
                />
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
                Rotate secret
              </button>
            </div>
            <h3 className="section-title">Recent deliveries</h3>
            {deliveries.isLoading ? (
              <Spinner />
            ) : (
              <div className="stack-list">
                {(deliveries.data || []).slice(0, 20).map((d) => (
                  <div className="list-row" key={d.id}>
                    <div>
                      <strong>{d.event_type}</strong>
                      <span>
                        {new Date(d.created_at).toLocaleString()} · attempt{' '}
                        {d.attempt_count}
                      </span>
                    </div>
                    <div className="row-actions">
                      <Status value={d.status} />
                      {d.status === 'failed' && (
                        <button
                          className="table-action"
                          onClick={() =>
                            webhooksApi
                              .retry(selected.id, d.id)
                              .then(() => deliveries.refetch())
                          }
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
            <Field label="Endpoint URL">
              <input
                required
                type="url"
                value={form.url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, url: e.target.value }))
                }
              />
            </Field>
            <Field label="Description">
              <input
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </Field>
            <Field
              label="Event types"
              hint="Comma-separated. Leave blank to receive all events"
            >
              <textarea
                rows={5}
                value={form.event_types}
                onChange={(e) =>
                  setForm((f) => ({ ...f, event_types: e.target.value }))
                }
              />
            </Field>
            {mode === 'edit' && (
              <Toggle
                checked={form.active}
                onChange={(v) => setForm((f) => ({ ...f, active: v }))}
                label="Webhook active"
              />
            )}
            <button className="btn primary" disabled={save.isPending}>
              Save webhook
            </button>
          </form>
        )}
      </Drawer>
      <Drawer
        open={!!secret}
        onClose={() => setSecret('')}
        title="Webhook secret"
      >
        <SecretReveal
          title="Signing secret"
          value={secret}
          onClose={() => setSecret('')}
        />
      </Drawer>
    </>
  );
}
