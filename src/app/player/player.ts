// Reusing interfaces from league.ts where possible or defining new ones specific to player view if needed
import { LeagueRoundPayload, RoundItem, GroupItem, MatchItem, TeamItem, TeamMember } from '../league/league';
import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../auth/auth';
import { catchError, map } from 'rxjs/operators';
import { Observable, of } from 'rxjs';

export interface PlayerLeague {
    id: string;
    name: string;
    status: 'active' | 'upcoming' | 'completed';
    startDate: Date;
    endDate: Date;
}

export interface MatchPlayer {
    id: string;
    name: string;
    rating: number;
}

export interface UpcomingMatch {
    id: string;
    leagueId: string;
    leagueName: string;
    date: Date;
    time: string;
    court: string;
    status: 'upcoming' | 'in-progress' | 'completed';
    players: MatchPlayer[];
    myTeamPlayerIds: string[];
    opponentTeamPlayerIds: string[];
    // Additional fields from API
    roundId?: string;
    groupId?: string;
    score?: number;
}

@Injectable({
    providedIn: 'root'
})
export class PlayerService {
    // Mock current player ID
    private currentPlayerId = signal('1');

    // Mock leagues the player is part of
    private leagues = signal<PlayerLeague[]>([]);

    // All available leagues
    private allLeagues = signal<PlayerLeague[]>([]);

    // Selected league ID
    selectedLeagueId = signal<string | null>(null);


    // Mock upcoming matches
    private matches = signal<UpcomingMatch[]>([]);

    // Computed: Get all leagues player is in
    getLeagues = computed(() => this.leagues());

    // Computed: Get status of all available leagues
    getAllLeagues = computed(() => this.allLeagues());

    // Computed: Get active leagues only
    getActiveLeagues = computed(() =>
        this.leagues().filter(l => l.status === 'active' || l.status === 'upcoming')
    );

    // Computed: Get matches filtered by selected league
    getUpcomingMatches = computed(() => {
        const selectedId = this.selectedLeagueId();
        if (!selectedId) {
            return this.matches().filter(m => m.status === 'upcoming');
        }
        return this.matches().filter(
            m => m.leagueId === selectedId && m.status === 'upcoming'
        );
    });

    // Computed: Get selected league
    getSelectedLeague = computed(() => {
        const selectedId = this.selectedLeagueId();
        if (!selectedId) return null;
        return this.leagues().find(l => l.id === selectedId);
    });

    private http = inject(HttpClient);
    private authService = inject(AuthService);

    constructor() {
        // Automatically fetch leagues when current user changes
        effect(() => {
            const user = this.authService.currentUser();
            if (user?.email) {
                this.fetchLeaguesForPlayer(user.email);
            } else {
                this.leagues.set([]);
            }
        });
    }

    fetchLeaguesForPlayer(email: string) {
        this.http.get<any>(`api/v1/player/league/${email}`).pipe(
            map(data => {
                console.log('Player leagues API response:', data);
                if (!data) return [];
                // Handle response if it's not an array (e.g. wrapped in an object or just a single object)
                const leaguesList = Array.isArray(data) ? data : (data.leagues || (data.data ? data.data : []));

                return leaguesList.map((l: any) => ({
                    id: l.id || l._id || l.league_id || crypto.randomUUID(),
                    name: l.league_name || l.name || 'Unknown League',
                    status: l.status || l.league_status || 'active',
                    startDate: new Date(l.startDate || l.league_start_date || new Date()),
                    endDate: new Date(l.endDate || l.league_end_date || new Date())
                }));
            }),
            catchError(err => {
                alert('Error fetching player leagues: ' + err);
                console.error('Error fetching player leagues:', err);
                return of([]);
            })
        ).subscribe((leagues: PlayerLeague[]) => {
            this.leagues.set(leagues);
            if (leagues.length > 0) {
                if (!this.selectedLeagueId()) {
                    this.selectedLeagueId.set(leagues[0].id);
                }
                // Fetch details for the first league found or currently selected
                const leagueToFetch = leagues.find(l => l.id === this.selectedLeagueId()) || leagues[0];
                this.fetchLeagueDetailsByName(leagueToFetch.name, leagueToFetch.id);
            }
        });
    }

