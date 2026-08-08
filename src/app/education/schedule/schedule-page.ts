import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  AcademicTerm,
  EduDay,
  EduSection,
  EduSectionTime,
  EduSubject,
} from '../../services/education.service';
import { EducationReferenceCache } from '../../services/education-reference-cache.service';
import { SnackbarService } from '../../services/snackbar.service';
import { PageSkeleton } from '../../shared/page-skeleton/page-skeleton';

interface AtomicRow {
  key: string;
  start: string;
  end: string;
  startMin: number;
  endMin: number;
  label: string;
  /** CSS grid row height in px (duration-flexible). */
  heightPx: number;
}

interface ScheduleEvent {
  id: string;
  section: EduSection;
  time: EduSectionTime;
  dayId: number;
  subject: string;
  sectionNumber: string;
  doctor: string;
  room: string;
  practical: boolean;
  start: string;
  end: string;
  startMin: number;
  endMin: number;
  rowStart: number; // 1-based CSS grid row
  rowSpan: number;
  lane: number; // 0-based
  laneCount: number;
  timeLabel: string;
}

interface DayTrack {
  day: EduDay;
  events: ScheduleEvent[];
  laneCount: number;
  columnTemplate: string;
}

@Component({
  selector: 'app-schedule-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule, PageSkeleton],
  templateUrl: './schedule-page.html',
  styleUrls: ['../education-shared.css', './schedule-page.css'],
})
export class SchedulePage implements OnInit {
  private readonly scheduleCache = inject(EducationReferenceCache);
  private readonly snackbar = inject(SnackbarService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  private static readonly MIN_ROW_PX = 36;
  private static readonly PX_PER_MINUTE = 1.15;

  loading = false;
  initialLoad = true;
  isRTL = false;
  sections: EduSection[] = [];
  subjects: EduSubject[] = [];
  days: EduDay[] = [];
  openTerms: AcademicTerm[] = [];
  activeTerm: AcademicTerm | null = null;
  filterSubjectId: number | null = null;
  filterTermId: number | null = null;
  atomicRows: AtomicRow[] = [];
  dayTracks: DayTrack[] = [];
  /** Fixed px rows — keeps on-screen timeline proportional and aligned. */
  rowsTemplate = '';
  /** Duration-weighted fr rows — used only when printing to stretch the table. */
  rowsTemplateFr = '';
  trackHeightPx = 0;
  printedAt = '';
  private afterPrintHandler: (() => void) | null = null;
  /** Ignores out-of-order schedule responses when filters change quickly. */
  private loadToken = 0;

  private readonly dayAr: Record<string, string> = {
    Sunday: 'الأحد',
    Monday: 'الإثنين',
    Tuesday: 'الثلاثاء',
    Wednesday: 'الأربعاء',
    Thursday: 'الخميس',
    Friday: 'الجمعة',
    Saturday: 'السبت',
  };

  private readonly dayOrder = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

  get showSkeleton(): boolean {
    return this.initialLoad && this.sections.length === 0 && this.days.length === 0;
  }

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    this.translate.onLangChange.subscribe((e) => {
      this.isRTL = e.lang === 'ar';
      this.rebuildGrid();
      this.cdr.detectChanges();
    });
    const cached = this.scheduleCache.peekScheduleBundle(this.filterSubjectId, this.filterTermId);
    if (cached) {
      this.applyBundle(cached);
      this.initialLoad = false;
    }
    void this.load();
  }

  get filterSubjectLabel(): string {
    if (this.filterSubjectId == null) return '';
    const s = this.subjects.find((x) => x.id === this.filterSubjectId);
    return s ? this.subjectLabel(s) : '';
  }

  get termLabel(): string {
    if (!this.activeTerm) return '';
    if (this.isRTL) {
      return this.activeTerm.name_ar || this.activeTerm.name || '';
    }
    return this.activeTerm.name || this.activeTerm.name_ar || '';
  }

