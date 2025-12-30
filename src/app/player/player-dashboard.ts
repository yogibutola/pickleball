import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { PlayerService } from './player';

@Component({
    selector: 'app-player-dashboard',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './player-dashboard.html',
    styleUrl: './player-dashboard.css'
})
export class PlayerDashboardComponent {
    playerService = inject(PlayerService);
    router = inject(Router);

    leagues = this.playerService.getLeagues;
    selectedLeague = this.playerService.getSelectedLeague;
    upcomingMatches = this.playerService.getUpcomingMatches;

    selectLeague(leagueId: string) {
        this.playerService.selectLeague(leagueId);
    }

    viewMatchDetail(matchId: string) {
        this.router.navigate(['/player/match', matchId]);
    }

    formatDate(date: Date): string {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const matchDate = new Date(date);

        if (matchDate.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (matchDate.toDateString() === tomorrow.toDateString()) {
            return 'Tomorrow';
        } else {
            return matchDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
        }
    }

    getTeammates(match: any): string {
        const myId = this.playerService.getCurrentPlayerId();
        return match.players
            .filter((p: any) => match.myTeamPlayerIds.includes(p.id) && p.id !== myId)
            .map((p: any) => p.name)
            .join(', ');
    }

    getOpponents(match: any): string {
        return match.players
            .filter((p: any) => match.opponentTeamPlayerIds.includes(p.id))
            .map((p: any) => p.name)
            .join(', ');
    }
}
