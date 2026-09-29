import * as THREE from 'three';

export interface RoomGridLayout {
  cols: number;
  rows: number;
  displayCount: number;
  totalRooms: number;
}

/** Grid dimensions for floor plate visualization (capped for performance). */
export function roomGridLayout(roomCount: number, maxCols = 8, maxRows = 6): RoomGridLayout {
  const total = Math.max(1, roomCount);
  let cols = Math.ceil(Math.sqrt(total));
  let rows = Math.ceil(total / cols);
  if (cols > maxCols) {
    cols = maxCols;
    rows = Math.ceil(total / cols);
  }
  if (rows > maxRows) {
    rows = maxRows;
  }
  const displayCount = Math.min(total, cols * rows);
  return { cols, rows, displayCount, totalRooms: total };
}

export interface Onboarding3dPalette {
  body: THREE.Color;
  accent: THREE.Color;
  emissive: THREE.Color;
  roomLit: THREE.Color;
  roomDim: THREE.Color;
  floorPlate: THREE.Color;
}

/** Matches `prop-onb__type-swatch[data-idx]` in property-onboarding.css */
export const ROOM_TYPE_SWATCH_HEX = [
  '#2563eb',
  '#7c3aed',
  '#0d9488',
  '#ea580c',
  '#db2777',
  '#4f46e5',
  '#0891b2',
  '#65a30d',
] as const;

export function roomTypeColorIndex(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h << 5) - h + name.charCodeAt(i);
  }
  return Math.abs(h) % ROOM_TYPE_SWATCH_HEX.length;
}

export function roomTypeSwatchHex(label: string): string {
  return ROOM_TYPE_SWATCH_HEX[roomTypeColorIndex(label)] ?? ROOM_TYPE_SWATCH_HEX[0];
}

/** Facade palette aligned with onboarding glass panel (soft slate + tenant accent). */
export function paletteFromHex(hex: string | null | undefined): Onboarding3dPalette {
  const accent = new THREE.Color(hex && hex.startsWith('#') ? hex : '#2563eb');
  const body = new THREE.Color(0xe2e8f0);
  body.lerp(accent, 0.08);
  const roomDim = new THREE.Color(0xc7d2e0);
  roomDim.lerp(accent, 0.06);
  const roomLit = accent.clone().lerp(new THREE.Color(0xf8fafc), 0.62);
  const floorPlate = new THREE.Color(0xb8c5d6);
  floorPlate.lerp(accent, 0.05);
  const emissive = accent.clone().lerp(new THREE.Color(0xffffff), 0.35);
  return { body, accent, emissive, roomLit, roomDim, floorPlate };
}

export function hashStringToHue(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return ((h % 360) + 360) % 360;
}

type BuildingFace = 'posZ' | 'negZ' | 'posX' | 'negX';

function roomCellMaterial(palette: Onboarding3dPalette, lit = true): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: palette.roomDim,
    emissive: palette.roomLit,
    emissiveIntensity: lit ? 0.28 : 0.12,
    roughness: 0.52,
    metalness: 0.04,
  });
}

/** Room window grid on one facade of a floor slab. */
export function appendRoomGridToFace(
  parent: THREE.Group,
  layout: RoomGridLayout,
  palette: Onboarding3dPalette,
  face: BuildingFace,
  baseY: number,
  buildingWidth: number,
  buildingDepth: number,
  cellScale = 1,
): void {
  const pad = 0.05 * cellScale;
  const bandH = 0.34 * cellScale;
  const span =
    face === 'posZ' || face === 'negZ' ? buildingWidth * 0.94 * cellScale : buildingDepth * 0.9 * cellScale;
  const cellW = (span - pad * 2) / layout.cols;
  const cellH = (bandH - pad * 2) / layout.rows;
  const halfW = buildingWidth / 2;
  const halfD = buildingDepth / 2;
  const inset = 0.055 * cellScale;

  for (let i = 0; i < layout.displayCount; i++) {
    const col = i % layout.cols;
    const row = Math.floor(i / layout.cols);
    const mat = roomCellMaterial(palette, row % 2 === col % 2);

    if (face === 'posZ' || face === 'negZ') {
      const startX = -span / 2 + pad + cellW / 2;
      const cell = new THREE.Mesh(new THREE.BoxGeometry(cellW * 0.82, cellH * 0.78, 0.035), mat);
      const z = face === 'posZ' ? halfD + inset : -halfD - inset;
      cell.position.set(startX + col * cellW, baseY + pad + cellH / 2, z);
      parent.add(cell);
      continue;
    }

    const startZ = -span / 2 + pad + cellW / 2;
    const cell = new THREE.Mesh(new THREE.BoxGeometry(0.035, cellH * 0.78, cellW * 0.82), mat);
    const x = face === 'posX' ? halfW + inset : -halfW - inset;
    cell.position.set(x, baseY + pad + cellH / 2, startZ + col * cellW);
    parent.add(cell);
  }
}

