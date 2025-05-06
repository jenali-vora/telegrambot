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
  // Receive data about the upload
  @Input() item: SelectedItem | null = null;
  @Input() progress: number = 0; // Percentage 0-100
  @Input() status: string = ''; // Status message (optional display)

  // Emit event when cancel button is clicked
  @Output() cancelUpload = new EventEmitter<void>();

  onCancelClick(): void {
    console.log('Cancel button clicked for item:', this.item?.name);
    this.cancelUpload.emit();
  }
}