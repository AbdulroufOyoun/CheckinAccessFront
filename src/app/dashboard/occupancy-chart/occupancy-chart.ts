import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { RoomStatusSummary } from '../../services/room-status.service';

@Component({
  selector: 'app-occupancy-chart',
  imports: [CommonModule, TranslateModule, BaseChartDirective],
  templateUrl: './occupancy-chart.html',
  styleUrl: './occupancy-chart.css',
})
export class OccupancyChart implements OnChanges {
  @Input() summary: RoomStatusSummary | null = null;

  doughnutChartData: ChartConfiguration<'doughnut'>['data'] = {
    labels: ['Occupied', 'On hold', 'Available'],
    datasets: [
      {
        data: [0, 0, 0],
        backgroundColor: ['#DC2626', '#F59E0B', '#16A34A'],
        borderWidth: 0,
      },
    ],
  };

  doughnutChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: { legend: { display: false } },
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['summary']) this.applySummary();
  }

  private applySummary(): void {
    const occupied = this.summary?.occupied ?? 0;
    const onHold = this.summary?.on_hold ?? 0;
    const available = this.summary?.available ?? 0;
    this.doughnutChartData = {
      ...this.doughnutChartData,
      datasets: [
        {
          ...this.doughnutChartData.datasets[0],
          data: [occupied, onHold, available],
        },
      ],
    };
  }

  get occupancyPct(): number {
    const total = this.summary?.total ?? 0;
    if (!total) return 0;
    return Math.round((((this.summary?.occupied ?? 0) + (this.summary?.on_hold ?? 0)) / total) * 100);
  }

  pct(part: number): number {
    const total = this.summary?.total ?? 0;
    if (!total) return 0;
    return Math.round((part / total) * 100);
  }
}
