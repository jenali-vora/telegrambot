import { Component, OnInit, OnDestroy, SecurityContext } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { FileManagerApiService } from '../../services/file-manager-api.service'; // Adjust path
import { PreviewDetails } from '../../../interfaces/batch.interfaces'; // Adjust path
import { CommonModule, DatePipe } from '@angular/common'; // For ngIf, ngSwitch, date pipe
import { ByteFormatPipe } from '../../pipes/byte-format.pipe'; // Adjust path
import { environment } from 'src/environments/environment';

// Optional for syntax highlighting
// import { HighlightModule } from 'ngx-highlightjs'; // If using ngx-highlightjs

@Component({
  selector: 'app-file-preview',
  standalone: true,
  imports: [
    CommonModule,
    ByteFormatPipe, // Make sure this pipe is standalone or part of a shared module
    DatePipe,
    // HighlightModule // If using ngx-highlightjs
  ],
  templateUrl: './file-preview.component.html',
  styleUrls: ['./file-preview.component.css']
})
export class FilePreviewComponent implements OnInit, OnDestroy {
  accessId: string | null = null;
  filenameQueryParam: string | null = null;
  previewDetails: PreviewDetails | null = null;
  isLoading = true;
  errorMessage: string | null = null;

  rawTextContent: string | null = null;
  sanitizedContentUrl: SafeResourceUrl | null = null;

  // For the "Download" button - this needs to be adapted from your batch-file-browser.component.ts
  // It will use the main accessId of the file being previewed.
  isPreparingDownload = false;
  downloadStatusMessage: string | null = null;
  downloadStatusType: 'info' | 'error' | 'success' = 'info';
  downloadProgress: any = null; // Simplified for now
  currentSse: EventSource | null = null;


  private subscriptions: Subscription = new Subscription();
  private readonly API_BASE_URL = environment.apiUrl; // Assuming you have environment setup

  constructor(
    private route: ActivatedRoute,
    private fileApiManagerService: FileManagerApiService, // Use your actual service name
    private sanitizer: DomSanitizer
  ) { }

  ngOnInit(): void {
    this.accessId = this.route.snapshot.paramMap.get('accessId');
    this.filenameQueryParam = this.route.snapshot.queryParamMap.get('filename');

    if (!this.accessId) {
      this.errorMessage = 'No file access ID provided in URL.';
      this.isLoading = false;
      return;
    }
    this.loadPreviewDetails();
  }

  loadPreviewDetails(): void {
    if (!this.accessId) return;

    this.isLoading = true;
    this.errorMessage = null;
    this.previewDetails = null;
    this.rawTextContent = null;
    this.sanitizedContentUrl = null;

    const previewSub = this.fileApiManagerService.getPreviewDetails(this.accessId, this.filenameQueryParam)
      .subscribe({
        next: (data) => {
          this.previewDetails = data;
          this.isLoading = false; // Set loading to false after details are fetched

          if (data.preview_type === 'expired') {
            this.errorMessage = 'This file link has expired.';
            return; // Stop further processing for expired files
          }

          if (data.preview_content_url) {
            const fullContentUrl = data.preview_content_url.startsWith('http')
              ? data.preview_content_url
              : `${this.API_BASE_URL}${data.preview_content_url}`;

            if (data.preview_type === 'code' || data.preview_type === 'text' ||
              data.preview_type === 'markdown' || data.preview_type === 'directory_listing') {
              this.fetchRawText(fullContentUrl); // fetchRawText will set isLoading = false
            } else if (data.preview_type === 'image' || data.preview_type === 'video' ||
              data.preview_type === 'pdf' || data.preview_type === 'audio') {
              this.sanitizedContentUrl = this.sanitizer.bypassSecurityTrustResourceUrl(fullContentUrl);
              // isLoading should be false here
            } else {
              // For 'unsupported' or other types, isLoading is already false.
            }
          } else if (data.preview_data) {
            this.rawTextContent = data.preview_data;
            // isLoading is already false
          }
          // No specific else for isLoading here, it's handled by initial true and set to false in branches
        },
        error: (err) => {
          this.isLoading = false;
          if (err.status === 410 || (err.message && err.message.toLowerCase().includes('expired'))) {
            this.previewDetails = { preview_type: 'expired' } as PreviewDetails;
            this.errorMessage = err.message || 'This file link has expired.';
          } else {
            this.errorMessage = err.message || err.error?.error || 'Failed to load file details.';
          }
          console.error('Error fetching preview details:', err);
        }
      });
    this.subscriptions.add(previewSub);
  }

