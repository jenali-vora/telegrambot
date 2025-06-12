// src/app/shared/services/file-manager-api.service.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, EMPTY } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { AuthService } from './auth.service';
import { PreviewDetails } from '../../interfaces/batch.interfaces';

// --- Interfaces ---

// MODIFIED: Added StreamUploadResponse interface for the new endpoint
export interface StreamUploadResponse {
  message: string;
  access_id: string;
  download_url: string;
  gdrive_file_id: string;
}

export interface FileInBatch {
  original_filename: string;
  original_size?: number;
  failed?: boolean;
  reason?: string | null;
  skipped?: boolean;
  send_locations?: any[];
}

export interface TelegramFileMetadata {
  original_filename?: string;
  original_size?: number;
  upload_timestamp?: string | Date;
  access_id?: string;
  name?: string;
  type?: 'file' | 'batch';
  icon?: string;
  size?: number;
  is_split?: boolean;
  is_compressed?: boolean;
  sent_filename?: string;
  lastModified?: string | Date;
  share_id?: string;
  _id?: string;
  is_batch?: boolean;
  batch_display_name?: string;
  files_in_batch?: FileInBatch[];
  total_original_size?: number;
  total_upload_duration_seconds?: number;
  username?: string;
  is_anonymous?: boolean;
  compressed_size?: number;
  archived_timestamp?: string | Date;
  archived_by_username?: string;
  [key: string]: any;
}

export interface InitiateUploadResponse {
  upload_id: string;
  filename: string;
  sse_gdrive_upload_url?: string;
  shareable_link?: string;
  message?: string;
  access_id?: string;
}

export interface ApiResponse {
  success?: boolean;
  message?: string;
  error?: string;
}

export interface BasicApiResponse {
  success?: boolean;
  message?: string;
  error?: string;
}

export interface SelectedItem {
  id: number;
  file: File;
  name: string;
  size: number;
  isFolder?: boolean;
  icon: string;
}

export interface DownloadAllInitiationResponse {
  message?: string;
  prep_id_for_zip?: string;
  sse_stream_url?: string;
  error?: string;
}

export interface SseReadyPayload {
  temp_file_id: string;
  final_filename: string;
}
// --- End of Interfaces ---

@Injectable({ providedIn: 'root' })
export class FileManagerApiService {
  streamUploadWithProgress(file: File) {
    throw new Error('Method not implemented.');
  }
  private apiUrl = environment.apiUrl;
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  public getApiBaseUrl(): string {
    return this.apiUrl;
  }

