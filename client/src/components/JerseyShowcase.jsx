import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls, ContactShadows, Html } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  RotateCcw,
  Play,
  Pause,
  SkipForward,
  ChevronRight,
  ChevronLeft,
  Volume2,
  VolumeX,
  Maximize2,
  Sparkles,
  Trophy,
  Shirt
} from 'lucide-react';
import { cloneJersey } from '../utils/jerseyPlayerInfo';
import { suspenseAudio } from '../utils/suspenseAudio';
import JerseyLaunchFilm from './JerseyLaunchFilm';
import hfplLogo from '../logo/HFPL logo-Photoroom.png';

// Team Logos (Small 160px optimized)
import ssLogo from '../team_logo/small/SS.png';
import rrLogo from '../team_logo/small/RR.png';
import mmgLogo from '../team_logo/small/MMG.png';
import kkrLogo from '../team_logo/small/KKR.png';

// ─── Official Team Configurations ────────────────────────────────────────────
// Sequence order explicitly starts with SHERLE SUNRISERS, followed by existing team order
export const TEAMS = [
  {
    id: 'sherle',
    code: 'SS',
    name: 'Sherle Sunrisers',
    tagline: 'SUNBURST PRIDE',
    model: '/models/hfpl_jersey_sherle.glb',
    logo: ssLogo,
    theme: {
      primary: '#f2661e',
      secondary: '#141010',
      accentGlow: 'rgba(242, 102, 30, 0.28)',
      pillBg: 'rgba(242, 102, 30, 0.16)',
      border: 'rgba(242, 102, 30, 0.55)',
      gradient: 'from-amber-500 via-orange-600 to-red-600'
    }
  },
  {
    id: 'ratnagiri',
    code: 'RR',
    name: 'Ratnagiri Royals',
    tagline: 'ROYAL HERITAGE',
    model: '/models/hfpl_jersey_ratnagiri.glb',
    logo: rrLogo,
    theme: {
      primary: '#e8227a',
      secondary: '#1c1a46',
      accentGlow: 'rgba(232, 34, 122, 0.28)',
      pillBg: 'rgba(232, 34, 122, 0.16)',
      border: 'rgba(232, 34, 122, 0.55)',
      gradient: 'from-pink-500 via-rose-600 to-indigo-900'
    }
  },
  {
    id: 'malgund',
    code: 'MMG',
    name: 'Malgund Maha Giants',
    tagline: 'RISE AS GIANTS',
    model: '/models/hfpl_jersey_malgund.glb',
    logo: mmgLogo,
    theme: {
      primary: '#f07a30',
      secondary: '#1b2070',
      accentGlow: 'rgba(240, 122, 48, 0.28)',
      pillBg: 'rgba(240, 122, 48, 0.16)',
      border: 'rgba(240, 122, 48, 0.55)',
      gradient: 'from-orange-500 via-blue-600 to-indigo-950'
    }
  },
  {
    id: 'kotwade',
    code: 'KKR',
    name: 'Kotwade Knight Riders',
    tagline: 'RIDE TOGETHER',
    model: '/models/hfpl_jersey_kotwade.glb',
    logo: kkrLogo,
    theme: {
      primary: '#e2b043',
      secondary: '#4a1468',
      accentGlow: 'rgba(226, 176, 67, 0.28)',
      pillBg: 'rgba(226, 176, 67, 0.16)',
      border: 'rgba(226, 176, 67, 0.55)',
      gradient: 'from-amber-400 via-purple-600 to-indigo-950'
    }
  }
];

// Preload GLB models
TEAMS.forEach((t) => useGLTF.preload(t.model));

// ─── 3D Single Jersey Model (Strictly NO Player Names or Numbers) ─────────────
function SingleJerseyModel({
  modelUrl,
  isRotating = true,
  rotationSpeed = 0.35,
  initialAngle = 0,
  scale = 1.0,
  position = [0, -0.02, 0],
  hovered = false
}) {
  const { scene } = useGLTF(modelUrl);
  const gl = useThree((s) => s.gl);

  const jersey = useMemo(() => {
    const copy = cloneJersey(scene);
    copy.traverse((child) => {
      // STRICT REQUIREMENT: No player names or jersey numbers
      if (child.name === 'PlayerNumber' || child.name === 'PlayerName') {
        child.visible = false;
      }
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material && child.material.map) {
          child.material.map.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
          gl.initTexture(child.material.map);
        }
      }
    });
    return copy;
  }, [scene, gl]);

  const groupRef = useRef();

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (isRotating) {
      groupRef.current.rotation.y += rotationSpeed * delta;
      if (groupRef.current.rotation.y > Math.PI * 2) {
        groupRef.current.rotation.y -= Math.PI * 2;
      }
    }
  });

  const targetScale = hovered ? scale * 1.06 : scale;

  return (
    <group ref={groupRef} position={position} rotation={[0, initialAngle, 0]} scale={targetScale}>
      <primitive object={jersey} />
    </group>
  );
}

