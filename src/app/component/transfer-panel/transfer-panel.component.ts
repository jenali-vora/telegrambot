// src/app/component/transfer-panel/transfer-panel.component.ts
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
  @Input() speedMBps: number = 0;
  @Input() etaFormatted: string = '--:--';

  @Output() requestAddFiles = new EventEmitter<void>();
  @Output() requestAddFolder = new EventEmitter<void>();
  @Output() itemRemoved = new EventEmitter<SelectedItem | undefined>(); // Used for pre-upload removal or clear all
  @Output() itemDownloadRequested = new EventEmitter<SelectedItem>();
  @Output() transferInitiated = new EventEmitter<void>();
  @Output() cancelUpload = new EventEmitter<void>(); // For cancelling the entire batch upload
  @Output() newTransferRequested = new EventEmitter<void>();
  @Output() itemUploadCancellationRequested = new EventEmitter<SelectedItem>(); // **** NEW EVENT ****

  @Input() generalUploadStatusMessage: string = '';

  tooltips: TooltipMessage[] = [];
  private nextTooltipId: number = 0;

  constructor(private cdr: ChangeDetectorRef) { }

  get totalSize(): number { return this.items.reduce((acc, item) => acc + (item.size || 0), 0); }
  get totalCount(): number { return this.items.length; }

  get currentUploadProgressSizeDisplay(): string {
    if (this.totalBytes > 0) {
      const pipe = new ByteFormatPipe();
      return `${pipe.transform(this.bytesSent)} / ${pipe.transform(this.totalBytes)}`;
    }
    return new ByteFormatPipe().transform(this.bytesSent);
  }

  addMoreFiles(): void { if (!this.isUploading && this.items.length === 0) this.requestAddFiles.emit(); }
  addFolder(): void { if (!this.isUploading && this.items.length === 0) this.requestAddFolder.emit(); }

  clearAllItems(): void {
    if (!this.isUploading) {
      this.itemRemoved.emit(undefined); // Signals to clear all pre-upload items
    }
  }

  requestItemRemoval(item: SelectedItem, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isUploading) { // This is for removing an item *before* upload starts
      this.itemRemoved.emit(item);
    }
  }

  requestItemDownload(item: SelectedItem, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isUploading && item.file) {
      this.itemDownloadRequested.emit(item);
    }
  }

  startTransfer(): void {
    if (this.items.length > 0 && !this.isUploading && !this.batchShareableLink) {
      this.transferInitiated.emit();
    }
  }

  // This method remains for cancelling the *entire* batch upload
  handleCancelUpload(): void {
    if (this.isUploading) {
      this.cancelUpload.emit();
    }
  }

  initiateNewTransfer(): void {
    this.newTransferRequested.emit();
  }

  copyLink(link: string | null | undefined, event: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!link) return;

    navigator.clipboard.writeText(link).then(() => {
      const tooltipId = this.nextTooltipId++;
      const message = 'Download link copied to clipboard';
      const newTooltip: TooltipMessage = { id: tooltipId, message: message };
      newTooltip.timeoutId = setTimeout(() => {
        this.removeTooltip(tooltipId);
        this.cdr.detectChanges();
      }, 3000);
      this.tooltips = [...this.tooltips, newTooltip];
      this.cdr.detectChanges();
    }).catch(err => {
      console.error('Failed to copy link: ', err);
      alert('Failed to copy link.');
      this.cdr.detectChanges();
    });
  }

  private removeTooltip(tooltipId: number): void {
    this.tooltips = this.tooltips.filter(t => t.id !== tooltipId);
  }

  ngOnDestroy(): void {
    this.tooltips.forEach(tooltip => {
      if (tooltip.timeoutId) clearTimeout(tooltip.timeoutId);
    });
    this.tooltips = [];
  }

  trackTooltipById(index: number, tooltip: TooltipMessage): number { return tooltip.id; }
  trackItemById(index: number, item: SelectedItem): number { return item.id; }
}