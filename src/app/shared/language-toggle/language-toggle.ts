import {
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { AppLang, LocaleService } from '../../services/locale.service';

@Component({
  selector: 'app-language-toggle',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './language-toggle.html',
  styleUrl: './language-toggle.css',
})
export class LanguageToggle implements OnInit, OnDestroy {
  private readonly locale = inject(LocaleService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  /** navbar (default) | auth (login/otp) | settings | inline */
  @Input() variant: 'navbar' | 'auth' | 'settings' | 'inline' = 'navbar';

  @Input() showIcon = true;

  currentLang: AppLang = 'en';

  ngOnInit(): void {
    this.locale.observeLang(this.destroy$, (lang) => {
      this.currentLang = lang;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Label shows the language you switch *to* (common toggle pattern). */
  get targetLabel(): string {
    return this.currentLang === 'ar' ? 'English' : 'عربي';
  }

  get hostClass(): string {
    switch (this.variant) {
      case 'auth':
        return 'lang-toggle lang-toggle--auth';
      case 'settings':
        return 'lang-toggle lang-toggle--settings settings-btn settings-btn--secondary';
      case 'inline':
        return 'lang-toggle lang-toggle--inline';
      default:
        return 'lang-toggle lang-toggle--navbar navbar__lang-btn';
    }
  }

  toggle(): void {
    void this.locale.toggle();
  }
}
