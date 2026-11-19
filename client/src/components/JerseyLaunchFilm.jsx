import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useTexture, useProgress, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ArrowLeft, RotateCcw, SkipForward, Volume2, VolumeX, Shirt, Maximize2, Minimize2, Users, Search } from 'lucide-react';
import { cloneJersey } from '../utils/jerseyPlayerInfo';
import { suspenseAudio } from '../utils/suspenseAudio';
import ssEmblem from '../team_logo/emblem/SS.webp';
import rrEmblem from '../team_logo/emblem/RR.webp';
import kkrEmblem from '../team_logo/emblem/KKR.webp';
import mmgEmblem from '../team_logo/emblem/MMG.webp';
import hfplEmblem from '../team_logo/emblem/HFPL.webp';

// ─── Timeline Constants (Seconds) ────────────────────────────────────────────
const LINE_LEN = 3;
const INTRO = 5 * LINE_LEN;                       // 15s opening statements
const LOGO_LEN = 24;                              // HFPL logo reveal: darkness > suspense > emergence > grand reveal > transition
const TEAMS_START = INTRO + LOGO_LEN;             // 39s
const TEAM_LEN = 55;                              // each team gets 55s of reveal
const FINAL_START = TEAMS_START + 4 * TEAM_LEN;   // 259s: film hands over to the manual inspect hub

const ORDER = ['sherle', 'ratnagiri', 'kotwade', 'malgund'];
const INTRO_LINES = ['A NEW SEASON.', 'A NEW IDENTITY.', 'FOUR TEAMS.', 'ONE PASSION.', 'INTRODUCING HFPL 2027.'];

const CAPTIONS = [
  { from: 8.0,  to: 12.0, text: 'A NEW LOOK.' },
  { from: 13.5, to: 17.0, text: 'A NEW IDENTITY.' },
  { from: 19.0, to: 23.0, text: 'EVERY DETAIL. CRAFTED.' },
  { from: 27.5, to: 31.5, text: 'MADE TO REPRESENT.' },
  { from: 37.5, to: 41.5, text: 'BUILT FOR THE BIG STAGE.' },
  { from: 46.0, to: 50.0, text: 'WEAR THE PRIDE.' },
];

// Per-team camera & jersey choreography
const SHOTS = [
  { t: 0.0,  cam: [0, 0.8, 1.9],       look: [0, 0.82, -2.4],     rot: -1.4,           y: 1.7 },
  { t: 3.5,  cam: [0, 0.72, 1.3],      look: [0, 0.78, -2.4],     rot: -1.3,           y: 1.6 },
  { t: 7.0,  cam: [0, 0.1, 2.55],      look: [0, 0.1, -0.4],      rot: -0.08,          y: 0 },   // wide front
  { t: 12.5, cam: [0, 0.08, 1.95],     look: [0, 0.06, 0],        rot: 0.05,           y: 0 },   // slow push-in
  { t: 17.5, cam: [0.17, 0.14, 0.98],  look: [0.08, 0.1, 0],      rot: 0.06,           y: 0 },   // chest crest
  { t: 22.5, cam: [0.12, 0.12, 0.9],   look: [0.08, 0.1, 0],      rot: 0.14,           y: 0 },   // crest hold
  { t: 27.0, cam: [-0.2, 0.11, 1.02],  look: [-0.13, 0.08, 0.15], rot: 0.9,            y: 0 },   // sleeve patch
  { t: 31.5, cam: [-0.24, 0.09, 0.98], look: [-0.13, 0.08, 0.15], rot: 1.0,            y: 0 },   // patch hold
  { t: 36.0, cam: [0.08, -0.3, 1.5],   look: [0, 0.12, 0],        rot: Math.PI,        y: 0 },   // back reveal
  { t: 40.5, cam: [0, 0.07, 1.15],     look: [0, 0.06, 0],        rot: Math.PI,        y: 0 },   // HFPL / 27 close-up
  { t: 44.5, cam: [-0.05, 0.05, 1.3],  look: [0, 0.05, 0],        rot: Math.PI + 0.12, y: 0 },   // back hold
  { t: 49.0, cam: [0, 0.05, 1.8],      look: [0, 0.02, 0],        rot: Math.PI * 1.5,  y: 0 },   // profile
  { t: 55.0, cam: [0.2, 0.1, 2.35],    look: [0, 0.04, 0],        rot: Math.PI * 2.25, y: 0 },   // wide turn
];

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (a, b, x) => {
  const k = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};
const mix = (a, b, k) => a + (b - a) * k;
const mix3 = (a, b, k) => [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];

function sampleShots(local) {
  if (local <= SHOTS[0].t) return SHOTS[0];
  for (let i = 0; i < SHOTS.length - 1; i++) {
    const a = SHOTS[i], b = SHOTS[i + 1];
    if (local <= b.t) {
      const k = ease((local - a.t) / (b.t - a.t));
      return {
        cam: mix3(a.cam, b.cam, k),
        look: mix3(a.look, b.look, k),
        rot: mix(a.rot, b.rot, k),
        y: mix(a.y, b.y, k)
      };
    }
  }
  return SHOTS[SHOTS.length - 1];
}

// HFPL logo scene (seconds from its start): 0-4 darkness, 4-10.5 suspense, 10.5-16 emergence,
// 16 grand reveal + hold, 21.8-24 transition into Sherle Sunrisers
const REVEAL_AT = 16;
const LOGO_CUES = [0.01, 5, 8.5, 11, REVEAL_AT, 22];

