import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Clipboard, Home, RefreshCw } from 'lucide-react';
import BrandMark from './BrandMark';

interface AppErrorBoundaryProps {
  children: ReactNode;
  resetKey: string;
}

interface AppErrorBoundaryState {
  copied: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    copied: false,
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    console.error('DaCollector WebUI route failed to render.', error, errorInfo);
  }

  componentDidUpdate(previousProps: AppErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ copied: false, error: null, errorInfo: null });
    }
  }

  private buildDetails() {
    const { error, errorInfo } = this.state;
    return [
      error ? `${error.name}: ${error.message}` : 'Unknown render error',
      error?.stack,
      errorInfo?.componentStack,
    ].filter(Boolean).join('\n\n');
  }

  private copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(this.buildDetails());
      this.setState({ copied: true });
    } catch {
      this.setState({ copied: false });
    }
  };

  private goHome = () => {
    const basePath = (import.meta.env.BASE_URL || '/webui/').replace(/\/$/, '');
    window.location.assign(`${basePath}/dashboard`);
  };

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const details = this.buildDetails();

    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10 text-gray-100">
        <section className="app-card w-full max-w-2xl px-6 py-6 sm:px-8">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <h1 className="text-xl font-semibold text-white">DaCollector WebUI</h1>
              <p className="text-sm text-gray-500">Route render failed</p>
            </div>
          </div>

          <div className="mt-6 flex items-start gap-3 rounded-md border border-red-500/40 bg-red-950/20 px-4 py-3 text-red-200">
            <AlertTriangle size={20} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-100">This page could not be displayed.</p>
              <p className="mt-1 text-sm text-red-200/80">
                Reload the page, return to Dashboard, or copy the diagnostic details for troubleshooting.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={this.copyDetails} className="admin-secondary-button">
              <Clipboard size={14} />
              {this.state.copied ? 'Copied' : 'Copy Details'}
            </button>
            <button type="button" onClick={this.reload} className="admin-secondary-button">
              <RefreshCw size={14} />
              Reload
            </button>
            <button type="button" onClick={this.goHome} className="admin-warning-button">
              <Home size={14} />
              Dashboard
            </button>
          </div>

          <details className="mt-6 rounded-md border border-gray-700/50 bg-black/40 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-gray-300">Diagnostic details</summary>
            <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-500">
              {details}
            </pre>
          </details>
        </section>
      </main>
    );
  }
}
