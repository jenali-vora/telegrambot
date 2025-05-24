// src/app/shared/directives/scroll-animation.directive.ts
import { Directive, ElementRef, Input, OnInit, OnDestroy, Renderer2, HostBinding, NgZone } from '@angular/core';

@Directive({
    selector: '[appScrollAnimation]',
    standalone: true,
})
export class ScrollAnimationDirective implements OnInit, OnDestroy {
    @Input('appScrollAnimation') animationClass!: string; // e.g., 'slide-in-left'
    @Input() animationThreshold: number = 0.1;
    @Input() animationDelay: string = '0s';
    @Input() triggerOnce: boolean = true;

    private observer!: IntersectionObserver;
    private isVisible = false; // To track visibility state for triggerOnce logic

    @HostBinding('class.scroll-animate-base') addBaseClass = true;

    constructor(
        private el: ElementRef<HTMLElement>,
        private renderer: Renderer2,
        private zone: NgZone // Inject NgZone
    ) {}

    ngOnInit(): void {
        if (!this.animationClass) {
            console.error('ScrollAnimationDirective: appScrollAnimation class name is required.');
            return;
        }

        this.renderer.addClass(this.el.nativeElement, this.animationClass);
        this.renderer.setStyle(this.el.nativeElement, 'transition-delay', this.animationDelay);

        const options = {
            root: null,
            rootMargin: '0px',
            threshold: this.animationThreshold,
        };

        // Run IntersectionObserver outside Angular's zone to prevent unnecessary change detection
        this.zone.runOutsideAngular(() => {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        if (this.isVisible && this.triggerOnce) return; // Already made visible and triggerOnce

                        // Use setTimeout to ensure the class is added after initial styles are processed
                        // This is often more robust for above-the-fold elements than requestAnimationFrame alone
                        setTimeout(() => {
                            this.zone.run(() => { // Run class addition back in Angular zone if it might trigger CD
                                this.renderer.addClass(this.el.nativeElement, 'is-visible');
                                this.isVisible = true;
                                if (this.triggerOnce) {
                                    this.observer.unobserve(this.el.nativeElement);
                                }
                            });
                        }, 20); // A small delay, e.g., 20-50ms. Adjust if needed.

                    } else {
                        if (!this.triggerOnce && this.isVisible) {
                             this.zone.run(() => {
                                this.renderer.removeClass(this.el.nativeElement, 'is-visible');
                                this.isVisible = false;
                             });
                        }
                    }
                });
            }, options);

            this.observer.observe(this.el.nativeElement);
        });
    }

    ngOnDestroy(): void {
        if (this.observer) {
            this.observer.disconnect();
        }
    }
}