// Coarse "beat" for the DOM overlays
function beatAt(t, mode = 'film') {
  if (t < INTRO) {
    const line = Math.min(4, Math.floor(t / LINE_LEN));
    return { phase: 'intro', line, out: t - line * LINE_LEN > LINE_LEN - 0.8 };
  }
  if (t < TEAMS_START) {
    const l = t - INTRO;
    return {
      phase: 'logo',
      cue: LOGO_CUES.filter((c) => l >= c).length,          // drives the sound design
      flash: l >= REVEAL_AT && l < REVEAL_AT + 0.7,
      title: l >= REVEAL_AT + 0.8 && l < 22.6,
      titleOut: l >= 21.9,
      fade: l >= 23.1,
    };
  }
  if (t < FINAL_START) {
    const i = Math.floor((t - TEAMS_START) / TEAM_LEN);
    const local = t - TEAMS_START - i * TEAM_LEN;
    let caption = -1, capOut = false;
    for (let k = 0; k < CAPTIONS.length; k++) {
      const c = CAPTIONS[k];
      if (local >= c.from && local < c.to) {
        caption = k;
        capOut = local > c.to - 0.7;
        break;
      }
    }
    return {
      phase: 'team',
      team: i,
      caption,
      capOut,
      name: local >= 1.2 && local < 6.6,
      nameOut: local >= 6.0,
      hud: local >= 6.6 && local < TEAM_LEN - 0.8,
      fade: local >= TEAM_LEN - 1.1 || local < 0.6,
    };
  }
  // after the last team the film waits on the manual hub; the lineup only starts on request
  if (mode !== 'lineup') return { phase: 'inspect' };
  const f = t - FINAL_START;
  return { phase: 'final', title: f >= 3.0, fade: f < 0.6 };
}

function setLight(t) {
  if (t < INTRO) return 0;
  if (t < TEAMS_START) return 0.2 * smooth(INTRO + 4, INTRO + 10.5, t) + 0.8 * smooth(INTRO + REVEAL_AT - 0.4, INTRO + REVEAL_AT + 2.5, t);
  return 1;
}

// ─── 3D: High-Precision Delta-Time Film Clock ────────────────────────────────
function FilmClock({ film, onBeat }) {
  const lastKey = useRef('');
  const prevNow = useRef(0);

  useFrame(() => {
    if (typeof document !== 'undefined' && document.hidden) return; // Pause clock when tab hidden

    const f = film.current;
    const now = performance.now();
    // Clamped delta-time prevents sudden jumps after tab switches or long frames
    const dt = prevNow.current ? Math.min((now - prevNow.current) / 1000, 0.05) : 0;
    prevNow.current = now;

    if (f.ready && f.playing) {
      f.t = f.mode === 'lineup' ? f.t + dt : Math.min(FINAL_START, f.t + dt);   // never auto-starts the lineup
    }

    const b = beatAt(f.t, f.mode);
    // Lightweight string key avoids JSON.stringify overhead every frame
    const key = `${b.phase}_${b.cue ?? ''}_${b.flash ? 1 : 0}_${b.line ?? ''}_${b.team ?? ''}_${b.caption ?? ''}_${b.out ? 1 : 0}_${b.name ? 1 : 0}_${b.hud ? 1 : 0}_${b.title ? 1 : 0}_${b.fade ? 1 : 0}`;
    if (key !== lastKey.current) {
      lastKey.current = key;
      onBeat(b);
    }
  });

  return null;
}

// ─── Studio Environment (RoomEnvironment, PMREM disposed cleanly) ─────────────
function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.28;
    scene.background = new THREE.Color('#030101');
    scene.fog = new THREE.Fog('#060202', 3.2, 9.5);
    return () => {
      scene.environment = null;
      scene.fog = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

// ─── Industrial Set: Instanced Ribs & Light Strips (5 draw calls total) ───────
function IndustrialSet({ film }) {
  const ribsCount = 18;
  const stripsCount = 10;

  const boxGeo = useMemo(() => new THREE.BoxGeometry(0.12, 3.2, 0.26), []);
  const stripGeo = useMemo(() => new THREE.BoxGeometry(0.012, 2.4, 0.018), []);
  const floorGeo = useMemo(() => new THREE.PlaneGeometry(12, 12), []);
  const backGeo = useMemo(() => new THREE.PlaneGeometry(9, 5), []);
  const plinthGeo = useMemo(() => new THREE.CylinderGeometry(0.58, 0.62, 0.05, 32), []);
  const torusGeo = useMemo(() => new THREE.TorusGeometry(0.6, 0.006, 8, 48), []);

  const metal = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1a0b08', metalness: 0.65, roughness: 0.45 }), []);
  const stripMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0), toneMapped: false }), []);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0), toneMapped: false }), []);
  const floorMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0a0303', metalness: 0.75, roughness: 0.32 }), []);
  const backMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0e0504', metalness: 0.4, roughness: 0.8 }), []);

  const ribsMesh = useRef();
  const stripsMesh = useRef();

  useEffect(() => {
    // Populate instanced matrices once
    if (ribsMesh.current) {
      const dummy = new THREE.Object3D();
      let ribIdx = 0;
      [-1, 1].forEach((side) => {
        for (let i = 0; i < 9; i++) {
          const z = -2.3 + i * 0.42;
          dummy.position.set(side * 2.2, 0.6, z);
          dummy.updateMatrix();
          ribsMesh.current.setMatrixAt(ribIdx++, dummy.matrix);
        }
      });
      ribsMesh.current.instanceMatrix.needsUpdate = true;
    }

    if (stripsMesh.current) {
      const dummy = new THREE.Object3D();
      let stripIdx = 0;
      [-1, 1].forEach((side) => {
        for (let i = 0; i < 9; i += 2) {
          const z = -2.3 + i * 0.42;
          dummy.position.set(side * 2.2 - side * 0.07, 0.5, z);
          dummy.updateMatrix();
          stripsMesh.current.setMatrixAt(stripIdx++, dummy.matrix);
        }
      });
      stripsMesh.current.instanceMatrix.needsUpdate = true;
    }
  }, []);

  useFrame(() => {
    const k = setLight(film.current.t);
    stripMat.color.setRGB(1.0 * k, 0.28 * k, 0.08 * k);
    ringMat.color.setRGB(1.0 * k, 0.42 * k, 0.12 * k);
  });

  // Resource cleanup
  useEffect(() => {
    return () => {
      boxGeo.dispose();
      stripGeo.dispose();
      floorGeo.dispose();
      backGeo.dispose();
      plinthGeo.dispose();
      torusGeo.dispose();
      metal.dispose();
      stripMat.dispose();
      ringMat.dispose();
      floorMat.dispose();
      backMat.dispose();
    };
  }, [boxGeo, stripGeo, floorGeo, backGeo, plinthGeo, torusGeo, metal, stripMat, ringMat, floorMat, backMat]);

  return (
    <group>
      <mesh position={[0, 0.9, -2.45]} geometry={backGeo} material={backMat} />
      <instancedMesh ref={ribsMesh} args={[boxGeo, metal, ribsCount]} />
      <instancedMesh ref={stripsMesh} args={[stripGeo, stripMat, stripsCount]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]} geometry={floorGeo} material={floorMat} />
      <mesh position={[0, -0.775, 0]} geometry={plinthGeo} material={metal} />
      <mesh position={[0, -0.748, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={torusGeo} material={ringMat} />
    </group>
  );
}

function radialTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 128; // 128x128 is lightweight and visually identical for soft radial glows
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, col]) => r.addColorStop(o, col));
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ─── Atmospheric Dust Particles ──────────────────────────────────────────────
function Atmosphere({ film }) {
  const N = 180; // 180 particles provides lush atmospheric haze at lower GPU fill cost
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      p[i * 3] = (Math.random() - 0.5) * 4.2;
      p[i * 3 + 1] = -0.7 + Math.random() * 2.8;
      p[i * 3 + 2] = -2.3 + Math.random() * 3.4;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  const sprite = useMemo(() => radialTexture([[0, 'rgba(255,220,180,1)'], [0.4, 'rgba(255,140,60,0.35)'], [1, 'rgba(0,0,0,0)']]), []);
  const mat = useRef();
  const pts = useRef();

  useFrame((_, dt) => {
    if (!pts.current || !mat.current) return;
    const t = film.current.t;
    pts.current.rotation.y += dt * 0.01;
    pts.current.position.y = 0.05 * Math.sin(t * 0.15);
    mat.current.opacity = t < INTRO ? 0 : 0.55 * Math.max(setLight(t), smooth(INTRO + 4, INTRO + 10, t) * 0.6);
  });

  useEffect(() => {
    return () => {
      geo.dispose();
      sprite.dispose();
    };
  }, [geo, sprite]);

  return (
    <points ref={pts} geometry={geo}>
      <pointsMaterial
        ref={mat}
        map={sprite}
        size={0.035}
        sizeAttenuation
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        color="#ffb070"
        opacity={0}
        toneMapped={false}
      />
    </points>
  );
}

// ─── Stadium searchlights: faint sweeping beams + moving shadows (logo scene only, 3 quads) ─
function beamTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  const h = g.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(255,236,200,0)'); h.addColorStop(0.5, 'rgba(255,236,200,1)'); h.addColorStop(1, 'rgba(255,236,200,0)');
  g.fillStyle = h; g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = 'destination-in';
  const v = g.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, 'rgba(0,0,0,0.9)'); v.addColorStop(0.55, 'rgba(0,0,0,0.25)'); v.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = v; g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const BEAMS = [[-1.5, 0.35, 0], [0.1, -0.1, 2.1], [1.6, -0.4, 4.2]];   // x, base angle, phase
function Searchlights({ film }) {
  const tex = useMemo(beamTexture, []);
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0), []);   // pivot at the lamp
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, color: '#ffe2b0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide }), [tex]);
  const refs = useRef([]);
  useFrame(() => {
    const t = film.current.t;
    const l = t - INTRO;
    const on = t < INTRO || t >= TEAMS_START ? 0
      : 0.16 * smooth(3.5, 9, l) * (1 - 0.55 * smooth(REVEAL_AT - 1, REVEAL_AT + 1, l)) * (1 - smooth(21.5, 23.5, l));
    mat.opacity = on;
    refs.current.forEach((m, i) => {
      if (!m) return;
      m.visible = on > 0.002;
      m.rotation.z = BEAMS[i][1] + 0.32 * Math.sin(t * 0.22 + BEAMS[i][2]);
    });
  });
  useEffect(() => () => { tex.dispose(); geo.dispose(); mat.dispose(); }, [tex, geo, mat]);
  return BEAMS.map(([x], i) => (
    <mesh key={i} ref={(el) => { refs.current[i] = el; }} geometry={geo} material={mat} position={[x, 2.3, -2.2]} scale={[0.75, 3.8, 1]} visible={false} />
  ));
}

