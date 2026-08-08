import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  forwardRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-time-picker',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './time-picker.html',
  styleUrl: './time-picker.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TimePicker),
      multi: true,
    },
  ],
})
export class TimePicker implements ControlValueAccessor, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() minuteStep = 5;
  @Input() placeholder = '--:--';
  @Input() invalid = false;

  open = false;
  disabled = false;
  value = '';
  draftHour = 9;
  draftMinute = 0;
  private ignoreDocClickUntil = 0;

  readonly hours = Array.from({ length: 24 }, (_, i) => i);
  minutes: number[] = [];

  private onChange: (v: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    this.rebuildMinutes();
  }

  get display(): string {
    return this.value || this.placeholder;
  }

  get formatPreview(): string {
    return this.format(this.draftHour, this.draftMinute);
  }

  pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  writeValue(value: string | null): void {
    this.value = value || '';
    this.syncDraftFromValue();
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }

  toggle(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.disabled) return;

    if (this.open) {
      this.close(false);
      return;
    }

    this.syncDraftFromValue();
    this.open = true;
    this.ignoreDocClickUntil = Date.now() + 250;
    this.cdr.detectChanges();
    queueMicrotask(() => this.scrollDraftIntoView());
  }

  selectHour(h: number, event?: Event): void {
    event?.stopPropagation();
    this.draftHour = h;
    this.cdr.detectChanges();
  }

  selectMinute(m: number, event?: Event): void {
    event?.stopPropagation();
    this.draftMinute = m;
    this.cdr.detectChanges();
  }

  confirm(event?: Event): void {
    event?.stopPropagation();
    this.value = this.format(this.draftHour, this.draftMinute);
    this.onChange(this.value);
    this.onTouched();
    this.open = false;
    this.cdr.detectChanges();
  }

  close(touched = true, event?: Event): void {
    event?.stopPropagation();
    this.open = false;
    if (touched) this.onTouched();
    this.cdr.detectChanges();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (!this.open || Date.now() < this.ignoreDocClickUntil) return;
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.open) this.close();
  }

  ngOnDestroy(): void {
    this.open = false;
  }

  private rebuildMinutes(): void {
    const step = Math.max(1, Math.min(30, this.minuteStep || 5));
    const list: number[] = [];
    for (let m = 0; m < 60; m += step) list.push(m);
    this.minutes = list;
  }

  private syncDraftFromValue(): void {
    const parsed = this.parse(this.value);
    this.draftHour = parsed?.h ?? 9;
    this.draftMinute = this.nearestMinute(parsed?.m ?? 0);
  }

  private nearestMinute(m: number): number {
    if (!this.minutes.length) return 0;
    let best = this.minutes[0];
    let dist = Math.abs(best - m);
    for (const option of this.minutes) {
      const d = Math.abs(option - m);
      if (d < dist) {
        best = option;
        dist = d;
      }
    }
    return best;
  }

  private parse(value: string): { h: number; m: number } | null {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value || '');
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return { h, m };
  }

  private format(h: number, m: number): string {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  private scrollDraftIntoView(): void {
    const root = this.host.nativeElement;
    const hourEl = root.querySelector(`.tp-col--hour [data-v="${this.draftHour}"]`) as HTMLElement | null;
    const minEl = root.querySelector(`.tp-col--min [data-v="${this.draftMinute}"]`) as HTMLElement | null;
    hourEl?.scrollIntoView({ block: 'center' });
    minEl?.scrollIntoView({ block: 'center' });
  }
}
