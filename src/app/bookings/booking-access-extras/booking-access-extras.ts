import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { PropertyApiService } from '../../property/services/property-api.service';
import {
  BookingExtraOption,
  BookingExtraPick,
  BookingExtraUnitType,
  bookingExtraKey,
  keysFromPicks,
  picksFromKeys,
} from '../booking-extra-unit';

@Component({
  selector: 'app-booking-access-extras',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './booking-access-extras.html',
  styleUrl: './booking-access-extras.css',
})
export class BookingAccessExtras implements OnInit, OnChanges {
  private readonly propertyApi = inject(PropertyApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() selected: BookingExtraPick[] = [];
  @Input() compact = false;
  @Output() selectedChange = new EventEmitter<BookingExtraPick[]>();

  loading = true;
  tab: BookingExtraUnitType = 'gate';
  search = '';
  gates: BookingExtraOption[] = [];
  facilities: BookingExtraOption[] = [];
  parkings: BookingExtraOption[] = [];
  private selectedSet = new Set<string>();

  ngOnInit(): void {
    this.syncSelectedSet();
    void this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selected']) {
      this.syncSelectedSet();
    }
  }

  get filteredOptions(): BookingExtraOption[] {
    const list =
      this.tab === 'gate' ? this.gates : this.tab === 'facility' ? this.facilities : this.parkings;
    const q = this.search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) =>
      [o.name, o.meta, o.typeLabel].filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  }

  get selectedCount(): number {
    return this.selectedSet.size;
  }

  setTab(tab: BookingExtraUnitType): void {
    this.tab = tab;
    this.search = '';
  }

  isSelected(option: BookingExtraOption): boolean {
    return this.selectedSet.has(bookingExtraKey(option.unit_type, option.unit_id));
  }

  toggle(option: BookingExtraOption): void {
    const key = bookingExtraKey(option.unit_type, option.unit_id);
    if (this.selectedSet.has(key)) {
      this.selectedSet.delete(key);
    } else {
      this.selectedSet.add(key);
    }
    this.emitSelected();
  }

  removeKey(key: string): void {
    this.selectedSet.delete(key);
    this.emitSelected();
  }

  selectedOptions(): BookingExtraOption[] {
    const all = [...this.gates, ...this.facilities, ...this.parkings];
    return all.filter((o) => this.selectedSet.has(bookingExtraKey(o.unit_type, o.unit_id)));
  }

  typeBadge(option: BookingExtraOption): string {
    if (option.unit_type === 'gate') return 'BOOK_EXTRA_GATE';
    if (option.unit_type === 'facility') return 'BOOK_EXTRA_FACILITY';
    return 'BOOK_EXTRA_PARKING';
  }

  emptyKey(): string {
    if (this.tab === 'gate') return 'BOOK_ACCESS_NO_GATES';
    if (this.tab === 'facility') return 'BOOK_ACCESS_NO_FACILITIES';
    return 'BOOK_ACCESS_NO_PARKINGS';
  }

  private syncSelectedSet(): void {
    this.selectedSet = new Set(keysFromPicks(this.selected || []));
  }

  private emitSelected(): void {
    const all = [...this.gates, ...this.facilities, ...this.parkings];
    const next = all
      .filter((o) => this.selectedSet.has(bookingExtraKey(o.unit_type, o.unit_id)))
      .map((o) => ({
        unit_type: o.unit_type,
        unit_id: o.unit_id,
        name: o.name,
        typeLabel: o.typeLabel,
      }));
    this.selected = next;
    this.selectedChange.emit(next);
    this.cdr.detectChanges();
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      const tree = await this.propertyApi.loadTree({ allowStale: true });
      const buildingById = new Map(tree.buildings.map((b) => [b.id, b.name]));
      const compoundById = new Map(tree.compounds.map((c) => [c.id, c.name]));
      const typeById = new Map(tree.facilityTypes.map((t) => [t.id, t.name]));

      this.gates = (tree.gates || [])
        .map((g) => ({
          unit_type: 'gate' as const,
          unit_id: g.id,
          name: g.name,
          meta: buildingById.get(g.building_id) || compoundById.get(g.compound_id || 0) || '',
          typeLabel: g.direction || undefined,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      this.facilities = (tree.facilities || [])
        .filter((f) => f.active !== false)
        .map((f) => {
          const typeId = f.facilitie_type_id ?? f.facility_type_id;
          const typeName = typeId ? typeById.get(typeId) : undefined;
          const floor = tree.buildings
            .flatMap((b) => (b.floors || []).map((fl) => ({ ...fl, buildingName: b.name })))
            .find((fl) => fl.id === f.floor_id);
          return {
            unit_type: 'facility' as const,
            unit_id: f.id,
            name: f.name,
            meta: floor ? `${floor.buildingName} · ${floor.number}` : '',
            typeLabel: typeName,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      this.parkings = (tree.parkings || [])
        .map((p) => ({
          unit_type: 'parking' as const,
          unit_id: p.id,
          name: p.name,
          meta:
            buildingById.get(p.building_id || 0) ||
            compoundById.get(p.compound_id || 0) ||
            p.location ||
            '',
          typeLabel: p.capacity ? String(p.capacity) : undefined,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      this.gates = [];
      this.facilities = [];
      this.parkings = [];
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
}
