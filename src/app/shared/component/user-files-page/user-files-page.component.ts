// src/app/component/user-files-page/user-files-page.component.ts
import { Component, inject, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService, User } from '../../services/auth.service';
import { FileManagerApiService, TelegramFileMetadata } from '../../services/file-manager-api.service';
import { ByteFormatPipe } from '../../pipes/byte-format.pipe';
import { RouterLink } from '@angular/router';
import { UploadEventService } from '../../services/upload-event.service';

@Component({
  selector: 'app-user-files-page',
  standalone: true,
  imports: [CommonModule, ByteFormatPipe, DatePipe, RouterLink],
  templateUrl: './user-files-page.component.html',
  styleUrls: ['./user-files-page.component.css'],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserFilesPageComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private apiService = inject(FileManagerApiService);
  private datePipe = inject(DatePipe);
  private cdRef = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private uploadEventService = inject(UploadEventService);

  currentUser: User | null = null;
  username: string = '';
  displayedFiles: TelegramFileMetadata[] = [];
  isLoadingFiles: boolean = false;
  fileListError: string | null = null;
  downloadingStates: { [accessId: string]: boolean } = {};
  private authSubscription: Subscription | null = null;
  private uploadEventSubscription: Subscription | null = null;

  ngOnInit(): void {
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.username = this.currentUser?.username || this.currentUser?.email || '';
      if (this.currentUser && this.username) {
        this.loadFilesForLoggedInUser();
      } else {
        this.fileListError = "Authentication error. Please log in.";
        this.isLoadingFiles = false;
        this.cdRef.detectChanges();
      }
    });

    this.uploadEventSubscription = this.uploadEventService.uploadCompleted$.subscribe(() => {
      if (this.currentUser && this.username) {
        console.log('UserFilesPageComponent: Received upload complete notification. Reloading files.');
        this.loadFilesForLoggedInUser();
      }
    });
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.uploadEventSubscription?.unsubscribe();
  }

  get totalUploadedSize(): number {
    return this.displayedFiles.reduce((acc, file) => {
      if (file.is_batch) {
        return acc + (file.total_original_size || 0);
      }
      return acc + (file.original_size || file.size || 0);
    }, 0);
  }

  loadFilesForLoggedInUser(): void {
    if (!this.currentUser || !this.username) return;
    this.isLoadingFiles = true;
    this.fileListError = null;
    this.cdRef.detectChanges();

    this.apiService.listFiles(this.username).subscribe({
      next: (files) => this.zone.run(() => {
        console.log('UserFilesPageComponent: Raw files from API /listFiles:', JSON.stringify(files, null, 2));
        this.displayedFiles = files.sort((a, b) => {
          const dateA = a.upload_timestamp ? new Date(a.upload_timestamp).getTime() : 0;
          const dateB = b.upload_timestamp ? new Date(b.upload_timestamp).getTime() : 0;
          return dateB - dateA;
        });
        this.isLoadingFiles = false;
        this.cdRef.detectChanges();
      }),
      error: (err) => this.zone.run(() => {
        console.error("UserFilesPageComponent: Error loading files:", err);
        this.fileListError = `Failed to load your files. ${err.message || 'Please try again.'}`;
        this.isLoadingFiles = false;
        this.cdRef.detectChanges();
      })
    });
  }

  getDisplayFilename(file: TelegramFileMetadata): string {
    if (file.is_batch) {
      return file.batch_display_name ||
        (file.files_in_batch && file.files_in_batch.length === 1 ? file.files_in_batch[0].original_filename : '') ||
        'Unnamed Batch';
    }
    return file.original_filename || file.name || file.sent_filename || 'Unnamed File';
  }

  getItemSize(file: TelegramFileMetadata): number {
    if (file.is_batch) {
      return file.total_original_size ?? 0;
    }
    return file.original_size ?? file.size ?? 0;
  }

  getFileIcon(file: TelegramFileMetadata): string {
    let filenameForIcon: string | undefined;

    if (file.is_batch) {
      filenameForIcon = file.batch_display_name;
      if ((!filenameForIcon || !filenameForIcon.includes('.')) && file.files_in_batch && file.files_in_batch.length === 1) {
        filenameForIcon = file.files_in_batch[0].original_filename;
      }
      if (!filenameForIcon || (file.files_in_batch && file.files_in_batch.length > 1 && !filenameForIcon.includes('.'))) {
        return 'fas fa-folder-open text-warning';
      }
    } else {
      filenameForIcon = file.original_filename || file.name || file.sent_filename;
    }

    if (!filenameForIcon) return 'fas fa-question-circle';
    const baseNameForIcon = filenameForIcon.includes('/') ? filenameForIcon.substring(filenameForIcon.lastIndexOf('/') + 1) : filenameForIcon;

    if (!baseNameForIcon.includes('.')) {
      return filenameForIcon.includes('/') ? 'fas fa-folder' : 'fas fa-file';
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
      case 'js': return 'fab fa-js-square text-warning';
      case 'ts': return 'fas fa-file-code text-primary';
      case 'json': return 'fas fa-file-code text-success';
      case 'html': return 'fab fa-html5 text-danger';
      case 'css': case 'scss': case 'sass': return 'fab fa-css3-alt text-info';
      case 'py': return 'fab fa-python text-primary';
      case 'java': return 'fab fa-java text-danger';
      case 'c': case 'cpp': case 'cs': case 'go': case 'php': case 'rb': case 'sh': return 'fas fa-file-code text-secondary';
      default: return 'fas fa-file text-muted';
    }
  }

  requestFileDownload(file: TelegramFileMetadata): void {
    if (!file.access_id) {
      alert("Error: Download information is missing for this item.");
      return;
    }
    if (this.downloadingStates[file.access_id]) return;

    this.downloadingStates[file.access_id] = true;
    this.fileListError = null;
    this.cdRef.detectChanges();

    this.apiService.downloadFileBlob(file.access_id).subscribe({
      next: (blob) => {
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;

        let downloadName = this.getDisplayFilename(file) || 'downloaded_item';
        if (file.is_batch && blob.type === "application/zip" && !downloadName.toLowerCase().endsWith('.zip')) {
          downloadName += '.zip';
        } else if (file.is_batch && !downloadName.includes('.')) {
          if (!(file.files_in_batch && file.files_in_batch.length === 1 && file.batch_display_name?.includes('.'))) {
            downloadName += '.zip';
          }
        }

        link.download = downloadName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        delete this.downloadingStates[file.access_id!];
        this.cdRef.detectChanges();
      },
      error: (err) => {
        const displayName = this.getDisplayFilename(file);
        console.error(`UserFilesPageComponent: Error downloading ${displayName}:`, err);
        this.fileListError = `Failed to download "${displayName}". ${err.message || 'Please try again.'}`;
        delete this.downloadingStates[file.access_id!];
        this.cdRef.detectChanges();
      }
    });
  }

  requestFileDelete(file: TelegramFileMetadata): void {
    if (!this.currentUser || !this.username) {
      this.fileListError = "Authentication error. Please log in.";
      this.cdRef.detectChanges();
      return;
    }

    const displayName = this.getDisplayFilename(file);

    // *** KEY CHANGE: Use access_id as the primary identifier for deletion ***
    // THIS LINE IS CRUCIAL AND CORRECT. IT USES THE UNIQUE access_id.
    const identifierForDelete = file.access_id;

    if (!identifierForDelete) {
      const errorMsg = `Cannot delete "${displayName}": Unique identifier (access_id) is missing for this item.`;
      alert(errorMsg);
      this.fileListError = errorMsg;
      this.cdRef.detectChanges();
      console.warn(`Attempted to delete item without access_id:`, file);
      return;
    }

    if (!confirm(`Are you sure you want to delete the record for "${displayName}"? This cannot be undone.`)) {
      return;
    }

    this.fileListError = null;
    this.cdRef.detectChanges();

    // 'identifierForDelete' (which is the access_id) is passed to the service.
    // The backend MUST be prepared to use this access_id to find the record.
    this.apiService.deleteFileRecord(this.username, identifierForDelete).subscribe({
      next: (response) => this.zone.run(() => {
        console.log(`Delete successful for item with access_id ${identifierForDelete} (Display Name: "${displayName}"):`, response?.message);
        this.loadFilesForLoggedInUser(); // Refresh list
      }),
      error: (err) => this.zone.run(() => {
        // The error message from the backend (err.message) will indicate "not found" if the backend
        // is looking for the access_id in the wrong database column (e.g., filename column).
        const errorMsg = `Failed to delete "${displayName}": ${err.message || 'Unknown server error'}`;
        this.fileListError = errorMsg;
        console.error(`Error deleting item with access_id ${identifierForDelete}:`, err);
        this.cdRef.detectChanges();
      })
    });
  }

  formatUploadDate(timestamp: string | Date | undefined): string {
    if (!timestamp) return 'N/A';
    try { return this.datePipe.transform(timestamp, 'yyyy-MM-dd HH:mm') || 'Invalid Date'; }
    catch (e) { return 'Invalid Date'; }
  }
}