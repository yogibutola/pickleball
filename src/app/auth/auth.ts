import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  dupr_rating: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private platformId = inject(PLATFORM_ID);
  private http = inject(HttpClient);

  // Signal to hold current user
  currentUser = signal<User | null>(null);

  constructor() {
    // Check local storage for persisted user (only in browser)
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem('pickleball_user');
      if (stored) {
        this.currentUser.set(JSON.parse(stored));
      }
    }
  }

  login(email: string, password: string): boolean {
    // Current sync login method (mock)
    // In a real app, this might be used if session is already valid
    return false;
  }

  signinObservable(email: string, password: string): Observable<boolean> {
    const payload = { email, password };
    console.log('Sending signin request:', payload);

    return this.http.post<any>('api/v1/signin', payload).pipe(
      tap((response) => {
        console.log('Signin successful:', response);

        const user: User = {
          id: response.id || crypto.randomUUID(),
          firstName: response.firstName || '',
          lastName: response.lastName || '',
          userName: response.userName || '',
          email: response.email || email,
          dupr_rating: response.dupr_rating || 0
        };

        this.currentUser.set(user);

        if (isPlatformBrowser(this.platformId)) {
          localStorage.setItem('pickleball_user', JSON.stringify(user));
        }
      }),
      map(() => true),
      catchError((err) => {
        console.error('Signin error:', err);
        let errorMessage = 'Login failed. Please check your credentials.';
        if (err.error?.detail) {
          if (typeof err.error.detail === 'string') {
            errorMessage = err.error.detail;
          } else if (Array.isArray(err.error.detail)) {
            errorMessage = err.error.detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ');
          }
        }
        alert('Error during signin: ' + errorMessage);
        return of(false);
      })
    );
  }

  signup(firstName: string, lastName: string, email: string, password: string, duprRating: number) {
    // Generate username from first and last name
    const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;

    // Prepare payload for backend
    const signupPayload = {
      firstName: firstName,
      lastName: lastName,
      userName: username,
      email: email,
      password: password.slice(0, 72), // Truncate to 72 bytes for bcrypt
      dupr_rating: duprRating
    };

    console.log('Sending signup request:', signupPayload);

    // Call backend API
    this.http.post<any>('api/v1/signup', signupPayload).subscribe({
      next: (response) => {
        console.log('Signup successful:', response);

        // Create user object from response
        const user: User = {
          id: response.id || crypto.randomUUID(),
          firstName: firstName,
          lastName: lastName,
          userName: username,
          email,
          dupr_rating: duprRating
        };

        // Update current user
        this.currentUser.set(user);

        // Persist to localStorage
        if (isPlatformBrowser(this.platformId)) {
          localStorage.setItem('pickleball_user', JSON.stringify(user));
        }
      },
      error: (err) => {
        console.error('Signup error:', err);

        // Handle error detail which might be an array of objects
        let errorMessage = 'Unknown error occurred';

        if (err.error?.detail) {
          if (Array.isArray(err.error.detail)) {
            // If detail is an array of error objects, extract field names and messages
            errorMessage = err.error.detail
              .map((e: any) => {
                const msg = e.msg || e.message || 'Error';
                // Extract field name from loc array (e.g., ["body", "field_name"])
                const field = e.loc && e.loc.length > 0 ? e.loc[e.loc.length - 1] : null;
                return field ? `${field}: ${msg}` : msg;
              })
              .join(', ');
          } else if (typeof err.error.detail === 'string') {
            errorMessage = err.error.detail;
          } else if (typeof err.error.detail === 'object') {
            errorMessage = JSON.stringify(err.error.detail);
          }
        } else if (err.statusText) {
          errorMessage = err.statusText;
        }

        alert('Error during signup: ' + errorMessage);
      }
    });

    return true;
  }

  // Observable-based signup that returns result for proper async handling
  signupObservable(firstName: string, lastName: string, email: string, password: string, duprRating: number): Observable<boolean> {
    const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;

    const signupPayload = {
      firstName: firstName,
      lastName: lastName,
      userName: username,
      email: email,
      password: password,
      dupr_rating: duprRating
    };

    console.log('Sending signup request:', signupPayload);

    return this.http.post<any>('api/v1/signup', signupPayload).pipe(
      tap((response) => {
        console.log('Signup successful:', response);

        const user: User = {
          id: response.id || crypto.randomUUID(),
          firstName: firstName,
          lastName: lastName,
          userName: username,
          email,
          dupr_rating: duprRating
        };

        this.currentUser.set(user);

        if (isPlatformBrowser(this.platformId)) {
          localStorage.setItem('pickleball_user', JSON.stringify(user));
        }
      }),
      map(() => true),
      catchError((err) => {
        console.error('Signup error:', err);

        // Handle error detail which might be an array of objects
        let errorMessage = 'Unknown error occurred';

        if (err.error?.detail) {
          if (Array.isArray(err.error.detail)) {
            // If detail is an array of error objects, extract field names and messages
            errorMessage = err.error.detail
              .map((e: any) => {
                const msg = e.msg || e.message || 'Error';
                // Extract field name from loc array (e.g., ["body", "field_name"])
                const field = e.loc && e.loc.length > 0 ? e.loc[e.loc.length - 1] : null;
                return field ? `${field}: ${msg}` : msg;
              })
              .join(', ');
          } else if (typeof err.error.detail === 'string') {
            errorMessage = err.error.detail;
          } else if (typeof err.error.detail === 'object') {
            errorMessage = JSON.stringify(err.error.detail);
          }
        } else if (err.statusText) {
          errorMessage = err.statusText;
        }

        alert('Error during signup: ' + errorMessage);
        return of(false);
      })
    );
  }

  logout() {
    this.currentUser.set(null);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('pickleball_user');
    }
  }

  isLoggedIn() {
    return this.currentUser() !== null;
  }
}
