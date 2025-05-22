// header.component.ts
import { Component, OnInit, OnDestroy, Renderer2, ElementRef, HostListener, inject, ViewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService, User } from '../../services/auth.service';
// ++ Import LanguageSelectorModalComponent and Language interface
import { LanguageSelectorModalComponent, Language } from '../language-selector-modal/language-selector-modal.component'; // Adjust path if needed

@Component({
  selector: 'app-header',
  standalone: true,
  // ++ Add LanguageSelectorModalComponent to imports
  imports: [CommonModule, RouterLink, RouterLinkActive, LanguageSelectorModalComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  isMenuOpen = false;
  isUserMenuOpen = false;
  isLoggedIn = false;
  currentUser: User | null = null;

  // ++ Properties for language modal
  isLanguageModalOpen = false;
  currentLanguageCode: string = 'en'; // Default language
  availableLanguages: Language[] = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'fr', name: 'Français', nativeName: 'French' }, // Assuming 'French' is nativeName for screenshot
    { code: 'it', name: 'Italiano', nativeName: 'Italian' },
    { code: 'de', name: 'Deutsch', nativeName: 'German' },
    { code: 'pt', name: 'Português', nativeName: 'Portuguese' },
    { code: 'tr', name: 'Türkçe', nativeName: 'Turkish' },
    { code: 'nl', name: 'Nederlands', nativeName: 'Dutch' },
    { code: 'es', name: 'Español', nativeName: 'Spanish' },
    { code: 'ro', name: 'Română', nativeName: 'Romanian' }
  ];
  appName: string = 'UploadNow'; // From screenshot context

  private authSubscription: Subscription = new Subscription();
  private renderer = inject(Renderer2);
  private el = inject(ElementRef);
  private authService = inject(AuthService);
  private router = inject(Router);

  @ViewChild('header') header!: ElementRef;
  // ++ ViewChild for the language selector button
  @ViewChild('languageSelectorBtn', { static: false }) languageSelectorBtnRef: ElementRef | undefined;

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
    // Optional: close language modal on resize if it interferes
    // if (this.isLanguageModalOpen) {
    //   this.closeLanguageModal();
    // }
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
    // TODO: Initialize currentLanguageCode from a translation service or localStorage if persisted
  }

  openMenu(): void {
    // ... (existing openMenu logic remains the same)
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
    // ... (existing closeMenu logic remains the same)
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
    // ... (existing addCloseListeners logic remains the same)
    const overlay = this.el.nativeElement.querySelector('#menu-overlay');
    if (overlay && !this.unlistenOverlayClick) {
      this.unlistenOverlayClick = this.renderer.listen(overlay, 'click', () => this.closeMenu());
    }
    if (!this.unlistenEscKey) {
      this.unlistenEscKey = this.renderer.listen('document', 'keydown', (event: KeyboardEvent) => {
        if (event.key === 'Escape' && this.isMenuOpen) this.closeMenu();
        // ++ Close language modal on Escape key as well
        if (event.key === 'Escape' && this.isLanguageModalOpen) this.closeLanguageModal();
      });
    }
  }

  private removeCloseListeners(): void {
    // ... (existing removeCloseListeners logic remains the same)
    this.unlistenOverlayClick?.();
    this.unlistenEscKey?.(); // Note: This also removes the Esc listener for language modal. If separate Esc handling is needed for language modal, manage its listener separately.
    this.unlistenOverlayClick = null;
    this.unlistenEscKey = null;
  }

  onSidebarLinkClick(): void { this.closeMenu(); }

  toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isUserMenuOpen = !this.isUserMenuOpen;
    if (this.isUserMenuOpen && this.isLanguageModalOpen) { // Close other modal
      this.closeLanguageModal();
    }
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

    // ++ Language Modal Logic
    // The language modal itself has stopPropagation for clicks inside it.
    // So, if a click reaches here and it's not the trigger button, close the modal.
    if (this.isLanguageModalOpen &&
      this.languageSelectorBtnRef &&
      !this.languageSelectorBtnRef.nativeElement.contains(event.target as Node)) {
      this.closeLanguageModal();
    }
  }

  logout(): void {
    this.authService.logout();
    this.isUserMenuOpen = false;
    this.closeMenu(); // Close mobile menu if open
    this.closeLanguageModal(); // Close language modal if open
  }

  getUserInitial(): string {
    if (this.currentUser?.email) {
      return this.currentUser.email.charAt(0).toUpperCase();
    } else if (this.currentUser?.username) {
      return this.currentUser.username.charAt(0).toUpperCase();
    }
    return '?';
  }

  // ++ Methods for Language Modal
  toggleLanguageModal(event: MouseEvent): void {
    event.stopPropagation(); // Prevent document click from closing it immediately
    this.isLanguageModalOpen = !this.isLanguageModalOpen;
    if (this.isLanguageModalOpen && this.isUserMenuOpen) { // Close other modal
      this.isUserMenuOpen = false;
    }
  }

  closeLanguageModal(): void {
    this.isLanguageModalOpen = false;
  }

  onLanguageSelected(langCode: string): void {
    this.currentLanguageCode = langCode;
    console.log(`Language selected: ${langCode}. Implement translation service call here.`);
    // Example: this.translateService.use(langCode);
    // localStorage.setItem('preferredLanguage', langCode);
    this.closeLanguageModal();
  }

  onContactForTranslation(): void {
    console.log('Contact for translation requested. Navigate to contact page or show form.');
    // Example: this.router.navigate(['/contact-us'], { queryParams: { reason: 'translate' } });
    this.closeLanguageModal();
  }

  ngOnDestroy(): void {
    this.authSubscription.unsubscribe();
    this.removeCloseListeners();
    if (this.isMenuOpen) {
      this.renderer.removeClass(document.body, 'mobile-menu-active');
    }
  }
}