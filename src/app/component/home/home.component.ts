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
  private readonly FIVE_GIGABYTES_IN_BYTES = 5 * 1024 * 1024 * 1024; // Added 5GB limit
  private readonly genericUploadMessage = "Your files are being uploaded, wait a few minutes.";
  private gdriveEventSource: EventSource | null = null;
  private telegramEventSource: EventSource | null = null;
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
    this.anonymousFolderUploadsCount = 0; // Reset this as well
    this.isGamePanelVisible = false;
    this.updatePlayGamesButtonVisibility();
    this.dragEnterCounter = 0;
    this.closeAllEventSources();

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
    this.closeAllEventSources();
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
  handleFilesDroppedInOrbital(fileList: FileList): void {
    console.log('HomeComponent: Files dropped in orbital display area.', fileList);
    if (this.selectedItems.length === 0 && !this.isUploading && !this.shareableLinkForPanel) {
      this.handleFiles(fileList, false);
    } else {
      console.log('HomeComponent: Drop in orbital area ignored, component not in receptive state for new files.');
    }
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
    if (this.shareableLinkForPanel || this.batchUploadLinks.length > 0) {
      this.selectedItems = [];
      this.nextItemId = 0;
      this.shareableLinkForPanel = null;
      this.batchUploadLinks = [];
      this.anonymousFolderUploadsCount = 0; // Reset for new selection batch
    }
    this.uploadError = null;
    this.uploadSuccessMessage = null;
    this.anonymousUploadLimitMessage = null;

    const isLoggedIn = this.authService.isLoggedIn();
    const MAX_TOTAL_ITEMS_OR_FILES_LIMIT_ANONYMOUS = this.MAX_ANONYMOUS_FOLDER_UPLOADS; // This is 5

    // --- Message Definitions ---
    let totalItemCountLimitErrorMessage: string;
    if (isFolderSelection) {
      totalItemCountLimitErrorMessage = `As you are not logged in, you can select a maximum of ${this.MAX_ANONYMOUS_FOLDER_UPLOADS} folder. Please login to upload more than ${this.MAX_ANONYMOUS_FOLDER_UPLOADS} folder.`;
    } else {
      totalItemCountLimitErrorMessage = `As you are not logged in, you can select a maximum of ${this.MAX_ANONYMOUS_FOLDER_UPLOADS} files. Please login to upload more than ${this.MAX_ANONYMOUS_FOLDER_UPLOADS} files.`;
    }

    const FOLDER_ADDITION_LIMIT_ERROR_MESSAGE = `As you are not logged in, you can add a maximum of ${this.MAX_ANONYMOUS_FOLDER_UPLOADS} folders. You have reached this limit. Please log in to add more folders.`;
    const FOLDER_ADDITION_LIMIT_INFO_MESSAGE = `As you are not logged in, you can select a maximum of ${this.MAX_ANONYMOUS_FOLDER_UPLOADS} folder. Please login to upload more than ${this.MAX_ANONYMOUS_FOLDER_UPLOADS} folder.`;
    const ANONYMOUS_SIZE_LIMIT_ERROR_MESSAGE = `As you are not logged in, your total selection cannot exceed 5 GB. Please log in for larger uploads or reduce your selection.`;


    // Handle empty fileList (e.g., empty folder selected)
    if (!fileList || fileList.length === 0) {
      if (isFolderSelection && !isLoggedIn) {
        if (this.anonymousFolderUploadsCount >= this.MAX_ANONYMOUS_FOLDER_UPLOADS) {
          this.uploadError = FOLDER_ADDITION_LIMIT_ERROR_MESSAGE;
        } else {
          this.anonymousFolderUploadsCount++;
          console.log(`Anonymous folder selection count incremented (empty folder): ${this.anonymousFolderUploadsCount}`);
          if (this.anonymousFolderUploadsCount >= this.MAX_ANONYMOUS_FOLDER_UPLOADS) {
            this.anonymousUploadLimitMessage = FOLDER_ADDITION_LIMIT_INFO_MESSAGE;
          }
        }
        if (this.folderInputRef?.nativeElement) this.folderInputRef.nativeElement.value = '';
        this.cdRef.detectChanges();
      }
      return;
    }

    // --- Pre-checks for anonymous users before processing the new fileList ---
    if (!isLoggedIn) {
      // 1. Check folder *addition* limit (if this is a folder selection)
      if (isFolderSelection && this.anonymousFolderUploadsCount >= this.MAX_ANONYMOUS_FOLDER_UPLOADS) {
        this.uploadError = FOLDER_ADDITION_LIMIT_ERROR_MESSAGE;
        if (this.folderInputRef?.nativeElement) this.folderInputRef.nativeElement.value = '';
        this.cdRef.detectChanges();
        return;
      }

      const currentItemCount = this.selectedItems.length;
      const currentTotalSize = this.selectedItems.reduce((sum, item) => sum + item.size, 0);

      // 2. Check if *already* at total item count limit (before adding anything from fileList)
      if (currentItemCount >= MAX_TOTAL_ITEMS_OR_FILES_LIMIT_ANONYMOUS && fileList.length > 0) {
        this.uploadError = totalItemCountLimitErrorMessage;
        if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = '';
        if (this.folderInputRef?.nativeElement) this.folderInputRef.nativeElement.value = '';
        this.cdRef.detectChanges();
        return;
      }

      // 3. Check if *already* at total size limit (before adding anything from fileList)
      if (currentTotalSize >= this.FIVE_GIGABYTES_IN_BYTES && fileList.length > 0) {
        this.uploadError = ANONYMOUS_SIZE_LIMIT_ERROR_MESSAGE;
        if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = '';
        if (this.folderInputRef?.nativeElement) this.folderInputRef.nativeElement.value = '';
        this.cdRef.detectChanges();
        return;
      }
    }


    const newItems: SelectedItem[] = [];
    let filesAddedInThisOperation = 0; // How many files from fileList were actually processed into SelectedItem
    let sizeAddedInThisOperation = 0;   // Total size of files successfully added to newItems in *this* call

    const currentItemCountBeforeThisBatch = this.selectedItems.length;
    const currentTotalSizeBeforeThisBatch = this.selectedItems.reduce((sum, item) => sum + item.size, 0);


    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];

      // For anonymous users, check limits before processing each file from fileList
      if (!isLoggedIn) {
        // Check total item count limit (selectedItems + newItems so far)
        if ((currentItemCountBeforeThisBatch + newItems.length) >= MAX_TOTAL_ITEMS_OR_FILES_LIMIT_ANONYMOUS) {
          if (!this.uploadError) this.uploadError = totalItemCountLimitErrorMessage;
          break; // Stop processing more files from fileList
        }
        // Check total size limit (selectedItems + newItems so far + current file)
        if ((currentTotalSizeBeforeThisBatch + sizeAddedInThisOperation + file.size) > this.FIVE_GIGABYTES_IN_BYTES) {
          if (!this.uploadError) this.uploadError = ANONYMOUS_SIZE_LIMIT_ERROR_MESSAGE;
          break; // Stop processing more files from fileList
        }
      }

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
      const isActualFolderEntry = (isFolderSelection && !file.type && file.size === 0 && file.webkitRelativePath.endsWith(file.name)) || (itemName.includes('/') && !itemName.split('/').pop()?.includes('.'));

      newItems.push({
        id: this.nextItemId++,
        file: file,
        name: itemName,
        size: file.size,
        icon: this.getFileIcon(itemName),
        isFolder: isActualFolderEntry
      });
      filesAddedInThisOperation++;
      sizeAddedInThisOperation += file.size;
    }

    if (newItems.length > 0) {
      this.selectedItems = [...this.selectedItems, ...newItems];
      console.log('Items added:', newItems.length, 'Total selectedItems:', this.selectedItems.length);
    }

    // Handle folder selection count increment and informational message for anonymous users
    if (isFolderSelection && !isLoggedIn && (filesAddedInThisOperation > 0 || (fileList.length > 0 && newItems.length === 0 && !this.uploadError))) {
      if (this.anonymousFolderUploadsCount < this.MAX_ANONYMOUS_FOLDER_UPLOADS) { // Only increment if current count is less than max
        this.anonymousFolderUploadsCount++;
        console.log(`Anonymous folder selection count incremented (processed folder): ${this.anonymousFolderUploadsCount}`);
        if (this.anonymousFolderUploadsCount >= this.MAX_ANONYMOUS_FOLDER_UPLOADS && !this.uploadError) {
          this.anonymousUploadLimitMessage = FOLDER_ADDITION_LIMIT_INFO_MESSAGE;
        }
      } else if (!this.uploadError && !this.anonymousUploadLimitMessage) {
        // If already at limit, and no other error/info message shown, show the info message
        this.anonymousUploadLimitMessage = FOLDER_ADDITION_LIMIT_INFO_MESSAGE;
      }
    }

    // If not all files from fileList were added due to hitting a limit (and error not already set by pre-checks)
    if (!isLoggedIn && filesAddedInThisOperation < fileList.length && !this.uploadError) {
      // The error should have been set inside the loop. This is a fallback.
      // Prioritize the error message based on which limit was likely hit.
      const finalItemCount = this.selectedItems.length;
      const finalTotalSize = this.selectedItems.reduce((sum, item) => sum + item.size, 0);

      if (finalTotalSize > this.FIVE_GIGABYTES_IN_BYTES) {
        this.uploadError = ANONYMOUS_SIZE_LIMIT_ERROR_MESSAGE;
      } else if (finalItemCount >= MAX_TOTAL_ITEMS_OR_FILES_LIMIT_ANONYMOUS) {
        this.uploadError = totalItemCountLimitErrorMessage;
      }
      // If FOLDER_ADDITION_LIMIT_ERROR_MESSAGE was set earlier, it should persist.
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

    // Additional check for anonymous user limits before initiating transfer
    if (!this.authService.isLoggedIn()) {
      const totalSize = this.selectedItems.reduce((sum, item) => sum + item.size, 0);
      if (this.selectedItems.length > this.MAX_ANONYMOUS_FOLDER_UPLOADS) {
        this.uploadError = `As you are not logged in, you can upload a maximum of ${this.MAX_ANONYMOUS_FOLDER_UPLOADS} files/folders. Please login to upload more than 5 files/folder.

.`;
        this.cdRef.detectChanges();
        return;
      }
      if (totalSize > this.FIVE_GIGABYTES_IN_BYTES) {
        this.uploadError = `As you are not logged in, your total selection cannot exceed 5 GB. Please reduce your selection or log in.`;
        this.cdRef.detectChanges();
        return;
      }
    }


    this.isUploading = true;
    this.uploadError = null;
    this.uploadSuccessMessage = null;
    this.anonymousUploadLimitMessage = null;
    this.shareableLinkForPanel = null;
    this.batchUploadLinks = [];
    this.closeAllEventSources();

    const totalBatchSize = this.selectedItems.reduce((sum, item) => sum + item.size, 0);

    this.currentItemBeingUploaded = {
      id: -1,
      name: this.selectedItems.length > 1 ? `Uploading ${this.selectedItems.length} items...` : `Uploading ${this.selectedItems[0].name}...`,
      size: totalBatchSize,
      file: null,
      icon: this.selectedItems.length === 1 ? (this.selectedItems[0].isFolder ? 'fas fa-folder' : this.selectedItems[0].icon) : 'fas fa-archive',
      isFolder: this.selectedItems.length === 1 ? (this.selectedItems[0].isFolder ?? false) : false
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
        if (res.upload_id && res.sse_gdrive_upload_url) {
          this.currentUploadId = res.upload_id;
          this.listenToGDriveUploadProgress(res.upload_id, res.sse_gdrive_upload_url, this.currentItemBeingUploaded);
        } else {
          this.handleBatchUploadError('Server did not return a valid upload ID or GDrive SSE URL.');
        }
      },
      error: (err: Error) => {
        if (!this.isUploading) return;
        this.handleBatchUploadError(`Failed to initiate batch upload: ${err.message}`);
      }
    });
  }
  private handleGDriveComplete(data: any, operationId: string): void {
    this.zone.run(() => {
      if (operationId !== this.currentUploadId || !this.isUploading) {
        this.closeGDriveEventSource();
        return;
      }
      console.log('GDrive upload complete. SSE Data:', data);

      if (data.access_id && data.filename) {

        if (data.is_final_step) {
          this.completedBatchAccessId = data.access_id;
          const frontendBaseUrl = window.location.origin;
          let viewPageRoute = '/batch-view/';
          this.shareableLinkForPanel = `${frontendBaseUrl}${viewPageRoute}${data.access_id}`;
          if (this.currentItemBeingUploaded) {
            this.currentItemBeingUploaded.name = data.filename;
          }
          this.uploadProgressDetails.percentage = 100;
          this.uploadProgress = 100;
          this.isUploading = false;
          this.uploadStatusMessage = data.message || "Upload complete!";

          if (!this.authService.isLoggedIn()) {
            this.anonymousUploadLimitMessage = "Upload successful! Your files are available for 5 days. For longer storage and more features, please log in or sign up.";
            setTimeout(() => { this.anonymousUploadLimitMessage = null; this.cdRef.detectChanges(); }, 7000);
          } else {
            this.uploadSuccessMessage = "Files uploaded successfully!";
            setTimeout(() => { this.uploadSuccessMessage = null; this.cdRef.detectChanges(); }, 6000);
          }
          if (this.currentUser && this.username) this.loadUserFileCount();
          this.closeGDriveEventSource();
        } else {
          this.uploadStatusMessage = data.message || 'Temporary storage complete. Preparing next phase...';
        }

      } else {
        this.handleBatchUploadError("GDrive phase completed, but essential data (access_id/filename) missing from server event.");
        this.isUploading = false;
      }
      this.cdRef.detectChanges();
    });
  }

  private listenToGDriveUploadProgress(operationId: string, relativeSseUrl: string, batchItemRepresentation: SelectedItem | null): void {
    this.closeAllEventSources();

    const backendApiUrl = this.apiService.getApiBaseUrl();
    const fullSseUrl = `${backendApiUrl}${relativeSseUrl}`;

    try {
      this.gdriveEventSource = new EventSource(fullSseUrl, { withCredentials: this.authService.isLoggedIn() });
      const es = this.gdriveEventSource;

      es.onopen = () => this.zone.run(() => {
        if (operationId !== this.currentUploadId || !this.isUploading) { this.closeGDriveEventSource(); return; }
        console.log(`GDrive SSE connection opened for: ${operationId} URL: ${fullSseUrl}`);
        this.uploadStatusMessage = 'Connecting to temporary storage...';
        this.cdRef.detectChanges();
      });

      es.addEventListener('start', (event: MessageEvent) => this.zone.run(() => {
        if (operationId !== this.currentUploadId || !this.isUploading) return;
        const data = JSON.parse(event.data);
        this.uploadStatusMessage = this.genericUploadMessage;
        if (data.totalSize && data.totalSize !== this.uploadProgressDetails.totalBytes) {
          this.uploadProgressDetails.totalBytes = parseInt(data.totalSize, 10);
          if (this.currentItemBeingUploaded) this.currentItemBeingUploaded.size = this.uploadProgressDetails.totalBytes;
        }
        this.uploadProgressDetails.percentage = 0;
        this.uploadProgressDetails.bytesSent = 0;
        this.uploadProgress = 0;
        this.cdRef.detectChanges();
      }));

      es.addEventListener('status', (event: MessageEvent) => this.zone.run(() => {
        if (operationId !== this.currentUploadId || !this.isUploading) return;
        const data = JSON.parse(event.data);
        this.uploadStatusMessage = this.genericUploadMessage;
        this.cdRef.detectChanges();
      }));

      es.addEventListener('progress', (event: MessageEvent) => this.zone.run(() => {
        if (operationId !== this.currentUploadId || !this.isUploading) return;
        const data = JSON.parse(event.data);
        this.uploadProgressDetails.percentage = data.percentage !== undefined ? Math.min(parseFloat(data.percentage), 100) : this.uploadProgressDetails.percentage;
        this.uploadProgressDetails.bytesSent = data.bytesSent !== undefined ? parseInt(data.bytesSent, 10) : this.uploadProgressDetails.bytesSent;
        this.uploadProgress = this.uploadProgressDetails.percentage;
        this.uploadStatusMessage = this.genericUploadMessage;
        this.cdRef.detectChanges();
      }));

      es.addEventListener('gdrive_complete', (event: MessageEvent) => this.zone.run(() => {
        if (operationId !== this.currentUploadId || !this.isUploading) { this.closeGDriveEventSource(); return; }

        const data = JSON.parse(event.data);
        console.log('GDrive phase finished. Data:', data);
        this.uploadStatusMessage = data.message || 'Temporary storage complete. Preparing final transfer...';

        this.closeGDriveEventSource();

        if (data.access_id) {
          if (data.is_final_step === true || !data.sse_telegram_upload_url) {
            this.completedBatchAccessId = data.access_id;
            const frontendBaseUrl = window.location.origin;
            this.shareableLinkForPanel = `${frontendBaseUrl}/batch-view/${data.access_id}`;
            if (this.currentItemBeingUploaded) this.currentItemBeingUploaded.name = data.filename || this.currentItemBeingUploaded.name;
            this.uploadProgressDetails.percentage = 100;
            this.uploadProgress = 100;
            this.isUploading = false;
            this.uploadStatusMessage = data.final_message || "Upload complete!";

            if (!this.authService.isLoggedIn()) {
              this.anonymousUploadLimitMessage = "Upload successful! Your files are available for 5 days. For longer storage and more features, please log in or sign up.";
              setTimeout(() => { this.anonymousUploadLimitMessage = null; this.cdRef.detectChanges(); }, 7000);
            } else {
              this.uploadSuccessMessage = "Files uploaded successfully!";
              setTimeout(() => { this.uploadSuccessMessage = null; this.cdRef.detectChanges(); }, 6000);
            }
            if (this.currentUser && this.username) this.loadUserFileCount();

          } else if (data.sse_telegram_upload_url) {
            this.uploadProgressDetails.percentage = 0;
            this.uploadProgressDetails.bytesSent = 0;
            this.uploadProgress = 0;
            this.listenToTelegramUploadProgress(operationId, data.sse_telegram_upload_url, batchItemRepresentation);
          } else {
            this.handleBatchUploadError("GDrive phase completed but next step unclear or finalization data missing.");
          }
        } else {
          this.handleBatchUploadError("GDrive phase completed but essential data (access_id) missing for next step or finalization.");
        }
        this.cdRef.detectChanges();
      }));

      es.addEventListener('error', (errorEventOrMsgEvent: Event) => this.zone.run(() => {
        if (operationId !== this.currentUploadId || !this.isUploading) { this.closeGDriveEventSource(); return; }
        let errorMessage = 'Error during temporary storage phase.';
        if (errorEventOrMsgEvent instanceof MessageEvent && (errorEventOrMsgEvent as MessageEvent).data) {
          try {
            const parsedError = JSON.parse((errorEventOrMsgEvent as MessageEvent).data);
            errorMessage = parsedError.message || parsedError.error || errorMessage;
          } catch (e) { console.warn("Could not parse GDrive SSE error event data:", (errorEventOrMsgEvent as MessageEvent).data); }
        }
        console.error("GDrive SSE Error Event: ", errorEventOrMsgEvent, "Parsed message:", errorMessage);
        this.handleBatchUploadError(errorMessage, errorEventOrMsgEvent);
      }));

      es.onerror = (errorEvent: Event) => this.zone.run(() => {
        if (es.readyState === EventSource.CLOSED) {
          console.log("GDrive EventSource closed by client or gracefully.");
          return;
        }
        if (operationId !== this.currentUploadId || !this.isUploading) { this.closeGDriveEventSource(); return; }
        console.error("GDrive SSE Connection Error (onerror): ", errorEvent, "Target URL was:", fullSseUrl);
        this.handleBatchUploadError(`Connection error during temporary storage phase (URL: ${relativeSseUrl}). Check backend.`, errorEvent);
      });

    } catch (error) {
      console.error("Failed to create GDrive EventSource:", error);
      this.handleBatchUploadError(`Client-side error setting up GDrive upload progress: ${(error as Error).message}`);
    }
  }

  private listenToTelegramUploadProgress(operationId: string, relativeTelegramSseUrl: string, batchItemRepresentation: SelectedItem | null): void {
    this.closeTelegramEventSource();

    const backendApiUrl = this.apiService.getApiBaseUrl();
    const fullTelegramSseUrl = `${backendApiUrl}${relativeTelegramSseUrl}`;

    try {
      this.telegramEventSource = new EventSource(fullTelegramSseUrl, { withCredentials: this.authService.isLoggedIn() });
      const es = this.telegramEventSource;

      es.onopen = () => this.zone.run(() => {
        if (operationId !== this.currentUploadId || !this.isUploading) { this.closeTelegramEventSource(); return; }
        console.log(`Telegram SSE connection opened for: ${operationId} URL: ${fullTelegramSseUrl}`);
        this.uploadStatusMessage = 'Starting final transfer phase...';
        this.cdRef.detectChanges();
      });

      es.addEventListener('start', (event: MessageEvent) => {
        this.zone.run(() => {
          if (operationId !== this.currentUploadId || !this.isUploading) { return; }
          const data = JSON.parse(event.data);
          this.uploadStatusMessage = this.genericUploadMessage;

          if (data.totalSize && data.totalSize !== this.uploadProgressDetails.totalBytes) {
            this.uploadProgressDetails.totalBytes = parseInt(data.totalSize, 10);
            if (this.currentItemBeingUploaded) this.currentItemBeingUploaded.size = this.uploadProgressDetails.totalBytes;
          } else if (this.uploadProgressDetails.totalBytes === 0 && this.currentItemBeingUploaded && this.currentItemBeingUploaded.size > 0) {
            this.uploadProgressDetails.totalBytes = this.currentItemBeingUploaded.size;
          }
          this.uploadProgressDetails.percentage = 0;
          this.uploadProgressDetails.bytesSent = 0;
          this.uploadProgress = 0;

          console.log('Telegram SSE "start" event data:', data);
          this.cdRef.detectChanges();
        });
      });

      es.addEventListener('status', (event: MessageEvent) => {
        this.zone.run(() => {
          if (operationId !== this.currentUploadId || !this.isUploading) { return; }
          const data = JSON.parse(event.data);
          this.uploadStatusMessage = this.genericUploadMessage;
          console.log('Telegram SSE "status" event data:', data);
          this.cdRef.detectChanges();
        });
      });

      es.addEventListener('progress', (event: MessageEvent) => {
        this.zone.run(() => {
          if (operationId !== this.currentUploadId || !this.isUploading) { return; }
          try {
            const data = JSON.parse(event.data);
            this.uploadProgressDetails.percentage = data.percentage !== undefined ? Math.min(parseFloat(data.percentage), 100) : this.uploadProgressDetails.percentage;
            this.uploadProgressDetails.bytesSent = data.bytesSent !== undefined ? parseInt(data.bytesSent, 10) : (data.bytesProcessed !== undefined ? parseInt(data.bytesProcessed, 10) : this.uploadProgressDetails.bytesSent);
            this.uploadProgressDetails.speedMBps = data.speedMBps !== undefined ? parseFloat(data.speedMBps) : this.uploadProgressDetails.speedMBps;
            this.uploadProgressDetails.etaFormatted = data.etaFormatted !== undefined ? data.etaFormatted : this.uploadProgressDetails.etaFormatted;

            this.uploadProgress = this.uploadProgressDetails.percentage;
            this.uploadStatusMessage = this.genericUploadMessage;
            this.cdRef.detectChanges();
          } catch (e) {
            console.error("Error parsing Telegram SSE 'progress' event data:", event.data, e);
          }
        });
      });

      es.addEventListener('complete', (event: MessageEvent) => {
        this.zone.run(() => {
          if (operationId !== this.currentUploadId || !this.isUploading) { this.closeTelegramEventSource(); return; }
          const data = JSON.parse(event.data);
          this.uploadStatusMessage = data.message || 'Upload complete!';
          this.uploadError = null;

          if (data.access_id && data.filename) {
            this.completedBatchAccessId = data.access_id;
            const frontendBaseUrl = window.location.origin;
            this.shareableLinkForPanel = `${frontendBaseUrl}/batch-view/${data.access_id}`;
            if (this.currentItemBeingUploaded) this.currentItemBeingUploaded.name = data.filename;

            if (!this.authService.isLoggedIn()) {
              this.anonymousUploadLimitMessage = "Upload successful! Your files are available for 5 days. For longer storage and more features, please log in or sign up.";
              setTimeout(() => { this.anonymousUploadLimitMessage = null; this.cdRef.detectChanges(); }, 7000);
            } else {
              this.uploadSuccessMessage = "Files uploaded successfully!";
              setTimeout(() => { this.uploadSuccessMessage = null; this.cdRef.detectChanges(); }, 6000);
            }
          } else {
            this.uploadError = "Upload complete, but essential link data missing.";
            this.shareableLinkForPanel = null;
          }

          this.uploadProgressDetails.percentage = 100;
          this.uploadProgressDetails.totalBytes = data.totalSize || this.uploadProgressDetails.totalBytes;
          this.uploadProgressDetails.bytesSent = this.uploadProgressDetails.totalBytes;
          this.uploadProgress = 100;
          this.isUploading = false;

          if (this.currentUser && this.username) {
            this.loadUserFileCount();
            this.uploadEventService.notifyUploadComplete();
          }
          this.closeTelegramEventSource();
          this.cdRef.detectChanges();
        });
      });

      es.addEventListener('error', (errorEventOrMsgEvent: Event) => this.zone.run(() => {
        if (operationId !== this.currentUploadId || !this.isUploading) { this.closeTelegramEventSource(); return; }
        let errorMessage = 'Error during final transfer phase.';
        if (errorEventOrMsgEvent instanceof MessageEvent && (errorEventOrMsgEvent as MessageEvent).data) {
          try {
            const parsedError = JSON.parse((errorEventOrMsgEvent as MessageEvent).data);
            errorMessage = parsedError.message || parsedError.error || errorMessage;
          } catch (e) { console.warn("Could not parse Telegram SSE error event data:", (errorEventOrMsgEvent as MessageEvent).data); }
        }
        console.error("Telegram SSE Error Event: ", errorEventOrMsgEvent, "Parsed message:", errorMessage);
        this.handleBatchUploadError(errorMessage, errorEventOrMsgEvent);
      }));

      es.onerror = (errorEvent: Event) => this.zone.run(() => {
        if (es.readyState === EventSource.CLOSED) {
          console.log("Telegram EventSource closed by client or gracefully.");
          return;
        }
        if (operationId !== this.currentUploadId || !this.isUploading) { this.closeTelegramEventSource(); return; }
        console.error("Telegram SSE Connection Error: ", errorEvent);
        this.handleBatchUploadError('Connection error during final transfer phase.', errorEvent);
      });

    } catch (error) {
      console.error("Failed to create Telegram EventSource:", error);
      this.handleBatchUploadError(`Client-side error setting up Telegram upload progress: ${(error as Error).message}`);
    }
  }

  private closeGDriveEventSource(): void {
    if (this.gdriveEventSource) {
      this.gdriveEventSource.close();
      this.gdriveEventSource = null;
      console.log('HomeComponent: GDrive EventSource closed.');
    }
  }

  private closeTelegramEventSource(): void {
    if (this.telegramEventSource) {
      this.telegramEventSource.close();
      this.telegramEventSource = null;
      console.log('HomeComponent: Telegram EventSource closed.');
    }
  }

  private closeAllEventSources(): void {
    this.closeGDriveEventSource();
    this.closeTelegramEventSource();
    this.closeEventSource();
  }

  handleNewTransferRequest(): void {
    console.log('HomeComponent: New transfer requested. Resetting state.');
    this.resetUploadState();
    this.cdRef.detectChanges();
  }

  private listenToUploadProgress(uploadId: string, batchItemRepresentation: SelectedItem | null): void {
    console.warn("listenToUploadProgress (single stream) is deprecated. Using multi-stage SSE.");
    this.closeGDriveEventSource();
    this.closeTelegramEventSource();

    const apiUrl = this.apiService.getApiBaseUrl();
    const url = `${apiUrl}/stream-progress/${uploadId}`;

    try {
      this.eventSource = new EventSource(url, { withCredentials: this.authService.isLoggedIn() });
      console.log("Attempting to use deprecated single stream SSE for upload ID:", uploadId);

      this.eventSource.onopen = () => { /* ... */ };
      this.eventSource.addEventListener('start', (event: MessageEvent) => { /* ... */ });
      this.eventSource.addEventListener('status', (event: MessageEvent) => { /* ... */ });
      this.eventSource.addEventListener('progress', (event: MessageEvent) => { /* ... */ });
      this.eventSource.addEventListener('complete', (event: MessageEvent) => {
        this.zone.run(() => {
          if (uploadId !== this.currentUploadId || !this.isUploading) { this.closeEventSource(); return; }
          const data = JSON.parse(event.data);
          this.uploadStatusMessage = data.message || 'Upload complete!';
          this.uploadError = null;
          if (data.batch_access_id) {
            this.completedBatchAccessId = data.batch_access_id;
            const frontendBaseUrl = window.location.origin;
            this.shareableLinkForPanel = `${frontendBaseUrl}/batch-view/${data.batch_access_id}`;
            if (!this.authService.isLoggedIn()) {
              this.anonymousUploadLimitMessage = "Upload successful! Your files are available for 5 days. For longer storage and more features, please log in or sign up.";
              setTimeout(() => { this.anonymousUploadLimitMessage = null; this.cdRef.detectChanges(); }, 7000);
            } else {
              this.uploadSuccessMessage = "Files uploaded successfully!";
              setTimeout(() => { this.uploadSuccessMessage = null; this.cdRef.detectChanges(); }, 6000);
            }
          } else {
            this.uploadError = "Upload complete, but link data missing.";
          }
          this.uploadProgressDetails.percentage = 100;
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
      this.eventSource.onerror = (errorEvent: Event) => { this.handleBatchUploadError('SSE connection error.', errorEvent); };

    } catch (error) {
      this.handleBatchUploadError(`Client-side error setting up upload progress: ${(error as Error).message}`);
    }
  }

  private handleBatchUploadError(errorMessage: string, errorEvent?: any): void {
    if (errorEvent) console.error("Error during batch upload:", errorMessage, errorEvent);
    else console.error("Error during batch upload:", errorMessage);
    let displayMessage = errorMessage;

    if (errorMessage &&
      (errorMessage.toLowerCase().includes("storage quota has been exceeded") ||
        errorMessage.toLowerCase().includes("storagequotaexceeded"))) {
      displayMessage = "Upload failed: The Google Drive storage is full. Please free up space in the designated Google Drive account or contact support.";
    }

    this.zone.run(() => {
      this.uploadError = displayMessage;
      this.uploadSuccessMessage = null;
      this.isUploading = false;
      this.uploadProgressDetails = {
        ...this.uploadProgressDetails,
        speedMBps: 0,
        etaFormatted: 'Error',
      };
      this.uploadStatusMessage = 'Upload Failed';
      this.closeAllEventSources();
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
    this.closeAllEventSources();

    this.uploadStatusMessage = `Upload cancelled.`;
    this.uploadError = null;
    this.uploadSuccessMessage = null;

    if (uploadIdToCancel) {
      console.log(`HomeComponent: Frontend cancellation for ${uploadIdToCancel}. Backend cancellation not currently invoked.`);
    }

    this.currentUploadId = null;
    this.cdRef.detectChanges();
  }


  private closeEventSource(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('HomeComponent: (Old) EventSource closed.');
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
        this.handleNewTransferRequest();
      }
    } else {
      this.handleNewTransferRequest();
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

  async handleDataTransferItemsDropped(items: DataTransferItemList | null): Promise<void> {
    if (!this.isReceptiveToNewFiles()) {
      console.log('HomeComponent: Drop ignored, component not in receptive state for new files.');
      return;
    }
    if (!items) {
      console.log('HomeComponent: No DataTransferItems received.');
      return;
    }

    console.log('HomeComponent: DataTransferItems dropped.', items);
    this.uploadError = null;

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
        this.handleFiles(this.createFileListFromArray([]), true);
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
    return this.selectedItems.length === 0 && !this.isUploading && !this.shareableLinkForPanel;
  }


  private async extractFilesFromDataTransferItems(items: DataTransferItemList): Promise<File[]> {
    const filesAccumulator: File[] = [];
    const promises: Promise<void>[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && typeof item.webkitGetAsEntry === 'function') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          promises.push(this.traverseFileSystemEntry(entry, filesAccumulator));
        } else {
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
    return filesAccumulator.filter(file => file instanceof File);
  }

  private async traverseFileSystemEntry(entry: FileSystemEntry, filesAccumulator: File[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (entry.isFile) {
        (entry as FileSystemFileEntry).file(
          (file) => {
            if (file.name.toLowerCase().endsWith('.ds_store')) {
              console.log(`Skipping .DS_Store file during traversal: ${entry.fullPath || entry.name}`);
              resolve();
              return;
            }
            filesAccumulator.push(file);
            resolve();
          },
          (err) => {
            console.error(`Error reading file ${entry.fullPath || entry.name}:`, err);
            resolve();
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
                (err) => batchReject(err)
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
            resolve();
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