import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Settings,
  LogOut,
  LayoutDashboard,
  Library,
  Wrench,
  ScrollText,
  Zap,
  Film,
  FolderSearch,
  ScanLine,
  FolderOpen,
  Plug,
  ChevronDown,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';
import { clearApiKey } from '../api/client';
import { queueApi, QueueStatus } from '../api/queue';
import { usersApi, User } from '../api/users';
import { buildConnection } from '../lib/signalr';
import BrandMark from './BrandMark';

interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
}

interface NavGroup {
  label: string;
  Icon: LucideIcon;
  items: NavItem[];
}

const primaryNav: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/utilities', label: 'Utilities', Icon: Wrench },
  { to: '/log', label: 'Log', Icon: ScrollText },
  { to: '/actions', label: 'Actions', Icon: Zap },
  { to: '/plugins', label: 'Plugins', Icon: Plug },
];

const collectionNav: NavGroup = {
  label: 'Collection',
  Icon: Library,
  items: [
    { to: '/media', label: 'Library', Icon: Film },
    { to: '/collections', label: 'Collections', Icon: Library },
    { to: '/folders', label: 'Folders', Icon: FolderOpen },
    { to: '/files', label: 'Files', Icon: FolderSearch },
    { to: '/parser', label: 'Parser', Icon: ScanLine },
  ],
};

