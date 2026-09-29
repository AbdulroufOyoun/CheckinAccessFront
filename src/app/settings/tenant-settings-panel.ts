import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbAlertModule, NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TenantCustomizationService } from '../services/tenant-customization.service';
import { SnackbarService } from '../services/snackbar.service';
import { LocaleService } from '../services/locale.service';
import {
  TENANT_LABEL_GROUPS,
  TENANT_LABEL_KEYS,
  TENANT_LABEL_META,
  TENANT_LABEL_MODULES,
  TENANT_NAV_IDS,
  TENANT_TERMINOLOGY_KEYS,
  TIMEZONE_OPTIONS,
  type TenantLabelGroup,
  type TenantLabelModule,
} from './tenant-settings.constants';
import {
  TENANT_WIDGET_CATALOG,
  TenantNavSectionForEdit,
  TenantWidgetCatalogEntry,
  applyNavSectionOrderToMap,
  buildNavSectionsForEdit,
  reorderNavSectionItems,
} from './tenant-nav.catalog';
import { TenantCustomizationPayload } from '../services/tenant-customization.types';
import { shadeHex } from '../services/tenant-brand.util';
import { TENANT_APPEARANCE_PRESETS, TenantAppearancePreset } from './tenant-appearance-presets';
import baseEn from '../../assets/i18n/en.json';
import baseAr from '../../assets/i18n/ar.json';

@Component({
  selector: 'app-tenant-settings-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgbNavModule,
    NgbAlertModule,
    TranslateModule,
    DragDropModule,
  ],
  templateUrl: './tenant-settings-panel.html',
  styleUrl: './tenant-settings-panel.css',
})
export class TenantSettingsPanel implements OnInit, OnDestroy {
  private static buildLabelGroupsForUi(groups: TenantLabelGroup[]): TenantLabelGroup[] {
    return groups
      .map((group) => ({
        ...group,
        keys: group.keys.filter((key) => TENANT_LABEL_META[key]?.kind !== 'nav'),
      }))
      .filter((group) => group.keys.length > 0);
  }

