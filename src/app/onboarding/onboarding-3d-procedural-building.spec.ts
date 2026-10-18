import { describe, expect, it } from 'vitest';
import { paletteFromHex } from './onboarding-3d-floor-grid';
import {
  buildProceduralBlueprint,
  countTiersByKind,
  clampFloorCount,
} from './onboarding-3d-procedural-building';

describe('buildProceduralBlueprint', () => {
  const palette = paletteFromHex('#2563eb');

  it('clamps floor count between 1 and 20', () => {
    expect(clampFloorCount(0)).toBe(1);
    expect(clampFloorCount(99)).toBe(20);
  });

  it('hotel with 3 floors has base, middle floors, and roof tiers', () => {
    const { tiers } = buildProceduralBlueprint({
      buildingType: 'hotel',
      floorCount: 3,
      roomsPerFloor: 4,
      palette,
    });
    const counts = countTiersByKind(tiers);
    expect(counts.base).toBe(1);
    expect(counts.roof).toBe(1);
    expect(counts.floor).toBe(2);
  });

  it('hospital adds distinct floor tiers when floor count increases', () => {
    const low = buildProceduralBlueprint({
      buildingType: 'hospital',
      floorCount: 2,
      palette,
    });
    const high = buildProceduralBlueprint({
      buildingType: 'hospital',
      floorCount: 5,
      palette,
    });
    expect(countTiersByKind(high.tiers).floor).toBeGreaterThan(
      countTiersByKind(low.tiers).floor,
    );
  });

  it('student_housing produces line segments per tier', () => {
    const { tiers } = buildProceduralBlueprint({
      buildingType: 'student_housing',
      floorCount: 4,
      roomsPerFloor: 6,
      palette,
    });
    expect(tiers.length).toBeGreaterThan(2);
    expect(tiers.every((t) => t.lineObjects.length > 0)).toBe(true);
  });
});
