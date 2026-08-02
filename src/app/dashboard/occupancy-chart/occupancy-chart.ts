import { Component } from '@angular/core';
import { ChartConfiguration, } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { ChartOptions } from 'chart.js';
@Component({
  selector: 'app-occupancy-chart',
  imports: [BaseChartDirective],
  templateUrl: './occupancy-chart.html',
  styleUrl: './occupancy-chart.css',
})
export class OccupancyChart {
  doughnutChartData: ChartConfiguration<'doughnut'>['data'] = {
    labels: ['Occupied', 'Partial', 'Available'],
    datasets: [
      {
        data: [29, 7, 12],
        backgroundColor: ['#DC2626', '#F59E0B', '#16A34A'],
        // backgroundColor: ['#1e3a5f', '#3b82f6', '#f59e0b'],

        borderWidth: 0
      }
    ]
  };

  doughnutChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { display: false }
    }
  };
  get occupancyPct(): number {
    const total = 29 + 7 + 12;
    return Math.round((29 / total) * 100);
  }
}
