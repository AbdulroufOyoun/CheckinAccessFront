import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { RoomStatusSummary } from '../../services/room-status.service';

@Component({
  selector: 'app-kpi-cards',
  imports: [CommonModule, TranslateModule],
  templateUrl: './kpi-cards.html',
  styleUrl: './kpi-cards.css',
})
export class KpiCards {
  @Input() summary: RoomStatusSummary | null = null;
  @Input() loading = false;

  get occupancyRate(): number {
    const total = this.summary?.total ?? 0;
    if (!total) return 0;
    const occupied = (this.summary?.occupied ?? 0) + (this.summary?.on_hold ?? 0);
    return Math.round((occupied / total) * 100);
  }
}
