import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PhoneCall, PhoneOutgoing, Search } from 'lucide-react';
import { appsApi, callsApi, errorMessage, gatewaysApi } from '../lib/api';
import type { Call } from '../types/api';
import {
  AddButton,
  Card,
  Drawer,
  Empty,
  ErrorBox,
  Field,
  PageHeader,
  Pagination,
  RowActions,
  Spinner,
  Status,
  Toggle,
} from '../components/UI';
const PAGE_SIZE = 25;

const blank = {
  type: 'phone',
  number: '',
  gateway_id: '',
  sip_uri: '',
  profile: 'external',
  sip_username: '',
  sip_password: '',
  outbound_proxy: '',
  user: '',
  from: '',
  from_host: '',
  application_id: '',
  record_calls: false,
  timeout: '30',
  time_limit: '',
  answer_on_bridge: false,
  ignore_early_media: false,
  headers: '{}',
  tag: '{}',
  amd_enabled: false,
  amd_initial_silence: '2500',
  amd_greeting: '1500',
  amd_after_greeting_silence: '800',
  amd_total_analysis_time: '5000',
  amd_max_words: '3',
};

export default function Calls() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<Call | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [err, setErr] = useState('');
  const data = useQuery({
    queryKey: ['calls', page],
    queryFn: () =>
      callsApi.listPaged({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    refetchInterval: 15000,
  });
  const gateways = useQuery({
    queryKey: ['gateways'],
    queryFn: gatewaysApi.list,
  });
  const apps = useQuery({ queryKey: ['apps'], queryFn: appsApi.list });
  const originate = useMutation({
    mutationFn: () => {
      let headers: Record<string, string> | undefined;
      let tag: Record<string, unknown> | undefined;
      try {
        headers = form.headers.trim() ? JSON.parse(form.headers) : undefined;
        tag = form.tag.trim() ? JSON.parse(form.tag) : undefined;
      } catch {
        throw new Error('Headers and tag must contain valid JSON');
      }
      const to =
        form.type === 'phone'
          ? { type: 'phone', number: form.number, gateway_id: form.gateway_id }
          : form.type === 'sip'
            ? {
                type: 'sip',
                sip_uri: form.sip_uri,
                profile: form.profile,
                auth: form.sip_username
                  ? { username: form.sip_username, password: form.sip_password }
                  : undefined,
                outbound_proxy: form.outbound_proxy || undefined,
              }
            : { type: 'user', user: form.user };
      return callsApi.create({
        to,
        from: form.from || undefined,
        from_host: form.from_host || undefined,
        application_id: form.application_id || undefined,
        record_calls: form.record_calls,
        timeout: +form.timeout,
        time_limit: form.time_limit ? +form.time_limit : undefined,
        headers,
        tag,
        answer_on_bridge: form.answer_on_bridge,
        ignore_early_media: form.ignore_early_media,
        amd: form.amd_enabled
          ? {
              enabled: true,
              initial_silence: +form.amd_initial_silence,
              greeting: +form.amd_greeting,
              after_greeting_silence: +form.amd_after_greeting_silence,
              total_analysis_time: +form.amd_total_analysis_time,
              maximum_number_of_words: +form.amd_max_words,
            }
          : undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calls'] });
      setOpen(false);
      setForm(blank);
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const hangup = useMutation({
    mutationFn: callsApi.hangup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calls'] }),
  });
  const rows = (data.data?.items || []).filter((c) =>
    `${c.from_number} ${c.to_number} ${c.status} ${c.hangup_cause}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  const total = data.data?.total ?? 0;
  return (
    <>
      <PageHeader
        eyebrow="Voice"
        title="Calls"
        description="Inspect call lifecycle records or originate calls through a gateway, SIP URI or registered user."
        action={<AddButton onClick={() => setOpen(true)}>Make call</AddButton>}
      />
      <Card>
        <div className="toolbar">
          <div className="search">
            <Search size={17} />
            <input
              placeholder="Search calls…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <span className="muted">{rows.length} records</span>
        </div>
        {data.isLoading ? (
          <Spinner />
        ) : rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Direction</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Status</th>
                  <th>Hangup cause</th>
                  <th>Duration</th>
                  <th>Initiated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className="caps">{c.direction}</td>
                    <td>{c.from_number}</td>
                    <td>{c.to_number}</td>
                    <td>
                      <Status value={c.status} />
                    </td>
                    <td>{c.hangup_cause || '—'}</td>
                    <td>
                      {c.duration_seconds == null
                        ? '—'
                        : `${c.duration_seconds}s`}
                    </td>
                    <td>{new Date(c.initiated_at).toLocaleString()}</td>
                    <td>
                      <RowActions
                        onView={() => setView(c)}
                        onDelete={
                          ![
                            'completed',
                            'failed',
                            'cancelled',
                            'no_answer',
                            'busy',
                          ].includes(c.status)
                            ? () =>
                                confirm('Hang up this active call?') &&
                                hangup.mutate(c.id)
                            : undefined
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
            icon={<PhoneCall size={16} />}
            text="No call records were returned."
          />
        )}
        {!data.isLoading && total > 0 && (
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          />
        )}
      </Card>
      <Drawer open={!!view} onClose={() => setView(null)} title="Call details">
        {view && (
          <div className="detail-grid">
            {[
              ['Call ID', view.id],
              ['Direction', view.direction],
              ['From', view.from_number],
              ['To', view.to_number],
              ['Status', <Status value={view.status} />],
              ['Hangup cause', view.hangup_cause || '—'],
              [
                'Duration',
                view.duration_seconds == null
                  ? '—'
                  : `${view.duration_seconds}s`,
              ],
              [
                'Application',
                apps.data?.find((a) => a.id === view.application_id)?.name ||
                  '—',
              ],
              ['Recording', view.record_calls ? 'Enabled' : 'Off'],
              ['Started', new Date(view.initiated_at).toLocaleString()],
              [
                'Answered',
                view.answered_at
                  ? new Date(view.answered_at).toLocaleString()
                  : '—',
              ],
              [
                'Ended',
                view.ended_at ? new Date(view.ended_at).toLocaleString() : '—',
              ],
            ].map(([a, b]) => (
              <div className="detail-item" key={String(a)}>
                <span>{a}</span>
                <strong>{b as any}</strong>
              </div>
            ))}
          </div>
        )}
      </Drawer>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Originate call"
        size="lg"
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setErr('');
            originate.mutate();
          }}
        >
          <ErrorBox message={err} />
          <div className="form-section">
            <h3>Destination</h3>
            <Field label="Destination type">
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, type: e.target.value }))
                }
              >
                <option value="phone">Phone via gateway</option>
                <option value="sip">SIP URI</option>
                <option value="user">Registered SIP user</option>
              </select>
            </Field>
            {form.type === 'phone' && (
              <div className="form-grid">
                <Field label="Destination number">
                  <input
                    required
                    value={form.number}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, number: e.target.value }))
                    }
                    placeholder="+27821234567"
                  />
                </Field>
                <Field label="Gateway">
                  <select
                    required
                    value={form.gateway_id}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, gateway_id: e.target.value }))
                    }
                  >
                    <option value="">Choose gateway…</option>
                    {(gateways.data || []).map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
            {form.type === 'sip' && (
              <>
                <div className="form-grid">
                  <Field label="SIP URI">
                    <input
                      required
                      value={form.sip_uri}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, sip_uri: e.target.value }))
                      }
                      placeholder="sip:bob@example.com"
                    />
                  </Field>
                  <Field label="Sofia profile">
                    <input
                      value={form.profile}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, profile: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Digest username">
                    <input
                      value={form.sip_username}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, sip_username: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Digest password">
                    <input
                      type="password"
                      value={form.sip_password}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, sip_password: e.target.value }))
                      }
                    />
                  </Field>
                </div>
                <Field label="Outbound proxy">
                  <input
                    value={form.outbound_proxy}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, outbound_proxy: e.target.value }))
                    }
                    placeholder="sip:192.168.1.50:5060;lr"
                  />
                </Field>
              </>
            )}
            {form.type === 'user' && (
              <Field label="Registered user">
                <input
                  required
                  value={form.user}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, user: e.target.value }))
                  }
                  placeholder="1001@sip.example.com"
                />
              </Field>
            )}
          </div>
          <div className="form-section">
            <h3>Identity & application</h3>
            <div className="form-grid">
              <Field label="From number">
                <input
                  value={form.from}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, from: e.target.value }))
                  }
                  placeholder="+27100562194"
                />
              </Field>
              <Field label="From host">
                <input
                  value={form.from_host}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, from_host: e.target.value }))
                  }
                  placeholder="carrier.example.com"
                />
              </Field>
              <Field label="Application">
                <select
                  value={form.application_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, application_id: e.target.value }))
                  }
                >
                  <option value="">None</option>
                  {(apps.data || []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ring timeout">
                <input
                  type="number"
                  min="1"
                  max="600"
                  value={form.timeout}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, timeout: e.target.value }))
                  }
                />
              </Field>
              <Field label="Time limit seconds">
                <input
                  type="number"
                  min="1"
                  max="86400"
                  value={form.time_limit}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, time_limit: e.target.value }))
                  }
                />
              </Field>
            </div>
            <Toggle
              checked={form.record_calls}
              onChange={(v) => setForm((f) => ({ ...f, record_calls: v }))}
              label="Record this call"
            />
            <Toggle
              checked={form.answer_on_bridge}
              onChange={(v) => setForm((f) => ({ ...f, answer_on_bridge: v }))}
              label="Answer A-leg only when B-leg bridges"
            />
            <Toggle
              checked={form.ignore_early_media}
              onChange={(v) =>
                setForm((f) => ({ ...f, ignore_early_media: v }))
              }
              label="Ignore early media"
            />
          </div>
          <div className="form-section">
            <h3>Metadata & SIP headers</h3>
            <div className="form-grid">
              <Field
                label="Custom SIP headers (JSON)"
                hint="Use X- prefixed headers for portability"
              >
                <textarea
                  rows={7}
                  value={form.headers}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, headers: e.target.value }))
                  }
                />
              </Field>
              <Field
                label="Call tag (JSON)"
                hint="Stored with the call and echoed in webhook events"
              >
                <textarea
                  rows={7}
                  value={form.tag}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tag: e.target.value }))
                  }
                />
              </Field>
            </div>
          </div>
          <div className="form-section">
            <h3>Answering machine detection</h3>
            <Toggle
              checked={form.amd_enabled}
              onChange={(v) => setForm((f) => ({ ...f, amd_enabled: v }))}
              label="Enable AMD before application flow"
            />
            {form.amd_enabled && (
              <div className="form-grid">
                <Field label="Initial silence (ms)">
                  <input
                    type="number"
                    value={form.amd_initial_silence}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        amd_initial_silence: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Greeting (ms)">
                  <input
                    type="number"
                    value={form.amd_greeting}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amd_greeting: e.target.value }))
                    }
                  />
                </Field>
                <Field label="After greeting silence (ms)">
                  <input
                    type="number"
                    value={form.amd_after_greeting_silence}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        amd_after_greeting_silence: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Analysis time (ms)">
                  <input
                    type="number"
                    value={form.amd_total_analysis_time}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        amd_total_analysis_time: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Maximum words">
                  <input
                    type="number"
                    value={form.amd_max_words}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amd_max_words: e.target.value }))
                    }
                  />
                </Field>
              </div>
            )}
          </div>
          <button className="btn primary" disabled={originate.isPending}>
            <PhoneOutgoing size={15} />{' '}
            {originate.isPending ? 'Calling…' : 'Place call'}
          </button>
        </form>
      </Drawer>
    </>
  );
}
