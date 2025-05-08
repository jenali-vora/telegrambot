// src/app/shared/services/upload-event.service.ts
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class UploadEventService {
    private uploadCompletedSource = new Subject<void>();

    // Observable streams
    uploadCompleted$ = this.uploadCompletedSource.asObservable();

    // Service message commands
    notifyUploadComplete(): void {
        this.uploadCompletedSource.next();
    }
}