/**
 * LoginIntegration Phaser Enhancement Test Suite
 * Tests for the Phaser-specific integration methods
 */

const loginIntegration = require('../../src/auth/login-integration.js');

// Mock Phaser game instance
const mockGame = {
  registry: {
    set: jest.fn(),
    get: jest.fn(),
    events: {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
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

// Mock scene
const mockScene = {
  sys: { key: 'TestScene' },
  registry: mockGame.registry,
  events: {
    emit: jest.fn(),
    on: jest.fn()
  }
};

// Mock AuthGameBridge
const mockAuthGameBridge = {
  initializeUserContext: jest.fn(),
  updateAllScenes: jest.fn(),
  handleAuthStateChange: jest.fn(),
  hasPermission: jest.fn(() => true),
  hasPermissions: jest.fn(() => true),
  getUserContext: jest.fn()
};

// Mock user data
const mockUserData = {
  id: 'user123',
  username: 'testuser',
  email: 'test@example.com',
  statistics: {
    level: 3,
    totalPoints: 1500,
    wins: 8,
    losses: 4,
    gamesPlayed: 12,
    winRate: 66.7
  },
  auth: {
    permissions: ['play_game', 'play_multiplayer'],
    roles: ['player']
  }
};

describe('LoginIntegration Phaser Enhancement', () => {
  beforeEach(() => {
    // Reset all mocked functions
    jest.clearAllMocks();
    
    // Mock the auth manager
    loginIntegration.authManager = {
      isAuthenticated: jest.fn(() => true),
      getCurrentUser: jest.fn(() => mockUserData),
      on: jest.fn(),
      off: jest.fn()
    };
    
    loginIntegration.isInitialized = true;
  });

  describe('integrateWithPhaserScenes', () => {
    test('should integrate auth with Phaser game scenes', async () => {
      // Arrange
      mockGame.scene.getScenes.mockReturnValue([mockScene]);
      
      // Act
      await loginIntegration.integrateWithPhaserScenes(mockGame);
      
      // Assert
      expect(mockGame.registry.set).toHaveBeenCalledWith('userContext', mockUserData);
      expect(mockGame.registry.set).toHaveBeenCalledWith('isAuthenticated', true);
      expect(mockScene.events.emit).toHaveBeenCalledWith('auth-context-updated', mockUserData);
    });

    test('should handle integration with unauthenticated user', async () => {
      // Arrange
      loginIntegration.authManager.isAuthenticated.mockReturnValue(false);
      loginIntegration.authManager.getCurrentUser.mockReturnValue(null);
      
      // Act
      await loginIntegration.integrateWithPhaserScenes(mockGame);
      
      // Assert
      expect(mockGame.registry.set).toHaveBeenCalledWith('userContext', null);
      expect(mockGame.registry.set).toHaveBeenCalledWith('isAuthenticated', false);
    });

    test('should handle errors during integration gracefully', async () => {
      // Arrange
      mockGame.registry.set.mockImplementation(() => {
        throw new Error('Registry error');
      });
      
      // Act & Assert
      await expect(loginIntegration.integrateWithPhaserScenes(mockGame))
        .rejects.toThrow('Failed to integrate with Phaser scenes');
    });

    test('should validate game parameter', async () => {
      // Act & Assert
      await expect(loginIntegration.integrateWithPhaserScenes(null))
        .rejects.toThrow('Game instance is required');
    });
  });

  describe('setupGameStateHandlers', () => {
    test('should setup auth event handlers for game state management', () => {
      // Arrange
      const mockAuthGameBridge = {
        handleAuthStateChange: jest.fn()
      };
      
      // Act
      loginIntegration.setupGameStateHandlers(mockGame, mockAuthGameBridge);
      
      // Assert
      expect(loginIntegration.authManager.on).toHaveBeenCalledWith('login', expect.any(Function));
      expect(loginIntegration.authManager.on).toHaveBeenCalledWith('logout', expect.any(Function));
      expect(loginIntegration.authManager.on).toHaveBeenCalledWith('session_expired', expect.any(Function));
    });

    test('should handle login events through AuthGameBridge', () => {
      // Arrange
      const mockAuthGameBridge = {
        handleAuthStateChange: jest.fn()
      };
      
      loginIntegration.setupGameStateHandlers(mockGame, mockAuthGameBridge);
      
      // Get the login handler that was registered
      const loginHandler = loginIntegration.authManager.on.mock.calls
        .find(call => call[0] === 'login')[1];
      
      // Act
      loginHandler(mockUserData);
      
      // Assert
      expect(mockAuthGameBridge.handleAuthStateChange).toHaveBeenCalledWith({
        type: 'login',
        user: mockUserData
      });
    });

    test('should handle logout events through AuthGameBridge', () => {
      // Arrange
      const mockAuthGameBridge = {
        handleAuthStateChange: jest.fn()
      };
      
      loginIntegration.setupGameStateHandlers(mockGame, mockAuthGameBridge);
      
      // Get the logout handler that was registered
      const logoutHandler = loginIntegration.authManager.on.mock.calls
        .find(call => call[0] === 'logout')[1];
      
      // Act
      logoutHandler();
      
      // Assert
      expect(mockAuthGameBridge.handleAuthStateChange).toHaveBeenCalledWith({
        type: 'logout'
      });
    });

    test('should validate parameters', () => {
      // Act & Assert
      expect(() => loginIntegration.setupGameStateHandlers(null, mockAuthGameBridge))
        .toThrow('Game instance is required');
      
      expect(() => loginIntegration.setupGameStateHandlers(mockGame, null))
        .toThrow('AuthGameBridge instance is required');
    });
  });

  describe('validateGameAccess', () => {
    test('should validate user has required permissions for game access', async () => {
      // Arrange
      loginIntegration.authManager.isAuthenticated.mockReturnValue(true);
      
      // Act
      const hasAccess = await loginIntegration.validateGameAccess(['play_game']);
      
      // Assert
      expect(hasAccess).toBe(true);
    });

    test('should deny access for unauthenticated users', async () => {
      // Arrange
      loginIntegration.authManager.isAuthenticated.mockReturnValue(false);
      
      // Act
      const hasAccess = await loginIntegration.validateGameAccess();
      
      // Assert
      expect(hasAccess).toBe(false);
    });

    test('should deny access when user lacks required permissions', async () => {
      // Arrange
      const userWithoutPermissions = {
        ...mockUserData,
        auth: {
          permissions: ['basic_access'],
          roles: ['guest']
        }
      };
      loginIntegration.authManager.getCurrentUser.mockReturnValue(userWithoutPermissions);
      
      // Act
      const hasAccess = await loginIntegration.validateGameAccess(['admin_access']);
      
      // Assert
      expect(hasAccess).toBe(false);
    });

    test('should allow access with no specific permissions required', async () => {
      // Arrange
      loginIntegration.authManager.isAuthenticated.mockReturnValue(true);
      
      // Act
      const hasAccess = await loginIntegration.validateGameAccess();
      
      // Assert
      expect(hasAccess).toBe(true);
    });

    test('should handle auth manager errors gracefully', async () => {
      // Arrange
      loginIntegration.authManager.isAuthenticated.mockImplementation(() => {
        throw new Error('Auth error');
      });
      
      // Act
      const hasAccess = await loginIntegration.validateGameAccess();
      
      // Assert
      expect(hasAccess).toBe(false);
    });
  });

  describe('setupSceneAuth', () => {
    test('should setup authentication context for a scene', async () => {
      // Arrange - Fresh mock scene for each test
      const testScene = {
        sys: { key: 'TestScene' },
        registry: {
          set: jest.fn()
        },
        events: {
          on: jest.fn()
        }
      };
      
      // Act
      await loginIntegration.setupSceneAuth(testScene);
      
      // Assert
      expect(testScene.events.on).toHaveBeenCalledWith('auth-context-updated', expect.any(Function));
      expect(testScene.events.on).toHaveBeenCalledWith('logout-requested', expect.any(Function));
    });

    test('should provide user context access to scene', async () => {
      // Arrange - Fresh mock scene for each test
      const testScene = {
        sys: { key: 'TestScene' },
        registry: {
          set: jest.fn()
        },
        events: {
          on: jest.fn()
        }
      };
      
      // Act
      await loginIntegration.setupSceneAuth(testScene);
      
      // Get the auth context handler
      const contextHandler = testScene.events.on.mock.calls
        .find(call => call[0] === 'auth-context-updated')[1];
      
      // Act - simulate auth context update
      contextHandler(mockUserData);
      
      // Assert - scene should have access to user data
      expect(testScene.registry.set).toHaveBeenCalledWith('userContext', mockUserData);
    });

    test('should handle logout requests from scene', async () => {
      // Arrange
      const testScene = {
        sys: { key: 'TestScene' },
        registry: {
          set: jest.fn()
        },
        events: {
          on: jest.fn()
        }
      };
      
      const logoutSpy = jest.spyOn(loginIntegration, 'logout').mockResolvedValue();
      
      await loginIntegration.setupSceneAuth(testScene);
      
      // Get the logout handler
      const logoutHandler = testScene.events.on.mock.calls
        .find(call => call[0] === 'logout-requested')[1];
      
      // Act
      logoutHandler();
      
      // Assert
      expect(logoutSpy).toHaveBeenCalled();
    });

    test('should validate scene parameter', async () => {
      // Act & Assert
      await expect(loginIntegration.setupSceneAuth(null))
        .rejects.toThrow('Scene instance is required');
    });
  });

  describe('getAuthenticatedUser', () => {
    test('should return current user if authenticated', () => {
      // Act
      const user = loginIntegration.getAuthenticatedUser();
      
      // Assert
      expect(user).toEqual(mockUserData);
    });

    test('should return null if not authenticated', () => {
      // Arrange
      loginIntegration.authManager.isAuthenticated.mockReturnValue(false);
      
      // Act
      const user = loginIntegration.getAuthenticatedUser();
      
      // Assert
      expect(user).toBe(null);
    });

    test('should handle errors gracefully', () => {
      // Arrange
      loginIntegration.authManager.getCurrentUser.mockImplementation(() => {
        throw new Error('Auth error');
      });
      
      // Act
      const user = loginIntegration.getAuthenticatedUser();
      
      // Assert
      expect(user).toBe(null);
    });
  });

  describe('requireAuth', () => {
    test('should return true for authenticated users with sufficient permissions', async () => {
      // Act
      const result = await loginIntegration.requireAuth(['play_game']);
      
      // Assert
      expect(result).toBe(true);
    });

    test('should redirect unauthenticated users to login', async () => {
      // Arrange
      loginIntegration.authManager.isAuthenticated.mockReturnValue(false);
      
      // Mock window.location
      delete window.location;
      window.location = { href: '' };
      
      // Act
      const result = await loginIntegration.requireAuth();
      
      // Assert
      expect(result).toBe(false);
      expect(window.location.href).toBe('login.html');
    });

    test('should deny access to users without required permissions', async () => {
      // Arrange
      const userWithoutPermissions = {
        ...mockUserData,
        auth: {
          permissions: ['basic_access'],
          roles: ['guest']
        }
      };
      loginIntegration.authManager.getCurrentUser.mockReturnValue(userWithoutPermissions);
      
      // Act
      const result = await loginIntegration.requireAuth(['admin_access']);
      
      // Assert
      expect(result).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    test('should provide complete Phaser integration workflow', async () => {
      // Arrange
      const mockAuthGameBridge = {
        handleAuthStateChange: jest.fn(),
        initializeUserContext: jest.fn()
      };
      
      // Create fresh mocks for this test
      const testGame = {
        registry: {
          set: jest.fn(),
          get: jest.fn(),
          events: {
            emit: jest.fn(),
            on: jest.fn(),
            off: jest.fn()
          }
        },
        scene: {
          getScenes: jest.fn(() => [mockScene]),
          getScene: jest.fn(() => null)
        },
        events: {
          emit: jest.fn(),
          on: jest.fn()
        }
      };
      
      const testScene = {
        sys: { key: 'TestScene' },
        registry: testGame.registry,
        events: {
          emit: jest.fn(),
          on: jest.fn()
        }
      };
      
      testGame.scene.getScenes.mockReturnValue([testScene]);
      
      // Act - Complete integration workflow
      await loginIntegration.integrateWithPhaserScenes(testGame);
      loginIntegration.setupGameStateHandlers(testGame, mockAuthGameBridge);
      await loginIntegration.setupSceneAuth(testScene);
      
      // Assert - All components should be properly integrated
      expect(testGame.registry.set).toHaveBeenCalledWith('userContext', mockUserData);
      expect(testGame.registry.set).toHaveBeenCalledWith('isAuthenticated', true);
      expect(testScene.events.on).toHaveBeenCalledWith('auth-context-updated', expect.any(Function));
      expect(loginIntegration.authManager.on).toHaveBeenCalledWith('login', expect.any(Function));
    });

    test('should handle complete authentication flow with game integration', async () => {
      // Arrange
      const mockAuthGameBridge = {
        handleAuthStateChange: jest.fn()
      };
      
      loginIntegration.setupGameStateHandlers(mockGame, mockAuthGameBridge);
      
      // Simulate login event
      const loginHandler = loginIntegration.authManager.on.mock.calls
        .find(call => call[0] === 'login')[1];
      
      // Act
      loginHandler(mockUserData);
      
      // Assert
      expect(mockAuthGameBridge.handleAuthStateChange).toHaveBeenCalledWith({
        type: 'login',
        user: mockUserData
      });
    });
  });
});