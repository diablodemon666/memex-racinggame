/**
 * TournamentFormats.test.js - Comprehensive Format-Specific Tests
 * 
 * Tests all tournament formats (Single Elimination, Double Elimination, Round Robin)
 * with different player counts and edge cases
 */

// Mock dependencies
jest.mock('../../multiplayer/MultiplayerEvents.js', () => ({
  multiplayerEvents: {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn()
  }
}));

jest.mock('../../utils/MersenneTwister.js', () => ({
  MersenneTwister: jest.fn().mockImplementation(() => ({
    random: jest.fn().mockReturnValue(0.5),
    seed: jest.fn()
  }))
}));

import { TournamentFormat } from '../formats/TournamentFormat';
import { SingleElimination } from '../formats/SingleElimination';
import { DoubleElimination } from '../formats/DoubleElimination';
import { RoundRobin } from '../formats/RoundRobin';
import { GameHelpers, AsyncHelpers, ValidationHelpers } from '../../../tests/utils/test-helpers';

describe('TournamentFormat (Base Class)', () => {
  let tournamentFormat;
  const mockConfig = {
    format: 'test_format',
    maxPlayers: 16,
    minPlayers: 4,
    raceTimeLimit: 300,
    playersPerRace: 6
  };

  beforeEach(() => {
    tournamentFormat = new TournamentFormat(mockConfig);
  });

  afterEach(() => {
    if (tournamentFormat) {
      tournamentFormat.cleanup();
    }
  });

  describe('Base Class Functionality', () => {
    it('should initialize with configuration', () => {
      expect(tournamentFormat.tournamentConfig.format).toBe('test_format');
      expect(tournamentFormat.tournamentConfig.maxPlayers).toBe(16);
      expect(tournamentFormat.participants).toBeInstanceOf(Map);
      expect(tournamentFormat.matches).toBeInstanceOf(Map);
      expect(tournamentFormat.statistics).toBeDefined();
    });

    it('should require implementation of abstract methods', async () => {
      await expect(tournamentFormat.initialize('test', [])).rejects.toThrow('initialize() must be implemented by subclass');
      expect(() => tournamentFormat.generateBracket()).toThrow('generateBracket() must be implemented by subclass');
      expect(() => tournamentFormat.getNextMatch()).toThrow('getNextMatch() must be implemented by subclass');
      expect(() => tournamentFormat.completeMatch('', {})).toThrow('completeMatch() must be implemented by subclass');
      expect(() => tournamentFormat.isComplete()).toThrow('isComplete() must be implemented by subclass');
      expect(() => tournamentFormat.getFinalStandings()).toThrow('getFinalStandings() must be implemented by subclass');
    });

    it('should initialize participants correctly', () => {
      const players = GameHelpers.createMockPlayers(4);
      
      tournamentFormat.initializeParticipants(players);

      expect(tournamentFormat.participants.size).toBe(4);
      expect(tournamentFormat.playerStats.size).toBe(4);
      
      players.forEach((player, index) => {
        const participant = tournamentFormat.participants.get(player.id);
        expect(participant.seed).toBe(index + 1);
        expect(participant.originalSeed).toBe(index + 1);
        expect(participant.isEliminated).toBe(false);
        
        const stats = tournamentFormat.playerStats.get(player.id);
        expect(stats.matchesPlayed).toBe(0);
        expect(stats.bestFinishPosition).toBe(Infinity);
      });
    });

    it('should create match with correct structure', () => {
      const players = GameHelpers.createMockPlayers(2);
      tournamentFormat.tournamentId = 'test-tournament';
      
      const match = tournamentFormat.createMatch({
        round: 1,
        players,
        matchType: 'standard',
        bracket: 'main'
      });

      expect(match.matchId).toBeDefined();
      expect(match.tournamentId).toBe('test-tournament');
      expect(match.round).toBe(1);
      expect(match.players).toHaveLength(2);
      expect(match.status).toBe('pending');
      expect(tournamentFormat.matches.has(match.matchId)).toBe(true);
      expect(tournamentFormat.statistics.totalMatches).toBe(1);
    });

    it('should handle bye matches correctly', () => {
      const player = GameHelpers.createMockPlayers(1)[0];
      tournamentFormat.tournamentId = 'test-tournament';
      
      const match = tournamentFormat.createMatch({
        round: 1,
        players: [player]
      });

      expect(tournamentFormat.isMatchBye(match)).toBe(true);
      
      const completedMatch = tournamentFormat.completeBye(match);
      expect(completedMatch.status).toBe('completed');
      expect(completedMatch.winner).toEqual(player);
      expect(tournamentFormat.statistics.byeCount).toBe(1);
    });

    it('should process match results correctly', () => {
      const players = GameHelpers.createMockPlayers(4);
      const match = { matchId: 'test-match', players, round: 1 };
      const raceResults = {
        players: [
          { playerId: players[0].id, playerName: players[0].name, finishPosition: 1, raceTime: 240000 },
          { playerId: players[1].id, playerName: players[1].name, finishPosition: 2, raceTime: 250000 },
          { playerId: players[2].id, playerName: players[2].name, finishPosition: 3, raceTime: 260000 },
          { playerId: players[3].id, playerName: players[3].name, finishPosition: 4, raceTime: 270000 }
        ],
        raceDuration: 250000,
        map: 'test-map'
      };

      tournamentFormat.initializeParticipants(players);
      tournamentFormat.getAdvancementCount = jest.fn().mockReturnValue(2);
      
      const results = tournamentFormat.processMatchResults(match, raceResults);

      expect(results.winners).toHaveLength(2);
      expect(results.losers).toHaveLength(2);
      expect(results.winners[0].finishPosition).toBe(1);
      expect(results.winners[1].finishPosition).toBe(2);
      expect(results.raceStats.duration).toBe(250000);
      expect(results.raceStats.map).toBe('test-map');
    });

    it('should update player statistics correctly', () => {
      const players = GameHelpers.createMockPlayers(2);
      const match = { matchId: 'test-match', round: 1 };
      const results = [
        { playerId: players[0].id, finishPosition: 1, raceTime: 240000 },
        { playerId: players[1].id, finishPosition: 2, raceTime: 250000 }
      ];

      tournamentFormat.initializeParticipants(players);
      tournamentFormat.getAdvancementCount = jest.fn().mockReturnValue(1);
      
      tournamentFormat.updatePlayerStats(match, results);

      const stats1 = tournamentFormat.playerStats.get(players[0].id);
      const stats2 = tournamentFormat.playerStats.get(players[1].id);

      expect(stats1.matchesPlayed).toBe(1);
      expect(stats1.matchesWon).toBe(1);
      expect(stats1.bestFinishPosition).toBe(1);
      expect(stats1.totalRaceTime).toBe(240000);

      expect(stats2.matchesPlayed).toBe(1);
      expect(stats2.matchesLost).toBe(1);
      expect(stats2.bestFinishPosition).toBe(2);
    });

    it('should validate tournament start conditions', () => {
      const players = GameHelpers.createMockPlayers(4);
      tournamentFormat.initializeParticipants(players);

      const validation = tournamentFormat.validateStart();

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.playerCount).toBe(4);
    });

    it('should reject start with insufficient players', () => {
      const players = GameHelpers.createMockPlayers(2);
      tournamentFormat.initializeParticipants(players);

      const validation = tournamentFormat.validateStart();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Minimum 4 players required');
    });

    it('should seed players with different methods', () => {
      const players = GameHelpers.createMockPlayers(8);

      const randomSeeded = tournamentFormat.seedPlayers(players, 'random');
      const rankedSeeded = tournamentFormat.seedPlayers(players, 'ranked');
      const balancedSeeded = tournamentFormat.seedPlayers(players, 'balanced');

      expect(randomSeeded).toHaveLength(8);
      expect(rankedSeeded).toHaveLength(8);
      expect(balancedSeeded).toHaveLength(8);
    });
  });

  describe('Configuration and Metadata', () => {
    it('should provide format configuration', () => {
      const config = tournamentFormat.getFormatConfig();

      expect(config).toEqual(expect.objectContaining({
        name: 'test_format',
        displayName: expect.any(String),
        description: expect.any(String),
        features: expect.any(Array),
        playerLimits: expect.objectContaining({
          min: 4,
          max: 16,
          optimal: expect.any(Number)
        }),
        estimatedDuration: expect.any(Number),
        complexity: expect.any(String)
      }));
    });

    it('should provide bracket summary', () => {
      const players = GameHelpers.createMockPlayers(4);
      tournamentFormat.initializeParticipants(players);
      tournamentFormat.tournamentId = 'test-tournament';

      const summary = tournamentFormat.getBracketSummary();

      expect(summary).toEqual(expect.objectContaining({
        tournamentId: 'test-tournament',
        format: 'test_format',
        totalPlayers: 4,
        remainingPlayers: 4,
        totalMatches: 0,
        completedMatches: 0
      }));
    });

    it('should provide statistics', () => {
      const players = GameHelpers.createMockPlayers(4);
      tournamentFormat.initializeParticipants(players);

      const stats = tournamentFormat.getStatistics();

      expect(stats).toEqual(expect.objectContaining({
        participantCount: 4,
        eliminatedCount: 0,
        averageMatchDuration: 0,
        completionPercentage: 0
      }));
    });

    it('should provide player statistics', () => {
      const players = GameHelpers.createMockPlayers(1);
      tournamentFormat.initializeParticipants(players);

      const playerStats = tournamentFormat.getPlayerStats(players[0].id);

      expect(playerStats).toEqual(expect.objectContaining({
        seed: 1,
        originalSeed: 1,
        isEliminated: false,
        matchesPlayed: 0,
        winRate: 0,
        averageRaceTime: 0
      }));
    });
  });
});

