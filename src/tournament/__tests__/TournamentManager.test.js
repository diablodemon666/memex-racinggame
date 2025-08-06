/**
 * TournamentManager.test.js - Comprehensive Unit Tests
 * 
 * Tests the core TournamentManager functionality using TDD methodology
 * Covers tournament lifecycle, player management, and system integration
 */

// Mock dependencies
jest.mock('../../multiplayer/MultiplayerEvents.js', () => ({
  multiplayerEvents: {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn()
  },
  MULTIPLAYER_EVENTS: {
    RACE_FINISHED: 'RACE_FINISHED',
    ROOM_CREATED: 'ROOM_CREATED'
  }
}));

jest.mock('../../multiplayer/RoomManager.js', () => ({
  roomManager: {
    initializeRoom: jest.fn(),
    addPlayer: jest.fn(),
    getRoom: jest.fn(),
    removeRoom: jest.fn()
  }
}));

jest.mock('../BracketManager.js', () => ({
  BracketManager: jest.fn().mockImplementation(() => ({
    createTournament: jest.fn().mockReturnValue({
      tournamentId: 'test-tournament-123',
      bracket: [],
      totalRounds: 4,
      firstRoundMatches: []
    }),
    startNextMatch: jest.fn().mockReturnValue({
      matchId: 'match-123',
      players: [
        { playerId: 'player1', playerName: 'Player 1' },
        { playerId: 'player2', playerName: 'Player 2' }
      ]
    }),
    isComplete: false,
    generateFinalStandings: jest.fn().mockReturnValue([
      { playerId: 'player1', playerName: 'Player 1', position: 1 }
    ]),
    cleanup: jest.fn(),
    destroy: jest.fn()
  }))
}));

jest.mock('../TournamentStateManager.js', () => ({
  TournamentStateManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(),
    saveTournamentState: jest.fn().mockResolvedValue(),
    loadActiveTournaments: jest.fn().mockResolvedValue([]),
    archiveTournament: jest.fn().mockResolvedValue(),
    destroy: jest.fn()
  }))
}));

import { TournamentManager } from '../TournamentManager';
import { GameHelpers, AsyncHelpers, ValidationHelpers } from '../../../tests/utils/test-helpers';
import { multiplayerEvents } from '../../multiplayer/MultiplayerEvents.js';

