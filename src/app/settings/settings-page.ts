import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { ChangePassword } from '../dialog/change-password/change-password';
import { AuthService } from '../services/auth.service';
import { TenantSettingsPanel } from './tenant-settings-panel';
import { LanguageToggle } from '../shared/language-toggle/language-toggle';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, TranslateModule, TenantSettingsPanel, LanguageToggle],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.css',
})
export class SettingsPage implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  adminName = '';
  adminEmail = '';
  canManageTenantSettings = false;

  ngOnInit(): void {
    const user = this.auth.getUser();
    this.adminName = user?.name || '';
    this.adminEmail = user?.email || '';
    void this.auth.ensureMe().then((u) => {
      this.canManageTenantSettings = u.can('manage tenant settings');
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
