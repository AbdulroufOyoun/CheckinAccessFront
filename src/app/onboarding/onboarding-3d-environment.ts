import * as THREE from 'three';

export type Onboarding3dEnvVariant = 'default' | 'roomTypes' | 'propertyLayout';

function hexLerp(a: string, b: string, t: number): string {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return `#${ca.lerp(cb, t).getHexString()}`;
}

/** Vertical sky gradient aligned with onboarding shell blues + tenant accent. */
export function makePropertyLayoutSkyTexture(accent: THREE.Color): THREE.CanvasTexture {
  const accentHex = `#${accent.getHexString()}`;
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#0a1220');
  grad.addColorStop(0.32, '#122038');
  grad.addColorStop(0.58, hexLerp('#1a3358', accentHex, 0.12));
  grad.addColorStop(0.82, hexLerp('#243d5c', accentHex, 0.18));
  grad.addColorStop(1, hexLerp('#1a2f4a', accentHex, 0.08));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 512);

  const glowColor = new THREE.Color(accentHex).lerp(new THREE.Color(0xffffff), 0.48);
  const grd2 = ctx.createRadialGradient(2, 440, 10, 2, 500, 240);
  grd2.addColorStop(
    0,
    `rgba(${Math.round(glowColor.r * 255)}, ${Math.round(glowColor.g * 255)}, ${Math.round(glowColor.b * 255)}, 0.2)`,
  );
  grd2.addColorStop(1, 'rgba(10, 18, 32, 0)');
  ctx.fillStyle = grd2;
  ctx.fillRect(0, 280, 4, 232);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Ground grid, site pad, and soft accent ring for layout step. */
export function buildPropertyLayoutEnvDecor(accent: THREE.Color): THREE.Group {
  const root = new THREE.Group();

  const grid = new THREE.GridHelper(26, 26, 0x5a7390, 0x354d66);
  const gridMat = grid.material as THREE.Material;
  gridMat.transparent = true;
  gridMat.opacity = 0.32;
  grid.position.y = 0.012;
  root.add(grid);

  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(9.5, 72),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x2a4563).lerp(accent, 0.06),
      roughness: 0.92,
      metalness: 0.02,
    }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.006;
  pad.receiveShadow = true;
  root.add(pad);

  const inner = new THREE.Mesh(
    new THREE.CircleGeometry(7.2, 64),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x324f6e).lerp(accent, 0.04),
      roughness: 0.9,
      metalness: 0,
    }),
  );
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.01;
  root.add(inner);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(8.8, 9.35, 80),
    new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.014;
  root.add(ring);

  const horizon = new THREE.Mesh(
    new THREE.RingGeometry(14, 22, 64),
    new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  horizon.rotation.x = -Math.PI / 2;
  horizon.position.y = 0.004;
  root.add(horizon);

  return root;
}

export function disposeEnvTexture(tex: THREE.Texture | null | undefined): void {
  tex?.dispose();
}
