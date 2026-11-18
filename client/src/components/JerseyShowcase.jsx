import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Maximize2
} from 'lucide-react';
import { applyPlayerInfo, cloneJersey } from '../utils/jerseyPlayerInfo';
import hfplLogo from '../logo/HFPL logo-Photoroom.png';
// 160px copies of the original team logos (the originals are 0.7-2 MB each)
import ssLogo from '../team_logo/small/SS.png';
import rrLogo from '../team_logo/small/RR.png';
import mmgLogo from '../team_logo/small/MMG.png';
import kkrLogo from '../team_logo/small/KKR.png';

// ─── Official Team Configurations ────────────────────────────────────────────
export const TEAMS = [
  {
    id: 'sherle',
    code: 'SS',
    name: 'Sherle Sunrisers',
    captainFull: 'Shrirang Sherlekar',
    captainPrint: 'SHRI',
    model: '/models/hfpl_jersey_sherle.glb',
    logo: ssLogo,
    theme: {
      primary: '#f2661e',
      secondary: '#141010',
      accentGlow: 'rgba(242, 102, 30, 0.18)',
      pillBg: 'rgba(242, 102, 30, 0.12)',
      border: 'rgba(242, 102, 30, 0.45)'
    }
  },
  {
    id: 'ratnagiri',
    code: 'RR',
    name: 'Ratnagiri Royals',
    captainFull: 'Sagar Chavan',
    captainPrint: 'SAGAR',
    model: '/models/hfpl_jersey_ratnagiri.glb',
    logo: rrLogo,
    theme: {
      primary: '#e8227a',
      secondary: '#1c1a46',
      accentGlow: 'rgba(232, 34, 122, 0.18)',
      pillBg: 'rgba(232, 34, 122, 0.12)',
      border: 'rgba(232, 34, 122, 0.45)'
    }
  },
  {
    id: 'malgund',
    code: 'MMG',
    name: 'Malgund Maha Giants',
    captainFull: 'Rajesh Pawar',
    captainPrint: 'RAJESH',
    model: '/models/hfpl_jersey_malgund.glb',
    logo: mmgLogo,
    theme: {
      primary: '#f07a30',
      secondary: '#1b2070',
      accentGlow: 'rgba(240, 122, 48, 0.18)',
      pillBg: 'rgba(240, 122, 48, 0.12)',
      border: 'rgba(240, 122, 48, 0.45)'
    }
  },
  {
    id: 'kotwade',
    code: 'KKR',
    name: 'Kotwade Knight Riders',
    captainFull: 'Vijay Bhosale',
    captainPrint: 'VIJAY',
    model: '/models/hfpl_jersey_kotwade.glb',
    logo: kkrLogo,
    theme: {
      primary: '#e2b043',
      secondary: '#4a1468',
      accentGlow: 'rgba(226, 176, 67, 0.18)',
      pillBg: 'rgba(226, 176, 67, 0.12)',
      border: 'rgba(226, 176, 67, 0.45)'
    }
  }
];

// Preload all 4 team models
TEAMS.forEach((t) => useGLTF.preload(t.model));

// ─── 3D Jersey Model Component ───────────────────────────────────────────────
function JerseyModel({ team, isRotating, targetAngleRef, onReady }) {
  const { scene } = useGLTF(team.model);
  const jersey = useMemo(() => cloneJersey(scene), [scene]);
  const groupRef = useRef();
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    if (!jersey) return;

    jersey.traverse((child) => {
      // Strictly hide player number mesh
      if (child.name === 'PlayerNumber') {
        child.visible = false;
      }
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          if (child.material.map) {
            child.material.map.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
            gl.initTexture(child.material.map);        // upload now, not on first visible frame
          }
          child.material.needsUpdate = true;
        }
      }
    });

    // Apply ONLY official Captain name on the back; number cleared
    let alive = true;
    Promise.resolve(applyPlayerInfo(jersey, { name: team.captainPrint, number: '' }))
      .catch(() => {})
      .finally(() => { if (alive) onReady?.(team.id); });
    return () => { alive = false; };
  }, [jersey, team, gl, onReady]);

  // Continuous smooth rotation with seamless preset angle support
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const g = groupRef.current;

    if (targetAngleRef.current !== null) {
      let diff = targetAngleRef.current - g.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      if (Math.abs(diff) < 0.02) {
        g.rotation.y = targetAngleRef.current;
        targetAngleRef.current = null;
      } else {
        g.rotation.y += diff * Math.min(1, delta * 6.0);
      }
    } else if (isRotating) {
      // Continuous natural 360-degree rotation (15 deg/sec)
      g.rotation.y += THREE.MathUtils.degToRad(15) * delta;
      if (g.rotation.y > Math.PI * 2) {
        g.rotation.y -= Math.PI * 2;
      }
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.02, 0]}>
      <primitive object={jersey} />
    </group>
  );
}

