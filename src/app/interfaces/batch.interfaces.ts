// src/app/interfaces/batch.interfaces.ts
export interface FileInBatchInfo {
    original_filename: string;
    original_size?: number;
    failed?: boolean;
    reason?: string | null;
    skipped?: boolean;
}

export interface BatchDetails {
    access_id: string; // The access_id of the batch itself
    batch_name: string; // Display name for the batch
    username?: string;   // Uploader's name
    upload_date?: string | Date; // Upload timestamp
    files: FileInBatchInfo[]; // List of files in the batch
    total_size?: number; // Total original size of all files in the batch
}

// For API response from /initiate-download-all
export interface DownloadAllInitiationResponse {
    prep_id_for_zip?: string; // Optional, if your backend uses it
    sse_stream_url: string;
    error?: string;
}

// For SSE 'ready' event payload
export interface SseReadyPayload {
    temp_file_id: string;
    final_filename: string;
}

// For SSE 'progress' event payload
export interface SseProgressPayload {
    percentage: number;
    bytesSent?: number;         // Used by _calculate_progress (e.g., for zipping)
    bytesProcessed?: number;    // Used in some hardcoded backend progress events
    totalBytes?: number;
    speedMBps?: number;
    etaFormatted?: string;
    etaSeconds?: number;
}

// For SSE 'status' event payload
export interface SseStatusPayload {
    message: string;
}