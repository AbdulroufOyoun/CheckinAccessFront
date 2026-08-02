import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-room-details-dialog',
  imports: [],
  templateUrl: './room-details-dialog.html',
  styleUrl: './room-details-dialog.css',
})
export class RoomDetailsDialog {
  lang: string = localStorage.getItem('lang') ?? 'en';
  type = 'Partial';
  // Available | Partial | Full

  capacity = 3;

  currentOccupancy = 2;

  occupancyPercent = 66;

  tenants = [
    {
      id: '2023456789',
      initials: 'AH',
      name: 'Ali Hassan',
      phone: '+966505678901',
      nationality: 'Yemeni',
      startDate: '2026-04-08',
      endDate: '2026-05-08',
      days: '30 Days',
      amount: '3,600'
    },
    {
      id: '2034567890',
      initials: 'HA',
      name: 'Hassan Ali',
      phone: '+966500000000',
      nationality: 'Saudi',
      startDate: '2026-04-01',
      endDate: '2026-04-20',
      days: '16 Days',
      amount: '1,920'
    }
  ];

  constructor(
    private dialogRef: MatDialogRef<RoomDetailsDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) { }

  closeDrawer(): void {
    this.dialogRef.close();
  }

}
