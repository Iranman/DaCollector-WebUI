import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearApiKey } from '../api/client';

export default function Layout() {
  const navigate = useNavigate();

  function handleLogout() {
    clearApiKey();
    navigate('/login');
  }

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: '▦' },
    { to: '/collections', label: 'Collection', icon: '▧' },
    { to: '/utilities', label: 'Utilities', icon: '⚒' },
    { to: '/log', label: 'Log', icon: '▤' },
    { to: '/actions', label: 'Actions', icon: '☷' },
  ];

  return (
    <div className="min-h-screen text-gray-100">
      <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-gray-700/50 bg-[#0d0d1a]/90 backdrop-blur-sm">
        <div className="flex h-full items-center px-6">
          <NavLink to="/dashboard" className="flex min-w-0 items-center gap-3 pr-10">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-500 text-sm font-semibold text-white">D</span>
            <span className="truncate text-lg font-semibold tracking-wide text-white">DaCollector</span>
          </NavLink>

          <nav className="hidden items-center gap-6 md:flex">
            {navItems.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 text-sm font-medium transition-colors ${
                    isActive ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                  }`
                }
              >
                <span className="text-lg leading-none text-current">{icon}</span>
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <div className="hidden items-center gap-2 text-sm text-gray-400 sm:flex">
              <span className="text-lg leading-none">▤</span>
              <span className="font-semibold text-emerald-400">0</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-500 text-sm font-semibold text-[#0d0d1a]">D</span>
              <span className="hidden sm:inline">Default</span>
            </div>
            <NavLink
              to="/settings"
              title="Settings"
              className={({ isActive }) =>
                `text-xl leading-none transition-colors ${
                  isActive ? 'text-blue-500' : 'text-gray-400 hover:text-gray-200'
                }`
              }
            >
              ⚙
            </NavLink>
            <a href="#" title="Discord" className="hidden text-lg leading-none text-gray-400 transition-colors hover:text-gray-200 lg:inline">
              ◉
            </a>
            <a href="#" title="GitHub" className="hidden text-lg leading-none text-gray-400 transition-colors hover:text-gray-200 lg:inline">
              ◌
            </a>
            <button type="button" onClick={handleLogout} title="Logout" className="text-xl leading-none text-gray-400 transition-colors hover:text-gray-200">
              ↪
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
