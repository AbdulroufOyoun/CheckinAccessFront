import { ChangeDetectorRef, Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LockableType, PropertyApiService, PropLock } from '../../services/property-api.service';
import { SnackbarService } from '../../../services/snackbar.service';

export interface LinkLockDialogData {
  propertyType: LockableType;
  propertyId: number;
  linked: PropLock[];
  available: PropLock[];
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
  selectedIds: number[] = [];
  search = '';
  private linkedIdsSet = new Set<number>();

  constructor(@Inject(MAT_DIALOG_DATA) public data: LinkLockDialogData) {}

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    this.linkedIdsSet = new Set(this.data.linked.map((l) => l.id));
  }

  /** Locks not already attached to this property — pick additional links only. */
  get pickable(): PropLock[] {
    return this.data.available.filter((lock) => !this.linkedIdsSet.has(lock.id));
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
    if (this.saving) return;
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
}
