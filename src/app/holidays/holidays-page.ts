import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  GregorianHoliday,
  HolidaysService,
  IslamicHoliday,
  WeekendDay,
} from '../services/holidays.service';
import { SnackbarService } from '../services/snackbar.service';
import { PageSkeleton } from '../shared/page-skeleton/page-skeleton';

type HolidaysTab = 'weekends' | 'gregorian' | 'islamic';

const WEEKDAY_NAMES: Record<number, { en: string; ar: string }> = {
  0: { en: 'Sunday', ar: 'الأحد' },
  1: { en: 'Monday', ar: 'الإثنين' },
  2: { en: 'Tuesday', ar: 'الثلاثاء' },
  3: { en: 'Wednesday', ar: 'الأربعاء' },
  4: { en: 'Thursday', ar: 'الخميس' },
  5: { en: 'Friday', ar: 'الجمعة' },
  6: { en: 'Saturday', ar: 'السبت' },
};

const HIJRI_MONTHS: Record<number, { en: string; ar: string }> = {
  1: { en: 'Muharram', ar: 'محرم' },
  2: { en: 'Safar', ar: 'صفر' },
  3: { en: 'Rabiʻ I', ar: 'ربيع الأول' },
  4: { en: 'Rabiʻ II', ar: 'ربيع الآخر' },
  5: { en: 'Jumada I', ar: 'جمادى الأولى' },
  6: { en: 'Jumada II', ar: 'جمادى الآخرة' },
  7: { en: 'Rajab', ar: 'رجب' },
  8: { en: 'Shaʻban', ar: 'شعبان' },
  9: { en: 'Ramadan', ar: 'رمضان' },
  10: { en: 'Shawwal', ar: 'شوال' },
  11: { en: 'Dhu al-Qiʻdah', ar: 'ذو القعدة' },
  12: { en: 'Dhu al-Hijjah', ar: 'ذو الحجة' },
};

@Component({
  selector: 'app-holidays-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PageSkeleton],
  templateUrl: './holidays-page.html',
  styleUrl: './holidays-page.css',
})
export class HolidaysPage implements OnInit {
  private readonly api = inject(HolidaysService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);

  isRTL = false;
  loading = true;
  initialLoad = true;
  saving = false;
  tab: HolidaysTab = 'weekends';

  weekends: WeekendDay[] = [];
  gregorian: GregorianHoliday[] = [];
  islamic: IslamicHoliday[] = [];

  weekendDraft = { code: 5 as number | '', day_name: '' };
  gregorianDraft = { name: '', date: '', is_recurring: false };
  islamicDraft = {
    name: '',
    hijri_month: 1 as number | '',
    hijri_day: 1 as number | '',
    observed_date: '',
  };

