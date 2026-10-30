import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';
import { eventsApi, errorMessage } from '../lib/api';
import { useSession } from '../lib/session';
import { showToast } from '../lib/toast';
import { ALL_EVENT_TYPES, describeEventType } from '../lib/eventTypes';
import { Card, ErrorBox, Field, PageHeader } from '../components/UI';
import { FormSection, DrawerActions } from '../components/Details';
// Example payloads: what the platform itself sends for these event types.
const TEMPLATES: { label: string; type: string; data: object }[] = [
  {
    label: 'Test ping',
    type: 'test.ping',
    data: { message: 'Hello from Cloudvoice' },
  },
  {
    label: 'Call answered',
    type: 'call.answered',
    data: {
      callId: '7c0e84df-3330-4372-b232-735742441222',
      answeredAt: '2026-10-30T04:40:10.000Z',
      sipCode: 200,
      sipText: 'OK',
    },
  },
  {
    label: 'SMS received',
    type: 'sms.received',
    data: {
      smsId: '0f4b6a2e-8c1d-4e7f-9a3b-5d2c1e0f9a8b',
      from: '+27623182874',
      to: '+27100562194',
      body: 'Thanks, see you then.',
      encoding: 'gsm7',
      segments: 1,
      receivedAt: '2026-10-30T04:41:00.000Z',
    },
  },
];
const pretty = (v: unknown) => JSON.stringify(v, null, 2);
type Published = {
  id: string;
  orgId: string;
  type: string;
  data: unknown;
  createdAt: string;
};
export default function EventTester() {
  const { session } = useSession();
  const [type, setType] = useState(TEMPLATES[0].type);
  const [payload, setPayload] = useState(pretty(TEMPLATES[0].data));
  const [err, setErr] = useState('');
  const [result, setResult] = useState<Published | null>(null);
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => {
    if (!payload.trim()) return { ok: true as const, value: {} };
    try {
      const value = JSON.parse(payload);
      if (value === null || typeof value !== 'object' || Array.isArray(value))
        return {
          ok: false as const,
          message:
            'The payload must be a JSON object, e.g. { "key": "value" }.',
        };
      return { ok: true as const, value };
    } catch (e) {
      return { ok: false as const, message: (e as Error).message };
    }
  }, [payload]);
  const known = describeEventType(type.trim());
  function applyTemplate(t: (typeof TEMPLATES)[number]) {
    setType(t.type);
    setPayload(pretty(t.data));
    setResult(null);
    setErr('');
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!parsed.ok) return;
    setErr('');
    setBusy(true);
    try {
      const r = (await eventsApi.publish({
        type: type.trim(),
        payload: parsed.value,
        org_id: session?.orgId || undefined,
      })) as Published;
      setResult(r);
      showToast({ kind: 'success', message: `Published ${r.type}.` });
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  // What subscribers will receive: the platform fills in id, orgId and createdAt.
  const preview = result ?? {
    id: '(assigned when published)',
    orgId: session?.orgId || '(your organisation)',
    type: type.trim() || '(event type)',
    data: parsed.ok ? parsed.value : '(fix the JSON to preview)',
    createdAt: '(set when published)',
  };
  return (
    <>
      <PageHeader
        title="Event publisher"
        description="Send a test event to everything listening for this organisation's events, to check your webhooks and WebSocket clients handle it. It doesn't touch any calls or messages."
      />
      <Card className="ev-how">
        <h2>How it works</h2>
        <ol className="ev-steps">
          <li>
            <strong>You publish an event</strong>
            <span>
              Give it a type, like <code>test.ping</code>, and any JSON data.
            </span>
          </li>
          <li>
            <strong>WebSocket clients get it straight away</strong>
            <span>
              Every client connected to this organisation's live feed.{' '}
              <Link to="/websocket">Open the WebSocket page</Link> to watch.
            </span>
          </li>
          <li>
            <strong>Matching webhooks get a signed POST</strong>
            <span>
              Only webhooks subscribed to this type, or to all events.{' '}
              <Link to="/webhooks">See your webhooks</Link> for delivery
              results.
            </span>
          </li>
        </ol>
      </Card>
      <div className="ev-grid">
        <Card>
          <form className="form-stack" onSubmit={submit}>
            <ErrorBox message={err} />
            <FormSection
              title="Start from a template"
              hint="These use the same data the platform sends for real events."
            >
              <div className="ev-templates">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    className={'btn' + (t.type === type ? ' ev-on' : '')}
                    onClick={() => applyTemplate(t)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </FormSection>
            <FormSection title="Event">
              <Field
                label="Event type"
                hint={
                  known
                    ? `Platform event: ${known}. Your integration will treat it like a real one.`
                    : 'Your own type, e.g. test.ping. Use dots to group related events.'
                }
              >
                <input
                  required
                  list="event-types"
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value);
                    setResult(null);
                  }}
                  placeholder="test.ping"
                />
                <datalist id="event-types">
                  {ALL_EVENT_TYPES.map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.label}
                    </option>
                  ))}
                </datalist>
              </Field>
              <Field
                label="Data (JSON)"
                hint="Sent to subscribers as the data field."
              >
                <textarea
                  rows={11}
                  spellCheck={false}
                  className="ev-json"
                  value={payload}
                  onChange={(e) => {
                    setPayload(e.target.value);
                    setResult(null);
                  }}
                />
              </Field>
              <p
                className={'ev-check ' + (parsed.ok ? 'ok' : 'bad')}
                role="status"
              >
                {parsed.ok ? 'Valid JSON' : `Invalid JSON: ${parsed.message}`}
              </p>
            </FormSection>
            <DrawerActions>
              <button
                className="btn primary"
                disabled={busy || !parsed.ok || !type.trim()}
              >
                <Send size={15} />
                {busy ? 'Publishing…' : 'Publish event'}
              </button>
            </DrawerActions>
          </form>
        </Card>
        <Card className="ev-result">
          <h2>{result ? 'Published' : 'What subscribers will receive'}</h2>
          <p className="muted">
            {result
              ? `Sent at ${new Date(result.createdAt).toLocaleTimeString()}. This is the event your WebSocket clients and matching webhooks received.`
              : 'The platform adds the id, orgId and createdAt when you publish.'}
          </p>
          <pre className="json-preview">{pretty(preview)}</pre>
          <p className="muted ev-headers">
            Webhooks get this as the request body, with the headers{' '}
            <code>X-Webhook-Event</code>, <code>X-Webhook-Delivery</code> and{' '}
            <code>X-Webhook-Signature</code>.
          </p>
        </Card>
      </div>
    </>
  );
}
