import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { eventsApi, wsUrl } from '../lib/api';
import { useSession } from '../lib/session';
import { Card, PageHeader } from '../components/UI';
type ConnState = 'disconnected' | 'connecting' | 'connected';
type Entry = {
  id: number;
  at: Date;
  kind: 'received' | 'sent' | 'connection';
  title: string;
  body?: unknown;
};
const MAX_ENTRIES = 200;
const STATE_LABEL: Record<ConnState, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
};
const KIND_LABEL: Record<Entry['kind'], string> = {
  received: 'Received',
  sent: 'Sent',
  connection: 'Connection',
};
const EVENT_GROUPS = [
  [
    'Calls',
    'call.created, call.trying, call.progress, call.progress-media, call.answered, call.completed, call.failed, call.amd',
  ],
  [
    'Call flows',
    'call.flow.started, call.flow.verb, call.flow.gather, call.flow.unsupported_verb, call.flow.completed',
  ],
  ['Queues', 'call.queue.entered, call.queue.agent_bridged, call.queue.left'],
  [
    'Recordings',
    'call.recording.started, call.recording.complete, recording.uploaded',
  ],
  [
    'SMS',
    'sms.queued, sms.sent, sms.delivered, sms.failed, sms.status, sms.received',
  ],
  ['Custom', 'Any type you publish with POST /v1/events'],
] as const;
const ENVELOPE = `{
  "id": "6f1c…",
  "orgId": "b2d4…",
  "type": "call.answered",
  "data": {
    "callId": "9a7e…",
    "answeredAt": "2026-10-30T09:15:02.000Z",
    "sipCode": 200,
    "sipText": "OK"
  },
  "createdAt": "2026-10-30T09:15:02.114Z"
}`;
const EXAMPLE = `const ws = new WebSocket(
  '${wsUrl}?token=' + process.env.CLOUDVOICE_API_KEY,
);

ws.onmessage = (msg) => {
  const event = JSON.parse(msg.data);
  if (event.type === 'call.completed') {
    console.log('Call ended', event.data.callId);
  }
};`;
export default function WebSocketPage() {
  const { session } = useSession();
  const [state, setState] = useState<ConnState>('disconnected');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [publishing, setPublishing] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const nextId = useRef(1);
  function log(kind: Entry['kind'], title: string, body?: unknown) {
    const entry = { id: nextId.current++, at: new Date(), kind, title, body };
    setEntries((list) => [entry, ...list].slice(0, MAX_ENTRIES));
  }
  function connect() {
    const token = localStorage.getItem('cv_token');
    if (!token) return log('connection', 'Sign in again to connect');
    setState('connecting');
    let opened = false;
    const ws = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;
    ws.onopen = () => {
      opened = true;
      setState('connected');
      log('connection', 'Connected');
    };
    ws.onmessage = (msg) => {
      let body: unknown = msg.data;
      try {
        body = JSON.parse(msg.data);
      } catch {
        /* show the raw text */
      }
      const type = (body as { type?: string })?.type;
      log('received', type || 'Message', body);
    };
    ws.onclose = (e) => {
      if (wsRef.current === ws) wsRef.current = null;
      setState('disconnected');
      log(
        'connection',
        opened
          ? `Disconnected (code ${e.code})`
          : 'Connection refused. Your session may have expired, so sign in again and retry.',
      );
    };
  }
  function disconnect() {
    wsRef.current?.close(1000);
  }
  function ping() {
    const msg = { type: 'ping' };
    wsRef.current?.send(JSON.stringify(msg));
    log('sent', 'ping', msg);
  }
  async function publishTest() {
    setPublishing(true);
    try {
      await eventsApi.publish({
        type: 'custom.test',
        payload: { message: 'Hello from the WebSocket page' },
        org_id: session?.orgId || undefined,
      });
    } catch {
      /* the API client shows the error */
    } finally {
      setPublishing(false);
    }
  }
  useEffect(() => () => wsRef.current?.close(1000), []);
  const connected = state === 'connected';
  return (
    <>
      <PageHeader
        title="WebSocket"
        description="Receive this organisation's events the moment they happen, without polling."
      />
      <Card className="ws-live">
        <div className="card-title">
          <div>
            <h2>Live connection</h2>
          </div>
          <span className={`ws-state ws-state-${state}`} role="status">
            <span className="ws-dot" />
            {STATE_LABEL[state]}
          </span>
        </div>
        <p className="muted">
          This connects with your signed-in session and shows every event for
          this organisation as it arrives. Your own apps should connect with an
          API key that has the Read scope.
        </p>
        <div className="button-row">
          {state === 'disconnected' ? (
            <button className="btn primary" onClick={connect}>
              Connect
            </button>
          ) : (
            <button className="btn primary" onClick={disconnect}>
              Disconnect
            </button>
          )}
          <button className="btn" onClick={ping} disabled={!connected}>
            Send ping
          </button>
          <button
            className="btn"
            onClick={publishTest}
            disabled={!connected || publishing}
          >
            {publishing ? 'Publishing…' : 'Publish test event'}
          </button>
          <button
            className="btn"
            onClick={() => setEntries([])}
            disabled={!entries.length}
          >
            Clear
          </button>
        </div>
        <div className="ws-log" aria-live="polite">
          {entries.length ? (
            entries.map((e) => (
              <details key={e.id} className={`ws-entry ws-entry-${e.kind}`}>
                <summary>
                  <time>{e.at.toLocaleTimeString()}</time>
                  <span className="ws-kind">{KIND_LABEL[e.kind]}</span>
                  <strong>{e.title}</strong>
                </summary>
                {e.body !== undefined && (
                  <pre className="json-preview">
                    {typeof e.body === 'string'
                      ? e.body
                      : JSON.stringify(e.body, null, 2)}
                  </pre>
                )}
              </details>
            ))
          ) : (
            <p className="muted ws-empty">
              {connected
                ? 'Waiting for events. Place a call, send an SMS or publish a test event.'
                : 'Connect to start receiving events.'}
            </p>
          )}
        </div>
      </Card>
      <div className="settings-grid ws-docs">
        <Card>
          <div className="card-title">
            <div>
              <h2>How it works</h2>
            </div>
          </div>
          <ol className="ws-steps">
            <li>
              <strong>Connect</strong>
              <span>
                Open a WebSocket to the address below, with an API key as the
                token. The key needs the Read scope. If the key is wrong or
                revoked, the connection is refused before it opens.
              </span>
              <code className="ws-url">{wsUrl}?token=YOUR_API_KEY</code>
            </li>
            <li>
              <strong>Receive events</strong>
              <span>
                Every event for the key's organisation arrives as a JSON text
                message. <code>type</code> says what happened and{' '}
                <code>data</code> holds the details.
              </span>
              <pre className="json-preview">{ENVELOPE}</pre>
            </li>
            <li>
              <strong>Stay connected</strong>
              <span>
                The server pings every 30 seconds and closes connections that
                stop answering. Browsers and most WebSocket libraries answer
                automatically. You can also send{' '}
                <code>{'{"type":"ping"}'}</code> and get{' '}
                <code>{'{"type":"pong"}'}</code> back. Reconnect if the
                connection drops.
              </span>
            </li>
          </ol>
          <pre className="json-preview">{EXAMPLE}</pre>
        </Card>
        <Card>
          <div className="card-title">
            <div>
              <h2>Event types</h2>
            </div>
          </div>
          <div className="detail-grid">
            {EVENT_GROUPS.map(([group, types]) => (
              <div className="detail-item full" key={group}>
                <span>{group}</span>
                <strong className="ws-types">{types}</strong>
              </div>
            ))}
          </div>
          <p className="muted ws-note">
            The same events go to your <Link to="/webhooks">webhooks</Link>. Use
            the <Link to="/events">Event Publisher</Link> to send your own.
          </p>
        </Card>
      </div>
    </>
  );
}
