import { useState, type ReactNode } from 'react';
import { ArrowRight, Check, ChevronRight, Copy, Play } from 'lucide-react';
import { answeredBy, humanize } from '../lib/labels';
import type { Call } from '../types/api';
import { Status } from './UI';
// Body of the "Call details" drawer: a summary of who called whom and how it
// went, then the timeline, answering machine detection and technical details
// as label / value rows.
const AMD_SETTINGS: [string, string, string][] = [
  ['initial_silence', 'Initial silence', 'ms'],
  ['greeting', 'Greeting length', 'ms'],
  ['after_greeting_silence', 'Silence after greeting', 'ms'],
  ['total_analysis_time', 'Total analysis time', 'ms'],
  ['maximum_number_of_words', 'Maximum words', ''],
  ['min_word_length', 'Minimum word length', 'ms'],
  ['maximum_word_length', 'Maximum word length', 'ms'],
  ['between_words_silence', 'Silence between words', 'ms'],
  ['silence_threshold', 'Silence threshold', ''],
];
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString() : '—';
const secondsBetween = (a: string | null, b: string | null) =>
  a && b
    ? Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 1000))
    : null;
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="cd-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="cd-copy">
      <code>{value}</code>
      <button
        className="icon-btn"
        aria-label={copied ? 'Copied' : 'Copy call ID'}
        title={copied ? 'Copied' : 'Copy call ID'}
        onClick={() =>
          navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
        }
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
      <span className="sr-only" role="status">
        {copied ? 'Call ID copied' : ''}
      </span>
    </span>
  );
}
export function CallDetails({
  call,
  applicationName,
  onPlay,
}: {
  call: Call;
  applicationName?: string;
  onPlay?: () => void;
}) {
  const ringing = secondsBetween(call.initiated_at, call.answered_at);
  const talk = call.duration_seconds;
  const amd = (call.amd_params || {}) as Record<string, unknown>;
  const amdRows = AMD_SETTINGS.filter(([key]) => amd[key] !== undefined);
  return (
    <div className="cd">
      <section className="cd-summary">
        <span className="cd-kind">
          {call.direction === 'inbound' ? 'Inbound call' : 'Outbound call'}
        </span>
        <div className="cd-route">
          <strong>{call.from_number}</strong>
          <ArrowRight size={16} aria-label="to" />
          <strong>{call.to_number}</strong>
        </div>
        <div className="cd-facts">
          <Status value={call.status} />
          {call.amd_result && <span>{answeredBy(call)}</span>}
          <span>{talk == null ? 'Not connected' : `${talk}s talk time`}</span>
        </div>
        {call.recording_id && onPlay && (
          <button className="btn primary cd-play" onClick={onPlay}>
            <Play size={15} fill="currentColor" /> Play recording
          </button>
        )}
      </section>

      <section className="cd-section">
        <h3>Timeline</h3>
        <ol className="cd-timeline">
          <li>
            <strong>Started</strong>
            <span>{when(call.initiated_at)}</span>
          </li>
          <li className={call.answered_at ? '' : 'cd-skipped'}>
            <strong>Answered</strong>
            <span>
              {call.answered_at
                ? `${when(call.answered_at)}${ringing != null ? ` · after ${ringing}s ringing` : ''}`
                : 'Not answered'}
            </span>
          </li>
          <li className={call.ended_at ? '' : 'cd-skipped'}>
            <strong>Ended</strong>
            <span>
              {call.ended_at
                ? `${when(call.ended_at)} · ${humanize(call.hangup_cause)}`
                : 'Still in progress'}
            </span>
          </li>
        </ol>
      </section>

      <section className="cd-section">
        <h3>Answering machine detection</h3>
        {call.amd_enabled || call.amd_result ? (
          <>
            <dl className="cd-rows">
              <Row label="Answered by">{answeredBy(call)}</Row>
            </dl>
            {amdRows.length > 0 && (
              <details className="cd-more">
                <summary>
                  <ChevronRight size={15} aria-hidden="true" />
                  Settings used
                </summary>
                <dl className="cd-rows">
                  {amdRows.map(([key, label, unit]) => (
                    <Row key={key} label={label}>
                      {String(amd[key])}
                      {unit && ` ${unit}`}
                    </Row>
                  ))}
                </dl>
              </details>
            )}
          </>
        ) : (
          <p className="muted cd-empty">Didn't run on this call.</p>
        )}
      </section>

      <section className="cd-section">
        <h3>Details</h3>
        <dl className="cd-rows">
          <Row label="Call ID">
            <CopyValue value={call.id} />
          </Row>
          <Row label="Application">{applicationName || '—'}</Row>
          <Row label="Recording">
            {call.recording_id
              ? 'Recorded'
              : call.record_calls
                ? 'On, not uploaded yet'
                : 'Off'}
          </Row>
          {call.caller_id_name && call.caller_id_name !== call.from_number && (
            <Row label="Caller ID name">{call.caller_id_name}</Row>
          )}
          {call.time_limit_secs != null && (
            <Row label="Time limit">{call.time_limit_secs}s</Row>
          )}
        </dl>
      </section>
    </div>
  );
}
