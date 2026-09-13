import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AppWindow, PhoneCall, RadioTower } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { callsApi, numbersApi, appsApi, smsApi } from '../lib/api';
import { useSession } from '../lib/session';
import { Card, PageHeader, Spinner, Status } from '../components/UI';
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
        eyebrow="Overview"
        title={`Good day${session?.user?.name ? ' ' + session.user.name.split(' ')[0] : ''}.`}
        description="Here’s what’s happening across your Cloudvoice account."
      />
      <div className="metric-grid">
        <Metric
          icon={<RadioTower />}
          label="Active numbers"
          value={(numbers.data || []).filter((n) => n.active).length}
        />
        <Metric icon={<PhoneCall />} label="Calls" value={all.length} />
        <Metric
          icon={<Activity />}
          label="Answered"
          value={
            all.length ? `${Math.round((answered / all.length) * 100)}%` : '—'
          }
        />
        <Metric
          icon={<AppWindow />}
          label="Applications"
          value={(apps.data || []).length}
        />
      </div>
      <div className="section-headbar">
        <span className="eyebrow">Activity</span>
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
              <span className="eyebrow">Traffic</span>
              <h2>Call activity</h2>
            </div>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="cv" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="currentColor"
                      stopOpacity={0.22}
                    />
                    <stop
                      offset="95%"
                      stopColor="currentColor"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  interval={xAxisInterval}
                  fontSize={11}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 10,
                    color: 'var(--text)',
                  }}
                  labelStyle={{ color: 'var(--text)' }}
                  itemStyle={{ color: 'var(--text)' }}
                  cursor={{ stroke: 'var(--line)' }}
                />
                <Area
                  type="monotone"
                  dataKey="calls"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  fill="url(#cv)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="chart-card">
          <div className="card-title">
            <div>
              <span className="eyebrow">Messaging</span>
              <h2>Message activity</h2>
            </div>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={messageChart}>
                <defs>
                  <linearGradient id="cv-msg" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="currentColor"
                      stopOpacity={0.22}
                    />
                    <stop
                      offset="95%"
                      stopColor="currentColor"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  interval={xAxisInterval}
                  fontSize={11}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 10,
                    color: 'var(--text)',
                  }}
                  labelStyle={{ color: 'var(--text)' }}
                  itemStyle={{ color: 'var(--text)' }}
                  cursor={{ stroke: 'var(--line)' }}
                />
                <Area
                  type="monotone"
                  dataKey="messages"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  fill="url(#cv-msg)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <Card>
        <div className="card-title">
          <div>
            <span className="eyebrow">Latest activity</span>
            <h2>Recent calls</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Direction</th>
                <th>From</th>
                <th>To</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((c) => (
                <tr key={c.id}>
                  <td className="caps">{c.direction}</td>
                  <td>{c.from_number}</td>
                  <td>{c.to_number}</td>
                  <td>
                    <Status value={c.status} />
                  </td>
                  <td>
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
    </>
  );
}
function Metric({
  icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="metric">
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </Card>
  );
}
