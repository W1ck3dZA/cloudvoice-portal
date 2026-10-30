import { ArrowRight, ChevronRight, Play } from 'lucide-react';
import { answeredBy, humanize } from '../lib/labels';
import type { Call } from '../types/api';
import {
  CopyValue,
  DetailRow,
  DetailRows,
  DetailSection,
  DetailSummary,
  DetailView,
} from './Details';
import { Status } from './UI';
// Body of the "Call details" drawer: a summary of who called whom and how it
// went, then the timeline, answering machine detection and technical details.
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
    <DetailView>
      <DetailSummary
        kind={call.direction === 'inbound' ? 'Inbound call' : 'Outbound call'}
        title={
          <span className="dv-route">
            {call.from_number}
            <ArrowRight size={16} aria-label="to" />
            {call.to_number}
          </span>
        }
        facts={
          <>
            <Status value={call.status} />
            {call.amd_result && <span>{answeredBy(call)}</span>}
            <span>{talk == null ? 'Not connected' : `${talk}s talk time`}</span>
          </>
        }
      >
        {call.recording_id && onPlay && (
          <button className="btn primary" onClick={onPlay}>
            <Play size={15} fill="currentColor" /> Play recording
          </button>
        )}
      </DetailSummary>

      <DetailSection title="Timeline">
        <ol className="dv-timeline">
          <li>
            <strong>Started</strong>
            <span>{when(call.initiated_at)}</span>
          </li>
          <li className={call.answered_at ? '' : 'dv-skipped'}>
            <strong>Answered</strong>
            <span>
              {call.answered_at
                ? `${when(call.answered_at)}${ringing != null ? ` · after ${ringing}s ringing` : ''}`
                : 'Not answered'}
            </span>
          </li>
          <li className={call.ended_at ? '' : 'dv-skipped'}>
            <strong>Ended</strong>
            <span>
              {call.ended_at
                ? `${when(call.ended_at)} · ${humanize(call.hangup_cause)}`
                : 'Still in progress'}
            </span>
          </li>
        </ol>
      </DetailSection>

      <DetailSection title="Answering machine detection">
        {call.amd_enabled || call.amd_result ? (
          <>
            <DetailRows>
              <DetailRow label="Answered by">{answeredBy(call)}</DetailRow>
            </DetailRows>
            {amdRows.length > 0 && (
              <details className="dv-more">
                <summary>
                  <ChevronRight size={15} aria-hidden="true" />
                  Settings used
                </summary>
                <DetailRows>
                  {amdRows.map(([key, label, unit]) => (
                    <DetailRow key={key} label={label}>
                      {String(amd[key])}
                      {unit && ` ${unit}`}
                    </DetailRow>
                  ))}
                </DetailRows>
              </details>
            )}
          </>
        ) : (
          <p className="muted dv-empty">Didn't run on this call.</p>
        )}
      </DetailSection>

      <DetailSection title="Details">
        <DetailRows>
          <DetailRow label="Call ID">
            <CopyValue value={call.id} label="call ID" />
          </DetailRow>
          <DetailRow label="Application">{applicationName || '—'}</DetailRow>
          <DetailRow label="Recording">
            {call.recording_id
              ? 'Recorded'
              : call.record_calls
                ? 'On, not uploaded yet'
                : 'Off'}
          </DetailRow>
          {call.caller_id_name && call.caller_id_name !== call.from_number && (
            <DetailRow label="Caller ID name">{call.caller_id_name}</DetailRow>
          )}
          {call.time_limit_secs != null && (
            <DetailRow label="Time limit">{call.time_limit_secs}s</DetailRow>
          )}
        </DetailRows>
      </DetailSection>
    </DetailView>
  );
}
