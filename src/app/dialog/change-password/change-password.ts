import { ChangeDetectorRef, Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AdminsService, TenantAdmin } from '../../services/admins.service';
import { SnackbarService } from '../../services/snackbar.service';

export interface ChangePasswordDialogData {
  mode: 'self' | 'reset';
  admin?: TenantAdmin;
}

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './change-password.html',
  styleUrls: ['../add-subject/add-subject.css', './change-password.css'],
})
export class ChangePassword implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<ChangePassword>);
  private readonly adminsApi = inject(AdminsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  saving = false;
  isRTL = false;
  mode: 'self' | 'reset' = 'self';
  adminName = '';

  showOld = false;
  showNew = false;
  showConfirm = false;

  form = {
    old_password: '',
    password: '',
    password_confirmation: '',
  };

  constructor(@Inject(MAT_DIALOG_DATA) public data: ChangePasswordDialogData) {
    this.mode = data?.mode || 'self';
    this.adminName = data?.admin?.name || '';
  }

  ngOnInit(): void {
    this.isRTL = this.document.documentElement.getAttribute('dir') === 'rtl'
      || this.translate.getCurrentLang() === 'ar';
    // Ensure fields start empty (avoid browser autofill leftovers).
    this.form = {
      old_password: '',
      password: '',
      password_confirmation: '',
    };
    this.showOld = false;
    this.showNew = false;
    this.showConfirm = false;
  }

  get canSave(): boolean {
    if (this.form.password.trim().length < 6) return false;
    if (this.form.password !== this.form.password_confirmation) return false;
    if (this.mode === 'self' && !this.form.old_password.trim()) return false;
    return true;
  }

  close(saved = false): void {
    this.dialogRef.close(saved);
  }

  async save(): Promise<void> {
    if (this.saving) return;
    if (!this.canSave) {
      if (this.form.password !== this.form.password_confirmation) {
        this.snackbar.show(this.translate.instant('PWD_MISMATCH'), 'error');
      } else {
        this.snackbar.show(this.translate.instant('PWD_REQUIRED'), 'error');
      }
      return;
    }

    this.saving = true;
    try {
      if (this.mode === 'self') {
        await this.adminsApi.changeOwnPassword({
          old_password: this.form.old_password.trim(),
          password: this.form.password.trim(),
          password_confirmation: this.form.password_confirmation.trim(),
        });
      } else if (this.data.admin) {
        await this.adminsApi.resetPassword({
          id: this.data.admin.id,
          password: this.form.password.trim(),
          password_confirmation: this.form.password_confirmation.trim(),
        });
      }
      this.snackbar.show(this.translate.instant('PWD_UPDATED'), 'success');
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
