// src/app/archived-files-page/archived-files-page.component.ts
import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService, User } from '../../services/auth.service';
import { FileManagerApiService, TelegramFileMetadata } from '../../services/file-manager-api.service';
import { ByteFormatPipe } from '../../pipes/byte-format.pipe';

@Component({
  selector: 'app-archived-files-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ByteFormatPipe, DatePipe],
  templateUrl: './archived-files-page.component.html',
  styleUrls: ['./archived-files-page.component.css', '../user-files-page/user-files-page.component.css'],
  providers: [DatePipe]
})
export class ArchivedFilesPageComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService); private apiService = inject(FileManagerApiService);
  private datePipe = inject(DatePipe); private cdRef = inject(ChangeDetectorRef); private zone = inject(NgZone);

  currentUser: User | null = null; username: string = ''; archivedFiles: TelegramFileMetadata[] = [];
  isLoading: boolean = false; error: string | null = null; restoringStates: { [accessId: string]: boolean } = {};
  private authSubscription: Subscription | null = null;

  ngOnInit(): void {
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user; this.username = user?.username || user?.email || '';
      if (this.currentUser && this.username) this.loadArchivedFiles();
      else { this.error = "Authentication error. Please log in."; this.isLoading = false; this.cdRef.detectChanges(); }
    });
  }

  ngOnDestroy(): void { this.authSubscription?.unsubscribe(); }

  loadArchivedFiles(): void {
    if (!this.username) return;
    this.isLoading = true; this.error = null; this.cdRef.detectChanges();
    this.apiService.listArchivedFiles(this.username).subscribe({
      next: (files) => this.zone.run(() => {
        this.archivedFiles = files.sort((a, b) => 
          (new Date(b.archived_timestamp ?? 0).getTime()) - (new Date(a.archived_timestamp ?? 0).getTime())
        );
        this.isLoading = false; this.cdRef.detectChanges();
      }),
      error: (err) => this.zone.run(() => {
        console.error("ArchivedFilesPage: Error loading archived files:", err);
        this.error = `Failed to load archived files. ${err.message || 'Please try again.'}${err.error?.error ? ` Server: ${err.error.error}` : ''}`;
        this.isLoading = false; this.cdRef.detectChanges();
      })
    });
  }

  requestFileRestore(file: TelegramFileMetadata): void {
    if (!file.access_id) { alert("Cannot restore: File information is incomplete."); return; }
    if (this.restoringStates[file.access_id]) return;
    this.restoringStates[file.access_id] = true; this.error = null; this.cdRef.detectChanges();

    this.apiService.restoreFile(file.access_id).subscribe({
      next: (response) => this.zone.run(() => {
        this.archivedFiles = this.archivedFiles.filter(f => f.access_id !== file.access_id);
        delete this.restoringStates[file.access_id!];
        alert(response.message || `File "${this.getDisplayFilename(file)}" restored successfully!`);
        this.cdRef.detectChanges();
      }),
      error: (err) => this.zone.run(() => {
        console.error(`ArchivedFilesPage: Error restoring file ${file.access_id}:`, err);
        const detail = err?.error?.message ?? err?.error?.error ?? err?.message ?? 'An unexpected error occurred.';
        this.error = `Failed to restore "${this.getDisplayFilename(file)}". ${detail}`;
        delete this.restoringStates[file.access_id!]; this.cdRef.detectChanges();
      })
    });
  }

  getDisplayFilename(file: TelegramFileMetadata): string {
    if (file.is_batch) return file.batch_display_name ?? 'Unnamed Batch';
    if (file.files_in_batch?.[0]?.original_filename) return file.files_in_batch[0].original_filename;
    return file.original_filename ?? file.name ?? file.sent_filename ?? 'Unnamed File';
  }

  getItemSize(file: TelegramFileMetadata): number {
    if (file.is_batch) return file.total_original_size ?? 0;
    if (typeof file.original_size === 'number') return file.original_size;
    if (typeof file.size === 'number') return file.size;
    if (file.files_in_batch?.[0]?.original_size !== undefined) return file.files_in_batch[0].original_size;
    return 0;
  }

  getFileIcon(file: TelegramFileMetadata): string {
    if (file.is_batch && file.files_in_batch && file.files_in_batch.length > 1) return 'fas fa-folder-open text-warning';
    let filenameForIcon: string | undefined;
    if (!file.is_batch) filenameForIcon = file.original_filename ?? file.name ?? file.sent_filename;
    filenameForIcon = filenameForIcon ?? file.files_in_batch?.[0]?.original_filename;
    if (file.is_batch && !filenameForIcon && file.batch_display_name && !file.batch_display_name.includes('.')) return 'fas fa-folder-open text-warning';
    if (!filenameForIcon) return file.is_batch ? 'fas fa-folder-open text-warning' : 'fas fa-question-circle text-muted';

    const extension = filenameForIcon.split('.').pop()?.toLowerCase();
    if (!extension) return file.is_batch ? 'fas fa-folder-open text-warning' : 'fas fa-file text-muted';

    switch (extension) {
      case 'pdf': return 'fas fa-file-pdf text-danger';
      case 'doc': case 'docx': return 'fas fa-file-word text-primary';
      case 'xls': case 'xlsx': return 'fas fa-file-excel text-success';
      case 'zip': case 'rar': case 'tar': case 'gz': case '7z': return 'fas fa-file-archive text-secondary';
      case 'png': case 'jpg': case 'jpeg': case 'gif': case 'webp': case 'svg': case 'ico': return 'fas fa-file-image text-purple';
      case 'mp3': case 'wav': case 'ogg': case 'aac': case 'flac': return 'fas fa-file-audio text-orange';
      case 'mp4': case 'mov': case 'avi': case 'mkv': case 'webm': return 'fas fa-file-video text-info';
      case 'txt': case 'log': case 'md': return 'fas fa-file-alt text-body-secondary';
      case 'html': case 'css': case 'js': case 'ts': case 'json': case 'xml': return 'fas fa-file-code text-primary-emphasis';
      default: return 'fas fa-file text-muted';
    }
  }

  formatArchivedDate(timestamp: string | Date | undefined): string {
    if (!timestamp) return 'N/A';
    try { return this.datePipe.transform(timestamp, 'yyyy-MM-dd HH:mm') ?? 'Invalid Date'; }
    catch (e) { return 'Invalid Date'; }
  }

  goBackToFiles(): void { /* Intentionally empty or for future use if routerLink is not sufficient */ }
}