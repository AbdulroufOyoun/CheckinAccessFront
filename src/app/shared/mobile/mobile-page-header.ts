import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-mobile-page-header',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <header class="mph">
      @if (eyebrowKey) {
        <p class="mph__eyebrow">{{ eyebrowKey | translate }}</p>
      }
      <div class="mph__row">
        <div class="mph__copy">
          <h1 class="mph__title">{{ titleKey | translate }}</h1>
          @if (subtitle) {
            <p class="mph__subtitle">{{ subtitle }}</p>
          }
        </div>
        <div class="mph__actions">
          <ng-content select="[mobileHeaderActions]" />
        </div>
      </div>
    </header>
  `,
  styles: [
    `
      .mph {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 12px;
      }
      .mph__eyebrow {
        margin: 0;
        font-size: 0.68rem;
        font-weight: 750;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--primary, #3b82f6);
      }
      .mph__row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      .mph__title {
        margin: 0;
        font-size: clamp(1.15rem, 4vw, 1.375rem);
        font-weight: 750;
        letter-spacing: -0.02em;
      }
      .mph__subtitle {
        margin: 4px 0 0;
        font-size: 0.84rem;
        color: var(--text-muted, #64748b);
      }
      .mph__actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
    `,
  ],
})
export class MobilePageHeader {
  @Input({ required: true }) titleKey!: string;
  @Input() eyebrowKey?: string;
  @Input() subtitle?: string;
}
