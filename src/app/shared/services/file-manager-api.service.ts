// src/app/shared/services/file-manager-api.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

// --- Interfaces (keep as is) ---
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
// --- End of Interfaces ---

@Injectable({ providedIn: 'root' })
export class FileManagerApiService {
  private apiUrl = environment.apiUrl;
  private http = inject(HttpClient);

  public getApiBaseUrl(): string {
    return this.apiUrl;
  }

  listFiles(username: string): Observable<TelegramFileMetadata[]> {
    if (!username) { return throwError(() => new Error('Username required.')); }
    return this.http.get<TelegramFileMetadata[]>(`${this.apiUrl}/files/${encodeURIComponent(username)}`)
      .pipe(
        tap(files => console.log(`Fetched ${files?.length ?? 0} files for ${username}`)),
        catchError(this.handleError)
      );
  }

  initiateUpload(formData: FormData): Observable<InitiateUploadResponse> {
    return this.http.post<InitiateUploadResponse>(`${this.apiUrl}/initiate-upload`, formData)
      .pipe(
        tap(res => console.log('Initiate Upload Resp:', res)),
        catchError(this.handleError)
      );
  }

  deleteFileRecord(username: string, identifier: string): Observable<BasicApiResponse> {
    // 'identifier' received here IS THE access_id from the component.
    if (!username || !identifier) { return throwError(() => new Error('Username and identifier required for deletion.')); }
    const encodedIdentifier = encodeURIComponent(identifier);

    // The URL will be like: /delete-file/LuminaryNavigator/55b5e8f1a6
    // The backend needs to interpret '55b5e8f1a6' as an access_id.
    return this.http.delete<BasicApiResponse>(`${this.apiUrl}/delete-file/${encodeURIComponent(username)}/${encodedIdentifier}`)
      .pipe(
        tap(res => console.log(`Delete response for ${identifier}:`, res)),
        catchError(this.handleError) // This will propagate the "not found" if backend doesn't find by access_id
      );
  }

  downloadFileBlob(accessId: string): Observable<Blob> {
    if (!accessId) {
      return throwError(() => new Error('Access ID required for download.'));
    }
    const url = `${this.apiUrl}/get/${encodeURIComponent(accessId)}`;
    return this.http.get(url, {
      responseType: 'blob'
    }).pipe(
      catchError(this.handleError)
    );
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
    console.error(`API Error: Status ${error.status}, Body: `, error.error);

    if (error.error) {
      if (error.error instanceof Blob && error.error.type && error.error.type.toLowerCase().includes('json')) {
        return new Observable(observer => {
          const reader = new FileReader();
          reader.onload = (e: any) => {
            try {
              const err = JSON.parse(e.target.result);
              userMessage = err.message || err.error || 'Failed to download file (server error).';
            } catch (parseError) {
              userMessage = 'Failed to download file and parse error response.';
            }
            observer.error(new Error(userMessage));
            observer.complete();
          };
          reader.onerror = () => {
            observer.error(new Error('Failed to read error response from download.'));
            observer.complete();
          };
          reader.readAsText(error.error);
        });
      } else if (typeof error.error.error === 'string') { userMessage = error.error.error; }
      else if (typeof error.error.message === 'string') { userMessage = error.error.message; }
    } else if (error.status === 0) {
      userMessage = 'Cannot connect to backend. Is it running & CORS enabled?';
    } else if (error.status === 400) {
      userMessage = 'Bad request. Please check your input.';
    } else if (error.status === 404) { // This is the error you are likely getting
      userMessage = 'Requested resource not found on the server.';
    } else if (error.status === 500) {
      userMessage = 'Internal server error. Please try again later.';
    } else if (error.message) {
      userMessage = `Error: ${error.message}`;
    }
    return throwError(() => new Error(userMessage));
  }
}