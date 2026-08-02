import { ChangeDetectorRef, Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from "@angular/forms";
import { ApiService } from '../../services/api.service';
import { ApiResponse, LoginResponse } from '../../interfaces/api-response';
import { Apiendpointd } from '../../apiEndpoints';
import { SnackbarService } from '../../services/snackbar.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-login',
  imports: [FormsModule, TranslateModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})

export class Login {
  isLoading: boolean = false;
  hasError: boolean = false
  phone: string = ''
  email: string = ''
  password: string = ''

  constructor(private router: Router, private api: ApiService, private snackbar: SnackbarService, private cdr: ChangeDetectorRef, private translate: TranslateService) { }

  async login1() {
    if (this.email === '' || this.password === '') {
      this.hasError = true
      return;
      // return this.snackbar.show("ادخل جميع الحقول ", 'error')
    }
    this.isLoading = true;
    try {
      const params = new FormData();
      params.append('email', this.email);
      params.append('password', this.password);
      const result = await this.api.post<ApiResponse<LoginResponse>>(
        Apiendpointd.login,
        params
      );
      if (result.success) {
        console.log('Done');
        this.snackbar.show('Login successful', 'success');
        this.isLoading = false;
        this.cdr.detectChanges();
        this.router.navigate(['/OtpVerification']);
      } else {
        this.isLoading = false;
        this.cdr.detectChanges();
        console.log(result.message);
      }
    } catch (error: any) {
      this.isLoading = false;
      this.cdr.detectChanges();
      this.snackbar.show(error.error.message, 'error');
      console.log(error);
    }
  }

  async login() {
    this.hasError = false;
    if (!this.email || !this.password) {
      this.hasError = true;
      return;
    }
    if (this.password.length < 4) {
      return;
    }
    this.isLoading = true;
    try {
      const params = new FormData();
      params.append('email', this.email);
      params.append('password', this.password);
      const result = await this.api.post<ApiResponse<LoginResponse>>(
        Apiendpointd.login,
        params
      );

      if (result.success) {
        console.log(result)
        this.snackbar.show('Login successful', 'success');
        this.router.navigate(
          ['/OtpVerification'],
          {
            state: {
              email: this.email,
              password: this.password
            }
          }
        );
      }
    } catch (error: any) {
      this.snackbar.show(error.error.message, 'error');
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges()
    }
  }
  // admin@example.com   password1231

  goToOtp() {
    if (this.phone == '') {
      this.hasError = true
      return
    }
    this.isLoading = true;
    setTimeout(() => {
      this.router.navigate(['/OtpVerification']);
    }, 800);
    console.log(this.isLoading)
  }
}
