/**
 * AuthenticatedScene Test Suite
 * Tests for the base scene class with authentication context
 */

// Mock Phaser Scene
const mockPhaser = {
  Scene: class MockScene {
    constructor(config) {
      this.sys = { key: config.key || 'TestScene' };
      this.registry = {
        get: jest.fn(),
        set: jest.fn(),
        events: {
          on: jest.fn(),
          off: jest.fn(),
          emit: jest.fn()
        }
      };
      this.events = {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn()
      };
      this.scene = {
        key: config.key || 'TestScene',
        restart: jest.fn(),
        start: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn()
      };
    }
  }
};

jest.mock('phaser', () => ({
  __esModule: true,
  default: mockPhaser
}));

const { AuthenticatedScene } = require('../../../src/game/scenes/AuthenticatedScene.js');

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
    winRate: 65.2
  },
  preferences: {
    soundEnabled: true,
    musicVolume: 0.7,
    effectsVolume: 0.8,
    playerColor: '#ff0000'
  },
  auth: {
    permissions: ['play_game', 'play_multiplayer'],
    roles: ['player']
  }
};

describe('AuthenticatedScene', () => {
  let authenticatedScene;

  beforeEach(() => {
    jest.clearAllMocks();
    authenticatedScene = new AuthenticatedScene({ key: 'TestAuthScene' });
  });

  describe('Initialization', () => {
    test('should initialize with authentication context', () => {
      // Arrange
      authenticatedScene.registry.get.mockImplementation((key) => {
        if (key === 'userContext') return mockUserData;
        if (key === 'isAuthenticated') return true;
        return null;
      });

      // Act
      authenticatedScene.create();

      // Assert
      expect(authenticatedScene.userContext).toEqual(mockUserData);
      expect(authenticatedScene.isAuthenticated).toBe(true);
      expect(authenticatedScene.registry.events.on).toHaveBeenCalledWith('auth-context-updated', expect.any(Function));
      expect(authenticatedScene.registry.events.on).toHaveBeenCalledWith('auth-state-changed', expect.any(Function));
    });

    test('should handle unauthenticated state', () => {
      // Arrange
      authenticatedScene.registry.get.mockImplementation((key) => {
        if (key === 'userContext') return null;
        if (key === 'isAuthenticated') return false;
        return null;
      });

      // Act
      authenticatedScene.create();

      // Assert
      expect(authenticatedScene.userContext).toBe(null);
      expect(authenticatedScene.isAuthenticated).toBe(false);
    });

    test('should setup auth event listeners', () => {
      // Act
      authenticatedScene.create();

      // Assert
      expect(authenticatedScene.registry.events.on).toHaveBeenCalledWith('auth-context-updated', expect.any(Function));
      expect(authenticatedScene.registry.events.on).toHaveBeenCalledWith('auth-state-changed', expect.any(Function));
    });
  });

  describe('Authentication Context Access', () => {
    test('should provide getUser() method', () => {
      // Arrange
      authenticatedScene.userContext = mockUserData;

      // Act
      const user = authenticatedScene.getUser();

      // Assert
      expect(user).toEqual(mockUserData);
    });

    test('should provide getUserId() method', () => {
      // Arrange
      authenticatedScene.userContext = mockUserData;

      // Act
      const userId = authenticatedScene.getUserId();

      // Assert
      expect(userId).toBe('user123');
    });

    test('should provide getUsername() method', () => {
      // Arrange
      authenticatedScene.userContext = mockUserData;

      // Act
      const username = authenticatedScene.getUsername();

      // Assert
      expect(username).toBe('testuser');
    });

    test('should handle missing user context gracefully', () => {
      // Arrange
      authenticatedScene.userContext = null;

      // Act & Assert
      expect(authenticatedScene.getUser()).toBe(null);
      expect(authenticatedScene.getUserId()).toBe(null);
      expect(authenticatedScene.getUsername()).toBe(null);
    });
  });

  describe('Permission Checking', () => {
    beforeEach(() => {
      authenticatedScene.userContext = mockUserData;
      authenticatedScene.isAuthenticated = true;
    });

    test('should check single permission', () => {
      // Act & Assert
      expect(authenticatedScene.hasPermission('play_game')).toBe(true);
      expect(authenticatedScene.hasPermission('admin_access')).toBe(false);
    });

    test('should check multiple permissions', () => {
      // Act & Assert
      expect(authenticatedScene.hasPermissions(['play_game', 'play_multiplayer'])).toBe(true);
      expect(authenticatedScene.hasPermissions(['play_game', 'admin_access'])).toBe(false);
    });

    test('should require authentication for permission checks', () => {
      // Arrange
      authenticatedScene.isAuthenticated = false;

      // Act & Assert
      expect(authenticatedScene.hasPermission('play_game')).toBe(false);
      expect(authenticatedScene.hasPermissions(['play_game'])).toBe(false);
    });

    test('should handle malformed permissions gracefully', () => {
      // Arrange
      authenticatedScene.userContext = {
        ...mockUserData,
        auth: { permissions: null }
      };

      // Act & Assert
      expect(authenticatedScene.hasPermission('play_game')).toBe(false);
      expect(authenticatedScene.hasPermissions(['play_game'])).toBe(false);
    });
  });

  describe('User Statistics Access', () => {
    beforeEach(() => {
      authenticatedScene.userContext = mockUserData;
    });

    test('should provide getUserStats() method', () => {
      // Act
      const stats = authenticatedScene.getUserStats();

      // Assert
      expect(stats).toEqual(mockUserData.statistics);
    });

    test('should provide getUserLevel() method', () => {
      // Act
      const level = authenticatedScene.getUserLevel();

      // Assert
      expect(level).toBe(5);
    });

    test('should provide getUserPoints() method', () => {
      // Act
      const points = authenticatedScene.getUserPoints();

      // Assert
      expect(points).toBe(2500);
    });

    test('should handle missing statistics gracefully', () => {
      // Arrange
      authenticatedScene.userContext = { ...mockUserData, statistics: null };

      // Act & Assert
      expect(authenticatedScene.getUserStats()).toBe(null);
      expect(authenticatedScene.getUserLevel()).toBe(0);
      expect(authenticatedScene.getUserPoints()).toBe(0);
    });
  });

  describe('User Preferences Access', () => {
    beforeEach(() => {
      authenticatedScene.userContext = mockUserData;
    });

    test('should provide getUserPreferences() method', () => {
      // Act
      const preferences = authenticatedScene.getUserPreferences();

      // Assert
      expect(preferences).toEqual(mockUserData.preferences);
    });

    test('should provide specific preference getters', () => {
      // Act & Assert
      expect(authenticatedScene.isSoundEnabled()).toBe(true);
      expect(authenticatedScene.getMusicVolume()).toBe(0.7);
      expect(authenticatedScene.getEffectsVolume()).toBe(0.8);
      expect(authenticatedScene.getPlayerColor()).toBe('#ff0000');
    });

    test('should handle missing preferences gracefully', () => {
      // Arrange
      authenticatedScene.userContext = { ...mockUserData, preferences: null };

      // Act & Assert
      expect(authenticatedScene.getUserPreferences()).toBe(null);
      expect(authenticatedScene.isSoundEnabled()).toBe(true); // Default
      expect(authenticatedScene.getMusicVolume()).toBe(0.5); // Default
      expect(authenticatedScene.getEffectsVolume()).toBe(0.5); // Default
      expect(authenticatedScene.getPlayerColor()).toBe('#ffffff'); // Default
    });
  });

  describe('Authentication Event Handling', () => {
    test('should handle auth context updates', () => {
      // Arrange
      authenticatedScene.create();
      const contextHandler = authenticatedScene.registry.events.on.mock.calls
        .find(call => call[0] === 'auth-context-updated')[1];

      // Act
      contextHandler(mockUserData);

      // Assert
      expect(authenticatedScene.userContext).toEqual(mockUserData);
      expect(authenticatedScene.isAuthenticated).toBe(true);
    });

    test('should handle auth context clearing', () => {
      // Arrange
      authenticatedScene.userContext = mockUserData;
      authenticatedScene.isAuthenticated = true;
      authenticatedScene.create();
      
      const contextHandler = authenticatedScene.registry.events.on.mock.calls
        .find(call => call[0] === 'auth-context-updated')[1];

      // Act
      contextHandler(null);

      // Assert
      expect(authenticatedScene.userContext).toBe(null);
      expect(authenticatedScene.isAuthenticated).toBe(false);
    });

    test('should handle auth state changes', () => {
      // Arrange
      authenticatedScene.create();
      const stateHandler = authenticatedScene.registry.events.on.mock.calls
        .find(call => call[0] === 'auth-state-changed')[1];

      const mockOnAuthStateChange = jest.fn();
      authenticatedScene.onAuthStateChange = mockOnAuthStateChange;

      // Act
      const stateChange = { type: 'login', user: mockUserData };
      stateHandler(stateChange);

      // Assert
      expect(mockOnAuthStateChange).toHaveBeenCalledWith(stateChange);
    });

    test('should call onUserContextUpdate when available', () => {
      // Arrange
      authenticatedScene.create();
      const mockOnUserContextUpdate = jest.fn();
      authenticatedScene.onUserContextUpdate = mockOnUserContextUpdate;

      const contextHandler = authenticatedScene.registry.events.on.mock.calls
        .find(call => call[0] === 'auth-context-updated')[1];

      // Act
      contextHandler(mockUserData);

      // Assert
      expect(mockOnUserContextUpdate).toHaveBeenCalledWith(mockUserData);
    });
  });

  describe('Logout Functionality', () => {
    test('should provide requestLogout() method', () => {
      // Act
      authenticatedScene.requestLogout();

      // Assert
      expect(authenticatedScene.events.emit).toHaveBeenCalledWith('logout-requested');
    });

    test('should handle logout confirmation', () => {
      // Arrange
      const mockOnLogout = jest.fn();
      authenticatedScene.onLogout = mockOnLogout;

      // Act
      authenticatedScene.handleLogout();

      // Assert
      expect(mockOnLogout).toHaveBeenCalled();
    });
  });

  describe('Route Protection', () => {
    test('should provide requireAuth() method', () => {
      // Arrange
      authenticatedScene.isAuthenticated = true;

      // Act
      const result = authenticatedScene.requireAuth();

      // Assert
      expect(result).toBe(true);
    });

    test('should deny access for unauthenticated users', () => {
      // Arrange
      authenticatedScene.isAuthenticated = false;

      // Act
      const result = authenticatedScene.requireAuth();

      // Assert
      expect(result).toBe(false);
    });

    test('should check required permissions', () => {
      // Arrange
      authenticatedScene.userContext = mockUserData;
      authenticatedScene.isAuthenticated = true;

      // Act & Assert
      expect(authenticatedScene.requireAuth(['play_game'])).toBe(true);
      expect(authenticatedScene.requireAuth(['admin_access'])).toBe(false);
    });

    test('should handle auth redirect', () => {
      // Arrange
      authenticatedScene.isAuthenticated = false;
      const mockRedirectToAuth = jest.fn();
      authenticatedScene.redirectToAuth = mockRedirectToAuth;

      // Act
      authenticatedScene.requireAuthOrRedirect();

      // Assert
      expect(mockRedirectToAuth).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup auth event listeners on destroy', () => {
      // Arrange
      authenticatedScene.create();

      // Act
      authenticatedScene.destroy();

      // Assert
      expect(authenticatedScene.registry.events.off).toHaveBeenCalledWith('auth-context-updated', expect.any(Function));
      expect(authenticatedScene.registry.events.off).toHaveBeenCalledWith('auth-state-changed', expect.any(Function));
    });

    test('should clear user context on destroy', () => {
      // Arrange
      authenticatedScene.userContext = mockUserData;

      // Act
      authenticatedScene.destroy();

      // Assert
      expect(authenticatedScene.userContext).toBe(null);
      expect(authenticatedScene.isAuthenticated).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle registry access errors gracefully', () => {
      // Arrange
      authenticatedScene.registry.get.mockImplementation(() => {
        throw new Error('Registry error');
      });

      // Act & Assert
      expect(() => authenticatedScene.create()).not.toThrow();
      expect(authenticatedScene.userContext).toBe(null);
      expect(authenticatedScene.isAuthenticated).toBe(false);
    });

    test('should handle malformed user data', () => {
      // Arrange
      authenticatedScene.registry.get.mockImplementation((key) => {
        if (key === 'userContext') return { malformed: 'data' };
        if (key === 'isAuthenticated') return true;
        return null;
      });

      // Act
      authenticatedScene.create();

      // Assert - Should handle gracefully
      expect(authenticatedScene.getUserId()).toBe(null);
      expect(authenticatedScene.getUsername()).toBe(null);
      expect(authenticatedScene.hasPermission('play_game')).toBe(false);
    });
  });
});