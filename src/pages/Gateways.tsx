import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Router } from 'lucide-react';
import { showToast } from '../lib/toast';
import { errorMessage, gatewaysApi } from '../lib/api';
import type { SipGateway } from '../types/api';
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
  ChoiceChips,
  CopyValue,
  DetailRow,
  DetailRows,
  DetailSection,
  DetailSummary,
  DetailView,
  DrawerActions,
  FormSection,
  ValuePills,
} from '../components/Details';
const CODEC_OPTIONS = ['OPUS', 'PCMU', 'PCMA', 'G729', 'G722'];
const blank = {
  name: '',
  realm: '',
  proxy: '',
  username: '',
  password: '',
  caller_id_number: '',
  caller_id_name: '',
  codecs: ['PCMU', 'PCMA'] as string[],
  active: true,
};
const GATEWAY_STATUS: Record<string, string> = {
  registered: 'Gateway is registered with the carrier',
  up: 'Gateway is reachable',
  registering: 'Gateway is registering. Test again in a few seconds',
  unregistered: 'Gateway is not registered',
  failed: 'Gateway registration failed. Check the username, password and realm',
  down: 'Gateway is unreachable',
  not_found: 'Gateway is not loaded yet. Save it again or contact support',
  unknown: 'Gateway status is unknown',
};
type TestResult = { connected: boolean; status: string; at: Date };
export default function Gateways() {
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ['gateways'], queryFn: gatewaysApi.list });
  const [mode, setMode] = useState<'add' | 'edit' | 'view' | null>(null);
  const [selected, setSelected] = useState<SipGateway | null>(null);
  const [form, setForm] = useState(blank);
  const [err, setErr] = useState('');
  // Latest connection test per gateway, shown in its drawer.
  const [tests, setTests] = useState<Record<string, TestResult>>({});
  const close = () => {
    setMode(null);
    setSelected(null);
    setErr('');
  };
  function body() {
    return {
      ...form,
      proxy: form.proxy || null,
      password: form.password || undefined,
      caller_id_number: form.caller_id_number || null,
      caller_id_name: form.caller_id_name || null,
    };
  }
  const save = useMutation({
    mutationFn: () =>
      mode === 'add'
        ? gatewaysApi.create(body())
        : gatewaysApi.update(selected!.id, body()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gateways'] });
      close();
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: gatewaysApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gateways'] });
      close();
    },
  });
  const test = useMutation({
    mutationFn: gatewaysApi.test,
    onSuccess: (d: { connected: boolean; status: string }, id: string) => {
      setTests((t) => ({ ...t, [id]: { ...d, at: new Date() } }));
      showToast({
        kind: d.connected ? 'success' : 'error',
        message: GATEWAY_STATUS[d.status] ?? 'Gateway status is unknown',
      });
    },
    onError: (e) => showToast({ kind: 'error', message: errorMessage(e) }),
  });
  const toggleActive = useMutation({
    mutationFn: (g: SipGateway) =>
      gatewaysApi.update(g.id, { active: !g.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gateways'] }),
  });
  function view(g: SipGateway) {
    setSelected(g);
    setMode('view');
  }
  function edit(g: SipGateway) {
    setSelected(g);
    setErr('');
    setForm({
      name: g.name,
      realm: g.realm,
      proxy: g.proxy || '',
      username: g.username,
      password: '',
      caller_id_number: g.caller_id_number || '',
      caller_id_name: g.caller_id_name || '',
      codecs: g.codecs || [],
      active: g.active,
    });
    setMode('edit');
  }
  function remove(g: SipGateway) {
    if (
      confirm(
        `Delete ${g.name}? Calls that use this gateway will fail, and this can't be undone.`,
      )
    )
      del.mutate(g.id);
  }
  const testing = (id: string) => test.isPending && test.variables === id;
  const last = selected ? tests[selected.id] : undefined;
  return (
    <>
      <PageHeader
        eyebrow="Voice"
        title="SIP Gateways"
        description="Outbound trunks to your carriers: where calls go, how they authenticate, the caller ID and codecs."
        action={
          <AddButton
            onClick={() => {
              setForm(blank);
              setErr('');
              setMode('add');
            }}
          >
            Add gateway
          </AddButton>
        }
      />
      <Card>
        {data.isLoading ? (
          <Spinner />
        ) : (data.data || []).length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Gateway</th>
                  <th>Username</th>
                  <th>Caller ID</th>
                  <th>Codecs</th>
                  <th>Active</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.data!.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <div className="cell-stack">
                        <strong>{g.name}</strong>
                        <span>
                          {g.proxy ? `${g.realm} via ${g.proxy}` : g.realm}
                        </span>
                      </div>
                    </td>
                    <td>{g.username}</td>
                    <td>{g.caller_id_number || '—'}</td>
                    <td>
                      <ValuePills values={g.codecs || []} />
                    </td>
                    <td>
                      <StatusToggle
                        checked={g.active}
                        onChange={() => toggleActive.mutate(g)}
                        disabled={
                          toggleActive.isPending &&
                          toggleActive.variables?.id === g.id
                        }
                        title={g.active ? 'Turn off' : 'Turn on'}
                      />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="table-action"
                          disabled={testing(g.id)}
                          onClick={() => test.mutate(g.id)}
                        >
                          {testing(g.id) ? 'Testing…' : 'Test'}
                        </button>
                        <RowActions
                          onView={() => view(g)}
                          onEdit={() => edit(g)}
                          onDelete={() => remove(g)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={<Router size={16} />}
            text="No SIP gateways yet. Add one to start making outbound calls through your carrier."
          />
        )}
      </Card>
      <Drawer
        open={!!mode}
        onClose={close}
        title={
          mode === 'add'
            ? 'Add SIP gateway'
            : mode === 'edit'
              ? 'Edit SIP gateway'
              : 'Gateway details'
        }
      >
        {mode === 'view' && selected ? (
          <DetailView>
            <DetailSummary
              kind="SIP gateway"
              title={selected.name}
              subtitle={
                selected.proxy
                  ? `${selected.realm} via ${selected.proxy}`
                  : selected.realm
              }
              facts={
                <>
                  <Status value={selected.active ? 'active' : 'inactive'} />
                  <span>{selected.codecs?.length || 0} codecs</span>
                </>
              }
            >
              <button className="btn primary" onClick={() => edit(selected)}>
                Edit gateway
              </button>
              <button
                className="btn"
                disabled={testing(selected.id)}
                onClick={() => test.mutate(selected.id)}
              >
                {testing(selected.id) ? 'Testing…' : 'Test connection'}
              </button>
              <div className="dv-result" role="status">
                {last && (
                  <>
                    <span
                      className={'badge ' + (last.connected ? 'good' : 'bad')}
                    >
                      <span />
                      {last.connected ? 'Connected' : 'Not connected'}
                    </span>
                    <span>
                      {GATEWAY_STATUS[last.status] ??
                        'Gateway status is unknown'}
                      . Tested {last.at.toLocaleTimeString()}.
                    </span>
                  </>
                )}
              </div>
            </DetailSummary>
            <DetailSection title="Connection">
              <DetailRows>
                <DetailRow label="Realm">{selected.realm}</DetailRow>
                <DetailRow label="Outbound proxy">
                  {selected.proxy || 'None, straight to the realm'}
                </DetailRow>
              </DetailRows>
            </DetailSection>
            <DetailSection title="Authentication">
              <DetailRows>
                <DetailRow label="Username">{selected.username}</DetailRow>
                <DetailRow label="Password">Saved</DetailRow>
              </DetailRows>
            </DetailSection>
            <DetailSection title="Caller ID">
              <DetailRows>
                <DetailRow label="Number">
                  {selected.caller_id_number || 'From the call'}
                </DetailRow>
                <DetailRow label="Name">
                  {selected.caller_id_name || 'From the call'}
                </DetailRow>
              </DetailRows>
            </DetailSection>
            <DetailSection title="Codecs">
              <DetailRows>
                <DetailRow label="Offered to the carrier">
                  <ValuePills values={selected.codecs || []} />
                </DetailRow>
              </DetailRows>
            </DetailSection>
            <DetailSection title="Details">
              <DetailRows>
                <DetailRow label="Gateway ID">
                  <CopyValue value={selected.id} label="gateway ID" />
                </DetailRow>
                <DetailRow label="Created">
                  {new Date(selected.created_at).toLocaleString()}
                </DetailRow>
                <DetailRow label="Last updated">
                  {new Date(selected.updated_at).toLocaleString()}
                </DetailRow>
              </DetailRows>
            </DetailSection>
          </DetailView>
        ) : (
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <ErrorBox message={err} />
            <FormSection title="Gateway">
              <Field
                label="Name"
                hint="Shown in the portal and when you pick a gateway for a call"
              >
                <input
                  required
                  value={form.name}
                  placeholder="Main carrier"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </Field>
              <Field
                label="Realm"
                hint="Your carrier's SIP domain or IP address"
              >
                <input
                  required
                  value={form.realm}
                  placeholder="sip.carrier.com"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, realm: e.target.value }))
                  }
                />
              </Field>
              <Field
                label="Outbound proxy"
                hint="Optional. Leave blank to send calls straight to the realm"
              >
                <input
                  value={form.proxy}
                  placeholder="proxy.carrier.com:5060"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, proxy: e.target.value }))
                  }
                />
              </Field>
            </FormSection>
            <FormSection
              title="Authentication"
              hint="The SIP credentials your carrier gave you."
            >
              <Field label="Username">
                <input
                  required
                  value={form.username}
                  autoComplete="off"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, username: e.target.value }))
                  }
                />
              </Field>
              <Field
                label="Password"
                hint={
                  mode === 'edit'
                    ? 'Leave blank to keep the current password'
                    : undefined
                }
              >
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                />
              </Field>
            </FormSection>
            <FormSection
              title="Caller ID"
              hint="Optional. Leave blank to use the caller ID set on each call."
            >
              <Field
                label="Number"
                hint="International format, e.g. +27100562194"
              >
                <input
                  value={form.caller_id_number}
                  inputMode="tel"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, caller_id_number: e.target.value }))
                  }
                />
              </Field>
              <Field label="Name">
                <input
                  value={form.caller_id_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, caller_id_name: e.target.value }))
                  }
                />
              </Field>
            </FormSection>
            <FormSection
              title="Codecs"
              hint="Audio formats offered to the carrier. Most carriers accept PCMU and PCMA."
            >
              <ChoiceChips
                label="Codecs"
                options={CODEC_OPTIONS.map((c) => ({ value: c, label: c }))}
                value={form.codecs}
                onChange={(codecs) => setForm((f) => ({ ...f, codecs }))}
              />
              {!form.codecs.length && (
                <p className="fs-hint" role="alert">
                  Choose at least one codec.
                </p>
              )}
            </FormSection>
            <FormSection title="Status">
              <Toggle
                checked={form.active}
                onChange={(v) => setForm((f) => ({ ...f, active: v }))}
                label="Use this gateway for calls"
              />
            </FormSection>
            <DrawerActions>
              <button
                className="btn primary"
                disabled={save.isPending || !form.codecs.length}
              >
                {save.isPending
                  ? 'Saving…'
                  : mode === 'add'
                    ? 'Add gateway'
                    : 'Save changes'}
              </button>
              <button type="button" className="btn" onClick={close}>
                Cancel
              </button>
              {mode === 'edit' && selected && (
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => remove(selected)}
                >
                  Delete
                </button>
              )}
            </DrawerActions>
          </form>
        )}
      </Drawer>
    </>
  );
}
