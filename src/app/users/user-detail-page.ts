import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { PageSkeleton } from '../shared/page-skeleton/page-skeleton';
import { SnackbarService } from '../services/snackbar.service';
import { AuthService } from '../services/auth.service';
import { TenantUser, UsersService } from '../services/users.service';
import { AddUser } from '../dialog/add-user/add-user';

interface BookingRow {
  id: number;
  status: string;
  statusKey: string;
  checkIn: string;
  checkOut: string;
  room: string;
}

const AVATAR_PALETTE = [
  { color: '#2563EB', shadow: 'rgba(37,99,235,0.25)' },
  { color: '#0D9488', shadow: 'rgba(13,148,136,0.25)' },
  { color: '#7C3AED', shadow: 'rgba(124,58,237,0.25)' },
  { color: '#DB2777', shadow: 'rgba(219,39,119,0.25)' },
  { color: '#D97706', shadow: 'rgba(217,119,6,0.25)' },
  { color: '#DC2626', shadow: 'rgba(220,38,38,0.25)' },
];

@Component({
  selector: 'app-user-detail-page',
  standalone: true,
  imports: [CommonModule, TranslateModule, RouterLink, PageSkeleton],
  templateUrl: './user-detail-page.html',
  styleUrl: './user-detail-page.css',
})
export class UserDetailPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly usersApi = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);

  private sub?: Subscription;
  private loadSeq = 0;

  isRTL = false;
  loading = true;
  notFound = false;
  userId = 0;
  user: TenantUser | null = null;
  bookings: BookingRow[] = [];
  bookingsLoading = false;
  canSeeBookings = false;

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    this.translate.onLangChange.subscribe((e) => {
      this.isRTL = e.lang === 'ar';
      this.cdr.detectChanges();
    });

    this.canSeeBookings =
      this.auth.hasModule('property') && this.auth.can('manage bookings');

    this.sub = this.route.paramMap.subscribe((params) => {
      this.userId = Number(params.get('id') || 0);
      void this.load();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get isActive(): boolean {
    return this.user?.active === true || this.user?.active === 1;
  }

  get initials(): string {
    const parts = (this.user?.name || '?').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  get avatarStyle(): { background: string; boxShadow: string } {
    const palette = AVATAR_PALETTE[(this.userId || 0) % AVATAR_PALETTE.length];
    return {
      background: palette.color,
      boxShadow: `0 8px 24px ${palette.shadow}`,
    };
  }

  get createdLabel(): string {
    if (!this.user?.created_at) return '—';
    try {
      return new Date(this.user.created_at).toLocaleDateString(
        this.isRTL ? 'ar' : 'en',
        { year: 'numeric', month: 'short', day: 'numeric' },
      );
    } catch {
      return this.user.created_at;
    }
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      void this.router.navigate(['/Users']);
    }
  }

  openEdit(): void {
    if (!this.user) return;
    const ref = this.dialog.open(AddUser, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '560px',
      maxWidth: '94vw',
      data: { mode: 'edit', user: this.user },
    });
    ref.afterClosed().subscribe((changed) => {
      if (changed) void this.load({ force: true });
    });
  }

  async removeUser(): Promise<void> {
    if (!this.user) return;
    const ok = confirm(
      this.translate.instant('USR_REMOVE_CONFIRM', { name: this.user.name }),
    );
    if (!ok) return;
    try {
      await this.usersApi.remove(this.user.id);
      this.snackbar.show(this.translate.instant('USR_REMOVED'), 'success');
      void this.router.navigate(['/Users']);
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  private async load(options?: { force?: boolean }): Promise<void> {
    if (!this.userId) {
      this.loading = false;
      this.notFound = true;
      this.cdr.detectChanges();
      return;
    }

    const seq = ++this.loadSeq;
    this.loading = true;
    this.notFound = false;
    this.cdr.detectChanges();

    try {
      const res = await this.usersApi.show(this.userId, options);
      if (seq !== this.loadSeq) return;

      this.user = res.data ?? null;
      if (!this.user) {
        this.notFound = true;
        return;
      }

      if (this.canSeeBookings) {
        void this.loadBookings(seq);
      } else {
        this.bookings = [];
      }
    } catch {
      if (seq !== this.loadSeq) return;
      this.user = null;
      this.notFound = true;
      this.snackbar.show(this.translate.instant('USR_DETAIL_NOT_FOUND'), 'error');
    } finally {
      if (seq === this.loadSeq) {
        this.loading = false;
        this.cdr.detectChanges();
      }
    }
  }

  private async loadBookings(seq: number): Promise<void> {
    this.bookingsLoading = true;
    this.cdr.detectChanges();
    try {
      const bookingsRes = await this.usersApi.userBookings(this.userId);
      if (seq !== this.loadSeq) return;

      const payload = bookingsRes.data as { data?: unknown[] } | unknown[];
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray((payload as { data?: unknown[] })?.data)
          ? (payload as { data: unknown[] }).data
          : [];

      this.bookings = rows.map((raw) => {
        const b = raw as {
          id: number;
          cancelled?: boolean;
          on_hold?: boolean;
          booking_periods?: Array<{ check_in_date?: string; check_out_date?: string }>;
          booking_period_units?: Array<{
            room_id?: number;
            room?: { number?: string; name?: string };
          }>;
        };
        const period = b.booking_periods?.[0];
        const unit = b.booking_period_units?.[0];
        let status = 'active';
        let statusKey = 'USR_BOOKING_ACTIVE';
        if (b.cancelled) {
          status = 'cancelled';
          statusKey = 'USR_BOOKING_CANCELLED';
        } else if (b.on_hold) {
          status = 'on_hold';
          statusKey = 'USR_BOOKING_HOLD';
        }
        return {
          id: b.id,
          status,
          statusKey,
          checkIn: period?.check_in_date || '—',
          checkOut: period?.check_out_date || '—',
          room:
            unit?.room?.number ||
            unit?.room?.name ||
            (unit?.room_id ? String(unit.room_id) : '—'),
        };
      });
    } catch {
      if (seq !== this.loadSeq) return;
      this.bookings = [];
    } finally {
      if (seq === this.loadSeq) {
        this.bookingsLoading = false;
        this.cdr.detectChanges();
      }
    }
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string } })?.error?.message;
    return typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED');
  }
}
