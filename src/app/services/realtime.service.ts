import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { environment } from '../../environments/environment';
import { Apiendpointd } from '../apiEndpoints';
import { AuthService } from './auth.service';

export interface OccupancyChangedPayload {
  reason: string;
  room_ids: number[];
  occupancy_version: string;
}

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly ngZone = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly occupancySubject = new Subject<OccupancyChangedPayload>();

  private echo: Echo<'reverb'> | null = null;
  private tenantId: string | null = null;
  private socketReady = false;

  readonly occupancyChanged: Observable<OccupancyChangedPayload> =
    this.occupancySubject.pipe(debounceTime(250));

  get connected(): boolean {
    return this.echo != null && this.tenantId != null;
  }

  /** True only after the WebSocket handshake succeeds. */
  get isLive(): boolean {
    return this.connected && this.socketReady;
  }

  connect(tenantId: string): void {
    if (!isPlatformBrowser(this.platformId) || !tenantId) {
      return;
    }
    if (this.echo && this.tenantId === tenantId && this.socketReady) {
      return;
    }

    this.disconnect();
    this.tenantId = tenantId;
    const token = this.auth.getToken();

    this.echo = new Echo({
      broadcaster: 'reverb',
      key: environment.reverb.key,
      wsHost: environment.reverb.host,
      wsPort: environment.reverb.port,
      wssPort: environment.reverb.port,
      forceTLS: environment.reverb.scheme === 'https',
      enabledTransports: ['ws', 'wss'],
      disableStats: true,
      cluster: 'mt1',
      Pusher,
      authEndpoint: Apiendpointd.broadcastingAuth,
      bearerToken: token,
      auth: {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          Accept: 'application/json',
        },
      },
      authorizer: (channel: { name: string }) => ({
        authorize: (
          socketId: string,
          callback: (error: Error | null, data: { auth: string } | null) => void,
        ) => {
          this.http
            .post<{ auth?: string; data?: { auth?: string } }>(Apiendpointd.broadcastingAuth, {
              socket_id: socketId,
              channel_name: channel.name,
            })
            .subscribe({
              next: (data) => {
                const auth = data?.auth || data?.data?.auth;
                if (!auth) {
                  callback(new Error('Channel auth missing'), null);
                  return;
                }
                callback(null, { auth });
              },
              error: (error: unknown) =>
                callback(error instanceof Error ? error : new Error('Channel auth failed'), null),
            });
        },
      }),
    });

    const pusher = this.echo.connector?.pusher as
      | { connection?: { bind: (event: string, cb: () => void) => void } }
      | undefined;
    pusher?.connection?.bind('connected', () => {
      this.socketReady = true;
    });
    pusher?.connection?.bind('disconnected', () => {
      this.socketReady = false;
    });
    pusher?.connection?.bind('unavailable', () => {
      this.socketReady = false;
    });

    const emit = (event: OccupancyChangedPayload | Record<string, unknown> | null) => {
      const payload = this.normalizePayload(event);
      this.ngZone.run(() => this.occupancySubject.next(payload));
    };

    this.echo
      .private(`tenant.${tenantId}.occupancy`)
      .listen('.occupancy.changed', emit)
      .listen('occupancy.changed', emit);
  }

  disconnect(): void {
    this.socketReady = false;
    if (this.echo && this.tenantId) {
      this.echo.leave(`tenant.${this.tenantId}.occupancy`);
    }
    this.echo?.disconnect();
    this.echo = null;
    this.tenantId = null;
  }

  affectsRoom(payload: OccupancyChangedPayload, roomId: number): boolean {
    if (!payload.room_ids.length) {
      return true;
    }
    return payload.room_ids.includes(roomId);
  }

  private normalizePayload(
    event: OccupancyChangedPayload | Record<string, unknown> | null,
  ): OccupancyChangedPayload {
    const raw = (event || {}) as Record<string, unknown>;
    const nested = (raw['data'] && typeof raw['data'] === 'object'
      ? (raw['data'] as Record<string, unknown>)
      : raw);
    const ids = nested['room_ids'];
    return {
      reason: String(nested['reason'] || raw['reason'] || 'occupancy.changed'),
      room_ids: Array.isArray(ids) ? ids.map((id) => Number(id)).filter((id) => id > 0) : [],
      occupancy_version: String(nested['occupancy_version'] || raw['occupancy_version'] || ''),
    };
  }
}
