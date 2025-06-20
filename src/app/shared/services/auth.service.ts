// src/app/shared/services/auth.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';

export interface User { id?: string; email: string; username?: string; }
export interface LoginResponse { token: string; user: User; message?: string; }
export interface RegistrationResponse { message: string; user?: { username: string; email: string; }; }
export interface PasswordResetResponse { message: string; }

const AUTH_TOKEN_KEY = 'authToken'; const CURRENT_USER_KEY = 'currentUser';
const ANONYMOUS_UPLOAD_ID_KEY = 'anonymousClientUploadId';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(this.loadInitialUser());
  public currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();
  public isLoggedIn$: Observable<boolean> = this.currentUser$.pipe(map(user => !!user && !!this.getToken()));

  private readonly baseApiUrl = environment.apiUrl;
  private loginUrl = `${this.baseApiUrl}/api/auth/login`;
  private registerUrl = `${this.baseApiUrl}/register`;
  private requestPasswordResetUrl = `${this.baseApiUrl}/api/auth/request-password-reset`;
  private resetPasswordUrlBase = `${this.baseApiUrl}/api/auth/reset-password`;

  private http = inject(HttpClient); private router = inject(Router);

  constructor() { }

  public get currentUserValue(): User | null { return this.currentUserSubject.value; }
  public get currentUsername(): string | null { const user = this.currentUserSubject.value; return user?.username ?? user?.email ?? null; }

  login(credentials: { email: string, password: string }): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.loginUrl, credentials).pipe(
      tap(response => {
        if (response?.user && response?.token) {
          this.storeUserData(response.user, response.token); this.currentUserSubject.next(response.user);
          if (typeof localStorage !== 'undefined') localStorage.removeItem(ANONYMOUS_UPLOAD_ID_KEY);
        } else {
          console.error("AuthService: Invalid login response structure received:", response);
          throw new Error('Invalid login response structure from server.');
        }
      }),
      catchError(this.handleError)
    );
  }

  register(username: string, email: string, password: string, confirmPasswordValue: string, agreedToTerms: boolean, understandPrivacy: boolean): Observable<RegistrationResponse> {
    const body = { username, email, password, confirmPassword: confirmPasswordValue, agreeTerms: agreedToTerms, understandPrivacy: understandPrivacy };
    return this.http.post<RegistrationResponse>(this.registerUrl, body).pipe(
      tap(response => { }), // Keep original empty tap
      catchError(this.handleError)
    );
  }

  logout(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(AUTH_TOKEN_KEY); localStorage.removeItem(CURRENT_USER_KEY);
      localStorage.removeItem(ANONYMOUS_UPLOAD_ID_KEY);
    }
    this.currentUserSubject.next(null); this.router.navigate(['/home']);
  }

  public getToken(): string | null {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(AUTH_TOKEN_KEY);
    return null;
  }

  public isLoggedIn(): boolean { return !!this.currentUserSubject.value && !!this.getToken(); }

  private storeUserData(user: User, token: string): void {
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem(AUTH_TOKEN_KEY, token); localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user)); }
      catch (e) { console.error("AuthService: Failed to store user data in localStorage", e); }
    }
  }

  private loadInitialUser(): User | null {
    if (typeof localStorage === 'undefined') return null;
    const storedUser = localStorage.getItem(CURRENT_USER_KEY); const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (storedUser && token) {
      try {
        const user: User = JSON.parse(storedUser);
        localStorage.removeItem(ANONYMOUS_UPLOAD_ID_KEY); return user;
      } catch (e) {
        console.error("AuthService: Error parsing stored user data. Clearing storage.", e);
        localStorage.removeItem(CURRENT_USER_KEY); localStorage.removeItem(AUTH_TOKEN_KEY); return null;
      }
    }
    return null;
  }

  requestPasswordReset(email: string): Observable<PasswordResetResponse> {
    return this.http.post<PasswordResetResponse>(this.requestPasswordResetUrl, { email }).pipe(
      tap(response => console.log('AuthService: Password reset request API call successful:', response?.message)),
      catchError(this.handleError)
    );
  }

  resetPassword(token: string, password: string, confirmPassword: string, logoutAll?: boolean): Observable<PasswordResetResponse> {
    const url = `${this.resetPasswordUrlBase}/${token}`;
    const payload = { password, confirmPassword, logoutAllDevices: logoutAll ?? false };
    return this.http.post<PasswordResetResponse>(url, payload).pipe(
      tap(response => console.log('AuthService: Password reset API call successful:', response?.message)),
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let userMessage = 'An unexpected error occurred. Please try again.';
    console.error(`AuthService HTTP Error: Status ${error.status}, URL: ${error.url}, Message: ${error.message}, Error Object: `, error.error);
    if (error.error instanceof ErrorEvent) userMessage = `Network error: ${error.error.message}`;
    else if (error.status === 0) {
      const apiUrlForError = this.baseApiUrl || 'the application server';
      userMessage = `Cannot connect to ${apiUrlForError}. Please check your network connection or if the server is running.`;
    } else {
      if (error.error) {
        if (typeof error.error.error === 'string') userMessage = error.error.error;
        else if (typeof error.error.message === 'string') userMessage = error.error.message;
        else if (typeof error.error === 'string') userMessage = error.error;
      }
      if (userMessage === 'An unexpected error occurred. Please try again.') {
        switch (error.status) {
          case 400: userMessage = 'Invalid request. Please check the data you provided.'; break;
          case 401: userMessage = 'Authentication failed. Please check your credentials.'; break;
          case 403: userMessage = 'You do not have permission to perform this action.'; break;
          case 404: userMessage = 'The requested resource or API endpoint was not found on the server.'; break;
          case 409: userMessage = 'There was a conflict with the data provided (e.g., email or username already in use).'; break;
          case 500: userMessage = 'A server error occurred. Please try again later.'; break;
          default: userMessage = `Error ${error.status}: ${error.statusText || 'An unknown server error occurred.'}`;
        }
      }
    }
    return throwError(() => new Error(userMessage));
  }

  public getOrGenerateAnonymousUploadId(): string | null {
    if (typeof localStorage === 'undefined' || typeof crypto === 'undefined' || typeof crypto.randomUUID === 'undefined') {
      console.warn('AuthService: localStorage or crypto.randomUUID not available for anonymous ID generation.');
      const timestamp = Date.now(); const randomPart = Math.random().toString(36).substring(2, 15);
      return `fallback-anon-id-${timestamp}-${randomPart}`;
    }
    let anonId = localStorage.getItem(ANONYMOUS_UPLOAD_ID_KEY);
    if (!anonId) { anonId = crypto.randomUUID(); localStorage.setItem(ANONYMOUS_UPLOAD_ID_KEY, anonId); }
    return anonId;
  }
}