import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { LocaleService } from '../services/locale.service';
import { TenantCustomizationService } from '../services/tenant-customization.service';

/** Resolves tenant terminology (e.g. room → Unit) with catalog fallback. */
@Pipe({ name: 'entityLabel', standalone: true, pure: false })
export class EntityLabelPipe implements PipeTransform {
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LocaleService);
  private readonly customization = inject(TenantCustomizationService);

  transform(entity: string): string {
    const termKey = entity.includes('.') ? entity : `entity.${entity}`;
    const lang = this.locale.lang();
    const custom = this.customization.settings()?.terminology?.[termKey]?.[lang]?.trim();
    if (custom) {
      return custom;
    }
    const catalogKey = `SET_TENANT_TERM_${termKey}`;
    const translated = this.translate.instant(catalogKey);
    if (translated !== catalogKey) {
      return translated;
    }
    const merged = this.translate.instant(termKey);
    return merged !== termKey ? merged : termKey;
  }
}
