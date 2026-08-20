import { ChangeDetectorRef, Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  LockableType,
  PropBuilding,
  PropFacility,
  PropRoom,
  PropTreeSnapshot,
  PropertyApiService,
} from '../../services/property-api.service';
import { SnackbarService } from '../../../services/snackbar.service';

export interface LinkEntitiesToLockDialogData {
  lockId: number;
  tree: PropTreeSnapshot;
  linkedBuildings: number[];
  linkedRooms: number[];
  linkedFacilities: number[];
}

interface EntityOption {
  type: LockableType;
  id: number;
  label: string;
  sublabel?: string;
}

interface SingleSelection {
  type: LockableType;
  id: number;
}

@Component({
  selector: 'app-link-entities-to-lock-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './link-entities-to-lock-dialog.html',
  styleUrl: './link-entities-to-lock-dialog.css',
})
export class LinkEntitiesToLockDialog implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<LinkEntitiesToLockDialog, boolean>);
  private readonly api = inject(PropertyApiService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);

  isRTL = false;
  saving = false;
  search = '';
  selectedTab: 'buildings' | 'rooms' | 'facilities' = 'buildings';

  buildings: EntityOption[] = [];
  rooms: EntityOption[] = [];
  facilities: EntityOption[] = [];

  selected: SingleSelection | null = null;

  constructor(@Inject(MAT_DIALOG_DATA) public data: LinkEntitiesToLockDialogData) {}

  ngOnInit(): void {
    this.isRTL =
      this.document.documentElement.getAttribute('dir') === 'rtl' ||
      this.translate.getCurrentLang() === 'ar';
    if (this.data.linkedBuildings?.length) {
      this.selected = { type: 'building', id: this.data.linkedBuildings[0] };
      this.selectedTab = 'buildings';
    } else if (this.data.linkedRooms?.length) {
      this.selected = { type: 'room', id: this.data.linkedRooms[0] };
      this.selectedTab = 'rooms';
    } else if (this.data.linkedFacilities?.length) {
      this.selected = { type: 'facility', id: this.data.linkedFacilities[0] };
      this.selectedTab = 'facilities';
    }
    this.buildEntityLists();
  }

  private buildEntityLists(): void {
    const tree = this.data.tree;

    this.buildings = (tree.buildings || []).map((b: PropBuilding) => ({
      type: 'building',
      id: b.id,
      label: b.name,
      sublabel: b.number ? `#${b.number}` : undefined,
    }));

    const roomsOut: EntityOption[] = [];
    for (const b of tree.buildings || []) {
      for (const f of b.floors || []) {
        for (const r of f.rooms || []) {
          roomsOut.push({
            type: 'room',
            id: r.id,
            label: r.name || `Room ${r.number}`,
            sublabel: `${b.name} · Floor ${f.number}`,
          });
        }
        for (const s of f.suites || []) {
          for (const r of s.rooms || []) {
            roomsOut.push({
              type: 'room',
              id: r.id,
              label: r.name || `Room ${r.number}`,
              sublabel: `${b.name} · Suite ${s.number}`,
            });
          }
        }
      }
    }
    this.rooms = roomsOut;

    this.facilities = (tree.facilities || []).map((f: PropFacility) => ({
      type: 'facility',
      id: f.id,
      label: f.name,
    }));
  }

  get filteredBuildings(): EntityOption[] {
    return this.filterList(this.buildings);
  }
  get filteredRooms(): EntityOption[] {
    return this.filterList(this.rooms);
  }
  get filteredFacilities(): EntityOption[] {
    return this.filterList(this.facilities);
  }

  private filterList(list: EntityOption[]): EntityOption[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        (e.sublabel || '').toLowerCase().includes(q) ||
        String(e.id).includes(q)
    );
  }

  select(type: LockableType, id: number): void {
    const existing = this.existingLink;
    if (existing && (existing.type !== type || existing.id !== id)) {
      this.snackbar.show(this.translate.instant('LOCKS_UNLINK_BEFORE_RELINK'), 'error');
      return;
    }
    if (this.selected && this.selected.type === type && this.selected.id === id) {
      this.selected = null;
      return;
    }
    this.selected = { type, id };
  }

  private get existingLink(): SingleSelection | null {
    if (this.data.linkedBuildings?.length) {
      return { type: 'building', id: this.data.linkedBuildings[0] };
    }
    if (this.data.linkedRooms?.length) {
      return { type: 'room', id: this.data.linkedRooms[0] };
    }
    if (this.data.linkedFacilities?.length) {
      return { type: 'facility', id: this.data.linkedFacilities[0] };
    }
    return null;
  }

  isSelected(type: LockableType, id: number): boolean {
    return this.selected?.type === type && this.selected?.id === id;
  }

  setTab(tab: 'buildings' | 'rooms' | 'facilities'): void {
    this.selectedTab = tab;
  }

  get totalSelected(): number {
    return this.selected ? 1 : 0;
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
      const lockId = this.data.lockId;
      const prev: Array<{ type: LockableType; id: number }> = [];
      (this.data.linkedBuildings || []).forEach((id) => prev.push({ type: 'building', id }));
      (this.data.linkedRooms || []).forEach((id) => prev.push({ type: 'room', id }));
      (this.data.linkedFacilities || []).forEach((id) => prev.push({ type: 'facility', id }));

      if (
        prev.length &&
        this.selected &&
        !prev.some((p) => p.type === this.selected!.type && p.id === this.selected!.id)
      ) {
        this.snackbar.show(this.translate.instant('LOCKS_UNLINK_BEFORE_RELINK'), 'error');
        return;
      }

      for (const { type, id } of prev) {
        if (!this.selected || !(this.selected.type === type && this.selected.id === id)) {
          await this.api.unlinkLock(type, id, lockId);
        }
      }

      if (this.selected) {
        const alreadyLinked = prev.some(
          (p) => p.type === this.selected!.type && p.id === this.selected!.id
        );
        if (!alreadyLinked) {
          const existing = await this.api.getPropertyLocks(this.selected.type, this.selected.id);
          const ids = existing.map((l) => l.id);
          if (!ids.includes(lockId)) ids.push(lockId);
          await this.api.syncLocks(this.selected.type, this.selected.id, ids);
        }
      }

      this.snackbar.show(this.translate.instant('LOCKS_LINKS_UPDATED'), 'success');
      this.dialogRef.close(true);
    } catch (e: unknown) {
      const m = (e as { error?: { message?: string } })?.error?.message;
      this.snackbar.show(
        typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED'),
        'error'
      );
    } finally {
      this.saving = false;
      this.dialogRef.disableClose = false;
      this.cdr.detectChanges();
    }
  }
}
