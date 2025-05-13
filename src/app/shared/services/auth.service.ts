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

// --- NEW Interface for Password Reset Responses ---
export interface PasswordResetResponse {
  message: string;
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

  // --- NEW URLs for Password Reset ---
  private requestPasswordResetUrl = `${this.baseApiUrl}/api/auth/request-password-reset`;
  private resetPasswordUrlBase = `${this.baseApiUrl}/api/auth/reset-password`; // Base URL, token will be appended


  private http = inject(HttpClient);
  private router = inject(Router);

  constructor() {
    console.log('AuthService initialized.');
    console.log('Register URL configured:', this.registerUrl);
    console.log('Login URL configured:', this.loginUrl);
    // --- NEW Console logs for new URLs ---
    console.log('Request Password Reset URL configured:', this.requestPasswordResetUrl);
    console.log('Base Reset Password URL configured:', this.resetPasswordUrlBase);
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
          // Propagate a new error that will be caught by catchError
          throw new Error('Invalid login response structure from server.');
        }
      }),
      catchError(this.handleError) // handleError will transform the error
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
    this.router.navigate(['/home']); // Consider navigating to '/login' or another appropriate page
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

  // --- NEW: Method to request password reset link ---
  requestPasswordReset(email: string): Observable<PasswordResetResponse> {
    console.log(`AuthService: Requesting password reset for ${email} via ${this.requestPasswordResetUrl}`);
    return this.http.post<PasswordResetResponse>(this.requestPasswordResetUrl, { email }).pipe(
      tap(response => console.log('AuthService: Password reset request API call successful:', response?.message)),
      catchError(this.handleError) // Your existing handleError will be used
    );
  }

  // --- NEW: Method to reset password using token ---
  resetPassword(
    token: string,
    password: string,
    confirmPassword: string,
    logoutAll?: boolean // Optional parameter
  ): Observable<PasswordResetResponse> {
    const url = `${this.resetPasswordUrlBase}/${token}`; // Append token to the base URL
    const payload = {
      password,
      confirmPassword,
      logoutAllDevices: logoutAll ?? false // Backend expects 'logoutAllDevices'
    };
    console.log(`AuthService: Attempting to reset password with token via ${url}. Payload:`, payload);
    return this.http.post<PasswordResetResponse>(url, payload).pipe(
      tap(response => console.log('AuthService: Password reset API call successful:', response?.message)),
      catchError(this.handleError) // Your existing handleError will be used
    );
  }
  // --- END OF NEW METHODS ---

  private handleError(error: HttpErrorResponse): Observable<never> {
    let userMessage = 'An unexpected error occurred. Please try again.';
    // Log the detailed error object for debugging
    console.error(`AuthService HTTP Error: Status ${error.status}, URL: ${error.url}, Message: ${error.message}, Error Object: `, error.error);

    if (error.error instanceof ErrorEvent) {
      // A client-side or network error occurred.
      userMessage = `Network error: ${error.error.message}`;
    } else if (error.status === 0) {
      // This typically means the request couldn't be made (e.g., CORS issue before preflight, server down, network disconnected)
      const apiUrlForError = this.baseApiUrl || 'the application server';
      userMessage = `Cannot connect to ${apiUrlForError}. Please check your network connection or if the server is running.`;
    } else {
      // The backend returned an unsuccessful response code.
      // The response body (`error.error`) may contain clues as to what went wrong.
      if (error.error) {
        if (typeof error.error.error === 'string') { // Backend format: { "error": "message" }
          userMessage = error.error.error;
        } else if (typeof error.error.message === 'string') { // Backend format: { "message": "message" } (less common for errors)
          userMessage = error.error.message;
        } else if (typeof error.error === 'string') { // Backend might send a plain string error
          userMessage = error.error;
        }
        // Add more specific checks if your backend has a consistent error object structure
      }

      // Fallback to status-based messages if a detailed message wasn't extracted from error.error
      if (userMessage === 'An unexpected error occurred. Please try again.') {
        switch (error.status) {
          case 400:
            userMessage = 'Invalid request. Please check the data you provided.';
            break;
          case 401:
            userMessage = 'Authentication failed. Please check your credentials.';
            break;
          case 403:
            userMessage = 'You do not have permission to perform this action.';
            break;
          case 404:
            userMessage = 'The requested resource or API endpoint was not found on the server.';
            break;
          case 409:
            userMessage = 'There was a conflict with the data provided (e.g., email or username already in use).';
            break;
          case 500:
            userMessage = 'A server error occurred. Please try again later.';
            break;
          default:
            userMessage = `Error ${error.status}: ${error.statusText || 'An unknown server error occurred.'}`;
        }
      }
    }
    // It's crucial to return an Observable that emits an Error object for .subscribe(error => ...) in components
    return throwError(() => new Error(userMessage));
  }

  // Method to get or generate anonymous ID
  public getOrGenerateAnonymousUploadId(): string | null {
    if (typeof localStorage === 'undefined' || typeof crypto === 'undefined' || typeof crypto.randomUUID === 'undefined') {
      console.warn('AuthService: localStorage or crypto.randomUUID not available for anonymous ID generation.');
      // Provide a very basic fallback for environments where crypto.randomUUID might not be available (e.g., very old browsers or specific non-browser contexts)
      // However, for modern browsers, crypto.randomUUID is standard.
      const timestamp = Date.now();
      const randomPart = Math.random().toString(36).substring(2, 15);
      return `fallback-anon-id-${timestamp}-${randomPart}`;
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