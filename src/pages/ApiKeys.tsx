import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, KeyRound } from 'lucide-react';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { apiKeysApi, errorMessage } from '../lib/api';
import { useSession } from '../lib/session';
import { showToast } from '../lib/toast';
import type { ApiKey } from '../types/api';
import {
  AddButton,
  Card,
  Drawer,
  Empty,
  ErrorBox,
  Field,
  PageHeader,
  SecretReveal,
  Spinner,
  Status,
  HoldToDelete,
  rowOpen,
  RowMain,
} from '../components/UI';
import { HoldButton } from '../components/HoldButton';
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
const SCOPES = [
  {
    value: 'read',
    label: 'Read',
    hint: 'View calls, numbers, recordings and settings',
  },
  {
    value: 'write',
    label: 'Write',
    hint: 'Place calls, send SMS, and create, change or delete anything',
  },
] as const;
const accessText = (scopes: string[]) =>
  scopes.includes('read') && scopes.includes('write')
    ? 'Read and write'
    : scopes.includes('write')
      ? 'Write only'
      : scopes.includes('read')
        ? 'Read only'
        : 'No access';
const date = (iso: string | null, fallback = 'Never') =>
  iso ? new Date(iso).toLocaleString() : fallback;
export default function ApiKeys() {
  const { session } = useSession();
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ['api-keys'], queryFn: apiKeysApi.list });
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ApiKey | null>(null);
  const [limitsOpen, setLimitsOpen] = useState<ApiKey | null>(null);
  const [limits, setLimits] = useState({
    requests_per_minute: '',
    requests_per_day: '',
  });
  const [secret, setSecret] = useState('');
  const [err, setErr] = useState('');
  const [form, setForm] = useState({
    name: '',
    scopes: ['read'] as string[],
    expires_at: '',
  });
  const create = useMutation({
    mutationFn: () =>
      apiKeysApi.create({
        name: form.name,
        org_id: session?.orgId,
        scopes: form.scopes,
        expires_at: form.expires_at || null,
      }),
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ['api-keys'] });
      setOpen(false);
      setSecret(d?.key || d?.token || '');
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: apiKeysApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['api-keys'] });
      setView(null);
      showToast({ kind: 'success', message: 'API key revoked.' });
    },
    onError: (e) => showToast({ kind: 'error', message: errorMessage(e) }),
  });
  const saveLimits = useMutation({
    mutationFn: () =>
      apiKeysApi.limits(limitsOpen!.id, {
        requests_per_minute: limits.requests_per_minute
          ? +limits.requests_per_minute
          : undefined,
        requests_per_day: limits.requests_per_day
          ? +limits.requests_per_day
          : undefined,
      }),
    onSuccess: () => {
      setLimitsOpen(null);
      showToast({ kind: 'success', message: 'Rate limits saved.' });
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  function openCreate() {
    setErr('');
    setForm({ name: '', scopes: ['read'], expires_at: '' });
    setOpen(true);
  }
  function openLimits(k: ApiKey) {
    setErr('');
    setLimits({ requests_per_minute: '', requests_per_day: '' });
    setView(null);
    setLimitsOpen(k);
  }
  function revoke(k: ApiKey) {
    del.mutate(k.id);
  }
  return (
    <>
      <PageHeader
        title="API keys"
        description="Keys for your own servers and integrations to call the Cloudvoice API. Give each integration its own key with only the access it needs."
        action={<AddButton onClick={openCreate}>Create API key</AddButton>}
      />
      <Card>
        {data.isLoading ? (
          <Spinner />
        ) : (data.data || []).length ? (
          <div className="table-wrap">
            <table className="rt">
              <thead>
                <tr>
                  <th>Key</th>
                  <th className="hide-md">Access</th>
                  <th>Status</th>
                  <th>Last used</th>
                  <th className="hide-md">Expires</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.data!.map((k) => (
                  <tr key={k.id} {...rowOpen(() => setView(k))}>
                    <RowMain
                      onOpen={() => setView(k)}
                      label={`Open ${k.name}`}
                      title={k.name}
                      sub={`${k.prefix}… · ${accessText(k.scopes)}`}
                    >
                      <div className="cell-stack">
                        <strong>{k.name}</strong>
                        <span>{k.prefix}…</span>
                      </div>
                    </RowMain>
                    <td className="hide-md">{accessText(k.scopes)}</td>
                    <td className="c-end">
                      <Status value={k.status} />
                    </td>
                    <td>{date(k.last_used_at)}</td>
                    <td className="hide-md">
                      {k.expires_at
                        ? new Date(k.expires_at).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="table-action wide-only"
                          onClick={() => setView(k)}
                        >
                          View{' '}
                          <AnimatedIcon
                            icon={ChevronRight}
                            size={14}
                            animation="nudge"
                          />
                        </button>
                        {k.status === 'active' && (
                          <>
                            <button
                              className="table-action"
                              onClick={() => openLimits(k)}
                            >
                              Limits
                            </button>
                            <HoldButton
                              iconOnly
                              aria-label={`Revoke ${k.name}`}
                              onHold={() => revoke(k)}
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={<KeyRound size={16} />}
            text="No API keys yet. Create one for each server or integration that calls the API."
            action={<AddButton onClick={openCreate}>Create API key</AddButton>}
          />
        )}
      </Card>
      <Drawer open={open} onClose={() => setOpen(false)} title="Create API key">
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setErr('');
            create.mutate();
          }}
        >
          <ErrorBox message={err} />
          <FormSection title="Name">
            <Field
              label="Key name"
              hint="So you can tell keys apart, e.g. CRM integration"
            >
              <input
                required
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </Field>
          </FormSection>
          <FormSection
            title="Access"
            hint="Choose only what this integration needs."
          >
            <div className="check-list" role="group" aria-label="Access">
              {SCOPES.map((sc) => (
                <label key={sc.value}>
                  <input
                    type="checkbox"
                    checked={form.scopes.includes(sc.value)}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        scopes: e.target.checked
                          ? [...f.scopes, sc.value]
                          : f.scopes.filter((x) => x !== sc.value),
                      }))
                    }
                  />
                  <span>
                    <strong>{sc.label}</strong>
                    <small>{sc.hint}</small>
                  </span>
                </label>
              ))}
              {!form.scopes.length && (
                <small className="check-list-note" role="alert">
                  Choose at least one.
                </small>
              )}
            </div>
          </FormSection>
          <FormSection title="Expiry">
            <Field
              label="Expires"
              hint="Optional. Leave blank for a key that doesn't expire"
            >
              <input
                type="datetime-local"
                value={form.expires_at}
                onChange={(e) =>
                  setForm((f) => ({ ...f, expires_at: e.target.value }))
                }
              />
            </Field>
          </FormSection>
          <p className="fs-hint">
            The key is shown once after you create it. Store it somewhere safe.
          </p>
          <DrawerActions>
            <button
              className="btn primary"
              disabled={create.isPending || !form.scopes.length}
            >
              {create.isPending ? 'Creating…' : 'Create key'}
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
        open={!!view}
        onClose={() => setView(null)}
        title="API key details"
      >
        {view && (
          <DetailView>
            <DetailSummary
              title={view.name}
              subtitle={`${view.prefix}…`}
              facts={
                <>
                  <Status value={view.status} />
                  <span>{accessText(view.scopes)}</span>
                  <span>
                    {view.expires_at
                      ? `Expires ${new Date(view.expires_at).toLocaleDateString()}`
                      : "Doesn't expire"}
                  </span>
                </>
              }
            >
              {view.status === 'active' && (
                <>
                  <button
                    className="btn primary"
                    onClick={() => openLimits(view)}
                  >
                    Set rate limits
                  </button>
                  <HoldToDelete
                    label="Hold to revoke key"
                    consequence="Revoking stops anything using this key straight away. It can't be undone."
                    onHold={() => revoke(view)}
                  />
                </>
              )}
            </DetailSummary>
            <DetailSection title="Access">
              <DetailRows>
                {SCOPES.map((sc) => (
                  <DetailRow key={sc.value} label={sc.label}>
                    {view.scopes.includes(sc.value) ? 'Allowed' : 'Not allowed'}
                  </DetailRow>
                ))}
              </DetailRows>
              <p className="dv-note dv-note-block">
                Read lets it view calls, numbers, recordings and settings. Write
                lets it place calls, send SMS, and create, change or delete
                anything.
              </p>
            </DetailSection>
            <DetailSection title="Usage">
              <DetailRows>
                <DetailRow label="Last used">
                  {date(view.last_used_at)}
                </DetailRow>
                <DetailRow label="Created">
                  {date(view.created_at, '—')}
                </DetailRow>
                <DetailRow label="Expires">{date(view.expires_at)}</DetailRow>
              </DetailRows>
            </DetailSection>
            <DetailSection title="Details">
              <DetailRows>
                <DetailRow label="Key ID">
                  <CopyValue value={view.id} label="key ID" />
                </DetailRow>
                <DetailRow label="Prefix">{view.prefix}</DetailRow>
              </DetailRows>
            </DetailSection>
          </DetailView>
        )}
      </Drawer>
      <Drawer
        open={!!limitsOpen}
        onClose={() => setLimitsOpen(null)}
        title="Rate limits"
        subtitle={limitsOpen?.name}
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setErr('');
            saveLimits.mutate();
          }}
        >
          <ErrorBox message={err} />
          <FormSection
            title="Limits"
            hint="Requests over a limit are refused until the window resets. Leave a field blank to keep its current limit."
          >
            <Field label="Requests per minute">
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={limits.requests_per_minute}
                onChange={(e) =>
                  setLimits((v) => ({
                    ...v,
                    requests_per_minute: e.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Requests per day">
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={limits.requests_per_day}
                onChange={(e) =>
                  setLimits((v) => ({ ...v, requests_per_day: e.target.value }))
                }
              />
            </Field>
          </FormSection>
          <DrawerActions>
            <button className="btn primary" disabled={saveLimits.isPending}>
              {saveLimits.isPending ? 'Saving…' : 'Save limits'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setLimitsOpen(null)}
            >
              Cancel
            </button>
          </DrawerActions>
        </form>
      </Drawer>
      <Drawer open={!!secret} onClose={() => setSecret('')} title="API key">
        <SecretReveal
          title="New API key"
          value={secret}
          onClose={() => setSecret('')}
        />
      </Drawer>
    </>
  );
}
