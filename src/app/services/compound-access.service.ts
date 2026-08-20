import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Apiendpointd } from '../apiEndpoints';
import { ApiResponse } from '../interfaces/api-response';

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

  searchUsers(query: string): Promise<ApiResponse<CompoundAccessUser[]>> {
    return this.api.get(Apiendpointd.compoundAccessStudents(query));
  }

  sync(userId: number, compoundIds: number[]): Promise<ApiResponse<CompoundAccessRow>> {
    return this.api.put(Apiendpointd.compoundAccessStudent(userId), { compound_ids: compoundIds });
  }
}
