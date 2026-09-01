import { DestroyRef, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export const MOBILE_BREAKPOINT_PX = 900;
export const DIALOG_MOBILE_BREAKPOINT_PX = 768;

@Injectable({ providedIn: 'root' })
export class MobileLayoutService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  readonly isMobile = signal(false);
  readonly drawerOpen = signal(false);
  readonly moreSheetOpen = signal(false);
  readonly searchSheetOpen = signal(false);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
    const sync = (): void => {
      const mobile = mq.matches;
      this.isMobile.set(mobile);
      if (!mobile) {
        this.drawerOpen.set(false);
        this.moreSheetOpen.set(false);
        this.searchSheetOpen.set(false);
      }
    };
    sync();
    mq.addEventListener('change', sync);
    this.destroyRef.onDestroy(() => mq.removeEventListener('change', sync));
  }

  openDrawer(): void {
    this.moreSheetOpen.set(false);
    this.searchSheetOpen.set(false);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  toggleDrawer(): void {
    if (this.drawerOpen()) {
      this.closeDrawer();
    } else {
      this.openDrawer();
    }
  }

  openMore(): void {
    this.closeDrawer();
    this.searchSheetOpen.set(false);
    this.moreSheetOpen.set(true);
  }

  closeMore(): void {
    this.moreSheetOpen.set(false);
  }

  toggleMore(): void {
    if (this.moreSheetOpen()) {
      this.closeMore();
    } else {
      this.openMore();
    }
  }

  openSearchSheet(): void {
    this.closeDrawer();
    this.closeMore();
    this.searchSheetOpen.set(true);
  }

  closeSearchSheet(): void {
    this.searchSheetOpen.set(false);
  }

  closeAllOverlays(): void {
    this.drawerOpen.set(false);
    this.moreSheetOpen.set(false);
    this.searchSheetOpen.set(false);
  }

  isDialogMobile(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }
    return window.matchMedia(`(max-width: ${DIALOG_MOBILE_BREAKPOINT_PX}px)`).matches;
  }
}
