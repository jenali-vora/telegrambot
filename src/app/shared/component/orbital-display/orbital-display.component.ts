// src/app/shared/component/orbital-display/orbital-display.component.ts
import { Component, OnInit, Input, Output, EventEmitter, ChangeDetectorRef, HostBinding } from '@angular/core'; // Added HostBinding
import { CommonModule } from '@angular/common';
import { SelectedItem, TransferPanelComponent } from '../../../component/transfer-panel/transfer-panel.component';

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

  @Input() uploadProgressPercentage: number = 0;
  @Input() bytesSent: number = 0;
  @Input() totalBytes: number = 0;
  @Input() speedMBps: number = 0;
  @Input() etaFormatted: string = '--:--';
  @Input() generalUploadStatusMessage: string = '';

  @Output() requestFileUpload = new EventEmitter<void>();
  @Output() requestAddFilesFromPanel = new EventEmitter<void>();
  @Output() requestAddFolderFromPanel = new EventEmitter<void>();
  @Output() itemRemovedFromPanel = new EventEmitter<SelectedItem | undefined>();
  @Output() itemDownloadRequestedFromPanel = new EventEmitter<SelectedItem>();
  @Output() transferInitiatedFromPanel = new EventEmitter<void>();
  @Output() cancelUploadFromPanel = new EventEmitter<void>();
  @Output() newTransferFromPanel = new EventEmitter<void>();

  private dragEnterCounter = 0;

  // SVG Circular Progress properties
  readonly radius = 52;
  readonly strokeWidth = 12;
  readonly viewBoxSize = (this.radius + this.strokeWidth) * 2;
  readonly circumference = 2 * Math.PI * this.radius;

  // Make circumference available as a CSS variable on the host element
  @HostBinding('style.--component-circumference-val')
  get hostCircumference(): number {
    return this.circumference;
  }

  constructor(private cdr: ChangeDetectorRef) { }

  ngOnInit(): void { }

  get showTransferPanelLogic(): boolean {
    return this.items.length > 0 || !!this.batchShareableLink;
  }

  // Helper to calculate stroke-dashoffset for normal progress
  private get _normalProgressStrokeDashoffset(): number {
    const offset = this.circumference - (this.uploadProgressPercentage / 100) * this.circumference;
    return Math.max(0, Math.min(offset, this.circumference)); // Clamp value
  }

  // Determines if the "spinning dot" state should be active
  get isAtZeroProgressAndUploading(): boolean {
    return this.isUploading && this.uploadProgressPercentage === 0;
  }

  // Dynamically bound to [style.strokeDasharray] of the progress circle
  get dynamicStrokeDasharray(): string {
    if (this.isAtZeroProgressAndUploading) {
      // For the spinning dot: a very small dash length (e.g., 0.1 or 1)
      // and a gap covering the rest of the circumference.
      // stroke-linecap: round will make this small dash appear as a dot.
      const dotLength = 0.1;
      return `${dotLength}, ${this.circumference - dotLength}`;
    } else {
      // For normal progress: the dash is the full circumference.
      // stroke-dashoffset will then reveal the correct portion.
      return this.circumference.toString();
    }
  }

  // Dynamically bound to [style.strokeDashoffset] of the progress circle
  get dynamicStrokeDashoffset(): string {
    if (this.isAtZeroProgressAndUploading) {
      // For the spinning dot, the CSS animation will control the offset.
      // Set to 0 as the initial state for the animation.
      return '0';
    } else {
      // For normal progress, use the calculated offset.
      return this._normalProgressStrokeDashoffset.toString();
    }
  }

  onNewTransferPanel(): void {
    this.newTransferFromPanel.emit();
  }

  onCentralButtonClick(): void {
    if (!this.isUploading) {
      this.requestFileUpload.emit();
    }
  }

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
    // Added stopPropagation for consistency, and reset drag state if uploading
    if (this.isUploading) {
      event.stopPropagation();
      this.isDragActiveLocal = false;
      this.dragEnterCounter = 0;
      return;
    }
    this.isDragActiveLocal = false;
    this.dragEnterCounter = 0;
    // Actual drop handling (emitting files) would go here
  }

  onRequestAddFilesPanel(): void { this.requestAddFilesFromPanel.emit(); }
  onRequestAddFolderPanel(): void { this.requestAddFolderFromPanel.emit(); }
  onItemRemovedPanel(item: SelectedItem | undefined): void { this.itemRemovedFromPanel.emit(item); }
  onItemDownloadRequestedPanel(item: SelectedItem): void { this.itemDownloadRequestedFromPanel.emit(item); }
  onTransferInitiatedPanel(): void { this.transferInitiatedFromPanel.emit(); }
  onCancelUploadPanel(): void { this.cancelUploadFromPanel.emit(); }
}