import * as THREE from 'three';
import {
  BlueprintLineObject,
  BlueprintTier,
  blueprintAccent,
  blueprintStructure,
  boxBlueprintLines,
  createBlueprintTier,
  meshToBlueprintLines,
  tierGroupFromTier,
} from './onboarding-3d-edge-lines';
import {
  Onboarding3dPalette,
  roomTypeShowcaseLayout,
  roomTypeSwatchHex,
} from './onboarding-3d-floor-grid';

export interface RoomTypesBlueprintResult {
  root: THREE.Group;
  tiers: BlueprintTier[];
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
  if (segments.length === 0) {
    return;
  }
  const tier = createBlueprintTier(kind, index, yMin, yMax, segments);
  tiers.push(tier);
  root.add(tierGroupFromTier(tier));
}

function podBlueprintLines(
  label: string,
  active: boolean,
  podScale: number,
  dashed: boolean,
): BlueprintLineObject[] {
  const segs: BlueprintLineObject[] = [];
  const swatch = roomTypeSwatchHex(label);
  const baseStyle = blueprintStructure({ dashed });
  const accentStyle = blueprintAccent({ color: swatch, dashed });

  const h = active ? 0.56 : 0.46;
  const baseY = 0.07;

  segs.push(
    ...boxBlueprintLines(
      0.58 * podScale,
      h * podScale,
      0.44 * podScale,
      new THREE.Vector3(0, baseY + (h * podScale) / 2, 0),
      baseStyle,
    ),
  );
  segs.push(
    ...boxBlueprintLines(
      0.6 * podScale,
      0.09 * podScale,
      0.46 * podScale,
      new THREE.Vector3(0, baseY + h * podScale - 0.04 * podScale, 0),
      accentStyle,
    ),
  );
  segs.push(
    ...boxBlueprintLines(
      0.14 * podScale,
      0.22 * podScale,
      0.02,
      new THREE.Vector3(0, baseY + 0.14 * podScale, 0.225 * podScale),
      baseStyle,
    ),
  );
  segs.push(
    ...boxBlueprintLines(
      0.2 * podScale,
      0.16 * podScale,
      0.02,
      new THREE.Vector3(0.16 * podScale, baseY + h * podScale * 0.52, 0.221 * podScale),
      active ? accentStyle : baseStyle,
    ),
  );

  if (active) {
    const ringGeo = new THREE.RingGeometry(0.38 * podScale, 0.44 * podScale, 24);
    const ringMat = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
    ringMat.setPosition(0, 0.04, 0);
    segs.push(...meshToBlueprintLines(ringGeo, ringMat, accentStyle));
    ringGeo.dispose();
  }

  return segs;
}

/** Step 1 room-type pods as architectural line sketch (matches layout step blueprint). */
export function buildRoomTypesBlueprintShowcase(
  labels: string[],
  activeIndex: number,
  _palette: Onboarding3dPalette,
  dashed = true,
): RoomTypesBlueprintResult {
  const root = new THREE.Group();
  const tiers: BlueprintTier[] = [];
  const style = blueprintStructure({ dashed });
  const layout = roomTypeShowcaseLayout(labels.length);
  const podScale = labels.length > 14 ? 0.72 : labels.length > 10 ? 0.82 : labels.length > 7 ? 0.9 : 1;

  const stageRadius = 2.4 + layout.cols * 0.42 + layout.rows * 0.35;
  const stageGeo = new THREE.CylinderGeometry(stageRadius, stageRadius + 0.12, 0.07, 28);
  const stageMat = new THREE.Matrix4().makeTranslation(0, 0.035, 0);
  const baseSegs: BlueprintLineObject[] = [
    ...meshToBlueprintLines(stageGeo, stageMat, style),
  ];
  stageGeo.dispose();

  for (let row = 0; row < layout.rows; row++) {
    const itemsInRow = Math.min(layout.cols, labels.length - row * layout.cols);
    const shelfW = itemsInRow * 0.72 + 0.45;
    const anchor = layout.slots[row * layout.cols];
    const sy = (anchor?.y ?? 0) + 0.02;
    const sz = anchor?.z ?? 0;
    baseSegs.push(
      ...boxBlueprintLines(shelfW, 0.04, 0.55, new THREE.Vector3(0, sy, sz), style),
    );
  }

  pushTier(root, tiers, 'base', 0, 0, 0.12, baseSegs);

  labels.forEach((label, i) => {
    const slot = layout.slots[i];
    if (!slot) {
      return;
    }
    const podGroup = new THREE.Group();
    podGroup.position.set(slot.x, slot.y, slot.z);
    const lines = podBlueprintLines(label, i === activeIndex, podScale, dashed);
    const yMin = slot.y;
    const yMax = slot.y + 0.65 * podScale;
    const tier = createBlueprintTier('floor', i, yMin, yMax, lines);
    tiers.push(tier);
    podGroup.add(tierGroupFromTier(tier));
    root.add(podGroup);
  });

  root.userData['showcaseFocusY'] = layout.focusY;
  root.userData['showcaseCamDist'] = layout.camDist;

  return { root, tiers };
}
