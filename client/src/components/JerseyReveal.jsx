import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  RotateCcw,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  ChevronDown
} from 'lucide-react';
import { applyPlayerInfo, cloneJersey } from '../hfpl_jersey_package/jerseyPlayerInfo';
import hfplLogo from '../logo/HFPL logo-Photoroom.png';
import iplSongUrl from 'virtual:ipl-song';

// ─── Players ──────────────────────────────────────────────────────────────────
const OFFICIAL_PLAYERS = [
  { name: 'SHRI', number: 21, role: 'Captain & All-rounder', team: 'Sherle Sunrisers' },
  { name: 'HFPL', number: 27, role: 'Official Match Kit',    team: 'Family Premier League' }
];

// ─── Easing ───────────────────────────────────────────────────────────────────
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeInOutCubic = (t) => { t = clamp01(t); return t < 0.5 ? 4*t*t*t : 1 - (-2*t+2)**3/2; };
const easeOutQuart   = (t) => { t = clamp01(t); return 1 - (1-t)**4; };
const easeInOutSine  = (t) => { t = clamp01(t); return -(Math.cos(Math.PI*t) - 1) / 2; };
const easeOutCubic   = (t) => { t = clamp01(t); return 1 - (1-t)**3; };

// ─── Sequence Timings ─────────────────────────────────────────────────────────
//
//  Phase 1 — Entrance     0.0 → 2.5s   Jersey rises and settles into frame
//  Phase 2 — Front view   2.5 → 5.5s   Camera eases in to show front detail (crest, collar)
//  Phase 3 — Wide front   5.5 → 7.0s   Camera pulls back to full-jersey wide
//  Phase 4 — Rotate back  7.0 → 9.0s   Smooth 180° rotation to back
//  Phase 5 — Back view    9.0 → 12.0s  Camera eases in to show back detail (name + number)
//  Phase 6 — Return       12.0→ 14.0s  Camera pulls back, jersey finishes 360° to front
//  Phase 7 — Idle         14.0s +      Gentle continuous spin, camera rests at default
//
const T = {
  ENTRANCE_END:   2.5,
  CLOSE_FRONT:    5.5,
  WIDE_FRONT:     7.0,
  ROTATE_BACK:    9.0,
  CLOSE_BACK:    12.0,
  RETURN_END:    14.0,
};

// Camera keyframe data — [x, y, z, lookAtY]
const CAM = {
  DEFAULT:     [0,  0.05, 2.18, 0.0],   // Standard full-jersey view
  ENTRANCE:    [0, -0.10, 2.80, 0.0],   // Start a little further back and low
  CLOSE_FRONT: [0.05, 0.32, 1.52, 0.15], // Close on front — crest + collar level
  CLOSE_BACK:  [-0.05, 0.25, 1.55, 0.12], // Close on back — name + number level
};

const IDLE_RPM = THREE.MathUtils.degToRad(16); // 16°/s — natural, readable, not mechanical

// ─── Procedural Studio Environment ───────────────────────────────────────────
function StudioEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem  = new THREE.PMREMGenerator(gl);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    return () => { pmrem.dispose(); envTex.dispose(); };
  }, [gl, scene]);
  return null;
}

// ─── Camera Choreographer ────────────────────────────────────────────────────
// Drives camera through the intro keyframe sequence entirely in useFrame.
// After the intro, the camera rests at DEFAULT and the user can orbit freely.
// We manage orbit ourselves via a ref to avoid drei OrbitControls conflicts.

