import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';

export interface Player {
  id: string;
  name: string; // Computed/Combined name for UI
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  password?: string; // Optional for safety
  dupr_rating: number;
}

export interface Group {
  level: number;
  players: Player[];
}

export interface TeamMember {
  firstName: string;
  lastName: string;
  email: string;
}

export interface TeamItem {
  team_id: string;
  team_name: string;
  player_one: TeamMember;
  player_two: TeamMember;
  score: number;
}

export interface MatchItem {
  match_id: string;
  team_one: TeamItem;
  team_two: TeamItem;
  siting_player?: TeamMember;
  time: string;
  court_number: string;
}

export interface GroupItem {
  group_id: string;
  group_name: string;
  match: MatchItem[];
}

export interface RoundItem {
  round_id: string;
  group: GroupItem[];
}

export interface LeagueRoundPayload {
  league_id: string | number;
  league_name: string;
  rounds: RoundItem[];
}

@Injectable({
  providedIn: 'root'
})
export class LeagueService {
  private http = inject(HttpClient);

  // Signal for players, initially empty
  private players = signal<Player[]>([]);

  constructor() {
    this.fetchPlayers();
  }

  // Fetch players from API and update signal
  fetchPlayers(leagueId?: string) {
    console.log("leagueId: " + leagueId);
    const url = leagueId ? `api/v1/league/id/${leagueId}` : 'api/v1/players';
    console.log(url);
    this.http.get<any[]>(url).pipe(
      map(data => data.map(p => ({
        id: p.id || p._id || Math.random().toString(36).substr(2, 9),
        name: p.firstName && p.lastName ? `${p.firstName} ${p.lastName}` : (p.name || p.userName || 'Unknown Player'),
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        userName: p.userName || '',
        email: p.email || '',
        password: '', // Dummy password for backend validator if needed
        dupr_rating: p.dupr_rating || 0
      }))),
      catchError(err => {
        console.error('Error fetching players:', err);
        return of([]);
      })
    ).subscribe(players => {
      this.players.set(players);
    });
  }

  getPlayers() {
    return this.players;
  }

  // Core Logic: Slotting players into groups of 5 based on rating
  getGroups(): Group[] {
    const playersList = this.players();
    if (playersList.length === 0) return [];

    const sortedPlayers = [...playersList].sort((a, b) => b.dupr_rating - a.dupr_rating);
    const groups: Group[] = [];

    for (let i = 0; i < sortedPlayers.length; i += 5) {
      groups.push({
        level: groups.length + 1,
        players: sortedPlayers.slice(i, i + 5)
      });
    }

    return groups;
  }

  // Core Logic: Promotion and Relegation
  // "After every round move the top player from a group to next higher group"
  // "After every round move the bottom player from a group to next lower group"
  // Note: This logic implies we need match results to know who is "top" of the group for that day.
  // For now, I will simulate this by assuming the "top" player is the one with highest match score gain (or just random/mocked for now if we don't have matches yet).
  // The Prompt says: "a top player from group 3 will move to group 2".

  // Implementation: We actually need to execute this move on the *list* of players ratings or just re-assign them?
  // If the groups are based *strictly* on rating, then updating a player's rating will automatically move them if they cross the threshold.
  // HOWEVER, the prompt implies a structural move: "move the top player... to next higher group".
  // This suggests "Groups" might be stateful for the day, OR we adjust ratings such that they resort correctly?
  // A common league approach is: You play in your group. Based on results, your rating changes OR you specifically swap with the person above/below.
  // Let's implement a `swapPlayers(playerA, playerB)` or `updateRatings` approach.
  // Simpler approach for this task: Update ratings + small boost/penalty to force resort, OR just return the visual "Next Session" groups.

  simulatePromotionRelegation(groups: Group[]) {
    // This is complex because "Top player" of the day depends on match results (which we haven't implemented yet).
    // I will leave this for integration with Match Service.
  }

  saveRoundData(payload: LeagueRoundPayload) {
    console.log('Saving round data:', payload);
    return this.http.post('api/v1/league/round', payload);
  }
}
