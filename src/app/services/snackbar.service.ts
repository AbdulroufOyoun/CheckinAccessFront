import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';

export type SnackbarKind = 'success' | 'error' | 'warning';

export interface SnackbarMessage {
  id: number;
  kind: SnackbarKind;
  text: string;
  titleKey: string;
}

const DURATION_MS = 5600;
const WARNING_DURATION_MS = 9000;
const MAX_TOASTS = 4;

const KNOWN_MESSAGES: Record<string, { textKey: string; titleKey: string; kind: SnackbarKind }> = {
  'this tenant is currently inactive.': {
    textKey: 'TENANT_INACTIVE',
    titleKey: 'TOAST_TENANT_PAUSED',
    kind: 'warning',
  },
  'this tenant is currently inactive': {
    textKey: 'TENANT_INACTIVE',
    titleKey: 'TOAST_TENANT_PAUSED',
    kind: 'warning',
  },
};

@Injectable({ providedIn: 'root' })
export class SnackbarService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly translate = inject(TranslateService);
  private seq = 0;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly remaining = new Map<number, number>();
  private readonly startedAt = new Map<number, number>();
  private readonly messagesSignal = signal<SnackbarMessage[]>([]);

  readonly messages = this.messagesSignal.asReadonly();

  static isTenantInactive(message: unknown): boolean {
    const text = typeof message === 'string' ? message.trim().toLowerCase() : '';
    return text.includes('tenant is currently inactive');
  }

  show(message: string, type: SnackbarKind = 'success'): void {
    const raw = this.normalize(message);
    const known = KNOWN_MESSAGES[raw.toLowerCase()];
    const kind = known?.kind ?? type;
    const titleKey = known?.titleKey ?? (kind === 'success' ? 'TOAST_SUCCESS' : kind === 'warning' ? 'TOAST_WARNING' : 'TOAST_ERROR');
    const text = known ? this.translate.instant(known.textKey) : raw;
    const duration = kind === 'warning' ? WARNING_DURATION_MS : DURATION_MS;

    if (known?.titleKey === 'TOAST_TENANT_PAUSED') {
      const existing = this.messagesSignal().find((item) => item.titleKey === 'TOAST_TENANT_PAUSED');
      if (existing) {
        this.dismiss(existing.id);
      }
    }

    const id = ++this.seq;
    this.messagesSignal.update((list) => {
      const next = [...list, { id, kind, text, titleKey }];
      const overflow = next.slice(0, Math.max(0, next.length - MAX_TOASTS));
      overflow.forEach((item) => this.clearTimer(item.id));
      return next.slice(-MAX_TOASTS);
    });
    this.arm(id, duration);
  }

  dismiss(id: number): void {
    this.clearTimer(id);
    this.messagesSignal.update((list) => list.filter((item) => item.id !== id));
  }

  pause(id: number): void {
    const timer = this.timers.get(id);
    if (!timer) return;
    clearTimeout(timer);
    this.timers.delete(id);
    const started = this.startedAt.get(id) ?? Date.now();
    const left = (this.remaining.get(id) ?? DURATION_MS) - (Date.now() - started);
    this.remaining.set(id, Math.max(400, left));
  }

  resume(id: number): void {
    if (!this.messagesSignal().some((item) => item.id === id)) return;
    this.arm(id, this.remaining.get(id) ?? DURATION_MS);
  }

  private arm(id: number, ms: number): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.clearTimer(id);
    this.startedAt.set(id, Date.now());
    this.remaining.set(id, ms);
    this.timers.set(
      id,
      setTimeout(() => this.dismiss(id), ms),
    );
  }

  private clearTimer(id: number): void {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer);
    this.timers.delete(id);
    this.startedAt.delete(id);
    this.remaining.delete(id);
  }

  private normalize(message: string): string {
    if (typeof message === 'string' && message.trim()) return message.trim();
    if (message == null) return 'Unexpected error';
    try {
      return JSON.stringify(message);
    } catch {
      return 'Unexpected error';
    }
  }
}
