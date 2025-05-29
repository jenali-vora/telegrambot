// src/app/shared/component/orbital-display/orbital-display.component.ts
import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
// Import SelectedItem and TransferPanelComponent
import { SelectedItem, TransferPanelComponent } from '../../../component/transfer-panel/transfer-panel.component';

@Component({
  selector: 'app-orbital-display',
  standalone: true,
  imports: [CommonModule, TransferPanelComponent], // TransferPanelComponent is already imported
  templateUrl: './orbital-display.component.html',
  styleUrls: ['./orbital-display.component.css']
})
export class OrbitalDisplayComponent implements OnInit {
  public isDragActiveLocal: boolean = false; // Local state for highlight

  @Input() centralButtonIconClass: string = 'fas fa-plus';

  // Inputs for app-transfer-panel's data (remain the same)
  @Input() items: SelectedItem[] = [];
  @Input() isUploading: boolean = false;
  @Input() batchShareableLink: string | null = null;
  @Input() uploadStatusMessage: string = '';
  @Input() overallProgressPercentage: number = 0;
  // Output for the orbital display's own + button click (remains the same)
  @Output() requestFileUpload = new EventEmitter<void>();

  // Outputs to bubble events from app-transfer-panel (remain the same)
  @Output() requestAddFilesFromPanel = new EventEmitter<void>();
  @Output() requestAddFolderFromPanel = new EventEmitter<void>();
  @Output() itemRemovedFromPanel = new EventEmitter<SelectedItem | undefined>();
  @Output() itemDownloadRequestedFromPanel = new EventEmitter<SelectedItem>();
  @Output() transferInitiatedFromPanel = new EventEmitter<void>();

  private dragEnterCounter = 0;

  constructor() { }

  ngOnInit(): void {
  }

  // Getter to determine if the transfer panel should be shown (remains the same)
  get showTransferPanel(): boolean {
    return ((this.items.length > 0 || !!this.batchShareableLink) || this.isUploading);
  }
  get showOverallProgressCircle(): boolean {
    return this.isUploading && this.items.length > 0;
  }
  // The showOrbitalContent getter is no longer needed.

  onCentralButtonClick(): void {
    this.requestFileUpload.emit(); // For the + button in orbital display
  }

  // Drag and drop handlers for the orbital area
  onDragEnterArea(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragEnterCounter++;
    if (event.dataTransfer && event.dataTransfer.items && event.dataTransfer.items.length > 0) {
      // isDragActiveLocal will be true if conditions are met,
      // the template then decides if the class is applied based on !showTransferPanel
      this.isDragActiveLocal = true;
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onDragOverArea(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
        event.dataTransfer.dropEffect = 'copy';
      } else {
        event.dataTransfer.dropEffect = 'none';
      }
    }
  }

  onDragLeaveArea(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragEnterCounter--;
    if (this.dragEnterCounter === 0) {
      this.isDragActiveLocal = false;
    }
  }

  onDropArea(event: DragEvent): void {
    event.preventDefault();
    // DO NOT call event.stopPropagation() here.
    // This allows the global drop handler in HomeComponent to process the files.
    this.isDragActiveLocal = false;
    this.dragEnterCounter = 0;
  }

  // Methods to re-emit events from app-transfer-panel (remain the same)
  onRequestAddFilesPanel(): void {
    this.requestAddFilesFromPanel.emit();
  }

  onRequestAddFolderPanel(): void {
    this.requestAddFolderFromPanel.emit();
  }

  onItemRemovedPanel(item: SelectedItem | undefined): void {
    this.itemRemovedFromPanel.emit(item);
  }

  onItemDownloadRequestedPanel(item: SelectedItem): void {
    this.itemDownloadRequestedFromPanel.emit(item);
  }

  onTransferInitiatedPanel(): void {
    this.transferInitiatedFromPanel.emit();
  }
}