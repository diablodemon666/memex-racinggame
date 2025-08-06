/**
 * Jest Setup File - After Environment Setup
 * 
 * This file runs after the test environment is set up and provides
 * comprehensive testing utilities and global configurations for the
 * Memex Racing Game test suite.
 */

// Import the main test environment setup
const { setupTestEnvironment } = require('./test-environment');

// Additional test utilities and matchers
require('./custom-matchers');

/**
 * Initialize the test environment
 */
beforeAll(() => {
  // Setup the comprehensive test environment
  global.testMocks = setupTestEnvironment();
  
  // Add global test utilities
  global.testUtils = setupGlobalTestUtils();
  
  // Configure console behavior for tests
  setupTestLogging();
  
  // Configure test timeouts based on test type
  setupTestTimeouts();
});

/**
 * Setup global test utilities
 */
function setupGlobalTestUtils() {
  return {
    // DOM utilities
    dom: {
      /**
       * Create a mock DOM element with specified attributes
       */
      createElement: (tag, attributes = {}) => {
        const element = document.createElement(tag);
        Object.entries(attributes).forEach(([key, value]) => {
          if (key === 'className') {
            element.className = value;
          } else if (key === 'innerHTML') {
            element.innerHTML = value;
          } else {
            element.setAttribute(key, value);
          }
        });
        return element;
      },

      /**
       * Wait for DOM mutations to complete
       */
      waitForMutations: () => {
        return new Promise(resolve => {
          const observer = new MutationObserver(() => {
            observer.disconnect();
            resolve();
          });
          observer.observe(document.body, { childList: true, subtree: true });
          setTimeout(resolve, 0);
        });
      },

      /**
       * Simulate user interaction events
       */
      simulateEvent: (element, eventType, options = {}) => {
        const event = new Event(eventType, { bubbles: true, ...options });
        element.dispatchEvent(event);
      },

      /**
       * Query for elements with test data attributes
       */
      getByTestId: (testId) => document.querySelector(`[data-testid="${testId}"]`),
      getAllByTestId: (testId) => document.querySelectorAll(`[data-testid="${testId}"]`)
    },

    // Game-specific utilities
    game: {
      /**
       * Create a mock Phaser game instance
       */
      createMockGame: (config = {}) => ({
        config: { width: 800, height: 600, ...config },
        scene: {
          add: jest.fn(),
          remove: jest.fn(),
          start: jest.fn(),
          stop: jest.fn(),
          get: jest.fn()
        },
        sound: {
          add: jest.fn(() => ({
            play: jest.fn(),
            stop: jest.fn(),
            setVolume: jest.fn()
          })),
          play: jest.fn(),
          stop: jest.fn()
        },
        tweens: {
          add: jest.fn(() => ({
            remove: jest.fn(),
            stop: jest.fn(),
            destroy: jest.fn(),
            onComplete: jest.fn()
          }))
        },
        time: {
          addEvent: jest.fn(() => ({
            remove: jest.fn(),
            destroy: jest.fn()
          }))
        },
        destroy: jest.fn()
      }),

      /**
       * Create a mock Phaser scene
       */
      createMockScene: (gameInstance) => ({
        add: {
          sprite: jest.fn(() => ({
            setOrigin: jest.fn().mockReturnThis(),
            setPosition: jest.fn().mockReturnThis(),
            setScale: jest.fn().mockReturnThis()
          })),
          image: jest.fn(() => ({
            setOrigin: jest.fn().mockReturnThis(),
            setPosition: jest.fn().mockReturnThis(),
            setScale: jest.fn().mockReturnThis()
          })),
          text: jest.fn(() => ({
            setOrigin: jest.fn().mockReturnThis(),
            setPosition: jest.fn().mockReturnThis(),
            setStyle: jest.fn().mockReturnThis()
          }))
        },
        physics: {
          add: {
            sprite: jest.fn(() => ({
              setOrigin: jest.fn().mockReturnThis(),
              setPosition: jest.fn().mockReturnThis(),
              setVelocity: jest.fn().mockReturnThis(),
              body: { velocity: { x: 0, y: 0 } }
            }))
          }
        },
        tweens: gameInstance?.tweens || global.testMocks.phaser.mockPhaserGame.tweens,
        time: gameInstance?.time || global.testMocks.phaser.mockPhaserGame.time,
        game: gameInstance || global.testMocks.phaser.mockPhaserGame
      }),

      /**
       * Create mock player data
       */
      createMockPlayer: (overrides = {}) => ({
        id: 'player-1',
        name: 'Test Player',
        username: 'testplayer',
        wins: 5,
        losses: 3,
        winRate: 62.5,
        avatar: null,
        ...overrides
      }),

      /**
       * Create mock game state
       */
      createMockGameState: (overrides = {}) => ({
        phase: 'menu',
        players: [],
        currentUser: null,
        roomCode: null,
        raceResults: [],
        timeRemaining: 30,
        ...overrides
      })
    },

    // Async utilities
    async: {
      /**
       * Wait for a specified amount of time
       */
      wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

      /**
       * Wait for a condition to be true
       */
      waitFor: async (condition, timeout = 5000, interval = 100) => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
          if (await condition()) {
            return true;
          }
          await new Promise(resolve => setTimeout(resolve, interval));
        }
        throw new Error(`Condition not met within ${timeout}ms`);
      },

      /**
       * Wait for a promise to resolve or reject
       */
      waitForPromise: (promise, timeout = 5000) => {
        return Promise.race([
          promise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Promise timeout after ${timeout}ms`)), timeout)
          )
        ]);
      }
    },

    // Mock utilities
    mocks: {
      /**
       * Create a mock multiplayer manager
       */
      createMockMultiplayerManager: () => ({
        isConnected: false,
        roomCode: null,
        players: [],
        connect: jest.fn().mockResolvedValue(true),
        disconnect: jest.fn(),
        joinRoom: jest.fn().mockResolvedValue(true),
        leaveRoom: jest.fn(),
        sendMessage: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn()
      }),

      /**
       * Create a mock Socket.IO socket
       */
      createMockSocket: () => ({
        connected: false,
        id: 'test-socket-id',
        emit: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        once: jest.fn(),
        connect: jest.fn(),
        disconnect: jest.fn()
      }),

      /**
       * Create a mock betting system
       */
      createMockBettingSystem: () => ({
        isActive: false,
        timeRemaining: 30,
        currentBet: null,
        userBalance: 1000,
        placeBet: jest.fn(),
        clearBet: jest.fn(),
        calculateOdds: jest.fn(),
        processResults: jest.fn()
      }),

      /**
       * Create a mock AnimationManager
       */
      createMockAnimationManager: () => ({
        animate: jest.fn().mockResolvedValue(undefined),
        animatePreset: jest.fn().mockResolvedValue(undefined),
        chain: jest.fn().mockResolvedValue(undefined),
        parallel: jest.fn().mockResolvedValue(undefined),
        stagger: jest.fn().mockResolvedValue(undefined),
        stopAnimation: jest.fn(),
        stopAllAnimations: jest.fn(),
        destroy: jest.fn(),
        getStats: jest.fn().mockReturnValue({
          activeAnimations: 0,
          completedAnimations: 0,
          isRunning: false,
          targetFPS: 60
        })
      })
    }
  };
}

/**
 * Setup test logging configuration
 */
function setupTestLogging() {
  if (process.env.TEST_DEBUG !== 'true') {
    // Suppress console.log during tests unless explicitly enabled
    jest.spyOn(console, 'log').mockImplementation(() => {});
  }
  
  // Always capture console.error for analysis
  const originalError = console.error;
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    // Store errors for later analysis
    if (!global.testErrors) global.testErrors = [];
    global.testErrors.push(args.join(' '));
    
    if (process.env.TEST_DEBUG === 'true') {
      originalError(...args);
    }
  });
}

/**
 * Setup test timeouts based on test type
 */
function setupTestTimeouts() {
  // Extend timeout for integration tests
  if (expect.getState().testPath?.includes('integration')) {
    jest.setTimeout(60000);
  }
  
  // Normal timeout for unit tests (already set in Jest config)
}

/**
 * Cleanup after each test
 */
afterEach(() => {
  // Clear all timers
  jest.clearAllTimers();
  
  // Reset all mocks
  jest.clearAllMocks();
  
  // Clean up DOM
  document.body.innerHTML = '';
  
  // Clear any global test state
  if (global.testErrors) {
    global.testErrors = [];
  }
  
  // Reset localStorage
  if (global.localStorage) {
    global.localStorage.clear();
  }
  
  // Reset any global game state
  if (global.testGameState) {
    global.testGameState = null;
  }
});

/**
 * Global cleanup after all tests
 */
afterAll(() => {
  // Restore all mocks
  jest.restoreAllMocks();
  
  // Clean up any global resources
  if (global.testMocks) {
    global.testMocks = null;
  }
  
  if (global.testUtils) {
    global.testUtils = null;
  }
});