// ─── Smooth Responsive Camera Controller ─────────────────────────────────────
// Moves the camera only after a preset request and stops once it arrives, so it never fights
// OrbitControls (which previously caused the jersey to drift partly out of frame).
const LOOK_Y = -0.005;          // vertical centre of the jersey
function CameraController({ activePreset, request, controlsRef }) {
  const { camera, size } = useThree();
  const goal = useRef(null);

  useEffect(() => {
    const isNarrow = size.width < 768;
    const collar = activePreset === 'collar';
    goal.current = {
      dist: collar ? (isNarrow ? 1.35 : 1.15) : (isNarrow ? 2.15 : 1.78),
      y: collar ? 0.16 : 0.03,
      lookY: collar ? 0.14 : LOOK_Y,
    };
  }, [activePreset, request, size.width]);

  useFrame((_, delta) => {
    const c = controlsRef.current;
    if (!goal.current || !c) return;
    const k = Math.min(1, delta * 4.0);
    c.target.y = THREE.MathUtils.lerp(c.target.y, goal.current.lookY, k);
    const off = camera.position.clone().sub(c.target);
    const horiz = Math.hypot(off.x, off.z) || 1;
    const dist = THREE.MathUtils.lerp(off.length(), goal.current.dist, k);
    const y = THREE.MathUtils.lerp(off.y, goal.current.y - goal.current.lookY, k);
    const h = Math.sqrt(Math.max(dist * dist - y * y, 0.01));
    // keep the user's orbit azimuth but return to a level, front-on framing
    const ax = THREE.MathUtils.lerp(off.x / horiz, 0, k), az = THREE.MathUtils.lerp(off.z / horiz, 1, k);
    const n = Math.hypot(ax, az) || 1;
    camera.position.set(c.target.x + (ax / n) * h, c.target.y + y, c.target.z + (az / n) * h);
    c.update();
    if (Math.abs(off.length() - goal.current.dist) < 0.004 && Math.abs(off.x) < 0.004 &&
        Math.abs(c.target.y - goal.current.lookY) < 0.002) goal.current = null;
  });

  // a user drag cancels any running camera move
  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return undefined;
    const stop = () => { goal.current = null; };
    c.addEventListener('start', stop);
    return () => c.removeEventListener('start', stop);
  });

  return null;
}

// ─── Local studio environment (no network HDR download) ──────────────────────
function StudioEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.6;
    return () => { scene.environment = null; env.dispose(); pmrem.dispose(); };
  }, [gl, scene]);
  return null;
}

