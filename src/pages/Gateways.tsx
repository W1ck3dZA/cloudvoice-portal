import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  PageHeader,
  RowActions,
  Spinner,
  Status,
  StatusToggle,
  rowOpen,
  RowMain,
} from '../components/UI';
import {
  CopyValue,
  DetailRow,
  DetailRows,
  DetailSection,
  DetailSummary,
  DetailView,
  ValuePills,
} from '../components/Details';
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
  const navigate = useNavigate();
  const [selected, setSelected] = useState<SipGateway | null>(null);
  // Latest connection test per gateway, shown in its drawer.
  const [tests, setTests] = useState<Record<string, TestResult>>({});
  const close = () => setSelected(null);
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
  const view = (g: SipGateway) => setSelected(g);
  const edit = (g: SipGateway) => navigate(`/gateways/${g.id}/edit`);
  function remove(g: SipGateway) {
    del.mutate(g.id);
  }
  const testing = (id: string) => test.isPending && test.variables === id;
  const last = selected ? tests[selected.id] : undefined;
  return (
    <>
      <PageHeader
        title="SIP gateways"
        description="Outbound trunks to your carriers: where calls go, how they authenticate, the caller ID and codecs."
        action={
          <AddButton onClick={() => navigate('/gateways/new')}>
            Add gateway
          </AddButton>
        }
      />
      <Card>
        {data.isLoading ? (
          <Spinner />
        ) : (data.data || []).length ? (
          <div className="table-wrap">
            <table className="rt">
              <thead>
                <tr>
                  <th>Gateway</th>
                  <th className="hide-md">Username</th>
                  <th className="hide-md">Caller ID</th>
                  <th>Codecs</th>
                  <th>Active</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.data!.map((g) => (
                  <tr key={g.id} {...rowOpen(() => view(g))}>
                    <RowMain
                      onOpen={() => view(g)}
                      label={`Open ${g.name}`}
                      title={g.name}
                      sub={g.proxy ? `${g.realm} via ${g.proxy}` : g.realm}
                    >
                      <div className="cell-stack">
                        <strong>{g.name}</strong>
                        <span>
                          {g.proxy ? `${g.realm} via ${g.proxy}` : g.realm}
                        </span>
                      </div>
                    </RowMain>
                    <td className="hide-md">{g.username}</td>
                    <td className="hide-md">{g.caller_id_number || '—'}</td>
                    <td>
                      <ValuePills values={g.codecs || []} />
                    </td>
                    <td className="c-end">
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
                          className="table-action wide-only"
                          disabled={testing(g.id)}
                          onClick={() => test.mutate(g.id)}
                        >
                          {testing(g.id) ? 'Testing…' : 'Test'}
                        </button>
                        <RowActions
                          onView={() => view(g)}
                          onEdit={() => edit(g)}
                          onDelete={() => remove(g)}
                          deleteLabel={`Delete ${g.name}`}
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
      <Drawer open={!!selected} onClose={close} title="Gateway details">
        {selected && (
          <DetailView>
            <DetailSummary
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
        )}
      </Drawer>
    </>
  );
}
