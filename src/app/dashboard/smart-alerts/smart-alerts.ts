import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

export interface DashboardAlertItem {
  id: string;
  message: string;
  roomLabel: string;
  detail: string;
  level: 'warning' | 'danger' | 'info';
}

@Component({
  selector: 'app-smart-alerts',
  imports: [CommonModule, TranslateModule],
  templateUrl: './smart-alerts.html',
  styleUrl: './smart-alerts.css',
})
export class SmartAlerts {
  @Input() alerts: DashboardAlertItem[] = [];
  @Input() loading = false;
}
