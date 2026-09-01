import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-sticky-action-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="sticky-action-bar sticky-action-bar--visible" role="toolbar">
      <ng-content />
    </div>
  `,
})
export class StickyActionBar {}
