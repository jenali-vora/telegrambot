import { Component, OnInit, Input, Output, EventEmitter, ChangeDetectorRef, HostBinding, OnDestroy, SimpleChanges, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SelectedItem, TransferPanelComponent } from '../../../component/transfer-panel/transfer-panel.component'; // Ensure SelectedItem is exported and has 'progress'
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-orbital-display',
  standalone: true,
  imports: [CommonModule, TransferPanelComponent, RouterLink],
  templateUrl: './orbital-display.component.html',
  styleUrls: ['./orbital-display.component.css']
})
export class OrbitalDisplayComponent implements OnInit, OnDestroy, OnChanges {
  public isDragActiveLocal: boolean = false;

  @Input() centralButtonIconClass: string = 'fas fa-plus';
  @Input() items: SelectedItem[] = [];
  @Input() isUploading: boolean = false;
  @Input() batchShareableLink: string | null = null;

  @Input() uploadProgressPercentage: number = 0; // This might be current file's individual progress from parent
  @Input() bytesSent: number = 0; // Assume this is overall cumulative bytes sent for the batch
  @Input() totalBytes: number = 0; // Assume this is overall total bytes for the batch
  @Input() speedMBps: number = 0;
  @Input() etaFormatted: string = '--:--';
  @Input() generalUploadStatusMessage: string = '';

  @Output() requestFileUpload = new EventEmitter<void>();
  @Output() requestAddFilesFromPanel = new EventEmitter<void>();
  @Output() requestAddFolderFromPanel = new EventEmitter<void>();
  @Output() requestFolderUpload = new EventEmitter<void>();
  @Output() itemRemovedFromPanel = new EventEmitter<SelectedItem | undefined>();
  @Output() itemDownloadRequestedFromPanel = new EventEmitter<SelectedItem>();
  @Output() transferInitiatedFromPanel = new EventEmitter<void>();
  @Output() cancelUploadFromPanel = new EventEmitter<void>();
  @Output() newTransferFromPanel = new EventEmitter<void>();
  @Output() filesDroppedInArea = new EventEmitter<FileList>();
  @Output() dataTransferItemsDropped = new EventEmitter<DataTransferItemList>();

  private dragEnterCounter = 0;

  readonly radius = 52;
  readonly strokeWidth = 12;
  readonly clipRadius = this.radius - (this.strokeWidth / 2);
  readonly viewBoxSize = (this.radius + this.strokeWidth) * 2;
  readonly circumference = 2 * Math.PI * this.radius;

  public waveAnimationPhase = 0;
  private waveAnimationInterval: any;


  @HostBinding('style.--component-circumference-val')
  get hostCircumference(): number {
    return this.circumference;
  }

  constructor(private cdr: ChangeDetectorRef) { }

  ngOnChanges(changes: SimpleChanges): void {
    let triggerChangeDetection = false;
    // Include bytesSent and totalBytes for change detection if they affect _actualOverallProgressPercentage
    if (changes['uploadProgressPercentage'] || changes['isUploading'] || changes['batchShareableLink'] || changes['items'] || changes['bytesSent'] || changes['totalBytes']) {
      triggerChangeDetection = true;
    }

    if (triggerChangeDetection) {
      this.cdr.detectChanges();
    }
  }

  // NEW: Getter for the actual overall progress percentage
  get _actualOverallProgressPercentage(): number {
    if (this.batchShareableLink) { // If a shareable link exists, upload is 100% complete
      return 100;
    }
    if (this.isUploading && this.totalBytes > 0 && this.bytesSent >= 0) {
      const progress = (this.bytesSent / this.totalBytes) * 100;
      return Math.min(Math.max(progress, 0), 100); // Clamp between 0 and 100
    }
    // If not uploading, but items were present and parent signaled 100% (covers post-upload completion)
    if (!this.isUploading && this.items.length > 0 && this.uploadProgressPercentage >= 100) {
      return 100;
    }
    // Default: Pre-upload, initial state, or error state where calculation isn't possible
    return 0;
  }

  ngOnInit(): void {
    this.waveAnimationInterval = setInterval(() => {
      // MODIFIED: Use _actualOverallProgressPercentage for wave animation condition
      if (this.isUploading && this._actualOverallProgressPercentage > 0 && this._actualOverallProgressPercentage < 100 && !this.isAtZeroProgressAndUploading && !this.isUploadComplete) {
        this.waveAnimationPhase += 0.04;
        if (this.waveAnimationPhase > Math.PI * 4) {
          this.waveAnimationPhase -= Math.PI * 4;
        }
        this.cdr.detectChanges();
      }
    }, 50);
  }

  ngOnDestroy(): void {
    if (this.waveAnimationInterval) {
      clearInterval(this.waveAnimationInterval);
    }
  }

  get showTransferPanelLogic(): boolean {
    return this.items.length > 0 || !!this.batchShareableLink;
  }

  private get _normalProgressStrokeDashoffset(): number {
    // MODIFIED: Use _actualOverallProgressPercentage
    const offset = this.circumference - (this._actualOverallProgressPercentage / 100) * this.circumference;
    return Math.max(0, Math.min(offset, this.circumference));
  }

