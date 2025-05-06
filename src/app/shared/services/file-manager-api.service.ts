// src/app/shared/services/file-manager-api.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

// --- Interfaces (Keep as they are) ---
export interface TelegramFileMetadata {
  original_filename: string;
  original_size?: number;
  upload_timestamp?: string | Date;
  access_id?: string;
  is_split?: boolean;
  is_compressed?: boolean;
  sent_filename?: string;
  name?: string;
  type?: 'file';
  icon?: string;
  size?: number;
  lastModified?: string | Date;
  share_id?: string;
}

export interface InitiateUploadResponse {
  upload_id: string;
  filename: string;
  shareable_link?: string;
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
  // !!! Ensure this URL points correctly to your running Python backend !!!
  private apiUrl = 'http://192.168.1.22:5000';

  private http = inject(HttpClient);

  // =====================================
  // === ADD THIS METHOD - START ===
  // =====================================
  /**
   * Returns the base API URL configured for this service.
   * Needed for constructing URLs for non-standard requests like EventSource.
   */
  public getApiBaseUrl(): string {
    return this.apiUrl;
  }
  // =====================================
  // === ADD THIS METHOD - END ===
  // =====================================


  /** Fetches the flat list of file metadata for a given username */
  listFiles(username: string): Observable<TelegramFileMetadata[]> {
    if (!username) { return throwError(() => new Error('Username required.')); }
    return this.http.get<TelegramFileMetadata[]>(`${this.apiUrl}/files/${encodeURIComponent(username)}`)
      .pipe(
        tap(files => console.log(`Fetched ${files?.length ?? 0} files for ${username}`)),
        catchError(this.handleError)
      );
  }

  /** Initiates the file upload process on the backend (for SSE flow) */
  initiateUpload(formData: FormData): Observable<InitiateUploadResponse> {
    return this.http.post<InitiateUploadResponse>(`${this.apiUrl}/initiate-upload`, formData)
      .pipe(
        tap(res => console.log('Initiate Upload Resp:', res)),
        catchError(this.handleError)
      );
  }

  /** Deletes a file's metadata record */
  deleteFileRecord(username: string, filename: string): Observable<BasicApiResponse> {
    if (!username || !filename) { return throwError(() => new Error('Username and filename required.')); }
    // Ensure filename is properly encoded if it might contain special characters like '/'
    const encodedFilename = encodeURIComponent(filename);
    return this.http.delete<BasicApiResponse>(`${this.apiUrl}/delete-file/${encodeURIComponent(username)}/${encodedFilename}`)
      .pipe(
        tap(res => console.log(`Delete response for ${filename}:`, res)),
        catchError(this.handleError)
      );
  }

  /** Constructs the expected server-side download URL (useful for linking) */
  getDownloadUrl(username: string, filename: string): string {
    if (!username || !filename) {
      console.error("Username and filename required to build download URL");
      return '#'; // Return a non-functional link on error
    }
    // Ensure filename is properly encoded
    const encodedFilename = encodeURIComponent(filename);
    // This endpoint might be '/download/<username>/<filename>' or '/get/<access_id>' depending on your backend
    // Using the direct download example for now:
    return `${this.apiUrl}/download/${encodeURIComponent(username)}/${encodedFilename}`;
  }

  // --- Error Handling ---
  private handleError(error: HttpErrorResponse): Observable<never> {
    let userMessage = 'An unexpected error occurred. Check backend connection/logs.';
    console.error(`API Error: Status ${error.status}, Body: `, error.error);

    if (error.error) { // Check if backend provided a JSON error object
      if (typeof error.error.error === 'string') { userMessage = error.error.error; }
      else if (typeof error.error.message === 'string') { userMessage = error.error.message; }
    } else if (error.status === 0) {
      userMessage = 'Cannot connect to backend. Is it running & CORS enabled?';
    } else if (error.status === 400) {
      userMessage = 'Bad request. Please check your input.';
    } else if (error.status === 404) {
       userMessage = 'Requested resource not found on the server.';
    } else if (error.status === 500) {
      userMessage = 'Internal server error. Please try again later.';
    } else if (error.message) { // Fallback to HttpErrorResponse message
      userMessage = `Error: ${error.message}`;
    }

    return throwError(() => new Error(userMessage));
  }
}