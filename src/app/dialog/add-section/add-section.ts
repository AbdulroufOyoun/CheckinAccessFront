import { ChangeDetectorRef, Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  EducationService,
  EduSubject,
  EduDay,
  EduRoom,
  AcademicTerm,
} from '../../services/education.service';
import { SnackbarService } from '../../services/snackbar.service';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { Apiendpointd } from '../../apiEndpoints';

export interface AddSectionDialogData {
  subjects: EduSubject[];
  subjectId?: number | null;
  days?: EduDay[];
  isRTL?: boolean;
}

interface DoctorOption {
  id: number;
  name: string;
  email?: string;
}

@Component({
  selector: 'app-add-section',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './add-section.html',
  styleUrl: './add-section.css',
})
export class AddSection implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<AddSection>);
  private readonly edu = inject(EducationService);
  private readonly snackbar = inject(SnackbarService);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  saving = false;
  loadingRooms = false;
  isRTL = false;
  subjects: EduSubject[] = [];
  days: EduDay[] = [];
  rooms: EduRoom[] = [];
  roomSearch = '';
  doctors: DoctorOption[] = [];
  terms: AcademicTerm[] = [];
  capacityPresets = [15, 20, 30, 40, 50];
  numberPresets = ['1', '2', 'A1', 'B1'];
  private roomLoadToken = 0;

  private readonly dayAr: Record<string, string> = {
    Sunday: 'الأحد',
    Monday: 'الإثنين',
    Tuesday: 'الثلاثاء',
    Wednesday: 'الأربعاء',
    Thursday: 'الخميس',
    Friday: 'الجمعة',
    Saturday: 'السبت',
  };

  private readonly dayShortEn: Record<string, string> = {
    Sunday: 'Sun',
    Monday: 'Mon',
    Tuesday: 'Tue',
    Wednesday: 'Wed',
    Thursday: 'Thu',
    Friday: 'Fri',
    Saturday: 'Sat',
  };

  private readonly conflictKeys: Record<string, string> = {
    'Doctor has a conflicting schedule at this time': 'SEC_DOCTOR_CONFLICT',
    'Room has a conflicting schedule at this time': 'SEC_ROOM_CONFLICT',
    'Room has a conflicting guest booking at this time': 'SEC_ROOM_BOOKING_CONFLICT',
  };

  form = {
    subject_id: '' as number | '',
    doctor_id: '' as number | '',
    academic_term_id: '' as number | '',
    number: '',
    capacity: 30,
    room_id: '' as number | '',
    is_practical: false,
    active: true,
    day_id: '' as number | '',
    start: '09:00',
    end: '11:00',
  };

  constructor(@Inject(MAT_DIALOG_DATA) public data: AddSectionDialogData) {
    this.subjects = data?.subjects || [];
    this.days = data?.days || [];
  }

  ngOnInit(): void {
    this.isRTL =
      this.data?.isRTL === true ||
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';

    const me = this.auth.getUser();
    if (me?.id) {
      this.form.doctor_id = me.id;
      this.doctors = [{ id: me.id, name: me.name || `#${me.id}`, email: me.email }];
    }

    if (this.data?.subjectId) {
      this.form.subject_id = this.data.subjectId;
      this.onSubjectChange(this.data.subjectId);
    }

    void this.loadDoctors();
    void this.loadTerms();
    if (!this.days.length) {
      void this.loadDays();
    }
  }

  private async loadDays(): Promise<void> {
    try {
      const res = await this.edu.getDays();
      this.days = res.data || [];
      this.cdr.detectChanges();
    } catch {
      this.days = [];
    }
  }

  get scheduleReady(): boolean {
    return !!this.form.day_id && this.timeRangeValid;
  }

  get busyRoomCount(): number {
    return this.rooms.filter((r) => r.available === false).length;
  }

  private async loadRooms(): Promise<void> {
    if (!this.scheduleReady) {
      this.rooms = [];
      this.form.room_id = '';
      this.loadingRooms = false;
      this.cdr.detectChanges();
      return;
    }

    const token = ++this.roomLoadToken;
    this.loadingRooms = true;
    this.cdr.detectChanges();
    try {
      const res = await this.edu.getRooms({
        day_id: Number(this.form.day_id),
        start: this.toHms(this.form.start),
        end: this.toHms(this.form.end),
      });
      if (token !== this.roomLoadToken) return;
      this.rooms = res.data || [];
      if (this.form.room_id) {
        const selected = this.rooms.find((r) => r.id === this.form.room_id);
        if (!selected || selected.available === false) {
          this.form.room_id = '';
        }
      }
    } catch {
      if (token !== this.roomLoadToken) return;
      this.rooms = [];
      this.snackbar.show(this.translate.instant('SEC_ROOMS_LOAD_FAILED'), 'error');
    } finally {
      if (token === this.roomLoadToken) {
        this.loadingRooms = false;
        this.cdr.detectChanges();
      }
    }
  }

  private async loadTerms(): Promise<void> {
    try {
      const res = await this.edu.getAcademicTerms('open');
      this.terms = res.data || [];
      if (this.terms.length === 1) {
        this.form.academic_term_id = this.terms[0].id;
      }
      this.cdr.detectChanges();
    } catch {
      this.terms = [];
    }
  }

  private async loadDoctors(): Promise<void> {
    try {
      const res = await this.api.get<{ data?: DoctorOption[] }>(Apiendpointd.admins);
      const list = Array.isArray(res.data) ? res.data : [];
      if (list.length) {
        this.doctors = list
          .filter((d) => d?.id)
          .map((d) => ({
            id: d.id,
            name: d.name || `#${d.id}`,
            email: d.email,
          }));
        if (!this.form.doctor_id && this.doctors[0]) {
          this.form.doctor_id = this.doctors[0].id;
        }
        this.cdr.detectChanges();
      }
    } catch {
      /* keep current user fallback */
    }
  }

  get filteredRooms(): EduRoom[] {
    const q = this.roomSearch.trim().toLowerCase();
    const list = !q
      ? [...this.rooms]
      : this.rooms.filter((r) => this.roomLabel(r).toLowerCase().includes(q));
    return list.sort((a, b) => {
      const av = a.available === false ? 1 : 0;
      const bv = b.available === false ? 1 : 0;
      if (av !== bv) return av - bv;
      return this.roomLabel(a).localeCompare(this.roomLabel(b), this.isRTL ? 'ar' : 'en');
    });
  }

  isRoomBusy(r: EduRoom): boolean {
    return r.available === false;
  }

  roomConflictLabel(r: EduRoom): string {
    if (r.conflict_reason === 'booking') {
      return this.translate.instant('SEC_ROOM_BUSY_BOOKING');
    }
    return this.translate.instant('SEC_ROOM_BUSY_SECTION');
  }

  subjectLabel(s: EduSubject): string {
    if (this.isRTL) return s.name_ar || s.name;
    return s.name || s.name_ar || '';
  }

  subjectSecondary(s: EduSubject): string {
    if (this.isRTL) return s.name !== (s.name_ar || '') ? s.name : '';
    return s.name_ar && s.name_ar !== s.name ? s.name_ar : '';
  }

  doctorLabel(d: DoctorOption): string {
    return d.name || `#${d.id}`;
  }

  doctorInitials(d?: DoctorOption | null): string {
    const name = d?.name || '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  roomLabel(r: EduRoom): string {
    const code = (r.number || r.name || `#${r.id}`).trim();
    const building = r.floor?.building?.name?.trim();
    const floor = r.floor?.number != null ? String(r.floor.number) : '';
    const type = (r.room_type || r.roomType)?.name?.trim();
    const parts = [code];
    if (building) parts.push(building);
    if (floor) parts.push(this.translate.instant('SEC_ROOM_FLOOR', { n: floor }));
    if (type) parts.push(type);
    return parts.join(' · ');
  }

  get selectedSubject(): EduSubject | undefined {
    if (!this.form.subject_id) return undefined;
    return this.subjects.find((s) => s.id === this.form.subject_id);
  }

  get selectedDoctor(): DoctorOption | undefined {
    return this.doctors.find((d) => d.id === this.form.doctor_id);
  }

  get selectedRoom(): EduRoom | undefined {
    if (!this.form.room_id) return undefined;
    return this.rooms.find((r) => r.id === this.form.room_id);
  }

  get previewCode(): string {
    const num = this.form.number.trim().toUpperCase();
    if (num) return num;
    const code = this.selectedSubject?.short_name?.trim().toUpperCase();
    return code || 'SEC';
  }

  get previewTitle(): string {
    const subj = this.selectedSubject;
    if (!subj) return this.translate.instant('SEC_UNTITLED');
    return this.subjectLabel(subj);
  }

  get previewMeta(): string {
    const cap = this.translate.instant('SEC_PREVIEW_CAPACITY', { n: this.form.capacity || 0 });
    const type = this.form.is_practical
      ? this.translate.instant('SUBJ_PRACTICAL')
      : this.translate.instant('SUBJ_THEORY');
    const status = this.form.active
      ? this.translate.instant('ACTIVE')
      : this.translate.instant('INACTIVE');
    return `${cap} · ${type} · ${status}`;
  }

  get previewRoom(): string {
    const room = this.selectedRoom;
    return room
      ? this.translate.instant('SEC_PREVIEW_ROOM', { room: this.roomLabel(room) })
      : this.translate.instant('SEC_PREVIEW_NO_ROOM');
  }

  get previewSchedule(): string {
    if (!this.form.day_id) return this.translate.instant('SEC_PREVIEW_NO_SCHEDULE');
    const day = this.days.find((d) => d.id === this.form.day_id);
    return this.translate.instant('SEC_PREVIEW_SCHEDULE', {
      day: this.dayLabel(day),
      start: this.form.start,
      end: this.form.end,
    });
  }

  get timeRangeValid(): boolean {
    if (!this.form.start || !this.form.end) return false;
    return this.form.start < this.form.end;
  }

  get canSave(): boolean {
    const room = this.selectedRoom;
    return (
      !!this.form.subject_id &&
      !!this.form.doctor_id &&
      !!this.form.number.trim() &&
      !!this.form.room_id &&
      !!room &&
      room.available !== false &&
      this.scheduleReady
    );
  }

  dayLabel(d?: EduDay | null): string {
    if (!d) return '';
    if (this.isRTL) return this.dayAr[d.name] || d.name_ar || d.name;
    return d.name;
  }

  dayShort(d: EduDay): string {
    if (this.isRTL) return (this.dayAr[d.name] || d.name).slice(0, 3);
    return this.dayShortEn[d.name] || d.name.slice(0, 3);
  }

  selectDay(id: number): void {
    this.form.day_id = id;
    this.onScheduleChange();
  }

  selectRoom(id: number): void {
    const room = this.rooms.find((r) => r.id === id);
    if (!room || room.available === false) {
      this.snackbar.show(this.translate.instant('SEC_ROOM_BUSY_PICK'), 'error');
      return;
    }
    this.form.room_id = id;
  }

  setPreset(start: string, end: string): void {
    this.form.start = start;
    this.form.end = end;
    this.onScheduleChange();
  }

  onTimeChange(): void {
    this.onScheduleChange();
  }

  private onScheduleChange(): void {
    this.form.room_id = '';
    void this.loadRooms();
  }

  onSubjectChange(id: number | ''): void {
    const subj = typeof id === 'number' ? this.subjects.find((s) => s.id === id) : undefined;
    if (subj?.has_practical) {
      this.form.is_practical = true;
    }
  }

  setNumber(value: string): void {
    this.form.number = value;
  }

  setCapacity(value: number): void {
    this.form.capacity = value;
  }

  bumpCapacity(delta: number): void {
    const next = Number(this.form.capacity || 0) + delta;
    this.form.capacity = Math.max(1, Math.min(9999, next));
  }

  close(saved = false): void {
    this.dialogRef.close(saved);
  }

  async save(): Promise<void> {
    if (!this.canSave) {
      this.snackbar.show(this.translate.instant('SEC_REQUIRED'), 'error');
      return;
    }

    this.saving = true;
    try {
      await this.edu.createSection({
        subject_id: Number(this.form.subject_id),
        doctor_id: Number(this.form.doctor_id),
        academic_term_id: this.form.academic_term_id ? Number(this.form.academic_term_id) : null,
        number: this.form.number.trim(),
        capacity: Number(this.form.capacity) || 30,
        room_id: Number(this.form.room_id),
        is_practical: this.form.is_practical,
        active: this.form.active,
        day_id: Number(this.form.day_id),
        start: this.toHms(this.form.start),
        end: this.toHms(this.form.end),
      });

      this.snackbar.show(this.translate.instant('SEC_CREATED'), 'success');
      this.close(true);
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  private toHms(value: string): string {
    const m = String(value || '').match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return value;
    return `${m[1].padStart(2, '0')}:${m[2]}:${m[3] || '00'}`;
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string } })?.error?.message;
    if (typeof m === 'string' && this.conflictKeys[m]) {
      return this.translate.instant(this.conflictKeys[m]);
    }
    return typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED');
  }
}
