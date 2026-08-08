import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { Apiendpointd } from '../../apiEndpoints';
import { ApiResponse } from '../../interfaces/api-response';
import { PropertyTreeCache } from '../../services/property-tree-cache.service';

export type PropNodeType =
  | 'compound'
  | 'building'
  | 'floor'
  | 'suite'
  | 'room'
  | 'facility'
  | 'gate'
  | 'parking'
  | 'elevator'
  | 'room_type'
  | 'facility_type';

export type LockableType = 'building' | 'floor' | 'suite' | 'room' | 'facility' | 'gate' | 'parking' | 'elevator';

export interface PropCompound {
  id: number;
  name: string;
  number?: string;
  active?: boolean;
}

export interface PropBuilding {
  id: number;
  name: string;
  number?: string;
  compound_id?: number | null;
  active?: boolean;
  floors?: PropFloor[];
  elevators?: PropElevator[];
  parkings?: PropParking[];
}

export interface PropFloor {
  id: number;
  number: number | string;
  building_id: number;
  active?: boolean;
  suites?: PropSuite[];
  rooms?: PropRoom[];
  facilities?: PropFacility[];
}

export interface PropSuite {
  id: number;
  number: string | number;
  name?: string;
  floor_id: number;
  active?: boolean;
  rooms?: PropRoom[];
}

export interface PropRoom {
  id: number;
  number: string;
  name?: string | null;
  capacity?: number;
  floor_id?: number | null;
  suite_id?: number | null;
  building_id?: number | null;
  room_type_id?: number | null;
  active?: boolean;
  room_type?: { id: number; name: string } | null;
  roomType?: { id: number; name: string } | null;
}

export interface PropFacility {
  id: number;
  name: string;
  floor_id: number;
  facilitie_type_id?: number;
  facility_type_id?: number;
  active?: boolean;
  facilitie_type?: { id: number; name: string } | null;
}

export interface PropGate {
  id: number;
  name: string;
  direction?: string;
  compound_id: number;
  building_id: number;
}

export interface PropParking {
  id: number;
  name: string;
  location?: string;
  capacity?: number;
  compound_id?: number | null;
  building_id?: number | null;
}

export interface PropElevator {
  id: number;
  name: string;
  capacity?: number;
  building_id: number;
}

export interface PropType {
  id: number;
  name: string;
  active?: boolean;
}

export interface PropLock {
  id: number;
  lockName?: string;
  lockAlias?: string;
  lockId?: string | number;
  lockMac?: string;
  electricQuantity?: number;
}

export interface PropTreeSnapshot {
  compounds: PropCompound[];
  buildings: PropBuilding[];
  gates: PropGate[];
  parkings: PropParking[];
  elevators: PropElevator[];
  roomTypes: PropType[];
  facilityTypes: PropType[];
  facilities: PropFacility[];
}

@Injectable({ providedIn: 'root' })
export class PropertyApiService {
  private readonly api = inject(ApiService);
  private readonly treeCache = inject(PropertyTreeCache);

  private unwrapList<T>(raw: unknown): T[] {
    if (Array.isArray(raw)) return raw as T[];
    const r = raw as { data?: T[] | { data?: T[] } };
    if (Array.isArray(r?.data)) return r.data;
    if (r?.data && Array.isArray((r.data as { data?: T[] }).data)) {
      return (r.data as { data: T[] }).data;
    }
    return [];
  }

  private data<T>(raw: unknown): T {
    return (raw as ApiResponse<T>)?.data as T;
  }

  private async mutate<T>(op: Promise<T>): Promise<T> {
    const result = await op;
    this.treeCache.invalidate();
    return result;
  }

  async loadTree(options?: { force?: boolean; allowStale?: boolean }): Promise<PropTreeSnapshot> {
    const bundle = await this.treeCache.getPropertyPageBundle(options);

    const buildings = (bundle.buildings ?? []) as PropBuilding[];

    const parkings: PropParking[] = [];
    const elevators: PropElevator[] = [];
    const facilities: PropFacility[] = [];
    for (const b of buildings) {
      for (const p of b.parkings || []) parkings.push(p);
      for (const e of b.elevators || []) elevators.push(e);
      for (const f of b.floors || []) {
        for (const fac of f.facilities || []) facilities.push(fac);
      }
    }

    return {
      compounds: (bundle.compounds ?? []) as PropCompound[],
      buildings,
      gates: (bundle.gates ?? []) as PropGate[],
      parkings,
      elevators,
      roomTypes: (bundle.roomTypes ?? []) as PropType[],
      facilityTypes: (bundle.facilityTypes ?? []) as PropType[],
      facilities,
    };
  }

