import { RoomStatusItem } from '../services/room-status.service';

export interface SuiteRoomGroup {
  suiteId: number;
  suiteLabel: string;
  rooms: RoomStatusItem[];
}

export interface FloorRoomGroups {
  floorId: number | null;
  floorLabel: string;
  standalone: RoomStatusItem[];
  suites: SuiteRoomGroup[];
  roomCount: number;
}

export interface BuildingRoomGroups {
  buildingId: number | null;
  buildingName: string;
  floors: FloorRoomGroups[];
}

export interface RoomDisplayLabels {
  unknownBuilding: string;
  floorPrefix: string;
  noFloor: string;
}

export function sortRoomsByNumber(rooms: RoomStatusItem[]): RoomStatusItem[] {
  return [...rooms].sort((a, b) =>
    String(a.number).localeCompare(String(b.number), undefined, { numeric: true }),
  );
}

export function partitionRoomsBySuite(rooms: RoomStatusItem[]): {
  standalone: RoomStatusItem[];
  suites: SuiteRoomGroup[];
} {
  const standalone: RoomStatusItem[] = [];
  const suiteMap = new Map<number, SuiteRoomGroup>();

  for (const room of rooms) {
    const suiteId = room.suite?.id;
    if (suiteId) {
      let group = suiteMap.get(suiteId);
      if (!group) {
        group = {
          suiteId,
          suiteLabel: String(room.suite?.name || room.suite?.number || `#${suiteId}`),
          rooms: [],
        };
        suiteMap.set(suiteId, group);
      }
      group.rooms.push(room);
    } else {
      standalone.push(room);
    }
  }

  const suites = [...suiteMap.values()]
    .map((group) => ({ ...group, rooms: sortRoomsByNumber(group.rooms) }))
    .sort((a, b) => a.suiteLabel.localeCompare(b.suiteLabel, undefined, { numeric: true }));

  return { standalone: sortRoomsByNumber(standalone), suites };
}

export function groupRoomsByBuildingFloor(
  rooms: RoomStatusItem[],
  labels: RoomDisplayLabels,
): BuildingRoomGroups[] {
  type FloorBucket = { floorId: number | null; floorLabel: string; rooms: RoomStatusItem[] };
  const buildingMap = new Map<
    string,
    { buildingId: number | null; buildingName: string; floors: Map<string, FloorBucket> }
  >();

  for (const room of rooms) {
    const buildingId = room.building?.id ?? null;
    const buildingKey = String(buildingId ?? 'none');
    if (!buildingMap.has(buildingKey)) {
      buildingMap.set(buildingKey, {
        buildingId,
        buildingName: room.building?.name || labels.unknownBuilding,
        floors: new Map(),
      });
    }

    const building = buildingMap.get(buildingKey)!;
    const floorId = room.floor?.id ?? null;
    const floorKey = String(floorId ?? 'none');
    if (!building.floors.has(floorKey)) {
      building.floors.set(floorKey, {
        floorId,
        floorLabel: room.floor ? `${labels.floorPrefix} ${room.floor.number}` : labels.noFloor,
        rooms: [],
      });
    }
    building.floors.get(floorKey)!.rooms.push(room);
  }

  const result: BuildingRoomGroups[] = [];
  for (const building of buildingMap.values()) {
    const floors: FloorRoomGroups[] = [];
    for (const bucket of building.floors.values()) {
      const { standalone, suites } = partitionRoomsBySuite(bucket.rooms);
      floors.push({
        floorId: bucket.floorId,
        floorLabel: bucket.floorLabel,
        standalone,
        suites,
        roomCount: bucket.rooms.length,
      });
    }

    floors.sort((a, b) => a.floorLabel.localeCompare(b.floorLabel, undefined, { numeric: true }));
    result.push({
      buildingId: building.buildingId,
      buildingName: building.buildingName,
      floors,
    });
  }

  return result.sort((a, b) => a.buildingName.localeCompare(b.buildingName));
}

export function suiteAvailableCount(group: SuiteRoomGroup): number {
  return group.rooms.filter((room) => room.status === 'available').length;
}
