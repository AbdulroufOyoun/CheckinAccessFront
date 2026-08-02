import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FacilitiesManagement } from './facilities-management';

describe('FacilitiesManagement', () => {
  let component: FacilitiesManagement;
  let fixture: ComponentFixture<FacilitiesManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FacilitiesManagement],
    }).compileComponents();

    fixture = TestBed.createComponent(FacilitiesManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
