import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  Check,
  ChevronDown,
  LogOut,
  RefreshCw,
  Settings,
  Sun,
} from 'lucide-react';
import { PlayerProvider } from './AudioPlayer';
import { AnimatedIcon } from './AnimatedIcon';
import {
  ChatIcon,
  ChevronIcon,
  CodeIcon,
  HashIcon,
  HeadsetIcon,
  HomeIcon,
  PhoneIcon,
} from './Icons';
import { Brand } from './Brand';
import { orgApi } from '../lib/api';
import { useSession } from '../lib/session';
import { useSwitchOrganisation } from '../lib/useSwitchOrganisation';
import NoOrganisation from '../pages/NoOrganisation';
import { useTheme } from '../lib/theme';

type NavLeaf = { to: string; label: string; icon: ReactElement };
type NavGroupDef = NavLeaf & { items: { to: string; label: string }[] };
type NavEntry = NavLeaf | NavGroupDef;
const isGroup = (e: NavEntry): e is NavGroupDef => 'items' in e;

// Six entries; related pages sit in groups. On phones each entry is one icon in the bottom bar and a group's
// pages show as a tab row under the header.
const nav: NavEntry[] = [
  { to: '/', label: 'Dashboard', icon: <HomeIcon /> },
  {
    to: '/calls',
    label: 'Calls',
    icon: <PhoneIcon />,
    items: [
      { to: '/calls', label: 'Calls' },
      { to: '/recordings', label: 'Recordings' },
      { to: '/call-center', label: 'Call center' },
    ],
  },
  {
    to: '/numbers',
    label: 'Numbers',
    icon: <HashIcon />,
    items: [
      { to: '/numbers', label: 'Numbers' },
      { to: '/applications', label: 'Applications' },
      { to: '/audio-files', label: 'Audio files' },
    ],
  },
  {
    to: '/sip-users',
    label: 'SIP',
    icon: <HeadsetIcon />,
    items: [
      { to: '/sip-users', label: 'SIP users' },
      { to: '/gateways', label: 'SIP gateways' },
    ],
  },
  { to: '/messaging', label: 'Messaging', icon: <ChatIcon /> },
  {
    to: '/api-keys',
    label: 'Developers',
    icon: <CodeIcon />,
    items: [
      { to: '/api-keys', label: 'API keys' },
      { to: '/webhooks', label: 'Webhooks' },
      { to: '/websocket', label: 'WebSocket' },
      { to: '/events', label: 'Event publisher' },
    ],
  },
];
const account = [
  { to: '/organisation', label: 'Organisation' },
  { to: '/settings', label: 'Settings' },
];

const within = (path: string, to: string) =>
  to === '/' ? path === '/' : path === to || path.startsWith(`${to}/`);
