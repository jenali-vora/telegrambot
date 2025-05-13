// src/app/components/forgot-password/forgot-password.component.ts
import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service'; // Adjust path as needed

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
  submittedEmail = ''; // To display in success message

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
    this.submittedEmail = '';
    this.forgotPasswordForm.markAllAsTouched();

    if (this.forgotPasswordForm.invalid) {
      this.errorMessage = 'Please enter a valid email address.';
      return;
    }

    this.isLoading = true;
    const emailValue = this.email?.value;
    this.submittedEmail = emailValue; // Store for success message

    this.resetSubscription?.unsubscribe();

    this.resetSubscription = this.authService.requestPasswordReset(emailValue).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.successMessage = response?.message || "Instructions sent if the email is registered.";
        // this.forgotPasswordForm.reset(); // Optionally reset
        // this.forgotPasswordForm.disable(); // Optionally disable after success
      },
      error: (error: Error) => {
        this.isLoading = false;
        // Even on backend error, we often show a generic success message for this flow
        // to avoid confirming/denying email existence.
        this.successMessage = "If an account with that email exists, instructions have been sent.";
        // Log the actual error for debugging
        console.error('Password reset request potentially failed on backend:', error.message);
      }
    });
  }

  ngOnDestroy(): void {
    this.resetSubscription?.unsubscribe();
  }
}