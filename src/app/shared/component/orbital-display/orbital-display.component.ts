// src/app/orbital-display/orbital-display.component.ts

import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

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
  borderColor?: string;
  textColor?: string;
  isHighlighted?: boolean;
  imageObjectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'; // Ensure this is here
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
  @Input() baseBackgroundColor: string = '#08011d'; // Default dark background
  @Input() centralButtonAction: () => void = () => {
    console.log('Central button clicked!');
  };

  defaultItems: OrbitalItem[] = [
    // --- Outer Orbit (Matches your desired dark screenshot more closely) ---
    // Radius around 200-220, Size around 48-55
    { id: 'user1-glasses', type: 'image', value: 'assets/image/avatars/man-glasses.png', altText: 'User with Glasses', angle: 340, radius: 210, size: 50 },
    { id: 'ga-outer', type: 'initials', value: 'GA', angle: 5, radius: 210, size: 50, backgroundColor: '#251e3e', textColor: '#c0c0e0' },
    { id: 'user-saitama', type: 'image', value: 'assets/image/avatars/anime-guy-orange-bg.png', altText: 'Anime Guy Orange BG', angle: 30, radius: 210, size: 50 }, // Assuming an image like one in desired shot
    { id: 'link-outer', type: 'icon-class', value: 'fas fa-link', angle: 55, radius: 210, size: 50, backgroundColor: '#2c3e50', textColor: '#e0e0e0' }, // Slightly different blue
    { id: 'firefox-logo', type: 'image', value: 'assets/image/icons/firefox-logo-filled.png', altText: 'Firefox', angle: 80, radius: 210, size: 60, isHighlighted: true, borderColor: '#FF9500' },
    { id: 'm-logo', type: 'image', value: 'assets/image/icons/m-logo-filled.png', altText: 'M Logo', angle: 105, radius: 210, size: 60, isHighlighted: true, borderColor: '#FF9500' },
    { id: 'jo-outer', type: 'initials', value: 'JO', angle: 130, radius: 210, size: 50, backgroundColor: '#251e3e', textColor: '#c0c0e0' },
    { id: 'dh-outer', type: 'initials', value: 'DH', angle: 155, radius: 210, size: 50, backgroundColor: '#251e3e', textColor: '#c0c0e0' },
    { id: 'user-anime-pink', type: 'image', value: 'assets/image/avatars/anime-girl-pink-hair.png', altText: 'Anime Girl Pink Hair', angle: 180, radius: 210, size: 50 }, // Assuming an image
    { id: 'ukn-logo', type: 'image', value: 'assets/image/icons/ukn-logo-filled.png', altText: 'UKN Logo', angle: 205, radius: 210, size: 60, isHighlighted: true, borderColor: '#FF9500' },
    { id: 'user-man-smile', type: 'image', value: 'assets/image/avatars/man-smiling-close.png', altText: 'Smiling Man Close', angle: 230, radius: 210, size: 50 }, // Assuming an image
    { id: 'kr-outer', type: 'initials', value: 'KR', angle: 255, radius: 210, size: 50, backgroundColor: '#251e3e', textColor: '#c0c0e0' },
    { id: 'user-anime-purple', type: 'image', value: 'assets/image/avatars/anime-girl-purple-hair.png', altText: 'Anime Girl Purple Hair', angle: 280, radius: 210, size: 50 }, // Assuming an image
    { id: 'user-avatar-prisma', type: 'image', value: 'assets/image/icons/prisma-logo-like.png', altText: 'Prisma-like logo', angle: 305, radius: 210, size: 50 }, // Assuming an image

    // --- Inner Orbit (UNCOMMENTED and adjusted to match desired screenshot) ---
    // Radius around 130-150, Size around 40-50
    // {
    //   id: 'bar-chart-icon', type: 'image', value: 'assets/image/icons/bar-chart-icon.png', // Example: "Trefo" from your 1st screenshot could be like this
    //   altText: 'Bar Chart Icon', angle: 240, radius: 140, size: 45,
    //   // imageObjectFit: 'contain' // if the icon has a lot of padding
    // },
    // {
    //   id: 'user-blue-shirt', type: 'image', value: 'assets/image/avatars/man-blue-shirt.png', // "Man"
    //   altText: 'Man in Blue Shirt', angle: 275, radius: 140, size: 45,
    //   // imageObjectFit: 'contain' // if avatar is small in its frame
    // },
    // {
    //   id: 'white-rect-logo', type: 'image', value: 'assets/image/icons/white-rect-logo.png', // "Whit" / "L" shape from desired
    //   altText: 'White Rect Logo', angle: 310, radius: 140, size: 45, isHighlighted: true, borderColor: '#FF9500',
    //   imageObjectFit: 'contain' // Often good for logos with specific shapes on transparent BG
    // }
  ];

  constructor() { }

  ngOnInit(): void {
    if (this.items.length === 0) {
      this.items = [...this.defaultItems]; // Use spread to create a new array instance
    }
    // CRITICAL: Ensure your image assets are well-prepared (square, centered content)
    // For `imageObjectFit: 'cover'` (default) to work best.
    // Use `imageObjectFit: 'contain'` for images with significant internal padding
    // or non-square subjects you want fully visible.
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

    return {
      'width': `${item.size}px`,
      'height': `${item.size}px`,
      'background-color': itemBackgroundColor,
      'border': item.isHighlighted ? `3px solid ${item.borderColor || '#FF9500'}` : `2px solid rgba(150, 150, 220, 0.3)`,
      'color': item.textColor || '#e0e0e0',
      'left': `calc(50% + ${xOffset}px - ${item.size / 2}px)`,
      'top': `calc(50% + ${yOffset}px - ${item.size / 2}px)`,
      'font-size': fontSize
    };
  }

  getItemLabelStyles(item: OrbitalItem): { [key: string]: any } {
    const labelRadiusOffset = item.size / 2 + 15; // Distance of label from item edge
    // Calculate label position based on item's angle and radius + offset
    const xOffset = Math.cos(item.angle * Math.PI / 180) * (item.radius + labelRadiusOffset);
    const yOffset = Math.sin(item.angle * Math.PI / 180) * (item.radius + labelRadiusOffset);

    // For labels, we want them to be outside the item, so we adjust the radius for positioning
    // The transform: translate(-50%, -50%) then centers the label text itself at that point.
    return {
      'left': `calc(50% + ${xOffset}px)`,
      'top': `calc(50% + ${yOffset}px)`,
      'transform': 'translate(-50%, -50%)', // Center the label text block
      'color': '#b0b0b0',
    };
  }

  onItemClick(item: OrbitalItem): void {
    console.log('Clicked item:', item);
  }
}