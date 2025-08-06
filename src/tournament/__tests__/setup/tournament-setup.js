/**
 * Tournament Test Setup
 * 
 * Global setup and configuration for tournament system tests
 * Includes mocks, utilities, and test environment configuration
 */

// Extend Jest matchers with tournament-specific assertions
expect.extend({
  /**
   * Check if a tournament has valid structure
   */
  toBeValidTournament(received) {
    const pass = received &&
      typeof received.tournamentId === 'string' &&
      typeof received.status === 'string' &&
      received.config &&
      Array.isArray(received.registeredPlayers) &&
      Array.isArray(received.spectators);

    if (pass) {
      return {
        message: () => `Expected ${received} not to be a valid tournament`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected ${received} to be a valid tournament`,
        pass: false
      };
    }
  },

  /**
   * Check if a match has valid structure
   */
  toBeValidMatch(received) {
    const pass = received &&
      typeof received.matchId === 'string' &&
      typeof received.round === 'number' &&
      Array.isArray(received.players) &&
      received.players.length > 0 &&
      ['pending', 'active', 'completed'].includes(received.status);

    if (pass) {
      return {
        message: () => `Expected ${received} not to be a valid match`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected ${received} to be a valid match`,
        pass: false
      };
    }
  },

  /**
   * Check if tournament bracket is properly structured
   */
  toHaveValidBracket(received) {
    const pass = received &&
      (received.bracket || received.rounds || received.groups) &&
      typeof received.totalRounds === 'number' &&
      received.totalRounds > 0;

    if (pass) {
      return {
        message: () => `Expected ${received} not to have valid bracket`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected ${received} to have valid bracket`,
        pass: false
      };
    }
  },

  /**
   * Check if player count is within tournament limits
   */
  toHaveValidPlayerCount(received, min, max) {
    const playerCount = received.registeredPlayers ? received.registeredPlayers.length : 0;
    const pass = playerCount >= min && playerCount <= max;

    if (pass) {
      return {
        message: () => `Expected ${playerCount} not to be between ${min} and ${max}`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected ${playerCount} to be between ${min} and ${max}`,
        pass: false
      };
    }
  },

  /**
   * Check if tournament format is supported
   */
  toHaveSupportedFormat(received) {
    const supportedFormats = ['single_elimination', 'double_elimination', 'round_robin'];
    const format = received.config ? received.config.format : received.format;
    const pass = supportedFormats.includes(format);

    if (pass) {
      return {
        message: () => `Expected ${format} not to be a supported format`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected ${format} to be a supported format`,
        pass: false
      };
    }
  },

  /**
   * Check if tournament statistics are reasonable
   */
  toHaveReasonableStats(received) {
    const stats = received.stats || received;
    const pass = stats &&
      typeof stats.totalMatches === 'number' && stats.totalMatches >= 0 &&
      typeof stats.totalRegistrations === 'number' && stats.totalRegistrations >= 0 &&
      typeof stats.averageMatchDuration === 'number' && stats.averageMatchDuration >= 0;

    if (pass) {
      return {
        message: () => `Expected ${JSON.stringify(stats)} not to have reasonable stats`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected ${JSON.stringify(stats)} to have reasonable stats`,
        pass: false
      };
    }
  }
});

// Global tournament test configuration
global.TOURNAMENT_TEST_CONFIG = {
  DEFAULT_TIMEOUT: 30000,
  MAX_PLAYERS: 64,
  MIN_PLAYERS: 4,
  SUPPORTED_FORMATS: ['single_elimination', 'double_elimination', 'round_robin'],
  DEFAULT_RACE_TIME: 300,
  MAX_SPECTATORS: 100
};