// ─── Illuminated Emblem (Pre-instantiated Meshes, Zero Texture Swapping Jank) ──
function Emblem({ film, textures }) {
  const gl = useThree((s) => s.gl);
  const halo = useRef();
  const beam = useRef();
  const light = useRef();
  const glow = useMemo(() => radialTexture([[0, 'rgba(255,170,60,0.9)'], [0.35, 'rgba(255,90,20,0.45)'], [1, 'rgba(255,40,10,0)']]), []);
  const beamTex = useMemo(() => radialTexture([[0, 'rgba(255,230,190,0.55)'], [0.5, 'rgba(255,150,70,0.12)'], [1, 'rgba(0,0,0,0)']]), []);

  // Pre-compiled materials per emblem: zero texture swap recompilation hitch!
  const emblemEntries = useMemo(() => {
    return Object.entries(textures).map(([key, tex]) => {
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        toneMapped: false,
        alphaTest: 0.02,
        opacity: 0
      });
      const img = tex.image;
      const aspect = img ? img.width / img.height : 1;
      return { key, mat, aspect };
    });
  }, [textures]);

  const emblemMeshRefs = useRef({});

  useFrame(() => {
    const t = film.current.t;
    const b = beatAt(t, film.current.mode);
    let activeKey = 'hfpl', on = 0, h = 1.75, sweep = 0, op = -1, back = -1, blur = 0;

    if (b.phase === 'logo') {
      const l = t - INTRO;
      const out = 1 - smooth(21.8, 23.6, l);
      const grand = smooth(REVEAL_AT - 0.15, REVEAL_AT + 0.35, l);
      const pulse = Math.exp(-Math.max(0, l - REVEAL_AT) * 2.2) * grand;          // short flash on the hit
      h = 1.6;
      op = smooth(10, 13.5, l) * out;                                              // silhouette appears first...
      on = Math.min(1, 0.03 + 0.6 * smooth(11, 16, l) ** 1.7 + 0.37 * grand + 0.25 * pulse) * out;   // ...then its detail
      back = (0.12 * smooth(7, 11, l) + 0.5 * smooth(10, 15.5, l) + 0.38 * grand + 0.5 * pulse) * out;
      sweep = smooth(11.5, 16.2, l);
      blur = l > 9.5 && l < REVEAL_AT + 0.3 ? 4.5 * (1 - smooth(11, REVEAL_AT, l)) : 0;   // pulls into sharp focus
    } else if (b.phase === 'team') {
      activeKey = ORDER[b.team];
      const local = t - TEAMS_START - b.team * TEAM_LEN;
      h = 2.1;
      on = local < 0.3 ? 0 : local < 1.6 ? smooth(0.3, 1.6, local) * (Math.sin(local * 40) > -0.6 ? 1 : 0.35) : 1;
      if (local > 9.5 && local < TEAM_LEN - 3) on *= 0.72;
      on *= 1 - smooth(TEAM_LEN - 1.2, TEAM_LEN, local) * 0.85;
    } else if (b.phase === 'inspect') {
      const sel = film.current.sel;
      activeKey = sel == null ? 'hfpl' : ORDER[sel];
      h = sel == null ? 1.75 : 2.1;
      on = sel == null ? 1 : 0.55;
    } else if (b.phase === 'final') {
      on = smooth(0.4, 3.0, t - FINAL_START);
    }

    emblemEntries.forEach(({ key, mat, aspect }) => {
      const mesh = emblemMeshRefs.current[key];
      if (mesh) {
        if (key === activeKey && (op >= 0 ? op : on) > 0.005) {
          mesh.visible = true;
          mesh.scale.set(h * aspect, h, 1);
          mat.color.setScalar(on);
          mat.opacity = op >= 0 ? op : on;
        } else {
          mesh.visible = false;
        }
      }
    });

    if (halo.current) halo.current.material.opacity = 0.5 * (back >= 0 ? back : on);
    if (light.current) light.current.intensity = 5 * on;
    if (beam.current) {
      beam.current.position.x = mix(-2.2, 2.2, sweep);
      beam.current.material.opacity = b.phase === 'logo' ? 0.3 * Math.sin(Math.PI * sweep) : 0;
    }
    // lens focus pull on the canvas during the emergence (only touches the style when it changes)
    const f = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : '';
    if (gl.domElement.style.filter !== f) gl.domElement.style.filter = f;
  });

  useEffect(() => {
    return () => {
      glow.dispose();
      beamTex.dispose();
      emblemEntries.forEach(({ mat }) => mat.dispose());
    };
  }, [glow, beamTex, emblemEntries]);

  return (
    <group position={[0, 0.85, -2.38]}>
      <mesh ref={halo} position={[0, 0, -0.02]} scale={[4.4, 3.6, 1]}>
        <planeGeometry />
        <meshBasicMaterial map={glow} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {emblemEntries.map(({ key, mat }) => (
        <mesh key={key} ref={(el) => { emblemMeshRefs.current[key] = el; }} material={mat} visible={false}>
          <planeGeometry />
        </mesh>
      ))}
      <mesh ref={beam} position={[0, 0, 0.05]} scale={[1.2, 3.2, 1]}>
        <planeGeometry />
        <meshBasicMaterial map={beamTex} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, 0, 0.6]} color="#ffae3a" intensity={0} distance={5} decay={2} />
    </group>
  );
}

