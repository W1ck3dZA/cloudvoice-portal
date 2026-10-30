import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Webhook as WebhookIcon } from 'lucide-react';
import { errorMessage, webhooksApi } from '../lib/api';
import { showToast } from '../lib/toast';
import { EVENT_GROUPS, ALL_EVENT_TYPES } from '../lib/eventTypes';
import type { WebhookDelivery, WebhookEndpoint } from '../types/api';
import {
  AddButton,
  Card,
  Drawer,
  Empty,
  ErrorBox,
  Field,
  PageHeader,
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
  ValuePills,
} from '../components/Details';
const KNOWN = new Set([
  ...ALL_EVENT_TYPES.map((t) => t.type),
  ...EVENT_GROUPS.flatMap((g) => (g.wildcard ? [g.wildcard.pattern] : [])),
]);
type Form = {
  url: string;
  description: string;
  scope: 'all' | 'some';
  selected: string[];
  custom: string;
  active: boolean;
};
const blank: Form = {
  url: '',
  description: '',
  scope: 'all',
  selected: [],
  custom: '',
  active: true,
};
const host = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};
const SIGNATURE_SNIPPET = `import crypto from 'node:crypto';

// rawBody: the exact request body, before you parse the JSON
function isFromCloudvoice(rawBody, signatureHeader, secret) {
  const expected =
    'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return (
    signatureHeader?.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected))
  );
}`;
const EXAMPLE_BODY = `{
  "id": "4b1f0c8e-2a6d-4f3b-9c7e-1d2a3b4c5d6e",
  "orgId": "c598b016-bfc0-47ee-ade2-5903463b44a5",
  "type": "call.answered",
  "data": {
    "callId": "7c0e84df-3330-4372-b232-735742441222",
    "answeredAt": "2026-10-30T04:40:10.000Z",
    "sipCode": 200,
    "sipText": "OK"
  },
  "createdAt": "2026-10-30T04:40:10.120Z"
}`;
function HowItWorks({ open }: { open: boolean }) {
  return (
    <details className="dv-more wh-how" open={open}>
      <summary>
        <ChevronRight size={15} aria-hidden="true" />
        How webhooks work
      </summary>
      <div className="wh-how-body">
        <ul className="wh-facts">
          <li>
            <strong>What you get.</strong> An HTTPS <code>POST</code> with a
            JSON body each time a subscribed event happens. The body is the
            event: <code>id</code>, <code>orgId</code>, <code>type</code>, the
            event's <code>data</code> and <code>createdAt</code>.
          </li>
          <li>
            <strong>Headers.</strong> <code>X-Webhook-Event</code> (the event
            type), <code>X-Webhook-Delivery</code> (a unique ID for this
            delivery) and <code>X-Webhook-Signature</code>.
          </li>
          <li>
            <strong>Reply quickly.</strong> Answer with any 2xx status within 10
            seconds. Do slow work after you've replied.
          </li>
          <li>
            <strong>Retries.</strong> If your server fails or times out, the
            delivery is tried up to 5 times, waiting 1, 2, 4, 8 and 16 seconds.
            After that it's marked failed and you can retry it from the
            webhook's details.
          </li>
          <li>
            <strong>Duplicates.</strong> A retry can deliver the same event
            twice. Use the event <code>id</code> to ignore repeats.
          </li>
          <li>
            <strong>Testing.</strong>{' '}
            <Link to="/events">Send a test event</Link> to see a delivery
            arrive.
          </li>
        </ul>
        <div className="wh-code">
          <h3>Check the signature</h3>
          <p className="muted">
            The signature is an HMAC-SHA256 of the raw body using your webhook's
            signing secret. Reject requests where it doesn't match.
          </p>
          <pre className="json-preview">{SIGNATURE_SNIPPET}</pre>
          <h3>Example body</h3>
          <pre className="json-preview">{EXAMPLE_BODY}</pre>
        </div>
      </div>
    </details>
  );
}
function eventSummary(types: string[]) {
  if (!types?.length) return 'All events';
  return types.length === 1 ? types[0] : `${types.length} event types`;
}
function DeliveryRow({
  d,
  onRetry,
  retrying,
}: {
  d: WebhookDelivery;
  onRetry: () => void;
  retrying: boolean;
}) {
  const response =
    d.response_status != null
      ? `HTTP ${d.response_status}${d.duration_ms != null ? ` in ${d.duration_ms} ms` : ''}`
      : null;
  return (
    <li className="wh-delivery">
      <div className="wh-delivery-main">
        <div className="wh-delivery-head">
          <Status value={d.status} />
          <code>{d.event_type}</code>
        </div>
        <span>
          {new Date(d.created_at).toLocaleString()} · attempt {d.attempt_count}
          {response && ` · ${response}`}
        </span>
        {d.error_message && <span className="wh-error">{d.error_message}</span>}
        {d.status === 'pending' && d.next_retry_at && (
          <span>
            Next try at {new Date(d.next_retry_at).toLocaleTimeString()}
          </span>
        )}
      </div>
      {d.status === 'failed' && (
        <button
          type="button"
          className="btn"
          disabled={retrying}
          onClick={onRetry}
        >
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      )}
    </li>
  );
}
export default function Webhooks() {
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ['webhooks'], queryFn: webhooksApi.list });
  const [mode, setMode] = useState<'add' | 'edit' | 'view' | null>(null);
  const [selected, setSelected] = useState<WebhookEndpoint | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [err, setErr] = useState('');
  const [secret, setSecret] = useState('');
  const deliveries = useQuery({
    queryKey: ['webhook-deliveries', selected?.id],
    queryFn: () => webhooksApi.deliveries(selected!.id),
    enabled: mode === 'view' && !!selected,
    refetchInterval: mode === 'view' ? 10000 : false,
  });
  const close = () => {
    setMode(null);
    setSelected(null);
    setErr('');
  };
  function eventTypesFromForm() {
    if (form.scope === 'all') return [];
    const custom = form.custom
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    return [...new Set([...form.selected, ...custom])];
  }
  const save = useMutation({
    mutationFn: () => {
      const b = {
        url: form.url.trim(),
        description: form.description.trim(),
        event_types: eventTypesFromForm(),
        active: form.active,
      };
      return mode === 'add'
        ? webhooksApi.create(b)
        : webhooksApi.update(selected!.id, b);
    },
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      if (d?.secret) setSecret(d.secret);
      else showToast({ kind: 'success', message: 'Webhook saved.' });
      close();
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: webhooksApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      close();
      showToast({ kind: 'success', message: 'Webhook deleted.' });
    },
    onError: (e) => showToast({ kind: 'error', message: errorMessage(e) }),
  });
  const rotate = useMutation({
    mutationFn: webhooksApi.rotate,
    onSuccess: (d: any) => setSecret(d?.secret || ''),
    onError: (e) => showToast({ kind: 'error', message: errorMessage(e) }),
  });
  const retry = useMutation({
    mutationFn: (deliveryId: string) =>
      webhooksApi.retry(selected!.id, deliveryId),
    onSuccess: () => {
      deliveries.refetch();
      showToast({ kind: 'success', message: 'Delivery queued again.' });
    },
    onError: (e) => showToast({ kind: 'error', message: errorMessage(e) }),
  });
  const toggleActive = useMutation({
    mutationFn: (w: WebhookEndpoint) =>
      webhooksApi.update(w.id, { active: !w.active }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      setSelected((s) => (s && s.id === updated.id ? updated : s));
    },
  });
  function openAdd() {
    setErr('');
    setForm(blank);
    setMode('add');
  }
  function edit(w: WebhookEndpoint) {
    const types = w.event_types || [];
    setErr('');
    setSelected(w);
    setForm({
      url: w.url,
      description: w.description || '',
      scope: types.length ? 'some' : 'all',
      selected: types.filter((t) => KNOWN.has(t)),
      custom: types.filter((t) => !KNOWN.has(t)).join(', '),
      active: w.active,
    });
    setMode('edit');
  }
  function remove(w: WebhookEndpoint) {
    if (
      confirm(
        `Delete the webhook for ${host(w.url)}? It stops receiving events straight away.`,
      )
    )
      del.mutate(w.id);
  }
  function toggleType(t: string, on: boolean) {
    setForm((f) => ({
      ...f,
      selected: on ? [...f.selected, t] : f.selected.filter((x) => x !== t),
    }));
  }
  const list = data.data || [];
  const noneChosen =
    form.scope === 'some' && !form.selected.length && !form.custom.trim();
  return (
    <>
      <PageHeader
        eyebrow="Developers"
        title="Webhooks"
        description="Get an HTTPS POST to your own server whenever something happens in your account, like a call being answered or an SMS arriving."
        action={<AddButton onClick={openAdd}>Add webhook</AddButton>}
      />
      {!data.isLoading && <HowItWorks open={!list.length} />}
      <Card>
        {data.isLoading ? (
          <Spinner />
        ) : list.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Events</th>
                  <th>Active</th>
                  <th>Updated</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {list.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <div className="cell-stack wh-endpoint">
                        <strong>{w.description || host(w.url)}</strong>
                        <span>{w.url}</span>
                      </div>
                    </td>
                    <td>{eventSummary(w.event_types)}</td>
                    <td>
                      <StatusToggle
                        checked={w.active}
                        onChange={() => toggleActive.mutate(w)}
                        disabled={
                          toggleActive.isPending &&
                          toggleActive.variables?.id === w.id
                        }
                        title={
                          w.active ? 'Pause deliveries' : 'Resume deliveries'
                        }
                      />
                    </td>
                    <td>{new Date(w.updated_at).toLocaleString()}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="table-action"
                          onClick={() => {
                            setSelected(w);
                            setMode('view');
                          }}
                        >
                          View <ChevronRight size={14} />
                        </button>
                        <button
                          className="table-action"
                          onClick={() => edit(w)}
                        >
                          Edit
                        </button>
                        <button
                          className="table-action danger-text"
                          onClick={() => remove(w)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={<WebhookIcon size={16} />}
            title="No webhooks yet"
            text="Add your server's URL and choose which events to send it."
            action={<AddButton onClick={openAdd}>Add webhook</AddButton>}
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
          <DetailView>
            <DetailSummary
              kind="Webhook"
              title={selected.description || host(selected.url)}
              subtitle={selected.url}
              facts={
                <>
                  <Status value={selected.active ? 'active' : 'paused'} />
                  <span>{eventSummary(selected.event_types)}</span>
                </>
              }
            >
              <button className="btn primary" onClick={() => edit(selected)}>
                Edit webhook
              </button>
              <Link className="btn" to="/events">
                Send a test event
              </Link>
            </DetailSummary>
            <DetailSection title="Endpoint">
              <DetailRows>
                <DetailRow label="URL">
                  <CopyValue value={selected.url} label="URL" />
                </DetailRow>
                <DetailRow label="Deliver events">
                  <StatusToggle
                    checked={selected.active}
                    onChange={() => toggleActive.mutate(selected)}
                    disabled={toggleActive.isPending}
                  />
                </DetailRow>
              </DetailRows>
            </DetailSection>
            <DetailSection title="Events">
              {selected.event_types?.length ? (
                <ValuePills values={selected.event_types} />
              ) : (
                <p className="muted dv-empty">
                  Every event, including new types added later.
                </p>
              )}
            </DetailSection>
            <DetailSection title="Signing">
              <DetailRows>
                <DetailRow label="Signing secret">Saved</DetailRow>
                <DetailRow label="Signature header">
                  <code>X-Webhook-Signature</code>
                </DetailRow>
              </DetailRows>
              <div className="dv-actions wh-rotate">
                <button
                  className="btn"
                  disabled={rotate.isPending}
                  onClick={() =>
                    confirm(
                      'Rotate the signing secret? Deliveries are signed with the new secret straight away, so your server must switch to it or it will reject them.',
                    ) && rotate.mutate(selected.id)
                  }
                >
                  {rotate.isPending ? 'Rotating…' : 'Rotate secret'}
                </button>
                <p className="dv-note">
                  The new secret is shown once. Update your server with it
                  straight away.
                </p>
              </div>
            </DetailSection>
            <DetailSection title="Recent deliveries">
              {deliveries.isLoading ? (
                <Spinner />
              ) : (deliveries.data || []).length ? (
                <ul className="wh-deliveries">
                  {(deliveries.data || []).slice(0, 20).map((d) => (
                    <DeliveryRow
                      key={d.id}
                      d={d}
                      retrying={retry.isPending && retry.variables === d.id}
                      onRetry={() => retry.mutate(d.id)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="muted dv-empty">
                  Nothing delivered yet.{' '}
                  <Link to="/events">Send a test event</Link> to check it works.
                </p>
              )}
            </DetailSection>
            <DetailSection title="Details">
              <DetailRows>
                <DetailRow label="Webhook ID">
                  <CopyValue value={selected.id} label="webhook ID" />
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
              setErr('');
              save.mutate();
            }}
          >
            <ErrorBox message={err} />
            <FormSection title="Endpoint">
              <Field
                label="URL"
                hint="An HTTPS address on your server that can be reached from the internet"
              >
                <input
                  required
                  type="url"
                  inputMode="url"
                  placeholder="https://example.com/webhooks/cloudvoice"
                  value={form.url}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, url: e.target.value }))
                  }
                />
              </Field>
              <Field
                label="Description"
                hint="Optional. So you can tell webhooks apart, e.g. CRM sync"
              >
                <input
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </Field>
            </FormSection>
            <FormSection
              title="Events"
              hint="Which events to send to this URL."
            >
              <div className="wh-scope" role="radiogroup" aria-label="Events">
                <label className={form.scope === 'all' ? 'on' : ''}>
                  <input
                    type="radio"
                    name="scope"
                    checked={form.scope === 'all'}
                    onChange={() => setForm((f) => ({ ...f, scope: 'all' }))}
                  />
                  <span>
                    <strong>All events</strong>
                    <small>Including new types added later</small>
                  </span>
                </label>
                <label className={form.scope === 'some' ? 'on' : ''}>
                  <input
                    type="radio"
                    name="scope"
                    checked={form.scope === 'some'}
                    onChange={() => setForm((f) => ({ ...f, scope: 'some' }))}
                  />
                  <span>
                    <strong>Only the events I choose</strong>
                    <small>Pick event types below</small>
                  </span>
                </label>
              </div>
              {form.scope === 'some' && (
                <div className="wh-groups">
                  {EVENT_GROUPS.map((g) => {
                    const whole =
                      !!g.wildcard &&
                      form.selected.includes(g.wildcard.pattern);
                    return (
                      <fieldset className="wh-group" key={g.label}>
                        <legend>{g.label}</legend>
                        <div className="wh-type-grid">
                          {g.wildcard && (
                            <label className="wh-type wh-wild">
                              <input
                                type="checkbox"
                                checked={whole}
                                onChange={(e) =>
                                  toggleType(
                                    g.wildcard!.pattern,
                                    e.target.checked,
                                  )
                                }
                              />
                              <span>
                                <code>{g.wildcard.pattern}</code>
                                <small>{g.wildcard.label}</small>
                              </span>
                            </label>
                          )}
                          {g.types.map((t) => (
                            <label className="wh-type" key={t.type}>
                              <input
                                type="checkbox"
                                disabled={whole}
                                checked={
                                  whole || form.selected.includes(t.type)
                                }
                                onChange={(e) =>
                                  toggleType(t.type, e.target.checked)
                                }
                              />
                              <span>
                                <code>{t.type}</code>
                                <small>{t.label}</small>
                              </span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    );
                  })}
                  <Field
                    label="Other event types"
                    hint="Optional. Your own types from the Event Publisher, separated by commas. Use name.* to match a whole group."
                  >
                    <input
                      value={form.custom}
                      placeholder="test.ping, orders.*"
                      onChange={(e) =>
                        setForm((f) => ({ ...f, custom: e.target.value }))
                      }
                    />
                  </Field>
                  {noneChosen && (
                    <p className="fs-hint" role="alert">
                      Choose at least one event type, or send all events.
                    </p>
                  )}
                </div>
              )}
            </FormSection>
            {mode === 'edit' && (
              <FormSection title="Status">
                <Toggle
                  checked={form.active}
                  onChange={(v) => setForm((f) => ({ ...f, active: v }))}
                  label="Deliver events to this URL"
                />
              </FormSection>
            )}
            {mode === 'add' && (
              <p className="fs-hint">
                After you add it, you'll see the signing secret once. Copy it to
                your server to check signatures.
              </p>
            )}
            <DrawerActions>
              <button
                className="btn primary"
                disabled={save.isPending || noneChosen}
              >
                {save.isPending
                  ? 'Saving…'
                  : mode === 'add'
                    ? 'Add webhook'
                    : 'Save changes'}
              </button>
              <button type="button" className="btn" onClick={close}>
                Cancel
              </button>
              {mode === 'edit' && selected && (
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => remove(selected)}
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
