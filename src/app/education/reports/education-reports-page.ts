import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { EducationService, EduReports } from '../../services/education.service';
import { SnackbarService } from '../../services/snackbar.service';
import { PageSkeleton } from '../../shared/page-skeleton/page-skeleton';

@Component({
  selector: 'app-education-reports-page',
  standalone: true,
  imports: [CommonModule, TranslateModule, PageSkeleton],
  templateUrl: './education-reports-page.html',
  styleUrls: ['../education-shared.css'],
})
export class EducationReportsPage implements OnInit {
  private readonly edu = inject(EducationService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);

  reports: EduReports | null = null;
  loading = false;
  isRTL = false;

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    this.translate.onLangChange.subscribe((e) => {
      this.isRTL = e.lang === 'ar';
      this.cdr.detectChanges();
    });
    void this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    try {
      const res = await this.edu.getReports();
      this.reports = res.data;
    } catch (e: unknown) {
      const m = (e as { error?: { message?: string } })?.error?.message;
      this.snackbar.show(
        typeof m === 'string' ? m : this.translate.instant('EDU_REP_LOAD_FAILED'),
        'error',
      );
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  statusEntries(): Array<{ key: string; value: number }> {
    const map = this.reports?.enrollments_by_status || {};
    return Object.keys(map).map((key) => ({ key, value: Number(map[key]) || 0 }));
  }

  statusLabel(status: string): string {
    const key = `EDU_REP_STATUS_${status.toUpperCase()}`;
    const translated = this.translate.instant(key);
    return translated === key ? status : translated;
  }
}