  fetchRawText(url: string): void {
    // isLoading should already be true from loadPreviewDetails
    const rawTextSub = this.fileApiManagerService.getRawTextContent(url).subscribe({
      next: (textData) => {
        this.rawTextContent = textData;
        this.isLoading = false; // Content loaded
      },
      error: (err) => {
        this.errorMessage = 'Failed to load file content for preview.';
        this.isLoading = false; // Error occurred
        console.error('Error fetching raw text content:', err);
      }
    });
    this.subscriptions.add(rawTextSub);
  }

  // Download button logic - adapted from your BatchFileBrowserComponent
  // This will download the single file being previewed.
  onDownloadClick(): void {
    if (!this.accessId || !this.previewDetails || this.isPreparingDownload) return;

    this.isPreparingDownload = true;
    this.downloadStatusMessage = `Initiating download for ${this.previewDetails.filename}...`;
    this.downloadStatusType = 'info';
    this.downloadProgress = { percentage: 0, totalBytes: this.previewDetails.size };

    let sseUrlForDownload: string;
    if (this.filenameQueryParam) { // Means it was a file from a multi-item batch
      const encodedFilename = encodeURIComponent(this.filenameQueryParam);
      sseUrlForDownload = `${this.API_BASE_URL}/download-single/${this.accessId}/${encodedFilename}`;
    } else { // It was a direct access to a single file (or batch-of-one) record
      sseUrlForDownload = `${this.API_BASE_URL}/stream-download/${this.accessId}`;
    }
    this.setupSseForDownload(sseUrlForDownload);
  }

  private setupSseForDownload(streamUrl: string): void {
    if (this.currentSse) {
      this.currentSse.close();
    }
    this.currentSse = new EventSource(streamUrl); // Assuming withCredentials is not needed or handled globally

    this.currentSse.onopen = () => {
      console.log("Download SSE connection opened:", streamUrl);
      this.downloadStatusMessage = 'Connection established. Preparing download...';
    };

    this.currentSse.addEventListener('status', (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      this.downloadStatusMessage = data.message || 'Processing...';
    });

    this.currentSse.addEventListener('progress', (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      this.downloadProgress = {
        percentage: Number(data.percentage) || 0,
        bytesProcessed: Number(data.bytesProcessed ?? data.bytesSent) || 0,
        totalBytes: Number(data.totalBytes ?? this.previewDetails?.size) || 0,
        speedMBps: Number(data.speedMBps) || 0,
        etaFormatted: data.etaFormatted || this.formatTime(NaN),
      };
    });

    this.currentSse.addEventListener('ready', (event: MessageEvent) => {
      if (this.currentSse) this.currentSse.close();
      const data = JSON.parse(event.data);
      if (!data.temp_file_id || !data.final_filename) {
        this.downloadStatusMessage = 'Error: Incomplete server response for download.';
        this.downloadStatusType = 'error';
        this.isPreparingDownload = false;
        return;
      }
      this.downloadProgress = { ...this.downloadProgress, percentage: 100 };
      this.downloadStatusMessage = `Download ready: ${data.final_filename}. Starting...`;
      this.downloadStatusType = 'success';
      window.location.href = `${this.API_BASE_URL}/serve-temp-file/${data.temp_file_id}/${encodeURIComponent(data.final_filename)}`;
      setTimeout(() => {
        this.isPreparingDownload = false;
        this.downloadStatusMessage = null; // Clear status after a bit
        this.downloadProgress = null;
      }, 5000);
    });

    this.currentSse.addEventListener('error', (event: MessageEvent | Event) => {
      if (this.currentSse) this.currentSse.close();
      let errorMsg = 'Error during download preparation stream.';
      if ((event as MessageEvent).data) { try { errorMsg = `Error: ${JSON.parse((event as MessageEvent).data).message}`; } catch (e) { } }
      this.downloadStatusMessage = errorMsg;
      this.downloadStatusType = 'error';
      this.isPreparingDownload = false;
      this.downloadProgress = null;
    });

    this.currentSse.onerror = (err: Event) => { // General SSE connection error
      if (this.currentSse) {
        this.currentSse.close();
        if (this.isPreparingDownload) { // If we were actually in the middle of something
          this.downloadStatusMessage = 'Connection lost during download preparation.';
          this.downloadStatusType = 'error';
        }
      }
      this.isPreparingDownload = false;
      this.downloadProgress = null;
    };
  }

  // Helper to get language for syntax highlighter (can be expanded)
  getLanguageForCode(): string {
    if (this.previewDetails?.filename) {
      const ext = this.previewDetails.filename.split('.').pop()?.toLowerCase();
      switch (ext) {
        case 'py': return 'python';
        case 'js': return 'javascript';
        // ... add more from previous example ...
        default: return 'plaintext';
      }
    }
    return 'plaintext';
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

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.currentSse) {
      this.currentSse.close();
    }
  }
}