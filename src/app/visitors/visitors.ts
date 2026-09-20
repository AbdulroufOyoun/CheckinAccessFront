import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AddVisitor } from '../dialog/add-visitor/add-visitor';
import { TenantUser } from '../services/users.service';
import { VisitorsService } from '../services/visitors.service';
import { SnackbarService } from '../services/snackbar.service';
import { PageSkeleton } from '../shared/page-skeleton/page-skeleton';

interface VisitorCard extends TenantUser {
  initials: string;
  color: string;
  shadow: string;
  delay: string;
  isActive: boolean;
}

const AVATAR_PALETTE = [
  { color: '#9333EA', shadow: 'rgba(147,51,234,0.25)' },
  { color: '#2563EB', shadow: 'rgba(37,99,235,0.25)' },
  { color: '#0D9488', shadow: 'rgba(13,148,136,0.25)' },
  { color: '#DB2777', shadow: 'rgba(219,39,119,0.25)' },
  { color: '#D97706', shadow: 'rgba(217,119,6,0.25)' },
];

@Component({
  selector: 'app-visitors',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PageSkeleton, RouterLink],
  templateUrl: './visitors.html',
  styleUrl: '../users/users.css',
})
export class Visitors {
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly visitorsApi = inject(VisitorsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  isRTL = false;
  loading = false;
  searchQuery = '';
  total = 0;
  visitors: VisitorCard[] = [];
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
      if (q === this.searchQuery && this.visitors.length) return;
      this.searchQuery = q;
      void this.loadVisitors();
    });
  }

  async loadVisitors(): Promise<void> {
    this.loading = true;
    try {
      const q = this.searchQuery.trim();
      const page = q
        ? await this.visitorsApi.searchByName(q, 100)
        : await this.visitorsApi.list(100);
      const rows = Array.isArray(page.data) ? page.data : [];
      this.total = page.total ?? rows.length;
      this.visitors = rows.map((u, i) => this.toCard(u, i));
    } catch (error: unknown) {
      this.visitors = [];
      this.total = 0;
      this.snackbar.show(this.errorText(error), 'error');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  onSearchChange(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.loadVisitors(), 300);
  }

  clearSearch(): void {
    this.searchQuery = '';
    void this.loadVisitors();
  }

  openAddDialog(): void {
    const ref = this.dialog.open(AddVisitor, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '560px',
      maxWidth: '94vw',
      data: { mode: 'add' },
    });
    ref.afterClosed().subscribe((changed) => {
      if (changed) void this.loadVisitors();
    });
  }

  openEditDialog(visitor: VisitorCard): void {
    const ref = this.dialog.open(AddVisitor, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '560px',
      maxWidth: '94vw',
      data: { mode: 'edit', visitor },
    });
    ref.afterClosed().subscribe((changed) => {
      if (changed) void this.loadVisitors();
    });
  }

  async removeVisitor(visitor: VisitorCard): Promise<void> {
    const ok = confirm(this.translate.instant('VIS_REMOVE_CONFIRM', { name: visitor.name }));
    if (!ok) return;
    try {
      await this.visitorsApi.remove(visitor.id);
      this.snackbar.show(this.translate.instant('VIS_REMOVED'), 'success');
      await this.loadVisitors();
    } catch (error: unknown) {
      this.snackbar.show(this.errorText(error), 'error');
    }
  }

  private toCard(u: TenantUser, index: number): VisitorCard {
    const palette = AVATAR_PALETTE[(u.id || index) % AVATAR_PALETTE.length];
    return {
      ...u,
      initials: this.initials(u.name),
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
    return this.translate.instant('REQUEST_FAILED');
  }
}
