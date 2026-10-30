import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage, webhooksApi } from '../lib/api';
import { showToast } from '../lib/toast';
import { EVENT_GROUPS, ALL_EVENT_TYPES } from '../lib/eventTypes';
import type { WebhookEndpoint } from '../types/api';
import {
  ErrorBox,
  Field,
  HoldToDelete,
  SecretReveal,
  Spinner,
  Toggle,
} from '../components/UI';
import { FormSection } from '../components/Details';
import {
  EditCard,
  EditHeader,
  EditTabs,
  SaveBar,
  focusField,
  useEditTab,
  useUnsavedGuard,
} from '../components/EditPage';

const KNOWN = new Set([
  ...ALL_EVENT_TYPES.map((t) => t.type),
  ...EVENT_GROUPS.flatMap((g) => (g.wildcard ? [g.wildcard.pattern] : [])),
]);
type Form = {
  url: string;
  description: string;
  scope: 'all' | 'some';
  selected: string[];
  custom: string;
  active: boolean;
};
type Key = keyof Form;
const blank: Form = {
  url: '',
  description: '',
  scope: 'all',
  selected: [],
  custom: '',
  active: true,
};
const fromWebhook = (w: WebhookEndpoint): Form => {
  const types = w.event_types || [];
  return {
    url: w.url,
    description: w.description || '',
    scope: types.length ? 'some' : 'all',
    selected: types.filter((t) => KNOWN.has(t)),
    custom: types.filter((t) => !KNOWN.has(t)).join(', '),
    active: w.active,
  };
};
const host = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};
const TABS = [
  { id: 'endpoint', label: 'Endpoint' },
  { id: 'events', label: 'Events' },
];
const TAB_OF: Record<Key, string> = {
  url: 'endpoint',
  description: 'endpoint',
  active: 'endpoint',
  scope: 'events',
  selected: 'events',
  custom: 'events',
};
function eventTypes(f: Form) {
  if (f.scope === 'all') return [];
  const custom = f.custom
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  return [...new Set([...f.selected, ...custom])];
}
function validate(f: Form) {
  const e: Partial<Record<Key, string>> = {};
  let ok = false;
  try {
    ok = ['https:', 'http:'].includes(new URL(f.url.trim()).protocol);
  } catch {
    ok = false;
  }
  if (!f.url.trim()) e.url = 'Enter the URL on your server.';
  else if (!ok) e.url = 'Enter a full address, e.g. https://example.com/hooks.';
  if (f.scope === 'some' && !eventTypes(f).length)
    e.selected = 'Choose at least one event type, or send all events.';
  return e;
}

