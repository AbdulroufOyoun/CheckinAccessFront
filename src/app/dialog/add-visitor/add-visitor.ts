import { ChangeDetectorRef, Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TenantUser } from '../../services/users.service';
import { VisitorsService } from '../../services/visitors.service';
import { SnackbarService } from '../../services/snackbar.service';

type DialogMode = 'add' | 'edit';

interface DialogData {
  mode: DialogMode;
  visitor?: TenantUser;
}

@Component({
  selector: 'app-add-visitor',
  imports: [FormsModule, CommonModule, TranslateModule],
  templateUrl: './add-visitor.html',
  styleUrl: '../add-user/add-user.css',
})
export class AddVisitor implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<AddVisitor>);
  private readonly visitorsApi = inject(VisitorsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  isRTL = false;
  saving = false;
  mode: DialogMode = 'add';
  visitorId: number | null = null;

  form = {
    name: '',
    email: '',
    mobile: '',
    nationality: '',
    title: '' as string,
    password: '',
    active: true,
  };

  constructor(@Inject(MAT_DIALOG_DATA) public data: DialogData) {
    this.mode = data?.mode === 'edit' ? 'edit' : 'add';
  }

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    if (this.mode === 'edit' && this.data?.visitor) {
      this.visitorId = this.data.visitor.id;
      this.form = {
        name: this.data.visitor.name || '',
        email: this.data.visitor.email || '',
        mobile: this.data.visitor.mobile || '',
        nationality: this.data.visitor.nationality || '',
        title: this.data.visitor.title || '',
        password: '',
        active: this.data.visitor.active === true || this.data.visitor.active === 1,
      };
    }
  }

  close(changed = false): void {
    this.dialogRef.close(changed);
  }

  normalizeMobile(): void {
    const digits = (this.form.mobile || '').replace(/\D/g, '');
    this.form.mobile = digits.slice(-10);
  }

  async save(): Promise<void> {
    this.normalizeMobile();
    if (!this.form.name.trim() || !this.form.email.trim() || this.form.mobile.length !== 10) {
      this.snackbar.show(this.translate.instant('VIS_DIALOG_REQUIRED'), 'error');
      return;
    }

    this.saving = true;
    try {
      if (this.mode === 'edit' && this.visitorId) {
        await this.visitorsApi.update(this.visitorId, {
          name: this.form.name.trim(),
          email: this.form.email.trim(),
          mobile: this.form.mobile,
          nationality: this.form.nationality || null,
          title: this.form.title || null,
          active: this.form.active,
        });
        this.snackbar.show(this.translate.instant('VIS_DIALOG_UPDATED'), 'success');
      } else {
        await this.visitorsApi.create({
          name: this.form.name.trim(),
          email: this.form.email.trim(),
          mobile: this.form.mobile,
          nationality: this.form.nationality || null,
          title: this.form.title || null,
          password: this.form.password || null,
        });
        this.snackbar.show(this.translate.instant('VIS_DIALOG_SAVED'), 'success');
      }
      this.close(true);
    } catch (error: unknown) {
      const body = (error as { error?: { message?: unknown } })?.error;
      const message = body?.message;
      this.snackbar.show(typeof message === 'string' ? message : this.translate.instant('REQUEST_FAILED'), 'error');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }
}
