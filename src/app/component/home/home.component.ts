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
    CtaSectionComponent, UploadProgressItemComponent, ByteFormatPipe, DatePipe
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

  @ViewChild('fileInputForStart') fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('folderInputForStart') folderInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('dropZoneTarget') dropZoneRef!: ElementRef<HTMLElement>;

  currentUser: User | null = null;
  username: string = ''; // Will be set if user is logged in

  isUploading: boolean = false;
  uploadError: string | null = null;
  isDragging = false;
  selectedItems: SelectedItem[] = [];
  shareableLinkForPanel: string | null = null;
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
  onFileSelected(event: Event): void { const input = event.target as HTMLInputElement; if (input.files?.length) this.handleFiles(input.files); input.value = ''; }
  onFolderSelected(event: Event): void { const input = event.target as HTMLInputElement; if (input.files?.length) this.handleFiles(input.files, true); input.value = ''; }
  onDragOver(event: DragEvent): void { if (this.isUploading) { if (event.dataTransfer) event.dataTransfer.dropEffect = 'none'; event.preventDefault(); event.stopPropagation(); return; } event.preventDefault(); event.stopPropagation(); this.isDragging = true; if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'; }
  onDragLeave(event: DragEvent): void { event.preventDefault(); event.stopPropagation(); const target = event.currentTarget as HTMLElement; const relatedTarget = event.relatedTarget as Node; if (!relatedTarget || !target.contains(relatedTarget)) this.isDragging = false; }
  onDrop(event: DragEvent): void { if (this.isUploading) { event.preventDefault(); event.stopPropagation(); this.isDragging = false; return; } event.preventDefault(); event.stopPropagation(); this.isDragging = false; const files = event.dataTransfer?.files; if (files && files.length > 0) this.handleFiles(files); }

  handleFiles(fileList: FileList, isFolderContent: boolean = false): void {
    if (this.isUploading) {
      alert("Wait for current upload or cancel it.");
      return;
    }
    if (this.shareableLinkForPanel || this.batchUploadLinks.length > 0) {
      this.selectedItems = [];
      this.nextItemId = 0;
      this.shareableLinkForPanel = null;
      this.batchUploadLinks = [];
    }
    this.uploadError = null;

    if (!fileList || fileList.length === 0) return;
    const MAX_TOTAL_FILES = 5;
    const currentCount = this.selectedItems.length;
    const availableSlots = MAX_TOTAL_FILES - currentCount;

    if (availableSlots <= 0) {
      this.uploadError = `You have already selected the maximum of ${MAX_TOTAL_FILES} files.`;
      if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = '';
      if (this.folderInputRef?.nativeElement) this.folderInputRef.nativeElement.value = '';
      this.cdRef.detectChanges();
      return;
    }

    let filesToAddCount = 0;
    const newItems: SelectedItem[] = [];
    for (let i = 0; i < fileList.length && filesToAddCount < availableSlots; i++) {
      const file = fileList[i];
      const name = isFolderContent && file.webkitRelativePath ? file.webkitRelativePath : file.name;

      if (file.size === 0 && !isFolderContent && !name.includes('/')) {
        continue;
      }
      newItems.push({
        id: this.nextItemId++,
        file: file,
        name: name,
        size: file.size,
        icon: this.getFileIcon(name),
        isFolder: isFolderContent || (file.webkitRelativePath && file.webkitRelativePath.includes('/')) || (name !== file.name && name.includes('/'))
      });
      filesToAddCount++;
    }

    if (fileList.length > filesToAddCount && filesToAddCount < availableSlots) {
      this.uploadError = `You can select a maximum of ${MAX_TOTAL_FILES} files in total. ${filesToAddCount} file(s) were added from your selection.`;
    } else if (fileList.length > availableSlots && filesToAddCount === 0 && currentCount < MAX_TOTAL_FILES) {
      this.uploadError = `Your selection exceeds the maximum of ${MAX_TOTAL_FILES} total files. No new files were added.`;
    } else if (fileList.length > availableSlots) {
      this.uploadError = `Your selection exceeds the maximum of ${MAX_TOTAL_FILES} total files. Only ${filesToAddCount} files were added.`;
    }

    this.zone.run(() => {
      this.selectedItems = [...this.selectedItems, ...newItems];
      this.cdRef.detectChanges();
    });

    if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = '';
    if (this.folderInputRef?.nativeElement) this.folderInputRef.nativeElement.value = '';
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

  private listenToUploadProgress(uploadId: string, batchItemRepresentation: SelectedItem | null): void {
    const apiUrl = this.apiService.getApiBaseUrl();
    const url = `${apiUrl}/stream-progress/${uploadId}`;
    try {
      this.eventSource = new EventSource(url, { withCredentials: this.authService.isLoggedIn() }); // Pass withCredentials if logged in

      this.eventSource.onopen = () => {
        this.zone.run(() => {
          console.log(`SSE connection opened for upload ID: ${uploadId}`);
          this.uploadStatusMessage = `Connection established. Starting upload...`;
          this.cdRef.detectChanges();
        });
      };

      this.eventSource.addEventListener('start', (event) => {
        this.zone.run(() => {
          const data = JSON.parse((event as MessageEvent).data);
          this.uploadStatusMessage = data.message || `Processing files for batch...`;
          if (data.total_bytes_for_batch) {
            this.uploadProgressDetails.totalBytes = data.total_bytes_for_batch;
          }
          this.cdRef.detectChanges();
        });
      });

      this.eventSource.addEventListener('status', (event) => {
        this.zone.run(() => {
          const data = JSON.parse((event as MessageEvent).data);
          this.uploadStatusMessage = data.message || 'Updating status...';
          if (data.filename && batchItemRepresentation) { // Update display name if provided
            // This might conflict if we set a generic batch name
            // this.currentItemBeingUploaded.name = data.filename;
          }
          this.cdRef.detectChanges();
        });
      });

      this.eventSource.addEventListener('progress', (event) => {
        this.zone.run(() => {
          const data = JSON.parse((event as MessageEvent).data);
          this.uploadProgressDetails = {
            percentage: data.percentage_complete,
            bytesSent: data.bytes_sent_for_batch,
            totalBytes: data.total_bytes_for_batch || this.uploadProgressDetails.totalBytes,
            speedMBps: data.speed_mbps,
            etaFormatted: data.eta_formatted,
          };
          this.uploadProgress = data.percentage_complete;
          this.uploadStatusMessage = data.message || `Uploading... ${data.percentage_complete.toFixed(1)}%`;
          this.cdRef.detectChanges();
        });
      });

      this.eventSource.addEventListener('complete', (event) => {
        if (!this.isUploading && this.currentUploadId !== uploadId) {
          this.closeEventSource(); return;
        }
        this.zone.run(() => {
          const data = JSON.parse((event as MessageEvent).data);
          this.uploadStatusMessage = data.message || `Batch upload complete!`;

          if (data.download_url) { // For single combined batch link
            this.shareableLinkForPanel = data.download_url;
          } else if (data.files_completed && Array.isArray(data.files_completed)) { // For multiple individual links
            this.batchUploadLinks = data.files_completed.map((f: any) => ({ name: f.name, url: f.url }));
            if (this.batchUploadLinks.length > 0 && !this.shareableLinkForPanel) {
              // If no single batch link, use the first file's link as the primary panel link (optional)
              // this.shareableLinkForPanel = this.batchUploadLinks[0].url;
            }
          }


          this.uploadProgress = 100;
          this.isUploading = false;
          this.currentItemBeingUploaded = null; // Clear the synthetic batch item
          // this.currentUploadId = null; // Keep it if you want to reference the completed batch

          if (this.currentUser && this.username) {
            console.log('HomeComponent: Upload complete. Preparing to notify.');
            this.loadUserFileCount();
            this.uploadEventService.notifyUploadComplete();
            console.log('HomeComponent: Notification sent.');
          }
          this.closeEventSource();
          this.cdRef.detectChanges();
        });
      });

      this.eventSource.onerror = (errorEvent) => {
        // Don't call handleBatchUploadError if we initiated the close
        if (!this.isUploading && this.currentUploadId !== uploadId) {
          console.log("SSE error after explicit close/cancellation, ignoring.");
          return;
        }
        this.zone.run(() => {
          let errorMessage = 'SSE connection error.';
          if (errorEvent && (errorEvent as any).message) {
            errorMessage += ` Details: ${(errorEvent as any).message}`;
          } else if (this.eventSource && this.eventSource.readyState === EventSource.CLOSED) {
            // Could be a network issue, or server closed connection unexpectedly.
            // If upload was nearly complete, this might not be a fatal error for the upload itself.
            // The 'complete' event might have been missed.
            if (this.uploadProgress > 95) { // Heuristic
              errorMessage = 'SSE connection lost. Upload may have completed. Check file list.';
              // Potentially treat as complete or prompt user to check.
            } else {
              errorMessage = 'SSE connection closed unexpectedly by the server or network.';
            }
          }
          console.error("SSE Error Event: ", errorEvent);
          this.handleBatchUploadError(errorMessage, errorEvent);
        });
      };
    } catch (error) {
      console.error("Failed to create EventSource:", error);
      this.handleBatchUploadError(`Client-side error setting up upload progress: ${(error as Error).message}`);
    }
  }

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

  removeItemFromPanel(): void {
    if (this.isUploading) {
      alert("Cannot remove items during upload. Please cancel the upload first.");
      return;
    }
    this.resetUploadState(); // resetUploadState clears selectedItems and related UI elements
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