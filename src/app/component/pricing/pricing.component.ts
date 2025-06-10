import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FaqAccordionComponent } from "../faq-accordion/faq-accordion.component";
import { ComparisonTableComponent } from "../comparison-table/comparison-table.component";
import { ScrollAnimationDirective } from '@app/shared/directives/scroll-animation.directive';

// --- Interfaces for Dynamic Pricing Plans ---
interface PlanFeature {
  text: string;
  iconClass: string;
}

interface PricingPlan {
  name: string;
  price: string;
  cardClass: string;
  saveBanner?: string;
  button: {
    text: string;
    styleClass: string;
    link?: string;
  };
  priceDetails: string[];
  features: PlanFeature[];
}

@Component({
  selector: 'app-pricing',
  imports: [CommonModule, RouterLink, FaqAccordionComponent, ComparisonTableComponent, ScrollAnimationDirective],
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.css'
})
export class PricingComponent {

  // --- Dynamic Data for Pricing Cards ---
  pricingPlans: PricingPlan[] = [
    {
      name: 'Free',
      price: 'Free service',
      cardClass: 'free-card',
      button: { text: 'Start now', styleClass: 'btn-outline-primary', link: '/' },
      priceDetails: ['No payment required', 'With no registration'],
      features: [
        { text: 'Send files and folders up to <strong>2 GB</strong> per transfer*', iconClass: 'fas fa-check' },
        { text: '<strong>Unlimited</strong> transfers', iconClass: 'fas fa-check' },
        { text: 'No storage', iconClass: 'fas fa-times text-muted' },
        { text: 'Add custom logos, backgrounds and promotional messages', iconClass: 'fas fa-times text-muted' },
        { text: 'Outlook Add-in', iconClass: 'fab fa-microsoft text-muted' }
      ]
    },
    {
      name: 'Pro',
      price: '₹432 /month',
      cardClass: 'highlight-card pro-card',
      saveBanner: 'SAVE 52%',
      button: { text: 'Subscribe', styleClass: 'btn-pro' },
      priceDetails: [
        '<del>₹21,600</del> ₹10,368 every 2 years<br>(₹11,232 saved)',
        '1 user'
      ],
      features: [
        { text: 'Send and receive files/folders up to <strong>250 GB</strong> per transfer', iconClass: 'fas fa-check' },
        { text: '<strong>Unlimited</strong> transfers', iconClass: 'fas fa-check' },
        { text: '<strong>1 TB</strong> of storage', iconClass: 'fas fa-check' },
        { text: 'Add custom logos, backgrounds and promotional messages', iconClass: 'fas fa-check' },
        { text: 'Outlook Add-in', iconClass: 'fab fa-microsoft' }
      ]
    },
    {
      name: 'Team',
      price: '₹1,152 /month',
      cardClass: 'highlight-card team-card',
      saveBanner: 'SAVE 52%',
      button: { text: 'Subscribe', styleClass: 'btn-team' },
      priceDetails: [
        '<del>₹57,600</del> ₹27,648 every 2 years<br>(₹29,952 saved)',
        '10 users included'
      ],
      features: [
        { text: 'Send and receive files/folders up to <strong>500 GB</strong> per transfer', iconClass: 'fas fa-check' },
        { text: '<strong>Unlimited</strong> transfers', iconClass: 'fas fa-check' },
        { text: '<strong>2 TB</strong> of storage', iconClass: 'fas fa-check' },
        { text: 'Add custom logos, backgrounds and promotional messages', iconClass: 'fas fa-check' },
        { text: 'Outlook Add-in', iconClass: 'fab fa-microsoft' }
      ]
    },
    // --- NEW ENTERPRISE PLAN ADDED ---
    {
      name: 'Enterprise',
      price: 'Custom',
      cardClass: 'enterprise-card', // A specific class for this card
      button: { text: 'Contact Us', styleClass: 'btn-enterprise' },
      priceDetails: [
        '+ 10 users'
      ],
      features: [
        { text: 'Send and receive files/folders with <strong>customized</strong> size limit', iconClass: 'fas fa-check' },
        { text: '<strong>Unlimited</strong> transfers', iconClass: 'fas fa-check' },
        { text: '<strong>Customized</strong> storage', iconClass: 'fas fa-check' },
        { text: 'Add custom logos, backgrounds and promotional messages', iconClass: 'fas fa-check' },
        { text: 'Outlook Add-in', iconClass: 'fab fa-microsoft' },
        { text: 'Single sign-on (SSO)', iconClass: 'fas fa-cloud' } // Using a cloud icon for SSO
      ]
    }
  ];

  // This part for the logo carousel remains the same
  customers: { imageSrc: string; altText: string; industry: string; }[] = [
    { imageSrc: 'assets/image/cobra.webp', altText: 'Axxès Logo', industry: 'IT / TRANSPORT' },
    { imageSrc: 'assets/image/bdo.webp', altText: 'BDO Logo', industry: 'IT / SECURITY' },
    { imageSrc: 'assets/image/brooksbell.webp', altText: 'Brookes Bell Logo', industry: 'INDUSTRY' },
    { imageSrc: 'assets/image/cerap.webp', altText: 'CERAP Logo', industry: 'BANKING / INSURANCE' },
    { imageSrc: 'assets/image/ducati.webp', altText: 'Ducati Logo', industry: 'AUTOMOBILE' },
    { imageSrc: 'assets/image/vinci.webp', altText: 'Another Logo', industry: 'CATEGORY' }
  ];
  displayLogos: { imageSrc: string; altText: string; industry: string; }[] = [];

  constructor() {
    this.displayLogos = [...this.customers, ...this.customers];
  }
}