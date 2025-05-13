import { Component, OnInit, OnDestroy, Renderer2, ElementRef, HostListener, inject, ViewChild } from '@angular/core'; // <-- Make sure HostListener is imported
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

  private authSubscription: Subscription = new Subscription();
  private renderer = inject(Renderer2);
  private el = inject(ElementRef);
  private authService = inject(AuthService);
  private router = inject(Router);

  // Listener cleanup functions for mobile menu
  private unlistenOverlayClick: (() => void) | null = null;
  private unlistenEscKey: (() => void) | null = null;
  @ViewChild('header') header!: ElementRef;

  // --- Define the breakpoint (should match your CSS @media query) ---
  private mobileBreakpoint = 992;

  constructor() { }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    const headerElement = this.header.nativeElement;
    // Ensure header element exists before trying to access classList
    if (headerElement) {
      if (window.scrollY > 150) {
        this.renderer.addClass(headerElement, 'fixed-header');
      } else {
        this.renderer.removeClass(headerElement, 'fixed-header');
      }
    }
  }

  // --- Add HostListener for window resize ---
  @HostListener('window:resize', ['$event'])
  onWindowResize(event: Event): void {
    // Check if the mobile menu is open AND the window width is now *above* the mobile breakpoint
    if (this.isMenuOpen && window.innerWidth > this.mobileBreakpoint) {
      // console.log('Window resized above breakpoint while mobile menu was open. Closing menu.'); // Optional: for debugging
      this.closeMenu();
    }
  }
  // --- End HostListener for window resize ---


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
      // Only reset aria-expanded if the hamburger button still exists (might not in desktop view)
      if (hamburger) {
        this.renderer.setAttribute(hamburger, 'aria-expanded', 'false');
      }
      this.isMenuOpen = false;
      this.removeCloseListeners();
    } else {
      // Fallback in case elements aren't found but state is inconsistent
      this.renderer.removeClass(document.body, 'mobile-menu-active');
      this.isMenuOpen = false;
      this.removeCloseListeners();
    }
  }

  private addCloseListeners(): void {
    const overlay = this.el.nativeElement.querySelector('#menu-overlay');
    if (overlay && !this.unlistenOverlayClick) { // Prevent adding multiple listeners
      this.unlistenOverlayClick = this.renderer.listen(overlay, 'click', () => this.closeMenu());
    }
    if (!this.unlistenEscKey) { // Prevent adding multiple listeners
      this.unlistenEscKey = this.renderer.listen('document', 'keydown', (event: KeyboardEvent) => {
        if (event.key === 'Escape' && this.isMenuOpen) this.closeMenu();
      });
    }
  }

  private removeCloseListeners(): void {
    this.unlistenOverlayClick?.();
    this.unlistenEscKey?.();
    this.unlistenOverlayClick = null;
    this.unlistenEscKey = null;
  }

  onSidebarLinkClick(): void { this.closeMenu(); }
  // --- End Mobile Hamburger Menu Logic ---


  // --- User Dropdown Menu Logic (Keep existing) ---
  toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Close user dropdown if click is outside
    const userMenuTrigger = this.el.nativeElement.querySelector('.user-profile-trigger');
    const userMenuDropdown = this.el.nativeElement.querySelector('.user-dropdown-menu');
    if (this.isUserMenuOpen && userMenuTrigger && userMenuDropdown) {
      const clickedInsideTrigger = userMenuTrigger.contains(event.target as Node);
      const clickedInsideDropdown = userMenuDropdown.contains(event.target as Node);
      if (!clickedInsideTrigger && !clickedInsideDropdown) {
        this.isUserMenuOpen = false;
      }
    }
  }

  logout(): void {
    this.authService.logout();
    this.isUserMenuOpen = false; // Ensure dropdown closes on logout
    this.closeMenu(); // Also ensure mobile menu closes if open
  }

  handleDropdownNavigation(path: string, isExternal: boolean = false): void {
    if (isExternal) {
      window.open(path, '_blank');
    } else {
      this.router.navigate([path]);
    }
    this.isUserMenuOpen = false;
  }

  getUserInitial(): string {
    if (this.currentUser && this.currentUser.email) {
      return this.currentUser.email.charAt(0).toUpperCase();
    } else if (this.currentUser && this.currentUser.username) {
      return this.currentUser.username.charAt(0).toUpperCase();
    }
    return '?';
  }

  ngOnDestroy(): void {
    this.authSubscription.unsubscribe();
    this.removeCloseListeners(); // Clean up mobile menu listeners
    // Ensure body class is removed if component is destroyed while menu is open
    if (this.isMenuOpen) {
      this.renderer.removeClass(document.body, 'mobile-menu-active');
    }
    // No need to explicitly remove the window:resize listener, Angular handles it.
  }
}