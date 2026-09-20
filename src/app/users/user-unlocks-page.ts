import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DoorUnlockRecord, DoorUnlockService } from '../services/door-unlock.service';
import { UsersService, TenantUser } from '../services/users.service';
import { SnackbarService } from '../services/snackbar.service';
import { PageSkeleton } from '../shared/page-skeleton/page-skeleton';

@Component({
  selector: 'app-user-unlocks-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule, PageSkeleton],
  templateUrl: './user-unlocks-page.html',
  styleUrls: ['./user-unlocks-page.css', '../reports/reports.css'],
})
export class UserUnlocksPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly unlocksApi = inject(DoorUnlockService);
  private readonly usersApi = inject(UsersService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);

  readonly perPage = 25;
  isRTL = false;
  loading = true;
  userId = 0;
  user: TenantUser | null = null;
  records: DoorUnlockRecord[] = [];
  total = 0;
  currentPage = 1;
  lastPage = 1;
  pageFrom = 0;
  pageTo = 0;
  start = '';
  end = '';

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    this.userId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.userId) {
      this.loading = false;
      return;
    }
    void this.load();
  }

  back(): void {
    this.location.back();
  }

  onFiltersChange(): void {
    this.currentPage = 1;
    void this.loadRecords();
  }

  goToPage(page: number): void {
    const next = Math.min(Math.max(page, 1), this.lastPage || 1);
    if (next === this.currentPage) return;
    this.currentPage = next;
    void this.loadRecords();
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      const profile = await this.usersApi.show(this.userId);
      this.user = profile.data ?? null;
      await this.loadRecords(false);
    } catch (error: unknown) {
      this.snackbar.show(this.errorText(error), 'error');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private async loadRecords(showLoading = true): Promise<void> {
    if (showLoading) this.loading = true;
    try {
      const page = await this.unlocksApi.listByUser(this.userId, {
        start: this.start || undefined,
        end: this.end || undefined,
        page: this.currentPage,
        per_page: this.perPage,
      });
      this.records = page.data || [];
      this.total = page.total ?? this.records.length;
      this.currentPage = page.current_page ?? this.currentPage;
      this.lastPage = page.last_page ?? 1;
      this.pageFrom = page.from ?? (this.records.length ? (this.currentPage - 1) * this.perPage + 1 : 0);
      this.pageTo = page.to ?? this.pageFrom + this.records.length - (this.records.length ? 1 : 0);
    } catch (error: unknown) {
      this.records = [];
      this.total = 0;
      this.snackbar.show(this.errorText(error), 'error');
    } finally {
      if (showLoading) {
        this.loading = false;
        this.cdr.detectChanges();
      }
    }
  }

  private errorText(error: unknown): string {
    const body = (error as { error?: { message?: unknown } })?.error;
    const message = body?.message;
    if (typeof message === 'string' && message.trim()) return message;
    return this.translate.instant('REP_LOAD_FAILED');
  }
}
