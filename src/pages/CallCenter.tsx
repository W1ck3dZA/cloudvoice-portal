import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, UsersRound } from 'lucide-react';
import { agentsApi, audioFilesApi, errorMessage, queuesApi } from '../lib/api';
import { useSession } from '../lib/session';
import type { Agent, Queue } from '../types/api';
import {
  AddButton,
  Card,
  Drawer,
  Empty,
  ErrorBox,
  Field,
  PageHeader,
  RowActions,
  Spinner,
  StatusToggle,
} from '../components/UI';
const qBlank = {
  name: '',
  strategy: 'longest-idle-agent',
  moh_sound: '',
  max_wait_time: '0',
  discard_abandoned_after: '60',
  agent_no_answer_status: 'On Break',
};
const aBlank = {
  name: '',
  type: 'callback',
  contact: '',
  status: 'Logged Out',
  wrap_up_time: '0',
};
export default function CallCenter() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { session } = useSession();
  const orgId = session?.orgId || '';
  const [tab, setTab] = useState<'queues' | 'agents'>('queues');
  const qs = useQuery({
    queryKey: ['queues'],
    queryFn: queuesApi.list,
    refetchInterval: 15000,
  });
  const as = useQuery({
    queryKey: ['agents'],
    queryFn: agentsApi.list,
    refetchInterval: 15000,
  });
  const audioFiles = useQuery({
    queryKey: ['audio-files', orgId],
    queryFn: () => audioFilesApi.list(orgId, 200, 0),
    enabled: !!orgId,
  });
  const [drawer, setDrawer] = useState<
    'qadd' | 'qedit' | 'aadd' | 'aedit' | null
  >(null);
  const [qSel, setQSel] = useState<Queue | null>(null);
  const [aSel, setASel] = useState<Agent | null>(null);
  const [qf, setQf] = useState(qBlank);
  const [af, setAf] = useState(aBlank);
  const [err, setErr] = useState('');
  const close = () => {
    setDrawer(null);
    setErr('');
  };
  const qsave = useMutation({
    mutationFn: () =>
      drawer === 'qadd'
        ? queuesApi.create({
            ...qf,
            max_wait_time: +qf.max_wait_time,
            discard_abandoned_after: +qf.discard_abandoned_after,
          })
        : queuesApi.update(qSel!.id, {
            name: qf.name,
            strategy: qf.strategy,
            moh_sound: qf.moh_sound,
            max_wait_time: +qf.max_wait_time,
            discard_abandoned_after: +qf.discard_abandoned_after,
            agent_no_answer_status: qf.agent_no_answer_status,
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queues'] });
      close();
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const toggleQueueActive = useMutation({
    mutationFn: (q: Queue) => queuesApi.update(q.id, { active: !q.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['queues'] }),
  });
  const asave = useMutation({
    mutationFn: () =>
      drawer === 'aadd'
        ? agentsApi.create({ ...af, wrap_up_time: +af.wrap_up_time })
        : agentsApi.update(aSel!.id, {
            name: af.name,
            contact: af.contact,
            wrap_up_time: +af.wrap_up_time,
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      close();
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Call Center"
        description="Manage queues and agents backed by FreeSWITCH mod_callcenter."
        action={
          <AddButton
            onClick={() => {
              if (tab === 'queues') {
                setQf(qBlank);
                setDrawer('qadd');
              } else {
                setAf(aBlank);
                setDrawer('aadd');
              }
            }}
          >
            Add {tab === 'queues' ? 'queue' : 'agent'}
          </AddButton>
        }
      />
      <div className="tabs">
        <button
          className={tab === 'queues' ? 'active' : ''}
          onClick={() => setTab('queues')}
        >
          Queues
        </button>
        <button
          className={tab === 'agents' ? 'active' : ''}
          onClick={() => setTab('agents')}
        >
          Agents
        </button>
      </div>
      {tab === 'queues' ? (
        <Card>
          {qs.isLoading ? (
            <Spinner />
          ) : (qs.data || []).length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Strategy</th>
                    <th>Answered</th>
                    <th>Abandoned</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {qs.data!.map((q) => (
                    <tr key={q.id}>
                      <td>
                        <strong>{q.name}</strong>
                      </td>
                      <td>{q.strategy}</td>
                      <td>{q.calls_answered}</td>
                      <td>{q.calls_abandoned}</td>
                      <td>
                        <StatusToggle
                          checked={q.active}
                          onChange={() => toggleQueueActive.mutate(q)}
                          disabled={
                            toggleQueueActive.isPending &&
                            toggleQueueActive.variables?.id === q.id
                          }
                        />
                      </td>
                      <td>
                        <RowActions
                          onView={() => nav(`/call-center/queues/${q.id}`)}
                          onEdit={() => {
                            setQSel(q);
                            setQf({
                              name: q.name,
                              strategy: q.strategy,
                              moh_sound: q.moh_sound || '',
                              max_wait_time: String(q.max_wait_time || 0),
                              discard_abandoned_after: String(
                                q.discard_abandoned_after || 60,
                              ),
                              agent_no_answer_status:
                                q.agent_no_answer_status || 'On Break',
                            });
                            setDrawer('qedit');
                          }}
                          onDelete={() =>
                            confirm(`Delete ${q.name}?`) &&
                            queuesApi
                              .remove(q.id)
                              .then(() =>
                                qc.invalidateQueries({ queryKey: ['queues'] }),
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
              icon={<UsersRound size={16} />}
              text="No call center queues."
            />
          )}
        </Card>
      ) : (
        <Card>
          {as.isLoading ? (
            <Spinner />
          ) : (as.data || []).length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>State</th>
                    <th>Calls</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {as.data!.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.name}</strong>
                      </td>
                      <td>{a.contact}</td>
                      <td>
                        <select
                          className="status-select"
                          value={a.status}
                          onChange={(e) =>
                            agentsApi
                              .status(a.id, e.target.value)
                              .then(() =>
                                qc.invalidateQueries({ queryKey: ['agents'] }),
                              )
                          }
                        >
                          {[
                            'Available',
                            'Available (On Demand)',
                            'On Break',
                            'Logged Out',
                          ].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </td>
                      <td>{a.state}</td>
                      <td>{a.calls_answered}</td>
                      <td>
                        <RowActions
                          onEdit={() => {
                            setASel(a);
                            setAf({
                              name: a.name,
                              type: a.type,
                              contact: a.contact,
                              status: a.status,
                              wrap_up_time: String(a.wrap_up_time || 0),
                            });
                            setDrawer('aedit');
                          }}
                          onDelete={() =>
                            confirm(`Delete ${a.name}?`) &&
                            agentsApi
                              .remove(a.id)
                              .then(() =>
                                qc.invalidateQueries({ queryKey: ['agents'] }),
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
            <Empty icon={<Users size={16} />} text="No call center agents." />
          )}
        </Card>
      )}
      <Drawer
        open={!!drawer}
        onClose={close}
        title={
          drawer?.startsWith('q')
            ? drawer === 'qadd'
              ? 'Add queue'
              : 'Edit queue'
            : drawer === 'aadd'
              ? 'Add agent'
              : 'Edit agent'
        }
      >
        {drawer?.startsWith('q') ? (
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              qsave.mutate();
            }}
          >
            <ErrorBox message={err} />
            <Field label="Name">
              <input
                required
                value={qf.name}
                onChange={(e) => setQf((f) => ({ ...f, name: e.target.value }))}
              />
            </Field>
            <Field label="Strategy">
              <select
                value={qf.strategy}
                onChange={(e) =>
                  setQf((f) => ({ ...f, strategy: e.target.value }))
                }
              >
                {[
                  'longest-idle-agent',
                  'round-robin',
                  'top-down',
                  'agent-with-least-talk-time',
                  'agent-with-fewest-calls',
                  'sequentially-by-agent-order',
                  'ring-all',
                  'ring-progressively',
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Music on hold">
              <select
                value={qf.moh_sound}
                onChange={(e) =>
                  setQf((f) => ({ ...f, moh_sound: e.target.value }))
                }
              >
                <option value="">None</option>
                {qf.moh_sound &&
                  !(audioFiles.data || []).some(
                    (file) => file.url === qf.moh_sound,
                  ) && <option value={qf.moh_sound}>{qf.moh_sound}</option>}
                {(audioFiles.data || []).map((file) => (
                  <option key={file.id} value={file.url}>
                    {file.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Max wait time">
              <input
                type="number"
                value={qf.max_wait_time}
                onChange={(e) =>
                  setQf((f) => ({ ...f, max_wait_time: e.target.value }))
                }
              />
            </Field>
            <Field label="Discard abandoned after">
              <input
                type="number"
                value={qf.discard_abandoned_after}
                onChange={(e) =>
                  setQf((f) => ({
                    ...f,
                    discard_abandoned_after: e.target.value,
                  }))
                }
              />
            </Field>
            <button className="btn primary">Save queue</button>
          </form>
        ) : (
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              asave.mutate();
            }}
          >
            <ErrorBox message={err} />
            <Field label="Name">
              <input
                required
                value={af.name}
                onChange={(e) => setAf((f) => ({ ...f, name: e.target.value }))}
              />
            </Field>
            {drawer === 'aadd' && (
              <Field label="Type">
                <select
                  value={af.type}
                  onChange={(e) =>
                    setAf((f) => ({ ...f, type: e.target.value }))
                  }
                >
                  <option value="callback">callback</option>
                  <option value="uuid-standby">uuid-standby</option>
                </select>
              </Field>
            )}
            <Field label="Contact">
              <input
                required
                value={af.contact}
                onChange={(e) =>
                  setAf((f) => ({ ...f, contact: e.target.value }))
                }
              />
            </Field>
            <Field label="Wrap-up seconds">
              <input
                type="number"
                value={af.wrap_up_time}
                onChange={(e) =>
                  setAf((f) => ({ ...f, wrap_up_time: e.target.value }))
                }
              />
            </Field>
            <button className="btn primary">Save agent</button>
          </form>
        )}
      </Drawer>
    </>
  );
}
