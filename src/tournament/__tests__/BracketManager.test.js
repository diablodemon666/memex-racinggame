/**
 * BracketManager.test.js - Comprehensive Unit Tests
 * 
 * Tests the core BracketManager functionality using TDD methodology
 * Covers bracket generation, match progression, and tournament format integration
 */

// Mock dependencies
jest.mock('../../multiplayer/MultiplayerEvents.js', () => ({
  multiplayerEvents: {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn()
  },
  MULTIPLAYER_EVENTS: {
    RACE_FINISHED: 'RACE_FINISHED'
  }
}));

jest.mock('../formats/SingleElimination.js', () => ({
  SingleElimination: jest.fn().mockImplementation((config) => ({
    config,
    participants: new Map(),
    initialize: jest.fn().mockResolvedValue({
      bracket: { rounds: [] },
      totalRounds: 3,
      winnersRounds: 3
    }),
    getNextMatch: jest.fn().mockReturnValue({
      matchId: 'match-123',
      round: 1,
      players: [
        { playerId: 'player1', playerName: 'Player 1' },
        { playerId: 'player2', playerName: 'Player 2' }
      ]
    }),
    startMatch: jest.fn().mockImplementation((matchId) => ({
      matchId,
      status: 'active',
      startTime: Date.now(),
      players: [
        { playerId: 'player1', playerName: 'Player 1' },
        { playerId: 'player2', playerName: 'Player 2' }
      ]
    })),
    completeMatch: jest.fn().mockReturnValue({
      match: { matchId: 'match-123', status: 'completed' }
    }),
    isComplete: jest.fn().mockReturnValue(false),
    getFinalStandings: jest.fn().mockReturnValue([
      { playerId: 'player1', playerName: 'Player 1', position: 1 }
    ]),
    getBracketSummary: jest.fn().mockReturnValue({
      totalRounds: 3,
      currentRound: 1,
      totalPlayers: 4,
      remainingPlayers: 4
    }),
    getStatistics: jest.fn().mockReturnValue({
      completedMatches: 0,
      totalMatches: 3
    }),
    cleanup: jest.fn(),
    getFormatConfig: jest.fn().mockReturnValue({
      name: 'single_elimination',
      displayName: 'Single Elimination'
    })
  }))
}));

jest.mock('../formats/DoubleElimination.js', () => ({
  DoubleElimination: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue({
      bracket: { winnersBracket: [], losersBracket: [], grandFinals: {} },
      totalRounds: 5
    }),
    getFormatConfig: jest.fn().mockReturnValue({
      name: 'double_elimination',
      displayName: 'Double Elimination'
    })
  }))
}));

jest.mock('../formats/RoundRobin.js', () => ({
  RoundRobin: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue({
      bracket: { rounds: [] },
      totalRounds: 1
    }),
    getFormatConfig: jest.fn().mockReturnValue({
      name: 'round_robin',
      displayName: 'Round Robin'
    })
  }))
}));

import { BracketManager } from '../BracketManager';
import { GameHelpers, AsyncHelpers, ValidationHelpers } from '../../../tests/utils/test-helpers';
import { multiplayerEvents } from '../../multiplayer/MultiplayerEvents.js';
import { SingleElimination } from '../formats/SingleElimination.js';

