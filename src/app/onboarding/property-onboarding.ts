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
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../services/auth.service';
import { LocaleService } from '../services/locale.service';
import { TenantCustomizationService } from '../services/tenant-customization.service';
import { SnackbarService } from '../services/snackbar.service';
import { onboardingI18n } from './onboarding-i18n';
import { suggestedRoomTypesForProfile } from './property-onboarding-suggested-types';
import { Onboarding3dScene } from './onboarding-3d-scene';
import { LayoutFocusField, Onboarding3dVisual, visualFromProfileId } from './onboarding-3d.types';
import { previewColorForPreset } from './onboarding-3d-establishment-models';
import { roomGridLayout, roomTypeColorIndex } from './onboarding-3d-floor-grid';

@Component({
  selector: 'app-property-onboarding',
  standalone: true,
  imports: [FormsModule, TranslateModule, Onboarding3dScene],
  templateUrl: './property-onboarding.html',
  styleUrls: ['./property-onboarding.css', './onboarding-shell.css'],
})
export class PropertyOnboarding implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly locale = inject(LocaleService);
  readonly customization = inject(TenantCustomizationService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly cdr = inject(ChangeDetectorRef);
  private langSub?: Subscription;

  step = signal(1);
  busy = signal(false);
  newTypeName = '';
  layoutFocus = signal<LayoutFocusField>('none');
  activeTypeIndex = signal(0);

  roomTypes = signal<string[]>([]);
  compoundsCount = signal(1);
  buildingsPerCompound = signal(1);
  floorsPerBuilding = signal(2);
  roomsPerFloor = signal(4);
  defaultCapacity = signal(2);

  readonly totalRooms = computed(
    () =>
      this.compoundsCount() *
      this.buildingsPerCompound() *
      this.floorsPerBuilding() *
      this.roomsPerFloor(),
  );

  readonly profileId = signal<string>('hotel');

  readonly suggestedTypes = computed(() =>
    suggestedRoomTypesForProfile(this.profileId(), this.locale.lang()),
  );

  readonly sceneVisual = computed((): Onboarding3dVisual => visualFromProfileId(this.profileId()));

  readonly scenePrimaryColor = computed(() => {
    const fromTenant = this.customization.settings()?.appearance?.primary_color;
    if (fromTenant) {
      return fromTenant;
    }
    return previewColorForPreset(this.profileId());
  });

  readonly floorGrid = computed(() => roomGridLayout(this.roomsPerFloor()));

  readonly floorGridExtra = computed(() => {
    const g = this.floorGrid();
    return g.totalRooms > g.displayCount ? g.totalRooms - g.displayCount : 0;
  });

  floorGridCells(): number[] {
    return Array.from({ length: this.floorGrid().displayCount }, (_, i) => i);
  }

  i18n(key: string): string {
    return onboardingI18n(this.locale.lang(), key);
  }

  typeColorIndex(name: string): number {
    return roomTypeColorIndex(name);
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.langSub = this.translate.onLangChange.subscribe(() => {
        this.cdr.markForCheck();
      });
      void this.customization.loadPublicConfig();
      void this.customization.loadSettings().then((s) => {
        const profile = s?.onboarding?.profile_id ?? 'hotel';
        this.profileId.set(profile);
        if (this.roomTypes().length === 0) {
          const defaults = suggestedRoomTypesForProfile(profile, this.locale.lang());
          this.roomTypes.set(defaults.slice(0, 2));
        }
        this.cdr.markForCheck();
      });
    }
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
  }

  isTypeSelected(name: string): boolean {
    return this.roomTypes().includes(name);
  }

  toggleSuggestedType(name: string): void {
    if (this.busy()) {
      return;
    }
    if (this.roomTypes().includes(name)) {
      this.removeType(name);
      return;
    }
    this.roomTypes.update((list) => [...list, name]);
    this.activeTypeIndex.set(this.roomTypes().length - 1);
  }

  addCustomType(): void {
    const name = this.newTypeName.trim();
    if (!name || this.roomTypes().includes(name)) {
      return;
    }
    this.roomTypes.update((list) => {
      const next = [...list, name];
      this.activeTypeIndex.set(next.length - 1);
      return next;
    });
    this.newTypeName = '';
  }

  removeType(name: string): void {
    this.roomTypes.update((list) => list.filter((t) => t !== name));
    this.activeTypeIndex.set(0);
  }

  selectActiveType(index: number): void {
    this.activeTypeIndex.set(index);
  }

  bump(field: 'compounds' | 'buildings' | 'floors' | 'rooms' | 'capacity', delta: number): void {
    const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
    switch (field) {
      case 'compounds':
        this.compoundsCount.update((v) => clamp(v + delta, 1, 10));
        this.layoutFocus.set('compounds');
        break;
      case 'buildings':
        this.buildingsPerCompound.update((v) => clamp(v + delta, 1, 10));
        this.layoutFocus.set('buildings');
        break;
      case 'floors':
        this.floorsPerBuilding.update((v) => clamp(v + delta, 1, 20));
        this.layoutFocus.set('floors');
        break;
      case 'rooms':
        this.roomsPerFloor.update((v) => clamp(v + delta, 1, 30));
        this.layoutFocus.set('rooms');
        break;
      case 'capacity':
        this.defaultCapacity.update((v) => clamp(v + delta, 1, 12));
        break;
    }
  }

  onSlider(field: 'floors' | 'rooms', value: number): void {
    if (field === 'floors') {
      this.floorsPerBuilding.set(Math.min(20, Math.max(1, value)));
      this.layoutFocus.set('floors');
    } else {
      this.roomsPerFloor.set(Math.min(30, Math.max(1, value)));
      this.layoutFocus.set('rooms');
    }
  }

  canGoNext(): boolean {
    if (this.step() === 1) {
      return this.roomTypes().length > 0;
    }
    if (this.step() === 2) {
      return this.totalRooms() > 0 && this.totalRooms() <= 5000;
    }
    return true;
  }

  nextStep(): void {
    if (!this.canGoNext() || this.busy()) {
      return;
    }
    if (this.step() < 3) {
      this.step.update((s) => s + 1);
      this.layoutFocus.set('none');
    }
  }

  prevStep(): void {
    if (this.busy() || this.step() <= 1) {
      return;
    }
    this.step.update((s) => s - 1);
    this.layoutFocus.set('none');
  }

  async skip(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      await this.customization.skipPropertyStructure();
      this.snackbar.show(this.translate.instant('PROP_ONB_SKIP_DONE'), 'success');
      await this.router.navigate([this.auth.homeRoute()]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : this.translate.instant('PROP_ONB_SKIP_FAIL');
      this.snackbar.show(msg, 'error');
    } finally {
      this.busy.set(false);
    }
  }

  async createStructure(): Promise<void> {
    if (this.busy() || !this.canGoNext()) {
      return;
    }
    this.busy.set(true);
    try {
      await this.customization.provisionPropertyStructure({
        room_types: this.roomTypes(),
        compounds_count: this.compoundsCount(),
        buildings_per_compound: this.buildingsPerCompound(),
        floors_per_building: this.floorsPerBuilding(),
        rooms_per_floor: this.roomsPerFloor(),
        default_capacity: this.defaultCapacity(),
      });
      this.snackbar.show(this.translate.instant('PROP_ONB_CREATED'), 'success');
      await this.router.navigate([this.auth.homeRoute()]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : this.translate.instant('PROP_ONB_CREATE_FAIL');
      this.snackbar.show(msg, 'error');
    } finally {
      this.busy.set(false);
    }
  }
}
