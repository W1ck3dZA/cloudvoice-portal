import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Copy,
  Inbox,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
export const Card = ({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) => <section className={'card ' + className}>{children}</section>;
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
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
  if (!open) return null;
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className={`drawer drawer-${size}`}>
        <div className="drawer-head">
          <div>
            <span className="eyebrow">Cloudvoice</span>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </>
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
          Next <ChevronRight size={14} />
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
      <Plus size={16} />
      {children}
    </PrimaryButton>
  );
}
export function DangerButton({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="btn danger"
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      <Trash2 size={15} />
      {children}
    </button>
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
      <Copy size={14} />
      {label}
    </button>
  );
}
export function ErrorBox({ message }: { message?: string }) {
  return message ? (
    <div className="alert">
      <AlertTriangle size={15} />
      {message}
    </div>
  ) : null;
}
export function ConfirmBar({
  text,
  onConfirm,
  busy = false,
}: {
  text: string;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <div className="danger-zone">
      <div>
        <strong>Danger zone</strong>
        <span>{text}</span>
      </div>
      <DangerButton onClick={onConfirm} disabled={busy}>
        Delete
      </DangerButton>
    </div>
  );
}
export function RowActions({
  onView,
  onEdit,
  onDelete,
}: {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="row-actions">
      {onView && (
        <button className="table-action" onClick={onView}>
          View <ChevronRight size={14} />
        </button>
      )}
      {onEdit && (
        <button className="table-action" onClick={onEdit}>
          Edit
        </button>
      )}
      {onDelete && (
        <button className="table-action danger-text" onClick={onDelete}>
          Delete
        </button>
      )}
    </div>
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
        <span className="eyebrow">Shown once</span>
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