  /** Lazy catalog refresh (room/facility types) without rebuilding the full tree. */
  async loadCatalogTypes(): Promise<{ roomTypes: PropType[]; facilityTypes: PropType[] }> {
    const [roomTypesRes, facilityTypesRes] = await Promise.all([
      this.api.get(Apiendpointd.roomTypes).catch(() => ({ data: [] })),
      this.api.get(Apiendpointd.facilityTypes).catch(() => ({ data: [] })),
    ]);
    return {
      roomTypes: this.unwrapList<PropType>(roomTypesRes),
      facilityTypes: this.unwrapList<PropType>(facilityTypesRes),
    };
  }

  // —— Compounds ——
  createCompound(body: { name: string; number: string }) {
    return this.mutate(this.api.post(Apiendpointd.compounds, body));
  }
  updateCompound(id: number, body: Partial<{ name: string; number: string }>) {
    return this.mutate(this.api.post(Apiendpointd.compoundById(id), body));
  }
  deleteCompound(id: number) {
    return this.mutate(this.api.delete(Apiendpointd.compoundById(id)));
  }
  activateCompound(id: number) {
    return this.mutate(this.api.post(Apiendpointd.activateCompound(id)));
  }
  inactivateCompound(id: number) {
    return this.mutate(this.api.post(Apiendpointd.inactivateCompound(id)));
  }

  // —— Buildings ——
  createBuilding(body: Record<string, unknown>) {
    return this.mutate(this.api.post(Apiendpointd.addBuildin, body));
  }
  updateBuilding(body: Record<string, unknown>) {
    return this.mutate(this.api.post(Apiendpointd.updateBuilding, body));
  }
  deleteBuilding(id: number) {
    return this.mutate(this.api.delete(`${Apiendpointd.deleteBuilding}?id_building=${id}`));
  }
  activateBuilding(id: number) {
    return this.mutate(this.api.post(Apiendpointd.activateBuilding(id)));
  }
  inactivateBuilding(id: number) {
    return this.mutate(this.api.post(Apiendpointd.inactivateBuilding(id)));
  }

  // —— Floors ——
  createFloor(body: { building_id: number; number: number | string }) {
    return this.mutate(this.api.post(Apiendpointd.addFloor, body));
  }
  updateFloor(body: Record<string, unknown>) {
    return this.mutate(this.api.post(Apiendpointd.updateFloor, body));
  }
  deleteFloor(id: number) {
    return this.mutate(this.api.delete(`${Apiendpointd.deleteFloor}?id_floor=${id}`));
  }
  activateFloor(id: number) {
    return this.mutate(this.api.post(Apiendpointd.activateFloor(id)));
  }
  inactivateFloor(id: number) {
    return this.mutate(this.api.post(Apiendpointd.inactivateFloor(id)));
  }

  // —— Suites (REST) ——
  createSuite(body: { floor_id: number; number: string; name: string }) {
    return this.mutate(this.api.post(Apiendpointd.suites, body));
  }
  updateSuite(id: number, body: Partial<{ floor_id: number; number: string; name: string }>) {
    return this.mutate(this.api.put(Apiendpointd.suiteById(id), body));
  }
  deleteSuite(id: number) {
    return this.mutate(this.api.delete(Apiendpointd.suiteById(id)));
  }
  activateSuite(id: number) {
    return this.mutate(this.api.post(Apiendpointd.activateSuite, { id }));
  }
  inactivateSuite(id: number) {
    return this.mutate(this.api.post(Apiendpointd.inactivateSuite, { id }));
  }

  // —— Rooms ——
  createRoom(body: Record<string, unknown>) {
    return this.mutate(this.api.post(Apiendpointd.rooms, body));
  }
  updateRoom(id: number, body: Record<string, unknown>) {
    return this.mutate(this.api.post(Apiendpointd.roomUpdate(id), body));
  }
  deleteRoom(id: number) {
    return this.mutate(this.api.delete(Apiendpointd.roomById(id)));
  }
  activateRoom(id: number) {
    return this.mutate(this.api.post(`${Apiendpointd.rooms}activate/${id}`));
  }
  inactivateRoom(id: number) {
    return this.mutate(this.api.post(Apiendpointd.inactivateRoom(id)));
  }

  // —— Facilities ——
  createFacility(body: { floor_id: number; name: string; facilitie_type_id: number }) {
    return this.mutate(
      this.api.post(Apiendpointd.facilities, {
        floor_id: body.floor_id,
        name: body.name,
        facility_type_id: body.facilitie_type_id,
      }),
    );
  }
  updateFacility(id: number, body: Record<string, unknown>) {
    return this.mutate(this.api.put(Apiendpointd.facilityById(id), body));
  }
  deleteFacility(id: number) {
    return this.mutate(this.api.delete(Apiendpointd.facilities + this.qs({ id })));
  }
  activateFacility(id: number) {
    return this.mutate(this.api.post(`${Apiendpointd.facilities}/activate`, { id }));
  }
  inactivateFacility(id: number) {
    return this.mutate(this.api.post(`${Apiendpointd.facilities}/inactivate`, { id }));
  }

