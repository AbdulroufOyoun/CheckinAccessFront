import { Injectable, inject } from '@angular/core';
import { MatDialog, MatDialogConfig, MatDialogRef } from '@angular/material/dialog';
import { ComponentType } from '@angular/cdk/portal';
import { MobileLayoutService } from '../layout/mobile-layout.service';

@Injectable({ providedIn: 'root' })
export class DialogMobileService {
  private readonly dialog = inject(MatDialog);
  private readonly mobileLayout = inject(MobileLayoutService);

  open<T, D = unknown, R = unknown>(
    component: ComponentType<T>,
    config?: MatDialogConfig<D>,
  ): MatDialogRef<T, R> {
    const mobile = this.mobileLayout.isDialogMobile();
    const merged: MatDialogConfig<D> = {
      ...config,
      maxWidth: mobile ? '100vw' : (config?.maxWidth ?? '640px'),
      width: mobile ? '100vw' : (config?.width ?? '640px'),
      height: mobile ? '100dvh' : config?.height,
      maxHeight: mobile ? '100dvh' : (config?.maxHeight ?? '90vh'),
      panelClass: mobile
        ? ['dialog--fullscreen', ...(Array.isArray(config?.panelClass) ? config.panelClass : config?.panelClass ? [config.panelClass] : [])]
        : config?.panelClass ?? ['custom-dialog'],
      backdropClass: config?.backdropClass ?? 'custom-backdrop',
      autoFocus: config?.autoFocus ?? false,
    };
    return this.dialog.open(component, merged);
  }
}
