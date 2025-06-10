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

  @Input() uploadProgressPercentage: number = 0;
  @Input() bytesSent: number = 0;
  @Input() totalBytes: number = 0;
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

  // Getter for the most accurate progress percentage to display
  get effectiveUploadProgressPercentage(): number {
    if (this.isUploading && this.totalBytes > 0) {
      const calculatedPercentage = (this.bytesSent / this.totalBytes) * 100;
      return Math.min(100, Math.max(0, calculatedPercentage));
    }
    // Fallback to the direct input if not uploading, totalBytes is 0, or parent signals completion
    return Math.min(100, Math.max(0, this.uploadProgressPercentage));
  }

  // Getter to determine if upload is effectively complete
  get isEffectivelyUploadComplete(): boolean {
    if (this.uploadProgressPercentage >= 100) { // Parent explicitly signals 100%
      return true;
    }
    if (this.isUploading && this.totalBytes > 0 && this.bytesSent >= this.totalBytes) { // Bytes match or exceed total
      return true;
    }
    return false;
  }

  // Getter to determine if upload is at 0% for spinning dot logic
  get isEffectivelyAtZeroProgressAndUploading(): boolean {
    return this.isUploading && !this.isEffectivelyUploadComplete && this.effectiveUploadProgressPercentage === 0;
  }

  constructor(private cdr: ChangeDetectorRef) { }

  ngOnChanges(changes: SimpleChanges): void {
    let triggerChangeDetection = false;
    // Add bytesSent and totalBytes to trigger change detection if they change, as they affect effective progress
    if (changes['uploadProgressPercentage'] || changes['isUploading'] || changes['batchShareableLink'] || changes['items'] || changes['bytesSent'] || changes['totalBytes']) {
      triggerChangeDetection = true;
    }

    if (triggerChangeDetection) {
      this.cdr.detectChanges();
    }
  }

  ngOnInit(): void {
    this.waveAnimationInterval = setInterval(() => {
      // Animate wave if uploading and progress is between 0 and 100 (exclusive)
      if (this.isUploading && this.effectiveUploadProgressPercentage > 0 && this.effectiveUploadProgressPercentage < 100) {
        this.waveAnimationPhase += 0.04;
        if (this.waveAnimationPhase > Math.PI * 4) {
          this.waveAnimationPhase -= Math.PI * 4;
        }
        this.cdr.detectChanges(); // Necessary as waveAnimationPhase is updated outside Angular's zone
      }
    }, 50); // Interval for wave animation
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
    // Use effective percentage; if complete, ensure it's 100% for full circle
    const percentage = this.isEffectivelyUploadComplete ? 100 : this.effectiveUploadProgressPercentage;
    const offset = this.circumference - (percentage / 100) * this.circumference;
    return Math.max(0, Math.min(offset, this.circumference));
  }

  get dynamicStrokeDasharray(): string {
    if (this.isEffectivelyAtZeroProgressAndUploading) {
      const dotLength = 0.1; // A very small dash for the spinning dot
      return `${dotLength}, ${this.circumference - dotLength}`;
    } else {
      return this.circumference.toString();
    }
  }

  get dynamicStrokeDashoffset(): string {
    if (this.isEffectivelyAtZeroProgressAndUploading) {
      return '0'; // Offset for spinning dot animation start
    } else {
      return this._normalProgressStrokeDashoffset.toString();
    }
  }

  getWaterPathD(): string {
    const vbCenter = this.viewBoxSize / 2;
    const r_for_wave = this.clipRadius;
    const padding = 5; // Padding for drawing area of water, can be 0 if clip handles edges well

    // Use effective percentage, capped at 100 for water level calculation
    const displayPercentageForWater = Math.min(100, this.effectiveUploadProgressPercentage);

    // Water fills from left (X_min) to right (X_max) in SVG coords, which appears bottom-to-top after -90deg rotation
    const waterEdgeXBase = (vbCenter - r_for_wave) + (displayPercentageForWater / 100) * (2 * r_for_wave);
    // Wave amplitude is 0 if complete (flat water surface), otherwise a fraction of radius
    const waveAmplitude = this.isEffectivelyUploadComplete ? 0 : r_for_wave * 0.15;

    const yTopBoundary_wave = vbCenter - r_for_wave;    // Min Y of the clipping circle
    const yBottomBoundary_wave = vbCenter + r_for_wave; // Max Y of the clipping circle

    // Calculate X positions for the start and end of the wave curve, incorporating animation phase
    const xAtWaveStart = waterEdgeXBase + (waveAmplitude * Math.sin(this.waveAnimationPhase + Math.PI * 0.3));
    const xAtWaveEnd = waterEdgeXBase + (waveAmplitude * Math.sin(this.waveAnimationPhase * 0.9 + Math.PI * 1.1));

    // Control points for the Bezier curve forming the wave
    const cp1y = vbCenter - r_for_wave * 0.5;
    const cp1x = waterEdgeXBase + waveAmplitude * 1.2 * Math.sin(this.waveAnimationPhase * 0.7 + Math.PI * 0.6);
    const cp2y = vbCenter + r_for_wave * 0.5;
    const cp2x = waterEdgeXBase - waveAmplitude * 1.2 * Math.sin(this.waveAnimationPhase * 1.1 + Math.PI * 0.1);

    // Construct the SVG path data string for the water
    // Path starts from padded top-left, goes to water edge, draws wave, then to padded bottom-left, and closes.
    let d = `M ${0 - padding},${0 - padding}`; // Start at top-left (of padded area)
    d += ` L ${xAtWaveStart},${0 - padding}`; // Line to where wave starts at top
    d += ` L ${xAtWaveStart},${yTopBoundary_wave}`; // Line down to top of clipping circle
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${xAtWaveEnd},${yBottomBoundary_wave}`; // Bezier curve for wave
    d += ` L ${xAtWaveEnd},${this.viewBoxSize + padding}`; // Line from wave end to bottom (of padded area)
    d += ` L ${0 - padding},${this.viewBoxSize + padding}`; // Line to bottom-left (of padded area)
    d += ` Z`; // Close path
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