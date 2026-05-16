import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  Camera,
  CheckCircle2,
  DownloadCloud,
  Settings,
  LogOut,
  LayoutDashboard,
  Library,
  Wrench,
  Zap,
  Film,
  Menu,
  UserCircle,
  X,
  type LucideIcon,
} from 'lucide-react';
import { clearApiKey } from '../api/client';
import { usersApi } from '../api/users';
import { useLiveState } from '../lib/liveState';
import { useToast } from './ui/ToastProvider';
import BrandMark from './BrandMark';

interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
}

const mainNav: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/media', label: 'Library', Icon: Film },
  { to: '/collections', label: 'Collection', Icon: Library },
  { to: '/utilities', label: 'Utilities', Icon: Wrench },
  { to: '/actions', label: 'Actions', Icon: Zap },
];

const maxAvatarBytes = 2 * 1024 * 1024;

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { currentUser, error, queue, readinessWarnings, refresh, status, updateState } = useLiveState();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) setNotificationOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
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
    setNotificationOpen(false);
    setProfileOpen(false);
  }

  async function handleAvatarSelected(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify({ message: 'Choose an image file for the profile picture.', tone: 'warning' });
      return;
    }
    if (file.size > maxAvatarBytes) {
      notify({ message: 'Profile image must be 2 MB or smaller.', tone: 'warning' });
      return;
    }

    setAvatarSaving(true);
    try {
      const avatar = await readFileAsDataUrl(file);
      await usersApi.updateCurrent({ Avatar: avatar });
      await refresh();
      notify({ message: 'Profile image updated.', tone: 'success' });
    } catch (err) {
      notify({
        title: 'Profile image failed',
        message: err instanceof Error ? err.message : 'Could not update the profile image.',
        tone: 'error',
      });
    } finally {
      setAvatarSaving(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  }

  const runningJobs = queue?.CurrentlyExecuting ?? [];
  const queueCount = queue?.TotalCount ?? 0;
  const username = currentUser?.Username ?? 'User';
  const allWarnings = [
    ...readinessWarnings,
    ...(error ? [error] : []),
    ...(status?.State && status.State !== 'Started' ? [`Server state: ${status.State}`] : []),
  ];
  const warningCount = allWarnings.length;
  const updateCount = Number(updateState.serverAvailable) + Number(updateState.webuiAvailable);
  const notificationCount = warningCount + queueCount + updateCount;
  const updateLabels = [
    ...(updateState.serverAvailable ? ['Server update available'] : []),
    ...(updateState.webuiAvailable ? ['WebUI update available'] : []),
  ];

  return (
    <div className="min-h-screen overflow-x-hidden text-gray-100">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-shoko-line bg-[#050505]/92 backdrop-blur-sm">
        <div className="flex h-16 items-center px-3 sm:px-6">
          <NavLink to="/dashboard" onClick={closeMobile} className="flex min-w-0 items-center gap-3 pr-3 sm:pr-6 xl:pr-10">
            <BrandMark className="h-11 w-11" />
            <span className="hidden truncate text-2xl font-semibold tracking-wide text-white sm:block">DaCollector</span>
          </NavLink>

          <nav className="hidden items-center gap-2 lg:flex">
            {mainNav.map(item => (
              <DesktopLink key={item.to} currentPath={location.pathname} item={item} />
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <div ref={profileRef} className="relative">
              <button
                type="button"
                title="Account"
                onClick={() => { setProfileOpen(o => !o); setNotificationOpen(false); setMobileOpen(false); }}
                className={`flex items-center rounded-full transition ${profileOpen ? 'ring-2 ring-blue-500' : 'ring-1 ring-transparent hover:ring-gray-600'}`}
              >
                <UserAvatar username={username} avatar={currentUser?.Avatar} sizeClass="h-9 w-9" />
              </button>
              {profileOpen && (
                <AccountMenu
                  avatar={currentUser?.Avatar}
                  avatarSaving={avatarSaving}
                  inputRef={avatarInputRef}
                  isAdmin={Boolean(currentUser?.IsAdmin)}
                  onAvatarSelected={handleAvatarSelected}
                  onClose={() => setProfileOpen(false)}
                  onLogout={handleLogout}
                  username={username}
                />
              )}
            </div>

            <NavLink
              to="/settings"
              title="Settings"
              className={({ isActive }) =>
                `inline-flex rounded-md p-2 transition-colors ${isActive ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`
              }
            >
              <Settings size={19} />
            </NavLink>

            <div ref={notificationRef} className="relative">
              <button
                type="button"
                title="Notifications"
                onClick={() => { setNotificationOpen(o => !o); setProfileOpen(false); setMobileOpen(false); }}
                className={`relative rounded-md p-2 transition-colors ${notificationOpen ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
              >
                <Bell size={19} />
                {notificationCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold leading-none text-white">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                )}
              </button>
              {notificationOpen && (
                <NotificationMenu
                  queueCount={queueCount}
                  runningJobs={runningJobs}
                  updateLabels={updateLabels}
                  warnings={allWarnings}
                  onClose={() => setNotificationOpen(false)}
                />
              )}
            </div>

            <button
              type="button"
              onClick={() => { setMobileOpen(open => !open); setNotificationOpen(false); setProfileOpen(false); }}
              className="fixed left-16 top-4 z-50 rounded-md border border-blue-500/60 bg-black/80 p-1.5 text-blue-500 transition-colors hover:text-blue-400 lg:hidden"
              aria-expanded={mobileOpen}
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="border-t border-shoko-line bg-[#050505]/95 px-4 py-4 shadow-panel lg:hidden">
            <div className="space-y-2">
              {mainNav.map(item => (
                <MobileLink key={item.to} item={item} currentPath={location.pathname} onNavigate={closeMobile} />
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="min-h-screen min-w-0 overflow-x-hidden pt-16">
        <Outlet />
      </main>
    </div>
  );
}

function AccountMenu({
  avatar,
  avatarSaving,
  inputRef,
  isAdmin,
  onAvatarSelected,
  onClose,
  onLogout,
  username,
}: {
  avatar?: string;
  avatarSaving: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  isAdmin: boolean;
  onAvatarSelected: (file?: File) => Promise<void>;
  onClose: () => void;
  onLogout: () => void;
  username: string;
}) {
  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-md border border-shoko-line bg-[#0d0d0d] p-4 shadow-panel">
      <div className="flex items-center gap-3">
        <UserAvatar username={username} avatar={avatar} sizeClass="h-14 w-14" />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-white">{username}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-500">
            {isAdmin ? <CheckCircle2 size={13} className="text-blue-400" /> : <UserCircle size={13} />}
            {isAdmin ? 'Administrator' : 'User'}
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={event => void onAvatarSelected(event.target.files?.[0])}
      />

      <div className="mt-4 grid gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={avatarSaving}
          className="flex items-center justify-center gap-2 rounded-md border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-blue-500/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Camera size={15} />
          {avatarSaving ? 'Uploading...' : 'Upload Profile Image'}
        </button>
        <NavLink
          to="/settings/profile"
          onClick={onClose}
          className="flex items-center justify-center gap-2 rounded-md border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-blue-500/60 hover:text-white"
        >
          <Settings size={15} />
          Account Settings
        </NavLink>
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center justify-center gap-2 rounded-md border border-red-700/50 px-3 py-2 text-sm font-medium text-red-300 transition-colors hover:border-red-500/70 hover:text-red-200"
        >
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </div>
  );
}

function NotificationMenu({
  onClose,
  queueCount,
  runningJobs,
  updateLabels,
  warnings,
}: {
  onClose: () => void;
  queueCount: number;
  runningJobs: Array<{ Title?: string; Type?: string }>;
  updateLabels: string[];
  warnings: string[];
}) {
  const hasNotifications = warnings.length > 0 || queueCount > 0 || updateLabels.length > 0;

  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-md border border-shoko-line bg-[#0d0d0d] shadow-panel">
      <div className="flex items-center justify-between border-b border-gray-800/60 px-4 py-3">
        <p className="text-sm font-semibold text-white">Notifications</p>
        <span className="text-xs text-gray-500">{queueCount} queued</span>
      </div>

      {!hasNotifications ? (
        <div className="flex items-center gap-2 px-4 py-5 text-sm text-gray-500">
          <CheckCircle2 size={16} className="text-emerald-400" />
          No active notifications.
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          {warnings.length > 0 && (
            <NotificationSection title="Warnings">
              {warnings.map((warning, index) => (
                <NotificationRow key={`${warning}-${index}`} icon={<AlertTriangle size={14} className="text-yellow-400" />} tone="warning">
                  {warning}
                </NotificationRow>
              ))}
            </NotificationSection>
          )}

          {updateLabels.length > 0 && (
            <NotificationSection title="Updates">
              {updateLabels.map(label => (
                <NotificationRow key={label} icon={<DownloadCloud size={14} className="text-blue-400" />}>
                  {label}
                </NotificationRow>
              ))}
              <NavLink
                to="/settings/web-ui"
                onClick={onClose}
                className="mx-4 mb-3 inline-flex text-xs font-medium text-blue-400 hover:text-blue-300"
              >
                Open update settings
              </NavLink>
            </NotificationSection>
          )}

          <NotificationSection title="Queue">
            {runningJobs.length > 0 ? (
              runningJobs.map((job, index) => (
                <NotificationRow key={`${job.Title ?? job.Type}-${index}`} icon={<span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />}>
                  {job.Title || job.Type || 'Running job'}
                </NotificationRow>
              ))
            ) : (
              <NotificationRow icon={<Bell size={14} className="text-gray-500" />}>
                No jobs currently running.
              </NotificationRow>
            )}
            <NavLink
              to="/utilities"
              onClick={onClose}
              className="mx-4 mb-3 inline-flex text-xs font-medium text-blue-400 hover:text-blue-300"
            >
              View full queue
            </NavLink>
          </NotificationSection>
        </div>
      )}
    </div>
  );
}

function NotificationSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="border-b border-gray-800/50 py-2 last:border-b-0">
      <h3 className="px-4 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      {children}
    </section>
  );
}

function NotificationRow({ children, icon, tone }: { children: React.ReactNode; icon: React.ReactNode; tone?: 'warning' }) {
  return (
    <div className={`flex items-start gap-2 px-4 py-2 text-sm ${tone === 'warning' ? 'text-yellow-100' : 'text-gray-300'}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

function UserAvatar({ avatar, username, sizeClass }: { avatar?: string; username: string; sizeClass: string }) {
  const initial = username.trim().charAt(0).toUpperCase() || 'U';

  if (avatar) {
    return (
      <img
        src={avatar}
        alt=""
        className={`${sizeClass} shrink-0 rounded-full border border-gray-700 object-cover`}
      />
    );
  }

  return (
    <span className={`${sizeClass} grid shrink-0 place-items-center rounded-full bg-blue-500 text-sm font-semibold text-black`}>
      {initial}
    </span>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not read profile image.'));
    };
    reader.onerror = () => reject(new Error('Could not read profile image.'));
    reader.readAsDataURL(file);
  });
}

function DesktopLink({ currentPath, item }: { currentPath: string; item: NavItem }) {
  const { to, label, Icon } = item;

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors ${
          isActive || isTopLevelActive(to, currentPath)
            ? 'bg-blue-600/20 text-white'
            : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
        }`
      }
    >
      <Icon size={16} />
      {label}
    </NavLink>
  );
}

function isTopLevelActive(to: string, currentPath: string) {
  if (to === '/utilities') return currentPath.startsWith('/utilities') || currentPath === '/files' || currentPath === '/folders' || currentPath === '/parser';
  if (to === '/media') return currentPath.startsWith('/media');
  if (to === '/collections') return currentPath.startsWith('/collections');
  if (to === '/actions') return currentPath.startsWith('/actions');
  return currentPath === to;
}

function MobileLink({ currentPath, item, onNavigate }: { currentPath: string; item: NavItem; onNavigate: () => void }) {
  const { to, label, Icon } = item;

  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={() =>
        `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
          isTopLevelActive(to, currentPath)
            ? 'bg-blue-600/20 text-white'
            : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
        }`
      }
    >
      <Icon size={16} />
      {label}
    </NavLink>
  );
}
