import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Apiendpointd } from '../apiEndpoints';
import { ApiResponse } from '../interfaces/api-response';

export interface WeekendDay {
  id: number;
  code: number;
  day_name: string;
}

export interface GregorianHoliday {
  id: number;
  name: string;
  date: string;
  is_recurring?: boolean;
}

export interface IslamicHoliday {
  id: number;
  name: string;
  hijri_month: number;
  hijri_day: number;
  observed_date?: string | null;
}

@Injectable({ providedIn: 'root' })
export class HolidaysService {
  private readonly api = inject(ApiService);

  listWeekends(): Promise<ApiResponse<WeekendDay[]>> {
    return this.api.get(Apiendpointd.weekends);
  }

  createWeekend(body: { code: number; day_name: string }): Promise<ApiResponse<WeekendDay>> {
    return this.api.post(Apiendpointd.weekends, body);
  }

  updateWeekend(id: number, body: Partial<{ code: number; day_name: string }>): Promise<ApiResponse<WeekendDay>> {
    return this.api.put(Apiendpointd.weekendById(id), body);
  }

  deleteWeekend(id: number): Promise<ApiResponse<unknown>> {
    return this.api.delete(Apiendpointd.weekendById(id));
  }

  listGregorian(): Promise<ApiResponse<GregorianHoliday[]>> {
    return this.api.get(Apiendpointd.gregorianHolidays);
  }

  createGregorian(body: {
    name: string;
    date: string;
    is_recurring?: boolean;
  }): Promise<ApiResponse<GregorianHoliday>> {
    return this.api.post(Apiendpointd.gregorianHolidays, body);
  }

  updateGregorian(
    id: number,
    body: Partial<{ name: string; date: string; is_recurring: boolean }>,
  ): Promise<ApiResponse<GregorianHoliday>> {
    return this.api.put(Apiendpointd.gregorianHolidayById(id), body);
  }

  deleteGregorian(id: number): Promise<ApiResponse<unknown>> {
    return this.api.delete(Apiendpointd.gregorianHolidayById(id));
  }

  listIslamic(): Promise<ApiResponse<IslamicHoliday[]>> {
    return this.api.get(Apiendpointd.islamicHolidays);
  }

  createIslamic(body: {
    name: string;
    hijri_month: number;
    hijri_day: number;
    observed_date?: string | null;
  }): Promise<ApiResponse<IslamicHoliday>> {
    return this.api.post(Apiendpointd.islamicHolidays, body);
  }

  updateIslamic(
    id: number,
    body: Partial<{
      name: string;
      hijri_month: number;
      hijri_day: number;
      observed_date: string | null;
    }>,
  ): Promise<ApiResponse<IslamicHoliday>> {
    return this.api.put(Apiendpointd.islamicHolidayById(id), body);
  }

  deleteIslamic(id: number): Promise<ApiResponse<unknown>> {
    return this.api.delete(Apiendpointd.islamicHolidayById(id));
  }
}