// ─── Main Showcase Page Component ────────────────────────────────────────────
export default function JerseyShowcase({ onBack }) {
  const [activeTeamIndex, setActiveTeamIndex] = useState(0);
  const [activePreset, setActivePreset] = useState('hero');
  const [isRotating, setIsRotating] = useState(true);
  const orbitRef = useRef();
  const targetAngleRef = useRef(null);
  const [readyTeam, setReadyTeam] = useState(null);
  const [camRequest, setCamRequest] = useState(0);
  const handleReady = React.useCallback((id) => setReadyTeam(id), []);

  const team = TEAMS[activeTeamIndex];

  // Camera presets
  const handleSelectPreset = (presetKey) => {
    setActivePreset(presetKey);

    const angleMap = {
      front: 0,
      hero: Math.PI * 0.18,
      side: Math.PI * 0.50,
      back: Math.PI,
      collar: 0
    };

    targetAngleRef.current = angleMap[presetKey] ?? 0;
    setCamRequest((n) => n + 1);
  };

  // Toggle Spin button (Pause / Resume)
  const toggleAutoSpin = () => {
    setIsRotating((prev) => !prev);
    targetAngleRef.current = null;
  };

  // Switch team without pausing continuous rotation
  const handleSelectTeam = (idx) => {
    setActiveTeamIndex(idx);
    targetAngleRef.current = null;
  };

  return (
    <div className="relative h-screen w-screen bg-[#07080a] text-white font-sans overflow-hidden select-none flex flex-col justify-between">
      {/* Dynamic Team Ambient Radial Glow behind the centered jersey */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-1000 ease-out"
        style={{
          background: `radial-gradient(circle 50% at 50% 50%, ${team.theme.accentGlow} 0%, transparent 70%),
                       radial-gradient(circle 35% at 50% 45%, ${team.theme.pillBg} 0%, transparent 60%)`
        }}
      />

      {/* Top Header Navigation */}
      <header className="relative z-20 flex items-center justify-between px-6 sm:px-10 py-3.5 border-b border-white/[0.06] backdrop-blur-md bg-[#07080a]/75 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] text-xs font-medium text-zinc-300 hover:text-white transition group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition" />
            <span>Auction Hub</span>
          </button>

          <div className="h-4 w-px bg-white/10 hidden sm:block" />

          <div className="flex items-center gap-2.5">
            <img src={hfplLogo} alt="HFPL" className="h-6 w-auto object-contain" />
            <span className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase hidden sm:inline">
              Official 3D Kit Showcase
            </span>
          </div>
        </div>

        {/* View Angle Presets & Continuous 360° Spin Toggle */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center p-1 rounded-full bg-white/[0.04] border border-white/[0.07]">
            {[
              { id: 'front', label: 'Front' },
              { id: 'hero',  label: '3/4 Angle' },
              { id: 'side',  label: 'Side' },
              { id: 'back',  label: 'Back (Captain)' },
              { id: 'collar',label: 'Collar Detail' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelectPreset(p.id)}
                className={`px-3 py-1 text-[11px] font-medium rounded-full transition ${
                  activePreset === p.id
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={toggleAutoSpin}
            title={isRotating ? 'Pause continuous rotation' : 'Resume continuous rotation'}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-[11px] font-medium transition ${
              isRotating
                ? 'bg-white/[0.12] border-white/20 text-white shadow-sm'
                : 'bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:text-white'
            }`}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} style={{ animationDuration: '9s' }} />
            <span>{isRotating ? '360° Spin' : 'Spin Paused'}</span>
          </button>
        </div>
      </header>

      {/* Main Showcase Viewport: 100% Width & Height, Centered 3D Focus */}
      <main className="relative z-10 flex-1 w-full h-full flex items-center justify-center overflow-hidden">
        {/* Floating Elegant Top-Left Team & Captain Identity HUD (Non-intrusive) */}
        <div className="absolute top-5 left-6 sm:left-10 z-20 pointer-events-none max-w-sm sm:max-w-md">
          {/* Edition Pill */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: team.theme.primary }}
            />
            <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-400">
              HFPL 2027 Official Kit
            </span>
          </div>

          {/* Team Crest & Name */}
          <div className="flex items-center gap-3.5 mb-2">
            <img
              src={team.logo}
              alt={team.name}
              className="h-10 sm:h-14 w-auto object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.6)]"
            />
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white drop-shadow-md">
              {team.name}
            </h1>
          </div>

          {/* Prominently Highlighted Captain Name ONLY */}
          <div className="flex flex-col mt-1 pl-0.5">
            <span className="text-[10px] uppercase tracking-[0.22em] text-zinc-400 font-semibold mb-0.5">
              Team Captain
            </span>
            <div className="flex items-baseline gap-2.5">
              <span
                className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight drop-shadow-sm"
                style={{ color: team.theme.primary }}
              >
                {team.captainFull}
              </span>
              <span className="text-xs sm:text-sm font-bold text-zinc-400 tracking-wider uppercase bg-white/[0.06] px-2 py-0.5 rounded border border-white/10">
                {team.captainPrint}
              </span>
            </div>
          </div>
        </div>

        {/* 3D Canvas Viewport: Exactly Centered, Occupies Full Available Area */}
        <div className="w-full h-full absolute inset-0 cursor-grab active:cursor-grabbing">
          <Canvas
            shadows
            dpr={[1, 1.75]}
            camera={{ position: [0, 0.03, 1.78], fov: 28 }}
            gl={{
              antialias: true,
              powerPreference: 'high-performance',
              // Neutral keeps the kit colours true to the reference sheets (ACES washed out pinks/oranges)
              toneMapping: THREE.NeutralToneMapping,
              toneMappingExposure: 1.0
            }}
          >
            <StudioEnvironment />
            <Suspense fallback={null}>
              <JerseyModel
                key={team.id}
                team={team}
                isRotating={isRotating}
                targetAngleRef={targetAngleRef}
                onReady={handleReady}
              />
            </Suspense>

            {/* Studio Three-Point Lighting */}
            <ambientLight intensity={0.25} />
            <directionalLight
              position={[2.0, 2.5, 2.8]}
              intensity={1.5}
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
              shadow-normalBias={0.01}
              shadow-camera-near={0.5}
              shadow-camera-far={6}
              shadow-bias={-0.0002}
            />
            <directionalLight position={[-2.2, 1.8, -1.8]} intensity={0.9} color="#ffffff" />
            <directionalLight position={[0, 2.8, -2.5]} intensity={0.5} color="#ffffff" />
            <directionalLight position={[-1.5, -0.2, 2.0]} intensity={0.25} color="#eef4ff" />

            {/* Responsive Camera Rig */}
            <CameraController activePreset={activePreset} request={camRequest} controlsRef={orbitRef} />

            {/* Interactive OrbitControls */}
            <OrbitControls
              ref={orbitRef}
              enablePan={false}
              enableDamping={true}
              dampingFactor={0.06}
              target={[0, LOOK_Y, 0]}
              minDistance={1.05}
              maxDistance={2.8}
              minPolarAngle={Math.PI / 2 - 0.28}
              maxPolarAngle={Math.PI / 2 + 0.22}
            />

            {/* Realistic Ground Soft Contact Shadow */}
            <ContactShadows
              position={[0, -0.42, 0]}
              opacity={0.45}
              scale={1.8}
              blur={1.8}
              far={1.2}
              resolution={256}
              color="#000000"
            />
          </Canvas>
        </div>

        {/* Loading indicator: shown until the selected kit is fully loaded and prepared */}
        {readyTeam !== team.id && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none" role="status" aria-live="polite">
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-black/70 border border-white/10 backdrop-blur-md">
              <span className="w-4 h-4 rounded-full border-2 border-white/20 animate-spin" style={{ borderTopColor: team.theme.primary }} />
              <span className="text-xs font-semibold tracking-wide text-zinc-200">Loading {team.name} kit…</span>
            </div>
          </div>
        )}

        {/* Drag Hint at Bottom Center */}
        <div className="absolute bottom-3 pointer-events-none text-[10px] text-zinc-400 tracking-widest uppercase flex items-center gap-1.5 z-20">
          <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
          <span>Drag to orbit 360° • Scroll to zoom</span>
        </div>
      </main>

      {/* Bottom Floating Team Switcher Bar */}
      <footer className="relative z-20 px-6 sm:px-10 py-3.5 border-t border-white/[0.06] backdrop-blur-md bg-[#07080a]/85 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">
            Select Team Kit:
          </span>
        </div>

        {/* 4 Team Selector Buttons */}
        <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {TEAMS.map((t, idx) => {
            const isActive = idx === activeTeamIndex;
            return (
              <button
                key={t.id}
                onClick={() => handleSelectTeam(idx)}
                className={`flex items-center gap-2.5 px-4 py-2 rounded-xl transition-all duration-200 border ${
                  isActive
                    ? 'bg-white/[0.12] text-white shadow-lg'
                    : 'bg-white/[0.03] hover:bg-white/[0.07] text-zinc-400 hover:text-zinc-200'
                }`}
                style={{
                  borderColor: isActive ? t.theme.primary : 'rgba(255, 255, 255, 0.08)'
                }}
              >
                <img
                  src={t.logo}
                  alt={t.name}
                  className="h-5 w-auto object-contain shrink-0"
                />
                <div className="text-left">
                  <span className="block text-xs font-semibold leading-tight">
                    {t.code}
                  </span>
                  <span className="block text-[9px] text-zinc-400 leading-tight">
                    {t.captainPrint}
                  </span>
                </div>
                {isActive && (
                  <span
                    className="w-1.5 h-1.5 rounded-full ml-auto"
                    style={{ backgroundColor: t.theme.primary }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </footer>
    </div>
  );
}
