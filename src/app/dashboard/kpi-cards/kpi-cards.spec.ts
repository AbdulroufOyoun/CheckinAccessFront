import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KpiCards } from './kpi-cards';

describe('KpiCards', () => {
  let component: KpiCards;
  let fixture: ComponentFixture<KpiCards>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KpiCards],
    }).compileComponents();

    fixture = TestBed.createComponent(KpiCards);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
