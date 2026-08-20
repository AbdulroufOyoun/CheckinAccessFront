import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { OccupancyChangedPayload, RealtimeService } from './realtime.service';
import { AuthService } from './auth.service';

describe('RealtimeService', () => {
  let service: RealtimeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { getToken: () => null } },
      ],
    });
    service = TestBed.inject(RealtimeService);
  });

  it('starts disconnected and disconnect is safe', () => {
    expect(service.connected).toBe(false);
    expect(service.isLive).toBe(false);
    expect(() => service.disconnect()).not.toThrow();
  });

  it('treats empty room_ids as affecting every room', () => {
    const payload: OccupancyChangedPayload = {
      reason: 'booking.created',
      room_ids: [],
      occupancy_version: '1',
    };
    expect(service.affectsRoom(payload, 12)).toBe(true);
  });

  it('matches a specific room id when the payload lists rooms', () => {
    const payload: OccupancyChangedPayload = {
      reason: 'booking.created',
      room_ids: [12, 15],
      occupancy_version: '1',
    };
    expect(service.affectsRoom(payload, 12)).toBe(true);
    expect(service.affectsRoom(payload, 99)).toBe(false);
  });
});
