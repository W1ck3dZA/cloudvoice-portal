import { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { errorMessage, ipAllowlistApi } from '../lib/api';
import { checkAllowlistCidr } from '../lib/cidr';
import { useSession } from '../lib/session';
import { showToast } from '../lib/toast';
import type { IpAllowlistEntry } from '../types/api';
import {
  AddButton,
  Card,
  Drawer,
  Empty,
  ErrorBox,
  Field,
  HoldToDelete,
  PageHeader,
  RowMain,
  Spinner,
  rowOpen,
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
} from '../components/Details';

const DESCRIPTION_MAX = 255;
const ADDRESS_EXAMPLE =
  'A single IP, like 41.0.0.10, or a range, like 41.0.0.0/24.';

/** "41.0.0.10/32" → "41.0.0.10"; ranges keep their prefix. */
function addressText(cidr: string) {
  return cidr.replace(/\/(32|128)$/, '');
}

/** Plain description of what the entry covers. */
function coverage(cidr: string) {
  const [, prefix] = cidr.split('/');
  const p = Number(prefix);
  const v6 = cidr.includes(':');
  if ((v6 && p === 128) || (!v6 && p === 32)) return 'Single address';
  if (v6) return `IPv6 range (/${p})`;
  return `Range of ${(2 ** (32 - p)).toLocaleString()} addresses`;
}

const date = (iso: string) => new Date(iso).toLocaleString();
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

type Form = { cidr: string; description: string };

export default function IpAllowlist() {
  const { session } = useSession();
  const canManage = session?.role === 'owner' || session?.role === 'admin';
  const qc = useQueryClient();
  const data = useQuery({
    queryKey: ['ip-allowlist'],
    queryFn: ipAllowlistApi.list,
  });

  // `editing` is the entry being changed; null with `open` means adding.
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<IpAllowlistEntry | null>(null);
  const [view, setView] = useState<IpAllowlistEntry | null>(null);
  const [form, setForm] = useState<Form>({ cidr: '', description: '' });
  // Server error for the address, and whether to show local problems yet
  // (after leaving the field or pressing save, not while typing).
  const [err, setErr] = useState('');
  const [touched, setTouched] = useState(false);
  const addressMsgId = useId();

  const done = (message: string) => {
    qc.invalidateQueries({ queryKey: ['ip-allowlist'] });
    setOpen(false);
    setEditing(null);
    setView(null);
    showToast({ kind: 'success', message });
  };

  const save = useMutation({
    mutationFn: () => {
      const body = {
        cidr: form.cidr.trim(),
        description: form.description.trim() || null,
      };
      return editing
        ? ipAllowlistApi.update(editing.id, body)
        : ipAllowlistApi.create(body);
    },
    onSuccess: (e) =>
      done(
        editing
          ? `${addressText(e.cidr)} updated.`
          : `${addressText(e.cidr)} added. The firewall picks it up within a few seconds.`,
      ),
    onError: (e) => setErr(errorMessage(e)),
  });

  const del = useMutation({
    mutationFn: (e: IpAllowlistEntry) => ipAllowlistApi.remove(e.id),
    onSuccess: (_r, e) => done(`${addressText(e.cidr)} removed.`),
    onError: (e) => showToast({ kind: 'error', message: errorMessage(e) }),
  });

  function openAdd() {
    setErr('');
    setTouched(false);
    setEditing(null);
    setForm({ cidr: '', description: '' });
    setOpen(true);
  }

  function openEntry(e: IpAllowlistEntry) {
    if (!canManage) return setView(e);
    setErr('');
    setTouched(false);
    setEditing(e);
    setForm({ cidr: addressText(e.cidr), description: e.description ?? '' });
    setOpen(true);
  }

  const entries = data.data || [];
  const check = checkAllowlistCidr(form.cidr);
  const cidrChanged = !!editing && check.ok && check.cidr !== editing.cidr;
  const descChanged =
    !!editing &&
    (form.description.trim() || null) !== (editing.description || null);
  const dirty = editing ? cidrChanged || descChanged : !!form.cidr.trim();

  // The line under the address: the server's error, a local problem once
  // shown, what a valid address covers, or an example.
  const addressError =
    err || (touched && form.cidr.trim() && !check.ok ? check.error : '');
  const addressNote = addressError
    ? addressError
    : check.ok
      ? check.covers
      : ADDRESS_EXAMPLE;

  function submit() {
    setTouched(true);
    setErr('');
    if (!check.ok || !dirty) return;
    save.mutate();
  }

  return (
    <>
      <PageHeader
        title="IP allowlist"
        description="The public IP addresses your PBX, SIP trunk or servers send SIP to Cloudvoice from. Our firewall only accepts SIP from addresses on this list, so add every address you send from."
        action={
          canManage && entries.length ? (
            <AddButton onClick={openAdd}>Add address</AddButton>
          ) : undefined
        }
      />
      {!canManage && (
        <p className="fs-hint" role="note">
          Only owners and admins can change the allowlist.
        </p>
      )}
      <Card>
        {data.isLoading ? (
          <Spinner />
        ) : data.isError ? (
          <ErrorBox message={errorMessage(data.error)} />
        ) : entries.length ? (
          <div className="table-wrap">
            <table className="rt">
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Description</th>
                  <th className="hide-md">Added</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} {...rowOpen(() => openEntry(e))}>
                    <RowMain
                      onOpen={() => openEntry(e)}
                      label={`Open ${addressText(e.cidr)}`}
                      title={addressText(e.cidr)}
                      sub={e.description || coverage(e.cidr)}
                    >
                      <div className="cell-stack">
                        <strong>{addressText(e.cidr)}</strong>
                        <span>{coverage(e.cidr)}</span>
                      </div>
                    </RowMain>
                    <td>{e.description || '—'}</td>
                    <td className="hide-md">
                      {new Date(e.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="table-action wide-only"
                          onClick={() => openEntry(e)}
                        >
                          {canManage ? 'Edit' : 'View'}{' '}
                          <AnimatedIcon
                            icon={ChevronRight}
                            size={14}
                            animation="nudge"
                          />
                        </button>
                        {canManage && (
                          <HoldButton
                            iconOnly
                            aria-label={`Remove ${addressText(e.cidr)}`}
                            onHold={() => del.mutate(e)}
                          />
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
            icon={<ShieldCheck size={16} />}
            text={
              canManage
                ? 'No addresses yet. Add the public IP of each PBX, SIP trunk or server that sends SIP to Cloudvoice.'
                : 'No addresses yet. An owner or admin can add the public IPs your systems send SIP from.'
            }
            action={
              canManage ? (
                <AddButton onClick={openAdd}>Add address</AddButton>
              ) : undefined
            }
          />
        )}
      </Card>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit address' : 'Add address'}
        subtitle={
          editing ? `Added ${shortDate(editing.created_at)}` : undefined
        }
      >
        <form
          className="form-stack"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="field">
            <span>IP address or range</span>
            <input
              autoFocus={!editing}
              inputMode="text"
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="done"
              aria-invalid={addressError ? true : undefined}
              aria-describedby={addressMsgId}
              value={form.cidr}
              onBlur={() => setTouched(true)}
              onChange={(e) => {
                setErr('');
                setForm((f) => ({ ...f, cidr: e.target.value }));
              }}
            />
            <small
              id={addressMsgId}
              className={addressError ? 'field-error' : undefined}
              role={addressError ? 'alert' : 'status'}
            >
              {addressNote}
            </small>
            {cidrChanged && !addressError && (
              <small>
                Saving stops SIP from {addressText(editing!.cidr)} within a few
                seconds.
              </small>
            )}
          </label>
          <Field label="Description" hint="Optional, e.g. Head office PBX">
            <input
              maxLength={DESCRIPTION_MAX}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </Field>
          <DrawerActions>
            <button className="btn primary" disabled={save.isPending || !dirty}>
              {save.isPending
                ? 'Saving…'
                : editing
                  ? 'Save changes'
                  : 'Add address'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </DrawerActions>
          {editing && (
            <HoldToDelete
              label="Hold to remove address"
              consequence={`Removing it stops SIP from ${addressText(editing.cidr)} within a few seconds.`}
              onHold={() => del.mutate(editing)}
            />
          )}
        </form>
      </Drawer>

      <Drawer
        open={!!view}
        onClose={() => setView(null)}
        title="Allowlisted address"
      >
        {view && (
          <DetailView>
            <DetailSummary
              title={addressText(view.cidr)}
              subtitle={view.description || undefined}
              facts={<span>{coverage(view.cidr)}</span>}
            />
            <DetailSection title="Details">
              <DetailRows>
                <DetailRow label="Address">
                  <CopyValue value={view.cidr} label="address" />
                </DetailRow>
                <DetailRow label="Description">
                  {view.description || '—'}
                </DetailRow>
                <DetailRow label="Added">{date(view.created_at)}</DetailRow>
                <DetailRow label="Last changed">
                  {date(view.updated_at)}
                </DetailRow>
              </DetailRows>
            </DetailSection>
          </DetailView>
        )}
      </Drawer>
    </>
  );
}
