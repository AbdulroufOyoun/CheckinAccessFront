/** Increment the trailing digits of a room number, preserving a leading prefix and padding. */
export function incrementRoomNumber(start: string, offset: number): string {
  const s = String(start ?? '').trim();
  if (!s) {
    return '';
  }
  if (!offset) {
    return s;
  }
  const match = s.match(/^(.*?)(\d+)$/);
  if (!match) {
    return `${s}${offset}`;
  }
  const prefix = match[1];
  const digits = match[2];
  const next = String(Number(digits) + offset);
  return prefix + (next.length >= digits.length ? next : next.padStart(digits.length, '0'));
}

export interface RoomDraft {
  key: number;
  number: string;
  name: string;
  capacity: number;
  suite_id: number | null;
  room_type_id: number | null;
}
