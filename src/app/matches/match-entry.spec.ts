import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchEntry } from './match-entry';

describe('MatchEntry', () => {
  let component: MatchEntry;
  let fixture: ComponentFixture<MatchEntry>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatchEntry]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MatchEntry);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