export function shouldShowSideRoomGrids(layout: RoomGridLayout): boolean {
  return layout.displayCount >= 6 || layout.cols >= 3 || layout.rows >= 2;
}

/** @deprecated use appendRoomGridToFace */
export function appendRoomGridToFloor(
  parent: THREE.Group,
  layout: RoomGridLayout,
  palette: Onboarding3dPalette,
  faceZ: number,
  baseY: number,
  cellScale = 1,
): void {
  const depth = 0.72;
  appendRoomGridToFace(parent, layout, palette, 'posZ', baseY, 1.05 * cellScale, depth, cellScale);
  void faceZ;
}

/** Stacked floors with visible room grid on the hero face. */
export function buildStackedBuilding(
  floors: number,
  roomsPerFloor: number,
  visual: string,
  palette: Onboarding3dPalette,
  detailed: boolean,
): THREE.Group {
  const root = new THREE.Group();
  const floorCount = Math.max(1, Math.min(20, floors));
  const layout = roomGridLayout(roomsPerFloor);
  const floorH = visual === 'compound' ? 0.32 : 0.42;
  const bodyMat = new THREE.MeshStandardMaterial({
    color: palette.body,
    roughness: 0.78,
    metalness: 0.04,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: palette.accent,
    emissive: palette.emissive,
    emissiveIntensity: 0.06,
    roughness: 0.45,
  });
  const plateMat = new THREE.MeshStandardMaterial({
    color: palette.floorPlate,
    roughness: 0.82,
    metalness: 0.02,
  });

  const width = visual === 'hostel' || visual === 'institutional' ? 1.35 : 1.05;
  const depth = 0.72;

  for (let f = 0; f < floorCount; f++) {
    const y = f * floorH;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(width, floorH * 0.88, depth), f === floorCount - 1 ? accentMat : bodyMat);
    slab.position.y = y + floorH * 0.44;
    root.add(slab);

    const plateFront = new THREE.Mesh(new THREE.BoxGeometry(width * 0.96, floorH * 0.75, 0.05), plateMat);
    plateFront.position.set(0, y + floorH * 0.44, depth / 2 + 0.02);
    root.add(plateFront);

    if (detailed) {
      const gridY = y + floorH * 0.1;
      const sideGrids = shouldShowSideRoomGrids(layout);
      appendRoomGridToFace(root, layout, palette, 'posZ', gridY, width, depth, 1);
      if (sideGrids) {
        appendRoomGridToFace(root, layout, palette, 'negZ', gridY, width, depth, 1);
        appendRoomGridToFace(root, layout, palette, 'posX', gridY, width, depth, 1);
        appendRoomGridToFace(root, layout, palette, 'negX', gridY, width, depth, 1);
        const plateBack = new THREE.Mesh(new THREE.BoxGeometry(width * 0.96, floorH * 0.75, 0.05), plateMat);
        plateBack.position.set(0, y + floorH * 0.44, -depth / 2 - 0.02);
        root.add(plateBack);
        const plateSideL = new THREE.Mesh(new THREE.BoxGeometry(0.05, floorH * 0.75, depth * 0.92), plateMat);
        plateSideL.position.set(-width / 2 - 0.02, y + floorH * 0.44, 0);
        root.add(plateSideL);
        const plateSideR = new THREE.Mesh(new THREE.BoxGeometry(0.05, floorH * 0.75, depth * 0.92), plateMat);
        plateSideR.position.set(width / 2 + 0.02, y + floorH * 0.44, 0);
        root.add(plateSideR);
      }
    }
  }

  if (visual === 'tower' || visual === 'mixed') {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(width * 1.02, 0.08, depth * 1.02), accentMat);
    cap.position.y = floorCount * floorH + 0.04;
    root.add(cap);
  }

  if (visual === 'compound') {
    const roof = new THREE.Mesh(new THREE.ConeGeometry(width * 0.55, 0.28, 4), accentMat);
    roof.position.y = floorCount * floorH + 0.2;
    roof.rotation.y = Math.PI / 4;
    root.add(roof);
  }

  return root;
}

