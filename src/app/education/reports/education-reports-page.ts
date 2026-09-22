import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { EducationService, EduReports } from '../../services/education.service';
import { SnackbarService } from '../../services/snackbar.service';
import { PageSkeleton } from '../../shared/page-skeleton/page-skeleton';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { Apiendpointd } from '../../apiEndpoints';
import { LocaleService } from '../../services/locale.service';

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
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LocaleService);

  reports: EduReports | null = null;
  loading = false;
  pdfLoading = false;
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

  async downloadPdf(): Promise<void> {
    const token = this.auth.getToken();
    if (!token) {
      return;
    }
    this.pdfLoading = true;
    try {
      const url = Apiendpointd.educationReportsPdf(this.locale.lang());
      const blob = await firstValueFrom(
        this.http.get(url, {
          responseType: 'blob',
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      const objectUrl = URL.createObjectURL(blob);
      const a = this.document.createElement('a');
      a.href = objectUrl;
      a.download = `education-reports-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      this.snackbar.show(this.translate.instant('REP_PDF_FAILED'), 'error');
    } finally {
      this.pdfLoading = false;
      this.cdr.detectChanges();
    }
  }
}
