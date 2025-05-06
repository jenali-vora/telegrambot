// src/app/components/login/login.component.ts
import { Component, ElementRef, ViewChild, inject, OnDestroy } from '@angular/core'; // Added OnDestroy
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs'; // Import Subscription

// --- Import your AuthService ---
import { AuthService, LoginResponse } from '../../services/auth.service'; // Adjust path if needed

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink // For the "Sign up" link
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnDestroy { // Implement OnDestroy

  // Reference to the email input for focusing on error
  @ViewChild('emailInput') emailInputRef!: ElementRef<HTMLInputElement>;

  loginForm: FormGroup;
  passwordFieldType: string = 'password';
  passwordVisible: boolean = false;

  // State for UI feedback
  isLoading: boolean = false;
  errorMessage: string = '';
  // No need for successMessage if redirecting immediately

  // Inject the Router service
  private router = inject(Router);
  // --- Inject AuthService ---
  private authService = inject(AuthService);

  // --- Subscription Management ---
  private loginSubscription: Subscription | null = null;

  constructor() {
    // Initialize the reactive form
    this.loginForm = new FormGroup({
      email: new FormControl('', [Validators.required, Validators.email]),
      password: new FormControl('', [Validators.required]),
      rememberMe: new FormControl(false) // Keep if you plan to use it with Flask-Login's remember=True
    });
  }

  // Getters for easy template access & validation check
  get email() { return this.loginForm.get('email'); }
  get password() { return this.loginForm.get('password'); }
  get rememberMe() { return this.loginForm.get('rememberMe'); } // Keep getter

  // Method to toggle visibility state and input type
  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
    this.passwordFieldType = this.passwordVisible ? 'text' : 'password';
  }

  // Method called by the form's (ngSubmit) event
  onSubmit() {
    this.errorMessage = ''; // Clear previous errors
    this.loginForm.markAllAsTouched(); // Show validation errors if any fields were missed

    // Proceed only if the form is valid
    if (this.loginForm.valid) {
      this.isLoading = true; // Indicate processing
      const emailValue = this.loginForm.value.email;
      const passwordValue = this.loginForm.value.password;
      // const remember = this.loginForm.value.rememberMe; // Get remember me value

      // --- Create credentials object ---
      const credentials = {
        email: emailValue,
        password: passwordValue
        // Note: The 'rememberMe' flag from the Angular form isn't directly passed
        // to the standard Flask form submission. Flask-Login's login_user(user, remember=...)
        // needs the boolean on the *backend*. If you want this feature, you'd typically:
        // 1. Send 'rememberMe' in the JSON body to your Flask '/login' route.
        // 2. Modify the Flask '/login' route to read this boolean from the JSON request
        //    (e.g., `remember_me = request.json.get('rememberMe', False)`)
        // 3. Pass it to `login_user(user_obj, remember=remember_me)`.
        // For now, we'll stick to `remember=False` as in your backend code.
      };

      console.log('Login attempt with:', { email: credentials.email }); // Avoid logging password

      // --- Call the Actual Authentication Service ---
      // Unsubscribe from previous attempt if any
      this.loginSubscription?.unsubscribe();

      this.loginSubscription = this.authService.login(credentials).subscribe({
        next: (response: LoginResponse) => {
          this.isLoading = false;
          // The authService already stored user data and token
          console.log('Login successful (from component), navigating to dashboard...');
          // Use response.message if available and desired
          // this.successMessage = response.message || 'Login successful!';
          this.router.navigate(['/dashboard']); // Navigate on success (adjust route if needed)
        },
        error: (error: Error) => { // Catch the Error object thrown by handleError
          this.isLoading = false;
          // The error message is already processed by authService.handleError
          this.errorMessage = error?.message || 'Invalid credentials or server error.';
          console.error('Login component error handler:', error);
          this.focusEmailInput(); // Focus email on error
        }
      });
      // --- End Actual Authentication Call ---

    } else {
      console.log('Form is invalid');
      this.errorMessage = 'Please fill in all required fields correctly.';
      // Focus the first invalid field (often email)
      if (this.email?.invalid) {
        this.focusEmailInput();
      } else if (this.password?.invalid) {
        // Optionally add ViewChild and focus for password input as well
      }
    }
  }

  // Helper method to focus email input on error
  focusEmailInput(): void {
    // Use optional chaining and setTimeout for safety, especially with *ngIf
    setTimeout(() => this.emailInputRef?.nativeElement.focus(), 0);
  }

  // --- Lifecycle Hook for Cleanup ---
  ngOnDestroy(): void {
    this.loginSubscription?.unsubscribe(); // Prevent memory leaks
  }
}