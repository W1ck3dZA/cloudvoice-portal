import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppWindow,
  Building2,
  ChevronDown,
  Code2,
  FileAudio,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Music,
  PhoneCall,
  RadioTower,
  Router,
  Settings,
  Sun,
  Users,
  UsersRound,
  Webhook,
  X,
} from 'lucide-react';
import { Brand } from './Brand';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/theme';
const groups = [
  { label: 'Overview', items: [['/', 'Dashboard', LayoutDashboard]] },
  {
    label: 'Voice',
    items: [
      ['/numbers', 'Numbers', RadioTower],
      ['/sip-users', 'SIP Users', Users],
      ['/gateways', 'SIP Gateways', Router],
      ['/calls', 'Calls', PhoneCall],
      ['/recordings', 'Recordings', FileAudio],
      ['/audio-files', 'Audio files', Music],
      ['/applications', 'Applications', AppWindow],
    ],
  },
  {
    label: 'Operations',
    items: [
      ['/call-center', 'Call Center', UsersRound],
      ['/messaging', 'Messaging', MessageSquare],
    ],
  },
  {
    label: 'Developers',
    items: [
      ['/webhooks', 'Webhooks', Webhook],
      ['/events', 'Event Publisher', Code2],
      ['/api-keys', 'API Keys', KeyRound],
    ],
  },
  {
    label: 'Account',
    items: [
      ['/organisation', 'Organisation', Building2],
      ['/settings', 'Settings', Settings],
    ],
  },
] as const;
export function Layout() {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { session, logout } = useSession();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isFullBleed = /\/applications\/[^/]+\/builder/.test(location.pathname);
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
    <div className="app-shell">
      <aside className={'sidebar ' + (open ? 'open' : '')}>
        <div className="side-head">
          <Brand />
          <button className="icon-btn mobile" onClick={() => setOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <nav>
          {groups.map((g) => (
            <div className="nav-group" key={g.label}>
              <div className="nav-label">{g.label}</div>
              {g.items.map(([to, label, Icon]) => (
                <NavLink
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    'nav-item ' + (isActive ? 'active' : '')
                  }
                  to={to}
                  end={to === '/'}
                  key={to}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">
            {session?.user?.name?.[0]?.toUpperCase() || 'C'}
          </div>
          <div className="user-copy">
            <strong>{session?.user?.name || 'Cloudvoice user'}</strong>
            <span>{session?.role || 'user'}</span>
          </div>
          <button className="icon-btn" onClick={logout} title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="icon-btn mobile" onClick={() => setOpen(true)}>
            <Menu size={21} />
          </button>
          <div className="crumb">Customer Portal</div>
          <div className="top-actions">
            <button
              className="icon-btn theme-toggle"
              onClick={toggleTheme}
              title={
                theme === 'dark'
                  ? 'Switch to light mode'
                  : 'Switch to dark mode'
              }
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="org-menu" ref={menuRef}>
              <button
                className="org-pill"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <span className="status-dot" />{' '}
                {session?.user?.name || 'Account'} <ChevronDown size={14} />
              </button>
              {menuOpen && (
                <div className="org-menu-panel">
                  <div className="org-menu-head">
                    <strong>{session?.user?.name || 'Cloudvoice user'}</strong>
                    <span>{session?.user?.email}</span>
                    <span className="caps">{session?.role || 'user'}</span>
                  </div>
                  <div className="org-menu-items">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/settings');
                      }}
                    >
                      <Settings size={15} /> Settings
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/organisation');
                      }}
                    >
                      <Building2 size={15} /> Organisation
                    </button>
                    <button onClick={logout}>
                      <LogOut size={15} /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className={'page' + (isFullBleed ? ' page-full' : '')}>
          <Outlet />
        </main>
      </div>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
    </div>
  );
}
