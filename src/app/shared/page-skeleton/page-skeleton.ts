import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-page-skeleton',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './page-skeleton.html',
  styleUrl: './page-skeleton.css',
})
export class PageSkeleton {
  @Input() variant: 'table' | 'cards' | 'kpi' = 'table';
  @Input() rows = 6;
  @Input() cols = 5;
  @Input() cards = 6;

  get rowItems(): number[] {
    return Array.from({ length: this.rows }, (_, i) => i);
  }

  get colItems(): number[] {
    return Array.from({ length: this.cols }, (_, i) => i);
  }

  get cardItems(): number[] {
    return Array.from({ length: this.cards }, (_, i) => i);
  }

  get kpiItems(): number[] {
    return [0, 1, 2, 3];
  }
}
