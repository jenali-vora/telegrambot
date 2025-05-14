import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, HostListener, Inject } from '@angular/core';
import { HeaderComponent } from '../header/header.component';
import { FooterComponent } from '../footer/footer.component';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-layout',
  imports: [CommonModule, HeaderComponent, FooterComponent, RouterOutlet],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent {
  showScrollToTopButton: boolean = false;
  private scrollThreshold: number = 100; // Pixels after which the button appears

  constructor(@Inject(DOCUMENT) private document: Document) { }

  ngOnInit(): void {
    // Initial check in case the page is already scrolled on load
    this.checkScrollPosition();
  }

  // Listen to scroll events on the window
  @HostListener('window:scroll', ['$event']) // Pass $event if you need it, otherwise [] is fine
  onWindowScroll(): void {
    this.checkScrollPosition();
  }

  private checkScrollPosition(): void {
    const scrollPosition = window.pageYOffset || this.document.documentElement.scrollTop || this.document.body.scrollTop || 0;

    if (scrollPosition > this.scrollThreshold) {
      this.showScrollToTopButton = true;
    } else {
      this.showScrollToTopButton = false;
    }
  }

  // Method to scroll to the top of the page
  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Fallback for older browsers (optional)
    // if (!('scrollBehavior' in document.documentElement.style)) {
    //   this.document.body.scrollTop = 0; // For Safari
    //   this.document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
    // }
  }
}