describe('TournamentManager', () => {
  let tournamentManager;
  let mockAuthManager;
  let mockGameEngine;

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock auth manager
    mockAuthManager = {
      validateUser: jest.fn().mockResolvedValue(true),
      getCurrentUser: jest.fn().mockReturnValue({ userId: 'user1', username: 'testuser' })
    };

    // Create mock game engine
    mockGameEngine = {
      isRunning: true,
      createRoom: jest.fn(),
      getRoomData: jest.fn()
    };

    // Create tournament manager instance
    tournamentManager = new TournamentManager(mockAuthManager, mockGameEngine);
    await tournamentManager.initialize();
  });

  afterEach(() => {
    if (tournamentManager) {
      tournamentManager.destroy();
    }
  });

  describe('Initialization', () => {
    it('should initialize with valid configuration', async () => {
      const newManager = new TournamentManager(mockAuthManager, mockGameEngine);
      await newManager.initialize();

      expect(newManager.isInitialized).toBe(true);
      expect(newManager.bracketManager).toBeDefined();
      expect(newManager.stateManager).toBeDefined();
      expect(newManager.activeTournaments).toBeInstanceOf(Map);
      expect(newManager.playerRegistrations).toBeInstanceOf(Map);
      expect(newManager.spectators).toBeInstanceOf(Map);
    });

    it('should have required component interface', () => {
      ValidationHelpers.validateComponent(tournamentManager, [
        'createTournament', 'registerPlayer', 'startTournament', 'cancelTournament'
      ]);
    });

    it('should initialize with default configuration', () => {
      expect(tournamentManager.config.maxConcurrentTournaments).toBe(5);
      expect(tournamentManager.config.defaultTournamentSettings.format).toBe('single_elimination');
      expect(tournamentManager.config.defaultTournamentSettings.maxPlayers).toBe(32);
      expect(tournamentManager.config.defaultTournamentSettings.minPlayers).toBe(4);
      expect(tournamentManager.config.supportedFormats).toContain('single_elimination');
      expect(tournamentManager.config.supportedFormats).toContain('double_elimination');
      expect(tournamentManager.config.supportedFormats).toContain('round_robin');
    });

    it('should not initialize twice', async () => {
      const initSpy = jest.spyOn(tournamentManager.stateManager, 'initialize');
      
      await tournamentManager.initialize();
      
      expect(initSpy).not.toHaveBeenCalled(); // Already initialized
    });

    it('should handle initialization errors gracefully', async () => {
      const newManager = new TournamentManager();
      newManager.stateManager.initialize.mockRejectedValue(new Error('State manager init failed'));

      await expect(newManager.initialize()).rejects.toThrow('State manager init failed');
      expect(newManager.isInitialized).toBe(false);
    });
  });

  describe('Tournament Creation', () => {
    const validTournamentConfig = {
      name: 'Test Tournament',
      format: 'single_elimination',
      maxPlayers: 16,
      minPlayers: 4,
      raceTimeLimit: 300
    };

    it('should create tournament with valid configuration', async () => {
      const result = await tournamentManager.createTournament(validTournamentConfig, 'creator1');

      expect(result.success).toBe(true);
      expect(result.tournament).toBeDefined();
      expect(result.tournament.config.name).toBe('Test Tournament');
      expect(result.tournament.status).toBe('registration');
      expect(result.tournament.creatorId).toBe('creator1');
      expect(result.registrationUrl).toContain(result.tournament.tournamentId);
      
      expect(tournamentManager.activeTournaments.size).toBe(1);
      expect(multiplayerEvents.emit).toHaveBeenCalledWith('TOURNAMENT_CREATED', expect.any(Object));
    });

    it('should merge configuration with defaults', async () => {
      const minimalConfig = { name: 'Minimal Tournament' };
      const result = await tournamentManager.createTournament(minimalConfig, 'creator1');

      expect(result.tournament.config.format).toBe('single_elimination');
      expect(result.tournament.config.maxPlayers).toBe(32);
      expect(result.tournament.config.minPlayers).toBe(4);
      expect(result.tournament.config.bettingEnabled).toBe(true);
    });

    it('should reject creation when max concurrent tournaments reached', async () => {
      // Fill up to max concurrent tournaments
      for (let i = 0; i < tournamentManager.config.maxConcurrentTournaments; i++) {
        await tournamentManager.createTournament(
          { ...validTournamentConfig, name: `Tournament ${i}` }, 
          `creator${i}`
        );
      }

      await expect(
        tournamentManager.createTournament(validTournamentConfig, 'creator6')
      ).rejects.toThrow('Maximum concurrent tournaments reached');
    });

    it('should validate creator authentication when auth manager present', async () => {
      mockAuthManager.validateUser.mockResolvedValue(false);

      await expect(
        tournamentManager.createTournament(validTournamentConfig, 'invalid-user')
      ).rejects.toThrow('Invalid tournament creator');
    });

    it('should throw error when not initialized', async () => {
      const uninitializedManager = new TournamentManager();

      await expect(
        uninitializedManager.createTournament(validTournamentConfig, 'creator1')
      ).rejects.toThrow('TournamentManager not initialized');
    });

    it('should validate tournament configuration', async () => {
      const invalidConfig = {
        format: 'invalid_format',
        maxPlayers: 2,
        minPlayers: 8
      };

      await expect(
        tournamentManager.createTournament(invalidConfig, 'creator1')
      ).rejects.toThrow();
    });

    it('should set registration deadline correctly', async () => {
      const customTimeLimit = 1200; // 20 minutes
      const configWithCustomTime = {
        ...validTournamentConfig,
        registrationTimeLimit: customTimeLimit
      };

      const startTime = Date.now();
      const result = await tournamentManager.createTournament(configWithCustomTime, 'creator1');
      
      const expectedDeadline = startTime + (customTimeLimit * 1000);
      const actualDeadline = result.tournament.registrationDeadline;
      
      expect(actualDeadline).toBeGreaterThanOrEqual(expectedDeadline - 100); // Allow 100ms tolerance
      expect(actualDeadline).toBeLessThanOrEqual(expectedDeadline + 100);
    });
  });

  describe('Player Registration', () => {
    let tournamentId;
    const playerData = {
      playerId: 'player1',
      playerName: 'Test Player',
      username: 'testplayer'
    };

    beforeEach(async () => {
      const result = await tournamentManager.createTournament({
        name: 'Test Tournament',
        format: 'single_elimination',
        maxPlayers: 8,
        minPlayers: 4
      }, 'creator1');
      tournamentId = result.tournament.tournamentId;
    });

    it('should register player successfully', async () => {
      const result = await tournamentManager.registerPlayer(tournamentId, playerData);

      expect(result.success).toBe(true);
      expect(result.registration.playerId).toBe(playerData.playerId);
      expect(result.registration.seed).toBe(1);
      expect(result.position).toBe(1);
      
      const registrations = tournamentManager.playerRegistrations.get(tournamentId);
      expect(registrations.has(playerData.playerId)).toBe(true);
      
      expect(multiplayerEvents.emit).toHaveBeenCalledWith('TOURNAMENT_PLAYER_REGISTERED', expect.any(Object));
    });

    it('should prevent duplicate registrations', async () => {
      await tournamentManager.registerPlayer(tournamentId, playerData);

      await expect(
        tournamentManager.registerPlayer(tournamentId, playerData)
      ).rejects.toThrow('Player already registered for this tournament');
    });

    it('should reject registration when tournament is full', async () => {
      const tournament = tournamentManager.activeTournaments.get(tournamentId);
      const maxPlayers = tournament.config.maxPlayers;

      // Fill tournament to capacity
      for (let i = 0; i < maxPlayers; i++) {
        await tournamentManager.registerPlayer(tournamentId, {
          playerId: `player${i}`,
          playerName: `Player ${i}`
        });
      }

      await expect(
        tournamentManager.registerPlayer(tournamentId, {
          playerId: 'overflow-player',
          playerName: 'Overflow Player'
        })
      ).rejects.toThrow('Tournament is full');
    });

    it('should reject registration after deadline', async () => {
      const tournament = tournamentManager.activeTournaments.get(tournamentId);
      tournament.registrationDeadline = Date.now() - 1000; // 1 second ago

      await expect(
        tournamentManager.registerPlayer(tournamentId, playerData)
      ).rejects.toThrow('Registration deadline has passed');
    });

    it('should reject registration when tournament not in registration status', async () => {
      const tournament = tournamentManager.activeTournaments.get(tournamentId);
      tournament.status = 'active';

      await expect(
        tournamentManager.registerPlayer(tournamentId, playerData)
      ).rejects.toThrow('Tournament registration is closed');
    });

    it('should reject registration for non-existent tournament', async () => {
      await expect(
        tournamentManager.registerPlayer('non-existent', playerData)
      ).rejects.toThrow('Tournament not found');
    });

    it('should validate player authentication', async () => {
      mockAuthManager.validateUser.mockResolvedValue(false);

      await expect(
        tournamentManager.registerPlayer(tournamentId, playerData)
      ).rejects.toThrow('Invalid player credentials');
    });

    it('should auto-start tournament when conditions are met', async () => {
      const tournament = tournamentManager.activeTournaments.get(tournamentId);
      const minPlayers = tournament.config.minPlayers;

      // Register minimum players
      for (let i = 0; i < minPlayers; i++) {
        await tournamentManager.registerPlayer(tournamentId, {
          playerId: `player${i}`,
          playerName: `Player ${i}`
        });
      }

      // Should trigger auto-start check
      expect(tournamentManager.checkTournamentStart).toBeDefined();
    });
  });

  describe('Player Unregistration', () => {
    let tournamentId;
    const playerData = {
      playerId: 'player1',
      playerName: 'Test Player'
    };

    beforeEach(async () => {
      const result = await tournamentManager.createTournament({
        name: 'Test Tournament',
        maxPlayers: 8,
        minPlayers: 4
      }, 'creator1');
      tournamentId = result.tournament.tournamentId;
      await tournamentManager.registerPlayer(tournamentId, playerData);
    });

    it('should unregister player successfully', async () => {
      const result = await tournamentManager.unregisterPlayer(tournamentId, playerData.playerId);

      expect(result.success).toBe(true);
      expect(result.totalRegistrations).toBe(0);

      const registrations = tournamentManager.playerRegistrations.get(tournamentId);
      expect(registrations.has(playerData.playerId)).toBe(false);

      expect(multiplayerEvents.emit).toHaveBeenCalledWith('TOURNAMENT_PLAYER_UNREGISTERED', expect.any(Object));
    });

    it('should reject unregistration for non-registered player', async () => {
      await expect(
        tournamentManager.unregisterPlayer(tournamentId, 'non-registered-player')
      ).rejects.toThrow('Player not registered for this tournament');
    });

    it('should reject unregistration after tournament starts', async () => {
      const tournament = tournamentManager.activeTournaments.get(tournamentId);
      tournament.status = 'active';

      await expect(
        tournamentManager.unregisterPlayer(tournamentId, playerData.playerId)
      ).rejects.toThrow('Cannot unregister after tournament has started');
    });
  });

  describe('Spectator Management', () => {
    let tournamentId;
    const spectatorData = {
      spectatorId: 'spec1',
      spectatorName: 'Test Spectator'
    };

    beforeEach(async () => {
      const result = await tournamentManager.createTournament({
        name: 'Test Tournament',
        spectatorCount: 10
      }, 'creator1');
      tournamentId = result.tournament.tournamentId;
    });

    it('should add spectator successfully', async () => {
      const result = await tournamentManager.addSpectator(tournamentId, spectatorData);

      expect(result.success).toBe(true);
      expect(result.spectator.spectatorId).toBe(spectatorData.spectatorId);
      expect(result.totalSpectators).toBe(1);

      const spectators = tournamentManager.spectators.get(tournamentId);
      expect(spectators.has(spectatorData.spectatorId)).toBe(true);

      expect(multiplayerEvents.emit).toHaveBeenCalledWith('TOURNAMENT_SPECTATOR_JOINED', expect.any(Object));
    });

    it('should handle duplicate spectator addition gracefully', async () => {
      await tournamentManager.addSpectator(tournamentId, spectatorData);
      const result = await tournamentManager.addSpectator(tournamentId, spectatorData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Already spectating');
    });

    it('should reject spectator when capacity reached', async () => {
      const tournament = tournamentManager.activeTournaments.get(tournamentId);
      const maxSpectators = tournament.config.spectatorCount;

      // Fill spectator capacity
      for (let i = 0; i < maxSpectators; i++) {
        await tournamentManager.addSpectator(tournamentId, {
          spectatorId: `spec${i}`,
          spectatorName: `Spectator ${i}`
        });
      }

      await expect(
        tournamentManager.addSpectator(tournamentId, {
          spectatorId: 'overflow-spec',
          spectatorName: 'Overflow Spectator'
        })
      ).rejects.toThrow('Tournament spectator capacity reached');
    });
  });

  describe('Tournament Lifecycle - Different Player Counts', () => {
    const playerCounts = [4, 8, 16, 32, 64];

    playerCounts.forEach(playerCount => {
      it(`should handle tournament lifecycle with ${playerCount} players`, async () => {
        const result = await tournamentManager.createTournament({
          name: `Tournament ${playerCount}`,
          maxPlayers: playerCount,
          minPlayers: Math.min(4, playerCount)
        }, 'creator1');
        
        const tournamentId = result.tournament.tournamentId;

        // Register players
        const players = GameHelpers.createMockPlayers(playerCount);
        for (const player of players) {
          await tournamentManager.registerPlayer(tournamentId, {
            playerId: player.id,
            playerName: player.name
          });
        }

        // Start tournament
        await tournamentManager.startTournament(tournamentId);
        const tournament = tournamentManager.activeTournaments.get(tournamentId);

        expect(tournament.status).toBe('active');
        expect(tournament.registeredPlayers.length).toBe(playerCount);
        expect(tournament.bracket).toBeDefined();
        expect(multiplayerEvents.emit).toHaveBeenCalledWith('TOURNAMENT_STARTED', expect.any(Object));
      });
    });

    it('should handle odd number of players (5 players)', async () => {
      const result = await tournamentManager.createTournament({
        name: 'Odd Players Tournament',
        maxPlayers: 8,
        minPlayers: 4
      }, 'creator1');
      
      const tournamentId = result.tournament.tournamentId;
      const players = GameHelpers.createMockPlayers(5);

      for (const player of players) {
        await tournamentManager.registerPlayer(tournamentId, {
          playerId: player.id,
          playerName: player.name
        });
      }

      await tournamentManager.startTournament(tournamentId);
      const tournament = tournamentManager.activeTournaments.get(tournamentId);

      expect(tournament.status).toBe('active');
      expect(tournament.registeredPlayers.length).toBe(5);
    });

    it('should handle minimum players (4 players)', async () => {
      const result = await tournamentManager.createTournament({
        name: 'Minimum Players Tournament',
        maxPlayers: 8,
        minPlayers: 4
      }, 'creator1');
      
      const tournamentId = result.tournament.tournamentId;
      const players = GameHelpers.createMockPlayers(4);

      for (const player of players) {
        await tournamentManager.registerPlayer(tournamentId, {
          playerId: player.id,
          playerName: player.name
        });
      }

      await tournamentManager.startTournament(tournamentId);
      const tournament = tournamentManager.activeTournaments.get(tournamentId);

      expect(tournament.status).toBe('active');
      expect(tournament.registeredPlayers.length).toBe(4);
    });

    it('should handle maximum players (64 players)', async () => {
      const result = await tournamentManager.createTournament({
        name: 'Maximum Players Tournament',
        maxPlayers: 64,
        minPlayers: 4
      }, 'creator1');
      
      const tournamentId = result.tournament.tournamentId;
      const players = GameHelpers.createMockPlayers(64);

      // Register players in batches to avoid timeout
      for (let i = 0; i < players.length; i += 10) {
        const batch = players.slice(i, i + 10);
        await Promise.all(batch.map(player => 
          tournamentManager.registerPlayer(tournamentId, {
            playerId: player.id,
            playerName: player.name
          })
        ));
      }

      await tournamentManager.startTournament(tournamentId);
      const tournament = tournamentManager.activeTournaments.get(tournamentId);

      expect(tournament.status).toBe('active');
      expect(tournament.registeredPlayers.length).toBe(64);
    });
  });

  describe('Tournament Start Conditions', () => {
    let tournamentId;

    beforeEach(async () => {
      const result = await tournamentManager.createTournament({
        name: 'Test Tournament',
        maxPlayers: 8,
        minPlayers: 4,
        registrationTimeLimit: 600
      }, 'creator1');
      tournamentId = result.tournament.tournamentId;
    });

    it('should start tournament when minimum players reached and deadline passed', async () => {
      // Register minimum players
      const players = GameHelpers.createMockPlayers(4);
      for (const player of players) {
        await tournamentManager.registerPlayer(tournamentId, {
          playerId: player.id,
          playerName: player.name
        });
      }

      // Simulate deadline passed
      const tournament = tournamentManager.activeTournaments.get(tournamentId);
      tournament.registrationDeadline = Date.now() - 1000;

      await tournamentManager.startTournament(tournamentId);
      expect(tournament.status).toBe('active');
    });

    it('should start tournament when maximum players reached', async () => {
      const tournament = tournamentManager.activeTournaments.get(tournamentId);
      const maxPlayers = tournament.config.maxPlayers;

      // Register maximum players
      for (let i = 0; i < maxPlayers; i++) {
        await tournamentManager.registerPlayer(tournamentId, {
          playerId: `player${i}`,
          playerName: `Player ${i}`
        });
      }

      await tournamentManager.startTournament(tournamentId);
      expect(tournament.status).toBe('active');
    });

    it('should not start tournament with insufficient players', async () => {
      // Register only 2 players (less than minimum)
      for (let i = 0; i < 2; i++) {
        await tournamentManager.registerPlayer(tournamentId, {
          playerId: `player${i}`,
          playerName: `Player ${i}`
        });
      }

      const tournament = tournamentManager.activeTournaments.get(tournamentId);
      expect(tournament.status).toBe('registration');
    });
  });

  describe('Match Creation and Room Management', () => {
    let tournamentId;

    beforeEach(async () => {
      const result = await tournamentManager.createTournament({
        name: 'Test Tournament',
        maxPlayers: 8,
        minPlayers: 4
      }, 'creator1');
      tournamentId = result.tournament.tournamentId;

      // Register and start tournament
      const players = GameHelpers.createMockPlayers(4);
      for (const player of players) {
        await tournamentManager.registerPlayer(tournamentId, {
          playerId: player.id,
          playerName: player.name
        });
      }
      await tournamentManager.startTournament(tournamentId);
    });

    it('should start next matches and create rooms', async () => {
      const match = await tournamentManager.startNextMatches(tournamentId);

      expect(match).toBeDefined();
      expect(match.matchId).toBeDefined();
      expect(match.roomCode).toBeDefined();
      expect(match.players.length).toBeGreaterThan(0);

      // Verify room creation
      expect(tournamentManager.roomManager.initializeRoom).toHaveBeenCalled();
      expect(tournamentManager.roomManager.addPlayer).toHaveBeenCalled();
    });

    it('should create room with correct tournament settings', async () => {
      await tournamentManager.startNextMatches(tournamentId);
      const tournament = tournamentManager.activeTournaments.get(tournamentId);

      expect(tournamentManager.roomManager.initializeRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          maxPlayers: expect.any(Number),
          fillWithAI: false,
          gameSettings: expect.objectContaining({
            raceTimeLimit: tournament.config.raceTimeLimit,
            bettingEnabled: tournament.config.bettingEnabled,
            isTournamentMatch: true,
            tournamentId: tournamentId
          }),
          isPrivate: false,
          spectatorLimit: tournament.config.spectatorCount
        })
      );
    });
  });

  describe('Match Completion Handling', () => {
    let tournamentId;

    beforeEach(async () => {
      const result = await tournamentManager.createTournament({
        name: 'Test Tournament',
        maxPlayers: 8,
        minPlayers: 4
      }, 'creator1');
      tournamentId = result.tournament.tournamentId;

      const players = GameHelpers.createMockPlayers(4);
      for (const player of players) {
        await tournamentManager.registerPlayer(tournamentId, {
          playerId: player.id,
          playerName: player.name
        });
      }
      await tournamentManager.startTournament(tournamentId);
    });

    it('should handle match completion correctly', async () => {
      const matchId = 'test-match-123';
      const results = {
        duration: 240000,
        winner: { playerId: 'player1', playerName: 'Player 1' },
        players: [
          { playerId: 'player1', finishPosition: 1, raceTime: 240000 },
          { playerId: 'player2', finishPosition: 2, raceTime: 250000 }
        ]
      };

      await tournamentManager.handleMatchCompletion(tournamentId, matchId, results);

      const tournament = tournamentManager.activeTournaments.get(tournamentId);
      expect(tournament.currentMatch).toBeNull();
      expect(tournament.stats.averageMatchDuration).toBeGreaterThan(0);
    });

    it('should start next matches after completion', async () => {
      const matchId = 'test-match-123';
      const results = { duration: 240000 };

      const startNextMatchesSpy = jest.spyOn(tournamentManager, 'startNextMatches');
      
      await tournamentManager.handleMatchCompletion(tournamentId, matchId, results);

      // Should schedule next matches with delay
      await AsyncHelpers.delay(5100); // Wait for 5 second delay + buffer
      
      expect(startNextMatchesSpy).toHaveBeenCalledWith(tournamentId);
    });

    it('should complete tournament when bracket is finished', async () => {
      tournamentManager.bracketManager.isComplete = true;
      const completeTournamentSpy = jest.spyOn(tournamentManager, 'completeTournament');

      await tournamentManager.handleMatchCompletion(tournamentId, 'match-123', { duration: 240000 });

      expect(completeTournamentSpy).toHaveBeenCalledWith(tournamentId);
    });
  });

  describe('Tournament Completion', () => {
    let tournamentId;

    beforeEach(async () => {
      const result = await tournamentManager.createTournament({
        name: 'Test Tournament',
        maxPlayers: 8,
        minPlayers: 4
      }, 'creator1');
      tournamentId = result.tournament.tournamentId;

      const players = GameHelpers.createMockPlayers(4);
      for (const player of players) {
        await tournamentManager.registerPlayer(tournamentId, {
          playerId: player.id,
          playerName: player.name
        });
      }
      await tournamentManager.startTournament(tournamentId);
    });

    it('should complete tournament correctly', async () => {
      await tournamentManager.completeTournament(tournamentId);

      expect(tournamentManager.activeTournaments.has(tournamentId)).toBe(false);
      expect(tournamentManager.playerRegistrations.has(tournamentId)).toBe(false);
      expect(tournamentManager.spectators.has(tournamentId)).toBe(false);

      expect(multiplayerEvents.emit).toHaveBeenCalledWith('TOURNAMENT_COMPLETED', expect.objectContaining({
        tournamentId,
        winner: expect.any(Object),
        finalStandings: expect.any(Array)
      }));
    });

    it('should archive tournament data', async () => {
      const archiveSpy = jest.spyOn(tournamentManager.stateManager, 'archiveTournament');
      
      await tournamentManager.completeTournament(tournamentId);
      
      expect(archiveSpy).toHaveBeenCalled();
    });
  });

  describe('Tournament Cancellation', () => {
    let tournamentId;

    beforeEach(async () => {
      const result = await tournamentManager.createTournament({
        name: 'Test Tournament',
        maxPlayers: 8,
        minPlayers: 4
      }, 'creator1');
      tournamentId = result.tournament.tournamentId;
    });

    it('should cancel tournament with reason', async () => {
      const reason = 'Not enough players';
      
      await tournamentManager.cancelTournament(tournamentId, reason);

      expect(tournamentManager.activeTournaments.has(tournamentId)).toBe(false);
      expect(tournamentManager.playerRegistrations.has(tournamentId)).toBe(false);
      expect(tournamentManager.spectators.has(tournamentId)).toBe(false);

      expect(multiplayerEvents.emit).toHaveBeenCalledWith('TOURNAMENT_CANCELLED', expect.objectContaining({
        tournamentId,
        reason
      }));
    });

    it('should use default cancellation reason', async () => {
      await tournamentManager.cancelTournament(tournamentId);

      expect(multiplayerEvents.emit).toHaveBeenCalledWith('TOURNAMENT_CANCELLED', expect.objectContaining({
        reason: 'Tournament cancelled by organizer'
      }));
    });

    it('should clean up bracket manager', async () => {
      const cleanupSpy = jest.spyOn(tournamentManager.bracketManager, 'cleanup');
      
      await tournamentManager.cancelTournament(tournamentId);
      
      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('Tournament Data Access', () => {
    let tournamentId;

    beforeEach(async () => {
      const result = await tournamentManager.createTournament({
        name: 'Test Tournament',
        maxPlayers: 8,
        minPlayers: 4,
        prizePool: 1000
      }, 'creator1');
      tournamentId = result.tournament.tournamentId;

      await tournamentManager.registerPlayer(tournamentId, {
        playerId: 'player1',
        playerName: 'Player 1'
      });
    });

    it('should return public tournament data', () => {
      const publicData = tournamentManager.getTournamentPublicData(
        tournamentManager.activeTournaments.get(tournamentId)
      );

      expect(publicData).toEqual(expect.objectContaining({
        tournamentId,
        name: 'Test Tournament',
        format: 'single_elimination',
        status: 'registration',
        maxPlayers: 8,
        minPlayers: 4,
        currentPlayers: 1,
        prizePool: 1000,
        bettingEnabled: true
      }));

      // Should not contain sensitive data
      expect(publicData.creatorId).toBeUndefined();
      expect(publicData.registeredPlayers).toBeUndefined();
    });

    it('should return detailed data for registered players', () => {
      const details = tournamentManager.getTournamentDetails(tournamentId, 'player1');

      expect(details.playerData).toBeDefined();
      expect(details.playerData.playerId).toBe('player1');
    });

    it('should list active tournaments', () => {
      const activeTournaments = tournamentManager.listActiveTournaments();

      expect(activeTournaments).toHaveLength(1);
      expect(activeTournaments[0].tournamentId).toBe(tournamentId);
    });

    it('should provide tournament statistics', () => {
      const stats = tournamentManager.getStatistics();

      expect(stats).toEqual(expect.objectContaining({
        activeTournaments: 1,
        totalRegistrations: 1,
        totalSpectators: 0,
        tournamentsByStatus: expect.objectContaining({
          registration: 1,
          active: 0,
          completed: 0
        }),
        averagePlayersPerTournament: 1
      }));
    });
  });

  describe('Format Validation', () => {
    it('should validate single elimination format', async () => {
      const config = { format: 'single_elimination', maxPlayers: 16, minPlayers: 4 };
      
      await expect(
        tournamentManager.createTournament(config, 'creator1')
      ).resolves.not.toThrow();
    });

    it('should validate double elimination format', async () => {
      const config = { format: 'double_elimination', maxPlayers: 16, minPlayers: 4 };
      
      await expect(
        tournamentManager.createTournament(config, 'creator1')
      ).resolves.not.toThrow();
    });

    it('should validate round robin format', async () => {
      const config = { format: 'round_robin', maxPlayers: 16, minPlayers: 4 };
      
      await expect(
        tournamentManager.createTournament(config, 'creator1')
      ).resolves.not.toThrow();
    });

    it('should reject unsupported formats', async () => {
      const config = { format: 'unsupported_format', maxPlayers: 16, minPlayers: 4 };
      
      await expect(
        tournamentManager.createTournament(config, 'creator1')
      ).rejects.toThrow('Unsupported tournament format');
    });
  });

  describe('Error Handling', () => {
    it('should handle bracket manager errors gracefully', async () => {
      tournamentManager.bracketManager.createTournament.mockImplementation(() => {
        throw new Error('Bracket creation failed');
      });

      await expect(
        tournamentManager.createTournament({ name: 'Test' }, 'creator1')
      ).rejects.toThrow('Bracket creation failed');
    });

    it('should handle state manager errors gracefully', async () => {
      tournamentManager.stateManager.saveTournamentState.mockRejectedValue(
        new Error('State save failed')
      );

      await expect(
        tournamentManager.createTournament({ name: 'Test' }, 'creator1')
      ).rejects.toThrow('State save failed');
    });

    it('should handle room manager errors gracefully', async () => {
      tournamentManager.roomManager.initializeRoom.mockImplementation(() => {
        throw new Error('Room creation failed');
      });

      const result = await tournamentManager.createTournament({ name: 'Test' }, 'creator1');
      const tournamentId = result.tournament.tournamentId;
      
      const players = GameHelpers.createMockPlayers(4);
      for (const player of players) {
        await tournamentManager.registerPlayer(tournamentId, {
          playerId: player.id,
          playerName: player.name
        });
      }
      await tournamentManager.startTournament(tournamentId);

      await expect(
        tournamentManager.startNextMatches(tournamentId)
      ).rejects.toThrow('Room creation failed');
    });
  });

  describe('Event Integration', () => {
    it('should emit tournament created event', async () => {
      await tournamentManager.createTournament({ name: 'Test' }, 'creator1');

      expect(multiplayerEvents.emit).toHaveBeenCalledWith('TOURNAMENT_CREATED', expect.objectContaining({
        tournament: expect.any(Object),
        creatorId: 'creator1'
      }));
    });

    it('should listen for race finished events', () => {
      expect(multiplayerEvents.on).toHaveBeenCalledWith('RACE_FINISHED', expect.any(Function));
    });

    it('should handle tournament match completion events', () => {
      expect(multiplayerEvents.on).toHaveBeenCalledWith('TOURNAMENT_MATCH_COMPLETED', expect.any(Function));
    });
  });

  describe('Resource Cleanup', () => {
    it('should cleanup all resources when destroy() is called', () => {
      tournamentManager.destroy();

      expect(tournamentManager.activeTournaments.size).toBe(0);
      expect(tournamentManager.playerRegistrations.size).toBe(0);
      expect(tournamentManager.spectators.size).toBe(0);
      expect(tournamentManager.bracketManager.destroy).toHaveBeenCalled();
      expect(tournamentManager.stateManager.destroy).toHaveBeenCalled();
    });

    it('should handle destroy when not initialized', () => {
      const uninitializedManager = new TournamentManager();
      
      expect(() => uninitializedManager.destroy()).not.toThrow();
    });
  });

  describe('Concurrent Tournament Management', () => {
    it('should handle multiple concurrent tournaments', async () => {
      const tournaments = [];
      
      // Create multiple tournaments
      for (let i = 0; i < 3; i++) {
        const result = await tournamentManager.createTournament({
          name: `Tournament ${i}`,
          maxPlayers: 8,
          minPlayers: 4
        }, `creator${i}`);
        tournaments.push(result.tournament.tournamentId);
      }

      expect(tournamentManager.activeTournaments.size).toBe(3);

      // Register players for each tournament
      for (const tournamentId of tournaments) {
        const players = GameHelpers.createMockPlayers(4);
        for (const player of players) {
          await tournamentManager.registerPlayer(tournamentId, {
            playerId: `${tournamentId}_${player.id}`,
            playerName: player.name
          });
        }
      }

      // Verify all tournaments have registrations
      tournaments.forEach(tournamentId => {
        const registrations = tournamentManager.playerRegistrations.get(tournamentId);
        expect(registrations.size).toBe(4);
      });
    });
  });
});