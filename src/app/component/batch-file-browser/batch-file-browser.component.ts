// src/app/shared/component/batch-file-browser/batch-file-browser.component.ts

import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
} from '../../interfaces/batch.interfaces'; // Adjusted path based on common structures

import { ByteFormatPipe } from '../../shared/pipes/byte-format.pipe'; // Adjusted path

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
  private router = inject(Router); // Inject Router if not already

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

  // constructor() {} // Removed router from constructor as it's injected

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['batchAccessIdInput'] && this.batchAccessIdInput) {
      this.effectiveBatchAccessId = this.batchAccessIdInput;
      this.resetStateAndFetch();
    } else if (changes['batchAccessIdInput'] && !this.batchAccessIdInput && this.effectiveBatchAccessId) {
      this.batchDetails = null;
      this.error = "Batch ID input removed.";
      this.isLoading = false;
      this.cleanupPreviousDownloadState();
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
      if (!this.batchDetails && !this.isLoading) {
        this.resetStateAndFetch();
      }
    }
  }

  private resetStateAndFetch(): void {
    if (this.effectiveBatchAccessId) {
      this.isLoading = true;
      this.error = null;
      this.batchDetails = null;
      this.cleanupPreviousDownloadState();
      this.cdRef.detectChanges();
      this.fetchBatchDetails(this.effectiveBatchAccessId);
    }
  }

  isZipFile(filename: string): boolean {
    if (!filename) {
      return false;
    }
    const extension = filename.split('.').pop()?.toLowerCase();
    return extension === 'zip';
  }

  isDocxFile(filename: string): boolean { // <-- NEW METHOD
    if (!filename) {
      return false;
    }
    const extension = filename.split('.').pop()?.toLowerCase();
    return extension === 'docx';
  }

  navigateToPreview(batchAccessId: string | null, filename: string): void { // Made batchAccessId nullable to match effectiveBatchAccessId
    if (!batchAccessId || !filename) {
      console.error('Batch Access ID and filename are required for preview.');
      this.setDownloadStatus('Cannot navigate to preview: Missing batch ID or filename.', 'error');
      return;
    }
    this.router.navigate(['/preview', batchAccessId], {
      queryParams: { filename: filename }
    });
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
    const endpointUrl = `${this.API_BASE_URL}/api/batch-details/${accessId}`; // Uses file_bp prefix /api/
    this.http.get<BatchDetails>(endpointUrl)
      .pipe(
        tap(details => console.log('Batch details fetched:', details)),
        catchError((err: HttpErrorResponse) => {
          console.error('Error fetching batch details:', err);
          let userFriendlyError: string;
          // The screenshot shows a 503 Service Unavailable error from the network,
          // which the browser often masks as a CORS error. This typically results
          // in a status of 0 in Angular's HttpErrorResponse.
          if (err.status === 0 || err.status === 503) {
            userFriendlyError = 'Failed to connect to the server. The service may be temporarily unavailable. Please try again later.';
          } else if (err.status === 404) {
            userFriendlyError = `The requested batch (${accessId}) was not found. Please check the link.`;
          } else {
            // For other errors, try to get a specific message from the server response.
            userFriendlyError = `Failed to load batch details: ${err.error?.error || err.statusText || 'An unexpected error occurred.'}`;
          }
          this.error = userFriendlyError;
          return throwError(() => new Error(userFriendlyError));
        })
      )
      .subscribe({
        next: (details) => {
          this.batchDetails = details;
          this.isLoading = false;
          this.cdRef.detectChanges();
        },
        error: () => {
          // The error message is already set in catchError. This block just handles the loading state.
          this.isLoading = false;
          this.cdRef.detectChanges();
        }
      });
  }

  private cleanupPreviousDownloadState(): void {
    this.isProcessingDownload = false;
    this.downloadStatusMessage = null;
    this.downloadStatusType = 'info';
    this.individualProgress = {};
    this.currentDownloadingFile = null;
    this.downloadAllProgress = null;
    this.downloadAllProgressMessage = null;
    this.isDownloadingAll = false;
    this.cleanupSse();
    this.cdRef.detectChanges();
  }

  initiateDownloadAll(): void {
    if (!this.effectiveBatchAccessId || this.isProcessingDownload) return;

    this.cleanupPreviousDownloadState();
    this.isDownloadingAll = true;
    this.isProcessingDownload = true;
    this.downloadAllProgress = { percentage: 0, totalBytes: this.batchDetails?.total_size || 0 };
    this.setDownloadStatus('Initiating Download All (.zip)...', 'info');
    this.cdRef.detectChanges();

    // **FIXED URL HERE**
    const initiateUrl = `${this.API_BASE_URL}/download/initiate-download-all/${this.effectiveBatchAccessId}`;
    console.log('Initiating Download All with URL:', initiateUrl);

    this.http.get<DownloadAllInitiationResponse>(initiateUrl)
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
          // sse_stream_url from backend should be absolute or relative to API_BASE_URL
          // If it's relative like "/download/stream-download-all/...", API_BASE_URL will make it absolute.
          // The backend already provides a relative URL that should be correct with the /download prefix.
          const sseUrl = response.sse_stream_url.startsWith('http') ? response.sse_stream_url : `${this.API_BASE_URL}${response.sse_stream_url}`;
          this.setupSseConnection(sseUrl);
        } else {
          const errorMsg = response.error || "Invalid response from Download All initiation endpoint.";
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
    // The download_sse_bp is registered at the root, so no prefix needed for /download-single/
    const sseUrl = `${this.API_BASE_URL}/download-single/${this.effectiveBatchAccessId}/${encodedFilename}`;

    console.log(`Connecting to SSE for individual file: ${sseUrl}`);
    this.setupSseConnection(sseUrl);
  }

  private setupSseConnection(streamUrl: string): void {
    if (this.currentSse) {
      this.currentSse.close();
    }
    this.cdRef.detectChanges();

    console.log(`Connecting to SSE: ${streamUrl}`);
    this.currentSse = new EventSource(streamUrl); // Removed withCredentials for now, add if needed & CORS configured

    this.currentSse.onopen = () => this.zone.run(() => {
      console.log("SSE connection opened to:", streamUrl);
      this.setDownloadStatus('Connection established. Preparing file...', 'info');
    });

    this.currentSse.addEventListener('status', (event: MessageEvent) => this.zone.run(() => {
      console.log("SSE 'status':", event.data);
      try {
        const data: SseStatusPayload = JSON.parse(event.data);
        const message = data.message || 'Processing...';
        if (this.isDownloadingAll && this.downloadAllProgress) {
          this.downloadAllProgressMessage = message;
        } else if (this.currentDownloadingFile) { // Only set general status if not for 'Download All'
          this.setDownloadStatus(message, 'info');
        }
      } catch (e) {
        if (this.isDownloadingAll) this.downloadAllProgressMessage = event.data;
        else this.setDownloadStatus(event.data, 'info');
      }
      this.cdRef.detectChanges();
    }));

    this.currentSse.addEventListener('progress', (event: MessageEvent) => this.zone.run(() => {
      try {
        const rawData = JSON.parse(event.data);
        const progressData: SseProgressPayload = {
          percentage: Number(rawData.percentage) || 0,
          bytesSent: rawData.bytesSent !== undefined ? Number(rawData.bytesSent) : undefined,
          bytesProcessed: rawData.bytesProcessed !== undefined ? Number(rawData.bytesProcessed) : undefined,
          totalBytes: rawData.totalBytes !== undefined ? Number(rawData.totalBytes) : (this.isDownloadingAll ? this.downloadAllProgress?.totalBytes : (this.currentDownloadingFile ? this.individualProgress[this.currentDownloadingFile]?.totalBytes : undefined)),
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
          this.downloadStatusMessage = null; // Let progress bar show status
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
        if (!sseData.temp_file_id || !sseData.final_filename) throw new Error("Missing temp_file_id or final_filename from 'ready' event");

        if (this.isDownloadingAll && this.downloadAllProgress) {
          this.downloadAllProgress = { ...this.downloadAllProgress, percentage: 100 };
          this.downloadAllProgressMessage = "Zip file ready!";
        } else if (this.currentDownloadingFile && this.individualProgress[this.currentDownloadingFile]) {
          this.individualProgress[this.currentDownloadingFile] = {
            ...(this.individualProgress[this.currentDownloadingFile] as SseProgressPayload), percentage: 100
          };
        }
        this.cdRef.detectChanges();

        // The serve-temp-file endpoint is also under the /download prefix
        const finalDownloadUrl = `${this.API_BASE_URL}/download/serve-temp-file/${sseData.temp_file_id}/${encodeURIComponent(sseData.final_filename)}`;
        this.setDownloadStatus(`Download ready: ${sseData.final_filename}. Starting...`, 'success');
        console.log(`Triggering file download from: ${finalDownloadUrl}`);
        window.location.href = finalDownloadUrl; // Triggers browser download

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
      const eventData = (event as MessageEvent).data;
      console.error("SSE 'error' event data:", eventData || event);
      let errorMsg = 'An error occurred during file preparation stream.';
      if (eventData) {
        try { errorMsg = `Error: ${JSON.parse(eventData).message || 'Unknown server error.'}`; }
        catch (e) { errorMsg = `Error: ${eventData || 'Server stream error.'}`; }
      }
      this.setDownloadStatus(errorMsg, 'error');
      this.cleanupPreviousDownloadState();
    }));

    this.currentSse.onerror = (err: Event) => this.zone.run(() => {
      if (this.currentSse && this.currentSse.readyState !== EventSource.CLOSED) { // Check if it's not an intentional close
        if (this.isProcessingDownload) {
          console.error("SSE EventSource connection error (onerror):", err, "URL:", streamUrl);
          this.setDownloadStatus('Connection lost or server error during file preparation.', 'error');
        } else {
          console.log("SSE EventSource error (onerror) after processing or manual close:", err);
        }
        this.cleanupPreviousDownloadState();
      } else {
        console.log("SSE EventSource (onerror) but readyState is CLOSED. Likely manual close.");
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
      case 'zip': case 'rar': case '7z': case 'tar': case 'gz':
        iconClass = 'fa fa-file-archive-o';
        break;
      case 'pdf': iconClass = 'fa fa-file-pdf-o'; break;
      case 'doc': case 'docx': iconClass = 'fa fa-file-word-o'; break;
      case 'xls': case 'xlsx': iconClass = 'fa fa-file-excel-o'; break;
      case 'ppt': case 'pptx': iconClass = 'fa fa-file-powerpoint-o'; break;
      case 'jpg': case 'jpeg': case 'png': case 'gif': case 'bmp': case 'svg': case 'webp':
        iconClass = 'fa fa-file-image-o'; break;
      case 'mp3': case 'wav': case 'ogg': case 'aac': case 'flac':
        iconClass = 'fa fa-file-audio-o'; break;
      case 'mp4': case 'mov': case 'avi': case 'mkv': case 'wmv':
        iconClass = 'fa fa-file-video-o'; break;
      case 'txt': iconClass = 'fa fa-file-text-o'; break;
      case 'js': case 'ts': case 'html': case 'css': case 'scss': case 'json': case 'xml': case 'py': case 'java': case 'c': case 'cpp':
        iconClass = 'fa fa-file-code-o'; break;
    }
    return iconClass;
  }

  ngOnDestroy(): void {
    this.cleanupPreviousDownloadState();
    this.routeSubscription?.unsubscribe();
  }
}