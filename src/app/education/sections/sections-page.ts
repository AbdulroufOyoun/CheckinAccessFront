import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  EducationService,
  EduDay,
  EduSection,
  EduSectionTime,
  EduSubject,
} from '../../services/education.service';
import { EducationReferenceCache } from '../../services/education-reference-cache.service';
import { SnackbarService } from '../../services/snackbar.service';
import { ApiService } from '../../services/api.service';
import { Apiendpointd } from '../../apiEndpoints';
import { AddSection } from '../../dialog/add-section/add-section';
import {
  SectionTimesDialog,
  SectionTimesDialogResult,
} from '../../dialog/section-times/section-times';
import { PageSkeleton } from '../../shared/page-skeleton/page-skeleton';

interface SubjectGroup {
  subject: EduSubject | null;
  subjectId: number;
  sections: EduSection[];
}

@Component({
  selector: 'app-sections-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PageSkeleton],
  templateUrl: './sections-page.html',
  styleUrl: './sections-page.css',
})
export class SectionsPage implements OnInit {
  private readonly edu = inject(EducationService);
  private readonly scheduleCache = inject(EducationReferenceCache);
  private readonly snackbar = inject(SnackbarService);
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  sections: EduSection[] = [];
  filtered: EduSection[] = [];
  groups: SubjectGroup[] = [];
  subjects: EduSubject[] = [];
  days: EduDay[] = [];
  loading = false;
  initialLoad = true;
  search = '';
  isRTL = false;
  filterSubjectId: number | null = null;

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

