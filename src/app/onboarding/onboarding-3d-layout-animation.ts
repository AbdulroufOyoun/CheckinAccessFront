import * as THREE from 'three';

export interface LayoutSnapshot {
  compounds: number;
  buildingsPerCompound: number;
  floorsPerBuilding: number;
  roomsPerFloor: number;
}

export interface LayoutBuildingAnim {
  object: THREE.Object3D;
  startMs: number;
  duration: number;
  sx: number;
  sy: number;
  sz: number;
  fromSy: number;
  kind: 'pop' | 'rise';
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

export function layoutSnapshotChanged(prev: LayoutSnapshot, next: LayoutSnapshot): boolean {
  return (
    prev.compounds !== next.compounds
    || prev.buildingsPerCompound !== next.buildingsPerCompound
    || prev.floorsPerBuilding !== next.floorsPerBuilding
    || prev.roomsPerFloor !== next.roomsPerFloor
  );
}

/** Staggered pop-in for new buildings; vertical stretch when floors increase. */
export function startLayoutBuildingAnimations(
  layoutRoot: THREE.Group,
  prev: LayoutSnapshot,
  next: LayoutSnapshot,
  nowMs: number,
): LayoutBuildingAnim[] {
  const anims: LayoutBuildingAnim[] = [];
  const totalPrev = Math.max(0, prev.compounds) * Math.max(0, prev.buildingsPerCompound);
  const totalNext = next.compounds * next.buildingsPerCompound;
  const floorsUp = next.floorsPerBuilding > prev.floorsPerBuilding && prev.floorsPerBuilding > 0;
  const countUp = totalNext > totalPrev;
  const useRise = floorsUp && !countUp;

  layoutRoot.children.forEach((child, index) => {
    const base = child.scale.x || 1;
    const kind: 'pop' | 'rise' = useRise ? 'rise' : 'pop';
    let fromSy = base * 0.06;

    if (kind === 'rise') {
      fromSy = (prev.floorsPerBuilding / next.floorsPerBuilding) * base;
      child.scale.set(base, fromSy, base);
    } else {
      child.scale.setScalar(0.001);
    }

    const stagger = countUp ? index * 72 : index * 48;
    anims.push({
      object: child,
      startMs: nowMs + stagger,
      duration: kind === 'rise' ? 720 : countUp ? 620 : 540,
      sx: base,
      sy: base,
      sz: base,
      fromSy: kind === 'rise' ? fromSy : 0.001,
      kind,
    });
  });

  return anims;
}

export function tickLayoutBuildingAnimations(anims: LayoutBuildingAnim[], nowMs: number): boolean {
  let active = false;

  for (const anim of anims) {
    if (nowMs < anim.startMs) {
      active = true;
      continue;
    }

    let t = (nowMs - anim.startMs) / anim.duration;
    if (t >= 1) {
      anim.object.scale.set(anim.sx, anim.sy, anim.sz);
      continue;
    }

    active = true;
    if (anim.kind === 'rise') {
      const e = easeOutCubic(t);
      anim.object.scale.set(anim.sx, anim.fromSy + (anim.sy - anim.fromSy) * e, anim.sz);
    } else {
      const e = easeOutBack(Math.min(1, Math.max(0, t)));
      const s = 0.001 + (anim.sx - 0.001) * e;
      anim.object.scale.set(s, s, s);
    }
  }

  return active;
}
