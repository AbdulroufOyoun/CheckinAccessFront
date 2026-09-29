import * as THREE from 'three';
import {
  Onboarding3dPalette,
  appendRoomGridToFace,
  roomGridLayout,
  shouldShowSideRoomGrids,
} from './onboarding-3d-floor-grid';

/** Preview accent colors aligned with backend presets (before apply). */
export const ESTABLISHMENT_PREVIEW_COLORS: Record<string, string> = {
  hotel: '#1d4ed8',
  serviced_apartments: '#7c3aed',
  residential_compound: '#0f766e',
  corporate_housing: '#0369a1',
  hospital: '#0284c7',
  student_housing: '#2563eb',
};

export function previewColorForPreset(presetId: string | null | undefined): string {
  return ESTABLISHMENT_PREVIEW_COLORS[presetId ?? ''] ?? '#2563eb';
}

function mat(color: THREE.ColorRepresentation, opts?: Partial<THREE.MeshStandardMaterialParameters>) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.58, metalness: 0.12, ...opts });
}

function windowRow(
  group: THREE.Group,
  y: number,
  z: number,
  count: number,
  w: number,
  palette: Onboarding3dPalette,
): void {
  const lit = mat(palette.roomLit, { emissive: palette.emissive, emissiveIntensity: 0.55 });
  const n = Math.max(1, Math.min(8, count));
  const start = -((n - 1) * w) / 2;
  for (let i = 0; i < n; i++) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.75, w * 0.55), lit);
    win.position.set(start + i * w, y, z);
    group.add(win);
  }
}

function clampFloors(floors: number): number {
  return Math.max(1, Math.min(20, floors));
}

function windowCountForRooms(roomsPerFloor: number): number {
  return roomGridLayout(roomsPerFloor).cols;
}

/** Same silhouettes as establishment step, driven by wizard floor/room counts. */
export function buildEstablishmentPropertyBuilding(
  presetId: string,
  floorsPerBuilding: number,
  roomsPerFloor: number,
  palette: Onboarding3dPalette,
  detailed: boolean,
): THREE.Group {
  switch (presetId) {
    case 'hospital':
      return scalePresetBuilding(buildHospital(palette), floorsPerBuilding, 2, palette, 1.05, 0.72, detailed, roomsPerFloor);
    case 'serviced_apartments':
      return buildApartments(palette, floorsPerBuilding, roomsPerFloor, detailed);
    case 'residential_compound':
      return buildSingleVilla(palette, floorsPerBuilding, roomsPerFloor, detailed);
    case 'corporate_housing':
      return scalePresetBuilding(buildCorporate(palette), floorsPerBuilding, 2.2, palette, 1.05, 0.72, detailed, roomsPerFloor);
    case 'student_housing':
      return scalePresetBuilding(buildStudentDorm(palette), floorsPerBuilding, 2, palette, 1.35, 0.72, detailed, roomsPerFloor);
    case 'hotel':
    default:
      return buildHotel(palette, floorsPerBuilding, roomsPerFloor, detailed);
  }
}

function scalePresetBuilding(
  model: THREE.Group,
  floors: number,
  refFloors: number,
  palette: Onboarding3dPalette,
  width: number,
  depth: number,
  detailed: boolean,
  roomsPerFloor: number,
): THREE.Group {
  const root = new THREE.Group();
  const scaleY = clampFloors(floors) / refFloors;
  model.scale.y = Math.max(0.55, Math.min(2.4, scaleY));
  root.add(model);
  if (detailed) {
    attachPropertyRoomGrids(root, clampFloors(floors), roomsPerFloor, palette, width, depth, 0.38);
  }
  return root;
}

