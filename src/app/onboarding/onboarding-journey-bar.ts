import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

export type OnboardingJourneyPhase = 'welcome' | 'establishment' | 'property';

@Component({
  selector: 'app-onboarding-journey-bar',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './onboarding-journey-bar.html',
  styleUrl: './onboarding-journey-bar.css',
})
export class OnboardingJourneyBar {
  @Input() phase: OnboardingJourneyPhase = 'establishment';

  private readonly order: OnboardingJourneyPhase[] = ['welcome', 'establishment', 'property'];

  stepState(step: OnboardingJourneyPhase): 'done' | 'active' | 'upcoming' {
    const current = this.order.indexOf(this.phase);
    const idx = this.order.indexOf(step);
    if (idx < current) {
      return 'done';
    }
    if (idx === current) {
      return 'active';
    }
    return 'upcoming';
  }

  connectorDone(afterStep: OnboardingJourneyPhase): boolean {
    const current = this.order.indexOf(this.phase);
    const idx = this.order.indexOf(afterStep);
    return current > idx;
  }
}
