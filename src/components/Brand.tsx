export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <div className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 48 48">
          <path d="M14 35h21a8 8 0 0 0 1-16 13 13 0 0 0-24-3A10 10 0 0 0 14 35Z" />
          <path d="M17 27c3-6 11-6 14 0M20 30c2-3 6-3 8 0" />
        </svg>
      </div>
      {!compact && <span>Cloudvoice</span>}
    </div>
  );
}
