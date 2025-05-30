import { Component, OnInit, Input, Output, EventEmitter, ChangeDetectorRef, HostBinding } from '@angular/core';
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
  @Output() filesDroppedInArea = new EventEmitter<FileList>(); // New Output

  private dragEnterCounter = 0;

  readonly radius = 52;
  readonly strokeWidth = 12;
  readonly viewBoxSize = (this.radius + this.strokeWidth) * 2;
  readonly circumference = 2 * Math.PI * this.radius;

  @HostBinding('style.--component-circumference-val')
  get hostCircumference(): number {
    return this.circumference;
  }

  constructor(private cdr: ChangeDetectorRef) {
    this.uploadProgressPercentage = 0;
  }

  ngOnInit(): void { }

  get showCircularProgressUI(): boolean {
    return this.isUploading && this.items.length > 0 && !this.batchShareableLink;
  }

  get showTransferPanelLogic(): boolean {
    return this.items.length > 0 || !!this.batchShareableLink;
  }
  get waterFillTopStyle(): string {
    const wrapperHeight = 180; // The height of .circular-progress-wrapper-new in CSS
    const safetyBuffer = 30;   // Extra pixels to push water down at 0% to compensate for rotation

    // If the circular progress UI itself shouldn't be shown
    if (!this.showCircularProgressUI) {
      return `${wrapperHeight + safetyBuffer}px`; // Water is hidden far below
    }

    // If the UI is shown, but progress is exactly 0%
    if (this.uploadProgressPercentage === 0) {
      return `${wrapperHeight + safetyBuffer}px`; // Water is hidden far below due to buffer
    }

    // If UI is shown and progress is > 0%
    // Calculate how much of the height should be "empty" from the top
    const fillRatio = this.uploadProgressPercentage / 100;
    const topPosition = wrapperHeight * (1 - fillRatio);

    // Clamp the value between 0 (fully filled) and wrapperHeight (empty)
    return `${Math.max(0, Math.min(wrapperHeight, topPosition))}px`;
  }
  
  private get _normalProgressStrokeDashoffset(): number {
    const offset = this.circumference - (this.uploadProgressPercentage / 100) * this.circumference;
    return Math.max(0, Math.min(offset, this.circumference));
  }

  get isAtZeroProgressAndUploading(): boolean {
    return this.isUploading && this.uploadProgressPercentage === 0;
  }

  get dynamicStrokeDasharray(): string {
    if (this.isAtZeroProgressAndUploading) {
      const dotLength = 0.1;
      return `${dotLength}, ${this.circumference - dotLength}`;
    } else {
      return this.circumference.toString();
    }
  }

  get dynamicStrokeDashoffset(): string {
    if (this.isAtZeroProgressAndUploading) {
      return '0';
    } else {
      return this._normalProgressStrokeDashoffset.toString();
    }
  }

  onNewTransferPanel(): void {
    this.newTransferFromPanel.emit();
  }

  onCentralButtonClick(): void {
    if (this.items.length === 0 && !this.isUploading && !this.batchShareableLink) {
      this.requestFileUpload.emit();
    }
  }

  onDragEnterArea(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.items.length > 0 || this.isUploading || this.batchShareableLink) {
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
      this.isDragActiveLocal = false;
      this.dragEnterCounter = 0;
      return;
    }

    this.dragEnterCounter++;
    if (event.dataTransfer && event.dataTransfer.items && event.dataTransfer.items.length > 0) {
      this.isDragActiveLocal = true;
      event.dataTransfer.dropEffect = 'copy';
    } else {
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
    }
  }

  onDragOverArea(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.items.length > 0 || this.isUploading || this.batchShareableLink) {
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
      // No need to change isDragActiveLocal here, onDragEnterArea handles entry.
      return;
    }

    if (event.dataTransfer) {
      if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
        event.dataTransfer.dropEffect = 'copy';
        this.isDragActiveLocal = true; // Keep highlighting if valid
      } else {
        event.dataTransfer.dropEffect = 'none';
        this.isDragActiveLocal = false; // Turn off if no valid items
      }
    }
  }

  onDragLeaveArea(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.dragEnterCounter--;
    if (this.dragEnterCounter <= 0) {
      this.isDragActiveLocal = false;
      this.dragEnterCounter = 0;
    }
  }

  onDropArea(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation(); // Crucial: stop event from bubbling to window listeners

    this.isDragActiveLocal = false;
    this.dragEnterCounter = 0;

    if (this.items.length > 0 || this.isUploading || this.batchShareableLink) {
      console.log('OrbitalDisplay: Drop ignored, component not in receptive state.');
      return;
    }

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.filesDroppedInArea.emit(files);
    } else {
      console.log('OrbitalDisplay: Drop event occurred but no files found.');
    }
  }

  onRequestAddFilesPanel(): void { this.requestAddFilesFromPanel.emit(); }
  onRequestAddFolderPanel(): void { this.requestAddFolderFromPanel.emit(); }
  onItemRemovedPanel(item: SelectedItem | undefined): void { this.itemRemovedFromPanel.emit(item); }
  onItemDownloadRequestedPanel(item: SelectedItem): void { this.itemDownloadRequestedFromPanel.emit(item); }
  onTransferInitiatedPanel(): void { this.transferInitiatedFromPanel.emit(); }
  onCancelUploadPanel(): void { this.cancelUploadFromPanel.emit(); }
}