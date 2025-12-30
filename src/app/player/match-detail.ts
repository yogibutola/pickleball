import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PlayerService, UpcomingMatch } from './player';

@Component({
    selector: 'app-match-detail',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './match-detail.html',
    styleUrl: './match-detail.css'
})
export class MatchDetailComponent implements OnInit {
    route = inject(ActivatedRoute);
    router = inject(Router);
    playerService = inject(PlayerService);

    match = signal<UpcomingMatch | undefined>(undefined);
    currentPlayerId = this.playerService.getCurrentPlayerId();

    // Score entry state
    isScoring = signal(false);
    team1Score = signal<number | null>(null); // My Team
    team2Score = signal<number | null>(null); // Opponent Team

    ngOnInit() {
        const matchId = this.route.snapshot.paramMap.get('id');
        if (matchId) {
            const foundMatch = this.playerService.getMatchById(matchId);
            this.match.set(foundMatch);
        }
    }

    goBack() {
        this.router.navigate(['/player']);
    }

    formatDate(date: Date): string {
        return new Date(date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    getMyTeamPlayers() {
        const m = this.match();
        if (!m) return [];
        return m.players.filter(p => m.myTeamPlayerIds.includes(p.id));
    }

    getOpponentTeamPlayers() {
        const m = this.match();
        if (!m) return [];
        return m.players.filter(p => m.opponentTeamPlayerIds.includes(p.id));
    }

    toggleScoreEntry() {
        this.isScoring.update(v => !v);
    }

    submitScore() {
        const t1 = this.team1Score();
        const t2 = this.team2Score();
        const m = this.match();
        const matchId = m?.id;

        if (t1 === null || t2 === null || !matchId || !m) {
            alert('Please enter valid scores for both teams.');
            return;
        }

        console.log(`Submitting score for match ${matchId}: ${t1} - ${t2}`);

        // Ensure we have necessary metadata
        const leagueName = m.leagueName || '';
        const roundId = m.roundId || '';
        const groupId = m.groupId || '';

        this.playerService.updateMatchScore(matchId, t1, t2, leagueName, roundId, groupId).subscribe(success => {
            if (success) {
                this.isScoring.set(false);
                alert('Score submitted successfully!');
                // Ideally reload match details here
            } else {
                alert('Failed to submit score. Please try again.');
            }
        });
    }
}