  // MODIFIED: This is now only used by non-streaming methods.
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return token ? new HttpHeaders().set('Authorization', `Bearer ${token}`) : new HttpHeaders();
  }

  // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  // +++ NEW STREAMING UPLOAD METHOD +++++++++++++++++++++++++++++++++++++++++++++
  // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  /**
  * Uploads a single file by streaming its raw data directly to the backend.
  * This is the new, faster method.
  * @param file The file object to stream.
  */
  streamUpload(file: File): Observable<StreamUploadResponse> {
    const streamUrl = `${this.apiUrl}/upload/stream`;

    // Create custom headers required by the backend.
    // The auth interceptor will automatically add the Authorization header if a token exists.
    const headers = new HttpHeaders({
      'X-Filename': file.name,
      'X-Filesize': file.size.toString()
      // We are NOT setting Content-Type. The browser and HttpClient are smart
      // enough to set the correct `Content-Type: application/octet-stream` (or similar)
      // when sending a raw File object, which is what our backend expects.
    });

    console.log(`[ApiService.streamUpload] Streaming file '${file.name}' to ${streamUrl}`);

    // POST the raw file object as the request body.
    return this.http.post<StreamUploadResponse>(streamUrl, file, { headers: headers })
      .pipe(
        tap(res => console.log(`Stream upload successful for ${file.name}:`, res)),
        catchError(this.handleError)
      );
  }
  // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  // +++ END OF NEW METHOD +++++++++++++++++++++++++++++++++++++++++++++++++++++++
  // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

  // --- All your other existing methods remain unchanged ---
  listFiles(username: string): Observable<TelegramFileMetadata[]> {
    if (!username) { return throwError(() => new Error('Username required.')); }
    const endpointUrl = `${this.apiUrl}/api/files/${encodeURIComponent(username)}`;
    console.log(`[ApiService.listFiles] Calling endpoint: ${endpointUrl}`);
    return this.http.get<TelegramFileMetadata[]>(endpointUrl, { headers: this.getAuthHeaders() })
      .pipe(
        tap(files => console.log(`Fetched ${files?.length ?? 0} files for ${username}`)),
        catchError(this.handleError)
      );
  }

  initiateUpload(formData: FormData): Observable<InitiateUploadResponse> {
    // This is the old method that uses FormData and saves to server disk first.
    // We are keeping it in case you need to switch back for testing.
    return this.http.post<InitiateUploadResponse>(`${this.apiUrl}/initiate-upload`, formData, { headers: this.getAuthHeaders() })
      .pipe(
        tap(res => console.log('Initiate Upload Resp:', res)),
        catchError(this.handleError)
      );
  }

  deleteFileRecord(username: string, identifier: string): Observable<BasicApiResponse> {
    if (!username || !identifier) { return throwError(() => new Error('Username and identifier required for deletion.')); }
    const encodedIdentifier = encodeURIComponent(identifier);
    const endpointUrl = `${this.apiUrl}/api/delete-file/${encodeURIComponent(username)}/${encodedIdentifier}`;
    console.log(`[ApiService.deleteFileRecord] Calling endpoint: ${endpointUrl}`);
    return this.http.delete<BasicApiResponse>(endpointUrl, { headers: this.getAuthHeaders() })
      .pipe(
        tap(res => console.log(`Archive (delete) response for ${identifier}:`, res)),
        catchError(this.handleError)
      );
  }

  listArchivedFiles(username: string): Observable<TelegramFileMetadata[]> {
    if (!username) { return throwError(() => new Error('Username required for listing archived files.')); }
    const endpointUrl = `${this.apiUrl}/api/archive/list-files/${encodeURIComponent(username)}`;
    console.log(`[ApiService.listArchivedFiles] Calling endpoint: ${endpointUrl}`);
    return this.http.get<TelegramFileMetadata[]>(endpointUrl, { headers: this.getAuthHeaders() })
      .pipe(
        tap(files => console.log(`Fetched ${files?.length ?? 0} archived files for ${username}`)),
        catchError(this.handleError)
      );
  }

  restoreFile(accessId: string): Observable<ApiResponse> {
    if (!accessId) { return throwError(() => new Error('Access ID required for restoring file.')); }
    const endpointUrl = `${this.apiUrl}/api/archive/restore-file/${encodeURIComponent(accessId)}`;
    console.log(`[ApiService.restoreFile] Calling endpoint: ${endpointUrl}`);
    return this.http.post<ApiResponse>(endpointUrl, {}, { headers: this.getAuthHeaders() })
      .pipe(
        tap(res => console.log(`Restore response for ${accessId}:`, res)),
        catchError(this.handleError)
      );
  }

  getPreviewDetails(accessId: string, filename?: string | null): Observable<PreviewDetails> {
    if (!accessId) {
      return throwError(() => new Error('Access ID is required.'));
    }
    let params = new HttpParams();
    if (filename) {
      params = params.set('filename', filename);
    }
    return this.http.get<PreviewDetails>(`${this.apiUrl}/api/preview-details/${accessId}`, {
      headers: this.getAuthHeaders(),
      params: params
    })
      .pipe(
        tap(details => console.log(`Preview details for ${accessId}${filename ? ' (file: ' + filename + ')' : ''}:`, details)),
        catchError(this.handleError)
      );
  }

  getRawTextContent(contentUrl: string): Observable<string> {
    const fullUrl = contentUrl.startsWith('http') ? contentUrl : `${this.apiUrl}${contentUrl}`;
    return this.http.get(fullUrl, { headers: this.getAuthHeaders(), responseType: 'text' })
      .pipe(
        catchError(this.handleError)
      );
  }

  public downloadFileBlob(accessId: string, isBatch: boolean): Observable<Blob> {
    if (!accessId) {
      return throwError(() => new Error('Access ID required for download.'));
    }

    return new Observable(observer => {
      let initialApiUrl: string;
      let isTwoStepSse = false;

      if (isBatch) {
        initialApiUrl = `${this.apiUrl}/download/initiate-download-all/${accessId}`;
        isTwoStepSse = true;
      } else {
        initialApiUrl = `${this.apiUrl}/download/stream-download/${accessId}`;
      }
      console.log(`[ApiService.downloadFileBlob] Initial API/SSE URL for ${accessId} (isBatch: ${isBatch}): ${initialApiUrl}`);

      let eventSource: EventSource | null = null;

      const setupPrimarySseConnection = (primarySseUrl: string) => {
        if (eventSource) {
          console.warn('[ApiService.downloadFileBlob] Closing existing EventSource before creating new one.');
          eventSource.close();
        }
        console.log(`[ApiService.downloadFileBlob] Connecting to primary SSE: ${primarySseUrl}`);
        eventSource = new EventSource(primarySseUrl, { withCredentials: true });

        eventSource.onopen = () => {
          console.log(`[ApiService.downloadFileBlob] SSE connection opened to: ${primarySseUrl}`);
        };

        eventSource.addEventListener('status', (event: MessageEvent) => {
          console.debug('[ApiService.downloadFileBlob] SSE status:', event.data);
        });

        eventSource.addEventListener('progress', (event: MessageEvent) => {
          console.debug('[ApiService.downloadFileBlob] SSE progress:', event.data);
        });

        eventSource.addEventListener('ready', (event: MessageEvent) => {
          console.log('[ApiService.downloadFileBlob] SSE "ready" event received:', event.data);
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }

          try {
            const data: SseReadyPayload = JSON.parse(event.data);
            if (!data.temp_file_id || !data.final_filename) {
              console.error('[ApiService.downloadFileBlob] "ready" event missing temp_file_id or final_filename.');
              observer.error(new Error('Download preparation failed: Incomplete server response from "ready" event.'));
              return;
            }
            const finalDownloadUrl = `${this.apiUrl}/download/serve-temp-file/${data.temp_file_id}/${encodeURIComponent(data.final_filename)}`;
            console.log(`[ApiService.downloadFileBlob] Triggering final blob download from: ${finalDownloadUrl}`);

            this.http.get(finalDownloadUrl, { responseType: 'blob', headers: this.getAuthHeaders() })
              .pipe(catchError(blobFetchError => {
                console.error('[ApiService.downloadFileBlob] Error fetching blob:', blobFetchError);
                this.handleError(blobFetchError as HttpErrorResponse).subscribe({
                  error: (processedError: Error) => observer.error(processedError)
                });
                return EMPTY;
              }))
              .subscribe(blob => {
                observer.next(blob);
                observer.complete();
              });
          } catch (e: any) {
            console.error('[ApiService.downloadFileBlob] Error processing "ready" event:', e);
            observer.error(new Error(e.message || 'Error processing download readiness.'));
          }
        });

        eventSource.addEventListener('error', (event: MessageEvent) => {
          console.error('[ApiService.downloadFileBlob] SSE "error" event from backend:', event.data);
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          let msg = 'File preparation error reported by server.';
          try {
            if (event.data) {
              const parsedError = JSON.parse(event.data);
              msg = parsedError.message || parsedError.error || msg;
            }
          } catch (e) {
            console.warn('[ApiService.downloadFileBlob] Could not parse SSE error event data:', event.data);
          }
          observer.error(new Error(msg));
        });

        eventSource.onerror = (err: Event) => {
          console.error('[ApiService.downloadFileBlob] EventSource general connection error:', err, 'URL:', primarySseUrl);
          if (eventSource) {
            eventSource.close();
            eventSource = null;
            observer.error(new Error('Connection error during file preparation. Check network or server status.'));
          }
        };
      };

      if (isTwoStepSse) {
        this.http.get<DownloadAllInitiationResponse>(initialApiUrl, { headers: this.getAuthHeaders() })
          .pipe(catchError(initError => {
            console.error('[ApiService.downloadFileBlob] Error initiating batch download all:', initError);
            this.handleError(initError as HttpErrorResponse).subscribe({
              error: (processedError: Error) => observer.error(processedError)
            });
            return EMPTY;
          }))
          .subscribe(response => {
            if (response && response.sse_stream_url) {
              const sseStreamUrl = response.sse_stream_url.startsWith('http') ? response.sse_stream_url : `${this.apiUrl}${response.sse_stream_url}`;
              setupPrimarySseConnection(sseStreamUrl);
            } else {
              const errMsg = response?.error || 'Failed to get download stream URL for batch operation.';
              console.error(`[ApiService.downloadFileBlob] Invalid initiation response for batch: ${errMsg}`);
              observer.error(new Error(errMsg));
            }
          });
      } else {
        setupPrimarySseConnection(initialApiUrl);
      }

      return () => {
        if (eventSource) {
          console.log('[ApiService.downloadFileBlob] Cleaning up EventSource on unsubscribe.');
          eventSource.close();
          eventSource = null;
        }
      };
    });
  }

  getDownloadUrl(username: string, filename: string): string {
    if (!username || !filename) {
      console.error("Username and filename required to build download URL");
      return '#';
    }
    const encodedFilename = encodeURIComponent(filename);
    return `${this.apiUrl}/download/${encodeURIComponent(username)}/${encodedFilename}`;
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let userMessage = 'An unexpected error occurred. Check backend connection/logs.';
    console.error(`API Error: Status ${error.status}, Body: `, error.error, `URL: ${error.url}`);

    if (error.error instanceof Blob && error.error.type && error.error.type.toLowerCase().includes('json')) {
      return new Observable(observer => {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          try {
            const err = JSON.parse(e.target.result);
            userMessage = err.message || err.error || `Server error (${error.status}).`;
            if (err.status === 410 && err.preview_type === 'expired') {
              observer.error({ ...err, status: err.status, message: userMessage });
              return;
            }
            console.error(`Parsed Blob Error: ${userMessage}`);
          } catch (parseError) {
            userMessage = `Failed to parse error response from server (${error.status}).`;
            console.error(`Error parsing blob error: ${parseError}`);
          }
          observer.error(new Error(userMessage));
        };
        reader.onerror = () => {
          console.error('FileReader failed to read error blob.');
          observer.error(new Error(`Failed to read error response from server (${error.status}).`));
        };
        reader.readAsText(error.error);
      });
    } else if (error.status === 410 && error.error.preview_type === 'expired') {
      userMessage = error.error.error || error.error.message || 'File link has expired.';
      return throwError(() => ({ ...error.error, status: error.status, message: userMessage }));
    } else if (error.error && typeof error.error.error === 'string') {
      userMessage = error.error.error;
    } else if (error.error && typeof error.error.message === 'string') {
      userMessage = error.error.message;
    } else if (typeof error.error === 'string') {
      userMessage = error.error;
    } else if (error.status === 0) {
      userMessage = 'Cannot connect to the backend server. Please check your network connection and ensure the server is running.';
    } else if (error.status === 400) {
      userMessage = `Bad request (${error.status}). ${error.error?.error || 'Please check your input.'}`;
    } else if (error.status === 401) {
      userMessage = `Unauthorized (${error.status}). Please log in or check your permissions.`;
    } else if (error.status === 403) {
      userMessage = `Forbidden (${error.status}). You do not have permission to access this resource.`;
    } else if (error.status === 404) {
      userMessage = `Requested resource not found on the server (${error.status}).`;
    } else if (error.status === 410) {
      userMessage = 'The requested resource is no longer available (Expired or Removed).';
    } else if (error.status === 500) {
      userMessage = `Internal server error (${error.status}). Please try again later or contact support.`;
    } else if (error.message) {
      userMessage = `Error (${error.status}): ${error.message}`;
    }

    console.error(`Final user message for error: ${userMessage}`);
    return throwError(() => new Error(userMessage));
  }
}