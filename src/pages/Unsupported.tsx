import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, Home } from 'lucide-react';
import BrandMark from '../components/BrandMark';

export default function Unsupported() {
  const location = useLocation();
  const path = `${location.pathname}${location.search}`;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-3xl items-center justify-center px-4 py-10 sm:px-6">
      <section className="app-card w-full px-6 py-6 sm:px-8">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <h1 className="text-xl font-semibold text-white">Unsupported Route</h1>
            <p className="text-sm text-gray-500">DaCollector WebUI does not have a page for this address.</p>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-md border border-yellow-500/40 bg-yellow-950/20 px-4 py-3 text-yellow-200">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-yellow-100">No matching WebUI route</p>
            <p className="mt-1 break-all text-sm text-yellow-200/80">{path}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Link to="/dashboard" className="admin-warning-button">
            <Home size={14} />
            Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
