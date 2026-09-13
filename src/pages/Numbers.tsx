import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RadioTower, Search } from 'lucide-react';
import { appsApi, errorMessage, numbersApi } from '../lib/api';
import { useSession } from '../lib/session';
import type { NumberResource } from '../types/api';
import {
  AddButton,
  Card,
  ConfirmBar,
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
  e164: '',
  capabilities: ['voice'] as ('voice' | 'sms')[],
  application_id: '',
  active: true,
};
export default function Numbers() {
  const { session } = useSession();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<'view' | 'add' | 'edit' | null>(null);
  const [selected, setSelected] = useState<NumberResource | null>(null);
  const [form, setForm] = useState(blank);
  const [err, setErr] = useState('');
  const rows = useQuery({
    queryKey: ['numbers', session?.orgId],
    queryFn: () => numbersApi.list(session?.orgId || undefined),
  });
  const apps = useQuery({ queryKey: ['apps'], queryFn: appsApi.list });
  const save = useMutation({
    mutationFn: () =>
      mode === 'add'
        ? numbersApi.create(
            { ...form, application_id: form.application_id || null },
            session?.orgId || undefined,
          )
        : numbersApi.update(selected!.id, {
            capabilities: form.capabilities,
            application_id: form.application_id || null,
            active: form.active,
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['numbers'] });
      close();
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => numbersApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['numbers'] });
      close();
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const toggleActive = useMutation({
    mutationFn: (n: NumberResource) =>
      numbersApi.update(n.id, { active: !n.active }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['numbers'] });
      setSelected((s) => (s && s.id === updated.id ? updated : s));
    },
  });
  const filtered = useMemo(
    () => (rows.data || []).filter((n) => n.e164.includes(q)),
    [rows.data, q],
  );
  function openAdd() {
    setSelected(null);
    setForm(blank);
    setErr('');
    setMode('add');
  }
  function openView(n: NumberResource) {
    setSelected(n);
    setMode('view');
    setErr('');
  }
  function openEdit(n: NumberResource) {
    setSelected(n);
    setForm({
      e164: n.e164,
      capabilities: [...n.capabilities],
      application_id: n.application_id || '',
      active: n.active,
    });
    setMode('edit');
    setErr('');
  }
  function close() {
    setMode(null);
    setSelected(null);
    setErr('');
  }
  function cap(c: 'voice' | 'sms', v: boolean) {
    setForm((f) => ({
      ...f,
      capabilities: v
        ? [...new Set([...f.capabilities, c])]
        : f.capabilities.filter((x) => x !== c),
    }));
  }
  return (
    <>
      <PageHeader
        eyebrow="Voice"
        title="Numbers"
        description="Provision numbers, assign voice applications and control capabilities."
        action={<AddButton onClick={openAdd}>Add number</AddButton>}
      />
      <Card>
        <div className="toolbar">
          <div className="search">
            <Search size={17} />
            <input
              placeholder="Search numbers…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <span className="muted">{filtered.length} numbers</span>
        </div>
        {rows.isLoading ? (
          <Spinner />
        ) : filtered.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Capabilities</th>
                  <th>Application</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((n) => (
                  <tr key={n.id}>
                    <td>
                      <strong>{n.e164}</strong>
                    </td>
                    <td>
                      <div className="chips">
                        {n.capabilities.map((c) => (
                          <span className="chip" key={c}>
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {apps.data?.find((a) => a.id === n.application_id)
                        ?.name || '—'}
                    </td>
                    <td>
                      <StatusToggle
                        checked={n.active}
                        onChange={() => toggleActive.mutate(n)}
                        disabled={
                          toggleActive.isPending &&
                          toggleActive.variables?.id === n.id
                        }
                      />
                    </td>
                    <td>{new Date(n.created_at).toLocaleDateString()}</td>
                    <td>
                      <RowActions
                        onView={() => openView(n)}
                        onEdit={() => openEdit(n)}
                        onDelete={() => {
                          if (confirm(`Release ${n.e164}?`)) del.mutate(n.id);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={<RadioTower size={16} />}
            text="No numbers are registered to this organisation."
            action={<AddButton onClick={openAdd}>Add number</AddButton>}
          />
        )}
      </Card>
      <Drawer
        open={!!mode}
        onClose={close}
        title={
          mode === 'add'
            ? 'Add number'
            : mode === 'edit'
              ? 'Edit number'
              : selected?.e164 || 'Number'
        }
      >
        {mode === 'view' && selected ? (
          <>
            <div className="detail-grid">
              <div className="detail-item">
                <span>E.164</span>
                <strong>{selected.e164}</strong>
              </div>
              <div className="detail-item">
                <span>Capabilities</span>
                <strong>{selected.capabilities.join(', ')}</strong>
              </div>
              <div className="detail-item">
                <span>Application</span>
                <strong>
                  {apps.data?.find((a) => a.id === selected.application_id)
                    ?.name || 'None'}
                </strong>
              </div>
              <div className="detail-item">
                <span>Status</span>
                <StatusToggle
                  checked={selected.active}
                  onChange={() => toggleActive.mutate(selected)}
                  disabled={
                    toggleActive.isPending &&
                    toggleActive.variables?.id === selected.id
                  }
                />
              </div>
            </div>
            <div className="drawer-footer">
              <button
                className="btn primary"
                onClick={() => openEdit(selected)}
              >
                Edit number
              </button>
            </div>
          </>
        ) : (
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              setErr('');
              save.mutate();
            }}
          >
            <ErrorBox message={err} />
            <Field
              label="E.164 number"
              hint="Cannot be changed after provisioning"
            >
              <input
                value={form.e164}
                disabled={mode === 'edit'}
                required
                onChange={(e) =>
                  setForm((f) => ({ ...f, e164: e.target.value }))
                }
                placeholder="+27821234567"
              />
            </Field>
            <div>
              <div className="field-label">Capabilities</div>
              <div className="check-row">
                <label>
                  <input
                    type="checkbox"
                    checked={form.capabilities.includes('voice')}
                    onChange={(e) => cap('voice', e.target.checked)}
                  />{' '}
                  Voice
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={form.capabilities.includes('sms')}
                    onChange={(e) => cap('sms', e.target.checked)}
                  />{' '}
                  SMS
                </label>
              </div>
            </div>
            {form.capabilities.includes('voice') && (
              <Field label="Inbound application">
                <select
                  value={form.application_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, application_id: e.target.value }))
                  }
                  required
                >
                  <option value="">Select application…</option>
                  {(apps.data || []).map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Toggle
              checked={form.active}
              onChange={(v) => setForm((f) => ({ ...f, active: v }))}
              label="Number active"
            />
            <div className="drawer-footer">
              <button className="btn primary" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save number'}
              </button>
              {mode === 'edit' && selected && (
                <button
                  className="btn danger"
                  type="button"
                  onClick={() => {
                    if (confirm(`Release ${selected.e164}?`))
                      del.mutate(selected.id);
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </form>
        )}
      </Drawer>
    </>
  );
}