// Tournament test utilities available globally
global.TournamentTestUtils = {
  /**
   * Wait for tournament state change
   */
  waitForTournamentState: async (tournament, expectedState, timeout = 5000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (tournament.status === expectedState) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Tournament did not reach state ${expectedState} within ${timeout}ms`);
  },

  /**
   * Simulate tournament time progression
   */
  advanceTournamentTime: (tournament, milliseconds) => {
    if (tournament.registrationDeadline) {
      tournament.registrationDeadline -= milliseconds;
    }
    if (tournament.createdAt) {
      tournament.createdAt -= milliseconds;
    }
  },

  /**
   * Generate deterministic test data
   */
  generateTestData: (type, count = 1, seed = 12345) => {
    // Simple seeded random for consistent test data
    let random = seed;
    const next = () => {
      random = (random * 9301 + 49297) % 233280;
      return random / 233280;
    };

    switch (type) {
      case 'players':
        return Array.from({ length: count }, (_, i) => ({
          id: `test-player-${i + 1}`,
          name: `Test Player ${i + 1}`,
          username: `testplayer${i + 1}`,
          seed: Math.floor(next() * 1000),
          wins: Math.floor(next() * 50),
          losses: Math.floor(next() * 30),
          totalRaces: Math.floor(next() * 100)
        }));

      case 'spectators':
        return Array.from({ length: count }, (_, i) => ({
          spectatorId: `test-spectator-${i + 1}`,
          spectatorName: `Test Spectator ${i + 1}`,
          joinedAt: Date.now() - Math.floor(next() * 300000)
        }));

      case 'raceResults':
        return {
          duration: 240000 + Math.floor(next() * 60000),
          map: ['classic', 'speed', 'serpentine'][Math.floor(next() * 3)],
          players: Array.from({ length: count }, (_, i) => ({
            playerId: `test-player-${i + 1}`,
            playerName: `Test Player ${i + 1}`,
            finishPosition: i + 1,
            raceTime: 240000 + (i * 10000) + Math.floor(next() * 20000),
            finished: true
          }))
        };

      default:
        return [];
    }
  },

  /**
   * Create isolated test environment
   */
  createTestEnvironment: () => {
    const cleanup = [];
    
    return {
      cleanup: () => {
        cleanup.forEach(fn => fn());
        cleanup.length = 0;
      },
      addCleanup: (fn) => {
        cleanup.push(fn);
      }
    };
  }
};

// Global error handler for tournament tests
const originalError = console.error;
console.error = (...args) => {
  // Filter out expected test errors
  const message = args[0];
  if (typeof message === 'string') {
    const expectedErrors = [
      'Tournament not found',
      'Player already registered',
      'Maximum concurrent tournaments reached',
      'Tournament registration is closed'
    ];
    
    if (expectedErrors.some(error => message.includes(error))) {
      // Don't log expected test errors
      return;
    }
  }
  
  originalError.apply(console, args);
};

// Memory leak detection for tournament tests
let tournamentInstanceCount = 0;
const originalTournamentManager = global.TournamentManager;

if (originalTournamentManager) {
  global.TournamentManager = function(...args) {
    tournamentInstanceCount++;
    const instance = new originalTournamentManager(...args);
    
    // Override destroy to track cleanup
    const originalDestroy = instance.destroy;
    instance.destroy = function() {
      tournamentInstanceCount--;
      return originalDestroy.call(this);
    };
    
    return instance;
  };
}

// Cleanup after all tests
afterAll(() => {
  if (tournamentInstanceCount > 0) {
    console.warn(`${tournamentInstanceCount} tournament instances not properly cleaned up`);
  }
});

// Performance monitoring for tournament tests
global.TournamentPerformanceMonitor = {
  measurements: new Map(),
  
  start: (label) => {
    global.TournamentPerformanceMonitor.measurements.set(label, performance.now());
  },
  
  end: (label) => {
    const start = global.TournamentPerformanceMonitor.measurements.get(label);
    if (start) {
      const duration = performance.now() - start;
      global.TournamentPerformanceMonitor.measurements.delete(label);
      return duration;
    }
    return 0;
  },
  
  getReport: () => {
    const active = Array.from(global.TournamentPerformanceMonitor.measurements.keys());
    return {
      activeMeasurements: active,
      potentialMemoryLeaks: active.length > 0
    };
  }
};

// Tournament test database (in-memory for tests)
global.TournamentTestDB = {
  tournaments: new Map(),
  players: new Map(),
  matches: new Map(),
  
  clear: () => {
    global.TournamentTestDB.tournaments.clear();
    global.TournamentTestDB.players.clear();
    global.TournamentTestDB.matches.clear();
  },
  
  addTournament: (tournament) => {
    global.TournamentTestDB.tournaments.set(tournament.tournamentId, tournament);
  },
  
  getTournament: (tournamentId) => {
    return global.TournamentTestDB.tournaments.get(tournamentId);
  },
  
  addMatch: (match) => {
    global.TournamentTestDB.matches.set(match.matchId, match);
  },
  
  getMatch: (matchId) => {
    return global.TournamentTestDB.matches.get(matchId);
  }
};

// Clear test database before each test
beforeEach(() => {
  global.TournamentTestDB.clear();
});

console.log('Tournament test environment initialized');
console.log(`Tournament test configuration:`, global.TOURNAMENT_TEST_CONFIG);