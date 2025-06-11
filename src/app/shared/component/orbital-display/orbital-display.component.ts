import { Component, OnInit, Input, Output, EventEmitter, ChangeDetectorRef, HostBinding, OnDestroy, SimpleChanges, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SelectedItem, TransferPanelComponent } from '../../../component/transfer-panel/transfer-panel.component';
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

  @Input() uploadProgressPercentage: number = 0; // This will be less relevant for the main display now
  @Input() bytesSent: number = 0; // Assumed to be BATCH total sent
  @Input() totalBytes: number = 0; // Assumed to be BATCH total size
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
    // Ensure changes to bytesSent or totalBytes also trigger detection
    if (changes['uploadProgressPercentage'] ||
      changes['isUploading'] ||
      changes['batchShareableLink'] ||
      changes['items'] ||
      changes['bytesSent'] ||
      changes['totalBytes']) {
      triggerChangeDetection = true;
    }

    if (triggerChangeDetection) {
      this.cdr.detectChanges();
    }
  }

  ngOnInit(): void {
    this.waveAnimationInterval = setInterval(() => {
      const currentProgress = this.rawOverallBatchProgress;
      // Wave animation runs when uploading, progress is between 0 and (almost) 100, and not in initial spinner or complete state
      if (this.isUploading && currentProgress > 0 && currentProgress < 99.99 && !this.isBatchUploadComplete) {
        this.waveAnimationPhase += 0.04;
        if (this.waveAnimationPhase > Math.PI * 4) {
          this.waveAnimationPhase -= Math.PI * 4;
        }
        // Change detection will be handled by ngOnChanges or other triggers for progress updates
      }
    }, 50);
  }

  ngOnDestroy(): void {
    if (this.waveAnimationInterval) {
      clearInterval(this.waveAnimationInterval);
    }
  }

  // --- START: New and Modified Getters for Overall Batch Progress ---

  /**
   * Calculates the raw overall progress percentage based on batch-wide bytesSent and totalBytes.
   */
  private get rawOverallBatchProgress(): number {
    if (this.totalBytes === 0) {
      return 0; // Avoid division by zero
    }
    const progress = (this.bytesSent / this.totalBytes) * 100;
    return Math.min(Math.max(progress, 0), 100); // Clamp between 0 and 100
  }

  /**
   * Determines if the entire batch upload is complete.
   * Completion is primarily signaled by batchShareableLink, or by reaching 100% progress while uploading.
   */
  get isBatchUploadComplete(): boolean {
    if (this.batchShareableLink) {
      return true; // Definitive completion
    }
    // If still marked as uploading and raw progress is effectively 100%
    if (this.isUploading && this.rawOverallBatchProgress >= 99.99) {
      return true;
    }
    return false;
  }

  /**
   * The overall progress percentage to be displayed and used for animations.
   * Shows 100% if complete, 0% if in pre-upload state, otherwise shows raw calculated progress.
   */
  public get overallBatchProgressPercentage(): number {
    if (this.isBatchUploadComplete) {
      return 100;
    }
    // If items are selected but upload hasn't started (and not already complete via link)
    if (!this.isUploading && this.items.length > 0 && !this.batchShareableLink) {
      return 0;
    }
    return this.rawOverallBatchProgress;
  }

  /**
   * Determines if the UI should show the initial spinning dot (uploading at 0% overall progress).
   */
  get isDisplayingInitialSpinner(): boolean {
    // Show spinner if uploading, batch is not yet complete, and raw progress is 0.
    return this.isUploading && !this.isBatchUploadComplete && this.rawOverallBatchProgress === 0;
  }

  // --- END: New and Modified Getters ---


  get showTransferPanelLogic(): boolean {
    return this.items.length > 0 || !!this.batchShareableLink;
  }

  private get _normalProgressStrokeDashoffset(): number {
    // Uses the new overallBatchProgressPercentage
    const offset = this.circumference - (this.overallBatchProgressPercentage / 100) * this.circumference;
    return Math.max(0, Math.min(offset, this.circumference));
  }

  get dynamicStrokeDasharray(): string {
    // Uses the new isDisplayingInitialSpinner
    if (this.isDisplayingInitialSpinner) {
      const dotLength = 0.1;
      return `${dotLength}, ${this.circumference - dotLength}`;
    } else {
      return this.circumference.toString();
    }
  }

  get dynamicStrokeDashoffset(): string {
    // Uses the new isDisplayingInitialSpinner
    if (this.isDisplayingInitialSpinner) {
      return '0';
    } else {
      return this._normalProgressStrokeDashoffset.toString();
    }
  }

  // Note: The original 'isUploadComplete' getter is effectively replaced by 'isBatchUploadComplete'.
  // If 'isUploadComplete' was used elsewhere, update those locations or remove the old getter.

  getWaterPathD(): string {
    const vbCenter = this.viewBoxSize / 2;
    const r_for_wave = this.clipRadius;
    const padding = 5; // Added padding variable for clarity

    // Uses the new overallBatchProgressPercentage
    const waterEdgeXBase = (vbCenter - r_for_wave) + (this.overallBatchProgressPercentage / 100) * (2 * r_for_wave);
    // Wave amplitude should be 0 if upload is complete (based on new logic)
    const waveAmplitude = this.isBatchUploadComplete ? 0 : r_for_wave * 0.15;

    const yTopBoundary_wave = vbCenter - r_for_wave;
    const yBottomBoundary_wave = vbCenter + r_for_wave;

    const xAtWaveStart = waterEdgeXBase + (waveAmplitude * Math.sin(this.waveAnimationPhase + Math.PI * 0.3));
    const xAtWaveEnd = waterEdgeXBase + (waveAmplitude * Math.sin(this.waveAnimationPhase * 0.9 + Math.PI * 1.1));

    const cp1y = vbCenter - r_for_wave * 0.5;
    const cp1x = waterEdgeXBase + waveAmplitude * 1.2 * Math.sin(this.waveAnimationPhase * 0.7 + Math.PI * 0.6);
    const cp2y = vbCenter + r_for_wave * 0.5;
    const cp2x = waterEdgeXBase - waveAmplitude * 1.2 * Math.sin(this.waveAnimationPhase * 1.1 + Math.PI * 0.1);

    // Adjusted to ensure the water fill covers the entire clipped circle area to the left of the wave
    let d = `M ${vbCenter - r_for_wave - padding}, ${vbCenter - r_for_wave - padding}`; // Start top-left of drawable area
    d += ` L ${xAtWaveStart}, ${vbCenter - r_for_wave - padding}`; // Line to top of wave start
    d += ` L ${xAtWaveStart}, ${yTopBoundary_wave}`; // Line down to actual wave top edge
    d += ` C ${cp1x}, ${cp1y}, ${cp2x}, ${cp2y}, ${xAtWaveEnd}, ${yBottomBoundary_wave}`; // Wave curve
    d += ` L ${xAtWaveEnd}, ${vbCenter + r_for_wave + padding}`; // Line from wave end to bottom-right of drawable area
    d += ` L ${vbCenter - r_for_wave - padding}, ${vbCenter + r_for_wave + padding}`; // Line to bottom-left
    d += ` Z`; // Close path
    return d;
  }

  // ... (rest of the component methods: onSelectFolderClick, onNewTransferPanel, etc. remain unchanged) ...
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