// src/app/component/home/home.component.ts
import { Component, inject, ViewChild, ElementRef, OnInit, OnDestroy, NgZone, ChangeDetectorRef, HostListener } from '@angular/core'; // Added HostListener
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService, User } from '../../shared/services/auth.service';
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
import { TestimonialSectionComponent } from '@app/shared/component/testimonial-section/testimonial-section.component';
import { OrbitalDisplayComponent } from '@app/shared/component/orbital-display/orbital-display.component';
import { ScrollAnimationDirective } from '@app/shared/directives/scroll-animation.directive';

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
    CtaSectionComponent, UploadProgressItemComponent, ByteFormatPipe, DatePipe, BatchFileBrowserComponent, TestimonialSectionComponent
    , OrbitalDisplayComponent, ScrollAnimationDirective
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  providers: [DatePipe]
})
export class HomeComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private apiService = inject(FileManagerApiService);
  private zone = inject(NgZone);
  private cdRef = inject(ChangeDetectorRef);
  private uploadEventService = inject(UploadEventService);
  public completedBatchAccessId: string | null = null;
  public shareableLinkForPanel: string | null = null;

  @ViewChild('fileInputForStart') fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('folderInputForStart') folderInputRef!: ElementRef<HTMLInputElement>;
  // @ViewChild('dropZoneTarget') dropZoneRef!: ElementRef<HTMLElement>; // No longer needed

  currentUser: User | null = null;
  username: string = '';

  isUploading: boolean = false;
  uploadError: string | null = null;
  // isDragging = false; // Replaced by isDraggingOverWindow for global behavior
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

  // New properties for global drag state
  public isDraggingOverWindow: boolean = false;
  private dragEnterCounter = 0; // To correctly handle dragenter/dragleave over child elements

  stepContent = [
    { number: '1', title: ' Select your file(s)', des: 'Select the file(s) and/or folder(s) you want to send from your computer or smartphone.' },
    { number: '2', title: ' Fill out the form', des: 'Fill out the transfer form - enter your email address as well as the recipient(s) email address(es). Send large files by email or generate a share link.' },
    { number: '3', title: ' Transfer files', des: 'Click "Send" to start uploading your files via our secure servers nearby you thanks to our global infrastructure.' },
  ];
  transferList = [
    { img: "assets/image/secure.svg", title: "Secure file transfer via email, or shareable links", des: "Send and share large files and other documents quickly and securely with our file transfer solution. Send large files via email or create a simple sharing link from any device (smartphone, tablet, computer) using just a web browser." },
    { img: "assets/image/sendFile.svg", title: "Send large files up to 250 GB per transfer", des: "Get a TransferNow account to transfer large files and other sizable documents! The files are available up to 365 days before being automatically and permanently erased from our servers." },
    { img: "assets/image/track.svg", title: "Track your sent files. Manage your transfers.", des: "Use our complete dashboard to follow and track your file downloads over time. You can modify your transfers’ data and parameters, re-transfer files to new recipients without having to systematically re-upload the same documents and erase a transfer before it's initial expiration date." },
    { img: "assets/image/download (2).svg", title: "Integrate the TransferNow widget on your website and receive files easily.", des: "Discover our form generator to receive files directly on your account and customize the widget’s appearance as well as it's fields (text boxes, drop-down lists, checkboxes, radio buttons). You can get a simple HTML code to integrate into your website allowing you to receive files instantaneously." }
  ];
  apps = [
    { img: "assets/image/windows.svg", title: "Windows" },
    { img: "assets/image/macos-D1UzuEXe.svg", title: "macOS" },
    { img: "assets/image/ios-B-i3hJIr.svg", title: "iOS" },
    { img: "assets/android-ByKVTp40.svg", title: "Android" },
  ];

  icon = [
    { icon: 'fa-solid fa-file-arrow-up', title: "Fast File Upload" },
    { icon: 'fa-solid fa-shuffle', title: "Effortless File Transfer" },
    { icon: 'fa-solid fa-file-shield', title: "Secure & Encrypted Uploads" },
  ]

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isUploading) {
      const confirmationMessage = "Leaving will cancel your current upload. Proceed?";
      event.preventDefault();
      event.returnValue = confirmationMessage;
    }
  }

  ngOnInit(): void {
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      this.zone.run(() => {
        const wasLoggedIn = !!this.currentUser;
        this.currentUser = user;
        this.username = this.currentUser?.username || this.currentUser?.email || '';

        const isLoggingOut = !user && wasLoggedIn;
        const isSwitchingUser = !!user && wasLoggedIn && this.currentUser && user.email !== this.currentUser.email;

        if (isLoggingOut || isSwitchingUser) {
          this.resetUploadState();
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
    } else {
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
    this.isDraggingOverWindow = false; // Reset drag state
    this.dragEnterCounter = 0;
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

  // --- Global Drag and Drop Event Handlers ---
  @HostListener('window:dragenter', ['$event'])
  onWindowDragEnter(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragEnterCounter++;

    if (this.selectedItems.length === 0 && !this.shareableLinkForPanel && !this.isUploading) {
      if (!this.isDraggingOverWindow) {
        this.isDraggingOverWindow = true;
        this.cdRef.detectChanges();
      }
    } else {
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'none'; // Indicate drop is not allowed
      }
    }
  }

  @HostListener('window:dragover', ['$event'])
  onWindowDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    // Set dropEffect to 'copy' if drop is allowed, 'none' otherwise
    if (this.selectedItems.length === 0 && !this.shareableLinkForPanel && !this.isUploading) {
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
      // Ensure overlay stays visible if conditions are met
      if (!this.isDraggingOverWindow) {
        this.isDraggingOverWindow = true;
        this.cdRef.detectChanges();
      }
    } else {
      if (event.dataTransfer) {
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
      this.dragEnterCounter = 0; // Ensure it doesn't go negative
      if (this.isDraggingOverWindow) {
        this.isDraggingOverWindow = false;
        this.cdRef.detectChanges();
      }
    }
  }

  @HostListener('window:drop', ['$event'])
  onWindowDrop(event: DragEvent): void {
    event.preventDefault();
    // It's good practice for the top-level handler to stop propagation if it fully handles the event.
    event.stopPropagation();

    // Reset global drag state if it was used for a full-screen overlay (which is currently commented out)
    this.isDraggingOverWindow = false;
    this.dragEnterCounter = 0;
    this.cdRef.detectChanges();

    // Process drop only if appropriate (no files selected, not uploading, etc.)
    if (this.selectedItems.length === 0 && !this.shareableLinkForPanel && !this.isUploading) {
      const files = event.dataTransfer?.files;
      if (files && files.length > 0) {
        this.handleFiles(files); // Existing file handling logic
      }
    } else {
      // Optionally provide feedback if the drop is ignored due to application state
      console.log("Drop ignored: Upload is already in progress or files are selected.");
    }
  }
  // --- End Global Drag and Drop ---

  triggerFileInput(): void { if (this.isUploading) return; this.fileInputRef?.nativeElement.click(); }
  triggerFolderInput(): void { if (this.isUploading) return; this.folderInputRef?.nativeElement.click(); }
  // onDragOver, onDragLeave, onDrop specific to #dropZoneTarget are removed as they are now global.

  handleFiles(fileList: FileList, isFolderSelection: boolean = false): void {
    // ... (existing handleFiles logic remains the same)
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

    let MAX_TOTAL_FILES: number;
    const isLoggedIn = this.authService.isLoggedIn();

    if (isLoggedIn) {
      MAX_TOTAL_FILES = Infinity;
    } else {
      MAX_TOTAL_FILES = 5;
    }
    console.log(`User is ${isLoggedIn ? 'logged in' : 'anonymous'}. MAX_TOTAL_FILES set to: ${MAX_TOTAL_FILES}`);

    const currentCount = this.selectedItems.length;
    let slotsActuallyAvailable = MAX_TOTAL_FILES - currentCount;

    if (slotsActuallyAvailable <= 0 && isFinite(MAX_TOTAL_FILES)) {
      this.uploadError = `You have already selected the maximum of ${MAX_TOTAL_FILES} files.`;
      if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = '';
      if (this.folderInputRef?.nativeElement) this.folderInputRef.nativeElement.value = '';
      this.cdRef.detectChanges();
      return;
    }

    const newItems: SelectedItem[] = [];
    let filesAddedInThisOperation = 0;

    for (let i = 0; i < fileList.length; i++) {
      if (filesAddedInThisOperation >= slotsActuallyAvailable) {
        break;
      }

      const file = fileList[i];
      const name = isFolderSelection && file.webkitRelativePath ? file.webkitRelativePath : file.name;

      if (file.size === 0 && !isFolderSelection && !name.includes('/')) {
        continue;
      }
      if (name.toLowerCase().endsWith('.ds_store')) {
        continue;
      }

      newItems.push({
        id: this.nextItemId++,
        file: file,
        name: name,
        size: file.size,
        icon: this.getFileIcon(name),
        isFolder: isFolderSelection || (file.webkitRelativePath && file.webkitRelativePath.includes('/')) || (name !== file.name && name.includes('/'))
      });
      filesAddedInThisOperation++;
    }

    if (filesAddedInThisOperation > 0) {
      this.selectedItems = [...this.selectedItems, ...newItems];
      console.log('Items added:', newItems.length, 'Total selectedItems:', this.selectedItems.length);
      this.cdRef.detectChanges();
    }

    if (isFinite(MAX_TOTAL_FILES)) {
      if (fileList.length > filesAddedInThisOperation && filesAddedInThisOperation < slotsActuallyAvailable) {
        this.uploadError = `As your not logged in, you can upload maximum ${MAX_TOTAL_FILES} files, Please login to upload more than ${filesAddedInThisOperation} files.`;
      } else if (fileList.length > slotsActuallyAvailable && filesAddedInThisOperation === 0 && currentCount < MAX_TOTAL_FILES) {
        this.uploadError = `As your not logged in, you can upload maximum ${MAX_TOTAL_FILES} files, Please login to upload more than ${filesAddedInThisOperation} files.`;
      } else if (fileList.length > slotsActuallyAvailable) {
        this.uploadError = `As your not logged in, you can upload maximum ${MAX_TOTAL_FILES} files, Please login to upload more than ${filesAddedInThisOperation} files.`;
      }
    }

    if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = '';
    if (this.folderInputRef?.nativeElement) this.folderInputRef.nativeElement.value = '';

    if (this.uploadError) {
      this.cdRef.detectChanges();
    }
  }

  onFileSelected(event: Event): void {
    // ... (existing onFileSelected logic remains the same)
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.handleFiles(input.files, false);
    }
  }

  onFolderSelected(event: Event): void {
    // ... (existing onFolderSelected logic remains the same)
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.handleFiles(input.files, true);
    }
  }

  initiateTransferFromPanel(): void {
    // ... (existing initiateTransferFromPanel logic remains the same)
    if (this.isUploading || this.selectedItems.length === 0) return;

    this.isUploading = true;
    this.uploadError = null;
    this.shareableLinkForPanel = null;
    this.batchUploadLinks = [];
    this.closeEventSource();

    const totalBatchSize = this.selectedItems.reduce((sum, item) => sum + item.size, 0);

    let batchIcon: string;
    let batchIsFolder = false;

    if (this.selectedItems.length === 1) {
      const singleItem = this.selectedItems[0];
      batchIsFolder = singleItem.isFolder ?? false;
      if (batchIsFolder) {
        batchIcon = 'fas fa-folder';
      } else {
        batchIcon = singleItem.icon;
      }
    } else {
      batchIcon = 'fas fa-archive';
      batchIsFolder = false;
    }

    this.currentItemBeingUploaded = {
      id: -1,
      name: this.selectedItems.length > 1 ? `Uploading ${this.selectedItems.length} items...` : `Uploading ${this.selectedItems[0].name}...`,
      size: totalBatchSize,
      file: null as any,
      icon: batchIcon,
      isFolder: batchIsFolder
    };

    this.uploadProgressDetails = {
      percentage: 0,
      bytesSent: 0,
      totalBytes: totalBatchSize,
      speedMBps: 0,
      etaFormatted: '--:--',
    };
    this.uploadProgress = 0;
    this.uploadStatusMessage = `Initiating batch upload of ${this.selectedItems.length} item(s)...`;
    this.currentUploadId = null;
    this.cdRef.detectChanges();

    const formData = new FormData();

    if (this.authService.isLoggedIn()) {
      if (this.username) {
        console.log('HomeComponent: Logged in user initiating transfer.');
      }
    } else {
      const anonymousId = this.authService.getOrGenerateAnonymousUploadId();
      if (anonymousId) {
        formData.append('anonymous_upload_id', anonymousId);
        console.log('HomeComponent: Anonymous user initiating transfer with ID:', anonymousId);
      } else {
        this.handleBatchUploadError('Could not generate an identifier for anonymous upload. Please enable cookies/localStorage or try logging in.');
        return;
      }
    }

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
    // ... (existing listenToUploadProgress logic remains the same)
    const apiUrl = this.apiService.getApiBaseUrl();
    const url = `${apiUrl}/stream-progress/${uploadId}`;

    try {
      this.eventSource = new EventSource(url, { withCredentials: this.authService.isLoggedIn() });

      this.eventSource.onopen = () => {
        this.zone.run(() => {
          if (uploadId !== this.currentUploadId || !this.isUploading) {
            console.log(`SSE 'onopen' for ${uploadId} ignored (current: ${this.currentUploadId}, uploading: ${this.isUploading})`);
            this.closeEventSource();
            return;
          }
          console.log(`SSE connection opened for upload ID: ${uploadId}`);
          this.uploadStatusMessage = 'Upload connection established. Starting...';
          this.cdRef.detectChanges();
        });
      };

      this.eventSource.addEventListener('start', (event: MessageEvent) => {
        this.zone.run(() => {
          if (uploadId !== this.currentUploadId || !this.isUploading) {
            console.log(`SSE 'start' event for ${uploadId} ignored.`);
            return;
          }
          const data = JSON.parse(event.data);
          this.uploadStatusMessage = data.message || 'Upload started.';
          if (data.totalBytes && data.totalBytes !== this.uploadProgressDetails.totalBytes) {
            this.uploadProgressDetails.totalBytes = parseInt(data.totalBytes, 10);
            if (this.currentItemBeingUploaded) {
              this.currentItemBeingUploaded.size = this.uploadProgressDetails.totalBytes;
            }
          }
          console.log('SSE "start" event data:', data);
          this.cdRef.detectChanges();
        });
      });

      this.eventSource.addEventListener('status', (event: MessageEvent) => {
        this.zone.run(() => {
          if (uploadId !== this.currentUploadId || !this.isUploading) {
            console.log(`SSE 'status' event for ${uploadId} ignored.`);
            return;
          }
          const data = JSON.parse(event.data);
          this.uploadStatusMessage = data.message || 'Processing...';
          if (typeof data.percentage === 'number') {
            this.uploadProgressDetails.percentage = Math.min(parseFloat(data.percentage), 100);
            this.uploadProgress = this.uploadProgressDetails.percentage;
          }
          console.log('SSE "status" event data:', data);
          this.cdRef.detectChanges();
        });
      });

      this.eventSource.addEventListener('progress', (event: MessageEvent) => {
        this.zone.run(() => {
          if (uploadId !== this.currentUploadId || !this.isUploading) {
            console.log(`SSE 'progress' event for ${uploadId} ignored.`);
            return;
          }
          try {
            const data = JSON.parse(event.data);
            this.uploadProgressDetails = {
              percentage: data.percentage !== undefined ? Math.min(parseFloat(data.percentage), 100) : this.uploadProgressDetails.percentage,
              bytesSent: data.bytesSent !== undefined ? parseInt(data.bytesSent, 10) : (data.bytesProcessed !== undefined ? parseInt(data.bytesProcessed, 10) : this.uploadProgressDetails.bytesSent),
              totalBytes: data.totalBytes !== undefined ? parseInt(data.totalBytes, 10) : this.uploadProgressDetails.totalBytes,
              speedMBps: data.speedMBps !== undefined ? parseFloat(data.speedMBps) : this.uploadProgressDetails.speedMBps,
              etaFormatted: data.etaFormatted !== undefined ? data.etaFormatted : this.uploadProgressDetails.etaFormatted,
            };
            if (this.currentItemBeingUploaded && data.totalBytes !== undefined && this.currentItemBeingUploaded.size !== this.uploadProgressDetails.totalBytes) {
              this.currentItemBeingUploaded.size = this.uploadProgressDetails.totalBytes;
            }
            this.uploadProgress = this.uploadProgressDetails.percentage;
            this.uploadStatusMessage = data.message || `Uploading: ${this.uploadProgressDetails.percentage.toFixed(0)}%`;
            this.cdRef.detectChanges();
          } catch (e) {
            console.error("Error parsing SSE 'progress' event data:", event.data, e);
          }
        });
      });

      this.eventSource.addEventListener('complete', (event: MessageEvent) => {
        this.zone.run(() => {
          if (uploadId !== this.currentUploadId || !this.isUploading) {
            console.log(`SSE 'complete' event for ${uploadId} ignored.`);
            this.closeEventSource();
            this.isUploading = false;
            return;
          }
          const data = JSON.parse(event.data);
          this.uploadStatusMessage = data.message || `Batch upload complete!`;
          if (data.batch_access_id) {
            this.completedBatchAccessId = data.batch_access_id;
            const frontendBaseUrl = window.location.origin;
            this.shareableLinkForPanel = `${frontendBaseUrl}/browse/${data.batch_access_id}`;
            console.log(`HomeComponent: Generated shareable link: ${this.shareableLinkForPanel}`);
          } else {
            console.error("HomeComponent: SSE 'complete' event is MISSING 'batch_access_id'.");
            this.uploadError = "Upload complete, but could not generate a shareable batch link.";
            this.shareableLinkForPanel = null;
          }
          this.uploadProgressDetails = {
            percentage: 100,
            bytesSent: data.bytesProcessed !== undefined ? parseInt(data.bytesProcessed, 10) : (data.totalBytes !== undefined ? parseInt(data.totalBytes, 10) : this.uploadProgressDetails.totalBytes),
            totalBytes: data.totalBytes !== undefined ? parseInt(data.totalBytes, 10) : this.uploadProgressDetails.totalBytes,
            speedMBps: 0,
            etaFormatted: '00:00',
          };
          this.uploadProgress = 100;
          this.isUploading = false;
          if (this.currentUser && this.username) {
            this.loadUserFileCount();
            this.uploadEventService.notifyUploadComplete();
          }
          this.closeEventSource();
          this.cdRef.detectChanges();
        });
      });

      this.eventSource.onerror = (errorEvent: Event) => {
        this.zone.run(() => {
          if (uploadId === this.currentUploadId && this.isUploading) {
            console.log(`SSE 'onerror' for ${uploadId} ignored (current: ${this.currentUploadId}, uploading: ${this.isUploading}).`);
            if (this.eventSource && this.eventSource.url.includes(uploadId)) {
              this.closeEventSource();
            }
            return;
          }
          console.error("SSE Error Event for active upload: ", errorEvent);
          let errorMessage = 'SSE connection error during upload. The upload may have failed.';
          if (errorEvent instanceof MessageEvent && (errorEvent as MessageEvent).data) {
            try {
              const parsedError = JSON.parse((errorEvent as MessageEvent).data);
              errorMessage = parsedError.message || parsedError.error || `SSE error: ${(errorEvent as MessageEvent).data}`;
            } catch (e) {
              errorMessage = `SSE error (unparseable): ${(errorEvent as MessageEvent).data}`;
            }
          }
          this.handleBatchUploadError(errorMessage, errorEvent);
        });
      };
    } catch (error) {
      console.error("Failed to create EventSource:", error);
      this.handleBatchUploadError(`Client-side error setting up upload progress: ${(error as Error).message}`);
    }
  }

  private handleBatchUploadError(errorMessage: string, errorEvent?: any): void {
    // ... (existing handleBatchUploadError logic remains the same)
    if (errorEvent) console.error("Error during batch upload:", errorMessage, errorEvent);
    else console.error("Error during batch upload:", errorMessage);

    this.zone.run(() => {
      this.uploadError = errorMessage;
      this.isUploading = false;
      this.uploadProgressDetails = {
        ...this.uploadProgressDetails,
        percentage: 0,
        bytesSent: this.uploadProgressDetails.bytesSent,
        speedMBps: 0,
        etaFormatted: 'Error',
      };
      this.uploadProgress = this.uploadProgressDetails.percentage;
      this.uploadStatusMessage = 'Batch Upload Failed';
      this.closeEventSource();
      this.cdRef.detectChanges();
    });
  }

  handleCancelUpload(): void {
    // ... (existing handleCancelUpload logic remains the same)
    if (!this.currentUploadId && !this.isUploading) {
      console.log('HomeComponent: No active upload to cancel.');
      return;
    }
    const uploadIdToCancel = this.currentUploadId;
    console.log('HomeComponent: User cancelled upload for ID:', uploadIdToCancel);

    this.isUploading = false;
    this.closeEventSource();

    this.uploadStatusMessage = `Upload cancelled.`;
    this.uploadError = null;

    this.uploadProgressDetails = {
      totalBytes: this.uploadProgressDetails.totalBytes || this.currentItemBeingUploaded?.size || 0,
      percentage: 0,
      bytesSent: 0,
      speedMBps: 0,
      etaFormatted: '--:--',
    };
    this.uploadProgress = 0;
    this.currentItemBeingUploaded = null;
    this.currentUploadId = null;
    this.cdRef.detectChanges();
  }

  private closeEventSource(): void {
    // ... (existing closeEventSource logic remains the same)
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('HomeComponent: EventSource closed.');
    }
  }

  handleItemRemovedFromPanel(itemOrUndefined: SelectedItem | undefined): void {
    // ... (existing handleItemRemovedFromPanel logic remains the same)
    if (this.isUploading) {
      alert("Cannot remove items during upload. Please cancel the upload first.");
      return;
    }

    if (itemOrUndefined) {
      this.selectedItems = this.selectedItems.filter(i => i.id !== itemOrUndefined.id);
      console.log('HomeComponent: Removed item:', itemOrUndefined.name);
      if (this.selectedItems.length === 0) {
        this.shareableLinkForPanel = null;
        this.uploadError = null;
        this.uploadStatusMessage = '';
        this.batchUploadLinks = [];
        this.currentItemBeingUploaded = null;
      }
    } else {
      this.shareableLinkForPanel = null;
      this.selectedItems = [];
      this.uploadError = null;
      this.uploadStatusMessage = '';
      this.batchUploadLinks = [];
      this.currentItemBeingUploaded = null;
      this.nextItemId = 0;
      console.log('HomeComponent: All items cleared from panel.');
    }
    this.cdRef.detectChanges();
  }

  handleDownloadRequest(itemToDownload: SelectedItem): void {
    // ... (existing handleDownloadRequest logic remains the same)
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
    // ... (existing getFileIcon logic remains the same)
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
      case 'html': case 'htm': return 'fas fa-file-code text-info';
      default: return 'fas fa-file text-muted';
    }
  }
}