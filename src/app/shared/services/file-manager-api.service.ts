// frontend/src/app/services/file-manager-api.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams, HttpHeaders, HttpEvent } from '@angular/common/http';
import { Observable, throwError, EMPTY } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { AuthService } from './auth.service';
import { PreviewDetails } from '../../interfaces/batch.interfaces';

// --- Compacted Interfaces ---
export interface StreamUploadResponse { message: string; access_id: string; download_url: string; gdrive_file_id: string; }
export interface FileInBatch { original_filename: string; original_size?: number; failed?: boolean; reason?: string | null; skipped?: boolean; send_locations?: any[]; }
export interface TelegramFileMetadata { original_filename?: string; original_size?: number; upload_timestamp?: string | Date; access_id?: string; name?: string; type?: 'file' | 'batch'; icon?: string; size?: number; is_split?: boolean; is_compressed?: boolean; sent_filename?: string; lastModified?: string | Date; share_id?: string; _id?: string; is_batch?: boolean; batch_display_name?: string; files_in_batch?: FileInBatch[]; total_original_size?: number; total_upload_duration_seconds?: number; username?: string; is_anonymous?: boolean; compressed_size?: number; archived_timestamp?: string | Date; archived_by_username?: string; [key: string]: any; }
export interface InitiateUploadResponse { upload_id: string; filename: string; sse_gdrive_upload_url?: string; shareable_link?: string; message?: string; access_id?: string; }
export interface ApiResponse { success?: boolean; message?: string; error?: string; }
export interface BasicApiResponse extends ApiResponse {}
export interface SelectedItem { id: number; file: File; name: string; size: number; isFolder?: boolean; icon: string; }
export interface DownloadAllInitiationResponse { message?: string; prep_id_for_zip?: string; sse_stream_url?: string; error?: string; }
export interface SseReadyPayload { temp_file_id: string; final_filename: string; }
export interface InitiateStreamResponse { message: string; operation_id: string; }
export interface InitiateBatchResponse { message: string; batch_id: string; }
export interface FinalizeBatchResponse { message: string; access_id: string; download_url: string; }

@Injectable({ providedIn: 'root' })
export class FileManagerApiService {
  private apiUrl = environment.apiUrl; private http = inject(HttpClient); private authService = inject(AuthService);
  public getApiBaseUrl = (): string => this.apiUrl;

  getUploadProgressStream(batchId: string): Observable<any> {
    return new Observable(observer => {
      const eventSource = new EventSource(`${this.apiUrl}/upload/progress-stream/${batchId}`, { withCredentials: true });
      const addListener = (name: string) => eventSource.addEventListener(name, (ev: MessageEvent) => { try { observer.next(JSON.parse(ev.data)); } catch (e) { observer.error(new Error(`SSE parse error: ${ev.data}`)); }});
      ['progress', 'status', 'error', 'finalized'].forEach(addListener);
      eventSource.onerror = (err) => { observer.error(new Error('Progress stream connection failed.')); eventSource.close(); };
      return () => { if (eventSource && eventSource.readyState !== eventSource.CLOSED) eventSource.close(); };
    });
  }

  initiateBatch = (payload: any): Observable<InitiateBatchResponse> => this.http.post<InitiateBatchResponse>(`${this.apiUrl}/upload/initiate-batch`, payload).pipe(catchError(this.handleError));
  streamFileToBatch = (file: File, batchId: string): Observable<HttpEvent<any>> => this.http.post(`${this.apiUrl}/upload/stream`, file, { headers: new HttpHeaders({ 'X-Filename': file.name, 'X-Filesize': file.size.toString(), 'X-Batch-Id': batchId }), reportProgress: true, observe: 'events' });
  finalizeBatch = (batchId: string): Observable<FinalizeBatchResponse> => this.http.post<FinalizeBatchResponse>(`${this.apiUrl}/upload/finalize-batch/${batchId}`, {}).pipe(catchError(this.handleError));
  listFiles = (username: string): Observable<TelegramFileMetadata[]> => this.http.get<TelegramFileMetadata[]>(`${this.apiUrl}/api/files/${encodeURIComponent(username)}`).pipe(catchError(this.handleError));
  deleteFileRecord = (user: string, id: string): Observable<BasicApiResponse> => this.http.delete<BasicApiResponse>(`${this.apiUrl}/api/delete-file/${encodeURIComponent(user)}/${encodeURIComponent(id)}`).pipe(catchError(this.handleError));
  listArchivedFiles = (username: string): Observable<TelegramFileMetadata[]> => this.http.get<TelegramFileMetadata[]>(`${this.apiUrl}/api/archive/list-files/${encodeURIComponent(username)}`).pipe(catchError(this.handleError));
  restoreFile = (accessId: string): Observable<ApiResponse> => this.http.post<ApiResponse>(`${this.apiUrl}/api/archive/restore-file/${encodeURIComponent(accessId)}`, {}).pipe(catchError(this.handleError));
  getPreviewDetails(accessId: string, filename?: string | null): Observable<PreviewDetails> {
    let params = new HttpParams(); if (filename) params = params.set('filename', filename);
    return this.http.get<PreviewDetails>(`${this.apiUrl}/api/preview-details/${accessId}`, { params }).pipe(catchError(this.handleError));
  }
  getRawTextContent(contentUrl: string): Observable<string> {
    const fullUrl = contentUrl.startsWith('http') ? contentUrl : `${this.apiUrl}${contentUrl}`;
    const h = this.authService.getToken() ? new HttpHeaders().set('Authorization', `Bearer ${this.authService.getToken()}`) : new HttpHeaders();
    return this.http.get(fullUrl, { headers: h, responseType: 'text' }).pipe(catchError(this.handleError));
  }