function CameraChoreographer({ seqRef }) {
  const { camera } = useThree();

  // Smoothly lerp camera toward a target [x,y,z] with a given alpha
  const lerpCam = (target, alpha) => {
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, target[0], alpha);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, target[1], alpha);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, target[2], alpha);
    const lookY = THREE.MathUtils.lerp(camera.position.y, target[3], 0.12);
    camera.lookAt(0, lookY, 0);
  };

  useFrame((_, delta) => {
    const t = seqRef.current.elapsed;

    if (t < T.ENTRANCE_END) {
      // Rise from entrance position to default
      const p = easeOutQuart(t / T.ENTRANCE_END);
      camera.position.x = THREE.MathUtils.lerp(CAM.ENTRANCE[0], CAM.DEFAULT[0], p);
      camera.position.y = THREE.MathUtils.lerp(CAM.ENTRANCE[1], CAM.DEFAULT[1], p);
      camera.position.z = THREE.MathUtils.lerp(CAM.ENTRANCE[2], CAM.DEFAULT[2], p);
      camera.lookAt(0, 0, 0);

    } else if (t < T.CLOSE_FRONT) {
      // Ease in to close-up of front
      const p = easeInOutCubic((t - T.ENTRANCE_END) / (T.CLOSE_FRONT - T.ENTRANCE_END));
      camera.position.x = THREE.MathUtils.lerp(CAM.DEFAULT[0], CAM.CLOSE_FRONT[0], p);
      camera.position.y = THREE.MathUtils.lerp(CAM.DEFAULT[1], CAM.CLOSE_FRONT[1], p);
      camera.position.z = THREE.MathUtils.lerp(CAM.DEFAULT[2], CAM.CLOSE_FRONT[2], p);
      const lookY = THREE.MathUtils.lerp(0, CAM.CLOSE_FRONT[3], p);
      camera.lookAt(0, lookY, 0);

    } else if (t < T.WIDE_FRONT) {
      // Pull back to wide
      const p = easeInOutCubic((t - T.CLOSE_FRONT) / (T.WIDE_FRONT - T.CLOSE_FRONT));
      camera.position.x = THREE.MathUtils.lerp(CAM.CLOSE_FRONT[0], CAM.DEFAULT[0], p);
      camera.position.y = THREE.MathUtils.lerp(CAM.CLOSE_FRONT[1], CAM.DEFAULT[1], p);
      camera.position.z = THREE.MathUtils.lerp(CAM.CLOSE_FRONT[2], CAM.DEFAULT[2], p);
      const lookY = THREE.MathUtils.lerp(CAM.CLOSE_FRONT[3], 0, p);
      camera.lookAt(0, lookY, 0);

    } else if (t < T.ROTATE_BACK) {
      // Hold at wide during rotation to back
      camera.position.set(CAM.DEFAULT[0], CAM.DEFAULT[1], CAM.DEFAULT[2]);
      camera.lookAt(0, 0, 0);

    } else if (t < T.CLOSE_BACK) {
      // Ease in to close-up of back (name + number)
      const p = easeInOutCubic((t - T.ROTATE_BACK) / (T.CLOSE_BACK - T.ROTATE_BACK));
      camera.position.x = THREE.MathUtils.lerp(CAM.DEFAULT[0], CAM.CLOSE_BACK[0], p);
      camera.position.y = THREE.MathUtils.lerp(CAM.DEFAULT[1], CAM.CLOSE_BACK[1], p);
      camera.position.z = THREE.MathUtils.lerp(CAM.DEFAULT[2], CAM.CLOSE_BACK[2], p);
      const lookY = THREE.MathUtils.lerp(0, CAM.CLOSE_BACK[3], p);
      camera.lookAt(0, lookY, 0);

    } else if (t < T.RETURN_END) {
      // Pull back to wide as jersey returns to front
      const p = easeInOutCubic((t - T.CLOSE_BACK) / (T.RETURN_END - T.CLOSE_BACK));
      camera.position.x = THREE.MathUtils.lerp(CAM.CLOSE_BACK[0], CAM.DEFAULT[0], p);
      camera.position.y = THREE.MathUtils.lerp(CAM.CLOSE_BACK[1], CAM.DEFAULT[1], p);
      camera.position.z = THREE.MathUtils.lerp(CAM.CLOSE_BACK[2], CAM.DEFAULT[2], p);
      const lookY = THREE.MathUtils.lerp(CAM.CLOSE_BACK[3], 0, p);
      camera.lookAt(0, lookY, 0);

    } else {
      // Idle — gently drift camera back to default if orbit happened
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, CAM.DEFAULT[0], delta * 0.4);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, CAM.DEFAULT[1], delta * 0.4);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, CAM.DEFAULT[2], delta * 0.4);
      camera.lookAt(0, 0, 0);
    }
  });

  return null;
}

