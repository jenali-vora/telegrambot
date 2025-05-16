import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { NgbCarouselModule } from '@ng-bootstrap/ng-bootstrap'; // Import NgbCarouselModule

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
    NgbCarouselModule // Add NgbCarouselModule here
  ],
  templateUrl: './testimonial-section.component.html',
  styleUrls: ['./testimonial-section.component.css']
})
export class TestimonialSectionComponent {
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
    }
  ];

  // NgbCarousel settings (can be set in the template directly too)
  showNavigationArrows = true;
  showNavigationIndicators = true;
  interval = 3000; // Autoplay interval in milliseconds
  wrap = true;     // Whether the carousel should cycle continuously
  pauseOnHover = true;
  keyboard = true; // Navigate with keyboard
  animation = true; // Use CSS slide transition (available in newer ng-bootstrap versions)


  constructor() { }

  onFabClick() {
    console.log('FAB clicked!');
  }
}