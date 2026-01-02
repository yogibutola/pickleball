import { Component, computed, signal, inject, effect, Injector } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { LeagueService, Player, LeagueRoundPayload, RoundItem, GroupItem, MatchItem, TeamItem, TeamMember } from './league';
import { AdminService } from '../admin/admin';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

interface MatchSlot {
  id: string;
  team1: Player[];
  team2: Player[];
  score1?: number;
  score2?: number;
  time?: string;
  courtNumber?: string;
}

@Component({
  selector: 'app-daily-slotting',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './daily-slotting.html',
  styleUrl: './daily-slotting.css'
})
export class DailySlottingComponent {
  private leagueService = inject(LeagueService);
  private adminService = inject(AdminService);
  private route = inject(ActivatedRoute);

  leagueId = signal<string | null>(null);
  league = computed(() => this.adminService.leagues().find(l => l.league_id === this.leagueId()));

  currentRound = signal<1 | 2>(1);
  slottingDate = signal<string>(new Date().toISOString().split('T')[0]);
  collapsedGroups = signal<Set<number>>(new Set());

  // Per group match state
  round1Matches = signal<Map<number, MatchSlot[]>>(new Map());
  round2Matches = signal<Map<number, MatchSlot[]>>(new Map());
  sittingPlayers = signal<Map<number, Player[][]>>(new Map()); // List of sitting players per match

  groups = computed(() => this.leagueService.getGroups());

  constructor() {
    this.route.queryParams.subscribe(params => {
      const id = params['league_id'];
      this.leagueId.set(id);
      if (id) {
        this.leagueService.fetchPlayers(id);
      }
    });

    // Automatically generate Round 1 when groups (players) are loaded
    effect(() => {
      const groups = this.groups();
      if (groups.length > 0 && this.currentRound() === 1 && this.round1Matches().size === 0) {
        this.generateRound1();
      }
    }, { allowSignalWrites: true });
  }

  generateRound1() {
    const groups = this.groups();
    const matchesMap = new Map<number, MatchSlot[]>();
    const sittingMap = new Map<number, Player[][]>();

    groups.forEach(group => {
      if (group.players.length === 5) {
        // Sort by DUPR (should already be sorted from service, but to be sure)
        const sorted = [...group.players].sort((a, b) => b.dupr_rating - a.dupr_rating);
        const p = sorted; // Shorthand for P1-P5

        const matches: MatchSlot[] = [
          { id: `g${group.level}-r1-m1`, team1: [p[0], p[3]], team2: [p[1], p[2]], time: '09:00', courtNumber: '1' },
          { id: `g${group.level}-r1-m2`, team1: [p[0], p[1]], team2: [p[2], p[4]], time: '09:20', courtNumber: '1' },
          { id: `g${group.level}-r1-m3`, team1: [p[1], p[4]], team2: [p[2], p[3]], time: '09:40', courtNumber: '1' },
          { id: `g${group.level}-r1-m4`, team1: [p[0], p[2]], team2: [p[3], p[4]], time: '10:00', courtNumber: '1' },
          { id: `g${group.level}-r1-m5`, team1: [p[0], p[4]], team2: [p[1], p[3]], time: '10:20', courtNumber: '1' }
        ];

        matchesMap.set(group.level, matches);
        sittingMap.set(group.level, [[p[4]], [p[3]], [p[0]], [p[1]], [p[2]]]);
      } else if (group.players.length === 4) {
        // Logic for 4 players (3 matches, no sitting)
        const sorted = [...group.players].sort((a, b) => b.dupr_rating - a.dupr_rating);
        const p = sorted; // Shorthand P1-P4

        const matches: MatchSlot[] = [
          { id: `g${group.level}-r1-m1`, team1: [p[0], p[1]], team2: [p[2], p[3]], time: '09:00', courtNumber: '1' }, // 1&2 vs 3&4
          { id: `g${group.level}-r1-m2`, team1: [p[0], p[2]], team2: [p[1], p[3]], time: '09:20', courtNumber: '1' }, // 1&3 vs 2&4
          { id: `g${group.level}-r1-m3`, team1: [p[0], p[3]], team2: [p[1], p[2]], time: '09:40', courtNumber: '1' }, // 1&4 vs 2&3
        ];

        matchesMap.set(group.level, matches);
        // No sitting players for groups of 4
        sittingMap.set(group.level, [[], [], []]);
      }
    });

    this.round1Matches.set(matchesMap);
    this.sittingPlayers.set(sittingMap);
    this.currentRound.set(1);
  }

  canGenerateRound2(): boolean {
    const r1 = this.round1Matches();
    if (r1.size === 0) return false;

    for (const [_, matches] of r1) {
      for (const m of matches) {
        if (m.score1 === undefined || m.score2 === undefined) return false;
      }
    }
    return true;
  }

