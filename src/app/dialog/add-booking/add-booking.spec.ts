import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddBooking } from './add-booking';

describe('AddBooking', () => {
  let component: AddBooking;
  let fixture: ComponentFixture<AddBooking>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddBooking],
    }).compileComponents();

    fixture = TestBed.createComponent(AddBooking);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
