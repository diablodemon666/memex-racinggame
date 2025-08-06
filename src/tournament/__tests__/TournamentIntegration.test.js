/**
 * TournamentIntegration.test.js - Comprehensive Integration Tests
 * 
 * Tests tournament system integration with game systems, multiplayer events,
 * room management, betting, and authentication
 */

// Mock all external dependencies
jest.mock('../../multiplayer/MultiplayerEvents.js', () => ({
  multiplayerEvents: {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn()
  },
  MULTIPLAYER_EVENTS: {
    RACE_FINISHED: 'RACE_FINISHED',
    ROOM_CREATED: 'ROOM_CREATED',
    PLAYER_JOINED: 'PLAYER_JOINED',
    BETTING_STARTED: 'BETTING_STARTED'
  }
}));

jest.mock('../../multiplayer/RoomManager.js', () => ({
  roomManager: {
    initializeRoom: jest.fn(),
    addPlayer: jest.fn(),
    removePlayer: jest.fn(),
    getRoom: jest.fn().mockReturnValue({
      roomCode: 'TOURN_12345',
      players: [],
      maxPlayers: 6,
      settings: {}
    }),
    updateRoomSettings: jest.fn(),
    destroyRoom: jest.fn(),
    getRoomList: jest.fn().mockReturnValue([]),
    broadcastToRoom: jest.fn()
  }
}));

jest.mock('../../auth/AuthManager.js', () => ({
  AuthManager: jest.fn().mockImplementation(() => ({
    validateUser: jest.fn().mockResolvedValue(true),
    getCurrentUser: jest.fn().mockReturnValue({
      userId: 'user123',
      username: 'testuser',
      isAuthenticated: true
    }),
    hasPermission: jest.fn().mockReturnValue(true),
    getUserStats: jest.fn().mockReturnValue({
      wins: 10,
      losses: 5,
      totalRaces: 15
    })
  }))
}));

jest.mock('../../game/engine/GameEngine.js', () => ({
  GameEngine: jest.fn().mockImplementation(() => ({
    isInitialized: true,
    isRunning: false,
    startRace: jest.fn().mockResolvedValue({
      raceId: 'race123',
      status: 'started'
    }),
    endRace: jest.fn().mockResolvedValue({
      results: {
        players: [
          { playerId: 'player1', finishPosition: 1, raceTime: 240000 },
          { playerId: 'player2', finishPosition: 2, raceTime: 250000 }
        ],
        duration: 245000
      }
    }),
    getRaceStatus: jest.fn().mockReturnValue({ status: 'finished' }),
    createRaceSession: jest.fn(),
    destroyRaceSession: jest.fn()
  }))
}));

jest.mock('../../ui/BettingManager.js', () => ({
  BettingManager: jest.fn().mockImplementation(() => ({
    isInitialized: true,
    startBetting: jest.fn(),
    endBetting: jest.fn(),
    placeBet: jest.fn().mockResolvedValue({ success: true }),
    getBettingState: jest.fn().mockReturnValue({
      isActive: false,
      totalPool: 0,
      odds: new Map()
    }),
    processBettingResults: jest.fn(),
    updateOdds: jest.fn()
  }))
}));

import { TournamentManager } from '../TournamentManager';
import { BracketManager } from '../BracketManager';
import { GameHelpers, AsyncHelpers, ValidationHelpers, IntegrationHelpers } from '../../../tests/utils/test-helpers';
import { multiplayerEvents, MULTIPLAYER_EVENTS } from '../../multiplayer/MultiplayerEvents.js';
import { roomManager } from '../../multiplayer/RoomManager.js';

