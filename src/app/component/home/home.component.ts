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
  speedMBps: number;    // Speed in MB/s, updated from backend or calculated
  etaFormatted: string; // Formatted ETA string (e.g., "01:23", "00:15", "--:--")
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
  // --- Injections and initial properties ---
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
  // currentItemBeingUploaded: SelectedItem | null = null;
  userFileCount: number = 0;
  isLoadingUserFileCount: boolean = false;
  uploadStatusMessage: string = '';
  uploadProgressDetails: UploadProgressDetails = {
    percentage: 0, bytesSent: 0, totalBytes: 0, speedMBps: 0, etaFormatted: '--:--',
  };
  // uploadProgress: number = 0;

  private nextItemId = 0;
  private authSubscription: Subscription | null = null;
  private progressSubscription: Subscription | null = null;
  private uploadStartTime: number = 0; // To store the start time of the upload for client-side ETA fallback

  // public isDraggingOverWindow: boolean = false;
  private dragEnterCounter = 0;

  transferList = [
    { img: "assets/image/secure.svg", title: "Secure file transfer via email, or shareable links", des: "Send and share large files and other documents quickly and securely with our file transfer solution. Send large files via email or create a simple sharing link from any device (smartphone, tablet, computer) using just a web browser." },
    { img: "assets/image/sendFile.svg", title: "Send large files up to 250 GB per transfer", des: "Get a TransferNow account to transfer large files and other sizable documents! The files are available up to 365 days before being automatically and permanently erased from our servers." },
    { img: "assets/image/track.svg", title: "Track your sent files. Manage your transfers.", des: "Use our complete dashboard to follow and track your file downloads over time. You can modify your transfers’ data and parameters, re-transfer files to new recipients without having to systematically re-upload the same documents and erase a transfer before it's initial expiration date." },
    { img: "assets/image/download (2).svg", title: "Integrate the TransferNow widget on your website and receive files easily.", des: "Discover our form generator to receive files directly on your account and customize the widget’s appearance as well as it's fields (text boxes, drop-down lists, checkboxes, radio buttons). You can get a simple HTML code to integrate into your website allowing you to receive files instantaneously." }
  ];
  redisterdUser = [
    { icon: 'assets/image/rg-i.png', title: 'Registered users', count: '35,000' },
    { icon: 'assets/image/upload-files-img1.png', title: 'Uploaded files', count: '1,90,000' }
  ]
  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent): void {
    let confirmationMessage = ""; // 1. Initialize an empty message

    // 2. First Check: Is an upload actively in progress?
    if (this.isUploading) {
      confirmationMessage = "Leaving or refreshing the page will cancel your current upload. Are you sure you want to proceed?";
    }
    // 3. Second Check (only if not uploading): Are files selected but not yet uploaded/completed?
    else if (this.selectedItems.length > 0 && !this.shareableLinkForPanel) {
      confirmationMessage = "You have files selected that have not been uploaded. If you leave or refresh the page, your selection will be lost. Are you sure you want to continue?";
    }

    // 4. If a message was set (meaning a warning is needed):
    if (confirmationMessage) {
      event.preventDefault(); // This is crucial. It tells the browser to show its native confirmation dialog.
      event.returnValue = confirmationMessage; // This provides the text for the dialog (though some modern browsers show a generic message for security reasons).
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
    }
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.progressSubscription?.unsubscribe();
  }

  private resetUploadState(): void {
    this.isUploading = false;
    this.uploadError = null;
    this.uploadSuccessMessage = null;
    this.selectedItems = [];
    this.shareableLinkForPanel = null;
    this.completedBatchAccessId = null;
    // this.currentItemBeingUploaded = null;
    this.uploadStatusMessage = '';
    this.uploadProgressDetails = { percentage: 0, bytesSent: 0, totalBytes: 0, speedMBps: 0, etaFormatted: '--:--' };
    // this.uploadProgress = 0;
    this.nextItemId = 0;
    this.anonymousUploadLimitMessage = null;
    this.anonymousFolderUploadsCount = 0;
    this.isGamePanelVisible = false;
    this.dragEnterCounter = 0;
    this.uploadStartTime = 0; // Reset upload start time

    if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = '';
    if (this.folderInputRef?.nativeElement) this.folderInputRef.nativeElement.value = '';

    this.progressSubscription?.unsubscribe();
    this.progressSubscription = null;
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
    event.preventDefault(); event.stopPropagation(); this.dragEnterCounter++;
    if (this.selectedItems.length > 0 || this.isUploading || this.shareableLinkForPanel) event.dataTransfer.dropEffect = 'none';
    else if (event.dataTransfer.dropEffect !== 'copy') event.dataTransfer.dropEffect = 'none';
  }
  @HostListener('window:dragover', ['$event'])
  onWindowDragOver(event: DragEvent): void {
    if (!event.dataTransfer) return;
    event.preventDefault(); event.stopPropagation();
    if (this.selectedItems.length > 0 || this.isUploading || this.shareableLinkForPanel) event.dataTransfer.dropEffect = 'none';
    else if (event.dataTransfer.dropEffect !== 'copy') event.dataTransfer.dropEffect = 'none';
  }
  @HostListener('window:dragleave', ['$event'])
  onWindowDragLeave(event: DragEvent): void {
    event.preventDefault(); event.stopPropagation(); this.dragEnterCounter--;
    if (this.dragEnterCounter <= 0) this.dragEnterCounter = 0;
  }
  @HostListener('window:drop', ['$event'])
  onWindowDrop(event: DragEvent): void {
    event.preventDefault(); event.stopPropagation(); this.dragEnterCounter = 0;
  }
  triggerFileInput(): void { if (this.selectedItems.length === 0 && !this.isUploading && !this.shareableLinkForPanel) this.fileInputRef?.nativeElement.click(); }
  triggerFolderInput(): void { if (this.selectedItems.length === 0 && !this.isUploading && !this.shareableLinkForPanel) this.folderInputRef?.nativeElement.click(); }
  handleFiles(fileList: FileList, isFolderSelection: boolean = false): void {
    if (this.isUploading) { alert("Wait for current upload or cancel it."); return; }
    if (this.shareableLinkForPanel || (this.selectedItems.length > 0 && fileList.length > 0 && this.selectedItems[0].id !== -2)) this.resetUploadState();
    this.uploadError = null; this.uploadSuccessMessage = null; this.anonymousUploadLimitMessage = null;
    const isLoggedIn = this.authService.isLoggedIn();
    const MAX_ITEMS_ANON = this.MAX_ANONYMOUS_FOLDER_UPLOADS;
    let limitMsg = `As you are not logged in, you can select a maximum of ${MAX_ITEMS_ANON} ${isFolderSelection ? 'folder' : 'file'}. Please login to upload more.`;
    const FOLDER_LIMIT_ERR = `As you are not logged in, you can add a maximum of ${MAX_ITEMS_ANON} folders. You have reached this limit. Please log in to add more folders.`;
    const FOLDER_LIMIT_INFO = `As you are not logged in, you can select a maximum of ${MAX_ITEMS_ANON} folder. Please login to upload more.`;
    const SIZE_LIMIT_ERR = `As you are not logged in, your total selection cannot exceed 5 GB. Please log in for larger uploads or reduce your selection.`;

    if (!fileList || fileList.length === 0) {
      if (isFolderSelection && !isLoggedIn) {
        if (this.anonymousFolderUploadsCount >= MAX_ITEMS_ANON) this.uploadError = FOLDER_LIMIT_ERR;
        else { this.anonymousFolderUploadsCount++; if (this.anonymousFolderUploadsCount >= MAX_ITEMS_ANON) this.anonymousUploadLimitMessage = FOLDER_LIMIT_INFO; }
        if (this.folderInputRef?.nativeElement) this.folderInputRef.nativeElement.value = ''; this.cdRef.detectChanges();
      } return;
    }
    if (!isLoggedIn) {
      if (isFolderSelection && this.anonymousFolderUploadsCount >= MAX_ITEMS_ANON) { this.uploadError = FOLDER_LIMIT_ERR; if (this.folderInputRef?.nativeElement) this.folderInputRef.nativeElement.value = ''; this.cdRef.detectChanges(); return; }
      const currentCount = this.selectedItems.length; const currentSize = this.selectedItems.reduce((s, i) => s + i.size, 0);
      if (currentCount >= MAX_ITEMS_ANON && fileList.length > 0) { this.uploadError = limitMsg; if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = ''; if (this.folderInputRef?.nativeElement) this.folderInputRef.nativeElement.value = ''; this.cdRef.detectChanges(); return; }
      if (currentSize >= this.FIVE_GIGABYTES_IN_BYTES && fileList.length > 0) { this.uploadError = SIZE_LIMIT_ERR; if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = ''; if (this.folderInputRef?.nativeElement) this.folderInputRef.nativeElement.value = ''; this.cdRef.detectChanges(); return; }
    }
    const newItems: SelectedItem[] = []; let filesAdded = 0; let sizeAdded = 0;
    const countBefore = this.selectedItems.length; const sizeBefore = this.selectedItems.reduce((s, i) => s + i.size, 0);
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!isLoggedIn) {
        if ((countBefore + newItems.length) >= MAX_ITEMS_ANON) { if (!this.uploadError) this.uploadError = limitMsg; break; }
        if ((sizeBefore + sizeAdded + file.size) > this.FIVE_GIGABYTES_IN_BYTES) { if (!this.uploadError) this.uploadError = SIZE_LIMIT_ERR; break; }
      }
      let itemName = file.name; if (file.webkitRelativePath && (file.webkitRelativePath !== file.name || isFolderSelection)) itemName = file.webkitRelativePath;
      if (file.size === 0 && !isFolderSelection && !itemName.includes('/')) continue; if (file.name.toLowerCase().endsWith('.ds_store')) continue;
      const isActualFolder = (isFolderSelection && !file.type && file.size === 0 && file.webkitRelativePath.endsWith(file.name)) || (itemName.includes('/') && !itemName.split('/').pop()?.includes('.'));
      newItems.push({ id: this.nextItemId++, file, name: itemName, size: file.size, icon: this.getFileIcon(itemName), isFolder: isActualFolder });
      filesAdded++; sizeAdded += file.size;
    }
    if (newItems.length > 0) this.selectedItems = [...this.selectedItems, ...newItems];
    if (isFolderSelection && !isLoggedIn && (filesAdded > 0 || (fileList.length > 0 && newItems.length === 0 && !this.uploadError))) {
      if (this.anonymousFolderUploadsCount < MAX_ITEMS_ANON) { this.anonymousFolderUploadsCount++; if (this.anonymousFolderUploadsCount >= MAX_ITEMS_ANON && !this.uploadError) this.anonymousUploadLimitMessage = FOLDER_LIMIT_INFO; }
      else if (!this.uploadError && !this.anonymousUploadLimitMessage) this.anonymousUploadLimitMessage = FOLDER_LIMIT_INFO;
    }
    if (!isLoggedIn && filesAdded < fileList.length && !this.uploadError) {
      const finalCount = this.selectedItems.length; const finalSize = this.selectedItems.reduce((s, i) => s + i.size, 0);
      if (finalSize > this.FIVE_GIGABYTES_IN_BYTES) this.uploadError = SIZE_LIMIT_ERR;
      else if (finalCount >= MAX_ITEMS_ANON) this.uploadError = limitMsg;
    }
    if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = ''; if (this.folderInputRef?.nativeElement) this.folderInputRef.nativeElement.value = '';
    this.cdRef.detectChanges(); this.updatePlayGamesButtonVisibility();
  }
  onFileSelected(event: Event): void { const i = event.target as HTMLInputElement; if (i.files?.length) this.handleFiles(i.files, false); }
  onFolderSelected(event: Event): void { const i = event.target as HTMLInputElement; if (i.files?.length) this.handleFiles(i.files, true); }

  private formatEta(totalSeconds: number): string {
    if (isNaN(totalSeconds) || totalSeconds < 0 || !isFinite(totalSeconds) || totalSeconds === Infinity) return '--:--'; // Handle Infinity
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  async initiateTransferFromPanel(): Promise<void> {
    if (this.isUploading || this.selectedItems.length === 0) return;
    this.isUploading = true; this.uploadError = null;
    this.uploadProgressDetails.totalBytes = this.selectedItems.reduce((s, i) => s + (i.file?.size ?? 0), 0);
    this.uploadProgressDetails.speedMBps = 0; this.uploadProgressDetails.etaFormatted = '--:--';
    this.updateOverallProgress(0);
    this.uploadStartTime = Date.now(); // Record start time for client-side ETA
    const batchName = this.uploadProgressDetails.totalBytes > 0 ? (this.selectedItems.length === 1 ? this.selectedItems[0].name : `Batch of ${this.selectedItems.length} files`) : 'Processing files...';
    // this.currentItemBeingUploaded = { id: -1, name: batchName, size: this.uploadProgressDetails.totalBytes, file: null as any, icon: 'fas fa-archive' };
    this.uploadStatusMessage = 'Initializing transfer...'; this.cdRef.detectChanges();
    try {
      const initRes = await firstValueFrom(this.apiService.initiateBatch(batchName, this.uploadProgressDetails.totalBytes, this.selectedItems.length > 1));
      const batchId = initRes.batch_id; let bytesUploadedSoFar = 0;
      this.progressSubscription = this.apiService.getUploadProgressStream(batchId).subscribe({
        next: (ev) => this.zone.run(() => this.handleProgressEvent(ev, bytesUploadedSoFar)),
        error: (er) => this.zone.run(() => this.handleBatchUploadError('Progress stream failed.', er))
      });
      for (const item of this.selectedItems) {
        if (!item.file) { if (item.size > 0) bytesUploadedSoFar += item.size; continue; }
        await this.streamFileWithFetch(item, batchId); 
        bytesUploadedSoFar += item.file.size;
      }
      this.uploadStatusMessage = 'Finalizing transfer...'; this.cdRef.detectChanges();
      const finalRes = await firstValueFrom(this.apiService.finalizeBatch(batchId));
      this.onAllUploadsComplete(finalRes);
    } catch (err: any) {
      this.handleBatchUploadError(err.message || 'An unknown error occurred during the upload process.');
    } finally { this.progressSubscription?.unsubscribe(); this.progressSubscription = null; }
  }

  private handleProgressEvent(event: any, bytesAlreadyUploadedForPreviousFiles: number): void {

    // Determine the new status message based on event type and content
    let newUploadStatusMessageToShow = this.uploadStatusMessage; // Default to current status

    if (event.type === 'progress') {
      if (event.filename || this.uploadStatusMessage === 'Initializing transfer...') {
        newUploadStatusMessageToShow = `Your files are being uploaded, wait a few minutes.`;
      }
      // ... (progress bar, ETA, speed calculations remain here)
      const currentFileBytesInEvent = event.bytes_sent || 0;
      const totalBatchSent = event.total_batch_bytes_sent !== undefined
        ? Number(event.total_batch_bytes_sent)
        : (bytesAlreadyUploadedForPreviousFiles + currentFileBytesInEvent);
      this.updateOverallProgress(totalBatchSent);

      let calculatedEta = '--:--';
      let currentSpeedMbps = this.uploadProgressDetails.speedMBps;

      if (event.eta_seconds !== undefined) {
        const etaSec = Number(event.eta_seconds);
        if (!isNaN(etaSec) && etaSec >= 0) {
          calculatedEta = this.formatEta(etaSec);
        }
      } else if (event.speed_mbps !== undefined) {
        const speedFromServer = parseFloat(event.speed_mbps);
        if (!isNaN(speedFromServer) && speedFromServer > 0) {
          currentSpeedMbps = speedFromServer;
          if (this.uploadProgressDetails.totalBytes > 0 && totalBatchSent < this.uploadProgressDetails.totalBytes) {
            const remainingBytes = this.uploadProgressDetails.totalBytes - totalBatchSent;
            const speedBps = currentSpeedMbps * 1024 * 1024;
            const remainingSec = remainingBytes / speedBps;
            calculatedEta = this.formatEta(remainingSec);
          } else if (totalBatchSent >= this.uploadProgressDetails.totalBytes && this.uploadProgressDetails.totalBytes > 0) {
            calculatedEta = '00:00';
          }
        } else {
          currentSpeedMbps = 0;
        }
      } else if (this.uploadStartTime > 0 && totalBatchSent > 0 && this.uploadProgressDetails.totalBytes > 0) {
        const elapsedTimeInSeconds = (Date.now() - this.uploadStartTime) / 1000;
        if (elapsedTimeInSeconds > 1) {
          const clientSpeedBps = totalBatchSent / elapsedTimeInSeconds;
          if (clientSpeedBps > 0) {
            currentSpeedMbps = clientSpeedBps / (1024 * 1024);
            const remainingBytes = this.uploadProgressDetails.totalBytes - totalBatchSent;
            if (remainingBytes > 0) {
              const remainingSec = remainingBytes / clientSpeedBps;
              calculatedEta = this.formatEta(remainingSec);
            } else {
              calculatedEta = '00:00';
            }
          }
        }
      }

      if (this.uploadProgressDetails.percentage >= 99.9 && calculatedEta !== '00:00') {
        calculatedEta = '00:00';
      }

      this.uploadProgressDetails.etaFormatted = calculatedEta;
      this.uploadProgressDetails.speedMBps = currentSpeedMbps;

    } else if (event.type === 'status' && event.message) {
      const messageStr = String(event.message);
      // Heuristic for "Completed: [long_filename]"
      const isUndesiredFileCompletionMsg = messageStr.startsWith('Completed: ') && messageStr.length > 25;

      if (isUndesiredFileCompletionMsg) {
        // If it's the specific "Completed: [filename]" message and the upload is still active
        // (not finalizing, not complete, not failed, not cancelled), then override it.
        if (this.isUploading &&
          this.uploadStatusMessage !== 'Finalizing transfer...' &&
          this.uploadStatusMessage !== 'Transfer complete!' &&
          !this.uploadStatusMessage.startsWith('Upload Failed') &&
          !this.uploadStatusMessage.startsWith('Upload cancelled')) {
          newUploadStatusMessageToShow = `Your files are being uploaded, wait a few minutes.`;
        }
        // If upload is already in a terminal state, newUploadStatusMessageToShow remains as current this.uploadStatusMessage,
        // effectively ignoring this specific "Completed: [filename]" status update.
      } else {
        // For other status messages, allow them.
        newUploadStatusMessageToShow = messageStr;
      }
    } else if (event.type === 'finalized' && event.message) {
      newUploadStatusMessageToShow = String(event.message); // e.g., "Batch finalized successfully."
      this.uploadProgressDetails.etaFormatted = '00:00';
      this.uploadProgressDetails.speedMBps = 0;
    } else if (event.type === 'error' && event.message) {
      this.handleBatchUploadError(String(event.message));
      return; // handleBatchUploadError calls cdRef.detectChanges()
    }

    // Only update the class property if the determined message is different
    if (this.uploadStatusMessage !== newUploadStatusMessageToShow) {
      this.uploadStatusMessage = newUploadStatusMessageToShow;
    }

    this.cdRef.detectChanges();
  }

  private async streamFileWithFetch(item: SelectedItem, batchId: string): Promise<void> {
    const apiUrl = this.apiService.getApiBaseUrl(); const authToken = this.authService.getToken();
    const url = `${apiUrl}/upload/stream?batch_id=${batchId}&filename=${encodeURIComponent(item.name)}&auth_token=${authToken || ''}`;
    try {
      const res = await fetch(url, { method: 'POST', body: item.file });
      if (!res.ok) { const errTxt = await res.text(); try { throw new Error(JSON.parse(errTxt).error || `Server responded with status ${res.status}`); } catch { throw new Error(errTxt || `Server responded with status ${res.status}`); } }
    } catch (err) { console.error(`Error streaming file ${item.name}:`, err); throw err; }
  }

  private updateOverallProgress(bytesSent: number): void {
    const totalBytes = this.uploadProgressDetails.totalBytes;
    if (totalBytes === 0) this.uploadProgressDetails.percentage = this.isUploading ? 0 : 100;
    else { const effSent = Math.min(bytesSent, totalBytes); 
    this.uploadProgressDetails.percentage = Math.min((effSent / totalBytes) * 100, 100); }
    this.uploadProgressDetails.bytesSent = bytesSent;
    // this.uploadProgress = this.uploadProgressDetails.percentage;
    this.cdRef.detectChanges();
  }

  onAllUploadsComplete(finalData: FinalizeBatchResponse): void {
    this.zone.run(() => {
      this.isUploading = false; this.uploadStatusMessage = "Transfer complete!";
      if (!this.authService.isLoggedIn()) { this.anonymousUploadLimitMessage = "Your file has been uploaded. It will be available for 5 days. Please log in or sign up for longer storage and more features."; this.uploadSuccessMessage = null; }
      else { this.uploadSuccessMessage = "Your files have been successfully uploaded."; this.anonymousUploadLimitMessage = null; }
      this.shareableLinkForPanel = finalData.download_url; this.completedBatchAccessId = finalData.access_id;
      this.updateOverallProgress(this.uploadProgressDetails.totalBytes);
      this.uploadProgressDetails.speedMBps = 0; this.uploadProgressDetails.etaFormatted = '00:00';
      // if (this.currentItemBeingUploaded) this.currentItemBeingUploaded.name = this.selectedItems.length > 1 ? `${this.selectedItems.length} files uploaded` : (this.selectedItems.length === 1 ? this.selectedItems[0].name : 'Upload complete');
      if (this.currentUser) this.uploadEventService.notifyUploadComplete();
      this.cdRef.detectChanges();
    });
  }
  handleNewTransferRequest(): void { this.resetUploadState(); this.cdRef.detectChanges(); }
  private handleBatchUploadError(errorMessage: string, errorEvent?: any): void {
    if (errorEvent) console.error("Error during batch upload:", errorMessage, errorEvent); else console.error("Error during batch upload:", errorMessage);
    this.zone.run(() => {
      this.uploadError = errorMessage; this.isUploading = false; this.uploadStatusMessage = 'Upload Failed';
      this.uploadProgressDetails.speedMBps = 0; this.uploadProgressDetails.etaFormatted = '--:--';
      this.progressSubscription?.unsubscribe(); this.progressSubscription = null; this.cdRef.detectChanges();
    });
  }
  handleCancelUpload(): void {
    if (!this.isUploading) return;
    this.progressSubscription?.unsubscribe(); this.progressSubscription = null; this.isUploading = false;
    this.uploadStatusMessage = `Upload cancelled.`; this.uploadError = null;
    this.uploadProgressDetails.speedMBps = 0; this.uploadProgressDetails.etaFormatted = '--:--';
    // Optionally keep partial progress:
    // this.uploadProgressDetails.bytesSent = this.uploadProgressDetails.bytesSent; 
    // this.uploadProgressDetails.percentage = this.uploadProgressDetails.percentage;
    // Or reset fully:
    this.uploadProgressDetails.bytesSent = 0;
    this.uploadProgressDetails.percentage = 0;
    // this.uploadProgress = 0;

    // this.currentItemBeingUploaded = null; 
    this.cdRef.detectChanges();
  }
  handleItemRemovedFromPanel(itemOrUndefined: SelectedItem | undefined): void {
    if (this.isUploading) { alert("Cannot remove items during upload. Please cancel the upload first."); return; }
    if (itemOrUndefined) { this.selectedItems = this.selectedItems.filter(i => i.id !== itemOrUndefined.id); if (this.selectedItems.length === 0) this.handleNewTransferRequest(); }
    else this.handleNewTransferRequest();
    this.updatePlayGamesButtonVisibility(); this.cdRef.detectChanges();
  }
  toggleGamePanel(): void { this.isGamePanelVisible = !this.isGamePanelVisible; }
  closeGamePanel(): void { this.isGamePanelVisible = false; }
  handleDownloadRequest(itemToDownload: SelectedItem): void {
    if (this.isUploading) return; try {
      if (!(itemToDownload.file instanceof File)) { if (itemToDownload.id === -1 && this.shareableLinkForPanel) alert("This represents the completed batch. To download, use the generated shareable link. Individual file download from this panel is for pre-upload items."); else alert("Cannot download this item locally. It might be a folder representation or an item from a completed transfer without a local file reference."); return; }
      const link = document.createElement('a'); const url = URL.createObjectURL(itemToDownload.file); link.href = url; link.download = itemToDownload.file.name; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
    } catch (err) { console.error("Error initiating local file download:", err); alert("Could not initiate local file download."); }
  }
  async handleDataTransferItemsDropped(items: DataTransferItemList | null): Promise<void> {
    if (!this.isReceptiveToNewFiles()) { console.log('HomeComponent: Drop ignored.'); return; }
    if (!items) { console.log('HomeComponent: No DataTransferItems received.'); return; }
    if (this.selectedItems.length > 0 || this.shareableLinkForPanel) this.resetUploadState();
    this.uploadError = null;
    try {
      let wasDirDropped = false; for (let i = 0; i < items.length; i++) { const item = items[i]; if (typeof item.webkitGetAsEntry === 'function') { const entry = item.webkitGetAsEntry(); if (entry?.isDirectory) { wasDirDropped = true; break; } } }
      const files = await this.extractFilesFromDataTransferItems(items);
      if (files.length > 0) this.handleFiles(this.createFileListFromArray(files), wasDirDropped || files.some(f => f.webkitRelativePath?.includes('/')));
      else if (wasDirDropped) { this.handleFiles(this.createFileListFromArray([]), true); }
      else console.log('HomeComponent: No files extracted.');
    } catch (err) { console.error('HomeComponent: Error processing dropped items:', err); this.uploadError = "Error processing dropped items."; }
    finally { this.cdRef.detectChanges(); }
  }
  private isReceptiveToNewFiles(): boolean { return !this.isUploading; }
  private async extractFilesFromDataTransferItems(items: DataTransferItemList): Promise<File[]> {
    const filesAcc: File[] = []; const promises: Promise<void>[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i]; if (item.kind !== 'file') continue;
      if (typeof item.webkitGetAsEntry === 'function') { const entry = item.webkitGetAsEntry(); if (entry) promises.push(this.traverseFileSystemEntry(entry, filesAcc)); else { const file = item.getAsFile(); if (file && !file.name.toLowerCase().endsWith('.ds_store') && (file.size > 0 || file.type !== '')) filesAcc.push(file); } }
      else { const file = item.getAsFile(); if (file && !file.name.toLowerCase().endsWith('.ds_store') && (file.size > 0 || file.type !== '')) filesAcc.push(file); }
    } await Promise.all(promises); return filesAcc.filter(f => f instanceof File);
  }
  private async traverseFileSystemEntry(entry: FileSystemEntry, filesAcc: File[]): Promise<void> {
    return new Promise<void>((resolve) => {
      if (entry.isFile) {
        (entry as FileSystemFileEntry).file((file) => { if (file.name.toLowerCase().endsWith('.ds_store')) { resolve(); return; } if (entry.fullPath && !Object.prototype.hasOwnProperty.call(file, 'webkitRelativePath')) try { Object.defineProperty(file, 'webkitRelativePath', { value: entry.fullPath.startsWith('/') ? entry.fullPath.substring(1) : entry.fullPath, writable: false, enumerable: true }); } catch (e) { console.warn("Could not set webkitRelativePath", e); } filesAcc.push(file); resolve(); }, (err) => { console.error(`Error reading file ${entry.fullPath || entry.name}:`, err); resolve(); });
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader(); const readAll = async () => { let allSub: FileSystemEntry[] = []; const readBatch = (): Promise<FileSystemEntry[]> => new Promise((res, rej) => reader.readEntries(b => res(b), e => rej(e))); try { let batch: FileSystemEntry[]; do { batch = await readBatch(); allSub = allSub.concat(batch); } while (batch.length > 0); const subPromises = allSub.map(subEntry => this.traverseFileSystemEntry(subEntry, filesAcc)); await Promise.all(subPromises); resolve(); } catch (dirErr) { console.error(`Error reading dir ${entry.fullPath || entry.name}:`, dirErr); resolve(); } }; readAll();
      } else { console.warn(`Skipping unknown entry: ${entry.name}`); resolve(); }
    });
  }
  private createFileListFromArray(files: File[]): FileList {
    const dt = new DataTransfer(); if (files?.length) files.forEach(f => { if (f instanceof File) dt.items.add(f); else console.warn("Not a File:", f); }); return dt.files;
  }
  getFileIcon(filename: string | undefined): string {
    if (!filename) return 'fas fa-question-circle'; const isPath = filename.includes('/');
    const baseName = isPath ? filename.substring(filename.lastIndexOf('/') + 1) : filename;
    if (isPath && (baseName === '' || !baseName.includes('.'))) return 'fas fa-folder';
    if (!baseName.includes('.') && !isPath) return 'fas fa-file';
    if (isPath && !baseName.includes('.')) return 'fas fa-folder';
    const ext = baseName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'fas fa-file-pdf text-danger'; case 'doc': case 'docx': return 'fas fa-file-word text-primary';
      case 'xls': case 'xlsx': return 'fas fa-file-excel text-success'; case 'ppt': case 'pptx': return 'fas fa-file-powerpoint text-warning';
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