const INSPECT_SCALE = 1.12;
function InspectControls({ sel }) {
  const ctl = useRef();
  const { camera, size } = useThree();
  useEffect(() => {
    const portrait = size.width / Math.max(1, size.height) < 0.8;
    camera.position.set(0.32, 0.06, portrait ? 2.9 : 1.75);
    if (ctl.current) { ctl.current.target.set(0, 0, 0); ctl.current.update(); }
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <OrbitControls ref={ctl} target={[0, 0, 0]} enablePan={false} enableDamping dampingFactor={0.08}
      minDistance={0.7} maxDistance={3.5} minPolarAngle={0.35} maxPolarAngle={2.6} autoRotate autoRotateSpeed={0.8} />
  );
}

// ─── Four Original GLB Jerseys (Reused & Cloned Once, Anisotropy Capped) ──────
function Jerseys({ film, teams }) {
  const urls = useMemo(() => ORDER.map((id) => teams.find((t) => t.id === id).model), [teams]);
  const gltfs = useGLTF(urls);
  const { gl, camera, size } = useThree();

  const clones = useMemo(() => {
    return gltfs.map(({ scene }) => {
      const c = cloneJersey(scene);
      c.traverse((o) => {
        if (o.name === 'PlayerName' || o.name === 'PlayerNumber') {
          o.visible = false;
        }
        if (o.isMesh && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((mat) => {
            if (mat.map) {
              // Capping anisotropy at 4 guarantees sharp logos without 16x memory bandwidth saturation
              mat.map.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
              mat.map.minFilter = THREE.LinearMipmapLinearFilter;
              gl.initTexture(mat.map);
            }
          });
        }
      });
      return c;
    });
  }, [gltfs, gl]);

  const groups = useRef([]);
  const look = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const t = film.current.t;
    const b = beatAt(t, film.current.mode);
    const aspect = size.width / Math.max(1, size.height);
    const portrait = aspect < 0.8;
    const bob = (p) => 0.025 * Math.sin(t * 0.9 + p);

    if (b.phase === 'intro' || b.phase === 'logo') {
      groups.current.forEach((g) => { if (g) g.visible = false; });
      const l = Math.max(0, t - INTRO);
      const k = ease(THREE.MathUtils.clamp(l / 22, 0, 1));
      const z = (mix(3.7, 1.85, k) - 0.18 * smooth(REVEAL_AT, 23, l)) * (portrait ? 1.6 : 1) + (portrait ? 0.7 : 0);
      camera.position.set(0.22 * Math.sin(l * 0.1), mix(0.3, 0.7, k), z);
      look.set(0, mix(0.78, 0.69, k), -2.4);
      camera.lookAt(look);
      return;
    }

    if (b.phase === 'team') {
      const local = t - TEAMS_START - b.team * TEAM_LEN;
      const s = sampleShots(local);
      groups.current.forEach((g, i) => {
        if (!g) return;
        g.visible = i === b.team && local > 3.6;
        if (!g.visible) return;
        g.position.set(0, s.y + bob(0) - 0.02, 0);
        g.rotation.set(0.035 * Math.sin(t * 0.45), s.rot, 0.025 * Math.sin(t * 0.6));
        g.scale.setScalar(1);
      });
      const pull = portrait ? 1.6 : aspect < 1.2 ? 1.2 : 1;
      const lookX = aspect < 1.2 ? s.look[0] * 0.3 : s.look[0];
      camera.position.set(
        lookX + (s.cam[0] - s.look[0]) * pull,
        s.look[1] + (s.cam[1] - s.look[1]) * pull,
        s.look[2] + (s.cam[2] - s.look[2]) * pull
      );
      look.set(lookX, s.look[1], s.look[2]);
      camera.lookAt(look);
      return;
    }

    // Manual inspection: one original jersey, larger; the camera belongs to OrbitControls
    if (b.phase === 'inspect') {
      const sel = film.current.sel;
      groups.current.forEach((g, i) => {
        if (!g) return;
        g.visible = i === sel;
        if (!g.visible) return;
        g.position.set(0, -0.02 * INSPECT_SCALE, 0);
        g.rotation.set(0, 0, 0);
        g.scale.setScalar(INSPECT_SCALE);
      });
      if (sel == null) {
        camera.position.set(0, 0.8, portrait ? 2.6 : 1.5);
        look.set(0, 0.85, -2.4);
        camera.lookAt(look);
      }
      return;
    }

    // Finale Lineup
    const f = t - FINAL_START;
    const spacing = 0.86;
    groups.current.forEach((g, i) => {
      if (!g) return;
      g.visible = true;
      const k = ease(THREE.MathUtils.clamp((f - 1.0 - i * 0.6) / 2.6, 0, 1));
      g.position.set((i - 1.5) * spacing, mix(-1.7, 0, k) + bob(i * 0.9) - 0.02, -Math.abs(i - 1.5) * 0.12);
      g.rotation.set(0, mix(-2.4, 0, k) + 0.18 * Math.sin(t * 0.35 + i * 0.6), 0);
      g.scale.setScalar(0.92);
    });

    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const fit = Math.max((1.5 * spacing + 0.5) / (tanH * aspect), 0.95 / tanH);
    const d = mix(fit * 0.6, fit, ease(THREE.MathUtils.clamp(f / 6, 0, 1))) + 0.12 * Math.sin(f * 0.2);
    camera.position.set(0.1 * Math.sin(f * 0.2), mix(-0.25, 0.16, ease(Math.min(1, f / 6))), d);
    look.set(0, 0.16, 0);
    camera.lookAt(look);
  });

  return clones.map((c, i) => (
    <group key={ORDER[i]} ref={(el) => { groups.current[i] = el; }} visible={false}>
      <primitive object={c} />
    </group>
  ));
}

// ─── Consolidated Cinematic Lighting (6 focused lights, zero closure allocations) ─
const LIGHT_BASE = [0.55, 0.35, 22, 7, 6, 6];
function Lights({ film }) {
  const ambRef = useRef();
  const hemiRef = useRef();
  const keyRef = useRef();
  const fillRef = useRef();
  const rimLRef = useRef();
  const rimRRef = useRef();

  useFrame(() => {
    const k = setLight(film.current.t);
    if (ambRef.current) ambRef.current.intensity = LIGHT_BASE[0] * k;
    if (hemiRef.current) hemiRef.current.intensity = LIGHT_BASE[1] * k;
    if (keyRef.current) keyRef.current.intensity = LIGHT_BASE[2] * k;
    if (fillRef.current) fillRef.current.intensity = LIGHT_BASE[3] * k;
    if (rimLRef.current) rimLRef.current.intensity = LIGHT_BASE[4] * k;
    if (rimRRef.current) rimRRef.current.intensity = LIGHT_BASE[5] * k;
  });

  return (
    <>
      <ambientLight ref={ambRef} color="#3a0d08" intensity={0} />
      <hemisphereLight ref={hemiRef} args={['#ffd8c0', '#200606', 0]} />
      <spotLight ref={keyRef} position={[1.2, 2.6, 2.4]} angle={0.5} penumbra={0.7} intensity={0} distance={8} decay={2} color="#fff1e2" />
      <spotLight ref={fillRef} position={[-1.4, 1.2, 2.2]} angle={0.6} penumbra={0.8} intensity={0} distance={7} decay={2} color="#ffe2cc" />
      <pointLight ref={rimLRef} position={[-1.7, 0.9, -0.9]} intensity={0} distance={6} decay={2} color="#ff2a10" />
      <pointLight ref={rimRRef} position={[1.7, 0.9, -0.9]} intensity={0} distance={6} decay={2} color="#ff5a1f" />
    </>
  );
}

function Ready({ onReady }) {
  useEffect(() => { onReady(); }, [onReady]);
  return null;
}

function SceneContent({ film, teams, onReady }) {
  const tex = useTexture({ sherle: ssEmblem, ratnagiri: rrEmblem, kotwade: kkrEmblem, malgund: mmgEmblem, hfpl: hfplEmblem });
  const gl = useThree((s) => s.gl);

  useMemo(() => {
    Object.values(tex).forEach((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
      gl.initTexture(t);
    });
  }, [tex, gl]);

  return (
    <>
      <IndustrialSet film={film} />
      <Atmosphere film={film} />
      <Searchlights film={film} />
      <Emblem film={film} textures={tex} />
      <Jerseys film={film} teams={teams} />
      <Ready onReady={onReady} />
    </>
  );
}

