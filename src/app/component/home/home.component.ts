// frontend/src/app/features/home/home.component.ts

import { Component, inject, ViewChild, ElementRef, OnInit, OnDestroy, NgZone, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable, Subscription, catchError, firstValueFrom, throwError } from 'rxjs';
import { AuthService, User } from '../../shared/services/auth.service';
import {
  FileManagerApiService,
  FinalizeBatchResponse,
} from '../../shared/services/file-manager-api.service';
import { SelectedItem } from '../transfer-panel/transfer-panel.component';
import { FaqAccordionComponent } from '../faq-accordion/faq-accordion.component';
import { ByteFormatPipe } from '../../shared/pipes/byte-format.pipe';
import { UploadEventService } from '../../shared/services/upload-event.service';
import { OrbitalDisplayComponent } from '@app/shared/component/orbital-display/orbital-display.component';
import { ScrollAnimationDirective } from '@app/shared/directives/scroll-animation.directive';
import { GamesComponent } from '@app/shared/component/games/games.component';


interface UploadProgressDetails {
  percentage: number;
  bytesSent: number;
  totalBytes: number;
  speedMBps: number; // Note: speed calculation is not implemented in this fix
  etaFormatted: string; // Note: ETA calculation is not implemented in this fix
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FaqAccordionComponent,
    ByteFormatPipe, DatePipe,
    OrbitalDisplayComponent, ScrollAnimationDirective, GamesComponent
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  providers: [DatePipe]
})
export class HomeComponent implements OnInit, OnDestroy {
  // --- Injections and initial properties (mostly unchanged) ---
  private authService = inject(AuthService);
  private apiService = inject(FileManagerApiService);
  private zone = inject(NgZone);
  private cdRef = inject(ChangeDetectorRef);
  private uploadEventService = inject(UploadEventService);
  public completedBatchAccessId: string | null = null;
  public shareableLinkForPanel: string | null = null;
  public showPlayGamesButton: boolean = false;
  private previousShowPlayGamesButtonState: boolean = false;
  public isGamePanelVisible: boolean = false;
  public anonymousUploadLimitMessage: string | null = null;
  private readonly ONE_GIGABYTE_IN_BYTES = 1 * 1024 * 1024 * 1024;
  private readonly FIVE_GIGABYTES_IN_BYTES = 5 * 1024 * 1024 * 1024;
  private anonymousFolderUploadsCount = 0;
  private readonly MAX_ANONYMOUS_FOLDER_UPLOADS = 5;

  @ViewChild('fileInputForStart') fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('folderInputForStart') folderInputRef!: ElementRef<HTMLInputElement>;

  currentUser: User | null = null;
  username: string = '';
  isUploading: boolean = false;
  uploadError: string | null = null;
  uploadSuccessMessage: string | null = null;
  selectedItems: SelectedItem[] = [];
  currentItemBeingUploaded: SelectedItem | null = null;
  userFileCount: number = 0;
  isLoadingUserFileCount: boolean = false;
  uploadStatusMessage: string = '';
  uploadProgressDetails: UploadProgressDetails = {
    percentage: 0, bytesSent: 0, totalBytes: 0, speedMBps: 0, etaFormatted: '--:--',
  };
  uploadProgress: number = 0;

  private nextItemId = 0;
  private authSubscription: Subscription | null = null;
  // MODIFICATION: Add a subscription for the progress stream
  private progressSubscription: Subscription | null = null;

  public isDraggingOverWindow: boolean = false;
  private dragEnterCounter = 0;