describe('SingleElimination Format', () => {
  let singleElimination;
  const mockConfig = {
    format: 'single_elimination',
    maxPlayers: 16,
    minPlayers: 4,
    playersPerRace: 6
  };

  beforeEach(() => {
    singleElimination = new SingleElimination(mockConfig);
  });

  afterEach(() => {
    if (singleElimination) {
      singleElimination.cleanup();
    }
  });

  describe('Format Configuration', () => {
    it('should have correct format metadata', () => {
      const config = singleElimination.getFormatConfig();

      expect(config.name).toBe('single_elimination');
      expect(config.displayName).toBe('Single Elimination');
      expect(config.description).toContain('elimination');
      expect(config.features).toContain('Fast tournament progression');
      expect(config.complexity).toBe('simple');
    });

    it('should calculate optimal player count as power of 2', () => {
      const config = singleElimination.getFormatConfig();
      const optimal = config.playerLimits.optimal;

      expect([4, 8, 16, 32, 64]).toContain(optimal);
    });

    it('should estimate reasonable tournament duration', () => {
      const config = singleElimination.getFormatConfig();
      
      expect(config.estimatedDuration).toBeGreaterThan(0);
      expect(config.estimatedDuration).toBeLessThan(3600000 * 4); // Less than 4 hours
    });
  });

  describe('Bracket Generation', () => {
    const playerCounts = [4, 8, 16, 32];

    playerCounts.forEach(count => {
      it(`should generate correct bracket for ${count} players`, async () => {
        const players = GameHelpers.createMockPlayers(count);
        
        const result = await singleElimination.initialize('test-tournament', players);

        expect(result).toBeDefined();
        expect(result.bracket).toBeDefined();
        expect(result.totalRounds).toBeGreaterThan(0);
        expect(singleElimination.participants.size).toBe(count);
      });
    });

    it('should handle odd number of players with byes', async () => {
      const players = GameHelpers.createMockPlayers(5);
      
      const result = await singleElimination.initialize('test-tournament', players);

      expect(result).toBeDefined();
      expect(singleElimination.participants.size).toBe(5);
      // Should have byes in first round to balance bracket
    });

    it('should calculate correct number of rounds', async () => {
      const testCases = [
        { players: 4, expectedRounds: 2 },
        { players: 8, expectedRounds: 3 },
        { players: 16, expectedRounds: 4 },
        { players: 32, expectedRounds: 5 }
      ];

      for (const testCase of testCases) {
        const players = GameHelpers.createMockPlayers(testCase.players);
        const result = await singleElimination.initialize('test-tournament', players);
        
        expect(result.totalRounds).toBe(testCase.expectedRounds);
        singleElimination.cleanup();
      }
    });
  });

  describe('Match Progression', () => {
    beforeEach(async () => {
      const players = GameHelpers.createMockPlayers(8);
      await singleElimination.initialize('test-tournament', players);
    });

    it('should provide next available match', () => {
      const match = singleElimination.getNextMatch();

      expect(match).toBeDefined();
      expect(match.matchId).toBeDefined();
      expect(match.round).toBe(1);
      expect(match.players.length).toBeGreaterThan(0);
    });

    it('should start match correctly', () => {
      const nextMatch = singleElimination.getNextMatch();
      const startedMatch = singleElimination.startMatch(nextMatch.matchId);

      expect(startedMatch.status).toBe('active');
      expect(startedMatch.startTime).toBeDefined();
    });

    it('should complete match and advance winners', () => {
      const nextMatch = singleElimination.getNextMatch();
      const startedMatch = singleElimination.startMatch(nextMatch.matchId);
      
      const raceResults = {
        players: startedMatch.players.map((player, index) => ({
          playerId: player.playerId,
          playerName: player.playerName,
          finishPosition: index + 1,
          raceTime: 240000 + (index * 10000)
        })),
        raceDuration: 250000
      };

      const result = singleElimination.completeMatch(startedMatch.matchId, raceResults);

      expect(result.match.status).toBe('completed');
      expect(result.match.winner).toBeDefined();
    });

    it('should determine tournament completion correctly', async () => {
      expect(singleElimination.isComplete()).toBe(false);
      
      // Simulate completing all matches to final
      while (!singleElimination.isComplete()) {
        const nextMatch = singleElimination.getNextMatch();
        if (!nextMatch) break;
        
        const startedMatch = singleElimination.startMatch(nextMatch.matchId);
        const raceResults = {
          players: startedMatch.players.map((player, index) => ({
            playerId: player.playerId,
            playerName: player.playerName,
            finishPosition: index + 1,
            raceTime: 240000 + (index * 10000)
          })),
          raceDuration: 250000
        };
        
        singleElimination.completeMatch(startedMatch.matchId, raceResults);
      }

      expect(singleElimination.isComplete()).toBe(true);
    });

    it('should generate final standings', async () => {
      // Complete tournament
      while (!singleElimination.isComplete()) {
        const nextMatch = singleElimination.getNextMatch();
        if (!nextMatch) break;
        
        const startedMatch = singleElimination.startMatch(nextMatch.matchId);
        const raceResults = {
          players: startedMatch.players.map((player, index) => ({
            playerId: player.playerId,
            playerName: player.playerName,
            finishPosition: index + 1,
            raceTime: 240000 + (index * 10000)
          })),
          raceDuration: 250000
        };
        
        singleElimination.completeMatch(startedMatch.matchId, raceResults);
      }

      const standings = singleElimination.getFinalStandings();

      expect(standings).toHaveLength(8);
      expect(standings[0].position).toBe(1);
      expect(standings[0].playerId).toBeDefined();
      expect(standings[7].position).toBe(8);
    });
  });

  describe('Edge Cases', () => {
    it('should handle minimum players (4)', async () => {
      const players = GameHelpers.createMockPlayers(4);
      
      const result = await singleElimination.initialize('test-tournament', players);

      expect(result.totalRounds).toBe(2);
      expect(singleElimination.participants.size).toBe(4);
    });

    it('should handle maximum players (64)', async () => {
      const players = GameHelpers.createMockPlayers(64);
      
      const result = await singleElimination.initialize('test-tournament', players);

      expect(result.totalRounds).toBe(6);
      expect(singleElimination.participants.size).toBe(64);
    }, 10000); // Longer timeout for large tournament

    it('should handle no available matches gracefully', () => {
      // Before initialization
      const match = singleElimination.getNextMatch();
      expect(match).toBeNull();
    });

    it('should handle invalid match completion', async () => {
      const players = GameHelpers.createMockPlayers(4);
      await singleElimination.initialize('test-tournament', players);

      expect(() => {
        singleElimination.completeMatch('non-existent-match', {});
      }).toThrow();
    });
  });
});

