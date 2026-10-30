import { useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
// Building blocks for drawers: a summary header, sections of label / value
// rows for viewing a record, and grouped sections for editing one.

/** Top of a view drawer: what it is, its name, a few facts and actions. */
export function DetailSummary({
  kind,
  title,
  subtitle,
  facts,
  children,
}: {
  kind: string;
  title: ReactNode;
  subtitle?: ReactNode;
  facts?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="dv-summary">
      <span className="dv-kind">{kind}</span>
      <div className="dv-title">{title}</div>
      {subtitle && <div className="dv-subtitle">{subtitle}</div>}
      {facts && <div className="dv-facts">{facts}</div>}
      {children && <div className="dv-actions">{children}</div>}
    </section>
  );
}

export function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="dv-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function DetailRows({ children }: { children: ReactNode }) {
  return <dl className="dv-rows">{children}</dl>;
}

export function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="dv-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** A value with a copy button, e.g. an ID or SIP username. */
export function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="dv-copy">
      <code>{value}</code>
      <button
        type="button"
        className="icon-btn"
        aria-label={copied ? 'Copied' : `Copy ${label}`}
        title={copied ? 'Copied' : `Copy ${label}`}
        onClick={() =>
          navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
        }
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
      <span className="sr-only" role="status">
        {copied ? `${label} copied` : ''}
      </span>
    </span>
  );
}

/** Body of a view drawer: summary then sections, evenly spaced. */
export function DetailView({ children }: { children: ReactNode }) {
  return <div className="dv">{children}</div>;
}

/** A titled group of fields inside a drawer form. */
export function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="fs">
      <legend>{title}</legend>
      {hint && <p className="fs-hint">{hint}</p>}
      <div className="fs-fields">{children}</div>
    </fieldset>
  );
}

/** Multi-select as pill-shaped checkboxes (real inputs, keyboard friendly). */
export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T[];
  onChange: (next: T[]) => void;
  label: string;
}) {
  return (
    <div className="choice-chips" role="group" aria-label={label}>
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <label key={o.value} className={'choice' + (on ? ' on' : '')}>
            <input
              type="checkbox"
              checked={on}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...value, o.value]
                    : value.filter((v) => v !== o.value),
                )
              }
            />
            {on && <Check size={14} aria-hidden="true" />}
            {o.label}
          </label>
        );
      })}
    </div>
  );
}

/** Footer of a drawer form or view: primary action first. */
export function DrawerActions({ children }: { children: ReactNode }) {
  return <div className="dv-footer">{children}</div>;
}

/** Read-only pills for a list of short values, e.g. codecs. */
export function ValuePills({ values }: { values: string[] }) {
  if (!values.length) return <>—</>;
  return (
    <span className="pills">
      {values.map((v) => (
        <span className="pill" key={v}>
          {v}
        </span>
      ))}
    </span>
  );
}
