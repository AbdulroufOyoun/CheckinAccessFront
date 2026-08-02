import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../services/api.service';
import { Apiendpointd } from '../../apiEndpoints';
import { User } from '../../model/User';
import { AuthService } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';


@Component({
  selector: 'app-otp-verification',
  imports: [FormsModule, TranslateModule],
  templateUrl: './otp-verification.html',
  styleUrl: './otp-verification.css',

})

export class OtpVerification {
  otp: string[] = ['', '', '', '', '', ''];
  isLoading: boolean = false;
  isSuccess: boolean = false;
  hasError: boolean = false;
  errorMessage: string = ''
  email: string = '';
  password: string = '';

  constructor(private router: Router, private cdr: ChangeDetectorRef, private translate: TranslateService, private api: ApiService, public authService: AuthService, private snackbar: SnackbarService,) { }

  ngOnInit(): void {
    const state = history.state;
    this.email = state.email ?? '';
    this.password = state.password ?? '';
    console.log("Email = " + this.email);
  }

  verifyOtp1() {
    this.hasError = false;
    this.isSuccess = false;
    this.isLoading = true;
    const code = this.otp.join('');
    if (code.length < 6 || this.otp.includes('')) {
      this.hasError = true;
      this.isLoading = false;
      this.hasError = true;
      this.errorMessage = this.translate.instant('ENTER_FULL_CODE');
      return;
    }
    setTimeout(() => {
      if (code === '123456') {
        console.log('Done');
        this.isLoading = false;
        this.isSuccess = true;
        this.cdr.detectChanges();
        setTimeout(() => {
          this.router.navigate(['/Dashboard']);
        }, 1200);
      } else {
        this.isLoading = false;
        this.hasError = true;
        this.errorMessage = this.translate.instant('INCORRECT_COOD');
        this.cdr.detectChanges();
      }
    }, 1200);
  }

  async verifyOtp() {
    this.hasError = false;
    this.isSuccess = false;
    const code = this.otp.join('');
    if (code.length < 6) {
      this.hasError = true;
      this.errorMessage = this.translate.instant('ENTER_FULL_CODE');
      return;
    }
    this.isLoading = true;
    try {
      const params = new FormData();
      params.append('email', this.email);
      params.append('password', this.password);
      params.append('verification_code', code);
      const result = await this.api.post<any>(
        Apiendpointd.verify, params
      );
      console.log(result  )
      if (result.success) {
        const user = new User(result.data.user);
        this.authService.saveUser(result.data.token, user);
        this.isSuccess = true;
        this.snackbar.show(result.message, 'success');
        console.log(this.authService.getToken());
        console.log(this.authService.getUser());
        this.router.navigate(['/Dashboard']);
      } else {
        console.log('Maybe Error')
      }
    } catch (error: any) {
      this.hasError = true;
      this.errorMessage = error.error?.message || 'Verification failed';
      this.snackbar.show(this.errorMessage, 'error');
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  onInput(event: any, index: number, nextInput: any) {
    this.hasError = false;
    const value = event.target.value;
    this.otp[index] = value;
    if (value && nextInput) {
      nextInput.focus();
    }
  }

  onBackspace(event: KeyboardEvent, index: number, prev: any) {
    if (event.key === 'Backspace' && !this.otp[index] && prev) {
      prev.focus();
    }
  }

}
