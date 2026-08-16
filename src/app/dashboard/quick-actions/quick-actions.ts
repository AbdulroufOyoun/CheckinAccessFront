import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-quick-actions',
  imports: [RouterLink, TranslateModule],
  templateUrl: './quick-actions.html',
  styleUrl: './quick-actions.css',
})
export class QuickActions {
  private readonly auth = inject(AuthService);

  get canBook(): boolean {
    return this.auth.hasModule('property') && this.auth.can('manage bookings');
  }

  get canUsers(): boolean {
    return this.auth.can('manage users');
  }

  get canReports(): boolean {
    return this.auth.hasModule('property') && this.auth.can('view reports');
  }

  get hasActions(): boolean {
    return this.canBook || this.canUsers || this.canReports;
  }
}
