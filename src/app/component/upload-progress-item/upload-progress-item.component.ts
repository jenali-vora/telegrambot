// src/app/component/upload-progress-item/upload-progress-item.component.ts
import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ByteFormatPipe } from '../../shared/pipes/byte-format.pipe'; // Adjust path
import { SelectedItem } from '../../shared/services/file-manager-api.service'; // Adjust path

@Component({
  selector: 'app-upload-progress-item',
  standalone: true,
  imports: [CommonModule, ByteFormatPipe],
  templateUrl: './upload-progress-item.component.html',
  styleUrls: ['./upload-progress-item.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UploadProgressItemComponent {
  @Input() item: SelectedItem | null = null;
  // @Input() progress: number = 0; // Original, renamed to percentage
  @Input() status: string = ''; // Status message (optional display, not used in current template)

  // New detailed progress inputs
  @Input() percentage: number = 0;
  @Input() bytesSent: number = 0;
  @Input() totalBytes: number = 0;
  @Input() speedMBps: number = 0;
  @Input() etaFormatted: string = '--:--';
  @Input() itemsInTransfer: number = 1;

  @Output() cancelUpload = new EventEmitter<void>();

  onCancelClick(): void {
    console.log('Cancel button clicked for item:', this.item?.name);
    this.cancelUpload.emit();
  }
}