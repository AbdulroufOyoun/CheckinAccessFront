import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Apiendpointd } from '../apiEndpoints';
import { ApiResponse } from '../interfaces/api-response';
import {
  AcademicTerm,
  EduDay,
  EduEnrollmentArchiveRow,
  EduEnrollmentRow,
  EduSection,
  EduSectionTime,
  EduSubject,
} from './education.service';

export interface ScheduleBundle {
  sections: EduSection[];
  subjects: EduSubject[];
  days: EduDay[];
  active_term?: AcademicTerm | null;
  selected_term?: AcademicTerm | null;
  suggested_term?: AcademicTerm | null;
  open_terms?: AcademicTerm[];
}

export interface EnrollmentHistoryBundle {
  archives: EduEnrollmentArchiveRow[];
  terms: AcademicTerm[];
}

export interface EnrollmentsPageBundle {
  enrollments: EduEnrollmentRow[];
  sections: EduSection[];
  terms?: AcademicTerm[];
}

/** Short-lived in-memory cache for education reference + list payloads. */
@Injectable({ providedIn: 'root' })
export class EducationReferenceCache {
  private readonly api = inject(ApiService);

  private readonly ttlMs = 60_000;

  private scheduleAt = new Map<string, number>();
  private scheduleData = new Map<string, ScheduleBundle>();
  private schedulePromise = new Map<string, Promise<ScheduleBundle>>();

  private subjectsAt = 0;
  private subjectsData: EduSubject[] | null = null;
  private subjectsPromise: Promise<EduSubject[]> | null = null;

  private historyAt = 0;
  private historyData: EnrollmentHistoryBundle | null = null;
  private historyPromise: Promise<EnrollmentHistoryBundle> | null = null;

  private enrollmentsAt = 0;
  private enrollmentsData: EnrollmentsPageBundle | null = null;
  private enrollmentsPromise: Promise<EnrollmentsPageBundle> | null = null;

  invalidate(): void {
    this.scheduleAt.clear();
    this.scheduleData.clear();
    this.schedulePromise.clear();
    this.subjectsAt = 0;
    this.subjectsData = null;
    this.subjectsPromise = null;
    this.historyAt = 0;
    this.historyData = null;
    this.historyPromise = null;
    this.enrollmentsAt = 0;
    this.enrollmentsData = null;
    this.enrollmentsPromise = null;
  }

  peekScheduleBundle(
    subjectId: number | null = null,
    termId: number | null = null,
  ): ScheduleBundle | null {
    return this.scheduleData.get(this.scheduleKey(subjectId, termId)) ?? null;
  }

  peekSubjects(): EduSubject[] | null {
    return this.subjectsData;
  }

  peekEnrollmentHistoryBundle(): EnrollmentHistoryBundle | null {
    return this.historyData;
  }

  peekEnrollmentsPageBundle(): EnrollmentsPageBundle | null {
    return this.enrollmentsData;
  }

  async getScheduleBundle(
    subjectId: number | null = null,
    options?: { force?: boolean; allowStale?: boolean; termId?: number | null },
  ): Promise<ScheduleBundle> {
    const termId = options?.termId ?? null;
    const key = this.scheduleKey(subjectId, termId);
    const force = options?.force === true;
    const allowStale = options?.allowStale !== false;
    const fresh = Date.now() - (this.scheduleAt.get(key) ?? 0) < this.ttlMs;

    if (!force && this.scheduleData.has(key) && fresh) {
      return this.scheduleData.get(key)!;
    }

    if (!force && allowStale && this.scheduleData.has(key)) {
      void this.fetchScheduleBundle(key, subjectId, termId);
      return this.scheduleData.get(key)!;
    }

    return this.fetchScheduleBundle(key, subjectId, termId);
  }

  async getSubjects(options?: { force?: boolean; allowStale?: boolean }): Promise<EduSubject[]> {
    const force = options?.force === true;
    const allowStale = options?.allowStale !== false;
    const fresh = Date.now() - this.subjectsAt < this.ttlMs;

    if (!force && this.subjectsData && fresh) {
      return this.subjectsData;
    }

    if (!force && allowStale && this.subjectsData) {
      void this.fetchSubjects();
      return this.subjectsData;
    }

    return this.fetchSubjects();
  }

  async getEnrollmentHistoryBundle(
    options?: { force?: boolean; allowStale?: boolean },
  ): Promise<EnrollmentHistoryBundle> {
    const force = options?.force === true;
    const allowStale = options?.allowStale !== false;
    const fresh = Date.now() - this.historyAt < this.ttlMs;

    if (!force && this.historyData && fresh) {
      return this.historyData;
    }

    if (!force && allowStale && this.historyData) {
      void this.fetchEnrollmentHistoryBundle();
      return this.historyData;
    }

    return this.fetchEnrollmentHistoryBundle();
  }

