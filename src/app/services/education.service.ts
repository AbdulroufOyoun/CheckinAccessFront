import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Apiendpointd } from '../apiEndpoints';
import { ApiResponse } from '../interfaces/api-response';
import { EducationReferenceCache } from './education-reference-cache.service';
import {
  CompoundAccessService,
  type CompoundAccessCompound,
  type CompoundAccessRow,
  type CompoundAccessStudent,
  type CompoundAccessUser,
} from './compound-access.service';

export interface EduSubject {
  id: number;
  name: string;
  name_ar?: string | null;
  short_name?: string | null;
  hours?: number | null;
  has_practical?: boolean;
  required_subject_id?: number | null;
  active?: boolean;
  required_subject?: EduSubject | null;
}

export interface EduSection {
  id: number;
  subject_id: number;
  academic_term_id?: number | null;
  doctor_id: number;
  number: string;
  capacity?: number;
  room_id?: number | null;
  room_name?: string | null;
  is_practical?: boolean;
  active?: boolean;
  subject?: EduSubject;
  doctor?: { id: number; name?: string };
  room?: { id: number; name?: string; number?: string };
  academic_term?: AcademicTerm | null;
  academicTerm?: AcademicTerm | null;
  section_times?: EduSectionTime[];
  sectionTimes?: EduSectionTime[];
}

export interface AcademicTerm {
  id: number;
  name: string;
  name_ar?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  status: 'open' | 'closed' | string;
  closed_at?: string | null;
  sections_count?: number;
  archives_count?: number;
  live_enrollments_count?: number;
}

export interface EduDay {
  id: number;
  name: string;
  name_ar?: string;
}

export interface EduRoom {
  id: number;
  number?: string | null;
  name?: string | null;
  capacity?: number | null;
  active?: boolean;
  available?: boolean;
  conflict_reason?: 'section' | 'booking' | string | null;
  floor?: {
    id: number;
    number?: string | number | null;
    building?: { id: number; name?: string | null } | null;
  } | null;
  room_type?: { id: number; name?: string | null } | null;
  roomType?: { id: number; name?: string | null } | null;
}

export interface EduSectionTime {
  id: number;
  section_id: number;
  day_id: number;
  start: string;
  end: string;
  day?: EduDay;
}

export interface EduEnrollmentRow {
  enrollment: {
    id: number;
    user_id: number;
    section_id: number;
    status: string;
    enrolled_at?: string;
    section?: EduSection;
  };
  user?: { id: number; name?: string; email?: string } | null;
}

export interface EduFacilityOption {
  id: number;
  name: string;
  floor_id?: number | null;
  locks_count?: number;
  linked?: boolean;
}

export interface EduEnrollmentArchiveRow {
  archive: {
    id: number;
    user_id: number;
    section_id?: number | null;
    academic_term_id?: number | null;
    subject_id?: number | null;
    status: string;
    enrolled_at?: string | null;
    section_number?: string | null;
    subject_name?: string | null;
    subject_name_ar?: string | null;
    doctor_name?: string | null;
    room_name?: string | null;
    term_name?: string | null;
    archive_batch_id: string;
    archived_at?: string | null;
    archive_note?: string | null;
    academic_term?: AcademicTerm | null;
    archived_by_admin?: { id: number; name?: string } | null;
  };
  user?: { id: number; name?: string; email?: string } | null;
}

export interface EduReports {
  subjects_count: number;
  sections_count: number;
  enrollments_total: number;
  enrollments_by_status: Record<string, number>;
  students_enrolled: number;
  archives_total?: number;
}

export type {
  CompoundAccessCompound,
  CompoundAccessRow,
  CompoundAccessStudent,
  CompoundAccessUser,
} from './compound-access.service';

@Injectable({ providedIn: 'root' })
export class EducationService {
  private readonly api = inject(ApiService);
  private readonly scheduleCache = inject(EducationReferenceCache);
  private readonly compoundAccess = inject(CompoundAccessService);

  private async mutate<T>(op: Promise<T>): Promise<T> {
    const result = await op;
    this.scheduleCache.invalidate();
    return result;
  }

  getSubjects(): Promise<ApiResponse<EduSubject[]>> {
    return this.api.get(Apiendpointd.subjects);
  }

  createSubject(body: Partial<EduSubject>): Promise<ApiResponse<EduSubject>> {
    return this.mutate(this.api.post(Apiendpointd.subjects, body));
  }

