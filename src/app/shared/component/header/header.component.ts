// header.component.ts
import { Component, OnInit, OnDestroy, Renderer2, ElementRef, HostListener, inject, ViewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService, User } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  isMenuOpen = false;
  isUserMenuOpen = false;
  isLoggedIn = false;
  currentUser: User | null = null;

  private authSubscription: Subscription = new Subscription();
  private renderer = inject(Renderer2);
  private el = inject(ElementRef);
  private authService = inject(AuthService);
  private router = inject(Router);

  @ViewChild('header') header!: ElementRef;
  private unlistenOverlayClick: (() => void) | null = null;
  private unlistenEscKey: (() => void) | null = null;

  private mobileBreakpoint = 992;

  constructor() { }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    const headerElement = this.header?.nativeElement;
    if (headerElement) {
      if (window.scrollY > 150) {
        this.renderer.addClass(headerElement, 'fixed-header');
      } else {
        this.renderer.removeClass(headerElement, 'fixed-header');
      }
    }
  }

  @HostListener('window:resize', ['$event'])
  onWindowResize(event: Event): void {
    if (this.isMenuOpen && window.innerWidth > this.mobileBreakpoint) {
      this.closeMenu();
    }
  }

  ngOnInit(): void {
    this.authSubscription.add(
      this.authService.isLoggedIn$.subscribe(status => {
        this.isLoggedIn = status;
        if (!status) {
          this.isUserMenuOpen = false;
        }
      })
    );
    this.authSubscription.add(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
      })
    );
  }

  openMenu(): void {
    if (this.isMenuOpen) return;
    const sidebar = this.el.nativeElement.querySelector('#mobile-sidebar');
    const overlay = this.el.nativeElement.querySelector('#menu-overlay');
    const hamburgerButton = this.el.nativeElement.querySelector('#hamburger-button');

    if (sidebar && overlay && hamburgerButton) {
      this.renderer.addClass(sidebar, 'is-open');
      this.renderer.addClass(overlay, 'is-open');
      this.renderer.addClass(document.body, 'mobile-menu-active');
      this.renderer.setAttribute(sidebar, 'aria-hidden', 'false');
      this.renderer.setAttribute(hamburgerButton, 'aria-expanded', 'true');
      this.isMenuOpen = true;
      this.addCloseListeners();

      const closeButtonInSidebar = sidebar.querySelector('#close-sidebar-button');
      const focusDelay = 350; // Slightly longer than CSS transition (0.3s = 300ms)

      setTimeout(() => {
        let focused = false;
        if (closeButtonInSidebar && typeof (closeButtonInSidebar as HTMLElement).focus === 'function') {
          (closeButtonInSidebar as HTMLElement).focus();
          focused = true;
        }
        if (!focused) {
          const focusableElements = sidebar.querySelectorAll(
            'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), [tabindex="0"]'
          );
          if (focusableElements.length > 0 && typeof (focusableElements[0] as HTMLElement).focus === 'function') {
            (focusableElements[0] as HTMLElement).focus();
          }
        }
      }, focusDelay);
    }
  }

  closeMenu(): void {
    if (!this.isMenuOpen) return;

    const sidebar = this.el.nativeElement.querySelector('#mobile-sidebar');
    const overlay = this.el.nativeElement.querySelector('#menu-overlay');
    const hamburgerButton = this.el.nativeElement.querySelector('#hamburger-button');

    let focusReturnedOrBlurred = false;

    // Try to return focus to the hamburger button IF it's visible and focusable
    if (hamburgerButton && window.getComputedStyle(hamburgerButton).display !== 'none') {
      if (typeof hamburgerButton.focus === 'function') {
        hamburgerButton.focus();
        focusReturnedOrBlurred = true;
      }
    }

    // If focus wasn't returned (e.g., hamburger is hidden on desktop resize)
    // AND an element within the sidebar currently has focus, blur that element.
    if (!focusReturnedOrBlurred && sidebar && document.activeElement && sidebar.contains(document.activeElement)) {
      if (typeof (document.activeElement as HTMLElement).blur === 'function') {
        (document.activeElement as HTMLElement).blur(); // Moves focus to document.body
        focusReturnedOrBlurred = true;
      }
    }

    // Defer the rest of the closing operations to ensure focus has shifted
    setTimeout(() => {
      this.isMenuOpen = false; // This triggers [attr.aria-hidden]="!isMenuOpen" to "true"

      if (sidebar) {
        this.renderer.removeClass(sidebar, 'is-open');
        // Angular binding [attr.aria-hidden]="!isMenuOpen" should handle this,
        // but explicitly setting it via renderer after state change can be a fallback
        // if needed, though typically not required with the timeout.
        // this.renderer.setAttribute(sidebar, 'aria-hidden', 'true');
      }
      if (overlay) {
        this.renderer.removeClass(overlay, 'is-open');
      }
      this.renderer.removeClass(document.body, 'mobile-menu-active');

      if (hamburgerButton) { // Only if it exists
        this.renderer.setAttribute(hamburgerButton, 'aria-expanded', 'false');
      }

      this.removeCloseListeners();
    }, 0); // Defer to the next JavaScript event loop tick
  }


  private addCloseListeners(): void {
    const overlay = this.el.nativeElement.querySelector('#menu-overlay');
    if (overlay && !this.unlistenOverlayClick) {
      this.unlistenOverlayClick = this.renderer.listen(overlay, 'click', () => this.closeMenu());
    }
    if (!this.unlistenEscKey) {
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

  toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
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
    this.isUserMenuOpen = false;
    this.closeMenu();
  }

  getUserInitial(): string {
    if (this.currentUser?.email) {
      return this.currentUser.email.charAt(0).toUpperCase();
    } else if (this.currentUser?.username) {
      return this.currentUser.username.charAt(0).toUpperCase();
    }
    return '?';
  }

  ngOnDestroy(): void {
    this.authSubscription.unsubscribe();
    this.removeCloseListeners();
    if (this.isMenuOpen) {
      this.renderer.removeClass(document.body, 'mobile-menu-active');
    }
  }
}