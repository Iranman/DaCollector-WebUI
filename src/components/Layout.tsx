import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  DownloadCloud,
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
import { useLiveState } from '../lib/liveState';
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

const utilityNav: NavGroup = {
  label: 'Utilities',
  Icon: Wrench,
  items: [
    { to: '/utilities', label: 'Queue', Icon: Bell },
    { to: '/utilities/unrecognized/files', label: 'Unmatched Files', Icon: FolderSearch },
    { to: '/utilities/release-management/duplicates', label: 'Duplicates', Icon: Library },
    { to: '/utilities/release-management/missing', label: 'Missing', Icon: ScrollText },
    { to: '/utilities/integrity', label: 'Integrity', Icon: Zap },
    { to: '/utilities/renamer', label: 'Rename/Move', Icon: FolderOpen },
    { to: '/utilities/file-search', label: 'Parser', Icon: ScanLine },
    { to: '/utilities/folders', label: 'Folders', Icon: FolderOpen },
  ],
};

const mobileNav: Array<NavItem | NavGroup> = [
  primaryNav[0],
  collectionNav,
  utilityNav,
  ...primaryNav.slice(1),
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const warningRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const { currentUser, error, queue, readinessWarnings, status, updateState } = useLiveState();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (warningRef.current && !warningRef.current.contains(e.target as Node)) setWarningOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleLogout() {
    clearApiKey();
    navigate('/login');
  }

  function closeMobile() {
    setMobileOpen(false);
  }

  const runningJobs = queue?.CurrentlyExecuting ?? [];
  const queueCount = queue?.TotalCount ?? 0;
  const username = currentUser?.Username ?? 'User';
  const userInitial = username.trim().charAt(0).toUpperCase() || 'U';
  const allWarnings = [
    ...readinessWarnings,
    ...(error ? [error] : []),
    ...(status?.State && status.State !== 'Started' ? [`Server state: ${status.State}`] : []),
  ];
  const warningCount = allWarnings.length;
  const updateCount = Number(updateState.serverAvailable) + Number(updateState.webuiAvailable);

  return (
    <div className="min-h-screen overflow-x-hidden text-gray-100">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-shoko-line bg-[#050505]/92 backdrop-blur-sm">
        <div className="flex h-14 items-center px-3 sm:px-6">
          <NavLink to="/dashboard" onClick={closeMobile} className="flex min-w-0 items-center gap-2 pr-3 sm:gap-3 sm:pr-5 lg:pr-10">
            <BrandMark />
            <span className="hidden truncate text-lg font-semibold tracking-wide text-white sm:block">DaCollector</span>
          </NavLink>

          <nav className="hidden items-center gap-6 lg:flex">
            <DesktopLink item={primaryNav[0]} />
            <DesktopGroup group={collectionNav} active={collectionNav.items.some(item => location.pathname.startsWith(item.to))} />
            <DesktopGroup group={utilityNav} active={location.pathname.startsWith('/utilities')} />
            {primaryNav.slice(1).map(item => (
              <DesktopLink key={item.to} item={item} />
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
            {warningCount > 0 && (
              <div ref={warningRef} className="relative hidden sm:block">
                <button
                  type="button"
                  title={`${warningCount} readiness warning${warningCount === 1 ? '' : 's'}`}
                  onClick={() => { setWarningOpen(o => !o); setBellOpen(false); }}
                  className="relative flex items-center text-yellow-400 transition-colors hover:text-yellow-300"
                >
                  <AlertTriangle size={18} />
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-yellow-500 px-1 text-[10px] font-semibold leading-none text-black">
                    {warningCount > 9 ? '9+' : warningCount}
                  </span>
                </button>
                {warningOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded border border-yellow-700/40 bg-[#0d0d0d] shadow-panel">
                    <div className="border-b border-yellow-700/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-yellow-400">
                      Warnings
                    </div>
                    <ul className="max-h-72 overflow-y-auto divide-y divide-gray-800/60">
                      {allWarnings.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 px-4 py-2.5 text-sm text-yellow-200">
                          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-yellow-400" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {updateCount > 0 && (
              <NavLink
                to="/settings/web-ui"
                title={`${updateCount} update${updateCount === 1 ? '' : 's'} available`}
                className="relative hidden items-center text-blue-500 transition-colors hover:text-blue-400 sm:flex"
              >
                <DownloadCloud size={18} />
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold leading-none text-black">
                  {updateCount}
                </span>
              </NavLink>
            )}

            <div ref={bellRef} className="relative hidden sm:block">
              <button
                type="button"
                title={queueCount > 0 ? `${queueCount} queued job${queueCount === 1 ? '' : 's'}` : 'Queue'}
                onClick={() => { setBellOpen(o => !o); setWarningOpen(false); }}
                className={`relative flex items-center transition-colors ${bellOpen ? 'text-blue-500' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <Bell size={18} />
                {queueCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold leading-none text-white">
                    {queueCount > 99 ? '99+' : queueCount}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded border border-shoko-line bg-[#0d0d0d] shadow-panel">
                  <div className="border-b border-gray-800/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Queue — {queueCount} job{queueCount === 1 ? '' : 's'}
                  </div>
                  {runningJobs.length > 0 ? (
                    <ul className="max-h-64 overflow-y-auto divide-y divide-gray-800/40">
                      {runningJobs.map((job, i) => (
                        <li key={i} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
                          <span className="min-w-0 truncate text-gray-200">{job.Title || job.Type}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-4 py-3 text-sm text-gray-500">No jobs currently running.</p>
                  )}
                  <div className="border-t border-gray-800/60 px-4 py-2">
                    <NavLink
                      to="/utilities"
                      onClick={() => setBellOpen(false)}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      View full queue →
                    </NavLink>
                  </div>
                </div>
              )}
            </div>

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
                `hidden transition-colors lg:inline-flex ${isActive ? 'text-blue-500' : 'text-gray-400 hover:text-gray-200'}`
              }
            >
              <Settings size={18} />
            </NavLink>

            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              className="hidden text-gray-400 transition-colors hover:text-gray-200 lg:inline-flex"
            >
              <LogOut size={18} />
            </button>

            <button
              type="button"
              onClick={() => setMobileOpen(open => !open)}
              className="fixed left-14 top-3 z-50 rounded-md border border-blue-500/60 bg-black/80 p-1.5 text-blue-500 transition-colors hover:text-blue-400 lg:hidden"
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

              <div className="border-t border-gray-800/70 pt-3">
                <MobileLink item={{ to: '/settings', label: 'Settings', Icon: Settings }} onNavigate={closeMobile} />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-1 flex w-full items-center gap-2 border-l-2 border-transparent px-3 py-2 text-sm text-gray-400 transition-colors hover:text-gray-200"
                >
                  <LogOut size={15} />
                  Logout
                </button>
              </div>
            </div>
          </nav>
        )}
      </header>

      <main className="min-h-screen min-w-0 overflow-x-hidden pt-14">
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
