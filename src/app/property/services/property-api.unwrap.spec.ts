import { describe, expect, it } from 'vitest';
import { unwrapEntityList, lockLinkTotal } from './property-api.service';

describe('unwrapEntityList', () => {
  it('returns a bare array', () => {
    expect(unwrapEntityList([{ id: 1 }])).toEqual([{ id: 1 }]);
  });

  it('returns envelope data when it is an array', () => {
    expect(unwrapEntityList({ success: true, data: [{ id: 2 }] })).toEqual([{ id: 2 }]);
  });

  it('returns paginated data.data', () => {
    expect(unwrapEntityList({ data: { current_page: 1, data: [{ id: 3 }] } })).toEqual([{ id: 3 }]);
  });

  it('returns property-lock data.locks so linked room locks are visible', () => {
    expect(
      unwrapEntityList({
        success: true,
        data: {
          property_type: 'room',
          property_id: 9,
          count: 1,
          locks: [{ id: 4, lockName: 'Room 101' }],
        },
      }),
    ).toEqual([{ id: 4, lockName: 'Room 101' }]);
  });

  it('returns an empty list when locks are missing', () => {
    expect(unwrapEntityList({ data: { property_type: 'room', count: 0 } })).toEqual([]);
  });
});

describe('lockLinkTotal', () => {
  it('treats a lock with any pivot count as already linked', () => {
    expect(lockLinkTotal({})).toBe(0);
    expect(lockLinkTotal({ rooms_count: 1 })).toBe(1);
    expect(lockLinkTotal({ buildings_count: 1, rooms_count: 1 })).toBe(2);
  });
});