  updateSubject(id: number, body: Partial<EduSubject>): Promise<ApiResponse<EduSubject>> {
    return this.mutate(this.api.put(Apiendpointd.subjectById(id), body));
  }

  deleteSubject(id: number): Promise<ApiResponse<unknown>> {
    return this.mutate(this.api.delete(Apiendpointd.subjectById(id)));
  }

  getSections(params?: {
    subject_id?: number | null;
    academic_term_id?: number | null;
    active?: boolean;
  }): Promise<ApiResponse<EduSection[]>> {
    const qs = new URLSearchParams();
    if (params?.subject_id) qs.set('subject_id', String(params.subject_id));
    if (params?.academic_term_id) qs.set('academic_term_id', String(params.academic_term_id));
    if (params?.active !== undefined) qs.set('active', String(params.active));
    const url = qs.toString() ? `${Apiendpointd.sections}?${qs}` : Apiendpointd.sections;
    return this.api.get(url);
  }

  createSection(body: Record<string, unknown>): Promise<ApiResponse<EduSection>> {
    return this.mutate(this.api.post(Apiendpointd.sections, body));
  }

  updateSection(id: number, body: Record<string, unknown>): Promise<ApiResponse<EduSection>> {
    return this.mutate(this.api.put(Apiendpointd.sectionById(id), body));
  }

  deleteSection(id: number): Promise<ApiResponse<unknown>> {
    return this.mutate(this.api.delete(Apiendpointd.sectionById(id)));
  }

  getDays(): Promise<ApiResponse<EduDay[]>> {
    return this.api.get(Apiendpointd.days);
  }

  getRooms(params?: {
    day_id?: number;
    start?: string;
    end?: string;
  }): Promise<ApiResponse<EduRoom[]>> {
    const qs = new URLSearchParams();
    if (params?.day_id) qs.set('day_id', String(params.day_id));
    if (params?.start) qs.set('start', params.start);
    if (params?.end) qs.set('end', params.end);
    const url = qs.toString() ? `${Apiendpointd.educationRooms}?${qs}` : Apiendpointd.educationRooms;
    return this.api.get(url);
  }

  getSectionTimes(sectionId: number): Promise<ApiResponse<EduSectionTime[]>> {
    return this.api.get(Apiendpointd.sectionTimes(sectionId));
  }

  addSectionTime(sectionId: number, body: { day_id: number; start: string; end: string }): Promise<ApiResponse<EduSectionTime>> {
    return this.mutate(this.api.post(Apiendpointd.sectionTimes(sectionId), body));
  }

  deleteSectionTime(sectionId: number, id: number): Promise<ApiResponse<unknown>> {
    return this.mutate(this.api.delete(Apiendpointd.sectionTimeById(sectionId, id)));
  }

  getEnrollments(params?: { section_id?: number; user_id?: number; status?: string }): Promise<ApiResponse<EduEnrollmentRow[]>> {
    const qs = new URLSearchParams();
    if (params?.section_id) qs.set('section_id', String(params.section_id));
    if (params?.user_id) qs.set('user_id', String(params.user_id));
    if (params?.status) qs.set('status', params.status);
    const url = qs.toString() ? `${Apiendpointd.enrollments}?${qs}` : Apiendpointd.enrollments;
    return this.api.get(url);
  }

  enroll(body: {
    user_id: number;
    academic_term_id: number;
    section_id?: number;
    section_ids?: number[];
    status?: string;
    facility_ids?: number[];
    access_units?: Array<{ unit_type: 'gate' | 'facility' | 'parking'; unit_id: number }>;
  }): Promise<ApiResponse<unknown>> {
    return this.mutate(this.api.post(Apiendpointd.enrollments, body));
  }

  getEducationFacilities(): Promise<ApiResponse<{ facilities: EduFacilityOption[] }>> {
    return this.api.get(Apiendpointd.educationFacilities);
  }

  getStudentFacilityAccess(userId: number): Promise<ApiResponse<{
    facilities: EduFacilityOption[];
    linked_facility_ids: number[];
    linked_units?: Array<{ unit_type: 'gate' | 'facility' | 'parking'; unit_id: number }>;
  }>> {
    return this.api.get(Apiendpointd.studentFacilityAccess(userId));
  }

