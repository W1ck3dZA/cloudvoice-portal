import {
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { HoldButton } from './HoldButton';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Copy,
  Inbox,
  MoreHorizontal,
  Plus,
  X,
} from 'lucide-react';
import { AnimatedIcon } from './AnimatedIcon';
export const Card = ({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) => <section className={'card ' + className}>{children}</section>;
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="page-actions">{action}</div>}
    </div>
  );
}
export function Empty({
  title = 'Nothing here yet',
  text,
  action,
  icon,
}: {
  title?: string;
  text: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-orb">{icon ?? <Inbox size={16} />}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Spinner() {
  return <div className="spinner" />;
}
export function Status({ value }: { value: string | boolean }) {
  const v = String(value);
  return (
    <span
      className={
        'badge ' +
        ([
          'active',
          'answered',
          'completed',
          'delivered',
          'available',
          'true',
          'sent',
          'received',
        ].includes(v.toLowerCase())
          ? 'good'
          : [
                'failed',
                'suspended',
                'busy',
                'false',
                'revoked',
                'undelivered',
              ].includes(v.toLowerCase())
            ? 'bad'
            : '')
      }
    >
      <span />
      {v.replaceAll('_', ' ')}
    </span>
  );
}
export function StatusToggle({
  checked,
  onChange,
  disabled = false,
  title,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={'switch ' + (checked ? 'on' : '')}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      disabled={disabled}
      title={title ?? (checked ? 'Active' : 'Inactive')}
    >
      <i />
    </button>
  );
}
/**
 * A native <dialog> side panel for quick edits; a bottom sheet on phones. Escape, the close button and a click on
 * the backdrop all call onClose. The title takes focus when it opens.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (open && d && !d.open) {
      d.showModal();
      titleRef.current?.focus();
    }
  }, [open]);
  if (!open) return null;
  return (
    <dialog
      ref={ref}
      className={`drawer drawer-${size}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="drawer-head">
        <div>
          <h2 id={titleId} ref={titleRef} tabIndex={-1}>
            {title}
          </h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          aria-label="Close"
          title="Close"
        >
          <AnimatedIcon icon={X} size={20} animation="press" trigger="click" />
        </button>
      </div>
      <div className="drawer-body">{children}</div>
    </dialog>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="toggle-row">
      <button
        type="button"
        className={'switch ' + (checked ? 'on' : '')}
        onClick={() => onChange(!checked)}
      >
        <i />
      </button>
      <span>{label}</span>
    </label>
  );
}
export function DetailGrid({
  items,
}: {
  items: { label: string; value: ReactNode }[];
}) {
  return (
    <div className="detail-grid">
      {items.map((i) => (
        <div className="detail-item" key={i.label}>
          <span>{i.label}</span>
          <strong>{i.value ?? '—'}</strong>
        </div>
      ))}
    </div>
  );
}
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="toolbar">{children}</div>;
}
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="pagination">
      <span className="muted">
        {from}–{to} of {total}
      </span>
      <div className="pagination-controls">
        <button
          className="btn ghost"
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft size={14} /> Prev
        </button>
        <span className="muted">
          Page {page} of {totalPages}
        </span>
        <button
          className="btn ghost"
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next <AnimatedIcon icon={ChevronRight} size={14} animation="nudge" />
        </button>
      </div>
    </div>
  );
}
export function PrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  return (
    <button
      className="btn primary"
      type={type}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function AddButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <PrimaryButton onClick={onClick}>
      <AnimatedIcon icon={Plus} size={16} animation="press" trigger="click" />
      {children}
    </PrimaryButton>
  );
}
export function CopyButton({
  value,
  label = 'Copy',
}: {
  value: string;
  label?: string;
}) {
  return (
    <button
      className="btn ghost"
      type="button"
      onClick={() => navigator.clipboard.writeText(value)}
    >
      <AnimatedIcon icon={Copy} size={14} animation="press" trigger="click" />
      {label}
    </button>
  );
}
export function ErrorBox({ message }: { message?: string }) {
  return message ? (
    <div className="alert">
      <AnimatedIcon
        icon={AlertTriangle}
        size={15}
        animation="shake"
        trigger="always"
      />
      {message}
    </div>
  ) : null;
}
export function RowActions({
  onView,
  onEdit,
  onDelete,
  deleteLabel = 'Delete',
}: {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Names what goes, e.g. "Delete SIP user 1001"; it is the hold button's accessible name. */
  deleteLabel?: string;
}) {
  return (
    <div className="row-actions">
      {onView && (
        <button className="table-action wide-only" onClick={onView}>
          View <AnimatedIcon icon={ChevronRight} size={14} animation="nudge" />
        </button>
      )}
      {onEdit && (
        <button className="table-action" onClick={onEdit}>
          Edit
        </button>
      )}
      {onDelete && (
        <HoldButton iconOnly aria-label={deleteLabel} onHold={onDelete} />
      )}
    </div>
  );
}
/** A delete in a drawer or danger zone: the consequence in words, then the hold button. */
export function HoldToDelete({
  label,
  consequence,
  onHold,
  ms,
}: {
  /** Starts with "Hold to", e.g. "Hold to delete gateway". */
  label: string;
  consequence: string;
  onHold: () => void;
  ms?: number;
}) {
  return (
    <div className="hold-zone">
      <p>{consequence}</p>
      <HoldButton label={label} onHold={onHold} ms={ms} />
    </div>
  );
}
/**
 * A risky action that is not a delete (rotate a secret, hang up a call): the first press shows the consequence
 * inline with a button that names the action, next to Cancel.
 */