  generateRound2() {
    const groups = this.groups();
    const r2MatchesMap = new Map<number, MatchSlot[]>();
    const sittingMap = new Map<number, Player[][]>();
    const r1MatchesMap = this.round1Matches();

    groups.forEach(group => {
      if (group.players.length === 5) {
        const matches = r1MatchesMap.get(group.level) || [];

        // Aggregate points from all 5 matches
        const playerScores = new Map<string, number>();
        group.players.forEach(p => playerScores.set(p.id, 0));

        matches.forEach(m => {
          m.team1.forEach(p => {
            const current = playerScores.get(p.id) || 0;
            playerScores.set(p.id, current + (m.score1 || 0));
          });
          m.team2.forEach(p => {
            const current = playerScores.get(p.id) || 0;
            playerScores.set(p.id, current + (m.score2 || 0));
          });
        });

        const rankedPlayers = [...group.players].sort((a, b) => {
          const scoreA = playerScores.get(a.id) || 0;
          const scoreB = playerScores.get(b.id) || 0;
          if (scoreB !== scoreA) return scoreB - scoreA;
          return b.dupr_rating - a.dupr_rating; // Tie-break with DUPR
        });

        // Round 2 (just 1 match for now as a demo of progression)
        const match: MatchSlot = {
          id: `g${group.level}-r2-m1`,
          team1: [rankedPlayers[0], rankedPlayers[4]],
          team2: [rankedPlayers[1], rankedPlayers[3]],
          time: '11:00',
          courtNumber: '1'
        };
        r2MatchesMap.set(group.level, [match]);
        sittingMap.set(group.level, [[rankedPlayers[2]]]);
      }
    });

    this.round2Matches.set(r2MatchesMap);
    this.sittingPlayers.set(sittingMap);
    this.currentRound.set(2);
  }

  getMatchesForGroup(level: number) {
    return this.currentRound() === 1
      ? (this.round1Matches().get(level) || [])
      : (this.round2Matches().get(level) || []);
  }

  getSittingPlayer(level: number, matchIndex: number) {
    const groupSitting = this.sittingPlayers().get(level);
    if (!groupSitting) return null;
    const matchSitting = groupSitting[matchIndex];
    return matchSitting ? matchSitting[0] : null;
  }

  toggleGroup(level: number) {
    this.collapsedGroups.update(set => {
      const newSet = new Set(set);
      if (newSet.has(level)) newSet.delete(level);
      else newSet.add(level);
      return newSet;
    });
  }

  isGroupCollapsed(level: number) {
    return this.collapsedGroups().has(level);
  }

  saveSlotting() {
    const league = this.league();
    if (!league) return;

    const rounds: RoundItem[] = [];

    const mapToMatchItem = (m: MatchSlot, level: number, index: number): MatchItem => {
      const sitting = this.getSittingPlayer(level, index);
      return {
        match_id: m.id,
        team_one: {
          team_id: `${m.id}-t1`,
          team_name: 'Team 1',
          player_one: { firstName: m.team1[0].firstName || '', lastName: m.team1[0].lastName || '', email: m.team1[0].email },
          player_two: { firstName: m.team1[1].firstName || '', lastName: m.team1[1].lastName || '', email: m.team1[1].email },
          score: m.score1 || 0
        },
        team_two: {
          team_id: `${m.id}-t2`,
          team_name: 'Team 2',
          player_one: { firstName: m.team2[0].firstName || '', lastName: m.team2[0].lastName || '', email: m.team2[0].email },
          player_two: { firstName: m.team2[1].firstName || '', lastName: m.team2[1].lastName || '', email: m.team2[1].email },
          score: m.score2 || 0
        },
        siting_player: sitting ? { firstName: sitting.firstName || '', lastName: sitting.lastName || '', email: sitting.email } : undefined,
        time: `${this.slottingDate()}T${(m.time || '09:00')}:00`,
        court_number: m.courtNumber || '1'
      };
    };

    // Round 1
    const r1 = this.round1Matches();
    if (r1.size > 0) {
      const groups: GroupItem[] = [];
      for (const [level, matches] of r1) {
        groups.push({
          group_id: `G${level}`,
          group_name: `Group ${level}`,
          match: matches.map((m, i) => mapToMatchItem(m, level, i))
        });
      }
      rounds.push({ round_id: 'R1', group: groups });
    }

    // Round 2
    const r2 = this.round2Matches();
    if (r2.size > 0) {
      const groups: GroupItem[] = [];
      for (const [level, matches] of r2) {
        groups.push({
          group_id: `G${level}`,
          group_name: `Group ${level}`,
          match: matches.map((m, i) => mapToMatchItem(m, level, i))
        });
      }
      rounds.push({ round_id: 'R2', group: groups });
    }

    const payload: LeagueRoundPayload = {
      league_id: league.league_id,
      league_name: league.league_name,
      rounds: rounds
    };

    this.leagueService.saveRoundData(payload).subscribe({
      next: (res) => alert('Slotting saved successfully!'),
      error: (err) => {
        console.error('Error saving slotting:', err);
        console.error('Error saving slotting:', JSON.stringify(err.error));
        alert('Error saving slotting: ' + JSON.stringify(err.error));
      }
    });
  }
}