const mobileNav: Array<NavItem | NavGroup> = [
  primaryNav[0],
  collectionNav,
  ...primaryNav.slice(1),
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [queue, setQueue] = useState<QueueStatus | null>(null);

  useEffect(() => {
    let stopped = false;

    usersApi.current()
      .then(user => { if (!stopped) setCurrentUser(user); })
      .catch(() => { if (!stopped) setCurrentUser(null); });

    return () => { stopped = true; };
  }, []);

  useEffect(() => {
    let stopped = false;

    queueApi.get()
      .then(status => { if (!stopped) setQueue(status); })
      .catch(() => undefined);

    const conn = buildConnection('/signalr/aggregate');

    function applyQueue(status: QueueStatus) {
      if (!stopped) setQueue(status);
    }

    conn.on('queue:connected', applyQueue);
    conn.on('queue:state.changed', applyQueue);
    conn.onreconnected(() => {
      conn.invoke('feed.join_single', 'queue').catch(() => undefined);
    });

    conn.start()
      .then(() => conn.invoke('feed.join_single', 'queue'))
      .catch(() => undefined);

    return () => {
      stopped = true;
      conn.stop();
    };
  }, []);

  function handleLogout() {
    clearApiKey();
    navigate('/login');
  }

  function closeMobile() {
    setMobileOpen(false);
  }

  const queueCount = queue?.TotalCount ?? 0;
  const username = currentUser?.Username ?? 'User';
  const userInitial = username.trim().charAt(0).toUpperCase() || 'U';

  return (
    <div className="min-h-screen text-gray-100">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-shoko-line bg-[#050505]/92 backdrop-blur-sm">
        <div className="flex h-14 items-center px-4 sm:px-6">
          <NavLink to="/dashboard" onClick={closeMobile} className="flex min-w-0 items-center gap-3 pr-5 lg:pr-10">
            <BrandMark />
            <span className="truncate text-lg font-semibold tracking-wide text-white">DaCollector</span>
          </NavLink>

          <nav className="hidden items-center gap-6 lg:flex">
            <DesktopLink item={primaryNav[0]} />
            <DesktopGroup group={collectionNav} active={collectionNav.items.some(item => location.pathname.startsWith(item.to))} />
            {primaryNav.slice(1).map(item => (
              <DesktopLink key={item.to} item={item} />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            <NavLink
              to="/utilities"
              title={queueCount > 0 ? `${queueCount} queued job${queueCount === 1 ? '' : 's'}` : 'Queue'}
              className={({ isActive }) =>
                `relative hidden items-center transition-colors sm:flex ${
                  isActive ? 'text-blue-500' : 'text-gray-400 hover:text-gray-200'
                }`
              }
            >
              <Bell size={18} />
              {queueCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold leading-none text-white">
                  {queueCount > 99 ? '99+' : queueCount}
                </span>
              )}
            </NavLink>

            <div className="hidden items-center gap-2 text-sm text-gray-300 sm:flex" title={username}>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-500 text-sm font-semibold text-black">
                {userInitial}
              </span>
              <span className="max-w-28 truncate">{username}</span>
            </div>

            <NavLink
              to="/settings"
              title="Settings"
              className={({ isActive }) =>
                `transition-colors ${isActive ? 'text-blue-500' : 'text-gray-400 hover:text-gray-200'}`
              }
            >
              <Settings size={18} />
            </NavLink>

            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              className="text-gray-400 transition-colors hover:text-gray-200"
            >
              <LogOut size={18} />
            </button>

            <button
              type="button"
              onClick={() => setMobileOpen(open => !open)}
              className="rounded-md border border-gray-700/50 p-1.5 text-gray-400 transition-colors hover:text-gray-200 lg:hidden"
              aria-expanded={mobileOpen}
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="border-t border-shoko-line bg-[#050505]/95 px-4 py-4 shadow-panel lg:hidden">
            <div className="mb-4 flex items-center justify-between border-b border-gray-800/70 pb-3">
              <div className="flex min-w-0 items-center gap-2 text-sm text-gray-300">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-500 text-sm font-semibold text-black">
                  {userInitial}
                </span>
                <span className="truncate">{username}</span>
              </div>
              <NavLink
                to="/utilities"
                onClick={closeMobile}
                className="relative text-gray-400 hover:text-gray-200"
                title="Queue"
              >
                <Bell size={18} />
                {queueCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold leading-none text-white">
                    {queueCount > 99 ? '99+' : queueCount}
                  </span>
                )}
              </NavLink>
            </div>

            <div className="space-y-4">
              {mobileNav.map(item => (
                'items' in item
                  ? <MobileGroup key={item.label} group={item} currentPath={location.pathname} onNavigate={closeMobile} />
                  : <MobileLink key={item.to} item={item} onNavigate={closeMobile} />
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="min-h-screen pt-14">
        <Outlet />
      </main>
    </div>
  );
}

function DesktopLink({ item }: { item: NavItem }) {
  const { to, label, Icon } = item;

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-1.5 text-sm font-medium transition-colors ${
          isActive ? 'text-white' : 'text-gray-400 hover:text-gray-200'
        }`
      }
    >
      <Icon size={15} />
      {label}
    </NavLink>
  );
}

function DesktopGroup({ group, active }: { group: NavGroup; active: boolean }) {
  const { Icon } = group;

  return (
    <div className="group relative">
      <button
        type="button"
        className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
          active ? 'text-white' : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        <Icon size={15} />
        {group.label}
        <ChevronDown size={13} />
      </button>
      <div className="invisible absolute left-0 top-full z-50 min-w-48 translate-y-2 border border-shoko-line bg-[#050505]/95 py-2 opacity-0 shadow-panel backdrop-blur-sm transition group-focus-within:visible group-focus-within:translate-y-1 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-1 group-hover:opacity-100">
        {group.items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                isActive ? 'bg-blue-600/20 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
              }`
            }
          >
            <item.Icon size={14} />
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

function MobileGroup({
  group,
  currentPath,
  onNavigate,
}: {
  group: NavGroup;
  currentPath: string;
  onNavigate: () => void;
}) {
  const active = group.items.some(item => currentPath.startsWith(item.to));
  const { Icon } = group;

  return (
    <div>
      <div className={`mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${
        active ? 'text-blue-400' : 'text-gray-500'
      }`}>
        <Icon size={13} />
        {group.label}
      </div>
      <div className="grid gap-1 pl-5">
        {group.items.map(item => (
          <MobileLink key={item.to} item={item} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

function MobileLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const { to, label, Icon } = item;

  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-2 border-l-2 px-3 py-2 text-sm transition-colors ${
          isActive
            ? 'border-blue-500 bg-blue-600/20 text-white'
            : 'border-transparent text-gray-400 hover:text-gray-200'
        }`
      }
    >
      <Icon size={15} />
      {label}
    </NavLink>
  );
}
