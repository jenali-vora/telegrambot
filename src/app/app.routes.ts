// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { LoginComponent } from './shared/component/login/login.component'; // Verify path
import { RegisterComponent } from './shared/component/register/register.component'; // Verify path
// Removed: import { DashboardComponent } from './component/dashboard/dashboard.component';
// Removed: import { FileBrowserComponent } from './component/file-browser/file-browser.component';
import { HomeComponent } from './component/home/home.component'; // Verify path
import { LayoutComponent } from './shared/component/layout/layout.component'; // <<< VERIFY PATH TO LAYOUT COMPONENT
import { ContactUsComponent } from './component/contact-us/contact-us.component';
import { PricingComponent } from './component/pricing/pricing.component';
import { FaqComponent } from './component/faq/faq.component';
import { BlogsComponent } from './component/blogs/blogs.component';
import { BlogDetailComponent } from './shared/component/blog-detail/blog-detail.component';
import { UserFilesPageComponent } from './shared/component/user-files-page/user-files-page.component';
import { authGuard } from './shared/guards/auth.guard';
import { BatchFileBrowserComponent } from './component/batch-file-browser/batch-file-browser.component';
import { ForgotPasswordComponent } from './shared/component/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './shared/component/reset-password/reset-password.component';

export const routes: Routes = [
  // Routes WITHOUT Main Header/Footer
  {
    path: 'login',
    component: LoginComponent
    // Optional: Add a guard here later to redirect away if already logged in
  },
  {
    path: 'register',
    component: RegisterComponent
    // Optional: Add a guard here later to redirect away if already logged in
  },
  {
    path: 'forgot-password',
    component: ForgotPasswordComponent
  },
  {
    path:'reset-password/:token',
    component:ResetPasswordComponent
  },
  // Routes WITH Main Header/Footer (using LayoutComponent)
  {
    path: '', // Represents routes using the main layout
    component: LayoutComponent, // This component has <app-header>, <router-outlet>, <app-footer>
    children: [
      {
        path: 'home', // Home page uses the main layout
        component: HomeComponent
      },
      // Removed the '/dashboard' route and its children
      {
        path: 'contact-us',
        component: ContactUsComponent
      },
      {
        path: 'pricing',
        component: PricingComponent
      },
      {
        path: 'faq',
        component: FaqComponent
      },
      {
        path: 'blog',
        component: BlogsComponent
      },
      { path: 'blog/:slug', component: BlogDetailComponent },
      // Default empty path within the main layout redirects to home page
      { path: 'browse/:accessId', component: BatchFileBrowserComponent },
      {
        path: 'my-files',
        component: UserFilesPageComponent,
        canActivate: [authGuard]
      },
      {
        path: '',
        redirectTo: '/home',
        pathMatch: 'full'
      }
    ]
  },

  // Wildcard route redirects to the home page (which has the layout)
  {
    path: '**',
    redirectTo: '/home' // Or show a dedicated NotFoundComponent within the layout
  }
];