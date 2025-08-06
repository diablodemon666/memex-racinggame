/**
 * Tournament Test Helpers
 * 
 * Specialized testing utilities for tournament system tests
 * Extends the main test helpers with tournament-specific functionality
 */

import { GameHelpers, AsyncHelpers } from './test-helpers';

/**
 * Tournament-specific test helpers
 */
export const TournamentHelpers = {
  /**
   * Create mock tournament configuration
   * @param {Object} overrides - Configuration overrides
   * @returns {Object} Tournament configuration
   */
  createMockTournamentConfig: (overrides = {}) => ({
    name: 'Test Tournament',
    format: 'single_elimination',
    maxPlayers: 16,
    minPlayers: 4,
    raceTimeLimit: 300,
    playersPerRace: 6,
    bettingEnabled: true,
    spectatorCount: 50,
    registrationTimeLimit: 600,
    prizePool: 0,
    ...overrides
  }),

  /**
   * Create mock tournament data structure
   * @param {Object} overrides - Tournament data overrides
   * @returns {Object} Tournament data
   */
  createMockTournament: (overrides = {}) => ({
    tournamentId: `tournament_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    config: TournamentHelpers.createMockTournamentConfig(),
    status: 'registration',
    creatorId: 'creator1',
    registeredPlayers: [],
    spectators: [],
    createdAt: Date.now(),
    registrationDeadline: Date.now() + 600000,
    currentMatch: null,
    bracket: [],
    totalRounds: 0,
    currentRound: 0,
    stats: {
      totalRegistrations: 0,
      totalSpectators: 0,
      totalMatches: 0,
      averageMatchDuration: 0
    },
    ...overrides
  }),

  /**
   * Create mock tournament match
   * @param {Object} overrides - Match overrides
   * @returns {Object} Tournament match
   */
  createMockMatch: (overrides = {}) => {
    const players = overrides.players || GameHelpers.createMockPlayers(4);
    return {
      matchId: `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tournamentId: 'test-tournament',
      round: 1,
      matchType: 'standard',
      bracket: 'main',
      players: players.map(player => ({
        playerId: player.id,
        playerName: player.name,
        seed: player.seed || 1,
        isEliminated: false
      })),
      status: 'pending',
      startTime: null,
      endTime: null,
      results: null,
      winner: null,
      roomCode: null,
      spectators: [],
      ...overrides
    };
  },

  /**
   * Create mock race results
   * @param {Array} players - Players in the race
   * @param {Object} overrides - Result overrides
   * @returns {Object} Race results
   */
  createMockRaceResults: (players, overrides = {}) => {
    if (!players || players.length === 0) {
      players = GameHelpers.createMockPlayers(4);
    }

    return {
      players: players.map((player, index) => ({
        playerId: typeof player === 'string' ? player : player.playerId || player.id,
        playerName: typeof player === 'string' ? `Player ${index + 1}` : player.playerName || player.name,
        finishPosition: index + 1,
        raceTime: 240000 + (index * 10000) + Math.random() * 5000,
        finished: true
      })),
      raceDuration: 250000,
      map: 'test-map',
      totalPlayers: players.length,
      ...overrides
    };
  },

  /**
   * Create mock bracket structure
   * @param {string} format - Tournament format
   * @param {number} playerCount - Number of players
   * @returns {Object} Bracket structure
   */
  createMockBracket: (format = 'single_elimination', playerCount = 8) => {
    switch (format) {
      case 'single_elimination':
        return {
          rounds: Array.from({ length: Math.ceil(Math.log2(playerCount)) }, (_, i) => ({
            round: i + 1,
            matches: [],
            completedMatches: 0,
            totalMatches: Math.pow(2, Math.ceil(Math.log2(playerCount)) - i - 1)
          }))
        };
      
      case 'double_elimination':
        return {
          winnersBracket: [],
          losersBracket: [],
          grandFinals: null
        };
      
      case 'round_robin':
        return {
          groups: [
            {
              groupId: 'group1',
              players: GameHelpers.createMockPlayers(Math.min(playerCount, 6)),
              standings: []
            }
          ],
          playoffs: null
        };
      
      default:
        return { rounds: [] };
    }
  },

  /**
   * Simulate tournament progression through multiple rounds
   * @param {Object} tournament - Tournament instance
   * @param {number} rounds - Number of rounds to simulate
   * @returns {Promise<Array>} Results from each round
   */
  simulateTournamentRounds: async (tournament, rounds = 1) => {
    const results = [];
    
    for (let round = 0; round < rounds; round++) {
      const nextMatch = tournament.getNextMatch ? tournament.getNextMatch() : null;
      if (!nextMatch) break;

      const startedMatch = tournament.startMatch ? tournament.startMatch(nextMatch.matchId) : nextMatch;
      const raceResults = TournamentHelpers.createMockRaceResults(startedMatch.players);
      
      const completionResult = tournament.completeMatch ? 
        tournament.completeMatch(startedMatch.matchId, raceResults) : 
        { match: startedMatch, results: raceResults };
      
      results.push(completionResult);
      
      // Small delay to simulate real tournament timing
      await AsyncHelpers.delay(10);
    }
    
    return results;
  },

  /**
   * Create complete tournament scenario with players and spectators
   * @param {Object} config - Tournament configuration
   * @param {number} playerCount - Number of players to register
   * @param {number} spectatorCount - Number of spectators to add
   * @returns {Object} Complete tournament scenario
   */
  createTournamentScenario: async (config = {}, playerCount = 8, spectatorCount = 5) => {
    const tournamentConfig = TournamentHelpers.createMockTournamentConfig(config);
    const players = GameHelpers.createMockPlayers(playerCount);
    const spectators = Array.from({ length: spectatorCount }, (_, i) => ({
      spectatorId: `spec${i}`,
      spectatorName: `Spectator ${i}`,
      joinedAt: Date.now()
    }));

    return {
      config: tournamentConfig,
      players,
      spectators,
      expectedRounds: Math.ceil(Math.log2(playerCount)),
      expectedMatches: playerCount - 1 // For single elimination
    };
  },

  /**
   * Validate tournament state consistency
   * @param {Object} tournament - Tournament object to validate
   * @returns {Object} Validation result
   */
  validateTournamentState: (tournament) => {
    const errors = [];
    const warnings = [];

    // Required fields
    if (!tournament.tournamentId) errors.push('Missing tournament ID');
    if (!tournament.config) errors.push('Missing tournament configuration');
    if (!tournament.status) errors.push('Missing tournament status');

    // Status validation
    const validStatuses = ['registration', 'active', 'completed', 'cancelled'];
    if (!validStatuses.includes(tournament.status)) {
      errors.push(`Invalid status: ${tournament.status}`);
    }

    // Player count validation
    if (tournament.registeredPlayers) {
      const playerCount = tournament.registeredPlayers.length;
      if (tournament.config?.minPlayers && playerCount < tournament.config.minPlayers) {
        warnings.push(`Player count ${playerCount} below minimum ${tournament.config.minPlayers}`);
      }
      if (tournament.config?.maxPlayers && playerCount > tournament.config.maxPlayers) {
        errors.push(`Player count ${playerCount} exceeds maximum ${tournament.config.maxPlayers}`);
      }
    }

    // Statistics validation
    if (tournament.stats) {
      if (tournament.stats.totalMatches < 0) errors.push('Negative total matches');
      if (tournament.stats.totalRegistrations < 0) errors.push('Negative total registrations');
      if (tournament.stats.averageMatchDuration < 0) errors.push('Negative average match duration');
    }

    // Timeline validation
    if (tournament.createdAt && tournament.registrationDeadline) {
      if (tournament.registrationDeadline <= tournament.createdAt) {
        errors.push('Registration deadline before creation time');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      playerCount: tournament.registeredPlayers?.length || 0,
      spectatorCount: tournament.spectators?.length || 0
    };
  },

  /**
   * Generate test data for different tournament formats
   * @param {string} format - Tournament format
   * @param {number} playerCount - Number of players
   * @returns {Object} Format-specific test data
   */
  generateFormatTestData: (format, playerCount) => {
    const baseData = {
      format,
      players: GameHelpers.createMockPlayers(playerCount),
      expectedComplexity: 'moderate'
    };

    switch (format) {
      case 'single_elimination':
        return {
          ...baseData,
          expectedRounds: Math.ceil(Math.log2(playerCount)),
          expectedMatches: playerCount - 1,
          expectedComplexity: 'simple',
          features: ['Fast elimination', 'Single bracket', 'One loss elimination']
        };

      case 'double_elimination':
        return {
          ...baseData,
          expectedRounds: Math.ceil(Math.log2(playerCount)) * 2 + 1,
          expectedMatches: (playerCount - 1) * 2,
          expectedComplexity: 'moderate',
          features: ['Winners bracket', 'Losers bracket', 'Grand finals', 'Second chance']
        };

      case 'round_robin':
        const groupSize = Math.min(6, playerCount);
        const groups = Math.ceil(playerCount / groupSize);
        return {
          ...baseData,
          expectedRounds: groupSize - 1 + Math.ceil(Math.log2(groups)),
          expectedMatches: (groupSize * (groupSize - 1)) / 2 * groups + groups - 1,
          expectedComplexity: 'complex',
          features: ['Group stage', 'All play all', 'Point scoring', 'Playoffs']
        };

      default:
        return baseData;
    }
  },

  /**
   * Create mock authentication manager for tournament tests
   * @param {Object} options - Authentication options
   * @returns {Object} Mock auth manager
   */
  createMockAuthManager: (options = {}) => ({
    validateUser: jest.fn().mockResolvedValue(options.validUsers !== false),
    getCurrentUser: jest.fn().mockReturnValue({
      userId: options.userId || 'test-user',
      username: options.username || 'testuser',
      isAuthenticated: options.isAuthenticated !== false
    }),
    hasPermission: jest.fn().mockReturnValue(options.hasPermissions !== false),
    getUserStats: jest.fn().mockReturnValue({
      wins: options.wins || 10,
      losses: options.losses || 5,
      totalRaces: options.totalRaces || 15,
      winRate: options.winRate || 66.67
    }),
    isAdmin: jest.fn().mockReturnValue(options.isAdmin || false)
  }),

  /**
   * Create mock room manager for tournament tests
   * @param {Object} options - Room manager options
   * @returns {Object} Mock room manager
   */
  createMockRoomManager: (options = {}) => ({
    initializeRoom: jest.fn().mockResolvedValue({
      roomCode: options.roomCode || 'TOURN_123',
      success: options.roomCreationSuccess !== false
    }),
    addPlayer: jest.fn().mockResolvedValue({
      success: options.playerAddSuccess !== false
    }),
    removePlayer: jest.fn(),
    getRoom: jest.fn().mockReturnValue({
      roomCode: options.roomCode || 'TOURN_123',
      players: options.players || [],
      maxPlayers: options.maxPlayers || 6,
      settings: options.settings || {}
    }),
    updateRoomSettings: jest.fn(),
    destroyRoom: jest.fn(),
    broadcastToRoom: jest.fn()
  }),

  /**
   * Create performance benchmark for tournament operations
   * @param {Function} operation - Operation to benchmark
   * @param {number} iterations - Number of iterations
   * @returns {Promise<Object>} Performance results
   */
  benchmarkTournamentOperation: async (operation, iterations = 100) => {
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      await operation();
      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    return {
      iterations,
      totalTime: times.reduce((sum, time) => sum + time, 0),
      averageTime: times.reduce((sum, time) => sum + time, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      medianTime: times.sort((a, b) => a - b)[Math.floor(times.length / 2)]
    };
  }
};

/**
 * Tournament test scenarios for comprehensive testing
 */
export const TournamentScenarios = {
  /**
   * Small tournament scenario (4 players)
   */
  small: {
    playerCount: 4,
    spectatorCount: 2,
    format: 'single_elimination',
    expectedDuration: 600000, // 10 minutes
    config: {
      name: 'Small Tournament',
      maxPlayers: 8,
      minPlayers: 4,
      raceTimeLimit: 300
    }
  },

  /**
   * Medium tournament scenario (16 players)
   */
  medium: {
    playerCount: 16,
    spectatorCount: 10,
    format: 'single_elimination',
    expectedDuration: 1800000, // 30 minutes
    config: {
      name: 'Medium Tournament',
      maxPlayers: 16,
      minPlayers: 8,
      raceTimeLimit: 300,
      bettingEnabled: true
    }
  },

  /**
   * Large tournament scenario (64 players)
   */
  large: {
    playerCount: 64,
    spectatorCount: 50,
    format: 'single_elimination',
    expectedDuration: 7200000, // 2 hours
    config: {
      name: 'Large Tournament',
      maxPlayers: 64,
      minPlayers: 32,
      raceTimeLimit: 300,
      bettingEnabled: true,
      prizePool: 10000
    }
  },

  /**
   * Double elimination tournament scenario
   */
  doubleElimination: {
    playerCount: 8,
    spectatorCount: 5,
    format: 'double_elimination',
    expectedDuration: 2400000, // 40 minutes
    config: {
      name: 'Double Elimination Tournament',
      format: 'double_elimination',
      maxPlayers: 16,
      minPlayers: 4,
      raceTimeLimit: 300
    }
  },

  /**
   * Round robin tournament scenario
   */
  roundRobin: {
    playerCount: 12,
    spectatorCount: 8,
    format: 'round_robin',
    expectedDuration: 3600000, // 1 hour
    config: {
      name: 'Round Robin Tournament',
      format: 'round_robin',
      maxPlayers: 12,
      minPlayers: 6,
      raceTimeLimit: 300,
      playersPerRace: 6
    }
  }
};

// Default export
export default {
  TournamentHelpers,
  TournamentScenarios
};