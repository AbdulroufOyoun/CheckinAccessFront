import * as THREE from 'three';
import { Onboarding3dPalette, roomGridLayout } from './onboarding-3d-floor-grid';
import {
  BlueprintLineObject,
  BlueprintLineStyle,
  BlueprintTier,
  boxBlueprintLines,
  createBlueprintTier,
  tierGroupFromTier,
  blueprintAccent,
  blueprintFloor,
  blueprintStructure,
} from './onboarding-3d-edge-lines';

export type BuildingType =
  | 'hotel'
  | 'hospital'
  | 'student_housing'
  | 'residential_compound'
  | 'corporate_housing'
  | 'serviced_apartments';

export interface ProceduralBuildingOptions {
  buildingType: BuildingType | string;
  floorCount: number;
  roomsPerFloor?: number;
  detailed?: boolean;
  palette: Onboarding3dPalette;
  /** Start lines in dashed mode for reveal animation */
  dashed?: boolean;
}

export interface ProceduralBuildingResult {
  root: THREE.Group;
  tiers: BlueprintTier[];
}

const FLOOR_H = 0.38;
const ESTABLISHMENT_PREVIEW_FLOORS = 4;

export function establishmentPreviewFloorCount(): number {
  return ESTABLISHMENT_PREVIEW_FLOORS;
}

export function clampFloorCount(n: number): number {
  return Math.max(1, Math.min(20, Math.floor(n)));
}

function windowCount(roomsPerFloor: number): number {
  return Math.max(1, Math.min(8, roomGridLayout(roomsPerFloor).cols));
}

function addWindowRow(
  segments: BlueprintLineObject[],
  y: number,
  z: number,
  count: number,
  spacing: number,
  w: number,
  h: number,
  style: BlueprintLineStyle,
  originX = 0,
): void {
  const n = Math.max(1, count);
  const start = originX - ((n - 1) * spacing) / 2;
  for (let i = 0; i < n; i++) {
    segments.push(
      ...boxBlueprintLines(w, h, 0.04, new THREE.Vector3(start + i * spacing, y, z), style),
    );
  }
}

function pushTier(
  root: THREE.Group,
  tiers: BlueprintTier[],
  kind: BlueprintTier['kind'],
  index: number,
  yMin: number,
  yMax: number,
  segments: BlueprintLineObject[],
): void {
  const tier = createBlueprintTier(kind, index, yMin, yMax, segments);
  tiers.push(tier);
  root.add(tierGroupFromTier(tier));
}

/** Procedural blueprint sketch for onboarding previews. */
export function buildProceduralBlueprint(options: ProceduralBuildingOptions): ProceduralBuildingResult {
  const type = normalizeBuildingType(options.buildingType);
  const floors = clampFloorCount(options.floorCount);
  const rooms = options.roomsPerFloor ?? 4;
  const style = blueprintStructure({ dashed: options.dashed });
  const floorStyle = blueprintFloor({ dashed: options.dashed });
  const accentStyle = blueprintAccent({
    color: options.palette.accent,
    dashed: options.dashed,
  });

  switch (type) {
    case 'hospital':
      return buildHospitalBlueprint(floors, rooms, style, floorStyle, accentStyle);
    case 'student_housing':
      return buildStudentBlueprint(floors, rooms, style, floorStyle, accentStyle);
    case 'residential_compound':
      return buildVillaBlueprint(floors, rooms, style, floorStyle, accentStyle);
    case 'corporate_housing':
      return buildCorporateBlueprint(floors, rooms, style, floorStyle, accentStyle);
    case 'serviced_apartments':
      return buildApartmentBlueprint(floors, rooms, style, floorStyle, accentStyle);
    case 'hotel':
    default:
      return buildHotelBlueprint(floors, rooms, style, floorStyle, accentStyle);
  }
}

function normalizeBuildingType(id: string): BuildingType {
  const map: Record<string, BuildingType> = {
    hotel: 'hotel',
    hospital: 'hospital',
    student_housing: 'student_housing',
    residential_compound: 'residential_compound',
    corporate_housing: 'corporate_housing',
    serviced_apartments: 'serviced_apartments',
  };
  return map[id] ?? 'hotel';
}

