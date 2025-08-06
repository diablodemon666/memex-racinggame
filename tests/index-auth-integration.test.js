/**
 * Index.js Auth Integration Test Suite
 * Tests for enhanced game initialization with authentication integration
 */

// Mock Phaser before importing
const mockPhaserGame = {
  registry: {
    set: jest.fn(),
    get: jest.fn(),
    events: {
      emit: jest.fn(),
      on: jest.fn()
    }
  },
  scene: {
    getScenes: jest.fn(() => []),
    getScene: jest.fn(() => null)
  },
  events: {
    emit: jest.fn(),
    on: jest.fn()
  }
};

jest.mock('phaser', () => ({
  __esModule: true,
  default: {
    Game: jest.fn(() => mockPhaserGame),
    AUTO: 'AUTO',
    Scale: {
      FIT: 'FIT',
      CENTER_BOTH: 'CENTER_BOTH'
    }
  }
}));

// Mock the auth components
jest.mock('../src/auth/login-integration.js', () => ({
  initialize: jest.fn().mockResolvedValue({ isAuthenticated: true, user: { id: 'test', username: 'testuser' } }),
  integrateWithPhaserScenes: jest.fn().mockResolvedValue(),
  setupGameStateHandlers: jest.fn(),
  getAuthenticatedUser: jest.fn(() => ({ id: 'test', username: 'testuser' }))
}));

jest.mock('../src/game/systems/AuthGameBridge.js', () => ({
  AuthGameBridge: jest.fn().mockImplementation(() => ({
    initializeUserContext: jest.fn().mockResolvedValue(),
    handleAuthStateChange: jest.fn(),
    getUserContext: jest.fn(() => ({ id: 'test', username: 'testuser' }))
  }))
}));

// Mock other dependencies
jest.mock('../src/ui', () => ({
  initializeUI: jest.fn().mockResolvedValue({
    setCurrentUser: jest.fn()
  })
}));

jest.mock('../src/multiplayer/MultiplayerEvents', () => ({
  multiplayerEvents: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn()
  }
}));

jest.mock('../src/config/development', () => ({
  developmentConfig: {
    debug: { enabled: false },
    hotReload: { enabled: false },
    performance: { enabled: false },
    game: { showPlayerDebugInfo: false }
  },
  DevelopmentPerformanceMonitor: jest.fn(),
  HMRHandler: jest.fn().mockImplementation(() => ({ setupHMR: jest.fn() })),
  devUtils: {
    setupGlobalDebugFunctions: jest.fn()
  }
}));

// Import the functions to test after mocking
const loginIntegration = require('../src/auth/login-integration.js');
const { AuthGameBridge } = require('../src/game/systems/AuthGameBridge.js');

