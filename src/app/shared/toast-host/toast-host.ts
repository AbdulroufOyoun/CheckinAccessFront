import { Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { SnackbarService } from '../../services/snackbar.service';

@Component({
  selector: 'app-toast-host',
  imports: [TranslateModule],
  templateUrl: './toast-host.html',
  styleUrl: './toast-host.css',
})
export class ToastHost {
  readonly snackbar = inject(SnackbarService);
}
