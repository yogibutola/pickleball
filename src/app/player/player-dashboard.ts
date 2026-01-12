import { Component, inject, signal } from '@angular/core';
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
    completedMatches = this.playerService.getCompletedMatches;
    standings = this.playerService.getStandings;

    // Local navigation state
    activeSection = signal<'matches' | 'leagues' | 'stats' | 'standings'>('matches');
    selectedRound = signal<string>('');

    setActiveSection(section: 'matches' | 'leagues' | 'stats' | 'standings') {
        this.activeSection.set(section);
    }

    setSelectedRound(roundId: string) {
        this.selectedRound.set(roundId);
    }

    // Get unique rounds from all matches
    getAvailableRounds(): { id: string; name: string }[] {
        const allMatches = [...this.upcomingMatches(), ...this.completedMatches()];
        const roundsMap = new Map<string, string>();

        allMatches.forEach(match => {
            if (match.roundId && !roundsMap.has(match.roundId)) {
                roundsMap.set(match.roundId, match.roundName || `Round ${match.roundId}`);
            }
        });

        return Array.from(roundsMap.entries()).map(([id, name]) => ({ id, name }));
    }

    // Get unique groups for the selected round
    getGroupsForRound(roundId: string): string[] {
        const allMatches = [...this.upcomingMatches(), ...this.completedMatches()];
        const groups = new Set<string>();

        allMatches
            .filter(m => m.roundId === roundId && m.groupId)
            .forEach(m => groups.add(m.groupId!));

        return Array.from(groups).sort();
    }

    // Get standings for a specific group in a specific round
    getStandingsForGroupAndRound(groupId: string, roundId: string): any[] {
        const allMatches = [...this.upcomingMatches(), ...this.completedMatches()];

        // Get completed matches for this group and round
        const groupRoundMatches = allMatches.filter(m =>
            m.groupId === groupId &&
            m.roundId === roundId &&
            m.status === 'completed'
        );

        // Calculate standings from these matches
        const standingsMap = new Map<string, { email: string; name: string; totalScore: number; matchesPlayed: number }>();

        groupRoundMatches.forEach(match => {
            // Add players from my team
            match.myTeamPlayerIds.forEach(email => {
                const player = match.players.find(p => p.id === email);
                if (player) {
                    let entry = standingsMap.get(email);
                    if (!entry) {
                        entry = { email, name: player.name, totalScore: 0, matchesPlayed: 0 };
                        standingsMap.set(email, entry);
                    }
                    entry.totalScore += match.team1Score || 0;
                    entry.matchesPlayed += 1;
                }
            });

            // Add players from opponent team
            match.opponentTeamPlayerIds.forEach(email => {
                const player = match.players.find(p => p.id === email);
                if (player) {
                    let entry = standingsMap.get(email);
                    if (!entry) {
                        entry = { email, name: player.name, totalScore: 0, matchesPlayed: 0 };
                        standingsMap.set(email, entry);
                    }
                    entry.totalScore += match.team2Score || 0;
                    entry.matchesPlayed += 1;
                }
            });
        });

        return Array.from(standingsMap.values()).sort((a, b) => b.totalScore - a.totalScore);
    }

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

    getGroupStandings(groupId: string): any[] {
        if (!groupId) return [];

        const allStandings = this.standings();
        const completedMatches = this.completedMatches();

        // Get all player IDs from matches in this group
        const groupPlayerIds = new Set<string>();
        completedMatches
            .filter(m => m.groupId === groupId)
            .forEach(match => {
                match.players.forEach(p => groupPlayerIds.add(p.id.toLowerCase()));
            });

        // Filter standings to only include players in this group
        const groupStandings = allStandings.filter((standing: any) =>
            groupPlayerIds.has(standing.email.toLowerCase())
        );

        // Sort by total score descending
        return groupStandings.sort((a: any, b: any) => b.totalScore - a.totalScore);
    }
}
