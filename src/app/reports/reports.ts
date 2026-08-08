import {
  ChangeDetectorRef,
  Component,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DoorUnlockRecord, DoorUnlockService } from '../services/door-unlock.service';
import { SnackbarService } from '../services/snackbar.service';
import { PageSkeleton } from '../shared/page-skeleton/page-skeleton';

@Component({
  selector: 'app-reports',
  imports: [CommonModule, FormsModule, TranslateModule, PageSkeleton],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports implements OnInit {
  private readonly api = inject(DoorUnlockService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);

  loading = true;
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
}
