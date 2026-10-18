import {
  Component,
  ElementRef,
  HostListener,
  OnInit,
  PLATFORM_ID,
  QueryList,
  ViewChildren,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LocaleService } from '../services/locale.service';
import { TenantCustomizationService } from '../services/tenant-customization.service';
import { SnackbarService } from '../services/snackbar.service';

const SLIDE_KEYS = [
  {
    title: 'WELCOME_SLIDE1_TITLE',
    lead: 'WELCOME_SLIDE1_LEAD',
    features: ['WELCOME_SLIDE1_F1', 'WELCOME_SLIDE1_F2', 'WELCOME_SLIDE1_F3'],
  },
  {
    title: 'WELCOME_SLIDE2_TITLE',
    lead: 'WELCOME_SLIDE2_LEAD',
    features: ['WELCOME_SLIDE2_F1', 'WELCOME_SLIDE2_F2', 'WELCOME_SLIDE2_F3'],
  },
  {
    title: 'WELCOME_SLIDE3_TITLE',
    lead: 'WELCOME_SLIDE3_LEAD',
    features: ['WELCOME_SLIDE3_F1', 'WELCOME_SLIDE3_F2', 'WELCOME_SLIDE3_F3'],
  },
  {
    title: 'WELCOME_SLIDE4_TITLE',
    lead: 'WELCOME_SLIDE4_LEAD',
    features: ['WELCOME_SLIDE4_F1', 'WELCOME_SLIDE4_F2', 'WELCOME_SLIDE4_F3'],
  },
] as const;

@Component({
  selector: 'app-onboarding-product-welcome',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './onboarding-product-welcome.html',
  styleUrl: './onboarding-product-welcome.css',
})
export class OnboardingProductWelcome implements OnInit {
  private readonly router = inject(Router);
  readonly locale = inject(LocaleService);
  private readonly customization = inject(TenantCustomizationService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly platformId = inject(PLATFORM_ID);

  @ViewChildren('slideTitle') private slideTitles?: QueryList<ElementRef<HTMLElement>>;

  readonly slides = SLIDE_KEYS;
  readonly slideIndex = signal(0);
  readonly busy = signal(false);
  readonly slideCount = SLIDE_KEYS.length;

  readonly uiLang = computed(() => this.locale.lang());

  readonly slideLabel = computed(() => {
    const n = String(this.slideIndex() + 1).padStart(2, '0');
    const total = String(this.slideCount).padStart(2, '0');
    return `${n} / ${total}`;
  });

  readonly isLastSlide = computed(() => this.slideIndex() >= this.slideCount - 1);

  /** Negative offset slides the LTR track so the next step enters from the side. */
  readonly trackShift = computed(() => -this.slideIndex());

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    void this.customization.loadSettings(true);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!isPlatformBrowser(this.platformId) || this.busy()) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') {
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      const rtl = this.uiLang() === 'ar';
      const forward = event.key === 'ArrowRight' ? !rtl : rtl;
      event.preventDefault();
      if (forward) {
        void this.next();
      } else {
        this.back();
      }
    }
    if (event.key === 'Enter' && this.isLastSlide()) {
      event.preventDefault();
      void this.finish();
    }
  }

  back(): void {
    if (this.slideIndex() <= 0 || this.busy()) {
      return;
    }
    this.slideIndex.update((i) => i - 1);
    this.focusTitle();
  }

  async next(): Promise<void> {
    if (this.busy()) {
      return;
    }
    if (this.isLastSlide()) {
      await this.finish();
      return;
    }
    this.slideIndex.update((i) => i + 1);
    this.focusTitle();
  }

  async skip(): Promise<void> {
    await this.completeAndGoSetup();
  }

  async finish(): Promise<void> {
    await this.completeAndGoSetup();
  }

  goToSlide(index: number): void {
    if (this.busy() || index < 0 || index >= this.slideCount || index === this.slideIndex()) {
      return;
    }
    this.slideIndex.set(index);
    this.focusTitle();
  }

  private focusTitle(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    queueMicrotask(() => this.slideTitles?.get(this.slideIndex())?.nativeElement?.focus());
  }

  private async completeAndGoSetup(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      await this.customization.completeProductIntro();
      await this.router.navigate(['/EstablishmentSetup']);
    } catch {
      this.snackbar.show(this.translate.instant('WELCOME_COMPLETE_FAIL'), 'error');
    } finally {
      this.busy.set(false);
    }
  }
}
