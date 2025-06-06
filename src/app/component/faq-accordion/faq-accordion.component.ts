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
      question: 'Can I upload files without creating an account?',
      answer: 'Yes, you can upload files or folders up to 5 GB without signing up. It is a quick and easy way to share content without any commitment.'
    },
    {
      question: 'What are the limitations for non-logged-in users?',
      answer: 'You can upload a maximum of 5 GB per session.Uploaded file links are valid only for 5 days.After 5 days, the files will be automatically deleted.You cannot view or manage uploaded files later unless you log in.'
    },
    {
      question: 'What do I get if I log in or create an account?',
      answer: 'Increased upload limit beyond 5 GB.Higher upload speed for faster transfers.Access to all previously uploaded files in your personal dashboard.Download and preview your files anytime.Shared file links never expire unless you delete them.Option to organize files into folders for better management.'
    },
    {
      question: 'Can I manage files uploaded without an account?',
      answer: 'No. For security and privacy reasons, we don’t store user identity for guest uploads. To manage, delete, or re-access files later, you need to log in.'
    },
    {
      question: 'What happens if I share a link as a guest?',
      answer: 'It will be valid for only 5 days.After that, the link will no longer work.To make links permanent, you must log in before uploading.'
    },
    {
      question: ' Is my data secure on this platform?',
      answer: 'Yes. We use encryption and secure servers to keep your files safe. Logged-in users also have access to privacy controls to manage who can view or download their files.'
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