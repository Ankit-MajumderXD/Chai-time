import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SpacetimeDBProvider } from 'spacetimedb/react';
import { Identity } from 'spacetimedb';
import App from './App';
import { DbConnection, type ErrorContext } from './module_bindings';
import { loadToken, saveToken } from './lib/auth';
import { connLog } from './lib/log';
import { ErrorBoundary } from './components/ErrorBoundary';

const HOST = import.meta.env.VITE_SPACETIMEDB_HOST ?? 'ws://127.0.0.1:3000';
const DB_NAME = import.meta.env.VITE_SPACETIMEDB_DB_NAME ?? 'chai-time';

/* The token in localStorage is the whole account. Keeping it means a returning
   visitor — or a plain page refresh — is already themselves, no login screen,
   ever. See lib/auth.ts. */
const onConnect = (conn: DbConnection, identity: Identity, token: string) => {
  saveToken(token);
  connLog('connected', {
    identity: identity.toHexString().slice(0, 12),
    connection: conn.connectionId?.toHexString().slice(0, 12),
    db: DB_NAME,
  });
};

const onDisconnect = () => connLog('disconnected');

const onConnectError = (_ctx: ErrorContext, err: Error) => {
  connLog('connect-error', { message: err.message });
};

const rootEl = document.getElementById('root');

/** A dependency-free bail-out for failures that happen before React can render
    (a bad build chunk, a throw while building the connection). */
function fatal(message: string) {
  if (!rootEl) return;
  rootEl.innerHTML = `
    <div style="min-height:100dvh;display:grid;place-items:center;padding:24px;
      font:500 15px/1.5 system-ui,sans-serif;color:#16141a;background:#faf8f5;text-align:center">
      <div style="max-width:22rem">
        <div style="font-size:2.2rem">🫖</div>
        <h1 style="font:800 1.15rem/1.3 system-ui;margin:12px 0 6px">Couldn't start</h1>
        <p style="color:#6c6774;margin:0 0 16px">A refresh usually fixes this.</p>
        <button onclick="location.reload()" style="padding:10px 18px;border:0;border-radius:999px;
          background:#6c5ce7;color:#fff;font-weight:700">Reload</button>
        <pre style="margin-top:14px;font:500 11px/1.4 ui-monospace,monospace;color:#9d98a5;
          white-space:pre-wrap;opacity:.7">${message.replace(/[<>&]/g, '')}</pre>
      </div>
    </div>`;
}

try {
  const resumed = !!loadToken();
  connLog('connecting', { host: HOST, db: DB_NAME, resumed });

  const connectionBuilder = DbConnection.builder()
    .withUri(HOST)
    .withDatabaseName(DB_NAME)
    .withToken(loadToken())
    .onConnect(onConnect)
    .onDisconnect(onDisconnect)
    .onConnectError(onConnectError);

  createRoot(rootEl!).render(
    <StrictMode>
      <ErrorBoundary>
        <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
          <App />
        </SpacetimeDBProvider>
      </ErrorBoundary>
    </StrictMode>
  );
} catch (err) {
  console.error('[chai-time] fatal on boot', err);
  fatal(err instanceof Error ? err.message : String(err));
}

// A chunk that fails to load after a redeploy leaves a blank page with only a
// console error — turn that into something the user can act on.
window.addEventListener('error', (e) => {
  if (/Loading (chunk|module)|dynamically imported module|module script failed/i.test(e.message)) {
    fatal('A newer version is available. Reload to get it.');
  }
});
window.addEventListener('unhandledrejection', (e) => {
  const m = String((e.reason && e.reason.message) || e.reason || '');
  if (/dynamically imported module|Failed to fetch dynamically|module script failed/i.test(m)) {
    fatal('A newer version is available. Reload to get it.');
  }
});