const groupOf = (path: string) =>
  nav.find((e) => isGroup(e) && e.items.some((i) => within(path, i.to))) as
    NavGroupDef | undefined;

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { session, logout } = useSession();
  const { preference, cycleTheme } = useTheme();
  // Refresh: refetch everything on screen without leaving the page; the icon spins while anything loads.
  const qc = useQueryClient();
  const fetching = useIsFetching() > 0;
  const organisations = useQuery({
    queryKey: ['organisations'],
    queryFn: orgApi.list,
    enabled: !!session,
  });
  const switchOrg = useSwitchOrganisation();
  const orgs = organisations.data || [];
  const currentOrg = orgs.find((o) => o.id === session?.orgId);
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname.replace(/(.)\/$/, '$1');
  const isFullBleed = /\/applications\/[^/]+\/builder/.test(path);
  const group = groupOf(path);
  const page =
    group?.items.find((i) => within(path, i.to)) ??
    account.find((a) => within(path, a.to)) ??
    nav.find((e) => !isGroup(e) && within(path, e.to));
  const name = session?.user?.name || 'Cloudvoice user';
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <div className="shell">
      <aside className="side">
        <div className="side-brand">
          <Brand />
        </div>
        <nav className="nav" aria-label="Main">
          {nav.map((e) =>
            isGroup(e) ? (
              <NavGroup key={e.to} {...e} path={path} />
            ) : (
              <NavLink
                key={e.to}
                to={e.to}
                end={e.to === '/'}
                title={e.label}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                <span className="ni">{e.icon}</span>
                <span className="nl">{e.label}</span>
              </NavLink>
            ),
          )}
        </nav>
        <div className="side-foot">
          {currentOrg && (
            <NavLink
              to="/organisation"
              className={({ isActive }) =>
                `side-org${isActive ? ' active' : ''}`
              }
            >
              <span className="me-name">{currentOrg.name}</span>
              <span>Organisation</span>
            </NavLink>
          )}
          <NavLink
            to="/settings"
            className={({ isActive }) => `me-link${isActive ? ' active' : ''}`}
          >
            <span className="me-av" aria-hidden="true">
              {initials}
            </span>
            <span className="me-text">
              <span className="me-name">{name}</span>
              <span>My account</span>
            </span>
          </NavLink>
        </div>
      </aside>
      <div className="main">
        <header className="hdr">
          <div className="hdr-brand mobile-only">
            <Brand compact />
          </div>
          <div className="crumb desktop-only">
            {group && group.label !== page?.label && (
              <>
                <span>{group.label}</span>
                <ChevronIcon />
              </>
            )}
            <span className="crumb-here">{page?.label ?? 'Cloudvoice'}</span>
          </div>
          <div className="top-actions">
            <button
              className="icon-btn"
              onClick={() => void qc.refetchQueries({ type: 'active' })}
              aria-label="Refresh"
              title="Refresh"
            >
              <AnimatedIcon
                icon={RefreshCw}
                size={20}
                animation="spin"
                active={fetching}
              />
            </button>
            <button
              className="icon-btn"
              onClick={cycleTheme}
              aria-label={`Theme: ${preference}. Change theme`}
              title={`Theme: ${preference}`}
            >
              <AnimatedIcon
                icon={Sun}
                size={20}
                animation="turn"
                trigger="click"
              />
            </button>
            <div className="org-menu" ref={menuRef}>
              <button
                className="org-pill"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <span className="me-av sm" aria-hidden="true">
                  {initials}
                </span>
                <span className="org-pill-name">{name}</span>
                <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
              </button>
              {menuOpen && (
                <div className="org-menu-panel">
                  <div className="org-menu-head">
                    <strong>{name}</strong>
                    <span>{session?.user?.email}</span>
                    <span className="caps">{session?.role || 'user'}</span>
                  </div>
                  {orgs.length > 1 && (
                    <div className="org-menu-items org-menu-orgs">
                      <span className="org-menu-label">Organisations</span>
                      {orgs.map((o) => {
                        const current = o.id === session?.orgId;
                        return (
                          <button
                            key={o.id}
                            aria-current={current || undefined}
                            disabled={current || switchOrg.isPending}
                            onClick={() => switchOrg.mutate(o.id)}
                          >
                            <span className="org-menu-org">
                              <span>{o.name}</span>
                              <small className="caps">{o.role}</small>
                            </span>
                            {current && (
                              <Check
                                size={16}
                                strokeWidth={1.8}
                                aria-label="Current"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="org-menu-items">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/settings');
                      }}
                    >
                      <Settings size={16} strokeWidth={1.8} /> Settings
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/organisation');
                      }}
                    >
                      <Building2 size={16} strokeWidth={1.8} /> Organisation
                    </button>
                    <button onClick={logout}>
                      <AnimatedIcon icon={LogOut} size={16} animation="nudge" />{' '}
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        {group && group.items.length > 1 && !isFullBleed && (
          <nav className="subnav mobile-only" aria-label={group.label}>
            {group.items.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                className={() => (within(path, i.to) ? 'active' : '')}
              >
                {i.label}
              </NavLink>
            ))}
          </nav>
        )}
        <main className={isFullBleed ? 'content-full' : 'content'}>
          <PlayerProvider>
            {session && !session.orgId && path !== '/settings' ? (
              <NoOrganisation />
            ) : (
              <Outlet />
            )}
          </PlayerProvider>
        </main>
      </div>
    </div>
  );
}

/**
 * A sidebar entry with pages under it. It opens by itself while you are on one of its pages, and its heading
 * opens and closes it. On phones it is one icon in the bottom bar that opens the group's first page.
 */
function NavGroup({
  to,
  label,
  icon,
  items,
  path,
}: NavGroupDef & { path: string }) {
  const inside = items.some((i) => within(path, i.to));
  const [open, setOpen] = useState(inside);
  useEffect(() => {
    if (inside) setOpen(true);
  }, [inside]);
  const id = `nav-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <>
      <NavLink
        to={to}
        title={label}
        className={() => `mobile-only${inside ? ' active' : ''}`}
      >
        <span className="ni">{icon}</span>
        <span className="nl">{label}</span>
      </NavLink>
      <button
        type="button"
        className={`nav-grp desktop-only${inside ? ' here' : ''}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span className="ni">{icon}</span>
        <span className="nl">{label}</span>
        <span className="nav-chev">
          <ChevronIcon />
        </span>
      </button>
      {open && (
        <div id={id} className="nav-sub desktop-only">
          {items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              className={() => (within(path, i.to) ? 'active' : '')}
            >
              <span className="nl">{i.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </>
  );
}