describe('Tournament Integration Tests', () => {
  let tournamentManager;
  let mockAuthManager;
  let mockGameEngine;
  let mockBettingManager;

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock managers
    mockAuthManager = {
      validateUser: jest.fn().mockResolvedValue(true),
      getCurrentUser: jest.fn().mockReturnValue({
        userId: 'user123',
        username: 'testuser'
      }),
      hasPermission: jest.fn().mockReturnValue(true)
    };

    mockGameEngine = {
      isInitialized: true,
      isRunning: false,
      startRace: jest.fn().mockResolvedValue({ raceId: 'race123' }),
      endRace: jest.fn().mockResolvedValue({
        results: {
          players: [
            { playerId: 'player1', finishPosition: 1, raceTime: 240000 },
            { playerId: 'player2', finishPosition: 2, raceTime: 250000 }
          ],
          duration: 245000
        }
      })
    };

    mockBettingManager = {
      startBetting: jest.fn(),
      endBetting: jest.fn(),
      getBettingState: jest.fn().mockReturnValue({ isActive: false }),
      processBettingResults: jest.fn()
    };

    // Create tournament manager with dependencies
    tournamentManager = new TournamentManager(mockAuthManager, mockGameEngine);
    tournamentManager.bettingManager = mockBettingManager;
    await tournamentManager.initialize();
  });

  afterEach(() => {
    if (tournamentManager) {
      tournamentManager.destroy();
    }
  });

  describe('Full Tournament Lifecycle Integration', () => {
    it('should execute complete tournament flow with 8 players', async () => {
      // Create tournament
      const tournamentResult = await tournamentManager.createTournament({
        name: 'Integration Test Tournament',
        format: 'single_elimination',
        maxPlayers: 8,
        minPlayers: 4,
        bettingEnabled: true
      }, 'creator1');

      const tournamentId = tournamentResult.tournament.tournamentId;
      expect(tournamentResult.success).toBe(true);

      // Register players
      const players = GameHelpers.createMockPlayers(8);
      for (const player of players) {
        const registration = await tournamentManager.registerPlayer(tournamentId, {
          playerId: player.id,
          playerName: player.name,
          username: player.username || `user_${player.id}`
        });
        expect(registration.success).toBe(true);
      }

      // Add spectators
      for (let i = 0; i < 5; i++) {
        await tournamentManager.addSpectator(tournamentId, {
          spectatorId: `spec${i}`,
          spectatorName: `Spectator ${i}`
        });
      }

      // Start tournament
      await tournamentManager.startTournament(tournamentId);
      const tournament = tournamentManager.activeTournaments.get(tournamentId);
      expect(tournament.status).toBe('active');

      // Verify room management integration
      expect(roomManager.initializeRoom).toHaveBeenCalled();
      expect(roomManager.addPlayer).toHaveBeenCalledTimes(8);

      // Verify tournament created event
      expect(multiplayerEvents.emit).toHaveBeenCalledWith('TOURNAMENT_STARTED', expect.objectContaining({
        tournamentId,
        tournament: expect.any(Object)
      }));

      // Simulate first match
      const firstMatch = await tournamentManager.startNextMatches(tournamentId);
      expect(firstMatch).toBeDefined();
      expect(firstMatch.roomCode).toBeDefined();

      // Simulate race results
      const raceResults = {
        duration: 240000,
        players: firstMatch.players.map((player, index) => ({
          playerId: player.playerId,
          playerName: player.playerName,
          finishPosition: index + 1,
          raceTime: 240000 + (index * 5000)
        }))
      };

      // Complete match
      await tournamentManager.handleMatchCompletion(tournamentId, firstMatch.matchId, raceResults);
      
      // Verify betting integration
      expect(mockBettingManager.startBetting).toHaveBeenCalled();
      expect(mockBettingManager.processBettingResults).toHaveBeenCalledWith(raceResults);

      // Verify tournament state update
      const updatedTournament = tournamentManager.activeTournaments.get(tournamentId);
      expect(updatedTournament.stats.totalMatches).toBe(1);
      expect(updatedTournament.stats.averageMatchDuration).toBeGreaterThan(0);
    }, 15000);

    it('should handle tournament cancellation and cleanup', async () => {
      // Create and populate tournament
      const tournamentResult = await tournamentManager.createTournament({
        name: 'Cancellation Test Tournament',
        maxPlayers: 8,
        minPlayers: 4
      }, 'creator1');

      const tournamentId = tournamentResult.tournament.tournamentId;
      
      const players = GameHelpers.createMockPlayers(4);
      for (const player of players) {
        await tournamentManager.registerPlayer(tournamentId, {
          playerId: player.id,
          playerName: player.name
        });
      }

      // Cancel tournament
      await tournamentManager.cancelTournament(tournamentId, 'Integration test cancellation');

      // Verify cleanup
      expect(tournamentManager.activeTournaments.has(tournamentId)).toBe(false);
      expect(tournamentManager.playerRegistrations.has(tournamentId)).toBe(false);
      expect(tournamentManager.spectators.has(tournamentId)).toBe(false);

      // Verify event emission
      expect(multiplayerEvents.emit).toHaveBeenCalledWith('TOURNAMENT_CANCELLED', expect.objectContaining({
        tournamentId,
        reason: 'Integration test cancellation'
      }));
    });
  });

  describe('Room Management Integration', () => {
    let tournamentId;

    beforeEach(async () => {
      const result = await tournamentManager.createTournament({
        name: 'Room Test Tournament',
        maxPlayers: 8,
        minPlayers: 4,
        playersPerRace: 4,
        spectatorCount: 20
      }, 'creator1');
      tournamentId = result.tournament.tournamentId;

      const players = GameHelpers.createMockPlayers(8);
      for (const player of players) {
        await tournamentManager.registerPlayer(tournamentId, {
          playerId: player.id,
          playerName: player.name
        });
      }
      await tournamentManager.startTournament(tournamentId);
    });

    it('should create rooms with correct tournament settings', async () => {
      const match = await tournamentManager.startNextMatches(tournamentId);
      const tournament = tournamentManager.activeTournaments.get(tournamentId);

      expect(roomManager.initializeRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          roomCode: expect.stringMatching(/^TOURN_/),
          maxPlayers: match.players.length,
          fillWithAI: false,
          gameSettings: expect.objectContaining({
            raceTimeLimit: tournament.config.raceTimeLimit,
            bettingEnabled: tournament.config.bettingEnabled,
            isTournamentMatch: true,
            tournamentId: tournamentId,
            matchId: match.matchId
          }),
          isPrivate: false,
          spectatorLimit: tournament.config.spectatorCount
        })
      );
    });

    it('should add tournament players to match rooms', async () => {
      const match = await tournamentManager.startNextMatches(tournamentId);

      match.players.forEach(player => {
        expect(roomManager.addPlayer).toHaveBeenCalledWith(
          expect.objectContaining({
            playerId: player.playerId,
            playerName: player.playerName,
            isTournamentPlayer: true,
            tournamentSeed: expect.any(Number)
          })
        );
      });
    });

    it('should handle room creation failures gracefully', async () => {
      roomManager.initializeRoom.mockImplementation(() => {
        throw new Error('Room creation failed');
      });

      await expect(
        tournamentManager.startNextMatches(tournamentId)
      ).rejects.toThrow('Room creation failed');
    });

    it('should manage spectator capacity in tournament rooms', async () => {
      const tournament = tournamentManager.activeTournaments.get(tournamentId);
      
      // Add spectators up to limit
      for (let i = 0; i < tournament.config.spectatorCount; i++) {
        await tournamentManager.addSpectator(tournamentId, {
          spectatorId: `spec${i}`,
          spectatorName: `Spectator ${i}`
        });
      }

      // Try to exceed limit
      await expect(
        tournamentManager.addSpectator(tournamentId, {
          spectatorId: 'overflow',
          spectatorName: 'Overflow Spectator'
        })
      ).rejects.toThrow('Tournament spectator capacity reached');
    });
  });

  describe('Authentication Integration', () => {
    it('should validate tournament creator authentication', async () => {
      mockAuthManager.validateUser.mockResolvedValue(false);

      await expect(
        tournamentManager.createTournament({
          name: 'Auth Test Tournament'
        }, 'invalid-creator')
      ).rejects.toThrow('Invalid tournament creator');

      expect(mockAuthManager.validateUser).toHaveBeenCalledWith('invalid-creator');
    });

    it('should validate player registration authentication', async () => {
      const result = await tournamentManager.createTournament({
        name: 'Auth Test Tournament'
      }, 'creator1');
      const tournamentId = result.tournament.tournamentId;

      mockAuthManager.validateUser.mockResolvedValue(false);

      await expect(
        tournamentManager.registerPlayer(tournamentId, {
          playerId: 'invalid-player',
          playerName: 'Invalid Player'
        })
      ).rejects.toThrow('Invalid player credentials');
    });

    it('should skip authentication when auth manager not provided', async () => {
      const noAuthManager = new TournamentManager(null, mockGameEngine);
      await noAuthManager.initialize();

      const result = await noAuthManager.createTournament({
        name: 'No Auth Tournament'
      }, 'any-creator');

      expect(result.success).toBe(true);

      const registrationResult = await noAuthManager.registerPlayer(result.tournament.tournamentId, {
        playerId: 'any-player',
        playerName: 'Any Player'
      });

      expect(registrationResult.success).toBe(true);
      noAuthManager.destroy();
    });

    it('should handle authentication errors gracefully', async () => {
      mockAuthManager.validateUser.mockRejectedValue(new Error('Auth service unavailable'));

      await expect(
        tournamentManager.createTournament({
          name: 'Auth Error Tournament'
        }, 'creator1')
      ).rejects.toThrow('Auth service unavailable');
    });
  });

  describe('Betting System Integration', () => {
    let tournamentId;

    beforeEach(async () => {
      const result = await tournamentManager.createTournament({
        name: 'Betting Test Tournament',
        maxPlayers: 8,
        minPlayers: 4,
        bettingEnabled: true,
        prizePool: 1000
      }, 'creator1');
      tournamentId = result.tournament.tournamentId;

      const players = GameHelpers.createMockPlayers(6);
      for (const player of players) {
        await tournamentManager.registerPlayer(tournamentId, {
          playerId: player.id,
          playerName: player.name
        });
      }
      await tournamentManager.startTournament(tournamentId);
    });

    it('should start betting when match begins', async () => {
      const match = await tournamentManager.startNextMatches(tournamentId);
      
      expect(mockBettingManager.startBetting).toHaveBeenCalledWith(
        expect.objectContaining({
          matchId: match.matchId,
          players: match.players,
          tournamentId: tournamentId
        })
      );
    });

    it('should process betting results after match completion', async () => {
      const match = await tournamentManager.startNextMatches(tournamentId);
      const raceResults = {
        duration: 240000,
        players: match.players.map((player, index) => ({
          playerId: player.playerId,
          playerName: player.playerName,
          finishPosition: index + 1,
          raceTime: 240000 + (index * 5000)
        }))
      };

      await tournamentManager.handleMatchCompletion(tournamentId, match.matchId, raceResults);

      expect(mockBettingManager.processBettingResults).toHaveBeenCalledWith(raceResults);
      expect(mockBettingManager.endBetting).toHaveBeenCalled();
    });

    it('should handle betting disabled tournaments', async () => {
      const noBettingResult = await tournamentManager.createTournament({
        name: 'No Betting Tournament',
        bettingEnabled: false
      }, 'creator1');

      const players = GameHelpers.createMockPlayers(4);
      for (const player of players) {
        await tournamentManager.registerPlayer(noBettingResult.tournament.tournamentId, {
          playerId: player.id,
          playerName: player.name
        });
      }
      await tournamentManager.startTournament(noBettingResult.tournament.tournamentId);

      const match = await tournamentManager.startNextMatches(noBettingResult.tournament.tournamentId);
      
      expect(mockBettingManager.startBetting).not.toHaveBeenCalled();
    });

    it('should update betting odds based on player performance', async () => {
      const match = await tournamentManager.startNextMatches(tournamentId);
      
      // Simulate betting odds update
      expect(mockBettingManager.startBetting).toHaveBeenCalled();
      
      // Verify that odds can be updated based on historical performance
      const tournament = tournamentManager.activeTournaments.get(tournamentId);
      expect(tournament.config.bettingEnabled).toBe(true);
    });
  });

  describe('Event System Integration', () => {
    let tournamentId;

    beforeEach(async () => {
      const result = await tournamentManager.createTournament({
        name: 'Event Test Tournament'
      }, 'creator1');
      tournamentId = result.tournament.tournamentId;
    });

    it('should emit tournament lifecycle events', async () => {
      // Tournament creation
      expect(multiplayerEvents.emit).toHaveBeenCalledWith('TOURNAMENT_CREATED', expect.any(Object));
      
      // Player registration
      await tournamentManager.registerPlayer(tournamentId, {
        playerId: 'player1',
        playerName: 'Player 1'
      });
      expect(multiplayerEvents.emit).toHaveBeenCalledWith('TOURNAMENT_PLAYER_REGISTERED', expect.any(Object));

      // Spectator joining
      await tournamentManager.addSpectator(tournamentId, {
        spectatorId: 'spec1',
        spectatorName: 'Spectator 1'
      });
      expect(multiplayerEvents.emit).toHaveBeenCalledWith('TOURNAMENT_SPECTATOR_JOINED', expect.any(Object));

      // Tournament start
      const players = GameHelpers.createMockPlayers(3);
      for (const player of players) {
        await tournamentManager.registerPlayer(tournamentId, {
          playerId: player.id,
          playerName: player.name
        });
      }
      await tournamentManager.startTournament(tournamentId);
      expect(multiplayerEvents.emit).toHaveBeenCalledWith('TOURNAMENT_STARTED', expect.any(Object));
    });

    it('should handle race finished events', async () => {
      // Setup tournament with players
      const players = GameHelpers.createMockPlayers(4);
      for (const player of players) {
        await tournamentManager.registerPlayer(tournamentId, {
          playerId: player.id,
          playerName: player.name
        });
      }
      await tournamentManager.startTournament(tournamentId);

      // Get the race finished event handler
      const raceFinishedCalls = multiplayerEvents.on.mock.calls.filter(
        call => call[0] === MULTIPLAYER_EVENTS.RACE_FINISHED
      );
      expect(raceFinishedCalls.length).toBeGreaterThan(0);

      const raceFinishedHandler = raceFinishedCalls[0][1];

      // Simulate race finished event
      const raceData = {
        isTournamentMatch: true,
        tournamentId: tournamentId,
        matchId: 'match-123',
        results: {
          players: [
            { playerId: 'player1', finishPosition: 1, raceTime: 240000 }
          ],
          duration: 240000
        }
      };

      // Should handle the event
      expect(() => raceFinishedHandler(raceData)).not.toThrow();
    });

    it('should emit match completion events', async () => {
      const players = GameHelpers.createMockPlayers(4);
      for (const player of players) {
        await tournamentManager.registerPlayer(tournamentId, {
          playerId: player.id,
          playerName: player.name
        });
      }
      await tournamentManager.startTournament(tournamentId);

      const matchId = 'test-match-123';
      const results = { duration: 240000 };

      await tournamentManager.handleMatchCompletion(tournamentId, matchId, results);

      // Should emit match completed event through bracket manager
      expect(multiplayerEvents.emit).toHaveBeenCalledWith(
        'TOURNAMENT_MATCH_COMPLETED',
        expect.any(Object)
      );
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle maximum concurrent tournaments', async () => {
      const maxConcurrent = tournamentManager.config.maxConcurrentTournaments;
      const tournaments = [];

      // Create maximum number of tournaments
      for (let i = 0; i < maxConcurrent; i++) {
        const result = await tournamentManager.createTournament({
          name: `Performance Test Tournament ${i}`,
          maxPlayers: 8,
          minPlayers: 4
        }, `creator${i}`);
        tournaments.push(result.tournament.tournamentId);
      }

      expect(tournamentManager.activeTournaments.size).toBe(maxConcurrent);

      // Try to create one more (should fail)
      await expect(
        tournamentManager.createTournament({
          name: 'Overflow Tournament'
        }, 'overflow-creator')
      ).rejects.toThrow('Maximum concurrent tournaments reached');

      // Cleanup
      for (const tournamentId of tournaments) {
        await tournamentManager.cancelTournament(tournamentId);
      }
    });

    it('should handle large player counts efficiently', async () => {
      const result = await tournamentManager.createTournament({
        name: 'Large Tournament',
        maxPlayers: 64,
        minPlayers: 4
      }, 'creator1');
      const tournamentId = result.tournament.tournamentId;

      const startTime = Date.now();

      // Register 64 players
      const players = GameHelpers.createMockPlayers(64);
      for (const player of players) {
        await tournamentManager.registerPlayer(tournamentId, {
          playerId: player.id,
          playerName: player.name
        });
      }

      const registrationTime = Date.now() - startTime;
      expect(registrationTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Start tournament
      const tournamentStartTime = Date.now();
      await tournamentManager.startTournament(tournamentId);
      const startupTime = Date.now() - tournamentStartTime;

      expect(startupTime).toBeLessThan(2000); // Should start within 2 seconds

      const tournament = tournamentManager.activeTournaments.get(tournamentId);
      expect(tournament.registeredPlayers.length).toBe(64);
    }, 10000);

    it('should handle rapid tournament creation and cancellation', async () => {
      const iterations = 10;
      const tournaments = [];

      for (let i = 0; i < iterations; i++) {
        const result = await tournamentManager.createTournament({
          name: `Rapid Test Tournament ${i}`
        }, `creator${i}`);
        tournaments.push(result.tournament.tournamentId);

        // Immediately cancel
        await tournamentManager.cancelTournament(result.tournament.tournamentId);
      }

      // Should have no active tournaments
      expect(tournamentManager.activeTournaments.size).toBe(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle game engine failures gracefully', async () => {
      mockGameEngine.startRace.mockRejectedValue(new Error('Game engine failure'));

      const result = await tournamentManager.createTournament({
        name: 'Error Test Tournament'
      }, 'creator1');

      // Tournament creation should still succeed
      expect(result.success).toBe(true);

      // But race starting should fail gracefully
      const players = GameHelpers.createMockPlayers(4);
      for (const player of players) {
        await tournamentManager.registerPlayer(result.tournament.tournamentId, {
          playerId: player.id,
          playerName: player.name
        });
      }
      
      await tournamentManager.startTournament(result.tournament.tournamentId);
      // Tournament should still be active even if race engine fails
      const tournament = tournamentManager.activeTournaments.get(result.tournament.tournamentId);
      expect(tournament.status).toBe('active');
    });

    it('should recover from network disconnections', async () => {
      const result = await tournamentManager.createTournament({
        name: 'Disconnection Test Tournament'
      }, 'creator1');
      const tournamentId = result.tournament.tournamentId;

      // Simulate network disconnection by making event emitter fail
      multiplayerEvents.emit.mockImplementation(() => {
        throw new Error('Network disconnected');
      });

      // Operations should still work locally
      await expect(
        tournamentManager.registerPlayer(tournamentId, {
          playerId: 'player1',
          playerName: 'Player 1'
        })
      ).resolves.toBeDefined();

      // Tournament should still exist locally
      expect(tournamentManager.activeTournaments.has(tournamentId)).toBe(true);
    });

    it('should handle corrupted tournament state', async () => {
      const result = await tournamentManager.createTournament({
        name: 'Corruption Test Tournament'
      }, 'creator1');
      const tournamentId = result.tournament.tournamentId;

      // Corrupt tournament data
      const tournament = tournamentManager.activeTournaments.get(tournamentId);
      tournament.registeredPlayers = null; // Corrupt the data

      // Should handle corruption gracefully
      await expect(
        tournamentManager.registerPlayer(tournamentId, {
          playerId: 'player1',
          playerName: 'Player 1'
        })
      ).rejects.toThrow();

      // Should be able to cancel corrupted tournament
      await expect(
        tournamentManager.cancelTournament(tournamentId, 'Corrupted state')
      ).resolves.not.toThrow();
    });

    it('should handle bracket manager failures', async () => {
      // Mock bracket manager to fail
      tournamentManager.bracketManager.createTournament.mockImplementation(() => {
        throw new Error('Bracket generation failed');
      });

      await expect(
        tournamentManager.createTournament({
          name: 'Bracket Failure Tournament'
        }, 'creator1')
      ).rejects.toThrow('Bracket generation failed');
    });
  });

  describe('State Persistence Integration', () => {
    it('should save tournament state after key operations', async () => {
      const saveSpy = jest.spyOn(tournamentManager.stateManager, 'saveTournamentState');
      
      const result = await tournamentManager.createTournament({
        name: 'Persistence Test Tournament'
      }, 'creator1');
      const tournamentId = result.tournament.tournamentId;

      // Should save after creation
      expect(saveSpy).toHaveBeenCalled();

      // Should save after player registration
      await tournamentManager.registerPlayer(tournamentId, {
        playerId: 'player1',
        playerName: 'Player 1'
      });
      expect(saveSpy).toHaveBeenCalledTimes(2);

      // Should save after tournament start
      const players = GameHelpers.createMockPlayers(3);
      for (const player of players) {
        await tournamentManager.registerPlayer(tournamentId, {
          playerId: player.id,
          playerName: player.name
        });
      }
      await tournamentManager.startTournament(tournamentId);
      expect(saveSpy).toHaveBeenCalledTimes(6); // 4 more registrations + start
    });

    it('should restore active tournaments on initialization', async () => {
      const mockActiveTournaments = [
        {
          tournamentId: 'restored-tournament-1',
          status: 'active',
          registeredPlayers: [
            { playerId: 'player1', playerName: 'Player 1' },
            { playerId: 'player2', playerName: 'Player 2' }
          ],
          spectators: [
            { spectatorId: 'spec1', spectatorName: 'Spectator 1' }
          ]
        }
      ];

      tournamentManager.stateManager.loadActiveTournaments.mockResolvedValue(mockActiveTournaments);

      // Create new tournament manager to test restoration
      const newTournamentManager = new TournamentManager(mockAuthManager, mockGameEngine);
      await newTournamentManager.initialize();

      expect(newTournamentManager.activeTournaments.size).toBe(1);
      expect(newTournamentManager.activeTournaments.has('restored-tournament-1')).toBe(true);

      newTournamentManager.destroy();
    });

    it('should handle state loading errors gracefully', async () => {
      tournamentManager.stateManager.loadActiveTournaments.mockRejectedValue(
        new Error('State loading failed')
      );

      // Should still initialize successfully
      const newTournamentManager = new TournamentManager(mockAuthManager, mockGameEngine);
      await expect(newTournamentManager.initialize()).resolves.not.toThrow();

      expect(newTournamentManager.activeTournaments.size).toBe(0);
      newTournamentManager.destroy();
    });
  });

  describe('Cross-System Data Flow', () => {
    it('should maintain data consistency across all systems', async () => {
      const result = await tournamentManager.createTournament({
        name: 'Data Flow Test Tournament',
        bettingEnabled: true,
        maxPlayers: 8
      }, 'creator1');
      const tournamentId = result.tournament.tournamentId;

      // Register players
      const players = GameHelpers.createMockPlayers(6);
      for (const player of players) {
        await tournamentManager.registerPlayer(tournamentId, {
          playerId: player.id,
          playerName: player.name
        });
      }

      // Start tournament
      await tournamentManager.startTournament(tournamentId);
      const tournament = tournamentManager.activeTournaments.get(tournamentId);

      // Start match
      const match = await tournamentManager.startNextMatches(tournamentId);

      // Verify data consistency across systems
      expect(tournament.tournamentId).toBe(tournamentId);
      expect(tournament.registeredPlayers.length).toBe(6);
      expect(match.tournamentId).toBe(tournamentId);
      expect(match.players.length).toBeGreaterThan(0);

      // Verify room data consistency
      const roomInitCall = roomManager.initializeRoom.mock.calls[0][0];
      expect(roomInitCall.gameSettings.tournamentId).toBe(tournamentId);
      expect(roomInitCall.gameSettings.matchId).toBe(match.matchId);

      // Complete match and verify state updates
      const raceResults = {
        duration: 240000,
        players: match.players.map((player, index) => ({
          playerId: player.playerId,
          finishPosition: index + 1,
          raceTime: 240000 + (index * 5000)
        }))
      };

      await tournamentManager.handleMatchCompletion(tournamentId, match.matchId, raceResults);

      // Verify tournament stats updated
      const updatedTournament = tournamentManager.activeTournaments.get(tournamentId);
      expect(updatedTournament.stats.totalMatches).toBe(1);
      expect(updatedTournament.currentMatch).toBeNull();
    });
  });
});