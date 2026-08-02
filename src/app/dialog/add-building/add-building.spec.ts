import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddBuilding } from './add-building';

describe('AddBuilding', () => {
  let component: AddBuilding;
  let fixture: ComponentFixture<AddBuilding>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddBuilding],
    }).compileComponents();

    fixture = TestBed.createComponent(AddBuilding);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
