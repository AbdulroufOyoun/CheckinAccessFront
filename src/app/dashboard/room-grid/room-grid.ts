import { Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { RoomDetailsDialog } from '../../dialog/room-details-dialog/room-details-dialog';

@Component({
  selector: 'app-room-grid',
  imports: [],
  templateUrl: './room-grid.html',
  styleUrl: './room-grid.css',
})
export class RoomGrid {
  dialog = inject(MatDialog);
  constructor() {
    console.log( 'LANG' + localStorage.getItem('lang'))
  }
  openDetail() {
    this.dialog.open(RoomDetailsDialog, {
      backdropClass: 'custom-backdrop',
      // data: {
      //   dir: 'ltr'
      // }
    });
  }
}