function attachPropertyRoomGrids(
  building: THREE.Group,
  floors: number,
  roomsPerFloor: number,
  palette: Onboarding3dPalette,
  width: number,
  depth: number,
  floorH: number,
): void {
  const layout = roomGridLayout(roomsPerFloor);
  const sideGrids = shouldShowSideRoomGrids(layout);
  for (let f = 0; f < Math.min(floors, 12); f++) {
    const gridY = f * floorH + floorH * 0.08;
    appendRoomGridToFace(building, layout, palette, 'posZ', gridY, width, depth, 1);
    if (sideGrids) {
      appendRoomGridToFace(building, layout, palette, 'negZ', gridY, width, depth, 1);
      appendRoomGridToFace(building, layout, palette, 'posX', gridY, width, depth, 1);
      appendRoomGridToFace(building, layout, palette, 'negX', gridY, width, depth, 1);
    }
  }
}

/** Distinct readable silhouettes per establishment preset (establishment step defaults). */
export function buildEstablishmentModel(presetId: string, palette: Onboarding3dPalette): THREE.Group {
  if (presetId === 'residential_compound') {
    return buildCompound(palette);
  }
  return buildEstablishmentPropertyBuilding(presetId, 5, 4, palette, false);
}

function buildHotel(
  palette: Onboarding3dPalette,
  floorsPerBuilding: number,
  roomsPerFloor: number,
  detailed: boolean,
): THREE.Group {
  const g = new THREE.Group();
  const body = mat(palette.body);
  const accent = mat(palette.accent, { emissive: palette.emissive, emissiveIntensity: 0.15 });

  const floors = clampFloors(floorsPerBuilding);
  const floorH = 0.38;
  const w = 1.05;
  const d = 0.85;
  const wins = windowCountForRooms(roomsPerFloor);

  for (let f = 0; f < floors; f++) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, floorH * 0.85, d), f === floors - 1 ? accent : body);
    slab.position.y = f * floorH + floorH * 0.42;
    g.add(slab);
    windowRow(g, f * floorH + floorH * 0.42, d / 2 + 0.02, wins, 0.22, palette);
  }

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 0.55), accent);
  canopy.position.set(0, 0.12, 0.55);
  g.add(canopy);

  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.22, 0.06),
    mat(0xf8fafc, { emissive: palette.accent, emissiveIntensity: 0.25 }),
  );
  sign.position.set(0, floors * floorH * 0.55 + 0.35, d / 2 + 0.05);
  g.add(sign);

  if (detailed) {
    attachPropertyRoomGrids(g, floors, roomsPerFloor, palette, w, d, floorH);
  }

  return g;
}

function buildHospital(palette: Onboarding3dPalette): THREE.Group {
  const g = new THREE.Group();
  const body = mat(palette.body);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 1.35), body);
  wing.position.y = 0.38;
  g.add(wing);

  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 1.35, 0.85),
    mat(palette.accent, { emissive: palette.emissive, emissiveIntensity: 0.12 }),
  );
  tower.position.set(-0.55, 0.95, 0.15);
  g.add(tower);

  const crossV = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.45, 0.04),
    mat(0xdc2626, { emissive: 0x991b1b, emissiveIntensity: 0.4 }),
  );
  crossV.position.set(0.35, 0.55, 0.69);
  const crossH = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.12, 0.04),
    mat(0xdc2626, { emissive: 0x991b1b, emissiveIntensity: 0.4 }),
  );
  crossH.position.set(0.35, 0.55, 0.69);
  g.add(crossV, crossH);

  windowRow(g, 0.55, 0.69, 6, 0.28, palette);

  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.03, 0.4),
    mat(0x94a3b8, { emissive: 0x64748b, emissiveIntensity: 0.2 }),
  );
  pad.position.set(0.85, 0.02, 0.75);
  g.add(pad);

  return g;
}

function buildApartments(
  palette: Onboarding3dPalette,
  floorsPerBuilding: number,
  roomsPerFloor: number,
  detailed: boolean,
): THREE.Group {
  const g = new THREE.Group();
  const body = mat(palette.body);
  const accent = mat(palette.accent, { emissive: palette.emissive, emissiveIntensity: 0.12 });
  const floors = clampFloors(floorsPerBuilding);
  const wins = windowCountForRooms(roomsPerFloor);
  const floorH = 0.32;

  for (let f = 0; f < floors; f++) {
    const y = f * floorH + 0.16;
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.24, 0.7), body);
    core.position.y = y;
    g.add(core);
    const balcony = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.35), accent);
    balcony.position.set(0, y - 0.05, 0.42);
    g.add(balcony);
    windowRow(g, y, 0.36, wins, 0.24, palette);
  }

  if (detailed) {
    attachPropertyRoomGrids(g, floors, roomsPerFloor, palette, 0.75, 0.7, floorH);
  }

  return g;
}

