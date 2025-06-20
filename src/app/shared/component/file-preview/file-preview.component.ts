// src/app/shared/component/file-preview/file-preview.component.ts
import { Component, OnInit, OnDestroy, SecurityContext, inject } from '@angular/core'; // Added inject
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { FileManagerApiService } from '../../services/file-manager-api.service';
import { PreviewDetails } from '../../../interfaces/batch.interfaces';
import { CommonModule, DatePipe } from '@angular/common';
import { ByteFormatPipe } from '../../pipes/byte-format.pipe';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-file-preview', standalone: true,
  imports: [CommonModule, ByteFormatPipe, DatePipe],
  templateUrl: './file-preview.component.html', styleUrls: ['./file-preview.component.css']
})
export class FilePreviewComponent implements OnInit, OnDestroy {
  accessId: string | null = null; filenameQueryParam: string | null = null;
  previewDetails: PreviewDetails | null = null; isLoading = true; errorMessage: string | null = null;
  rawTextContent: string | null = null; sanitizedContentUrl: SafeResourceUrl | null = null;
  isPreparingDownload = false; downloadStatusMessage: string | null = null;
  downloadStatusType: 'info' | 'error' | 'success' = 'info'; downloadProgress: any = null;
  currentSse: EventSource | null = null;
  private subscriptions: Subscription = new Subscription();
  private readonly API_BASE_URL = environment.apiUrl;

  private route = inject(ActivatedRoute);
  private fileApiManagerService = inject(FileManagerApiService);
  private sanitizer = inject(DomSanitizer);

  constructor() { } // Constructor can be empty if all injections are field injections

  ngOnInit(): void {
    this.accessId = this.route.snapshot.paramMap.get('accessId');
    this.filenameQueryParam = this.route.snapshot.queryParamMap.get('filename');
    if (!this.accessId) {
      this.errorMessage = 'No file access ID provided in URL.'; this.isLoading = false; return;
    }
    this.loadPreviewDetails();
  }

  loadPreviewDetails(): void {
    if (!this.accessId) return;
    this.isLoading = true; this.errorMessage = null; this.previewDetails = null;
    this.rawTextContent = null; this.sanitizedContentUrl = null;

    const previewSub = this.fileApiManagerService.getPreviewDetails(this.accessId, this.filenameQueryParam)
      .subscribe({
        next: (data) => {
          this.previewDetails = data; this.isLoading = false;
          if (data.preview_type === 'expired') { this.errorMessage = 'This file link has expired.'; return; }
          if (data.preview_content_url) {
            const fullContentUrl = data.preview_content_url.startsWith('http') ? data.preview_content_url : `${this.API_BASE_URL}${data.preview_content_url}`;
            if (['code', 'text', 'markdown', 'directory_listing'].includes(data.preview_type)) this.fetchRawText(fullContentUrl);
            else if (['image', 'video', 'pdf', 'audio'].includes(data.preview_type)) this.sanitizedContentUrl = this.sanitizer.bypassSecurityTrustResourceUrl(fullContentUrl);
          } else if (data.preview_data) this.rawTextContent = data.preview_data;
        },
        error: (err) => {
          this.isLoading = false;
          if (err.status === 410 || (err.message && err.message.toLowerCase().includes('expired'))) {
            this.previewDetails = { preview_type: 'expired' } as PreviewDetails;
            this.errorMessage = err.message || 'This file link has expired.';
          } else this.errorMessage = err.message || err.error?.error || 'Failed to load file details.';
          console.error('Error fetching preview details:', err);
        }
      });
    this.subscriptions.add(previewSub);
  }

  fetchRawText(url: string): void {
    const rawTextSub = this.fileApiManagerService.getRawTextContent(url).subscribe({
      next: (textData) => { this.rawTextContent = textData; this.isLoading = false; },
      error: (err) => {
        this.errorMessage = 'Failed to load file content for preview.'; this.isLoading = false;
        console.error('Error fetching raw text content:', err);
      }
    });
    this.subscriptions.add(rawTextSub);
  }

