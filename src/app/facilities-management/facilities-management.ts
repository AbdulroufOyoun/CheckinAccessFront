import { Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AddBooking } from '../dialog/add-booking/add-booking';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AddBuilding } from '../dialog/add-building/add-building';



@Component({
  selector: 'app-facilities-management',
  imports: [FormsModule, CommonModule],
  templateUrl: './facilities-management.html',
  styleUrl: './facilities-management.css',
})
export class FacilitiesManagement {
  expandedBuildings: number[] = [];
  expandedFloors: number[] = [];
  expandedSuites: number[] = [];
  breadcrumb: string[] = [];

  buildings = [
    {
      id: 1,
      name: 'Building A',
      status: 'Active',
      facilities: [],
      // facilities: ['Gym', 'Pool', 'Parking'],
      floors: [
        {
          id: 1,
          name: 'Floor 1',
          suites: [
            {
              id: 1,
              name: 'Suite 101',
              rooms: [
                { id: 1, number: '101', status: 'Available', type: 'Single' },
                { id: 2, number: '102', status: 'Occupied', type: 'Double' },
                { id: 3, number: '103', status: 'Available', type: 'Single' },
                { id: 1, number: '101', status: 'Available', type: 'Single' },
                { id: 2, number: '102', status: 'Occupied', type: 'Double' },
                { id: 3, number: '103', status: 'Available', type: 'Single' },
                { id: 1, number: '101', status: 'Available', type: 'Single' },
                { id: 2, number: '102', status: 'Occupied', type: 'Double' },
                { id: 3, number: '103', status: 'Available', type: 'Single' },
                { id: 1, number: '101', status: 'Available', type: 'Single' },
                { id: 2, number: '102', status: 'Occupied', type: 'Double' },
                { id: 3, number: '103', status: 'Available', type: 'Single' },
                { id: 1, number: '101', status: 'Available', type: 'Single' },
                { id: 2, number: '102', status: 'Occupied', type: 'Double' },
                { id: 3, number: '103', status: 'Available', type: 'Single' },
                { id: 1, number: '101', status: 'Available', type: 'Single' },
                { id: 2, number: '102', status: 'Occupied', type: 'Double' },
                { id: 3, number: '103', status: 'Available', type: 'Single' },
              ]
            },
            {
              id: 2,
              name: 'Suite 102',
              rooms: [
                { id: 4, number: '201', status: 'Occupied', type: 'Double' },
                { id: 5, number: '202', status: 'Available', type: 'Single' }
              ]
            }
          ]
        },
        {
          id: 2,
          name: 'Floor 2',
          suites: [
            {
              id: 3,
              name: 'Suite 201',
              rooms: [
                { id: 6, number: '301', status: 'Available', type: 'Single' },
                { id: 7, number: '302', status: 'Occupied', type: 'Double' }
              ]
            }
          ]
        }
      ]
    },

    {
      id: 2,
      name: 'Building B',
      status: 'Under Maintenance',
      facilities: ['Gym'],
      floors: [
        {
          id: 1,
          name: 'Floor 1',
          suites: [
            {
              id: 1,
              name: 'Suite 101',
              rooms: [
                { id: 1, number: '101', status: 'Available', type: 'Single' },
                { id: 2, number: '102', status: 'Occupied', type: 'Double' }
              ]
            }
          ]
        }
      ]
    },

    {
      id: 3,
      name: 'Building C',
      status: 'Active',
      facilities: ['Pool', 'Security'],
      // floors: [
      //   {
      //     id: 1,
      //     name: 'Floor 1',
      //     suites: [
      //       {
      //         id: 1,
      //         name: 'Suite 101',
      //         rooms: [
      //           { id: 1, number: '101', status: 'Available', type: 'Single' },
      //           { id: 2, number: '102', status: 'Occupied', type: 'Double' },
      //           { id: 3, number: '103', status: 'Available', type: 'Single' }
      //         ]
      //       }
      //     ]
      //   }
      // ]
    }
  ];

  selectedType: string = '';
  selectedId: number | null = null;
  selectedItem: any = null;

