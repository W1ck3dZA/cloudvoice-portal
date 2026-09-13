import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, MessageSquare, Send } from 'lucide-react';
import { errorMessage, smsApi, smsCredentialsApi } from '../lib/api';
import type { SmsMessage } from '../types/api';
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
  Status,
  StatusToggle,
  Toggle,
} from '../components/UI';
export default function Messaging() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'messages' | 'credentials'>('messages');
  const data = useQuery({
    queryKey: ['sms'],
    queryFn: () => smsApi.list(),
    refetchInterval: 15000,
  });
  const creds = useQuery({
    queryKey: ['sms-credentials'],
    queryFn: smsCredentialsApi.get,
  });
  const [open, setOpen] = useState(false);
  const [credOpen, setCredOpen] = useState(false);
  const [view, setView] = useState<SmsMessage | null>(null);
  const [form, setForm] = useState({ to: '', from: '', body: '' });
  const [cform, setCform] = useState({
    jasmin_username: '',
    jasmin_password: '',
    default_sender_id: '',
    active: true,
  });
  const [err, setErr] = useState('');
  const send = useMutation({
    mutationFn: () => smsApi.send({ ...form, from: form.from || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sms'] });
      setOpen(false);
      setForm({ to: '', from: '', body: '' });
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const saveCred = useMutation({
    mutationFn: () =>
      creds.data
        ? smsCredentialsApi.update({
            ...cform,
            jasmin_password: cform.jasmin_password || undefined,
            default_sender_id: cform.default_sender_id || null,
          })
        : smsCredentialsApi.create({
            ...cform,
            default_sender_id: cform.default_sender_id || null,
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sms-credentials'] });
      setCredOpen(false);
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const toggleCredActive = useMutation({
    mutationFn: () => smsCredentialsApi.update({ active: !creds.data!.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sms-credentials'] }),
  });
  return (
    <>
      <PageHeader
        eyebrow="Messaging"
        title="SMS"
        description="Send messages, inspect delivery records and manage the organisation's SMS gateway credential."
        action={
          tab === 'messages' ? (
            <AddButton onClick={() => setOpen(true)}>Send SMS</AddButton>
          ) : (
            <AddButton
              onClick={() => {
                const c = creds.data;
                setCform({
                  jasmin_username: c?.jasmin_username || '',
                  jasmin_password: '',
                  default_sender_id: c?.default_sender_id || '',
                  active: c?.active ?? true,
                });
                setCredOpen(true);
              }}
            >
              {creds.data ? 'Edit credential' : 'Add credential'}
            </AddButton>
          )
        }
      />
      <div className="tabs">
        <button
          className={tab === 'messages' ? 'active' : ''}
          onClick={() => setTab('messages')}
        >
          Messages
        </button>
        <button
          className={tab === 'credentials' ? 'active' : ''}
          onClick={() => setTab('credentials')}
        >
          SMS Credential
        </button>
      </div>
      {tab === 'messages' ? (
        <Card>
          {data.isLoading ? (
            <Spinner />
          ) : (data.data || []).length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Direction</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Message</th>
                    <th>Status</th>
                    <th>Segments</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.data!.map((m) => (
                    <tr key={m.id}>
                      <td>{m.direction}</td>
                      <td>{m.from_number || '—'}</td>
                      <td>{m.to_number}</td>
                      <td className="truncate">{m.body}</td>
                      <td>
                        <Status value={m.status} />
                      </td>
                      <td>{m.segments}</td>
                      <td>{new Date(m.created_at).toLocaleString()}</td>
                      <td>
                        <RowActions onView={() => setView(m)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              icon={<MessageSquare size={16} />}
              text="No SMS messages were returned."
            />
          )}
        </Card>
      ) : (
        <Card>
          {creds.isLoading ? (
            <Spinner />
          ) : creds.data ? (
            <>
              <div className="detail-grid">
                <div className="detail-item">
                  <span>Jasmin username</span>
                  <strong>{creds.data.jasmin_username}</strong>
                </div>
                <div className="detail-item">
                  <span>Default sender</span>
                  <strong>{creds.data.default_sender_id || '—'}</strong>
                </div>
                <div className="detail-item">
                  <span>Status</span>
                  <StatusToggle
                    checked={creds.data.active}
                    onChange={() => toggleCredActive.mutate()}
                    disabled={toggleCredActive.isPending}
                  />
                </div>
              </div>
              <div className="button-row">
                <button
                  className="btn primary"
                  onClick={() => {
                    const c = creds.data!;
                    setCform({
                      jasmin_username: c.jasmin_username,
                      jasmin_password: '',
                      default_sender_id: c.default_sender_id || '',
                      active: c.active,
                    });
                    setCredOpen(true);
                  }}
                >
                  Edit credential
                </button>
                <button
                  className="btn danger"
                  onClick={() =>
                    confirm('Remove the SMS credential?') &&
                    smsCredentialsApi
                      .remove()
                      .then(() =>
                        qc.invalidateQueries({ queryKey: ['sms-credentials'] }),
                      )
                  }
                >
                  Delete
                </button>
              </div>
            </>
          ) : (
            <Empty
              icon={<KeyRound size={16} />}
              text="No SMS credential is configured for this organisation."
            />
          )}
        </Card>
      )}
      <Drawer open={open} onClose={() => setOpen(false)} title="Send SMS">
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setErr('');
            send.mutate();
          }}
        >
          <ErrorBox message={err} />
          <Field label="To">
            <input
              required
              placeholder="+27821234567"
              value={form.to}
              onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
            />
          </Field>
          <Field
            label="From"
            hint="Optional; your organisation default sender is used when blank"
          >
            <input
              value={form.from}
              onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))}
            />
          </Field>
          <Field label="Message">
            <textarea
              required
              rows={8}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />
          </Field>
          <button className="btn primary" disabled={send.isPending}>
            <Send size={15} />
            {send.isPending ? 'Sending…' : 'Send message'}
          </button>
        </form>
      </Drawer>
      <Drawer
        open={credOpen}
        onClose={() => setCredOpen(false)}
        title="SMS credential"
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setErr('');
            saveCred.mutate();
          }}
        >
          <ErrorBox message={err} />
          <Field label="Username">
            <input
              required
              value={cform.jasmin_username}
              onChange={(e) =>
                setCform((f) => ({ ...f, jasmin_username: e.target.value }))
              }
            />
          </Field>
          <Field
            label="Password"
            hint={creds.data ? 'Leave blank to keep the current password' : ''}
          >
            <input
              type="password"
              required={!creds.data}
              value={cform.jasmin_password}
              onChange={(e) =>
                setCform((f) => ({ ...f, jasmin_password: e.target.value }))
              }
            />
          </Field>
          <Field label="Default sender ID">
            <input
              value={cform.default_sender_id}
              onChange={(e) =>
                setCform((f) => ({ ...f, default_sender_id: e.target.value }))
              }
            />
          </Field>
          <Toggle
            checked={cform.active}
            onChange={(v) => setCform((f) => ({ ...f, active: v }))}
            label="Credential active"
          />
          <button className="btn primary">Save credential</button>
        </form>
      </Drawer>
      <Drawer
        open={!!view}
        onClose={() => setView(null)}
        title="Message details"
      >
        {view && (
          <div className="detail-grid">
            {[
              ['Direction', view.direction],
              ['From', view.from_number || '—'],
              ['To', view.to_number],
              ['Status', <Status value={view.status} />],
              ['Encoding', view.encoding],
              ['Segments', view.segments],
              ['Provider ID', view.provider_message_id || '—'],
              ['Error', view.error_code || '—'],
              ['Created', new Date(view.created_at).toLocaleString()],
            ].map(([a, b]) => (
              <div className="detail-item" key={String(a)}>
                <span>{a}</span>
                <strong>{b as any}</strong>
              </div>
            ))}
            <div className="detail-item full">
              <span>Message</span>
              <strong>{view.body}</strong>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