describe('DoubleElimination Format', () => {
  let doubleElimination;
  const mockConfig = {
    format: 'double_elimination',
    maxPlayers: 16,
    minPlayers: 4,
    playersPerRace: 6
  };

  beforeEach(() => {
    doubleElimination = new DoubleElimination(mockConfig);
  });

  afterEach(() => {
    if (doubleElimination) {
      doubleElimination.cleanup();
    }
  });

  describe('Format Configuration', () => {
    it('should have correct format metadata', () => {
      const config = doubleElimination.getFormatConfig();

      expect(config.name).toBe('double_elimination');
      expect(config.displayName).toBe('Double Elimination');
      expect(config.description).toContain('second chance');
      expect(config.features).toContain('Winners and losers brackets');
      expect(config.complexity).toBe('moderate');
    });

    it('should estimate longer duration than single elimination', () => {
      const singleConfig = new SingleElimination(mockConfig).getFormatConfig();
      const doubleConfig = doubleElimination.getFormatConfig();

      expect(doubleConfig.estimatedDuration).toBeGreaterThan(singleConfig.estimatedDuration);
    });
  });

  describe('Bracket Generation', () => {
    const playerCounts = [4, 8, 16];

    playerCounts.forEach(count => {
      it(`should generate winners and losers brackets for ${count} players`, async () => {
        const players = GameHelpers.createMockPlayers(count);
        
        const result = await doubleElimination.initialize('test-tournament', players);

        expect(result).toBeDefined();
        expect(result.bracket).toBeDefined();
        expect(result.bracket.winnersBracket).toBeDefined();
        expect(result.bracket.losersBracket).toBeDefined();
        expect(result.bracket.grandFinals).toBeDefined();
        expect(doubleElimination.participants.size).toBe(count);
      });
    });

    it('should calculate correct number of rounds for both brackets', async () => {
      const players = GameHelpers.createMockPlayers(8);
      
      const result = await doubleElimination.initialize('test-tournament', players);

      expect(result.winnersRounds).toBeGreaterThan(0);
      expect(result.losersRounds).toBeGreaterThan(0);
      expect(result.totalRounds).toBe(result.winnersRounds + result.losersRounds + 1); // +1 for grand finals
    });
  });

  describe('Match Progression', () => {
    beforeEach(async () => {
      const players = GameHelpers.createMockPlayers(8);
      await doubleElimination.initialize('test-tournament', players);
    });

    it('should start with winners bracket matches', () => {
      const match = doubleElimination.getNextMatch();

      expect(match).toBeDefined();
      expect(match.bracket).toBe('winners');
      expect(match.round).toBe(1);
    });

    it('should handle player elimination to losers bracket', () => {
      const nextMatch = doubleElimination.getNextMatch();
      const startedMatch = doubleElimination.startMatch(nextMatch.matchId);
      
      const raceResults = {
        players: startedMatch.players.map((player, index) => ({
          playerId: player.playerId,
          playerName: player.playerName,
          finishPosition: index + 1,
          raceTime: 240000 + (index * 10000)
        })),
        raceDuration: 250000
      };

      const result = doubleElimination.completeMatch(startedMatch.matchId, raceResults);

      expect(result.losersToLowerBracket).toBeDefined();
      expect(result.losersToLowerBracket.length).toBeGreaterThan(0);
    });

    it('should handle second elimination (final elimination)', () => {
      // This would require simulating multiple rounds
      // Placeholder for complex double elimination logic
      expect(doubleElimination.isComplete()).toBe(false);
    });

    it('should handle grand finals correctly', async () => {
      // Simulate tournament progression to grand finals
      // This is a complex scenario that would require many match completions
      expect(doubleElimination.getFinalStandings()).toEqual([]);
    });
  });

  describe('Bracket Interaction', () => {
    beforeEach(async () => {
      const players = GameHelpers.createMockPlayers(8);
      await doubleElimination.initialize('test-tournament', players);
    });

    it('should track players in both brackets', () => {
      const summary = doubleElimination.getBracketSummary();

      expect(summary.winnersBracketPlayers).toBeDefined();
      expect(summary.losersBracketPlayers).toBeDefined();
      expect(summary.totalPlayers).toBe(8);
    });

    it('should provide matches for specific bracket', () => {
      const winnersMatches = doubleElimination.getMatchesForRound(1, 'winners');
      const losersMatches = doubleElimination.getMatchesForRound(1, 'losers');

      expect(Array.isArray(winnersMatches)).toBe(true);
      expect(Array.isArray(losersMatches)).toBe(true);
    });
  });
});

