import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import {
  BookingScenario,
  BookingScenarioRoomOption,
  BookingScenarioRoomScope,
  BookingScenariosService,
} from '../../services/booking-scenarios.service';
import { LocaleService } from '../../services/locale.service';
import { SnackbarService } from '../../services/snackbar.service';
import { PageSkeleton } from '../../shared/page-skeleton/page-skeleton';

@Component({
  selector: 'app-booking-scenarios-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PageSkeleton],
  templateUrl: './booking-scenarios-page.html',
  styleUrl: './booking-scenarios-page.css',
})
export class BookingScenariosPage implements OnInit, OnDestroy {
  private readonly api = inject(BookingScenariosService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LocaleService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  isRTL = false;
  loading = true;
  saving = false;
  items: BookingScenario[] = [];
  roomOptions: BookingScenarioRoomOption[] = [];
  roomSearch = '';

  draft = {
    name: '',
    name_ar: '',
    room_scope: 'all' as BookingScenarioRoomScope,
    room_ids: [] as number[],
    sort_order: 0,
  };

  editingId: number | null = null;

  ngOnInit(): void {
    this.locale.observeLang(this.destroy$, (_lang, rtl) => {
      this.isRTL = rtl;
      this.cdr.detectChanges();
    });
    void this.reload();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get filteredRoomOptions(): BookingScenarioRoomOption[] {
    const q = this.roomSearch.trim().toLowerCase();
    if (!q) return this.roomOptions;
    return this.roomOptions.filter((r) => {
      const hay = [r.number, r.name, r.building, r.suite].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  scenarioLabel(row: BookingScenario): string {
    if (this.isRTL && row.name_ar?.trim()) return row.name_ar.trim();
    return row.name;
  }

  scopeLabel(scope: BookingScenarioRoomScope): string {
    return scope === 'all'
      ? this.translate.instant('BOOK_SC_SCOPE_ALL')
      : this.translate.instant('BOOK_SC_SCOPE_SELECTED');
  }

  roomsSummary(row: BookingScenario): string {
    if (row.room_scope === 'all') {
      return this.translate.instant('BOOK_SC_ALL_ROOMS');
    }
    const n = row.room_ids?.length ?? 0;
    return this.translate.instant('BOOK_SC_ROOMS_COUNT', { n });
  }

  isRoomPicked(id: number): boolean {
    return this.draft.room_ids.includes(id);
  }

  toggleRoom(id: number): void {
    if (this.draft.room_ids.includes(id)) {
      this.draft.room_ids = this.draft.room_ids.filter((x) => x !== id);
    } else {
      this.draft.room_ids = [...this.draft.room_ids, id];
    }
  }

  setScope(scope: BookingScenarioRoomScope): void {
    this.draft.room_scope = scope;
    if (scope === 'all') {
      this.draft.room_ids = [];
    }
  }

  async reload(): Promise<void> {
    this.loading = true;
    try {
      const [listRes, roomsRes] = await Promise.all([
        this.api.list(),
        this.api.roomOptions(),
      ]);
      this.items = listRes.data ?? [];
      this.roomOptions = roomsRes.data ?? [];
    } catch {
      this.snackbar.show(this.translate.instant('REQUEST_FAILED'), 'error');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  resetDraft(): void {
    this.editingId = null;
    this.draft = {
      name: '',
      name_ar: '',
      room_scope: 'all',
      room_ids: [],
      sort_order: 0,
    };
    this.roomSearch = '';
  }

  startEdit(row: BookingScenario): void {
    this.editingId = row.id;
    this.draft = {
      name: row.name,
      name_ar: row.name_ar ?? '',
      room_scope: row.room_scope,
      room_ids: [...(row.room_ids ?? [])],
      sort_order: row.sort_order ?? 0,
    };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async save(): Promise<void> {
    if (!this.draft.name.trim()) {
      this.snackbar.show(this.translate.instant('BOOK_SC_NAME_REQUIRED'), 'error');
      return;
    }
    if (this.draft.room_scope === 'selected' && !this.draft.room_ids.length) {
      this.snackbar.show(this.translate.instant('BOOK_SC_ROOMS_REQUIRED'), 'error');
      return;
    }

    this.saving = true;
    try {
      const body = {
        name: this.draft.name.trim(),
        name_ar: this.draft.name_ar.trim() || null,
        room_scope: this.draft.room_scope,
        room_ids: this.draft.room_scope === 'selected' ? [...this.draft.room_ids] : [],
        sort_order: this.draft.sort_order,
      };
      if (this.editingId) {
        await this.api.update(this.editingId, body);
        this.snackbar.show(this.translate.instant('BOOK_SC_UPDATED'), 'success');
      } else {
        await this.api.create(body);
        this.snackbar.show(this.translate.instant('BOOK_SC_CREATED'), 'success');
      }
      this.resetDraft();
      await this.reload();
    } catch {
      this.snackbar.show(this.translate.instant('REQUEST_FAILED'), 'error');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  async toggleActive(row: BookingScenario): Promise<void> {
    try {
      if (row.active) {
        await this.api.inactivate(row.id);
      } else {
        await this.api.activate(row.id);
      }
      await this.reload();
    } catch {
      this.snackbar.show(this.translate.instant('REQUEST_FAILED'), 'error');
    }
  }

  async remove(row: BookingScenario): Promise<void> {
    if (!confirm(this.translate.instant('BOOK_SC_DELETE_CONFIRM', { name: this.scenarioLabel(row) }))) {
      return;
    }
    try {
      await this.api.delete(row.id);
      this.snackbar.show(this.translate.instant('BOOK_SC_DELETED'), 'success');
      if (this.editingId === row.id) {
        this.resetDraft();
      }
      await this.reload();
    } catch {
      this.snackbar.show(this.translate.instant('REQUEST_FAILED'), 'error');
    }
  }

  roomOptionLabel(r: BookingScenarioRoomOption): string {
    const parts = [r.number, r.name, r.building].filter(Boolean);
    return parts.join(' · ');
  }
}
