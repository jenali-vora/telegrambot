import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone, Input, OnChanges, SimpleChanges } from '@angular/core'; // Added Input, OnChanges, SimpleChanges
import { CommonModule, DatePipe } from '@angular/common';
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
  SseProgressPayload,
  SseStatusPayload
} from '../../interfaces/batch.interfaces';

import { ByteFormatPipe } from '../../shared/pipes/byte-format.pipe';

@Component({
  selector: 'app-batch-file-browser',
  standalone: true,
  imports: [CommonModule, RouterLink, ByteFormatPipe, DatePipe],
  templateUrl: './batch-file-browser.component.html',
  styleUrls: ['./batch-file-browser.component.css'],
  providers: [DatePipe]
})
export class BatchFileBrowserComponent implements OnInit, OnDestroy, OnChanges { // Implement OnChanges
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private cdRef = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private datePipe = inject(DatePipe);

  @Input() batchAccessIdInput: string | null = null; // Renamed for clarity

  // This property will hold the effective batch ID, whether from input or route
  public effectiveBatchAccessId: string | null = null;

  batchDetails: BatchDetails | null = null;
  isLoading = true;
  error: string | null = null;

  downloadStatusMessage: string | null = null;
  downloadStatusType: 'info' | 'error' | 'success' = 'info';
  isProcessingDownload = false;

  private currentSse: EventSource | null = null;
  private routeSubscription: Subscription | null = null;

  private readonly API_BASE_URL = environment.apiUrl;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['batchAccessIdInput'] && this.batchAccessIdInput) {
      // Input has changed and is valid, prioritize it
      this.effectiveBatchAccessId = this.batchAccessIdInput;
      this.resetStateAndFetch();
    } else if (changes['batchAccessIdInput'] && !this.batchAccessIdInput && this.effectiveBatchAccessId) {
      // Input was removed, if component relies on route, it might need re-evaluation
      // or simply clear if it was solely dependent on input.
      // For now, if input becomes null, we clear. If it was also routed, ngOnInit would handle.
      this.batchDetails = null;
      this.error = "Batch ID input removed.";
      this.isLoading = false;
      this.cdRef.detectChanges();
    }
  }

  ngOnInit(): void {
    // If input is already set (e.g. component initialized with input), ngOnChanges handles it.
    // This OnInit logic is primarily for when the component is routed directly.
    if (!this.batchAccessIdInput) { // Only process route if no input is driving the component
      this.routeSubscription = this.route.paramMap.subscribe(params => {
        const accessIdFromRoute = params.get('accessId'); // 'accessId' must match the route param name (e.g., path: 'browse/:accessId')
        console.log('BatchFileBrowserComponent: Received accessId from route parameters:', accessIdFromRoute); // For debugging

        if (accessIdFromRoute) {
          this.effectiveBatchAccessId = accessIdFromRoute;
          this.resetStateAndFetch(); // This will call fetchBatchDetails with the ID
        } else {
          // No input and no route param
          this.error = 'Batch Access ID not found in URL and no input provided.';
          this.isLoading = false;
          this.cdRef.detectChanges();
          console.error('BatchFileBrowserComponent: Critical - accessIdFromRoute is null or undefined.');
        }
      });
    } else if (this.batchAccessIdInput && !this.effectiveBatchAccessId) {
      // Handles case where input is set before ngOnInit but ngOnChanges might not have run
      // or to ensure effectiveBatchAccessId is set if ngOnChanges didn't set it.
      this.effectiveBatchAccessId = this.batchAccessIdInput;
      this.resetStateAndFetch();
    } else if (this.effectiveBatchAccessId) {
      // If effectiveBatchAccessId was already set by ngOnChanges from an input
      this.resetStateAndFetch();
    }
  }

  private resetStateAndFetch(): void {
    if (this.effectiveBatchAccessId) {
      this.isLoading = true;
      this.error = null;
      this.batchDetails = null; // Clear previous details
      this.downloadStatusMessage = null; // Clear download status
      this.isProcessingDownload = false;
      this.cleanupSse(); // Clean up any existing SSE connection
      this.cdRef.detectChanges(); // Update UI for loading state
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

    // MODIFIED LINE: Prepend '/api' to the endpoint path
    const endpointUrl = `${this.API_BASE_URL}/api/batch-details/${accessId}`;
    console.log(`Fetching batch details from: ${endpointUrl}`); // For debugging

    this.http.get<BatchDetails>(endpointUrl) // Use the constructed endpointUrl
      .pipe(
        tap(details => console.log('Batch details fetched:', details)),
        catchError(err => {
          console.error('Error fetching batch details:', err);
          this.error = `Failed to load batch details for ${accessId}: ${err.statusText || err.message || 'Server error'}`;
          // More detailed error for 404
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
          // Error is already set in catchError, just ensure loading state is updated
          this.isLoading = false;
          this.cdRef.detectChanges();
        }
      });
  }


  initiateDownloadAll(): void {
    if (!this.effectiveBatchAccessId || this.isProcessingDownload) return;

    console.log(`Download All clicked for access_id: ${this.effectiveBatchAccessId}`);
    this.http.get<DownloadAllInitiationResponse>(`${this.API_BASE_URL}/initiate-download-all/${this.effectiveBatchAccessId}`)
      .pipe(
        catchError(err => {
          const errorMsg = err.error?.error || err.message || `HTTP error ${err.status}`;
          console.error("Error initiating Download All:", errorMsg);
          this.setDownloadStatus(`Error: ${errorMsg}`, 'error');
          this.isProcessingDownload = false;
          return throwError(() => new Error(errorMsg));
        })
      )
      .subscribe(response => {
        if (response.sse_stream_url) {
          console.log("Download All initiation successful. SSE URL:", response.sse_stream_url);
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
    if (!this.effectiveBatchAccessId || !file.original_filename || this.isProcessingDownload) return;

    console.log(`Individual download: BatchID=${this.effectiveBatchAccessId}, Filename=${file.original_filename}`);
    const encodedFilename = encodeURIComponent(file.original_filename);
    const sseUrl = `${this.API_BASE_URL}/download-single/${this.effectiveBatchAccessId}/${encodedFilename}`;
    this.setupSseConnection(sseUrl, false);
  }

  // ... (setupSseConnection, cleanupSse, setDownloadStatus, formatTime, formatUploadDate remain unchanged)
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
        const eta = data.etaFormatted || this.formatTime(NaN);
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

        window.location.href = finalDownloadUrl;

        this.cleanupSse();
        setTimeout(() => {
          this.isProcessingDownload = false;
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

    this.currentSse.onerror = (err: Event) => this.zone.run(() => {
      if (this.currentSse) {
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