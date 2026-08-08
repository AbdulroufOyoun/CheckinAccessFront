import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Apiendpointd } from '../apiEndpoints';
import { ApiResponse } from '../interfaces/api-response';

export interface PropertyPageBundle {
  compounds: Array<{ id: number; name: string; number?: string; active?: boolean }>;
  buildings: Array<{
    id: number;
    name: string;
    number?: string;
    compound_id?: number | null;
    active?: boolean;
    floors?: Array<{
      id: number;
      number: number | string;
      building_id: number;
      active?: boolean;
      suites?: unknown[];
      rooms?: unknown[];
      facilities?: unknown[];
    }>;
    parkings?: unknown[];
    elevators?: unknown[];
  }>;
  gates: Array<{ id: number; name: string; direction?: string; compound_id: number; building_id: number }>;
  roomTypes: Array<{ id: number; name: string; active?: boolean }>;
  facilityTypes: Array<{ id: number; name: string; active?: boolean }>;
}

/** Short-lived in-memory cache for property tree payloads. */
@Injectable({ providedIn: 'root' })
export class PropertyTreeCache {
  private readonly api = inject(ApiService);

  private readonly ttlMs = 60_000;

  private pageAt = 0;
  private pageData: PropertyPageBundle | null = null;
  private pagePromise: Promise<PropertyPageBundle> | null = null;

  private buildingDataAt = 0;
  private buildingDataPromise: Promise<unknown> | null = null;
  private buildingData: unknown = null;

  private compoundsAt = 0;
  private compoundsPromise: Promise<unknown> | null = null;
  private compoundsAll: unknown = null;

  invalidate(): void {
    this.pageAt = 0;
    this.pageData = null;
    this.pagePromise = null;
    this.buildingDataAt = 0;
    this.buildingData = null;
    this.buildingDataPromise = null;
    this.compoundsAt = 0;
    this.compoundsAll = null;
    this.compoundsPromise = null;
  }

  peekPropertyPageBundle(): PropertyPageBundle | null {
    return this.pageData;
  }

  async getPropertyPageBundle(
    options?: { force?: boolean; allowStale?: boolean },
  ): Promise<PropertyPageBundle> {
    const force = options?.force === true;
    const allowStale = options?.allowStale !== false;
    const fresh = Date.now() - this.pageAt < this.ttlMs;

    if (!force && this.pageData && fresh) {
      return this.pageData;
    }

    if (!force && allowStale && this.pageData) {
      void this.fetchPropertyPageBundle();
      return this.pageData;
    }

    return this.fetchPropertyPageBundle();
  }

  private fetchPropertyPageBundle(): Promise<PropertyPageBundle> {
    if (this.pagePromise) {
      return this.pagePromise;
    }

    this.pagePromise = this.api
      .get<ApiResponse<PropertyPageBundle>>(Apiendpointd.propertyPage)
      .then((res) => {
        const bundle = this.normalizePageBundle(res?.data);
        this.pageData = bundle;
        this.pageAt = Date.now();
        this.pagePromise = null;
        return bundle;
      })
      .catch((err) => {
        this.pagePromise = null;
        throw err;
      });

    return this.pagePromise;
  }

  private normalizePageBundle(raw?: PropertyPageBundle | null): PropertyPageBundle {
    return {
      compounds: raw?.compounds ?? [],
      buildings: raw?.buildings ?? [],
      gates: raw?.gates ?? [],
      roomTypes: raw?.roomTypes ?? [],
      facilityTypes: raw?.facilityTypes ?? [],
    };
  }

  async getBuildingData<T = unknown>(force = false): Promise<T> {
    const fresh = Date.now() - this.buildingDataAt < this.ttlMs;
    if (!force && this.buildingData != null && fresh) {
      return this.buildingData as T;
    }
    if (!force && this.buildingDataPromise) {
      return this.buildingDataPromise as Promise<T>;
    }

    this.buildingDataPromise = this.api
      .get<ApiResponse<T>>(Apiendpointd.buildingData)
      .then((res) => {
        this.buildingData = res.data;
        this.buildingDataAt = Date.now();
        this.buildingDataPromise = null;
        return res.data;
      })
      .catch((err) => {
        this.buildingDataPromise = null;
        throw err;
      });

    return this.buildingDataPromise as Promise<T>;
  }

  async getCompoundsAll<T = unknown>(force = false): Promise<T> {
    const fresh = Date.now() - this.compoundsAt < this.ttlMs;
    if (!force && this.compoundsAll != null && fresh) {
      return this.compoundsAll as T;
    }
    if (!force && this.compoundsPromise) {
      return this.compoundsPromise as Promise<T>;
    }

    this.compoundsPromise = this.api
      .get(`${Apiendpointd.compounds}?all=1`)
      .then((raw: unknown) => {
        const data = (raw as ApiResponse<T>)?.data ?? raw;
        this.compoundsAll = data;
        this.compoundsAt = Date.now();
        this.compoundsPromise = null;
        return data as T;
      })
      .catch((err) => {
        this.compoundsPromise = null;
        throw err;
      });

    return this.compoundsPromise as Promise<T>;
  }
}