  // transferList, redisterdUser arrays are unchanged
  transferList = [
    { img: "assets/image/secure.svg", title: "Secure file transfer via email, or shareable links", des: "Send and share large files and other documents quickly and securely with our file transfer solution. Send large files via email or create a simple sharing link from any device (smartphone, tablet, computer) using just a web browser." },
    { img: "assets/image/sendFile.svg", title: "Send large files up to 250 GB per transfer", des: "Get a TransferNow account to transfer large files and other sizable documents! The files are available up to 365 days before being automatically and permanently erased from our servers." },
    { img: "assets/image/track.svg", title: "Track your sent files. Manage your transfers.", des: "Use our complete dashboard to follow and track your file downloads over time. You can modify your transfers’ data and parameters, re-transfer files to new recipients without having to systematically re-upload the same documents and erase a transfer before it's initial expiration date." },
    { img: "assets/image/download (2).svg", title: "Integrate the TransferNow widget on your website and receive files easily.", des: "Discover our form generator to receive files directly on your account and customize the widget’s appearance as well as it's fields (text boxes, drop-down lists, checkboxes, radio buttons). You can get a simple HTML code to integrate into your website allowing you to receive files instantaneously." }
  ];
  redisterdUser = [
    { icon: 'assets/image/rg-i.png', title: 'Registered users', count: '327,026,694' },
    { icon: 'assets/image/upload-files-img1.png', title: 'Uploaded files', count: '191,649,393,254' }
  ]
  // --- HostListeners (unchanged) ---
  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isUploading) {
      const confirmationMessage = "Leaving will cancel your current upload. Proceed?";
      event.preventDefault();
      event.returnValue = confirmationMessage;
    }
  }

  // --- ngOnInit (unchanged) ---
  ngOnInit(): void {
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      this.zone.run(() => {
        const wasLoggedIn = !!this.currentUser;
        this.currentUser = user;
        this.username = this.currentUser?.username || this.currentUser?.email || '';
        const isLoggingIn = !!user && !wasLoggedIn;
        const isLoggingOut = !user && wasLoggedIn;
        const isSwitchingUser = !!user && wasLoggedIn && this.currentUser && user.email !== this.currentUser.email;

        if (isLoggingOut || isSwitchingUser) {
          this.resetUploadState();
        } else if (isLoggingIn) {
          this.anonymousFolderUploadsCount = 0;
          this.anonymousUploadLimitMessage = null;
        }

        if (this.currentUser && this.username) {
          this.loadUserFileCount();
        } else {
          this.userFileCount = 0;
          this.isLoadingUserFileCount = false;
        }
        this.cdRef.detectChanges();
      });
    });

    this.currentUser = this.authService.currentUserValue;
    this.username = this.currentUser?.username || this.currentUser?.email || '';
    if (this.currentUser && this.username) {
      this.loadUserFileCount();
    }
  }

  // MODIFICATION: Unsubscribe from progress stream on destroy
  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.progressSubscription?.unsubscribe();
  }

  // MODIFICATION: Unsubscribe from progress stream on reset
  private resetUploadState(): void {
    this.isUploading = false;
    this.uploadError = null;
    this.uploadSuccessMessage = null;
    this.selectedItems = [];
    this.shareableLinkForPanel = null;
    this.completedBatchAccessId = null;
    this.currentItemBeingUploaded = null;
    this.uploadStatusMessage = '';
    this.uploadProgressDetails = { percentage: 0, bytesSent: 0, totalBytes: 0, speedMBps: 0, etaFormatted: '--:--' };
    this.uploadProgress = 0;
    this.nextItemId = 0;
    this.anonymousUploadLimitMessage = null;
    this.anonymousFolderUploadsCount = 0;
    this.isGamePanelVisible = false;
    this.dragEnterCounter = 0;

    if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = '';
    if (this.folderInputRef?.nativeElement) this.folderInputRef.nativeElement.value = '';

    this.progressSubscription?.unsubscribe();
    this.progressSubscription = null;

    console.log('HomeComponent: Upload state has been reset.');
    this.updatePlayGamesButtonVisibility();
  }

  // --- No changes to other methods like handleFiles, onFileSelected, getFileIcon etc. ---
  private updatePlayGamesButtonVisibility(): void {
    const totalSelectedSize = this.selectedItems.reduce((sum, item) => sum + item.size, 0);
    const newShowPlayGamesButtonState = totalSelectedSize >= this.ONE_GIGABYTE_IN_BYTES;

    if (newShowPlayGamesButtonState && !this.previousShowPlayGamesButtonState) {
      this.playNotificationSound();
    }

    this.showPlayGamesButton = newShowPlayGamesButtonState;
    this.previousShowPlayGamesButtonState = this.showPlayGamesButton;

    if (!this.showPlayGamesButton) {
      this.isGamePanelVisible = false;
    }
    this.cdRef.detectChanges();
  }
  private playNotificationSound(): void {
    const audio = new Audio('assets/audio/new-notification-3-323602.mp3');
    audio.play().catch(error => {
      console.warn("Notification sound playback failed:", error);
    });
  }
  loadUserFileCount(): void {
    if (!this.currentUser || !this.username) {
      this.userFileCount = 0; this.isLoadingUserFileCount = false; return;
    }
    this.isLoadingUserFileCount = true;
    this.apiService.listFiles(this.username).subscribe({
      next: (files) => this.zone.run(() => {
        this.userFileCount = files.length; this.isLoadingUserFileCount = false; this.cdRef.detectChanges();
      }),
      error: (err) => this.zone.run(() => {
        console.error("Home: Error loading file count:", err);
        this.userFileCount = 0; this.isLoadingUserFileCount = false; this.cdRef.detectChanges();
      })
    });
  }
  @HostListener('window:dragenter', ['$event'])
  onWindowDragEnter(event: DragEvent): void {
    if (!event.dataTransfer) return;

    event.preventDefault();
    event.stopPropagation();
    this.dragEnterCounter++;

    if (this.selectedItems.length > 0 || this.isUploading || this.shareableLinkForPanel) {
      event.dataTransfer.dropEffect = 'none';
    } else {
      if (event.dataTransfer.dropEffect !== 'copy') {
        event.dataTransfer.dropEffect = 'none';
      }
    }
  }
  @HostListener('window:dragover', ['$event'])
  onWindowDragOver(event: DragEvent): void {
    if (!event.dataTransfer) return;

    event.preventDefault();
    event.stopPropagation();

    if (this.selectedItems.length > 0 || this.isUploading || this.shareableLinkForPanel) {
      event.dataTransfer.dropEffect = 'none';
    } else {
      if (event.dataTransfer.dropEffect !== 'copy') {
        event.dataTransfer.dropEffect = 'none';
      }
    }
  }
  @HostListener('window:dragleave', ['$event'])
  onWindowDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.dragEnterCounter--;
    if (this.dragEnterCounter <= 0) {
      this.dragEnterCounter = 0;
    }
  }
  @HostListener('window:drop', ['$event'])
  onWindowDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.dragEnterCounter = 0;
    console.log('HomeComponent: Window drop event. If not handled by a specific zone, it is ignored. Target:', event.target);
  }
  triggerFileInput(): void {
    if (this.selectedItems.length === 0 && !this.isUploading && !this.shareableLinkForPanel) {
      this.fileInputRef?.nativeElement.click();
    }
  }
  triggerFolderInput(): void {
    if (this.selectedItems.length === 0 && !this.isUploading && !this.shareableLinkForPanel) {
      this.folderInputRef?.nativeElement.click();
    }
  }
  handleFiles(fileList: FileList, isFolderSelection: boolean = false): void {
    if (this.isUploading) {
      alert("Wait for current upload or cancel it.");
      return;
    }
    if (this.shareableLinkForPanel || this.selectedItems.length > 0 && fileList.length > 0 && this.selectedItems[0].id !== -2) { // -2 is a placeholder if we need a "reset" signal
      this.resetUploadState(); // Reset if new files are added after a successful upload or if files already exist and new ones are selected
    }

    this.uploadError = null;
    this.uploadSuccessMessage = null;
    this.anonymousUploadLimitMessage = null;
    const isLoggedIn = this.authService.isLoggedIn();
    const MAX_TOTAL_ITEMS_OR_FILES_LIMIT_ANONYMOUS = this.MAX_ANONYMOUS_FOLDER_UPLOADS; // This constant is confusingly named; it applies to files too
    let totalItemCountLimitErrorMessage: string;

    if (isFolderSelection) { totalItemCountLimitErrorMessage = `As you are not logged in, you can select a maximum of ${this.MAX_ANONYMOUS_FOLDER_UPLOADS} folder. Please login to upload more.`; }
    else { totalItemCountLimitErrorMessage = `As you are not logged in, you can select a maximum of ${this.MAX_ANONYMOUS_FOLDER_UPLOADS} file. Please login to upload more.`; }

    const FOLDER_ADDITION_LIMIT_ERROR_MESSAGE = `As you are not logged in, you can add a maximum of ${this.MAX_ANONYMOUS_FOLDER_UPLOADS} folders. You have reached this limit. Please log in to add more folders.`;
    const FOLDER_ADDITION_LIMIT_INFO_MESSAGE = `As you are not logged in, you can select a maximum of ${this.MAX_ANONYMOUS_FOLDER_UPLOADS} folder. Please login to upload more.`;
    const ANONYMOUS_SIZE_LIMIT_ERROR_MESSAGE = `As you are not logged in, your total selection cannot exceed 5 GB. Please log in for larger uploads or reduce your selection.`;

    if (!fileList || fileList.length === 0) {
      if (isFolderSelection && !isLoggedIn) {
        if (this.anonymousFolderUploadsCount >= this.MAX_ANONYMOUS_FOLDER_UPLOADS) { this.uploadError = FOLDER_ADDITION_LIMIT_ERROR_MESSAGE; }
        else { this.anonymousFolderUploadsCount++; if (this.anonymousFolderUploadsCount >= this.MAX_ANONYMOUS_FOLDER_UPLOADS) { this.anonymousUploadLimitMessage = FOLDER_ADDITION_LIMIT_INFO_MESSAGE; } }
        if (this.folderInputRef?.nativeElement) this.folderInputRef.nativeElement.value = '';
        this.cdRef.detectChanges();
      }
      return;
    }

    if (!isLoggedIn) {
      if (isFolderSelection && this.anonymousFolderUploadsCount >= this.MAX_ANONYMOUS_FOLDER_UPLOADS) {
        this.uploadError = FOLDER_ADDITION_LIMIT_ERROR_MESSAGE;
        if (this.folderInputRef?.nativeElement) this.folderInputRef.nativeElement.value = '';
        this.cdRef.detectChanges(); return;
      }
      const currentItemCount = this.selectedItems.length;
      const currentTotalSize = this.selectedItems.reduce((sum, item) => sum + item.size, 0);
      if (currentItemCount >= MAX_TOTAL_ITEMS_OR_FILES_LIMIT_ANONYMOUS && fileList.length > 0) {
        this.uploadError = totalItemCountLimitErrorMessage;
        if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = '';
        if (this.folderInputRef?.nativeElement) this.folderInputRef.nativeElement.value = '';
        this.cdRef.detectChanges(); return;
      }
      if (currentTotalSize >= this.FIVE_GIGABYTES_IN_BYTES && fileList.length > 0) {
        this.uploadError = ANONYMOUS_SIZE_LIMIT_ERROR_MESSAGE;
        if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = '';
        if (this.folderInputRef?.nativeElement) this.folderInputRef.nativeElement.value = '';
        this.cdRef.detectChanges(); return;
      }
    }

    const newItems: SelectedItem[] = [];
    let filesAddedInThisOperation = 0;
    let sizeAddedInThisOperation = 0;
    const currentItemCountBeforeThisBatch = this.selectedItems.length;
    const currentTotalSizeBeforeThisBatch = this.selectedItems.reduce((sum, item) => sum + item.size, 0);

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!isLoggedIn) {
        if ((currentItemCountBeforeThisBatch + newItems.length) >= MAX_TOTAL_ITEMS_OR_FILES_LIMIT_ANONYMOUS) { if (!this.uploadError) this.uploadError = totalItemCountLimitErrorMessage; break; }
        if ((currentTotalSizeBeforeThisBatch + sizeAddedInThisOperation + file.size) > this.FIVE_GIGABYTES_IN_BYTES) { if (!this.uploadError) this.uploadError = ANONYMOUS_SIZE_LIMIT_ERROR_MESSAGE; break; }
      }
      let itemName = file.name;
      if (file.webkitRelativePath && (file.webkitRelativePath !== file.name || isFolderSelection)) { itemName = file.webkitRelativePath; }
      if (file.size === 0 && !isFolderSelection && !itemName.includes('/')) { continue; } // Skip empty files unless they are part of a folder structure or explicitly marked as folder
      if (file.name.toLowerCase().endsWith('.ds_store')) { continue; }

      const isActualFolderEntry = (isFolderSelection && !file.type && file.size === 0 && file.webkitRelativePath.endsWith(file.name)) || (itemName.includes('/') && !itemName.split('/').pop()?.includes('.'));
      newItems.push({ id: this.nextItemId++, file: file, name: itemName, size: file.size, icon: this.getFileIcon(itemName), isFolder: isActualFolderEntry });
      filesAddedInThisOperation++;
      sizeAddedInThisOperation += file.size;
    }

    if (newItems.length > 0) { this.selectedItems = [...this.selectedItems, ...newItems]; }

    if (isFolderSelection && !isLoggedIn && (filesAddedInThisOperation > 0 || (fileList.length > 0 && newItems.length === 0 && !this.uploadError))) {
      if (this.anonymousFolderUploadsCount < this.MAX_ANONYMOUS_FOLDER_UPLOADS) { this.anonymousFolderUploadsCount++; if (this.anonymousFolderUploadsCount >= this.MAX_ANONYMOUS_FOLDER_UPLOADS && !this.uploadError) { this.anonymousUploadLimitMessage = FOLDER_ADDITION_LIMIT_INFO_MESSAGE; } }
      else if (!this.uploadError && !this.anonymousUploadLimitMessage) { this.anonymousUploadLimitMessage = FOLDER_ADDITION_LIMIT_INFO_MESSAGE; }
    }

    if (!isLoggedIn && filesAddedInThisOperation < fileList.length && !this.uploadError) {
      const finalItemCount = this.selectedItems.length;
      const finalTotalSize = this.selectedItems.reduce((sum, item) => sum + item.size, 0);
      if (finalTotalSize > this.FIVE_GIGABYTES_IN_BYTES) { this.uploadError = ANONYMOUS_SIZE_LIMIT_ERROR_MESSAGE; }
      else if (finalItemCount >= MAX_TOTAL_ITEMS_OR_FILES_LIMIT_ANONYMOUS) { this.uploadError = totalItemCountLimitErrorMessage; }
    }

    if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = '';
    if (this.folderInputRef?.nativeElement) this.folderInputRef.nativeElement.value = '';
    this.cdRef.detectChanges();
    this.updatePlayGamesButtonVisibility();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.handleFiles(input.files, false);
    }
  }

  onFolderSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.handleFiles(input.files, true);
    }
  }

  // ==============================================================================
  // === MODIFIED: Main upload orchestration logic ================================
  // ==============================================================================
  async initiateTransferFromPanel(): Promise<void> {
    if (this.isUploading || this.selectedItems.length === 0) return;

    this.isUploading = true;
    this.uploadError = null;
    this.uploadProgressDetails.totalBytes = this.selectedItems.reduce((sum, item) => sum + (item.file?.size ?? 0), 0);
    this.updateOverallProgress(0); // Start progress at 0

    const batchName = this.uploadProgressDetails.totalBytes > 0
      ? (this.selectedItems.length === 1 ? this.selectedItems[0].name : `Batch of ${this.selectedItems.length} files`)
      : 'Processing files...';

    this.currentItemBeingUploaded = {
      id: -1, name: batchName, size: this.uploadProgressDetails.totalBytes, file: null as any, icon: 'fas fa-archive'
    };
    this.uploadStatusMessage = 'Initializing transfer...';
    this.cdRef.detectChanges();

    try {
      // 1. Initiate the batch and get a batchId
      const initResponse = await firstValueFrom(this.apiService.initiateBatch(
        batchName, this.uploadProgressDetails.totalBytes, this.selectedItems.length > 1
      ));
      const batchId = initResponse.batch_id;

      let bytesUploadedSoFar = 0;

      // 2. Subscribe to the progress stream BEFORE starting the uploads
      this.progressSubscription = this.apiService.getUploadProgressStream(batchId).subscribe({
        next: (event) => this.zone.run(() => this.handleProgressEvent(event, bytesUploadedSoFar)),
        error: (err) => this.zone.run(() => this.handleBatchUploadError('Progress stream failed.', err))
      });

      // 3. Loop through files and send them
      for (const item of this.selectedItems) {
        // Skip invalid items, but account for their size if it exists to avoid progress errors
        if (!item.file) {
          if (item.size > 0) {
            bytesUploadedSoFar += item.size;
            this.updateOverallProgress(bytesUploadedSoFar);
          }
          continue;
        }

        // The status message is now updated by the progress event handler
        await this.streamFileWithFetch(item, batchId);

        // After a file is fully sent, update the "base" of uploaded bytes
        bytesUploadedSoFar += item.file.size;
        // Ensure progress reflects the full completion of this file
        this.updateOverallProgress(bytesUploadedSoFar);
      }

      // 4. Finalize the batch
      this.uploadStatusMessage = 'Finalizing transfer...';
      this.cdRef.detectChanges();
      const finalResponse = await firstValueFrom(this.apiService.finalizeBatch(batchId));
      this.onAllUploadsComplete(finalResponse);

    } catch (error: any) {
      this.handleBatchUploadError(error.message || 'An unknown error occurred during the upload process.');
    } finally {
      // 5. Always clean up the progress stream subscription
      this.progressSubscription?.unsubscribe();
      this.progressSubscription = null;
    }
  }

  /**
   * NEW: Handles events from the progress SSE stream.
   */
  private handleProgressEvent(event: any, bytesAlreadyUploaded: number): void {
    if (event.type === 'progress') {
      // <<< MODIFICATION 2: Change to "Your files are being uploaded..." when progress starts >>>
      // We check if filename exists, otherwise use a more generic message.
      // This message will override "Initializing transfer..." once actual upload feedback is received.
      if (event.filename) {
        this.uploadStatusMessage = `Your files are being uploaded, wait a few minutes. (Current: ${event.filename})`;
      } else if (this.uploadStatusMessage === 'Initializing transfer...') { // Only change if still initializing
        this.uploadStatusMessage = `Your files are being uploaded, wait a few minutes.`;
      } // Else, keep the more specific message if one was set by a previous event.


      const currentFileBytesSent = event.bytes_sent || 0;
      const totalBatchSent = event.total_batch_bytes_sent !== undefined ? event.total_batch_bytes_sent : (bytesAlreadyUploaded + currentFileBytesSent);
      this.updateOverallProgress(totalBatchSent);

    } else if (event.type === 'status' && event.message) {
      // Backend status messages might be more specific than our generic "Your files are being uploaded..."
      // We can let these override if they are more informative.
      this.uploadStatusMessage = event.message;
    } else if (event.type === 'finalized' && event.message) {
      this.uploadStatusMessage = event.message;
    } else if (event.type === 'error' && event.message) {
      this.handleBatchUploadError(event.message);
    }
    this.cdRef.detectChanges();
  }

  /**
   * MODIFIED: Simplified to just send the file. Progress is handled by the SSE stream.
   */
  private async streamFileWithFetch(item: SelectedItem, batchId: string): Promise<void> {
    const apiUrl = this.apiService.getApiBaseUrl();
    const authToken = this.authService.getToken();
    const url = `${apiUrl}/upload/stream?batch_id=${batchId}&filename=${encodeURIComponent(item.name)}&auth_token=${authToken || ''}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: item.file, // fetch handles File, Blob, or null bodies correctly
      });

      if (!response.ok) {
        const errorText = await response.text();
        try {
          throw new Error(JSON.parse(errorText).error || `Server responded with status ${response.status}`);
        } catch {
          throw new Error(errorText || `Server responded with status ${response.status}`);
        }
      }
      // No need to read the response body, the upload is done when this promise resolves.
      console.log(`Successfully streamed ${item.name}.`);
    } catch (error) {
      console.error(`Error streaming file ${item.name}:`, error);
      throw error; // Re-throw to be caught by the main orchestrator
    }
  }

  /**
   * MODIFIED: Centralized progress update logic.
   */
  private updateOverallProgress(bytesSent: number): void {
    const totalBytes = this.uploadProgressDetails.totalBytes;
    if (totalBytes === 0) {
      this.uploadProgressDetails.percentage = this.isUploading ? 0 : 100;
    } else {
      this.uploadProgressDetails.percentage = Math.min((bytesSent / totalBytes) * 100, 100);
    }
    this.uploadProgressDetails.bytesSent = bytesSent;
    this.uploadProgress = this.uploadProgressDetails.percentage;
    this.cdRef.detectChanges();
  }

  // --- No changes to the remaining methods (onAllUploadsComplete, handleBatchUploadError, etc.) ---
  onAllUploadsComplete(finalData: FinalizeBatchResponse): void {
    this.zone.run(() => {
      this.isUploading = false;
      this.uploadStatusMessage = "Transfer complete!";
      if (!this.authService.isLoggedIn()) {
        this.anonymousUploadLimitMessage = "Your file has been uploaded. It will be available for 5 days. Please log in or sign up for longer storage and more features.";
        this.uploadSuccessMessage = null; // Ensure only one success-type message is shown
      } else {
        this.uploadSuccessMessage = "Your files have been successfully uploaded.";
        this.anonymousUploadLimitMessage = null; // Clear any previous anonymous message
      }

      this.shareableLinkForPanel = finalData.download_url;
      this.completedBatchAccessId = finalData.access_id;

      this.updateOverallProgress(this.uploadProgressDetails.totalBytes); // Set to 100%

      if (this.currentItemBeingUploaded) {
        this.currentItemBeingUploaded.name = this.selectedItems.length > 1
          ? `${this.selectedItems.length} files uploaded`
          : (this.selectedItems.length === 1 ? this.selectedItems[0].name : 'Upload complete');
      }

      if (this.currentUser) this.uploadEventService.notifyUploadComplete();
      this.cdRef.detectChanges();
    });
  }
  handleNewTransferRequest(): void {
    console.log('HomeComponent: New transfer requested. Resetting state.');
    this.resetUploadState();
    this.cdRef.detectChanges();
  }
  private handleBatchUploadError(errorMessage: string, errorEvent?: any): void {
    if (errorEvent) console.error("Error during batch upload:", errorMessage, errorEvent);
    else console.error("Error during batch upload:", errorMessage);

    this.zone.run(() => {
      this.uploadError = errorMessage;
      this.isUploading = false;
      this.uploadStatusMessage = 'Upload Failed';
      // Unsubscribe here as well, in case the error didn't come from the stream itself
      this.progressSubscription?.unsubscribe();
      this.progressSubscription = null;
      this.cdRef.detectChanges();
    });
  }
  handleCancelUpload(): void {
    if (!this.isUploading) {
      return;
    }
    console.log('HomeComponent: User cancelled upload.');
    // TODO: A more advanced implementation would use an AbortController with fetch.
    // For now, this stops new files from being sent and resets the state.
    this.progressSubscription?.unsubscribe();
    this.progressSubscription = null;
    this.isUploading = false;
    this.uploadStatusMessage = `Upload cancelled.`;
    this.uploadError = null;
    this.updateOverallProgress(0); // Reset progress
    this.currentItemBeingUploaded = null;
    this.cdRef.detectChanges();
  }
  
  handleItemRemovedFromPanel(itemOrUndefined: SelectedItem | undefined): void {
    if (this.isUploading) {
      alert("Cannot remove items during upload. Please cancel the upload first.");
      return;
    }
    if (itemOrUndefined) {
      this.selectedItems = this.selectedItems.filter(i => i.id !== itemOrUndefined.id);
      if (this.selectedItems.length === 0) {
        this.handleNewTransferRequest();
      }
    } else {
      this.handleNewTransferRequest();
    }
    this.updatePlayGamesButtonVisibility();
    this.cdRef.detectChanges();
  }

  toggleGamePanel(): void {
    this.isGamePanelVisible = !this.isGamePanelVisible;
  }
  closeGamePanel(): void {
    this.isGamePanelVisible = false;
  }
  handleDownloadRequest(itemToDownload: SelectedItem): void {
    if (this.isUploading) return;
    try {
      if (!(itemToDownload.file instanceof File)) {
        if (itemToDownload.id === -1 && this.shareableLinkForPanel) { // -1 is the batch representation
          alert("This represents the completed batch. To download, use the generated shareable link. Individual file download from this panel is for pre-upload items.");
          return;
        }
        alert("Cannot download this item locally. It might be a folder representation or an item from a completed transfer without a local file reference.");
        return;
      }
      const link = document.createElement('a');
      const url = URL.createObjectURL(itemToDownload.file);
      link.href = url;
      link.download = itemToDownload.file.name; // Use original file name for download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error initiating local file download:", error);
      alert("Could not initiate local file download.");
    }
  }
  async handleDataTransferItemsDropped(items: DataTransferItemList | null): Promise<void> {
    if (!this.isReceptiveToNewFiles()) {
      console.log('HomeComponent: Drop ignored, component not in receptive state for new files.');
      return;
    }
    if (!items) {
      console.log('HomeComponent: No DataTransferItems received.');
      return;
    }
    if (this.selectedItems.length > 0 || this.shareableLinkForPanel) {
      this.resetUploadState();
    }
    console.log('HomeComponent: DataTransferItems dropped.', items);
    this.uploadError = null; // Clear previous errors

    try {
      let wasAnyDirectoryDropped = false;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (typeof item.webkitGetAsEntry === 'function') {
          const entry = item.webkitGetAsEntry();
          if (entry && entry.isDirectory) {
            wasAnyDirectoryDropped = true;
            break;
          }
        }
      }

      const files = await this.extractFilesFromDataTransferItems(items);

      if (files.length > 0) {
        this.handleFiles(this.createFileListFromArray(files), wasAnyDirectoryDropped || files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/')));
      } else if (wasAnyDirectoryDropped) {
        this.handleFiles(this.createFileListFromArray([]), true); // Pass true for isFolderSelection
        console.log('HomeComponent: An empty folder or folder with no valid files was dropped.');
      } else {
        console.log('HomeComponent: No files extracted from dropped items.');
      }
    } catch (error) {
      console.error('HomeComponent: Error processing dropped items:', error);
      this.uploadError = "Error processing dropped items. Some files or folders might not be readable.";
    } finally {
      this.cdRef.detectChanges();
    }
  }
  private isReceptiveToNewFiles(): boolean {
    return !this.isUploading;
  }
  private async extractFilesFromDataTransferItems(items: DataTransferItemList): Promise<File[]> {
    const filesAccumulator: File[] = [];
    const promises: Promise<void>[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') { // Process only file kind
        if (typeof item.webkitGetAsEntry === 'function') {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            promises.push(this.traverseFileSystemEntry(entry, filesAccumulator));
          } else { // Fallback for browsers that might not support getAsEntry well for all file types
            const file = item.getAsFile();
            if (file) {
              if (!file.name.toLowerCase().endsWith('.ds_store') && (file.size > 0 || (file.size === 0 && file.type !== ''))) { // Add empty files if they have a type
                filesAccumulator.push(file);
              }
            }
          }
        } else { // If webkitGetAsEntry is not available at all
          const file = item.getAsFile();
          if (file) {
            if (!file.name.toLowerCase().endsWith('.ds_store') && (file.size > 0 || (file.size === 0 && file.type !== ''))) {
              filesAccumulator.push(file);
            }
          }
        }
      }
    }

    await Promise.all(promises);
    return filesAccumulator.filter(file => file instanceof File); // Ensure all are actual File objects
  }

  private async traverseFileSystemEntry(entry: FileSystemEntry, filesAccumulator: File[]): Promise<void> {
    return new Promise<void>((resolve, reject) => { // Added reject for clarity, though current logic resolves on error
      if (entry.isFile) {
        (entry as FileSystemFileEntry).file(
          (file) => {
            if (file.name.toLowerCase().endsWith('.ds_store')) {
              console.log(`Skipping .DS_Store file during traversal: ${entry.fullPath || entry.name}`);
              resolve();
              return;
            }
            if (entry.fullPath && !Object.prototype.hasOwnProperty.call(file, 'webkitRelativePath')) {
              try {
                Object.defineProperty(file, 'webkitRelativePath', {
                  value: entry.fullPath.startsWith('/') ? entry.fullPath.substring(1) : entry.fullPath,
                  writable: false,
                  enumerable: true
                });
              } catch (e) { console.warn("Could not set webkitRelativePath on file", e); }
            }
            filesAccumulator.push(file);
            resolve();
          },
          (err) => {
            console.error(`Error reading file ${entry.fullPath || entry.name}:`, err);
            resolve(); // Resolve to not break Promise.all for other files
          }
        );
      } else if (entry.isDirectory) {
        const directoryReader = (entry as FileSystemDirectoryEntry).createReader();
        const readAllSubEntries = async () => {
          let allSubEntries: FileSystemEntry[] = [];
          const readBatch = (): Promise<FileSystemEntry[]> => {
            return new Promise<FileSystemEntry[]>((batchResolve, batchReject) => {
              directoryReader.readEntries(
                (batch) => batchResolve(batch),
                (err) => batchReject(err) // Propagate directory read error
              );
            });
          };

          try {
            let currentBatch: FileSystemEntry[];
            do {
              currentBatch = await readBatch();
              allSubEntries = allSubEntries.concat(currentBatch);
            } while (currentBatch.length > 0);

            const entryPromises: Promise<void>[] = [];
            for (const subEntry of allSubEntries) {
              entryPromises.push(this.traverseFileSystemEntry(subEntry, filesAccumulator));
            }
            await Promise.all(entryPromises);
            resolve();
          } catch (dirReadError) {
            console.error(`Error reading directory contents for ${entry.fullPath || entry.name}:`, dirReadError);
            resolve(); // Resolve to not break Promise.all
          }
        };
        readAllSubEntries();
      } else {
        console.warn(`Skipping unknown entry type: ${entry.name}`);
        resolve();
      }
    });
  }
  private createFileListFromArray(files: File[]): FileList {
    const dataTransfer = new DataTransfer();
    if (files && files.length > 0) {
      files.forEach(file => {
        if (file instanceof File) {
          dataTransfer.items.add(file);
        } else {
          console.warn("Attempted to add non-File object to DataTransfer:", file);
        }
      });
    }
    return dataTransfer.files;
  }

  getFileIcon(filename: string | undefined): string {
    if (!filename) return 'fas fa-question-circle'; // Default for undefined
    const isPath = filename.includes('/');
    const baseNameForIcon = isPath ? filename.substring(filename.lastIndexOf('/') + 1) : filename;
    if (isPath && (baseNameForIcon === '' || !baseNameForIcon.includes('.'))) {
      return 'fas fa-folder';
    }
    if (!baseNameForIcon.includes('.') && !isPath) {
      return 'fas fa-file';
    }
    if (isPath && !baseNameForIcon.includes('.')) {
      return 'fas fa-folder';
    }
    const extension = baseNameForIcon.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf': return 'fas fa-file-pdf text-danger';
      case 'doc': case 'docx': return 'fas fa-file-word text-primary';
      case 'xls': case 'xlsx': return 'fas fa-file-excel text-success';
      case 'ppt': case 'pptx': return 'fas fa-file-powerpoint text-warning';
      case 'zip': case 'rar': case '7z': case 'gz': case 'tar': return 'fas fa-file-archive text-secondary';
      case 'txt': case 'md': case 'log': return 'fas fa-file-alt text-info';
      case 'jpg': case 'jpeg': case 'png': case 'gif': case 'bmp': case 'svg': case 'webp': return 'fas fa-file-image text-purple';
      case 'mp3': case 'wav': case 'ogg': case 'aac': case 'flac': return 'fas fa-file-audio text-orange';
      case 'mp4': case 'mov': case 'avi': case 'mkv': case 'wmv': case 'webm': return 'fas fa-file-video text-teal';
      case 'html': case 'htm': case 'js': case 'css': case 'ts': case 'py': case 'java': case 'cs': return 'fas fa-file-code text-info';
      default: return 'fas fa-file text-muted';
    }
  }
}