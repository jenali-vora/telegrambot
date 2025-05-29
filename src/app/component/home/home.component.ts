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
  uploadedFilesCount: number; // <<<< ADDED THIS PROPERTY
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
  private readonly ONE_GIGABYTE_IN_BYTES = 1 * 1024 * 1024 * 1024;

  @ViewChild('fileInputForStart') fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('folderInputForStart') folderInputRef!: ElementRef<HTMLInputElement>;

  currentUser: User | null = null;
  username: string = '';

  isUploading: boolean = false;
  uploadError: string | null = null;
  selectedItems: SelectedItem[] = [];
  currentItemBeingUploaded: SelectedItem | null = null; // This still represents the batch item
  currentUploadId: string | null = null;

  userFileCount: number = 0;
  isLoadingUserFileCount: boolean = false;

  private eventSource: EventSource | null = null;
  uploadStatusMessage: string = '';
  uploadProgressDetails: UploadProgressDetails = { // Initialize with the new property
    percentage: 0, bytesSent: 0, totalBytes: 0, speedMBps: 0, etaFormatted: '--:--', uploadedFilesCount: 0,
  };
  uploadProgress: number = 0;

  private nextItemId = 0;
  private authSubscription: Subscription | null = null;

  public batchUploadLinks: CompletedUploadLink[] = [];
  public batchShareableLinkForPanel: string | null = null;

  public isDraggingOverWindow: boolean = false;
  private dragEnterCounter = 0;

  // ... (stepContent, transferList, apps, icon, redisterdUser remain the same) ...
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
    { icon: 'assets/image/ru-i.png', title: 'Registered users', count: '327,026,694' },
    { icon: 'assets/image/files-uploadImg.png', title: 'Uploaded files', count: '191,649,393,254' }
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
    // this.selectedItems = []; // Keep selected items if needed for post-cancel display or re-initiation
    this.shareableLinkForPanel = null;
    this.currentItemBeingUploaded = null;
    this.currentUploadId = null;
    this.uploadStatusMessage = '';
    this.uploadProgressDetails = { // Reset with the new property
      percentage: 0, bytesSent: 0, totalBytes: 0, speedMBps: 0, etaFormatted: '--:--', uploadedFilesCount: 0,
    };
    this.uploadProgress = 0;
    // this.nextItemId = 0; // Only reset if selectedItems is also reset
    this.batchUploadLinks = [];
    this.isDraggingOverWindow = false;
    this.isGamePanelVisible = false;
    this.updatePlayGamesButtonVisibility();
    this.dragEnterCounter = 0;
    this.closeEventSource();

    // Reset progress for any existing items if they are not cleared
    this.selectedItems = this.selectedItems.map(item => ({
      ...item,
      individualProgress: 0,
      isCurrentlyProcessing: false
    }));

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
    event.preventDefault();
    event.stopPropagation();
    this.dragEnterCounter++;

    if (!this.isUploading && !this.shareableLinkForPanel) {
      if (!this.isDraggingOverWindow) {
        this.isDraggingOverWindow = true;
        this.cdRef.detectChanges();
      }
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
    } else {
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'none';
      }
    }
  }

  @HostListener('window:dragover', ['$event'])
  onWindowDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.isUploading && !this.shareableLinkForPanel) {
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
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
      this.dragEnterCounter = 0;
      if (this.isDraggingOverWindow) {
        this.isDraggingOverWindow = false;
        this.cdRef.detectChanges();
      }
    }
  }

  @HostListener('window:drop', ['$event'])
  onWindowDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.isDraggingOverWindow = false;
    this.dragEnterCounter = 0;
    this.cdRef.detectChanges();

    if (!this.isUploading && !this.shareableLinkForPanel) {
      const files = event.dataTransfer?.files;
      if (files && files.length > 0) {
        this.handleFiles(files, false);
      }
    } else {
      let reason = "";
      if (this.isUploading) reason = "upload is in progress";
      else if (this.shareableLinkForPanel) reason = "a shareable link for a completed transfer is displayed";
      else reason = "current state does not permit drop";
      console.log(`Drop ignored: ${reason}.`);
    }
  }

  triggerFileInput(): void { if (this.isUploading) return; this.fileInputRef?.nativeElement.click(); }
  triggerFolderInput(): void { if (this.isUploading) return; this.folderInputRef?.nativeElement.click(); }

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
          || (isFolderSelection && itemName.endsWith('/')),
        individualProgress: 0,
        isCurrentlyProcessing: false
      });
      filesAddedInThisOperation++;
    }

    if (filesAddedInThisOperation > 0) {
      this.selectedItems = [...this.selectedItems, ...newItems];
      console.log('Items added:', newItems.length, 'Total selectedItems:', this.selectedItems.length);
    }

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
    this.selectedItems = this.selectedItems.map(item => ({
      ...item,
      individualProgress: 0,
      isCurrentlyProcessing: false
    }));

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
      uploadedFilesCount: 0, // Initialize here as well
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
      this.eventSource = new EventSource(url, { withCredentials: this.authService.isLoggedIn() });

      this.eventSource.onopen = () => {
        this.zone.run(() => {
          if (uploadId !== this.currentUploadId || !this.isUploading) {
            this.closeEventSource(); return;
          }
          this.uploadStatusMessage = 'Upload connection established. Starting...';
          this.cdRef.detectChanges();
        });
      };

      this.eventSource.addEventListener('start', (event: MessageEvent) => {
        this.zone.run(() => {
          if (uploadId !== this.currentUploadId || !this.isUploading) return;
          const data = JSON.parse(event.data);
          this.uploadStatusMessage = data.message || 'Upload started.';
          if (data.totalBytes && data.totalBytes !== this.uploadProgressDetails.totalBytes) {
            this.uploadProgressDetails.totalBytes = parseInt(data.totalBytes, 10);
            if (this.currentItemBeingUploaded) {
              this.currentItemBeingUploaded.size = this.uploadProgressDetails.totalBytes;
            }
          }
          this.cdRef.detectChanges();
        });
      });

      this.eventSource.addEventListener('status', (event: MessageEvent) => {
        this.zone.run(() => {
          if (uploadId !== this.currentUploadId || !this.isUploading) return;
          const data = JSON.parse(event.data);
          this.uploadStatusMessage = data.message || 'Processing...';
          if (typeof data.percentage === 'number') {
            this.uploadProgressDetails.percentage = Math.min(parseFloat(data.percentage), 100);
            this.uploadProgress = this.uploadProgressDetails.percentage;
          }
          if (data.message && typeof data.message === 'string') {
            this.updateIndividualFileProgressFromMessage(data.message, this.uploadProgressDetails.percentage);
          }
          this.cdRef.detectChanges();
        });
      });

      this.eventSource.addEventListener('progress', (event: MessageEvent) => {
        this.zone.run(() => {
          if (uploadId !== this.currentUploadId || !this.isUploading) return;
          try {
            const data = JSON.parse(event.data);
            this.uploadProgressDetails = {
              percentage: data.percentage !== undefined ? Math.min(parseFloat(data.percentage), 100) : this.uploadProgressDetails.percentage,
              bytesSent: data.bytesSent !== undefined ? parseInt(data.bytesSent, 10) : (data.bytesProcessed !== undefined ? parseInt(data.bytesProcessed, 10) : this.uploadProgressDetails.bytesSent),
              totalBytes: data.totalBytes !== undefined ? parseInt(data.totalBytes, 10) : this.uploadProgressDetails.totalBytes,
              speedMBps: data.speedMBps !== undefined ? parseFloat(data.speedMBps) : this.uploadProgressDetails.speedMBps,
              etaFormatted: data.etaFormatted !== undefined ? data.etaFormatted : this.uploadProgressDetails.etaFormatted,
              uploadedFilesCount: this.uploadProgressDetails.uploadedFilesCount // Preserve existing, will be updated by updateIndividualFileProgressFromMessage
            };
            if (this.currentItemBeingUploaded && data.totalBytes !== undefined && this.currentItemBeingUploaded.size !== this.uploadProgressDetails.totalBytes) {
              this.currentItemBeingUploaded.size = this.uploadProgressDetails.totalBytes;
            }
            this.uploadProgress = this.uploadProgressDetails.percentage;

            if (data.message && typeof data.message === 'string') {
              this.uploadStatusMessage = data.message;
              this.updateIndividualFileProgressFromMessage(data.message, this.uploadProgressDetails.percentage);
            } else {
              this.uploadStatusMessage = `Uploading: ${this.uploadProgressDetails.percentage.toFixed(0)}%`;
              const firstNonCompleteIndex = this.selectedItems.findIndex(it => (it.individualProgress || 0) < 100);
              if (firstNonCompleteIndex !== -1) {
                this.selectedItems = this.selectedItems.map((item, index) => ({
                  ...item,
                  isCurrentlyProcessing: index === firstNonCompleteIndex,
                  individualProgress: index === firstNonCompleteIndex ? this.uploadProgressDetails.percentage : item.individualProgress
                }));
              }
            }
            this.cdRef.detectChanges();
          } catch (e) {
            console.error("Error parsing SSE 'progress' event data:", event.data, e);
          }
        });
      });

      this.eventSource.addEventListener('complete', (event: MessageEvent) => {
        this.zone.run(() => {
          if (uploadId !== this.currentUploadId || !this.isUploading) { this.closeEventSource(); return; }
          const data = JSON.parse(event.data);
          this.uploadStatusMessage = data.message || 'Upload complete!';
          if (data.batch_access_id) {
            this.completedBatchAccessId = data.batch_access_id;
            const frontendBaseUrl = window.location.origin;
            this.shareableLinkForPanel = `${frontendBaseUrl}/browse/${data.batch_access_id}`;
          } else {
            this.uploadError = "Upload complete, but could not generate a shareable batch link.";
            this.shareableLinkForPanel = null;
          }
          this.uploadProgressDetails = {
            percentage: 100,
            bytesSent: data.bytesProcessed !== undefined ? parseInt(data.bytesProcessed, 10) : (data.totalBytes !== undefined ? parseInt(data.totalBytes, 10) : this.uploadProgressDetails.totalBytes),
            totalBytes: data.totalBytes !== undefined ? parseInt(data.totalBytes, 10) : this.uploadProgressDetails.totalBytes,
            speedMBps: 0,
            etaFormatted: '00:00',
            uploadedFilesCount: this.selectedItems.length // All files complete
          };
          this.uploadProgress = 100; // Ensure overall progress is 100
          this.selectedItems = this.selectedItems.map(item => ({
            ...item,
            individualProgress: 100,
            isCurrentlyProcessing: false
          }));
          this.isUploading = false; // Set after items are marked complete
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
          if (this.eventSource && !this.eventSource.url.includes(uploadId)) return;
          if (uploadId !== this.currentUploadId || !this.isUploading) {
            if (this.eventSource && this.eventSource.url.includes(uploadId)) this.closeEventSource();
            return;
          }
          let errorMessage = 'SSE connection error during upload. The upload may have failed.';
          if (errorEvent instanceof MessageEvent && (errorEvent as MessageEvent).data) {
            try {
              const parsedError = JSON.parse((errorEvent as MessageEvent).data);
              errorMessage = parsedError.message || parsedError.error || `SSE error: ${(errorEvent as MessageEvent).data}`;
            } catch (e) { errorMessage = `SSE error (unparseable): ${(errorEvent as MessageEvent).data}`; }
          }
          this.handleBatchUploadError(errorMessage, errorEvent);
        });
      };
    } catch (error) {
      this.handleBatchUploadError(`Client-side error setting up upload progress: ${(error as Error).message}`);
    }
  }
  private updateIndividualFileProgressFromMessage(message: string, overallPercentage: number): void {
    const fileProgressMatch = message.match(/Uploading:?\s*([^\(]+)\s*\((\d+)\/(\d+)\)/i) || message.match(/Processing:?\s*([^\(]+)/i);

    let currentFileNameFromMessage: string | null = null;
    let currentFileNumber: number | null = null;
    // let totalFilesMessage: number | null = null; // Not directly used in assignment logic

    if (message.match(/Uploading:?\s*([^\(]+)\s*\((\d+)\/(\d+)\)/i)) {
      const match = message.match(/Uploading:?\s*([^\(]+)\s*\((\d+)\/(\d+)\)/i);
      if (match) {
        currentFileNameFromMessage = match[1].trim();
        currentFileNumber = parseInt(match[2], 10);
        // totalFilesMessage = parseInt(match[3], 10);
      }
    } else if (message.match(/Processing:?\s*([^\(]+)/i)) {
      const match = message.match(/Processing:?\s*([^\(]+)/i);
      if (match) {
        currentFileNameFromMessage = match[1].trim();
        const idx = this.selectedItems.findIndex(f => f.name === currentFileNameFromMessage && (f.individualProgress || 0) < 100);
        if (idx !== -1) {
          currentFileNumber = idx + 1;
        }
      }
    }

    this.selectedItems = this.selectedItems.map((item, index) => {
      let newIndividualProgress = item.individualProgress || 0;
      let newIsCurrentlyProcessing = false;

      if (currentFileNumber && (index + 1) === currentFileNumber) { // Prioritize file number if available
        newIsCurrentlyProcessing = true;
        newIndividualProgress = overallPercentage;
      } else if (currentFileNameFromMessage && item.name === currentFileNameFromMessage && !currentFileNumber) { // Fallback to name if no number
        newIsCurrentlyProcessing = true;
        newIndividualProgress = overallPercentage;
      } else if (currentFileNumber && (index + 1) < currentFileNumber) {
        newIndividualProgress = 100;
        newIsCurrentlyProcessing = false;
      } else {
        newIsCurrentlyProcessing = false;
        newIndividualProgress = newIndividualProgress === 100 ? 100 : (item.isCurrentlyProcessing ? 0 : newIndividualProgress);
      }

      if (overallPercentage === 100) newIndividualProgress = 100;

      return {
        ...item,
        individualProgress: newIndividualProgress,
        isCurrentlyProcessing: newIsCurrentlyProcessing,
      };
    });

    const completedCount = this.selectedItems.filter(it => it.individualProgress === 100).length;
    this.uploadProgressDetails.uploadedFilesCount = completedCount;
  }

  private handleBatchUploadError(errorMessage: string, errorEvent?: any): void {
    if (errorEvent) console.error("Error during batch upload:", errorMessage, errorEvent);
    else console.error("Error during batch upload:", errorMessage);

    this.zone.run(() => {
      this.uploadError = errorMessage;
      this.isUploading = false;
      this.uploadProgressDetails = {
        ...this.uploadProgressDetails, // Spread existing details
        percentage: this.uploadProgressDetails.percentage > 0 ? this.uploadProgressDetails.percentage : 0,
        speedMBps: 0,
        etaFormatted: 'Error',
        // uploadedFilesCount remains as is or could be set to 0 if error is catastrophic
      };
      this.uploadStatusMessage = 'Upload Failed';
      this.closeEventSource();
      this.cdRef.detectChanges();
    });
  }

  handleCancelUpload(): void {
    if (!this.isUploading && !this.currentUploadId) {
      return;
    }
    const uploadIdToCancel = this.currentUploadId;

    this.isUploading = false; // Set immediately
    this.closeEventSource(); // Close SSE connection

    // Backend notification (optional, if you have an endpoint)
    if (uploadIdToCancel) {
      console.log(`HomeComponent: Skipping backend notification for cancellation of ${uploadIdToCancel}.`);
      // this.apiService.cancelUpload(uploadIdToCancel).subscribe(...);
    }

    this.uploadStatusMessage = `Upload cancelled.`;
    this.uploadError = null; // Clear any previous upload error

    const totalSizeBeforeCancel = this.uploadProgressDetails.totalBytes || this.currentItemBeingUploaded?.size || 0;
    this.uploadProgressDetails = {
      totalBytes: totalSizeBeforeCancel,
      percentage: this.uploadProgressDetails.percentage > 0 ? this.uploadProgressDetails.percentage : 0, // Keep partially completed overall %
      bytesSent: this.uploadProgressDetails.bytesSent,
      speedMBps: 0,
      etaFormatted: '--:--',
      uploadedFilesCount: this.uploadProgressDetails.uploadedFilesCount, // Keep count of already fully uploaded files
    };
    // this.uploadProgress = this.uploadProgressDetails.percentage; // Reflect current overall %

    // Update individual items: mark currently processing as stopped, keep others' progress
    this.selectedItems = this.selectedItems.map(item => ({
      ...item,
      // individualProgress: item.isCurrentlyProcessing ? (item.individualProgress || 0) : item.individualProgress, // Stop progress for current, keep for others
      isCurrentlyProcessing: false // No item is currently processing
    }));

    this.currentItemBeingUploaded = null; // Clear the batch representation
    this.currentUploadId = null; // Important to reset this

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
      if (this.selectedItems.length === 0) {
        this.shareableLinkForPanel = null;
        this.uploadError = null;
        this.uploadStatusMessage = '';
        this.batchUploadLinks = [];
        this.currentItemBeingUploaded = null;
        this.nextItemId = 0;
      }
    } else { // Clear all
      this.selectedItems = [];
      this.shareableLinkForPanel = null;
      this.uploadError = null;
      this.uploadStatusMessage = '';
      this.batchUploadLinks = [];
      this.currentItemBeingUploaded = null;
      this.nextItemId = 0;
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
    if (this.isUploading && itemToDownload.isCurrentlyProcessing) {
      alert("Cannot download an item that is currently being uploaded. Please wait or cancel.");
      return;
    }
    try {
      if (!(itemToDownload.file instanceof File)) {
        if (itemToDownload.id === -1 && this.shareableLinkForPanel) {
          alert("This represents the completed batch. To download, use the generated shareable link.");
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
    if (isPath && (baseNameForIcon === '' || !baseNameForIcon.includes('.'))) return 'fas fa-folder';
    if (!baseNameForIcon.includes('.')) return 'fas fa-file';
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