// src/app/component/transfer-panel/transfer-panel.component.ts
import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ByteFormatPipe } from '../../shared/pipes/byte-format.pipe';

// Keep SelectedItem Interface Export
export interface SelectedItem { id: number; file: File; name: string; size: number; isFolder?: boolean; icon: string; }

@Component({
  selector: 'app-transfer-panel',
  standalone: true,
  imports: [CommonModule, ByteFormatPipe],
  templateUrl: './transfer-panel.component.html',
  styleUrls: ['./transfer-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransferPanelComponent {
  @Input() items: SelectedItem[] = [];
  @Input() isUploading: boolean = false;
  @Input() batchShareableLink: string | null = null;
  @Input() uploadStatusMessage: string = ''; // Add input for status message

  @Output() requestAddFiles = new EventEmitter<void>();
  @Output() requestAddFolder = new EventEmitter<void>();
  // itemRemoved now always signals clearing the current batch
  @Output() itemRemoved = new EventEmitter<undefined>(); // Correctly emits only undefined
  @Output() itemDownloadRequested = new EventEmitter<SelectedItem>();
  @Output() transferInitiated = new EventEmitter<void>();

  copyButtonText: string = 'Copy link';
  copyTimeout: any = null;

  // Calculate total size/count based on the current items array
  get totalSize(): number { return this.items.reduce((acc, item) => acc + item.size, 0); }
  get totalCount(): number { return this.items.length; }

  // These buttons are now hidden when items.length > 0, but keep methods
  addMoreFiles(): void { if (!this.isUploading && this.items.length === 0) this.requestAddFiles.emit(); }
  addFolder(): void { if (!this.isUploading && this.items.length === 0) this.requestAddFolder.emit(); }

  // "Clear All" button now triggers the removal
  clearAllItems(): void {
    if (!this.isUploading) {
      console.log('Requesting removal of the current selection');
      this.itemRemoved.emit(undefined); // Signal to clear the batch - THIS IS CORRECT
    }
  }

  // *** REMOVED the conflicting requestItemRemoval method ***
  // requestItemRemoval(item: SelectedItem, event: MouseEvent): void {
  //   event.stopPropagation(); // Prevent potential parent clicks
  //   if (!this.isUploading) {
  //     console.log('Requesting removal of item:', item.name);
  //     // this.itemRemoved.emit(item); // This line caused the error
  //     // As per design, we should clear the whole batch, so call clearAllItems or just emit undefined
  //      this.itemRemoved.emit(undefined); // If method were kept, it should do this
  //   }
  // }

  // Download request remains the same
  requestItemDownload(item: SelectedItem, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isUploading) {
      console.warn('Requesting download of LOCAL item:', item.name);
      this.itemDownloadRequested.emit(item);
    }
  }

  // Transfer button remains the same
  startTransfer(): void {
    if (this.items.length > 0 && !this.isUploading) {
      console.log('Transfer button clicked in panel, emitting event.');
      this.transferInitiated.emit();
    }
    // No need for else-if check as button is hidden when items.length === 0
  }

  // Copy link remains the same
  copyLink(link: string | null | undefined, event: MouseEvent): void {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      this.copyButtonText = 'Copied!';
      if (this.copyTimeout) clearTimeout(this.copyTimeout);
      this.copyTimeout = setTimeout(() => { this.copyButtonText = 'Copy link'; }, 2000);
    }).catch(err => {
      console.error('Failed to copy link: ', err);
      alert('Failed to copy link.'); // Provide feedback
    });
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  // TrackBy remains the same
  trackById(index: number, item: SelectedItem): number { return item.id; }
}