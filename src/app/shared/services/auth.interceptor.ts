// AFTER (Rename the file or modify the existing one, e.g., src/app/services/auth.interceptor.ts)
import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core'; // Import inject
import { Observable } from 'rxjs';
import { AuthService } from './auth.service'; // Adjust path if needed

// Export a const that IS the function
export const authInterceptorFn: HttpInterceptorFn =
  (req, next) => {
    const authService = inject(AuthService);
    const authToken = authService.getToken();
    console.log('Current Auth Token:', authToken);

    if (authToken) {
      const authReq = req.clone({
        setHeaders: { // Using setHeaders for potentially better DX
          Authorization: `Bearer ${authToken}`
        }
        // Or:
        // headers: req.headers.set('Authorization', `Bearer ${authToken}`)
      });
      return next(authReq);
    }
    return next(req);
  };