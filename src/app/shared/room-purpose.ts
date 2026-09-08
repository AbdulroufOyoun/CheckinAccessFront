export type RoomPurpose = 'accommodation' | 'lecture' | 'both';

export const ROOM_PURPOSE_OPTIONS: RoomPurpose[] = ['accommodation', 'lecture', 'both'];

export const ROOM_PURPOSE_I18N: Record<RoomPurpose, string> = {
  accommodation: 'ROOM_PURPOSE_ACCOMMODATION',
  lecture: 'ROOM_PURPOSE_LECTURE',
  both: 'ROOM_PURPOSE_BOTH',
};

export const ROOM_PURPOSE_HINT_I18N: Record<RoomPurpose, string> = {
  accommodation: 'ROOM_PURPOSE_ACCOMMODATION_HINT',
  lecture: 'ROOM_PURPOSE_LECTURE_HINT',
  both: 'ROOM_PURPOSE_BOTH_HINT',
};

export function roomPurposeTone(purpose: RoomPurpose | string | null | undefined): string {
  switch (purpose) {
    case 'accommodation':
      return 'housing';
    case 'lecture':
      return 'education';
    default:
      return 'shared';
  }
}
