import { ChangeDetectorRef, Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  EducationService,
  EduDay,
  EduSection,
  EduSectionTime,
} from '../../services/education.service';
import { SnackbarService } from '../../services/snackbar.service';

export interface SectionTimesDialogData {
  section: EduSection;
  days: EduDay[];
  isRTL?: boolean;
}

export interface SectionTimesDialogResult {
  sectionId: number;
  times: EduSectionTime[];
  changed: boolean;
}

@Component({
  selector: 'app-section-times',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './section-times.html',
  styleUrl: './section-times.css',
})
export class SectionTimesDialog implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<SectionTimesDialog, SectionTimesDialogResult>);
  private readonly edu = inject(EducationService);
  private readonly snackbar = inject(SnackbarService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  isRTL = false;
  loading = true;
  saving = false;
  changed = false;
  times: EduSectionTime[] = [];
  days: EduDay[] = [];
  section!: EduSection;

  timeForm = {
    day_id: '' as number | '',
    start: '09:00',
    end: '11:00',
  };

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

  constructor(@Inject(MAT_DIALOG_DATA) public data: SectionTimesDialogData) {
    this.section = data.section;
    this.days = [...(data.days || [])];
  }

  ngOnInit(): void {
    this.isRTL =
      this.data.isRTL === true ||
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    void this.loadTimes();
  }

  get subjectName(): string {
    const s = this.section.subject;
    if (!s) return `#${this.section.subject_id}`;
    if (this.isRTL) return s.name_ar || s.name;
    return s.name || s.name_ar || '';
  }

  get previewMeta(): string {
    const room = this.section.room_name || this.section.room?.number || this.section.room?.name;
    const doctor = this.section.doctor?.name;
    const parts = [
      this.translate.instant('SCHED_SECTION', { n: this.section.number }),
      doctor,
      room,
    ].filter(Boolean);
    return parts.join(' · ');
  }

  get durationLabel(): string {
    const mins = this.durationMinutes(this.timeForm.start, this.timeForm.end);
    if (mins == null) return '';
    if (mins <= 0) return this.translate.instant('SEC_TIME_INVALID_RANGE');
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h && m) return this.translate.instant('SEC_TIME_DURATION_HM', { h, m });
    if (h) return this.translate.instant('SEC_TIME_DURATION_H', { h });
    return this.translate.instant('SEC_TIME_DURATION_M', { m });
  }

  get canAdd(): boolean {
    return (
      !!this.timeForm.day_id &&
      !!this.timeForm.start &&
      !!this.timeForm.end &&
      !this.saving &&
      (this.durationMinutes(this.timeForm.start, this.timeForm.end) ?? 0) > 0
    );
  }

  get sortedTimes(): EduSectionTime[] {
    const order = Object.keys(this.dayAr);
    return [...this.times].sort((a, b) => {
      const da = order.indexOf(a.day?.name || '');
      const db = order.indexOf(b.day?.name || '');
      const byDay = (da === -1 ? 99 : da) - (db === -1 ? 99 : db);
      if (byDay !== 0) return byDay;
      return String(a.start).localeCompare(String(b.start));
    });
  }

  dayLabel(d?: EduDay | null): string {
    if (!d) return '';
    if (this.isRTL) return this.dayAr[d.name] || d.name_ar || d.name;
    return d.name;
  }

  dayShort(d?: EduDay | null): string {
    if (!d) return '';
    if (this.isRTL) return this.dayAr[d.name]?.slice(0, 3) || d.name;
    return this.dayShortEn[d.name] || d.name.slice(0, 3);
  }

  formatClock(value?: string | null): string {
    if (!value) return '—';
    const m = String(value).match(/^(\d{1,2}):(\d{2})/);
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : String(value);
  }

  selectDay(id: number): void {
    this.timeForm.day_id = id;
  }

  setPreset(start: string, end: string): void {
    this.timeForm.start = start;
    this.timeForm.end = end;
  }

  close(): void {
    this.dialogRef.close({
      sectionId: this.section.id,
      times: this.times,
      changed: this.changed,
    });
  }

  async addTime(): Promise<void> {
    if (!this.canAdd || !this.timeForm.day_id) {
      this.snackbar.show(this.translate.instant('SEC_DAY_REQUIRED'), 'error');
      return;
    }
    this.saving = true;
    try {
      await this.edu.addSectionTime(this.section.id, {
        day_id: Number(this.timeForm.day_id),
        start: this.toHms(this.timeForm.start),
        end: this.toHms(this.timeForm.end),
      });
      this.changed = true;
      this.snackbar.show(this.translate.instant('SEC_TIME_ADDED'), 'success');
      await this.loadTimes(true);
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  async removeTime(id: number): Promise<void> {
    this.saving = true;
    try {
      await this.edu.deleteSectionTime(this.section.id, id);
      this.times = this.times.filter((t) => t.id !== id);
      this.changed = true;
      this.snackbar.show(this.translate.instant('SEC_TIME_REMOVED'), 'success');
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  private async loadTimes(force = false): Promise<void> {
    if (!force) {
      const cached = this.section.section_times || this.section.sectionTimes || [];
      if (cached.length) {
        this.times = cached;
        this.loading = false;
        this.cdr.detectChanges();
        return;
      }
    }
    this.loading = true;
    try {
      const res = await this.edu.getSectionTimes(this.section.id);
      this.times = res.data || [];
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
      this.times = [];
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private durationMinutes(start: string, end: string): number | null {
    const a = this.toMinutes(start);
    const b = this.toMinutes(end);
    if (a == null || b == null) return null;
    return b - a;
  }

  private toMinutes(value: string): number | null {
    const m = String(value).match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  private toHms(value: string): string {
    if (/^\d{2}:\d{2}:\d{2}$/.test(value)) return value;
    if (/^\d{2}:\d{2}$/.test(value)) return `${value}:00`;
    return value;
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string } })?.error?.message;
    const map: Record<string, string> = {
      'Doctor has a conflicting schedule at this time': 'SEC_DOCTOR_CONFLICT',
      'Room has a conflicting schedule at this time': 'SEC_ROOM_CONFLICT',
      'Room has a conflicting guest booking at this time': 'SEC_ROOM_BOOKING_CONFLICT',
    };
    if (typeof m === 'string' && map[m]) {
      return this.translate.instant(map[m]);
    }
    return typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED');
  }
}
