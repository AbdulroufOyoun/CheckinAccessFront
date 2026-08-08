import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { RoomOccupancyStatus, RoomStatusItem, RoomStatusSummary } from '../../services/room-status.service';

interface FloorGroup {
  key: string;
  label: string;
  rooms: RoomStatusItem[];
}

@Component({
  selector: 'app-room-grid',
  imports: [CommonModule, TranslateModule, RouterLink],
  templateUrl: './room-grid.html',
  styleUrl: './room-grid.css',
})
export class RoomGrid {
  private readonly translate = inject(TranslateService);

  @Input() rooms: RoomStatusItem[] = [];
  @Input() summary: RoomStatusSummary | null = null;
  @Input() loading = false;

  get floors(): FloorGroup[] {
    const map = new Map<string, FloorGroup>();
    for (const room of this.rooms) {
      const floorNum = room.floor?.number ?? '?';
      const building = room.building?.name || '';
      const key = `${building}|${floorNum}`;
      if (!map.has(key)) {
        const label = building
          ? this.translate.instant('DASH_FLOOR_LABEL', { building, floor: floorNum })
          : this.translate.instant('DASH_FLOOR_ONLY', { floor: floorNum });
        map.set(key, { key, label, rooms: [] });
      }
      map.get(key)!.rooms.push(room);
    }
    return Array.from(map.values());
  }

  statusClass(status: RoomOccupancyStatus): string {
    if (status === 'occupied') return 'occupied';
    if (status === 'on_hold') return 'partial';
    if (status === 'inactive') return 'inactive';
    return 'available';
  }

  statusLabel(status: RoomOccupancyStatus): string {
    const key =
      status === 'occupied'
        ? 'DASH_STATUS_OCCUPIED'
        : status === 'on_hold'
          ? 'DASH_STATUS_ON_HOLD'
          : status === 'inactive'
            ? 'DASH_STATUS_INACTIVE'
            : 'DASH_STATUS_AVAILABLE';
    return this.translate.instant(key);
  }

  barColor(status: RoomOccupancyStatus): string {
    if (status === 'occupied') return '#DC2626';
    if (status === 'on_hold' || status === 'inactive') return '#D97706';
    return '#16A34A';
  }

  barWidth(status: RoomOccupancyStatus): string {
    if (status === 'occupied') return '100%';
    if (status === 'on_hold') return '50%';
    if (status === 'inactive') return '25%';
    return '0%';
  }
}
