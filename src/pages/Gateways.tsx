import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Router } from 'lucide-react';
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
  StatusToggle,
  Toggle,
} from '../components/UI';
const blank = {
  name: '',
  profile: 'external',
  realm: '',
  proxy: '',
  username: '',
  password: '',
  caller_id_number: '',
  caller_id_name: '',
  codecs: 'PCMU,PCMA',
  active: true,
};
export default function Gateways() {
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ['gateways'], queryFn: gatewaysApi.list });
  const [mode, setMode] = useState<'add' | 'edit' | 'view' | null>(null);
  const [selected, setSelected] = useState<SipGateway | null>(null);
  const [form, setForm] = useState(blank);
  const [err, setErr] = useState('');
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
      codecs: form.codecs
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
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
    onSuccess: (d: any) => alert(d?.message || 'Gateway test completed'),
    onError: (e) => alert(errorMessage(e)),
  });
  const toggleActive = useMutation({
    mutationFn: (g: SipGateway) =>
      gatewaysApi.update(g.id, { active: !g.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gateways'] }),
  });
  function edit(g: SipGateway) {
    setSelected(g);
    setForm({
      name: g.name,
      profile: g.profile,
      realm: g.realm,
      proxy: g.proxy || '',
      username: g.username,
      password: '',
      caller_id_number: g.caller_id_number || '',
      caller_id_name: g.caller_id_name || '',
      codecs: (g.codecs || []).join(','),
      active: g.active,
    });
    setMode('edit');
  }
  return (
    <>
      <PageHeader
        eyebrow="Voice"
        title="SIP Gateways"
        description="Configure outbound trunks, authentication, caller ID and codecs."
        action={
          <AddButton
            onClick={() => {
              setForm(blank);
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
                  <th>Name</th>
                  <th>Realm</th>
                  <th>Profile</th>
                  <th>Username</th>
                  <th>Codecs</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.data!.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <strong>{g.name}</strong>
                    </td>
                    <td>{g.realm}</td>
                    <td>{g.profile}</td>
                    <td>{g.username}</td>
                    <td>{g.codecs?.join(', ') || '—'}</td>
                    <td>
                      <StatusToggle
                        checked={g.active}
                        onChange={() => toggleActive.mutate(g)}
                        disabled={
                          toggleActive.isPending &&
                          toggleActive.variables?.id === g.id
                        }
                      />
                    </td>
                    <td>
                      <RowActions
                        onView={() => {
                          setSelected(g);
                          setMode('view');
                        }}
                        onEdit={() => edit(g)}
                        onDelete={() =>
                          confirm(`Delete ${g.name}?`) && del.mutate(g.id)
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
            icon={<Router size={16} />}
            text="No SIP gateways configured."
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
              : selected?.name || 'Gateway'
        }
      >
        {mode === 'view' && selected ? (
          <>
            <div className="detail-grid">
              <div className="detail-item">
                <span>Realm</span>
                <strong>{selected.realm}</strong>
              </div>
              <div className="detail-item">
                <span>Proxy</span>
                <strong>{selected.proxy || 'Direct'}</strong>
              </div>
              <div className="detail-item">
                <span>Username</span>
                <strong>{selected.username}</strong>
              </div>
              <div className="detail-item">
                <span>Caller ID</span>
                <strong>{selected.caller_id_number || '—'}</strong>
              </div>
            </div>
            <div className="button-row">
              <button className="btn primary" onClick={() => edit(selected)}>
                Edit
              </button>
              <button className="btn" onClick={() => test.mutate(selected.id)}>
                Test gateway
              </button>
            </div>
          </>
        ) : (
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <ErrorBox message={err} />
            {(
              [
                'name',
                'profile',
                'realm',
                'proxy',
                'username',
                'password',
                'caller_id_number',
                'caller_id_name',
                'codecs',
              ] as const
            ).map((k) => (
              <Field label={k.replaceAll('_', ' ')} key={k}>
                <input
                  type={k === 'password' ? 'password' : 'text'}
                  required={['name', 'realm', 'username'].includes(k)}
                  placeholder={
                    k === 'password' && mode === 'edit'
                      ? 'Leave blank to keep current password'
                      : ''
                  }
                  value={form[k]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [k]: e.target.value }))
                  }
                />
              </Field>
            ))}
            <Toggle
              checked={form.active}
              onChange={(v) => setForm((f) => ({ ...f, active: v }))}
              label="Gateway active"
            />
            <button className="btn primary" disabled={save.isPending}>
              Save gateway
            </button>
          </form>
        )}
      </Drawer>
    </>
  );
}
