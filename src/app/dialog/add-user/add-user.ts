import { Component, Inject, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { FormsModule } from "@angular/forms";

@Component({
  selector: 'app-add-user',
  imports: [FormsModule],
  templateUrl: './add-user.html',
  styleUrl: './add-user.css',
})
export class AddUser {
  isOpen: boolean = true
  isViewOpen: boolean = false
  isRTL: boolean = false
  dialog = inject(MatDialog);
  form: any = {
    fullNameEn: '',
    fullNameAr: '',
    phone: '',
    email: '',
    nationalId: '',
    nationality: '',
    gender: 'male'
  };
  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {
    console.log(data)
  }

  ngOnInit() {
    if (this.data?.mode === 'edit' && this.data?.user) {
      const u = this.data.user;
      this.form.fullNameEn = u.name;
      this.form.phone = u.phone;
      this.form.email = u.email;
      this.form.nationality = u.nationality;
      this.form.gender = u.gender || 'male';
      this.form.nationalId = u.nationalId;
      this.form.fullNameAr = u.nameAr;
    } else if (this.data?.mode === 'view' && this.data?.user) {
      this.isViewOpen = true
      const u = this.data.user;
      this.form.fullNameEn = u.name;
      this.form.phone = u.phone;
      this.form.email = u.email;
      this.form.nationality = u.nationality;
      this.form.gender = u.gender || 'male';
      this.form.nationalId = u.nationalId;
      this.form.fullNameAr = u.nameAr;
    }
  }

  close() {
    this.dialog.closeAll()
  }

  closeView() {
    this.dialog.closeAll()
  }
}
