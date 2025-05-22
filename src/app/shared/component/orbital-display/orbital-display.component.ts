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
  @Input() items: OrbitalItem[] = [];
  @Input() centralButtonIconClass: string = 'fas fa-plus';
  // @Input() baseBackgroundColor: string = 'linear-gradient(to bottom, #87CEEB 70%, #B0E0E6)';
  @Output() requestFileUpload = new EventEmitter<void>();

  // Explicitly typed defaultItems (already correct)
  defaultItems: OrbitalItem[] = [
    {
      id: 'item-screen-default', type: 'image', value: 'assets/icons/screen-white.png', altText: 'Screen',
      angle: (360 / 13) * 0, radius: 130.7, size: 42, shape: 'square',
      backgroundColor: '#FFD13B', contentPadding: '8px', imageObjectFit: 'contain',
    },
    {
      id: 'item-at-default', type: 'image', value: 'assets/icons/at-white.png', altText: 'Email',
      angle: (360 / 13) * 1, radius: 130.7, size: 42, shape: 'square',
      backgroundColor: '#4CAF50', contentPadding: '8px', imageObjectFit: 'contain',
    },
    // ... (rest of your 13 default items if needed, ensuring all properties match OrbitalItem)
    // For brevity, I'll assume the list continues. Ensure 'type', 'shape', 'imageObjectFit'
    // use values allowed by the interface.
  ];


  constructor() { }

  ngOnInit(): void {
    if (this.items.length === 0) {
      // Explicitly type exampleScreenshotItems with OrbitalItem[]
      // Updated to 6 items with new angles
      const exampleScreenshotItems: OrbitalItem[] = [
        { id: 'item-folder', type: 'initials', value: 'Folder', angle: 0, radius: 130.7, size: 60, shape: 'circle', backgroundColor: '#000080', contentPadding: '8px' },
        { id: 'item-zip', type: 'initials', value: 'Zip', angle: 60, radius: 130.7, size: 60, shape: 'circle', backgroundColor: '#2a52be', contentPadding: '8px' },
        { id: 'item-files', type: 'initials', value: 'Files', angle: 120, radius: 130.7, size: 60, shape: 'circle', backgroundColor: '#000080', contentPadding: '8px' },
        { id: 'item-txt', type: 'initials', value: 'TXT', angle: 180, radius: 130.7, size: 60, shape: 'circle', backgroundColor: '#2a52be', contentPadding: '8px' },
        { id: 'item-jpg', type: 'initials', value: 'JPG', angle: 240, radius: 130.7, size: 60, shape: 'circle', backgroundColor: '#000080', contentPadding: '8px' },
        { id: 'item-png', type: 'initials', value: 'ENV', angle: 300, radius: 130.7, size: 60, shape: 'circle', backgroundColor: '#2a52be', contentPadding: '8px' },
      ];
      this.items = [...exampleScreenshotItems];
    }
    // If you still want to use defaultItems as a fallback if exampleScreenshotItems is empty,
    // you could do:
    // else if (this.defaultItems.length > 0) { // Or some other condition
    //   this.items = [...this.defaultItems];
    // }
  }

  onCentralButtonClick(): void {
    this.requestFileUpload.emit();
    console.log('Orbital central button clicked, requesting file upload.');
  }

  getStylesForItem(item: OrbitalItem): { [key: string]: any } {
    const xOffset = Math.cos(item.angle * Math.PI / 180) * item.radius;
    const yOffset = Math.sin(item.angle * Math.PI / 180) * item.radius;

    let fontSize;
    if (item.type === 'initials') {
      fontSize = `${item.size * (item.value.length > 2 ? 0.25 : item.value.length > 1 ? 0.3 : 0.4)}px`;
    } else if (item.type === 'icon-class') {
      fontSize = `${item.size * 0.5}px`;
    }

    const itemShape = item.shape || 'circle';
    const itemBackgroundColor = item.backgroundColor ||
      (itemShape === 'square' ? '#E0E0E0' : 'rgba(255,255,255,0.05)');

    let itemTextColor = item.textColor;
    if (!itemTextColor && (item.type === 'initials' || item.type === 'icon-class')) {
      itemTextColor = itemShape === 'square' ? (item.squareIconColor || '#FFFFFF') : '#FFFFFF';
    }
    if (item.type === 'icon-class' && item.squareIconColor && itemShape === 'square') {
      itemTextColor = item.squareIconColor;
    }

    let currentBorderWidth = item.borderWidth;
    let currentBorderColor = item.borderColor;

    if (itemShape === 'square') {
      currentBorderWidth = item.borderWidth || '1px';
      currentBorderColor = item.borderColor || 'rgba(255, 255, 255, 0.35)';
    } else {
      currentBorderWidth = item.borderWidth || '0px';
      currentBorderColor = item.borderColor || 'white';
    }

    if (item.isHighlighted) {
      currentBorderWidth = item.borderWidth ? `calc(${item.borderWidth} + 1px)` : (itemShape === 'square' ? '2px' : '3px');
      currentBorderColor = item.borderColor || '#FFA500';
    }
    const borderStyle = `${currentBorderWidth} solid ${currentBorderColor}`;

    const borderRadius = (itemShape === 'square') ?
      (item.size < 40 ? '4px' : item.size < 55 ? '6px' : '8px') :
      '50%';

    let boxShadow = item.squareShadow;
    if (!boxShadow) {
      if (itemShape === 'square') {
        boxShadow = `1.5px 1.5px 0px rgba(0,0,0,0.07), 2px 2px 3px rgba(0,0,0,0.1)`;
        if (item.isHighlighted) {
          boxShadow = `2px 2px 4px rgba(0,0,0,0.15), 3px 3px 6px rgba(0,0,0,0.2), inset 0 0 0 1px ${currentBorderColor}`;
        }
      } else {
        boxShadow = '0 2px 6px rgba(0,0,0,0.25)';
        if (item.isHighlighted) {
          boxShadow = `0 4px 10px rgba(0,0,0,0.3), 0 0 0 1px ${currentBorderColor}`;
        }
      }
    }

    const styles: { [key: string]: any } = {
      'width': `${item.size}px`,
      'height': `${item.size}px`,
      'background-color': itemBackgroundColor,
      'border': borderStyle,
      'color': itemTextColor || 'transparent',
      'left': `calc(50% + ${xOffset}px - ${item.size / 2}px)`,
      'top': `calc(50% + ${yOffset}px - ${item.size / 2}px)`,
      'border-radius': borderRadius,
      'box-shadow': boxShadow,
    };
    if (fontSize) {
      styles['font-size'] = fontSize;
    }
    return styles;
  }

  getContentContainerStyles(item: OrbitalItem): { [key: string]: any } {
    const styles: { [key: string]: any } = {
      width: '100%', height: '100%', display: 'flex',
      justifyContent: 'center', alignItems: 'center',
      position: 'relative', overflow: 'hidden',
    };
    if (item.contentPadding) { styles['padding'] = item.contentPadding; }
    return styles;
  }

  getImageContentStyles(item: OrbitalItem): { [key: string]: any } {
    const styles: { [key: string]: any } = {
      display: 'block', maxWidth: '100%', maxHeight: '100%',
      width: 'auto', height: 'auto',
      objectFit: item.imageObjectFit || 'contain',
    };
    if ((item.shape || 'circle') === 'circle') { styles['border-radius'] = '50%'; }
    return styles;
  }

  getItemLabelStyles(item: OrbitalItem): { [key: string]: any } {
    const labelRadius = item.radius + (item.size / 2) + 12;
    const xOffset = Math.cos(item.angle * Math.PI / 180) * labelRadius;
    const yOffset = Math.sin(item.angle * Math.PI / 180) * labelRadius;
    return {
      'left': `calc(50% + ${xOffset}px)`,
      'top': `calc(50% + ${yOffset}px)`,
      'transform': 'translate(-50%, -50%)',
      'color': 'rgba(0,0,0,0.6)',
      'text-shadow': '0 1px 1px rgba(255,255,255,0.3)',
    };
  }

  onItemClick(item: OrbitalItem): void {
    console.log('Clicked item:', item);
  }
}