  get isAtZeroProgressAndUploading(): boolean {
    // MODIFIED: Use _actualOverallProgressPercentage
    return this.isUploading && this.items.length > 0 && this._actualOverallProgressPercentage === 0;
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

  get isUploadComplete(): boolean {
    // MODIFIED: Use _actualOverallProgressPercentage
    if (this.batchShareableLink) return true;
    return this._actualOverallProgressPercentage >= 100 && !this.isUploading && this.items.length > 0;
  }

  getWaterPathD(): string {
    // MODIFIED: Use _actualOverallProgressPercentage
    const currentProgress = this._actualOverallProgressPercentage;
    const vbCenter = this.viewBoxSize / 2;
    const r_for_wave = this.clipRadius;
    const padding = 5;

    const waterEdgeXBase = (vbCenter - r_for_wave) + (currentProgress / 100) * (2 * r_for_wave);
    const waveAmplitude = this.isUploadComplete ? 0 : r_for_wave * 0.15; // isUploadComplete now uses _actualOverallProgressPercentage

    const yTopBoundary_wave = vbCenter - r_for_wave;
    const yBottomBoundary_wave = vbCenter + r_for_wave;

    const xAtWaveStart = waterEdgeXBase + (waveAmplitude * Math.sin(this.waveAnimationPhase + Math.PI * 0.3));
    const xAtWaveEnd = waterEdgeXBase + (waveAmplitude * Math.sin(this.waveAnimationPhase * 0.9 + Math.PI * 1.1));

    const cp1y = vbCenter - r_for_wave * 0.5;
    const cp1x = waterEdgeXBase + waveAmplitude * 1.2 * Math.sin(this.waveAnimationPhase * 0.7 + Math.PI * 0.6);
    const cp2y = vbCenter + r_for_wave * 0.5;
    const cp2x = waterEdgeXBase - waveAmplitude * 1.2 * Math.sin(this.waveAnimationPhase * 1.1 + Math.PI * 0.1);

    let d = `M ${0 - padding}, ${0 - padding}`;
    d += ` L ${xAtWaveStart}, ${0 - padding}`;
    d += ` L ${xAtWaveStart}, ${yTopBoundary_wave}`;
    d += ` C ${cp1x}, ${cp1y}, ${cp2x}, ${cp2y}, ${xAtWaveEnd}, ${yBottomBoundary_wave}`;
    d += ` L ${xAtWaveEnd}, ${this.viewBoxSize + padding}`;
    d += ` L ${0 - padding}, ${this.viewBoxSize + padding}`;
    d += ` Z`;
    return d;
  }

  onSelectFolderClick(event: MouseEvent): void {
    event.stopPropagation();
    if (this.items.length === 0 && !this.isUploading && !this.batchShareableLink) {
      this.requestFolderUpload.emit();
    }
  }
  onNewTransferPanel(): void { this.newTransferFromPanel.emit(); }
  onCentralButtonClick(): void {
    if (this.items.length === 0 && !this.isUploading && !this.batchShareableLink) {
      this.requestFileUpload.emit();
    }
  }

  onDragEnterArea(event: DragEvent): void {
    event.preventDefault(); event.stopPropagation();
    if (this.items.length > 0 || this.isUploading || this.batchShareableLink) {
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
      this.isDragActiveLocal = false; this.dragEnterCounter = 0; return;
    }
    this.dragEnterCounter++;
    if (event.dataTransfer && event.dataTransfer.items && event.dataTransfer.items.length > 0) {
      this.isDragActiveLocal = true; event.dataTransfer.dropEffect = 'copy';
    } else { if (event.dataTransfer) event.dataTransfer.dropEffect = 'none'; }
  }

  onDragOverArea(event: DragEvent): void {
    event.preventDefault(); event.stopPropagation();
    if (this.items.length > 0 || this.isUploading || this.batchShareableLink) {
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none'; return;
    }
    if (event.dataTransfer) {
      if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
        event.dataTransfer.dropEffect = 'copy'; this.isDragActiveLocal = true;
      } else { event.dataTransfer.dropEffect = 'none'; this.isDragActiveLocal = false; }
    }
  }

  onDragLeaveArea(event: DragEvent): void {
    event.preventDefault(); event.stopPropagation();
    this.dragEnterCounter--;
    if (this.dragEnterCounter <= 0) { this.isDragActiveLocal = false; this.dragEnterCounter = 0; }
  }

  onDropArea(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragActiveLocal = false;
    this.dragEnterCounter = 0;

    if (this.items.length > 0 || this.isUploading || this.batchShareableLink) {
      return;
    }

    const items = event.dataTransfer?.items;
    if (items && items.length > 0) {
      this.dataTransferItemsDropped.emit(items);
    }
  }

  onRequestAddFilesPanel(): void { this.requestAddFilesFromPanel.emit(); }
  onRequestAddFolderPanel(): void { this.requestAddFolderFromPanel.emit(); }
  onItemRemovedPanel(item: SelectedItem | undefined): void { this.itemRemovedFromPanel.emit(item); }
  onItemDownloadRequestedPanel(item: SelectedItem): void { this.itemDownloadRequestedFromPanel.emit(item); }
  onTransferInitiatedPanel(): void { this.transferInitiatedFromPanel.emit(); }
  onCancelUploadPanel(): void { this.cancelUploadFromPanel.emit(); }
}