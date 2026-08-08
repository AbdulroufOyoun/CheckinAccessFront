import { ChangeDetectorRef, Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AdminsService, TenantAdmin } from '../../services/admins.service';
import { SpatieRole } from '../../services/roles.service';
import { SnackbarService } from '../../services/snackbar.service';

export interface AddAdminDialogData {
  mode: 'add' | 'edit';
  admin?: TenantAdmin;
  roles: SpatieRole[];
}

@Component({
  selector: 'app-add-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './add-admin.html',
  styleUrl: './add-admin.css',
})
export class AddAdmin implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<AddAdmin>);
  private readonly adminsApi = inject(AdminsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  saving = false;
  isRTL = false;
  mode: 'add' | 'edit' = 'add';
  roles: SpatieRole[] = [];
  editingId: number | null = null;
  selectedRoles: string[] = [];

  form = {
    name: '',
    email: '',
    mobile: '',
    password: '',
  };

  constructor(@Inject(MAT_DIALOG_DATA) public data: AddAdminDialogData) {
    this.mode = data?.mode || 'add';
    this.roles = (data?.roles || []).filter((r) => r.name !== 'Super Admin');
  }

  toggleRole(name: string): void {
    if (name === 'Super Admin') return;
    if (this.selectedRoles.includes(name)) {
      this.selectedRoles = this.selectedRoles.filter((r) => r !== name);
    } else {
      this.selectedRoles = [...this.selectedRoles, name];
    }
  }

  ngOnInit(): void {
    this.isRTL = this.document.documentElement.getAttribute('dir') === 'rtl'
      || this.translate.getCurrentLang() === 'ar';

    if (this.mode === 'edit' && this.data.admin) {
      const a = this.data.admin;
      this.editingId = a.id;
      this.form = {
        name: a.name || '',
        email: a.email || '',
        mobile: a.mobile || '',
        password: '',
      };
      this.selectedRoles = (a.roles || [])
        .map((r) => r.name)
        .filter((name) => name !== 'Super Admin');
    }
  }

  get previewName(): string {
    return this.form.name.trim() || this.translate.instant('ADM_UNTITLED');
  }

  get previewMeta(): string {
    const roles = this.selectedRoles.length
      ? this.selectedRoles.join(', ')
      : this.translate.instant('ADM_NO_ROLES');
    return `${this.form.email || this.form.mobile || '—'} · ${roles}`;
  }

  get canSave(): boolean {
    if (!this.form.name.trim() || !this.form.mobile.trim()) return false;
    if (this.mode === 'add' && this.form.password.trim().length < 6) return false;
    if (this.mode === 'edit' && this.form.password && this.form.password.trim().length < 6) return false;
    return true;
  }

  hasRole(name: string): boolean {
    return this.selectedRoles.includes(name);
  }

  close(saved = false): void {
    this.dialogRef.close(saved);
  }

  async save(): Promise<void> {
    if (!this.canSave) {
      this.snackbar.show(this.translate.instant('ADM_REQUIRED'), 'error');
      return;
    }

    this.saving = true;
    try {
      if (this.mode === 'edit' && this.editingId) {
        const body: Parameters<AdminsService['update']>[0] = {
          id: this.editingId,
          name: this.form.name.trim(),
          mobile: this.form.mobile.trim(),
          email: this.form.email.trim() || null,
          roles: this.selectedRoles,
        };
        if (this.form.password.trim()) {
          body.password = this.form.password.trim();
        }
        await this.adminsApi.update(body);
        this.snackbar.show(this.translate.instant('ADM_UPDATED'), 'success');
      } else {
        await this.adminsApi.create({
          name: this.form.name.trim(),
          mobile: this.form.mobile.trim(),
          email: this.form.email.trim() || null,
          password: this.form.password.trim(),
          roles: this.selectedRoles,
        });
        this.snackbar.show(this.translate.instant('ADM_CREATED'), 'success');
      }
      this.close(true);
    } catch (e: unknown) {
      const m = (e as { error?: { message?: string } })?.error?.message;
      this.snackbar.show(
        typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED'),
        'error',
      );
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }
}
