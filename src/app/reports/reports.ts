import {
  ChangeDetectorRef,
  Component,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { DoorUnlockRecord, DoorUnlockService } from '../services/door-unlock.service';
import { SnackbarService } from '../services/snackbar.service';
import { PageSkeleton } from '../shared/page-skeleton/page-skeleton';
import { AuthService } from '../services/auth.service';
import { Apiendpointd } from '../apiEndpoints';
import { LocaleService } from '../services/locale.service';
import { TenantDateTimePipe } from '../pipes/tenant-date.pipe';

@Component({
  selector: 'app-reports',
  imports: [CommonModule, FormsModule, TranslateModule, PageSkeleton, TenantDateTimePipe],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports implements OnInit {
  private readonly api = inject(DoorUnlockService);
  private readonly http = inject(HttpClient);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LocaleService);

  loading = true;
  pdfLoading = false;
  records: DoorUnlockRecord[] = [];
  total = 0;
  start = '';
  end = '';

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      void this.load();
    }
  }

  async load(): Promise<void> {
    this.loading = true;
    try {
      const page = await this.api.list({
        start: this.start || undefined,
        end: this.end || undefined,
        per_page: 50,
      });
      this.records = page.data || [];
      this.total = page.total ?? this.records.length;
    } catch (e: unknown) {
      this.records = [];
      this.total = 0;
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: string }).message)
          : this.translate.instant('REP_LOAD_FAILED');
      this.snackbar.show(msg, 'error');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async downloadPdf(): Promise<void> {
    const token = this.auth.getToken();
    if (!token) {
      return;
    }
    this.pdfLoading = true;
    try {
      const lang = this.locale.lang();
      const url = Apiendpointd.doorUnlockHistoryPdf(this.start || undefined, this.end || undefined, lang);
      const blob = await firstValueFrom(
        this.http.get(url, {
          responseType: 'blob',
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `door-unlock-${new Date().toISOString().slice(0, 10)}.pdf`;
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
