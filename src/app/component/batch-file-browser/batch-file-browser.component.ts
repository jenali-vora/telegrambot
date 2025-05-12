import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common'; // Added DecimalPipe
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, Subscription, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

import {
  BatchDetails,
  FileInBatchInfo,
  DownloadAllInitiationResponse,
  SseReadyPayload,
  SseProgressPayload, // Ensure this is correctly defined as per Step 1
  SseStatusPayload
} from '../../interfaces/batch.interfaces';

import { ByteFormatPipe } from '../../shared/pipes/byte-format.pipe';

@Component({
  selector: 'app-batch-file-browser',
  standalone: true,
  imports: [CommonModule, RouterLink, ByteFormatPipe, DatePipe, DecimalPipe], // Added DecimalPipe
  templateUrl: './batch-file-browser.component.html',
  styleUrls: ['./batch-file-browser.component.css'],
  providers: [DatePipe, DecimalPipe] // Added DecimalPipe
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
  isProcessingDownload = false; // General flag to disable buttons

  // --- Progress related state ---
  individualProgress: { [key: string]: SseProgressPayload | null } = {};
  currentDownloadingFile: string | null = null; // Filename of the individual file being downloaded/prepared

  downloadAllProgress: SseProgressPayload | null = null;
  downloadAllProgressMessage: string | null = null; // For stage messages during "Download All"
  isDownloadingAll: boolean = false; // True if "Download All" (zip) operation is active
  // --- End Progress related state ---

  private currentSse: EventSource | null = null;
  private routeSubscription: Subscription | null = null;
  private readonly API_BASE_URL = environment.apiUrl;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['batchAccessIdInput'] && this.batchAccessIdInput) {
      this.effectiveBatchAccessId = this.batchAccessIdInput;
      this.resetStateAndFetch();
    } else if (changes['batchAccessIdInput'] && !this.batchAccessIdInput && this.effectiveBatchAccessId) {
      this.batchDetails = null; // Clear details
      this.error = "Batch ID input removed.";
      this.isLoading = false;
      this.cleanupPreviousDownloadState(); // Reset download related state
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
          this.cleanupPreviousDownloadState(); // Reset download state
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
      this.cleanupPreviousDownloadState(); // This handles SSE, progress vars, status messages
      this.cdRef.detectChanges();
      this.fetchBatchDetails(this.effectiveBatchAccessId);
    }
  }

  fetchBatchDetails(accessId: string): void {
    // ... (fetchBatchDetails implementation remains the same as your provided code)
    if (!accessId) {
      this.error = "Access ID is missing for fetching batch details.";
      this.isLoading = false;
      this.cdRef.detectChanges();
      return;
    }
    this.isLoading = true;
    this.error = null;
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
          return throwError(() => err);
        })
      )
      .subscribe({
        next: (details) => {
          this.batchDetails = details;
          this.isLoading = false;
          this.cdRef.detectChanges();
        },
        error: () => {
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

    this.cleanupPreviousDownloadState(); // Clear previous state first
    this.isDownloadingAll = true;
    this.isProcessingDownload = true; // Disables buttons
    this.downloadAllProgress = { percentage: 0 }; // Show progress bar immediately
    this.setDownloadStatus('Initiating Download All (.zip)...', 'info'); // General status
    this.cdRef.detectChanges();

    console.log(`Download All clicked for access_id: ${this.effectiveBatchAccessId}`);
    this.http.get<DownloadAllInitiationResponse>(`${this.API_BASE_URL}/initiate-download-all/${this.effectiveBatchAccessId}`)
      .pipe(
        catchError(err => {
          const errorMsg = err.error?.error || err.message || `HTTP error ${err.status}`;
          console.error("Error initiating Download All:", errorMsg);
          this.setDownloadStatus(`Error: ${errorMsg}`, 'error');
          // Reset flags specific to this operation if it fails at initiation
          this.isDownloadingAll = false;
          this.isProcessingDownload = false; // Re-enable buttons
          this.downloadAllProgress = null;
          this.cdRef.detectChanges();
          return throwError(() => new Error(errorMsg));
        })
      )
      .subscribe(response => {
        if (response.sse_stream_url) {
          const sseUrl = response.sse_stream_url.startsWith('http') ? response.sse_stream_url : `${this.API_BASE_URL}${response.sse_stream_url}`;
          this.setupSseConnection(sseUrl); // Removed isDownloadAll param
        } else {
          const errorMsg = response.error || "Invalid response from initiation endpoint.";
          this.setDownloadStatus(`Error: ${errorMsg}`, 'error');
          this.isDownloadingAll = false;
          this.isProcessingDownload = false; // Re-enable buttons
          this.downloadAllProgress = null;
          this.cdRef.detectChanges();
        }
      });
  }

  initiateIndividualDownload(file: FileInBatchInfo): void {
    if (!this.effectiveBatchAccessId || !file.original_filename || this.isProcessingDownload) return;

    this.cleanupPreviousDownloadState(); // Clear previous state first
    this.currentDownloadingFile = file.original_filename;
    this.isProcessingDownload = true; // Disables buttons
    this.individualProgress[file.original_filename] = { percentage: 0 }; // Show progress bar
    this.setDownloadStatus(`Initiating download for ${file.original_filename}...`, 'info');
    this.cdRef.detectChanges();

    const encodedFilename = encodeURIComponent(file.original_filename);
    const sseUrl = `${this.API_BASE_URL}/download-single/${this.effectiveBatchAccessId}/${encodedFilename}`;
    this.setupSseConnection(sseUrl); // Removed isDownloadAll param
  }

  private setupSseConnection(streamUrl: string): void { // Removed isDownloadAll parameter
    // cleanupSse is called by cleanupPreviousDownloadState, so not strictly needed here
    // if called before, but as a safeguard:
    if (this.currentSse) {
      this.currentSse.close();
    }

    // isProcessingDownload and initial status message set by caller
    this.cdRef.detectChanges();

    console.log(`Connecting to SSE: ${streamUrl}`);
    this.currentSse = new EventSource(streamUrl);

    this.currentSse.onopen = () => this.zone.run(() => {
      console.log("SSE connection opened.");
      this.setDownloadStatus('Connection established. Preparing file...', 'info');
    });

    this.currentSse.addEventListener('status', (event: MessageEvent) => this.zone.run(() => {
      console.log("SSE 'status':", event.data);
      try {
        const data: SseStatusPayload = JSON.parse(event.data);
        const message = data.message || 'Processing...';
        if (this.isDownloadingAll && this.downloadAllProgress) {
          this.downloadAllProgressMessage = message; // Show status as part of progress details
        } else {
          this.setDownloadStatus(message, 'info');
        }
      } catch (e) { this.setDownloadStatus(event.data, 'info'); }
      this.cdRef.detectChanges();
    }));

    this.currentSse.addEventListener('progress', (event: MessageEvent) => this.zone.run(() => {
      try {
        const rawData = JSON.parse(event.data);
        // Ensure numbers are parsed correctly, provide defaults for undefined
        const progressData: SseProgressPayload = {
          percentage: Number(rawData.percentage) || 0,
          bytesSent: rawData.bytesSent !== undefined ? Number(rawData.bytesSent) : undefined,
          bytesProcessed: rawData.bytesProcessed !== undefined ? Number(rawData.bytesProcessed) : undefined,
          totalBytes: rawData.totalBytes !== undefined ? Number(rawData.totalBytes) : undefined,
          speedMBps: rawData.speedMBps !== undefined ? Number(rawData.speedMBps) : undefined,
          etaFormatted: rawData.etaFormatted || this.formatTime(NaN), // Use existing formatTime
          etaSeconds: rawData.etaSeconds !== undefined ? Number(rawData.etaSeconds) : undefined,
        };

        // console.log("SSE 'progress' data (parsed):", progressData);

        if (this.isDownloadingAll) {
          this.downloadAllProgress = progressData;
          if (progressData.percentage < 100) {
            // Optional: Update general status or let progress bar convey it
            // this.setDownloadStatus(`Overall process: ${progressData.percentage.toFixed(0)}%`, 'info');
          }
        } else if (this.currentDownloadingFile && this.individualProgress.hasOwnProperty(this.currentDownloadingFile)) {
          this.individualProgress[this.currentDownloadingFile] = progressData;
          if (progressData.percentage < 100) {
            // this.setDownloadStatus(`Preparing ${this.currentDownloadingFile}: ${progressData.percentage.toFixed(0)}%`, 'info');
          }
        }
        // Hide general status message if a progress bar is active to avoid overlap
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

        // Mark progress as 100%
        if (this.isDownloadingAll && this.downloadAllProgress) {
          this.downloadAllProgress = { ...this.downloadAllProgress, percentage: 100 };
        } else if (this.currentDownloadingFile && this.individualProgress[this.currentDownloadingFile]) {
          this.individualProgress[this.currentDownloadingFile] = {
            ...(this.individualProgress[this.currentDownloadingFile] as SseProgressPayload), percentage: 100
          };
        }
        this.cdRef.detectChanges(); // Show 100%

        const finalDownloadUrl = `${this.API_BASE_URL}/serve-temp-file/${sseData.temp_file_id}/${encodeURIComponent(sseData.final_filename)}`;
        this.setDownloadStatus(`Download ready: ${sseData.final_filename}. Starting download...`, 'success');
        console.log(`Preparation complete. Triggering download: ${finalDownloadUrl}`);

        window.location.href = finalDownloadUrl;

        setTimeout(() => {
          this.cleanupPreviousDownloadState(); // Full reset for next operation
        }, 5000); // User sees success msg and 100% for a bit
      } catch (e: any) {
        console.error("Error processing 'ready' event:", e);
        this.setDownloadStatus(`Error finalizing download: ${e.message || 'Unknown error'}`, 'error');
        this.cleanupPreviousDownloadState(); // Reset on error too
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
      this.cleanupPreviousDownloadState(); // Reset
    }));

    this.currentSse.onerror = (err: Event) => this.zone.run(() => {
      if (this.currentSse) {
        if (this.isProcessingDownload) { // If we were expecting more data
          console.error("SSE EventSource connection error:", err);
          this.setDownloadStatus('Connection lost or server error during file preparation.', 'error');
        } else {
          console.log("SSE EventSource error after processing seemed complete or was manually closed:", err);
        }
        this.cleanupPreviousDownloadState(); // Reset
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
    // Only show general status if no specific progress bar is active, or it's a final success/error
    if (message && ((this.isDownloadingAll && this.downloadAllProgress) || this.currentDownloadingFile) && type === 'info' && message.startsWith('Preparing')) {
      // Let progress bar convey detailed info, maybe keep a simpler general message or none
      // this.downloadStatusMessage = null; // Example: clear general message
    } else {
      this.downloadStatusMessage = message;
    }
    this.downloadStatusType = type;
    this.cdRef.detectChanges();
  }

  formatTime(seconds: number | undefined): string {
    // ... (formatTime implementation remains the same)
    if (seconds === undefined || isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return "--:--";
    seconds = Math.round(seconds);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) { return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`; }
    else { return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`; }
  }

  formatUploadDate(timestamp: string | Date | undefined): string {
    // ... (formatUploadDate implementation remains the same)
    if (!timestamp) return 'N/A';
    try {
      return this.datePipe.transform(timestamp, 'yyyy-MM-dd HH:mm') || 'Invalid Date';
    } catch (e) {
      return 'Invalid Date';
    }
  }
  getFileIconClass(filename: string): string {
    if (!filename) {
      return 'fa fa-file-o'; // Default icon if no filename
    }

    const extension = filename.split('.').pop()?.toLowerCase();
    let iconClass = 'fa fa-file-o'; // Default file icon

    switch (extension) {
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
      case 'gz':
        iconClass = 'fa fa-file-archive-o'; // Archive icon (like in screenshot 2)
        break;
      case 'pdf':
        iconClass = 'fa fa-file-pdf-o';
        break;
      case 'doc':
      case 'docx':
        iconClass = 'fa fa-file-word-o';
        break;
      case 'xls':
      case 'xlsx':
        iconClass = 'fa fa-file-excel-o';
        break;
      case 'ppt':
      case 'pptx':
        iconClass = 'fa fa-file-powerpoint-o';
        break;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'svg':
      case 'webp': // Added webp
        iconClass = 'fa fa-file-image-o';
        break;
      case 'mp3':
      case 'wav':
      case 'ogg':
      case 'aac':
        iconClass = 'fa fa-file-audio-o';
        break;
      case 'mp4':
      case 'mov':
      case 'avi':
      case 'mkv':
      case 'wmv':
        iconClass = 'fa fa-file-video-o';
        break;
      case 'txt':
        iconClass = 'fa fa-file-text-o';
        break;
      case 'js':
      case 'ts':
      case 'html':
      case 'css':
      case 'scss':
      case 'json':
      case 'xml':
      case 'py':
      case 'java':
      case 'c':
      case 'cpp':
        iconClass = 'fa fa-file-code-o';
        break;
      // Add more cases as needed
    }

    return iconClass; // Return the determined class (e.g., 'fa fa-file-archive-o')
  }

  ngOnDestroy(): void {
    this.cleanupPreviousDownloadState(); // Ensures SSE is closed and state is clean
    this.routeSubscription?.unsubscribe();
  }
}