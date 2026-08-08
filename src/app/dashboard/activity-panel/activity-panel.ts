import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

export interface DashboardActivityItem {
  id: number;
  message: string;
  roomLabel: string;
  timeLabel: string;
  kind: 'booking' | 'hold' | 'cancel';
}

@Component({
  selector: 'app-activity-panel',
  imports: [CommonModule, TranslateModule],
  templateUrl: './activity-panel.html',
  styleUrl: './activity-panel.css',
})
export class ActivityPanel {
  @Input() items: DashboardActivityItem[] = [];
  @Input() loading = false;
}
