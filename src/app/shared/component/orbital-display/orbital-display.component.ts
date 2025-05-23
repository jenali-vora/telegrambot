// src/app/shared/component/orbital-display/orbital-display.component.ts
import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-orbital-display',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './orbital-display.component.html',
  styleUrls: ['./orbital-display.component.css']
})
export class OrbitalDisplayComponent implements OnInit {
  public isDragActiveLocal: boolean = false; // Local state for highlight

  @Input() centralButtonIconClass: string = 'fas fa-plus';
  @Output() requestFileUpload = new EventEmitter<void>();

  private dragEnterCounter = 0;

  constructor() { }

  ngOnInit(): void {
  }

  onCentralButtonClick(): void {
    this.requestFileUpload.emit();
  }

  onDragEnterArea(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragEnterCounter++;
    if (event.dataTransfer && event.dataTransfer.items && event.dataTransfer.items.length > 0) {
      this.isDragActiveLocal = true;
      // event.dataTransfer is confirmed not null here by the condition above
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onDragOverArea(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) { // Ensure dataTransfer object exists
      if (this.isDragActiveLocal) {
        event.dataTransfer.dropEffect = 'copy';
      } else {
        // Even if not isDragActiveLocal (e.g., drag started over a child),
        // set dropEffect based on current content.
        // The outer `if (event.dataTransfer)` ensures `event.dataTransfer.items` access is safe.
        if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
          event.dataTransfer.dropEffect = 'copy';
        } else {
          event.dataTransfer.dropEffect = 'none';
        }
      }
    } else {
      // If dataTransfer is null, we can't set dropEffect.
      // This might happen if the drag operation doesn't involve transferable items.
    }
  }

  onDragLeaveArea(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragEnterCounter--;
    if (this.dragEnterCounter === 0) {
      this.isDragActiveLocal = false;
    }
  }

  onDropArea(event: DragEvent): void {
    event.preventDefault();
    // DO NOT call event.stopPropagation() here.
    this.isDragActiveLocal = false;
    this.dragEnterCounter = 0;
    // File processing will be handled by HomeComponent
    // Accessing event.dataTransfer.files will be done in HomeComponent's drop handler,
    // which should also include null checks.
  }
}