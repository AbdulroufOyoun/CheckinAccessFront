import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor(private http: HttpClient) { }

  get(url: string) {
    return firstValueFrom(this.http.get(url));
  }

  async post<T>(url: string, body: any): Promise<T> {
    return await firstValueFrom(this.http.post<T>(url, body));
  }

  put(url: string, body: any) {
    return firstValueFrom(this.http.put(url, body));
  }

  delete(url: string) {
    return firstValueFrom(this.http.delete(url));
  }

}
