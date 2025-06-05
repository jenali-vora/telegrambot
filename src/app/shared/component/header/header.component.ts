// header.component.ts
import { Component, OnInit, OnDestroy, Renderer2, ElementRef, HostListener, inject, ViewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService, User } from '../../services/auth.service';
// LanguageSelectorModalComponent and Language interface removed

@Component({
  selector: 'app-header',
  standalone: true,
  // LanguageSelectorModalComponent removed from imports
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  isMenuOpen = false;
  isUserMenuOpen = false;
  isLoggedIn = false;
  currentUser: User | null = null;

  // Properties for language modal removed

  private authSubscription: Subscription = new Subscription();
  private renderer = inject(Renderer2);
  private el = inject(ElementRef);
  private authService = inject(AuthService);
  private router = inject(Router);

  @ViewChild('header') header!: ElementRef;
  // ViewChild for the language selector button removed

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
    // Optional: close language modal on resize if it interferes (removed as language modal is gone)
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
    // Removed: TODO for currentLanguageCode initialization
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
      const focusDelay = 350;

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

    if (hamburgerButton && window.getComputedStyle(hamburgerButton).display !== 'none') {
      if (typeof hamburgerButton.focus === 'function') {
        hamburgerButton.focus();
        focusReturnedOrBlurred = true;
      }
    }

    if (!focusReturnedOrBlurred && sidebar && document.activeElement && sidebar.contains(document.activeElement)) {
      if (typeof (document.activeElement as HTMLElement).blur === 'function') {
        (document.activeElement as HTMLElement).blur();
        focusReturnedOrBlurred = true;
      }
    }

    setTimeout(() => {
      this.isMenuOpen = false;

      if (sidebar) {
        this.renderer.removeClass(sidebar, 'is-open');
      }
      if (overlay) {
        this.renderer.removeClass(overlay, 'is-open');
      }
      this.renderer.removeClass(document.body, 'mobile-menu-active');

      if (hamburgerButton) {
        this.renderer.setAttribute(hamburgerButton, 'aria-expanded', 'false');
      }

      this.removeCloseListeners();
    }, 0);
  }


  private addCloseListeners(): void {
    const overlay = this.el.nativeElement.querySelector('#menu-overlay');
    if (overlay && !this.unlistenOverlayClick) {
      this.unlistenOverlayClick = this.renderer.listen(overlay, 'click', () => this.closeMenu());
    }
    if (!this.unlistenEscKey) {
      this.unlistenEscKey = this.renderer.listen('document', 'keydown', (event: KeyboardEvent) => {
        if (event.key === 'Escape' && this.isMenuOpen) this.closeMenu();
        // Removed: Close language modal on Escape key
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
    // Removed: Logic to close language modal if open
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // User Dropdown Menu Logic
    const userMenuTrigger = this.el.nativeElement.querySelector('.user-profile-trigger');
    const userMenuDropdown = this.el.nativeElement.querySelector('.user-dropdown-menu');
    if (this.isUserMenuOpen && userMenuTrigger && userMenuDropdown) {
      const clickedInsideTrigger = userMenuTrigger.contains(event.target as Node);
      const clickedInsideDropdown = userMenuDropdown.contains(event.target as Node);
      if (!clickedInsideTrigger && !clickedInsideDropdown) {
        this.isUserMenuOpen = false;
      }
    }

    // Removed: Language Modal Logic
  }

  logout(): void {
    this.authService.logout();
    this.isUserMenuOpen = false;
    this.closeMenu(); // Close mobile menu if open
    // Removed: this.closeLanguageModal();
  }

  getUserInitial(): string {
    if (this.currentUser?.email) {
      return this.currentUser.email.charAt(0).toUpperCase();
    } else if (this.currentUser?.username) {
      return this.currentUser.username.charAt(0).toUpperCase();
    }
    return '?';
  }

  // Removed: Methods for Language Modal (toggleLanguageModal, closeLanguageModal, onLanguageSelected, onContactForTranslation)

  ngOnDestroy(): void {
    this.authSubscription.unsubscribe();
    this.removeCloseListeners();
    if (this.isMenuOpen) {
      this.renderer.removeClass(document.body, 'mobile-menu-active');
    }
  }
}