function buildHotelBlueprint(
  floorCount: number,
  roomsPerFloor: number,
  style: BlueprintLineStyle,
  floor: BlueprintLineStyle,
  accent: BlueprintLineStyle,
): ProceduralBuildingResult {
  const root = new THREE.Group();
  const tiers: BlueprintTier[] = [];
  const podiumW = 1.72;
  const podiumD = 1.12;
  const towerW = 0.78;
  const towerD = 0.62;
  const wins = windowCount(roomsPerFloor);
  const baseSeg: BlueprintLineObject[] = [];

  baseSeg.push(
    ...boxBlueprintLines(podiumW, FLOOR_H * 0.7, podiumD, new THREE.Vector3(0, FLOOR_H * 0.35, 0), style),
  );
  baseSeg.push(
    ...boxBlueprintLines(0.42, 0.05, 0.28, new THREE.Vector3(0, FLOOR_H * 0.72, podiumD / 2 + 0.08), accent),
  );
  pushTier(root, tiers, 'base', 0, 0, FLOOR_H * 0.78, baseSeg);

  const towerFloors = Math.max(0, floorCount - 1);
  for (let f = 0; f < towerFloors; f++) {
    const y = FLOOR_H * 0.78 + f * FLOOR_H + FLOOR_H * 0.42;
    const segs: BlueprintLineObject[] = [];
    segs.push(...boxBlueprintLines(towerW, FLOOR_H * 0.82, towerD, new THREE.Vector3(0, y, -0.04), floor));
    addWindowRow(segs, y, towerD / 2 - 0.02, Math.min(3, wins), 0.2, 0.12, 0.1, floor);
    pushTier(root, tiers, 'floor', f, y - FLOOR_H * 0.42, y + FLOOR_H * 0.42, segs);
  }

  const roofY = FLOOR_H * 0.78 + towerFloors * FLOOR_H + 0.18;
  const roofSeg: BlueprintLineObject[] = [];
  roofSeg.push(
    ...boxBlueprintLines(towerW * 0.62, 0.22, towerD * 0.62, new THREE.Vector3(0, roofY, -0.04), accent),
  );
  pushTier(root, tiers, 'roof', 0, roofY - 0.12, roofY + 0.16, roofSeg);

  return { root, tiers };
}

function buildHospitalBlueprint(
  floorCount: number,
  roomsPerFloor: number,
  style: BlueprintLineStyle,
  floor: BlueprintLineStyle,
  accent: BlueprintLineStyle,
): ProceduralBuildingResult {
  const root = new THREE.Group();
  const tiers: BlueprintTier[] = [];
  const wins = Math.min(6, windowCount(roomsPerFloor) + 2);
  const wingW = 2.35;
  const wingD = 0.52;
  const stemW = 0.5;
  const stemD = 1.15;

  const baseSeg: BlueprintLineObject[] = [];
  baseSeg.push(
    ...boxBlueprintLines(wingW, FLOOR_H * 0.85, wingD, new THREE.Vector3(0, FLOOR_H * 0.42, 0.42), style),
  );
  baseSeg.push(
    ...boxBlueprintLines(stemW, FLOOR_H * 0.85, stemD, new THREE.Vector3(0, FLOOR_H * 0.42, -0.28), style),
  );
  baseSeg.push(
    ...boxBlueprintLines(0.7, 0.04, 0.32, new THREE.Vector3(0, FLOOR_H * 0.86, 0.78), accent),
  );
  pushTier(root, tiers, 'base', 0, 0, FLOOR_H * 0.9, baseSeg);

  const upper = Math.max(1, floorCount - 1);
  for (let f = 0; f < upper; f++) {
    const y = FLOOR_H * 0.9 + f * FLOOR_H + FLOOR_H * 0.42;
    const segs: BlueprintLineObject[] = [];
    segs.push(
      ...boxBlueprintLines(wingW, FLOOR_H * 0.8, wingD, new THREE.Vector3(0, y, 0.42), floor),
    );
    segs.push(
      ...boxBlueprintLines(stemW, FLOOR_H * 0.8, stemD, new THREE.Vector3(0, y, -0.28), floor),
    );
    addWindowRow(segs, y, 0.7, wins, 0.32, 0.14, 0.1, floor);
    pushTier(root, tiers, 'floor', f, y - FLOOR_H * 0.42, y + FLOOR_H * 0.42, segs);
  }

  const roofY = FLOOR_H * 0.9 + upper * FLOOR_H + 0.12;
  const roofSeg: BlueprintLineObject[] = [];
  roofSeg.push(
    ...boxBlueprintLines(wingW * 1.02, 0.04, wingD * 1.04, new THREE.Vector3(0, roofY, 0.42), style),
  );
  roofSeg.push(
    ...boxBlueprintLines(0.08, 0.28, 0.08, new THREE.Vector3(0.85, roofY + 0.14, 0.42), accent),
  );
  pushTier(root, tiers, 'roof', 0, roofY - 0.08, roofY + 0.3, roofSeg);

  return { root, tiers };
}

