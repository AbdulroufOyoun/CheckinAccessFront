import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoomDetailsDialog } from './room-details-dialog';

describe('RoomDetailsDialog', () => {
  let component: RoomDetailsDialog;
  let fixture: ComponentFixture<RoomDetailsDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoomDetailsDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(RoomDetailsDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
