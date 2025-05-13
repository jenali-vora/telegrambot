// src/app/components/reset-password/reset-password.component.ts
import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service'; // Adjust path

// Custom Validator for password mismatch
export function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');
  if (password?.pristine || confirmPassword?.pristine) { return null; }
  return password && confirmPassword && password.value !== confirmPassword.value
    ? { passwordMismatch: true }
    : null;
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css']
})
export class ResetPasswordComponent implements OnInit, OnDestroy {
  resetPasswordForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  token: string | null = null;
  tokenValid: boolean | null = null; // null: checking, true: valid, false: invalid

  passwordFieldType: string = 'password';
  passwordVisible: boolean = false;
  confirmPasswordFieldType: string = 'password';
  confirmPasswordVisible: boolean = false;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private routeSub: Subscription | null = null;
  private resetSub: Subscription | null = null;

  constructor() {
    this.resetPasswordForm = new FormGroup({
      password: new FormControl('', [Validators.required, Validators.minLength(8)]),
      confirmPassword: new FormControl('', [Validators.required]),
      logoutAllDevices: new FormControl(false)
    }, { validators: passwordMatchValidator });
  }

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(params => {
      this.token = params.get('token');
      if (!this.token) {
        this.errorMessage = 'Reset token is missing. Please use the link from your email.';
        this.tokenValid = false;
        this.resetPasswordForm.disable();
      } else {
        // For now, we assume the token might be valid and let the backend's POST verify it.
        // A GET request to validate token on load can be added for better UX.
        this.tokenValid = true;
        console.log('Token from URL:', this.token);
      }
    });
  }

  get password() { return this.resetPasswordForm.get('password'); }
  get confirmPassword() { return this.resetPasswordForm.get('confirmPassword'); }
  get logoutAllDevices() { return this.resetPasswordForm.get('logoutAllDevices'); }

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
    this.passwordFieldType = this.passwordVisible ? 'text' : 'password';
  }

  toggleConfirmPasswordVisibility(): void {
    this.confirmPasswordVisible = !this.confirmPasswordVisible;
    this.confirmPasswordFieldType = this.confirmPasswordVisible ? 'text' : 'password';
  }

  onSubmit() {
    this.errorMessage = '';
    this.successMessage = '';
    this.resetPasswordForm.markAllAsTouched();

    if (this.resetPasswordForm.invalid) {
      this.errorMessage = 'Please correct the errors in the form.';
      return;
    }
    if (!this.token) {
      this.errorMessage = 'Reset token is not available.';
      this.tokenValid = false;
      return;
    }

    this.isLoading = true;
    const newPassword = this.password?.value;
    const confirmPass = this.confirmPassword?.value;
    const logoutAll = this.logoutAllDevices?.value;

    this.resetSub?.unsubscribe();
    this.resetSub = this.authService.resetPassword(this.token, newPassword, confirmPass, logoutAll)
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          this.successMessage = response?.message || 'Your password has been successfully reset!';
          this.resetPasswordForm.disable(); // Prevent resubmission
          this.router.navigate(['/login']);
          // Optionally redirect after a delay
          // setTimeout(() => this.router.navigate(['/login']), 3000);
        },
        error: (error: Error) => {
          this.isLoading = false;
          this.errorMessage = error?.message || 'Failed to reset password. The link may be invalid or expired.';
          if (error.message.toLowerCase().includes('expired') || error.message.toLowerCase().includes('invalid')) {
            this.tokenValid = false; // Mark token as definitely invalid
            this.resetPasswordForm.disable();
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.resetSub?.unsubscribe();
  }
}