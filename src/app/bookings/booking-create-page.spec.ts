import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { BookingCreatePage } from './booking-create-page';
import { BookingsService } from '../services/bookings.service';
import { RoomStatusService, RoomStatusItem } from '../services/room-status.service';
import { UsersService } from '../services/users.service';
import { SnackbarService } from '../services/snackbar.service';
import { RealtimeService } from '../services/realtime.service';
import { DurationsService } from '../services/durations.service';

function room(id: number, capacity = 2): RoomStatusItem {
  return {
    id,
    number: String(100 + id),
    name: `Room ${id}`,
    capacity,
    status: 'available',
    active: true,
    blocked_by: null,
  } as RoomStatusItem;
}

describe('BookingCreatePage', () => {
  let component: BookingCreatePage;
  let fixture: ComponentFixture<BookingCreatePage>;
  let createSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    createSpy = vi.fn().mockResolvedValue({ success: true });

    await TestBed.configureTestingModule({
      imports: [BookingCreatePage, TranslateModule.forRoot()],
      providers: [
        {
          provide: Router,
          useValue: { navigate: vi.fn().mockResolvedValue(true) },
        },
        {
          provide: BookingsService,
          useValue: {
            validateAvailability: vi.fn().mockResolvedValue({
              data: { available: true, accessible_days: 5, blocked_dates: [], overlap_errors: [] },
            }),
            create: createSpy,
          },
        },
        {
          provide: RoomStatusService,
          useValue: {
            getFilterBuildings: vi.fn().mockResolvedValue([]),
            getAvailabilityForPeriod: vi.fn().mockResolvedValue({
              rooms: [],
              summary: { total: 0, available: 0, occupied: 0, inactive: 0 },
            }),
          },
        },
        {
          provide: UsersService,
          useValue: {
            list: vi.fn().mockResolvedValue({
              data: [{ id: 1, name: 'Guest', email: 'g@test.com', mobile: '0500000000' }],
            }),
          },
        },
        { provide: SnackbarService, useValue: { show: vi.fn() } },
        {
          provide: RealtimeService,
          useValue: { occupancyChanged: new Subject<void>() },
        },
        {
          provide: DurationsService,
          useValue: { list: vi.fn().mockResolvedValue({ data: [] }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BookingCreatePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('allows selecting multiple available rooms', () => {
    component.toggleRoom(room(1));
    component.toggleRoom(room(2));

    expect(component.selectedRoomCount).toBe(2);
    expect(component.isRoomSelected(1)).toBe(true);
    expect(component.isRoomSelected(2)).toBe(true);
    expect(component.canGoStep3).toBe(true);
    expect(component.roomCapacity).toBe(4);
  });

  it('deselects a room when toggled again', () => {
    const a = room(1);
    component.toggleRoom(a);
    component.toggleRoom(a);
    expect(component.selectedRoomCount).toBe(0);
    expect(component.canGoStep3).toBe(false);
  });

  it('submits one unit per selected room', async () => {
    component.periods = [{
      id: 'p-1',
      mode: 'full_day',
      check_in_date: component.today,
      check_out_date: component.today,
      start_time: '09:00',
      end_time: '17:00',
      weekends_included: true,
      gregorian_holidays_included: true,
      islamic_holidays_included: true,
      excluded_weekdays: [],
    }];
    component.toggleRoom(room(10));
    component.toggleRoom(room(11));
    component.occupants = [{ id: 1, name: 'Guest', email: 'g@test.com', mobile: '0500000000' }];

    await component.save();

    expect(createSpy).toHaveBeenCalled();
    const payload = createSpy.mock.calls[0][0];
    const units = payload.bookings[0].booking_periods[0].units.filter(
      (u: { unit_type: string; unit_id: number }) => u.unit_type === 'room',
    );
    expect(units.length).toBe(2);
    expect(units.map((u: { unit_id: number }) => u.unit_id).sort()).toEqual([10, 11]);
  });
});
