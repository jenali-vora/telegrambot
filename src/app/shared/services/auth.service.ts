// src/app/shared/services/auth.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment'; // Ensure this path is correct

// --- Interfaces ---
export interface User {
  id?: string;
  email: string;
  username?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  message?: string;
}

export interface RegistrationResponse {
  message: string;
  user?: {
    username: string;
    email: string;
  };
}
// --- End of Interfaces ---

const AUTH_TOKEN_KEY = 'authToken';
const CURRENT_USER_KEY = 'currentUser';
const ANONYMOUS_UPLOAD_ID_KEY = 'anonymousClientUploadId'; // Key for anonymous ID

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(this.loadInitialUser());
  public currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();
  public isLoggedIn$: Observable<boolean> = this.currentUser$.pipe(
    map(user => !!user && !!this.getToken())
  );

  private readonly baseApiUrl = environment.apiUrl;
  private loginUrl = `${this.baseApiUrl}/api/auth/login`;
  private registerUrl = `${this.baseApiUrl}/register`; // Matches Python route

  private http = inject(HttpClient);
  private router = inject(Router);

  constructor() {
    console.log('AuthService initialized.');
    console.log('Register URL configured:', this.registerUrl);
    console.log('Login URL configured:', this.loginUrl);
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public get currentUsername(): string | null {
    const user = this.currentUserSubject.value;
    return user?.username ?? user?.email ?? null;
  }

  login(credentials: { email: string, password: string }): Observable<LoginResponse> {
    console.log(`AuthService: Attempting login for ${credentials.email} via ${this.loginUrl}`);
    return this.http.post<LoginResponse>(this.loginUrl, credentials).pipe(
      tap(response => {
        if (response?.user && response?.token) {
          this.storeUserData(response.user, response.token);
          this.currentUserSubject.next(response.user);
          // Clear anonymous ID on successful login
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(ANONYMOUS_UPLOAD_ID_KEY);
          }
          console.log('AuthService: Login successful for:', response.user.email, '(Username:', response.user.username || 'N/A', ')');
        } else {
          console.error("AuthService: Invalid login response structure received:", response);
          throw new Error('Invalid login response structure from server.');
        }
      }),
      catchError(this.handleError)
    );
  }

  register(
    username: string,
    email: string,
    password: string,
    confirmPasswordValue: string,
    agreedToTerms: boolean,
    understandPrivacy: boolean
  ): Observable<RegistrationResponse> {
    console.log(`AuthService: Attempting registration for username ${username}, email ${email} via ${this.registerUrl}`);
    const body = {
      username: username,
      email: email,
      password: password,
      confirmPassword: confirmPasswordValue,
      agreeTerms: agreedToTerms,
      understandPrivacy: understandPrivacy
    };
    console.log('Sending registration body:', body);
    return this.http.post<RegistrationResponse>(this.registerUrl, body).pipe(
      tap(response => {
        console.log('AuthService: Registration API call successful:', response?.message);
      }),
      catchError(this.handleError)
    );
  }

  logout(): void {
    console.log('AuthService: Logging out user.');
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(CURRENT_USER_KEY);
      // Clear anonymous ID on logout as well
      localStorage.removeItem(ANONYMOUS_UPLOAD_ID_KEY);
    }
    this.currentUserSubject.next(null);
    this.router.navigate(['/home']);
  }

  public getToken(): string | null {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    }
    return null;
  }

  public isLoggedIn(): boolean {
    const hasUser = !!this.currentUserSubject.value;
    const hasToken = !!this.getToken();
    return hasUser && hasToken;
  }

  private storeUserData(user: User, token: string): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        console.log('AuthService: Stored user data and token.');
      } catch (e) {
        console.error("AuthService: Failed to store user data in localStorage", e);
      }
    }
  }

  private loadInitialUser(): User | null {
    if (typeof localStorage === 'undefined') { return null; }
    const storedUser = localStorage.getItem(CURRENT_USER_KEY);
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (storedUser && token) {
      try {
        const user: User = JSON.parse(storedUser);
        console.log('AuthService: Loaded initial user from storage:', user?.email, '(Username:', user?.username || 'N/A', ')');
        // Clear anonymous ID if user is loaded as logged in
        localStorage.removeItem(ANONYMOUS_UPLOAD_ID_KEY);
        return user;
      } catch (e) {
        console.error("AuthService: Error parsing stored user data. Clearing storage.", e);
        localStorage.removeItem(CURRENT_USER_KEY);
        localStorage.removeItem(AUTH_TOKEN_KEY);
        return null;
      }
    }
    return null;
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let userMessage = 'An unexpected error occurred. Please try again.';
    console.error(`AuthService HTTP Error: Status ${error.status}, URL: ${error.url}, Body: `, error.error);

    if (error.error instanceof ErrorEvent) {
      userMessage = `Network error: ${error.error.message}`;
    } else if (error.status === 0) {
      const apiUrl = (this as any)?.baseApiUrl || 'the server';
      userMessage = `Cannot connect to ${apiUrl}. Please check network or server status.`;
    } else {
      if (error.error) {
        if (typeof error.error.error === 'string') { userMessage = error.error.error; }
        else if (typeof error.error.message === 'string') { userMessage = error.error.message; }
      }
      else if (error.status === 400) { userMessage = 'Invalid request data provided. Check username format or other fields.'; }
      else if (error.status === 401) { userMessage = 'Authentication failed.'; }
      else if (error.status === 403) { userMessage = 'Forbidden.'; }
      else if (error.status === 404) { userMessage = 'API endpoint not found.'; }
      else if (error.status === 409) { userMessage = 'Conflict. Username or Email may already be taken.'; }
      else if (error.status === 500) { userMessage = 'Server error. Please try again later.'; }
      else if (error.statusText) { userMessage = `Server Error ${error.status}: ${error.statusText}`; }
    }
    return throwError(() => new Error(userMessage));
  }

  // Method to get or generate anonymous ID
  public getOrGenerateAnonymousUploadId(): string | null {
    if (typeof localStorage === 'undefined' || typeof crypto === 'undefined' || typeof crypto.randomUUID === 'undefined') {
      console.warn('localStorage or crypto.randomUUID not available for anonymous ID generation.');
      // Fallback or error handling if needed, for now, returning null.
      // You could use a simpler random string generator if crypto.randomUUID is not available.
      return 'fallback-anon-id-' + Date.now(); // Basic fallback
    }

    let anonId = localStorage.getItem(ANONYMOUS_UPLOAD_ID_KEY);
    if (!anonId) {
      anonId = crypto.randomUUID();
      localStorage.setItem(ANONYMOUS_UPLOAD_ID_KEY, anonId);
      console.log('AuthService: Generated new anonymous upload ID:', anonId);
    }
    return anonId;
  }
}