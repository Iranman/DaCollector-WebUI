import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearApiKey } from '../api/client';

export default function Layout() {
  const navigate = useNavigate();

  function handleLogout() {
    clearApiKey();
    navigate('/setup');
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      <aside className="w-56 shrink-0 flex flex-col bg-gray-900 border-r border-gray-800">
        <div className="px-6 py-5 border-b border-gray-800">
          <span className="text-lg font-bold tracking-wide text-indigo-400">DaCollector</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {[
            { to: '/dashboard', label: 'Dashboard' },
            { to: '/collections', label: 'Collections' },
            { to: '/settings', label: 'Settings' },
          ].map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 rounded-md text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-gray-100 text-left transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
