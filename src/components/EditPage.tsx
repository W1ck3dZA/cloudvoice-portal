import { useEffect, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

// Edit pages (ui-design "Edit pages"): an item with more than about four fields gets its own page. Editing groups
// the fields in tabs kept in the URL, with one save bar for every tab; creating uses one page with sections.

export function EditHeader({
  backTo,
  backLabel,
  title,
  description,
}: {
  backTo: string;
  backLabel: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="edit-head">
      <Link className="dp-back" to={backTo}>
        <ChevronLeft size={16} aria-hidden="true" />
        {backLabel}
      </Link>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
  );
}

export type EditTab = {
  id: string;
  label: string;
  /** Unsaved changes on this tab. */
  dirty?: boolean;
  /** Fields on this tab that need fixing. */
  errors?: number;
};

/** The current tab from ?tab=, falling back to the first. */
export function useEditTab(ids: string[]) {
  const [params, setParams] = useSearchParams();
  const asked = params.get('tab');
  const tab = asked && ids.includes(asked) ? asked : ids[0];
  const go = (id: string) => setParams({ tab: id }, { replace: true });
  return [tab, go] as const;
}

export function EditTabs({
  tabs,
  current,
  label,
}: {
  tabs: EditTab[];
  current: string;
  label: string;
}) {
  return (
    <nav className="vtabs" aria-label={label}>
      {tabs.map((t) => (
        <Link
          key={t.id}
          className="vtab"
          to={{ search: `?tab=${t.id}` }}
          replace
          aria-current={t.id === current ? 'page' : undefined}
        >
          {t.label}
          {!!t.errors && (
            <span className="vtab-n bad" aria-label={`${t.errors} to fix`}>
              {t.errors}
            </span>
          )}
          {t.dirty && !t.errors && (
            <span
              className="dirty-dot"
              role="img"
              aria-label="Unsaved changes"
            />
          )}
        </Link>
      ))}
    </nav>
  );
}

/** Appears only while there are unsaved changes; saving covers every tab. */
export function SaveBar({
  saving,
  onDiscard,
  saveLabel = 'Save changes',
}: {
  saving: boolean;
  onDiscard: () => void;
  saveLabel?: string;
}) {
  return (
    <div className="savebar" role="region" aria-label="Unsaved changes">
      <span className="savebar-msg">Unsaved changes</span>
      <button type="button" className="btn" onClick={onDiscard}>
        Discard
      </button>
      <button type="submit" className="btn savebar-go" disabled={saving}>
        {saving ? 'Saving…' : saveLabel}
      </button>
    </div>
  );
}

/** Asks before the tab or window closes while there are unsaved changes. */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);
}

/** Focus a field by id once its tab has rendered. */
export function focusField(id: string) {
  requestAnimationFrame(() => document.getElementById(id)?.focus());
}

export function EditCard({ children }: { children: ReactNode }) {
  return <section className="card edit-card">{children}</section>;
}
