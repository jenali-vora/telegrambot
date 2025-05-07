// src/app/component/home/home.component.ts
import { Component, inject, ViewChild, ElementRef, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common'; // DatePipe still imported here
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService, User } from '../../shared/services/auth.service';
import {
  FileManagerApiService,
  InitiateUploadResponse,
  TelegramFileMetadata
} from '../../shared/services/file-manager-api.service';
import { TransferPanelComponent, SelectedItem } from '../transfer-panel/transfer-panel.component';
import { FaqAccordionComponent } from '../faq-accordion/faq-accordion.component';
import { CtaSectionComponent } from '../cta-section/cta-section.component';
import { UploadProgressItemComponent } from '../upload-progress-item/upload-progress-item.component';
import { ByteFormatPipe } from '../../shared/pipes/byte-format.pipe';

interface UploadProgressDetails {
  percentage: number;
  bytesSent: number;
  totalBytes: number;
  speedMBps: number;
  etaFormatted: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule, // Keep for ngIf, ngFor, etc., and template pipes
    RouterLink,
    TransferPanelComponent,
    FaqAccordionComponent,
    CtaSectionComponent,
    UploadProgressItemComponent,
    ByteFormatPipe // Assuming ByteFormatPipe is standalone or provided elsewhere if injected
    // DatePipe is NOT needed in imports if CommonModule is already there AND you're providing it below
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  providers: [DatePipe] // <<< --- ADD THIS LINE ---
})
// src/app/component/home/home.component.ts
// ... (imports and other parts of the component) ...

export class HomeComponent implements OnInit, OnDestroy {
  // ... (existing properties) ...

  // NEW getter for total size of displayedFiles
  get totalUploadedSize(): number {
    return this.displayedFiles.reduce((acc, file) => acc + (file.original_size || 0), 0);
  }

  // ... (rest of the component code from previous correct answer) ...
  // Make sure loadFilesForLoggedInUser, requestFileDownload, requestFileDelete,
  // formatUploadDate, and getFileIcon methods are present as before.

  // ... (full component code as provided in the previous answer that fixed DatePipe error
  //      and introduced the two-column layout for the hero section) ...
  private router = inject(Router); // Keep if used, if not, can be removed from here
  private authService = inject(AuthService);
  private apiService = inject(FileManagerApiService);
  private zone = inject(NgZone);
  private cdRef = inject(ChangeDetectorRef);
  private datePipe = inject(DatePipe);

  @ViewChild('fileInputForStart') fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('folderInputForStart') folderInputRef!: ElementRef<HTMLInputElement>;

  currentUser: User | null = null;
  username: string = '';

  isUploading: boolean = false;
  uploadError: string | null = null;
  isDragging = false;
  selectedItems: SelectedItem[] = [];
  shareableLinkForPanel: string | null = null;
  currentItemBeingUploaded: SelectedItem | null = null;
  currentUploadId: string | null = null;

  displayedFiles: TelegramFileMetadata[] = [];
  isLoadingFiles: boolean = false;
  fileListError: string | null = null;

  private eventSource: EventSource | null = null;
  uploadStatusMessage: string = '';
  uploadProgressDetails: UploadProgressDetails = {
    percentage: 0, bytesSent: 0, totalBytes: 0, speedMBps: 0, etaFormatted: '--:--',
  };
  uploadProgress: number = 0;

  private nextItemId = 0;
  private authSubscription: Subscription | null = null;

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
        const userJustChanged = this.currentUser?.email !== user?.email || (!this.currentUser && user) || (this.currentUser && !user);
        this.currentUser = user;
        this.username = this.currentUser?.username || this.currentUser?.email || '';

