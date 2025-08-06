// TDD RED Phase - Write failing test for JWT Token Management
const JWTManager = require('../../src/auth/JWTManager.js');

describe('JWTManager', () => {
  let jwtManager;
  const mockConfig = {
    secret: 'test-secret-key',
    expiresIn: '1h',
    refreshExpiresIn: '7d',
    algorithm: 'HS256'
  };

  beforeEach(() => {
    jwtManager = new JWTManager(mockConfig);
  });

  describe('token generation', () => {
    it('should generate JWT token with user data', async () => {
      // Arrange
      const userData = {
        id: '123',
        username: 'testuser',
        email: 'test@example.com'
      };

      // Act
      const result = await jwtManager.generateToken(userData);

      // Assert
      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.expiresAt).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should include user information in token payload', async () => {
      // Arrange
      const userData = {
        id: '123',
        username: 'testuser',
        email: 'test@example.com'
      };

      // Act
      const result = await jwtManager.generateToken(userData);
      const decoded = await jwtManager.verifyToken(result.token);

      // Assert
      expect(decoded.id).toBe(userData.id);
      expect(decoded.username).toBe(userData.username);
      expect(decoded.email).toBe(userData.email);
      expect(decoded.iat).toBeDefined(); // issued at
      expect(decoded.exp).toBeDefined(); // expires
    });

    it('should have proper expiration time', async () => {
      // Arrange
      const userData = { id: '123', username: 'testuser' };
      const beforeGeneration = Date.now();

      // Act
      const result = await jwtManager.generateToken(userData);
      const decoded = await jwtManager.verifyToken(result.token);
      const afterGeneration = Date.now();

      // Assert
      const expectedExpiry = beforeGeneration + (60 * 60 * 1000); // 1 hour in ms
      const actualExpiry = decoded.exp * 1000; // convert to ms
      
      expect(actualExpiry).toBeGreaterThan(expectedExpiry - 1000); // allow 1s tolerance
      expect(actualExpiry).toBeLessThan(afterGeneration + (60 * 60 * 1000) + 1000);
    });
  });

  describe('token validation', () => {
    it('should validate successfully with correct secret', async () => {
      // Arrange
      const userData = { id: '123', username: 'testuser' };
      const { token } = await jwtManager.generateToken(userData);

      // Act
      const result = await jwtManager.verifyToken(token);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(userData.id);
      expect(result.username).toBe(userData.username);
    });

    it('should throw error with invalid token', async () => {
      // Arrange
      const invalidToken = 'invalid.token.here';

      // Act & Assert
      await expect(jwtManager.verifyToken(invalidToken)).rejects.toThrow();
    });

    it('should throw error with expired token', async () => {
      // Arrange - create manager with very short expiry
      const shortExpiryManager = new JWTManager({
        ...mockConfig,
        expiresIn: '1ms'
      });
      const userData = { id: '123', username: 'testuser' };
      const { token } = await shortExpiryManager.generateToken(userData);

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 10));

      // Act & Assert
      await expect(jwtManager.verifyToken(token)).rejects.toThrow();
    });
  });

  describe('token refresh', () => {
    it('should refresh token with valid refresh token', async () => {
      // Arrange
      const userData = { id: '123', username: 'testuser' };
      const { refreshToken } = await jwtManager.generateToken(userData);

      // Act
      const newTokens = await jwtManager.refreshToken(refreshToken);

      // Assert
      expect(newTokens).toBeDefined();
      expect(newTokens.token).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
      expect(typeof newTokens.token).toBe('string');
      expect(typeof newTokens.refreshToken).toBe('string');
    });

    it('should throw error with invalid refresh token', async () => {
      // Arrange
      const invalidRefreshToken = 'invalid.refresh.token';

      // Act & Assert
      await expect(jwtManager.refreshToken(invalidRefreshToken)).rejects.toThrow();
    });
  });

  describe('token parsing', () => {
    it('should parse token payload without verification', () => {
      // This is for cases where we need to read token data client-side
      // without verifying signature (useful for checking expiry client-side)
      const userData = { id: '123', username: 'testuser' };
      
      // We'll need to implement this as a synchronous method
      expect(() => {
        const payload = jwtManager.parseTokenPayload('some.jwt.token');
        expect(payload).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('automatic refresh scheduling', () => {
    it('should schedule automatic token refresh', async () => {
      // Arrange
      const userData = { id: '123', username: 'testuser' };
      const { token } = await jwtManager.generateToken(userData);
      let refreshCalled = false;
      const mockRefreshCallback = () => { refreshCalled = true; };

      // Act
      jwtManager.scheduleAutoRefresh(token, mockRefreshCallback);

      // Assert - we'll need to implement this functionality
      expect(jwtManager.refreshTimer).toBeDefined();
    });

    it('should clear existing refresh timer when scheduling new one', async () => {
      // Arrange
      const userData = { id: '123', username: 'testuser' };
      const { token } = await jwtManager.generateToken(userData);
      const mockCallback = () => {};

      // Act
      jwtManager.scheduleAutoRefresh(token, mockCallback);
      const firstTimer = jwtManager.refreshTimer;
      jwtManager.scheduleAutoRefresh(token, mockCallback);
      const secondTimer = jwtManager.refreshTimer;

      // Assert
      expect(firstTimer).toBeDefined();
      expect(secondTimer).toBeDefined();
      expect(firstTimer).not.toBe(secondTimer);
    });
  });

  describe('token invalidation mechanism', () => {
    it('should maintain a blacklist of invalidated tokens', async () => {
      // Arrange
      const userData = { id: '123', username: 'testuser' };
      const { token } = await jwtManager.generateToken(userData);

      // Act
      jwtManager.invalidateToken(token);

      // Assert
      expect(jwtManager.isTokenBlacklisted(token)).toBe(true);
    });

    it('should reject blacklisted tokens during verification', async () => {
      // Arrange
      const userData = { id: '123', username: 'testuser' };
      const { token } = await jwtManager.generateToken(userData);

      // Act
      jwtManager.invalidateToken(token);

      // Assert
      await expect(jwtManager.verifyToken(token)).rejects.toThrow('Token has been invalidated');
    });

    it('should allow clearing the token blacklist', async () => {
      // Arrange
      const userData = { id: '123', username: 'testuser' };
      const { token } = await jwtManager.generateToken(userData);
      jwtManager.invalidateToken(token);

      // Act
      jwtManager.clearBlacklist();

      // Assert
      expect(jwtManager.isTokenBlacklisted(token)).toBe(false);
    });

    it('should invalidate all tokens for a specific user', async () => {
      // Arrange
      const userData = { id: '123', username: 'testuser' };
      const { token: token1 } = await jwtManager.generateToken(userData);
      const { token: token2 } = await jwtManager.generateToken(userData);

      // Act
      jwtManager.invalidateAllUserTokens(userData.id);

      // Assert
      expect(jwtManager.isTokenBlacklisted(token1)).toBe(true);
      expect(jwtManager.isTokenBlacklisted(token2)).toBe(true);
    });

    it('should clean up expired blacklisted tokens', async () => {
      // Arrange
      const shortExpiryManager = new JWTManager({
        ...mockConfig,
        expiresIn: '50ms' // Increased from 1ms for more reliable testing
      });
      const userData = { id: '123', username: 'testuser' };
      const { token } = await shortExpiryManager.generateToken(userData);

      // Act
      shortExpiryManager.invalidateToken(token);
      expect(shortExpiryManager.isTokenBlacklisted(token)).toBe(true);
      
      // Wait for token to expire with more buffer time
      await new Promise(resolve => setTimeout(resolve, 100));
      
      shortExpiryManager.cleanupExpiredBlacklistedTokens();

      // Assert
      expect(shortExpiryManager.isTokenBlacklisted(token)).toBe(false);
      
      // Cleanup
      shortExpiryManager.cleanup();
    });

    it('should provide blacklist statistics', async () => {
      // Arrange - use different users to ensure separate tokens
      const userData1 = { id: '123', username: 'testuser1' };
      const userData2 = { id: '456', username: 'testuser2' };
      const { token: token1 } = await jwtManager.generateToken(userData1);
      const { token: token2 } = await jwtManager.generateToken(userData2);

      // Act
      jwtManager.invalidateToken(token1);
      jwtManager.invalidateToken(token2);
      const stats = jwtManager.getBlacklistStats();

      // Assert
      expect(stats.totalBlacklisted).toBe(2);
      expect(stats.blacklistedTokens).toContain(token1);
      expect(stats.blacklistedTokens).toContain(token2);
    });
  });
});