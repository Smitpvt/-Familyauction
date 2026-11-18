// Runtime player name / number for hfpl_jersey.glb (Three.js, framework-agnostic).
//
// The GLB contains two separate meshes on the back of the jersey:
//   "PlayerName"   -> material "PlayerNameMaterial"
//   "PlayerNumber" -> material "PlayerNumberMaterial"
// Their textures are transparent PNGs, so swapping the texture changes the text
// without touching the permanent jersey artwork (material "JerseyPrint").
//
// Font: the default textures use "Alfa Slab One" (Google Fonts, heavy athletic slab).
// Add to index.html:
//   <link href="https://fonts.googleapis.com/css2?family=Alfa+Slab+One&display=swap" rel="stylesheet">

import * as THREE from 'three';

const DEFAULTS = {
  fontFamily: 'Alfa Slab One',
  fallbackFont: 'Impact, "Arial Black", sans-serif',
  fill: '#111111',        // letter colour (overridden by the team colours stored in the GLB)
  outline: '#ff6214',     // outline colour (overridden by the team colours stored in the GLB)
};

function findMaterial(root, name) {
  let found = null;
  root.traverse((o) => {
    if (!found && o.isMesh && o.material && o.material.name === name) found = o.material;
  });
  return found;
}

function drawText(text, width, height, opts) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  if (!text) return canvas;

  const family = `"${opts.fontFamily}", ${opts.fallbackFont}`;
  // Fit the text inside 96% width / 90% height, shrinking for long names.
  let size = Math.floor(height * 0.95);
  let stroke, w, asc, desc;
  for (;;) {
    ctx.font = `${size}px ${family}`;
    stroke = Math.max(3, Math.round(size / 30));
    const m = ctx.measureText(text);
    w = m.width + stroke * 2;
    asc = m.actualBoundingBoxAscent;
    desc = m.actualBoundingBoxDescent;
    if ((w <= width * 0.96 && asc + desc + stroke * 2 <= height * 0.9) || size < 12) break;
    size -= 4;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const x = width / 2;
  const y = height / 2 + (asc - desc) / 2;
  ctx.lineJoin = 'round';
  ctx.lineWidth = stroke * 2;          // stroke is centred on the path
  ctx.strokeStyle = opts.outline;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = opts.fill;
  ctx.fillText(text, x, y);
  return canvas;
}

function swapTexture(material, canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;                   // glTF UV convention
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const old = material.map;
  material.map = tex;
  material.transparent = true;
  material.needsUpdate = true;
  if (old && old !== tex) old.dispose();
}

/**
 * Set the player name and number on a loaded jersey.
 * @param {THREE.Object3D} root   gltf.scene (or a clone of it)
 * @param {{name?: string, number?: string|number}} player
 * @param {object} [options]      colours / font overrides
 */
export async function applyPlayerInfo(root, { name = '', number = '' } = {}, options = {}) {
  // Each team GLB stores its lettering colours in the root node's extras (-> userData).
  let teamColors = {};
  root.traverse((o) => {
    if (!teamColors.fill && o.userData && o.userData.nameFill) {
      teamColors = { fill: o.userData.nameFill, outline: o.userData.nameOutline };
    }
  });
  const opts = { ...DEFAULTS, ...teamColors, ...options };
  if (document.fonts && document.fonts.load) {
    try { await document.fonts.load(`64px "${opts.fontFamily}"`); } catch (_) { /* fallback font */ }
  }
  const nameMat = findMaterial(root, 'PlayerNameMaterial');
  const numMat = findMaterial(root, 'PlayerNumberMaterial');
  // Keep each texture's original aspect ratio (it matches the mesh area on the back).
  if (nameMat) {
    const { width = 1024, height = 360 } = nameMat.map?.image ?? {};
    swapTexture(nameMat, drawText(String(name).toUpperCase(), width, height, opts));
  }
  if (numMat) {
    const { width = 768, height = 664 } = numMat.map?.image ?? {};
    swapTexture(numMat, drawText(String(number), width, height, opts));
  }
}

/**
 * Each player card needs its own materials, otherwise all clones share one name.
 * Use this instead of gltf.scene.clone() when showing several jerseys at once.
 */
export function cloneJersey(scene) {
  const copy = scene.clone(true);
  copy.traverse((o) => {
    if (o.isMesh && /^Player(Name|Number)Material$/.test(o.material?.name)) {
      o.material = o.material.clone();
    }
  });
  return copy;
}
