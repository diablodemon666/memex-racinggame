// TDD RED Phase - Write failing test first
const AuthManager = require('../../src/auth/AuthManager.js');
const authConfig = require('../../src/auth/config.js');

describe('AuthManager', () => {
  describe('instantiation', () => {
    it('should instantiate with valid config', () => {
      // Arrange
      const validConfig = {
        jwt: {
          secret: 'test-secret-key',
          expiresIn: '1h',
          refreshExpiresIn: '7d'
        },
        storage: {
          encryption: true,
          keyPrefix: 'memex_racing_'
        },
        validation: {
          minPasswordLength: 8,
          requireSpecialChars: true
        }
      };

      // Act & Assert
      expect(() => {
        const authManager = new AuthManager(validConfig);
        expect(authManager).toBeDefined();
      }).not.toThrow();
    });

    it('should throw error with invalid config', () => {
      // Arrange
      const invalidConfig = {};

      // Act & Assert
      expect(() => {
        new AuthManager(invalidConfig);
      }).toThrow('Invalid authentication configuration');
    });

    it('should expose required authentication methods', () => {
      // Arrange
      const validConfig = {
        jwt: {
          secret: 'test-secret-key',
          expiresIn: '1h',
          refreshExpiresIn: '7d'
        },
        storage: {
          encryption: true,
          keyPrefix: 'memex_racing_'
        },
        validation: {
          minPasswordLength: 8,
          requireSpecialChars: true
        }
      };

      // Act
      const authManager = new AuthManager(validConfig);

      // Assert
      expect(typeof authManager.register).toBe('function');
      expect(typeof authManager.login).toBe('function');
      expect(typeof authManager.logout).toBe('function');
      expect(typeof authManager.refreshToken).toBe('function');
      expect(typeof authManager.getCurrentUser).toBe('function');
      expect(typeof authManager.isAuthenticated).toBe('function');
    });
  });

  describe('configuration validation', () => {
    it('should validate JWT configuration', () => {
      // Arrange
      const configWithoutJWT = {
        storage: {
          encryption: true,
          keyPrefix: 'memex_racing_'
        }
      };

      // Act & Assert
      expect(() => {
        new AuthManager(configWithoutJWT);
      }).toThrow('JWT configuration is required');
    });

    it('should validate storage configuration', () => {
      // Arrange
      const configWithoutStorage = {
        jwt: {
          secret: 'test-secret-key',
          expiresIn: '1h'
        }
      };

      // Act & Assert
      expect(() => {
        new AuthManager(configWithoutStorage);
      }).toThrow('Storage configuration is required');
    });
  });

  describe('default configuration', () => {
    it('should use default config when imported', () => {
      // Act
      const authManager = new AuthManager(authConfig);

      // Assert
      expect(authManager).toBeDefined();
      expect(authManager.isAuthenticated()).toBe(false);
    });
  });
});