  // —— Types ——
  createRoomType(body: { name: string }) {
    return this.mutate(this.api.post(Apiendpointd.roomTypes, body));
  }
  updateRoomType(id: number, body: { name: string }) {
    return this.mutate(this.api.put(Apiendpointd.roomTypeById(id), body));
  }
  deleteRoomType(id: number) {
    return this.mutate(this.api.delete(Apiendpointd.roomTypeById(id)));
  }
  createFacilityType(body: { name: string }) {
    return this.mutate(this.api.post(Apiendpointd.facilityTypes, body));
  }
  updateFacilityType(id: number, body: { name: string }) {
    return this.mutate(this.api.put(Apiendpointd.facilityTypeById(id), body));
  }
  deleteFacilityType(id: number) {
    return this.mutate(this.api.delete(Apiendpointd.facilityTypeById(id)));
  }

  // —— Side entities ——
  createGate(body: Record<string, unknown>) {
    return this.mutate(this.api.post(Apiendpointd.gates, body));
  }
  updateGate(id: number, body: Record<string, unknown>) {
    return this.mutate(this.api.post(Apiendpointd.gateById(id), body));
  }
  deleteGate(id: number) {
    return this.mutate(this.api.delete(Apiendpointd.gateById(id)));
  }
  createParking(body: Record<string, unknown>) {
    return this.mutate(this.api.post(Apiendpointd.parkings, body));
  }
  updateParking(id: number, body: Record<string, unknown>) {
    return this.mutate(this.api.post(Apiendpointd.parkingById(id), body));
  }
  deleteParking(id: number) {
    return this.mutate(this.api.delete(Apiendpointd.parkingById(id)));
  }
  createElevator(body: Record<string, unknown>) {
    return this.mutate(this.api.post(Apiendpointd.elevators, body));
  }
  updateElevator(id: number, body: Record<string, unknown>) {
    return this.mutate(this.api.post(Apiendpointd.elevatorById(id), body));
  }
  deleteElevator(id: number) {
    return this.mutate(this.api.delete(Apiendpointd.elevatorById(id)));
  }

  // —— Locks ——
  private locksAt = 0;
  private locksData: PropLock[] | null = null;
  private locksPromise: Promise<PropLock[]> | null = null;
  private static readonly LOCKS_TTL_MS = 60_000;

  listLocks(force = false): Promise<PropLock[]> {
    const fresh = Date.now() - this.locksAt < PropertyApiService.LOCKS_TTL_MS;
    if (!force && this.locksData && fresh) {
      return Promise.resolve(this.locksData);
    }
    if (!force && this.locksPromise) {
      return this.locksPromise;
    }

    this.locksPromise = this.api
      .get(Apiendpointd.locks)
      .then((r) => {
        const list = this.unwrapList<PropLock>(r);
        this.locksData = list;
        this.locksAt = Date.now();
        this.locksPromise = null;
        return list;
      })
      .catch((err) => {
        this.locksPromise = null;
        throw err;
      });

    return this.locksPromise;
  }

  getLock(id: number): Promise<
    PropLock & {
      rooms?: Array<{ id: number }>;
      buildings?: Array<{ id: number }>;
      facilities?: Array<{ id: number }>;
    }
  > {
    return this.api.get(Apiendpointd.lockById(id)).then((r) => {
      const data = (r as { data?: unknown })?.data;
      return (data || {}) as PropLock & {
        rooms?: Array<{ id: number }>;
        buildings?: Array<{ id: number }>;
        facilities?: Array<{ id: number }>;
      };
    });
  }

  getPropertyLocks(type: LockableType, id: number): Promise<PropLock[]> {
    return this.api.get(Apiendpointd.propertyLocks(type, id)).then((r) => this.unwrapList<PropLock>(r));
  }
  linkLocks(type: LockableType, id: number, lockIds: number[]) {
    return this.api.post(Apiendpointd.propertyLocks(type, id), { lock_ids: lockIds });
  }
  unlinkLocks(type: LockableType, id: number, lockIds: number[]) {
    return this.api.deleteWithBody(Apiendpointd.propertyLocks(type, id), { lock_ids: lockIds });
  }
  unlinkLock(type: LockableType, id: number, lockId: number) {
    return this.api.delete(Apiendpointd.propertyLockById(type, id, lockId));
  }
  syncLocks(type: LockableType, id: number, lockIds: number[]) {
    return this.api.put(Apiendpointd.propertyLocks(type, id), { lock_ids: lockIds });
  }

  private qs(body: Record<string, unknown>): string {
    const params = new URLSearchParams();
    Object.entries(body).forEach(([k, v]) => {
      if (v !== undefined && v !== null) params.set(k, String(v));
    });
    const s = params.toString();
    return s ? `?${s}` : '';
  }
}
