// src/app/component/home/home.component.ts
import { Component, inject, ViewChild, ElementRef, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService, User } from '../../shared/services/auth.service'; // AuthService
import {
  FileManagerApiService,
  InitiateUploadResponse,
} from '../../shared/services/file-manager-api.service';
import { TransferPanelComponent, SelectedItem } from '../transfer-panel/transfer-panel.component';
import { FaqAccordionComponent } from '../faq-accordion/faq-accordion.component';
import { CtaSectionComponent } from '../cta-section/cta-section.component';
import { UploadProgressItemComponent } from '../upload-progress-item/upload-progress-item.component';
import { ByteFormatPipe } from '../../shared/pipes/byte-format.pipe';
import { UploadEventService } from '../../shared/services/upload-event.service';
import { BatchFileBrowserComponent } from '../batch-file-browser/batch-file-browser.component';

interface UploadProgressDetails {
  percentage: number;
  bytesSent: number;
  totalBytes: number;
  speedMBps: number;
  etaFormatted: string;
}

interface CompletedUploadLink {
  name: string;
  url: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule, RouterLink, TransferPanelComponent, FaqAccordionComponent,
    CtaSectionComponent, UploadProgressItemComponent, ByteFormatPipe, DatePipe, BatchFileBrowserComponent
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  providers: [DatePipe]
})
export class HomeComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService); // Injected
  private apiService = inject(FileManagerApiService);
  private zone = inject(NgZone);
  private cdRef = inject(ChangeDetectorRef);
  private uploadEventService = inject(UploadEventService);
  public completedBatchAccessId: string | null = null;
  public shareableLinkForPanel: string | null = null;

  @ViewChild('fileInputForStart') fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('folderInputForStart') folderInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('dropZoneTarget') dropZoneRef!: ElementRef<HTMLElement>;

  currentUser: User | null = null;
  username: string = ''; // Will be set if user is logged in

  isUploading: boolean = false;
  uploadError: string | null = null;
  isDragging = false;
  selectedItems: SelectedItem[] = [];
  currentItemBeingUploaded: SelectedItem | null = null;
  currentUploadId: string | null = null;

  userFileCount: number = 0;
  isLoadingUserFileCount: boolean = false;

  private eventSource: EventSource | null = null;
  uploadStatusMessage: string = '';
  uploadProgressDetails: UploadProgressDetails = {
    percentage: 0, bytesSent: 0, totalBytes: 0, speedMBps: 0, etaFormatted: '--:--',
  };
  uploadProgress: number = 0;

  private nextItemId = 0;
  private authSubscription: Subscription | null = null;

  public batchUploadLinks: CompletedUploadLink[] = [];
  public batchShareableLinkForPanel: string | null = null;

  stepContent = [
    { number: '1', title: ' Select your file(s)', des: 'Select the file(s) and/or folder(s) you want to send from your computer or smartphone.' },
    { number: '2', title: ' Fill out the form', des: 'Fill out the transfer form - enter your email address as well as the recipient(s) email address(es). Send large files by email or generate a share link.' },
    { number: '3', title: ' Transfer files', des: 'Click "Send" to start uploading your files via our secure servers nearby you thanks to our global infrastructure.' },
  ];
  transferList = [
    { img: "assets/image/download (2).svg", des: "Customize and integrate our widget to receive files from your clients or other contacts directly from your own website." },
    { img: "assets/image/customized.svg", des: "Build your own file reception forms and add your customized fields (text fields, drop-down lists, checkboxes, and radio buttons)." },
    { img: "assets/image/clous.svg", des: "The transferred files are stored on our secure cloud and you will receive a notification to inform you that a new transfer was received on your account." }
  ];
  apps = [
    { img: "assets/image/windows.svg", title: "Windows" },
    { img: "assets/image/macos-D1UzuEXe.svg", title: "macOS" },
    { img: "assets/image/ios-B-i3hJIr.svg", title: "iOS" },
    { img: "assets/android-ByKVTp40.svg", title: "Android" },
  ];

  ngOnInit(): void {
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      this.zone.run(() => {
        const wasLoggedIn = !!this.currentUser;
        this.currentUser = user;
        this.username = this.currentUser?.username || this.currentUser?.email || '';

        const isLoggingOut = !user && wasLoggedIn;
        const isSwitchingUser = !!user && wasLoggedIn && user.email !== this.currentUser?.email; // Assuming email is unique identifier

        if (isLoggingOut || isSwitchingUser) {
          this.resetUploadState(); // Reset on logout or user switch
        }

        if (this.currentUser && this.username) {
          this.loadUserFileCount();
        } else {
          // User is not logged in (or just logged out)
          this.userFileCount = 0;
          this.isLoadingUserFileCount = false;
          // If items were selected as anonymous and then user logs out,
          // they should ideally persist if the anonymous_upload_id is still valid
          // For now, resetUploadState clears selectedItems.
          // If you want to keep them after logout, you'd need more complex state management.
        }
        this.cdRef.detectChanges();
      });
    });

    // Initial check - might be redundant if subscription fires immediately
    this.currentUser = this.authService.currentUserValue;
    this.username = this.currentUser?.username || this.currentUser?.email || '';
    if (this.currentUser && this.username) {
      this.loadUserFileCount();
    } else {
      this.resetUploadState(); // Ensure clean state if starting anonymous
      this.userFileCount = 0;
      this.isLoadingUserFileCount = false;
    }
  }

  private resetUploadState(): void {
    this.isUploading = false;
    this.uploadError = null;
    this.selectedItems = [];
    this.shareableLinkForPanel = null;
    this.currentItemBeingUploaded = null;
    this.currentUploadId = null;
    this.uploadStatusMessage = '';
    this.uploadProgressDetails = {
      percentage: 0, bytesSent: 0, totalBytes: 0, speedMBps: 0, etaFormatted: '--:--',
    };
    this.uploadProgress = 0;
    this.nextItemId = 0;
    this.batchUploadLinks = [];
    this.closeEventSource();

    if (this.fileInputRef?.nativeElement) {
      this.fileInputRef.nativeElement.value = '';
    }
    if (this.folderInputRef?.nativeElement) {
      this.folderInputRef.nativeElement.value = '';
    }
    console.log('HomeComponent: Upload state has been reset.');
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.closeEventSource();
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

  triggerFileInput(): void { if (this.isUploading) return; this.fileInputRef?.nativeElement.click(); }
  triggerFolderInput(): void { if (this.isUploading) return; this.folderInputRef?.nativeElement.click(); }
  // onFileSelected(event: Event): void { const input = event.target as HTMLInputElement; if (input.files?.length) this.handleFiles(input.files); input.value = ''; }
  // onFolderSelected(event: Event): void { const input = event.target as HTMLInputElement; if (input.files?.length) this.handleFiles(input.files, true); input.value = ''; }
  onDragOver(event: DragEvent): void { if (this.isUploading) { if (event.dataTransfer) event.dataTransfer.dropEffect = 'none'; event.preventDefault(); event.stopPropagation(); return; } event.preventDefault(); event.stopPropagation(); this.isDragging = true; if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'; }
  onDragLeave(event: DragEvent): void { event.preventDefault(); event.stopPropagation(); const target = event.currentTarget as HTMLElement; const relatedTarget = event.relatedTarget as Node; if (!relatedTarget || !target.contains(relatedTarget)) this.isDragging = false; }
  onDrop(event: DragEvent): void { if (this.isUploading) { event.preventDefault(); event.stopPropagation(); this.isDragging = false; return; } event.preventDefault(); event.stopPropagation(); this.isDragging = false; const files = event.dataTransfer?.files; if (files && files.length > 0) this.handleFiles(files); }

  handleFiles(fileList: FileList, isFolderSelection: boolean = false): void { // Renamed for clarity
    if (this.isUploading) {
      alert("Wait for current upload or cancel it.");
      return;
    }
    if (this.shareableLinkForPanel || this.batchUploadLinks.length > 0) {
      // Reset if starting a new selection after a completed upload
      this.selectedItems = [];
      this.nextItemId = 0;
      this.shareableLinkForPanel = null;
      this.batchUploadLinks = [];
    }
    this.uploadError = null; // Clear previous errors

    if (!fileList || fileList.length === 0) return;

    const MAX_TOTAL_FILES = 5; // Your defined limit
    const currentCount = this.selectedItems.length;
    let slotsActuallyAvailable = MAX_TOTAL_FILES - currentCount;

    if (slotsActuallyAvailable <= 0) {
      this.uploadError = `You have already selected the maximum of ${MAX_TOTAL_FILES} files.`;
      // Clear the input fields to allow re-selection
      if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = '';
      if (this.folderInputRef?.nativeElement) this.folderInputRef.nativeElement.value = '';
      this.cdRef.detectChanges();
      return;
    }

    const newItems: SelectedItem[] = [];
    let filesAddedInThisOperation = 0;

    for (let i = 0; i < fileList.length; i++) {
      if (filesAddedInThisOperation >= slotsActuallyAvailable) {
        // We've hit the MAX_TOTAL_FILES limit (considering existing items + new ones)
        break;
      }

      const file = fileList[i];
      const name = isFolderSelection && file.webkitRelativePath ? file.webkitRelativePath : file.name;

      // Skip empty files that are not part of a folder structure (e.g., an empty file explicitly selected)
      if (file.size === 0 && !isFolderSelection && !name.includes('/')) {
        // console.log(`Skipping empty file: ${file.name}`);
        continue;
      }

      // Skip .DS_Store files or other system files if desired
      if (name.toLowerCase().endsWith('.ds_store')) {
        continue;
      }

      newItems.push({
        id: this.nextItemId++,
        file: file,
        name: name,
        size: file.size,
        icon: this.getFileIcon(name),
        // Determine if it's a folder based on webkitRelativePath or if the derived name indicates a path
        isFolder: isFolderSelection || (file.webkitRelativePath && file.webkitRelativePath.includes('/')) || (name !== file.name && name.includes('/'))
      });
      filesAddedInThisOperation++;
    }

    if (filesAddedInThisOperation > 0) {
      this.selectedItems = [...this.selectedItems, ...newItems];
      console.log('Items added:', newItems.length, 'Total selectedItems:', this.selectedItems.length, this.selectedItems); // DEBUG
      this.cdRef.detectChanges();
    }

    // Set error message if not all files from the selection could be added
    if (fileList.length > filesAddedInThisOperation && filesAddedInThisOperation < slotsActuallyAvailable) {
      // This case means some files were valid but we hit the overall MAX_TOTAL_FILES limit partway through processing fileList
      this.uploadError = `You can select a maximum of ${MAX_TOTAL_FILES} files in total. ${filesAddedInThisOperation} file(s) were added from your selection.`;
    } else if (fileList.length > slotsActuallyAvailable && filesAddedInThisOperation === 0 && currentCount < MAX_TOTAL_FILES) {
      // This means the user already had some files, and the new selection itself was too large to add any.
      this.uploadError = `Your selection exceeds the maximum of ${MAX_TOTAL_FILES} total files. No new files were added.`;
    } else if (fileList.length > slotsActuallyAvailable) {
      // This means the selection was larger than available slots, and we filled up the available slots.
      this.uploadError = `Your selection exceeds the maximum of ${MAX_TOTAL_FILES} total files. Only ${filesAddedInThisOperation} file(s) were added to reach the limit.`;
    }


    // Always clear the input fields after processing
    if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = '';
    if (this.folderInputRef?.nativeElement) this.folderInputRef.nativeElement.value = '';

    if (this.uploadError) {
      this.cdRef.detectChanges(); // Ensure error message is displayed
    }
  }

  // ... (rest of the component: onFileSelected, onFolderSelected need to pass the flag)

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.handleFiles(input.files, false); // Pass false for isFolderSelection
    }
    // input.value = ''; // Moved to inside handleFiles
  }

  onFolderSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.handleFiles(input.files, true); // Pass true for isFolderSelection
    }
    // input.value = ''; // Moved to inside handleFiles
  }

  initiateTransferFromPanel(): void {
    if (this.isUploading || this.selectedItems.length === 0) return;

    this.isUploading = true;
    this.uploadError = null;
    this.shareableLinkForPanel = null;
    this.batchUploadLinks = [];
    this.closeEventSource();

    const totalBatchSize = this.selectedItems.reduce((sum, item) => sum + item.size, 0);

    this.currentItemBeingUploaded = {
      id: -1,
      name: `Uploading ${this.selectedItems.length} item(s)...`,
      size: totalBatchSize,
      file: null as any,
      icon: 'fas fa-archive',
      isFolder: false
    };

    this.uploadProgressDetails = { percentage: 0, bytesSent: 0, totalBytes: totalBatchSize, speedMBps: 0, etaFormatted: '--:--' };
    this.uploadProgress = 0;
    this.uploadStatusMessage = `Initiating batch upload of ${this.selectedItems.length} item(s)...`;
    this.currentUploadId = null;
    this.cdRef.detectChanges();

    const formData = new FormData();

    // --- MODIFICATION START ---
    if (this.authService.isLoggedIn()) {
      // User is logged in. JWT will be attached by an interceptor (assumed).
      // The backend `routes.py` uses `get_jwt_identity()` so 'username' form field is not strictly needed
      // if JWT is present, but can be kept for logging or if backend logic changes.
      if (this.username) {
        // formData.append('username', this.username); // Optional: Backend primarily uses JWT
        console.log('HomeComponent: Logged in user initiating transfer.');
      }
    } else {
      // User is anonymous. Get or generate an anonymous ID and send it.
      const anonymousId = this.authService.getOrGenerateAnonymousUploadId();
      if (anonymousId) {
        formData.append('anonymous_upload_id', anonymousId);
        console.log('HomeComponent: Anonymous user initiating transfer with ID:', anonymousId);
      } else {
        // Handle case where anonymous ID couldn't be generated (e.g., localStorage issue)
        this.handleBatchUploadError('Could not generate an identifier for anonymous upload. Please enable cookies/localStorage or try logging in.');
        return;
      }
    }
    // --- MODIFICATION END ---

    for (const item of this.selectedItems) {
      formData.append('files[]', item.file, item.name);
    }

    this.apiService.initiateUpload(formData).subscribe({
      next: (res: InitiateUploadResponse) => {
        if (!this.isUploading) return;
        if (res.upload_id) {
          this.currentUploadId = res.upload_id;
          this.listenToUploadProgress(res.upload_id, this.currentItemBeingUploaded);
        } else {
          this.handleBatchUploadError('Server did not return a valid upload ID for the batch.');
        }
      },
      error: (err: Error) => {
        if (!this.isUploading) return;
        this.handleBatchUploadError(`Failed to initiate batch upload: ${err.message}`);
      }
    });
  }

  // src/app/component/home/home.component.ts
  // ... (other code)

  private listenToUploadProgress(uploadId: string, batchItemRepresentation: SelectedItem | null): void {
    const apiUrl = this.apiService.getApiBaseUrl(); // Your API base URL
    const url = `${apiUrl}/stream-progress/${uploadId}`; // SSE endpoint

    try {
      this.eventSource = new EventSource(url, { withCredentials: this.authService.isLoggedIn() });

      // ... (onopen, start, status, progress event listeners remain the same)

      this.eventSource.addEventListener('complete', (event) => {
        this.zone.run(() => {
          if (uploadId !== this.currentUploadId || !this.isUploading) {
            console.log(`SSE 'complete' event for ${uploadId} ignored (current: ${this.currentUploadId}, uploading: ${this.isUploading})`);
            this.closeEventSource();
            return;
          }

          const data = JSON.parse((event as MessageEvent).data);
          this.uploadStatusMessage = data.message || `Batch upload complete!`;

          // --- THIS IS THE CRUCIAL MODIFICATION FOR THE SHAREABLE LINK ---
          if (data.batch_access_id) { // Assuming your backend sends 'batch_access_id'
            this.completedBatchAccessId = data.batch_access_id; // Used if you show BatchFileBrowserComponent inline in HomeComponent

            // Construct the full shareable link for opening in a new tab
            // window.location.origin gives your Angular app's base URL (e.g., "http://localhost:4200")
            const frontendBaseUrl = window.location.origin;
            this.shareableLinkForPanel = `${frontendBaseUrl}/browse/${data.batch_access_id}`;

            console.log(`HomeComponent: Generated shareable link: ${this.shareableLinkForPanel}`);

          } else {
            console.error("HomeComponent: SSE 'complete' event is MISSING 'batch_access_id' from the backend. Cannot generate correct shareable link.");
            this.uploadError = "Upload complete, but could not generate a shareable batch link.";
            this.shareableLinkForPanel = null; // Clear any old link
          }
          // --- END OF CRUCIAL MODIFICATION ---

          this.uploadProgress = 100;
          this.isUploading = false;
          this.currentItemBeingUploaded = null;

          if (this.currentUser && this.username) {
            this.loadUserFileCount();
            this.uploadEventService.notifyUploadComplete();
          }
          this.closeEventSource();
          this.cdRef.detectChanges();
        });
      });

      this.eventSource.onerror = (errorEvent) => {
        this.zone.run(() => {
          if (uploadId !== this.currentUploadId || !this.isUploading) {
            // ... (ignore logic)
            return;
          }
          // ... (your existing onerror logic)
          console.error("SSE Error Event for active upload: ", errorEvent);
          this.handleBatchUploadError('SSE connection error during upload.', errorEvent);
        });
      };
    } catch (error) {
      console.error("Failed to create EventSource:", error);
      this.handleBatchUploadError(`Client-side error setting up upload progress: ${(error as Error).message}`);
    }
  }

  // ... (rest of your component code)

  private handleBatchUploadError(errorMessage: string, errorEvent?: any): void {
    if (errorEvent) console.error("Error during batch upload:", errorMessage, errorEvent);
    else console.error("Error during batch upload:", errorMessage);

    this.zone.run(() => {
      this.uploadError = errorMessage;
      this.isUploading = false;
      // Keep totalBytes for potential retry display, reset others
      this.uploadProgressDetails = {
        ...this.uploadProgressDetails,
        percentage: 0,
        bytesSent: 0,
        speedMBps: 0,
        etaFormatted: '--:--',
      };
      this.uploadProgress = 0;
      this.uploadStatusMessage = 'Batch Upload Failed';
      // Don't nullify currentItemBeingUploaded immediately,
      // transfer panel might want to show the failed item.
      // this.currentItemBeingUploaded = null;
      // this.currentUploadId = null;
      this.closeEventSource();
      this.cdRef.detectChanges();
    });
  }

  handleCancelUpload(): void {
    if (!this.isUploading) return;

    console.log('HomeComponent: Cancelling upload for ID:', this.currentUploadId);
    const uploadIdToCancel = this.currentUploadId; // Capture before resetting

    this.isUploading = false; // Set this first to prevent SSE error handlers from misinterpreting
    this.closeEventSource();

    this.uploadStatusMessage = `Batch upload cancelled.`;
    this.uploadError = `Batch upload cancelled by user.`;


    // Client-side cancellation of further processing
    this.currentItemBeingUploaded = null;
    this.currentUploadId = null; // Important to nullify so SSE errors after this are ignored

    this.uploadProgressDetails = {
      ...this.uploadProgressDetails,
      percentage: 0,
      bytesSent: 0,
      speedMBps: 0,
      etaFormatted: '--:--',
    };
    this.uploadProgress = 0;

    // TODO: If your backend supports cancelling an ongoing upload, call an API endpoint here
    // if (uploadIdToCancel) {
    //   this.apiService.cancelUploadOnServer(uploadIdToCancel).subscribe({
    //     next: () => console.log(`Server notified of cancellation for ${uploadIdToCancel}`),
    //     error: (err) => console.error(`Error notifying server of cancellation for ${uploadIdToCancel}`, err)
    //   });
    // }

    this.cdRef.detectChanges();
  }

  private closeEventSource(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('HomeComponent: EventSource closed.');
    }
  }

  handleItemRemovedFromPanel(itemOrUndefined: SelectedItem | undefined): void {
    if (this.isUploading) {
      alert("Cannot remove items during upload. Please cancel the upload first.");
      return;
    }

    if (itemOrUndefined) {
      // Individual item removal
      this.selectedItems = this.selectedItems.filter(i => i.id !== itemOrUndefined.id);
      console.log('HomeComponent: Removed item:', itemOrUndefined.name);
      if (this.selectedItems.length === 0) {
        // If all items are removed one by one, reset relevant state
        this.shareableLinkForPanel = null;
        this.uploadError = null;
        this.uploadStatusMessage = '';
        this.batchUploadLinks = [];
        this.currentItemBeingUploaded = null; // Should be null if not uploading
        // nextItemId is not reset here as new items will continue the sequence
      }
    } else {
      // Clear all items (undefined was emitted)
      this.shareableLinkForPanel = null;
      this.selectedItems = [];
      this.uploadError = null;
      this.uploadStatusMessage = '';
      this.batchUploadLinks = [];
      this.currentItemBeingUploaded = null;
      this.nextItemId = 0; // Reset for a completely new selection
      console.log('HomeComponent: All items cleared from panel.');
    }
    this.cdRef.detectChanges();
  }

  handleDownloadRequest(itemToDownload: SelectedItem): void {
    // ... (same as before)
    if (this.isUploading) return;
    try {
      if (!(itemToDownload.file instanceof File)) {
        if (itemToDownload.id === -1 && this.shareableLinkForPanel) {
          alert("This represents the batch. Download individual files from links if available, or the main batch link.");
          return;
        }
        alert("Cannot download this item, it's not a valid local file.");
        return;
      }
      const link = document.createElement('a');
      const url = URL.createObjectURL(itemToDownload.file);
      link.href = url;
      link.download = itemToDownload.file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error initiating local file download:", error);
      alert("Could not initiate local file download.");
    }
  }

  startTransfer(): void {
    this.triggerFileInput();
  }

  getFileIcon(filename: string | undefined): string {
    // ... (same as before)
    if (!filename) return 'fas fa-question-circle';
    const baseNameForIcon = filename.includes('/') ? filename.substring(filename.lastIndexOf('/') + 1) : filename;
    if (!baseNameForIcon.includes('.')) return filename.includes('/') ? 'fas fa-folder' : 'fas fa-file';

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
      default: return 'fas fa-file text-muted';
    }
  }
}