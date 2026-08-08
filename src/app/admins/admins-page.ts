import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AdminsService, TenantAdmin } from '../services/admins.service';
import { RolesService, SpatieRole } from '../services/roles.service';
import { SnackbarService } from '../services/snackbar.service';
import { AddAdmin } from '../dialog/add-admin/add-admin';
import { ChangePassword } from '../dialog/change-password/change-password';
import { PageSkeleton } from '../shared/page-skeleton/page-skeleton';

@Component({
  selector: 'app-admins-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PageSkeleton],
  templateUrl: './admins-page.html',
  styleUrls: ['../education/education-shared.css', './admins-page.css'],
})
export class AdminsPage implements OnInit {
  private readonly adminsApi = inject(AdminsService);
  private readonly rolesApi = inject(RolesService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  admins: TenantAdmin[] = [];
  filtered: TenantAdmin[] = [];
  roles: SpatieRole[] = [];
  loading = false;
  search = '';
  isRTL = false;

  ngOnInit(): void {
    this.isRTL = this.document.documentElement.getAttribute('dir') === 'rtl'
      || this.translate.getCurrentLang() === 'ar';
    this.translate.onLangChange.subscribe((e) => {
      this.isRTL = e.lang === 'ar';
      this.cdr.detectChanges();
    });
    void this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    try {
      const [admins, roles] = await Promise.all([
        this.adminsApi.list({ excludeSuper: true }),
        this.rolesApi.getRolesPage({ force: true }).catch(() => null),
      ]);
      this.admins = admins.data || [];
      if (!roles) {
        this.roles = [];
        this.snackbar.show(this.translate.instant('ADM_ROLES_LOAD_FAILED'), 'error');
      } else {
        // Super Admin role is system-owned and must not be assignable here.
        this.roles = (roles.roles || []).filter((r) => r.name !== 'Super Admin');
      }
      this.applyFilter();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  applyFilter(): void {
    const q = this.search.trim().toLowerCase();
    this.filtered = !q
      ? [...this.admins]
      : this.admins.filter((a) => {
          const roles = (a.roles || []).map((r) => r.name).join(' ').toLowerCase();
          return (
            (a.name || '').toLowerCase().includes(q) ||
            (a.email || '').toLowerCase().includes(q) ||
            (a.mobile || '').toLowerCase().includes(q) ||
            roles.includes(q)
          );
        });
  }

  isActive(a: TenantAdmin): boolean {
    return a.active !== false && a.active !== 0;
  }

  initials(a: TenantAdmin): string {
    const parts = (a.name || '?').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  async openCreate(): Promise<void> {
    if (!this.roles.length) {
      await this.load();
    }
    if (!this.roles.length) {
      this.snackbar.show(this.translate.instant('ADM_NO_ROLES_AVAILABLE_HINT'), 'error');
      return;
    }
    const ref = this.dialog.open(AddAdmin, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '560px',
      maxWidth: '94vw',
      maxHeight: '90vh',
      autoFocus: false,
      data: { mode: 'add', roles: this.roles },
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) void this.load();
    });
  }

  openEdit(a: TenantAdmin): void {
    const ref = this.dialog.open(AddAdmin, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '560px',
      maxWidth: '94vw',
      maxHeight: '90vh',
      autoFocus: false,
      data: { mode: 'edit', admin: a, roles: this.roles },
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) void this.load();
    });
  }

  openResetPassword(a: TenantAdmin): void {
    this.dialog.open(ChangePassword, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '480px',
      maxWidth: '94vw',
      maxHeight: '90vh',
      autoFocus: false,
      data: { mode: 'reset', admin: a },
    });
  }

  async toggleActive(a: TenantAdmin): Promise<void> {
    try {
      if (this.isActive(a)) {
        await this.adminsApi.deactivate(a.id);
        this.snackbar.show(this.translate.instant('ADM_DEACTIVATED'), 'success');
      } else {
        await this.adminsApi.activate(a.id);
        this.snackbar.show(this.translate.instant('ADM_ACTIVATED'), 'success');
      }
      await this.load();
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string } })?.error?.message;
    return typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED');
  }
}
