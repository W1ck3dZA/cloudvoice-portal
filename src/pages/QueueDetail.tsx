import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  PhoneCall,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { agentsApi, errorMessage, queuesApi } from '../lib/api';
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
} from '../components/UI';
export default function QueueDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const queue = useQuery({
    queryKey: ['queue', id],
    queryFn: () => queuesApi.get(id!),
    enabled: !!id,
  });
  const stats = useQuery({
    queryKey: ['queue-stats', id],
    queryFn: () => queuesApi.stats(id!),
    enabled: !!id,
    refetchInterval: 10000,
  });
  const members = useQuery({
    queryKey: ['queue-members', id],
    queryFn: () => queuesApi.members(id!),
    enabled: !!id,
    refetchInterval: 5000,
  });
  const tiers = useQuery({
    queryKey: ['queue-tiers', id],
    queryFn: () => queuesApi.tiers(id!),
    enabled: !!id,
  });
  const agents = useQuery({ queryKey: ['agents'], queryFn: agentsApi.list });
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
  const toggleActive = useMutation({
    mutationFn: () => queuesApi.update(id!, { active: !queue.data!.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['queue', id] }),
  });
  if (queue.isLoading) return <Spinner />;
  if (!queue.data)
    return <Empty icon={<Search size={16} />} text="Queue not found." />;
  const s = stats.data;
  return (
    <>
      <PageHeader
        eyebrow="Call Center / Queue"
        title={queue.data.name}
        description={queue.data.strategy}
        action={
          <button className="btn" onClick={() => nav('/call-center')}>
            <ArrowLeft size={15} /> Back
          </button>
        }
      />
      <div className="metric-grid">
        <Card className="metric">
          <div>
            <span>Waiting</span>
            <strong>{s?.currently_waiting ?? '—'}</strong>
          </div>
        </Card>
        <Card className="metric">
          <div>
            <span>Available agents</span>
            <strong>{s?.available_agents ?? '—'}</strong>
          </div>
        </Card>
        <Card className="metric">
          <div>
            <span>Answered</span>
            <strong>{s?.total_answered ?? queue.data.calls_answered}</strong>
          </div>
        </Card>
        <Card className="metric">
          <div>
            <span>Abandoned</span>
            <strong>{s?.total_abandoned ?? queue.data.calls_abandoned}</strong>
          </div>
        </Card>
      </div>
      <div className="dash-grid">
        <Card>
          <div className="card-title">
            <div>
              <span className="eyebrow">Live statistics</span>
              <h2>Queue performance</h2>
            </div>
            <StatusToggle
              checked={queue.data.active}
              onChange={() => toggleActive.mutate()}
              disabled={toggleActive.isPending}
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
              <span className="eyebrow">Configuration</span>
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
              <strong>{queue.data.moh_sound || '—'}</strong>
            </div>
            <div className="detail-item">
              <span>No answer status</span>
              <strong>{queue.data.agent_no_answer_status}</strong>
            </div>
          </div>
        </Card>
      </div>
      <Card>
        <div className="card-title">
          <div>
            <span className="eyebrow">Live callers</span>
            <h2>Queue members</h2>
          </div>
          <span className="muted">Refreshes every 5 seconds</span>
        </div>
        {members.isLoading ? (
          <Spinner />
        ) : (members.data || []).length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Caller</th>
                  <th>Status</th>
                  <th>Agent</th>
                  <th>Joined</th>
                  <th>Bridged</th>
                </tr>
              </thead>
              <tbody>
                {members.data!.map((m) => (
                  <tr key={m.id}>
                    <td>{m.cid_number || m.cid_name || 'Unknown'}</td>
                    <td>
                      <Status value={m.status} />
                    </td>
                    <td>{m.agent_name || '—'}</td>
                    <td>{new Date(m.joined_at).toLocaleTimeString()}</td>
                    <td>
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
            <span className="eyebrow">Agent routing</span>
            <h2>Tier assignments</h2>
          </div>
          <button className="btn primary" onClick={() => setOpen(true)}>
            <Plus size={15} /> Add agent
          </button>
        </div>
        {tiers.isLoading ? (
          <Spinner />
        ) : (tiers.data || []).length ? (
          <div className="table-wrap">
            <table>
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
                    <td>
                      <strong>{t.agent_name}</strong>
                      <div className="muted">{t.agent_fs_name}</div>
                    </td>
                    <td>
                      <Status value={t.agent_status} />
                    </td>
                    <td>{t.agent_state}</td>
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
                    <td>
                      <button
                        className="table-action danger-text"
                        onClick={() =>
                          confirm(`Remove ${t.agent_name} from queue?`) &&
                          queuesApi.removeTier(id!, t.agent_id).then(() =>
                            qc.invalidateQueries({
                              queryKey: ['queue-tiers', id],
                            }),
                          )
                        }
                      >
                        <Trash2 size={14} /> Remove
                      </button>
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
