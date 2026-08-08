import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  constructor(private http: HttpClient) {}

  get<T = unknown>(url: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(url));
  }

  async post<T>(url: string, body: unknown = {}): Promise<T> {
    return await firstValueFrom(this.http.post<T>(url, body));
  }

  put<T = unknown>(url: string, body: unknown = {}): Promise<T> {
    return firstValueFrom(this.http.put<T>(url, body));
  }

  delete<T = unknown>(url: string): Promise<T> {
    return firstValueFrom(this.http.delete<T>(url));
  }

  deleteWithBody<T = unknown>(url: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.delete<T>(url, { body }));
  }
}
