// src/app/component/user-files-page/user-files-page.component.ts
import { Component, inject, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService, User } from '../../services/auth.service'; // Adjust path as needed
import { FileManagerApiService, TelegramFileMetadata } from '../../services/file-manager-api.service'; // Adjust path
import { ByteFormatPipe } from '../../pipes/byte-format.pipe'; // Adjust path
import { RouterLink } from '@angular/router';
import { UploadEventService } from '../../services/upload-event.service'; // <-- IMPORT (Adjust path if necessary)

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
  private uploadEventService = inject(UploadEventService); // <-- INJECT SERVICE

  currentUser: User | null = null;
  username: string = '';

  displayedFiles: TelegramFileMetadata[] = [];
  isLoadingFiles: boolean = false;
  fileListError: string | null = null;

  private authSubscription: Subscription | null = null;
  private uploadEventSubscription: Subscription | null = null; // <-- ADD SUBSCRIPTION PROPERTY

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

    // Subscribe to upload completion events
    this.uploadEventSubscription = this.uploadEventService.uploadCompleted$.subscribe(() => {
      if (this.currentUser && this.username) {
        console.log('UserFilesPageComponent: Received upload complete notification. Reloading files.');
        this.loadFilesForLoggedInUser();
      }
    });
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.uploadEventSubscription?.unsubscribe(); // <-- UNSUBSCRIBE
  }

  get totalUploadedSize(): number {
    return this.displayedFiles.reduce((acc, file) => acc + (file.original_size || 0), 0);
  }

  loadFilesForLoggedInUser(): void {
    if (!this.currentUser || !this.username) return;

    this.isLoadingFiles = true;
    this.fileListError = null;
    this.cdRef.detectChanges();

    this.apiService.listFiles(this.username).subscribe({
      next: (files) => this.zone.run(() => {
        // VITAL DEBUG LOG: Print the raw data from the API
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
        this.fileListError = `Failed to load your files. Please try again.`;
        this.isLoadingFiles = false;
        this.cdRef.detectChanges();
      })
    });
  }

  requestFileDownload(file: TelegramFileMetadata): void {
    if (!file.access_id) {
      alert("Error: Download link information is missing for this file.");
      return;
    }
    const downloadPageUrl = `${this.apiService.getApiBaseUrl()}/get/${file.access_id}`;
    window.open(downloadPageUrl, '_blank');
  }

  requestFileDelete(file: TelegramFileMetadata): void {
    if (!this.currentUser || !this.username) return;
    if (!confirm(`Are you sure you want to delete the record for "${file.original_filename}"? This cannot be undone.`)) return;

    this.fileListError = null;
    // Ensure original_filename is what the backend expects for deletion.
    // If original_filename can be a path, ensure the backend handles that.
    // For safety, use access_id if the backend supports deletion by it, as it's unique.
    // Assuming deletion by original_filename for now as per existing code.
    const identifierForDelete = file.original_filename; // Or file.access_id if API supports

    this.apiService.deleteFileRecord(this.username, identifierForDelete).subscribe({
      next: (response) => this.zone.run(() => {
        console.log("Delete successful:", response.message);
        this.loadFilesForLoggedInUser(); // Refresh the list
      }),
      error: (err) => this.zone.run(() => {
        this.fileListError = `Failed to delete file: ${err.message}`;
        this.cdRef.detectChanges();
      })
    });
  }

  formatUploadDate(timestamp: string | Date | undefined): string {
    if (!timestamp) return 'N/A';
    try { return this.datePipe.transform(timestamp, 'yyyy-MM-dd HH:mm') || 'Invalid Date'; }
    catch (e) { return 'Invalid Date'; }
  }

  // It's good practice to use a consistent and comprehensive getFileIcon function.
  // Consider moving this to a shared utility or service if used in multiple places,
  // or ensure both components have the same complete version.
  // Using the more comprehensive one from HomeComponent for UserFilesPageComponent:
  getFileIcon(filename: string | undefined): string {
    if (!filename) return 'fas fa-question-circle'; // Default for undefined or empty filename
    const baseNameForIcon = filename.includes('/') ? filename.substring(filename.lastIndexOf('/') + 1) : filename;

    if (!baseNameForIcon.includes('.')) { // If no extension in the actual filename part
      // If original filename had a path, it might represent a folder structure item
      // or just an extensionless file.
      return filename.includes('/') ? 'fas fa-folder' : 'fas fa-file';
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
      case 'js': return 'fab fa-js-square text-warning'; // From HomeComponent
      case 'ts': return 'fas fa-file-code text-primary'; // From HomeComponent
      case 'json': return 'fas fa-file-code text-success'; // From HomeComponent
      case 'html': return 'fab fa-html5 text-danger'; // From HomeComponent
      case 'css': case 'scss': case 'sass': return 'fab fa-css3-alt text-info'; // From HomeComponent
      case 'py': return 'fab fa-python text-primary'; // From HomeComponent
      case 'java': return 'fab fa-java text-danger'; // From HomeComponent
      case 'c': case 'cpp': case 'cs': case 'go': case 'php': case 'rb': case 'sh': return 'fas fa-file-code text-secondary'; // From HomeComponent
      default: return 'fas fa-file text-muted';
    }
  }
}