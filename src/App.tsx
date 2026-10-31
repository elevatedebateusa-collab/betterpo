import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ChamberLanding } from './pages/ChamberLanding';
import { PODashboard } from './pages/PODashboard';
import { SpectatorBoard } from './pages/SpectatorBoard';
import { AdminMetricsView } from './pages/AdminMetricsView';

// -------------------------------------------------------------
// Lightweight Error Boundary to catch component render errors
// -------------------------------------------------------------
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Elevate Chamber] Unhandled runtime render error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-amber-500/30">
          <div className="max-w-xl w-full bg-slate-900 border border-rose-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h1 className="text-base font-bold text-white">Chamber Render Exception</h1>
                <p className="text-xs text-rose-300">A runtime error occurred in this view</p>
              </div>
            </div>

            <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 font-mono text-xs text-rose-300 overflow-x-auto whitespace-pre-wrap max-h-40">
              {this.state.error?.message || 'Unknown runtime error'}
            </div>

            {this.state.errorInfo?.componentStack && (
              <details className="text-xs text-slate-400">
                <summary className="cursor-pointer text-slate-300 font-semibold mb-1">
                  View Component Trace
                </summary>
                <pre className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[10px] text-slate-400 overflow-x-auto font-mono max-h-36">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={this.handleGoHome}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors"
              >
                Return to Chamber Home
              </button>
              <button
                onClick={this.handleReload}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors"
              >
                Reload Chamber
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// -------------------------------------------------------------
// Root Application Routing
// -------------------------------------------------------------
export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Landing, Role Select, Creation & Join */}
          <Route path="/" element={<ChamberLanding />} />
          <Route path="/index.html" element={<Navigate to="/" replace />} />

          {/* PO Controller View */}
          <Route path="/room/:code/po" element={<PODashboard />} />

          {/* Spectator / Competitor Live View */}
          <Route path="/room/:code" element={<SpectatorBoard />} />

          {/* Secure Administrative Metrics & Telemetry Dashboard */}
          <Route path="/admin/metrics" element={<AdminMetricsView />} />

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
