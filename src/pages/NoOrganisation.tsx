import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { errorMessage, orgApi } from '../lib/api';
import { useSession } from '../lib/session';
import { useSwitchOrganisation } from '../lib/useSwitchOrganisation';
import { Card, ErrorBox, Field, PageHeader } from '../components/UI';
// Shown in place of every page while the signed-in user has no organisation
// (e.g. an account created without one, or whose access was removed).
export default function NoOrganisation() {
  const { session } = useSession();
  const switchOrg = useSwitchOrganisation();
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const create = useMutation({
    mutationFn: () => orgApi.create({ name: name.trim() }),
    onSuccess: (o) => switchOrg.mutate(o.id),
    onError: (e) => setErr(errorMessage(e)),
  });
  const check = useMutation({
    mutationFn: orgApi.list,
    onSuccess: (orgs) => {
      if (orgs.length) switchOrg.mutate(orgs[0].id);
      else setNote("You haven't been added to an organisation yet.");
    },
  });
  const busy = create.isPending || switchOrg.isPending;
  return (
    <>
      <PageHeader
        title="Set up your organisation"
        description="Your account isn't part of an organisation yet. Numbers, calls and everything else in Cloudvoice belong to an organisation."
      />
      <div className="settings-grid">
        <Card>
          <div className="card-title">
            <div>
              <h2>Create an organisation</h2>
            </div>
          </div>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              setErr('');
              create.mutate();
            }}
          >
            <ErrorBox message={err} />
            <Field
              label="Organisation name"
              hint="Usually your company name. You'll be its owner."
            >
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <button className="btn primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create organisation'}
            </button>
          </form>
        </Card>
        <Card>
          <div className="card-title">
            <div>
              <h2>Join your team's organisation</h2>
            </div>
          </div>
          <p className="muted">
            Ask an owner or admin to add <strong>{session?.user.email}</strong>{' '}
            on their Organisation page, then check again.
          </p>
          {note && (
            <p className="muted" role="status">
              {note}
            </p>
          )}
          <div className="button-row">
            <button
              className="btn"
              onClick={() => {
                setNote('');
                check.mutate();
              }}
              disabled={check.isPending || switchOrg.isPending}
            >
              {check.isPending ? 'Checking…' : 'Check again'}
            </button>
          </div>
        </Card>
      </div>
    </>
  );
}