  public downloadFileBlob(accessId: string, isBatch: boolean): Observable<Blob> {
    if (!accessId) return throwError(() => new Error('Access ID required.'));
    return new Observable(observer => {
      let initialApiUrl = isBatch ? `${this.apiUrl}/download/initiate-download-all/${accessId}` : `${this.apiUrl}/download/stream-download/${accessId}`;
      let eventSource: EventSource | null = null;
      const connectSse = (sseUrl: string) => {
        if (eventSource) eventSource.close();
        eventSource = new EventSource(sseUrl, { withCredentials: true });
        eventSource.onopen = () => console.log(`SSE opened: ${sseUrl}`);
        ['status', 'progress'].forEach(type => eventSource!.addEventListener(type, (ev: MessageEvent) => console.debug(`SSE ${type}:`, ev.data)));
        eventSource.addEventListener('ready', (ev: MessageEvent) => {
          if (eventSource) { eventSource.close(); eventSource = null; }
          try {
            const data: SseReadyPayload = JSON.parse(ev.data);
            if (!data.temp_file_id || !data.final_filename) { observer.error(new Error('Download prep failed: incomplete "ready" event.')); return; }
            const h = this.authService.getToken() ? new HttpHeaders().set('Authorization', `Bearer ${this.authService.getToken()}`) : new HttpHeaders();
            const dlUrl = `${this.apiUrl}/download/serve-temp-file/${data.temp_file_id}/${encodeURIComponent(data.final_filename)}`;
            this.http.get(dlUrl, { responseType: 'blob', headers: h }).pipe(catchError(blobErr => { this.handleError(blobErr as HttpErrorResponse).subscribe({ error: (pErr: Error) => observer.error(pErr) }); return EMPTY; }))
              .subscribe(blob => { observer.next(blob); observer.complete(); });
          } catch (e: any) { observer.error(new Error(e.message || 'Error processing "ready" event.')); }
        });
        eventSource.addEventListener('error', (ev: MessageEvent) => {
          if (eventSource) { eventSource.close(); eventSource = null; }
          let msg = 'Server file prep error.'; try { if (ev.data) msg = JSON.parse(ev.data).message || JSON.parse(ev.data).error || msg; } catch { /*ignore*/ }
          observer.error(new Error(msg));
        });
        eventSource.onerror = () => { if (eventSource) { eventSource.close(); eventSource = null; observer.error(new Error('SSE connection error.')); }};
      };
      if (isBatch) {
        const h = this.authService.getToken() ? new HttpHeaders().set('Authorization', `Bearer ${this.authService.getToken()}`) : new HttpHeaders();
        this.http.get<DownloadAllInitiationResponse>(initialApiUrl, { headers: h }).pipe(catchError(initErr => { this.handleError(initErr as HttpErrorResponse).subscribe({ error: (pErr: Error) => observer.error(pErr) }); return EMPTY; }))
          .subscribe(res => {
            if (res?.sse_stream_url) connectSse(res.sse_stream_url.startsWith('http') ? res.sse_stream_url : `${this.apiUrl}${res.sse_stream_url}`);
            else observer.error(new Error(res?.error || 'Failed to get batch download stream URL.'));
          });
      } else connectSse(initialApiUrl);
      return () => { if (eventSource) { eventSource.close(); eventSource = null; }};
    });
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let userMsg = 'Unexpected error. Check backend.'; console.error(`API Error ${error.status}: ${error.url}`, error.error);
    if (error.error instanceof Blob && error.error.type?.toLowerCase().includes('json')) {
      return new Observable(obs => {
        const reader = new FileReader();
        reader.onload = (e: any) => { try { const err = JSON.parse(e.target.result); userMsg = err.message || err.error || `Server error (${error.status}).`; if (err.status === 410 && err.preview_type === 'expired') { obs.error({ ...err, status: err.status, message: userMsg }); return; } } catch { userMsg = `Failed to parse error (${error.status}).`; } obs.error(new Error(userMsg)); };
        reader.onerror = () => obs.error(new Error(`Failed to read error blob (${error.status}).`));
        reader.readAsText(error.error);
      });
    }
    const errDetails = error.error;
    if (error.status === 410 && errDetails?.preview_type === 'expired') userMsg = errDetails.error || errDetails.message || 'File link expired.';
    else if (errDetails && typeof errDetails.error === 'string') userMsg = errDetails.error;
    else if (errDetails && typeof errDetails.message === 'string') userMsg = errDetails.message;
    else if (typeof errDetails === 'string') userMsg = errDetails;
    else if (error.status === 0) userMsg = 'Cannot connect to backend. Check network/server.';
    else if (error.status === 400) userMsg = `Bad request (${error.status}). ${errDetails?.error || 'Check input.'}`;
    else if (error.status === 401) userMsg = `Unauthorized (${error.status}). Login or check permissions.`;
    else if (error.status === 403) userMsg = `Forbidden (${error.status}). No permission.`;
    else if (error.status === 404) userMsg = `Not found (${error.status}).`;
    else if (error.status === 410) userMsg = 'Resource expired/removed.';
    else if (error.status === 500) userMsg = `Internal server error (${error.status}). Try later.`;
    else if (error.message) userMsg = `Error (${error.status}): ${error.message}`;
    return throwError(() => new Error(userMsg));
  }
}