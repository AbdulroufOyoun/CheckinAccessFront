import {
  buildPropertyBuildingLayout,
  paletteFromHex,
  propertyBuildingLayoutCount,
  roomGridLayout,
  roomTypeColorIndex,
  roomTypeShowcaseLayout,
  shouldShowSideRoomGrids,
} from './onboarding-3d-floor-grid';
import { layoutSnapshotChanged } from './onboarding-3d-layout-animation';

describe('roomGridLayout', () => {
  it('returns at least one cell', () => {
    const g = roomGridLayout(4);
    expect(g.displayCount).toBe(4);
    expect(g.cols * g.rows).toBeGreaterThanOrEqual(4);
  });

  it('caps display grid for large room counts', () => {
    const g = roomGridLayout(100);
    expect(g.displayCount).toBeLessThanOrEqual(48);
    expect(g.totalRooms).toBe(100);
  });
});

describe('propertyBuildingLayoutCount', () => {
  it('matches compounds × buildings per compound', () => {
    expect(propertyBuildingLayoutCount({ compounds: 2, buildingsPerCompound: 3 })).toBe(6);
    expect(propertyBuildingLayoutCount({ compounds: 10, buildingsPerCompound: 10, maxBuildings: 36 })).toBe(
      36,
    );
  });
});

describe('shouldShowSideRoomGrids', () => {
  it('enables side facades when the grid grows', () => {
    expect(shouldShowSideRoomGrids(roomGridLayout(4))).toBe(false);
    expect(shouldShowSideRoomGrids(roomGridLayout(9))).toBe(true);
  });
});

describe('layoutSnapshotChanged', () => {
  it('detects compound and floor counter changes', () => {
    const prev = { compounds: 1, buildingsPerCompound: 1, floorsPerBuilding: 2, roomsPerFloor: 4 };
    expect(layoutSnapshotChanged(prev, { ...prev, compounds: 2 })).toBe(true);
    expect(layoutSnapshotChanged(prev, { ...prev, floorsPerBuilding: 3 })).toBe(true);
    expect(layoutSnapshotChanged(prev, { ...prev })).toBe(false);
  });
});

describe('roomTypeShowcaseLayout', () => {
  it('wraps to a second tier after four types', () => {
    const layout = roomTypeShowcaseLayout(9);
    expect(layout.slots.length).toBe(9);
    expect(layout.rows).toBe(3);
    expect(layout.slots[4].y).toBeGreaterThan(layout.slots[0].y);
  });

  it('keeps seven types on two rows', () => {
    const layout = roomTypeShowcaseLayout(7);
    expect(layout.slots.length).toBe(7);
    expect(layout.rows).toBe(2);
  });
});

describe('roomTypeColorIndex', () => {
  it('matches UI swatch index 0–7', () => {
    expect(roomTypeColorIndex('Deluxe')).toBeGreaterThanOrEqual(0);
    expect(roomTypeColorIndex('Deluxe')).toBeLessThan(8);
  });
});

describe('buildPropertyBuildingLayout', () => {
  it('adds one group child per rendered building', () => {
    const palette = paletteFromHex('#2563eb');
    const layout = buildPropertyBuildingLayout({
      compounds: 2,
      buildingsPerCompound: 2,
      floorsPerBuilding: 3,
      roomsPerFloor: 4,
      visual: 'tower',
      palette,
    });
    expect(layout.children.length).toBe(4);
  });
});