// ─── Jersey 3D Mesh ────────────────────────────────────────────────────────────
function JerseyMesh({ player, seqRef, jerseyGroupRef }) {
  const { scene } = useGLTF('/models/hfpl_jersey.glb');
  const jersey    = useMemo(() => cloneJersey(scene), [scene]);
  const groupRef  = useRef();

  useEffect(() => {
    if (jerseyGroupRef) jerseyGroupRef.current = groupRef.current;
  }, [jerseyGroupRef]);

  useEffect(() => {
    if (jersey) {
      applyPlayerInfo(jersey, {
        name:   player.name   || 'SHRI',
        number: player.number !== undefined ? player.number : 21
      });
    }
  }, [jersey, player.name, player.number]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const g = groupRef.current;
    const t = seqRef.current.elapsed;
    const seq = seqRef.current;

    if (t < T.ENTRANCE_END) {
      // ── Rise from below into hero center ──
      const p = easeOutQuart(t / T.ENTRANCE_END);
      g.position.y   = THREE.MathUtils.lerp(-0.55, 0, p);
      g.scale.setScalar(THREE.MathUtils.lerp(0.88, 1.0, p));
      // Very subtle initial tilt that straightens out
      g.rotation.x   = THREE.MathUtils.lerp(0.05, 0, p);
      g.rotation.y   = seq.rotY;

    } else if (t < T.WIDE_FRONT) {
      // ── Front showcase — hold still ──
      g.position.y   = 0;
      g.scale.setScalar(1.0);
      g.rotation.x   = 0;
      g.rotation.y   = seq.rotY;

    } else if (t < T.ROTATE_BACK) {
      // ── Smooth 180° arc to back ──
      const p = easeInOutSine((t - T.WIDE_FRONT) / (T.ROTATE_BACK - T.WIDE_FRONT));
      seq.rotY       = THREE.MathUtils.lerp(0, Math.PI, p);
      g.position.set(0, 0, 0);
      g.scale.setScalar(1.0);
      g.rotation.x   = 0;
      g.rotation.y   = seq.rotY;

    } else if (t < T.CLOSE_BACK) {
      // ── Hold on back face ──
      seq.rotY       = Math.PI;
      g.rotation.set(0, Math.PI, 0);
      g.position.set(0, 0, 0);
      g.scale.setScalar(1.0);

    } else if (t < T.RETURN_END) {
      // ── Smooth 180° arc back to front (going the short way: π → 2π) ──
      const p = easeInOutSine((t - T.CLOSE_BACK) / (T.RETURN_END - T.CLOSE_BACK));
      seq.rotY       = THREE.MathUtils.lerp(Math.PI, Math.PI * 2, p);
      g.rotation.set(0, seq.rotY, 0);
      g.position.set(0, 0, 0);
      g.scale.setScalar(1.0);

    } else {
      // ── Idle: continuous gentle rotation ──
      if (seq.rotY > Math.PI * 2) seq.rotY -= Math.PI * 2;
      if (seq.playing) {
        seq.rotY += IDLE_RPM * delta;
      }
      // If user has requested a snap target, ease toward it smoothly
      if (seq.snapTarget !== null) {
        const remaining = Math.abs(seq.snapTarget - seq.rotY);
        if (remaining < 0.004) {
          seq.rotY       = seq.snapTarget;
          seq.snapTarget = null;
        } else {
          seq.rotY = THREE.MathUtils.lerp(seq.rotY, seq.snapTarget, delta * 5.5);
        }
      }
      g.rotation.set(0, seq.rotY, 0);
      g.position.set(0, 0, 0);
      g.scale.setScalar(1.0);
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.55, 0]} scale={0.88}>
      <primitive object={jersey} />
    </group>
  );
}

// ─── Studio Lighting ──────────────────────────────────────────────────────────
// Lights fade in during the entrance, then stay static — no wasted per-frame updates.

