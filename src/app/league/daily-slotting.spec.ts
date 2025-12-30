import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DailySlotting } from './daily-slotting';

describe('DailySlotting', () => {
  let component: DailySlotting;
  let fixture: ComponentFixture<DailySlotting>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DailySlotting]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DailySlotting);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