export function ConfirmAction({
  label,
  confirmLabel,
  consequence,
  onConfirm,
  busy = false,
  compact = false,
}: {
  label: ReactNode;
  /** Names the consequence, e.g. "Yes, rotate secret". */
  confirmLabel: string;
  consequence?: string;
  onConfirm: () => void;
  busy?: boolean;
  /** In a table row: plain text buttons, no explanation box. */
  compact?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const yes = () => {
    setAsking(false);
    onConfirm();
  };
  if (compact)
    return asking ? (
      <span className="confirm-inline" role="group">
        <button className="table-action danger-text" onClick={yes}>
          {confirmLabel}
        </button>
        <button className="table-action" onClick={() => setAsking(false)}>
          Cancel
        </button>
      </span>
    ) : (
      <button
        className="table-action"
        disabled={busy}
        onClick={() => setAsking(true)}
      >
        {label}
      </button>
    );
  return asking ? (
    <div className="confirm" role="group">
      {consequence && <p>{consequence}</p>}
      <div className="confirm-act">
        <button type="button" className="btn primary" onClick={yes}>
          {confirmLabel}
        </button>
        <button type="button" className="btn" onClick={() => setAsking(false)}>
          Cancel
        </button>
      </div>
    </div>
  ) : (
    <button
      type="button"
      className="btn"
      disabled={busy}
      onClick={() => setAsking(true)}
    >
      {label}
    </button>
  );
}
export function SecretReveal({
  title,
  value,
  onClose,
}: {
  title: string;
  value: string;
  onClose: () => void;
}) {
  return (
    <div className="secret-card">
      <div>
        <h3>{title}</h3>
        <p>Copy this value now. The API may not return it again.</p>
      </div>
      <code>{value}</code>
      <div className="button-row">
        <CopyButton value={value} />
        <button className="btn" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
/**
 * Responsive tables (table.rt): on phones each row collapses to its main cell and an end cell (.c-end), and the
 * whole row opens the item. Spread rowOpen(fn) on the <tr>; taps on the row's own controls don't open it.
 */
export function rowOpen(onOpen?: () => void) {
  if (!onOpen) return {};
  return {
    className: 'tap',
    onClick: (e: MouseEvent<HTMLTableRowElement>) => {
      const t = e.target as HTMLElement;
      if (t.closest('button, a, input, select, textarea, label, .hold')) return;
      onOpen();
    },
  };
}
/**
 * The first cell of a responsive table row. `children` is the desktop content; on phones `title` (default:
 * children) and the `sub` summary line show instead. With onOpen the content is a button, so keyboards can open it.
 */
export function RowMain({
  children,
  title,
  sub,
  onOpen,
  label,
}: {
  children: ReactNode;
  title?: ReactNode;
  sub?: ReactNode;
  onOpen?: () => void;
  /** Accessible name for the open button, e.g. "Open +27100562194". */
  label?: string;
}) {
  const body = (
    <>
      <span className="main-lg">{children}</span>
      <span className="main-sm">{title ?? children}</span>
      {sub && <span className="sub-sm">{sub}</span>}
    </>
  );
  return (
    <td className="c-main">
      {onOpen ? (
        <button
          type="button"
          className="row-open"
          aria-label={label}
          onClick={onOpen}
        >
          {body}
        </button>
      ) : (
        body
      )}
    </td>
  );
}
