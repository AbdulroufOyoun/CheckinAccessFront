import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class SnackbarService {

  constructor(private snackBar: MatSnackBar) { }

  show(
    message: string,
    type: 'success' | 'error' = 'success'
  ) {

    const isArabic = 'en';

    this.snackBar.open(message, undefined, {
      duration: 5000,

      horizontalPosition:
        isArabic ? 'left' : 'right',

      verticalPosition: 'top',

      panelClass: [
        type === 'success'
          ? 'snackbar-success'
          : 'snackbar-error',

        isArabic
          ? 'snackbar-rtl'
          : 'snackbar-ltr'
      ]
    }
    );
  }
}
