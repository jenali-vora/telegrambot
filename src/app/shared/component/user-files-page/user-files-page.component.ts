import { Component, inject, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService, User } from '../../services/auth.service'; // Adjust path as needed
import { FileManagerApiService, TelegramFileMetadata } from '../../services/file-manager-api.service'; // Adjust path
import { ByteFormatPipe } from '../../pipes/byte-format.pipe'; // Adjust path
import { RouterLink } from '@angular/router'; // For the "Back to Home" link

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

  currentUser: User | null = null;
  username: string = '';
  
  displayedFiles: TelegramFileMetadata[] = [];
  isLoadingFiles: boolean = false;
  fileListError: string | null = null;

  private authSubscription: Subscription | null = null;

  ngOnInit(): void {
    // This page should be protected by an AuthGuard, so user should always be logged in
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.username = this.currentUser?.username || this.currentUser?.email || '';
      if (this.currentUser && this.username) {
        this.loadFilesForLoggedInUser();
      } else {
        // Fallback, though guard should prevent this
        this.fileListError = "Authentication error. Please log in.";
        this.isLoadingFiles = false;
        this.cdRef.detectChanges();
      }
    });
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
  }

  get totalUploadedSize(): number {
    return this.displayedFiles.reduce((acc, file) => acc + (file.original_size || 0), 0);
  }

  loadFilesForLoggedInUser(): void {
    if (!this.currentUser || !this.username) return;

    this.isLoadingFiles = true;
    this.fileListError = null;
    this.displayedFiles = [];
    this.cdRef.detectChanges();

    this.apiService.listFiles(this.username).subscribe({
      next: (files) => this.zone.run(() => {
        this.displayedFiles = files.sort((a, b) => { // Sort by date, newest first
          const dateA = a.upload_timestamp ? new Date(a.upload_timestamp).getTime() : 0;
          const dateB = b.upload_timestamp ? new Date(b.upload_timestamp).getTime() : 0;
          return dateB - dateA;
        });
        this.isLoadingFiles = false;
        this.cdRef.detectChanges();
      }),
      error: (err) => this.zone.run(() => {
        this.fileListError = `Failed to load your files: ${err.message}`;
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
    const filenameToDelete = file.original_filename;
    this.apiService.deleteFileRecord(this.username, filenameToDelete).subscribe({
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

  getFileIcon(filename: string | undefined): string {
    if (!filename) return 'fas fa-question-circle';
    const baseName = filename.includes('/') ? filename.substring(filename.lastIndexOf('/') + 1) : filename;
    if (!baseName.includes('.')) return filename.includes('/') ? 'fas fa-folder' : 'fas fa-file';
    const extension = baseName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf': return 'fas fa-file-pdf text-danger';
      case 'doc': case 'docx': return 'fas fa-file-word text-primary';
      case 'xls': case 'xlsx': return 'fas fa-file-excel text-success';
      case 'zip': case 'rar': case 'tar': return 'fas fa-file-archive text-secondary';
      case 'jpg': case 'jpeg': case 'png': case 'gif': return 'fas fa-file-image text-purple';
      default: return 'fas fa-file text-muted';
    }
  }
}