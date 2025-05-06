// src/app/components/dashboard/sidebar/sidebar.component.ts (Verify Path)
import { CommonModule } from '@angular/common';
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

// --- IMPORT YOUR PIPE ---
import { ByteFormatPipe } from '../../../app/shared/pipes/byte-format.pipe'; // <<< ADJUST PATH

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    ByteFormatPipe      // <<< IMPORT PIPE HERE
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'], // Use styleUrls (plural)
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent {
  // Use Inputs for data - provide defaults similar to your original static ones
  // Convert GB to Bytes for the input: GB * 1024^3
  @Input() usedStorageBytes: number = 12.5 * 1024 * 1024 * 1024;
  @Input() totalStorageBytes: number = 50 * 1024 * 1024 * 1024;
  @Input() logoUrl: string = 'assets/image/telegram.png'; // Adjust path
  @Input() userDisplayName: string = '';

  get storagePercentage(): number {
    if (this.totalStorageBytes <= 0 || this.usedStorageBytes < 0) return 0;
    const percentage = (this.usedStorageBytes / this.totalStorageBytes) * 100;
    return Math.min(percentage, 100);
  }
}