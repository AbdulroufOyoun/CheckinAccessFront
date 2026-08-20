import { ChangeDetectorRef, Component, DOCUMENT, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { ApiResponse, LoginResponse } from '../../interfaces/api-response';
import { Apiendpointd } from '../../apiEndpoints';
import { SnackbarService } from '../../services/snackbar.service';
import { AuthService } from '../../services/auth.service';
import { User } from '../../model/User';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-login',
  imports: [FormsModule, TranslateModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  isLoading = false;
  hasError = false;
  pausedTenant = false;
  phone = '';
  email = '';
  password = '';

  constructor(
    private router: Router,
    private api: ApiService,
    private snackbar: SnackbarService,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService,
    private authService: AuthService,
    private title: Title,
  ) {
    this.title.setTitle('Sign in — CheckinAccess');
    if (isPlatformBrowser(this.platformId)) {
      const lang = (localStorage.getItem('lang') as 'ar' | 'en') || 'en';
      this.document.documentElement.lang = lang;
      this.document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      this.translate.use(lang).subscribe(() => this.cdr.detectChanges());
    }
  }

  private stopLoading(): void {
    this.isLoading = false;
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  private errorText(error: unknown): string {
    const body = (error as { error?: { message?: unknown } })?.error;
    const message = body?.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
    if (message && typeof message === 'object') {
      const parts = Object.values(message as Record<string, unknown>)
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .map((value) => String(value ?? '').trim())
        .filter(Boolean);
      if (parts.length) {
        return parts.join(' ');
      }
    }
    return this.translate.instant('LOGIN_FAILED') || 'Login failed';
  }

  async login(): Promise<void> {
    this.hasError = false;
    this.pausedTenant = false;
    if (!this.email || !this.password) {
      this.hasError = true;
      this.stopLoading();
      return;
    }
    if (this.password.length < 4) {
      this.stopLoading();
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    try {
      const loginParams = new FormData();
      loginParams.append('email', this.email);
      loginParams.append('password', this.password);
      const loginResult = await this.api.post<ApiResponse<LoginResponse>>(
        Apiendpointd.login,
        loginParams,
      );

      const otp = loginResult?.data?.sms;
      if (!loginResult?.success || !otp) {
        this.stopLoading();
        this.snackbar.show(
          typeof loginResult?.message === 'string' ? loginResult.message : 'Login failed',
          'error',
        );
        return;
      }

      const verifyParams = new FormData();
      verifyParams.append('email', this.email);
      verifyParams.append('password', this.password);
      verifyParams.append('verification_code', String(otp));
      const verifyResult = await this.api.post<any>(Apiendpointd.verify, verifyParams);

      if (verifyResult?.success && verifyResult?.data?.token) {
        const user = new User(verifyResult.data.user);
        this.authService.saveUser(verifyResult.data.token, user);
        try {
          await this.authService.refreshMe(true);
        } catch {
          // Session still usable; modules refresh can retry later from the shell.
        }
        this.stopLoading();
        this.snackbar.show(verifyResult.message || 'Login successful', 'success');
        await this.router.navigate([this.authService.homeRoute()]);
        return;
      }

      this.stopLoading();
      this.snackbar.show(
        typeof verifyResult?.message === 'string' ? verifyResult.message : 'Login failed',
        'error',
      );
    } catch (error: unknown) {
      try {
        const text = this.errorText(error);
        this.pausedTenant = SnackbarService.isTenantInactive(text);
        this.snackbar.show(text, this.pausedTenant ? 'warning' : 'error');
      } catch {
        // Never leave the button stuck if toast fails.
      }
      this.stopLoading();
    } finally {
      // Guarantee the spinner stops even if a path above returned early incorrectly.
      if (this.isLoading) {
        this.stopLoading();
      }
    }
  }
}
