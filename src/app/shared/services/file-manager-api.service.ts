// src/app/shared/services/file-manager-api.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams, HttpHeaders } from '@angular/common/http'; // Added HttpHeaders
import { Observable, throwError, EMPTY } from 'rxjs'; // Added EMPTY
import { catchError, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { AuthService } from './auth.service'; // Assuming AuthService is correctly located

// --- Interfaces ---
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
  access_id?: string; // This is the key identifier
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
}

export interface InitiateUploadResponse {
  upload_id: string;
  filename: string;
  shareable_link?: string;
  message?: string;
  access_id?: string;
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

// Added interfaces from previous context for downloadFileBlob
export interface DownloadAllInitiationResponse {
  message?: string;
  prep_id_for_zip?: string;
  sse_stream_url?: string;
  error?: string;
}

export interface SseReadyPayload {
  temp_file_id: string;
  final_filename: string;
  // ... any other fields
}
// --- End of Interfaces ---

@Injectable({ providedIn: 'root' })
export class FileManagerApiService {
  private apiUrl = environment.apiUrl;
  private http = inject(HttpClient);
  private authService = inject(AuthService); // Injected AuthService

  public getApiBaseUrl(): string {
    return this.apiUrl;
  }

  // Added getAuthHeaders from previous context
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return token ? new HttpHeaders().set('Authorization', `Bearer ${token}`) : new HttpHeaders();
  }

  listFiles(username: string): Observable<TelegramFileMetadata[]> {
    if (!username) { return throwError(() => new Error('Username required.')); }
    return this.http.get<TelegramFileMetadata[]>(`${this.apiUrl}/files/${encodeURIComponent(username)}`, { headers: this.getAuthHeaders() }) // Added headers
      .pipe(
        tap(files => console.log(`Fetched ${files?.length ?? 0} files for ${username}`)),
        catchError(this.handleError)
      );
  }

  initiateUpload(formData: FormData): Observable<InitiateUploadResponse> {
    return this.http.post<InitiateUploadResponse>(`${this.apiUrl}/initiate-upload`, formData, { headers: this.getAuthHeaders() }) // Added headers
      .pipe(
        tap(res => console.log('Initiate Upload Resp:', res)),
        catchError(this.handleError)
      );
  }

  deleteFileRecord(username: string, identifier: string): Observable<BasicApiResponse> {
    if (!username || !identifier) { return throwError(() => new Error('Username and identifier required for deletion.')); }
    const encodedIdentifier = encodeURIComponent(identifier);
    return this.http.delete<BasicApiResponse>(`${this.apiUrl}/delete-file/${encodeURIComponent(username)}/${encodedIdentifier}`, { headers: this.getAuthHeaders() }) // Added headers
      .pipe(
        tap(res => console.log(`Delete response for ${identifier}:`, res)),
        catchError(this.handleError)
      );
  }

