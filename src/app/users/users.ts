import { Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AddUser } from '../dialog/add-user/add-user';

@Component({
  selector: 'app-users',
  imports: [],
  templateUrl: './users.html',
  styleUrl: './users.css',
})
export class Users {
  isRTL: boolean = false
  dialog = inject(MatDialog);
  users = [
    {
      initials: 'AH',
      name: 'Ahmed Al-Rashidi',
      nationality: 'Saudi',
      phone: '+966501234567',
      email: 'ahmed@email.com',
      active: 2,
      color: '#2563EB',
      shadow: 'rgba(37,99,235,0.25)',
      delay: '0s'
    },
    {
      initials: 'MO',
      name: 'Mohammed Al-Otaibi',
      nationality: 'Saudi',
      phone: '+966502345678',
      email: 'moh@email.com',
      active: 1,
      color: '#0D9488',
      shadow: 'rgba(13,148,136,0.25)',
      delay: '0.04s'
    },
    {
      initials: 'KD',
      name: 'Khalid Al-Dosari',
      nationality: 'Saudi',
      phone: '+966503456789',
      email: 'khalid@email.com',
      active: 0,
      color: '#7C3AED',
      shadow: 'rgba(124,58,237,0.25)',
      delay: '0.08s'
    },
    {
      initials: 'OG',
      name: 'Omar Al-Ghamdi',
      nationality: 'Saudi',
      phone: '+966504567890',
      email: 'omar@email.com',
      active: 1,
      color: '#DB2777',
      shadow: 'rgba(219,39,119,0.25)',
      delay: '0.12s'
    },
    {
      initials: 'AY',
      name: 'Ali Hassan Al-Yami',
      nationality: 'Yemeni',
      phone: '+966505678901',
      email: 'ali@email.com',
      active: 1,
      color: '#D97706',
      shadow: 'rgba(217,119,6,0.25)',
      delay: '0.16s'
    },
    {
      initials: 'HS',
      name: 'Hassan Al-Zubaydi',
      nationality: 'Yemeni',
      phone: '+966506789012',
      email: 'hassan@email.com',
      active: 0,
      color: '#DC2626',
      shadow: 'rgba(220,38,38,0.25)',
      delay: '0.20s'
    }
  ];

  constructor() {
  }


  openAddDialog() {
    this.dialog.open(AddUser, {
      panelClass: 'custom-dialog',
      backdropClass: 'custom-backdrop',
      data: { mode: 'add' }
    });
  }

  openEditDialog(user: any) {
    this.dialog.open(AddUser, {
      panelClass: 'custom-dialog',
      backdropClass: 'custom-backdrop',
      data: {
        mode: 'edit',
        user: user
      }
    });
  }

  openViewDialog(user: any) {
    this.dialog.open(AddUser, {
      panelClass: 'custom-dialog',
      backdropClass: 'custom-backdrop',
      data: {
        mode: 'view',
        user: user
      }
    });
  }
}
