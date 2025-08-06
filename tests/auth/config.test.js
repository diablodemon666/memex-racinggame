// TDD RED Phase - Write failing test for Authentication Configuration Security
const authConfig = require('../../src/auth/config.js');

describe('Authentication Configuration Security', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment (create a copy)
    originalEnv = { ...process.env };
    
    // Ensure test environment has required variables
    if (!process.env.BCRYPT_SALT_ROUNDS) {
      process.env.BCRYPT_SALT_ROUNDS = '12';
    }
  });

  afterEach(() => {
    // Clear config cache and module cache
    const config = require('../../src/auth/config.js');
    if (config.clearAuthConfigCache) {
      config.clearAuthConfigCache();
    }
    delete require.cache[require.resolve('../../src/auth/config.js')];
    delete require.cache[require.resolve('../../src/config/environment.js')];
    
    // Restore original environment (properly restore keys)
    Object.keys(process.env).forEach(key => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);
  });

  describe('JWT secret enforcement', () => {
    it('should enforce JWT secret from environment variable only', () => {
      // Arrange - save and clear JWT_SECRET environment variable
      const savedSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      // Act & Assert - should throw error when no JWT_SECRET is set
      expect(() => {
        // Force re-evaluation of the config module
        delete require.cache[require.resolve('../../src/auth/config.js')];
        delete require.cache[require.resolve('../../src/config/environment.js')];
        const config = require('../../src/auth/config.js');
        config.clearAuthConfigCache();
        // Access a property to trigger config loading
        return config.jwt.secret;
      }).toThrow('JWT_SECRET environment variable is required');

      // Restore original secret
      process.env.JWT_SECRET = savedSecret;
    });

    it('should use JWT secret from environment variable when provided', () => {
      // Arrange
      const savedSecret = process.env.JWT_SECRET;
      const testSecret = 'test-secure-jwt-secret-from-env-12345';
      process.env.JWT_SECRET = testSecret;

      // Act
      delete require.cache[require.resolve('../../src/auth/config.js')];
      const config = require('../../src/auth/config.js');

      // Assert
      expect(config.jwt.secret).toBe(testSecret);
      expect(config.jwt.secret).not.toContain('default');
      expect(config.jwt.secret).not.toContain('change-in-production');

      // Restore original secret
      process.env.JWT_SECRET = savedSecret;
    });

    it('should reject weak default secrets', () => {
      // Arrange
      const savedSecret = process.env.JWT_SECRET;
      const weakSecrets = [
        'default',
        'secret',
        'password',
        'memex-racing-default-secret-change-in-production',
        '123456',
        'test'
      ];

      for (const weakSecret of weakSecrets) {
        process.env.JWT_SECRET = weakSecret;

        // Act & Assert
        expect(() => {
          delete require.cache[require.resolve('../../src/auth/config.js')];
          require('../../src/auth/config.js');
        }).toThrow('JWT secret is too weak');
      }

      // Restore original secret
      process.env.JWT_SECRET = savedSecret;
    });

    it('should require minimum secret length (32 characters)', () => {
      // Arrange
      const savedSecret = process.env.JWT_SECRET;
      const shortSecret = 'short';
      process.env.JWT_SECRET = shortSecret;

      // Act & Assert
      expect(() => {
        delete require.cache[require.resolve('../../src/auth/config.js')];
        require('../../src/auth/config.js');
      }).toThrow('JWT secret must be at least 32 characters long');

      // Restore original secret
      process.env.JWT_SECRET = savedSecret;
    });

    it('should accept strong JWT secrets', () => {
      // Arrange
      const savedSecret = process.env.JWT_SECRET;
      const strongSecret = 'very-secure-jwt-secret-with-sufficient-length-and-complexity-12345';
      process.env.JWT_SECRET = strongSecret;

      // Act
      delete require.cache[require.resolve('../../src/auth/config.js')];
      const config = require('../../src/auth/config.js');

      // Assert
      expect(config.jwt.secret).toBe(strongSecret);
      expect(config.jwt.secret.length).toBeGreaterThanOrEqual(32);

      // Restore original secret
      process.env.JWT_SECRET = savedSecret;
    });
  });

  describe('security configuration validation', () => {
    beforeEach(() => {
      // Set valid JWT secret for other tests
      process.env.JWT_SECRET = 'secure-jwt-secret-for-testing-with-sufficient-length-12345';
    });

    it('should have secure default configurations', () => {
      // Act
      delete require.cache[require.resolve('../../src/auth/config.js')];
      const config = require('../../src/auth/config.js');

      // Assert
      expect(config.validation.minPasswordLength).toBeGreaterThanOrEqual(8);
      expect(config.validation.requireSpecialChars).toBe(true);
      expect(config.validation.requireNumbers).toBe(true);
      expect(config.validation.requireUppercase).toBe(true);
      expect(config.validation.maxLoginAttempts).toBeLessThanOrEqual(5);
      expect(config.validation.lockoutDuration).toBeGreaterThanOrEqual(15 * 60 * 1000); // 15 minutes
    });

    it('should use strong algorithm for JWT', () => {
      // Act
      delete require.cache[require.resolve('../../src/auth/config.js')];
      const config = require('../../src/auth/config.js');

      // Assert
      expect(config.jwt.algorithm).toBe('HS256');
      expect(['HS256', 'HS384', 'HS512']).toContain(config.jwt.algorithm);
    });

    it('should have reasonable token expiration times', () => {
      // Act
      delete require.cache[require.resolve('../../src/auth/config.js')];
      const config = require('../../src/auth/config.js');

      // Assert
      expect(config.jwt.expiresIn).toBeDefined();
      expect(config.jwt.refreshExpiresIn).toBeDefined();
      expect(typeof config.jwt.expiresIn).toBe('string');
      expect(typeof config.jwt.refreshExpiresIn).toBe('string');
    });

    it('should enable encryption by default', () => {
      // Act
      delete require.cache[require.resolve('../../src/auth/config.js')];
      const config = require('../../src/auth/config.js');

      // Assert
      expect(config.storage.encryption).toBe(true);
      expect(config.storage.algorithm).toMatch(/AES/); // Accept AES-256-GCM or similar
      expect(config.storage.keyDerivation).toBe('PBKDF2');
    });
  });

  describe('rate limiting configuration', () => {
    beforeEach(() => {
      process.env.JWT_SECRET = 'secure-jwt-secret-for-testing-with-sufficient-length-12345';
    });

    it('should have secure rate limiting defaults', () => {
      // Act
      delete require.cache[require.resolve('../../src/auth/config.js')];
      const config = require('../../src/auth/config.js');

      // Assert
      expect(config.validation.maxLoginAttempts).toBeGreaterThan(0);
      expect(config.validation.maxLoginAttempts).toBeLessThanOrEqual(10);
      expect(config.validation.lockoutDuration).toBeGreaterThan(0);
    });
  });
});