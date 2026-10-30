import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts';
import { callsApi, numbersApi, appsApi, smsApi } from '../lib/api';
import { answeredBy } from '../lib/labels';
import { useSession } from '../lib/session';
import {
  Card,
  Drawer,
  PageHeader,
  Spinner,
  Status,
  rowOpen,
  RowMain,
} from '../components/UI';
import { usePlayer } from '../components/AudioPlayer';
import {
  CallDetails,
  callParty,
  callSummary,
  callTrack,
} from '../components/CallDetails';
import type { Call } from '../types/api';
type Range = 'today' | 'week' | 'month';
const ranges: { key: Range; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Last week' },
  { key: 'month', label: 'Last month' },
];
function buildSeries<T>(
  items: T[],
  getDate: (item: T) => string,
  range: Range,
  valueKey: string,
) {
  const now = new Date();
  if (range === 'today') {
    return Array.from({ length: 24 }, (_, h) => {
      const start = new Date(now);
      start.setHours(h, 0, 0, 0);
      const end = new Date(start);
      end.setHours(h + 1);
      const count = items.filter((item) => {
        const d = new Date(getDate(item));
        return d >= start && d < end;
      }).length;
      return {
        name: start
          .toLocaleTimeString('en-US', { hour: 'numeric' })
          .replace(' ', ''),
        [valueKey]: count,
      };
    });
  }
  const spanDays = range === 'week' ? 7 : 30;
  return Array.from({ length: spanDays }, (_, i) => {
    const day = new Date(now);
    day.setDate(now.getDate() - (spanDays - 1 - i));
    day.setHours(0, 0, 0, 0);
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    const count = items.filter((item) => {
      const d = new Date(getDate(item));
      return d >= day && d < next;
    }).length;
    return {
      name:
        range === 'week'
          ? day.toLocaleDateString('en-US', { weekday: 'short' })
          : day.toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'short',
            }),
      [valueKey]: count,
    };
  });
}
export default function Dashboard() {
  const { session } = useSession();
  const [range, setRange] = useState<Range>('week');
  const [view, setView] = useState<Call | null>(null);
  const player = usePlayer();
  const numbers = useQuery({
    queryKey: ['numbers', session?.orgId],
    queryFn: () => numbersApi.list(session?.orgId || undefined),
  });
  const calls = useQuery({
    queryKey: ['calls'],
    queryFn: () => callsApi.list({ limit: 200 }),
  });
  const apps = useQuery({ queryKey: ['apps'], queryFn: appsApi.list });
  const messages = useQuery({
    queryKey: ['sms'],
    queryFn: () => smsApi.list({ limit: 200 }),
  });
  const all = calls.data || [];
  const allMessages = messages.data || [];
  const recent = all.slice(0, 6);
  const answered = all.filter((c) =>
    ['answered', 'completed'].includes(c.status),
  ).length;
  const chart = buildSeries(all, (c) => c.initiated_at, range, 'calls');
  const messageChart = buildSeries(
    allMessages,
    (m) => m.created_at,
    range,
    'messages',
  );
  const xAxisInterval = range === 'today' ? 2 : range === 'month' ? 4 : 0;
  if (numbers.isLoading && calls.isLoading) return <Spinner />;
  return (
    <>
      <PageHeader
        title={`Good day${session?.user?.name ? ' ' + session.user.name.split(' ')[0] : ''}.`}
        description="Here’s what’s happening across your Cloudvoice account."
      />
      <section className="hero dash-hero" aria-label="Calls">
        <div className="lbl">Calls</div>
        <div className="big">{all.length}</div>
        <div className="hero-facts">
          {all.length
            ? `${Math.round((answered / all.length) * 100)}% answered`
            : 'No calls yet'}
          {' · '}
          {(numbers.data || []).filter((n) => n.active).length} active numbers
          {' · '}
          {(apps.data || []).length} applications
        </div>
      </section>
      <div className="section-headbar">
        <h2 className="section-title">Activity</h2>
        <div className="range-toggle">
          {ranges.map((r) => (
            <button
              key={r.key}
              className={range === r.key ? 'active' : ''}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="dash-grid">
        <Card className="chart-card">
          <div className="card-title">
            <div>
              <h2>Call activity</h2>
            </div>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis
                  dataKey="name"
                  axisLine={{ stroke: 'var(--line2)' }}
                  tickLine={false}
                  interval={xAxisInterval}
                  fontSize={11}
                  tick={{ fill: 'var(--mute)' }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--line)',
                    borderRadius: 10,
                    color: 'var(--fg)',
                  }}
                  labelStyle={{ color: 'var(--fg)' }}
                  itemStyle={{ color: 'var(--fg)' }}
                  cursor={{ stroke: 'var(--line)' }}
                />
                <Area
                  type="monotone"
                  dataKey="calls"
                  name={'Calls'}
                  stroke="var(--s1)"
                  strokeWidth={2}
                  fill="var(--s1)"
                  fillOpacity={0.1}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="chart-card">
          <div className="card-title">
            <div>
              <h2>Message activity</h2>
            </div>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={messageChart}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis
                  dataKey="name"
                  axisLine={{ stroke: 'var(--line2)' }}
                  tickLine={false}
                  interval={xAxisInterval}
                  fontSize={11}
                  tick={{ fill: 'var(--mute)' }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--line)',
                    borderRadius: 10,
                    color: 'var(--fg)',
                  }}
                  labelStyle={{ color: 'var(--fg)' }}
                  itemStyle={{ color: 'var(--fg)' }}
                  cursor={{ stroke: 'var(--line)' }}
                />
                <Area
                  type="monotone"
                  dataKey="messages"
                  name={'Messages'}
                  stroke="var(--s1)"
                  strokeWidth={2}
                  fill="var(--s1)"
                  fillOpacity={0.1}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <Card>
        <div className="card-title">
          <div>
            <h2>Recent calls</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table className="rt">
            <thead>
              <tr>
                <th>Direction</th>
                <th className="hide-md">From</th>
                <th>To</th>
                <th>Status</th>
                <th className="hide-md">Answered by</th>
                <th className="hide-md">Duration</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((c) => (
                <tr key={c.id} {...rowOpen(() => setView(c))}>
                  <RowMain
                    onOpen={() => setView(c)}
                    label={`Open the call with ${callParty(c)}`}
                    title={callParty(c)}
                    sub={callSummary(c)}
                  >
                    <span className="caps">{c.direction}</span>
                  </RowMain>
                  <td className="hide-md">{c.from_number}</td>
                  <td>{c.to_number}</td>
                  <td className="c-end">
                    <Status value={c.status} />
                  </td>
                  <td className="hide-md">{answeredBy(c)}</td>
                  <td className="hide-md">
                    {c.duration_seconds == null
                      ? '—'
                      : `${c.duration_seconds}s`}
                  </td>
                  <td>{new Date(c.initiated_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Drawer open={!!view} onClose={() => setView(null)} title="Call details">
        {view && (
          <CallDetails
            call={view}
            applicationName={
              apps.data?.find((a) => a.id === view.application_id)?.name
            }
            onPlay={() => view.recording_id && player.play(callTrack(view))}
          />
        )}
      </Drawer>
    </>
  );
}
