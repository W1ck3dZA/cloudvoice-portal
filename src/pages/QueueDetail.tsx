import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  PhoneCall,
  Plus,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { agentsApi, audioFilesApi, errorMessage, queuesApi } from '../lib/api';
import { useSession } from '../lib/session';
import {
  Card,
  Drawer,
  Empty,
  ErrorBox,
  Field,
  PageHeader,
  Spinner,
  Status,
  StatusToggle,
  rowOpen,
  RowMain,
} from '../components/UI';
import { HoldButton } from '../components/HoldButton';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { humanize } from '../lib/labels';
export default function QueueDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { session } = useSession();
  const orgId = session?.orgId || '';
  const [autoRefresh, setAutoRefresh] = useState(false);
  const queue = useQuery({
    queryKey: ['queue', id],
    queryFn: () => queuesApi.get(id!),
    enabled: !!id,
  });
  const stats = useQuery({
    queryKey: ['queue-stats', id],
    queryFn: () => queuesApi.stats(id!),
    enabled: !!id,
    refetchInterval: autoRefresh ? 10000 : false,
  });
  const members = useQuery({
    queryKey: ['queue-members', id],
    queryFn: () => queuesApi.members(id!),
    enabled: !!id,
    refetchInterval: autoRefresh ? 5000 : false,
  });
  const tiers = useQuery({
    queryKey: ['queue-tiers', id],
    queryFn: () => queuesApi.tiers(id!),
    enabled: !!id,
  });
  const agents = useQuery({ queryKey: ['agents'], queryFn: agentsApi.list });
  const audioFiles = useQuery({
    queryKey: ['audio-files', orgId],
    queryFn: () => audioFilesApi.list(orgId, 200, 0),
    enabled: !!orgId,
  });
  const mohName =
    (audioFiles.data || []).find((f) => f.url === queue.data?.moh_sound)
      ?.name || queue.data?.moh_sound;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ agent_id: '', level: '1', position: '1' });
  const [err, setErr] = useState('');
  const add = useMutation({
    mutationFn: () =>
      queuesApi.addTier(id!, {
        agent_id: form.agent_id,
        level: +form.level,
        position: +form.position,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queue-tiers', id] });
      setOpen(false);
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const refreshAll = () => {
    queue.refetch();
    stats.refetch();
    members.refetch();
    tiers.refetch();
  };
  if (queue.isLoading) return <Spinner />;
  if (!queue.data)
    return <Empty icon={<Search size={16} />} text="Queue not found." />;
  const s = stats.data;
  return (
    <>
      <Link className="dp-back queue-back" to="/call-center">
        <ChevronLeft size={16} aria-hidden="true" />
        Call center
      </Link>
      <PageHeader
        title={queue.data.name}
        description={queue.data.strategy}
        action={
          <button className="btn" onClick={refreshAll}>
            <AnimatedIcon
              icon={RefreshCw}
              size={16}
              animation="spin"
              active={queue.isFetching || stats.isFetching}
            />
            Refresh
          </button>
        }
      />
      <section className="hero dash-hero" aria-label="Live queue">
        <div className="lbl">Waiting now</div>
        <div className="big">{s?.currently_waiting ?? '—'}</div>
        <div className="hero-facts">
          {s?.available_agents ?? '—'} available agents ·{' '}
          {s?.total_answered ?? queue.data.calls_answered} answered ·{' '}
          {s?.total_abandoned ?? queue.data.calls_abandoned} abandoned
        </div>
      </section>
      <div className="dash-grid">
        <Card>
          <div className="card-title">
            <div>
              <h2>Queue performance</h2>
            </div>
            <StatusToggle
              checked={autoRefresh}
              onChange={() => setAutoRefresh((v) => !v)}
              title={autoRefresh ? 'Auto-refresh on' : 'Auto-refresh off'}
            />
          </div>
          <div className="detail-grid">
            <div className="detail-item">
              <span>Currently bridged</span>
              <strong>{s?.currently_bridged ?? '—'}</strong>
            </div>
            <div className="detail-item">
              <span>Average wait</span>
              <strong>
                {s?.avg_wait_seconds == null
                  ? '—'
                  : `${s.avg_wait_seconds.toFixed(1)}s`}
              </strong>
            </div>
            <div className="detail-item">
              <span>Average talk</span>
              <strong>
                {s?.avg_talk_seconds == null
                  ? '—'
                  : `${s.avg_talk_seconds.toFixed(1)}s`}
              </strong>
            </div>
            <div className="detail-item">
              <span>Agents on call</span>
              <strong>{s?.agents_on_call ?? '—'}</strong>
            </div>
          </div>
        </Card>
        <Card>
          <div className="card-title">
            <div>
              <h2>Routing</h2>
            </div>
          </div>
          <div className="detail-grid">
            <div className="detail-item">
              <span>Strategy</span>
              <strong>{queue.data.strategy}</strong>
            </div>
            <div className="detail-item">
              <span>Max wait</span>
              <strong>{queue.data.max_wait_time || 'No limit'}</strong>
            </div>
            <div className="detail-item">
              <span>MOH</span>
              <strong>{mohName || '—'}</strong>
            </div>
            <div className="detail-item">
              <span>No answer status</span>
              <strong>{humanize(queue.data.agent_no_answer_status)}</strong>
            </div>
          </div>
        </Card>
      </div>
      <Card>
        <div className="card-title">
          <div>
            <h2>Queue callers</h2>
          </div>
          <span className="muted">
            Live and historical · refreshes every 5 seconds
          </span>
        </div>
        {members.isLoading ? (
          <Spinner />
        ) : (members.data || []).length ? (
          <div className="table-wrap">
            <table className="rt">
              <thead>
                <tr>
                  <th>Caller</th>
                  <th>Status</th>
                  <th>Agent</th>
                  <th>Joined</th>
                  <th className="hide-md">Bridged</th>
                </tr>
              </thead>
              <tbody>
                {members.data!.map((m) => (
                  <tr key={m.id}>
                    <RowMain
                      sub={[
                        m.agent_name ? `with ${m.agent_name}` : null,
                        `joined ${new Date(m.joined_at).toLocaleTimeString()}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    >
                      {m.cid_number || m.cid_name || 'Unknown'}
                    </RowMain>
                    <td className="c-end">
                      <Status value={m.status} />
                    </td>
                    <td>{m.agent_name || '—'}</td>
                    <td>{new Date(m.joined_at).toLocaleTimeString()}</td>
                    <td className="hide-md">
                      {m.bridged_at
                        ? new Date(m.bridged_at).toLocaleTimeString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={<PhoneCall size={16} />}
            text="No callers are currently present in this queue."
          />
        )}
      </Card>
      <Card className="tier-card">
        <div className="card-title">
          <div>
            <h2>Tier assignments</h2>
          </div>
          <button className="btn primary" onClick={() => setOpen(true)}>
            <AnimatedIcon
              icon={Plus}
              size={15}
              animation="press"
              trigger="click"
            />{' '}
            Add agent
          </button>
        </div>
        {tiers.isLoading ? (
          <Spinner />
        ) : (tiers.data || []).length ? (
          <div className="table-wrap">
            <table className="rt">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Status</th>
                  <th>State</th>
                  <th>Level</th>
                  <th>Position</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tiers.data!.map((t) => (
                  <tr key={t.agent_id}>
                    <RowMain
                      title={t.agent_name}
                      sub={`${humanize(t.agent_status)} · level ${t.level} · position ${t.position}`}
                    >
                      <strong>{t.agent_name}</strong>
                    </RowMain>
                    <td>
                      <Status value={t.agent_status} />
                    </td>
                    <td className="hide-md">{humanize(t.agent_state)}</td>
                    <td>
                      <input
                        className="mini-input"
                        type="number"
                        defaultValue={t.level}
                        onBlur={(e) =>
                          queuesApi
                            .updateTier(id!, t.agent_id, {
                              level: +e.target.value,
                            })
                            .then(() =>
                              qc.invalidateQueries({
                                queryKey: ['queue-tiers', id],
                              }),
                            )
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="mini-input"
                        type="number"
                        defaultValue={t.position}
                        onBlur={(e) =>
                          queuesApi
                            .updateTier(id!, t.agent_id, {
                              position: +e.target.value,
                            })
                            .then(() =>
                              qc.invalidateQueries({
                                queryKey: ['queue-tiers', id],
                              }),
                            )
                        }
                      />
                    </td>
                    <td className="c-end">
                      <HoldButton
                        iconOnly
                        aria-label={`Remove ${t.agent_name} from this queue`}
                        onHold={() =>
                          queuesApi.removeTier(id!, t.agent_id).then(() =>
                            qc.invalidateQueries({
                              queryKey: ['queue-tiers', id],
                            }),
                          )
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
            icon={<Users size={16} />}
            text="No agents are assigned to this queue."
          />
        )}
      </Card>
      <Drawer open={open} onClose={() => setOpen(false)} title="Assign agent">
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setErr('');
            add.mutate();
          }}
        >
          <ErrorBox message={err} />
          <Field label="Agent">
            <select
              required
              value={form.agent_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, agent_id: e.target.value }))
              }
            >
              <option value="">Select agent…</option>
              {(agents.data || [])
                .filter(
                  (a) => !(tiers.data || []).some((t) => t.agent_id === a.id),
                )
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Level">
            <input
              type="number"
              min="1"
              value={form.level}
              onChange={(e) =>
                setForm((f) => ({ ...f, level: e.target.value }))
              }
            />
          </Field>
          <Field label="Position">
            <input
              type="number"
              min="1"
              value={form.position}
              onChange={(e) =>
                setForm((f) => ({ ...f, position: e.target.value }))
              }
            />
          </Field>
          <button className="btn primary">Assign agent</button>
        </form>
      </Drawer>
    </>
  );
}
