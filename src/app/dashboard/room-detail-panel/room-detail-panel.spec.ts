import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoomDetailPanel } from './room-detail-panel';

describe('RoomDetailPanel', () => {
  let component: RoomDetailPanel;
  let fixture: ComponentFixture<RoomDetailPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoomDetailPanel],
    }).compileComponents();

    fixture = TestBed.createComponent(RoomDetailPanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
