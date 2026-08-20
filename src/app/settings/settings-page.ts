import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ChangePassword } from '../dialog/change-password/change-password';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.css',
})
export class SettingsPage implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);
  private readonly cdr = inject(ChangeDetectorRef);

  currentLang: 'ar' | 'en' = 'en';
  adminName = '';
  adminEmail = '';

  ngOnInit(): void {
    this.currentLang = (localStorage.getItem('lang') as 'ar' | 'en') || 'en';
    const user = this.auth.getUser();
    this.adminName = user?.name || '';
    this.adminEmail = user?.email || '';
  }

  toggleLang(): void {
    this.currentLang = this.currentLang === 'en' ? 'ar' : 'en';
    localStorage.setItem('lang', this.currentLang);
    this.translate.use(this.currentLang).subscribe(() => {
      const html = this.document.documentElement;
      if (this.currentLang === 'ar') {
        html.setAttribute('dir', 'rtl');
        html.setAttribute('lang', 'ar');
      } else {
        html.setAttribute('dir', 'ltr');
        html.setAttribute('lang', 'en');
      }
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