export interface PropertyBuildingLayoutInput {
  compounds: number;
  buildingsPerCompound: number;
  floorsPerBuilding: number;
  roomsPerFloor: number;
  visual: string;
  palette: Onboarding3dPalette;
  /** When set, builds each unit with the establishment silhouette (see scene). */
  buildUnit?: (
    floorsPerBuilding: number,
    roomsPerFloor: number,
    palette: Onboarding3dPalette,
  ) => THREE.Group;
  layoutSpacing?: number;
  /** Hard cap to keep WebGL responsive in the wizard. */
  maxBuildings?: number;
}

/** Places one stacked building per compound × buildings-per-compound (matches wizard counters). */
export function buildPropertyBuildingLayout(input: PropertyBuildingLayoutInput): THREE.Group {
  const {
    compounds,
    buildingsPerCompound,
    floorsPerBuilding,
    roomsPerFloor,
    visual,
    palette,
    buildUnit,
    layoutSpacing: layoutSpacingInput,
    maxBuildings = 36,
  } = input;

  const layoutSpacing =
    layoutSpacingInput ?? (visual === 'compound' ? 1.05 : 1.25);

  const root = new THREE.Group();
  const compoundCount = Math.max(1, compounds);
  const perCompound = Math.max(1, buildingsPerCompound);
  const total = compoundCount * perCompound;
  const toRender = Math.min(total, maxBuildings);
  const scale = total > 16 ? 0.82 : total > 9 ? 0.92 : 1;

  let index = 0;
  for (let c = 0; c < compoundCount && index < toRender; c++) {
    const compoundAngle =
      compoundCount === 1 ? 0 : (c / compoundCount) * Math.PI * 2 - Math.PI / 2;
    const compoundRadius =
      compoundCount === 1 ? 0 : 2.4 + Math.min(perCompound, 6) * 0.22 + compoundCount * 0.12;
    const cx = Math.cos(compoundAngle) * compoundRadius;
    const cz = Math.sin(compoundAngle) * compoundRadius * 0.72;

    const cols = Math.max(1, Math.ceil(Math.sqrt(perCompound)));
    for (let b = 0; b < perCompound && index < toRender; b++) {
      const building = buildUnit
        ? buildUnit(floorsPerBuilding, roomsPerFloor, palette)
        : buildStackedBuilding(floorsPerBuilding, roomsPerFloor, visual, palette, true);
      building.scale.setScalar(scale);

      const row = Math.floor(b / cols);
      const col = b % cols;
      const spacing = layoutSpacing * scale;
      const rows = Math.ceil(perCompound / cols);
      const offsetX = (col - (cols - 1) / 2) * spacing;
      const offsetZ = (row - (rows - 1) / 2) * spacing * 0.9;

      building.position.set(cx + offsetX, 0, cz + offsetZ);
      if (visual === 'compound' && compoundCount > 1) {
        building.rotation.y = compoundAngle + Math.PI / 2;
      }
      root.add(building);
      index++;
    }
  }

  return root;
}

export function propertyBuildingLayoutCount(input: {
  compounds: number;
  buildingsPerCompound: number;
  maxBuildings?: number;
}): number {
  const total = Math.max(1, input.compounds) * Math.max(1, input.buildingsPerCompound);
  return Math.min(total, input.maxBuildings ?? 36);
}

export interface RoomTypeShowcaseSlot {
  x: number;
  y: number;
  z: number;
}

export interface RoomTypeShowcaseLayout {
  cols: number;
  rows: number;
  slots: RoomTypeShowcaseSlot[];
  focusY: number;
  camDist: number;
}

