import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { PageSkeleton } from '../../shared/page-skeleton/page-skeleton';
import { SnackbarService } from '../../services/snackbar.service';
import { DialogMobileService } from '../../services/dialog-mobile.service';
import { ConfirmDialog } from '../../dialog/confirm-dialog/confirm-dialog';
import { EduEvent, EventsService } from '../../services/events.service';

/** Timeline label for list cards (distinct from workflow status draft/active/cancelled). */
export type EventDisplayPhase = 'draft' | 'cancelled' | 'upcoming' | 'ongoing' | 'ended';

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
  private readonly dialogMobile = inject(DialogMobileService);

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

  displayPhase(row: EduEvent): EventDisplayPhase {
    if (row.status === 'cancelled') {
      return 'cancelled';
    }
    if (row.status === 'draft') {
      return 'draft';
    }

    const today = this.localIsoDate();
    const start = (row.start_date || '').slice(0, 10);
    const end = (row.end_date || '').slice(0, 10);

    if (end && end < today) {
      return 'ended';
    }
    if (start && start > today) {
      return 'upcoming';
    }

    return 'ongoing';
  }

  statusLabel(row: EduEvent): string {
    const map: Record<EventDisplayPhase, string> = {
      draft: 'EVT_STATUS_DRAFT',
      cancelled: 'EVT_STATUS_CANCELLED',
      upcoming: 'EVT_STATUS_UPCOMING',
      ongoing: 'EVT_STATUS_ONGOING',
      ended: 'EVT_STATUS_ENDED',
    };
    return this.translate.instant(map[this.displayPhase(row)]);
  }

  private localIsoDate(date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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
    if (!(await this.openCancelConfirm(row))) return;
    try {
      await this.eventsApi.cancel(row.id);
      this.snackbar.show(this.translate.instant('EVT_CANCELLED'), 'success');
      await this.load();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  async remove(row: EduEvent): Promise<void> {
    if (!(await this.openDeleteConfirm(row))) return;
    try {
      await this.eventsApi.delete(row.id);
      this.snackbar.show(this.translate.instant('EVT_DELETED'), 'success');
      await this.load();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  edit(row: EduEvent): void {
    void this.router.navigate(['/Education/Events/Edit', row.id]);
  }

  private async openCancelConfirm(row: EduEvent): Promise<boolean> {
    const ref = this.dialogMobile.open(ConfirmDialog, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      width: '440px',
      maxWidth: '94vw',
      data: {
        variant: 'danger',
        titleKey: 'EVT_CANCEL_DIALOG_TITLE',
        messageKey: 'EVT_CANCEL_DIALOG_MESSAGE',
        hintKey: 'EVT_CANCEL_DIALOG_HINT',
        confirmKey: 'EVT_CANCEL_DIALOG_CONFIRM',
        preview: {
          title: row.name,
          subtitle: `${row.start_date} → ${row.end_date}`,
        },
      },
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  private async openDeleteConfirm(row: EduEvent): Promise<boolean> {
    const ref = this.dialogMobile.open(ConfirmDialog, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      width: '440px',
      maxWidth: '94vw',
      data: {
        variant: 'warning',
        titleKey: 'EVT_DELETE_DIALOG_TITLE',
        messageKey: 'EVT_DELETE_DIALOG_MESSAGE',
        hintKey: 'EVT_DELETE_DIALOG_HINT',
        confirmKey: 'EVT_DELETE_DIALOG_CONFIRM',
        preview: {
          title: row.name,
          subtitle: `${row.start_date} → ${row.end_date}`,
        },
      },
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  private err(e: unknown): string {
    const body = (e as { error?: { message?: string } })?.error;
    return typeof body?.message === 'string' && body.message.trim()
      ? body.message
      : this.translate.instant('REQUEST_FAILED');
  }
}
