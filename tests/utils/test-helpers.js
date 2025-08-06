/**
 * Test Helpers and Utilities
 * 
 * Comprehensive collection of testing utilities for the Memex Racing Game
 * Includes DOM manipulation, async testing, mock creation, and game-specific helpers
 */

/**
 * DOM Testing Helpers
 */
export const DOMHelpers = {
  /**
   * Setup a clean DOM environment for testing
   */
  setupCleanDOM: () => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    
    // Add basic meta tags that components might expect
    const viewport = document.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1';
    document.head.appendChild(viewport);
  },

  /**
   * Create a container element for testing UI components
   */
  createTestContainer: (id = 'test-container') => {
    const container = document.createElement('div');
    container.id = id;
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
    return container;
  },

  /**
   * Create the standard UI overlay structure expected by components
   */
  createUIOverlay: () => {
    const overlay = document.createElement('div');
    overlay.id = 'ui-overlay';
    overlay.className = 'ui-overlay';
    
    // Create standard panels that components expect to exist
    const panels = [
      'player-info-panel',
      'betting-panel', 
      'leaderboard-panel',
      'map-selection-panel',
      'debug-panel',
      'invite-modal',
      'asset-browser-panel',
      'preset-manager-panel',
      'preview-panel',
      'track-editor-panel'
    ];
    
    panels.forEach(panelId => {
      const panel = document.createElement('div');
      panel.id = panelId;
      panel.className = `ui-panel ${panelId.replace('-panel', '').replace('-modal', '')} hidden`;
      overlay.appendChild(panel);
    });
    
    document.body.appendChild(overlay);
    return overlay;
  },

  /**
   * Simulate user click on element
   */
  simulateClick: (element) => {
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    element.dispatchEvent(event);
  },

  /**
   * Simulate keyboard input
   */
  simulateKeyboard: (element, key, type = 'keydown') => {
    const event = new KeyboardEvent(type, {
      key,
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(event);
  },

  /**
   * Simulate form input change
   */
  simulateInput: (element, value) => {
    element.value = value;
    const event = new Event('input', { bubbles: true });
    element.dispatchEvent(event);
  },

  /**
   * Wait for DOM updates to complete
   */
  waitForDOM: () => {
    return new Promise(resolve => {
      setTimeout(resolve, 0);
    });
  },

  /**
   * Find element by test ID
   */
  findByTestId: (testId, container = document) => {
    return container.querySelector(`[data-testid="${testId}"]`);
  },

  /**
   * Find all elements by test ID
   */
  findAllByTestId: (testId, container = document) => {
    return Array.from(container.querySelectorAll(`[data-testid="${testId}"]`));
  }
};

/**
 * Async Testing Helpers
 */
export const AsyncHelpers = {
  /**
   * Wait for condition to be true with timeout
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
   * Wait for element to appear in DOM
   */
  waitForElement: async (selector, timeout = 5000) => {
    return AsyncHelpers.waitFor(
      () => document.querySelector(selector),
      timeout
    );
  },

  /**
   * Wait for element to be visible
   */
  waitForElementVisible: async (selector, timeout = 5000) => {
    return AsyncHelpers.waitFor(
      () => {
        const element = document.querySelector(selector);
        return element && element.offsetHeight > 0 && element.offsetWidth > 0;
      },
      timeout
    );
  },

  /**
   * Wait for async function to complete
   */
  waitForAsync: async (asyncFn, timeout = 5000) => {
    return Promise.race([
      asyncFn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Async function timeout after ${timeout}ms`)), timeout)
      )
    ]);
  },

  /**
   * Delay execution for specified time
   */
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Run function with fake timers
   */
  withFakeTimers: async (fn) => {
    jest.useFakeTimers();
    try {
      const result = await fn();
      jest.runAllTimers();
      return result;
    } finally {
      jest.useRealTimers();
    }
  }
};

/**
 * Game-Specific Test Helpers
 */
export const GameHelpers = {
  /**
   * Create a comprehensive mock game instance
   */
  createMockGame: (config = {}) => {
    const defaultConfig = {
      width: 800,
      height: 600,
      backgroundColor: '#000000',
      ...config
    };

    return {
      config: defaultConfig,
      scene: {
        add: jest.fn(),
        remove: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        get: jest.fn(),
        scenes: []
      },
      sound: {
        add: jest.fn(() => ({
          play: jest.fn(),
          stop: jest.fn(),
          pause: jest.fn(),
          resume: jest.fn(),
          setVolume: jest.fn(),
          destroy: jest.fn()
        })),
        play: jest.fn(),
        stop: jest.fn(),
        pauseAll: jest.fn(),
        resumeAll: jest.fn()
      },
      tweens: {
        add: jest.fn(() => ({
          remove: jest.fn(),
          stop: jest.fn(),
          destroy: jest.fn(),
          onComplete: jest.fn()
        })),
        killAll: jest.fn()
      },
      time: {
        addEvent: jest.fn(() => ({
          remove: jest.fn(),
          destroy: jest.fn(),
          paused: false
        })),
        removeAllEvents: jest.fn(),
        now: Date.now()
      },
      canvas: {
        width: defaultConfig.width,
        height: defaultConfig.height
      },
      destroy: jest.fn(),
      isBooted: true,
      isRunning: true
    };
  },

  /**
   * Create mock player data with realistic stats
   */
  createMockPlayer: (overrides = {}) => ({
    id: `player-${Math.random().toString(36).substr(2, 9)}`,
    name: `Player ${Math.floor(Math.random() * 100)}`,
    username: `user${Math.floor(Math.random() * 1000)}`,
    wins: Math.floor(Math.random() * 20),
    losses: Math.floor(Math.random() * 15),
    winRate: Math.floor(Math.random() * 100),
    totalRaces: Math.floor(Math.random() * 50),
    avatar: null,
    isReady: false,
    isConnected: true,
    joinedAt: Date.now(),
    ...overrides
  }),

  /**
   * Create multiple mock players
   */
  createMockPlayers: (count = 4) => {
    return Array.from({ length: count }, (_, index) => 
      GameHelpers.createMockPlayer({ 
        name: `Player ${index + 1}`,
        id: `player-${index + 1}`
      })
    );
  },

  /**
   * Create mock game state for different phases
   */
  createMockGameState: (phase = 'menu', overrides = {}) => {
    const baseState = {
      phase,
      players: [],
      currentUser: null,
      roomCode: null,
      raceResults: [],
      timeRemaining: phase === 'betting' ? 30 : 0,
      isMultiplayer: false,
      settings: {
        raceTime: 300, // 5 minutes
        bettingTime: 30,
        maxPlayers: 6
      }
    };

    // Add phase-specific data
    switch (phase) {
      case 'lobby':
        baseState.players = GameHelpers.createMockPlayers(2);
        baseState.currentUser = baseState.players[0];
        baseState.roomCode = 'TEST123';
        break;
      case 'betting':
        baseState.players = GameHelpers.createMockPlayers(4);
        baseState.currentUser = null; // Spectator
        baseState.timeRemaining = 30;
        break;
      case 'racing':
        baseState.players = GameHelpers.createMockPlayers(4);
        baseState.timeRemaining = 300;
        break;
      case 'finished':
        baseState.players = GameHelpers.createMockPlayers(4);
        baseState.raceResults = [
          { playerId: baseState.players[0].id, position: 1, time: 245000 },
          { playerId: baseState.players[1].id, position: 2, time: 258000 },
          { playerId: baseState.players[2].id, position: 3, time: 271000 },
          { playerId: baseState.players[3].id, position: 4, time: 289000 }
        ];
        break;
    }

    return { ...baseState, ...overrides };
  },

  /**
   * Create mock betting state
   */
  createMockBettingState: (overrides = {}) => ({
    isActive: true,
    timeRemaining: 30,
    currentBet: null,
    userBalance: 1000,
    totalPool: 0,
    playerOdds: new Map(),
    bets: new Map(),
    ...overrides
  }),

  /**
   * Create mock race results
   */
  createMockRaceResults: (players) => {
    if (!players || players.length === 0) {
      players = GameHelpers.createMockPlayers(4);
    }

    return players.map((player, index) => ({
      playerId: player.id,
      playerName: player.name,
      position: index + 1,
      time: 240000 + (index * 15000) + Math.random() * 10000, // Realistic race times
      finished: true
    })).sort((a, b) => a.position - b.position);
  }
};

/**
 * Mock Creation Helpers
 */
export const MockHelpers = {
  /**
   * Create a mock Socket.IO client
   */
  createMockSocket: () => ({
    id: 'test-socket-id',
    connected: false,
    disconnected: true,
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    once: jest.fn(),
    removeAllListeners: jest.fn(),
    connect: jest.fn(() => {
      this.connected = true;
      this.disconnected = false;
    }),
    disconnect: jest.fn(() => {
      this.connected = false;
      this.disconnected = true;
    }),
    hasListeners: jest.fn(() => false)
  }),

  /**
   * Create a mock multiplayer manager
   */
  createMockMultiplayerManager: () => ({
    isConnected: false,
    roomCode: null,
    players: [],
    currentUser: null,
    socket: MockHelpers.createMockSocket(),
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn(),
    createRoom: jest.fn().mockResolvedValue('TEST123'),
    joinRoom: jest.fn().mockResolvedValue(true),
    leaveRoom: jest.fn(),
    sendMessage: jest.fn(),
    updatePlayerList: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn()
  }),

  /**
   * Create a mock UI manager
   */
  createMockUIManager: () => ({
    isInitialized: false,
    currentGameState: 'menu',
    panelStates: {
      betting: false,
      leaderboard: false,
      debug: false,
      playerSetup: true
    },
    initialize: jest.fn().mockResolvedValue(),
    togglePanel: jest.fn(),
    updateGameState: jest.fn(),
    showNotification: jest.fn(),
    destroy: jest.fn()
  }),

  /**
   * Create mock HTTP request/response objects
   */
  createMockHTTP: () => ({
    req: {
      headers: {},
      body: {},
      query: {},
      params: {},
      method: 'GET',
      url: '/test',
      get: jest.fn()
    },
    res: {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    }
  })
};

/**
 * Validation Helpers
 */
export const ValidationHelpers = {
  /**
   * Validate that a component follows the expected interface
   */
  validateComponent: (component, requiredMethods = []) => {
    const defaultMethods = ['initialize', 'destroy'];
    const allMethods = [...defaultMethods, ...requiredMethods];
    
    allMethods.forEach(method => {
      expect(component).toHaveProperty(method);
      expect(typeof component[method]).toBe('function');
    });
  },

  /**
   * Validate player object structure
   */
  validatePlayer: (player) => {
    expect(player).toHaveProperty('id');
    expect(player).toHaveProperty('name');
    expect(player).toHaveProperty('wins');
    expect(player).toHaveProperty('winRate');
    expect(typeof player.id).toBe('string');
    expect(typeof player.name).toBe('string');
    expect(typeof player.wins).toBe('number');
    expect(typeof player.winRate).toBe('number');
    expect(player.wins).toBeGreaterThanOrEqual(0);
    expect(player.winRate).toBeGreaterThanOrEqual(0);
    expect(player.winRate).toBeLessThanOrEqual(100);
  },

  /**
   * Validate game state object structure
   */
  validateGameState: (state) => {
    const validPhases = ['menu', 'lobby', 'betting', 'racing', 'finished'];
    expect(state).toHaveProperty('phase');
    expect(state).toHaveProperty('players');
    expect(state).toHaveProperty('raceResults');
    expect(validPhases).toContain(state.phase);
    expect(Array.isArray(state.players)).toBe(true);
    expect(Array.isArray(state.raceResults)).toBe(true);
  }
};

/**
 * Integration Test Helpers
 */
export const IntegrationHelpers = {
  /**
   * Setup a complete test environment with game, UI, and multiplayer
   */
  setupFullEnvironment: async () => {
    const game = GameHelpers.createMockGame();
    const uiManager = MockHelpers.createMockUIManager();
    const multiplayerManager = MockHelpers.createMockMultiplayerManager();
    
    DOMHelpers.setupCleanDOM();
    DOMHelpers.createUIOverlay();
    
    await uiManager.initialize();
    
    return {
      game,
      uiManager,
      multiplayerManager,
      cleanup: () => {
        game.destroy();
        uiManager.destroy();
        multiplayerManager.disconnect();
        DOMHelpers.setupCleanDOM();
      }
    };
  },

  /**
   * Run a complete game flow test
   */
  runGameFlowTest: async (phases) => {
    const environment = await IntegrationHelpers.setupFullEnvironment();
    
    try {
      for (const phase of phases) {
        const gameState = GameHelpers.createMockGameState(phase);
        environment.uiManager.updateGameState(gameState);
        await AsyncHelpers.delay(100); // Allow phase transition
      }
    } finally {
      environment.cleanup();
    }
  }
};

// Default export with all helpers
export default {
  DOMHelpers,
  AsyncHelpers,
  GameHelpers,
  MockHelpers,
  ValidationHelpers,
  IntegrationHelpers
};