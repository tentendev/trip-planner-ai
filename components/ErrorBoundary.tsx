import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level crash guard. Without this, any uncaught render error white-screens
 * the app with no way back in — persisted state can keep re-crashing it.
 * The "reset" action clears localStorage so a corrupt payload can't brick the app.
 */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] crashed:', error, info.componentStack);
  }

  handleReset = () => {
    try {
      localStorage.removeItem('trip_os_v1_state');
      localStorage.removeItem('trip_os_shared_plans');
    } catch {
      // storage unavailable — reload still recovers the render tree
    }
    window.location.href = '/';
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const lang = document.documentElement.lang || 'en';
      const zh = lang.startsWith('zh');
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 flex items-center justify-center text-2xl">
              ⚠️
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              {zh ? '發生未預期的錯誤' : 'Something went wrong'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
              {zh
                ? '應用程式遇到錯誤。你可以重新載入，或清除本機資料後重新開始（不會影響雲端分享的行程）。'
                : 'The app hit an unexpected error. You can reload, or clear local data and start fresh (shared itineraries in the cloud are not affected).'}
            </p>
            {this.state.error && (
              <pre className="text-left text-[11px] font-mono text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-lg p-3 mb-6 overflow-x-auto max-h-24">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
              >
                {zh ? '重新載入' : 'Reload'}
              </button>
              <button
                onClick={this.handleReset}
                className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                {zh ? '清除資料並重設' : 'Reset local data'}
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
