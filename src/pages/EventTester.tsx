import { useState } from 'react';
import { eventsApi, errorMessage } from '../lib/api';
import { useSession } from '../lib/session';
import { Card, ErrorBox, Field, PageHeader } from '../components/UI';
export default function EventTester() {
  const { session } = useSession();
  const [type, setType] = useState('custom.test');
  const [payload, setPayload] = useState(
    '{\n  "message": "Hello from Cloudvoice"\n}',
  );
  const [err, setErr] = useState('');
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: any) {
    e.preventDefault();
    setErr('');
    setResult(null);
    try {
      setBusy(true);
      const p = payload.trim() ? JSON.parse(payload) : {};
      setResult(
        await eventsApi.publish({
          type,
          payload: p,
          org_id: session?.orgId || undefined,
        }),
      );
    } catch (e: any) {
      setErr(
        e instanceof SyntaxError
          ? 'Payload must be valid JSON'
          : errorMessage(e),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Developers"
        title="Event Publisher"
        description="Publish a test event to this organisation's WebSocket and webhook subscribers."
      />
      <div className="settings-grid">
        <Card>
          <form className="form-stack" onSubmit={submit}>
            <ErrorBox message={err} />
            <Field label="Event type">
              <input
                required
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="custom.test"
              />
            </Field>
            <Field label="Payload JSON">
              <textarea
                rows={14}
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
              />
            </Field>
            <button className="btn primary" disabled={busy}>
              {busy ? 'Publishing…' : 'Publish event'}
            </button>
          </form>
        </Card>
        <Card>
          <div className="card-title">
            <div>
              <span className="eyebrow">Result</span>
              <h2>API response</h2>
            </div>
          </div>
          {result ? (
            <pre className="json-preview">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : (
            <p className="muted">
              Publish an event to see the returned event record.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
