import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AddUser } from '../dialog/add-user/add-user';
import { TenantUser, UsersService } from '../services/users.service';
import { SnackbarService } from '../services/snackbar.service';
import { PageSkeleton } from '../shared/page-skeleton/page-skeleton';

interface UserCard extends TenantUser {
  initials: string;
  color: string;
  shadow: string;
  delay: string;
  phone: string;
  isActive: boolean;
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
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PageSkeleton],
  templateUrl: './users.html',
  styleUrl: './users.css',
})
export class Users implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly usersApi = inject(UsersService);
  private readonly snackbar = inject(SnackbarService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  isRTL = false;
  loading = false;
  searchQuery = '';
  total = 0;
  users: UserCard[] = [];
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    this.translate.onLangChange.subscribe((e) => {
      this.isRTL = e.lang === 'ar';
      this.cdr.detectChanges();
    });
    this.searchQuery = this.route.snapshot.queryParamMap.get('q') ?? '';
    this.route.queryParamMap.subscribe((params) => {
      const q = params.get('q') ?? '';
      if (q === this.searchQuery && this.users.length) return;
      this.searchQuery = q;
      void this.loadUsers();
    });
  }

  async loadUsers(): Promise<void> {
    this.loading = true;
    try {
      const q = this.searchQuery.trim();
      const page = q
        ? await this.usersApi.searchByName(q, 100)
        : await this.usersApi.list(100);
      const rows = Array.isArray(page.data) ? page.data : [];
      this.total = page.total ?? rows.length;
      this.users = rows.map((u, i) => this.toCard(u, i));
    } catch (error: unknown) {
      this.users = [];
      this.total = 0;
      this.snackbar.show(this.errorText(error), 'error');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  onSearchChange(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.loadUsers(), 300);
  }

  clearSearch(): void {
    this.searchQuery = '';
    void this.loadUsers();
  }

  openAddDialog(): void {
    const ref = this.dialog.open(AddUser, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '560px',
      maxWidth: '94vw',
      data: { mode: 'add' },
    });
    ref.afterClosed().subscribe((changed) => {
      if (changed) void this.loadUsers();
    });
  }

  openEditDialog(user: UserCard): void {
    const ref = this.dialog.open(AddUser, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '560px',
      maxWidth: '94vw',
      data: { mode: 'edit', user },
    });
    ref.afterClosed().subscribe((changed) => {
      if (changed) void this.loadUsers();
    });
  }

  openView(user: UserCard): void {
    void this.router.navigate(['/Users', user.id]);
  }

  async removeUser(user: UserCard): Promise<void> {
    const ok = confirm(this.translate.instant('USR_REMOVE_CONFIRM', { name: user.name }));
    if (!ok) return;
    try {
      await this.usersApi.remove(user.id);
      this.snackbar.show(this.translate.instant('USR_REMOVED'), 'success');
      await this.loadUsers();
    } catch (error: unknown) {
      this.snackbar.show(this.errorText(error), 'error');
    }
  }

  private toCard(u: TenantUser, index: number): UserCard {
    const palette = AVATAR_PALETTE[(u.id || index) % AVATAR_PALETTE.length];
    return {
      ...u,
      initials: this.initials(u.name),
      phone: u.mobile,
      isActive: u.active === true || u.active === 1,
      color: palette.color,
      shadow: palette.shadow,
      delay: `${index * 0.04}s`,
    };
  }

  private initials(name: string): string {
    const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  private errorText(error: unknown): string {
    const body = (error as { error?: { message?: unknown } })?.error;
    const message = body?.message;
    if (typeof message === 'string' && message.trim()) return message;
    if (message && typeof message === 'object') {
      const parts = Object.values(message as Record<string, unknown>)
        .flatMap((v) => (Array.isArray(v) ? v : [v]))
        .map((v) => String(v ?? '').trim())
        .filter(Boolean);
      if (parts.length) return parts.join(' ');
    }
    return this.translate.instant('REQUEST_FAILED');
  }
}
