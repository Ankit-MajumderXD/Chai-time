/**
 * Three.js is ~600KB of the bundle and it draws decoration, so it must never be
 * on the critical path. This loads the WebGL layer after first paint and shows
 * the CSS gradient in the meantime — the screen looks finished either way.
 */
import { Suspense, lazy } from 'react';

const AmbientCanvas = lazy(() => import('./Ambient'));

export function Ambient({ intensity = 1 }: { intensity?: number }) {
  return (
    <Suspense
      fallback={
        <div className="ambient" style={{ opacity: intensity }} aria-hidden>
          <div className="ambient__fallback" />
        </div>
      }
    >
      <AmbientCanvas intensity={intensity} />
    </Suspense>
  );
}
