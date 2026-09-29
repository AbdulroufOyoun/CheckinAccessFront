import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { LocaleService } from '../services/locale.service';
import { TenantCustomizationService } from '../services/tenant-customization.service';
import { EstablishmentPresetCard } from '../services/tenant-customization.types';
import type { AppLang } from '../services/locale.service';
import { SnackbarService } from '../services/snackbar.service';
import { onboardingI18n } from './onboarding-i18n';
import { Onboarding3dScene } from './onboarding-3d-scene';
import { previewColorForPreset } from './onboarding-3d-establishment-models';
import { Onboarding3dVisual, visualFromPresetId } from './onboarding-3d.types';

@Component({
  selector: 'app-establishment-setup',
  standalone: true,
  imports: [CommonModule, TranslateModule, Onboarding3dScene],
  templateUrl: './establishment-setup.html',
  styleUrls: ['./establishment-setup.css', './onboarding-shell.css'],
})
export class EstablishmentSetup implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly locale = inject(LocaleService);
  readonly customization = inject(TenantCustomizationService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly presets = signal<EstablishmentPresetCard[]>([]);
  readonly loading = signal(true);
  readonly applying = signal(false);
  readonly selectedId = signal<string | null>(null);
  readonly selectedLang = signal<AppLang | null>(null);
  readonly errorKey = signal<string | null>(null);
  private langSub?: Subscription;

  /** Language shown in UI (picker wins over global locale until synced). */
  readonly uiLang = computed(() => this.selectedLang() ?? this.locale.lang());

  readonly scenePresetId = computed(() => this.selectedId() ?? 'hotel');

  readonly sceneVisual = computed((): Onboarding3dVisual => visualFromPresetId(this.scenePresetId()));

  readonly scenePrimaryColor = computed(() => {
    const fromTenant = this.customization.settings()?.appearance?.primary_color;
    if (this.selectedId()) {
      return previewColorForPreset(this.selectedId());
    }
    return fromTenant ?? '#2563eb';
  });

  readonly sceneCaption = computed(() => {
    const id = this.selectedId();
    if (!id) {
      return this.i18n('EST_SETUP_SCENE_PICK');
    }
    const preset = this.presets().find((p) => p.id === id);
    return preset ? this.presetText(preset, 'title') : id;
  });

  readonly scenePulse = computed(() => (this.selectedId() ? 1 : 0));

  i18n(key: string): string {
    return onboardingI18n(this.uiLang(), key);
  }

  presetText(preset: EstablishmentPresetCard, field: 'title' | 'description'): string {
    const lang = this.uiLang();
    const block = preset[field];
    if (!block) {
      return preset.id;
    }
    return block[lang]?.trim() || block.en?.trim() || preset.id;
  }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.loading.set(false);
      return;
    }
    void this.customization.loadPublicConfig();
    this.selectedLang.set(this.locale.lang());
    this.langSub = this.translate.onLangChange.subscribe(() => {
      this.cdr.markForCheck();
    });
    void this.loadPresets();
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
  }

  private async loadPresets(): Promise<void> {
    this.loading.set(true);
    this.errorKey.set(null);
    try {
      const list = await this.customization.loadEstablishmentPresets();
      this.presets.set(list);
      if (!list.length) {
        this.errorKey.set('EST_SETUP_EMPTY');
      }
    } catch {
      this.errorKey.set('EST_SETUP_LOAD_FAILED');
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  iconGlyph(icon: string): string {
    const map: Record<string, string> = {
      hotel: '🏨',
      apartment: '🏢',
      compound: '🏘️',
      corporate: '🏛️',
      hospital: '🏥',
      student: '🎓',
      building: '🏗️',
    };
    return map[icon] ?? '🏗️';
  }

  selectPreset(id: string): void {
    if (this.applying()) {
      return;
    }
    this.selectedId.set(id);
  }

  async selectLanguage(lang: AppLang): Promise<void> {
    if (this.applying()) {
      return;
    }
    this.selectedLang.set(lang);
    await this.locale.use(lang, false);
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  canContinue(): boolean {
    return !!this.selectedId() && !!this.selectedLang() && !this.applying();
  }

  async confirm(): Promise<void> {
    const presetId = this.selectedId();
    const lang = this.selectedLang();
    if (!presetId || !lang || this.applying()) {
      return;
    }
    this.applying.set(true);
    try {
      await this.customization.applyEstablishmentPreset(presetId, lang);
      await this.locale.use(lang, true);
      this.snackbar.show(this.translate.instant('EST_SETUP_APPLIED'), 'success');
      await this.router.navigate(['/PropertyOnboarding']);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : this.translate.instant('EST_SETUP_APPLY_FAILED');
      this.snackbar.show(msg, 'error');
    } finally {
      this.applying.set(false);
      this.cdr.markForCheck();
    }
  }
}
