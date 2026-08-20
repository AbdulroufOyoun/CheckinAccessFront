import { describe, expect, it } from 'vitest';
import { incrementRoomNumber } from './room-number';

describe('incrementRoomNumber', () => {
  it('increments trailing digits and keeps padding', () => {
    expect(incrementRoomNumber('101', 0)).toBe('101');
    expect(incrementRoomNumber('101', 1)).toBe('102');
    expect(incrementRoomNumber('101', 4)).toBe('105');
    expect(incrementRoomNumber('001', 1)).toBe('002');
    expect(incrementRoomNumber('A01', 2)).toBe('A03');
  });

  it('appends the offset when there are no digits', () => {
    expect(incrementRoomNumber('A', 1)).toBe('A1');
    expect(incrementRoomNumber('', 3)).toBe('');
  });
});