function buildSingleVilla(
  palette: Onboarding3dPalette,
  floorsPerBuilding: number,
  roomsPerFloor: number,
  detailed: boolean,
): THREE.Group {
  const g = new THREE.Group();
  const body = mat(palette.body);
  const accent = mat(palette.accent, { emissive: palette.emissive, emissiveIntensity: 0.1 });
  const floors = clampFloors(floorsPerBuilding);
  const floorH = 0.32;
  const w = 0.75;
  const d = 0.65;

  for (let f = 0; f < floors; f++) {
    const y = f * floorH + 0.22;
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, floorH * 0.85, d), body);
    base.position.y = y;
    g.add(base);
  }

  const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.55, 0.28, 4), accent);
  roof.position.y = floors * floorH + 0.35;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);

  if (detailed) {
    attachPropertyRoomGrids(g, floors, roomsPerFloor, palette, w, d, floorH);
  }

  return g;
}

function buildCompound(palette: Onboarding3dPalette): THREE.Group {
  const g = new THREE.Group();
  const body = mat(palette.body);
  const accent = mat(palette.accent, { emissive: palette.emissive, emissiveIntensity: 0.1 });

  for (let i = 0; i < 3; i++) {
    const villa = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.45, 0.65), body);
    base.position.y = 0.22;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.28, 4), accent);
    roof.position.y = 0.58;
    roof.rotation.y = Math.PI / 4;
    villa.add(base, roof);
    const angle = (i - 1) * 0.85;
    villa.position.set(Math.sin(angle) * 1.5, 0, Math.cos(angle) * 0.9);
    villa.rotation.y = -angle;
    g.add(villa);
  }

  const wall = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 0.12), mat(palette.floorPlate));
  wall.position.set(0, 0.09, 1.15);
  g.add(wall);

  const gateL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), accent);
  gateL.position.set(-0.35, 0.28, 1.15);
  const gateR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), accent);
  gateR.position.set(0.35, 0.28, 1.15);
  g.add(gateL, gateR);

  return g;
}

function buildCorporate(palette: Onboarding3dPalette): THREE.Group {
  const g = new THREE.Group();
  const body = mat(palette.body);
  const glass = mat(palette.accent, {
    roughness: 0.2,
    metalness: 0.35,
    emissive: palette.emissive,
    emissiveIntensity: 0.18,
  });

  const lowL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.75), body);
  lowL.position.set(-0.75, 0.25, 0);
  const lowR = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.75), body);
  lowR.position.set(0.75, 0.25, 0);
  g.add(lowL, lowR);

  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.45, 0.55), glass);
  tower.position.set(0, 0.72, 0);
  g.add(tower);

  const plaza = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 1.2), mat(palette.floorPlate));
  plaza.position.y = 0.02;
  g.add(plaza);

  return g;
}

function buildStudentDorm(palette: Onboarding3dPalette): THREE.Group {
  const g = new THREE.Group();
  const body = mat(palette.body);
  const accent = mat(palette.accent, { emissive: palette.emissive, emissiveIntensity: 0.1 });

  const block = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.65, 0.8), body);
  block.position.y = 0.32;
  g.add(block);

  for (let i = 0; i < 8; i++) {
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(0.14, 0.12),
      mat(palette.roomLit, { emissive: palette.emissive, emissiveIntensity: 0.45 }),
    );
    win.position.set(-0.75 + (i % 4) * 0.5, 0.38 + Math.floor(i / 4) * 0.18, 0.41);
    g.add(win);
  }

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.9, 8), mat(0x64748b));
  pole.position.set(1.15, 0.45, 0.35);
  g.add(pole);

  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.22), accent);
  flag.position.set(1.32, 0.75, 0.35);
  flag.rotation.y = -0.35;
  g.add(flag);

  return g;
}