// ─── 3D Four Jerseys Lineup for Grand Final Reveal ───────────────────────────
function FourJerseysLineup({ hoveredIndex, onHoverIndex }) {
  const { size } = useThree();
  const isNarrow = size.width < 768;

  // Horizontal spacing
  const spacing = isNarrow ? 0.72 : 0.88;
  const baseY = isNarrow ? -0.06 : -0.03;
  const baseScale = isNarrow ? 0.82 : 0.94;

  return (
    <group position={[0, baseY, 0]}>
      {TEAMS.map((t, idx) => {
        // Lineup positions: -1.5, -0.5, 0.5, 1.5 spacing
        const x = (idx - 1.5) * spacing;
        // Subtle stadium arc in depth
        const z = -Math.abs(x) * 0.14;
        const isHovered = hoveredIndex === idx;

        return (
          <group
            key={t.id}
            position={[x, 0, z]}
            onPointerOver={(e) => {
              e.stopPropagation();
              onHoverIndex?.(idx);
            }}
            onPointerOut={() => onHoverIndex?.(null)}
          >
            <SingleJerseyModel
              modelUrl={t.model}
              isRotating={true}
              rotationSpeed={0.22}
              initialAngle={idx * 0.45}
              scale={baseScale}
              hovered={isHovered}
            />
          </group>
        );
      })}
    </group>
  );
}

// ─── Cinematic Team Reveal Choreography ──────────────────────────────────────
// Keyframes in seconds since the team's reveal started (0-2.5s is the title card).
// cam = camera position, look = camera target, rot/y/s = jersey yaw, height and scale.
// The crest sits on the wearer's left chest (+X), the HFPL badge on the right sleeve (-X).
const REVEAL_KEYS = [
  { t: 2.5,  cam: [0, 0.02, 2.5],      look: [0, -0.01, 0],     rot: -1.6,           y: -0.55, s: 0.8 },  // entrance
  { t: 3.9,  cam: [0, 0.03, 1.8],      look: [0, -0.01, 0],     rot: -0.12,          y: 0,     s: 1 },    // hero front
  { t: 5.5,  cam: [0.13, 0.14, 0.98],  look: [0.08, 0.1, 0],    rot: 0.05,           y: 0,     s: 1 },    // crest close-up
  { t: 7.1,  cam: [-0.16, 0.12, 1.02], look: [-0.13, 0.08, 0.15], rot: 0.9,          y: 0,     s: 1 },    // badge / sleeve close-up
  { t: 8.9,  cam: [0, 0.12, 1.45],     look: [0, 0.04, 0],      rot: Math.PI,        y: 0,     s: 1 },    // back & collar
  { t: 11.0, cam: [0, 0.03, 1.9],      look: [0, -0.01, 0],     rot: Math.PI * 2.15, y: 0,     s: 1 }     // wide 3/4 hero
];
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

function sampleReveal(elapsed) {
  const k = REVEAL_KEYS;
  if (elapsed <= k[0].t) return k[0];
  for (let i = 0; i < k.length - 1; i++) {
    if (elapsed <= k[i + 1].t) {
      const e = easeInOutCubic((elapsed - k[i].t) / (k[i + 1].t - k[i].t));
      return {
        cam: lerp3(k[i].cam, k[i + 1].cam, e),
        look: lerp3(k[i].look, k[i + 1].look, e),
        rot: k[i].rot + (k[i + 1].rot - k[i].rot) * e,
        y: k[i].y + (k[i + 1].y - k[i].y) * e,
        s: k[i].s + (k[i + 1].s - k[i].s) * e
      };
    }
  }
  return k[k.length - 1];
}

// One jersey driven by the reveal clock: entrance, rotation and camera close-ups.
// Mounted for the whole team phase (hidden during the title card) so the GLB textures are
// already on the GPU when the jersey appears and the WebGL context is never recreated.
function CinematicRevealJersey({ team, startRef }) {
  const { scene } = useGLTF(team.model);
  const { gl, camera, size } = useThree();
  const groupRef = useRef();
  const look = useMemo(() => new THREE.Vector3(), []);

  const jersey = useMemo(() => {
    const copy = cloneJersey(scene);
    copy.traverse((child) => {
      if (child.name === 'PlayerNumber' || child.name === 'PlayerName') child.visible = false;
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material && child.material.map) {
          child.material.map.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
          gl.initTexture(child.material.map);
        }
      }
    });
    return copy;
  }, [scene, gl]);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const elapsed = (performance.now() - startRef.current) / 1000;
    g.visible = elapsed >= 2.45;
    const f = sampleReveal(elapsed);
    // narrow / portrait screens: pull every camera key back so the jersey stays in frame
    const pull = size.width < size.height ? 1.35 : size.width < 768 ? 1.15 : 1;
    g.rotation.y = f.rot;
    g.position.y = -0.02 + f.y;
    g.scale.setScalar(f.s);
    look.set(f.look[0], f.look[1], f.look[2]);
    camera.position.set(
      f.look[0] + (f.cam[0] - f.look[0]) * pull,
      f.look[1] + (f.cam[1] - f.look[1]) * pull,
      f.look[2] + (f.cam[2] - f.look[2]) * pull
    );
    camera.lookAt(look);
  });

  return (
    <group ref={groupRef} visible={false}>
      <primitive object={jersey} />
    </group>
  );
}

