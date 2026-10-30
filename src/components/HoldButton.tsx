import { HoldIcon } from './HoldIcon';
import { useHold } from './useHold';
import './hold.css';

/**
 * The delete button. Every delete in a product uses this, in tables, drawers, detail pages and bulk bars.
 *
 *   <HoldButton label="Hold to delete customer" onHold={() => remove(id)} />
 *   <HoldButton iconOnly aria-label="Delete Acme Telecom" onHold={...} />
 *
 * The label always starts with "Hold to", so nobody has to guess that a tap does nothing. Put the consequence in
 * plain text next to it ("Their numbers go back to the pool. This can't be undone.").
 */
export function HoldButton({
  label = 'Hold to delete',
  onHold,
  ms = 1000,
  iconOnly = false,
  disabled,
  ...aria
}: {
  label?: string;
  onHold: () => void;
  ms?: number;
  iconOnly?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
}) {
  const hold = useHold(onHold, ms);
  const cls = [
    'hold',
    iconOnly && 'hold-icon',
    hold.holding && 'holding',
    hold.done && 'done',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={cls}
      style={{ ['--hold-ms' as string]: `${ms}ms` }}
      disabled={disabled || hold.done}
      aria-description="Press and hold to delete"
      {...aria}
      {...hold.bind}
    >
      <svg className="hold-edge" aria-hidden="true">
        <rect pathLength={100} />
      </svg>
      <HoldIcon />
      <span className="hold-lbl">
        {hold.holding ? 'Keep holding' : hold.done ? 'Deleting' : label}
      </span>
    </button>
  );
}