  get termDatesLabel(): string {
    if (!this.activeTerm) return '';
    const from = this.formatDate(this.activeTerm.starts_on);
    const to = this.formatDate(this.activeTerm.ends_on);
    if (!from && !to) {
      return this.translate.instant('SCHED_TERM_NO_DATES');
    }
    return this.translate.instant('SCHED_TERM_DATES', {
      from: from || '—',
      to: to || '—',
    });
  }

  get hasEntries(): boolean {
    return this.atomicRows.length > 0 && this.dayTracks.some((t) => t.events.length > 0);
  }

  get hasOpenTerms(): boolean {
    return this.openTerms.length > 0;
  }

  eventGridRow(ev: ScheduleEvent): string {
    return `${ev.rowStart} / span ${ev.rowSpan}`;
  }

  eventGridColumn(ev: ScheduleEvent): string {
    return `${ev.lane + 1} / span 1`;
  }

  subjectLabel(s?: EduSubject | null): string {
    if (!s) return '';
    if (this.isRTL) return s.name_ar || s.name;
    return s.name || s.name_ar || '';
  }

  termOptionLabel(t: AcademicTerm): string {
    const name = this.isRTL ? t.name_ar || t.name : t.name || t.name_ar || '';
    const from = this.formatDate(t.starts_on);
    const to = this.formatDate(t.ends_on);
    if (from || to) {
      return `${name} (${from || '—'} → ${to || '—'})`;
    }
    return name;
  }

  dayLabel(d?: EduDay | null): string {
    if (!d) return '';
    if (this.isRTL) return this.dayAr[d.name] || d.name_ar || d.name;
    return d.name;
  }

  onSubjectFilterChange(raw: number | ''): void {
    this.filterSubjectId = raw === '' || raw == null ? null : Number(raw);
    void this.load(false);
  }

  onTermFilterChange(raw: number | ''): void {
    this.filterTermId = raw === '' || raw == null ? null : Number(raw);
    // Subject filter from another term often yields a false empty schedule.
    this.filterSubjectId = null;
    void this.load(false);
  }