/** Grid: fill a row left-to-right, then stack the next row above (Y) with slight depth (Z). */
export function roomTypeShowcaseLayout(count: number, maxCols = 4): RoomTypeShowcaseLayout {
  const n = Math.max(1, count);
  const cols = Math.min(maxCols, n);
  const rows = Math.ceil(n / cols);
  const gapX = n > 12 ? 0.58 : n > 8 ? 0.65 : 0.72;
  const tierStepY = n > 12 ? 0.52 : 0.58;
  const tierStepZ = 0.32;

  const slots: RoomTypeShowcaseSlot[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const itemsInRow = Math.min(cols, n - row * cols);
    const startX = -((itemsInRow - 1) * gapX) / 2;
    slots.push({
      x: startX + col * gapX,
      y: row * tierStepY,
      z: row * tierStepZ,
    });
  }

  const focusY = 0.22 + ((rows - 1) * tierStepY) / 2 + 0.18;
  const camDist = 7.2 + cols * 0.38 + rows * 0.62;

  return { cols, rows, slots, focusY, camDist };
}

function buildRoomTypePod(
  label: string,
  active: boolean,
  palette: Onboarding3dPalette,
  podScale: number,
): THREE.Group {
  const pod = new THREE.Group();
  pod.scale.setScalar(podScale);

  const swatch = roomTypeSwatchHex(label);
  const h = active ? 0.56 : 0.46;
  const wallColor = new THREE.Color(swatch).lerp(new THREE.Color(0xffffff), 0.42);

  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, h, 0.44),
    new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.62, metalness: 0.03 }),
  );
  walls.position.y = 0.07 + h / 2;

  const band = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.09, 0.46),
    new THREE.MeshStandardMaterial({
      color: swatch,
      emissive: new THREE.Color(swatch),
      emissiveIntensity: active ? 0.32 : 0.1,
      roughness: 0.4,
    }),
  );
  band.position.y = 0.07 + h - 0.04;

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.22, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 }),
  );
  door.position.set(0, 0.07 + 0.14, 0.225);

  const window = new THREE.Mesh(
    new THREE.PlaneGeometry(0.2, 0.16),
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: palette.roomLit,
      emissiveIntensity: active ? 0.42 : 0.18,
      roughness: 0.35,
    }),
  );
  window.position.set(0.16, 0.07 + h * 0.52, 0.221);

  pod.add(walls, band, door, window);

  if (active) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.38, 0.44, 36),
      new THREE.MeshStandardMaterial({
        color: swatch,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    pod.add(ring);
  }

  return pod;
}

/** Step 1: mini room pods colored like UI type swatches. */
export function buildRoomTypesShowcase(
  labels: string[],
  activeIndex: number,
  palette: Onboarding3dPalette,
): THREE.Group {
  const root = new THREE.Group();
  const layout = roomTypeShowcaseLayout(labels.length);
  const podScale = labels.length > 14 ? 0.72 : labels.length > 10 ? 0.82 : labels.length > 7 ? 0.9 : 1;

  const stageRadius = 2.4 + layout.cols * 0.42 + layout.rows * 0.35;
  const stage = new THREE.Mesh(
    new THREE.CylinderGeometry(stageRadius, stageRadius + 0.12, 0.07, 40),
    new THREE.MeshStandardMaterial({
      color: 0xb8c5d6,
      roughness: 0.88,
      metalness: 0.02,
    }),
  );
  stage.position.y = 0.035;
  root.add(stage);

  const shelfMat = new THREE.MeshStandardMaterial({ color: 0xa8b8cc, roughness: 0.86, metalness: 0.02 });
  for (let row = 0; row < layout.rows; row++) {
    const itemsInRow = Math.min(layout.cols, labels.length - row * layout.cols);
    const shelfW = itemsInRow * 0.72 + 0.45;
    const anchor = layout.slots[row * layout.cols];
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(shelfW, 0.04, 0.55), shelfMat);
    shelf.position.set(0, (anchor?.y ?? 0) + 0.02, anchor?.z ?? 0);
    root.add(shelf);
  }

  labels.forEach((label, i) => {
    const slot = layout.slots[i];
    if (!slot) {
      return;
    }
    const pod = buildRoomTypePod(label, i === activeIndex, palette, podScale);
    pod.position.set(slot.x, slot.y, slot.z);
    root.add(pod);
  });

  root.userData['showcaseFocusY'] = layout.focusY;
  root.userData['showcaseCamDist'] = layout.camDist;

  return root;
}

export function buildMiniSilhouette(palette: Onboarding3dPalette, scale = 0.45): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: palette.body,
    roughness: 0.8,
    transparent: true,
    opacity: 0.55,
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.5 * scale, 0.9 * scale, 0.45 * scale), mat);
  m.position.y = 0.45 * scale;
  g.add(m);
  return g;
}
