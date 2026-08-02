import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Testcom } from './testcom';

describe('Testcom', () => {
  let component: Testcom;
  let fixture: ComponentFixture<Testcom>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Testcom],
    }).compileComponents();

    fixture = TestBed.createComponent(Testcom);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
