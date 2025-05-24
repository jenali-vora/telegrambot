import { Component } from '@angular/core';
import { FaqAccordionComponent } from "../faq-accordion/faq-accordion.component";
import { ComparisonTableComponent } from "../comparison-table/comparison-table.component";
import { ScrollAnimationDirective } from '@app/shared/directives/scroll-animation.directive';
interface CustomerLogo {
  imageSrc: string;
  altText: string;
  industry: string;
}

@Component({
  selector: 'app-pricing',
  imports: [FaqAccordionComponent, ComparisonTableComponent, ScrollAnimationDirective],
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.css'
})
export class PricingComponent {
  customers: CustomerLogo[] = [
    { imageSrc: 'assets/image/cobra.webp', altText: 'Axxès Logo', industry: 'IT / TRANSPORT' },
    { imageSrc: 'assets/image/bdo.webp', altText: 'BDO Logo', industry: 'IT / SECURITY' },
    { imageSrc: 'assets/image/brooksbell.webp', altText: 'Brookes Bell Logo', industry: 'INDUSTRY' },
    { imageSrc: 'assets/image/cerap.webp', altText: 'CERAP Logo', industry: 'BANKING / INSURANCE' },
    { imageSrc: 'assets/image/ducati.webp', altText: 'Ducati Logo', industry: 'AUTOMOBILE' },
    { imageSrc: 'assets/image/vinci.webp', altText: 'Another Logo', industry: 'CATEGORY' } // Add all your logos
    // ... add more customer objects here
  ];
  displayLogos: CustomerLogo[] = [];

  constructor() {
    // Create the doubled array for the template
    this.displayLogos = [...this.customers, ...this.customers];
  }
}
