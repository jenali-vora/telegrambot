// frontend/src/app/component/transfer-panel/transfer-panel.component.ts

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ByteFormatPipe } from '../../shared/pipes/byte-format.pipe';

export interface SelectedItem {
  id: number;
  file: File | null;
  name: string;
  size: number;
  isFolder?: boolean;
  icon: string;
  progress?: number;
  status?: 'pending' | 'uploading' | 'complete' | 'error';
}

interface TooltipMessage {
  id: number;
  message: string;
  timeoutId?: any;
}

@Component({
  selector: 'app-transfer-panel',
  standalone: true,
  imports: [CommonModule, ByteFormatPipe],
  templateUrl: './transfer-panel.component.html',
  styleUrls: ['./transfer-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransferPanelComponent implements OnDestroy {
  @Input() items: SelectedItem[] = [];
  @Input() isUploading: boolean = false;
  @Input() batchShareableLink: string | null = null;

  @Input() uploadPercentage: number = 0;
  @Input() bytesSent: number = 0;
  @Input() totalBytes: number = 0;
  @Input() speedMBps: number = 0; // Overall current batch speed
  @Input() etaFormatted: string = '--:--';

  // @Output() requestAddFiles = new EventEmitter<void>();
  // @Output() requestAddFolder = new EventEmitter<void>();
  @Output() itemRemoved = new EventEmitter<SelectedItem | undefined>();
  @Output() itemDownloadRequested = new EventEmitter<SelectedItem>();
  @Output() transferInitiated = new EventEmitter<void>();
  @Output() cancelUpload = new EventEmitter<void>();
  @Output() newTransferRequested = new EventEmitter<void>();
  @Output() itemUploadCancellationRequested = new EventEmitter<SelectedItem>();

  @Input() generalUploadStatusMessage: string = '';

  tooltips: TooltipMessage[] = [];
  private nextTooltipId: number = 0;

  constructor(private cdr: ChangeDetectorRef) { }

  get totalSize(): number { return this.items.reduce((acc, item) => acc + (item.size || 0), 0); }
  get totalCount(): number { return this.items.length; }

  // ... (other methods: addMoreFiles, clearAllItems, requestItemRemoval, etc. remain the same)
  // addMoreFiles(): void { if (!this.isUploading && this.items.length === 0) this.requestAddFiles.emit(); }
  // addFolder(): void { if (!this.isUploading && this.items.length === 0) this.requestAddFolder.emit(); }
  clearAllItems(): void { if (!this.isUploading) { this.itemRemoved.emit(undefined); } }
  requestItemRemoval(item: SelectedItem, event: MouseEvent): void { event.stopPropagation(); if (!this.isUploading) { this.itemRemoved.emit(item); } }
  requestItemDownload(item: SelectedItem, event: MouseEvent): void { event.stopPropagation(); if (!this.isUploading && item.file) { this.itemDownloadRequested.emit(item); } }
  startTransfer(): void { if (this.items.length > 0 && !this.isUploading && !this.batchShareableLink) { this.transferInitiated.emit(); } }
  handleCancelUpload(): void { if (this.isUploading) { this.cancelUpload.emit(); } }
  initiateNewTransfer(): void { this.newTransferRequested.emit(); }

  copyLink(link: string | null | undefined, event: MouseEvent): void {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      const tooltipId = this.nextTooltipId++;
      const message = 'Download link copied to clipboard';
      const newTooltip: TooltipMessage = { id: tooltipId, message: message };
      newTooltip.timeoutId = setTimeout(() => {
        this.removeTooltip(tooltipId); this.cdr.detectChanges();
      }, 3000);
      this.tooltips = [...this.tooltips, newTooltip]; this.cdr.detectChanges();
    }).catch(err => {
      console.error('Failed to copy link: ', err); alert('Failed to copy link.'); this.cdr.detectChanges();
    });
  }
  private removeTooltip(tooltipId: number): void { this.tooltips = this.tooltips.filter(t => t.id !== tooltipId); }
  ngOnDestroy(): void { this.tooltips.forEach(tooltip => { if (tooltip.timeoutId) clearTimeout(tooltip.timeoutId); }); this.tooltips = []; }
  trackTooltipById(index: number, tooltip: TooltipMessage): number { return tooltip.id; }
  trackItemById(index: number, item: SelectedItem): number { return item.id; }

  public getItemUploadedBytes(currentItem: SelectedItem): number {
    const itemIndex = this.items.findIndex(i => i.id === currentItem.id);
    if (itemIndex === -1) return 0;
    const sizeOfPreviousItems = this.items.slice(0, itemIndex).reduce((acc, i) => acc + i.size, 0);
    const itemStartBytes = sizeOfPreviousItems;
    const itemEndBytes = sizeOfPreviousItems + currentItem.size;
    if (this.bytesSent >= itemEndBytes) return currentItem.size;
    if (this.bytesSent > itemStartBytes) return this.bytesSent - itemStartBytes;
    return 0;
  }

  public getItemUploadPercentage(currentItem: SelectedItem): number {
    if (currentItem.size === 0) {
      const itemIndex = this.items.findIndex(i => i.id === currentItem.id);
      if (itemIndex === -1) return 0;
      const sizeOfPreviousItems = this.items.slice(0, itemIndex).reduce((acc, i) => acc + i.size, 0);
      return this.bytesSent >= sizeOfPreviousItems ? 100 : 0;
    }
    const uploadedBytes = this.getItemUploadedBytes(currentItem);
    return (uploadedBytes / currentItem.size) * 100;
  }

  public getItemDisplayTimeOrEta(currentItem: SelectedItem): string | null {
    const currentItemProgress = this.getItemUploadPercentage(currentItem);
    if (currentItemProgress >= 99.99) {
      return null; // <--- KEY CHANGE: Return null for completed items
    }
    if (!this.isUploading || this.speedMBps <= 0) return '--:--';

    let firstActiveItem: SelectedItem | undefined = undefined;
    for (const item of this.items) {
      if (this.getItemUploadPercentage(item) < 99.99) {
        firstActiveItem = item;
        break;
      }
    }

    if (firstActiveItem && currentItem.id === firstActiveItem.id) {
      const uploadedBytesOfCurrent = this.getItemUploadedBytes(currentItem);
      const remainingBytesOfCurrent = currentItem.size - uploadedBytesOfCurrent;
      if (remainingBytesOfCurrent > 0) {
        const etaSeconds = remainingBytesOfCurrent / (this.speedMBps * 1024 * 1024);
        return this.formatEtaSeconds(etaSeconds);
      } else if (currentItem.size === 0 && currentItemProgress < 99.99) {
        return '00:00';
      }
      return '00:00';
    } else {
      return '--:--';
    }
  }

  // +++ NEW METHOD TO DISPLAY ITEM-SPECIFIC SPEED +++
  public getItemDisplaySpeed(currentItem: SelectedItem): string {
    const currentItemProgress = this.getItemUploadPercentage(currentItem);

    if (currentItemProgress >= 99.99) { // Completed file
      return ""; // No speed display for completed files
    }

    if (!this.isUploading) { // Overall upload not active
      return "";
    }

    // Find the first item in the list that is not 100% complete. This is the active one.
    let firstActiveItem: SelectedItem | undefined = undefined;
    for (const item of this.items) {
      if (this.getItemUploadPercentage(item) < 99.99) {
        firstActiveItem = item;
        break;
      }
    }

    // Only show speed if:
    // 1. There is an active item.
    // 2. The currentItem IS the active item.
    // 3. The current global speed (this.speedMBps) is greater than 0.
    if (firstActiveItem && currentItem.id === firstActiveItem.id && this.speedMBps > 0) {
      return `${this.speedMBps.toFixed(1)} MB/s`;
    }

    return ""; // For pending files or if active file has 0 speed
  }

  private formatEtaSeconds(totalSeconds: number): string {
    if (isNaN(totalSeconds) || totalSeconds < 0 || !isFinite(totalSeconds) || totalSeconds === Infinity) return '--:--';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}