// ─── DOM Overlays & Cinematic Typography ─────────────────────────────────────────
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Michroma&family=Share+Tech+Mono&display=swap';
const CSS = `
.hfl-root{width:100vw;height:100vh;height:100dvh}
.hfl-title{font-family:'Michroma','Poppins',sans-serif;letter-spacing:.14em;text-transform:uppercase;font-weight:400}
.hfl-mono{font-family:'Share Tech Mono',ui-monospace,monospace}
.hfl-glitch{position:relative;display:inline-block;animation:hflIn 0.8s cubic-bezier(.16,1,.3,1) both}
.hfl-glitch.hfl-out,.hfl-out{animation:hflOut .6s ease both}
@keyframes hflIn{0%{opacity:0;transform:translateY(8px);filter:blur(4px)}100%{opacity:1;transform:none;filter:none}}
@keyframes hflOut{from{opacity:1;filter:none}to{opacity:0;filter:blur(4px);transform:translateY(-6px)}}
.hfl-fade{animation:hflFade 0.8s ease both}
.hfl-flash{background:radial-gradient(ellipse at 50% 42%,rgba(255,246,228,.85),rgba(255,214,150,.35) 45%,transparent 75%);animation:hflFlash .7s ease-out both}
@keyframes hflFlash{0%{opacity:0}12%{opacity:1}100%{opacity:0}}
.hfl-gold{background:linear-gradient(180deg,#fff6df 0%,#f5d27a 55%,#c9932f 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 22px rgba(255,190,90,.35))}
.hfl-track{animation:hflTrack 2.0s cubic-bezier(.16,.8,.2,1) both}
@keyframes hflTrack{from{opacity:0;letter-spacing:.45em;filter:blur(4px)}to{opacity:1;letter-spacing:.2em;filter:none}}
.hfl-line{animation:hflLine 1.8s cubic-bezier(.16,.8,.2,1) .3s both}@keyframes hflLine{from{opacity:0;transform:scaleX(0)}to{opacity:1;transform:none}}@keyframes hflFade{from{opacity:0}to{opacity:1}}
.hfl-black{transition:opacity .8s ease}
.hfl-rise{animation:hflRise 1.2s cubic-bezier(.16,1,.3,1) both}@keyframes hflRise{from{opacity:0;transform:translateY(12px);filter:blur(3px)}to{opacity:1;transform:none;filter:none}}
`;

function Glitch({ text, out = false, className = '' }) {
  return <span key={text} data-text={text} className={`hfl-glitch hfl-title ${out ? 'hfl-out' : ''} ${className}`}>{text}</span>;
}

const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function enterFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  try {
    const p = req && req.call(el, { navigationUI: 'hide' });
    if (p && p.catch) p.catch(() => {});
  } catch {}
}
function exitFullscreen() {
  const ex = document.exitFullscreen || document.webkitExitFullscreen;
  try {
    const p = isFullscreen() && ex && ex.call(document);
    if (p && p.catch) p.catch(() => {});
  } catch {}
}

