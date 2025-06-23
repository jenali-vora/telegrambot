// frontend/src/app/features/home/home.component.ts
import { Component, inject, ViewChild, ElementRef, OnInit, OnDestroy, NgZone, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { AuthService, User } from '../../shared/services/auth.service';
import { FileManagerApiService, FinalizeBatchResponse } from '../../shared/services/file-manager-api.service';
import { SelectedItem } from '../transfer-panel/transfer-panel.component';
import { FaqAccordionComponent } from '../faq-accordion/faq-accordion.component';
import { UploadEventService } from '../../shared/services/upload-event.service';
import { OrbitalDisplayComponent } from '@app/shared/component/orbital-display/orbital-display.component';
import { ScrollAnimationDirective } from '@app/shared/directives/scroll-animation.directive';
import { GamesComponent } from '@app/shared/component/games/games.component';

interface UploadProgressDetails { percentage: number; bytesSent: number; totalBytes: number; speedMBps: number; etaFormatted: string; }

@Component({
  selector: 'app-home', standalone: true,
  imports: [CommonModule, RouterLink, FaqAccordionComponent, OrbitalDisplayComponent, ScrollAnimationDirective, GamesComponent],
  templateUrl: './home.component.html', styleUrls: ['./home.component.css'], providers: [DatePipe]
})
export class HomeComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService); private apiService = inject(FileManagerApiService); private zone = inject(NgZone);
  private cdRef = inject(ChangeDetectorRef); private uploadEventService = inject(UploadEventService);
  @ViewChild('fileInputForStart') fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('folderInputForStart') folderInputRef!: ElementRef<HTMLInputElement>;

  currentUser: User | null = null; username: string = ''; isUploading: boolean = false; uploadError: string | null = null;
  uploadSuccessMessage: string | null = null; selectedItems: SelectedItem[] = []; userFileCount: number = 0;
  isLoadingUserFileCount: boolean = false; uploadStatusMessage: string = '';
  uploadProgressDetails: UploadProgressDetails = { percentage: 0, bytesSent: 0, totalBytes: 0, speedMBps: 0, etaFormatted: '--:--' };
  completedBatchAccessId: string | null = null; shareableLinkForPanel: string | null = null; showPlayGamesButton: boolean = false;
  private previousShowPlayGamesButtonState: boolean = false; isGamePanelVisible: boolean = false;
  anonymousUploadLimitMessage: string | null = null; private readonly ONE_GIGABYTE_IN_BYTES = 1073741824;
  private readonly FIVE_GIGABYTES_IN_BYTES = 5368709120; private anonymousFolderUploadsCount = 0;
  private readonly MAX_ANONYMOUS_FOLDER_UPLOADS = 5; private nextItemId = 0;
  private authSubscription: Subscription | null = null; private progressSubscription: Subscription | null = null;
  private uploadStartTime: number = 0; private dragEnterCounter = 0;

  transferList = [{ img: "assets/image/secure.svg", title: "Secure file transfer", des: "Send and share large files quickly and securely via email or shareable links from any device." }, { img: "assets/image/sendFile.svg", title: "Send large files up to 250 GB", des: "Transfer large files available up to 365 days before automatic erasure from our servers." }, { img: "assets/image/track.svg", title: "Track sent files & manage transfers", des: "Use our dashboard to track downloads, modify transfers, re-transfer, or erase before expiration." }, { img: "assets/image/download (2).svg", title: "Integrate widget for file reception", des: "Use our form generator to receive files on your account; integrate with simple HTML." }];
  redisterdUser = [{ icon: 'assets/image/rg-i.png', title: 'Registered users', count: '35,000' }, { icon: 'assets/image/upload-files-img1.png', title: 'Uploaded files', count: '1,90,000' }];
  private iconMap: { [k: string]: string } = { pdf: 'fas fa-file-pdf text-danger', doc: 'fas fa-file-word text-primary', docx: 'fas fa-file-word text-primary', xls: 'fas fa-file-excel text-success', xlsx: 'fas fa-file-excel text-success', ppt: 'fas fa-file-powerpoint text-warning', pptx: 'fas fa-file-powerpoint text-warning', zip: 'fas fa-file-archive text-secondary', rar: 'fas fa-file-archive text-secondary', '7z': 'fas fa-file-archive text-secondary', gz: 'fas fa-file-archive text-secondary', tar: 'fas fa-file-archive text-secondary', txt: 'fas fa-file-alt text-info', md: 'fas fa-file-alt text-info', log: 'fas fa-file-alt text-info', jpg: 'fas fa-file-image text-purple', jpeg: 'fas fa-file-image text-purple', png: 'fas fa-file-image text-purple', gif: 'fas fa-file-image text-purple', bmp: 'fas fa-file-image text-purple', svg: 'fas fa-file-image text-purple', webp: 'fas fa-file-image text-purple', mp3: 'fas fa-file-audio text-orange', wav: 'fas fa-file-audio text-orange', ogg: 'fas fa-file-audio text-orange', aac: 'fas fa-file-audio text-orange', flac: 'fas fa-file-audio text-orange', mp4: 'fas fa-file-video text-teal', mov: 'fas fa-file-video text-teal', avi: 'fas fa-file-video text-teal', mkv: 'fas fa-file-video text-teal', wmv: 'fas fa-file-video text-teal', webm: 'fas fa-file-video text-teal', html: 'fas fa-file-code text-info', htm: 'fas fa-file-code text-info', js: 'fas fa-file-code text-info', css: 'fas fa-file-code text-info', ts: 'fas fa-file-code text-info', py: 'fas fa-file-code text-info', java: 'fas fa-file-code text-info', cs: 'fas fa-file-code text-info' };

  @HostListener('window:beforeunload', ['$event']) handleBeforeUnload(event: BeforeUnloadEvent): void {
    const msg = this.isUploading ? "Leaving will cancel your upload. Proceed?" : (this.selectedItems.length > 0 && !this.shareableLinkForPanel ? "File selection will be lost. Continue?" : "");
    if (msg) { event.preventDefault(); event.returnValue = msg; }
  }
  ngOnInit(): void {
    this.authSubscription = this.authService.currentUser$.subscribe(user => this.zone.run(() => {
      const wasLoggedIn = !!this.currentUser; this.currentUser = user; this.username = user?.username || user?.email || '';
      if (!user && wasLoggedIn || (user && wasLoggedIn && this.currentUser && user.email !== this.currentUser.email)) this.resetUploadState();
      else if (!!user && !wasLoggedIn) { this.anonymousFolderUploadsCount = 0; this.anonymousUploadLimitMessage = null; }
      if (this.currentUser && this.username) this.loadUserFileCount(); else { this.userFileCount = 0; this.isLoadingUserFileCount = false; }
      this.cdRef.detectChanges();
    }));
    this.currentUser = this.authService.currentUserValue; this.username = this.currentUser?.username || this.currentUser?.email || '';
    if (this.currentUser && this.username) this.loadUserFileCount();
  }
  ngOnDestroy(): void { this.authSubscription?.unsubscribe(); this.progressSubscription?.unsubscribe(); }

  private resetUploadState(): void {
    this.isUploading = false; this.uploadError = null; this.uploadSuccessMessage = null; this.selectedItems = [];
    this.shareableLinkForPanel = null; this.completedBatchAccessId = null; this.uploadStatusMessage = '';
    this.uploadProgressDetails = { percentage: 0, bytesSent: 0, totalBytes: 0, speedMBps: 0, etaFormatted: '--:--' };
    this.nextItemId = 0; this.anonymousUploadLimitMessage = null; this.anonymousFolderUploadsCount = 0;
    this.isGamePanelVisible = false; this.dragEnterCounter = 0; this.uploadStartTime = 0;
    if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = '';
    if (this.folderInputRef?.nativeElement) this.folderInputRef.nativeElement.value = '';
    this.progressSubscription?.unsubscribe(); this.progressSubscription = null; this.updatePlayGamesButtonVisibility();
  }
  private updatePlayGamesButtonVisibility(): void {
    const totalSize = this.selectedItems.reduce((sum, item) => sum + item.size, 0);
    const newState = totalSize >= this.ONE_GIGABYTE_IN_BYTES;
    if (newState && !this.previousShowPlayGamesButtonState) new Audio('assets/audio/new-notification-3-323602.mp3').play().catch(e => console.warn("Sound fail:", e));
    this.showPlayGamesButton = newState; this.previousShowPlayGamesButtonState = newState;
    if (!newState) this.isGamePanelVisible = false; this.cdRef.detectChanges();
  }
  loadUserFileCount(): void {
    if (!this.currentUser || !this.username) { this.userFileCount = 0; this.isLoadingUserFileCount = false; return; }
    this.isLoadingUserFileCount = true;
    this.apiService.listFiles(this.username).subscribe({
      next: (f) => this.zone.run(() => { this.userFileCount = f.length; this.isLoadingUserFileCount = false; this.cdRef.detectChanges(); }),
      error: (e) => this.zone.run(() => { console.error("File count error:", e); this.userFileCount = 0; this.isLoadingUserFileCount = false; this.cdRef.detectChanges(); })
    });
  }
  @HostListener('window:dragenter', ['$event']) onWindowDragEvent(event: DragEvent, type: 'enter' | 'over'): void { if (!event.dataTransfer) return; event.preventDefault(); event.stopPropagation(); if (type === 'enter') this.dragEnterCounter++; event.dataTransfer.dropEffect = (this.selectedItems.length > 0 || this.isUploading || this.shareableLinkForPanel) ? 'none' : 'copy'; }
  @HostListener('window:dragover', ['$event']) onWindowDragOver(event: DragEvent): void { this.onWindowDragEvent(event, 'over'); }
  @HostListener('window:dragleave', ['$event']) onWindowDragLeave(event: DragEvent): void { event.preventDefault(); event.stopPropagation(); this.dragEnterCounter--; if (this.dragEnterCounter <= 0) this.dragEnterCounter = 0; }
  @HostListener('window:drop', ['$event']) onWindowDrop(event: DragEvent): void { event.preventDefault(); event.stopPropagation(); this.dragEnterCounter = 0; }

  triggerFileInput(): void { if (this.isReceptiveToNewFiles()) this.fileInputRef?.nativeElement.click(); }
  triggerFolderInput(): void { if (this.isReceptiveToNewFiles()) this.folderInputRef?.nativeElement.click(); }

  private checkAnonLimits(isFolder: boolean, fileListLength: number, currentItems: SelectedItem[]): string | null {
    const F_LIMIT_ERR = `Max ${this.MAX_ANONYMOUS_FOLDER_UPLOADS} folders for anonymous. Login for more.`;
    const SIZE_LIMIT_ERR = `Max 5GB total for anonymous. Login or reduce selection.`;
    const ITEM_LIMIT_MSG = (type: string) => `Max ${this.MAX_ANONYMOUS_FOLDER_UPLOADS} ${type} for anonymous. Login for more.`;
    if (this.authService.isLoggedIn()) return null;
    if (isFolder && this.anonymousFolderUploadsCount >= this.MAX_ANONYMOUS_FOLDER_UPLOADS) return F_LIMIT_ERR;
    const currentSize = currentItems.reduce((s, i) => s + i.size, 0); const currentCount = currentItems.length;
    if (fileListLength > 0) { if (currentCount >= this.MAX_ANONYMOUS_FOLDER_UPLOADS) return ITEM_LIMIT_MSG(isFolder ? 'folder' : 'file'); if (currentSize >= this.FIVE_GIGABYTES_IN_BYTES) return SIZE_LIMIT_ERR; }
    return null;
  }
  handleFiles(fileList: FileList, isFolderSelection: boolean = false): void {
    if (this.isUploading) { alert("Wait for current upload or cancel it."); return; }
    if (this.shareableLinkForPanel || (this.selectedItems.length > 0 && fileList.length > 0 && this.selectedItems[0].id !== -2)) this.resetUploadState();
    [this.uploadError, this.uploadSuccessMessage, this.anonymousUploadLimitMessage] = [null, null, null];
    const F_LIMIT_INFO = `Max ${this.MAX_ANONYMOUS_FOLDER_UPLOADS} folders for anonymous. Login for more.`;
    const resetInputsAndDetectChanges = () => { if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = ''; if (this.folderInputRef?.nativeElement) this.folderInputRef.nativeElement.value = ''; this.cdRef.detectChanges(); };
    const limitError = this.checkAnonLimits(isFolderSelection, fileList.length, this.selectedItems);
    if (limitError) { this.uploadError = limitError; resetInputsAndDetectChanges(); return; }
    if (!fileList || fileList.length === 0) { if (isFolderSelection && !this.authService.isLoggedIn()) { if (this.anonymousFolderUploadsCount >= this.MAX_ANONYMOUS_FOLDER_UPLOADS) this.uploadError = F_LIMIT_INFO; else { this.anonymousFolderUploadsCount++; if (this.anonymousFolderUploadsCount >= this.MAX_ANONYMOUS_FOLDER_UPLOADS) this.anonymousUploadLimitMessage = F_LIMIT_INFO; } } resetInputsAndDetectChanges(); return; }
    const newItems: SelectedItem[] = []; let filesAdded = 0, sizeAdded = 0;
    const countBefore = this.selectedItems.length, sizeBefore = this.selectedItems.reduce((s, i) => s + i.size, 0);
    for (const file of Array.from(fileList)) {
      if (!this.authService.isLoggedIn()) {
        if ((countBefore + newItems.length) >= this.MAX_ANONYMOUS_FOLDER_UPLOADS) { if (!this.uploadError) this.uploadError = this.checkAnonLimits(isFolderSelection, fileList.length, this.selectedItems) || `As your not logged in, you can upload maximum 5 files or folder, Please login to upload more than 5 files or folder.`; break; }
        if ((sizeBefore + sizeAdded + file.size) > this.FIVE_GIGABYTES_IN_BYTES) { if (!this.uploadError) this.uploadError = this.checkAnonLimits(isFolderSelection, fileList.length, this.selectedItems) || `As you are not logged in, your total selection cannot exceed 5 GB. Please log in for larger uploads or reduce your selection.`; break; }
      }
      let itemName = file.webkitRelativePath && (file.webkitRelativePath !== file.name || isFolderSelection) ? file.webkitRelativePath : file.name;
      if ((file.size === 0 && !isFolderSelection && !itemName.includes('/')) || file.name.toLowerCase().endsWith('.ds_store')) continue;
      const isActualFolder = (isFolderSelection && !file.type && file.size === 0 && file.webkitRelativePath.endsWith(file.name)) || (itemName.includes('/') && !itemName.split('/').pop()?.includes('.'));
      newItems.push({ id: this.nextItemId++, file, name: itemName, size: file.size, icon: this.getFileIcon(itemName), isFolder: isActualFolder }); filesAdded++; sizeAdded += file.size;
    }
    if (newItems.length > 0) this.selectedItems = [...this.selectedItems, ...newItems];
    if (isFolderSelection && !this.authService.isLoggedIn() && (filesAdded > 0 || (fileList.length > 0 && newItems.length === 0 && !this.uploadError))) { if (this.anonymousFolderUploadsCount < this.MAX_ANONYMOUS_FOLDER_UPLOADS) { this.anonymousFolderUploadsCount++; if (this.anonymousFolderUploadsCount >= this.MAX_ANONYMOUS_FOLDER_UPLOADS && !this.uploadError) this.anonymousUploadLimitMessage = F_LIMIT_INFO; } else if (!this.uploadError && !this.anonymousUploadLimitMessage) this.anonymousUploadLimitMessage = F_LIMIT_INFO; }
    if (!this.authService.isLoggedIn() && filesAdded < fileList.length && !this.uploadError) { const finalLimitError = this.checkAnonLimits(isFolderSelection, 0, this.selectedItems); if (finalLimitError) this.uploadError = finalLimitError; }
    resetInputsAndDetectChanges(); this.updatePlayGamesButtonVisibility();
  }
  onFileSelected(event: Event): void { const i = event.target as HTMLInputElement; if (i.files?.length) this.handleFiles(i.files, false); }
  onFolderSelected(event: Event): void { const i = event.target as HTMLInputElement; if (i.files?.length) this.handleFiles(i.files, true); }

  private formatEta(s: number): string { if (isNaN(s) || s < 0 || !isFinite(s)) return '--:--'; const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60); return h > 0 ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`; }
   async initiateTransferFromPanel(): Promise<void> {
    if (this.isUploading || this.selectedItems.length === 0) return;
    this.isUploading = true;
    this.uploadError = null;
    this.uploadStartTime = Date.now();
    this.uploadProgressDetails.totalBytes = this.selectedItems.reduce((s, i) => s + (i.file?.size ?? 0), 0);
    [this.uploadProgressDetails.speedMBps, this.uploadProgressDetails.etaFormatted] = [0, '--:--'];
    this.updateOverallProgress(0);

    const isSingleFile = this.selectedItems.length === 1;
    const batchName = isSingleFile ? this.selectedItems[0].name : `Batch of ${this.selectedItems.length} files`;
    
    this.uploadStatusMessage = 'Initializing...';
    this.cdRef.detectChanges();

    try {
      // --- START OF THE FIX ---
      // Prepare the payload for the initiateBatch API call
      const initiateBatchPayload = {
        batch_display_name: batchName,
        total_original_size: this.uploadProgressDetails.totalBytes,
        is_batch: !isSingleFile
      };

      // If it's a single file, add the original_filename to the payload
      if (isSingleFile) {
        (initiateBatchPayload as any)['original_filename'] = this.selectedItems[0].name;
      }
      
      // Call the API with the constructed payload
      const { batch_id: batchId } = await firstValueFrom(this.apiService.initiateBatch(initiateBatchPayload));
      // --- END OF THE FIX ---

      let bytesUploadedSoFar = 0;

      // Subscribe to the progress stream
      this.progressSubscription = this.apiService.getUploadProgressStream(batchId).subscribe({
        next: (ev) => this.zone.run(() => this.handleProgressEvent(ev, bytesUploadedSoFar)),
        error: (er) => this.zone.run(() => this.handleBatchUploadError('Progress stream failed.', er))
      });

      // Loop through and upload each file
      for (const item of this.selectedItems) {
        if (!item.file) {
          if (item.size > 0) bytesUploadedSoFar += item.size;
          continue;
        }
        await this.streamFileWithFetch(item, batchId);
        bytesUploadedSoFar += item.file.size;
      }

      this.uploadStatusMessage = 'Finalizing...';
      this.cdRef.detectChanges();
      
      // Finalize the batch
      const finalizeResponse = await firstValueFrom(this.apiService.finalizeBatch(batchId));
      this.onAllUploadsComplete(finalizeResponse);

    } catch (err: any) {
      this.handleBatchUploadError(err.message || 'Upload process error.');
    } finally {
      // Unsubscribe from progress stream in the finally block
      this.progressSubscription?.unsubscribe();
      this.progressSubscription = null;
    }
  }
  private handleProgressEvent(event: any, bytesAlreadyUploadedForPreviousFiles: number): void {
    let newMsg = this.uploadStatusMessage;
    if (event.type === 'progress') {
      if (event.filename || newMsg === 'Initializing...') newMsg = `Uploading, please wait...`;
      const totalBatchSent = Number(event.total_batch_bytes_sent ?? (bytesAlreadyUploadedForPreviousFiles + (event.bytes_sent || 0)));
      this.updateOverallProgress(totalBatchSent); let eta = '--:--', speed = this.uploadProgressDetails.speedMBps;
      if (event.eta_seconds !== undefined && !isNaN(Number(event.eta_seconds)) && Number(event.eta_seconds) >= 0) eta = this.formatEta(Number(event.eta_seconds));
      else if (event.speed_mbps !== undefined) { const serverSpeed = parseFloat(event.speed_mbps); if (!isNaN(serverSpeed) && serverSpeed > 0) { speed = serverSpeed; if (this.uploadProgressDetails.totalBytes > 0 && totalBatchSent < this.uploadProgressDetails.totalBytes) eta = this.formatEta((this.uploadProgressDetails.totalBytes - totalBatchSent) / (speed * 1024 * 1024)); else if (totalBatchSent >= this.uploadProgressDetails.totalBytes && this.uploadProgressDetails.totalBytes > 0) eta = '00:00'; } else speed = 0; }
      else if (this.uploadStartTime > 0 && totalBatchSent > 0 && this.uploadProgressDetails.totalBytes > 0) { const elapsedS = (Date.now() - this.uploadStartTime) / 1000; if (elapsedS > 1) { const clientSpeedBps = totalBatchSent / elapsedS; if (clientSpeedBps > 0) { speed = clientSpeedBps / (1024 * 1024); const remBytes = this.uploadProgressDetails.totalBytes - totalBatchSent; eta = remBytes > 0 ? this.formatEta(remBytes / clientSpeedBps) : '00:00'; } } }
      if (this.uploadProgressDetails.percentage >= 99.9 && eta !== '00:00') eta = '00:00';
      [this.uploadProgressDetails.etaFormatted, this.uploadProgressDetails.speedMBps] = [eta, speed];
    } else if (event.type === 'status' && event.message) { const msgStr = String(event.message); if (!(msgStr.startsWith('Completed: ') && msgStr.length > 25 && this.isUploading && !['Finalizing...', 'Transfer complete!', 'Upload Failed', 'Upload cancelled'].includes(newMsg))) newMsg = msgStr; else newMsg = `Uploading, please wait...`; }
    else if (event.type === 'finalized' && event.message) { newMsg = String(event.message);[this.uploadProgressDetails.etaFormatted, this.uploadProgressDetails.speedMBps] = ['00:00', 0]; }
    else if (event.type === 'error' && event.message) { this.handleBatchUploadError(String(event.message)); return; }
    if (this.uploadStatusMessage !== newMsg) this.uploadStatusMessage = newMsg; this.cdRef.detectChanges();
  }
  private async streamFileWithFetch(item: SelectedItem, batchId: string): Promise<void> { const url = `${this.apiService.getApiBaseUrl()}/upload/stream?batch_id=${batchId}&filename=${encodeURIComponent(item.name)}&auth_token=${this.authService.getToken() || ''}`; try { const res = await fetch(url, { method: 'POST', body: item.file }); if (!res.ok) { const txt = await res.text(); try { throw new Error(JSON.parse(txt).error || `Server error ${res.status}`); } catch { throw new Error(txt || `Server error ${res.status}`); } } } catch (err) { console.error(`Error streaming ${item.name}:`, err); throw err; } }
  private updateOverallProgress(bytesSent: number): void { const total = this.uploadProgressDetails.totalBytes; this.uploadProgressDetails.percentage = total === 0 ? (this.isUploading ? 0 : 100) : Math.min((Math.min(bytesSent, total) / total) * 100, 100); this.uploadProgressDetails.bytesSent = bytesSent; this.cdRef.detectChanges(); }
  onAllUploadsComplete(finalData: FinalizeBatchResponse): void { this.zone.run(() => { this.isUploading = false; this.uploadStatusMessage = "Transfer complete!"; if (!this.authService.isLoggedIn()) { this.anonymousUploadLimitMessage = "File uploaded. Available for 5 days. Login for more features."; this.uploadSuccessMessage = null; } else { this.uploadSuccessMessage = "Files successfully uploaded."; this.anonymousUploadLimitMessage = null; } this.shareableLinkForPanel = finalData.download_url; this.completedBatchAccessId = finalData.access_id; this.updateOverallProgress(this.uploadProgressDetails.totalBytes);[this.uploadProgressDetails.speedMBps, this.uploadProgressDetails.etaFormatted] = [0, '00:00']; if (this.currentUser) this.uploadEventService.notifyUploadComplete(); this.cdRef.detectChanges(); }); }
  handleNewTransferRequest(): void { this.resetUploadState(); this.cdRef.detectChanges(); }
  private handleBatchUploadError(errorMessage: string, errorEvent?: any): void { console.error("Batch upload error:", errorMessage, errorEvent || ''); this.zone.run(() => { this.uploadError = errorMessage; this.isUploading = false; this.uploadStatusMessage = 'Upload Failed';[this.uploadProgressDetails.speedMBps, this.uploadProgressDetails.etaFormatted] = [0, '--:--']; this.progressSubscription?.unsubscribe(); this.progressSubscription = null; this.cdRef.detectChanges(); }); }
  handleCancelUpload(): void { if (!this.isUploading) return; this.progressSubscription?.unsubscribe(); this.progressSubscription = null; this.isUploading = false; this.uploadStatusMessage = `Upload cancelled.`; this.uploadError = null;[this.uploadProgressDetails.speedMBps, this.uploadProgressDetails.etaFormatted, this.uploadProgressDetails.bytesSent, this.uploadProgressDetails.percentage] = [0, '--:--', 0, 0]; this.cdRef.detectChanges(); }
  handleItemRemovedFromPanel(item?: SelectedItem): void { if (this.isUploading) { alert("Cannot remove during upload. Cancel first."); return; } if (item) this.selectedItems = this.selectedItems.filter(i => i.id !== item.id); if (!item || this.selectedItems.length === 0) this.handleNewTransferRequest(); this.updatePlayGamesButtonVisibility(); this.cdRef.detectChanges(); }
  toggleGamePanel(): void { this.isGamePanelVisible = !this.isGamePanelVisible; }
  closeGamePanel(): void { this.isGamePanelVisible = false; }
  handleDownloadRequest(item: SelectedItem): void { if (this.isUploading) return; if (!(item.file instanceof File)) { alert(item.id === -1 && this.shareableLinkForPanel ? "Use generated link for batch download." : "Cannot download locally."); return; } try { const link = document.createElement('a'); const url = URL.createObjectURL(item.file); link.href = url; link.download = item.file.name; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); } catch (err) { console.error("Local download error:", err); alert("Could not initiate local download."); } }
  async handleDataTransferItemsDropped(items: DataTransferItemList | null): Promise<void> { if (!this.isReceptiveToNewFiles() || !items) { console.log('Drop ignored or no items.'); return; } if (this.selectedItems.length > 0 || this.shareableLinkForPanel) this.resetUploadState(); this.uploadError = null; try { let wasDirDropped = Array.from(items).some(item => typeof item.webkitGetAsEntry === 'function' && item.webkitGetAsEntry()?.isDirectory); const files = await this.extractFilesFromDataTransferItems(items); if (files.length > 0) this.handleFiles(this.createFileListFromArray(files), wasDirDropped || files.some(f => f.webkitRelativePath?.includes('/'))); else if (wasDirDropped) this.handleFiles(this.createFileListFromArray([]), true); else console.log('No files extracted from drop.'); } catch (err) { console.error('Drop processing error:', err); this.uploadError = "Error processing dropped items."; } finally { this.cdRef.detectChanges(); } }
  private isReceptiveToNewFiles(): boolean { return !this.isUploading; }
  private async extractFilesFromDataTransferItems(items: DataTransferItemList): Promise<File[]> { const filesAcc: File[] = []; const promises: Promise<void>[] = []; for (const item of Array.from(items)) { if (item.kind !== 'file') continue; const entry = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null; if (entry) promises.push(this.traverseFileSystemEntry(entry, filesAcc)); else { const file = item.getAsFile(); if (file && !file.name.toLowerCase().endsWith('.ds_store') && (file.size > 0 || file.type)) filesAcc.push(file); } } await Promise.all(promises); return filesAcc.filter(f => f instanceof File); }
  private async traverseFileSystemEntry(entry: FileSystemEntry, filesAcc: File[]): Promise<void> { return new Promise<void>((resolve) => { if (entry.isFile) { (entry as FileSystemFileEntry).file(file => { if (!file.name.toLowerCase().endsWith('.ds_store')) { if (entry.fullPath && !Object.prototype.hasOwnProperty.call(file, 'webkitRelativePath')) try { Object.defineProperty(file, 'webkitRelativePath', { value: entry.fullPath.startsWith('/') ? entry.fullPath.substring(1) : entry.fullPath }); } catch (e) {/*ignore*/ } filesAcc.push(file); } resolve(); }, () => resolve()); } else if (entry.isDirectory) { (entry as FileSystemDirectoryEntry).createReader().readEntries(async (entries) => { await Promise.all(entries.map(subEntry => this.traverseFileSystemEntry(subEntry, filesAcc))); resolve(); }, () => resolve()); } else resolve(); }); }
  private createFileListFromArray(files: File[]): FileList { const dt = new DataTransfer(); files.forEach(f => { if (f instanceof File) dt.items.add(f); }); return dt.files; }
  getFileIcon(filename?: string): string { if (!filename) return 'fas fa-question-circle'; const isPath = filename.includes('/'); const baseName = isPath ? filename.substring(filename.lastIndexOf('/') + 1) : filename; if ((isPath && (baseName === '' || !baseName.includes('.'))) || (!baseName.includes('.') && !isPath)) return 'fas fa-folder'; const ext = baseName.split('.').pop()?.toLowerCase() || ''; return this.iconMap[ext] || 'fas fa-file text-muted'; }
}