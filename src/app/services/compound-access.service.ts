import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Apiendpointd } from '../apiEndpoints';
import { ApiResponse } from '../interfaces/api-response';
import { PropertyPageBundle } from './property-tree-cache.service';

export type PropertyAccessScopeType =
  | 'compound'
  | 'building'
  | 'floor'
  | 'suite'
  | 'room'
  | 'gate'
  | 'parking'
  | 'facility';

export interface PropertyAccessGrant {
  type: PropertyAccessScopeType;
  id: number;
}

export interface PropertyAccessGrantDisplay extends PropertyAccessGrant {
  label?: string | null;
  compound_id?: number | null;
}

export interface CompoundAccessCompound {
  id: number;
  name?: string | null;
  number?: string | null;
}

export interface CompoundAccessUser {
  id: number;
  name?: string | null;
  email?: string | null;
  mobile?: string | null;
}

/** @deprecated Use CompoundAccessUser */
export type CompoundAccessStudent = CompoundAccessUser;

export interface CompoundAccessRow {
  user_id: number;
  user?: CompoundAccessUser | null;
  /** Full grant list (edit/sync). */
  grants: PropertyAccessGrantDisplay[];
  /** Collapsed summary for list chips (parent hides children). */
  grants_display?: PropertyAccessGrantDisplay[];
  compounds: CompoundAccessCompound[];
}

@Injectable({ providedIn: 'root' })
export class CompoundAccessService {
  private readonly api = inject(ApiService);

  list(): Promise<ApiResponse<CompoundAccessRow[]>> {
    return this.api.get(Apiendpointd.compoundAccess);
  }

  listCompounds(): Promise<ApiResponse<CompoundAccessCompound[]>> {
    return this.api.get(Apiendpointd.compoundAccessCompounds);
  }

  loadPropertyTree(): Promise<ApiResponse<PropertyPageBundle>> {
    return this.api.get(Apiendpointd.compoundAccessPropertyTree);
  }

  searchUsers(query: string): Promise<ApiResponse<CompoundAccessUser[]>> {
    return this.api.get(Apiendpointd.compoundAccessStudents(query));
  }

  sync(userId: number, grants: PropertyAccessGrant[]): Promise<ApiResponse<CompoundAccessRow>> {
    return this.api.put(Apiendpointd.compoundAccessStudent(userId), { grants });
  }

  /** @deprecated Use sync(userId, grants) with compound-type grants */
  syncCompoundIds(userId: number, compoundIds: number[]): Promise<ApiResponse<CompoundAccessRow>> {
    const grants: PropertyAccessGrant[] = compoundIds.map((id) => ({ type: 'compound', id }));
    return this.sync(userId, grants);
  }
}