// ─── Main Film Component ─────────────────────────────────────────────────────
export default function JerseyLaunchFilm({ teams, onBack, onExplore }) {
  const film = useRef({ t: 0, playing: false, ready: false, mode: 'film', sel: null });
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [beat, setBeat] = useState(beatAt(0));
  const [muted, setMuted] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const [fs, setFs] = useState(false);
  const [sel, setSel] = useState(null);
  if (import.meta.env.DEV && typeof window !== 'undefined') window.__hflFilm = film;   // dev-only QA seek hook
  const { progress } = useProgress();
  const ordered = useMemo(() => ORDER.map((id) => teams.find((t) => t.id === id)), [teams]);

  useEffect(() => {
    if (!document.getElementById('hfl-fonts')) {
      const l = document.createElement('link');
      l.id = 'hfl-fonts';
      l.rel = 'stylesheet';
      l.href = FONT_HREF;
      document.head.appendChild(l);
    }
    const onFs = () => setFs(isFullscreen());
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
      document.body.style.overflow = prevOverflow;
      suspenseAudio.stopAll();
    };
  }, []);

  const onReady = useCallback(() => {
    film.current.ready = true;
    setReady(true);
  }, []);

  // Audio cues on beat changes
  const prev = useRef(null);
  useEffect(() => {
    const p = prev.current;
    prev.current = beat;
    if (!audioOn || muted || !started) return;

    if (beat.phase === 'intro' && (!p || p.phase !== 'intro' || p.line !== beat.line)) {
      if (beat.line === 0) suspenseAudio.startSuspenseDrone();
      suspenseAudio.playImpact(beat.line === 4 ? 44 : 52, 1.6, 0.55);
      suspenseAudio.playWhoosh(1.0, 0.14);
    } else if (beat.phase === 'logo' && (!p || p.phase !== 'logo' || p.cue !== beat.cue)) {
      const c = beat.cue;
      if (c <= 1) { suspenseAudio.startSuspenseDrone(); suspenseAudio.startStadiumAmbience(); }   // darkness: rumble + distant crowd
      else if (c === 2) suspenseAudio.playImpact(50, 2.6, 0.32);                                 // controlled hits
      else if (c === 3) suspenseAudio.playImpact(44, 2.8, 0.45);
      else if (c === 4) suspenseAudio.playTensionRiser(REVEAL_AT - 11, 0.3);                      // rising tension into the reveal
      else if (c === 5) suspenseAudio.playLogoReveal();
      else if (c === 6) suspenseAudio.playWhoosh(1.6, 0.16);
    } else if (beat.phase === 'team' && (!p || p.phase !== 'team' || p.team !== beat.team)) {
      suspenseAudio.stopSuspenseDrone();
      suspenseAudio.stopStadiumAmbience(6);
      suspenseAudio.playImpact(40, 2.0, 0.75);
      if (beat.team === 0) suspenseAudio.startAnthem(0.4, 3.0);
    } else if (beat.phase === 'team' && p && p.caption !== beat.caption && beat.caption >= 0) {
      suspenseAudio.playWhoosh(0.8, 0.12);
    } else if (beat.phase === 'final' && p && p.phase !== 'final') {
      suspenseAudio.playClimaxHorn();
    }
  }, [beat, audioOn, muted, started]);

  const unlockAudio = () => {
    if (audioOn) return;
    suspenseAudio.init();
    suspenseAudio.resume();
    suspenseAudio.setMuted(muted);
    setAudioOn(true);
  };

  const begin = () => {
    enterFullscreen();
    unlockAudio();
    film.current.t = 0;
    film.current.playing = true;
    prev.current = null;
    setStarted(true);
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    unlockAudio();
    const m = !muted;
    setMuted(m);
    suspenseAudio.setMuted(m);
  };

  const toggleFs = (e) => {
    e.stopPropagation();
    if (isFullscreen()) exitFullscreen();
    else enterFullscreen();
  };

  const jump = (t) => {
    film.current.t = t;
    film.current.mode = 'film';
    film.current.playing = true;
  };

  const inspect = (i) => (e) => {
    e.stopPropagation();
    film.current.mode = 'film';
    film.current.t = FINAL_START;
    film.current.sel = i;
    setSel(i);
  };

  const showLineup = (e) => {
    e.stopPropagation();
    film.current.mode = 'lineup';
    film.current.t = FINAL_START;
    film.current.sel = null;
    setSel(null);
  };

  const replay = (e) => {
    e?.stopPropagation();
    suspenseAudio.stopAll();
    prev.current = null;
    film.current.sel = null;
    setSel(null);
    jump(0);
  };

  const skip = (e) => {
    e.stopPropagation();
    if (beat.phase === 'intro') jump(INTRO);
    else if (beat.phase === 'logo') jump(TEAMS_START);
    else if (beat.phase === 'team') jump(TEAMS_START + (beat.team + 1) * TEAM_LEN);
  };

  const team = beat.phase === 'team' ? ordered[beat.team] : null;
  const showBlack = !started || beat.phase === 'intro' || beat.fade;
  const hub = started && (beat.phase === 'inspect' || beat.phase === 'final');

  return (
    <div className="hfl-root fixed inset-0 m-0 p-0 bg-black text-white select-none overflow-hidden">
      <style>{CSS}</style>

      {/* Optimized Canvas: Capped DPR, Depth/Stencil optimized, powerPreference */}
      <Canvas
        dpr={[1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 1.35)]}
        camera={{ fov: 30, near: 0.1, far: 25, position: [0, 0.35, 3.4] }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.NeutralToneMapping,
          toneMappingExposure: 1.05,
          stencil: false,
          depth: true
        }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        <Environment />
        <Lights film={film} />
        <FilmClock film={film} onBeat={setBeat} />
        <Suspense fallback={null}>
          <SceneContent film={film} teams={teams} onReady={onReady} />
        </Suspense>
        {beat.phase === 'inspect' && sel != null && <InspectControls sel={sel} />}
      </Canvas>

      {/* Black layer: covers the set for the start screen, opening, soft cuts between scenes and end card */}
      <div className={`hfl-black absolute inset-0 bg-black pointer-events-none ${showBlack ? 'opacity-100' : 'opacity-0'}`} />

      {/* Opening statements */}
      {started && beat.phase === 'intro' && (
        <div className="absolute inset-0 flex items-center justify-center px-6 pointer-events-none">
          <Glitch text={INTRO_LINES[beat.line]} out={beat.out} className="text-center text-white text-lg sm:text-3xl md:text-4xl" />
        </div>
      )}

      {/* HFPL logo reveal: impact flash + title */}
      {beat.phase === 'logo' && beat.flash && <div className="hfl-flash absolute inset-0 pointer-events-none" />}
      {beat.phase === 'logo' && beat.title && (
        <div className={`absolute inset-x-0 bottom-[9vh] flex flex-col items-center pointer-events-none px-4 ${beat.titleOut ? 'hfl-out' : ''}`}>
          <span className="hfl-title hfl-track text-3xl sm:text-5xl md:text-6xl hfl-gold">HFPL 2027</span>
          <span className="hfl-line mt-4 h-px w-40 sm:w-64 bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
        </div>
      )}

      {/* Cinematic subtle vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.8)_100%)]" />

      {/* Team reveal typography */}
      {team && beat.name && (
        <div className="absolute inset-x-0 bottom-[16vh] flex flex-col items-center text-center px-4 pointer-events-none">
          <span className={`hfl-mono text-[11px] sm:text-xs tracking-[0.5em] text-orange-400 ${beat.nameOut ? 'hfl-out' : 'hfl-rise'}`}>TEAM 0{beat.team + 1} // {team.code}</span>
          <Glitch text={team.name} out={beat.nameOut} className="mt-3 text-xl sm:text-4xl md:text-5xl text-white drop-shadow-[0_0_24px_rgba(255,90,30,0.45)]" />
        </div>
      )}
      {team && beat.hud && (
        <div className="absolute left-4 sm:left-10 top-[8vh] pointer-events-none hfl-fade">
          <div className="hfl-mono text-[10px] sm:text-[11px] tracking-[0.4em] text-orange-400">HFPL 2027 // {team.code}</div>
          <div className="hfl-title text-sm sm:text-xl text-white mt-1">{team.name}</div>
        </div>
      )}
      {team && beat.caption >= 0 && (
        <div className="absolute inset-x-0 bottom-[9vh] flex justify-center pointer-events-none px-4">
          <Glitch text={CAPTIONS[beat.caption].text} out={beat.capOut} className="text-base sm:text-2xl md:text-3xl text-white drop-shadow-[0_0_18px_rgba(0,0,0,0.9)]" />
        </div>
      )}

      {/* Finale */}
      {beat.phase === 'final' && beat.title && (
        <div className="absolute inset-x-0 top-[8vh] flex flex-col items-center pointer-events-none px-4">
          <span className="hfl-mono text-[10px] sm:text-xs tracking-[0.55em] text-orange-400 hfl-rise">FOUR TEAMS. ONE PASSION.</span>
          <Glitch text="HFPL 2027" className="mt-2 text-4xl sm:text-6xl md:text-7xl text-white drop-shadow-[0_0_30px_rgba(255,100,30,0.55)]" />
        </div>
      )}
      {/* Manual hub: inspect any kit or open the final lineup. Nothing here is timed. */}
      {hub && beat.phase === 'inspect' && sel != null && (
        <div className="absolute left-4 sm:left-10 top-[8vh] pointer-events-none hfl-fade">
          <div className="hfl-mono text-[10px] sm:text-[11px] tracking-[0.4em] text-orange-400">INSPECT // {ordered[sel].code}</div>
          <div className="hfl-title text-sm sm:text-xl text-white mt-1">{ordered[sel].name}</div>
        </div>
      )}
      {hub && (
        <div className="absolute inset-x-0 bottom-[6.5vh] z-10 flex flex-col items-center gap-3 px-3 hfl-fade">
          <span className="hfl-mono text-[10px] sm:text-[11px] tracking-[0.4em] text-zinc-400 text-center">
            {beat.phase === 'final' ? 'FINAL LINEUP' : 'DRAG TO ROTATE  ·  SCROLL TO ZOOM'}
          </span>
          <div className="flex flex-wrap justify-center gap-2">
            {ordered.map((tm, i) => (
              <button key={tm.id} onClick={inspect(i)}
                className={`hfl-title text-[10px] sm:text-[11px] px-3.5 sm:px-4 py-2 rounded-lg border transition flex items-center gap-1.5 cursor-pointer backdrop-blur-md ${beat.phase === 'inspect' && sel === i ? 'border-orange-400 text-orange-300 bg-orange-500/15' : 'border-white/15 text-zinc-200 bg-black/50 hover:border-orange-400 hover:text-orange-300'}`}>
                <Search className="w-3 h-3" /> Inspect {tm.code}
              </button>
            ))}
            <button onClick={showLineup}
              className={`hfl-title text-[10px] sm:text-[11px] px-4 sm:px-5 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${beat.phase === 'final' ? 'bg-orange-500 text-black font-semibold' : 'bg-orange-600 hover:bg-orange-500 text-white'}`}>
              <Users className="w-3.5 h-3.5" /> Final Lineup
            </button>
          </div>
        </div>
      )}

      {/* Start screen: clean, minimal, premium */}
      {!started && (
        <div className="absolute inset-0 bg-black flex flex-col items-center justify-center px-6 text-center z-50">
          <img
            src={hfplEmblem}
            alt="HFPL 2027"
            className="w-24 sm:w-32 h-auto mb-6 drop-shadow-[0_0_35px_rgba(255,140,40,0.35)]"
          />
          <h1 className="hfl-title text-2xl sm:text-4xl md:text-5xl text-white tracking-[0.25em]">
            HFPL 2027
          </h1>
          <p className="hfl-mono text-xs sm:text-sm text-orange-400 tracking-[0.4em] uppercase mt-2">
            OFFICIAL JERSEY REVEAL
          </p>
          <button
            onClick={begin}
            disabled={!ready}
            className="hfl-title mt-10 px-8 sm:px-10 py-3.5 sm:py-4 text-xs sm:text-sm text-black bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 hover:brightness-110 disabled:opacity-40 transition font-bold tracking-widest shadow-[0_0_30px_rgba(251,191,36,0.3)] cursor-pointer rounded-full"
          >
            {ready ? "START REVEAL" : `LOADING ${Math.round(progress)}%`}
          </button>
        </div>
      )}

      {/* Discreet Header Controls */}
      <div className="absolute top-3 inset-x-4 sm:inset-x-8 flex items-center justify-between z-20 pointer-events-auto">
        <button
          onClick={(e) => { e.stopPropagation(); exitFullscreen(); onBack?.(); }}
          className="hfl-mono text-[11px] tracking-widest text-zinc-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 cursor-pointer transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> HUB
        </button>
        <div className="flex items-center gap-2">
          {started && (
            <button onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} className="p-2 text-zinc-400 hover:text-white rounded-full bg-black/40 backdrop-blur-md border border-white/10 cursor-pointer transition">
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
            </button>
          )}
          <button onClick={toggleFs} aria-label={fs ? 'Exit fullscreen' : 'Fullscreen'} className="p-2 text-zinc-400 hover:text-white rounded-full bg-black/40 backdrop-blur-md border border-white/10 cursor-pointer transition">
            {fs ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          {started && (beat.phase === 'intro' || beat.phase === 'logo') && (
            <button onClick={skip} className="hfl-title text-[10px] sm:text-[11px] px-3.5 py-1.5 rounded-full border border-white/15 bg-black/40 backdrop-blur-md text-zinc-200 hover:border-amber-400 hover:text-amber-300 transition flex items-center gap-1.5 cursor-pointer">
              Skip Intro <SkipForward className="w-3 h-3" />
            </button>
          )}
          {started && beat.phase === 'team' && (
            <button onClick={skip} className="hfl-title text-[10px] sm:text-[11px] px-3.5 py-1.5 rounded-full border border-white/15 bg-black/40 backdrop-blur-md text-zinc-200 hover:border-amber-400 hover:text-amber-300 transition flex items-center gap-1.5 cursor-pointer">
              Next <SkipForward className="w-3 h-3" />
            </button>
          )}
          {started && beat.phase !== 'intro' && (
            <button onClick={replay} className="hfl-title text-[10px] sm:text-[11px] px-3.5 py-1.5 rounded-full border border-white/15 bg-black/40 backdrop-blur-md text-zinc-200 hover:border-amber-400 hover:text-amber-300 transition flex items-center gap-1.5 cursor-pointer">
              <RotateCcw className="w-3 h-3" /> Replay
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
