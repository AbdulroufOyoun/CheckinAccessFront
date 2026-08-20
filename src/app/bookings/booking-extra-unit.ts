export type BookingExtraUnitType = 'gate' | 'facility' | 'parking';

export interface BookingExtraPick {
  unit_type: BookingExtraUnitType;
  unit_id: number;
  name?: string;
  typeLabel?: string;
}

export interface BookingExtraOption extends BookingExtraPick {
  name: string;
  meta: string;
  typeLabel?: string;
}

export function bookingExtraKey(unitType: string, unitId: number): string {
  return `${unitType}:${unitId}`;
}

export function parseBookingExtraKey(key: string): BookingExtraPick | null {
  const [unit_type, id] = key.split(':');
  if ((unit_type !== 'gate' && unit_type !== 'facility' && unit_type !== 'parking') || !id) return null;
  const unit_id = Number(id);
  if (!Number.isFinite(unit_id)) return null;
  return { unit_type: unit_type as BookingExtraUnitType, unit_id };
}

export function picksFromKeys(keys: string[]): BookingExtraPick[] {
  return keys
    .map(parseBookingExtraKey)
    .filter((p): p is BookingExtraPick => p != null);
}

export function keysFromPicks(picks: BookingExtraPick[]): string[] {
  return picks.map((p) => bookingExtraKey(p.unit_type, p.unit_id));
}
