import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RadioTower, Search } from 'lucide-react';
import { appsApi, errorMessage, numbersApi } from '../lib/api';
import { useSession } from '../lib/session';
import type { NumberResource } from '../types/api';
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
  HoldToDelete,
  rowOpen,
  RowMain,
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
} from '../components/Details';
const capabilityText = (c: ('voice' | 'sms')[]) =>
  c.includes('voice') && c.includes('sms')
    ? 'Voice and SMS'
    : c.includes('voice')
      ? 'Voice only'
      : c.includes('sms')
        ? 'SMS only'
        : 'No capabilities';
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
  return (
    <>
      <PageHeader
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
            <table className="rt">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Capabilities</th>
                  <th>Application</th>
                  <th>Status</th>
                  <th className="hide-md">Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((n) => (
                  <tr key={n.id} {...rowOpen(() => openView(n))}>
                    <RowMain
                      onOpen={() => openView(n)}
                      label={`Open ${n.e164}`}
                      sub={[
                        n.capabilities.join(', ').toUpperCase(),
                        apps.data?.find((a) => a.id === n.application_id)
                          ?.name || 'No application',
                      ].join(' · ')}
                    >
                      <strong>{n.e164}</strong>
                    </RowMain>
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
                    <td className="c-end">
                      <StatusToggle
                        checked={n.active}
                        onChange={() => toggleActive.mutate(n)}
                        disabled={
                          toggleActive.isPending &&
                          toggleActive.variables?.id === n.id
                        }
                      />
                    </td>
                    <td className="hide-md">
                      {new Date(n.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <RowActions
                        onView={() => openView(n)}
                        onEdit={() => openEdit(n)}
                        onDelete={() => del.mutate(n.id)}
                        deleteLabel={`Release ${n.e164}`}
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
              : 'Number details'
        }
      >
        {mode === 'view' && selected ? (
          <DetailView>
            <DetailSummary
              title={selected.e164}
              facts={
                <>
                  <Status value={selected.active ? 'active' : 'inactive'} />
                  <span>{capabilityText(selected.capabilities)}</span>
                </>
              }
            >
              <button
                className="btn primary"
                onClick={() => openEdit(selected)}
              >
                Edit number
              </button>
            </DetailSummary>
            <DetailSection title="Routing">
              <DetailRows>
                <DetailRow label="Inbound application">
                  {selected.capabilities.includes('voice')
                    ? apps.data?.find((a) => a.id === selected.application_id)
                        ?.name || 'None'
                    : 'Voice not enabled'}
                </DetailRow>
                <DetailRow label="Accepting calls and messages">
                  <StatusToggle
                    checked={selected.active}
                    onChange={() => toggleActive.mutate(selected)}
                    disabled={
                      toggleActive.isPending &&
                      toggleActive.variables?.id === selected.id
                    }
                  />
                </DetailRow>
              </DetailRows>
            </DetailSection>
            <DetailSection title="Details">
              <DetailRows>
                <DetailRow label="Number ID">
                  <CopyValue value={selected.id} label="number ID" />
                </DetailRow>
                <DetailRow label="Added">
                  {new Date(selected.created_at).toLocaleString()}
                </DetailRow>
              </DetailRows>
            </DetailSection>
          </DetailView>
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
            <FormSection title="Number">
              <Field
                label="Phone number"
                hint={
                  mode === 'edit'
                    ? "Can't be changed once added"
                    : 'International format with the country code, e.g. +27821234567'
                }
              >
                <input
                  value={form.e164}
                  disabled={mode === 'edit'}
                  required
                  inputMode="tel"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, e164: e.target.value }))
                  }
                  placeholder="+27821234567"
                />
              </Field>
            </FormSection>
            <FormSection
              title="Capabilities"
              hint="What this number can be used for."
            >
              <ChoiceChips
                label="Capabilities"
                options={[
                  { value: 'voice', label: 'Voice' },
                  { value: 'sms', label: 'SMS' },
                ]}
                value={form.capabilities}
                onChange={(capabilities) =>
                  setForm((f) => ({ ...f, capabilities }))
                }
              />
            </FormSection>
            <FormSection title="Routing">
              {form.capabilities.includes('voice') && (
                <Field
                  label="Inbound application"
                  hint="Runs when someone calls this number"
                >
                  <select
                    value={form.application_id}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        application_id: e.target.value,
                      }))
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
                label="Accept calls and messages on this number"
              />
            </FormSection>
            <DrawerActions>
              <button className="btn primary" disabled={save.isPending}>
                {save.isPending
                  ? 'Saving…'
                  : mode === 'add'
                    ? 'Add number'
                    : 'Save changes'}
              </button>
              <button type="button" className="btn" onClick={close}>
                Cancel
              </button>
            </DrawerActions>
            {mode === 'edit' && selected && (
              <HoldToDelete
                label="Hold to release number"
                consequence={`Calls and messages to ${selected.e164} stop. This can't be undone.`}
                onHold={() => del.mutate(selected.id)}
              />
            )}
          </form>
        )}
      </Drawer>
    </>
  );
}
