import type { ReactNode } from 'react';

// Hand-drawn inline icons: 24px viewBox, 1.8px stroke, round caps and joins, currentColor, shown at 20 to 22px.
// This is the static base set (navigation and anywhere an icon does not move). Icons that animate use Lucide through
// AnimatedIcon.tsx at the same 1.8px stroke. Add new static icons in this style; never use emoji or Unicode symbols as icons.

function Svg({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
export const HomeIcon = () => (
  <Svg>
    <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />
  </Svg>
);
export const PeopleIcon = () => (
  <Svg>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
    <path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.8c1.8.6 3 2.4 3 5.2" />
  </Svg>
);
export const HeadsetIcon = () => (
  <Svg>
    <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
    <rect x="3" y="14" width="4" height="6" rx="1.5" />
    <rect x="17" y="14" width="4" height="6" rx="1.5" />
  </Svg>
);
export const WalletIcon = () => (
  <Svg>
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path d="M3 10h18M16 14.5h2" />
  </Svg>
);
export const SlidersIcon = () => (
  <Svg>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </Svg>
);
export const BuildingIcon = () => (
  <Svg>
    <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 10h4a1 1 0 0 1 1 1v10M3 21h18M8 8h3M8 12h3M8 16h3" />
  </Svg>
);
export const TagIcon = () => (
  <Svg>
    <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" />
    <circle cx="8" cy="8" r="1.5" />
  </Svg>
);
export const PhoneIcon = () => (
  <Svg>
    <path d="M5 4h3.5l1.5 4.5-2.2 1.4a11 11 0 0 0 6.3 6.3l1.4-2.2L20 15.5V19a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />
  </Svg>
);
export const TeamIcon = () => (
  <Svg>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20c0-3.3 2.7-5.5 6-5.5 1.4 0 2.6.4 3.6 1" />
    <circle cx="17.5" cy="16.5" r="2.2" />
    <path d="M17.5 12.8v1.5M17.5 18.7v1.5M21.2 16.5h-1.5M15.3 16.5h-1.5" />
  </Svg>
);
export const UserIcon = () => (
  <Svg>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20c.8-3.6 3.9-5.8 7.5-5.8s6.7 2.2 7.5 5.8" />
  </Svg>
);
export const MailIcon = () => (
  <Svg>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
  </Svg>
);
export const ChartIcon = () => (
  <Svg>
    <path d="M4 20h16M7 16v-5M12 16V6M17 16v-8" />
  </Svg>
);
export const HistoryIcon = () => (
  <Svg>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6M3.5 4v4h4M12 8v4.5l3 2" />
  </Svg>
);
export const GearIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5" />
  </Svg>
);
export const SunIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
  </Svg>
);
export const LogOutIcon = () => (
  <Svg>
    <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9" />
  </Svg>
);
// Added for the Cloudvoice portal, in the same style: numbers, messages and developer tools.
export const HashIcon = () => (
  <Svg>
    <path d="M9.5 4 8 20M16 4l-1.5 16M4.5 9h15M4 15h15" />
  </Svg>
);
export const ChatIcon = () => (
  <Svg>
    <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
    <path d="M8 10h8M8 13h5" />
  </Svg>
);
export const CodeIcon = () => (
  <Svg>
    <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4.5l-3 15" />
  </Svg>
);
export const BackIcon = () => (
  <Svg size={24}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
);
// Two arcs, each ending in its own arrowhead, so the circle reads as closed with no stray corner.
export const RefreshIcon = ({ size = 22 }: { size?: number }) => (
  <Svg size={size}>
    <path d="M3.5 12a8.5 8.5 0 0 1 14.5-6l2.5 2.5M20.5 3.5v5h-5M20.5 12a8.5 8.5 0 0 1-14.5 6l-2.5-2.5M3.5 20.5v-5h5" />
  </Svg>
);
export const ChevronIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m9 6 6 6-6 6" />
  </svg>
);
export const CheckIcon = ({ size = 20 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const PlusIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/**
 * The product's logo mark: the colour version on light themes, the white one on dark.
 * Pass the two image URLs; CSS (.mark-light / .mark-dark in app.css) swaps them with the theme.
 */
export const BrandMark = ({
  light,
  dark,
  size = 34,
}: {
  light: string;
  dark: string;
  size?: number;
}) => (
  <span
    className="mark"
    style={{ width: size, height: size }}
    aria-hidden="true"
  >
    <img className="mark-light" src={light} alt="" width={size} height={size} />
    <img className="mark-dark" src={dark} alt="" width={size} height={size} />
  </span>
);
