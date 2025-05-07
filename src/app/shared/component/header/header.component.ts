import { Component, OnInit, OnDestroy, Renderer2, ElementRef, HostListener, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService, User } from '../../services/auth.service'; // Adjust path as needed

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  isMenuOpen = false; // For mobile hamburger menu
  isUserMenuOpen = false; // For user dropdown menu

  isLoggedIn = false;
  currentUser: User | null = null;
  // For user's plan - this would ideally come from backend, hardcoding for example
  // If your User object from authService contains plan info, use that.

  private authSubscription: Subscription = new Subscription();
  private renderer = inject(Renderer2);
  private el = inject(ElementRef);
  private authService = inject(AuthService);
  private router = inject(Router);

  // Listener cleanup functions for mobile menu
  private unlistenOverlayClick: (() => void) | null = null;
  private unlistenEscKey: (() => void) | null = null;

  constructor() { }

  ngOnInit(): void {
    this.authSubscription.add(
      this.authService.isLoggedIn$.subscribe(status => {
        this.isLoggedIn = status;
        if (!status) {
          this.isUserMenuOpen = false; // Close user menu if logged out
        }
      })
    );
    this.authSubscription.add(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
        // Example: if user object had a plan: this.userPlan = user?.plan || 'Free plan';
      })
    );
  }

  // --- Mobile Hamburger Menu Logic (Keep existing) ---
  openMenu(): void {
    if (this.isMenuOpen) return;
    const sidebar = this.el.nativeElement.querySelector('#mobile-sidebar');
    const overlay = this.el.nativeElement.querySelector('#menu-overlay');
    const hamburger = this.el.nativeElement.querySelector('#hamburger-button');
    if (sidebar && overlay && hamburger) {
      this.renderer.addClass(sidebar, 'is-open');
      this.renderer.addClass(overlay, 'is-open');
      this.renderer.addClass(document.body, 'mobile-menu-active');
      this.renderer.setAttribute(sidebar, 'aria-hidden', 'false');
      this.renderer.setAttribute(hamburger, 'aria-expanded', 'true');
      this.isMenuOpen = true;
      this.addCloseListeners();
    }
  }

  closeMenu(): void {
    if (!this.isMenuOpen) return;
    const sidebar = this.el.nativeElement.querySelector('#mobile-sidebar');
    const overlay = this.el.nativeElement.querySelector('#menu-overlay');
    const hamburger = this.el.nativeElement.querySelector('#hamburger-button');
    if (sidebar && overlay && hamburger) {
      this.renderer.removeClass(sidebar, 'is-open');
      this.renderer.removeClass(overlay, 'is-open');
      this.renderer.removeClass(document.body, 'mobile-menu-active');
      this.renderer.setAttribute(sidebar, 'aria-hidden', 'true');
      this.renderer.setAttribute(hamburger, 'aria-expanded', 'false');
      this.isMenuOpen = false;
      this.removeCloseListeners();
    }
  }

  private addCloseListeners(): void {
    const overlay = this.el.nativeElement.querySelector('#menu-overlay');
    if (overlay) {
      this.unlistenOverlayClick = this.renderer.listen(overlay, 'click', () => this.closeMenu());
    }
    this.unlistenEscKey = this.renderer.listen('document', 'keydown', (event: KeyboardEvent) => {
      if (event.key === 'Escape' && this.isMenuOpen) this.closeMenu();
    });
  }

  private removeCloseListeners(): void {
    this.unlistenOverlayClick?.();
    this.unlistenEscKey?.();
    this.unlistenOverlayClick = null;
    this.unlistenEscKey = null;
  }

  onSidebarLinkClick(): void { this.closeMenu(); }
  // --- End Mobile Hamburger Menu Logic ---


  // --- User Dropdown Menu Logic ---
  toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const userMenuTrigger = this.el.nativeElement.querySelector('.user-profile-trigger');
    const userMenuDropdown = this.el.nativeElement.querySelector('.user-dropdown-menu');
    if (this.isUserMenuOpen && userMenuTrigger && userMenuDropdown) {
      if (!userMenuTrigger.contains(event.target as Node) && !userMenuDropdown.contains(event.target as Node)) {
        this.isUserMenuOpen = false;
      }
    }
  }

  // Logout Method
  logout(): void {
    this.authService.logout(); // AuthService handles navigation
    this.isUserMenuOpen = false;
  }

  // Helper for dropdown links
  handleDropdownNavigation(path: string, isExternal: boolean = false): void {
    if (isExternal) {
      window.open(path, '_blank');
    } else {
      this.router.navigate([path]);
    }
    this.isUserMenuOpen = false;
  }

  ngOnDestroy(): void {
    this.authSubscription.unsubscribe();
    this.removeCloseListeners(); // For mobile menu
    if (this.isMenuOpen) {
      this.renderer.removeClass(document.body, 'mobile-menu-active');
    }
  }
}