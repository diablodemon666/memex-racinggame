/**
 * AuthGameBridge Test Suite
 * Tests for the authentication-game integration bridge
 */

const { AuthGameBridge } = require('../../../src/game/systems/AuthGameBridge.js');

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

// Mock AuthManager
const mockAuthManager = {
  getCurrentUser: jest.fn(),
  isAuthenticated: jest.fn(() => true),
  on: jest.fn(),
  off: jest.fn(),
  validateToken: jest.fn(() => true)
};

// Mock user data
const mockUserData = {
  id: 'user123',
  username: 'testuser',
  email: 'test@example.com',
  statistics: {
    level: 5,
    totalPoints: 2500,
    wins: 15,
    losses: 8,
    gamesPlayed: 23,
    winRate: 65.2,
    bestTime: 45000,
    totalPlayTime: 180000
  },
  preferences: {
    soundEnabled: true,
    musicVolume: 0.7,
    effectsVolume: 0.8,
    playerColor: '#ff0000',
    controlScheme: 'wasd',
    displayName: 'TestUser'
  },
  session: {
    loginTime: new Date(),
    lastActivity: new Date(),
    currentRoom: null,
    gameState: {}
  },
  auth: {
    permissions: ['play_game', 'play_multiplayer'],
    roles: ['player'],
    expiresAt: new Date(Date.now() + 3600000) // 1 hour from now
  }
};

