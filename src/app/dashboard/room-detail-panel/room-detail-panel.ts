import { Component } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';

/* ✅ هون التعريف لازم يكون فوق */
export const slideInRight = trigger('slideInRight', [
  transition(':enter', [
    style({ transform: 'translateX(100%)', opacity: 0 }),
    animate('250ms ease-out', style({ transform: 'translateX(0)', opacity: 1 }))
  ]),
  transition(':leave', [
    animate('200ms ease-in', style({ transform: 'translateX(100%)', opacity: 0 }))
  ])
]);

@Component({
  selector: 'app-room-detail-panel',
  standalone: true,
  imports: [],
  templateUrl: './room-detail-panel.html',
  styleUrl: './room-detail-panel.css',
  animations: [slideInRight]
})
export class RoomDetailPanel {
  isOpen = false
}