function CanvasLoader({ label }) {
  return (
    <Html center>
      <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/70 border border-white/10 backdrop-blur-md whitespace-nowrap">
        <span className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-amber-400 animate-spin" />
        <span className="text-xs font-semibold text-zinc-200">{label}</span>
      </div>
    </Html>
  );
}

// ─── Studio Lighting & Local Environment ─────────────────────────────────────
function StudioEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.65;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

// ─── Dynamic Responsive Camera Rig ───────────────────────────────────────────
function ResponsiveCameraRig({ mode, controlsRef }) {
  const { camera, size } = useThree();

  useEffect(() => {
    const isNarrow = size.width < 768;
    if (mode === 'final') {
      camera.fov = isNarrow ? 36 : 30;
      // fit the whole four-jersey line (same spacing as FourJerseysLineup) plus the space under the title
      const spacing = isNarrow ? 0.72 : 0.88;
      const halfW = 1.5 * spacing + 0.42;
      const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const aspect = size.width / Math.max(size.height, 1);
      const dist = Math.max(halfW / (tanH * aspect), 0.62 / tanH);
      camera.position.set(0, 0.1, dist);
    } else {
      camera.fov = isNarrow ? 30 : 27;
      camera.position.set(0, 0.03, isNarrow ? 2.15 : 1.76);
    }
    camera.updateProjectionMatrix();
    if (controlsRef?.current) {
      controlsRef.current.target.set(0, mode === 'final' ? 0.06 : -0.01, 0);
      controlsRef.current.update();
    }
  }, [mode, size.width, size.height, camera, controlsRef]);

  return null;
}

