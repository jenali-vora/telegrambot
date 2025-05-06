// // EXAMPLE ONLY - If you have a CLASS guard
// import { Injectable, inject } from '@angular/core';
// import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
// import { AuthService } from '../services/auth.service'; // Verify path

// @Injectable({ providedIn: 'root' })
// export class AuthGuard implements CanActivate { // Implements CanActivate

//   private authService = inject(AuthService);
//   private router = inject(Router);

//   canActivate(
//     route: ActivatedRouteSnapshot,
//     state: RouterStateSnapshot): boolean { // Return boolean directly
//     if (this.authService.isLoggedIn()) {
//       return true;
//     } else {
//       this.router.navigate(['/login']);
//       return false;
//     }
//   }
// }