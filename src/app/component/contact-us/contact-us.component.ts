import { Component } from '@angular/core';
import { TestimonialSectionComponent } from "../../shared/component/testimonial-section/testimonial-section.component";
import { ScrollAnimationDirective } from '@app/shared/directives/scroll-animation.directive';

@Component({
  selector: 'app-contact-us',
  imports: [TestimonialSectionComponent, ScrollAnimationDirective],
  templateUrl: './contact-us.component.html',
  styleUrl: './contact-us.component.css'
})
export class ContactUsComponent {

}