  async getEnrollmentsPageBundle(
    options?: { force?: boolean; allowStale?: boolean },
  ): Promise<EnrollmentsPageBundle> {
    const force = options?.force === true;
    const allowStale = options?.allowStale !== false;
    const fresh = Date.now() - this.enrollmentsAt < this.ttlMs;

    if (!force && this.enrollmentsData && fresh) {
      return this.enrollmentsData;
    }

    if (!force && allowStale && this.enrollmentsData) {
      void this.fetchEnrollmentsPageBundle();
      return this.enrollmentsData;
    }

    return this.fetchEnrollmentsPageBundle();
  }

  private scheduleKey(subjectId: number | null, termId: number | null): string {
    return `s:${subjectId ?? 'all'}|t:${termId ?? 'auto'}`;
  }

  private fetchScheduleBundle(
    key: string,
    subjectId: number | null,
    termId: number | null,
  ): Promise<ScheduleBundle> {
    if (this.schedulePromise.has(key)) {
      return this.schedulePromise.get(key)!;
    }

    const qs = new URLSearchParams();
    if (subjectId != null) qs.set('subject_id', String(subjectId));
    if (termId != null) qs.set('academic_term_id', String(termId));
    const query = qs.toString() ? `?${qs.toString()}` : '';

    const promise = this.api
      .get<ApiResponse<ScheduleBundle>>(`${Apiendpointd.educationSchedule}${query}`)
      .then((res) => {
        const bundle = this.normalizeBundle(res?.data);
        this.scheduleData.set(key, bundle);
        this.scheduleAt.set(key, Date.now());
        this.schedulePromise.delete(key);
        return bundle;
      })
      .catch((err) => {
        this.schedulePromise.delete(key);
        throw err;
      });

    this.schedulePromise.set(key, promise);
    return promise;
  }

  private fetchSubjects(): Promise<EduSubject[]> {
    if (this.subjectsPromise) {
      return this.subjectsPromise;
    }

    this.subjectsPromise = this.api
      .get<ApiResponse<EduSubject[]>>(Apiendpointd.subjects)
      .then((res) => {
        this.subjectsData = res?.data ?? [];
        this.subjectsAt = Date.now();
        this.subjectsPromise = null;
        return this.subjectsData;
      })
      .catch((err) => {
        this.subjectsPromise = null;
        throw err;
      });

    return this.subjectsPromise;
  }

  private fetchEnrollmentHistoryBundle(): Promise<EnrollmentHistoryBundle> {
    if (this.historyPromise) {
      return this.historyPromise;
    }

    this.historyPromise = this.api
      .get<ApiResponse<EnrollmentHistoryBundle>>(Apiendpointd.enrollmentHistory)
      .then((res) => {
        this.historyData = {
          archives: res?.data?.archives ?? [],
          terms: res?.data?.terms ?? [],
        };
        this.historyAt = Date.now();
        this.historyPromise = null;
        return this.historyData;
      })
      .catch((err) => {
        this.historyPromise = null;
        throw err;
      });

    return this.historyPromise;
  }

  private fetchEnrollmentsPageBundle(): Promise<EnrollmentsPageBundle> {
    if (this.enrollmentsPromise) {
      return this.enrollmentsPromise;
    }

    this.enrollmentsPromise = this.api
      .get<ApiResponse<EnrollmentsPageBundle>>(Apiendpointd.enrollmentsPage)
      .then((res) => {
        this.enrollmentsData = {
          enrollments: res?.data?.enrollments ?? [],
          sections: res?.data?.sections ?? [],
        };
        this.enrollmentsAt = Date.now();
        this.enrollmentsPromise = null;
        return this.enrollmentsData;
      })
      .catch((err) => {
        this.enrollmentsPromise = null;
        throw err;
      });

    return this.enrollmentsPromise;
  }

  private normalizeBundle(raw?: ScheduleBundle | null): ScheduleBundle {
    const sections = (raw?.sections ?? []).map((s) => this.normalizeSection(s));
    const selected = raw?.selected_term ?? raw?.active_term ?? null;
    return {
      sections,
      subjects: raw?.subjects ?? [],
      days: raw?.days ?? [],
      active_term: selected,
      selected_term: selected,
      suggested_term: raw?.suggested_term ?? null,
      open_terms: raw?.open_terms ?? [],
    };
  }

  private normalizeSection(section: EduSection): EduSection {
    const raw = section as EduSection & { sectionTimes?: EduSectionTime[] };
    const times = raw.section_times ?? raw.sectionTimes ?? [];
    return {
      ...section,
      section_times: times,
      sectionTimes: times,
    };
  }
}