  readonly customization = inject(TenantCustomizationService);
  private pendingLogoFile: File | null = null;
  private pendingLogoObjectUrl: string | null = null;
  private readonly pendingLogoPreview = signal<string | null>(null);
  readonly logoPreviewUrl = computed(
    () => this.pendingLogoPreview() ?? this.customization.logoDisplayUrl(),
  );
  private readonly snackbar = inject(SnackbarService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly locale = inject(LocaleService);
  private readonly translate = inject(TranslateService);

  activeTab = 1;
  saving = false;
  loading = true;

  readonly labelKeys = TENANT_LABEL_KEYS;
  /** Page copy only — sidebar menu titles (DUR_NAV, …) are managed under Navigation. */
  readonly labelGroups = TenantSettingsPanel.buildLabelGroupsForUi(TENANT_LABEL_GROUPS);
  readonly labelUiKeys = this.labelGroups.flatMap((g) => g.keys);
  labelSearch = '';
  labelModuleFilter: TenantLabelModule | 'all' = 'all';
  readonly labelModules = TENANT_LABEL_MODULES;
  readonly navIds = TENANT_NAV_IDS;
  readonly terminologyKeys = TENANT_TERMINOLOGY_KEYS;
  readonly timezones = TIMEZONE_OPTIONS;
  readonly appearancePresets = TENANT_APPEARANCE_PRESETS;
  activeAppearancePresetId: string | null = null;

  navSectionsForEdit: TenantNavSectionForEdit[] = [];
  widgetEntries: TenantWidgetCatalogEntry[] = [...TENANT_WIDGET_CATALOG];

  appearance = {
    primary_color: '#2563eb',
    sidebar_color_start: '#0C1A3A',
    sidebar_color_end: '#0E2247',
    surface_bg: '#EEF2F9',
    app_name_ar: '',
    app_name_en: '',
    app_subtitle_ar: '',
    app_subtitle_en: '',
  };

  /** Single sidebar picker; end color derived automatically for API. */
  sidebar_color = '#0C1A3A';

  regional = {
    timezone: 'Asia/Riyadh',
    default_lang: 'en' as 'ar' | 'en',
    hour12: false,
  };

  welcome = {
    enabled: false,
    style: 'info' as 'info' | 'success' | 'warning',
    dismissible: true,
    title_ar: '',
    title_en: '',
    body_ar: '',
    body_en: '',
  };

  pdf = {
    show_logo: true,
    header_ar: '',
    header_en: '',
    footer_ar: '',
    footer_en: '',
    primary_color: '',
  };

  labelOverridesAr: Record<string, string> = {};
  labelOverridesEn: Record<string, string> = {};
  terminologyAr: Record<string, string> = {};
  terminologyEn: Record<string, string> = {};
  navHidden: Record<string, boolean> = {};
  navOrder: Record<string, number> = {};
  widgetVisible: Record<string, boolean> = {};

  ngOnInit(): void {
    void this.load();
  }

  ngOnDestroy(): void {
    this.clearPendingLogoSelection();
  }

  onManualAppearanceChange(): void {
    this.activeAppearancePresetId = null;
    this.syncSidebarEndFromPicker();
  }

  onSidebarColorChange(): void {
    this.activeAppearancePresetId = null;
    this.syncSidebarEndFromPicker();
  }

  applyAppearancePreset(preset: TenantAppearancePreset): void {
    this.activeAppearancePresetId = preset.id;
    this.appearance.primary_color = preset.primary_color;
    this.sidebar_color = preset.sidebar_color;
    this.appearance.surface_bg = preset.surface_bg;
    this.syncSidebarEndFromPicker();
    this.cdr.detectChanges();
  }

  isPresetActive(preset: TenantAppearancePreset): boolean {
    return this.activeAppearancePresetId === preset.id;
  }

  private syncSidebarEndFromPicker(): void {
    this.appearance.sidebar_color_start = this.sidebar_color;
    this.appearance.sidebar_color_end = shadeHex(this.sidebar_color, -16);
  }

  private previewAppearance(): void {
    this.syncSidebarEndFromPicker();
    this.customization.applyBranding(this.appearance);
  }

  welcomePreviewTitle(): string {
    const lang = this.locale.lang();
    const t = lang === 'ar' ? this.welcome.title_ar : this.welcome.title_en;
    return t.trim() || (lang === 'ar' ? 'مرحباً' : 'Welcome');
  }

  welcomePreviewBody(): string {
    const lang = this.locale.lang();
    const b = lang === 'ar' ? this.welcome.body_ar : this.welcome.body_en;
    return b.trim() || (lang === 'ar' ? 'نص الترحيب يظهر هنا.' : 'Welcome message preview.');
  }

  terminologyLabelKey(key: string): string {
    return `SET_TENANT_TERM_${key}`;
  }

  /** Base catalog string (before tenant override in inputs). */
  catalogLabel(key: string, lang: 'en' | 'ar'): string {
    const map = (lang === 'ar' ? baseAr : baseEn) as Record<string, string>;
    const value = map[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
    return key;
  }

  /** Human-facing card title (never the internal i18n key). */
  labelCardTitle(key: string): string {
    const lang = this.locale.lang();
    const override =
      lang === 'ar' ? this.labelOverridesAr[key]?.trim() : this.labelOverridesEn[key]?.trim();
    if (override) {
      return override;
    }
    return this.catalogLabel(key, lang);
  }

  labelModuleLabel(module: TenantLabelModule | 'all'): string {
    if (module === 'all') {
      return 'SET_TENANT_LABELS_MODULE_ALL';
    }
    return `SET_TENANT_LABELS_MODULE_${module.toUpperCase()}`;
  }

  setLabelModuleFilter(module: TenantLabelModule | 'all'): void {
    this.labelModuleFilter = module;
    this.cdr.detectChanges();
  }

  labelRowVisible(key: string): boolean {
    if (this.labelModuleFilter !== 'all') {
      const group = this.labelGroups.find((g) => g.keys.includes(key));
      if (group && group.module !== this.labelModuleFilter) {
        return false;
      }
    }
    const q = this.labelSearch.trim().toLowerCase();
    if (!q) {
      return true;
    }
    const haystack = [
      this.catalogLabel(key, 'en'),
      this.catalogLabel(key, 'ar'),
      this.labelOverridesEn[key] ?? '',
      this.labelOverridesAr[key] ?? '',
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  }

  labelGroupVisible(group: TenantLabelGroup): boolean {
    if (this.labelModuleFilter !== 'all' && group.module !== this.labelModuleFilter) {
      return false;
    }
    return group.keys.some((key) => this.labelRowVisible(key));
  }

  anyLabelGroupVisible(): boolean {
    return this.labelGroups.some((group) => this.labelGroupVisible(group));
  }

  isLabelCustomized(key: string): boolean {
    return !!(this.labelOverridesEn[key]?.trim() || this.labelOverridesAr[key]?.trim());
  }

  customizedLabelsCount(): number {
    return this.labelUiKeys.filter((key) => this.isLabelCustomized(key)).length;
  }

  clearLabelOverride(key: string): void {
    this.labelOverridesEn[key] = '';
    this.labelOverridesAr[key] = '';
    this.cdr.detectChanges();
  }

  isTerminologyCustomized(key: string): boolean {
    return !!(this.terminologyEn[key]?.trim() || this.terminologyAr[key]?.trim());
  }

  clearTerminologyOverride(key: string): void {
    this.terminologyEn[key] = '';
    this.terminologyAr[key] = '';
    this.cdr.detectChanges();
  }

  terminologyDefault(key: string, lang: 'en' | 'ar'): string {
    const labelKey = this.terminologyLabelKey(key);
    return this.catalogLabel(labelKey, lang);
  }

  async load(): Promise<void> {
    this.loading = true;
    try {
      const data = (await this.customization.loadSettings(true)) ?? this.customization.settings();
      if (data) {
        this.clearPendingLogoSelection();
        this.hydrateFromPayload(data);
      } else {
        this.rebuildNavSections();
        this.syncWidgetOrderFromCatalog();
      }
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.clearPendingLogoSelection();
    this.pendingLogoFile = file;
    this.pendingLogoObjectUrl = URL.createObjectURL(file);
    this.pendingLogoPreview.set(this.pendingLogoObjectUrl);
    input.value = '';
    this.cdr.detectChanges();
  }

  onNavDrop(sectionIndex: number, event: CdkDragDrop<TenantNavSectionForEdit['items']>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    const section = this.navSectionsForEdit[sectionIndex];
    const updated = reorderNavSectionItems(section, event.previousIndex, event.currentIndex);
    this.navSectionsForEdit = this.navSectionsForEdit.map((s, i) => (i === sectionIndex ? updated : s));
    applyNavSectionOrderToMap(this.navSectionsForEdit, this.navOrder);
    this.cdr.detectChanges();
  }

  onWidgetDrop(event: CdkDragDrop<TenantWidgetCatalogEntry[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    moveItemInArray(this.widgetEntries, event.previousIndex, event.currentIndex);
    this.cdr.detectChanges();
  }

  async saveAppearance(): Promise<void> {
    this.syncSidebarEndFromPicker();
    this.saving = true;
    this.cdr.detectChanges();
    try {
      if (this.pendingLogoFile) {
        await this.customization.uploadLogo(this.pendingLogoFile);
        this.clearPendingLogoSelection();
      }
      const data = await this.customization.saveSettings({
        appearance: {
          primary_color: this.appearance.primary_color,
          sidebar_color_start: this.appearance.sidebar_color_start,
          sidebar_color_end: this.appearance.sidebar_color_end,
          surface_bg: this.appearance.surface_bg,
          app_name: { ar: this.appearance.app_name_ar, en: this.appearance.app_name_en },
          app_subtitle: { ar: this.appearance.app_subtitle_ar, en: this.appearance.app_subtitle_en },
        },
      });
      if (data) {
        this.hydrateFromPayload(data);
      }
      this.snackbar.show(this.translate.instant('SET_TENANT_TOAST_SAVED'), 'success');
    } catch (err) {
      this.snackbar.show(this.saveErrorMessage(err), 'error');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  private clearPendingLogoSelection(): void {
    if (this.pendingLogoObjectUrl) {
      URL.revokeObjectURL(this.pendingLogoObjectUrl);
      this.pendingLogoObjectUrl = null;
    }
    this.pendingLogoFile = null;
    this.pendingLogoPreview.set(null);
  }

  async saveRegional(): Promise<void> {
    await this.save({
      regional: {
        timezone: this.regional.timezone,
        default_lang: this.regional.default_lang,
        date_preset: 'dmy_short',
        time_preset: 'hm_24',
        hour12: this.regional.hour12,
      },
    });
  }

  async saveWelcome(): Promise<void> {
    await this.save({
      welcome: {
        enabled: this.welcome.enabled,
        style: this.welcome.style,
        dismissible: this.welcome.dismissible,
        title: { ar: this.welcome.title_ar, en: this.welcome.title_en },
        body: { ar: this.welcome.body_ar, en: this.welcome.body_en },
      },
    });
  }

  async saveLabels(): Promise<void> {
    const ar: Record<string, string> = {};
    const en: Record<string, string> = {};
    for (const key of this.labelKeys) {
      if (this.labelOverridesAr[key]?.trim()) {
        ar[key] = this.labelOverridesAr[key].trim();
      }
      if (this.labelOverridesEn[key]?.trim()) {
        en[key] = this.labelOverridesEn[key].trim();
      }
    }
    const terminology: Record<string, { ar: string; en: string }> = {};
    for (const key of this.terminologyKeys) {
      const ta = this.terminologyAr[key]?.trim() ?? '';
      const te = this.terminologyEn[key]?.trim() ?? '';
      if (ta || te) {
        terminology[key] = { ar: ta, en: te };
      }
    }
    await this.save({ label_overrides: { ar, en }, terminology });
  }

  async saveNavigation(): Promise<void> {
    applyNavSectionOrderToMap(this.navSectionsForEdit, this.navOrder);
    const items = this.navIds.map((id, index) => ({
      id,
      hidden: !!this.navHidden[id],
      order: this.navOrder[id] ?? (index + 1) * 10,
    }));
    await this.save({ navigation: { items } });
  }

  async saveDashboard(): Promise<void> {
    const widgets = this.widgetEntries.map((entry, index) => ({
      id: entry.id,
      visible: this.widgetVisible[entry.id] !== false,
      order: (index + 1) * 10,
    }));
    await this.save({ dashboard: { widgets } });
  }

  async savePdf(): Promise<void> {
    await this.save({
      pdf: {
        show_logo: this.pdf.show_logo,
        primary_color: this.pdf.primary_color || null,
        header_text: { ar: this.pdf.header_ar, en: this.pdf.header_en },
        footer_text: { ar: this.pdf.footer_ar, en: this.pdf.footer_en },
      },
    });
  }

  private saveErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse && typeof err.error?.message === 'string' && err.error.message.trim()) {
      return err.error.message.trim();
    }
    if (err instanceof Error && err.message.trim()) {
      return err.message.trim();
    }
    return this.translate.instant('SET_TENANT_TOAST_SAVE_FAIL');
  }

  private async save(patch: Partial<TenantCustomizationPayload>): Promise<void> {
    this.saving = true;
    this.cdr.detectChanges();
    try {
      const data = await this.customization.saveSettings(patch);
      if (data) {
        this.hydrateFromPayload(data);
      }
      this.snackbar.show(this.translate.instant('SET_TENANT_TOAST_SAVED'), 'success');
    } catch (err) {
      this.snackbar.show(this.saveErrorMessage(err), 'error');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  private rebuildNavSections(): void {
    this.navSectionsForEdit = buildNavSectionsForEdit(this.navOrder);
  }

  private syncWidgetOrderFromCatalog(data?: TenantCustomizationPayload): void {
    const widgets = data?.dashboard?.widgets;
    if (!widgets?.length) {
      this.widgetEntries = [...TENANT_WIDGET_CATALOG];
      return;
    }
    const orderMap = new Map(widgets.map((w) => [w.id, w.order ?? 9999]));
    this.widgetEntries = [...TENANT_WIDGET_CATALOG].sort((a, b) => {
      const oa = orderMap.get(a.id) ?? 9999;
      const ob = orderMap.get(b.id) ?? 9999;
      if (oa !== ob) {
        return oa - ob;
      }
      return TENANT_WIDGET_CATALOG.findIndex((e) => e.id === a.id) - TENANT_WIDGET_CATALOG.findIndex((e) => e.id === b.id);
    });
  }

  private hydrateFromPayload(data: TenantCustomizationPayload): void {
    const a = data.appearance;
    if (a) {
      this.appearance.primary_color = a.primary_color ?? this.appearance.primary_color;
      this.appearance.sidebar_color_start = a.sidebar_color_start ?? this.appearance.sidebar_color_start;
      this.appearance.sidebar_color_end = a.sidebar_color_end ?? this.appearance.sidebar_color_end;
      this.appearance.surface_bg = a.surface_bg ?? this.appearance.surface_bg;
      this.appearance.app_name_ar =
        (a.app_name?.ar && String(a.app_name.ar).trim()) || this.customization.appName('ar');
      this.appearance.app_name_en =
        (a.app_name?.en && String(a.app_name.en).trim()) || this.customization.appName('en');
      this.appearance.app_subtitle_ar =
        (a.app_subtitle?.ar && String(a.app_subtitle.ar).trim()) || this.customization.appSubtitle('ar');
      this.appearance.app_subtitle_en =
        (a.app_subtitle?.en && String(a.app_subtitle.en).trim()) || this.customization.appSubtitle('en');
      this.sidebar_color = a.sidebar_color_start ?? this.sidebar_color;
    }
    const r = data.regional;
    if (r) {
      this.regional.timezone = r.timezone ?? this.regional.timezone;
      this.regional.default_lang = r.default_lang ?? 'en';
      this.regional.hour12 = r.hour12 ?? false;
    }
    const w = data.welcome;
    if (w) {
      this.welcome.enabled = !!w.enabled;
      this.welcome.style = w.style ?? 'info';
      this.welcome.dismissible = w.dismissible !== false;
      this.welcome.title_ar = w.title?.ar ?? '';
      this.welcome.title_en = w.title?.en ?? '';
      this.welcome.body_ar = w.body?.ar ?? '';
      this.welcome.body_en = w.body?.en ?? '';
    }
    const p = data.pdf;
    if (p) {
      this.pdf.show_logo = p.show_logo !== false;
      this.pdf.primary_color = p.primary_color ?? '';
      this.pdf.header_ar = p.header_text?.ar ?? '';
      this.pdf.header_en = p.header_text?.en ?? '';
      this.pdf.footer_ar = p.footer_text?.ar ?? '';
      this.pdf.footer_en = p.footer_text?.en ?? '';
    }
    for (const key of this.labelKeys) {
      this.labelOverridesAr[key] = data.label_overrides?.ar?.[key] ?? '';
      this.labelOverridesEn[key] = data.label_overrides?.en?.[key] ?? '';
    }
    for (const key of this.terminologyKeys) {
      this.terminologyAr[key] = data.terminology?.[key]?.ar ?? '';
      this.terminologyEn[key] = data.terminology?.[key]?.en ?? '';
    }
    for (const id of this.navIds) {
      const item = data.navigation?.items?.find((n) => n.id === id);
      this.navHidden[id] = !!item?.hidden;
      this.navOrder[id] = item?.order ?? 0;
    }
    for (const id of TENANT_WIDGET_CATALOG.map((e) => e.id)) {
      const item = data.dashboard?.widgets?.find((w) => w.id === id);
      this.widgetVisible[id] = item?.visible !== false;
    }
    this.rebuildNavSections();
    this.syncWidgetOrderFromCatalog(data);
    this.previewAppearance();
  }
}
