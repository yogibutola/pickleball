import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LeagueService } from '../league/league';
import { MatchService } from './match';
import { AuthService } from '../auth/auth';

@Component({
  selector: 'app-match-entry',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './match-entry.html',
  styleUrl: './match-entry.css'
})
export class MatchEntryComponent {
  leagueService = inject(LeagueService);
  matchService = inject(MatchService);
  authService = inject(AuthService);
  router = inject(Router);

  players = this.leagueService.getPlayers();
  currentUserId = this.authService.currentUser()?.id;

  partnerId = '';
  opponent1Id = '';
  opponent2Id = '';
  myScore: number | null = null;
  opponentScore: number | null = null;

  // Current date and time for display
  currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Get current player info
  getCurrentPlayer() {
    return this.players().find(p => p.id === this.currentUserId);
  }

  // Form validation
  isFormValid(): boolean {
    return !!(
      this.partnerId &&
      this.opponent1Id &&
      this.opponent2Id &&
      this.myScore !== null &&
      this.opponentScore !== null &&
      this.partnerId !== this.opponent1Id &&
      this.partnerId !== this.opponent2Id &&
      this.opponent1Id !== this.opponent2Id
    );
  }

  onSubmit() {
    if (this.isFormValid()) {
      this.matchService.addMatch({
        id: crypto.randomUUID(),
        date: new Date(),
        players: [this.currentUserId!, this.partnerId, this.opponent1Id, this.opponent2Id],
        scores: [this.myScore!, this.opponentScore!],
        winnerTeam: this.myScore! > this.opponentScore! ? 1 : 2
      });
      this.router.navigate(['/player']);
    }
  }
}
