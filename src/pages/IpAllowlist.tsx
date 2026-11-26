import { useId, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { errorMessage, ipAllowlistApi } from '../lib/api';
import { checkAllowlistCidr } from '../lib/cidr';
import { useSession } from '../lib/session';
import { showToast } from '../lib/toast';
import type { IpAllowlistEntry } from '../types/api';
import { Card, Empty, ErrorBox, PageHeader, Spinner } from '../components/UI';
import { HoldButton } from '../components/HoldButton';

const DESCRIPTION_MAX = 255;
const ADDRESS_EXAMPLE =
  'A single IP, like 41.0.0.10, or a range, like 41.0.0.0/24.';

/** "41.0.0.10/32" → "41.0.0.10"; ranges keep their prefix. */
const addressText = (cidr: string) => cidr.replace(/\/(32|128)$/, '');

/** Short description of what a saved entry covers. */
function coverage(cidr: string) {
  const p = Number(cidr.split('/')[1]);
  const v6 = cidr.includes(':');
  if (p === (v6 ? 128 : 32)) return 'Single address';
  return v6
    ? `IPv6 range (/${p})`
    : `${(2 ** (32 - p)).toLocaleString()} addresses`;
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

type Draft = { cidr: string; description: string };

/**
 * The address and description fields with the live check under the
 * address. Shared by the add form and a row being changed.
 */
function AddressFields({
  draft,
  onChange,
  serverError,
  touched,
  onTouch,
  previous,
  addressRef,
  autoFocus,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  serverError: string;
  touched: boolean;
  onTouch: () => void;
  /** The saved address when changing a row, to warn that it stops. */
  previous?: string;
  addressRef?: React.Ref<HTMLInputElement>;
  autoFocus?: boolean;
}) {
  const msgId = useId();
  const check = checkAllowlistCidr(draft.cidr);
  const error =
    serverError ||
    (touched && draft.cidr.trim() && !check.ok ? check.error : '');
  const note = error || (check.ok ? check.covers : ADDRESS_EXAMPLE);
  const moving = !!previous && check.ok && check.cidr !== previous;

  return (
    <div className="allow-fields">
      <label className="field">
        <span>IP address or range</span>
        <input
          ref={addressRef}
          autoFocus={autoFocus}
          inputMode="text"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={msgId}
          value={draft.cidr}
          onBlur={onTouch}
          onChange={(e) => onChange({ ...draft, cidr: e.target.value })}
        />
        <small
          id={msgId}
          className={error ? 'field-error' : undefined}
          role={error ? 'alert' : 'status'}
        >
          {note}
        </small>
        {moving && !error && (
          <small>
            Saving stops SIP from {addressText(previous!)} within a few seconds.
          </small>
        )}
      </label>
      <label className="field">
        <span>Description</span>
        <input
          maxLength={DESCRIPTION_MAX}
          value={draft.description}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
        />
        <small>Optional, e.g. Head office PBX</small>
      </label>
    </div>
  );
}

export default function IpAllowlist() {
  const { session } = useSession();
  const canManage = session?.role === 'owner' || session?.role === 'admin';
  const qc = useQueryClient();
  const data = useQuery({
    queryKey: ['ip-allowlist'],
    queryFn: ipAllowlistApi.list,
  });
  const entries = data.data || [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['ip-allowlist'] });

  // ── Add ────────────────────────────────────────────────────────────────
  const empty: Draft = { cidr: '', description: '' };
  const [add, setAdd] = useState<Draft>(empty);
  const [addErr, setAddErr] = useState('');
  const [addTouched, setAddTouched] = useState(false);
  const addRef = useRef<HTMLInputElement>(null);
  const addCheck = checkAllowlistCidr(add.cidr);

  const create = useMutation({
    mutationFn: () =>
      ipAllowlistApi.create({
        cidr: add.cidr.trim(),
        description: add.description.trim() || null,
      }),
    onSuccess: (e) => {
      refresh();
      setAdd(empty);
      setAddTouched(false);
      addRef.current?.focus();
      showToast({
        kind: 'success',
        message: `${addressText(e.cidr)} added. The firewall picks it up within a few seconds.`,
      });
    },
    onError: (e) => setAddErr(errorMessage(e)),
  });

  function submitAdd() {
    setAddTouched(true);
    setAddErr('');
    if (addCheck.ok) create.mutate();
  }

  // ── Change one row in place ────────────────────────────────────────────
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Draft>(empty);
  const [editErr, setEditErr] = useState('');
  const [editTouched, setEditTouched] = useState(false);
  const editing = entries.find((e) => e.id === editId) ?? null;
  const editCheck = checkAllowlistCidr(edit.cidr);
  const editDirty =
    !!editing &&
    ((editCheck.ok && editCheck.cidr !== editing.cidr) ||
      (edit.description.trim() || null) !== (editing.description || null));

  function openEdit(e: IpAllowlistEntry) {
    setEditId(e.id);
    setEdit({ cidr: addressText(e.cidr), description: e.description ?? '' });
    setEditErr('');
    setEditTouched(false);
  }

  const update = useMutation({
    mutationFn: () =>
      ipAllowlistApi.update(editId!, {
        cidr: edit.cidr.trim(),
        description: edit.description.trim() || null,
      }),
    onSuccess: (e) => {
      refresh();
      setEditId(null);
      showToast({ kind: 'success', message: `${addressText(e.cidr)} saved.` });
    },
    onError: (e) => setEditErr(errorMessage(e)),
  });

  function submitEdit() {
    setEditTouched(true);
    setEditErr('');
    if (editCheck.ok && editDirty) update.mutate();
  }

  // ── Remove ─────────────────────────────────────────────────────────────
  const remove = useMutation({
    mutationFn: (e: IpAllowlistEntry) => ipAllowlistApi.remove(e.id),
    onSuccess: (_r, e) => {
      refresh();
      if (editId === e.id) setEditId(null);
      showToast({
        kind: 'success',
        message: `${addressText(e.cidr)} removed. SIP from it stops within a few seconds.`,
      });
    },
    onError: (e) => showToast({ kind: 'error', message: errorMessage(e) }),
  });

  return (
    <div className="allow-page">
      <PageHeader
        title="IP allowlist"
        description="Our firewall only accepts SIP from the public IP addresses on this list. Add every address your PBX, SIP trunk or servers send from."
      />

      {canManage && (
        <Card>
          <section className="set-section" aria-labelledby="allow-add">
            <h2 id="allow-add">Add an address</h2>
            <form
              className="allow-form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                submitAdd();
              }}
            >
              <AddressFields
                draft={add}
                onChange={(d) => {
                  setAddErr('');
                  setAdd(d);
                }}
                serverError={addErr}
                touched={addTouched}
                onTouch={() => setAddTouched(true)}
                addressRef={addRef}
              />
              <div className="set-actions">
                <button
                  className="btn primary"
                  disabled={create.isPending || !add.cidr.trim()}
                >
                  {create.isPending ? 'Adding…' : 'Add address'}
                </button>
              </div>
            </form>
          </section>
        </Card>
      )}

      <Card>
        <section className="set-section" aria-labelledby="allow-list">
          <h2 id="allow-list">
            Allowed addresses{entries.length ? ` (${entries.length})` : ''}
          </h2>
          {!canManage && (
            <p className="set-intro">
              Only owners and admins can change the allowlist.
            </p>
          )}
          {data.isLoading ? (
            <Spinner />
          ) : data.isError ? (
            <ErrorBox message={errorMessage(data.error)} />
          ) : !entries.length ? (
            <Empty
              icon={<ShieldCheck size={16} />}
              text={
                canManage
                  ? 'No addresses yet. Until you add one, SIP from your systems is blocked.'
                  : 'No addresses yet. An owner or admin can add the public IPs your systems send SIP from.'
              }
            />
          ) : (
            <ul className="allow-list">
              {entries.map((e) => {
                const open = e.id === editId;
                const facts = [
                  e.description,
                  coverage(e.cidr),
                  `added ${shortDate(e.created_at)}`,
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <li key={e.id} className={'set-row' + (open ? ' open' : '')}>
                    <div className="set-head">
                      {canManage && !open ? (
                        <button
                          type="button"
                          className="set-label allow-open"
                          onClick={() => openEdit(e)}
                          aria-label={`Change ${addressText(e.cidr)}`}
                        >
                          <strong className="allow-addr">
                            {addressText(e.cidr)}
                          </strong>
                          <p>{facts}</p>
                        </button>
                      ) : (
                        <div className="set-label">
                          <strong className="allow-addr">
                            {addressText(e.cidr)}
                          </strong>
                          <p>{facts}</p>
                        </div>
                      )}
                      {canManage && !open && (
                        <div className="allow-actions">
                          <button
                            type="button"
                            className="btn allow-change"
                            tabIndex={-1}
                            aria-hidden="true"
                            onClick={() => openEdit(e)}
                          >
                            Change
                          </button>
                          <HoldButton
                            iconOnly
                            aria-label={`Hold to remove ${addressText(e.cidr)}`}
                            onHold={() => remove.mutate(e)}
                          />
                        </div>
                      )}
                    </div>
                    {open && (
                      <form
                        className="set-edit allow-form"
                        noValidate
                        onSubmit={(ev) => {
                          ev.preventDefault();
                          submitEdit();
                        }}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Escape') setEditId(null);
                        }}
                      >
                        <AddressFields
                          draft={edit}
                          onChange={(d) => {
                            setEditErr('');
                            setEdit(d);
                          }}
                          serverError={editErr}
                          touched={editTouched}
                          onTouch={() => setEditTouched(true)}
                          previous={e.cidr}
                          autoFocus
                        />
                        <div className="set-actions">
                          <button
                            className="btn primary"
                            disabled={update.isPending || !editDirty}
                          >
                            {update.isPending ? 'Saving…' : 'Save changes'}
                          </button>
                          <button
                            type="button"
                            className="btn"
                            onClick={() => setEditId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </Card>
    </div>
  );
}