// ─── Main HFPL 2027 Jersey Reveal Page ───────────────────────────────────────
export default function JerseyShowcase({ onBack }) {
  // Reveal Phases: 'intro' | 'team_reveal' | 'final_reveal' | 'inspect'
  // 'film' = cinematic launch film (JerseyLaunchFilm); the remaining phases are the interactive explorer
  const [phase, setPhase] = useState('film');

  // Intro Sequence Timeline (0 to 10 seconds)
  const [introTime, setIntroTime] = useState(0);
  const [activeIntroIndex, setActiveIntroIndex] = useState(0);

  // Individual Team Reveals Timeline
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [teamTimer, setTeamTimer] = useState(0); // 0 to 11 seconds per team
  const [teamSubBeat, setTeamSubBeat] = useState(0); // 0: INTRODUCING [TEAM], 1: A NEW LOOK, 2: A NEW IDENTITY, 3: MADE TO REPRESENT, 4: WEAR THE PRIDE

  // Final Reveal & Inspect State
  const [hoveredLineupIndex, setHoveredLineupIndex] = useState(null);
  const [isRotating, setIsRotating] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [soundStarted, setSoundStarted] = useState(false);

  const orbitRef = useRef();
  const teamStartRef = useRef(performance.now());
  const currentTeam = TEAMS[currentTeamIndex];

  // 10-Second Sequential Animated Intro Lines (Exact Timings)
  const INTRO_LINES = [
    { start: 0, end: 2, text: 'A NEW SEASON.', sub: 'HFPL 2027 EDITION' },
    { start: 2, end: 4, text: 'A NEW IDENTITY.', sub: 'FORGED FOR GLORY' },
    { start: 4, end: 6, text: 'FOUR TEAMS.', sub: 'ONE CHAMPIONSHIP' },
    { start: 6, end: 8, text: 'ONE PASSION.', sub: 'CRICKET IN OUR BLOOD' },
    { start: 8, end: 10, text: 'INTRODUCING HFPL 2027.', sub: 'THE OFFICIAL KITS' }
  ];

  // Team Reveal Text Lines (displayed one by one while jersey stays visible & rotating)
  const TEAM_TEXT_LINES = [
    'A NEW LOOK.',
    'A NEW IDENTITY.',
    'MADE TO REPRESENT.',
    'WEAR THE PRIDE.'
  ];

  // Start sound on first user interaction if not already started
  const ensureSound = () => {
    if (!soundStarted) {
      suspenseAudio.init();
      suspenseAudio.resume();
      setSoundStarted(true);
    }
  };

  // Mute / Unmute handler
  const toggleMute = (e) => {
    e?.stopPropagation();
    ensureSound();
    const next = !isMuted;
    setIsMuted(next);
    suspenseAudio.setMuted(next);
  };

  // ─── 1. Opening 10-Second Cinematic Sequence Engine ────────────────────────
  useEffect(() => {
    if (phase !== 'intro') return;

    suspenseAudio.startSuspenseDrone();

    const startTime = performance.now();
    let lastBeat = -1;

    const interval = setInterval(() => {
      const elapsed = (performance.now() - startTime) / 1000;
      setIntroTime(elapsed);

      // Determine active line
      const beatIndex = Math.min(4, Math.floor(elapsed / 2));
      setActiveIntroIndex(beatIndex);

      // Sound triggers synced to each 2-second beat
      if (beatIndex !== lastBeat) {
        lastBeat = beatIndex;
        ensureSound();
        if (beatIndex < 4) {
          suspenseAudio.playImpact(52, 1.2, 0.7);
          suspenseAudio.playWhoosh(0.7, 0.2);
        } else if (beatIndex === 4) {
          // 8.0s - 10.0s Tension Riser
          suspenseAudio.playImpact(44, 2.0, 0.85);
          suspenseAudio.playTensionRiser(2.0, 0.55);
        }
      }

      // Transition exactly at 10.0 seconds into Team 1 (Sherle Sunrisers)
      if (elapsed >= 10.0) {
        clearInterval(interval);
        suspenseAudio.stopSuspenseDrone();
        suspenseAudio.playClimaxHorn();
        suspenseAudio.startAnthem(0.55, 2.0);
        setPhase('team_reveal');
        setCurrentTeamIndex(0);
        setTeamTimer(0);
      }
    }, 40);

    return () => {
      clearInterval(interval);
    };
  }, [phase]);

  // ─── 2. Individual Team Reveals Sequential Engine ──────────────────────────
  useEffect(() => {
    if (phase !== 'team_reveal') return;

    setTeamTimer(0);
    setTeamSubBeat(0);
    const startT = performance.now();
    teamStartRef.current = startT;
    let currentBeat = -1;

    // Team reveal duration = 11.0 seconds per team
    // 0.0s - 2.5s: "INTRODUCING [TEAM NAME]" Title Card
    // 2.5s - 4.6s: 3D Jersey + "A NEW LOOK."
    // 4.6s - 6.7s: 3D Jersey + "A NEW IDENTITY."
    // 6.7s - 8.8s: 3D Jersey + "MADE TO REPRESENT."
    // 8.8s - 11.0s: 3D Jersey + "WEAR THE PRIDE."
    const interval = setInterval(() => {
      const elapsed = (performance.now() - startT) / 1000;
      setTeamTimer(elapsed);

      let beat = 0;
      if (elapsed < 2.5) {
        beat = 0; // INTRODUCING [TEAM]
      } else if (elapsed < 4.6) {
        beat = 1; // A NEW LOOK.
      } else if (elapsed < 6.7) {
        beat = 2; // A NEW IDENTITY.
      } else if (elapsed < 8.8) {
        beat = 3; // MADE TO REPRESENT.
      } else {
        beat = 4; // WEAR THE PRIDE.
      }

      if (beat !== currentBeat) {
        currentBeat = beat;
        setTeamSubBeat(beat);
        if (beat > 0) {
          suspenseAudio.playWhoosh(0.5, 0.15);
        }
      }

      // Move to next team or to Final Reveal
      if (elapsed >= 11.0) {
        clearInterval(interval);
        if (currentTeamIndex < TEAMS.length - 1) {
          setCurrentTeamIndex((prev) => prev + 1);
        } else {
          // Finished all 4 teams -> Grand Final Reveal!
          setPhase('final_reveal');
          triggerGrandConfetti();
        }
      }
    }, 50);

    return () => clearInterval(interval);
  }, [phase, currentTeamIndex]);

  // Grand Finale Confetti Celebration
  const triggerGrandConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#f2661e', '#e8227a', '#f07a30', '#e2b043', '#ffffff']
      });
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 60,
          spread: 70,
          origin: { x: 0.1, y: 0.7 },
          colors: ['#e2b043', '#ffffff', '#f2661e']
        });
        confetti({
          particleCount: 60,
          angle: 120,
          spread: 70,
          origin: { x: 0.9, y: 0.7 },
          colors: ['#e8227a', '#ffffff', '#f07a30']
        });
      }, 500);
    } catch (_) {}
  };

  // Skip Intro handler: skips the 10-second opening and starts Sherle Sunrisers reveal
  const handleSkipIntro = () => {
    ensureSound();
    suspenseAudio.stopSuspenseDrone();
    suspenseAudio.playClimaxHorn();
    suspenseAudio.startAnthem(0.55, 2.0);
    setPhase('team_reveal');
    setCurrentTeamIndex(0);
    setTeamTimer(0);
  };

  // Replay complete sequence handler
  const handleReplaySequence = () => {
    ensureSound();
    suspenseAudio.stopAll();
    setPhase('film');
    setIntroTime(0);
    setActiveIntroIndex(0);
    setCurrentTeamIndex(0);
    setTeamTimer(0);
    setTeamSubBeat(0);
  };

  // Quick jump to next team during reveal
  const handleNextTeam = () => {
    if (currentTeamIndex < TEAMS.length - 1) {
      setCurrentTeamIndex((i) => i + 1);
    } else {
      setPhase('final_reveal');
      triggerGrandConfetti();
    }
  };

  // Quick jump to previous team during reveal
  const handlePrevTeam = () => {
    if (currentTeamIndex > 0) {
      setCurrentTeamIndex((i) => i - 1);
    }
  };

  // Skip directly to Final 4-Jersey Lineup
  const handleSkipToFinal = () => {
    setPhase('final_reveal');
    triggerGrandConfetti();
  };

  // Inspect mode for individual team
  const handleInspectTeam = (index) => {
    setCurrentTeamIndex(index);
    setPhase('inspect');
  };

  if (phase === 'film') {
    return <JerseyLaunchFilm teams={TEAMS} onBack={onBack} onExplore={() => setPhase('final_reveal')} />;
  }

  return (
    <div
      onClick={ensureSound}
      className="relative h-screen w-screen bg-[#060709] text-white font-sans overflow-hidden select-none flex flex-col justify-between"
    >
      {/* ── Dynamic Ambient Studio Glow ── */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-1000 ease-out"
        style={{
          background:
            phase === 'team_reveal' || phase === 'inspect'
              ? `radial-gradient(circle 55% at 50% 50%, ${currentTeam.theme.accentGlow} 0%, transparent 70%),
                 radial-gradient(circle 35% at 50% 45%, ${currentTeam.theme.pillBg} 0%, transparent 60%)`
              : `radial-gradient(circle 60% at 50% 48%, rgba(226, 176, 67, 0.12) 0%, transparent 75%),
                 radial-gradient(circle 40% at 50% 50%, rgba(242, 102, 30, 0.08) 0%, transparent 65%)`
        }}
      />

      {/* Subtle Cinematic Grid & Vignette */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_40%,#060709_100%)] opacity-90 z-[5]" />

      {/* ── Top Header Bar ── */}
      <header className="relative z-30 flex items-center justify-between px-5 sm:px-8 py-3.5 border-b border-white/[0.06] backdrop-blur-md bg-[#060709]/80 shrink-0">
        <div className="flex items-center gap-3.5">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] text-xs font-medium text-zinc-300 hover:text-white transition group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition" />
            <span>Auction Hub</span>
          </button>

          <div className="h-4 w-px bg-white/10 hidden sm:block" />

          <div className="flex items-center gap-2.5">
            <img src={hfplLogo} alt="HFPL" className="h-6 w-auto object-contain" />
            <span className="text-[11px] font-bold tracking-[0.2em] text-zinc-300 uppercase hidden sm:inline">
              HFPL 2027 Jersey Launch
            </span>
          </div>
        </div>

        {/* Global Controls: Audio Toggle, Skip / Replay Controls */}
        <div className="flex items-center gap-2">
          {/* Audio Mute / Unmute Button */}
          <button
            onClick={toggleMute}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition ${
              !isMuted
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:text-white'
            }`}
          >
            {!isMuted ? <Volume2 className="w-3.5 h-3.5 text-amber-400" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden min-[420px]:inline">{isMuted ? 'Muted' : 'Sound ON'}</span>
          </button>

          {/* Skip Intro button (during 10s intro) */}
          {phase === 'intro' && (
            <button
              onClick={handleSkipIntro}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-black font-bold text-xs hover:bg-zinc-200 transition shadow-lg active:scale-95"
            >
              <span>Skip Intro</span>
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Skip to Lineup (during individual reveals) */}
          {phase === 'team_reveal' && (
            <button
              onClick={handleSkipToFinal}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-zinc-300 hover:text-white transition"
            >
              <span className="hidden sm:inline">All Jerseys</span>
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Replay Sequence button (during final reveal or inspect mode) */}
          {(phase === 'final_reveal' || phase === 'inspect') && (
            <button
              onClick={handleReplaySequence}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-semibold text-xs transition shadow-md"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Replay Sequence</span>
            </button>
          )}
        </div>
      </header>

      {/* ── Main Viewport Content ── */}
      <main className="relative z-10 flex-1 w-full h-full flex items-center justify-center overflow-hidden">
        {/* ══════════════════════════════════════════════════════════════════════
            STAGE 1: OPENING — EXACTLY 10 SECONDS CINEMATIC INTRODUCTION
           ══════════════════════════════════════════════════════════════════════ */}
        {phase === 'intro' && (
          <div className="relative z-20 w-full max-w-4xl px-6 flex flex-col items-center justify-center text-center">
            {/* Ambient League Seal */}
            <div className="mb-8 relative flex items-center justify-center">
              <div className="absolute w-44 h-44 rounded-full bg-amber-500/10 blur-3xl animate-pulse" />
              <img
                src={hfplLogo}
                alt="HFPL 2027"
                className="w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-[0_10px_25px_rgba(245,158,11,0.25)] transition duration-700"
              />
            </div>

            {/* Sequential Animated Text Display (0-2s, 2-4s, 4-6s, 6-8s, 8-10s) */}
            <div className="min-h-[140px] sm:min-h-[170px] flex flex-col items-center justify-center">
              {INTRO_LINES.map((line, idx) => {
                const isActive = activeIntroIndex === idx;
                if (!isActive) return null;

                const isClimax = idx === 4;

                return (
                  <div
                    key={idx}
                    className="flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-500"
                  >
                    <span className="text-xs sm:text-sm font-bold tracking-[0.35em] text-amber-400/90 uppercase mb-3">
                      {line.sub}
                    </span>

                    <h1
                      className={`font-black tracking-tight uppercase drop-shadow-[0_8px_20px_rgba(0,0,0,0.8)] ${
                        isClimax
                          ? 'text-3xl sm:text-5xl md:text-6xl text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-100 to-orange-400 py-1'
                          : 'text-4xl sm:text-6xl md:text-7xl text-white'
                      }`}
                    >
                      {line.text}
                    </h1>
                  </div>
                );
              })}
            </div>

            {/* Exactly 10-Second Progress Bar */}
            <div className="mt-12 w-64 sm:w-80 flex flex-col items-center gap-2">
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-75 ease-linear"
                  style={{ width: `${Math.min(100, (introTime / 10.0) * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between w-full text-[10px] text-zinc-500 font-mono tracking-widest">
                <span>00:0{Math.floor(introTime)}</span>
                <span className="text-amber-400 font-semibold">10.00s CINEMATIC INTRO</span>
                <span>00:10</span>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STAGE 2: INDIVIDUAL JERSEY REVEALS (ONE BY ONE SEQUENTIALLY)
           ══════════════════════════════════════════════════════════════════════ */}
        {phase === 'team_reveal' && (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* One persistent 3D stage for all four reveals (jersey hidden during each title card) */}
            <div className="w-full h-full absolute inset-0">
              <Canvas
                shadows
                dpr={[1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 1.5)]}
                camera={{ position: [0, 0.03, 2.5], fov: 27, near: 0.05, far: 20 }}
                gl={{
                  antialias: true,
                  powerPreference: 'high-performance',
                  toneMapping: THREE.NeutralToneMapping,
                  toneMappingExposure: 1.0
                }}
              >
                <StudioEnvironment />
                <Suspense fallback={teamSubBeat > 0 ? <CanvasLoader label={`Loading ${currentTeam.name} kit…`} /> : null}>
                  <CinematicRevealJersey key={currentTeam.id} team={currentTeam} startRef={teamStartRef} />
                </Suspense>
                <ambientLight intensity={0.3} />
                <directionalLight
                  position={[2.0, 2.5, 2.8]}
                  intensity={1.5}
                  castShadow
                  shadow-mapSize-width={1024}
                  shadow-mapSize-height={1024}
                  shadow-bias={-0.0002}
                  shadow-normalBias={0.01}
                />
                <directionalLight position={[-2.2, 1.8, -1.8]} intensity={1.0} color={currentTeam.theme.primary} />
                <directionalLight position={[0, 2.8, -2.5]} intensity={0.5} color="#ffffff" />
                <directionalLight position={[-1.5, -0.2, 2.0]} intensity={0.3} color="#ffffff" />
                <ContactShadows position={[0, -0.42, 0]} opacity={0.45} scale={1.8} blur={1.8} far={1.2} resolution={256} color="#000000" />
              </Canvas>
            </div>

            {/* SUB-BEAT 0: "INTRODUCING [TEAM NAME]" Dramatic Title Splash (0.0s - 2.5s) */}
            {teamSubBeat === 0 ? (
              <div className="relative z-20 flex flex-col items-center justify-center text-center px-6 animate-in fade-in zoom-in-95 duration-500">
                <div
                  className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl p-5 mb-6 flex items-center justify-center border shadow-2xl backdrop-blur-xl animate-pulse"
                  style={{
                    backgroundColor: currentTeam.theme.pillBg,
                    borderColor: currentTeam.theme.border
                  }}
                >
                  <img
                    src={currentTeam.logo}
                    alt={currentTeam.name}
                    className="w-full h-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.8)]"
                  />
                </div>

                <span
                  className="text-xs sm:text-sm font-extrabold tracking-[0.4em] uppercase mb-2"
                  style={{ color: currentTeam.theme.primary }}
                >
                  INTRODUCING
                </span>

                <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white drop-shadow-lg mb-3">
                  {currentTeam.name}
                </h1>

                <p className="text-xs sm:text-sm tracking-[0.25em] font-semibold text-zinc-400 uppercase">
                  {currentTeam.tagline}
                </p>
              </div>
            ) : (
              /* SUB-BEAT 1 to 4: cinematic jersey reveal with the four lines */
              <>
                {/* Floating Top Team Header HUD (Non-intrusive) */}
                <div className="absolute top-6 left-6 sm:left-10 z-20 pointer-events-none flex items-center gap-3.5">
                  <img
                    src={currentTeam.logo}
                    alt={currentTeam.name}
                    className="h-11 sm:h-14 w-auto object-contain drop-shadow-md"
                  />
                  <div>
                    <span
                      className="text-[10px] font-bold tracking-[0.25em] uppercase block"
                      style={{ color: currentTeam.theme.primary }}
                    >
                      TEAM {currentTeamIndex + 1} OF 4
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                      {currentTeam.name}
                    </h2>
                  </div>
                </div>

                {/* Short, Powerful Sequential Text Line Displayed One by One (Jersey stays fully visible) */}
                <div className="absolute bottom-16 sm:bottom-20 z-20 pointer-events-none w-full flex justify-center px-4">
                  <div
                    key={`${currentTeam.id}-${teamSubBeat}`}
                    className="px-6 sm:px-8 py-2.5 sm:py-3 rounded-full bg-black/65 border backdrop-blur-md shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-400"
                    style={{ borderColor: currentTeam.theme.border }}
                  >
                    <span
                      className="w-2 h-2 rounded-full animate-ping shrink-0"
                      style={{ backgroundColor: currentTeam.theme.primary }}
                    />
                    <span className="text-base sm:text-xl font-black tracking-widest text-white uppercase">
                      {TEAM_TEXT_LINES[teamSubBeat - 1] || 'A NEW LOOK.'}
                    </span>
                  </div>
                </div>

                {/* Individual Reveal Navigation Arrows */}
                <div className="absolute inset-y-0 left-4 right-4 pointer-events-none flex items-center justify-between z-20">
                  <button
                    onClick={handlePrevTeam}
                    disabled={currentTeamIndex === 0}
                    className={`p-2 sm:p-2.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-md pointer-events-auto transition ${
                      currentTeamIndex === 0
                        ? 'opacity-20 cursor-not-allowed'
                        : 'hover:bg-white/10 text-white cursor-pointer'
                    }`}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleNextTeam}
                    className="p-2 sm:p-2.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-md pointer-events-auto hover:bg-white/10 text-white transition cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STAGE 3: GRAND FINAL REVEAL (ALL 4 ACTUAL 3D JERSEYS IN A LINEUP)
           ══════════════════════════════════════════════════════════════════════ */}
        {phase === 'final_reveal' && (
          <div className="relative w-full h-full flex flex-col items-center justify-between">
            {/* Grand Launch Header Text */}
            <div className="relative z-20 pt-4 sm:pt-6 flex flex-col items-center text-center px-4 animate-in fade-in duration-700 pointer-events-none">
              <span className="text-xs sm:text-sm font-black tracking-[0.4em] text-amber-400 uppercase mb-1">
                FOUR TEAMS. ONE PASSION.
              </span>
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-amber-300 drop-shadow-md">
                H F P L 2 0 2 7
              </h1>
              <p className="text-[11px] sm:text-xs text-zinc-400 uppercase tracking-widest mt-1">
                Official Match Kits Lineup • Click any jersey to inspect in 3D
              </p>
            </div>

            {/* 3D Canvas Rendering All 4 Actual Jerseys Side-by-Side */}
            <div className="w-full h-full absolute inset-0 cursor-grab active:cursor-grabbing">
              <Canvas
                shadows
                dpr={[1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 1.5)]}
                camera={{ position: [0, 0.05, 2.9], fov: 32 }}
                gl={{
                  antialias: true,
                  powerPreference: 'high-performance',
                  toneMapping: THREE.NeutralToneMapping,
                  toneMappingExposure: 1.05
                }}
              >
                <StudioEnvironment />
                <Suspense fallback={<CanvasLoader label="Loading all four kits…" />}>
                  <FourJerseysLineup
                    hoveredIndex={hoveredLineupIndex}
                    onHoverIndex={setHoveredLineupIndex}
                  />
                </Suspense>

                {/* Grand Stadium Three-Point Lights */}
                <ambientLight intensity={0.4} />
                <directionalLight
                  position={[0, 4.0, 3.0]}
                  intensity={1.6}
                  color="#ffffff"
                  castShadow
                  shadow-mapSize-width={1024}
                  shadow-mapSize-height={1024}
                />
                <directionalLight position={[-3.5, 2.0, 1.0]} intensity={0.9} color="#f2661e" />
                <directionalLight position={[3.5, 2.0, 1.0]} intensity={0.9} color="#e2b043" />
                <directionalLight position={[0, -1.0, 2.0]} intensity={0.35} color="#ffffff" />

                <ResponsiveCameraRig mode="final" controlsRef={orbitRef} />
                <OrbitControls
                  ref={orbitRef}
                  enablePan={false}
                  enableDamping
                  dampingFactor={0.06}
                    minDistance={1.8}
                  maxDistance={12}
                />
                <ContactShadows
                  position={[0, -0.45, 0]}
                  opacity={0.5}
                  scale={5.5}
                  blur={2.0}
                  far={1.5}
                  resolution={256}
                  color="#000000"
                />
              </Canvas>
            </div>

            {/* Bottom 4-Team Interactive Badges */}
            <div className="relative z-20 pb-5 sm:pb-7 px-4 w-full max-w-4xl flex items-center justify-center gap-2 sm:gap-4">
              {TEAMS.map((t, idx) => {
                const isHovered = hoveredLineupIndex === idx;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleInspectTeam(idx)}
                    onMouseEnter={() => setHoveredLineupIndex(idx)}
                    onMouseLeave={() => setHoveredLineupIndex(null)}
                    className={`flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-2.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border backdrop-blur-md transition-all duration-200 cursor-pointer ${
                      isHovered
                        ? 'bg-white/[0.15] scale-105 shadow-xl text-white'
                        : 'bg-black/50 hover:bg-white/[0.08] text-zinc-300'
                    }`}
                    style={{
                      borderColor: isHovered ? t.theme.primary : 'rgba(255,255,255,0.1)'
                    }}
                  >
                    <img src={t.logo} alt={t.name} className="h-6 sm:h-7 w-auto object-contain shrink-0" />
                    <div className="text-left hidden min-[480px]:block">
                      <span className="block text-xs font-bold leading-tight">{t.name}</span>
                      <span className="block text-[9px] text-zinc-400 tracking-wider uppercase">
                        Inspect 3D
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STAGE 4: INTERACTIVE 3D INSPECT MODE (ROTATION & ANGLE EXPLORATION)
           ══════════════════════════════════════════════════════════════════════ */}
        {phase === 'inspect' && (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* 3D Canvas */}
            <div className="w-full h-full absolute inset-0 cursor-grab active:cursor-grabbing">
              <Canvas
                shadows
                dpr={[1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 1.5)]}
                camera={{ position: [0, 0.03, 1.76], fov: 27 }}
                gl={{
                  antialias: true,
                  powerPreference: 'high-performance',
                  toneMapping: THREE.NeutralToneMapping,
                  toneMappingExposure: 1.0
                }}
              >
                <StudioEnvironment />
                <Suspense fallback={<CanvasLoader label={`Loading ${currentTeam.name} kit…`} />}>
                  <SingleJerseyModel
                    key={currentTeam.id}
                    modelUrl={currentTeam.model}
                    isRotating={isRotating}
                    rotationSpeed={0.3}
                    scale={1.0}
                  />
                </Suspense>

                <ambientLight intensity={0.3} />
                <directionalLight
                  position={[2.0, 2.5, 2.8]}
                  intensity={1.5}
                  castShadow
                  shadow-mapSize-width={1024}
                  shadow-mapSize-height={1024}
                  shadow-bias={-0.0002}
                />
                <directionalLight
                  position={[-2.2, 1.8, -1.8]}
                  intensity={0.9}
                  color={currentTeam.theme.primary}
                />
                <directionalLight position={[0, 2.8, -2.5]} intensity={0.5} color="#ffffff" />
                <directionalLight position={[-1.5, -0.2, 2.0]} intensity={0.3} color="#ffffff" />

                <ResponsiveCameraRig mode="single" controlsRef={orbitRef} />
                <OrbitControls
                  ref={orbitRef}
                  enablePan={false}
                  enableDamping
                  dampingFactor={0.06}
                  minDistance={1.05}
                  maxDistance={2.8}
                />
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

            {/* Top Left Team Info */}
            <div className="absolute top-6 left-6 sm:left-10 z-20 pointer-events-none flex items-center gap-3.5">
              <img
                src={currentTeam.logo}
                alt={currentTeam.name}
                className="h-12 sm:h-14 w-auto object-contain drop-shadow-md"
              />
              <div>
                <span
                  className="text-[10px] font-bold tracking-[0.25em] uppercase block"
                  style={{ color: currentTeam.theme.primary }}
                >
                  HFPL 2027 OFFICIAL KIT
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                  {currentTeam.name}
                </h2>
              </div>
            </div>

            {/* Back to 4-Jersey Lineup Button */}
            <div className="absolute top-6 right-6 z-20">
              <button
                onClick={handleSkipToFinal}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-white transition shadow-lg"
              >
                <Shirt className="w-3.5 h-3.5" />
                <span>View All 4 Jerseys</span>
              </button>
            </div>

            {/* Orbit Hint */}
            <div className="absolute bottom-16 pointer-events-none text-[10px] text-zinc-400 tracking-widest uppercase flex items-center gap-1.5 z-20">
              <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
              <span>Drag to orbit 360° • Scroll to zoom</span>
            </div>
          </div>
        )}
      </main>

      {/* ── Bottom Team Selection Footer (Visible in Reveal and Inspect modes) ── */}
      {(phase === 'team_reveal' || phase === 'inspect') && (
        <footer className="relative z-30 px-5 sm:px-8 py-3 border-t border-white/[0.06] backdrop-blur-md bg-[#060709]/85 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">
              Select Kit:
            </span>
          </div>

          {/* 4 Team Switcher Tabs */}
          <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            {TEAMS.map((t, idx) => {
              const isActive = idx === currentTeamIndex;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setCurrentTeamIndex(idx);
                    if (phase === 'team_reveal') {
                      setTeamTimer(2.5); // Jump straight to rotating jersey
                      setTeamSubBeat(1);
                    }
                  }}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-white/[0.14] text-white shadow-lg'
                      : 'bg-white/[0.03] hover:bg-white/[0.07] text-zinc-400 hover:text-zinc-200'
                  }`}
                  style={{
                    borderColor: isActive ? t.theme.primary : 'rgba(255,255,255,0.08)'
                  }}
                >
                  <img src={t.logo} alt={t.name} className="h-4 sm:h-5 w-auto object-contain shrink-0" />
                  <span className="text-xs font-semibold">{t.code}</span>
                  {isActive && (
                    <span
                      className="w-1.5 h-1.5 rounded-full ml-1"
                      style={{ backgroundColor: t.theme.primary }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* 360 Spin Toggle Button */}
          <button
            onClick={() => setIsRotating((p) => !p)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-medium transition ${
              isRotating
                ? 'bg-white/[0.12] border-white/20 text-white'
                : 'bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:text-white'
            }`}
          >
            <RotateCcw className={`w-3 h-3 ${isRotating ? 'animate-spin' : ''}`} style={{ animationDuration: '9s' }} />
            <span>{isRotating ? 'Spinning 360°' : 'Spin Paused'}</span>
          </button>
        </footer>
      )}
    </div>
  );
}
