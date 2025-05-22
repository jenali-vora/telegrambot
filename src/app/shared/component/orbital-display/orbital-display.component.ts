import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core'; // Removed HostBinding as it wasn't used
import { CommonModule } from '@angular/common';

// OrbitalItem interface remains the same
export interface OrbitalItem {
  id: string | number;
  type: 'image' | 'initials' | 'icon-class';
  value: string;
  altText?: string;
  label?: string;
  angle: number;
  radius: number;
  size: number;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  borderWidth?: string;
  shape?: 'circle' | 'square';
  squareIconColor?: string;
  squareShadow?: string;
  imageObjectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  isHighlighted?: boolean;
  contentPadding?: string;
}

@Component({
  selector: 'app-orbital-display',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './orbital-display.component.html',
  styleUrls: ['./orbital-display.component.css']
})
export class OrbitalDisplayComponent implements OnInit {
  @Input() isDragActive: boolean = false;
  @Input() centralButtonIconClass: string = 'fas fa-plus';
  @Output() requestFileUpload = new EventEmitter<void>();


  constructor() { }

  ngOnInit(): void {
  }

  onCentralButtonClick(): void {
    this.requestFileUpload.emit();
  }
}