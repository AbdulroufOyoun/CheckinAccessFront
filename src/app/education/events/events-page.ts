import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PageSkeleton } from '../../shared/page-skeleton/page-skeleton';
import { SnackbarService } from '../../services/snackbar.service';
import { EduEvent, EventsService } from '../../services/events.service';

@Component({
  selector: 'app-events-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PageSkeleton, RouterLink],
  templateUrl: './events-page.html',
  styleUrls: ['../education-shared.css', './events-page.css'],
})
export class EventsPage implements OnInit {
  private readonly eventsApi = inject(EventsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);

  isRTL = false;
  loading = false;
  initialLoad = true;
  rows: EduEvent[] = [];
  statusFilter = '';
  search = '';

  get showSkeleton(): boolean {
    return this.initialLoad && this.loading && this.rows.length === 0;
  }

  get filteredRows(): EduEvent[] {
    const q = this.search.trim().toLowerCase();
    return this.rows.filter((row) => {
      if (this.statusFilter && row.status !== this.statusFilter) return false;
      if (!q) return true;
      const hay = [row.name, row.description, row.status].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    void this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    try {
      const res = await this.eventsApi.list();
      this.rows = res.data || [];
    } catch {
      this.snackbar.show(this.translate.instant('REQUEST_FAILED'), 'error');
    } finally {
      this.loading = false;
      this.initialLoad = false;
      this.cdr.detectChanges();
    }
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      draft: 'EVT_STATUS_DRAFT',
      active: 'EVT_STATUS_ACTIVE',
      cancelled: 'EVT_STATUS_CANCELLED',
    };
    return this.translate.instant(map[status] || status);
  }

  audienceLabel(row: EduEvent): string {
    return row.audience_mode === 'all_students'
      ? this.translate.instant('EVT_AUDIENCE_ALL')
      : this.translate.instant('EVT_AUDIENCE_SELECTED', { n: row.attendees?.length || 0 });
  }

  roomLabel(row: EduEvent): string {
    const rooms = row.rooms || [];
    if (!rooms.length) return '—';
    if (rooms.length === 1) return rooms[0].number || rooms[0].name || `#${rooms[0].id}`;
    return this.translate.instant('EVT_ROOMS_COUNT', { n: rooms.length });
  }

  async activate(row: EduEvent): Promise<void> {
    try {
      await this.eventsApi.activate(row.id);
      this.snackbar.show(this.translate.instant('EVT_ACTIVATED'), 'success');
      await this.load();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  async cancel(row: EduEvent): Promise<void> {
    if (!confirm(this.translate.instant('EVT_CANCEL_CONFIRM'))) return;
    try {
      await this.eventsApi.cancel(row.id);
      this.snackbar.show(this.translate.instant('EVT_CANCELLED'), 'success');
      await this.load();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  async remove(row: EduEvent): Promise<void> {
    if (!confirm(this.translate.instant('EVT_DELETE_CONFIRM'))) return;
    try {
      await this.eventsApi.delete(row.id);
      this.snackbar.show(this.translate.instant('EVT_DELETED'), 'success');
      await this.load();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  edit(row: EduEvent): void {
    void this.router.navigate(['/Education/Events/New'], { queryParams: { id: row.id } });
  }

  private err(e: unknown): string {
    const body = (e as { error?: { message?: string } })?.error;
    return typeof body?.message === 'string' && body.message.trim()
      ? body.message
      : this.translate.instant('REQUEST_FAILED');
  }
}
