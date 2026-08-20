import { ChangeDetectorRef, Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TenantUser, UsersService } from '../../services/users.service';
import { SnackbarService } from '../../services/snackbar.service';

type DialogMode = 'add' | 'edit';

interface DialogData {
  mode: DialogMode;
  user?: TenantUser;
}

interface SelectOption {
  value: string;
  key: string;
}

@Component({
  selector: 'app-add-user',
  imports: [FormsModule, CommonModule, TranslateModule],
  templateUrl: './add-user.html',
  styleUrl: './add-user.css',
})
export class AddUser implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<AddUser>);
  private readonly usersApi = inject(UsersService);
  private readonly snackbar = inject(SnackbarService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  isRTL = false;
  saving = false;
  mode: DialogMode = 'add';
  userId: number | null = null;

  form = {
    name: '',
    email: '',
    mobile: '',
    nationality: '',
    title: '' as string,
    password: '',
    active: true,
  };

  readonly nationalities: SelectOption[] = [
    { value: 'Saudi', key: 'USR_NAT_SAUDI' },
    { value: 'Egyptian', key: 'USR_NAT_EGYPTIAN' },
    { value: 'Yemeni', key: 'USR_NAT_YEMENI' },
    { value: 'Kuwaiti', key: 'USR_NAT_KUWAITI' },
    { value: 'Qatari', key: 'USR_NAT_QATARI' },
    { value: 'Emirati', key: 'USR_NAT_EMIRATI' },
    { value: 'Omani', key: 'USR_NAT_OMANI' },
    { value: 'Bahraini', key: 'USR_NAT_BAHRAINI' },
    { value: 'Jordanian', key: 'USR_NAT_JORDANIAN' },
    { value: 'Syrian', key: 'USR_NAT_SYRIAN' },
    { value: 'Lebanese', key: 'USR_NAT_LEBANESE' },
    { value: 'Libyan', key: 'USR_NAT_LIBYAN' },
    { value: 'Algerian', key: 'USR_NAT_ALGERIAN' },
    { value: 'Sudanese', key: 'USR_NAT_SUDANESE' },
  ];

  readonly titles: SelectOption[] = [
    { value: 'Mr', key: 'USR_HON_MR' },
    { value: 'Mrs', key: 'USR_HON_MRS' },
    { value: 'Ms', key: 'USR_HON_MS' },
    { value: 'Miss', key: 'USR_HON_MISS' },
    { value: 'Dr', key: 'USR_HON_DR' },
    { value: 'Prof', key: 'USR_HON_PROF' },
  ];

  constructor(@Inject(MAT_DIALOG_DATA) public data: DialogData) {
    this.mode = data?.mode === 'edit' ? 'edit' : 'add';
  }

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    this.translate.onLangChange.subscribe((e) => {
      this.isRTL = e.lang === 'ar';
      this.cdr.detectChanges();
    });

    if (this.mode === 'edit' && this.data?.user) {
      this.userId = this.data.user.id;
      this.patchForm(this.data.user);
    }
  }

  private patchForm(u: TenantUser): void {
    this.form = {
      name: u.name || '',
      email: u.email || '',
      mobile: u.mobile || '',
      nationality: u.nationality || '',
      title: u.title || '',
      password: '',
      active: u.active === true || u.active === 1 || u.active === undefined,
    };
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
      this.snackbar.show(this.translate.instant('USR_DIALOG_REQUIRED'), 'error');
      return;
    }

    this.saving = true;
    const body = {
      name: this.form.name.trim(),
      email: this.form.email.trim(),
      mobile: this.form.mobile,
      nationality: this.form.nationality || null,
      title: this.form.title || null,
      password: this.form.password || null,
      active: this.form.active,
    };

    try {
      if (this.mode === 'edit' && this.userId) {
        await this.usersApi.update(this.userId, {
          name: body.name,
          email: body.email,
          mobile: body.mobile,
          nationality: body.nationality,
          title: body.title,
          active: body.active,
        });
        this.snackbar.show(this.translate.instant('USR_DIALOG_UPDATED'), 'success');
      } else {
        await this.usersApi.create({
          name: body.name,
          email: body.email,
          mobile: body.mobile,
          nationality: body.nationality,
          title: body.title,
          password: body.password,
        });
        this.snackbar.show(this.translate.instant('USR_DIALOG_SAVED'), 'success');
      }
      this.close(true);
    } catch (error: unknown) {
      this.snackbar.show(this.errorText(error), 'error');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
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
