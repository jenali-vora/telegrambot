// src/app/component/faq-accordion/faq-accordion.component.ts
import { Component, Input } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common'; // Import NgClass

// Interface for FAQ items
export interface FaqItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-faq-accordion',
  standalone: true,
  imports: [CommonModule, NgClass], // Add NgClass here
  templateUrl: './faq-accordion.component.html',
  styleUrls: ['./faq-accordion.component.css']
})
export class FaqAccordionComponent {

  // Input to receive FAQ data from parent component
  @Input() faqItems: FaqItem[] = [ // Default/Example data (replace with actual data source)
    {
      question: 'Where are TransferNow files hosted?',
      answer: 'By using our service to send or receive your files you have a dedicated and secure global cloud infrastructure where files are stored and encrypted on disk (AES-XTS 256 bits) in datacenters (AICPA SOC 2 Type II) on the European, American and Asian continents.'
    },
    {
      question: 'Is my personal data safe?',
      answer: 'Yes, your personal data is handled with utmost care according to GDPR and other relevant privacy regulations. We implement robust security measures to protect your information.'
    },
    {
      question: 'Do you open and/or use my files?',
      answer: 'Absolutely not. We operate under a zero-knowledge principle regarding your file content. Files are encrypted during transfer and at rest, and we do not access or scan the content of your files.'
    },
    {
      question: 'Are my files safe?',
      answer: 'Yes, file safety is paramount. Files are encrypted using strong AES-256 encryption both during transit (TLS) and while stored on our servers. Access is strictly controlled.'
    }
  ];

  // State to track the currently open item index. Start with first item open (index 0).
  activeIndex: number | null = 0;

  /**
   * Toggles the visibility of an FAQ item.
   * If the clicked item is already open, it closes it.
   * Otherwise, it opens the clicked item and closes any other open item.
   * @param index The index of the FAQ item clicked.
   */
  toggleItem(index: number): void {
    if (this.activeIndex === index) {
      // Clicked on the already open item, so close it
      this.activeIndex = null;
    } else {
      // Clicked on a different item, so open it
      this.activeIndex = index;
    }
  }
}