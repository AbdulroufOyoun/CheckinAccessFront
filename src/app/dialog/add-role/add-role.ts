import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { RolesService, SpatieRole } from '../../services/roles.service';
import { SnackbarService } from '../../services/snackbar.service';

@Component({
  selector: 'app-add-role',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './add-role.html',
  styleUrl: './add-role.css',
})
export class AddRole implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<AddRole, SpatieRole | undefined>);
  private readonly rolesApi = inject(RolesService);
  private readonly snackbar = inject(SnackbarService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  @ViewChild('roleNameInput') private roleNameInput?: ElementRef<HTMLInputElement>;

  saving = false;
  isRTL = false;
  name = '';

  ngOnInit(): void {
    this.isRTL = this.document.documentElement.getAttribute('dir') === 'rtl'
      || this.translate.getCurrentLang() === 'ar';
    setTimeout(() => this.roleNameInput?.nativeElement.focus(), 0);
  }

  get previewName(): string {
    const name = this.name.trim();
    return name || this.translate.instant('ROLE_NAME_PLACEHOLDER');
  }

  get previewMark(): string {
    const name = this.name.trim();
    if (!name) return 'R';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  get canSave(): boolean {
    return this.name.trim().length > 0;
  }

  close(): void {
    if (this.saving) return;
    this.dialogRef.close();
  }

  async save(): Promise<void> {
    if (this.saving) return;
    const name = this.name.trim();
    if (!name) {
      this.snackbar.show(this.translate.instant('ROLE_NAME_REQUIRED'), 'error');
      this.roleNameInput?.nativeElement.focus();
      return;
    }
    if (name.toLowerCase() === 'super admin') {
      this.snackbar.show(this.translate.instant('ROLE_SUPER_RESERVED'), 'error');
      this.roleNameInput?.nativeElement.focus();
      return;
    }

    this.saving = true;
    this.dialogRef.disableClose = true;
    try {
      const res = await this.rolesApi.createRole({ name });
      this.snackbar.show(this.translate.instant('ROLE_CREATED'), 'success');
      this.dialogRef.close(res.data);
    } catch (e: unknown) {
      const m = (e as { error?: { message?: string } })?.error?.message;
      this.snackbar.show(
        typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED'),
        'error',
      );
      this.roleNameInput?.nativeElement.focus();
    } finally {
      this.saving = false;
      this.dialogRef.disableClose = false;
      this.cdr.detectChanges();
    }
  }
}