  get showSkeleton(): boolean {
    return this.initialLoad && this.sections.length === 0;
  }

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    this.translate.onLangChange.subscribe((e) => {
      this.isRTL = e.lang === 'ar';
      this.applyFilter();
      this.cdr.detectChanges();
    });
    this.route.queryParamMap.subscribe((params) => {
      const raw = params.get('subject_id');
      const id = raw ? Number(raw) : null;
      this.filterSubjectId = id && !Number.isNaN(id) ? id : null;
      void this.bootstrap();
    });
  }

  get filteredSubject(): EduSubject | undefined {
    if (!this.filterSubjectId) return undefined;
    return this.subjects.find((s) => s.id === this.filterSubjectId);
  }

  get totalSlots(): number {
    return this.filtered.reduce((n, s) => n + this.sectionTimes(s).length, 0);
  }

  subjectLabel(s?: EduSubject | null): string {
    if (!s) return this.translate.instant('SEC_UNKNOWN_SUBJECT');
    if (this.isRTL) return s.name_ar || s.name;
    return s.name || s.name_ar || '';
  }

  dayLabel(d?: EduDay | null): string {
    if (!d) return '';
    if (this.isRTL) return this.dayAr[d.name] || d.name_ar || d.name;
    return d.name;
  }

  dayShort(d?: EduDay | null): string {
    if (!d) return '?';
    if (this.isRTL) return (this.dayAr[d.name] || d.name).slice(0, 3);
    return this.dayShortEn[d.name] || d.name.slice(0, 3);
  }

  sectionTimes(section: EduSection): EduSectionTime[] {
    const raw = section as EduSection & { sectionTimes?: EduSectionTime[] };
    return raw.section_times || raw.sectionTimes || [];
  }

  sortedTimes(section: EduSection): EduSectionTime[] {
    const order = Object.keys(this.dayAr);
    return [...this.sectionTimes(section)].sort((a, b) => {
      const da = order.indexOf(a.day?.name || '');
      const db = order.indexOf(b.day?.name || '');
      const byDay = (da === -1 ? 99 : da) - (db === -1 ? 99 : db);
      if (byDay !== 0) return byDay;
      return String(a.start).localeCompare(String(b.start));
    });
  }

  formatClock(value?: string | null): string {
    if (!value) return '—';
    const m = String(value).match(/^(\d{1,2}):(\d{2})/);
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : String(value);
  }

  roomLabel(sec: EduSection): string {
    return sec.room_name || sec.room?.number || sec.room?.name || '—';
  }

  async bootstrap(force = false): Promise<void> {
    const hadData = this.sections.length > 0;
    if (!hadData) this.loading = true;
    try {
      const [sectionsRes, subjectsRes, daysRes] = await Promise.all([
        this.edu.getSections({ subject_id: this.filterSubjectId || undefined }),
        this.subjects.length && !force
          ? Promise.resolve({ data: this.subjects })
          : this.edu.getSubjects(),
        this.days.length && !force
          ? Promise.resolve({ data: this.days })
          : this.edu.getDays(),
      ]);

      this.sections = sectionsRes.data || [];
      this.subjects = (subjectsRes as { data?: EduSubject[] }).data || this.subjects;
      this.days = daysRes.data || this.days;
      if (!this.days.length) {
        await this.seedDefaultDays();
      }
      this.applyFilter();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.loading = false;
      this.initialLoad = false;
      this.cdr.detectChanges();
    }
  }

  applyFilter(): void {
    const q = this.search.trim().toLowerCase();
    this.filtered = !q
      ? [...this.sections]
      : this.sections.filter((sec) => {
          const subj = this.subjectLabel(sec.subject).toLowerCase();
          const doctor = (sec.doctor?.name || '').toLowerCase();
          const room = this.roomLabel(sec).toLowerCase();
          const times = this.sortedTimes(sec)
            .map((t) => `${this.dayLabel(t.day)} ${this.formatClock(t.start)}`)
            .join(' ')
            .toLowerCase();
          return (
            sec.number.toLowerCase().includes(q) ||
            subj.includes(q) ||
            doctor.includes(q) ||
            room.includes(q) ||
            times.includes(q)
          );
        });
    this.rebuildGroups();
  }

  private rebuildGroups(): void {
    const map = new Map<number, SubjectGroup>();

    for (const sec of this.filtered) {
      const sid = sec.subject_id;
      if (!map.has(sid)) {
        map.set(sid, {
          subjectId: sid,
          subject: sec.subject || this.subjects.find((s) => s.id === sid) || null,
          sections: [],
        });
      }
      map.get(sid)!.sections.push(sec);
    }

    // When filtering by subject with no sections, still show empty group.
    if (this.filterSubjectId && !map.has(this.filterSubjectId)) {
      map.set(this.filterSubjectId, {
        subjectId: this.filterSubjectId,
        subject: this.subjects.find((s) => s.id === this.filterSubjectId) || null,
        sections: [],
      });
    }

    this.groups = [...map.values()].sort((a, b) =>
      this.subjectLabel(a.subject).localeCompare(this.subjectLabel(b.subject), this.isRTL ? 'ar' : 'en'),
    );
  }

  onFilterChange(value: number | ''): void {
    const id = value === '' ? null : Number(value);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { subject_id: id || null },
      queryParamsHandling: 'merge',
    });
  }

  clearFilter(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { subject_id: null },
      queryParamsHandling: 'merge',
    });
  }

  openCreate(subjectId?: number | null): void {
    const ref = this.dialog.open(AddSection, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '640px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      autoFocus: false,
      data: {
        subjects: this.subjects,
        subjectId: subjectId ?? this.filterSubjectId,
        days: this.days,
        isRTL: this.isRTL,
      },
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this.scheduleCache.invalidate();
        void this.bootstrap(true);
      }
    });
  }

  async remove(sec: EduSection, event?: Event): Promise<void> {
    event?.stopPropagation();
    const label = `${this.subjectLabel(sec.subject)} · ${sec.number}`;
    const ok = confirm(this.translate.instant('SEC_DELETE_CONFIRM', { name: label }));
    if (!ok) return;
    try {
      await this.edu.deleteSection(sec.id);
      this.snackbar.show(this.translate.instant('SEC_DELETED'), 'success');
      this.scheduleCache.invalidate();
      await this.bootstrap(true);
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  openTimes(section: EduSection, event?: Event): void {
    event?.stopPropagation();
    const ref = this.dialog.open(SectionTimesDialog, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '560px',
      maxWidth: '94vw',
      maxHeight: '90vh',
      autoFocus: false,
      data: {
        section,
        days: this.days,
        isRTL: this.isRTL,
      },
    });
    ref.afterClosed().subscribe((result?: SectionTimesDialogResult) => {
      if (!result?.changed) return;
      this.patchSectionTimes(result.sectionId, result.times);
      this.scheduleCache.invalidate();
      this.cdr.detectChanges();
    });
  }

  private async seedDefaultDays(): Promise<void> {
    const defaults = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (const name of defaults) {
      try {
        await this.api.post(Apiendpointd.days, { name });
      } catch {
        /* ignore */
      }
    }
    try {
      const days = await this.edu.getDays();
      this.days = days.data || [];
    } catch {
      /* noop */
    }
  }

  private patchSectionTimes(sectionId: number, times: EduSectionTime[]): void {
    this.sections = this.sections.map((s) =>
      s.id === sectionId ? { ...s, section_times: times, sectionTimes: times } : s,
    );
    this.applyFilter();
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string } })?.error?.message;
    return typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED');
  }
}
