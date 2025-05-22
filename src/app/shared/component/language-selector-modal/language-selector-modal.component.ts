// src/app/components/language-selector-modal/language-selector-modal.component.ts
import { Component, Input, Output, EventEmitter, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Language {
  code: string;
  name: string; // English name
  nativeName: string; // Name in its own language
}

@Component({
  selector: 'app-language-selector-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './language-selector-modal.component.html',
  styleUrls: ['./language-selector-modal.component.css']
})
export class LanguageSelectorModalComponent {
  @Input() isOpen: boolean = false;
  @Input() currentLanguage: string = 'EN';
  @Input() availableLanguages: Language[] = [];
  @Input() appName: string = 'YourApp'; // Add an input for the app name

  @Output() closeModalRequest = new EventEmitter<void>();
  @Output() languageSelected = new EventEmitter<string>();
  @Output() contactRequested = new EventEmitter<void>();

  public Math = Math;
  
  constructor(private el: ElementRef) { }

  // Stop propagation for clicks inside the modal,
  // so document:click in parent doesn't close it prematurely
  @HostListener('click', ['$event'])
  onModalClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  selectLanguage(langCode: string): void {
    this.languageSelected.emit(langCode);
  }

  requestClose(): void {
    this.closeModalRequest.emit();
  }

  requestContact(): void {
    this.contactRequested.emit();
  }

  // Optional: Handle Escape key within the modal itself if it has focus control.
  // However, it's often managed by the parent component that toggles the modal.
  // @HostListener('document:keydown.escape', ['$event'])
  // onEscapeKey(event: KeyboardEvent): void {
  //   if (this.isOpen) {
  //     this.requestClose();
  //   }
  // }
}