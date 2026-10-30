import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { showToast } from '../lib/toast';
import { errorMessage, gatewaysApi } from '../lib/api';
import type { SipGateway } from '../types/api';
import {
  ErrorBox,
  Field,
  HoldToDelete,
  Spinner,
  Toggle,
} from '../components/UI';
import { ChoiceChips, FormSection } from '../components/Details';
import {
  EditCard,
  EditHeader,
  EditTabs,
  SaveBar,
  focusField,
  useEditTab,
  useUnsavedGuard,
} from '../components/EditPage';

const CODEC_OPTIONS = ['OPUS', 'PCMU', 'PCMA', 'G729', 'G722'];
type Form = {
  name: string;
  realm: string;
  proxy: string;
  username: string;
  password: string;
  caller_id_number: string;
  caller_id_name: string;
  codecs: string[];
  active: boolean;
};
const blank: Form = {
  name: '',
  realm: '',
  proxy: '',
  username: '',
  password: '',
  caller_id_number: '',
  caller_id_name: '',
  codecs: ['PCMU', 'PCMA'],
  active: true,
};
const fromGateway = (g: SipGateway): Form => ({
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
type Key = keyof Form;
const TABS = [
  { id: 'connection', label: 'Connection' },
  { id: 'authentication', label: 'Authentication' },
  { id: 'calls', label: 'Outbound calls' },
];
const TAB_OF: Record<Key, string> = {
  name: 'connection',
  realm: 'connection',
  proxy: 'connection',
  active: 'connection',
  username: 'authentication',
  password: 'authentication',
  caller_id_number: 'calls',
  caller_id_name: 'calls',
  codecs: 'calls',
};
function validate(f: Form) {
  const e: Partial<Record<Key, string>> = {};
  if (!f.name.trim()) e.name = 'Give the gateway a name.';
  if (!f.realm.trim())
    e.realm = "Enter your carrier's SIP domain or IP address.";
  if (!f.username.trim())
    e.username = 'Enter the username your carrier gave you.';
  if (f.caller_id_number && !/^\+?\d{6,15}$/.test(f.caller_id_number.trim()))
    e.caller_id_number = 'Use international format, e.g. +27100562194.';
  if (!f.codecs.length) e.codecs = 'Choose at least one codec.';
  return e;
}

export default function GatewayEdit() {
  const { id } = useParams();
  const isNew = !id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const existing = useQuery({
    queryKey: ['gateway', id],
    queryFn: () => gatewaysApi.get(id!),
    enabled: !isNew,
  });
  const initial = useMemo(
    () => (existing.data ? fromGateway(existing.data) : blank),
    [existing.data],
  );
  const [form, setForm] = useState<Form>(blank);
  useEffect(() => setForm(initial), [initial]);
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({});
  const [err, setErr] = useState('');
  const [tab, goTab] = useEditTab(TABS.map((t) => t.id));
  const changed = (k: Key) =>
    JSON.stringify(form[k]) !== JSON.stringify(initial[k]);
  const dirty = (Object.keys(form) as Key[]).some(changed);
  useUnsavedGuard(dirty);
  const set = <K extends Key>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        proxy: form.proxy || null,
        password: form.password || undefined,
        caller_id_number: form.caller_id_number.trim() || null,
        caller_id_name: form.caller_id_name || null,
      };
      return isNew ? gatewaysApi.create(body) : gatewaysApi.update(id!, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gateways'] });
      qc.invalidateQueries({ queryKey: ['gateway', id] });
      showToast({
        kind: 'success',
        message: isNew ? `Added ${form.name}.` : `Saved ${form.name}.`,
      });
      navigate('/gateways');
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: () => gatewaysApi.remove(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gateways'] });
      showToast({ kind: 'success', message: `Deleted ${initial.name}.` });
      navigate('/gateways');
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
      focusField(`gw-${first}`);
      return;
    }
    save.mutate();
  }

  if (!isNew && existing.isLoading) return <Spinner />;
  if (!isNew && !existing.data)
    return (
      <div className="edit-page">
        <EditHeader
          backTo="/gateways"
          backLabel="SIP gateways"
          title="Gateway not found"
          description="It may have been deleted. Go back to the list to pick another."
        />
      </div>
    );

  const fieldErr = (k: Key) =>
    errors[k] && (
      <small className="field-error" role="alert">
        {errors[k]}
      </small>
    );
  const connection = (
    <FormSection title="Connection" hint="Where calls go.">
      <Field
        label="Name"
        hint="Shown in the portal and when you pick a gateway for a call"
      >
        <input
          id="gw-name"
          value={form.name}
          placeholder="Main carrier"
          aria-invalid={!!errors.name}
          onChange={(e) => set('name', e.target.value)}
        />
        {fieldErr('name')}
      </Field>
      <Field label="Realm" hint="Your carrier's SIP domain or IP address">
        <input
          id="gw-realm"
          value={form.realm}
          placeholder="sip.carrier.com"
          aria-invalid={!!errors.realm}
          onChange={(e) => set('realm', e.target.value)}
        />
        {fieldErr('realm')}
      </Field>
      <Field
        label="Outbound proxy"
        hint="Optional. Leave blank to send calls straight to the realm"
      >
        <input
          id="gw-proxy"
          value={form.proxy}
          placeholder="proxy.carrier.com:5060"
          onChange={(e) => set('proxy', e.target.value)}
        />
      </Field>
      <Toggle
        checked={form.active}
        onChange={(v) => set('active', v)}
        label="Use this gateway for calls"
      />
    </FormSection>
  );
  const authentication = (
    <FormSection
      title="Authentication"
      hint="The SIP credentials your carrier gave you."
    >
      <Field label="Username">
        <input
          id="gw-username"
          value={form.username}
          autoComplete="off"
          aria-invalid={!!errors.username}
          onChange={(e) => set('username', e.target.value)}
        />
        {fieldErr('username')}
      </Field>
      <Field
        label="Password"
        hint={
          isNew ? undefined : 'Saved. Leave blank to keep the current password'
        }
      >
        <input
          id="gw-password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
        />
      </Field>
    </FormSection>
  );
  const calls = (
    <>
      <FormSection
        title="Caller ID"
        hint="Optional. Leave blank to use the caller ID set on each call."
      >
        <Field label="Number" hint="International format, e.g. +27100562194">
          <input
            id="gw-caller_id_number"
            value={form.caller_id_number}
            inputMode="tel"
            aria-invalid={!!errors.caller_id_number}
            onChange={(e) => set('caller_id_number', e.target.value)}
          />
          {fieldErr('caller_id_number')}
        </Field>
        <Field label="Name">
          <input
            id="gw-caller_id_name"
            value={form.caller_id_name}
            onChange={(e) => set('caller_id_name', e.target.value)}
          />
        </Field>
      </FormSection>
      <FormSection
        title="Codecs"
        hint="Audio formats offered to the carrier. Most carriers accept PCMU and PCMA."
      >
        <div id="gw-codecs" tabIndex={-1}>
          <ChoiceChips
            label="Codecs"
            options={CODEC_OPTIONS.map((c) => ({ value: c, label: c }))}
            value={form.codecs}
            onChange={(codecs) => set('codecs', codecs)}
          />
        </div>
        {fieldErr('codecs')}
      </FormSection>
    </>
  );
  const tabErrors = (t: string) =>
    (Object.keys(errors) as Key[]).filter((k) => errors[k] && TAB_OF[k] === t)
      .length;

  return (
    <div className="edit-page">
      <EditHeader
        backTo="/gateways"
        backLabel="SIP gateways"
        title={isNew ? 'Add SIP gateway' : initial.name}
        description={
          isNew
            ? 'An outbound trunk to your carrier: where calls go, how they authenticate, the caller ID and codecs.'
            : initial.proxy
              ? `${initial.realm} via ${initial.proxy}`
              : initial.realm
        }
      />
      <form className="form-stack edit-form" noValidate onSubmit={submit}>
        <ErrorBox message={err} />
        {isNew ? (
          <>
            <EditCard>{connection}</EditCard>
            <EditCard>{authentication}</EditCard>
            <EditCard>{calls}</EditCard>
            <div className="edit-actions">
              <button className="btn primary" disabled={save.isPending}>
                {save.isPending ? 'Adding…' : 'Add gateway'}
              </button>
              <Link className="btn" to="/gateways">
                Cancel
              </Link>
            </div>
          </>
        ) : (
          <>
            <EditTabs
              label="Gateway settings"
              current={tab}
              tabs={TABS.map((t) => ({
                ...t,
                dirty: (Object.keys(TAB_OF) as Key[]).some(
                  (k) => TAB_OF[k] === t.id && changed(k),
                ),
                errors: tabErrors(t.id),
              }))}
            />
            <EditCard>
              {tab === 'connection'
                ? connection
                : tab === 'authentication'
                  ? authentication
                  : calls}
            </EditCard>
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
          <h2>Delete gateway</h2>
          <HoldToDelete
            label="Hold to delete gateway"
            consequence={`Calls that use ${initial.name} will fail. This can't be undone.`}
            onHold={() => del.mutate()}
          />
        </section>
      )}
    </div>
  );
}
