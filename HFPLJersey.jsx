// Example React (Vite) usage with @react-three/fiber + @react-three/drei.
//   npm i three @react-three/fiber @react-three/drei
// Put hfpl_jersey_<team>.glb in /public/models/  (team = malgund | sherle | ratnagiri | kotwade).

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment } from '@react-three/drei';
import { applyPlayerInfo, cloneJersey } from './jerseyPlayerInfo';

const modelUrl = (team) => `/models/hfpl_jersey_${team}.glb`;

function Jersey({ team, name, number, autoRotate = true }) {
  const { scene } = useGLTF(modelUrl(team));
  const jersey = useMemo(() => cloneJersey(scene), [scene]); // own materials per card
  const ref = useRef();

  useEffect(() => {
    applyPlayerInfo(jersey, { name, number }); // team colours come from the GLB
  }, [jersey, name, number]);

  useFrame((_, dt) => {
    if (autoRotate && ref.current) ref.current.rotation.y += dt * 0.6; // 360° spin
  });

  return <primitive ref={ref} object={jersey} />;
}

export default function HFPLJersey({ team = 'sherle', name = 'SHRI', number = 21 }) {
  return (
    <Canvas camera={{ position: [0, 0.1, 2.1], fov: 30 }} style={{ height: 420 }}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[1, 2, 3]} intensity={1} />
      <Suspense fallback={null}>
        <Environment preset="studio" />
        <Jersey team={team} name={name} number={number} />
      </Suspense>
      <OrbitControls enablePan={false} minDistance={1.2} maxDistance={3.5} />
    </Canvas>
  );
}

['malgund', 'sherle', 'ratnagiri', 'kotwade'].forEach((t) => useGLTF.preload(modelUrl(t)));
