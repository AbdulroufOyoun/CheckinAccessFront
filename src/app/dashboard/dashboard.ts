import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SmartAlerts, DashboardAlertItem } from './smart-alerts/smart-alerts';
import { ActivityPanel, DashboardActivityItem } from './activity-panel/activity-panel';
import { QuickActions } from './quick-actions/quick-actions';
import { OccupancyChart } from './occupancy-chart/occupancy-chart';
import { RoomGrid } from './room-grid/room-grid';
import { KpiCards } from './kpi-cards/kpi-cards';
import { AuthService } from '../services/auth.service';
import { ApiService } from '../services/api.service';
import { EduReports } from '../services/education.service';
import { RoomStatusItem, RoomStatusPayload, RoomStatusSummary } from '../services/room-status.service';
import { Booking } from '../services/bookings.service';
import { Apiendpointd } from '../apiEndpoints';
import { ApiResponse } from '../interfaces/api-response';

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslateModule,
    SmartAlerts,
    ActivityPanel,
    QuickActions,
    OccupancyChart,
    RoomGrid,
    KpiCards,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);

  filtersOpen = false;
  selectedBuildingId: number | null = null;
  buildings: Array<{ id: number; name: string }> = [];

  hasProperty = false;
  hasEducation = false;
  eduReports: EduReports | null = null;

  loadingProperty = false;
  loadingEdu = false;
  refreshing = false;
  summary: RoomStatusSummary | null = null;
  rooms: RoomStatusItem[] = [];
  activity: DashboardActivityItem[] = [];
  alerts: DashboardAlertItem[] = [];
  asOfLabel = '';

  get hasActiveFilter(): boolean {
    return this.selectedBuildingId != null;
  }

  get selectedBuildingName(): string {
    if (this.selectedBuildingId == null) return '';
    return this.buildings.find((b) => b.id === this.selectedBuildingId)?.name ?? '';
  }

  get greetingKey(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'DASH_GREETING_MORNING';
    if (hour < 18) return 'DASH_GREETING_AFTERNOON';
    return 'DASH_GREETING_EVENING';
  }

  get firstName(): string {
    const name = this.auth.getUser()?.name?.trim();
    if (!name) return '';
    return name.split(/\s+/)[0];
  }

  ngOnInit(): void {
    this.hasProperty = this.auth.hasModule('property');
    this.hasEducation = this.auth.hasModule('education');
    if (isPlatformBrowser(this.platformId)) {
      void this.loadAll();
    }
  }

  private async loadAll(): Promise<void> {
    await this.loadDashboard();

  }

  private async loadDashboard(): Promise<void> {
    if (this.hasProperty) this.loadingProperty = true;
    if (this.hasEducation) this.loadingEdu = true;
    try {
      const qs = new URLSearchParams();
      if (this.selectedBuildingId != null) qs.set('building_id', String(this.selectedBuildingId));

      const res = await this.api.get<ApiResponse<{
        education?: EduReports | null;
        property?: {
          buildings?: Array<{ id: number; name: string }>;
          status?: RoomStatusPayload | null;
          recent_bookings?: Booking[];
        };
      }>>(
        `${Apiendpointd.adminDashboard}${qs.toString() ? `?${qs.toString()}` : ''}`,
      );

      const data = res.data;

      this.eduReports = this.hasEducation ? (data.education ?? null) : null;

      if (this.hasProperty) {
        const prop = data.property;
        this.buildings = (prop?.buildings ?? []).map((b) => ({ id: b.id, name: b.name }));

        const status = prop?.status;
        if (status) {
          this.summary = status.summary;
          this.rooms = status.rooms || [];
          this.alerts = this.buildAlerts(this.rooms);
          this.asOfLabel = `${status.date} ${status.time}`;
        } else {
          this.summary = { total: 0, available: 0, occupied: 0, on_hold: 0, inactive: 0 };
          this.rooms = [];
          this.alerts = [];
          this.asOfLabel = '';
        }

        this.activity = (prop?.recent_bookings ?? []).slice(0, 8).map((b) => this.toActivity(b));
      }
    } catch {
      this.eduReports = null;
      this.summary = { total: 0, available: 0, occupied: 0, on_hold: 0, inactive: 0 };
      this.rooms = [];
      this.activity = [];
      this.alerts = [];
      this.asOfLabel = '';
    } finally {
      this.loadingProperty = false;
      this.loadingEdu = false;
      this.refreshing = false;
      this.cdr.detectChanges();
    }
  }

  async refresh(): Promise<void> {
    this.refreshing = true;
    this.cdr.detectChanges();
    await this.loadDashboard();
  }

  private buildAlerts(rooms: RoomStatusItem[]): DashboardAlertItem[] {
    const alerts: DashboardAlertItem[] = [];
    for (const room of rooms) {
      const label = room.number || room.name || String(room.id);
      if (room.status === 'on_hold') {
        alerts.push({
          id: `hold-${room.id}`,
          message: this.translate.instant('DASH_ALERT_ON_HOLD', { room: label }),
          roomLabel: label,
          detail: room.booking?.guest || '—',
          level: 'warning',
        });
      } else if (room.status === 'inactive') {
        alerts.push({
          id: `inactive-${room.id}`,
          message: this.translate.instant('DASH_ALERT_INACTIVE', { room: label }),
          roomLabel: label,
          detail: this.translate.instant('DASH_KPI_INACTIVE'),
          level: 'info',
        });
      }
    }
    return alerts.slice(0, 8);
  }

  private toActivity(b: Booking): DashboardActivityItem {
    const units = b.booking_period_units || b.bookingPeriodUnits || [];
    const unit = units[0];
    const roomLabel =
      unit?.room?.number || unit?.room?.name || unit?.building?.name || unit?.facility?.name || '—';
    const guest = b.user?.name || `#${b.user_id}`;
    let kind: DashboardActivityItem['kind'] = 'booking';
    let message = this.translate.instant('DASH_ACT_BOOKING', { guest });
    if (b.cancelled) {
      kind = 'cancel';
      message = this.translate.instant('DASH_ACT_CANCEL', { guest });
    } else if (b.on_hold) {
      kind = 'hold';
      message = this.translate.instant('DASH_ACT_HOLD', { guest });
    }
    return {
      id: b.id,
      message,
      roomLabel: String(roomLabel),
      timeLabel: b.created_at ? new Date(b.created_at).toLocaleString() : `#${b.id}`,
      kind,
    };
  }

  toggleFilters(): void {
    this.filtersOpen = !this.filtersOpen;
  }

  async applyBuildingFilter(): Promise<void> {
    await this.loadDashboard();
  }

  async resetFilters(): Promise<void> {
    this.selectedBuildingId = null;
    this.filtersOpen = false;
    await this.loadDashboard();
  }
}
