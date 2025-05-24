import { Component } from '@angular/core';
import { FaqAccordionComponent } from "../faq-accordion/faq-accordion.component";
import { ScrollAnimationDirective } from '@app/shared/directives/scroll-animation.directive';

@Component({
  selector: 'app-faq',
  imports: [FaqAccordionComponent,ScrollAnimationDirective],
  templateUrl: './faq.component.html',
  styleUrl: './faq.component.css'
})
export class FaqComponent {

}