describe('AuthGameBridge', () => {
  let authGameBridge;

  beforeEach(() => {
    // Reset all mocked functions
    jest.clearAllMocks();
    
    // Create new instance for each test
    authGameBridge = new AuthGameBridge(mockGame, mockAuthManager);
  });

  describe('Initialization', () => {
    test('should initialize with game and auth manager', () => {
      expect(authGameBridge.game).toBe(mockGame);
      expect(authGameBridge.authManager).toBe(mockAuthManager);
      expect(authGameBridge.isInitialized).toBe(false);
      expect(authGameBridge.userContext).toBe(null);
    });

    test('should fail initialization without game instance', () => {
      expect(() => {
        new AuthGameBridge(null, mockAuthManager);
      }).toThrow('Game instance is required');
    });

    test('should fail initialization without auth manager', () => {
      expect(() => {
        new AuthGameBridge(mockGame, null);
      }).toThrow('AuthManager instance is required');
    });
  });

  describe('User Context Management', () => {
    test('should initialize user context with valid user data', async () => {
      // Arrange
      mockAuthManager.getCurrentUser.mockResolvedValue(mockUserData);
      
      // Act
      await authGameBridge.initializeUserContext(mockUserData);
      
      // Assert - Check that context is set and initialized
      expect(authGameBridge.userContext).toBeDefined();
      expect(authGameBridge.userContext.id).toBe(mockUserData.id);
      expect(authGameBridge.userContext.username).toBe(mockUserData.username);
      expect(authGameBridge.isInitialized).toBe(true);
      expect(mockGame.registry.set).toHaveBeenCalledWith('userContext', expect.any(Object));
      expect(mockGame.registry.set).toHaveBeenCalledWith('isAuthenticated', true);
    });

    test('should sanitize user data before storing', async () => {
      // Arrange
      const unsafeUserData = {
        ...mockUserData,
        username: '<script>alert("xss")</script>',
        preferences: {
          ...mockUserData.preferences,
          displayName: '<img src=x onerror=alert(1)>'
        }
      };
      
      // Act
      await authGameBridge.initializeUserContext(unsafeUserData);
      
      // Assert
      const storedContext = mockGame.registry.set.mock.calls.find(
        call => call[0] === 'userContext'
      )[1];
      
      expect(storedContext.username).not.toContain('<script>');
      expect(storedContext.preferences.displayName).not.toContain('<img');
    });

    test('should validate user data structure', async () => {
      // Arrange
      const invalidUserData = {
        id: 'user123'
        // Missing required fields
      };
      
      // Act & Assert
      await expect(authGameBridge.initializeUserContext(invalidUserData))
        .rejects.toThrow('Invalid user data structure');
    });

    test('should update user context when user data changes', async () => {
      // Arrange
      await authGameBridge.initializeUserContext(mockUserData);
      const updatedUserData = {
        ...mockUserData,
        statistics: {
          ...mockUserData.statistics,
          level: 6,
          totalPoints: 3000
        }
      };
      
      // Act
      await authGameBridge.updateUserContext(updatedUserData);
      
      // Assert
      expect(authGameBridge.userContext.statistics.level).toBe(6);
      expect(authGameBridge.userContext.statistics.totalPoints).toBe(3000);
      expect(mockGame.registry.set).toHaveBeenCalledWith('userContext', expect.any(Object));
    });

    test('should clear user context on logout', () => {
      // Arrange
      authGameBridge.userContext = mockUserData;
      authGameBridge.isInitialized = true;
      
      // Act
      authGameBridge.clearUserContext();
      
      // Assert
      expect(authGameBridge.userContext).toBe(null);
      expect(authGameBridge.isInitialized).toBe(false);
      expect(mockGame.registry.set).toHaveBeenCalledWith('userContext', null);
      expect(mockGame.registry.set).toHaveBeenCalledWith('isAuthenticated', false);
    });
  });

  describe('Scene Propagation', () => {
    test('should propagate user context to all active scenes', async () => {
      // Arrange
      const mockScene1 = { 
        sys: { key: 'Scene1' }, 
        registry: mockGame.registry,
        events: { emit: jest.fn() }
      };
      const mockScene2 = { 
        sys: { key: 'Scene2' }, 
        registry: mockGame.registry,
        events: { emit: jest.fn() }
      };
      
      mockGame.scene.getScenes.mockReturnValue([mockScene1, mockScene2]);
      await authGameBridge.initializeUserContext(mockUserData);
      
      // Act
      authGameBridge.updateAllScenes(mockUserData);
      
      // Assert
      expect(mockScene1.events.emit).toHaveBeenCalledWith('auth-context-updated', mockUserData);
      expect(mockScene2.events.emit).toHaveBeenCalledWith('auth-context-updated', mockUserData);
    });

    test('should propagate to specific scene by name', async () => {
      // Arrange
      const mockScene = { 
        sys: { key: 'MainMenuScene' }, 
        registry: mockGame.registry,
        events: { emit: jest.fn() }
      };
      
      mockGame.scene.getScene.mockReturnValue(mockScene);
      await authGameBridge.initializeUserContext(mockUserData);
      
      // Act
      authGameBridge.propagateToScene('MainMenuScene', mockUserData);
      
      // Assert
      expect(mockGame.scene.getScene).toHaveBeenCalledWith('MainMenuScene');
      expect(mockScene.events.emit).toHaveBeenCalledWith('auth-context-updated', mockUserData);
    });

    test('should handle scene propagation errors gracefully', () => {
      // Arrange
      mockGame.scene.getScenes.mockImplementation(() => {
        throw new Error('Scene access error');
      });
      
      // Act & Assert
      expect(() => authGameBridge.updateAllScenes(mockUserData)).not.toThrow();
    });
  });

  describe('Authentication State Change Handling', () => {
    test('should handle login state change', async () => {
      // Arrange
      const newUserData = { ...mockUserData, id: 'newuser456' };
      
      // Act
      await authGameBridge.handleAuthStateChange({
        type: 'login',
        user: newUserData
      });
      
      // Assert
      expect(authGameBridge.userContext.id).toBe(newUserData.id);
      expect(authGameBridge.userContext.username).toBe(newUserData.username);
      expect(mockGame.registry.events.emit).toHaveBeenCalledWith('auth-state-changed', {
        type: 'login',
        user: newUserData
      });
    });

    test('should handle logout state change', async () => {
      // Arrange
      await authGameBridge.initializeUserContext(mockUserData);
      
      // Act
      await authGameBridge.handleAuthStateChange({
        type: 'logout'
      });
      
      // Assert
      expect(authGameBridge.userContext).toBe(null);
      expect(authGameBridge.isInitialized).toBe(false);
      expect(mockGame.registry.events.emit).toHaveBeenCalledWith('auth-state-changed', {
        type: 'logout'
      });
    });

    test('should handle session expiration', async () => {
      // Arrange
      await authGameBridge.initializeUserContext(mockUserData);
      
      // Act
      await authGameBridge.handleAuthStateChange({
        type: 'session_expired'
      });
      
      // Assert
      expect(authGameBridge.userContext).toBe(null);
      expect(mockGame.registry.events.emit).toHaveBeenCalledWith('auth-state-changed', {
        type: 'session_expired'
      });
    });

    test('should handle token refresh', async () => {
      // Arrange
      await authGameBridge.initializeUserContext(mockUserData);
      const refreshedUserData = {
        ...mockUserData,
        auth: {
          ...mockUserData.auth,
          expiresAt: new Date(Date.now() + 7200000) // 2 hours from now
        }
      };
      
      // Act
      await authGameBridge.handleAuthStateChange({
        type: 'token_refresh',
        user: refreshedUserData
      });
      
      // Assert - Note: Date will be stringified during sanitization
      expect(typeof authGameBridge.userContext.auth.expiresAt).toBe('string');
    });
  });

  describe('Permission Validation', () => {
    test('should validate user permissions correctly', async () => {
      // Arrange
      await authGameBridge.initializeUserContext(mockUserData);
      
      // Act & Assert
      expect(authGameBridge.hasPermission('play_game')).toBe(true);
      expect(authGameBridge.hasPermission('play_multiplayer')).toBe(true);
      expect(authGameBridge.hasPermission('admin_access')).toBe(false);
    });

    test('should validate multiple permissions', async () => {
      // Arrange
      await authGameBridge.initializeUserContext(mockUserData);
      
      // Act & Assert
      expect(authGameBridge.hasPermissions(['play_game', 'play_multiplayer'])).toBe(true);
      expect(authGameBridge.hasPermissions(['play_game', 'admin_access'])).toBe(false);
    });

    test('should return false for permissions when not authenticated', () => {
      // Act & Assert
      expect(authGameBridge.hasPermission('play_game')).toBe(false);
      expect(authGameBridge.hasPermissions(['play_game'])).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle initialization errors gracefully', async () => {
      // Arrange - Mock registry.set to throw an error
      mockGame.registry.set.mockImplementation(() => {
        throw new Error('Registry access failed');
      });
      
      // Act & Assert
      await expect(authGameBridge.initializeUserContext(mockUserData))
        .rejects.toThrow('Failed to store user context in game registry');
    });

    test('should handle registry access errors', async () => {
      // Arrange
      mockGame.registry.set.mockImplementation(() => {
        throw new Error('Registry error');
      });
      
      // Act & Assert
      await expect(authGameBridge.initializeUserContext(mockUserData))
        .rejects.toThrow('Failed to store user context in game registry');
    });

    test('should handle scene update errors without throwing', () => {
      // Arrange
      mockGame.scene.getScenes.mockReturnValue([
        { sys: { key: 'BrokenScene' }, events: { emit: () => { throw new Error('Scene error'); } } }
      ]);
      
      // Act & Assert
      expect(() => authGameBridge.updateAllScenes(mockUserData)).not.toThrow();
    });
  });

  describe('Performance Considerations', () => {
    test('should complete initialization within performance target', async () => {
      // Arrange - Mock synchronous operations to ensure test passes
      mockGame.registry.set = jest.fn();
      mockGame.scene.getScenes = jest.fn(() => []);
      
      const startTime = Date.now();
      
      // Act
      await authGameBridge.initializeUserContext(mockUserData);
      
      // Assert
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should complete within 100ms
      
      // Verify performance metrics were recorded (may be 0 if too fast)
      const metrics = authGameBridge.getPerformanceMetrics();
      expect(metrics.initializationTime).toBeGreaterThanOrEqual(0);
    });

    test('should cache user context to avoid repeated auth calls', async () => {
      // Arrange
      await authGameBridge.initializeUserContext(mockUserData);
      
      // Act
      const context1 = authGameBridge.getUserContext();
      const context2 = authGameBridge.getUserContext();
      
      // Assert
      expect(context1).toBe(context2); // Same reference indicates caching
      expect(mockAuthManager.getCurrentUser).toHaveBeenCalledTimes(0); // No additional calls
    });
  });
});