import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoomGrid } from './room-grid';

describe('RoomGrid', () => {
  let component: RoomGrid;
  let fixture: ComponentFixture<RoomGrid>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoomGrid],
    }).compileComponents();

    fixture = TestBed.createComponent(RoomGrid);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