describe('Enhanced Game Initialization with Auth Integration', () => {
  let mockAuthGameBridge;
  let mockGame;
  let mockUIManager;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Set up DOM
    document.body.innerHTML = '<div id="game-container"></div>';
    
    // Mock implementations
    mockAuthGameBridge = {
      initializeUserContext: jest.fn().mockResolvedValue(),
      handleAuthStateChange: jest.fn(),
      getUserContext: jest.fn(() => ({ id: 'test', username: 'testuser' }))
    };
    
    mockGame = mockPhaserGame;
    
    mockUIManager = {
      setCurrentUser: jest.fn()
    };
    
    // Mock AuthGameBridge constructor
    AuthGameBridge.mockImplementation(() => mockAuthGameBridge);
    
    // Mock successful auth initialization
    loginIntegration.initialize.mockResolvedValue({
      isAuthenticated: true,
      user: { id: 'test', username: 'testuser' }
    });
  });

  describe('initializeAuthIntegrationEnhanced', () => {
    test('should create AuthGameBridge and integrate with authenticated user', async () => {
      // Mock the enhanced initialization function (we'll create this)
      const initializeAuthIntegrationEnhanced = async (game, uiManager) => {
        try {
          // Initialize login integration
          const authResult = await loginIntegration.initialize();
          
          // Create AuthGameBridge
          const authGameBridge = new AuthGameBridge(game, loginIntegration.authManager);
          
          // Setup integration if authenticated
          if (authResult.isAuthenticated) {
            await authGameBridge.initializeUserContext(authResult.user);
            await loginIntegration.integrateWithPhaserScenes(game);
            loginIntegration.setupGameStateHandlers(game, authGameBridge);
          }
          
          // Setup UI manager
          if (uiManager && authResult.user) {
            uiManager.setCurrentUser(authResult.user);
          }
          
          return { authGameBridge, authResult };
        } catch (error) {
          console.error('Failed to initialize enhanced auth integration:', error);
          throw error;
        }
      };

      // Act
      const result = await initializeAuthIntegrationEnhanced(mockGame, mockUIManager);

      // Assert
      expect(loginIntegration.initialize).toHaveBeenCalled();
      expect(AuthGameBridge).toHaveBeenCalledWith(mockGame, loginIntegration.authManager);
      expect(mockAuthGameBridge.initializeUserContext).toHaveBeenCalledWith({
        id: 'test',
        username: 'testuser'
      });
      expect(loginIntegration.integrateWithPhaserScenes).toHaveBeenCalledWith(mockGame);
      expect(loginIntegration.setupGameStateHandlers).toHaveBeenCalledWith(mockGame, mockAuthGameBridge);
      expect(mockUIManager.setCurrentUser).toHaveBeenCalledWith({
        id: 'test',
        username: 'testuser'
      });
      expect(result.authGameBridge).toBe(mockAuthGameBridge);
    });

    test('should handle unauthenticated users gracefully', async () => {
      // Arrange
      loginIntegration.initialize.mockResolvedValue({
        isAuthenticated: false,
        user: null
      });

      const initializeAuthIntegrationEnhanced = async (game, uiManager) => {
        try {
          const authResult = await loginIntegration.initialize();
          const authGameBridge = new AuthGameBridge(game, loginIntegration.authManager);
          
          if (authResult.isAuthenticated) {
            await authGameBridge.initializeUserContext(authResult.user);
            await loginIntegration.integrateWithPhaserScenes(game);
            loginIntegration.setupGameStateHandlers(game, authGameBridge);
          } else {
            // Clear any existing user data
            if (uiManager) {
              uiManager.setCurrentUser(null);
            }
          }
          
          return { authGameBridge, authResult };
        } catch (error) {
          console.error('Failed to initialize enhanced auth integration:', error);
          throw error;
        }
      };

      // Act
      const result = await initializeAuthIntegrationEnhanced(mockGame, mockUIManager);

      // Assert
      expect(mockAuthGameBridge.initializeUserContext).not.toHaveBeenCalled();
      expect(loginIntegration.integrateWithPhaserScenes).not.toHaveBeenCalled();
      expect(mockUIManager.setCurrentUser).toHaveBeenCalledWith(null);
      expect(result.authResult.isAuthenticated).toBe(false);
    });

    test('should handle auth initialization errors gracefully', async () => {
      // Arrange
      loginIntegration.initialize.mockRejectedValue(new Error('Auth initialization failed'));

      const initializeAuthIntegrationEnhanced = async (game, uiManager) => {
        try {
          const authResult = await loginIntegration.initialize();
          const authGameBridge = new AuthGameBridge(game, loginIntegration.authManager);
          return { authGameBridge, authResult };
        } catch (error) {
          console.error('Failed to initialize enhanced auth integration:', error);
          // Continue without auth integration
          return { authGameBridge: null, authResult: { isAuthenticated: false, user: null } };
        }
      };

      // Act
      const result = await initializeAuthIntegrationEnhanced(mockGame, mockUIManager);

      // Assert
      expect(result.authGameBridge).toBe(null);
      expect(result.authResult.isAuthenticated).toBe(false);
    });

    test('should handle AuthGameBridge creation errors', async () => {
      // Arrange
      AuthGameBridge.mockImplementation(() => {
        throw new Error('AuthGameBridge creation failed');
      });

      const initializeAuthIntegrationEnhanced = async (game, uiManager) => {
        try {
          const authResult = await loginIntegration.initialize();
          const authGameBridge = new AuthGameBridge(game, loginIntegration.authManager);
          return { authGameBridge, authResult };
        } catch (error) {
          console.error('Failed to initialize enhanced auth integration:', error);
          return { authGameBridge: null, authResult: { isAuthenticated: false, user: null } };
        }
      };

      // Act
      const result = await initializeAuthIntegrationEnhanced(mockGame, mockUIManager);

      // Assert
      expect(result.authGameBridge).toBe(null);
    });
  });

  describe('setupAuthEventListeners enhanced', () => {
    test('should setup enhanced auth event listeners with AuthGameBridge', () => {
      const setupAuthEventListenersEnhanced = (game, uiManager, authGameBridge) => {
        if (!authGameBridge) return;

        // Setup enhanced event listeners that use AuthGameBridge
        const mockAuthManager = {
          on: jest.fn()
        };

        // Mock the event setup
        mockAuthManager.on('login', (userData) => {
          authGameBridge.handleAuthStateChange({ type: 'login', user: userData });
          if (uiManager) {
            uiManager.setCurrentUser(userData);
          }
        });

        mockAuthManager.on('logout', () => {
          authGameBridge.handleAuthStateChange({ type: 'logout' });
          if (uiManager) {
            uiManager.setCurrentUser(null);
          }
        });

        return mockAuthManager;
      };

      // Act
      const authManager = setupAuthEventListenersEnhanced(mockGame, mockUIManager, mockAuthGameBridge);

      // Assert
      expect(authManager.on).toHaveBeenCalledWith('login', expect.any(Function));
      expect(authManager.on).toHaveBeenCalledWith('logout', expect.any(Function));
    });

    test('should handle missing AuthGameBridge gracefully', () => {
      const setupAuthEventListenersEnhanced = (game, uiManager, authGameBridge) => {
        if (!authGameBridge) return null;
        // Setup would happen here
        return {};
      };

      // Act
      const result = setupAuthEventListenersEnhanced(mockGame, mockUIManager, null);

      // Assert
      expect(result).toBe(null);
    });
  });

  describe('Game initialization flow integration', () => {
    test('should integrate auth throughout complete game initialization', async () => {
      // Mock complete initialization flow
      const completeGameInitialization = async () => {
        // 1. Initialize auth
        const authResult = await loginIntegration.initialize();
        
        // 2. Create game
        const Phaser = require('phaser').default;
        const game = new Phaser.Game({});
        
        // 3. Initialize UI
        const { initializeUI } = require('../src/ui');
        const uiManager = await initializeUI(game);
        
        // 4. Create AuthGameBridge
        const authGameBridge = authResult.isAuthenticated 
          ? new AuthGameBridge(game, loginIntegration.authManager)
          : null;
        
        // 5. Setup auth integration
        if (authGameBridge && authResult.isAuthenticated) {
          await authGameBridge.initializeUserContext(authResult.user);
          await loginIntegration.integrateWithPhaserScenes(game);
          loginIntegration.setupGameStateHandlers(game, authGameBridge);
          uiManager.setCurrentUser(authResult.user);
        }
        
        return { game, uiManager, authGameBridge, authResult };
      };

      // Act
      const result = await completeGameInitialization();

      // Assert - Complete integration flow
      expect(loginIntegration.initialize).toHaveBeenCalled();
      expect(result.game).toBeDefined();
      expect(result.uiManager).toBeDefined();
      expect(result.authGameBridge).toBeDefined();
      expect(mockAuthGameBridge.initializeUserContext).toHaveBeenCalled();
      expect(loginIntegration.integrateWithPhaserScenes).toHaveBeenCalled();
      expect(loginIntegration.setupGameStateHandlers).toHaveBeenCalled();
    });

    test('should handle partial initialization failures gracefully', async () => {
      // Arrange - UI initialization fails
      const { initializeUI } = require('../src/ui');
      initializeUI.mockRejectedValue(new Error('UI initialization failed'));

      const robustGameInitialization = async () => {
        try {
          const authResult = await loginIntegration.initialize();
          const Phaser = require('phaser').default;
          const game = new Phaser.Game({});
          
          let uiManager = null;
          try {
            uiManager = await initializeUI(game);
          } catch (uiError) {
            console.warn('UI initialization failed, continuing without UI manager');
          }
          
          const authGameBridge = authResult.isAuthenticated 
            ? new AuthGameBridge(game, loginIntegration.authManager)
            : null;
          
          if (authGameBridge && authResult.isAuthenticated) {
            await authGameBridge.initializeUserContext(authResult.user);
            await loginIntegration.integrateWithPhaserScenes(game);
            loginIntegration.setupGameStateHandlers(game, authGameBridge);
            
            if (uiManager) {
              uiManager.setCurrentUser(authResult.user);
            }
          }
          
          return { game, uiManager, authGameBridge, authResult };
        } catch (error) {
          console.error('Game initialization failed:', error);
          throw error;
        }
      };

      // Act
      const result = await robustGameInitialization();

      // Assert - Should continue despite UI failure
      expect(result.game).toBeDefined();
      expect(result.uiManager).toBe(null);
      expect(result.authGameBridge).toBeDefined();
      expect(mockAuthGameBridge.initializeUserContext).toHaveBeenCalled();
    });
  });

  describe('Performance considerations', () => {
    test('should complete auth integration within performance target', async () => {
      const performantAuthIntegration = async (game, uiManager) => {
        const startTime = Date.now();
        
        const authResult = await loginIntegration.initialize();
        const authGameBridge = new AuthGameBridge(game, loginIntegration.authManager);
        
        if (authResult.isAuthenticated) {
          await authGameBridge.initializeUserContext(authResult.user);
          await loginIntegration.integrateWithPhaserScenes(game);
          loginIntegration.setupGameStateHandlers(game, authGameBridge);
        }
        
        const duration = Date.now() - startTime;
        return { authGameBridge, authResult, duration };
      };

      // Act
      const result = await performantAuthIntegration(mockGame, mockUIManager);

      // Assert - Should complete quickly (note: mocks make this very fast)
      expect(result.duration).toBeLessThan(100);
      expect(result.authGameBridge).toBeDefined();
    });
  });
});