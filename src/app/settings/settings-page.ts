import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { ChangePassword } from '../dialog/change-password/change-password';
import { AuthService } from '../services/auth.service';
import { LocaleService } from '../services/locale.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.css',
})
export class SettingsPage implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LocaleService);
  private readonly cdr = inject(ChangeDetectorRef);

  currentLang: 'ar' | 'en' = 'en';
  adminName = '';
  adminEmail = '';

  ngOnInit(): void {
    this.currentLang = this.locale.lang();
    const user = this.auth.getUser();
    this.adminName = user?.name || '';
    this.adminEmail = user?.email || '';
  }

  toggleLang(): void {
    void this.locale.toggle().then(() => {
      this.currentLang = this.locale.lang();
      this.cdr.detectChanges();
    });
  }

  openChangePassword(): void {
    this.dialog.open(ChangePassword, {
      panelClass: ['custom-dialog', 'subject-dialog'],
      backdropClass: 'custom-backdrop',
      width: '480px',
      maxWidth: '94vw',
      maxHeight: '90vh',
      autoFocus: false,
      data: { mode: 'self' },
    });
  }
}
