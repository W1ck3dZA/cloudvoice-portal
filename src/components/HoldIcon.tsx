/**
 * The bin used by every delete hold: Lucide's trash-2 shapes, with the lid as its own group so hold.css can lift it
 * while the button is held. Decorative; the button around it carries the name.
 */
export function HoldIcon() {
  return (
    <svg
      className="hold-ico"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <g className="lid">
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
      </g>
      <path d="M6 6l1 14h10l1-14" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
