import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Webhook as WebhookIcon } from 'lucide-react';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { errorMessage, webhooksApi } from '../lib/api';
import { showToast } from '../lib/toast';
import type { WebhookDelivery, WebhookEndpoint } from '../types/api';
import {
  AddButton,
  Card,
  Drawer,
  Empty,
  PageHeader,
  SecretReveal,
  Spinner,
  Status,
  StatusToggle,
  ConfirmAction,
} from '../components/UI';
import { HoldButton } from '../components/HoldButton';
import {
  CopyValue,
  DetailRow,
  DetailRows,
  DetailSection,
  DetailSummary,
  DetailView,
  ValuePills,
} from '../components/Details';
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
  const navigate = useNavigate();
  const [selected, setSelected] = useState<WebhookEndpoint | null>(null);
  const [secret, setSecret] = useState('');
  const deliveries = useQuery({
    queryKey: ['webhook-deliveries', selected?.id],
    queryFn: () => webhooksApi.deliveries(selected!.id),
    enabled: !!selected,
    refetchInterval: selected ? 10000 : false,
  });
  const close = () => setSelected(null);
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
  const openAdd = () => navigate('/webhooks/new');
  const edit = (w: WebhookEndpoint) => navigate(`/webhooks/${w.id}/edit`);
  function remove(w: WebhookEndpoint) {
    del.mutate(w.id);
  }
  const list = data.data || [];
  return (
    <>
      <PageHeader
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
                          onClick={() => setSelected(w)}
                        >
                          View{' '}
                          <AnimatedIcon
                            icon={ChevronRight}
                            size={14}
                            animation="nudge"
                          />
                        </button>
                        <button
                          className="table-action"
                          onClick={() => edit(w)}
                        >
                          Edit
                        </button>
                        <HoldButton
                          iconOnly
                          aria-label={`Delete the webhook for ${host(w.url)}`}
                          onHold={() => remove(w)}
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
            icon={<WebhookIcon size={16} />}
            title="No webhooks yet"
            text="Add your server's URL and choose which events to send it."
            action={<AddButton onClick={openAdd}>Add webhook</AddButton>}
          />
        )}
      </Card>
      <Drawer
        open={!!selected}
        onClose={close}
        title="Webhook details"
        size="lg"
      >
        {selected && (
          <DetailView>
            <DetailSummary
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
                <ConfirmAction
                  label={rotate.isPending ? 'Rotating…' : 'Rotate secret'}
                  confirmLabel="Yes, rotate secret"
                  consequence="Deliveries are signed with the new secret straight away, so your server must switch to it or it will reject them. The new secret is shown once."
                  busy={rotate.isPending}
                  onConfirm={() => rotate.mutate(selected.id)}
                />
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
