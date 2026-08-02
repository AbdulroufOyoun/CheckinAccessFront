import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Testdr } from './testdr';

describe('Testdr', () => {
  let component: Testdr;
  let fixture: ComponentFixture<Testdr>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Testdr],
    }).compileComponents();

    fixture = TestBed.createComponent(Testdr);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