function buildStudentBlueprint(
  floorCount: number,
  roomsPerFloor: number,
  style: BlueprintLineStyle,
  floor: BlueprintLineStyle,
  accent: BlueprintLineStyle,
): ProceduralBuildingResult {
  const root = new THREE.Group();
  const tiers: BlueprintTier[] = [];
  const width = 2.55;
  const depth = 0.46;
  const wins = Math.min(10, windowCount(roomsPerFloor) + 4);

  const baseSeg: BlueprintLineObject[] = [];
  baseSeg.push(
    ...boxBlueprintLines(width, FLOOR_H * 0.55, depth, new THREE.Vector3(0, FLOOR_H * 0.28, 0), style),
  );
  baseSeg.push(
    ...boxBlueprintLines(0.28, 0.05, 0.16, new THREE.Vector3(0, FLOOR_H * 0.58, depth / 2 + 0.04), accent),
  );
  pushTier(root, tiers, 'base', 0, 0, FLOOR_H * 0.62, baseSeg);

  for (let f = 0; f < floorCount; f++) {
    const y = FLOOR_H * 0.62 + f * FLOOR_H + FLOOR_H * 0.4;
    const segs: BlueprintLineObject[] = [];
    segs.push(...boxBlueprintLines(width, FLOOR_H * 0.78, depth, new THREE.Vector3(0, y, 0), floor));
    addWindowRow(segs, y, depth / 2 + 0.02, wins, 0.22, 0.1, 0.1, floor);
    pushTier(root, tiers, 'floor', f, y - FLOOR_H * 0.4, y + FLOOR_H * 0.4, segs);
  }

  const roofY = FLOOR_H * 0.62 + floorCount * FLOOR_H + 0.08;
  const roofSeg: BlueprintLineObject[] = [];
  roofSeg.push(
    ...boxBlueprintLines(width * 1.01, 0.04, depth * 1.04, new THREE.Vector3(0, roofY, 0), style),
  );
  pushTier(root, tiers, 'roof', 0, roofY - 0.04, roofY + 0.06, roofSeg);

  return { root, tiers };
}

function buildVillaBlueprint(
  floorCount: number,
  _roomsPerFloor: number,
  style: BlueprintLineStyle,
  floor: BlueprintLineStyle,
  accent: BlueprintLineStyle,
): ProceduralBuildingResult {
  const root = new THREE.Group();
  const tiers: BlueprintTier[] = [];
  const levels = Math.min(Math.max(1, floorCount), 2);
  const villaW = 0.52;
  const villaD = 0.42;
  const spots: Array<[number, number]> = [
    [-0.72, 0.62],
    [0.72, 0.62],
    [-0.72, -0.58],
    [0.72, -0.58],
  ];

  const baseSeg: BlueprintLineObject[] = [];
  baseSeg.push(...boxBlueprintLines(1.15, 0.02, 1.05, new THREE.Vector3(0, 0.02, 0), accent));
  for (const [x, z] of spots) {
    baseSeg.push(
      ...boxBlueprintLines(villaW, FLOOR_H * 0.7, villaD, new THREE.Vector3(x, FLOOR_H * 0.35, z), style),
    );
  }
  pushTier(root, tiers, 'base', 0, 0, FLOOR_H * 0.72, baseSeg);

  for (let f = 1; f < levels; f++) {
    const y = FLOOR_H * 0.72 + (f - 1) * FLOOR_H + FLOOR_H * 0.38;
    const segs: BlueprintLineObject[] = [];
    for (const [x, z] of spots) {
      segs.push(
        ...boxBlueprintLines(villaW * 0.86, FLOOR_H * 0.72, villaD * 0.86, new THREE.Vector3(x, y, z), floor),
      );
    }
    pushTier(root, tiers, 'floor', f, y - FLOOR_H * 0.36, y + FLOOR_H * 0.36, segs);
  }

  const roofY = FLOOR_H * 0.72 + Math.max(0, levels - 1) * FLOOR_H + 0.16;
  const roofSeg: BlueprintLineObject[] = [];
  for (const [x, z] of spots) {
    roofSeg.push(
      ...boxBlueprintLines(0.06, 0.16, 0.06, new THREE.Vector3(x + 0.12, roofY, z), accent),
    );
  }
  pushTier(root, tiers, 'roof', 0, roofY - 0.08, roofY + 0.12, roofSeg);

  return { root, tiers };
}

