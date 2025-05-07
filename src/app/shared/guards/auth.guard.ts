import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service'; // Adjust path
import { map, take } from 'rxjs/operators';

export const authGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    return authService.isLoggedIn$.pipe(
        take(1),
        map(isLoggedIn => {
            if (isLoggedIn) {
                return true;
            } else {
                router.navigate(['/home']); // Or your login page
                return false;
            }
        })
    );
};