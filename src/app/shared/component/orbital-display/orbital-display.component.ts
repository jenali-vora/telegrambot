// src/app/shared/component/orbital-display/orbital-display.component.ts
import { Component, OnInit, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SelectedItem, TransferPanelComponent } from '../../../component/transfer-panel/transfer-panel.component'; // Correct path

@Component({
  selector: 'app-orbital-display',
  standalone: true,
  imports: [CommonModule, TransferPanelComponent],
  templateUrl: './orbital-display.component.html',
  styleUrls: ['./orbital-display.component.css']
})
export class OrbitalDisplayComponent implements OnInit {
  public isDragActiveLocal: boolean = false;

  @Input() centralButtonIconClass: string = 'fas fa-plus';
  @Input() items: SelectedItem[] = [];
  @Input() isUploading: boolean = false;
  @Input() batchShareableLink: string | null = null;

  // Inputs for circular progress and to pass to transfer-panel
  @Input() uploadProgressPercentage: number = 0;
  @Input() bytesSent: number = 0;
  @Input() totalBytes: number = 0;
  @Input() speedMBps: number = 0;
  @Input() etaFormatted: string = '--:--';

  @Output() requestFileUpload = new EventEmitter<void>();
  @Output() requestAddFilesFromPanel = new EventEmitter<void>();
  @Output() requestAddFolderFromPanel = new EventEmitter<void>();
  @Output() itemRemovedFromPanel = new EventEmitter<SelectedItem | undefined>();
  @Output() itemDownloadRequestedFromPanel = new EventEmitter<SelectedItem>();
  @Output() transferInitiatedFromPanel = new EventEmitter<void>();
  @Output() cancelUploadFromPanel = new EventEmitter<void>();

  private dragEnterCounter = 0;

  // SVG Circular Progress properties (Restored and adjusted)
  readonly radius = 52; // Adjusted for a slightly larger appearance if needed
  readonly strokeWidth = 12; // Adjusted stroke width as per new image
  readonly viewBoxSize = (this.radius + this.strokeWidth) * 2; // e.g. (52+12)*2 = 128
  readonly circumference = 2 * Math.PI * this.radius;


  constructor(private cdr: ChangeDetectorRef) { }

  ngOnInit(): void { }

  get showTransferPanelLogic(): boolean {
    return this.items.length > 0 || !!this.batchShareableLink;
  }

  get strokeDashoffset() {
    const offset = this.circumference - (this.uploadProgressPercentage / 100) * this.circumference;
    return Math.max(0, Math.min(offset, this.circumference)); // Clamp value
  }

  onCentralButtonClick(): void {
    if (!this.isUploading) {
      this.requestFileUpload.emit();
    }
  }

  // ... (keep all drag and drop handlers and event emitters as they were) ...
  onDragEnterArea(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isUploading) {
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
      return;
    }
    this.dragEnterCounter++;
    if (event.dataTransfer && event.dataTransfer.items && event.dataTransfer.items.length > 0) {
      this.isDragActiveLocal = true;
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onDragOverArea(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isUploading) {
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
      return;
    }
    if (event.dataTransfer) {
      if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
        event.dataTransfer.dropEffect = 'copy';
      } else {
        event.dataTransfer.dropEffect = 'none';
      }
    }
  }

  onDragLeaveArea(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isUploading) return;
    this.dragEnterCounter--;
    if (this.dragEnterCounter === 0) {
      this.isDragActiveLocal = false;
    }
  }

  onDropArea(event: DragEvent): void {
    event.preventDefault();
    if (this.isUploading) {
      event.stopPropagation();
      this.isDragActiveLocal = false;
      this.dragEnterCounter = 0;
      return;
    }
    this.isDragActiveLocal = false;
    this.dragEnterCounter = 0;
  }

  onRequestAddFilesPanel(): void { this.requestAddFilesFromPanel.emit(); }
  onRequestAddFolderPanel(): void { this.requestAddFolderFromPanel.emit(); }
  onItemRemovedPanel(item: SelectedItem | undefined): void { this.itemRemovedFromPanel.emit(item); }
  onItemDownloadRequestedPanel(item: SelectedItem): void { this.itemDownloadRequestedFromPanel.emit(item); }
  onTransferInitiatedPanel(): void { this.transferInitiatedFromPanel.emit(); }
  onCancelUploadPanel(): void { this.cancelUploadFromPanel.emit(); }
}