        if (userJustChanged) {
          console.log('HomeComponent: User context changed to:', this.username || 'Anonymous');
          if (this.currentUser && this.username) {
            this.loadFilesForLoggedInUser();
          } else {
            this.displayedFiles = [];
            this.isLoadingFiles = false;
            this.fileListError = null;
          }
        } else if (this.currentUser && this.username && this.displayedFiles.length === 0 && !this.isLoadingFiles) {
          this.loadFilesForLoggedInUser();
        }
        this.cdRef.detectChanges();
      });
    });
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.closeEventSource();
  }

  loadFilesForLoggedInUser(): void {
    if (!this.currentUser || !this.username) {
      this.displayedFiles = []; this.isLoadingFiles = false; return;
    }
    console.log(`Loading files for user: ${this.username}`);
    this.isLoadingFiles = true; this.fileListError = null; this.displayedFiles = [];
    this.cdRef.detectChanges();
    this.apiService.listFiles(this.username).subscribe({
      next: (files) => this.zone.run(() => {
        this.displayedFiles = files; this.isLoadingFiles = false;
        console.log(`Loaded ${files.length} files for ${this.username}.`); this.cdRef.detectChanges();
      }),
      error: (err) => this.zone.run(() => {
        this.fileListError = `Failed to load files: ${err.message}`; this.isLoadingFiles = false;
        console.error("Error loading files:", err); this.cdRef.detectChanges();
      })
    });
  }

  triggerFileInput(): void { if (this.isUploading || this.selectedItems.length > 0) return; this.fileInputRef?.nativeElement.click(); }
  triggerFolderInput(): void { if (this.isUploading || this.selectedItems.length > 0) return; this.folderInputRef?.nativeElement.click(); }
  onFileSelected(event: Event): void { const input = event.target as HTMLInputElement; if (input.files?.length) this.handleFiles(input.files); input.value = ''; }
  onFolderSelected(event: Event): void { const input = event.target as HTMLInputElement; if (input.files?.length) this.handleFiles(input.files, true); input.value = ''; }
  onDragOver(event: DragEvent): void { if (this.selectedItems.length > 0 || this.isUploading) { if (event.dataTransfer) event.dataTransfer.dropEffect = 'none'; event.preventDefault(); event.stopPropagation(); return; } event.preventDefault(); event.stopPropagation(); this.isDragging = true; if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'; }
  onDragLeave(event: DragEvent): void { event.preventDefault(); event.stopPropagation(); const target = event.currentTarget as HTMLElement; const relatedTarget = event.relatedTarget as Node; if (!relatedTarget || !target.contains(relatedTarget)) this.isDragging = false; }
  onDrop(event: DragEvent): void { if (this.selectedItems.length > 0 || this.isUploading) { event.preventDefault(); event.stopPropagation(); this.isDragging = false; return; } event.preventDefault(); event.stopPropagation(); this.isDragging = false; const files = event.dataTransfer?.files; if (files && files.length > 0) this.handleFiles(files); }
  handleFiles(fileList: FileList, isFolderContent: boolean = false): void { if (this.isUploading) { alert("Wait for current upload or cancel it."); return; } this.uploadError = null; this.shareableLinkForPanel = null; if (!fileList || fileList.length === 0) return; const newItems: SelectedItem[] = []; for (let i = 0; i < fileList.length; i++) { const file = fileList[i]; const name = isFolderContent && file.webkitRelativePath ? file.webkitRelativePath : file.name; if (file.size === 0 && !isFolderContent) continue; newItems.push({ id: this.nextItemId++, file, name, size: file.size, icon: this.getFileIcon(name), isFolder: isFolderContent || (name !== file.name && name.includes('/')) }); } this.zone.run(() => { this.selectedItems = newItems.length > 0 ? [...newItems] : []; this.cdRef.detectChanges(); }); }

  initiateTransferFromPanel(): void {
    if (this.isUploading || this.selectedItems.length === 0) return;
    const itemsToUpload = this.selectedItems;
    this.isUploading = true; this.uploadError = null;
    this.uploadProgressDetails = { percentage: 0, bytesSent: 0, totalBytes: 0, speedMBps: 0, etaFormatted: '--:--' };
    this.uploadProgress = 0; this.uploadStatusMessage = 'Initiating...';
    this.shareableLinkForPanel = null; this.closeEventSource();
    this.currentItemBeingUploaded = itemsToUpload[0]; this.currentUploadId = null;
    this.cdRef.detectChanges();
    const formData = new FormData();
    formData.append('file', itemsToUpload[0].file, itemsToUpload[0].file.name);
    if (this.currentUser && this.username) formData.append('username', this.username);

    this.apiService.initiateUpload(formData).subscribe({
      next: (res: InitiateUploadResponse) => {
        if (res.upload_id) { this.currentUploadId = res.upload_id; this.listenToUploadProgress(res.upload_id, itemsToUpload[0]); }
        else this.handleUploadError('Server did not return a valid upload ID.');
      },
      error: (err: Error) => this.handleUploadError(`Failed to initiate upload: ${err.message}`)
    });
  }

  private listenToUploadProgress(uploadId: string, uploadedItemRepresentation: SelectedItem): void {
    const apiUrl = this.apiService.getApiBaseUrl();
    const url = `${apiUrl}/stream-progress/${uploadId}`;
    try {
      this.eventSource = new EventSource(url);
      this.eventSource.onopen = () => this.zone.run(() => { this.uploadStatusMessage = 'Connected...'; this.cdRef.detectChanges(); });
      this.eventSource.addEventListener('start', (event) => this.zone.run(() => { const data = JSON.parse((event as MessageEvent).data); if (data.totalSize) this.uploadProgressDetails.totalBytes = data.totalSize; this.uploadProgressDetails.percentage = 0; this.cdRef.detectChanges(); }));
      this.eventSource.addEventListener('status', (event) => this.zone.run(() => { const data = JSON.parse((event as MessageEvent).data); this.uploadStatusMessage = data.message || 'Processing...'; this.cdRef.detectChanges(); }));
      this.eventSource.addEventListener('progress', (event) => this.zone.run(() => { const data = JSON.parse((event as MessageEvent).data); this.uploadProgressDetails = { percentage: Math.round(data.percentage || 0), bytesSent: data.bytesSent || 0, totalBytes: data.totalBytes || this.uploadProgressDetails.totalBytes, speedMBps: data.speedMBps || 0, etaFormatted: data.etaFormatted || '--:--' }; this.uploadProgress = this.uploadProgressDetails.percentage; this.cdRef.detectChanges(); }));
      this.eventSource.addEventListener('complete', (event) => this.zone.run(() => {
        const data = JSON.parse((event as MessageEvent).data);
        this.uploadStatusMessage = data.message || 'Upload complete!';
        this.shareableLinkForPanel = data.download_url || null;
        this.uploadProgress = 100; this.isUploading = false;
        if (this.currentUser && this.username) this.loadFilesForLoggedInUser();
        else console.log("Anonymous upload complete. Link in panel.");
        this.currentItemBeingUploaded = null; this.currentUploadId = null; this.selectedItems = [];
        this.closeEventSource(); this.cdRef.detectChanges();
      }));
      this.eventSource.onerror = (event: MessageEvent | Event) => { let err = 'Upload error.'; if (event instanceof MessageEvent && event.data) { try { const d = JSON.parse(event.data); err = d.message || 'Server error.'; } catch (e) { err = 'Unrecognised err.'; } } else if (this.isUploading) err = 'Connection lost.'; if (this.isUploading || (event instanceof MessageEvent && event.data)) this.handleUploadError(err); else this.closeEventSource(); };
    } catch (error) { this.handleUploadError('Could not connect to upload progress server.'); }
  }

  private handleUploadError(errorMessage: string): void { this.zone.run(() => { this.uploadError = errorMessage; this.isUploading = false; this.uploadProgressDetails = { percentage: 0, bytesSent: 0, totalBytes: this.uploadProgressDetails.totalBytes, speedMBps: 0, etaFormatted: '--:--' }; this.uploadProgress = 0; this.uploadStatusMessage = 'Upload Failed'; this.currentItemBeingUploaded = null; this.currentUploadId = null; this.closeEventSource(); this.cdRef.detectChanges(); }); }
  handleCancelUpload(): void { if (this.currentItemBeingUploaded && this.currentUploadId) this.handleUploadError('Upload cancelled.'); else { this.isUploading = false; this.currentItemBeingUploaded = null; this.currentUploadId = null; this.closeEventSource(); this.cdRef.detectChanges(); } }
  private closeEventSource(): void { if (this.eventSource) { this.eventSource.close(); this.eventSource = null; } }
  removeItemFromPanel(): void { if (this.isUploading) { alert("Cannot remove items during upload."); return; } this.shareableLinkForPanel = null; this.selectedItems = []; this.cdRef.detectChanges(); }
  handleDownloadRequest(itemToDownload: SelectedItem): void { if (this.isUploading) return; try { const link = document.createElement('a'); const url = URL.createObjectURL(itemToDownload.file); link.href = url; link.download = itemToDownload.file.name; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); } catch (error) { alert("Could not initiate local file download."); } }

  requestFileDownload(file: TelegramFileMetadata): void {
    if (!file.access_id) { alert("Error: Download link info missing."); return; }
    const downloadPageUrl = `${this.apiService.getApiBaseUrl()}/get/${file.access_id}`;
    window.open(downloadPageUrl, '_blank');
  }

  requestFileDelete(file: TelegramFileMetadata): void {
    if (!this.currentUser || !this.username) { console.warn("Delete attempted while not logged in."); return; }
    if (!confirm(`Delete "${file.original_filename}"? This cannot be undone.`)) return;
    this.fileListError = null;
    this.apiService.deleteFileRecord(this.username, file.original_filename).subscribe({
      next: (response) => this.zone.run(() => { console.log("Delete successful:", response.message); this.loadFilesForLoggedInUser(); this.cdRef.detectChanges(); }),
      error: (err) => this.zone.run(() => { this.fileListError = `Failed to delete: ${err.message}`; console.error("Error deleting:", err); this.cdRef.detectChanges(); })
    });
  }

  formatUploadDate(timestamp: string | Date | undefined): string { if (!timestamp) return 'N/A'; try { return this.datePipe.transform(timestamp, 'yyyy-MM-dd HH:mm') || 'Invalid Date'; } catch (e) { return 'Invalid Date'; } }
  startTransfer(): void { this.triggerFileInput(); }
  getFileIcon(filename: string | undefined): string { if (!filename) return 'fas fa-question-circle'; const baseName = filename.includes('/') ? filename.substring(filename.lastIndexOf('/') + 1) : filename; if (!baseName.includes('.')) return filename.includes('/') ? 'fas fa-folder' : 'fas fa-file'; const extension = baseName.split('.').pop()?.toLowerCase(); switch (extension) { case 'pdf': return 'fas fa-file-pdf text-danger'; case 'doc': case 'docx': return 'fas fa-file-word text-primary'; case 'xls': case 'xlsx': return 'fas fa-file-excel text-success'; case 'ppt': case 'pptx': return 'fas fa-file-powerpoint text-warning'; case 'zip': case 'rar': case '7z': case 'gz': case 'tar': return 'fas fa-file-archive text-secondary'; case 'txt': case 'md': case 'log': return 'fas fa-file-alt text-info'; case 'jpg': case 'jpeg': case 'png': case 'gif': case 'bmp': case 'svg': case 'webp': return 'fas fa-file-image text-purple'; case 'mp3': case 'wav': case 'ogg': case 'aac': case 'flac': return 'fas fa-file-audio text-orange'; case 'mp4': case 'mov': case 'avi': case 'mkv': case 'wmv': case 'webm': return 'fas fa-file-video text-teal'; case 'js': return 'fab fa-js-square text-warning'; case 'ts': return 'fas fa-file-code text-primary'; case 'json': return 'fas fa-file-code text-success'; case 'html': return 'fab fa-html5 text-danger'; case 'css': case 'scss': case 'sass': return 'fab fa-css3-alt text-info'; case 'py': return 'fab fa-python text-primary'; case 'java': return 'fab fa-java text-danger'; case 'c': case 'cpp': case 'cs': case 'go': case 'php': case 'rb': case 'sh': return 'fas fa-file-code text-secondary'; default: return 'fas fa-file text-muted'; } }
}