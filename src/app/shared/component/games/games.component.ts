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

  // Updated games array with only Tic Tac Toe, using a reliable embeddable URL
  games: Game[] = [
    {
      id: 1,
      name: 'Tic Tac Toe',
      description: 'Play the classic game of Tic Tac Toe!',
      thumbnailUrl: 'assets/image/tic-tac-toy.jpg', //  Ensure you have this image or update path
      gameUrl: 'https://www.mathsisfun.com/games/tic-tac-toe.html',
      category: 'Strategy'
    },
  ];

  constructor(private sanitizer: DomSanitizer) { }

  ngOnInit(): void { }

  selectGame(game: Game): void {
    console.log('Selected game object:', game);
    console.log('Attempting to load URL:', game.gameUrl);
    this.selectedGameUrl = this.sanitizer.bypassSecurityTrustResourceUrl(game.gameUrl);
    this.selectedGameName = game.name;
  }

  closePanel(): void {
    this.selectedGameUrl = null;
    this.selectedGameName = null;
    this.close.emit();
  }

  getSanitizedUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}