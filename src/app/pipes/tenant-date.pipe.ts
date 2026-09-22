import { Pipe, PipeTransform, inject } from '@angular/core';
import { TenantDateTimeService } from '../services/tenant-date-time.service';

@Pipe({ name: 'tenantDate', standalone: true })
export class TenantDatePipe implements PipeTransform {
  private readonly dt = inject(TenantDateTimeService);

  transform(value?: string | null): string {
    return this.dt.formatDate(value);
  }
}

@Pipe({ name: 'tenantDateTime', standalone: true })
export class TenantDateTimePipe implements PipeTransform {
  private readonly dt = inject(TenantDateTimeService);

  transform(value?: string | null): string {
    return this.dt.formatDateTime(value);
  }
}