  // *** UPDATED downloadFileBlob method from Step 2 ***
  public downloadFileBlob(accessId: string, isBatch: boolean): Observable<Blob> {
    if (!accessId) {
      return throwError(() => new Error('Access ID required for download.'));
    }

    return new Observable(observer => {
      let initialApiUrl: string;
      let isTwoStepSse = false; // Flag to determine if we need to hit an initiation URL first

      if (isBatch) {
        // For batch downloads, first hit the initiation endpoint
        initialApiUrl = `${this.apiUrl}/initiate-download-all/${accessId}`;
        isTwoStepSse = true;
      } else {
        // For single file downloads, the SSE stream URL is directly constructed
        initialApiUrl = `${this.apiUrl}/stream-download/${accessId}`;
      }
      console.log(`[ApiService.downloadFileBlob] Initial API/SSE URL for ${accessId} (isBatch: ${isBatch}): ${initialApiUrl}`);

      let eventSource: EventSource | null = null;

      const setupPrimarySseConnection = (primarySseUrl: string) => {
        if (eventSource) {
          console.warn('[ApiService.downloadFileBlob] Closing existing EventSource before creating new one.');
          eventSource.close();
        }
        console.log(`[ApiService.downloadFileBlob] Connecting to primary SSE: ${primarySseUrl}`);
        // Ensure withCredentials is true if your SSE endpoint requires cookies/auth headers via session
        eventSource = new EventSource(primarySseUrl, { withCredentials: true }); // Adjust withCredentials as needed

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

            const finalDownloadUrl = `${this.apiUrl}/serve-temp-file/${data.temp_file_id}/${encodeURIComponent(data.final_filename)}`;
            console.log(`[ApiService.downloadFileBlob] Triggering final blob download from: ${finalDownloadUrl}`);

            this.http.get(finalDownloadUrl, { responseType: 'blob', headers: this.getAuthHeaders() })
              .pipe(catchError(blobFetchError => {
                console.error('[ApiService.downloadFileBlob] Error fetching blob:', blobFetchError);
                // Use handleError's logic to create a user-friendly error
                this.handleError(blobFetchError as HttpErrorResponse).subscribe({
                  error: (processedError: Error) => observer.error(processedError)
                });
                return EMPTY; // Important to return EMPTY to satisfy catchError's signature
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

        eventSource.addEventListener('error', (event: MessageEvent) => { // Backend explicitly sent an 'error' event
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

        eventSource.onerror = (err: Event) => { // General EventSource connection error
          console.error('[ApiService.downloadFileBlob] EventSource general connection error:', err, 'URL:', primarySseUrl);
          if (eventSource) { // Only act if this is still the active EventSource
            eventSource.close();
            eventSource = null;
            observer.error(new Error('Connection error during file preparation. Check network or server status.'));
          }
        };
      };

      if (isTwoStepSse) {
        // For batch, first call the initiation endpoint
        this.http.get<DownloadAllInitiationResponse>(initialApiUrl, { headers: this.getAuthHeaders() })
          .pipe(catchError(initError => {
            console.error('[ApiService.downloadFileBlob] Error initiating batch download all:', initError);
            // Use handleError for consistent error message formatting
            this.handleError(initError as HttpErrorResponse).subscribe({
              error: (processedError: Error) => observer.error(processedError)
            });
            return EMPTY;
          }))
          .subscribe(response => {
            if (response && response.sse_stream_url) {
              // The SSE URL from the backend might be relative, so prepend API base URL if needed
              const sseStreamUrl = response.sse_stream_url.startsWith('http') ? response.sse_stream_url : `${this.apiUrl}${response.sse_stream_url}`;
              setupPrimarySseConnection(sseStreamUrl);
            } else {
              const errMsg = response?.error || 'Failed to get download stream URL for batch operation.';
              console.error(`[ApiService.downloadFileBlob] Invalid initiation response for batch: ${errMsg}`);
              observer.error(new Error(errMsg));
            }
          });
      } else {
        // For single file, initialApiUrl is already the SSE stream URL
        setupPrimarySseConnection(initialApiUrl);
      }

      return () => { // Cleanup function for when the Observable is unsubscribed
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
    // This method seems to construct a direct download URL, which is different from the SSE flow.
    // Ensure your backend route /download/<username>/<filename> handles direct downloads if this is intended.
    // The current SSE flow uses /stream-download/... or /initiate-download-all/...
    // This might be a legacy method or for a different download mechanism.
    return `${this.apiUrl}/download/${encodeURIComponent(username)}/${encodedFilename}`;
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let userMessage = 'An unexpected error occurred. Check backend connection/logs.';
    console.error(`API Error: Status ${error.status}, Body: `, error.error, `URL: ${error.url}`);

    if (error.error) {
      // Attempt to parse blob error if it's JSON
      if (error.error instanceof Blob && error.error.type && error.error.type.toLowerCase().includes('json')) {
        return new Observable(observer => {
          const reader = new FileReader();
          reader.onload = (e: any) => {
            try {
              const err = JSON.parse(e.target.result);
              userMessage = err.message || err.error || `Server error (${error.status}).`;
              console.error(`Parsed Blob Error: ${userMessage}`);
            } catch (parseError) {
              userMessage = `Failed to parse error response from server (${error.status}).`;
              console.error(`Error parsing blob error: ${parseError}`);
            }
            observer.error(new Error(userMessage)); // Pass the Error object
            // observer.complete(); // Not needed after error
          };
          reader.onerror = () => {
            console.error('FileReader failed to read error blob.');
            observer.error(new Error(`Failed to read error response from server (${error.status}).`));
            // observer.complete(); // Not needed after error
          };
          reader.readAsText(error.error);
        });
      } else if (typeof error.error.error === 'string') { // Flask often returns { "error": "message" }
        userMessage = error.error.error;
      } else if (typeof error.error.message === 'string') { // Or { "message": "message" }
        userMessage = error.error.message;
      } else if (typeof error.error === 'string') { // Fallback for plain string error
        userMessage = error.error;
      }
    } else if (error.status === 0) {
      userMessage = 'Cannot connect to the backend server. Please check your network connection and ensure the server is running.';
    } else if (error.status === 400) {
      userMessage = `Bad request (${error.status}). Please check your input.`;
    } else if (error.status === 401) {
      userMessage = `Unauthorized (${error.status}). Please log in or check your permissions.`;
    } else if (error.status === 403) {
      userMessage = `Forbidden (${error.status}). You do not have permission to access this resource.`;
    } else if (error.status === 404) {
      userMessage = `Requested resource not found on the server (${error.status}).`;
    } else if (error.status === 500) {
      userMessage = `Internal server error (${error.status}). Please try again later or contact support.`;
    } else if (error.message) { // Fallback to generic HttpErrorResponse message
      userMessage = `Error (${error.status}): ${error.message}`;
    }

    console.error(`Final user message for error: ${userMessage}`);
    return throwError(() => new Error(userMessage)); // Always throw an Error object
  }
}