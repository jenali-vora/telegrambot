import { AfterViewInit, Component, ElementRef, HostListener, Inject, PLATFORM_ID, Renderer2, NgZone, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/component/header/header.component';
import { FooterComponent } from './shared/component/footer/footer.component';
import { isPlatformBrowser } from '@angular/common';
import { TawkToChatService } from './shared/services/tawk-to-chat.service';

@Component({
  selector: 'app-root',
  standalone: true, // Make sure this is correct for your project setup
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements AfterViewInit, OnInit {
  title = 'telegrambot';
  private ringElements: NodeListOf<HTMLElement> | null = null;
  private isBrowser: boolean;
  private customCursorElement: HTMLElement | null = null; // Renamed for clarity
  private offsetX: number = 0;
  private offsetY: number = 0;
  private isCoarsePointerDevice: boolean = false; // Flag for touch-like devices

  constructor(
    private renderer: Renderer2,
    private elRef: ElementRef,
    private tawkToChatService: TawkToChatService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private ngZone: NgZone
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      // Check for coarse pointer using matchMedia
      this.isCoarsePointerDevice = window.matchMedia('(pointer: coarse)').matches;
    }
  }

  ngOnInit(): void {
    this.tawkToChatService.loadScript();
  }

  ngAfterViewInit(): void {
    if (this.isBrowser && !this.isCoarsePointerDevice) { // Only initialize for non-coarse (mouse) pointers
      this.customCursorElement = this.elRef.nativeElement.querySelector('#customCursor');
      if (this.customCursorElement) {
        this.ringElements = this.customCursorElement.querySelectorAll('.ring');
        // Calculate offset dynamically
        const rect = this.customCursorElement.getBoundingClientRect();
        this.offsetX = rect.width / 2;
        this.offsetY = rect.height / 2;
      } else {
        console.warn('Custom cursor element (#customCursor) not found.');
      }
    } else if (this.isBrowser && this.isCoarsePointerDevice) {
      console.info('Custom cursor JS interactions disabled for coarse pointer devices (e.g., touch). CSS will hide the element.');
      // Optionally, you could explicitly hide it with JS here too, but CSS is preferred.
      // const cursor = this.elRef.nativeElement.querySelector('#customCursor');
      // if (cursor) { this.renderer.setStyle(cursor, 'display', 'none'); }
    }
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    // Only run if it's a browser, NOT a coarse pointer, and elements are initialized
    if (this.isBrowser && !this.isCoarsePointerDevice && this.ringElements && this.ringElements.length > 0) {
      this.ngZone.runOutsideAngular(() => { // Performance optimization
        this.updateCursorPosition(event.clientX, event.clientY);
      });
    }
  }

  private updateCursorPosition(x: number, y: number): void {
    // This check is redundant if onMouseMove already checks ringElements, but safe
    if (this.ringElements) {
      this.ringElements.forEach(ring => {
        const transformValue = `translateX(${x - this.offsetX}px) translateY(${y - this.offsetY}px)`;
        this.renderer.setStyle(ring, 'transform', transformValue);
      });
    }
  }

  // Optional: Mouse down/up listeners should also check for !isCoarsePointerDevice
  @HostListener('window:mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    if (this.isBrowser && !this.isCoarsePointerDevice && this.ringElements) {
      // Your mousedown logic
    }
  }

  @HostListener('window:mouseup', ['$event'])
  onMouseUp(event: MouseEvent): void {
    if (this.isBrowser && !this.isCoarsePointerDevice && this.ringElements) {
      // Your mouseup logic
    }
  }

  // REMOVE ANY TOUCH EVENT LISTENERS like touchstart, touchmove, touchend
  // as they are not needed if the cursor is hidden on touch devices.
}