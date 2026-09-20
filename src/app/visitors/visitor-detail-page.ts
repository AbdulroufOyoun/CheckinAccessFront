import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AddVisitor } from '../dialog/add-visitor/add-visitor';
import { SnackbarService } from '../services/snackbar.service';
import { TenantUser } from '../services/users.service';
import { VisitorEventRow, VisitorsService } from '../services/visitors.service';
import { PageSkeleton } from '../shared/page-skeleton/page-skeleton';

const AVATAR_PALETTE = [
  { color: '#9333EA', shadow: 'rgba(147,51,234,0.25)' },
  { color: '#2563EB', shadow: 'rgba(37,99,235,0.25)' },
  { color: '#0D9488', shadow: 'rgba(13,148,136,0.25)' },
];

@Component({
  selector: 'app-visitor-detail-page',
  standalone: true,
  imports: [CommonModule, TranslateModule, PageSkeleton],
  templateUrl: './visitor-detail-page.html',
  styleUrls: ['../users/user-detail-page.css', './visitor-detail-page.css'],
})
export class VisitorDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly visitorsApi = inject(VisitorsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);
  private readonly dialog = inject(MatDialog);

  isRTL = false;
  loading = true;
  visitorId = 0;
  visitor: TenantUser | null = null;
  assignedEvents: VisitorEventRow[] = [];
  enteredEvents: VisitorEventRow[] = [];
  initials = '?';
  avatarColor = AVATAR_PALETTE[0].color;
  avatarShadow = AVATAR_PALETTE[0].shadow;

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    this.visitorId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.visitorId) {
      this.loading = false;
      return;
    }
    void this.load();
  }

  back(): void {
    this.location.back();
  }

  openEditDialog(): void {
    if (!this.visitor) return;
    const ref = this.dialog.open(AddVisitor, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '560px',
      maxWidth: '94vw',
      data: { mode: 'edit', visitor: this.visitor },
    });
    ref.afterClosed().subscribe((changed) => {
      if (changed) void this.load();
    });
  }

  statusLabel(status?: string | null): string {
    const map: Record<string, string> = {
      draft: 'EVT_STATUS_DRAFT',
      active: 'EVT_STATUS_ACTIVE',
      cancelled: 'EVT_STATUS_CANCELLED',
    };
    return map[status || ''] || 'EVT_STATUS_DRAFT';
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    return value;
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.cdr.detectChanges();
    try {
      const [profile, eventsRes] = await Promise.all([
        this.visitorsApi.show(this.visitorId),
        this.visitorsApi.events(this.visitorId),
      ]);
      this.visitor = profile.data ?? null;
      const events = eventsRes.data;
      this.assignedEvents = events?.assigned_events ?? [];
      this.enteredEvents = events?.entered_events ?? [];
      if (this.visitor) {
        this.initials = this.buildInitials(this.visitor.name);
        const palette = AVATAR_PALETTE[(this.visitor.id || 0) % AVATAR_PALETTE.length];
        this.avatarColor = palette.color;
        this.avatarShadow = palette.shadow;
      }
    } catch (error: unknown) {
      this.snackbar.show(this.errorText(error), 'error');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private buildInitials(name: string): string {
    const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  private errorText(error: unknown): string {
    const body = (error as { error?: { message?: unknown } })?.error;
    const message = body?.message;
    if (typeof message === 'string' && message.trim()) return message;
    return this.translate.instant('REQUEST_FAILED');
  }
}