function buildCorporateBlueprint(
  floorCount: number,
  _roomsPerFloor: number,
  style: BlueprintLineStyle,
  floor: BlueprintLineStyle,
  accent: BlueprintLineStyle,
): ProceduralBuildingResult {
  const root = new THREE.Group();
  const tiers: BlueprintTier[] = [];
  const cube = 1.05;

  const baseSeg: BlueprintLineObject[] = [];
  baseSeg.push(
    ...boxBlueprintLines(1.55, FLOOR_H * 0.45, 1.35, new THREE.Vector3(0, FLOOR_H * 0.22, 0), style),
  );
  pushTier(root, tiers, 'base', 0, 0, FLOOR_H * 0.48, baseSeg);

  for (let f = 0; f < floorCount; f++) {
    const y = FLOOR_H * 0.48 + f * FLOOR_H + FLOOR_H * 0.4;
    const segs: BlueprintLineObject[] = [];
    segs.push(...boxBlueprintLines(cube, FLOOR_H * 0.78, cube, new THREE.Vector3(0, y, 0), floor));
    addWindowRow(segs, y, cube / 2 + 0.02, 3, 0.28, 0.16, 0.12, floor);
    pushTier(root, tiers, 'floor', f, y - FLOOR_H * 0.4, y + FLOOR_H * 0.4, segs);
  }

  const roofY = FLOOR_H * 0.48 + floorCount * FLOOR_H + 0.06;
  const roofSeg: BlueprintLineObject[] = [];
  roofSeg.push(
    ...boxBlueprintLines(cube * 1.04, 0.035, cube * 1.04, new THREE.Vector3(0, roofY, 0), style),
  );
  pushTier(root, tiers, 'roof', 0, roofY - 0.04, roofY + 0.05, roofSeg);

  return { root, tiers };
}

function buildApartmentBlueprint(
  floorCount: number,
  roomsPerFloor: number,
  style: BlueprintLineStyle,
  floor: BlueprintLineStyle,
  accent: BlueprintLineStyle,
): ProceduralBuildingResult {
  const root = new THREE.Group();
  const tiers: BlueprintTier[] = [];
  const wins = Math.min(3, windowCount(roomsPerFloor));
  const tall = floorCount;
  const short = Math.max(1, floorCount - 1);
  const towerW = 0.48;
  const towerD = 0.62;

  const baseSeg: BlueprintLineObject[] = [];
  baseSeg.push(
    ...boxBlueprintLines(1.45, FLOOR_H * 0.4, 0.95, new THREE.Vector3(0, FLOOR_H * 0.2, 0), style),
  );
  pushTier(root, tiers, 'base', 0, 0, FLOOR_H * 0.42, baseSeg);

  const levels = Math.max(tall, short);
  for (let f = 0; f < levels; f++) {
    const y = FLOOR_H * 0.42 + f * FLOOR_H + FLOOR_H * 0.4;
    const segs: BlueprintLineObject[] = [];
    if (f < tall) {
      segs.push(
        ...boxBlueprintLines(towerW, FLOOR_H * 0.78, towerD, new THREE.Vector3(-0.38, y, 0.04), floor),
      );
      addWindowRow(segs, y, towerD / 2 + 0.06, wins, 0.14, 0.08, 0.09, floor, -0.38);
    }
    if (f < short) {
      segs.push(
        ...boxBlueprintLines(towerW, FLOOR_H * 0.78, towerD * 0.92, new THREE.Vector3(0.4, y, -0.08), floor),
      );
    }
    if (segs.length > 0) {
      pushTier(root, tiers, 'floor', f, y - FLOOR_H * 0.4, y + FLOOR_H * 0.4, segs);
    }
  }

  const roofY = FLOOR_H * 0.42 + tall * FLOOR_H + 0.1;
  const roofSeg: BlueprintLineObject[] = [];
  roofSeg.push(
    ...boxBlueprintLines(towerW * 0.7, 0.16, towerD * 0.55, new THREE.Vector3(-0.38, roofY, 0.04), accent),
  );
  roofSeg.push(
    ...boxBlueprintLines(towerW * 0.85, 0.04, towerD * 0.9, new THREE.Vector3(0.4, FLOOR_H * 0.42 + short * FLOOR_H + 0.04, -0.08), style),
  );
  pushTier(root, tiers, 'roof', 0, FLOOR_H * 0.42, roofY + 0.12, roofSeg);

  return { root, tiers };
}

/** Count tiers by kind (for tests). */
export function countTiersByKind(tiers: BlueprintTier[]): Record<BlueprintTier['kind'], number> {
  const out: Record<BlueprintTier['kind'], number> = { base: 0, floor: 0, roof: 0 };
  for (const t of tiers) {
    out[t.kind] += 1;
  }
  return out;
}
