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
    team1Score?: number;
    team2Score?: number;
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
    getActiveLeagues = computed(() => {
        const leagues = this.leagues();
        console.log('getActiveLeagues computed triggered, leagues count:', leagues.length);
        return leagues.filter(l => l.status === 'active' || l.status === 'upcoming');
    });

    // Computed: Get matches filtered by selected league (Upcoming only)
    getUpcomingMatches = computed(() => {
        const selectedId = this.selectedLeagueId();
        const allMatches = this.matches();
        console.log(`getUpcomingMatches computed: selectedLeagueId=${selectedId}, TotalMatches=${allMatches.length}`);

        const matches = allMatches.filter(m => m.status !== 'completed');
        if (!selectedId) {
            return matches;
        }
        const filtered = matches.filter(m => String(m.leagueId) === String(selectedId));
        console.log(`getUpcomingMatches: returning ${filtered.length} matches`);
        return filtered;
    });

    // Computed: Get completed matches filtered by selected league
    getCompletedMatches = computed(() => {
        const selectedId = this.selectedLeagueId();
        const allMatches = this.matches();
        console.log(`getCompletedMatches computed: selectedLeagueId=${selectedId}, TotalMatches=${allMatches.length}`);

        const matches = allMatches.filter(m => m.status === 'completed');
        if (!selectedId) {
            return matches;
        }
        const filtered = matches.filter(m => String(m.leagueId) === String(selectedId));
        console.log(`getCompletedMatches: returning ${filtered.length} matches`);
        return filtered;
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
                this.currentPlayerId.set(user.email);
                this.fetchLeaguesForPlayer(user.email);
            } else {
                this.leagues.set([]);
                this.currentPlayerId.set('1');
            }
        });
    }

    fetchLeaguesForPlayer(email: string) {
        this.http.get<any>(`api/v1/player/league/${email}`).pipe(
            map(data => {
                console.log('Player leagues API response:', data);
                if (!data) return [];
                const leaguesList = Array.isArray(data) ? data : (data.leagues || (data.data ? data.data : []));

                return leaguesList.map((l: any) => ({
                    id: String(l.id || l._id || l.league_id || crypto.randomUUID()),
                    name: l.league_name || l.name || 'Unknown League',
                    status: (l.status || l.league_status || 'active').toLowerCase(),
                    startDate: new Date(l.startDate || l.league_start_date || new Date()),
                    endDate: new Date(l.endDate || l.league_end_date || new Date())
                }));
            }),
            catchError(err => {
                console.error('Error fetching player leagues:', err);
                return of([]);
            })
        ).subscribe((leagues: PlayerLeague[]) => {
            console.log('Processed player leagues:', leagues);
            this.leagues.set(leagues);
            if (leagues.length > 0) {
                const currentSelectedId = this.selectedLeagueId();
                const stillExists = leagues.find(l => l.id === currentSelectedId);

                if (!currentSelectedId || !stillExists) {
                    console.log('Syncing selectedLeagueId to:', leagues[0].id);
                    this.selectedLeagueId.set(leagues[0].id);
                }

                const leagueToFetch = leagues.find(l => l.id === this.selectedLeagueId()) || leagues[0];
                this.fetchLeagueDetailsByName(leagueToFetch.name, leagueToFetch.id);
            } else {
                this.selectedLeagueId.set(null);
                this.matches.set([]);
            }
        });
    }

    fetchLeagueDetailsByName(leagueName: string, leagueId: string) {
        console.log(`[PlayerService] Fetching details for league: ${leagueName} (ID: ${leagueId})`);

        // Try fetching by name
        const encodedName = encodeURIComponent(leagueName);
        this.http.get<LeagueRoundPayload>(`api/v1/league/name/${encodedName}`).pipe(
            catchError(err => {
                console.error(`[PlayerService] Error fetching league details by name (${leagueName}):`, err);
                return of(null);
            })
        ).subscribe(details => {
            const matches = this.parseLeagueDetails(details, leagueId, leagueName);

            // If no matches found by name, try fetching by ID (which daily-slotting uses via the name endpoint)
            if (matches.length === 0 && leagueId && String(leagueId) !== String(leagueName)) { // Added String() for safety
                console.log(`[PlayerService] No matches found by name, trying fetch by ID: ${leagueId}`);
                this.http.get<LeagueRoundPayload>(`api/v1/league/name/${leagueId}`).pipe(
                    catchError(err => {
                        console.error(`[PlayerService] Error fetching league details by ID (${leagueId}):`, err);
                        return of(null);
                    })
                ).subscribe(idDetails => {
                    const idMatches = this.parseLeagueDetails(idDetails, leagueId, leagueName);
                    this.matches.set(idMatches);
                });
            } else {
                this.matches.set(matches);
            }
        });
    }

    private parseLeagueDetails(details: any, leagueId: string, leagueName: string): UpcomingMatch[] {
        if (!details) {
            console.warn(`[PlayerService] No details returned for ${leagueName}.`);
            return [];
        }

        const userEmail = this.authService.currentUser()?.email;
        if (!userEmail) {
            console.warn('[PlayerService] No user email found, cannot filter matches.');
            return [];
        }

        const emailLower = userEmail.toLowerCase();
        const newMatches: UpcomingMatch[] = [];

        console.log(`[PlayerService] Processing details for ${leagueName}. Response has matches: ${!!details.matches}, rounds: ${!!details.rounds}`);

        const playersLookup = new Map<string, any>();
        if (details.players) {
            details.players.forEach((p: any) => {
                if (p.email) playersLookup.set(p.email.toLowerCase(), p);
            });
        }

        const processMatch = (m: any) => {
            const t1 = m.team_one;
            const t2 = m.team_two;
            if (!t1 || !t2) {
                console.warn(`[PlayerService] Skipping match ${m._id || m.match_id} due to missing team data.`);
                return;
            }

            const p1 = t1.player_one;
            const p2 = t1.player_two;
            const p3 = t2.player_one;
            const p4 = t2.player_two;

            const allPlayers = [p1, p2, p3, p4].filter(p => !!p);
            const isParticipant = allPlayers.some(p => String(p.email)?.toLowerCase() === emailLower); // String() for safety

            if (isParticipant) {
                const myTeamEmails = [p1, p2].filter(p => !!p && !!p.email).map(p => String(p.email).toLowerCase()); // String() for safety
                const isTeam1 = myTeamEmails.includes(emailLower);
                console.log(`[PlayerService] Participant found in match ${m._id || m.match_id}. Is Team 1: ${isTeam1}`);

                // Date parsing robustnes: use m.date or extract from m.time if it looks like a date string
                let matchDate = m.date ? new Date(m.date) : new Date();
                if (m.time && (String(m.time).includes('-') || String(m.time).includes('/')) && isNaN(matchDate.getTime())) { // String() for safety
                    matchDate = new Date(m.time);
                }

                // If time is a full date string, extract just the time part for display
                let timeStr = String(m.time || 'TBD'); // String() for safety
                if (timeStr.includes('T')) {
                    timeStr = timeStr.split('T')[1].substring(0, 5);
                }

                newMatches.push({
                    id: String(m._id || m.match_id),
                    leagueId: String(leagueId || m.league_id || details.league_id),
                    leagueName: m.league_name || details.league_name || leagueName,
                    date: isNaN(matchDate.getTime()) ? new Date() : matchDate,
                    time: timeStr,
                    court: String(m.court_number || m.court || 'TBD'),
                    players: allPlayers.map(p => {
                        const lookup = playersLookup.get(String(p.email)?.toLowerCase()); // String() for safety
                        return {
                            id: String(p.id || p.email),
                            name: p.name || (p.firstName ? `${p.firstName} ${p.lastName}` : (lookup?.firstName ? `${lookup.firstName} ${lookup.lastName}` : 'Unknown')),
                            rating: p.dupr_rating || lookup?.dupr_rating || 0
                        };
                    }),
                    myTeamPlayerIds: isTeam1
                        ? [p1?.email, p2?.email].filter((e): e is string => !!e).map(String) // Map to String for safety
                        : [p3?.email, p4?.email].filter((e): e is string => !!e).map(String), // Map to String for safety
                    opponentTeamPlayerIds: isTeam1
                        ? [p3?.email, p4?.email].filter((e): e is string => !!e).map(String) // Map to String for safety
                        : [p1?.email, p2?.email].filter((e): e is string => !!e).map(String), // Map to String for safety
                    roundId: String(m.round_id || ''),
                    groupId: String(m.group_id || ''),
                    status: (String(m.match_status)?.toLowerCase() === 'completed' || String(m.match_status)?.toLowerCase() === 'finished' || (t1.score > 0 || t2.score > 0)) ? 'completed' : 'upcoming', // String() for safety
                    team1Score: t1.score || 0,
                    team2Score: t2.score || 0
                });
            }
        };

        if (details.matches && Array.isArray(details.matches)) {
            console.log(`[PlayerService] Processing ${details.matches.length} top-level matches.`);
            details.matches.forEach((m: any) => processMatch(m));
        }

        // Only check rounds if no matches found in top-level list
        if (newMatches.length === 0 && details.rounds && Array.isArray(details.rounds)) {
            console.log(`[PlayerService] No top-level matches found, processing ${details.rounds.length} rounds.`);
            details.rounds.forEach((round: any) => {
                round.group?.forEach((group: any) => {
                    group.match?.forEach((match: any) => processMatch(match));
                });
            });
        }

        console.log(`[PlayerService] Successfully mapped ${newMatches.length} matches for user.`);
        return newMatches;
    }


    // Get match by ID
    getMatchById(matchId: string): UpcomingMatch | undefined {
        return this.matches().find((m: UpcomingMatch) => String(m.id) === String(matchId));
    }

    // Select a league
    selectLeague(leagueId: string) {
        this.selectedLeagueId.set(leagueId);
        const league = this.leagues().find((l: PlayerLeague) => l.id === leagueId);
        if (league) {
            this.fetchLeagueDetailsByName(league.name, league.id);
        }
    }

    // Get current player ID
    getCurrentPlayerId() {
        return this.currentPlayerId();
    }

    updateMatchScore(leagueId: string, matchId: string, score1: number, score2: number) {
        console.log(`Sending score update for ${matchId} in league ${leagueId}: ${score1} - ${score2}`);

        const payload = {
            league_id: leagueId,
            match_id: matchId,
            score_team_1: score1,
            score_team_2: score2,
            match_status: 'completed'
        };

        return this.http.post('api/v1/league/match/score', payload).pipe(
            map(res => {
                console.log('Score update response:', res);
                // Update local signal to reflect changes immediately
                this.matches.update(currentMatches =>
                    currentMatches.map(m =>
                        m.id === matchId
                            ? { ...m, status: 'completed' as const, team1Score: score1, team2Score: score2 }
                            : m
                    )
                );
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
                if (!Array.isArray(data)) return [];
                return data.map((l: any) => ({
                    id: String(l.id || l._id || l.league_id || crypto.randomUUID()),
                    name: l.league_name || l.name || 'Unknown League',
                    status: (l.status || l.league_status || 'active').toLowerCase(),
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