  syncStudentFacilityAccess(
    userId: number,
    accessUnits: Array<{ unit_type: 'gate' | 'facility' | 'parking'; unit_id: number }>,
  ): Promise<ApiResponse<{
    facilities: EduFacilityOption[];
    linked_facility_ids: number[];
    linked_units?: Array<{ unit_type: 'gate' | 'facility' | 'parking'; unit_id: number }>;
  }>> {
    return this.mutate(this.api.put(Apiendpointd.studentFacilityAccess(userId), {
      access_units: accessUnits,
    }));
  }

  getStudentSchedule(userId: number): Promise<ApiResponse<{
    user?: { id: number; name?: string; email?: string } | null;
    enrollments: EduEnrollmentRow['enrollment'][] | Array<{
      id: number;
      user_id: number;
      section_id: number;
      status: string;
      section?: EduSection;
    }>;
  }>> {
    return this.api.get(Apiendpointd.studentSchedule(userId));
  }

  updateEnrollmentStatus(id: number, status: string): Promise<ApiResponse<unknown>> {
    return this.mutate(this.api.post(Apiendpointd.enrollmentStatus(id), { status }));
  }

  removeEnrollment(id: number): Promise<ApiResponse<unknown>> {
    return this.mutate(this.api.delete(Apiendpointd.enrollmentById(id)));
  }

  getReports(): Promise<ApiResponse<EduReports>> {
    return this.api.get(Apiendpointd.educationReports);
  }

  getAcademicTerms(status?: string): Promise<ApiResponse<AcademicTerm[]>> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.api.get(`${Apiendpointd.academicTerms}${qs}`);
  }

  createAcademicTerm(body: Partial<AcademicTerm>): Promise<ApiResponse<AcademicTerm>> {
    return this.mutate(this.api.post(Apiendpointd.academicTerms, body));
  }

  updateAcademicTerm(id: number, body: Partial<AcademicTerm>): Promise<ApiResponse<AcademicTerm>> {
    return this.mutate(this.api.put(Apiendpointd.academicTermById(id), body));
  }

  deleteAcademicTerm(id: number): Promise<ApiResponse<unknown>> {
    return this.mutate(this.api.delete(Apiendpointd.academicTermById(id)));
  }

  closeAcademicTerm(id: number, archiveNote?: string): Promise<ApiResponse<{ archived_count: number; archive_batch_id: string }>> {
    return this.mutate(this.api.post(Apiendpointd.academicTermClose(id), { archive_note: archiveNote || null }));
  }

  assignSectionsToTerm(id: number, sectionIds: number[]): Promise<ApiResponse<unknown>> {
    return this.mutate(this.api.post(Apiendpointd.academicTermAssignSections(id), { section_ids: sectionIds }));
  }

  getEnrollmentArchives(params?: {
    user_id?: number;
    academic_term_id?: number;
    status?: string;
    archive_batch_id?: string;
  }): Promise<ApiResponse<EduEnrollmentArchiveRow[]>> {
    const qs = new URLSearchParams();
    if (params?.user_id) qs.set('user_id', String(params.user_id));
    if (params?.academic_term_id) qs.set('academic_term_id', String(params.academic_term_id));
    if (params?.status) qs.set('status', params.status);
    if (params?.archive_batch_id) qs.set('archive_batch_id', params.archive_batch_id);
    const url = qs.toString() ? `${Apiendpointd.enrollmentArchives}?${qs}` : Apiendpointd.enrollmentArchives;
    return this.api.get(url);
  }

  archiveAllLiveEnrollments(body: {
    confirm: boolean;
    archive_note?: string;
    term_label?: string;
  }): Promise<ApiResponse<{ archived_count: number; archive_batch_id: string }>> {
    return this.mutate(this.api.post(Apiendpointd.enrollmentArchivesArchiveAll, body));
  }

  getCompoundAccess(): Promise<ApiResponse<CompoundAccessRow[]>> {
    return this.compoundAccess.list();
  }

  getCompoundAccessCompounds(): Promise<ApiResponse<CompoundAccessCompound[]>> {
    return this.compoundAccess.listCompounds();
  }

  searchCompoundAccessStudents(query: string): Promise<ApiResponse<CompoundAccessStudent[]>> {
    return this.compoundAccess.searchUsers(query);
  }

  syncCompoundAccess(userId: number, compoundIds: number[]): Promise<ApiResponse<CompoundAccessRow>> {
    return this.compoundAccess.sync(userId, compoundIds);
  }
}
