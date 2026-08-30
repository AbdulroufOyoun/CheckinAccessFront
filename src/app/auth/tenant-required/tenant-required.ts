import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { tenantHostExample } from '../../core/tenant-host';

@Component({
  selector: 'app-tenant-required',
  imports: [TranslateModule],
  templateUrl: './tenant-required.html',
  styleUrl: './tenant-required.css',
})
export class TenantRequired {
  readonly exampleUrl = tenantHostExample('abd');
}