export default function WebhookEdit() {
  const { id } = useParams();
  const isNew = !id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const existing = useQuery({
    queryKey: ['webhook', id],
    queryFn: () => webhooksApi.get(id!),
    enabled: !isNew,
  });
  const initial = useMemo(
    () => (existing.data ? fromWebhook(existing.data) : blank),
    [existing.data],
  );
  const [form, setForm] = useState<Form>(blank);
  useEffect(() => setForm(initial), [initial]);
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({});
  const [err, setErr] = useState('');
  const [secret, setSecret] = useState('');
  const [tab, goTab] = useEditTab(TABS.map((t) => t.id));
  const changed = (k: Key) =>
    JSON.stringify(form[k]) !== JSON.stringify(initial[k]);
  const dirty = !secret && (Object.keys(form) as Key[]).some(changed);
  useUnsavedGuard(dirty);
  const set = <K extends Key>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    const ek = k === 'custom' || k === 'scope' ? 'selected' : k;
    if (errors[ek]) setErrors((e) => ({ ...e, [ek]: undefined }));
  };
  function toggleType(t: string, on: boolean) {
    set(
      'selected',
      on ? [...form.selected, t] : form.selected.filter((x) => x !== t),
    );
  }

  const save = useMutation({
    mutationFn: () => {
      const b = {
        url: form.url.trim(),
        description: form.description.trim(),
        event_types: eventTypes(form),
        active: form.active,
      };
      return isNew ? webhooksApi.create(b) : webhooksApi.update(id!, b);
    },
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      qc.invalidateQueries({ queryKey: ['webhook', id] });
      if (d?.secret) {
        setSecret(d.secret);
        return;
      }
      showToast({ kind: 'success', message: 'Webhook saved.' });
      navigate('/webhooks');
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: () => webhooksApi.remove(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      showToast({ kind: 'success', message: 'Webhook deleted.' });
      navigate('/webhooks');
    },
    onError: (e) => showToast({ kind: 'error', message: errorMessage(e) }),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const v = validate(form);
    setErrors(v);
    const first = (Object.keys(TAB_OF) as Key[]).find((k) => v[k]);
    if (first) {
      if (!isNew) goTab(TAB_OF[first]);
      focusField(`wh-${first}`);
      return;
    }
    save.mutate();
  }

  if (!isNew && existing.isLoading) return <Spinner />;
  if (!isNew && !existing.data)
    return (
      <div className="edit-page">
        <EditHeader
          backTo="/webhooks"
          backLabel="Webhooks"
          title="Webhook not found"
          description="It may have been deleted. Go back to the list to pick another."
        />
      </div>
    );
  if (secret)
    return (
      <div className="edit-page">
        <EditHeader
          backTo="/webhooks"
          backLabel="Webhooks"
          title="Webhook added"
          description={`Events will be sent to ${host(form.url)}. Copy the signing secret to your server so it can check each request.`}
        />
        <SecretReveal
          title="Signing secret"
          value={secret}
          onClose={() => navigate('/webhooks')}
        />
      </div>
    );

  const fieldErr = (k: Key) =>
    errors[k] && (
      <small className="field-error" role="alert">
        {errors[k]}
      </small>
    );
  const endpoint = (
    <FormSection title="Endpoint">
      <Field
        label="URL"
        hint="An HTTPS address on your server that can be reached from the internet"
      >
        <input
          id="wh-url"
          type="url"
          inputMode="url"
          placeholder="https://example.com/webhooks/cloudvoice"
          value={form.url}
          aria-invalid={!!errors.url}
          onChange={(e) => set('url', e.target.value)}
        />
        {fieldErr('url')}
      </Field>
      <Field
        label="Description"
        hint="Optional. So you can tell webhooks apart, e.g. CRM sync"
      >
        <input
          id="wh-description"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </Field>
      {!isNew && (
        <Toggle
          checked={form.active}
          onChange={(v) => set('active', v)}
          label="Deliver events to this URL"
        />
      )}
    </FormSection>
  );
  const events = (
    <FormSection title="Events" hint="Which events to send to this URL.">
      <div className="wh-scope" role="radiogroup" aria-label="Events">
        <label className={form.scope === 'all' ? 'on' : ''}>
          <input
            type="radio"
            name="scope"
            checked={form.scope === 'all'}
            onChange={() => set('scope', 'all')}
          />
          <span>
            <strong>All events</strong>
            <small>Including new types added later</small>
          </span>
        </label>
        <label className={form.scope === 'some' ? 'on' : ''}>
          <input
            type="radio"
            name="scope"
            checked={form.scope === 'some'}
            onChange={() => set('scope', 'some')}
          />
          <span>
            <strong>Only the events I choose</strong>
            <small>Pick event types below</small>
          </span>
        </label>
      </div>
      {form.scope === 'some' && (
        <div className="wh-groups" id="wh-selected" tabIndex={-1}>
          {EVENT_GROUPS.map((g) => {
            const whole =
              !!g.wildcard && form.selected.includes(g.wildcard.pattern);
            return (
              <fieldset className="wh-group" key={g.label}>
                <legend>{g.label}</legend>
                <div className="wh-type-grid">
                  {g.wildcard && (
                    <label className="wh-type wh-wild">
                      <input
                        type="checkbox"
                        checked={whole}
                        onChange={(e) =>
                          toggleType(g.wildcard!.pattern, e.target.checked)
                        }
                      />
                      <span>
                        <code>{g.wildcard.pattern}</code>
                        <small>{g.wildcard.label}</small>
                      </span>
                    </label>
                  )}
                  {g.types.map((t) => (
                    <label className="wh-type" key={t.type}>
                      <input
                        type="checkbox"
                        disabled={whole}
                        checked={whole || form.selected.includes(t.type)}
                        onChange={(e) => toggleType(t.type, e.target.checked)}
                      />
                      <span>
                        <code>{t.type}</code>
                        <small>{t.label}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
          <Field
            label="Other event types"
            hint="Optional. Your own types from the Event publisher, separated by commas. Use name.* to match a whole group."
          >
            <input
              id="wh-custom"
              value={form.custom}
              placeholder="test.ping, orders.*"
              onChange={(e) => set('custom', e.target.value)}
            />
          </Field>
          {fieldErr('selected')}
        </div>
      )}
    </FormSection>
  );
  const tabErrors = (t: string) =>
    (Object.keys(errors) as Key[]).filter((k) => errors[k] && TAB_OF[k] === t)
      .length;

  return (
    <div className="edit-page">
      <EditHeader
        backTo="/webhooks"
        backLabel="Webhooks"
        title={isNew ? 'Add webhook' : initial.description || host(initial.url)}
        description={
          isNew
            ? "Send an HTTPS POST to your server when events happen. You'll see the signing secret once, after you add it."
            : initial.url
        }
      />
      <form className="form-stack edit-form" noValidate onSubmit={submit}>
        <ErrorBox message={err} />
        {isNew ? (
          <>
            <EditCard>{endpoint}</EditCard>
            <EditCard>{events}</EditCard>
            <div className="edit-actions">
              <button className="btn primary" disabled={save.isPending}>
                {save.isPending ? 'Adding…' : 'Add webhook'}
              </button>
              <Link className="btn" to="/webhooks">
                Cancel
              </Link>
            </div>
          </>
        ) : (
          <>
            <EditTabs
              label="Webhook settings"
              current={tab}
              tabs={TABS.map((t) => ({
                ...t,
                dirty: (Object.keys(TAB_OF) as Key[]).some(
                  (k) => TAB_OF[k] === t.id && changed(k),
                ),
                errors: tabErrors(t.id),
              }))}
            />
            <EditCard>{tab === 'endpoint' ? endpoint : events}</EditCard>
            {dirty && (
              <SaveBar
                saving={save.isPending}
                onDiscard={() => {
                  setForm(initial);
                  setErrors({});
                  setErr('');
                }}
              />
            )}
          </>
        )}
      </form>
      {!isNew && (
        <section className="card danger-card">
          <h2>Delete webhook</h2>
          <HoldToDelete
            label="Hold to delete webhook"
            consequence={`${host(initial.url)} stops receiving events straight away. This can't be undone.`}
            onHold={() => del.mutate()}
          />
        </section>
      )}
    </div>
  );
}
