// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { LoginComponent } from './shared/component/login/login.component';
import { RegisterComponent } from './shared/component/register/register.component';
import { HomeComponent } from './component/home/home.component';
import { LayoutComponent } from './shared/component/layout/layout.component';
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
import { ArchivedFilesPageComponent } from './shared/component/archived-files-page/archived-files-page.component';
import { GamesComponent } from './shared/component/games/games.component';
import { FilePreviewComponent } from './shared/component/file-preview/file-preview.component';
import { PrivacyPolicyComponent } from './shared/component/privacy-policy/privacy-policy.component';

export const routes: Routes = [
  // Routes WITHOUT Main Header/Footer
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'register',
    component: RegisterComponent
  },
  {
    path: 'forgot-password',
    component: ForgotPasswordComponent
  },
  {
    path: 'reset-password/:token',
    component: ResetPasswordComponent
  },

  // Routes WITH Main Header/Footer (using LayoutComponent)
  {
    path: '', // Represents routes using the main layout
    component: LayoutComponent,
    children: [
      {
        path: '', // Home page uses the main layout, now at the root
        component: HomeComponent,
        pathMatch: 'full' // Important for empty path routes
      },
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
      { path: 'batch-view/:accessId', component: BatchFileBrowserComponent },
      {
        path: 'my-files',
        component: UserFilesPageComponent,
        canActivate: [authGuard]
      },
      {
        path: 'archived-files', // The path we linked to
        component: ArchivedFilesPageComponent,
        canActivate: [authGuard] // Protect this route too
      },
      {
        path: 'games',
        component: GamesComponent
      },
      { path: 'preview/:accessId', component: FilePreviewComponent },
      { path: 'privacy', component: PrivacyPolicyComponent },
      // Removed: { path: '', redirectTo: '/home', pathMatch: 'full' }
      // This is no longer needed as HomeComponent is now the default for the empty path.
    ]
  },

  // Optional: If you want to redirect users who still type /home to the root
  {
    path: 'home',
    redirectTo: '', // Redirects to the root path
    pathMatch: 'full'
  },

  // Wildcard route redirects to the new home page (which is the root path)
  {
    path: '**',
    redirectTo: '' // Or show a dedicated NotFoundComponent within the layout
  }
];