import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, Subscription, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment'; // Your environment file

// Interfaces
import {
  BatchDetails,
  FileInBatchInfo,
  DownloadAllInitiationResponse,
  SseReadyPayload,
  SseProgressPayload,
  SseStatusPayload
} from '../../interfaces/batch.interfaces'; // Adjust path as needed

// Pipe
import { ByteFormatPipe } from '../../shared/pipes/byte-format.pipe'; // Adjust path as needed

@Component({
  selector: 'app-batch-file-browser',
  standalone: true,
  imports: [CommonModule, RouterLink, ByteFormatPipe, DatePipe],
  templateUrl: './batch-file-browser.component.html',
  styleUrls: ['./batch-file-browser.component.css'],
  providers: [DatePipe]
})
export class BatchFileBrowserComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private cdRef = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private datePipe = inject(DatePipe);

  batchAccessId: string | null = null;
  batchDetails: BatchDetails | null = null;
  isLoading = true;
  error: string | null = null;

  downloadStatusMessage: string | null = null;
  downloadStatusType: 'info' | 'error' | 'success' = 'info';
  isProcessingDownload = false;

  private currentSse: EventSource | null = null;
  private routeSubscription: Subscription | null = null;

  private readonly API_BASE_URL = environment.apiUrl;

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe(params => {
      this.batchAccessId = params.get('accessId'); // Assuming route is /your-path/:accessId
      if (this.batchAccessId) {
        this.fetchBatchDetails(this.batchAccessId);
      } else {
        this.error = 'Batch Access ID not found in URL.';
        this.isLoading = false;
        this.cdRef.detectChanges();
      }
    });
  }

  fetchBatchDetails(accessId: string): void {
    this.isLoading = true;
    this.error = null;
    this.http.get<BatchDetails>(`${this.API_BASE_URL}/batch-details/${accessId}`)
      .pipe(
        tap(details => console.log('Batch details fetched:', details)),
        catchError(err => {
          console.error('Error fetching batch details:', err);
          this.error = `Failed to load batch details: ${err.message || 'Server error'}`;
          return throwError(() => err);
        })
      )
      .subscribe({
        next: (details) => {
          this.batchDetails = details;
          // Jinja uses 'batch_name', 'username', 'upload_date', 'files', 'total_size', 'access_id'
          // Ensure your BatchDetails interface and backend response align.
          // If your backend sends 'batch_display_name', map it or use it directly.
          // The example interface uses `batch_name` from the template.
          this.isLoading = false;
          this.cdRef.detectChanges();
        },
        error: () => {
          this.isLoading = false;
          this.cdRef.detectChanges();
        }
      });
  }

  initiateDownloadAll(): void {
    if (!this.batchAccessId || this.isProcessingDownload) return;

    console.log(`Download All clicked for access_id: ${this.batchAccessId}`);
    this.http.get<DownloadAllInitiationResponse>(`${this.API_BASE_URL}/initiate-download-all/${this.batchAccessId}`)
      .pipe(
        catchError(err => {
          const errorMsg = err.error?.error || err.message || `HTTP error ${err.status}`;
          console.error("Error initiating Download All:", errorMsg);
          this.setDownloadStatus(`Error: ${errorMsg}`, 'error');
          this.isProcessingDownload = false; // Re-enable if initiation failed
          return throwError(() => new Error(errorMsg));
        })
      )
      .subscribe(response => {
        if (response.sse_stream_url) {
          console.log("Download All initiation successful. SSE URL:", response.sse_stream_url);
          // Note: SSE URLs might need to be relative to API_BASE_URL or absolute
          // For simplicity, assuming backend provides a full or directly usable path
          const sseUrl = response.sse_stream_url.startsWith('http') ? response.sse_stream_url : `${this.API_BASE_URL}${response.sse_stream_url}`;
          this.setupSseConnection(sseUrl, true);
        } else {
          const errorMsg = response.error || "Invalid response from initiation endpoint.";
          this.setDownloadStatus(`Error: ${errorMsg}`, 'error');
          this.isProcessingDownload = false;
        }
      });
  }

  initiateIndividualDownload(file: FileInBatchInfo): void {
    if (!this.batchAccessId || !file.original_filename || this.isProcessingDownload) return;

    console.log(`Individual download: BatchID=${this.batchAccessId}, Filename=${file.original_filename}`);
    const encodedFilename = encodeURIComponent(file.original_filename);
    // This SSE URL is directly constructed based on template logic
    const sseUrl = `${this.API_BASE_URL}/download-single/${this.batchAccessId}/${encodedFilename}`;
    this.setupSseConnection(sseUrl, false);
  }

  private setupSseConnection(streamUrl: string, isDownloadAll: boolean): void {
    if (this.currentSse) {
      this.currentSse.close();
      console.log("Closed previous SSE connection.");
    }

    this.isProcessingDownload = true;
    this.setDownloadStatus('Connecting...', 'info');
    this.cdRef.detectChanges();

    console.log(`Connecting to SSE: ${streamUrl}`);
    this.currentSse = new EventSource(streamUrl); // Consider withCredentials if needed

    this.currentSse.onopen = () => this.zone.run(() => {
      console.log("SSE connection opened.");
      this.setDownloadStatus('Connection established. Preparing file...', 'info');
    });

    this.currentSse.addEventListener('status', (event: MessageEvent) => this.zone.run(() => {
      console.log("SSE 'status':", event.data);
      try {
        const data: SseStatusPayload = JSON.parse(event.data);
        this.setDownloadStatus(data.message || 'Processing...', 'info');
      } catch (e) { this.setDownloadStatus(event.data, 'info'); }
    }));

    this.currentSse.addEventListener('progress', (event: MessageEvent) => this.zone.run(() => {
      try {
        const data: SseProgressPayload = JSON.parse(event.data);
        const percentage = data.percentage !== undefined ? data.percentage.toFixed(0) : '?';
        const speed = data.speedMBps !== undefined ? data.speedMBps.toFixed(1) : '?';
        const eta = data.etaFormatted || this.formatTime(NaN); // Use NaN for formatTime to get default
        this.setDownloadStatus(`Preparing: ${percentage}% (${speed} MB/s, ETA: ${eta})`, 'info');
      } catch (e) { console.error("Progress parse error", e); }
    }));

    this.currentSse.addEventListener('ready', (event: MessageEvent) => this.zone.run(() => {
      console.log("SSE 'ready':", event.data);
      try {
        const data: SseReadyPayload = JSON.parse(event.data);
        if (!data.temp_file_id || !data.final_filename) throw new Error("Missing temp_file_id or final_filename");

        const finalDownloadUrl = `${this.API_BASE_URL}/serve-temp-file/${data.temp_file_id}/${encodeURIComponent(data.final_filename)}`;
        console.log(`Preparation complete. Triggering download: ${finalDownloadUrl}`);
        this.setDownloadStatus(`Download ready: ${data.final_filename}`, 'success');

        window.location.href = finalDownloadUrl; // Triggers download

        this.cleanupSse();
        setTimeout(() => { // Delay re-enabling and clearing status
          this.isProcessingDownload = false;
          // this.setDownloadStatus(null, 'info'); // Optionally hide
          this.cdRef.detectChanges();
        }, 3000);
      } catch (e: any) {
        console.error("Error processing 'ready' event:", e);
        this.setDownloadStatus(`Error preparing download: ${e.message}`, 'error');
        this.cleanupSse();
        this.isProcessingDownload = false;
        this.cdRef.detectChanges();
      }
    }));

    this.currentSse.addEventListener('error', (event: MessageEvent) => this.zone.run(() => {
      console.error("SSE 'error' event data:", event.data);
      let errorMsg = 'An error occurred during file preparation.';
      try { if (event.data) { errorMsg = `Error: ${JSON.parse(event.data).message || 'Unknown server error.'}`; } }
      catch (e) { /* Use default message */ }
      this.setDownloadStatus(errorMsg, 'error');
      this.cleanupSse();
      this.isProcessingDownload = false;
      this.cdRef.detectChanges();
    }));

    this.currentSse.onerror = (err: Event) => this.zone.run(() => { // Generic EventSource error
      if (this.currentSse) { // Only if not closed by 'ready' or 'error' event
        console.error("SSE EventSource connection error:", err);
        this.setDownloadStatus('Connection lost or server error.', 'error');
        this.cleanupSse();
        this.isProcessingDownload = false;
        this.cdRef.detectChanges();
      }
    });
  }

  private cleanupSse(): void {
    if (this.currentSse) {
      this.currentSse.close();
      this.currentSse = null;
      console.log("SSE connection closed.");
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
      // Assuming timestamp is ISO 8601 string or Date object
      return this.datePipe.transform(timestamp, 'yyyy-MM-dd HH:mm') || 'Invalid Date';
    } catch (e) {
      return 'Invalid Date';
    }
  }

  ngOnDestroy(): void {
    this.cleanupSse();
    this.routeSubscription?.unsubscribe();
  }
}