  readonly weekdayCodes = [0, 1, 2, 3, 4, 5, 6];
  readonly hijriMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  get showSkeleton(): boolean {
    return this.initialLoad && !this.weekends.length && !this.gregorian.length && !this.islamic.length;
  }

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    this.translate.onLangChange.subscribe((e) => {
      this.isRTL = e.lang === 'ar';
      this.cdr.detectChanges();
    });
    this.onWeekendCodeChange(this.weekendDraft.code);
    void this.reload();
  }

  setTab(tab: HolidaysTab): void {
    this.tab = tab;
  }

  dayName(code: number): string {
    const entry = WEEKDAY_NAMES[code];
    if (!entry) return String(code);
    return this.isRTL ? entry.ar : entry.en;
  }

  hijriMonthName(month: number): string {
    const entry = HIJRI_MONTHS[month];
    if (!entry) return String(month);
    return this.isRTL ? entry.ar : entry.en;
  }

  hijriLabel(day: number, month: number): string {
    return `${day} ${this.hijriMonthName(month)}`;
  }

  /** Human-readable calendar date (never raw ISO). */
  formatDate(value?: string | null): string {
    if (!value) return '—';
    const d = this.parseDateValue(value);
    if (!d) return '—';
    return d.toLocaleDateString(this.isRTL ? 'ar-SA' : 'en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  async reload(): Promise<void> {
    const hadData = this.weekends.length > 0 || this.gregorian.length > 0 || this.islamic.length > 0;
    if (!hadData) {
      this.loading = true;
    }
    try {
      const [w, g, i] = await Promise.all([
        this.api.listWeekends(),
        this.api.listGregorian(),
        this.api.listIslamic(),
      ]);
      this.weekends = w.data || [];
      this.gregorian = g.data || [];
      this.islamic = i.data || [];
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.loading = false;
      this.initialLoad = false;
      this.cdr.detectChanges();
    }
  }

  async addWeekend(): Promise<void> {
    if (this.weekendDraft.code === '' || !this.weekendDraft.day_name.trim()) {
      this.snackbar.show(this.translate.instant('HOL_REQUIRED'), 'error');
      return;
    }
    this.saving = true;
    try {
      await this.api.createWeekend({
        code: Number(this.weekendDraft.code),
        day_name: this.weekendDraft.day_name.trim(),
      });
      this.weekendDraft = { code: 5, day_name: this.dayName(5) };
      this.snackbar.show(this.translate.instant('HOL_SAVED'), 'success');
      await this.reload();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  async removeWeekend(row: WeekendDay): Promise<void> {
    if (!confirm(this.translate.instant('HOL_DELETE_CONFIRM'))) return;
    try {
      await this.api.deleteWeekend(row.id);
      this.snackbar.show(this.translate.instant('HOL_DELETED'), 'success');
      await this.reload();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  async addGregorian(): Promise<void> {
    if (!this.gregorianDraft.name.trim() || !this.gregorianDraft.date) {
      this.snackbar.show(this.translate.instant('HOL_REQUIRED'), 'error');
      return;
    }
    this.saving = true;
    try {
      await this.api.createGregorian({
        name: this.gregorianDraft.name.trim(),
        date: this.toDateOnly(this.gregorianDraft.date),
        is_recurring: this.gregorianDraft.is_recurring,
      });
      this.gregorianDraft = { name: '', date: '', is_recurring: false };
      this.snackbar.show(this.translate.instant('HOL_SAVED'), 'success');
      await this.reload();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  async removeGregorian(row: GregorianHoliday): Promise<void> {
    if (!confirm(this.translate.instant('HOL_DELETE_CONFIRM'))) return;
    try {
      await this.api.deleteGregorian(row.id);
      this.snackbar.show(this.translate.instant('HOL_DELETED'), 'success');
      await this.reload();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  async addIslamic(): Promise<void> {
    if (
      !this.islamicDraft.name.trim() ||
      this.islamicDraft.hijri_month === '' ||
      this.islamicDraft.hijri_day === ''
    ) {
      this.snackbar.show(this.translate.instant('HOL_REQUIRED'), 'error');
      return;
    }
    this.saving = true;
    try {
      await this.api.createIslamic({
        name: this.islamicDraft.name.trim(),
        hijri_month: Number(this.islamicDraft.hijri_month),
        hijri_day: Number(this.islamicDraft.hijri_day),
        observed_date: this.islamicDraft.observed_date
          ? this.toDateOnly(this.islamicDraft.observed_date)
          : null,
      });
      this.islamicDraft = { name: '', hijri_month: 1, hijri_day: 1, observed_date: '' };
      this.snackbar.show(this.translate.instant('HOL_SAVED'), 'success');
      await this.reload();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  async removeIslamic(row: IslamicHoliday): Promise<void> {
    if (!confirm(this.translate.instant('HOL_DELETE_CONFIRM'))) return;
    try {
      await this.api.deleteIslamic(row.id);
      this.snackbar.show(this.translate.instant('HOL_DELETED'), 'success');
      await this.reload();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  onWeekendCodeChange(code: number | ''): void {
    if (code === '') return;
    this.weekendDraft.day_name = this.dayName(Number(code));
  }

  private toDateOnly(value: string): string {
    const m = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : value;
  }

  private parseDateValue(value: string): Date | null {
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y, m, d] = raw.split('-').map(Number);
      const local = new Date(y, m - 1, d);
      return Number.isNaN(local.getTime()) ? null : local;
    }
    // Laravel ISO date cast (e.g. 2026-03-19T21:00:00.000000Z): use local calendar day.
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string } })?.error?.message;
    return typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED');
  }
}
