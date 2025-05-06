// src/app/shared/component/register/register.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormGroup,
  FormControl,
  Validators,
  AbstractControl,
  ValidationErrors,
  ValidatorFn
} from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService, RegistrationResponse } from '../../services/auth.service'; // Adjust path

// --- Custom Validator for Password Match (Keep as is) ---
export function passwordMatchValidator(): ValidatorFn {
  // ... (validator code remains the same) ...
  return (control: AbstractControl): ValidationErrors | null => {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (!password || !confirmPassword || !password.value || !confirmPassword.value || password.pristine || confirmPassword.pristine || password.invalid) {
      if (confirmPassword?.hasError('passwordsMismatch')) {
        const errors = { ...confirmPassword.errors };
        delete errors['passwordsMismatch'];
        confirmPassword.setErrors(Object.keys(errors).length > 0 ? errors : null);
      }
      return null;
    }

    const mismatch = password.value !== confirmPassword.value;
    if (mismatch && !confirmPassword.hasError('passwordsMismatch')) {
      confirmPassword.setErrors({ ...(confirmPassword.errors || {}), passwordsMismatch: true });
    }
    else if (!mismatch && confirmPassword.hasError('passwordsMismatch')) {
      const errors = { ...confirmPassword.errors };
      delete errors['passwordsMismatch'];
      confirmPassword.setErrors(Object.keys(errors).length > 0 ? errors : null);
    }
    return null;
  };
}
// --------------------------------------------

@Component({
  selector: 'app-signup', // Or 'app-register' if that's your selector
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {

  private authService = inject(AuthService);
  private router = inject(Router);

  signupForm: FormGroup;
  passwordFieldType: string = 'password';
  confirmPasswordFieldType: string = 'password';
  passwordVisible: boolean = false;
  confirmPasswordVisible: boolean = false;
  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';

  constructor() {
    this.signupForm = new FormGroup({
      // REMOVED firstName and lastName
      // ADDED username with pattern validator (adjust regex if needed)
      username: new FormControl('', [
        Validators.required,
        Validators.pattern(/^[a-zA-Z0-9_]{3,}$/) // Example: Letters, numbers, underscore, min 3 chars
      ]),
      email: new FormControl('', [Validators.required, Validators.email]),
      password: new FormControl('', [Validators.required, Validators.minLength(8)]),
      confirmPassword: new FormControl('', [Validators.required]),
      agreeTerms: new FormControl(false, [Validators.requiredTrue]),
      // Ensure formControlName matches HTML ('understandWarning')
      understandWarning: new FormControl(false, [Validators.requiredTrue])
    },
      { validators: passwordMatchValidator() }
    );
  }

  // --- Getters for template access ---
  // REMOVED firstName, lastName getters
  get username() { return this.signupForm.get('username'); }
  get email() { return this.signupForm.get('email'); }
  get password() { return this.signupForm.get('password'); }
  get confirmPassword() { return this.signupForm.get('confirmPassword'); }
  get agreeTerms() { return this.signupForm.get('agreeTerms'); }
  get understandWarning() { return this.signupForm.get('understandWarning'); }
  // ----------------------------------

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
    this.signupForm.markAllAsTouched();

    if (this.signupForm.valid) {
      this.isLoading = true;
      const formData = this.signupForm.value;
      console.log('Submitting Signup Form (Valid):', formData);

      // --- Call AuthService with updated parameters ---
      this.authService.register(
        formData.username, // Pass username
        formData.email,
        formData.password,
        formData.confirmPassword,
        formData.agreeTerms,
        formData.understandWarning // Ensure this matches form control name
      ).subscribe({
        next: (response: RegistrationResponse) => {
          this.isLoading = false;
          this.successMessage = response?.message || 'Registration successful! Redirecting to login...';
          console.log('Registration API call successful:', response);
          this.signupForm.reset();

          setTimeout(() => {
            this.router.navigate(['/login']); // Use correct login route
          }, 2500);
        },
        error: (err: Error) => {
          this.isLoading = false;
          this.errorMessage = err.message || 'Registration failed unexpectedly. Please try again.';
          console.error('Registration failed:', err);
        }
      });

    } else {
      console.log('Form is invalid');
      this.errorMessage = 'Please correct the errors highlighted in the form.'; // Simpler message
    }
  }
}