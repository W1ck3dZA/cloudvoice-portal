import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AppWindow, GitBranch } from 'lucide-react';
import { appsApi, errorMessage } from '../lib/api';
import type { Application } from '../types/api';
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
const blank = { name: '', description: '', active: true, record_calls: false };
export default function Applications() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ['apps'], queryFn: appsApi.list });
  const [mode, setMode] = useState<'add' | 'edit' | 'view' | null>(null);
  const [selected, setSelected] = useState<Application | null>(null);
  const [form, setForm] = useState(blank);
  const [err, setErr] = useState('');
  const close = () => {
    setMode(null);
    setSelected(null);
    setErr('');
  };
  const save = useMutation({
    mutationFn: () =>
      mode === 'add'
        ? appsApi.create({
            name: form.name,
            description: form.description,
            flow: [],
            config: { record_calls: form.record_calls },
            active: form.active,
          })
        : appsApi.update(selected!.id, {
            name: form.name,
            description: form.description,
            config: { record_calls: form.record_calls },
            active: form.active,
          }),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ['apps'] });
      close();
      if (mode === 'add') nav(`/applications/${a.id}/builder`);
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: appsApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apps'] });
      close();
    },
  });
  const toggleActive = useMutation({
    mutationFn: (a: Application) => appsApi.update(a.id, { active: !a.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apps'] }),
  });
  function edit(a: Application) {
    setSelected(a);
    setForm({
      name: a.name,
      description: a.description || '',
      active: a.active,
      record_calls: !!a.config?.record_calls,
    });
    setMode('edit');
  }
  return (
    <>
      <PageHeader
        eyebrow="Routing"
        title="Applications"
        description="Build and manage call-flow applications. Every flow change creates a new application version."
        action={
          <AddButton
            onClick={() => {
              setForm(blank);
              setMode('add');
            }}
          >
            New application
          </AddButton>
        }
      />
      {data.isLoading ? (
        <Spinner />
      ) : (
        <div className="app-grid">
          {(data.data || []).map((a) => (
            <Card className="app-card" key={a.id}>
              <div className="app-card-top">
                <div className="app-icon">
                  <AppWindow />
                </div>
                <StatusToggle
                  checked={a.active}
                  onChange={() => toggleActive.mutate(a)}
                  disabled={
                    toggleActive.isPending &&
                    toggleActive.variables?.id === a.id
                  }
                />
              </div>
              <h3>{a.name}</h3>
              <p>{a.description || 'No description'}</p>
              <div className="app-meta">
                <span>Version {a.version}</span>
                <span>{a.flow?.length || 0} top-level steps</span>
              </div>
              <div className="button-row">
                <button
                  className="btn primary grow"
                  onClick={() => nav(`/applications/${a.id}/builder`)}
                >
                  <GitBranch size={15} /> Flow builder
                </button>
                <button className="btn" onClick={() => edit(a)}>
                  Settings
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {!data.isLoading && !data.data?.length && (
        <Card>
          <Empty
            icon={<AppWindow size={16} />}
            text="Create your first application, then design its call flow visually."
            action={
              <AddButton
                onClick={() => {
                  setForm(blank);
                  setMode('add');
                }}
              >
                New application
              </AddButton>
            }
          />
        </Card>
      )}
      <Drawer
        open={!!mode}
        onClose={close}
        title={
          mode === 'add'
            ? 'New application'
            : mode === 'edit'
              ? 'Application settings'
              : selected?.name || 'Application'
        }
      >
        {mode === 'view' && selected ? null : (
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <ErrorBox message={err} />
            <Field label="Name">
              <input
                required
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </Field>
            <Field label="Description">
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </Field>
            <Toggle
              checked={form.record_calls}
              onChange={(v) => setForm((f) => ({ ...f, record_calls: v }))}
              label="Record calls by default"
            />
            <Toggle
              checked={form.active}
              onChange={(v) => setForm((f) => ({ ...f, active: v }))}
              label="Application active"
            />
            <button className="btn primary" disabled={save.isPending}>
              Save application
            </button>
            {mode === 'edit' && selected && (
              <button
                className="btn danger"
                type="button"
                onClick={() =>
                  confirm(`Delete ${selected.name}?`) && del.mutate(selected.id)
                }
              >
                Delete application
              </button>
            )}
          </form>
        )}
      </Drawer>
    </>
  );
}
