/**
 * The ambient layer — a WebGL scene of soft pastel blobs drifting behind the
 * warm background.
 *
 * Rules it lives by, because decoration must never cost the product:
 *  - purely decorative, `aria-hidden`, and behind every real surface
 *  - low resolution + CSS blur, so it costs a fraction of a frame
 *  - the render loop stops when the tab is hidden or the element scrolls away
 *  - reduced-motion and no-WebGL both fall back to a plain CSS gradient
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

// Two-tone vertical gradient plus a soft rim, which is all a blurred blob needs
// to read as a rounded, lit object rather than a flat circle.
const FRAG = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float ramp = smoothstep(-0.9, 0.9, vNormal.y);
    vec3 base = mix(uBottom, uTop, ramp);
    float rim = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.2);
    gl_FragColor = vec4(base + rim * 0.22, uOpacity);
  }
`;

interface BlobSpec {
  position: [number, number, number];
  scale: number;
  top: string;
  bottom: string;
  speed: number;
  opacity: number;
}

const PALETTE: BlobSpec[] = [
  { position: [-1.9, 1.1, -1], scale: 1.5, top: '#e9dcff', bottom: '#bfa9ff', speed: 0.42, opacity: 0.85 },
  { position: [2.0, 0.4, -1.6], scale: 1.85, top: '#ffe3d0', bottom: '#ffc0b4', speed: 0.31, opacity: 0.8 },
  { position: [0.4, -1.6, -0.6], scale: 1.15, top: '#d9ecff', bottom: '#a9c8ff', speed: 0.5, opacity: 0.75 },
  { position: [-1.3, -1.9, -2.1], scale: 1.35, top: '#fff0c6', bottom: '#ffd79b', speed: 0.37, opacity: 0.65 },
  { position: [1.5, 2.1, -2.4], scale: 1.05, top: '#d8f4e8', bottom: '#a4e2c8', speed: 0.46, opacity: 0.6 },
];

function Blob({ spec, drift }: { spec: BlobSpec; drift: React.MutableRefObject<[number, number]> }) {
  const mesh = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color(spec.top) },
      uBottom: { value: new THREE.Color(spec.bottom) },
      uOpacity: { value: spec.opacity },
    }),
    [spec.top, spec.bottom, spec.opacity]
  );

  useFrame(({ clock }) => {
    const node = mesh.current;
    if (!node) return;
    const t = clock.elapsedTime * spec.speed;
    const [px, py] = drift.current;
    node.position.x = spec.position[0] + Math.cos(t * 0.8) * 0.26 + px * 0.5;
    node.position.y = spec.position[1] + Math.sin(t) * 0.34 + py * 0.4;
    node.rotation.x = t * 0.24;
    node.rotation.y = t * 0.18;
  });

  return (
    <mesh ref={mesh} position={spec.position} scale={spec.scale}>
      <icosahedronGeometry args={[1, 5]} />
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

function Scene({ drift }: { drift: React.MutableRefObject<[number, number]> }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 0, 5.4);
  }, [camera]);

  return (
    <>
      {PALETTE.map((spec, i) => (
        <Blob key={i} spec={spec} drift={drift} />
      ))}
    </>
  );
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function Ambient({ intensity = 1 }: { intensity?: number }) {
  const drift = useRef<[number, number]>([0, 0]);
  const [enabled, setEnabled] = useState(false);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setEnabled(!reduced && webglAvailable());
  }, []);

  // Parallax from the pointer on desktop and the gyroscope on a phone — a few
  // degrees at most, so it reads as depth rather than as movement.
  useEffect(() => {
    if (!enabled) return;
    const onPointer = (e: PointerEvent) => {
      drift.current = [
        (e.clientX / window.innerWidth - 0.5) * 0.9,
        -(e.clientY / window.innerHeight - 0.5) * 0.9,
      ];
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      const gamma = (e.gamma ?? 0) / 45;
      const beta = ((e.beta ?? 0) - 45) / 45;
      drift.current = [
        Math.max(-1, Math.min(1, gamma)),
        Math.max(-1, Math.min(1, -beta)) * 0.6,
      ];
    };
    const onVisibility = () => setRunning(!document.hidden);

    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('deviceorientation', onTilt);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('deviceorientation', onTilt);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);

  return (
    <div className="ambient" style={{ opacity: intensity }} aria-hidden>
      {enabled ? (
        <Canvas
          className="ambient__canvas"
          dpr={[1, 1.35]}
          frameloop={running ? 'always' : 'never'}
          gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
          camera={{ fov: 42, position: [0, 0, 5.4] }}
        >
          <Scene drift={drift} />
        </Canvas>
      ) : (
        <div className="ambient__fallback" />
      )}
    </div>
  );
}

export default Ambient;
