import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core'; // Import OnDestroy
import { NgbCarouselModule } from '@ng-bootstrap/ng-bootstrap';
import { BreakpointObserver } from '@angular/cdk/layout'; // Import BreakpointObserver
import { Subject } from 'rxjs';
import { takeUntil, distinctUntilChanged } from 'rxjs/operators';

interface Testimonial {
  imageUrl: string;
  name: string;
  quote: string;
}

@Component({
  selector: 'app-testimonial-section',
  standalone: true,
  imports: [
    CommonModule,
    NgbCarouselModule
  ],
  templateUrl: './testimonial-section.component.html',
  styleUrls: ['./testimonial-section.component.css']
})
export class TestimonialSectionComponent implements OnInit, OnDestroy {
  testimonials: Testimonial[] = [
    {
      imageUrl: 'assets/image/woman1.png',
      name: 'Veronica D.',
      quote: 'Amazing service! We were tired of sending large files via e-mail and getting errors. Now, everything solved. Thanks for the great idea.'
    },
    {
      imageUrl: 'assets/image/woman2.png',
      name: 'Eva N.',
      quote: 'Instead of using an external hard-disk, I am using Transfer with huge storage space. I can download them whenever I need them.'
    },
    {
      imageUrl: 'assets/image/man1.png',
      name: 'Boris V.',
      quote: 'Thanks for providing this service, I don\'t need to send my files one by one to each of my friends anymore.'
    },
    {
      imageUrl: 'assets/image/woman1.png', // Example
      name: 'Sarah M.',
      quote: 'A game changer for our team! Collaboration has never been smoother.'
    },
    {
      imageUrl: 'assets/image/man1.png', // Example
      name: 'John B.',
      quote: 'Reliable, fast, and exactly what I needed. Highly recommend this service.'
    },
    {
      imageUrl: 'assets/image/woman2.png', // Example
      name: 'Linda K.',
      quote: 'The customer support is fantastic and the platform is incredibly easy to use.'
    }
  ];

  chunkedTestimonials: Testimonial[][] = [];
  itemsPerSlide = 3; // Default for desktop

  // NgbCarousel settings
  showNavigationArrows = true;
  showNavigationIndicators = true;
  interval = 4000;
  wrap = true;
  pauseOnHover = true;
  keyboard = true;
  animation = true;

  private destroy$ = new Subject<void>();

  constructor(private breakpointObserver: BreakpointObserver) { }

  ngOnInit(): void {
    this.breakpointObserver
      .observe(['(max-width: 992px)']) // This matches your CSS media query for tablet/mobile
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged((prev, curr) => prev.matches === curr.matches) // Only emit if 'matches' changes
      )
      .subscribe(result => {
        if (result.matches) { // Screen is 992px wide or less
          this.itemsPerSlide = 1;
        } else { // Screen is wider than 992px
          this.itemsPerSlide = 3;
        }
        this.chunkTestimonials();
      });
  }

  chunkTestimonials(): void {
    this.chunkedTestimonials = [];
    if (this.testimonials && this.testimonials.length > 0) {
      for (let i = 0; i < this.testimonials.length; i += this.itemsPerSlide) {
        this.chunkedTestimonials.push(this.testimonials.slice(i, i + this.itemsPerSlide));
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onFabClick() {
    console.log('FAB clicked!');
  }
}