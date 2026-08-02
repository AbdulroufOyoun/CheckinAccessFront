import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SmartAlerts } from './smart-alerts';

describe('SmartAlerts', () => {
  let component: SmartAlerts;
  let fixture: ComponentFixture<SmartAlerts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SmartAlerts],
    }).compileComponents();

    fixture = TestBed.createComponent(SmartAlerts);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
