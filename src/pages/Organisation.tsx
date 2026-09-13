import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Settings2, UserCog, Users } from 'lucide-react';
import { errorMessage, orgApi } from '../lib/api';
import { useSession } from '../lib/session';
import type { Member } from '../types/api';
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
} from '../components/UI';

export default function Organisation() {
  const { session } = useSession();
  const id = session?.orgId || '';
  const qc = useQueryClient();
  const org = useQuery({
    queryKey: ['org', id],
    queryFn: () => orgApi.get(id),
    enabled: !!id,
  });
  const organisations = useQuery({
    queryKey: ['organisations'],
    queryFn: orgApi.list,
  });
  const members = useQuery({
    queryKey: ['members', id],
    queryFn: () => orgApi.members(id),
    enabled: !!id,
  });
  const limits = useQuery({
    queryKey: ['org-limits', id],
    queryFn: () => orgApi.limits(id),
    enabled: !!id && session?.role === 'owner',
  });
  const [drawer, setDrawer] = useState<
    | 'member-add'
    | 'member-edit'
    | 'org-edit'
    | 'org-create'
    | 'limits'
    | 'owner'
    | null
  >(null);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('developer');
  const [err, setErr] = useState('');
  const [orgName, setOrgName] = useState('');
  const [newOrg, setNewOrg] = useState({ name: '', slug: '', plan: 'free' });
  const [ownerId, setOwnerId] = useState('');
  const [limitForm, setLimitForm] = useState({
    requests_per_minute: '',
    requests_per_day: '',
    max_users: '',
    max_api_keys: '',
  });
  useEffect(() => {
    if (limits.data)
      setLimitForm({
        requests_per_minute: String(limits.data.requests_per_minute ?? ''),
        requests_per_day: String(limits.data.requests_per_day ?? ''),
        max_users: String(limits.data.max_users ?? ''),
        max_api_keys: String(limits.data.max_api_keys ?? ''),
      });
  }, [limits.data]);
  const close = () => {
    setDrawer(null);
    setEditMember(null);
    setErr('');
  };
  const add = useMutation({
    mutationFn: () => orgApi.addMember(id, { email, role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', id] });
      close();
      setEmail('');
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const updateRole = useMutation({
    mutationFn: () => orgApi.memberRole(id, editMember!.id, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', id] });
      close();
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const createOrg = useMutation({
    mutationFn: () => orgApi.create(newOrg),
    onSuccess: (o) => {
      qc.invalidateQueries({ queryKey: ['organisations'] });
      close();
      alert(
        `Organisation ${o.name} created. The active organisation remains the one embedded in the current JWT.`,
      );
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const updateOrg = useMutation({
    mutationFn: () => orgApi.update(id, { name: orgName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org', id] });
      close();
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const updateLimits = useMutation({
    mutationFn: () =>
      orgApi.updateLimits(id, {
        requests_per_minute: +limitForm.requests_per_minute,
        requests_per_day: +limitForm.requests_per_day,
        max_users: +limitForm.max_users,
        max_api_keys: +limitForm.max_api_keys,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-limits', id] });
      close();
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const transfer = useMutation({
    mutationFn: () => orgApi.transferOwner(id, ownerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', id] });
      qc.invalidateQueries({ queryKey: ['org', id] });
      close();
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const canManage = session?.role === 'owner' || session?.role === 'admin';
  const isOwner = session?.role === 'owner';
  if (org.isLoading) return <Spinner />;
  return (
    <>
      <PageHeader
        eyebrow="Account"
        title={org.data?.name || 'Organisation'}
        description="Manage organisation identity, members, access roles and owner-level limits."
        action={
          <div className="button-row no-margin">
            <button
              className="btn"
              onClick={() => {
                setNewOrg({ name: '', slug: '', plan: 'free' });
                setDrawer('org-create');
              }}
            >
              New organisation
            </button>
            {canManage && (
              <AddButton
                onClick={() => {
                  setRole('developer');
                  setDrawer('member-add');
                }}
              >
                Add member
              </AddButton>
            )}
          </div>
        }
      />
      <div className="dash-grid">
        <Card>
          <div className="card-title">
            <div>
              <span className="eyebrow">Organisation</span>
              <h2>Account details</h2>
            </div>
            {canManage && (
              <button
                className="btn"
                onClick={() => {
                  setOrgName(org.data?.name || '');
                  setDrawer('org-edit');
                }}
              >
                <Settings2 size={15} /> Edit
              </button>
            )}
          </div>
          <div className="detail-grid">
            <div className="detail-item">
              <span>Slug</span>
              <strong>{org.data?.slug}</strong>
            </div>
            <div className="detail-item">
              <span>Plan</span>
              <strong>{org.data?.plan}</strong>
            </div>
            <div className="detail-item">
              <span>Status</span>
              <StatusToggle
                checked={
                  (org.data?.status || 'active').toLowerCase() === 'active'
                }
                onChange={() => {}}
                disabled
                title={org.data?.status || 'active'}
              />
            </div>
            <div className="detail-item">
              <span>Your role</span>
              <strong>{session?.role}</strong>
            </div>
          </div>
        </Card>
        <Card>
          <div className="card-title">
            <div>
              <span className="eyebrow">Access</span>
              <h2>{members.data?.length || 0} members</h2>
            </div>
          </div>
          <p className="muted">
            Owners and admins can manage membership. Ownership and account
            limits remain owner-only.
          </p>
          {isOwner && (
            <div className="button-row">
              <button className="btn" onClick={() => setDrawer('limits')}>
                Rate limits
              </button>
              <button className="btn" onClick={() => setDrawer('owner')}>
                <UserCog size={15} /> Transfer ownership
              </button>
            </div>
          )}
        </Card>
      </div>
      <Card>
        <div className="card-title">
          <div>
            <span className="eyebrow">Team</span>
            <h2>Members</h2>
          </div>
        </div>
        {members.isLoading ? (
          <Spinner />
        ) : (members.data || []).length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {members.data!.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.name}</strong>
                    </td>
                    <td>{m.email}</td>
                    <td>{m.role}</td>
                    <td>
                      <StatusToggle
                        checked={m.status?.toLowerCase() === 'active'}
                        onChange={() => {}}
                        disabled
                        title={m.status}
                      />
                    </td>
                    <td>{new Date(m.joined_at).toLocaleDateString()}</td>
                    <td>
                      {canManage && m.role !== 'owner' && (
                        <RowActions
                          onEdit={() => {
                            setEditMember(m);
                            setRole(m.role);
                            setDrawer('member-edit');
                          }}
                          onDelete={() =>
                            confirm(
                              `Remove ${m.email} from this organisation?`,
                            ) &&
                            orgApi.removeMember(id, m.id).then(() =>
                              qc.invalidateQueries({
                                queryKey: ['members', id],
                              }),
                            )
                          }
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={<Users size={16} />} text="No members returned." />
        )}
      </Card>

      <Card className="org-memberships">
        <div className="card-title">
          <div>
            <span className="eyebrow">Memberships</span>
            <h2>My organisations</h2>
          </div>
        </div>
        <div className="stack-list">
          {(organisations.data || []).map((o) => (
            <div className="list-row" key={o.id}>
              <div>
                <strong>{o.name}</strong>
                <span>
                  {o.slug} · {o.plan} · {o.role}
                </span>
              </div>
              <StatusToggle
                checked={o.id === id}
                onChange={() => {}}
                disabled
                title={
                  o.id === id
                    ? 'Current organisation'
                    : 'Sign in with a token scoped to this organisation to switch'
                }
              />
            </div>
          ))}
        </div>
      </Card>
      {isOwner && (
        <Card className="danger-card">
          <div>
            <span className="eyebrow">Danger zone</span>
            <h2>Delete organisation</h2>
            <p>
              Soft-delete this organisation and prevent normal use of its
              resources.
            </p>
          </div>
          <button
            className="btn danger"
            onClick={() => {
              if (
                confirm(
                  `Delete organisation ${org.data?.name}? This is a destructive owner-only action.`,
                )
              )
                orgApi.remove(id).then(() => (location.href = '/'));
            }}
          >
            <AlertTriangle size={15} /> Delete organisation
          </button>
        </Card>
      )}
      <Drawer
        open={drawer === 'member-add' || drawer === 'member-edit'}
        onClose={close}
        title={drawer === 'member-edit' ? 'Edit member role' : 'Add member'}
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setErr('');
            drawer === 'member-edit' ? updateRole.mutate() : add.mutate();
          }}
        >
          <ErrorBox message={err} />
          {drawer === 'member-add' && (
            <Field label="Email">
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
          )}
          <Field label="Role">
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="admin">Admin</option>
              <option value="developer">Developer</option>
              <option value="viewer">Viewer</option>
            </select>
          </Field>
          <button className="btn primary">
            {drawer === 'member-edit' ? 'Update role' : 'Add member'}
          </button>
        </form>
      </Drawer>

      <Drawer
        open={drawer === 'org-create'}
        onClose={close}
        title="Create organisation"
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setErr('');
            createOrg.mutate();
          }}
        >
          <ErrorBox message={err} />
          <Field label="Name">
            <input
              required
              value={newOrg.name}
              onChange={(e) =>
                setNewOrg((f) => ({ ...f, name: e.target.value }))
              }
            />
          </Field>
          <Field
            label="Slug"
            hint="Lowercase letters, digits and hyphens; 3–50 characters"
          >
            <input
              required
              pattern="[a-z0-9-]{3,50}"
              value={newOrg.slug}
              onChange={(e) =>
                setNewOrg((f) => ({ ...f, slug: e.target.value.toLowerCase() }))
              }
            />
          </Field>
          <Field label="Plan">
            <select
              value={newOrg.plan}
              onChange={(e) =>
                setNewOrg((f) => ({ ...f, plan: e.target.value }))
              }
            >
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
              <option value="custom">Custom</option>
            </select>
          </Field>
          <button className="btn primary">Create organisation</button>
        </form>
      </Drawer>
      <Drawer
        open={drawer === 'org-edit'}
        onClose={close}
        title="Edit organisation"
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setErr('');
            updateOrg.mutate();
          }}
        >
          <ErrorBox message={err} />
          <Field label="Organisation name">
            <input
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
          </Field>
          <button className="btn primary">Save organisation</button>
        </form>
      </Drawer>
      <Drawer
        open={drawer === 'limits'}
        onClose={close}
        title="Organisation limits"
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setErr('');
            updateLimits.mutate();
          }}
        >
          <ErrorBox message={err} />
          {(
            [
              'requests_per_minute',
              'requests_per_day',
              'max_users',
              'max_api_keys',
            ] as const
          ).map((k) => (
            <Field key={k} label={k.replaceAll('_', ' ')}>
              <input
                required
                type="number"
                min="0"
                value={limitForm[k]}
                onChange={(e) =>
                  setLimitForm((f) => ({ ...f, [k]: e.target.value }))
                }
              />
            </Field>
          ))}
          <button className="btn primary">Update limits</button>
        </form>
      </Drawer>
      <Drawer
        open={drawer === 'owner'}
        onClose={close}
        title="Transfer ownership"
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setErr('');
            if (confirm('Transfer ownership to this member?'))
              transfer.mutate();
          }}
        >
          <ErrorBox message={err} />
          <Field label="New owner">
            <select
              required
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
            >
              <option value="">Select member…</option>
              {(members.data || [])
                .filter((m) => m.role !== 'owner')
                .map((m) => (
                  <option value={m.id} key={m.id}>
                    {m.name} · {m.email}
                  </option>
                ))}
            </select>
          </Field>
          <div className="note">
            Ownership transfer is an owner-only action. Your role may change
            after the transfer.
          </div>
          <button className="btn danger">Transfer ownership</button>
        </form>
      </Drawer>
    </>
  );
}
