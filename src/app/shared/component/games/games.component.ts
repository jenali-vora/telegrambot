import { Component, OnInit, Input, Output, EventEmitter, SecurityContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

export interface Game {
  id: number;
  name: string;
  description: string;
  thumbnailUrl: string; // Path to an image for the game (e.g., in your assets)
  gameUrl: string;      // The direct URL to the online game
  category?: string;
}

@Component({
  selector: 'app-game-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './games.component.html',
  styleUrls: ['./games.component.css']
})
export class GamesComponent implements OnInit {
  @Input() isVisible: boolean = false;
  @Output() close = new EventEmitter<void>();

  selectedGameUrl: SafeResourceUrl | null = null;
  selectedGameName: string | null = null;

  games: Game[] = [
    {
      id: 1,
      name: '2048',
      description: 'Join the numbers and get to the 2048 tile!',
      thumbnailUrl: 'assets/image/games/2048_thumbnail.png',
      gameUrl: 'https://play2048.co/',
      category: 'Puzzle'
    },
    {
      id: 2,
      name: 'Pac-Man',
      description: "Google's 30th Anniversary Pac-Man doodle.",
      thumbnailUrl: 'assets/image/games/pacman_thumbnail.png',
      gameUrl: 'https://www.google.com/doodles/30th-anniversary-of-pac-man',
      category: 'Arcade'
    },
    {
      id: 3,
      name: 'Quick, Draw!',
      description: 'Can a neural network learn to recognize your doodles?',
      thumbnailUrl: 'assets/image/games/quickdraw_thumbnail.png',
      gameUrl: 'https://quickdraw.withgoogle.com/',
      category: 'Creative'
    },
    // Add more games here
  ];

  constructor(private sanitizer: DomSanitizer) { }

  ngOnInit(): void { }

  selectGame(game: Game): void {
    // IMPORTANT: Sanitize the URL before binding it to iframe src
    this.selectedGameUrl = this.sanitizer.bypassSecurityTrustResourceUrl(game.gameUrl);
    this.selectedGameName = game.name;
  }

  closePanel(): void {
    this.selectedGameUrl = null; // Clear selected game when closing
    this.selectedGameName = null;
    this.close.emit();
  }

  // Helper to prevent direct URL binding in template which can be unsafe
  getSanitizedUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}