import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  DurationKind,
  DurationPreset,
  DurationScope,
  DurationsService,
} from '../services/durations.service';
import { AuthService } from '../services/auth.service';
import { SnackbarService } from '../services/snackbar.service';
import { PageSkeleton } from '../shared/page-skeleton/page-skeleton';

@Component({
  selector: 'app-durations-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PageSkeleton],
  templateUrl: './durations-page.html',
  styleUrl: './durations-page.css',
})
export class DurationsPage implements OnInit {
  private readonly api = inject(DurationsService);
  private readonly auth = inject(AuthService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);

  isRTL = false;
  loading = true;
  initialLoad = true;
  saving = false;
  items: DurationPreset[] = [];
  today = '';

  draft = {
    name: '',
    kind: 'time' as DurationKind,
    start_time: '09:00',
    end_time: '11:00',
    days: 7,
    start_date: '',
    end_date: '',
    scope: 'both' as DurationScope,
  };

  get hasProperty(): boolean {
    return this.auth.hasModule('property');
  }

  get hasEducation(): boolean {
    return this.auth.hasModule('education');
  }

  get showScopeSelector(): boolean {
    return this.hasProperty && this.hasEducation;
  }

  get canManage(): boolean {
    return (
      (this.hasProperty && this.auth.can('manage bookings')) ||
      (this.hasEducation && this.auth.can('manage education'))
    );
  }

  get showStayKinds(): boolean {
    return this.hasProperty;
  }

  get showSkeleton(): boolean {
    return this.initialLoad && !this.items.length;
  }

  ngOnInit(): void {
    this.today = this.localIsoDate();
    this.draft.start_date = this.today;
    this.draft.end_date = this.today;
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    this.translate.onLangChange.subscribe((e) => {
      this.isRTL = e.lang === 'ar';
      this.cdr.detectChanges();
    });
    this.draft.scope = this.defaultScope();
    if (!this.showStayKinds) {
      this.draft.kind = 'time';
    }
    void this.reload();
  }

  defaultScope(): DurationScope {
    if (this.hasProperty && !this.hasEducation) return 'property';
    if (this.hasEducation && !this.hasProperty) return 'education';
    return 'both';
  }

  scopeLabel(scope: DurationScope): string {
    const map: Record<DurationScope, string> = {
      property: 'DUR_SCOPE_PROPERTY',
      education: 'DUR_SCOPE_EDUCATION',
      both: 'DUR_SCOPE_BOTH',
    };
    return this.translate.instant(map[scope]);
  }

  kindLabel(kind: DurationKind): string {
    const map: Record<DurationKind, string> = {
      time: 'DUR_KIND_TIME',
      days: 'DUR_KIND_DAYS',
      date_range: 'DUR_KIND_DATE_RANGE',
    };
    return this.translate.instant(map[kind]);
  }

  valueLabel(row: DurationPreset): string {
    if (row.kind === 'days') {
      return this.translate.instant('DUR_DAYS_VALUE', { n: row.days ?? 0 });
    }
    if (row.kind === 'date_range') {
      return `${this.formatDate(row.start_date)} – ${this.formatDate(row.end_date)}`;
    }
    return `${this.formatClock(row.start_time)} – ${this.formatClock(row.end_time)}`;
  }

  formatClock(value?: string | null): string {
    if (!value) return '—';
    const m = String(value).match(/^(\d{1,2}):(\d{2})/);
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : String(value);
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(`${value}T12:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString(this.isRTL ? 'ar-SA' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  async reload(): Promise<void> {
    const hadData = this.items.length > 0;
    if (!hadData) this.loading = true;
    try {
      const res = await this.api.list();
      this.items = res.data || [];
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.loading = false;
      this.initialLoad = false;
      this.cdr.detectChanges();
    }
  }

  async addDuration(): Promise<void> {
    if (!this.draft.name.trim()) {
      this.snackbar.show(this.translate.instant('DUR_REQUIRED'), 'error');
      return;
    }
    if (this.draft.kind === 'time') {
      if (!this.draft.start_time || !this.draft.end_time || this.draft.end_time <= this.draft.start_time) {
        this.snackbar.show(this.translate.instant('DUR_TIME_INVALID'), 'error');
        return;
      }
    } else if (this.draft.kind === 'days') {
      if (!this.draft.days || Number(this.draft.days) < 1) {
        this.snackbar.show(this.translate.instant('DUR_DAYS_INVALID'), 'error');
        return;
      }
    } else if (!this.draft.start_date || !this.draft.end_date || this.draft.end_date < this.draft.start_date) {
      this.snackbar.show(this.translate.instant('DUR_DATE_RANGE_INVALID'), 'error');
      return;
    }

    this.saving = true;
    try {
      await this.api.create({
        name: this.draft.name.trim(),
        kind: this.draft.kind,
        start_time: this.draft.kind === 'time' ? this.draft.start_time : null,
        end_time: this.draft.kind === 'time' ? this.draft.end_time : null,
        days: this.draft.kind === 'days' ? Number(this.draft.days) : null,
        start_date: this.draft.kind === 'date_range' ? this.draft.start_date : null,
        end_date: this.draft.kind === 'date_range' ? this.draft.end_date : null,
        scope: this.showScopeSelector ? this.draft.scope : this.defaultScope(),
      });
      this.draft.name = '';
      this.draft.start_time = '09:00';
      this.draft.end_time = '11:00';
      this.draft.days = 7;
      this.draft.start_date = this.today;
      this.draft.end_date = this.today;
      this.snackbar.show(this.translate.instant('DUR_SAVED'), 'success');
      await this.reload();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  async toggleActive(row: DurationPreset): Promise<void> {
    try {
      if (row.active) {
        await this.api.inactivate(row.id);
      } else {
        await this.api.activate(row.id);
      }
      await this.reload();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  async remove(row: DurationPreset): Promise<void> {
    if (!confirm(this.translate.instant('DUR_DELETE_CONFIRM'))) return;
    try {
      await this.api.delete(row.id);
      this.snackbar.show(this.translate.instant('DUR_DELETED'), 'success');
      await this.reload();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  private localIsoDate(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string } })?.error?.message;
    return typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED');
  }
}