  onDownloadClick(): void {
    if (!this.accessId || !this.previewDetails || this.isPreparingDownload) return;
    this.isPreparingDownload = true;
    this.downloadStatusMessage = `Initiating download for ${this.previewDetails.filename}...`;
    this.downloadStatusType = 'info'; this.downloadProgress = { percentage: 0, totalBytes: this.previewDetails.size };
    let sseUrlForDownload: string;
    if (this.filenameQueryParam) sseUrlForDownload = `${this.API_BASE_URL}/download-single/${this.accessId}/${encodeURIComponent(this.filenameQueryParam)}`;
    else sseUrlForDownload = `${this.API_BASE_URL}/stream-download/${this.accessId}`;
    this.setupSseForDownload(sseUrlForDownload);
  }

  private setupSseForDownload(streamUrl: string): void {
    if (this.currentSse) this.currentSse.close();
    this.currentSse = new EventSource(streamUrl);
    this.currentSse.onopen = () => { console.log("Download SSE connection opened:", streamUrl); this.downloadStatusMessage = 'Connection established. Preparing download...'; };
    this.currentSse.addEventListener('status', (event: MessageEvent) => { const data = JSON.parse(event.data); this.downloadStatusMessage = data.message || 'Processing...'; });
    this.currentSse.addEventListener('progress', (event: MessageEvent) => {
      const data = JSON.parse(event.data); const percentage = Number(data.percentage) || 0;
      const totalBytes = Number(data.totalBytes ?? this.previewDetails?.size) || 0;
      let bytesProcessed = Number(data.bytesProcessed ?? data.bytesSent) || 0;
      if (percentage >= 100 && totalBytes > 0) bytesProcessed = totalBytes;
      this.downloadProgress = { percentage, bytesProcessed, totalBytes, speedMBps: Number(data.speedMBps) || 0, etaFormatted: data.etaFormatted || this.formatTime(NaN) };
    });
    this.currentSse.addEventListener('ready', (event: MessageEvent) => {
      if (this.currentSse) this.currentSse.close(); const data = JSON.parse(event.data);
      if (!data.temp_file_id || !data.final_filename) {
        this.downloadStatusMessage = 'Error: Incomplete server response for download.'; this.downloadStatusType = 'error';
        this.isPreparingDownload = false; return;
      }
      const finalTotalBytes = this.downloadProgress?.totalBytes || this.previewDetails?.size || 0;
      this.downloadProgress = { percentage: 100, bytesProcessed: finalTotalBytes, totalBytes: finalTotalBytes };
      this.downloadStatusMessage = `Download ready: ${data.final_filename}. Starting...`; this.downloadStatusType = 'success';
      window.location.href = `${this.API_BASE_URL}/download/serve-temp-file/${data.temp_file_id}/${encodeURIComponent(data.final_filename)}`;
      setTimeout(() => { this.isPreparingDownload = false; this.downloadStatusMessage = null; this.downloadProgress = null; }, 5000);
    });
    this.currentSse.addEventListener('error', (event: MessageEvent | Event) => {
      if (this.currentSse) this.currentSse.close(); let errorMsg = 'Error during download preparation stream.';
      if ((event as MessageEvent).data) { try { errorMsg = `Error: ${JSON.parse((event as MessageEvent).data).message}`; } catch (e) { } }
      this.downloadStatusMessage = errorMsg; this.downloadStatusType = 'error';
      this.isPreparingDownload = false; this.downloadProgress = null;
    });
    this.currentSse.onerror = (err: Event) => {
      if (this.currentSse) { this.currentSse.close(); if (this.isPreparingDownload) { this.downloadStatusMessage = 'Connection lost during download preparation.'; this.downloadStatusType = 'error'; } }
      this.isPreparingDownload = false; this.downloadProgress = null;
    };
  }

  getLanguageForCode(): string {
    if (this.previewDetails?.filename) {
      const ext = this.previewDetails.filename.split('.').pop()?.toLowerCase();
      switch (ext) { case 'py': return 'python'; case 'js': return 'javascript'; default: return 'plaintext'; }
    }
    return 'plaintext';
  }

  formatTime(seconds: number | undefined): string {
    if (seconds === undefined || isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return "--:--";
    seconds = Math.round(seconds); const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), secs = seconds % 60;
    return h > 0 ? `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` : `${m.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  ngOnDestroy(): void { this.subscriptions.unsubscribe(); if (this.currentSse) this.currentSse.close(); }
}