// src/app/components/forgot-password/forgot-password.component.ts
import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription, throwError } from 'rxjs'; // Import throwError
import { catchError } from 'rxjs/operators'; // Import catchError
import { AuthService } from '../../services/auth.service'; // Adjust path as needed
import { HttpErrorResponse } from '@angular/common/http'; // Import HttpErrorResponse

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css']
})
export class ForgotPasswordComponent implements OnDestroy {
  forgotPasswordForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  // submittedEmail = ''; // No longer strictly needed if we show generic messages

  private authService = inject(AuthService);
  private resetSubscription: Subscription | null = null;

  constructor() {
    this.forgotPasswordForm = new FormGroup({
      email: new FormControl('', [Validators.required, Validators.email]),
    });
  }

  get email() { return this.forgotPasswordForm.get('email'); }

  onSubmit() {
    this.errorMessage = '';
    this.successMessage = '';
    // this.submittedEmail = '';
    this.forgotPasswordForm.markAllAsTouched();

    if (this.forgotPasswordForm.invalid) {
      // Keep this client-side validation error message
      // this.errorMessage = 'Please enter a valid email address.';
      return; // Don't proceed if form is invalid
    }

    this.isLoading = true;
    const emailValue = this.email?.value;
    // this.submittedEmail = emailValue;

    this.resetSubscription?.unsubscribe();

    this.resetSubscription = this.authService.requestPasswordReset(emailValue)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          // This block will catch HTTP errors from the backend
          // AND network errors like ERR_CONNECTION_TIMED_OUT (which often manifest as status 0)
          this.isLoading = false;

          if (error.status === 0 || error.error instanceof ProgressEvent) {
            // Network error (backend unreachable, CORS, timeout etc.)
            this.errorMessage = "Could not connect to the server. Please try again later.";
            console.error('Network error or backend unreachable:', error);
          } else if (error.status === 404 && error.error?.message?.toLowerCase().includes('user not found')) {
            // Specific backend error: User not found.
            // For security, still show a generic success message to avoid email enumeration.
            this.successMessage = "If an account with that email exists, instructions have been sent.";
            console.warn('Password reset attempt for non-existent email (handled generically):', emailValue);
          } else {
            // Other backend errors (e.g., 400, 500)
            // You might want to show a generic error or parse error.error.message
            this.errorMessage = error.error?.message || 'An unexpected error occurred. Please try again.';
            console.error('Password reset request failed on backend:', error);
          }
          this.successMessage = ''; // Ensure success message is cleared on error
          return throwError(() => error); // Re-throw the error to ensure the `next` block isn't hit
        })
      )
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          // This block is now only hit on a successful 2xx response from the backend
          this.successMessage = response?.message || "If an account with that email exists, instructions have been sent.";
          this.errorMessage = ''; // Clear any previous error messages
          // this.forgotPasswordForm.reset();
          // this.forgotPasswordForm.disable();
        },
        // The error callback here is now less likely to be hit directly for HTTP errors
        // because catchError handles them. It might catch other unexpected JS errors.
        error: (err) => {
          // This is a fallback, most errors are handled by catchError
          if (!this.errorMessage && !this.successMessage) { // Check if messages were already set
            this.isLoading = false;
            this.errorMessage = 'An unexpected client-side error occurred.';
            console.error("Unexpected error in subscription:", err);
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.resetSubscription?.unsubscribe();
  }
}