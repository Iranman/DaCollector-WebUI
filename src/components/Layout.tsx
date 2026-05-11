import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Bell,
  Settings,
  LogOut,
  GitFork,
  LayoutDashboard,
  Library,
  Wrench,
  ScrollText,
  Zap,
  Film,
  FolderSearch,
  ScanLine,
} from 'lucide-react';
import { clearApiKey } from '../api/client';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/media', label: 'Library', Icon: Film },
  { to: '/files', label: 'Files', Icon: FolderSearch },
  { to: '/collections', label: 'Collections', Icon: Library },
  { to: '/parser', label: 'Parser', Icon: ScanLine },
  { to: '/utilities', label: 'Utilities', Icon: Wrench },
  { to: '/log', label: 'Log', Icon: ScrollText },
  { to: '/actions', label: 'Actions', Icon: Zap },
];

export default function Layout() {
  const navigate = useNavigate();

  function handleLogout() {
    clearApiKey();
    navigate('/login');
  }

  return (
    <div className="min-h-screen text-gray-100">
      <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-gray-700/50 bg-[#0d0d1a]/90 backdrop-blur-sm">
        <div className="flex h-full items-center px-6">
          {/* Logo */}
          <NavLink to="/dashboard" className="flex min-w-0 items-center gap-3 pr-10">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-500 text-sm font-semibold text-white">
              D
            </span>
            <span className="truncate text-lg font-semibold tracking-wide text-white">DaCollector</span>
          </NavLink>

          {/* Center nav */}
          <nav className="hidden items-center gap-6 md:flex">
            {navItems.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
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
            ))}
          </nav>

          {/* Right controls */}
          <div className="ml-auto flex items-center gap-4">
            {/* Notification bell */}
            <button
              type="button"
              className="relative hidden items-center text-gray-400 transition-colors hover:text-gray-200 sm:flex"
              title="Notifications"
            >
              <Bell size={18} />
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-semibold text-white leading-none">
                0
              </span>
            </button>

            {/* User avatar + name */}
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-500 text-sm font-semibold text-[#0d0d1a]">
                D
              </span>
              <span className="hidden sm:inline">Default</span>
            </div>

            {/* Settings */}
            <NavLink
              to="/settings"
              title="Settings"
              className={({ isActive }) =>
                `transition-colors ${isActive ? 'text-blue-500' : 'text-gray-400 hover:text-gray-200'}`
              }
            >
              <Settings size={18} />
            </NavLink>

            {/* Discord placeholder — no lucide icon */}
            <a
              href="#"
              title="Discord"
              className="hidden text-gray-400 transition-colors hover:text-gray-200 lg:flex items-center"
            >
              <span className="text-[11px] font-bold leading-none tracking-tight">DC</span>
            </a>

            {/* GitHub */}
            <a
              href="#"
              title="GitHub"
              className="hidden text-gray-400 transition-colors hover:text-gray-200 lg:flex"
            >
              <GitFork size={18} />
            </a>

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              className="text-gray-400 transition-colors hover:text-gray-200"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="min-h-screen pt-14">
        <Outlet />
      </main>
    </div>
  );
}
