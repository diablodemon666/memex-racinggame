// Test for auth module index and factory function
const { AuthManager, authConfig, createAuthManager } = require('../../src/auth/index.js');

describe('Auth Module Index', () => {
  describe('exports', () => {
    it('should export AuthManager class', () => {
      expect(AuthManager).toBeDefined();
      expect(typeof AuthManager).toBe('function');
    });

    it('should export authConfig object', () => {
      expect(authConfig).toBeDefined();
      expect(typeof authConfig).toBe('object');
      expect(authConfig.jwt).toBeDefined();
      expect(authConfig.storage).toBeDefined();
    });

    it('should export createAuthManager factory function', () => {
      expect(createAuthManager).toBeDefined();
      expect(typeof createAuthManager).toBe('function');
    });
  });

  describe('createAuthManager factory', () => {
    it('should create AuthManager with default config', () => {
      // Act
      const authManager = createAuthManager();

      // Assert
      expect(authManager).toBeInstanceOf(AuthManager);
      expect(authManager.isAuthenticated()).toBe(false);
    });

    it('should create AuthManager with custom config overrides', () => {
      // Arrange
      const customConfig = {
        jwt: {
          secret: 'custom-secret',
          expiresIn: '2h'
        }
      };

      // Act
      const authManager = createAuthManager(customConfig);

      // Assert
      expect(authManager).toBeInstanceOf(AuthManager);
      expect(authManager.config.jwt.secret).toBe('custom-secret');
      expect(authManager.config.jwt.expiresIn).toBe('2h');
      // Should still have default storage config
      expect(authManager.config.storage.encryption).toBe(true);
    });
  });
});