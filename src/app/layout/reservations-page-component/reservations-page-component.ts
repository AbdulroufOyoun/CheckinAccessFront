import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { MatDialog } from '@angular/material/dialog';
import { AddUser } from '../../dialog/add-user/add-user';
import { AddBooking } from '../../dialog/add-booking/add-booking';

@Component({
  selector: 'app-reservations-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reservations-page-component.html',
  styleUrls: ['./reservations-page-component.css'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(8px)' }),
        animate('250ms ease-out',
          style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in',
          style({ opacity: 0, transform: 'translateY(-5px)' }))
      ])
    ])
  ]
})
export class ReservationsPageComponent implements OnInit {
  dialog = inject(MatDialog);


  search = '';
  statusFilter = '';

  reservations = [
    {
      id: 1,
      tenantName: 'John Smith',
      roomNumber: '101',
      building: 'Building A',
      checkIn: '2026-04-28',
      checkOut: '2026-05-02',
      status: 'active',
      amount: 500
    },
    {
      id: 2,
      tenantName: 'Sarah Johnson',
      roomNumber: '205',
      building: 'Building B',
      checkIn: '2026-04-29',
      checkOut: '2026-05-04',
      status: 'paused',
      amount: 650
    },
    {
      id: 3,
      tenantName: 'Michael Brown',
      roomNumber: '310',
      building: 'Building C',
      checkIn: '2026-04-30',
      checkOut: '2026-05-05',
      status: 'completed',
      amount: 700
    },
    {
      id: 1,
      tenantName: 'John Smith',
      roomNumber: '101',
      building: 'Building A',
      checkIn: '2026-04-28',
      checkOut: '2026-05-02',
      status: 'active',
      amount: 500
    },
    {
      id: 2,
      tenantName: 'Sarah Johnson',
      roomNumber: '205',
      building: 'Building B',
      checkIn: '2026-04-29',
      checkOut: '2026-05-04',
      status: 'paused',
      amount: 650
    },
    {
      id: 3,
      tenantName: 'Michael Brown',
      roomNumber: '310',
      building: 'Building C',
      checkIn: '2026-04-30',
      checkOut: '2026-05-05',
      status: 'completed',
      amount: 700
    },
    {
      id: 1,
      tenantName: 'John Smith',
      roomNumber: '101',
      building: 'Building A',
      checkIn: '2026-04-28',
      checkOut: '2026-05-02',
      status: 'active',
      amount: 500
    },
    {
      id: 2,
      tenantName: 'Sarah Johnson',
      roomNumber: '205',
      building: 'Building B',
      checkIn: '2026-04-29',
      checkOut: '2026-05-04',
      status: 'paused',
      amount: 650
    },
    {
      id: 3,
      tenantName: 'Michael Brown',
      roomNumber: '310',
      building: 'Building C',
      checkIn: '2026-04-30',
      checkOut: '2026-05-05',
      status: 'completed',
      amount: 700
    },
    {
      id: 1,
      tenantName: 'John Smith',
      roomNumber: '101',
      building: 'Building A',
      checkIn: '2026-04-28',
      checkOut: '2026-05-02',
      status: 'active',
      amount: 500
    },
    {
      id: 2,
      tenantName: 'Sarah Johnson',
      roomNumber: '205',
      building: 'Building B',
      checkIn: '2026-04-29',
      checkOut: '2026-05-04',
      status: 'paused',
      amount: 650
    },
    {
      id: 3,
      tenantName: 'Michael Brown',
      roomNumber: '310',
      building: 'Building C',
      checkIn: '2026-04-30',
      checkOut: '2026-05-05',
      status: 'completed',
      amount: 700
    },
    {
      id: 1,
      tenantName: 'John Smith',
      roomNumber: '101',
      building: 'Building A',
      checkIn: '2026-04-28',
      checkOut: '2026-05-02',
      status: 'active',
      amount: 500
    },
    {
      id: 2,
      tenantName: 'Sarah Johnson',
      roomNumber: '205',
      building: 'Building B',
      checkIn: '2026-04-29',
      checkOut: '2026-05-04',
      status: 'paused',
      amount: 650
    },
    {
      id: 3,
      tenantName: 'Michael Brown',
      roomNumber: '310',
      building: 'Building C',
      checkIn: '2026-04-30',
      checkOut: '2026-05-05',
      status: 'completed',
      amount: 700
    },
    {
      id: 1,
      tenantName: 'John Smith',
      roomNumber: '101',
      building: 'Building A',
      checkIn: '2026-04-28',
      checkOut: '2026-05-02',
      status: 'active',
      amount: 500
    },
    {
      id: 2,
      tenantName: 'Sarah Johnson',
      roomNumber: '205',
      building: 'Building B',
      checkIn: '2026-04-29',
      checkOut: '2026-05-04',
      status: 'paused',
      amount: 650
    },
    {
      id: 3,
      tenantName: 'Michael Brown',
      roomNumber: '310',
      building: 'Building C',
      checkIn: '2026-04-30',
      checkOut: '2026-05-05',
      status: 'completed',
      amount: 700
    },

  ];

  filteredReservations = [...this.reservations];

  statCounts = {
    all: 0,
    active: 0,
    paused: 0,
    cancelled: 0,
    completed: 0
  };

  ngOnInit(): void {
    this.updateStats();
    this.filterReservations();
  }

  setStatusFilter(status: string) {
    this.statusFilter = status;
    this.filterReservations();
  }

  onSearchChange() {
    this.filterReservations();
  }

  filterReservations() {
    const q = this.search.toLowerCase();

    this.filteredReservations = this.reservations.filter(r => {
      const matchSearch =
        !q ||
        r.tenantName.toLowerCase().includes(q) ||
        r.id.toString().includes(q) ||
        r.roomNumber.includes(q);

      const matchStatus =
        !this.statusFilter || r.status === this.statusFilter;

      return matchSearch && matchStatus;
    });
  }

  cancelReservation(id: number) {
    this.reservations = this.reservations.map(r =>
      r.id === id ? { ...r, status: 'cancelled' } : r
    );

    this.updateStats();
    this.filterReservations();
  }

  updateStats() {
    this.statCounts = {
      all: this.reservations.length,
      active: this.reservations.filter(r => r.status === 'active').length,
      paused: this.reservations.filter(r => r.status === 'paused').length,
      cancelled: this.reservations.filter(r => r.status === 'cancelled').length,
      completed: this.reservations.filter(r => r.status === 'completed').length
    };
  }

  viewReservation(id: number) {
    console.log('View reservation', id);
  }

  deleteReservation(id: number) {
    this.reservations = this.reservations.filter(r => r.id !== id);
    this.updateStats();
    this.filterReservations();
  }

  openNewReservation() {
    this.dialog.open(AddBooking, {
      panelClass: 'custom-dialog',
      backdropClass: 'custom-backdrop',
    });
  }

}
