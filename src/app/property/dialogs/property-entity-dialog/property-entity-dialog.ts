import { ChangeDetectorRef, Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  PropNodeType,
  PropType,
  PropertyApiService,
} from '../../services/property-api.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { ApiResponse } from '../../../interfaces/api-response';

export interface PropertyEntityDialogData {
  entity: PropNodeType;
  mode: 'add' | 'edit';
  item?: Record<string, unknown>;
  parent?: {
    compound_id?: number;
    building_id?: number;
    floor_id?: number;
    suite_id?: number;
  };
  roomTypes?: PropType[];
  facilityTypes?: PropType[];
  compounds?: Array<{ id: number; name: string }>;
  buildings?: Array<{ id: number; name: string; compound_id?: number | null }>;
  suites?: Array<{ id: number; name?: string; number?: string; floor_id?: number }>;
}

@Component({
  selector: 'app-property-entity-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './property-entity-dialog.html',
  styleUrl: './property-entity-dialog.css',
})
export class PropertyEntityDialog implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<PropertyEntityDialog, boolean>);
  private readonly api = inject(PropertyApiService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);

  isRTL = false;
  saving = false;
  creatingType = false;
  form: Record<string, unknown> = {};

  roomTypes: PropType[] = [];
  facilityTypes: PropType[] = [];
  suites: Array<{ id: number; name?: string; number?: string; floor_id?: number }> = [];
  showNewRoomType = false;
  showNewFacilityType = false;
  newRoomTypeName = '';
  newFacilityTypeName = '';

  constructor(@Inject(MAT_DIALOG_DATA) public data: PropertyEntityDialogData) {}

  ngOnInit(): void {
    this.isRTL = this.document.documentElement.getAttribute('dir') === 'rtl'
      || this.translate.getCurrentLang() === 'ar';
    this.form = { ...(this.data.item || {}) };
    this.roomTypes = [...(this.data.roomTypes || [])];
    this.facilityTypes = [...(this.data.facilityTypes || [])];
    this.suites = [...(this.data.suites || [])];
    const p = this.data.parent || {};
    if (p.compound_id) this.form['compound_id'] = p.compound_id;
    if (p.building_id) this.form['building_id'] = p.building_id;
    if (p.floor_id) this.form['floor_id'] = p.floor_id;
    if (p.suite_id) this.form['suite_id'] = p.suite_id;

    if (this.data.entity === 'building' && this.data.mode === 'add') {
      this.form['createFloors'] = false;
      this.form['numberFloor'] = 1;
      this.form['numberOfFloor'] = 1;
    }
    if (this.data.entity === 'gate' && this.data.mode === 'add' && !this.form['direction']) {
      this.form['direction'] = 'both';
    }
    if (this.data.entity === 'room' && this.data.mode === 'add' && this.form['capacity'] == null) {
      this.form['capacity'] = 1;
    }
    if (this.data.entity === 'room' && !this.roomTypes.length) {
      this.showNewRoomType = true;
    }
    if (this.data.entity === 'facility' && !this.facilityTypes.length) {
      this.showNewFacilityType = true;
    }
  }

  get titleKey(): string {
    const e = this.data.entity.toUpperCase();
    return this.data.mode === 'edit' ? `PROP_EDIT_${e}` : `PROP_ADD_${e}`;
  }

  get preview(): string {
    const name = String(this.form['name'] || this.form['number'] || this.form['lockName'] || '—');
    return name;
  }

  close(saved = false): void {
    if (this.saving || this.creatingType) return;
    this.dialogRef.close(saved);
  }

  async createRoomTypeInline(): Promise<void> {
    const name = this.newRoomTypeName.trim();
    if (!name || this.creatingType) return;
    this.creatingType = true;
    try {
      const res = await this.api.createRoomType({ name });
      const created = this.unwrapCreated(res);
      if (created) {
        this.roomTypes = [...this.roomTypes, created];
        this.form['room_type_id'] = created.id;
        this.newRoomTypeName = '';
        this.showNewRoomType = false;
        this.snackbar.show(this.translate.instant('PROP_TYPE_CREATED'), 'success');
      }
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.creatingType = false;
      this.cdr.detectChanges();
    }
  }

  async createFacilityTypeInline(): Promise<void> {
    const name = this.newFacilityTypeName.trim();
    if (!name || this.creatingType) return;
    this.creatingType = true;
    try {
      const res = await this.api.createFacilityType({ name });
      const created = this.unwrapCreated(res);
      if (created) {
        this.facilityTypes = [...this.facilityTypes, created];
        this.form['facilitie_type_id'] = created.id;
        this.newFacilityTypeName = '';
        this.showNewFacilityType = false;
        this.snackbar.show(this.translate.instant('PROP_TYPE_CREATED'), 'success');
      }
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.creatingType = false;
      this.cdr.detectChanges();
    }
  }

  private unwrapCreated(res: unknown): PropType | null {
    const data = (res as ApiResponse<PropType | { data?: PropType }>)?.data;
    if (data && typeof data === 'object' && 'id' in data && 'name' in data) {
      return data as PropType;
    }
    if (data && typeof data === 'object' && 'data' in data) {
      const inner = (data as { data?: PropType }).data;
      if (inner?.id) return inner;
    }
    return null;
  }

  private err(e: unknown): string {
    const m = (e as { error?: { message?: string } })?.error?.message;
    return typeof m === 'string' ? m : this.translate.instant('REQUEST_FAILED');
  }

  async save(): Promise<void> {
    if (this.saving || this.creatingType) return;

    if (this.data.entity === 'room' && !this.form['room_type_id']) {
      this.snackbar.show(this.translate.instant('PROP_ROOM_TYPE_REQUIRED'), 'error');
      this.showNewRoomType = true;
      return;
    }
    if (this.data.entity === 'facility' && !this.form['facilitie_type_id']) {
      this.snackbar.show(this.translate.instant('PROP_FACILITY_TYPE_REQUIRED'), 'error');
      this.showNewFacilityType = true;
      return;
    }

    this.saving = true;
    this.dialogRef.disableClose = true;
    try {
      await this.persist();
      this.snackbar.show(this.translate.instant('PROP_SAVED'), 'success');
      this.dialogRef.close(true);
    } catch (e: unknown) {
      this.snackbar.show(this.err(e), 'error');
    } finally {
      this.saving = false;
      this.dialogRef.disableClose = false;
      this.cdr.detectChanges();
    }
  }

  private async persist(): Promise<void> {
    const e = this.data.entity;
    const edit = this.data.mode === 'edit';
    const id = Number(this.form['id']);

    switch (e) {
      case 'compound':
        if (edit) await this.api.updateCompound(id, { name: String(this.form['name']), number: String(this.form['number']) });
        else await this.api.createCompound({ name: String(this.form['name']), number: String(this.form['number']) });
        break;
      case 'building': {
        if (edit) {
          await this.api.updateBuilding({
            id,
            name: this.form['name'],
            number: this.form['number'],
          });
        } else {
          const body: Record<string, unknown> = {
            name: this.form['name'],
            number: this.form['number'],
          };
          if (this.form['compound_id']) {
            body['compound_id'] = Number(this.form['compound_id']);
          }
          if (this.form['createFloors']) {
            body['numberFloor'] = Number(this.form['numberFloor']) || 1;
            body['numberOfFloor'] = Number(this.form['numberOfFloor']) || 1;
          }
          await this.api.createBuilding(body);
        }
        break;
      }
      case 'floor':
        if (edit) await this.api.updateFloor({ id, number: String(this.form['number']) });
        else await this.api.createFloor({ building_id: Number(this.form['building_id']), number: this.form['number'] as string | number });
        break;
      case 'suite':
        if (edit) {
          await this.api.updateSuite(id, {
            floor_id: Number(this.form['floor_id']),
            number: String(this.form['number']),
            name: String(this.form['name']),
          });
        } else {
          await this.api.createSuite({
            floor_id: Number(this.form['floor_id']),
            number: String(this.form['number']),
            name: String(this.form['name']),
          });
        }
        break;
      case 'room': {
        const body: Record<string, unknown> = {
          number: this.form['number'],
          name: this.form['name'] || null,
          capacity: Number(this.form['capacity']) || 1,
          room_type_id: Number(this.form['room_type_id']),
          floor_id: this.form['floor_id'] ? Number(this.form['floor_id']) : null,
          suite_id: this.form['suite_id'] ? Number(this.form['suite_id']) : null,
          building_id: this.form['building_id'] ? Number(this.form['building_id']) : null,
        };
        if (edit) await this.api.updateRoom(id, body);
        else await this.api.createRoom(body);
        break;
      }
      case 'facility':
        if (edit) {
          await this.api.updateFacility(id, {
            name: this.form['name'],
            floor_id: Number(this.form['floor_id']),
            facilitie_type_id: Number(this.form['facilitie_type_id']),
          });
        } else {
          await this.api.createFacility({
            name: String(this.form['name']),
            floor_id: Number(this.form['floor_id']),
            facilitie_type_id: Number(this.form['facilitie_type_id']),
          });
        }
        break;
      case 'gate':
        if (edit) {
          await this.api.updateGate(id, {
            name: this.form['name'],
            direction: this.form['direction'],
            building_id: Number(this.form['building_id']),
            compound_id: Number(this.form['compound_id']),
          });
        } else {
          await this.api.createGate({
            name: this.form['name'],
            direction: this.form['direction'],
            building_id: Number(this.form['building_id']),
            compound_id: Number(this.form['compound_id']),
          });
        }
        break;
      case 'parking':
        if (edit) {
          await this.api.updateParking(id, {
            name: this.form['name'],
            location: this.form['location'],
            capacity: Number(this.form['capacity']),
            building_id: this.form['building_id'] || null,
            compound_id: this.form['compound_id'] || null,
          });
        } else {
          await this.api.createParking({
            name: this.form['name'],
            location: this.form['location'],
            capacity: Number(this.form['capacity']),
            building_id: this.form['building_id'] || null,
            compound_id: this.form['compound_id'] || null,
          });
        }
        break;
      case 'elevator':
        if (edit) {
          await this.api.updateElevator(id, {
            name: this.form['name'],
            capacity: Number(this.form['capacity']),
            building_id: Number(this.form['building_id']),
          });
        } else {
          await this.api.createElevator({
            name: this.form['name'],
            capacity: Number(this.form['capacity']),
            building_id: Number(this.form['building_id']),
          });
        }
        break;
      case 'room_type':
        if (edit) await this.api.updateRoomType(id, { name: String(this.form['name']) });
        else await this.api.createRoomType({ name: String(this.form['name']) });
        break;
      case 'facility_type':
        if (edit) await this.api.updateFacilityType(id, { name: String(this.form['name']) });
        else await this.api.createFacilityType({ name: String(this.form['name']) });
        break;
    }
  }
}
