import logo from '../assets/brand/logo.png';
import logoWhite from '../assets/brand/logo-white.png';
import mark from '../assets/brand/mark.png';
import markWhite from '../assets/brand/mark-white.png';

// onDark forces the white artwork (e.g. on the always-dark login panel);
// otherwise the variant follows the active light/dark theme.
export function Brand({
  compact = false,
  onDark = false,
}: {
  compact?: boolean;
  onDark?: boolean;
}) {
  const color = compact ? mark : logo;
  const white = compact ? markWhite : logoWhite;
  const cls = compact ? 'brand-mark' : 'brand-logo';
  return (
    <div className="brand">
      {onDark ? (
        <img className={cls} src={white} alt="Cloudvoice" />
      ) : (
        <>
          <img className={cls + ' brand-light'} src={color} alt="Cloudvoice" />
          <img className={cls + ' brand-dark'} src={white} alt="" aria-hidden="true" />
        </>
      )}
    </div>
  );
}
