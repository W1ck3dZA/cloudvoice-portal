import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, KeyRound, MessageSquare, Send } from 'lucide-react';
import { errorMessage, smsApi, smsCredentialsApi } from '../lib/api';
import type { SmsMessage } from '../types/api';
import { humanize } from '../lib/labels';
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
import {
  CopyValue,
  DetailRow,
  DetailRows,
  DetailSection,
  DetailSummary,
  DetailView,
  DrawerActions,
  FormSection,
} from '../components/Details';
// GSM-7 basic set; anything else forces UCS-2 (Unicode). Extension characters
// cost two GSM-7 units.
const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXTENDED = '^{}\\[~]|€';
function segmentInfo(body: string) {
  let units = 0;
  let unicode = false;
  for (const ch of body) {
    if (GSM_BASIC.includes(ch)) units += 1;
    else if (GSM_EXTENDED.includes(ch)) units += 2;
    else {
      unicode = true;
      break;
    }
  }
  if (unicode) {
    const n = body.length;
    return { unicode, length: n, segments: n <= 70 ? 1 : Math.ceil(n / 67) };
  }
  return {
    unicode,
    length: units,
    segments: units <= 160 ? 1 : Math.ceil(units / 153),
  };
}
const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString() : '—';
const blankMessage = { to: '', from: '', body: '' };

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
  const [form, setForm] = useState(blankMessage);
  const [cform, setCform] = useState({
    username: '',
    password: '',
    default_sender_id: '',
    active: true,
  });
  const [err, setErr] = useState('');
  const send = useMutation({
    mutationFn: () => smsApi.send({ ...form, from: form.from || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sms'] });
      setOpen(false);
      setForm(blankMessage);
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const saveCred = useMutation({
    mutationFn: () =>
      creds.data
        ? smsCredentialsApi.update({
            ...cform,
            password: cform.password || undefined,
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
  const removeCred = useMutation({
    mutationFn: smsCredentialsApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sms-credentials'] }),
  });
  function compose(prefill: Partial<typeof blankMessage> = {}) {
    setErr('');
    setForm({ ...blankMessage, ...prefill });
    setView(null);
    setOpen(true);
  }
  function editCredential() {
    const c = creds.data;
    setErr('');
    setCform({
      username: c?.username || '',
      password: '',
      default_sender_id: c?.default_sender_id || '',
      active: c?.active ?? true,
    });
    setCredOpen(true);
  }
  const seg = segmentInfo(form.body);
  return (
    <>
      <PageHeader
        title="SMS"
        description="Send messages, check delivery and manage the SMS gateway credential your organisation sends with."
        action={
          tab === 'messages' ? (
            <AddButton onClick={() => compose()}>Send SMS</AddButton>
          ) : (
            !creds.data &&
            !creds.isLoading && (
              <AddButton onClick={editCredential}>Add credential</AddButton>
            )
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
          SMS credential
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
                    <th>Sent</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.data!.map((m) => (
                    <tr key={m.id}>
                      <td>{humanize(m.direction)}</td>
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
              text="No messages yet. Send one to see it here with its delivery status."
            />
          )}
        </Card>
      ) : (
        <Card>
          {creds.isLoading ? (
            <Spinner />
          ) : creds.data ? (
            <DetailView>
              <DetailSummary
                kind="SMS gateway credential"
                title={creds.data.username}
                facts={
                  <>
                    <Status value={creds.data.active ? 'active' : 'inactive'} />
                    <span>
                      {creds.data.default_sender_id
                        ? `Sends as ${creds.data.default_sender_id}`
                        : 'No default sender ID'}
                    </span>
                  </>
                }
              >
                <button className="btn primary" onClick={editCredential}>
                  Edit credential
                </button>
              </DetailSummary>
              <DetailSection title="Gateway login">
                <DetailRows>
                  <DetailRow label="Username">{creds.data.username}</DetailRow>
                  <DetailRow label="Password">
                    {creds.data.password_set ? 'Saved' : 'Not set'}
                  </DetailRow>
                </DetailRows>
              </DetailSection>
              <DetailSection title="Sending">
                <DetailRows>
                  <DetailRow label="Default sender ID">
                    {creds.data.default_sender_id || 'None'}
                  </DetailRow>
                  <DetailRow label="Use for sending">
                    <StatusToggle
                      checked={creds.data.active}
                      onChange={() => toggleCredActive.mutate()}
                      disabled={toggleCredActive.isPending}
                    />
                  </DetailRow>
                  <DetailRow label="Last updated">
                    {when(creds.data.updated_at)}
                  </DetailRow>
                </DetailRows>
              </DetailSection>
              <DrawerActions>
                <button
                  className="btn danger"
                  disabled={removeCred.isPending}
                  onClick={() =>
                    confirm(
                      "Remove the SMS credential? Messages can't be sent until you add one again.",
                    ) && removeCred.mutate()
                  }
                >
                  Remove credential
                </button>
              </DrawerActions>
            </DetailView>
          ) : (
            <Empty
              icon={<KeyRound size={16} />}
              text="No SMS credential yet. Add the login your SMS gateway gave you to start sending."
              action={
                <AddButton onClick={editCredential}>Add credential</AddButton>
              }
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
          <FormSection title="Recipient">
            <Field
              label="To"
              hint="International format with the country code, e.g. +27821234567"
            >
              <input
                required
                inputMode="tel"
                placeholder="+27821234567"
                value={form.to}
                onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
              />
            </Field>
          </FormSection>
          <FormSection title="Sender">
            <Field
              label="From"
              hint={
                creds.data?.default_sender_id
                  ? `Optional. Leave blank to send as ${creds.data.default_sender_id}`
                  : 'Optional. Leave blank to use your default sender ID'
              }
            >
              <input
                value={form.from}
                onChange={(e) =>
                  setForm((f) => ({ ...f, from: e.target.value }))
                }
              />
            </Field>
          </FormSection>
          <FormSection title="Message">
            <Field label="Text">
              <textarea
                required
                rows={7}
                value={form.body}
                onChange={(e) =>
                  setForm((f) => ({ ...f, body: e.target.value }))
                }
              />
            </Field>
            <p className="fs-hint sms-count" aria-live="polite">
              {seg.length} characters · {seg.segments}{' '}
              {seg.segments === 1 ? 'segment' : 'segments'} (
              {seg.unicode ? 'Unicode' : 'GSM-7'}). Each segment is billed as
              one message.
              {seg.unicode &&
                ' Emoji and some accented letters switch to Unicode, which fits 70 characters per segment instead of 160.'}
            </p>
          </FormSection>
          <DrawerActions>
            <button className="btn primary" disabled={send.isPending}>
              <Send size={15} />
              {send.isPending ? 'Sending…' : 'Send message'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </DrawerActions>
        </form>
      </Drawer>
      <Drawer
        open={credOpen}
        onClose={() => setCredOpen(false)}
        title={creds.data ? 'Edit SMS credential' : 'Add SMS credential'}
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
          <FormSection
            title="Gateway login"
            hint="The login your SMS gateway gave you."
          >
            <Field label="Username">
              <input
                required
                autoComplete="off"
                value={cform.username}
                onChange={(e) =>
                  setCform((f) => ({ ...f, username: e.target.value }))
                }
              />
            </Field>
            <Field
              label="Password"
              hint={
                creds.data
                  ? 'Leave blank to keep the current password'
                  : undefined
              }
            >
              <input
                type="password"
                autoComplete="new-password"
                required={!creds.data}
                value={cform.password}
                onChange={(e) =>
                  setCform((f) => ({ ...f, password: e.target.value }))
                }
              />
            </Field>
          </FormSection>
          <FormSection title="Sending">
            <Field
              label="Default sender ID"
              hint="Used when a message doesn't set its own sender. A number or an approved name."
            >
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
              label="Use this credential to send messages"
            />
          </FormSection>
          <DrawerActions>
            <button className="btn primary" disabled={saveCred.isPending}>
              {saveCred.isPending
                ? 'Saving…'
                : creds.data
                  ? 'Save changes'
                  : 'Add credential'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setCredOpen(false)}
            >
              Cancel
            </button>
          </DrawerActions>
        </form>
      </Drawer>
      <Drawer
        open={!!view}
        onClose={() => setView(null)}
        title="Message details"
      >
        {view && (
          <DetailView>
            <DetailSummary
              kind={
                view.direction === 'inbound'
                  ? 'Inbound message'
                  : 'Outbound message'
              }
              title={
                <span className="dv-route">
                  {view.from_number || 'Default sender'}
                  <ArrowRight size={16} aria-label="to" />
                  {view.to_number}
                </span>
              }
              facts={
                <>
                  <Status value={view.status} />
                  <span>
                    {view.segments}{' '}
                    {view.segments === 1 ? 'segment' : 'segments'}
                  </span>
                  <span>{view.encoding === 'ucs2' ? 'Unicode' : 'GSM-7'}</span>
                </>
              }
            >
              {view.direction === 'inbound' && view.from_number ? (
                <button
                  className="btn primary"
                  onClick={() =>
                    compose({ to: view.from_number!, from: view.to_number })
                  }
                >
                  <Send size={15} /> Reply
                </button>
              ) : (
                <button
                  className="btn"
                  onClick={() =>
                    compose({
                      to: view.to_number,
                      from: view.from_number || '',
                    })
                  }
                >
                  <Send size={15} /> Message again
                </button>
              )}
            </DetailSummary>
            <DetailSection title="Message">
              <p className="sms-body">{view.body}</p>
            </DetailSection>
            <DetailSection title="Delivery">
              <DetailRows>
                <DetailRow label="Status">
                  <Status value={view.status} />
                </DetailRow>
                {view.direction === 'outbound' && (
                  <>
                    <DetailRow label="Sent to the gateway">
                      {when(view.submitted_at)}
                    </DetailRow>
                    <DetailRow label="Delivered">
                      {when(view.delivered_at)}
                    </DetailRow>
                  </>
                )}
                {view.error_code && (
                  <DetailRow label="Error">
                    {humanize(view.error_code)}
                  </DetailRow>
                )}
              </DetailRows>
            </DetailSection>
            <DetailSection title="Details">
              <DetailRows>
                <DetailRow label="Message ID">
                  <CopyValue value={view.id} label="message ID" />
                </DetailRow>
                <DetailRow label="Created">{when(view.created_at)}</DetailRow>
                <DetailRow label="Encoding">
                  {view.encoding === 'ucs2'
                    ? 'Unicode (70 per segment)'
                    : 'GSM-7 (160 per segment)'}
                </DetailRow>
              </DetailRows>
            </DetailSection>
          </DetailView>
        )}
      </Drawer>
    </>
  );
}