  lang: string = localStorage.getItem('lang') ?? '';
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
      status: 'Floor',
      amount: 500
    },
    {
      id: 2,
      tenantName: 'Sarah Johnson',
      roomNumber: '205',
      building: 'Building B',
      checkIn: '2026-04-29',
      checkOut: '2026-05-04',
      status: 'Room',
      amount: 650
    },
    {
      id: 3,
      tenantName: 'Michael Brown',
      roomNumber: '310',
      building: 'Building C',
      checkIn: '2026-04-30',
      checkOut: '2026-05-05',
      status: 'Facilitie',
      amount: 700
    },
    {
      id: 1,
      tenantName: 'John Smith',
      roomNumber: '101',
      building: 'Building A',
      checkIn: '2026-04-28',
      checkOut: '2026-05-02',
      status: 'Floor',
      amount: 500
    },
    {
      id: 2,
      tenantName: 'Sarah Johnson',
      roomNumber: '205',
      building: 'Building B',
      checkIn: '2026-04-29',
      checkOut: '2026-05-04',
      status: 'Room',
      amount: 650
    },
    {
      id: 3,
      tenantName: 'Michael Brown',
      roomNumber: '310',
      building: 'Building C',
      checkIn: '2026-04-30',
      checkOut: '2026-05-05',
      status: 'Facilitie',
      amount: 700
    },
    {
      id: 1,
      tenantName: 'John Smith',
      roomNumber: '101',
      building: 'Building A',
      checkIn: '2026-04-28',
      checkOut: '2026-05-02',
      status: 'Floor',
      amount: 500
    },
    {
      id: 2,
      tenantName: 'Sarah Johnson',
      roomNumber: '205',
      building: 'Building B',
      checkIn: '2026-04-29',
      checkOut: '2026-05-04',
      status: 'Room',
      amount: 650
    },
    {
      id: 3,
      tenantName: 'Michael Brown',
      roomNumber: '310',
      building: 'Building C',
      checkIn: '2026-04-30',
      checkOut: '2026-05-05',
      status: 'Facilitie',
      amount: 700
    },
    {
      id: 1,
      tenantName: 'John Smith',
      roomNumber: '101',
      building: 'Building A',
      checkIn: '2026-04-28',
      checkOut: '2026-05-02',
      status: 'Floor',
      amount: 500
    },
    {
      id: 2,
      tenantName: 'Sarah Johnson',
      roomNumber: '205',
      building: 'Building B',
      checkIn: '2026-04-29',
      checkOut: '2026-05-04',
      status: 'Room',
      amount: 650
    },
    {
      id: 3,
      tenantName: 'Michael Brown',
      roomNumber: '310',
      building: 'Building C',
      checkIn: '2026-04-30',
      checkOut: '2026-05-05',
      status: 'Facilitie',
      amount: 700
    },
    {
      id: 1,
      tenantName: 'John Smith',
      roomNumber: '101',
      building: 'Building A',
      checkIn: '2026-04-28',
      checkOut: '2026-05-02',
      status: 'Floor',
      amount: 500
    },
    {
      id: 2,
      tenantName: 'Sarah Johnson',
      roomNumber: '205',
      building: 'Building B',
      checkIn: '2026-04-29',
      checkOut: '2026-05-04',
      status: 'Room',
      amount: 650
    },
    {
      id: 3,
      tenantName: 'Michael Brown',
      roomNumber: '310',
      building: 'Building C',
      checkIn: '2026-04-30',
      checkOut: '2026-05-05',
      status: 'Facilitie',
      amount: 700
    },
    {
      id: 1,
      tenantName: 'John Smith',
      roomNumber: '101',
      building: 'Building A',
      checkIn: '2026-04-28',
      checkOut: '2026-05-02',
      status: 'Floor',
      amount: 500
    },
    {
      id: 2,
      tenantName: 'Sarah Johnson',
      roomNumber: '205',
      building: 'Building B',
      checkIn: '2026-04-29',
      checkOut: '2026-05-04',
      status: 'Room',
      amount: 650
    },
    {
      id: 3,
      tenantName: 'Michael Brown',
      roomNumber: '310',
      building: 'Building C',
      checkIn: '2026-04-30',
      checkOut: '2026-05-05',
      status: 'Facilitie',
      amount: 700
    },

  ];
  filteredReservations = [...this.reservations];
  statCounts = {
    Building: 0,
    Floor: 0,
    Room: 0,
    Suite: 0,
    Facilitie: 0
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
      r.id === id ? { ...r, status: 'Suite' } : r
    );

    this.updateStats();
    this.filterReservations();
  }

  updateStats() {
    this.statCounts = {
      Building: this.reservations.length,
      Floor: this.reservations.filter(r => r.status === 'Floor').length,
      Room: this.reservations.filter(r => r.status === 'Room').length,
      Suite: this.reservations.filter(r => r.status === 'Suite').length,
      Facilitie: this.reservations.filter(r => r.status === 'Facilitie').length
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

  toggleBuilding(id: number) {
    const index = this.expandedBuildings.indexOf(id);

    if (index > -1) {
      this.expandedBuildings.splice(index, 1);
    } else {
      this.expandedBuildings.push(id);
    }
  }

  toggleFloor(id: number) {
    const index = this.expandedFloors.indexOf(id);

    if (index > -1) {
      this.expandedFloors.splice(index, 1);
    } else {
      this.expandedFloors.push(id);
    }
  }

  toggleSuite(id: number) {
    const index = this.expandedSuites.indexOf(id);

    if (index > -1) {
      this.expandedSuites.splice(index, 1);
    } else {
      this.expandedSuites.push(id);
    }
  }

  // selectItem(type: string, id: number) {
  //   this.selectedType = type;
  //   this.selectedId = id;
  // }


  selectItem(type: string, item: any, path: string[]) {
    this.selectedType = type;
    this.selectedItem = item;
    this.selectedId = item.id;
    this.breadcrumb = path;

    console.log('TYPE = ' + type)
  }

  getBuildingRooms(building: any) {
    return building.floors
      ?.flatMap((floor: any) =>
        floor.suites?.flatMap((suite: any) => suite.rooms || [])
      ) || [];
  }

  getFloorRooms(floor: any) {
    return floor.suites
      ?.flatMap((suite: any) => suite.rooms || []) || [];
  }

  openDialogAddBuilding() {
    this.dialog.open(AddBuilding, {
      width: '500px',
      maxWidth: '550px',
      panelClass: 'custom-dialog',
      backdropClass: 'custom-backdrop',
    });
  }

}