  print(): void {
    const locale = this.isRTL ? 'ar-SA' : 'en-GB';
    this.printedAt = new Date().toLocaleString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    this.cdr.detectChanges();

    const body = this.document.body;
    const head = this.document.head;
    body.classList.add('print-schedule');

    let pageStyle = head.querySelector('style[data-print-schedule]') as HTMLStyleElement | null;
    if (!pageStyle) {
      pageStyle = this.document.createElement('style');
      pageStyle.setAttribute('data-print-schedule', '1');
      pageStyle.textContent = '@page { size: A4 landscape; margin: 4mm 5mm; }';
      head.appendChild(pageStyle);
    }

    const cleanup = () => {
      body.classList.remove('print-schedule');
      pageStyle?.remove();
      if (this.afterPrintHandler) {
        this.document.defaultView?.removeEventListener('afterprint', this.afterPrintHandler);
        this.afterPrintHandler = null;
      }
    };
    this.afterPrintHandler = cleanup;
    this.document.defaultView?.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 60_000);
    window.print();
  }

  async load(force = false): Promise<void> {
    const token = ++this.loadToken;
    const requestedTermId = this.filterTermId;
    const requestedSubjectId = this.filterSubjectId;
    this.loading = true;
    this.cdr.detectChanges();

    try {
      const bundle = await this.scheduleCache.getScheduleBundle(requestedSubjectId, {
        force,
        allowStale: !force,
        termId: requestedTermId,
      });

      // Drop stale responses from an earlier term/subject selection.
      if (token !== this.loadToken) {
        return;
      }
      if (requestedTermId !== this.filterTermId || requestedSubjectId !== this.filterSubjectId) {
        return;
      }

      this.applyBundle(bundle);
    } catch (e: unknown) {
      if (token !== this.loadToken) {
        return;
      }
      this.snackbar.show(this.err(e), 'error');
    } finally {
      if (token === this.loadToken) {
        this.loading = false;
        this.initialLoad = false;
        this.cdr.detectChanges();
      }
    }
  }

  private applyBundle(bundle: {
    sections?: EduSection[];
    subjects?: EduSubject[];
    days?: EduDay[];
    active_term?: AcademicTerm | null;
    selected_term?: AcademicTerm | null;
    open_terms?: AcademicTerm[];
  }): void {
    this.sections = (bundle.sections || []).filter((s) => s.active !== false);
    this.subjects = bundle.subjects || [];
    this.days = this.sortDays(bundle.days || []);
    this.openTerms = bundle.open_terms || [];

    // Never overwrite an explicit user term choice with a late/auto bundle term.
    if (this.filterTermId == null) {
      const suggested =
        bundle.selected_term ?? bundle.active_term ?? this.openTerms[0] ?? null;
      this.activeTerm = suggested;
      if (suggested?.id != null) {
        this.filterTermId = suggested.id;
      }
    } else {
      this.activeTerm =
        this.openTerms.find((t) => t.id === this.filterTermId) ??
        (bundle.selected_term?.id === this.filterTermId ? bundle.selected_term : null) ??
        (bundle.active_term?.id === this.filterTermId ? bundle.active_term : null) ??
        null;

      if (!this.openTerms.some((t) => t.id === this.filterTermId)) {
        this.filterTermId = this.openTerms[0]?.id ?? null;
        this.activeTerm = this.openTerms[0] ?? null;
      }
    }

    this.rebuildGrid();
  }

  refresh(): void {
    void this.load(true);
  }

  private formatDate(value?: string | null): string {
    if (!value) return '';
    const raw = String(value).slice(0, 10);
    const d = new Date(`${raw}T12:00:00`);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString(this.isRTL ? 'ar-SA' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  private rebuildGrid(): void {
    const rawEvents: Omit<ScheduleEvent, 'rowStart' | 'rowSpan' | 'lane' | 'laneCount'>[] = [];
    const boundaryMins = new Set<number>();

    for (const section of this.sections) {
      for (const time of this.sectionTimes(section)) {
        const start = this.normalizeTime(time.start);
        const end = this.normalizeTime(time.end);
        if (!start || !end || !time.day_id) continue;
        const startMin = this.toMinutes(start);
        const endMin = this.toMinutes(end);
        if (startMin == null || endMin == null || endMin <= startMin) continue;

        boundaryMins.add(startMin);
        boundaryMins.add(endMin);

        rawEvents.push({
          id: `${section.id}-${time.id}`,
          section,
          time,
          dayId: time.day_id,
          subject: this.subjectLabel(section.subject) || `#${section.subject_id}`,
          sectionNumber: section.number || '—',
          doctor: section.doctor?.name || (section.doctor_id ? `#${section.doctor_id}` : '—'),
          room: section.room_name || section.room?.number || section.room?.name || '—',
          practical: !!section.is_practical,
          start,
          end,
          startMin,
          endMin,
          timeLabel: `${this.formatTime(start)} – ${this.formatTime(end)}`,
        });
      }
    }

    const sortedBounds = [...boundaryMins].sort((a, b) => a - b);
    this.atomicRows = [];
    for (let i = 0; i < sortedBounds.length - 1; i++) {
      const startMin = sortedBounds[i];
      const endMin = sortedBounds[i + 1];
      const start = this.fromMinutes(startMin);
      const end = this.fromMinutes(endMin);
      const duration = endMin - startMin;
      this.atomicRows.push({
        key: `${start}|${end}`,
        start,
        end,
        startMin,
        endMin,
        label: `${this.formatTime(start)} – ${this.formatTime(end)}`,
        heightPx: Math.max(
          SchedulePage.MIN_ROW_PX,
          Math.round(duration * SchedulePage.PX_PER_MINUTE),
        ),
      });
    }

    this.rowsTemplate = this.atomicRows.map((r) => `${r.heightPx}px`).join(' ');
    this.rowsTemplateFr = this.atomicRows
      .map((r) => `minmax(0, ${Math.max(1, r.endMin - r.startMin)}fr)`)
      .join(' ');
    this.trackHeightPx = this.atomicRows.reduce((sum, r) => sum + r.heightPx, 0);

    const byDay = new Map<number, typeof rawEvents>();
    for (const ev of rawEvents) {
      const list = byDay.get(ev.dayId) || [];
      list.push(ev);
      byDay.set(ev.dayId, list);
    }

    this.dayTracks = this.days.map((day) => {
      const dayRaw = byDay.get(day.id) || [];
      const laidOut = this.layoutDay(dayRaw);
      const laneCount = Math.max(1, ...laidOut.map((e) => e.lane + 1), 1);
      return {
        day,
        events: laidOut,
        laneCount,
        columnTemplate: `repeat(${laneCount}, minmax(0, 1fr))`,
      };
    });
  }

  private layoutDay(
    raw: Omit<ScheduleEvent, 'rowStart' | 'rowSpan' | 'lane' | 'laneCount'>[],
  ): ScheduleEvent[] {
    const sorted = [...raw].sort((a, b) => {
      const byStart = a.startMin - b.startMin;
      if (byStart !== 0) return byStart;
      return b.endMin - a.endMin;
    });

    const laneEnds: number[] = [];
    const withLanes: ScheduleEvent[] = [];

    for (const ev of sorted) {
      let lane = 0;
      while (lane < laneEnds.length && laneEnds[lane] > ev.startMin) {
        lane++;
      }
      laneEnds[lane] = ev.endMin;

      const rowStart = this.atomicRows.findIndex((r) => r.startMin === ev.startMin);
      const rowEnd = this.atomicRows.findIndex((r) => r.endMin === ev.endMin);
      const startIdx = rowStart >= 0 ? rowStart : this.atomicRows.findIndex((r) => r.startMin >= ev.startMin);
      const endIdx =
        rowEnd >= 0
          ? rowEnd
          : (() => {
              let last = -1;
              for (let i = 0; i < this.atomicRows.length; i++) {
                if (this.atomicRows[i].endMin <= ev.endMin) last = i;
              }
              return last;
            })();

      const safeStart = Math.max(0, startIdx);
      const safeEnd = Math.max(safeStart, endIdx);
      const rowSpan = safeEnd - safeStart + 1;

      withLanes.push({
        ...ev,
        lane,
        laneCount: 1,
        rowStart: safeStart + 1,
        rowSpan,
      });
    }

    // Cluster-aware laneCount for equal width within overlap groups.
    for (const ev of withLanes) {
      const overlapping = withLanes.filter(
        (o) => o.startMin < ev.endMin && o.endMin > ev.startMin,
      );
      const maxLane = Math.max(...overlapping.map((o) => o.lane));
      ev.laneCount = maxLane + 1;
    }

    return withLanes;
  }

  private sectionTimes(section: EduSection): EduSectionTime[] {
    const raw = section as EduSection & { sectionTimes?: EduSectionTime[] };
    return raw.section_times || raw.sectionTimes || [];
  }

  private sortDays(days: EduDay[]): EduDay[] {
    return [...days].sort((a, b) => {
      const ai = this.dayOrder.indexOf(a.name);
      const bi = this.dayOrder.indexOf(b.name);
      const av = ai === -1 ? 99 : ai;
      const bv = bi === -1 ? 99 : bi;
      return av - bv || a.id - b.id;
    });
  }

  private normalizeTime(value?: string | null): string {
    if (!value) return '';
    const m = String(value).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return String(value);
    return `${m[1].padStart(2, '0')}:${m[2]}:${(m[3] || '00').padStart(2, '0')}`;
  }

  private toMinutes(value: string): number | null {
    const m = value.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  private fromMinutes(total: number): string {
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  }

  formatTime(value: string): string {
    const m = value.match(/^(\d{2}):(\d{2})/);
    return m ? `${m[1]}:${m[2]}` : value;
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string } })?.error?.message;
    return typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED');
  }
}