function StudioLighting({ seqRef }) {
  const spotRef  = useRef();
  const keyRef   = useRef();
  const rimLRef  = useRef();
  const rimRRef  = useRef();
  const doneRef  = useRef(false);

  useEffect(() => {
    const reset = () => { doneRef.current = false; };
    window.addEventListener('hfpl-jersey-replay', reset);
    reset();
    return () => window.removeEventListener('hfpl-jersey-replay', reset);
  }, []);

  useFrame(() => {
    if (doneRef.current) return;
    const t      = seqRef.current.elapsed;
    const factor = easeOutCubic(Math.min(t / T.ENTRANCE_END, 1));

    if (spotRef.current) spotRef.current.intensity = THREE.MathUtils.lerp(0,   1.7, factor);
    if (keyRef.current)  keyRef.current.intensity  = THREE.MathUtils.lerp(0.1, 1.0, factor);
    if (rimLRef.current) rimLRef.current.intensity = THREE.MathUtils.lerp(0,   1.2, factor);
    if (rimRRef.current) rimRRef.current.intensity = THREE.MathUtils.lerp(0,   0.85, factor);

    if (t >= T.ENTRANCE_END) doneRef.current = true;
  });

  return (
    <>
      <ambientLight intensity={0.42} />

      {/* Overhead softbox — primary key */}
      <spotLight
        ref={spotRef}
        position={[0, 3.2, 1.8]}
        angle={0.55}
        penumbra={0.85}
        intensity={1.7}
        color="#fff8f2"
      />

      {/* Front fill — slightly off-axis to bring out fabric texture */}
      <directionalLight
        ref={keyRef}
        position={[1.8, 2.2, 3.0]}
        intensity={1.0}
        color="#ffffff"
      />

      {/* Left warm rim — HFPL orange, separates the jersey from the dark bg */}
      <directionalLight
        ref={rimLRef}
        position={[-2.2, 1.0, -2.0]}
        intensity={1.2}
        color="#ff8c38"
      />

      {/* Right cool rim — adds subtle sheen to the right sleeve */}
      <directionalLight
        ref={rimRRef}
        position={[2.2, 1.0, -2.0]}
        intensity={0.85}
        color="#ddeeff"
      />

      {/* Natural floor shadow */}
      <ContactShadows
        position={[0, -0.62, 0]}
        opacity={0.45}
        scale={2.4}
        blur={3.0}
        far={1.3}
        color="#000000"
      />
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function JerseyReveal({ onBack }) {
  // URL param support: /jersey?name=SHRI&number=21
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialPlayer = useMemo(() => {
    const qName = searchParams.get('name');
    const qNum  = searchParams.get('number');
    if (qName || qNum) {
      const found = OFFICIAL_PLAYERS.find(
        p => p.name === (qName || '').toUpperCase()
      );
      if (found) return found;
      return {
        name:   (qName || 'SHRI').toUpperCase(),
        number: qNum !== null ? Number(qNum) : 21,
        role:   searchParams.get('role') || 'Player Edition',
        team:   searchParams.get('team') || 'HFPL 2027'
      };
    }
    return OFFICIAL_PLAYERS[0];
  }, [searchParams]);

  const [currentPlayer, setCurrentPlayer] = useState(initialPlayer);
  const [isRotating,    setIsRotating]    = useState(true);
  const [isFullscreen,  setIsFullscreen]  = useState(false);
  const [isMuted,       setIsMuted]       = useState(true);
  const [showMenu,      setShowMenu]      = useState(false);
  const [showBanner,    setShowBanner]    = useState(true);

  // seqRef is the single source of truth for animation state.
  // It lives outside React so Three.js components can read it in useFrame
  // without triggering any re-renders.
  const seqRef = useRef({
    elapsed:    0,       // seconds since last replay
    rotY:       0,       // jersey Y rotation in radians (continuous)
    playing:    true,    // idle rotation on/off
    snapTarget: null,    // target angle for animated snap (null = disabled)
  });

  const jerseyGroupRef = useRef(null);
  const audioRef       = useRef(null);
  const bannerTimerRef = useRef(null);

  // Keep seqRef.playing in sync with React state (sync is trivially cheap)
  useEffect(() => { seqRef.current.playing = isRotating; }, [isRotating]);

  // Audio
  useEffect(() => {
    if (iplSongUrl) {
      const a  = new Audio(iplSongUrl);
      a.loop   = true;
      a.volume = 0.38;
      audioRef.current = a;
    }
    return () => { audioRef.current?.pause(); };
  }, []);

  const toggleSound = () => {
    if (!audioRef.current) return;
    if (isMuted) { audioRef.current.play().catch(() => {}); setIsMuted(false); }
    else         { audioRef.current.pause();                setIsMuted(true);  }
  };

  // Start / Replay sequence
  const startSequence = () => {
    seqRef.current.elapsed    = 0;
    seqRef.current.rotY       = 0;
    seqRef.current.playing    = false;
    seqRef.current.snapTarget = null;
    window.dispatchEvent(new CustomEvent('hfpl-jersey-replay'));
    setIsRotating(false);
    setShowBanner(true);

    clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => {
      setShowBanner(false);
      setIsRotating(true);
      seqRef.current.playing = true;
    }, (T.RETURN_END + 0.4) * 1000);
  };

  // Advance elapsed time each animation frame (outside Three.js canvas)
  // We use a simple rAF loop so the seqRef clock runs even before Suspense resolves.
  const rafRef = useRef(null);
  const lastTsRef = useRef(null);

  useEffect(() => {
    const tick = (ts) => {
      if (lastTsRef.current !== null) {
        const delta = (ts - lastTsRef.current) / 1000;
        if (seqRef.current.elapsed < T.RETURN_END + 60) {
          seqRef.current.elapsed += delta;
        }
      }
      lastTsRef.current = ts;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(bannerTimerRef.current);
    };
  }, []);

  // Auto-hide banner on first load
  useEffect(() => {
    bannerTimerRef.current = setTimeout(() => {
      setShowBanner(false);
      setIsRotating(true);
      seqRef.current.playing = true;
    }, (T.RETURN_END + 0.4) * 1000);
    return () => clearTimeout(bannerTimerRef.current);
  }, []);

  // When player changes — restart the sequence with the new player
  const handlePlayerChange = (p) => {
    setCurrentPlayer(p);
    setShowMenu(false);
    // Brief delay so texture swap completes before replay
    setTimeout(() => startSequence(), 80);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Animated snap to Front / Back — sets snapTarget, eased inside useFrame
  const snapTo = (rad) => {
    // Normalize rad to within one turn of current rotY for shortest arc
    let target = rad;
    const cur  = seqRef.current.rotY % (Math.PI * 2);
    const normalized = ((cur % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    // Offset target to be near the current accumulated rotY
    target = seqRef.current.rotY - normalized + rad;
    seqRef.current.snapTarget = target;
    seqRef.current.playing = false;
    setIsRotating(false);
  };

  return (
    <div className="relative w-screen h-screen bg-[#08090c] overflow-hidden select-none font-sans text-white">

      {/* Very subtle warm radial center — just breaks the void without looking designed */}
      <div className="absolute inset-0 pointer-events-none
        bg-[radial-gradient(ellipse_55%_50%_at_50%_50%,rgba(249,115,22,0.04)_0%,transparent_70%)]" />

      {/* ── 3D Canvas ── */}
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{ position: CAM.ENTRANCE.slice(0,3), fov: 30 }}
          gl={{
            antialias:           true,
            toneMapping:         THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.08
          }}
          style={{ width: '100%', height: '100%' }}
        >
          <StudioEnvironment />
          <CameraChoreographer seqRef={seqRef} />
          <StudioLighting seqRef={seqRef} />

          <Suspense fallback={null}>
            <JerseyMesh
              player={currentPlayer}
              seqRef={seqRef}
              jerseyGroupRef={jerseyGroupRef}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* ── Top Header ── */}
      <header className="absolute top-0 inset-x-0 z-20 px-5 sm:px-8 py-4 sm:py-5
        flex items-center justify-between pointer-events-none">

        <div className="flex items-center gap-3 pointer-events-auto">
          <img src={hfplLogo} alt="HFPL" className="h-9 sm:h-10 w-auto object-contain drop-shadow" />
          <div className="h-5 w-px bg-white/20 hidden min-[420px]:block" />
          <div className="hidden min-[420px]:block leading-tight">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold tracking-tight text-white uppercase">
                HFPL 2027
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded
                text-[9px] font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                OFFICIAL KIT
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 tracking-widest uppercase font-medium mt-0.5">
              Official Match Jersey
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {iplSongUrl && (
            <button onClick={toggleSound}
              className="p-2 sm:px-3 sm:py-2 rounded-full bg-black/50 hover:bg-black/70
                border border-white/10 text-zinc-300 hover:text-white transition
                flex items-center gap-1.5 backdrop-blur-sm text-xs">
              {isMuted
                ? <VolumeX className="w-4 h-4 text-zinc-400" />
                : <Volume2  className="w-4 h-4 text-orange-400" />}
              <span className="hidden sm:inline text-[11px] font-medium">
                {isMuted ? 'Sound Off' : 'Sound On'}
              </span>
            </button>
          )}

          <button onClick={toggleFullscreen}
            className="p-2 sm:px-3 sm:py-2 rounded-full bg-black/50 hover:bg-black/70
              border border-white/10 text-zinc-300 hover:text-white transition
              flex items-center gap-1.5 backdrop-blur-sm text-xs">
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span className="hidden sm:inline text-[11px] font-medium">
              {isFullscreen ? 'Exit Full' : 'Projector'}
            </span>
          </button>

          <button onClick={() => { if (onBack) onBack(); else window.location.href = '/'; }}
            className="px-3 sm:px-4 py-2 rounded-full bg-white/10 hover:bg-white/20
              border border-white/15 text-white transition flex items-center gap-1.5
              backdrop-blur-sm text-xs font-semibold">
            <ArrowLeft className="w-4 h-4" />
            <span>Return</span>
          </button>
        </div>
      </header>

      {/* ── Reveal Caption — only during intro ── */}
      <div className={`absolute top-[72px] sm:top-20 inset-x-0 z-10 flex justify-center
        pointer-events-none transition-opacity duration-700 ${showBanner ? 'opacity-100' : 'opacity-0'}`}>
        <div className="px-5 py-1.5 rounded-full bg-black/50 border border-white/10
          text-zinc-300 text-[11px] tracking-widest uppercase font-medium backdrop-blur-sm">
          HFPL 2027 — Official Match Kit Unveil
        </div>
      </div>

      {/* ── Bottom Controls ── */}
      <footer className="absolute bottom-0 inset-x-0 z-20 px-4 sm:px-8 py-5 sm:py-7
        flex flex-col sm:flex-row items-end sm:items-center justify-between gap-3 pointer-events-none">

        {/* ── Player Badge ── */}
        <div className="pointer-events-auto flex items-center gap-3
          bg-black/60 border border-white/10 backdrop-blur-md px-4 py-3 rounded-2xl shadow-lg">

          {/* Jersey number pill */}
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/25
            flex items-center justify-center text-orange-400 font-bold text-lg font-mono shrink-0">
            {currentPlayer.number}
          </div>

          {/* Player info */}
          <div className="text-left min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-sm font-bold text-white tracking-wide uppercase leading-tight">
                {currentPlayer.name}
              </h2>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-300 font-medium shrink-0">
                #{currentPlayer.number}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-tight mt-0.5 truncate max-w-[160px]">
              {currentPlayer.role} · <span className="text-orange-400">{currentPlayer.team}</span>
            </p>
          </div>

          {/* Player switcher — inline pill buttons, no dropdown needed for only 2 options */}
          <div className="flex items-center gap-1 ml-1 p-1 bg-white/5 border border-white/10 rounded-xl">
            {OFFICIAL_PLAYERS.map((p, i) => {
              const active = currentPlayer.name === p.name && currentPlayer.number === p.number;
              return (
                <button key={i}
                  onClick={() => !active && handlePlayerChange(p)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    active
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-white/10'
                  }`}>
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Playback Controls ── */}
        <div className="pointer-events-auto flex items-center gap-2
          bg-black/60 border border-white/10 backdrop-blur-md px-3 py-2 rounded-2xl shadow-lg">

          {/* Pause / Resume idle rotation */}
          <button onClick={() => setIsRotating(v => !v)}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15
              border border-white/10 text-zinc-200 hover:text-white transition
              flex items-center gap-1.5 text-xs font-medium">
            {isRotating
              ? <Pause className="w-3.5 h-3.5 text-orange-400" />
              : <Play  className="w-3.5 h-3.5 text-emerald-400" />}
            <span className="hidden sm:inline">{isRotating ? 'Pause' : 'Resume'}</span>
          </button>

          {/* Animated snap to front */}
          <button onClick={() => snapTo(0)}
            className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/15
              border border-white/10 text-zinc-300 hover:text-white transition
              text-xs font-medium"
            title="Show front view">
            Front
          </button>

          {/* Animated snap to back */}
          <button onClick={() => snapTo(Math.PI)}
            className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/15
              border border-white/10 text-zinc-300 hover:text-white transition
              text-xs font-medium"
            title="Show back — player name and number">
            Back
          </button>

          <div className="w-px h-4 bg-white/15 mx-0.5" />

          {/* Replay full reveal */}
          <button onClick={startSequence}
            className="px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600
              text-white font-semibold text-xs transition flex items-center gap-1.5
              shadow-md shadow-orange-500/20">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Replay</span>
          </button>
        </div>
      </footer>
    </div>
  );
}

useGLTF.preload('/models/hfpl_jersey.glb');