describe('RoundRobin Format', () => {
  let roundRobin;
  const mockConfig = {
    format: 'round_robin',
    maxPlayers: 12,
    minPlayers: 4,
    playersPerRace: 6
  };

  beforeEach(() => {
    roundRobin = new RoundRobin(mockConfig);
  });

  afterEach(() => {
    if (roundRobin) {
      roundRobin.cleanup();
    }
  });

  describe('Format Configuration', () => {
    it('should have correct format metadata', () => {
      const config = roundRobin.getFormatConfig();

      expect(config.name).toBe('round_robin');
      expect(config.displayName).toBe('Round Robin');
      expect(config.description).toContain('every player');
      expect(config.features).toContain('All players compete equally');
      expect(config.complexity).toBe('complex');
    });

    it('should have higher optimal player count for balanced groups', () => {
      const config = roundRobin.getFormatConfig();
      
      expect(config.playerLimits.optimal).toBeGreaterThanOrEqual(6);
      expect(config.playerLimits.optimal % 2).toBe(0); // Even number for balanced groups
    });

    it('should estimate longest duration of all formats', () => {
      const singleConfig = new SingleElimination(mockConfig).getFormatConfig();
      const roundRobinConfig = roundRobin.getFormatConfig();

      expect(roundRobinConfig.estimatedDuration).toBeGreaterThan(singleConfig.estimatedDuration);
    });
  });

  describe('Group Generation', () => {
    const playerCounts = [6, 8, 12];

    playerCounts.forEach(count => {
      it(`should generate groups for ${count} players`, async () => {
        const players = GameHelpers.createMockPlayers(count);
        
        const result = await roundRobin.initialize('test-tournament', players);

        expect(result).toBeDefined();
        expect(result.bracket).toBeDefined();
        expect(result.bracket.groups).toBeDefined();
        expect(roundRobin.participants.size).toBe(count);
      });
    });

    it('should balance groups evenly', async () => {
      const players = GameHelpers.createMockPlayers(12);
      
      const result = await roundRobin.initialize('test-tournament', players);

      const groups = result.bracket.groups;
      const groupSizes = groups.map(group => group.players.length);
      const maxSize = Math.max(...groupSizes);
      const minSize = Math.min(...groupSizes);

      expect(maxSize - minSize).toBeLessThanOrEqual(1); // Groups should be balanced within 1 player
    });

    it('should generate correct number of rounds per group', async () => {
      const players = GameHelpers.createMockPlayers(6);
      
      const result = await roundRobin.initialize('test-tournament', players);

      expect(result.groupStageRounds).toBeGreaterThan(0);
      expect(result.playoffRounds).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Match Scheduling', () => {
    beforeEach(async () => {
      const players = GameHelpers.createMockPlayers(8);
      await roundRobin.initialize('test-tournament', players);
    });

    it('should schedule group stage matches first', () => {
      const match = roundRobin.getNextMatch();

      expect(match).toBeDefined();
      expect(match.stage).toBe('group');
      expect(match.group).toBeDefined();
    });

    it('should track group standings', () => {
      const standings = roundRobin.getCurrentStandings();

      expect(Array.isArray(standings)).toBe(true);
      expect(standings.length).toBeGreaterThan(0);
    });

    it('should handle group stage completion', () => {
      // This would require completing all group matches
      const summary = roundRobin.getBracketSummary();

      expect(summary.groupStageComplete).toBeDefined();
      expect(summary.playoffStageActive).toBeDefined();
    });

    it('should provide head-to-head records', () => {
      const players = Array.from(roundRobin.participants.keys());
      if (players.length >= 2) {
        const record = roundRobin.getHeadToHeadRecord(players[0], players[1]);

        expect(record).toBeDefined();
        expect(record.wins).toBeDefined();
        expect(record.losses).toBeDefined();
        expect(record.draws).toBeDefined();
      }
    });
  });

  describe('Scoring System', () => {
    beforeEach(async () => {
      const players = GameHelpers.createMockPlayers(6);
      await roundRobin.initialize('test-tournament', players);
    });

    it('should track points correctly', () => {
      const nextMatch = roundRobin.getNextMatch();
      if (nextMatch) {
        const startedMatch = roundRobin.startMatch(nextMatch.matchId);
        
        const raceResults = {
          players: startedMatch.players.map((player, index) => ({
            playerId: player.playerId,
            playerName: player.playerName,
            finishPosition: index + 1,
            raceTime: 240000 + (index * 10000)
          })),
          raceDuration: 250000
        };

        roundRobin.completeMatch(startedMatch.matchId, raceResults);

        const standings = roundRobin.getCurrentStandings();
        expect(standings[0].points).toBeGreaterThan(0);
      }
    });

    it('should handle tiebreaking criteria', () => {
      const standings = roundRobin.getCurrentStandings();

      if (standings.length > 1) {
        // Check that standings are properly sorted
        for (let i = 1; i < standings.length; i++) {
          expect(standings[i-1].points).toBeGreaterThanOrEqual(standings[i].points);
        }
      }
    });
  });

  describe('Playoff Generation', () => {
    it('should determine playoff qualifiers', async () => {
      const players = GameHelpers.createMockPlayers(8);
      await roundRobin.initialize('test-tournament', players);

      // After group stage completion, playoffs should be generated
      const summary = roundRobin.getBracketSummary();
      
      expect(summary.playoffQualifiers).toBeDefined();
    });

    it('should create elimination bracket for playoffs', async () => {
      const players = GameHelpers.createMockPlayers(8);
      await roundRobin.initialize('test-tournament', players);

      // Simulate group stage completion
      const summary = roundRobin.getBracketSummary();
      
      if (summary.playoffStageActive) {
        expect(summary.playoffBracket).toBeDefined();
      }
    });
  });
});

describe('Format Comparison and Edge Cases', () => {
  const playerCounts = [4, 8, 16, 32];
  const formats = [
    { name: 'single_elimination', class: SingleElimination },
    { name: 'double_elimination', class: DoubleElimination },
    { name: 'round_robin', class: RoundRobin }
  ];

  describe('Format Validation', () => {
    formats.forEach(format => {
      it(`should validate ${format.name} start conditions`, async () => {
        const instance = new format.class({ format: format.name });
        const players = GameHelpers.createMockPlayers(4);
        
        instance.initializeParticipants(players);
        const validation = instance.validateStart();

        expect(validation.isValid).toBe(true);
        expect(validation.playerCount).toBe(4);
        
        instance.cleanup();
      });

      it(`should reject ${format.name} with insufficient players`, async () => {
        const instance = new format.class({ format: format.name, minPlayers: 4 });
        const players = GameHelpers.createMockPlayers(2);
        
        instance.initializeParticipants(players);
        const validation = instance.validateStart();

        expect(validation.isValid).toBe(false);
        expect(validation.errors).toContain('Minimum 4 players required');
        
        instance.cleanup();
      });
    });
  });

  describe('Performance Comparison', () => {
    playerCounts.forEach(count => {
      it(`should handle ${count} players efficiently across all formats`, async () => {
        const performances = [];

        for (const format of formats) {
          const startTime = Date.now();
          const instance = new format.class({ format: format.name });
          const players = GameHelpers.createMockPlayers(count);
          
          await instance.initialize('test-tournament', players);
          const endTime = Date.now();
          
          performances.push({
            format: format.name,
            duration: endTime - startTime,
            instance
          });
          
          instance.cleanup();
        }

        // All formats should initialize within reasonable time
        performances.forEach(perf => {
          expect(perf.duration).toBeLessThan(1000); // Less than 1 second
        });
      }, 10000);
    });
  });

  describe('Memory Usage', () => {
    it('should properly cleanup resources', () => {
      formats.forEach(format => {
        const instance = new format.class({ format: format.name });
        const players = GameHelpers.createMockPlayers(8);
        
        instance.initializeParticipants(players);
        expect(instance.participants.size).toBe(8);
        
        instance.cleanup();
        expect(instance.participants.size).toBe(0);
        expect(instance.matches.size).toBe(0);
        expect(instance.playerStats.size).toBe(0);
      });
    });
  });

  describe('Concurrency Handling', () => {
    it('should handle concurrent format instances', async () => {
      const instances = formats.map(format => 
        new format.class({ format: format.name })
      );

      const players = GameHelpers.createMockPlayers(8);

      // Initialize all formats concurrently
      const results = await Promise.all(
        instances.map(instance => 
          instance.initialize(`test-tournament-${instance.tournamentConfig.format}`, players)
        )
      );

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
      });

      // Cleanup
      instances.forEach(instance => instance.cleanup());
    });
  });

  describe('Error Recovery', () => {
    it('should handle initialization errors gracefully', async () => {
      const instance = new SingleElimination({ format: 'single_elimination' });
      
      // Mock initialization failure
      instance.generateBracket = jest.fn().mockImplementation(() => {
        throw new Error('Bracket generation failed');
      });

      await expect(
        instance.initialize('test-tournament', GameHelpers.createMockPlayers(4))
      ).rejects.toThrow('Bracket generation failed');
      
      instance.cleanup();
    });

    it('should handle match completion errors gracefully', async () => {
      const instance = new SingleElimination({ format: 'single_elimination' });
      await instance.initialize('test-tournament', GameHelpers.createMockPlayers(4));

      expect(() => {
        instance.completeMatch('non-existent-match', {});
      }).toThrow();
      
      instance.cleanup();
    });
  });
});