import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BookingsService } from '../../services/bookings.service';
import { PropertyApiService, PropLock } from '../../property/services/property-api.service';
import { SnackbarService } from '../../services/snackbar.service';

export interface AssignBookingLocksData {
  bookingId: number;
  guestName: string;
}

@Component({
  selector: 'app-assign-booking-locks',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, TranslateModule],
  templateUrl: './assign-booking-locks.html',
  styleUrl: './assign-booking-locks.css',
})
export class AssignBookingLocksDialog implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<AssignBookingLocksDialog, boolean>);
  private readonly data = inject<AssignBookingLocksData>(MAT_DIALOG_DATA);
  private readonly bookings = inject(BookingsService);
  private readonly property = inject(PropertyApiService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);

  loading = true;
  saving = false;
  locks: PropLock[] = [];
  selected = new Set<number>();
  assigned = new Set<number>();

  get bookingId(): number {
    return this.data.bookingId;
  }

  get guestName(): string {
    return this.data.guestName;
  }

  async ngOnInit(): Promise<void> {
    try {
      const [allLocks, bookingRes] = await Promise.all([
        this.property.listLocks(),
        this.bookings.show(this.bookingId),
      ]);
      this.locks = allLocks || [];
      const current = bookingRes.data?.locks || [];
      this.assigned = new Set(current.map((l) => l.id));
      this.selected = new Set(this.assigned);
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  toggle(id: number): void {
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
  }

  isChecked(id: number): boolean {
    return this.selected.has(id);
  }

  lockLabel(lock: PropLock): string {
    return lock.lockAlias || lock.lockName || lock.lockMac || `#${lock.id}`;
  }

  async save(): Promise<void> {
    this.saving = true;
    try {
      const next = Array.from(this.selected);
      const toAdd = next.filter((id) => !this.assigned.has(id));
      const toRemove = Array.from(this.assigned).filter((id) => !this.selected.has(id));

      if (toAdd.length) {
        await this.bookings.assignLocks(this.bookingId, toAdd);
      }
      if (toRemove.length) {
        await this.bookings.removeLocks(this.bookingId, toRemove);
      }

      this.snackbar.show(this.translate.instant('BOOK_LOCKS_SAVED'), 'success');
      this.dialogRef.close(true);
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  close(): void {
    this.dialogRef.close(false);
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string } })?.error?.message;
    if (typeof m === 'string' && m) return m;
    if (e && typeof e === 'object' && 'message' in e) return String((e as { message: string }).message);
    return this.translate.instant('BOOK_LOCKS_FAILED');
  }
}
