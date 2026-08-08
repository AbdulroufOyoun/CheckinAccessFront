import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AddRole } from '../dialog/add-role/add-role';
import { RolesService, SpatiePermission, SpatieRole } from '../services/roles.service';
import { SnackbarService } from '../services/snackbar.service';
import { PageSkeleton } from '../shared/page-skeleton/page-skeleton';

interface PermissionGroup {
  key: string;
  labelKey: string;
  permissions: SpatiePermission[];
}

@Component({
  selector: 'app-roles-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PageSkeleton],
  templateUrl: './roles-page.html',
  styleUrl: './roles-page.css',
})
export class RolesPage implements OnInit {
  private readonly rolesApi = inject(RolesService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  roles: SpatieRole[] = [];
  permissions: SpatiePermission[] = [];
  loading = false;
  saving = false;
  isRTL = false;
  selectedRoleId: number | null = null;
  draftPermissions = new Set<string>();
  dirty = false;
  roleSearch = '';
  permSearch = '';

  renaming = false;
  renameValue = '';

  ngOnInit(): void {
    this.isRTL = this.document.documentElement.getAttribute('dir') === 'rtl'
      || this.translate.getCurrentLang() === 'ar';
    this.translate.onLangChange.subscribe((e) => {
      this.isRTL = e.lang === 'ar';
      this.cdr.detectChanges();
    });
    void this.load();
  }

  get filteredRoles(): SpatieRole[] {
    const q = this.roleSearch.trim().toLowerCase();
    if (!q) return this.roles;
    return this.roles.filter((r) => r.name.toLowerCase().includes(q));
  }

  get selectedRole(): SpatieRole | undefined {
    return this.roles.find((r) => r.id === this.selectedRoleId);
  }

  get isSuperAdmin(): boolean {
    return this.selectedRole?.name === 'Super Admin';
  }

  get permissionGroups(): PermissionGroup[] {
    const q = this.permSearch.trim().toLowerCase();
    const list = q
      ? this.permissions.filter((p) => p.name.toLowerCase().includes(q))
      : this.permissions;

    const buckets = new Map<string, SpatiePermission[]>();
    for (const p of list) {
      const key = this.groupKey(p.name);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(p);
    }

    const order = ['admin', 'users', 'education', 'property', 'reports', 'other'];
    return order
      .filter((k) => buckets.has(k))
      .map((key) => ({
        key,
        labelKey: 'ROLE_GROUP_' + key.toUpperCase(),
        permissions: buckets.get(key)!,
      }));
  }

  get selectedCount(): number {
    return this.draftPermissions.size;
  }

  private groupKey(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('admin') || n.includes('role')) return 'admin';
    if (n.includes('user')) return 'users';
    if (n.includes('education') || n.includes('enroll')) return 'education';
    if (
      n.includes('building') ||
      n.includes('room') ||
      n.includes('booking') ||
      n.includes('lock') ||
      n.includes('compound')
    ) {
      return 'property';
    }
    if (n.includes('report')) return 'reports';
    return 'other';
  }

  async load(): Promise<void> {
    const hasCache = !!this.rolesApi.peekRolesPage();
    if (!hasCache) {
      this.loading = true;
    }
    try {
      const bundle = await this.rolesApi.getRolesPage({ allowStale: true });
      this.roles = bundle.roles || [];
      this.permissions = bundle.permissions || [];
      if (!this.selectedRoleId && this.roles.length) {
        this.selectRole(this.roles[0]);
      } else if (this.selectedRoleId) {
        const still = this.roles.find((r) => r.id === this.selectedRoleId);
        if (still) this.selectRole(still);
        else if (this.roles[0]) this.selectRole(this.roles[0]);
      }
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  selectRole(role: SpatieRole): void {
    if (this.dirty && !confirm(this.translate.instant('ROLE_DISCARD_CONFIRM'))) {
      return;
    }
    this.selectedRoleId = role.id;
    this.draftPermissions = new Set((role.permissions || []).map((p) => p.name));
    this.dirty = false;
    this.renaming = false;
    this.renameValue = role.name;
  }

  togglePermission(name: string): void {
    if (this.isSuperAdmin) return;
    if (this.draftPermissions.has(name)) this.draftPermissions.delete(name);
    else this.draftPermissions.add(name);
    this.dirty = true;
  }

  hasPermission(name: string): boolean {
    return this.draftPermissions.has(name);
  }

  selectAllInGroup(group: PermissionGroup): void {
    if (this.isSuperAdmin) return;
    for (const p of group.permissions) this.draftPermissions.add(p.name);
    this.dirty = true;
  }

  clearGroup(group: PermissionGroup): void {
    if (this.isSuperAdmin) return;
    for (const p of group.permissions) this.draftPermissions.delete(p.name);
    this.dirty = true;
  }

  async savePermissions(): Promise<void> {
    const role = this.selectedRole;
    if (!role || this.isSuperAdmin) return;
    this.saving = true;
    try {
      const res = await this.rolesApi.syncPermissions(role.name, [...this.draftPermissions]);
      const updated = res.data;
      this.roles = this.roles.map((r) => (r.id === updated.id ? updated : r));
      this.dirty = false;
      this.snackbar.show(this.translate.instant('ROLE_PERMS_SAVED'), 'success');
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  openCreate(): void {
    const ref = this.dialog.open(AddRole, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '460px',
      maxWidth: '94vw',
      maxHeight: '90vh',
      autoFocus: false,
    });
    ref.afterClosed().subscribe((created?: SpatieRole) => {
      if (!created) return;
      this.roles = [...this.roles, created].sort((a, b) => a.name.localeCompare(b.name));
      this.dirty = false;
      this.selectRole(created);
      this.cdr.detectChanges();
    });
  }

  startRename(): void {
    if (!this.selectedRole || this.isSuperAdmin) return;
    this.renaming = true;
    this.renameValue = this.selectedRole.name;
  }

  async saveRename(): Promise<void> {
    const role = this.selectedRole;
    const name = this.renameValue.trim();
    if (!role || !name) return;
    try {
      const res = await this.rolesApi.updateRole(role.id, { name });
      this.roles = this.roles.map((r) => (r.id === res.data.id ? { ...r, ...res.data } : r));
      this.renaming = false;
      this.snackbar.show(this.translate.instant('ROLE_UPDATED'), 'success');
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  async deleteRole(): Promise<void> {
    const role = this.selectedRole;
    if (!role || this.isSuperAdmin) return;
    const ok = confirm(this.translate.instant('ROLE_DELETE_CONFIRM', { name: role.name }));
    if (!ok) return;
    try {
      await this.rolesApi.deleteRole(role.id);
      this.roles = this.roles.filter((r) => r.id !== role.id);
      this.dirty = false;
      this.selectedRoleId = null;
      if (this.roles[0]) this.selectRole(this.roles[0]);
      this.snackbar.show(this.translate.instant('ROLE_DELETED'), 'success');
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    }
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string } })?.error?.message;
    return typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED');
  }
}
