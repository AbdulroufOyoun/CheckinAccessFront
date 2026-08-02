import { Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-add-booking',
  imports: [],
  templateUrl: './add-booking.html',
  styleUrl: './add-booking.css',
})
export class AddBooking {
  isRTL: boolean = false
  dialog = inject(MatDialog);


  close() {
    this.dialog.closeAll()
  }

}
