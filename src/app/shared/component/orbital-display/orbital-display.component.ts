import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface OrbitalItem {
  id: string | number;
  type: 'image' | 'initials' | 'icon-class';
  value: string;
  altText?: string;
  label?: string; // For labels next to items
  angle: number;
  radius: number;
  size: number;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  isHighlighted?: boolean;
  imageObjectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
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
  @Input() baseBackgroundColor: string = '#0d47a1'; // Dark Blue from desired theme
  @Output() requestFileUpload = new EventEmitter<void>();

  // Adjusted radius for items to touch each other
  // Old radius was 230, new radius is ~130.7
  // Item size remains 48px, N=17 items.
  defaultItems: OrbitalItem[] = [
    { id: 'kr-initials', type: 'image', value: 'assets/image/zip.png', altText: 'zip', angle: 0, radius: 130.7, size: 48, backgroundColor: '#ffffff', isHighlighted: true, borderColor: '#FFA500', },
    { id: 'man-img', type: 'image', value: 'assets/image/jpg.png', altText: 'Man', angle: 21.176, radius: 130.7, size: 48, backgroundColor: '#ffffff', isHighlighted: true, borderColor: '#3e57da', },
    { id: 'bar-char-img', type: 'image', value: 'assets/image/foldericon.png', altText: 'folder', angle: 42.353, radius: 130.7, size: 60, isHighlighted: true, borderColor: '#FFA500', },
    { id: 'smilin-img', type: 'image', value: 'assets/image/file.png', altText: 'file', angle: 63.529, radius: 130.7, size: 60, backgroundColor: '#ffffff', isHighlighted: true, borderColor: '#3e57da', },
    { id: 'ukn-logo-img', type: 'image', value: 'assets/image/png.png', altText: 'png', angle: 84.706, radius: 130.7, size: 48, backgroundColor: '#ffffff', isHighlighted: true, borderColor: '#FFA500' },
    { id: 'anime-bottom', type: 'image', value: 'assets/image/vedio.jpg', altText: 'vedio', angle: 105.882, radius: 130.7, size: 48, backgroundColor: '#ffffff', isHighlighted: true, borderColor: '#3e57da', },
    { id: 'dh-initials', type: 'image', value: 'assets/image/svg.png', angle: 127.059, radius: 130.7, size: 48, backgroundColor: '#fff', isHighlighted: true, borderColor: '#FFA500' },
    { id: 'jo-initials', type: 'image', value: 'assets/image/gallery.png', altText: 'gallery', angle: 148.235, radius: 130.7, size: 60, backgroundColor: '#fff', isHighlighted: true, borderColor: '#3e57da', },
    { id: 'm-logo-img', type: 'image', value: 'assets/image/pdf.jpg', altText: 'pdf', angle: 169.412, radius: 130.7, size: 60, backgroundColor: '#ffffff', isHighlighted: true, borderColor: '#FFA500', imageObjectFit: 'contain' },
    { id: 'firefox-img', type: 'image', value: 'assets/image/mp3.png', altText: 'mp3', angle: 190.588, radius: 130.7, size: 48, backgroundColor: '#ffffff', isHighlighted: true, borderColor: '#3e57da', },
    { id: 'link-icon', type: 'image', value: 'assets/image/js.png', altText: 'js', angle: 211.765, radius: 130.7, size: 48, backgroundColor: '#fff', isHighlighted: true, borderColor: '#FFA500' },
    { id: 'anime-mid', type: 'image', value: 'assets/image/txt.png', altText: 'txt', angle: 232.941, radius: 130.7, size: 60, backgroundColor: '#ffffff', isHighlighted: true, borderColor: '#3e57da', },
    { id: 'ga-initials', type: 'image', value: 'assets/image/html.png', altText: 'html', angle: 254.118, radius: 130.7, size: 60, backgroundColor: '#fff', isHighlighted: true, borderColor: '#FFA500' },
    { id: 'user-img', type: 'image', value: 'assets/image/psd.png', altText: 'psd', angle: 275.294, radius: 130.7, size: 48, backgroundColor: '#ffffff', isHighlighted: true, borderColor: '#3e57da', },
    { id: 'whit-img', type: 'image', value: 'assets/image/css.svg', altText: 'css', angle: 296.471, radius: 130.7, size: 48, backgroundColor: '#ffffff', isHighlighted: true, borderColor: '#FFA500' },
    { id: 'prisma-img', type: 'image', value: 'assets/image/doc.png', altText: 'doc', angle: 317.647, radius: 130.7, size: 60, backgroundColor: '#ffffff', isHighlighted: true, borderColor: '#3e57da', },
    { id: 'anime-top', type: 'image', value: 'assets/image/mp4.jpg', altText: 'mp4', angle: 338.824, radius: 130.7, size: 60, backgroundColor: '#ffffff', isHighlighted: true, borderColor: '#FFA500' },
  ];

  constructor() { }

  ngOnInit(): void {
    if (this.items.length === 0) {
      this.items = [...this.defaultItems];
    }
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
      fontSize = `${item.size * (item.value.length > 1 ? 0.35 : 0.45)}px`;
    } else if (item.type === 'icon-class') {
      fontSize = `${item.size * 0.5}px`;
    }

    const itemBackgroundColor = item.backgroundColor || 'transparent';
    const itemTextColor = item.textColor || '#e0e0e0';

    let borderStyle = `1px solid rgba(255, 255, 255, 0.2)`;
    if (item.type === 'initials' || item.type === 'icon-class') {
      borderStyle = `1px solid ${item.backgroundColor || 'rgba(255,255,255,0.2)'}`;
    }
    if (item.isHighlighted) {
      borderStyle = `3px solid ${item.borderColor || '#FFA500'}`;
    }

    return {
      'width': `${item.size}px`,
      'height': `${item.size}px`,
      'background-color': itemBackgroundColor,
      'border': borderStyle,
      'color': itemTextColor,
      'left': `calc(50% + ${xOffset}px - ${item.size / 2}px)`,
      'top': `calc(50% + ${yOffset}px - ${item.size / 2}px)`,
      'font-size': fontSize,
    };
  }

  getItemLabelStyles(item: OrbitalItem): { [key: string]: any } {
    const labelRadius = item.radius + (item.size / 2) + 12;
    const xOffset = Math.cos(item.angle * Math.PI / 180) * labelRadius;
    const yOffset = Math.sin(item.angle * Math.PI / 180) * labelRadius;

    return {
      'left': `calc(50% + ${xOffset}px)`,
      'top': `calc(50% + ${yOffset}px)`,
      'transform': 'translate(-50%, -50%)',
      'color': '#d0d0d0',
    };
  }

  onItemClick(item: OrbitalItem): void {
    console.log('Clicked item:', item);
  }
}