    fetchLeagueDetailsByName(leagueName: string, leagueId: string) {
        console.log(`Fetching details for league: ${leagueName}`);
        this.http.get<LeagueRoundPayload>(`api/v1/league/name/${leagueName}`).pipe(
            catchError(err => {
                console.error('Error fetching league details:', err);
                return of(null);
            })
        ).subscribe(details => {
            if (details && details.rounds) {
                const currentPlayerId = this.getCurrentPlayerId(); // This might be mock '1', need real ID
                const realUser = this.authService.currentUser();
                // If we have a real user, try to match by email since ID migh vary
                const userEmail = realUser?.email;

                console.log('Current User Email:', userEmail);
                console.log('League Details:', details);

                const newMatches: UpcomingMatch[] = [];

                if (!userEmail) {
                    console.warn('No user email found, cannot filter matches.');
                    return;
                }

                details.rounds.forEach(round => {
                    round.group.forEach(group => {
                        group.match.forEach(match => {
                            // Check if current player is in this match
                            const p1 = match.team_one.player_one;
                            const p2 = match.team_one.player_two;
                            const p3 = match.team_two.player_one;
                            const p4 = match.team_two.player_two;

                            const allPlayers = [p1, p2, p3, p4];
                            const isParticipant = allPlayers.some(p => p.email === userEmail); // Match by email

                            if (isParticipant) {
                                console.log('Found match for user:', match.match_id);
                                // Map to UpcomingMatch
                                newMatches.push({
                                    id: match._id || match.match_id,
                                    leagueId: leagueId, // Use passed ID instead of relying on details
                                    leagueName: details.league_name,
                                    date: new Date(), // Date not in payload yet, defaulting
                                    time: 'TBD',
                                    court: 'TBD',
                                    status: 'upcoming', // Default
                                    players: allPlayers.map((p, index) => ({
                                        id: p.email, // using email as ID for now
                                        name: `${p.firstName} ${p.lastName}`,
                                        rating: 0 // Not in payload
                                    })),
                                    myTeamPlayerIds: (p1.email === userEmail || p2.email === userEmail) ? [p1.email, p2.email] : [p3.email, p4.email],
                                    opponentTeamPlayerIds: (p1.email === userEmail || p2.email === userEmail) ? [p3.email, p4.email] : [p1.email, p2.email],
                                    roundId: round.round_id,
                                    groupId: group.group_id
                                });
                            }
                        });
                    });
                });

                if (newMatches.length > 0) {
                    this.matches.set(newMatches);
                }
            }
        });
    }


    // Get match by ID
    getMatchById(matchId: string): UpcomingMatch | undefined {
        return this.matches().find(m => m.id === matchId);
    }

    // Select a league
    selectLeague(leagueId: string) {
        this.selectedLeagueId.set(leagueId);
        const league = this.leagues().find(l => l.id === leagueId);
        if (league) {
            this.fetchLeagueDetailsByName(league.name, league.id);
        }
    }

    // Get current player ID
    getCurrentPlayerId() {
        return this.currentPlayerId();
    }

    updateMatchScore(matchId: string, score1: number, score2: number) {
        console.log(`Sending score update for ${matchId}: ${score1} - ${score2}`);

        const payload = {
            match_id: matchId,
            score_team_1: score1,
            score_team_2: score2,
            match_status: 'completed'
        };

        return this.http.post('api/v1/league/match/score', payload).pipe(
            map(res => {
                console.log('Score update response:', res);
                return true;
            }),
            catchError(err => {
                console.error('Error updating score:', err);
                return of(false);
            })
        );
    }

    fetchAllLeagues() {
        this.http.get<any[]>('api/v1/all_leagues').pipe(
            map(data => {
                return data.map((l: any) => ({
                    id: l.id || l._id || String(l.league_id) || crypto.randomUUID(),
                    name: l.league_name || l.name || 'Unknown League',
                    status: l.status || l.league_status || 'active',
                    startDate: new Date(l.startDate || l.league_start_date || new Date()),
                    endDate: new Date(l.endDate || l.league_end_date || new Date())
                }));
            }),
            catchError(err => {
                console.error('Error fetching all leagues:', err);
                return of([]);
            })
        ).subscribe(leagues => {
            this.allLeagues.set(leagues);
        });
    }

    registerForLeague(leagueId: string): Observable<boolean> {
        const user = this.authService.currentUser();
        if (!user) return of(false);

        // alert(`Registering for league: ${leagueId}`);
        const payload = {
            league_id: leagueId,
            email: user.email
        };

        // Assuming this endpoint exists based on usual patterns, or we'd use a different update mechanism
        return this.http.post('api/v1/league/register', payload).pipe(
            map(res => {
                // alert('Registration successful!');
                console.log('Registration successful:', res);
                // Refresh player leagues
                this.fetchLeaguesForPlayer(user.email);
                return true;
            }),
            catchError(err => {
                alert('Registration failed!!!!!' + err.message);
                console.error('Registration error:', err);
                // Fallback: If 404, we might not have the endpoint yet, alert user
                if (err.status === 404) {
                    alert('Registration endpoint not found on server. Please contact admin.');
                }
                return of(false);
            })
        );
    }
}
