// src/app/component/home/home.component.ts
import { Component, inject, ViewChild, ElementRef, OnInit, OnDestroy, NgZone, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subscription, of } from 'rxjs'; // Added 'of' for potential placeholder in service
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
import { GamesComponent } from '@app/shared/component/games/games.component';

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
    , OrbitalDisplayComponent, ScrollAnimationDirective, GamesComponent
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
  public showPlayGamesButton: boolean = false;
  private previousShowPlayGamesButtonState: boolean = false;
  public isGamePanelVisible: boolean = false;
  public anonymousUploadLimitMessage: string | null = null;
  private readonly ONE_GIGABYTE_IN_BYTES = 1 * 1024 * 1024 * 1024;
  private readonly genericUploadMessage = "Your files are being uploaded, wait a few moment.";

  @ViewChild('fileInputForStart') fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('folderInputForStart') folderInputRef!: ElementRef<HTMLInputElement>;

  currentUser: User | null = null;
  username: string = '';

  isUploading: boolean = false;
  uploadError: string | null = null;
  uploadSuccessMessage: string | null = null;
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

  public isDraggingOverWindow: boolean = false;
  private dragEnterCounter = 0;

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
  redisterdUser = [
    { icon: 'assets/image/rg-i.png', title: 'Registered users', count: '327,026,694' },
    { icon: 'assets/image/upload-files-img1.png', title: 'Uploaded files', count: '191,649,393,254' }
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
    this.uploadSuccessMessage = null;
    this.selectedItems = [];
    this.shareableLinkForPanel = null;
    this.completedBatchAccessId = null;
    this.currentItemBeingUploaded = null;
    this.currentUploadId = null;
    this.uploadStatusMessage = '';
    this.uploadProgressDetails = {
      percentage: 0, bytesSent: 0, totalBytes: 0, speedMBps: 0, etaFormatted: '--:--',
    };
    this.uploadProgress = 0;
    this.nextItemId = 0;
    this.batchUploadLinks = [];
    this.anonymousUploadLimitMessage = null;
    // this.isDraggingOverWindow = false;
    this.isGamePanelVisible = false;
    this.updatePlayGamesButtonVisibility();
    this.dragEnterCounter = 0;
    this.closeEventSource();

    if (this.fileInputRef?.nativeElement) {
      this.fileInputRef.nativeElement.value = '';
    }
    if (this.folderInputRef?.nativeElement) {
      this.folderInputRef.nativeElement.value = '';
    }
    console.log('HomeComponent: Upload state has been reset.');
    this.updatePlayGamesButtonVisibility();
  }
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

  @HostListener('window:dragenter', ['$event'])
  onWindowDragEnter(event: DragEvent): void {
    if (!event.dataTransfer) return;

    event.preventDefault();
    event.stopPropagation();
    this.dragEnterCounter++;

    if (this.selectedItems.length > 0 || this.isUploading || this.shareableLinkForPanel) {
      event.dataTransfer.dropEffect = 'none';
    } else {
      // If not already set to 'copy' by a receptive child (like orbital-display),
      // default to 'none' for the window.
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
      // If not already set to 'copy' by a receptive child, default to 'none'.
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
    event.stopPropagation(); // Crucial to stop the browser's default file open action

    this.dragEnterCounter = 0; // Reset counter

    // If the drop happened on orbital-display's upload-area, its onDropArea handler
    // would have processed it and called event.stopPropagation().
    // This primarily catches drops outside designated zones, which are now ignored.
    console.log('HomeComponent: Window drop event. If not handled by a specific zone, it is ignored. Target:', event.target);
  }
  handleFilesDroppedInOrbital(fileList: FileList): void {
    console.log('HomeComponent: Files dropped in orbital display area.', fileList);
    // Ensure conditions are met before processing (no items selected, not uploading, no link)
    if (this.selectedItems.length === 0 && !this.isUploading && !this.shareableLinkForPanel) {
      this.handleFiles(fileList, false); // Assuming these are files, not detected as folders from this drop
    } else {
      console.log('HomeComponent: Drop in orbital area ignored, component not in receptive state for new files.');
    }
  }
  triggerFileInput(): void {
    // Only allow triggering file input if no items selected, not uploading, and no link
    if (this.selectedItems.length === 0 && !this.isUploading && !this.shareableLinkForPanel) {
      this.fileInputRef?.nativeElement.click();
    }
  }
  triggerFolderInput(): void {
    // Similar condition for folder input
    if (this.selectedItems.length === 0 && !this.isUploading && !this.shareableLinkForPanel) {
      this.folderInputRef?.nativeElement.click();
    }
  }

  handleFiles(fileList: FileList, isFolderSelection: boolean = false): void {
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
    this.uploadError = null; // Clear previous error
    this.uploadSuccessMessage = null;

    if (!fileList || fileList.length === 0) return;

    let MAX_TOTAL_FILES: number;
    const isLoggedIn = this.authService.isLoggedIn();

    if (isLoggedIn) {
      MAX_TOTAL_FILES = Infinity;
    } else {
      MAX_TOTAL_FILES = 5; // Anonymous user limit
    }
    console.log(`User is ${isLoggedIn ? 'logged in' : 'anonymous'}. MAX_TOTAL_FILES set to: ${MAX_TOTAL_FILES}`);

    const currentCount = this.selectedItems.length;
    let slotsActuallyAvailable = MAX_TOTAL_FILES - currentCount;

    if (!isFinite(MAX_TOTAL_FILES)) { // If logged in
      slotsActuallyAvailable = Infinity;
    }

    // Check if anonymous user is already at the limit and trying to add more
    if (!isLoggedIn && currentCount >= MAX_TOTAL_FILES && fileList.length > 0) {
      this.uploadError = "As your not logged in, you can upload maximum 5 files, Please login to upload more than 5 files.";
      if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = '';
      if (this.folderInputRef?.nativeElement) this.folderInputRef.nativeElement.value = '';
      this.cdRef.detectChanges();
      return;
    }


    const newItems: SelectedItem[] = [];
    let filesAddedInThisOperation = 0;

    for (let i = 0; i < fileList.length; i++) {
      if (!isLoggedIn && (currentCount + filesAddedInThisOperation >= MAX_TOTAL_FILES)) {
        // Stop adding if limit for anonymous user is reached during this operation
        break;
      }

      const file = fileList[i];

      let itemName = file.name;
      if (file.webkitRelativePath && (file.webkitRelativePath !== file.name || isFolderSelection)) {
        itemName = file.webkitRelativePath;
      }

      if (file.size === 0 && !isFolderSelection && !itemName.includes('/')) {
        console.log(`Skipping empty file: ${itemName}`);
        continue;
      }
      if (file.name.toLowerCase().endsWith('.ds_store')) {
        console.log(`Skipping .DS_Store file: ${itemName} (original: ${file.name})`);
        continue;
      }

      newItems.push({
        id: this.nextItemId++,
        file: file,
        name: itemName,
        size: file.size,
        icon: this.getFileIcon(itemName),
        isFolder: (isFolderSelection && file.webkitRelativePath && file.webkitRelativePath === file.name && !file.type && file.size === 0)
          || (isFolderSelection && itemName.endsWith('/'))
      });
      filesAddedInThisOperation++;
    }

    if (filesAddedInThisOperation > 0) {
      this.selectedItems = [...this.selectedItems, ...newItems];
      console.log('Items added:', newItems.length, 'Total selectedItems:', this.selectedItems.length);
    }

    // Set error message if not all files from the input could be added due to limits (for anonymous users)
    // This condition applies if the loop was broken because the limit was hit.
    if (!isLoggedIn && filesAddedInThisOperation < fileList.length) {
      this.uploadError = "As your not logged in, you can upload maximum 5 files, Please login to upload more than 5 files.";
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

  initiateTransferFromPanel(): void {
    if (this.isUploading || this.selectedItems.length === 0) return;

    this.isUploading = true;
    this.uploadError = null;
    this.uploadSuccessMessage = null;
    this.anonymousUploadLimitMessage = null;
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
      file: null,
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
    this.uploadStatusMessage = 'Initializing upload...';
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
      if (item.file) {
        formData.append('files[]', item.file, item.name);
      } else {
        console.warn(`Skipping item with null file: ${item.name}`);
      }
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
  handleNewTransferRequest(): void {
    console.log('HomeComponent: New transfer requested. Resetting state.');
    this.resetUploadState();
    this.cdRef.detectChanges(); // Ensure UI updates after state reset
  }

  private listenToUploadProgress(uploadId: string, batchItemRepresentation: SelectedItem | null): void {
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
          let finalMessage: string;
          const serverMessage = data.message;
          if (serverMessage) {
            const lowerServerMessage = serverMessage.toLowerCase();
            if (lowerServerMessage.includes("fetching") || lowerServerMessage.includes("sent tg chunk")) {
              finalMessage = this.genericUploadMessage;
            } else {
              finalMessage = serverMessage; // Use other server messages as is
            }
          } else {
            finalMessage = 'Upload started.'; // Default for 'start' if no server message
          }
          this.uploadStatusMessage = finalMessage;

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

          let finalMessage: string;
          const serverMessage = data.message;
          if (serverMessage) {
            const lowerServerMessage = serverMessage.toLowerCase();
            if (lowerServerMessage.includes("fetching") || lowerServerMessage.includes("sent tg chunk")) {
              finalMessage = this.genericUploadMessage;
            } else {
              finalMessage = serverMessage; // Use other server messages as is
            }
          } else {
            finalMessage = 'Processing...'; // Default for 'status' if no server message
          }
          this.uploadStatusMessage = finalMessage;

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
            let finalMessage: string;
            const serverMessage = data.message;
            if (serverMessage) {
              const lowerServerMessage = serverMessage.toLowerCase();
              if (lowerServerMessage.includes("fetching") || lowerServerMessage.includes("sent tg chunk")) {
                finalMessage = this.genericUploadMessage;
              } else {
                finalMessage = serverMessage; // Use other server messages as is
              }
            } else {
              // Default for 'progress' if no server message, show percentage
              finalMessage = `Uploading: ${this.uploadProgressDetails.percentage.toFixed(0)}%`;
            }
            this.uploadStatusMessage = finalMessage;
            this.uploadStatusMessage = finalMessage;
            this.cdRef.detectChanges();
          } catch (e) {
            console.error("Error parsing SSE 'progress' event data:", event.data, e);
          }
        });
      });

      this.eventSource.addEventListener('complete', (event: MessageEvent) => {
        this.zone.run(() => {
          if (uploadId !== this.currentUploadId || !this.isUploading) {
            console.log(`SSE 'complete' event for ${uploadId} ignored (current: ${this.currentUploadId}, uploading: ${this.isUploading})`);
            this.closeEventSource();
            return;
          }
          const data = JSON.parse(event.data);
          this.uploadStatusMessage = data.message || 'Upload complete!';
          // this.uploadSuccessMessage = "Files uploaded successfully.";
          this.uploadError = null;
          if (data.batch_access_id) {
            this.completedBatchAccessId = data.batch_access_id;
            const frontendBaseUrl = window.location.origin;
            this.shareableLinkForPanel = `${frontendBaseUrl}/batch-view/${data.batch_access_id}`;
            console.log(`HomeComponent: Generated shareable link: ${this.shareableLinkForPanel}`);
            if (!this.authService.isLoggedIn()) {
              // User is anonymous and upload was successful with a link
              this.anonymousUploadLimitMessage = "Upload successful! Your files are available for 5 days. For longer storage and more features, please log in or sign up.";
              this.uploadSuccessMessage = null; // Ensure generic success message isn't shown

              // Set a timeout to clear the message after a few seconds
              setTimeout(() => {
                this.anonymousUploadLimitMessage = null;
                this.cdRef.detectChanges();
              }, 7000); // Display for 7 seconds (adjust as needed, animation is 6s)
            } else {
              // User is logged in
              this.uploadSuccessMessage = "Files uploaded successfully!";
              this.anonymousUploadLimitMessage = null; // Ensure anonymous message isn't shown

              setTimeout(() => {
                this.uploadSuccessMessage = null;
                this.cdRef.detectChanges();
              }, 6000); // Standard timeout for success message
            }
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
          if (this.eventSource && !this.eventSource.url.includes(uploadId)) {
            console.log(`SSE 'onerror' for a non-current EventSource (${this.eventSource.url}). Ignoring.`);
            return;
          }
          if (uploadId !== this.currentUploadId || !this.isUploading) {
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
          this.uploadSuccessMessage = null;
          this.handleBatchUploadError(errorMessage, errorEvent);
        });
      };
    } catch (error) {
      console.error("Failed to create EventSource:", error);
      this.uploadSuccessMessage = null;
      this.handleBatchUploadError(`Client-side error setting up upload progress: ${(error as Error).message}`);
    }
  }

  private handleBatchUploadError(errorMessage: string, errorEvent?: any): void {
    if (errorEvent) console.error("Error during batch upload:", errorMessage, errorEvent);
    else console.error("Error during batch upload:", errorMessage);

    this.zone.run(() => {
      this.uploadError = errorMessage;
      this.uploadSuccessMessage = null;
      this.isUploading = false;
      this.uploadProgressDetails = {
        ...this.uploadProgressDetails,
        percentage: this.uploadProgressDetails.percentage > 0 ? this.uploadProgressDetails.percentage : 0,
        speedMBps: 0,
        etaFormatted: 'Error',
      };
      this.uploadStatusMessage = 'Upload Failed';
      this.closeEventSource();
      this.cdRef.detectChanges();
    });
  }

  handleCancelUpload(): void {
    if (!this.isUploading && !this.currentUploadId) {
      console.log('HomeComponent: No active upload to cancel or already cancelled.');
      return;
    }
    const uploadIdToCancel = this.currentUploadId;
    console.log('HomeComponent: User cancelled upload for ID:', uploadIdToCancel || 'ID not yet established');

    this.isUploading = false;
    this.uploadSuccessMessage = null;
    this.uploadError = null;
    this.closeEventSource();

    /*
    if (uploadIdToCancel) {
        // Ensure this.apiService has a 'cancelUpload' method before uncommenting.
        // this.apiService.cancelUpload(uploadIdToCancel).subscribe({
        //     next: () => console.log(`HomeComponent: Backend notified of cancellation for ${uploadIdToCancel}.`),
        //     error: (err) => console.error(`HomeComponent: Error notifying backend of cancellation for ${uploadIdToCancel}:`, err)
        // });
    }
    */
    if (uploadIdToCancel) {
      console.log(`HomeComponent: Skipping backend notification for cancellation of ${uploadIdToCancel} (FileManagerApiService.cancelUpload not called / not implemented).`);
    }


    this.uploadStatusMessage = `Upload cancelled.`;
    this.uploadError = null;

    const totalSizeBeforeCancel = this.uploadProgressDetails.totalBytes || this.currentItemBeingUploaded?.size || 0;
    this.uploadProgressDetails = {
      totalBytes: totalSizeBeforeCancel,
      percentage: 0,
      bytesSent: this.uploadProgressDetails.bytesSent > 0 ? this.uploadProgressDetails.bytesSent : 0,
      speedMBps: 0,
      etaFormatted: '--:--',
    };
    this.uploadProgress = 0;

    this.currentUploadId = null;
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
      this.selectedItems = this.selectedItems.filter(i => i.id !== itemOrUndefined.id);
      console.log('HomeComponent: Removed item:', itemOrUndefined.name);
      if (this.selectedItems.length === 0) {
        this.shareableLinkForPanel = null;
        this.uploadError = null;
        this.uploadStatusMessage = '';
        this.batchUploadLinks = [];
        this.currentItemBeingUploaded = null;
        this.nextItemId = 0;
      }
    } else {
      this.selectedItems = [];
      this.shareableLinkForPanel = null;
      this.uploadError = null;
      this.uploadStatusMessage = '';
      this.batchUploadLinks = [];
      this.currentItemBeingUploaded = null;
      this.nextItemId = 0;
      console.log('HomeComponent: All items cleared from panel.');
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
        if (itemToDownload.id === -1 && this.shareableLinkForPanel) {
          alert("This represents the completed batch. To download, use the generated shareable link. Individual file download from this panel is for pre-upload items.");
          return;
        }
        alert("Cannot download this item locally. It might be a folder representation or an item from a completed transfer without a local file reference.");
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
    if (!filename) return 'fas fa-question-circle';

    const isPath = filename.includes('/');
    const baseNameForIcon = isPath ? filename.substring(filename.lastIndexOf('/') + 1) : filename;

    if (isPath && (baseNameForIcon === '' || !baseNameForIcon.includes('.'))) {
      return 'fas fa-folder';
    }
    if (!baseNameForIcon.includes('.')) {
      return 'fas fa-file';
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