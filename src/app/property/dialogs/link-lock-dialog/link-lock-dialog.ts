import { ChangeDetectorRef, Component, Inject, OnInit, inject } from '@angular/core';

import { CommonModule, DOCUMENT } from '@angular/common';

import { FormsModule } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { LockableType, PropertyApiService, PropLock, lockLinkTotal } from '../../services/property-api.service';

import { SnackbarService } from '../../../services/snackbar.service';



export interface LinkLockDialogData {

  propertyType: LockableType;

  propertyId: number;

  /** Pre-loaded linked locks for this unit. */

  linked?: PropLock[];

  /** Full lock catalog when already cached; omit to load inside the dialog. */

  available?: PropLock[];

}



@Component({

  selector: 'app-link-lock-dialog',

  standalone: true,

  imports: [CommonModule, FormsModule, TranslateModule],

  templateUrl: './link-lock-dialog.html',

  styleUrl: './link-lock-dialog.css',

})

export class LinkLockDialog implements OnInit {

  private readonly dialogRef = inject(MatDialogRef<LinkLockDialog, boolean>);

  private readonly api = inject(PropertyApiService);

  private readonly snackbar = inject(SnackbarService);

  private readonly translate = inject(TranslateService);

  private readonly cdr = inject(ChangeDetectorRef);

  private readonly document = inject(DOCUMENT);



  isRTL = false;

  saving = false;

  loading = false;

  selectedIds: number[] = [];

  search = '';

  available: PropLock[] = [];

  readonly skelRows = [0, 1, 2, 3, 4];

  private linkedIdsSet = new Set<number>();



  constructor(@Inject(MAT_DIALOG_DATA) public data: LinkLockDialogData) {}



  ngOnInit(): void {

    this.isRTL =

      this.document.documentElement.getAttribute('dir') === 'rtl' ||

      this.translate.getCurrentLang() === 'ar';



    const linked = this.data.linked ?? [];

    this.available = [...(this.data.available ?? [])];

    this.linkedIdsSet = new Set(linked.map((l) => l.id));



    if (this.data.available !== undefined) {

      return;

    }



    void this.loadLocks();

  }



  /** Unlinked locks only — exclude locks attached to this or any other unit. */

  get pickable(): PropLock[] {

    return this.available.filter(

      (lock) => !this.linkedIdsSet.has(lock.id) && lockLinkTotal(lock) === 0,

    );

  }



  get filtered(): PropLock[] {

    const q = this.search.trim().toLowerCase();

    if (!q) return this.pickable;

    return this.pickable.filter((l) =>

      String(l.lockName || l.lockAlias || l.lockId || l.id).toLowerCase().includes(q),

    );

  }



  toggle(id: number): void {

    const i = this.selectedIds.indexOf(id);

    if (i >= 0) this.selectedIds.splice(i, 1);

    else this.selectedIds.push(id);

  }



  isChecked(id: number): boolean {

    return this.selectedIds.includes(id);

  }



  close(saved = false): void {

    if (this.saving) return;

    this.dialogRef.close(saved);

  }



  async save(): Promise<void> {

    if (this.saving || this.loading) return;

    this.saving = true;

    this.dialogRef.disableClose = true;

    try {

      const lockIds = [...new Set([...this.linkedIdsSet, ...this.selectedIds])];

      await this.api.syncLocks(this.data.propertyType, this.data.propertyId, lockIds);

      this.snackbar.show(this.translate.instant('PROP_LOCKS_UPDATED'), 'success');

      this.dialogRef.close(true);

    } catch (e: unknown) {

      const m = (e as { error?: { message?: string } })?.error?.message;

      this.snackbar.show(typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED'), 'error');

    } finally {

      this.saving = false;

      this.dialogRef.disableClose = false;

      this.cdr.detectChanges();

    }

  }



  private async loadLocks(): Promise<void> {

    this.loading = true;

    this.cdr.detectChanges();

    try {

      const [linked, available] = await Promise.all([

        this.api.getPropertyLocks(this.data.propertyType, this.data.propertyId),

        this.api.listLocks(),

      ]);

      this.available = available;

      this.linkedIdsSet = new Set(linked.map((l) => l.id));

    } catch (e: unknown) {

      const m = (e as { error?: { message?: string } })?.error?.message;

      this.snackbar.show(typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED'), 'error');

      this.dialogRef.close(false);

    } finally {

      this.loading = false;

      this.cdr.detectChanges();

    }

  }

}


