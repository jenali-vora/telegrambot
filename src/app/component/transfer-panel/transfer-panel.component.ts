// src/app/component/transfer-panel/transfer-panel.component.ts
import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnDestroy, ChangeDetectorRef } from '@angular/core'; // Import ChangeDetectorRef
import { CommonModule } from '@angular/common';
import { ByteFormatPipe } from '../../shared/pipes/byte-format.pipe';

export interface SelectedItem {
  id: number;
  file: File;
  name: string;
  size: number;
  isFolder?: boolean;
  icon: string;
}

interface TooltipMessage {
  id: number;
  message: string;
  timeoutId?: any; // To store the timeout ID for potential cleanup
}

@Component({
  selector: 'app-transfer-panel',
  standalone: true,
  imports: [CommonModule, ByteFormatPipe],
  templateUrl: './transfer-panel.component.html',
  styleUrls: ['./transfer-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush // Keep OnPush
})
export class TransferPanelComponent implements OnDestroy {
  @Input() items: SelectedItem[] = [];
  @Input() isUploading: boolean = false;
  @Input() batchShareableLink: string | null = null;
  @Input() uploadStatusMessage: string = '';

  @Output() requestAddFiles = new EventEmitter<void>();
  @Output() requestAddFolder = new EventEmitter<void>();
  @Output() itemRemoved = new EventEmitter<SelectedItem | undefined>();
  @Output() itemDownloadRequested = new EventEmitter<SelectedItem>();
  @Output() transferInitiated = new EventEmitter<void>();

  tooltips: TooltipMessage[] = [];
  private nextTooltipId: number = 0;

  // 1. Inject ChangeDetectorRef
  constructor(private cdr: ChangeDetectorRef) { }

  get totalSize(): number { return this.items.reduce((acc, item) => acc + item.size, 0); }
  get totalCount(): number { return this.items.length; }

  addMoreFiles(): void { if (!this.isUploading && this.items.length === 0) this.requestAddFiles.emit(); }
  addFolder(): void { if (!this.isUploading && this.items.length === 0) this.requestAddFolder.emit(); }

  clearAllItems(): void {
    if (!this.isUploading) {
      this.itemRemoved.emit(undefined);
    }
  }

  requestItemRemoval(item: SelectedItem, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isUploading) {
      this.itemRemoved.emit(item);
    }
  }

  requestItemDownload(item: SelectedItem, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isUploading) {
      this.itemDownloadRequested.emit(item);
    }
  }

  startTransfer(): void {
    if (this.items.length > 0 && !this.isUploading) {
      this.transferInitiated.emit();
    }
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

      const newTooltip: TooltipMessage = {
        id: tooltipId,
        message: message,
      };

      newTooltip.timeoutId = setTimeout(() => {
        this.removeTooltip(tooltipId);
        // 2. Call detectChanges when tooltip is removed (already good)
        this.cdr.detectChanges();
      }, 3000);

      // 3. Use immutable update for the tooltips array
      this.tooltips = [...this.tooltips, newTooltip];

      // 2. Call detectChanges after adding the tooltip
      this.cdr.detectChanges();

    }).catch(err => {
      console.error('Failed to copy link: ', err);
      alert('Failed to copy link.');
      // Optionally trigger change detection here too if an error state needs to be reflected in the UI
      this.cdr.detectChanges();
    });
  }

  private removeTooltip(tooltipId: number): void {
    // 3. Use immutable update for removing from the tooltips array
    this.tooltips = this.tooltips.filter(t => t.id !== tooltipId);
    // Change detection will be called by the setTimeout callback that invokes this.
  }

  ngOnDestroy(): void {
    this.tooltips.forEach(tooltip => {
      if (tooltip.timeoutId) {
        clearTimeout(tooltip.timeoutId);
      }
    });
    this.tooltips = [];
  }

  trackTooltipById(index: number, tooltip: TooltipMessage): number {
    return tooltip.id;
  }
}