describe('BracketManager', () => {
  let bracketManager;
  let mockRoomManager;
  let mockGameEngine;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock room manager
    mockRoomManager = {
      createRoom: jest.fn().mockResolvedValue({ roomCode: 'ROOM123' }),
      addPlayersToRoom: jest.fn(),
      getRoomData: jest.fn(),
      destroyRoom: jest.fn()
    };

    // Create mock game engine
    mockGameEngine = {
      isRunning: true,
      startRace: jest.fn(),
      getRaceResults: jest.fn()
    };

    // Create bracket manager instance
    bracketManager = new BracketManager();
    bracketManager.roomManager = mockRoomManager;
    bracketManager.gameEngine = mockGameEngine;
  });

  afterEach(() => {
    if (bracketManager) {
      bracketManager.destroy();
    }
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(bracketManager.tournamentId).toBeNull();
      expect(bracketManager.tournamentConfig).toBeNull();
      expect(bracketManager.bracket).toEqual([]);
      expect(bracketManager.currentRound).toBe(0);
      expect(bracketManager.maxRounds).toBe(0);
      expect(bracketManager.isActive).toBe(false);
      expect(bracketManager.isComplete).toBe(false);
    });

    it('should have required component interface', () => {
      ValidationHelpers.validateComponent(bracketManager, [
        'createTournament', 'startNextMatch', 'completeMatch'
      ]);
    });

    it('should initialize format registry with supported formats', () => {
      expect(bracketManager.formatRegistry.size).toBe(3);
      expect(bracketManager.formatRegistry.has('single_elimination')).toBe(true);
      expect(bracketManager.formatRegistry.has('double_elimination')).toBe(true);
      expect(bracketManager.formatRegistry.has('round_robin')).toBe(true);
    });

    it('should set up event listeners during construction', () => {
      expect(multiplayerEvents.on).toHaveBeenCalledWith('RACE_FINISHED', expect.any(Function));
    });
  });

  describe('Tournament Creation', () => {
    const validConfig = {
      name: 'Test Tournament',
      format: 'single_elimination',
      maxPlayers: 16,
      minPlayers: 4,
      raceTimeLimit: 300,
      playersPerRace: 6
    };

    const mockPlayers = GameHelpers.createMockPlayers(8);

    it('should create tournament with valid configuration', async () => {
      const result = await bracketManager.createTournament(validConfig, mockPlayers);

      expect(result.tournamentId).toBeDefined();
      expect(result.config.name).toBe('Test Tournament');
      expect(result.config.format).toBe('single_elimination');
      expect(result.bracket).toBeDefined();
      expect(result.totalRounds).toBe(3);
      expect(result.format).toBe('single_elimination');

      expect(bracketManager.isActive).toBe(true);
      expect(bracketManager.tournamentId).toBeDefined();
      expect(multiplayerEvents.emit).toHaveBeenCalledWith('TOURNAMENT_CREATED', expect.any(Object));
    });

    it('should generate unique tournament ID', async () => {
      const result1 = await bracketManager.createTournament(validConfig, mockPlayers);
      
      bracketManager.cleanup();
      const newBracketManager = new BracketManager();
      const result2 = await newBracketManager.createTournament(validConfig, mockPlayers);

      expect(result1.tournamentId).not.toBe(result2.tournamentId);
      newBracketManager.destroy();
    });

    it('should merge configuration with defaults', async () => {
      const minimalConfig = { name: 'Minimal Tournament' };
      const result = await bracketManager.createTournament(minimalConfig, mockPlayers);

      expect(result.config.format).toBe('single_elimination');
      expect(result.config.maxPlayers).toBe(64);
      expect(result.config.minPlayers).toBe(4);
      expect(result.config.raceTimeLimit).toBe(300);
      expect(result.config.playersPerRace).toBe(6);
      expect(result.config.bettingEnabled).toBe(true);
    });

    it('should reject creation when already active', async () => {
      await bracketManager.createTournament(validConfig, mockPlayers);

      await expect(
        bracketManager.createTournament(validConfig, mockPlayers)
      ).rejects.toThrow('Tournament already active');
    });

    it('should validate tournament configuration', async () => {
      const invalidConfig = {
        format: 'invalid_format',
        maxPlayers: 100, // Too many
        playersPerRace: 10 // Too many per race
      };

      await expect(
        bracketManager.createTournament(invalidConfig, mockPlayers)
      ).rejects.toThrow();
    });

    it('should validate player count', async () => {
      await expect(
        bracketManager.createTournament(validConfig, []) // No players
      ).rejects.toThrow('Minimum 4 players required for tournament');

      const tooManyPlayers = GameHelpers.createMockPlayers(100);
      await expect(
        bracketManager.createTournament(validConfig, tooManyPlayers)
      ).rejects.toThrow('Maximum 64 players allowed for tournament');
    });

    it('should create tournament format instance', async () => {
      await bracketManager.createTournament(validConfig, mockPlayers);

      expect(SingleElimination).toHaveBeenCalledWith(expect.objectContaining({
        format: 'single_elimination'
      }));
      expect(bracketManager.tournamentFormat).toBeDefined();
    });

    it('should initialize tournament format with players', async () => {
      await bracketManager.createTournament(validConfig, mockPlayers);

      expect(bracketManager.tournamentFormat.initialize).toHaveBeenCalledWith(
        expect.any(String),
        mockPlayers
      );
    });
  });

  describe('Tournament Format Support', () => {
    const mockPlayers = GameHelpers.createMockPlayers(8);

    it('should support single elimination format', async () => {
      const config = { format: 'single_elimination' };
      const result = await bracketManager.createTournament(config, mockPlayers);

      expect(result.format).toBe('single_elimination');
      expect(SingleElimination).toHaveBeenCalled();
    });

    it('should support double elimination format', async () => {
      const { DoubleElimination } = require('../formats/DoubleElimination.js');
      const config = { format: 'double_elimination' };
      
      await bracketManager.createTournament(config, mockPlayers);

      expect(DoubleElimination).toHaveBeenCalled();
    });

    it('should support round robin format', async () => {
      const { RoundRobin } = require('../formats/RoundRobin.js');
      const config = { format: 'round_robin' };
      
      await bracketManager.createTournament(config, mockPlayers);

      expect(RoundRobin).toHaveBeenCalled();
    });

    it('should reject unsupported format', async () => {
      const config = { format: 'unsupported_format' };

      await expect(
        bracketManager.createTournament(config, mockPlayers)
      ).rejects.toThrow('Unsupported tournament format: unsupported_format');
    });
  });

  describe('Match Management', () => {
    const mockPlayers = GameHelpers.createMockPlayers(8);

    beforeEach(async () => {
      await bracketManager.createTournament({
        format: 'single_elimination',
        name: 'Test Tournament'
      }, mockPlayers);
    });

    it('should start next available match', () => {
      const match = bracketManager.startNextMatch();

      expect(match).toBeDefined();
      expect(match.matchId).toBeDefined();
      expect(match.status).toBe('active');
      expect(match.startTime).toBeDefined();
      expect(match.players.length).toBeGreaterThan(0);
      
      expect(bracketManager.tournamentFormat.startMatch).toHaveBeenCalled();
      expect(multiplayerEvents.emit).toHaveBeenCalledWith('TOURNAMENT_MATCH_STARTED', expect.any(Object));
    });

    it('should return null when no matches available', () => {
      bracketManager.tournamentFormat.getNextMatch.mockReturnValue(null);

      const match = bracketManager.startNextMatch();

      expect(match).toBeNull();
    });

    it('should not start match when tournament not active', () => {
      bracketManager.isActive = false;

      const match = bracketManager.startNextMatch();

      expect(match).toBeNull();
    });

    it('should not start match when tournament complete', () => {
      bracketManager.isComplete = true;

      const match = bracketManager.startNextMatch();

      expect(match).toBeNull();
    });

    it('should handle tournament format errors', () => {
      bracketManager.tournamentFormat = null;

      const match = bracketManager.startNextMatch();

      expect(match).toBeNull();
    });
  });

  describe('Match Completion', () => {
    const mockPlayers = GameHelpers.createMockPlayers(8);
    const mockRaceResults = {
      players: [
        { playerId: 'player1', finishPosition: 1, raceTime: 240000 },
        { playerId: 'player2', finishPosition: 2, raceTime: 250000 }
      ],
      raceDuration: 240000,
      map: 'test-map'
    };

    beforeEach(async () => {
      await bracketManager.createTournament({
        format: 'single_elimination',
        name: 'Test Tournament'
      }, mockPlayers);
    });

    it('should complete match with results', () => {
      const matchId = 'match-123';
      const result = bracketManager.completeMatch(matchId, mockRaceResults);

      expect(result).toBeDefined();
      expect(bracketManager.tournamentFormat.completeMatch).toHaveBeenCalledWith(
        matchId,
        mockRaceResults
      );
      expect(multiplayerEvents.emit).toHaveBeenCalledWith('TOURNAMENT_MATCH_COMPLETED', expect.any(Object));
    });

    it('should update tournament state after match completion', () => {
      const updateStateSpy = jest.spyOn(bracketManager, 'updateTournamentState');
      
      bracketManager.completeMatch('match-123', mockRaceResults);

      expect(updateStateSpy).toHaveBeenCalled();
    });

    it('should complete tournament when format indicates completion', () => {
      bracketManager.tournamentFormat.isComplete.mockReturnValue(true);
      const completeSpy = jest.spyOn(bracketManager, 'completeTournament');

      bracketManager.completeMatch('match-123', mockRaceResults);

      expect(completeSpy).toHaveBeenCalled();
    });

    it('should handle completion errors gracefully', () => {
      bracketManager.tournamentFormat.completeMatch.mockImplementation(() => {
        throw new Error('Completion failed');
      });

      expect(() => {
        bracketManager.completeMatch('match-123', mockRaceResults);
      }).toThrow('Completion failed');
    });

    it('should handle missing tournament format', () => {
      bracketManager.tournamentFormat = null;

      expect(() => {
        bracketManager.completeMatch('match-123', mockRaceResults);
      }).not.toThrow();
    });
  });

  describe('Tournament Completion', () => {
    const mockPlayers = GameHelpers.createMockPlayers(8);

    beforeEach(async () => {
      await bracketManager.createTournament({
        format: 'single_elimination',
        name: 'Test Tournament'
      }, mockPlayers);
    });

    it('should complete tournament correctly', () => {
      const startTime = Date.now();
      bracketManager.startTime = startTime;

      bracketManager.completeTournament();

      expect(bracketManager.isActive).toBe(false);
      expect(bracketManager.isComplete).toBe(true);
      expect(bracketManager.endTime).toBeGreaterThan(startTime);
      
      expect(multiplayerEvents.emit).toHaveBeenCalledWith('TOURNAMENT_COMPLETED', expect.objectContaining({
        tournamentId: bracketManager.tournamentId,
        format: 'single_elimination',
        winner: expect.any(Object),
        finalStandings: expect.any(Array),
        statistics: expect.any(Object)
      }));
    });

    it('should generate final standings', () => {
      bracketManager.completeTournament();

      expect(bracketManager.tournamentFormat.getFinalStandings).toHaveBeenCalled();
    });

    it('should calculate tournament duration', () => {
      const startTime = Date.now() - 600000; // 10 minutes ago
      bracketManager.startTime = startTime;

      bracketManager.completeTournament();

      const emittedEvent = multiplayerEvents.emit.mock.calls.find(
        call => call[0] === 'TOURNAMENT_COMPLETED'
      );
      expect(emittedEvent[1].duration).toBeGreaterThan(500000); // At least 8+ minutes
    });

    it('should handle missing tournament format gracefully', () => {
      bracketManager.tournamentFormat = null;

      expect(() => bracketManager.completeTournament()).not.toThrow();
    });
  });

  describe('Bracket Summary and Status', () => {
    const mockPlayers = GameHelpers.createMockPlayers(8);

    beforeEach(async () => {
      await bracketManager.createTournament({
        format: 'single_elimination',
        name: 'Test Tournament'
      }, mockPlayers);
    });

    it('should provide bracket summary', () => {
      const summary = bracketManager.getBracketSummary();

      expect(summary).toEqual(expect.objectContaining({
        format: 'single_elimination',
        config: expect.any(Object)
      }));
      expect(bracketManager.tournamentFormat.getBracketSummary).toHaveBeenCalled();
    });

    it('should provide tournament status', () => {
      const status = bracketManager.getStatus();

      expect(status).toEqual(expect.objectContaining({
        tournamentId: bracketManager.tournamentId,
        format: 'single_elimination',
        isActive: true,
        isComplete: false,
        startTime: expect.any(Number),
        duration: expect.any(Number)
      }));
    });

    it('should handle missing tournament format in status', () => {
      bracketManager.tournamentFormat = null;
      bracketManager.tournamentConfig = { format: 'unknown' };

      const status = bracketManager.getStatus();

      expect(status.format).toBe('unknown');
      expect(status.participantCount).toBe(0);
    });

    it('should provide fallback bracket summary when format missing', () => {
      bracketManager.tournamentFormat = null;
      bracketManager.tournamentConfig = { format: 'test_format' };

      const summary = bracketManager.getBracketSummary();

      expect(summary.format).toBe('test_format');
      expect(summary.totalRounds).toBe(bracketManager.maxRounds);
    });
  });

  describe('Format Registry and Validation', () => {
    it('should get available tournament formats', () => {
      const formats = bracketManager.getAvailableFormats();

      expect(formats).toHaveLength(3);
      expect(formats.map(f => f.key)).toContain('single_elimination');
      expect(formats.map(f => f.key)).toContain('double_elimination');
      expect(formats.map(f => f.key)).toContain('round_robin');
    });

    it('should validate format-specific configuration', () => {
      const validConfig = {
        format: 'single_elimination',
        maxPlayers: 16
      };

      const validation = bracketManager.validateFormatConfig(validConfig);

      expect(validation).toEqual(expect.objectContaining({
        isValid: expect.any(Boolean)
      }));
    });

    it('should reject validation for unsupported format', () => {
      const invalidConfig = {
        format: 'unsupported_format',
        maxPlayers: 16
      };

      const validation = bracketManager.validateFormatConfig(invalidConfig);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Unsupported format: unsupported_format');
    });

    it('should handle format validation errors', () => {
      const config = { format: 'single_elimination', maxPlayers: 16 };
      
      // Mock the format constructor to throw an error
      SingleElimination.mockImplementation(() => {
        throw new Error('Format initialization failed');
      });

      const validation = bracketManager.validateFormatConfig(config);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Format initialization failed');
    });
  });

  describe('Player Count Scenarios', () => {
    const playerCounts = [4, 8, 16, 32, 64];

    playerCounts.forEach(count => {
      it(`should handle ${count} players correctly`, async () => {
        const players = GameHelpers.createMockPlayers(count);
        const config = {
          format: 'single_elimination',
          maxPlayers: count,
          minPlayers: Math.min(4, count)
        };

        const result = await bracketManager.createTournament(config, players);

        expect(result).toBeDefined();
        expect(result.tournamentId).toBeDefined();
        expect(bracketManager.isActive).toBe(true);
        expect(bracketManager.tournamentFormat.initialize).toHaveBeenCalledWith(
          expect.any(String),
          players
        );
      });
    });

    it('should handle odd number of players (5 players)', async () => {
      const players = GameHelpers.createMockPlayers(5);
      const config = { format: 'single_elimination' };

      const result = await bracketManager.createTournament(config, players);

      expect(result).toBeDefined();
      expect(bracketManager.isActive).toBe(true);
    });

    it('should handle minimum viable tournament (4 players)', async () => {
      const players = GameHelpers.createMockPlayers(4);
      const config = { format: 'single_elimination', minPlayers: 4 };

      const result = await bracketManager.createTournament(config, players);

      expect(result).toBeDefined();
      expect(bracketManager.isActive).toBe(true);
    });

    it('should handle maximum tournament size (64 players)', async () => {
      const players = GameHelpers.createMockPlayers(64);
      const config = { format: 'single_elimination', maxPlayers: 64 };

      const result = await bracketManager.createTournament(config, players);

      expect(result).toBeDefined();
      expect(bracketManager.isActive).toBe(true);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid tournament configuration', () => {
      const validConfig = {
        maxPlayers: 16,
        playersPerRace: 4
      };

      expect(() => {
        bracketManager.validateTournamentConfig(validConfig);
      }).not.toThrow();
    });

    it('should reject invalid max players', () => {
      const invalidConfig = {
        maxPlayers: 100 // Too many
      };

      expect(() => {
        bracketManager.validateTournamentConfig(invalidConfig);
      }).toThrow('Max players must be between 4 and 64');
    });

    it('should reject invalid players per race', () => {
      const invalidConfig = {
        playersPerRace: 10 // Too many per race
      };

      expect(() => {
        bracketManager.validateTournamentConfig(invalidConfig);
      }).toThrow('Players per race must be between 2 and 6');
    });

    it('should reject null or undefined configuration', () => {
      expect(() => {
        bracketManager.validateTournamentConfig(null);
      }).toThrow('Tournament configuration is required');

      expect(() => {
        bracketManager.validateTournamentConfig(undefined);
      }).toThrow('Tournament configuration is required');
    });
  });

  describe('Event Handling', () => {
    const mockPlayers = GameHelpers.createMockPlayers(8);

    beforeEach(async () => {
      await bracketManager.createTournament({
        format: 'single_elimination',
        name: 'Test Tournament'
      }, mockPlayers);
    });

    it('should handle race finished events', () => {
      // Simulate race finished event
      const raceData = {
        matchId: 'match-123',
        results: {
          players: [
            { playerId: 'player1', finishPosition: 1, raceTime: 240000 }
          ]
        }
      };

      // Get the event handler that was registered
      const raceFinishedHandler = multiplayerEvents.on.mock.calls.find(
        call => call[0] === 'RACE_FINISHED'
      )[1];

      // Mock the activeMatches to include our match
      bracketManager.activeMatches = new Map();
      bracketManager.activeMatches.set('match-123', { matchId: 'match-123' });

      const completeSpy = jest.spyOn(bracketManager, 'completeMatch');
      
      raceFinishedHandler(raceData);

      expect(completeSpy).toHaveBeenCalledWith('match-123', raceData.results);
    });

    it('should ignore race events for non-tournament matches', () => {
      const raceData = {
        matchId: 'non-tournament-match',
        results: {}
      };

      const raceFinishedHandler = multiplayerEvents.on.mock.calls.find(
        call => call[0] === 'RACE_FINISHED'
      )[1];

      const completeSpy = jest.spyOn(bracketManager, 'completeMatch');
      
      raceFinishedHandler(raceData);

      expect(completeSpy).not.toHaveBeenCalled();
    });
  });

  describe('Format-Specific Method Delegation', () => {
    const mockPlayers = GameHelpers.createMockPlayers(8);

    beforeEach(async () => {
      await bracketManager.createTournament({
        format: 'single_elimination',
        name: 'Test Tournament'
      }, mockPlayers);
    });

    it('should delegate getMatchesForRound to format', () => {
      bracketManager.tournamentFormat.getMatchesForRound = jest.fn().mockReturnValue([]);
      
      const matches = bracketManager.getMatchesForRound(1);

      expect(bracketManager.tournamentFormat.getMatchesForRound).toHaveBeenCalledWith(1, 'main');
      expect(matches).toEqual([]);
    });

    it('should delegate getPlayerStats to format', () => {
      bracketManager.tournamentFormat.getPlayerStats = jest.fn().mockReturnValue({
        matchesPlayed: 2
      });
      
      const stats = bracketManager.getPlayerStats('player1');

      expect(bracketManager.tournamentFormat.getPlayerStats).toHaveBeenCalledWith('player1');
      expect(stats.matchesPlayed).toBe(2);
    });

    it('should delegate getCurrentStandings to format', () => {
      bracketManager.tournamentFormat.getCurrentStandings = jest.fn().mockReturnValue([]);
      
      const standings = bracketManager.getCurrentStandings();

      expect(bracketManager.tournamentFormat.getCurrentStandings).toHaveBeenCalled();
      expect(standings).toEqual([]);
    });

    it('should delegate getHeadToHeadRecord to format', () => {
      bracketManager.tournamentFormat.getHeadToHeadRecord = jest.fn().mockReturnValue({
        wins: 1, losses: 0
      });
      
      const record = bracketManager.getHeadToHeadRecord('player1', 'player2');

      expect(bracketManager.tournamentFormat.getHeadToHeadRecord).toHaveBeenCalledWith('player1', 'player2');
      expect(record).toEqual({ wins: 1, losses: 0 });
    });

    it('should return null/empty when format missing', () => {
      bracketManager.tournamentFormat = null;

      expect(bracketManager.getPlayerStats('player1')).toBeNull();
      expect(bracketManager.getCurrentStandings()).toEqual([]);
      expect(bracketManager.getHeadToHeadRecord('player1', 'player2')).toBeNull();
    });
  });

  describe('Legacy Bracket Data Compatibility', () => {
    const mockPlayers = GameHelpers.createMockPlayers(8);

    it('should update legacy bracket data for single elimination', async () => {
      const mockFormatResult = {
        bracket: [
          { round: 1, matches: [] },
          { round: 2, matches: [] }
        ],
        totalRounds: 2
      };

      bracketManager.tournamentFormat = {
        initialize: jest.fn().mockResolvedValue(mockFormatResult)
      };

      await bracketManager.createTournament({
        format: 'single_elimination'
      }, mockPlayers);

      expect(bracketManager.maxRounds).toBe(2);
      expect(bracketManager.bracket).toEqual(mockFormatResult.bracket);
    });

    it('should update legacy bracket data for double elimination', async () => {
      const mockFormatResult = {
        bracket: {
          winnersBracket: [{ round: 1, matches: [] }],
          losersBracket: [{ round: 1, matches: [] }],
          grandFinals: { round: 'final', matches: [] }
        },
        totalRounds: 3
      };

      bracketManager.tournamentFormat = {
        initialize: jest.fn().mockResolvedValue(mockFormatResult)
      };

      await bracketManager.createTournament({
        format: 'double_elimination'
      }, mockPlayers);

      expect(bracketManager.maxRounds).toBe(3);
      expect(bracketManager.bracket).toHaveLength(3); // winnersBracket + losersBracket + grandFinals
    });

    it('should update legacy bracket data for round robin', async () => {
      const mockFormatResult = {
        bracket: {
          rounds: [
            { round: 1, matches: [] }
          ]
        },
        totalRounds: 1
      };

      bracketManager.tournamentFormat = {
        initialize: jest.fn().mockResolvedValue(mockFormatResult)
      };

      await bracketManager.createTournament({
        format: 'round_robin'
      }, mockPlayers);

      expect(bracketManager.maxRounds).toBe(1);
      expect(bracketManager.bracket).toEqual(mockFormatResult.bracket.rounds);
    });
  });

  describe('Resource Management', () => {
    it('should cleanup all resources when cleanup() is called', () => {
      bracketManager.isActive = true;
      bracketManager.tournamentId = 'test-123';
      bracketManager.bracket = [{ round: 1 }];

      bracketManager.cleanup();

      expect(bracketManager.bracket).toEqual([]);
      expect(bracketManager.isActive).toBe(false);
      expect(bracketManager.isComplete).toBe(false);
      expect(bracketManager.tournamentId).toBeNull();
      expect(bracketManager.tournamentConfig).toBeNull();
    });

    it('should destroy all resources when destroy() is called', () => {
      bracketManager.isActive = true;
      bracketManager.formatRegistry.set('test', jest.fn());

      bracketManager.destroy();

      expect(bracketManager.formatRegistry.size).toBe(0);
      expect(bracketManager.isActive).toBe(false);
    });

    it('should cleanup tournament format when present', () => {
      const mockFormat = {
        cleanup: jest.fn()
      };
      bracketManager.tournamentFormat = mockFormat;

      bracketManager.cleanup();

      expect(mockFormat.cleanup).toHaveBeenCalled();
      expect(bracketManager.tournamentFormat).toBeNull();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle tournament creation with empty format result', async () => {
      const mockFormat = {
        initialize: jest.fn().mockResolvedValue({})
      };
      
      bracketManager.formatRegistry.set('test_format', jest.fn().mockReturnValue(mockFormat));
      
      const config = { format: 'test_format' };
      const players = GameHelpers.createMockPlayers(4);

      const result = await bracketManager.createTournament(config, players);

      expect(result).toBeDefined();
      expect(bracketManager.maxRounds).toBe(1); // Default fallback
    });

    it('should handle match start with missing format', () => {
      bracketManager.isActive = true;
      bracketManager.tournamentFormat = null;

      const match = bracketManager.startNextMatch();

      expect(match).toBeNull();
    });

    it('should handle tournament state update with missing format', () => {
      bracketManager.tournamentFormat = null;

      expect(() => bracketManager.updateTournamentState()).not.toThrow();
    });

    it('should handle configuration validation errors', () => {
      expect(() => {
        bracketManager.validateTournamentConfig({});
      }).not.toThrow();

      expect(() => {
        bracketManager.validateTournamentConfig({ maxPlayers: 2 });
      }).toThrow();
    });

    it('should handle player count validation edge cases', () => {
      expect(() => {
        bracketManager.validatePlayerCount(3);
      }).toThrow('Minimum 4 players required for tournament');

      expect(() => {
        bracketManager.validatePlayerCount(65);
      }).toThrow('Maximum 64 players allowed for tournament');

      expect(() => {
        bracketManager.validatePlayerCount(4);
      }).not.toThrow();

      expect(() => {
        bracketManager.validatePlayerCount(64);
      }).not.toThrow();
    });
  });
});