/**
 * Last line of defence.
 *
 * Anything that throws while rendering lands here instead of a blank white
 * page: the user gets a way back (reload) and an escape hatch (start fresh,
 * which drops the stored session). Also catches unhandled promise rejections
 * and stale-module errors after a dev-server restart, both of which otherwise
 * leave the screen empty with nothing to click.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { clearToken } from '../lib/auth';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidMount() {
    window.addEventListener('unhandledrejection', this.onRejection);
    window.addEventListener('error', this.onError);
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.onRejection);
    window.removeEventListener('error', this.onError);
  }

  onRejection = (e: PromiseRejectionEvent) => {
    const msg = String(e.reason?.message ?? e.reason ?? '');
    // A chunk that 404s after a rebuild — the only fix is a full reload.
    if (/dynamically imported module|Failed to fetch|Importing a module script failed/i.test(msg)) {
      this.setState({ error: new Error(msg) });
    }
  };

  onError = (e: ErrorEvent) => {
    if (/Loading chunk|module script failed/i.test(e.message)) {
      this.setState({ error: new Error(e.message) });
    }
  };

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[chai-time] render error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="crash">
        <div className="crash__card">
          <span className="crash__mark">🫖</span>
          <h1 className="crash__title">That didn't load right</h1>
          <p className="crash__body">
            A refresh usually sorts it. If it keeps happening, start fresh — you'll
            pick a name again but your rooms are safe on the server.
          </p>
          <div className="crash__actions">
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--block"
              onClick={() => {
                clearToken();
                window.location.href = '/';
              }}
            >
              Start fresh
            </button>
          </div>
          <pre className="crash__detail">{this.state.error.message}</pre>
        </div>
      </div>
    );
  }
}
