// src/app/component/home/home.component.ts
import { Component, inject, ViewChild, ElementRef, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../shared/services/auth.service'; // Adjust path if needed
import {
  FileManagerApiService,
  InitiateUploadResponse,
  BasicApiResponse // Assuming BasicApiResponse is defined in the service
} from '../../shared/services/file-manager-api.service'; // Adjust path if needed
// Import SelectedItem from the panel component as well
import { TransferPanelComponent, SelectedItem } from '../transfer-panel/transfer-panel.component'; // Adjust path if needed
import { FaqAccordionComponent } from '../faq-accordion/faq-accordion.component';
import { CtaSectionComponent } from '../cta-section/cta-section.component';
import { UploadProgressItemComponent } from '../upload-progress-item/upload-progress-item.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TransferPanelComponent, // Ensure panel is imported
    FaqAccordionComponent,
    CtaSectionComponent,
    UploadProgressItemComponent // Ensure progress item is imported
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {
  // --- Dependency Injection ---
  private router = inject(Router);
  private authService = inject(AuthService);
  private apiService = inject(FileManagerApiService);
  private zone = inject(NgZone); // NgZone helps run updates within Angular's context
  private cdRef = inject(ChangeDetectorRef); // For manual change detection triggering

  // --- ViewChild References ---
  @ViewChild('fileInputForStart') fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('folderInputForStart') folderInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('dropZoneTarget') dropZoneRef!: ElementRef<HTMLElement>;

  // --- Component State ---
  currentYear = new Date().getFullYear();
  username: string = ''; // Will be empty if not logged in
  isUploading: boolean = false; // Controlled by SSE flow
  uploadError: string | null = null;
  isDragging = false;
  selectedItems: SelectedItem[] = []; // Holds the SINGLE batch of items for upload
  shareableLinkForPanel: string | null = null; // Holds the link after successful upload

  currentItemBeingUploaded: SelectedItem | null = null; // Represents the batch being uploaded
  currentUploadId: string | null = null;
  // --- SSE State ---
  private eventSource: EventSource | null = null;
  uploadProgress: number = 0; // Percentage (0-100)
  uploadStatusMessage: string = ''; // e.g., "Compressing...", "Sending chunk..."

  // --- Private Properties ---
  private nextItemId = 0;
  private authSubscription: Subscription | null = null;

  // --- Static Content Arrays (for template) ---
  stepContent = [
    { number: '1', title: ' Select your file(s)', des: 'Select the file(s) and/or folder(s) you want to send from your computer or smartphone.' },
    { number: '2', title: ' Fill out the form', des: 'Fill out the transfer form - enter your email address as well as the recipient(s) email address(es). Send large files by email or generate a share link.' },
    { number: '3', title: ' Transfer files', des: 'Click "Send" to start uploading your files via our secure servers nearby you thanks to our global infrastructure.' },
  ];

  transferList = [
    { img: "assets/image/download (2).svg", des: "Customize and integrate our widget to receive files from your clients or other contacts directly from your own website." },
    { img: "assets/image/customized.svg", des: "Build your own file reception forms and add your customized fields (text fields, drop-down lists, checkboxes, and radio buttons)." },
    { img: "assets/image/clous.svg", des: "The transferred files are stored on our secure cloud and you will receive a notification to inform you that a new transfer was received on your account." }
  ]

  apps = [
    { img: "assets/image/windows.svg", title: "Windows" },
    { img: "assets/image/macos-D1UzuEXe.svg", title: "macOS" },
    { img: "assets/image/ios-B-i3hJIr.svg", title: "iOS" },
    { img: "assets/android-ByKVTp40.svg", title: "Android" },
  ]

  // --- Lifecycle Hooks ---
  ngOnInit(): void {
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      this.zone.run(() => {
        const oldUsername = this.username;
        this.username = user?.email || '';
        if (oldUsername !== this.username) {
          console.log('HomeComponent: User context updated:', this.username || 'Anonymous/Logged Out');
          this.cdRef.detectChanges();
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.closeEventSource();
  }

  // --- UI Event Handlers: Triggering File Inputs ---
  triggerFileInput(): void {
    // Allow triggering only if not uploading AND no items are already selected
    if (this.isUploading || this.selectedItems.length > 0) return;
    this.fileInputRef?.nativeElement.click();
  }

  triggerFolderInput(): void {
    // Allow triggering only if not uploading AND no items are already selected
    if (this.isUploading || this.selectedItems.length > 0) return;
    console.warn('Requesting folder selection. Browser support/API handling varies.');
    this.folderInputRef?.nativeElement.click();
  }

  // --- UI Event Handlers: File Selection & Drag/Drop ---
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.handleFiles(input.files); // Process the files
    }
    input.value = ''; // Reset input
  }

  onFolderSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      console.log(`Folder selected, containing ${input.files.length} files.`);
      this.handleFiles(input.files, true); // Process the files
    }
    input.value = ''; // Reset input
  }

  onDragOver(event: DragEvent): void {
    // ** MODIFIED: Allow dropping ONLY if no items are currently selected AND upload isn't happening **
    if (this.selectedItems.length > 0 || this.isUploading) {
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none'; // Indicate not allowed
      // Prevent default to stop browser opening file, but don't set isDragging
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    const relatedTarget = event.relatedTarget as Node;
    if (!relatedTarget || !target.contains(relatedTarget)) {
      this.isDragging = false;
    }
  }

  onDrop(event: DragEvent): void {
    // ** MODIFIED: Allow dropping ONLY if no items are currently selected AND upload isn't happening **
    if (this.selectedItems.length > 0 || this.isUploading) {
      event.preventDefault(); // Still prevent default browser handling
      event.stopPropagation();
      this.isDragging = false; // Reset dragging state
      console.log("Drop ignored: An item is already selected or upload is in progress.");
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFiles(files); // Process the dropped files
    }
  }

  // --- Internal Logic: Processing Selected Files ---
  handleFiles(fileList: FileList, isFolderContent: boolean = false): void {
    // ** MODIFIED: Check if upload is in progress (safety check) **
    if (this.isUploading) {
      console.warn("Cannot add files while an upload is in progress.");
      alert("Please wait for the current upload to complete or cancel it before adding new files.");
      return;
    }
    // The check for selectedItems.length > 0 is now handled by the trigger/drag/drop events,
    // so this function assumes it's okay to proceed and *replace* the selection.

    this.uploadError = null; // Clear previous errors
    this.shareableLinkForPanel = null; // Clear previous link
    if (!fileList || fileList.length === 0) return;

    console.log(`Processing ${fileList.length} selected file(s). Folder content: ${isFolderContent}. Replacing existing selection.`);
    const newItems: SelectedItem[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const name = isFolderContent && file.webkitRelativePath ? file.webkitRelativePath : file.name;

      if (file.size === 0 && !isFolderContent) {
        console.warn(`Skipping zero-byte file: ${name}`);
        continue;
      }

      newItems.push({
        id: this.nextItemId++,
        file: file,
        name: name,
        size: file.size,
        icon: this.getFileIcon(name), // Determine icon based on name/extension
        isFolder: isFolderContent || (name !== file.name && name.includes('/')) // Refined heuristic
      });
    }

    if (newItems.length > 0) {
      console.log(`Setting selection with ${newItems.length} valid item(s).`);
      this.zone.run(() => {
        // *** CRITICAL CHANGE: Replace the array instead of appending ***
        this.selectedItems = [...newItems]; // Create a new array with the new items
        this.cdRef.detectChanges(); // Update the view
      });
    } else {
      console.log("No valid items to add from selection.");
      // Ensure list is cleared if selection resulted in no valid items
      this.zone.run(() => {
        this.selectedItems = [];
        this.cdRef.detectChanges();
      });
    }
  }

  // --- Action: Initiate Upload Process (Triggered by Panel Button via transferInitiated event) ---
  initiateTransferFromPanel(): void {
    if (this.isUploading || this.selectedItems.length === 0) {
      console.log("Upload blocked: Already uploading or no items selected.");
      return;
    }

    
    // --- IMPORTANT BACKEND NOTE ---
    // The current backend `/initiate-upload` likely expects *one* file based on typical examples.
    // If `selectedItems` contains multiple files (from multi-select or folder drop),
    // the FormData construction below needs to match what the backend expects.
    // If the backend expects only one file per /initiate-upload call, you should either:
    //    a) Prevent multi-select/folder drop entirely.
    //    b) Zip files client-side before sending (complex).
    //    c) Change the backend to handle multiple 'file' fields or a specific structure.
    // The code below currently sends ONLY THE FIRST file from `selectedItems`.
    // --- --- --- --- --- --- --- ---

    const itemsToUpload = this.selectedItems; // This is the single batch selected by the user
    if (itemsToUpload.length === 0) return; // Should not happen if button is visible

    console.log(`Initiating SSE upload process for the batch of ${itemsToUpload.length} item(s).`);
    if (!this.username) {
      console.log("Initiating as ANONYMOUS user.");
    }

    // Reset state before starting
    this.isUploading = true;
    this.uploadError = null;
    this.uploadProgress = 0;
    this.uploadStatusMessage = 'Initiating...';
    this.shareableLinkForPanel = null;
    this.closeEventSource(); // Close any previous connection

    // Display the first item in the progress overlay as a representative item
    this.currentItemBeingUploaded = itemsToUpload[0];
    this.currentUploadId = null;
    this.cdRef.detectChanges();

    // 1. Call /initiate-upload API first using the service
    const formData = new FormData();
    // *** SENDING ONLY THE FIRST FILE - ADJUST IF BACKEND HANDLES MULTIPLE ***
    formData.append('file', itemsToUpload[0].file, itemsToUpload[0].file.name); // Use original name
    console.warn(`Sending only the first file ('${itemsToUpload[0].name}') of the batch to /initiate-upload. Backend must handle this or logic needs change.`);

    // Example for sending multiple files (REQUIRES BACKEND SUPPORT):
    // itemsToUpload.forEach(item => {
    //   formData.append('files', item.file, item.file.webkitRelativePath || item.file.name); // Send relative path if available
    // });


    // Conditionally add username
    if (this.username) {
      formData.append('username', this.username);
      console.log(`Uploading as user: ${this.username}`);
    } else {
      console.log(`Uploading without specific username (anonymous).`);
    }

    this.apiService.initiateUpload(formData).subscribe({
      next: (res: InitiateUploadResponse) => {
        console.log('API Success: /initiate-upload completed:', res);
        if (res.upload_id) {
          // 2. If initiate is successful, start listening to SSE stream
          this.currentUploadId = res.upload_id;
          // Pass the representative item for display purposes
          this.listenToUploadProgress(res.upload_id, this.currentItemBeingUploaded!);
        } else {
          this.handleUploadError('Server did not return a valid upload ID.');
        }
      },
      error: (err: Error) => {
        this.handleUploadError(`Failed to initiate upload: ${err.message}`);
      }
    });
  }

  // --- Private: Listen to Server-Sent Events for Upload Progress ---
  private listenToUploadProgress(uploadId: string, uploadedItemRepresentation: SelectedItem): void {
    const apiUrl = this.apiService.getApiBaseUrl(); // Get base URL from service
    const url = `${apiUrl}/stream-progress/${uploadId}`;
    console.log(`Connecting to SSE stream: ${url}`);

    try {
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = (event) => {
        this.zone.run(() => {
          console.log('SSE connection opened.');
          this.uploadStatusMessage = 'Connected, preparing upload...';
          this.cdRef.detectChanges();
        });
      };

      this.eventSource.addEventListener('start', (event) => {
        this.zone.run(() => {
          const data = JSON.parse((event as MessageEvent).data);
          console.log('SSE event: start', data);
          this.uploadStatusMessage = 'Upload starting...';
          this.uploadProgress = 0;
          this.cdRef.detectChanges();
        });
      });

      this.eventSource.addEventListener('status', (event) => {
        this.zone.run(() => {
          const data = JSON.parse((event as MessageEvent).data);
          console.log('SSE event: status', data);
          this.uploadStatusMessage = data.message || 'Processing...';
          this.cdRef.detectChanges();
        });
      });

      this.eventSource.addEventListener('progress', (event) => {
        this.zone.run(() => {
          const data = JSON.parse((event as MessageEvent).data);
          console.log('SSE event: progress', data);
          this.uploadProgress = data.percentage !== undefined ? Math.round(data.percentage) : this.uploadProgress;
          this.cdRef.detectChanges();
        });
      });

      this.eventSource.addEventListener('complete', (event) => {
        this.zone.run(() => {
          const data = JSON.parse((event as MessageEvent).data);
          console.log('SSE event: complete', data);
          this.uploadStatusMessage = data.message || 'Upload complete!';
          this.shareableLinkForPanel = data.download_url || null; // Get the link
          this.uploadProgress = 100;
          this.isUploading = false; // Mark upload as finished

          this.currentItemBeingUploaded = null; // Clear the item being shown in progress
          this.currentUploadId = null;

          // *** CRITICAL CHANGE: Clear the selected items list upon successful completion ***
          this.selectedItems = []; // Reset for the next single batch upload

          this.closeEventSource(); // Close connection on success
          this.cdRef.detectChanges();
        });
      });

      this.eventSource.onerror = (event: MessageEvent | Event) => {
        console.error('SSE Error event received:', event);
        let errorMessage = 'An unknown error occurred during upload.';
        if (event instanceof MessageEvent && event.data) {
          try {
            const data = JSON.parse(event.data);
            errorMessage = data.message || 'Received error from server.';
            console.error('SSE received error data:', data);
          } catch (e) {
            errorMessage = 'Received unrecognised error event from server.';
            console.error('SSE received non-JSON error data:', event.data);
          }
          this.handleUploadError(errorMessage);
        } else {
          console.error('SSE connection error or closed unexpectedly.');
          if (this.isUploading) {
            this.handleUploadError('Connection to server lost during upload.');
          } else {
            console.log('SSE connection closed (expected after completion/error/manual close).');
            this.closeEventSource();
          }
        }
      };

    } catch (error) {
      console.error("Failed to create EventSource:", error);
      this.handleUploadError('Could not connect to upload progress server.');
    }
  }

  // --- Private: Handle Upload Errors and Cleanup SSE ---
  private handleUploadError(errorMessage: string): void {
    this.zone.run(() => {
      console.error("Handling upload error:", errorMessage);
      this.uploadError = errorMessage; // Display error message to user
      this.isUploading = false; // Stop upload state
      this.uploadProgress = 0; // Reset progress
      this.uploadStatusMessage = 'Upload Failed';

      this.currentItemBeingUploaded = null; // Clear progress display item
      this.currentUploadId = null;
      this.closeEventSource(); // IMPORTANT: Close SSE connection

      // *** CRITICAL CHANGE: Do NOT clear selectedItems on error ***
      // This allows the user to see what failed and potentially remove it manually.
      // this.selectedItems = []; // REMOVED

      this.cdRef.detectChanges(); // Update the view
    });
  }

  // --- Action: Cancel Upload ---
  handleCancelUpload(): void {
    console.log('Cancel requested via progress item.');
    if (this.currentItemBeingUploaded && this.currentUploadId) {
      console.log(`Attempting to cancel upload for: ${this.currentItemBeingUploaded.name} (ID: ${this.currentUploadId})`);

      // --- IMPORTANT: Requires Backend Endpoint ---
      // You NEED a backend endpoint (e.g., /cancel-upload/{uploadId}) to actually stop processing.
      // This frontend code only cleans up the UI and SSE connection.
      // Example (requires adding `cancelUpload` to your API service):
      // this.apiService.cancelUpload(this.currentUploadId).subscribe({
      //   next: () => console.log('Backend acknowledged cancellation.'),
      //   error: (err) => console.error('Failed to notify backend of cancellation:', err)
      // });
      console.warn("Frontend cancellation only. Backend endpoint needed to fully stop upload processing.");
      // --- --- --- --- --- --- --- --- --- --- --- ---

      // Clean up frontend state using existing error handler logic
      this.handleUploadError('Upload cancelled by user.');

    } else {
      console.warn('Cancel requested but no item or upload ID found.');
      // Ensure cleanup even if state is inconsistent
      this.isUploading = false;
      this.currentItemBeingUploaded = null;
      this.currentUploadId = null;
      this.closeEventSource();
      this.cdRef.detectChanges();
    }
  }

  // --- Private: Close SSE Connection Safely ---
  private closeEventSource(): void {
    if (this.eventSource) {
      console.log("Closing SSE connection.");
      this.eventSource.close(); // Close the connection
      this.eventSource = null; // Clear the reference
    }
  }

  // --- Action: Remove Item(s) from Panel (Triggered by itemRemoved event) ---
  // ** MODIFIED: Now always clears the single batch **
  removeItemFromPanel(): void { // No longer needs `itemToRemove` argument
    if (this.isUploading) {
      // Prevent removal during upload
      alert("Cannot remove items while an upload is in progress. Please wait or cancel.");
      return;
    }

    // Clear any existing shareable link when the list is modified
    this.shareableLinkForPanel = null;

    console.log('Removing the current selection (batch).');
    // Clear the entire selectedItems array
    this.selectedItems = [];

    // Optional: Add backend deletion logic here if needed, related to the *potential* upload
    // This is tricky because the upload might not have even started.
    // Typically, you wouldn't delete anything on the backend just from clearing the UI selection.
    // Deletion is usually tied to an existing uploaded file.
    // if (this.username) {
    //   console.log(`TODO: If necessary, implement logic to inform backend about cancelled selection for user '${this.username}'`);
    // }

    this.cdRef.detectChanges(); // Update the view
  }

  // --- Action: Handle Local Download Request (Triggered by itemDownloadRequested event) ---
  handleDownloadRequest(itemToDownload: SelectedItem): void {
    if (this.isUploading) return; // Prevent local download during upload

    console.log(`Download requested for LOCAL file: ${itemToDownload.name}`);
    // Simulate browser download of the local File object
    try {
      const link = document.createElement('a');
      const url = URL.createObjectURL(itemToDownload.file);
      link.href = url;
      link.download = itemToDownload.file.name; // Use original filename
      document.body.appendChild(link); // Append link to body (needed for Firefox)
      link.click(); // Simulate a click
      document.body.removeChild(link); // Remove the link
      URL.revokeObjectURL(url); // Clean up the object URL
    } catch (error) {
      console.error("Could not simulate local download:", error);
      alert("Could not initiate local file download."); // User feedback
    }
  }

  // --- Utility: Check Login Status ---
  // This isn't used to block uploads anymore but might be useful elsewhere.
  private checkLoginAndShowError(): boolean {
    if (typeof this.authService.isLoggedIn !== 'function') {
      console.error("AuthService is missing the 'isLoggedIn' method!");
      return false;
    }
    if (!this.authService.isLoggedIn()) {
      console.log("User is not logged in (checkLoginAndShowError).");
      return false;
    }
    if (!this.username) {
      console.warn("User logged in according to AuthService, but username missing (checkLoginAndShowError).");
      return false;
    }
    return true; // User appears to be logged in
  }

  // --- Utility: Original "Start" Button Action ---
  startTransfer(): void {
    // This is linked to the big initial "Start" button
    // It should now trigger file selection only if no items are selected
    this.triggerFileInput();
  }

  // --- Utility: Get File Icon Class ---
  getFileIcon(filename: string | undefined): string {
    if (!filename) return 'fas fa-question-circle'; // Icon for unknown

    const baseName = filename.includes('/') ? filename.substring(filename.lastIndexOf('/') + 1) : filename;

    // Handle files without extensions (treat as generic file unless path indicated folder)
    if (!baseName.includes('.')) {
      // If the original name had a path separator, it's likely from a folder upload
      return filename.includes('/') ? 'fas fa-folder' : 'fas fa-file';
    }

    const extension = baseName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf': return 'fas fa-file-pdf';
      case 'doc': case 'docx': return 'fas fa-file-word';
      case 'xls': case 'xlsx': return 'fas fa-file-excel';
      case 'ppt': case 'pptx': return 'fas fa-file-powerpoint';
      case 'zip': case 'rar': case '7z': case 'gz': case 'tar': return 'fas fa-file-archive';
      case 'txt': case 'md': case 'log': return 'fas fa-file-alt';
      case 'jpg': case 'jpeg': case 'png': case 'gif': case 'bmp': case 'svg': case 'webp': return 'fas fa-file-image';
      case 'mp3': case 'wav': case 'ogg': case 'aac': case 'flac': return 'fas fa-file-audio';
      case 'mp4': case 'mov': case 'avi': case 'mkv': case 'wmv': case 'webm': return 'fas fa-file-video';
      case 'js': return 'fab fa-js-square';
      case 'ts': return 'fas fa-file-code'; // Specific TS icon might require another library or custom CSS
      case 'json': return 'fas fa-file-code';
      case 'html': return 'fab fa-html5';
      case 'css': case 'scss': case 'sass': return 'fab fa-css3-alt';
      case 'py': return 'fab fa-python';
      case 'java': return 'fab fa-java';
      case 'c': case 'cpp': case 'cs': case 'go': case 'php': case 'rb': case 'sh': return 'fas fa-file-code';
      default: return 'fas fa-file'; // Default generic file icon
    }
  }

} // <<< END OF HomeComponent CLASS