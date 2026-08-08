import { ChangeDetectorRef, Component, Inject, OnInit, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TenantUser, UsersService } from '../../services/users.service';
import { SnackbarService } from '../../services/snackbar.service';

type DialogMode = 'add' | 'edit';

interface DialogData {
  mode: DialogMode;
  user?: TenantUser;
}

@Component({
  selector: 'app-add-user',
  imports: [FormsModule, CommonModule],
  templateUrl: './add-user.html',
  styleUrl: './add-user.css',
})
export class AddUser implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<AddUser>);
  private readonly usersApi = inject(UsersService);
  private readonly snackbar = inject(SnackbarService);
  private readonly cdr = inject(ChangeDetectorRef);

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

  nationalities = [
    'Saudi',
    'Egyptian',
    'Yemeni',
    'Kuwaiti',
    'Qatari',
    'Emirati',
    'Omani',
    'Bahraini',
    'Jordanian',
    'Syrian',
    'Lebanese',
    'Libyan',
    'Algerian',
    'Sudanese',
  ];

  titles = ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof'];

  constructor(@Inject(MAT_DIALOG_DATA) public data: DialogData) {
    this.mode = data?.mode === 'edit' ? 'edit' : 'add';
  }

  ngOnInit(): void {
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
      this.snackbar.show('Name, email and 10-digit mobile are required', 'error');
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
        this.snackbar.show('User updated', 'success');
      } else {
        await this.usersApi.create({
          name: body.name,
          email: body.email,
          mobile: body.mobile,
          nationality: body.nationality,
          title: body.title,
          password: body.password,
        });
        this.snackbar.show('User saved (created or linked to tenant)', 'success');
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
    return 'Request failed';
  }
}
