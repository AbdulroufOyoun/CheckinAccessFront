import { Injectable } from '@angular/core';
import { User } from '../model/User';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor() { }

  saveUser(token: string, user: User): void {

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));

  }

  getToken(): string | null {

    return localStorage.getItem('token');

  }

  getUser(): User | null {

    const user = localStorage.getItem('user');

    if (!user) {
      return null;
    }

    return new User(JSON.parse(user));

  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

}
