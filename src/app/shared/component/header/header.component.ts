import { Component, OnInit, OnDestroy, Renderer2, ElementRef } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router'; // Import RouterLink and RouterLinkActive
import { CommonModule } from '@angular/common'; // Import CommonModule for ngClass, ngIf etc.


@Component({
  selector: 'app-header',
  standalone: true, // Use standalone: true for modern Angular components
  imports: [
    CommonModule, // Needed for ngClass, etc.
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  isMenuOpen = false;

  // Listener cleanup functions
  private unlistenOverlayClick: Function | null = null;
  private unlistenEscKey: Function | null = null;

  constructor(private renderer: Renderer2, private el: ElementRef) { }

  ngOnInit(): void {
    // Initialization logic if needed
  }

  openMenu(): void {
    if (this.isMenuOpen) return; // Prevent multiple opens

    const sidebar = this.el.nativeElement.querySelector('#mobile-sidebar');
    const overlay = this.el.nativeElement.querySelector('#menu-overlay');
    const hamburger = this.el.nativeElement.querySelector('#hamburger-button');

    if (sidebar && overlay && hamburger) {
      this.renderer.addClass(sidebar, 'is-open');
      this.renderer.addClass(overlay, 'is-open');
      this.renderer.addClass(document.body, 'mobile-menu-active'); // Add class to body
      this.renderer.setAttribute(sidebar, 'aria-hidden', 'false');
      this.renderer.setAttribute(hamburger, 'aria-expanded', 'true');
      this.isMenuOpen = true;
      this.addCloseListeners();
    }
  }

  closeMenu(): void {
    if (!this.isMenuOpen) return; // Prevent multiple closes

    const sidebar = this.el.nativeElement.querySelector('#mobile-sidebar');
    const overlay = this.el.nativeElement.querySelector('#menu-overlay');
    const hamburger = this.el.nativeElement.querySelector('#hamburger-button');

    if (sidebar && overlay && hamburger) {
      this.renderer.removeClass(sidebar, 'is-open');
      this.renderer.removeClass(overlay, 'is-open');
      this.renderer.removeClass(document.body, 'mobile-menu-active'); // Remove class from body
      this.renderer.setAttribute(sidebar, 'aria-hidden', 'true');
      this.renderer.setAttribute(hamburger, 'aria-expanded', 'false');
      this.isMenuOpen = false;
      this.removeCloseListeners();
    }
  }

  // Add listeners needed ONLY when menu is open
  private addCloseListeners(): void {
    const overlay = this.el.nativeElement.querySelector('#menu-overlay');
    if (overlay) {
      this.unlistenOverlayClick = this.renderer.listen(overlay, 'click', () => {
        this.closeMenu();
      });
    }

    // Listen on document for Escape key
    this.unlistenEscKey = this.renderer.listen('document', 'keydown', (event: KeyboardEvent) => {
      if (event.key === 'Escape' && this.isMenuOpen) {
        this.closeMenu();
      }
    });
  }

  // Remove listeners when menu closes or component is destroyed
  private removeCloseListeners(): void {
    if (this.unlistenOverlayClick) {
      this.unlistenOverlayClick();
      this.unlistenOverlayClick = null;
    }
    if (this.unlistenEscKey) {
      this.unlistenEscKey();
      this.unlistenEscKey = null;
    }
  }

  // Method to close menu when a sidebar link is clicked
  onSidebarLinkClick(): void {
    this.closeMenu();
  }

  ngOnDestroy(): void {
    // Ensure listeners are removed when component is destroyed
    this.removeCloseListeners();
    // Clean up body class if component destroyed while menu is open
    if (this.isMenuOpen) {
      this.renderer.removeClass(document.body, 'mobile-menu-active');
    }
  }
}