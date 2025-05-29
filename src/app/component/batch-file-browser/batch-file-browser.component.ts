import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http'; // Import HttpErrorResponse
import { Observable, Subscription, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

import {
  BatchDetails,
  FileInBatchInfo,
  DownloadAllInitiationResponse,
  SseReadyPayload,
  SseProgressPayload,
  SseStatusPayload
} from '../../interfaces/batch.interfaces';

import { ByteFormatPipe } from '../../shared/pipes/byte-format.pipe';

@Component({
  selector: 'app-batch-file-browser',
  standalone: true,
  imports: [CommonModule, RouterLink, ByteFormatPipe, DatePipe, DecimalPipe],
  templateUrl: './batch-file-browser.component.html',
  styleUrls: ['./batch-file-browser.component.css'],
  providers: [DatePipe, DecimalPipe]
})
export class BatchFileBrowserComponent implements OnInit, OnDestroy, OnChanges {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private cdRef = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private datePipe = inject(DatePipe);

  @Input() batchAccessIdInput: string | null = null;
  public effectiveBatchAccessId: string | null = null;

  batchDetails: BatchDetails | null = null;
  isLoading = true;
  error: string | null = null;

  downloadStatusMessage: string | null = null;
  downloadStatusType: 'info' | 'error' | 'success' = 'info';
  isProcessingDownload = false;

  individualProgress: { [key: string]: SseProgressPayload | null } = {};
  currentDownloadingFile: string | null = null;

  downloadAllProgress: SseProgressPayload | null = null;
  downloadAllProgressMessage: string | null = null;
  isDownloadingAll: boolean = false;

  private currentSse: EventSource | null = null;
  private routeSubscription: Subscription | null = null;
  private readonly API_BASE_URL = environment.apiUrl;

  // --- New properties for specific single file previews ---
  isSingleImageOnlyPreview = false;
  singleImageFile: FileInBatchInfo | null = null;
  singleImagePreviewUrl: string | null = null;

  isSingleCodeFilePreview = false;
  singleCodeFile: FileInBatchInfo | null = null;
  singleCodeFileContent: string | null = null;
  isLoadingFileContent = false;
  // ---

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['batchAccessIdInput'] && this.batchAccessIdInput) {
      this.effectiveBatchAccessId = this.batchAccessIdInput;
      this.resetStateAndFetch();
    } else if (changes['batchAccessIdInput'] && !this.batchAccessIdInput && this.effectiveBatchAccessId) {
      this.batchDetails = null;
      this.error = "Batch ID input removed.";
      this.isLoading = false;
      this.cleanupPreviousDownloadState(); // Also cleans up preview states
      this.cdRef.detectChanges();
    }
  }

  ngOnInit(): void {
    if (!this.batchAccessIdInput) {
      this.routeSubscription = this.route.paramMap.subscribe(params => {
        const accessIdFromRoute = params.get('accessId');
        if (accessIdFromRoute) {
          this.effectiveBatchAccessId = accessIdFromRoute;
          this.resetStateAndFetch();
        } else {
          this.error = 'Batch Access ID not found in URL and no input provided.';
          this.isLoading = false;
          this.cleanupPreviousDownloadState();
          this.cdRef.detectChanges();
        }
      });
    } else if (this.batchAccessIdInput && !this.effectiveBatchAccessId) {
      this.effectiveBatchAccessId = this.batchAccessIdInput;
      this.resetStateAndFetch();
    } else if (this.effectiveBatchAccessId) {
      if (!this.batchDetails && !this.isLoading) { // If component re-initializes with ID already set
        this.resetStateAndFetch();
      }
    }
  }

  private resetStateAndFetch(): void {
    if (this.effectiveBatchAccessId) {
      this.isLoading = true;
      this.error = null;
      this.batchDetails = null;
      this.cleanupPreviousDownloadState(); // Resets all download and preview states
      this.cdRef.detectChanges();
      this.fetchBatchDetails(this.effectiveBatchAccessId);
    }
  }

  fetchBatchDetails(accessId: string): void {
    if (!accessId) {
      this.error = "Access ID is missing for fetching batch details.";
      this.isLoading = false;
      this.cdRef.detectChanges();
      return;
    }
    this.isLoading = true;
    this.error = null;
    // Reset preview states before fetching new details
    this.isSingleImageOnlyPreview = false;
    this.singleImageFile = null;
    this.singleImagePreviewUrl = null;
    this.isSingleCodeFilePreview = false;
    this.singleCodeFile = null;
    this.singleCodeFileContent = null;
    this.isLoadingFileContent = false;

    const endpointUrl = `${this.API_BASE_URL}/api/batch-details/${accessId}`;
    this.http.get<BatchDetails>(endpointUrl)
      .pipe(
        tap(details => console.log('Batch details fetched:', details)),
        catchError(err => {
          console.error('Error fetching batch details:', err);
          this.error = `Failed to load batch details for ${accessId}: ${err.statusText || err.message || 'Server error'}`;
          if (err.status === 404) {
            this.error = `Batch with ID ${accessId} not found (404). Please check the ID or link.`;
          }
          this.isLoading = false;
          this.cdRef.detectChanges();
          return throwError(() => err);
        })
      )
      .subscribe({
        next: (details) => {
          this.batchDetails = details;
          this.isLoading = false;

          if (details.files && details.files.length === 1) {
            const file = details.files[0];
            if (!file.skipped && !file.failed) {
              if (this.isImageFile(file.original_filename)) {
                this.isSingleImageOnlyPreview = true;
                this.singleImageFile = file;
                // IMPORTANT: This URL must point to an endpoint that serves the raw image file.
                this.singleImagePreviewUrl = `${this.API_BASE_URL}/api/file-preview/${this.effectiveBatchAccessId}/${encodeURIComponent(file.original_filename)}`;
              } else if (this.isCodeOrTextFile(file.original_filename)) {
                this.isSingleCodeFilePreview = true;
                this.singleCodeFile = file;
                this.fetchAndDisplayCodeFileContent(file);
              }
              // If neither, it will fall through to the standard file list view in the template
            }
          }
          this.cdRef.detectChanges();
        },
        error: (err) => { // Error caught by catchError, but good to have it here too.
          this.isLoading = false;
          // Error is already set by catchError
          this.cdRef.detectChanges();
        }
      });
  }

  isImageFile(filename: string | undefined): boolean {
    if (!filename) return false;
    const extension = filename.split('.').pop()?.toLowerCase();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
    return !!extension && imageExtensions.includes(extension);
  }

  isCodeOrTextFile(filename: string | undefined): boolean {
    if (!filename) return false;
    const extension = filename.split('.').pop()?.toLowerCase();
    // Add more extensions as needed
    const codeExtensions = [
      'txt', 'md', 'log', // Plain text & markdown
      'js', 'ts', 'jsx', 'tsx', // JavaScript/TypeScript
      'html', 'htm', 'xml', 'svg', // Markup
      'css', 'scss', 'less', // Stylesheets
      'json', 'yaml', 'yml', // Data formats
      'py', 'rb', 'php', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'swift', 'kt', // Programming languages
      'sh', 'bash', 'ps1', // Scripts
      'sql' // SQL
    ];
    return !!extension && codeExtensions.includes(extension);
  }

  fetchAndDisplayCodeFileContent(file: FileInBatchInfo): void {
    if (!this.effectiveBatchAccessId || !file.original_filename) return;

    this.isLoadingFileContent = true;
    this.singleCodeFileContent = null; // Clear previous content
    this.error = null; // Clear general errors that might be from batch load
    this.cdRef.detectChanges();

    // IMPORTANT: Use an endpoint that serves raw file content as text.
    const contentUrl = `${this.API_BASE_URL}/api/file-content/${this.effectiveBatchAccessId}/${encodeURIComponent(file.original_filename)}`;
    // const contentUrl = `${this.API_BASE_URL}/download-single/${this.effectiveBatchAccessId}/${encodeURIComponent(file.original_filename)}`; // if this endpoint can serve text

    this.http.get(contentUrl, { responseType: 'text' })
      .pipe(
        catchError((err: HttpErrorResponse) => {
          console.error(`Error fetching content for ${file.original_filename}:`, err);
          this.error = `Could not load content for ${file.original_filename}. Server responded with ${err.status}.`;
          this.isLoadingFileContent = false;
          this.isSingleCodeFilePreview = false; // Fallback to list view
          this.cdRef.detectChanges();
          return throwError(() => err);
        })
      )
      .subscribe({
        next: (content) => {
          this.singleCodeFileContent = content;
          this.isLoadingFileContent = false;
          this.cdRef.detectChanges();
        },
        // Error handled by catchError
      });
  }


  onImagePreviewError(event: Event) {
    console.error('Failed to load preview image:', this.singleImagePreviewUrl, event);
    if (this.singleImageFile) {
      // Set a general error that will be displayed by the #loadingOrError template
      this.error = `Could not load preview for ${this.singleImageFile.original_filename}. The file might be inaccessible or not a valid image.`;
    } else {
      this.error = 'Could not load preview image.';
    }
    this.singleImagePreviewUrl = null;
    this.isSingleImageOnlyPreview = false; // Fallback to list view or show error
    this.isLoading = false; // Ensure loading state is false to show error
    this.cdRef.detectChanges();
  }

  private cleanupPreviousDownloadState(): void {
    // Resets download-related states
    this.isProcessingDownload = false;
    this.downloadStatusMessage = null;
    this.downloadStatusType = 'info';
    this.individualProgress = {};
    this.currentDownloadingFile = null;
    this.downloadAllProgress = null;
    this.downloadAllProgressMessage = null;
    this.isDownloadingAll = false;
    this.cleanupSse();

    // Also reset new preview states
    this.isSingleImageOnlyPreview = false;
    this.singleImageFile = null;
    this.singleImagePreviewUrl = null;
    this.isSingleCodeFilePreview = false;
    this.singleCodeFile = null;
    this.singleCodeFileContent = null;
    this.isLoadingFileContent = false;

    // this.error = null; // Don't clear general error here if it's from batch load itself
    this.cdRef.detectChanges();
  }

  // ... (initiateDownloadAll, initiateIndividualDownload, setupSseConnection, cleanupSse, setDownloadStatus, formatTime, formatUploadDate, getFileIconClass, ngOnDestroy remain UNCHANGED from your original code)
  initiateDownloadAll(): void {
    if (!this.effectiveBatchAccessId || this.isProcessingDownload) return;

    this.cleanupPreviousDownloadState();
    this.isDownloadingAll = true;
    this.isProcessingDownload = true;
    this.downloadAllProgress = { percentage: 0 };
    this.setDownloadStatus('Initiating Download All (.zip)...', 'info');
    this.cdRef.detectChanges();

    console.log(`Download All clicked for access_id: ${this.effectiveBatchAccessId}`);
    this.http.get<DownloadAllInitiationResponse>(`${this.API_BASE_URL}/initiate-download-all/${this.effectiveBatchAccessId}`)
      .pipe(
        catchError(err => {
          const errorMsg = err.error?.error || err.message || `HTTP error ${err.status}`;
          console.error("Error initiating Download All:", errorMsg);
          this.setDownloadStatus(`Error: ${errorMsg}`, 'error');
          this.isDownloadingAll = false;
          this.isProcessingDownload = false;
          this.downloadAllProgress = null;
          this.cdRef.detectChanges();
          return throwError(() => new Error(errorMsg));
        })
      )
      .subscribe(response => {
        if (response.sse_stream_url) {
          const sseUrl = response.sse_stream_url.startsWith('http') ? response.sse_stream_url : `${this.API_BASE_URL}${response.sse_stream_url}`;
          this.setupSseConnection(sseUrl);
        } else {
          const errorMsg = response.error || "Invalid response from initiation endpoint.";
          this.setDownloadStatus(`Error: ${errorMsg}`, 'error');
          this.isDownloadingAll = false;
          this.isProcessingDownload = false;
          this.downloadAllProgress = null;
          this.cdRef.detectChanges();
        }
      });
  }

  initiateIndividualDownload(file: FileInBatchInfo): void {
    if (!this.effectiveBatchAccessId || !file.original_filename || this.isProcessingDownload) return;

    this.cleanupPreviousDownloadState();
    this.currentDownloadingFile = file.original_filename;
    this.isProcessingDownload = true;

    const initialProgressPayload: SseProgressPayload = {
      percentage: 0,
      bytesSent: 0,
      totalBytes: file.original_size,
      speedMBps: 0,
      etaFormatted: "Estimating...",
    };
    this.individualProgress[file.original_filename] = initialProgressPayload;
    this.cdRef.detectChanges();

    const encodedFilename = encodeURIComponent(file.original_filename);
    const sseUrl = `${this.API_BASE_URL}/download-single/${this.effectiveBatchAccessId}/${encodedFilename}`;
    this.setupSseConnection(sseUrl);
  }

  private setupSseConnection(streamUrl: string): void {
    if (this.currentSse) {
      this.currentSse.close();
    }
    this.cdRef.detectChanges();

    console.log(`Connecting to SSE: ${streamUrl}`);
    this.currentSse = new EventSource(streamUrl);

    this.currentSse.onopen = () => this.zone.run(() => {
      console.log("SSE connection opened.");
      if (!((this.isDownloadingAll && this.downloadAllProgress) || this.currentDownloadingFile)) {
        this.setDownloadStatus('Connection established. Preparing file...', 'info');
      }
    });

    this.currentSse.addEventListener('status', (event: MessageEvent) => this.zone.run(() => {
      console.log("SSE 'status':", event.data);
      try {
        const data: SseStatusPayload = JSON.parse(event.data);
        const message = data.message || 'Processing...';
        if (this.isDownloadingAll && this.downloadAllProgress) {
          this.downloadAllProgressMessage = message;
        } else if (this.currentDownloadingFile) {
          // this.setDownloadStatus(message, 'info');
        } else {
          this.setDownloadStatus(message, 'info');
        }
      } catch (e) { this.setDownloadStatus(event.data, 'info'); }
      this.cdRef.detectChanges();
    }));

    this.currentSse.addEventListener('progress', (event: MessageEvent) => this.zone.run(() => {
      try {
        const rawData = JSON.parse(event.data);
        const progressData: SseProgressPayload = {
          percentage: Number(rawData.percentage) || 0,
          bytesSent: rawData.bytesSent !== undefined ? Number(rawData.bytesSent) : undefined,
          bytesProcessed: rawData.bytesProcessed !== undefined ? Number(rawData.bytesProcessed) : undefined,
          totalBytes: rawData.totalBytes !== undefined ? Number(rawData.totalBytes) : undefined,
          speedMBps: rawData.speedMBps !== undefined ? Number(rawData.speedMBps) : undefined,
          etaFormatted: rawData.etaFormatted || this.formatTime(NaN),
          etaSeconds: rawData.etaSeconds !== undefined ? Number(rawData.etaSeconds) : undefined,
        };

        if (this.isDownloadingAll) {
          this.downloadAllProgress = progressData;
        } else if (this.currentDownloadingFile && this.individualProgress.hasOwnProperty(this.currentDownloadingFile)) {
          this.individualProgress[this.currentDownloadingFile] = progressData;
        }
        if ((this.isDownloadingAll && this.downloadAllProgress) || this.currentDownloadingFile) {
          this.downloadStatusMessage = null;
        }
        this.cdRef.detectChanges();
      } catch (e) {
        console.error("Progress parse/update error", e, "Data:", event.data);
      }
    }));

    this.currentSse.addEventListener('ready', (event: MessageEvent) => this.zone.run(() => {
      console.log("SSE 'ready':", event.data);
      try {
        const sseData: SseReadyPayload = JSON.parse(event.data);
        if (!sseData.temp_file_id || !sseData.final_filename) throw new Error("Missing temp_file_id or final_filename");

        if (this.isDownloadingAll && this.downloadAllProgress) {
          this.downloadAllProgress = { ...this.downloadAllProgress, percentage: 100 };
        } else if (this.currentDownloadingFile && this.individualProgress[this.currentDownloadingFile]) {
          this.individualProgress[this.currentDownloadingFile] = {
            ...(this.individualProgress[this.currentDownloadingFile] as SseProgressPayload), percentage: 100
          };
        }
        this.cdRef.detectChanges();

        const finalDownloadUrl = `${this.API_BASE_URL}/serve-temp-file/${sseData.temp_file_id}/${encodeURIComponent(sseData.final_filename)}`;
        this.setDownloadStatus(`Download ready: ${sseData.final_filename}. Starting download...`, 'success');
        console.log(`Preparation complete. Triggering download: ${finalDownloadUrl}`);

        window.location.href = finalDownloadUrl;

        setTimeout(() => {
          this.cleanupPreviousDownloadState();
        }, 5000);
      } catch (e: any) {
        console.error("Error processing 'ready' event:", e);
        this.setDownloadStatus(`Error finalizing download: ${e.message || 'Unknown error'}`, 'error');
        this.cleanupPreviousDownloadState();
      }
    }));

    this.currentSse.addEventListener('error', (event: MessageEvent | Event) => this.zone.run(() => {
      console.error("SSE 'error' event data:", (event as MessageEvent).data || event);
      let errorMsg = 'An error occurred during file preparation stream.';
      if ((event as MessageEvent).data) {
        try { errorMsg = `Error: ${JSON.parse((event as MessageEvent).data).message || 'Unknown server error.'}`; }
        catch (e) { errorMsg = `Error: ${(event as MessageEvent).data || 'Server stream error.'}`; }
      }
      this.setDownloadStatus(errorMsg, 'error');
      this.cleanupPreviousDownloadState();
    }));

    this.currentSse.onerror = (err: Event) => this.zone.run(() => {
      if (this.currentSse) {
        if (this.isProcessingDownload) {
          console.error("SSE EventSource connection error:", err);
          this.setDownloadStatus('Connection lost or server error during file preparation.', 'error');
        } else {
          console.log("SSE EventSource error after processing seemed complete or was manually closed:", err);
        }
        this.cleanupPreviousDownloadState();
      }
    });
  }

  private cleanupSse(): void {
    if (this.currentSse) {
      this.currentSse.close();
      this.currentSse = null;
      console.log("SSE connection explicitly closed.");
    }
  }

  private setDownloadStatus(message: string | null, type: 'info' | 'error' | 'success'): void {
    this.downloadStatusMessage = message;
    this.downloadStatusType = type;
    this.cdRef.detectChanges();
  }

  formatTime(seconds: number | undefined): string {
    if (seconds === undefined || isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return "--:--";
    seconds = Math.round(seconds);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) { return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`; }
    else { return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`; }
  }

  formatUploadDate(timestamp: string | Date | undefined): string {
    if (!timestamp) return 'N/A';
    try {
      return this.datePipe.transform(timestamp, 'yyyy-MM-dd HH:mm') || 'Invalid Date';
    } catch (e) {
      return 'Invalid Date';
    }
  }

  getFileIconClass(filename: string): string {
    if (!filename) {
      return 'fa fa-file-o';
    }
    const extension = filename.split('.').pop()?.toLowerCase();
    let iconClass = 'fa fa-file-o';
    switch (extension) {
      case 'zip': case 'rar': case '7z': case 'tar': case 'gz': iconClass = 'fa fa-file-archive-o'; break;
      case 'pdf': iconClass = 'fa fa-file-pdf-o'; break;
      case 'doc': case 'docx': iconClass = 'fa fa-file-word-o'; break;
      case 'xls': case 'xlsx': iconClass = 'fa fa-file-excel-o'; break;
      case 'ppt': case 'pptx': iconClass = 'fa fa-file-powerpoint-o'; break;
      case 'jpg': case 'jpeg': case 'png': case 'gif': case 'bmp': case 'svg': case 'webp': iconClass = 'fa fa-file-image-o'; break;
      case 'mp3': case 'wav': case 'ogg': case 'aac': iconClass = 'fa fa-file-audio-o'; break;
      case 'mp4': case 'mov': case 'avi': case 'mkv': case 'wmv': iconClass = 'fa fa-file-video-o'; break;
      case 'txt': iconClass = 'fa fa-file-text-o'; break;
      case 'js': case 'ts': case 'html': case 'css': case 'scss': case 'json': case 'xml': case 'py': case 'java': case 'c': case 'cpp': iconClass = 'fa fa-file-code-o'; break;
    }
    return iconClass;
  }

  ngOnDestroy(): void {
    this.cleanupPreviousDownloadState();
    this.routeSubscription?.unsubscribe();
  }
}