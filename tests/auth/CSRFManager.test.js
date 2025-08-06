// TDD RED Phase - Write failing test for CSRF Protection System
const CSRFManager = require('../../src/auth/CSRFManager.js');

describe('CSRFManager', () => {
  let csrfManager;
  const mockConfig = {
    tokenLength: 32,
    tokenExpiration: 60 * 60 * 1000, // 1 hour
    cookieName: 'csrf-token',
    headerName: 'X-CSRF-Token',
    cleanupInterval: 10 * 60 * 1000 // 10 minutes
  };

  beforeEach(() => {
    csrfManager = new CSRFManager(mockConfig);
  });

  afterEach(() => {
    if (csrfManager) {
      csrfManager.cleanup();
    }
  });

  describe('instantiation', () => {
    it('should instantiate with valid config', () => {
      // Act & Assert
      expect(() => {
        const manager = new CSRFManager(mockConfig);
        expect(manager).toBeDefined();
      }).not.toThrow();
    });

    it('should use default config when not provided', () => {
      // Act
      const manager = new CSRFManager({});

      // Assert
      expect(manager.config.tokenLength).toBeDefined();
      expect(manager.config.tokenExpiration).toBeDefined();
      expect(manager.config.cookieName).toBeDefined();
      expect(manager.config.headerName).toBeDefined();
    });
  });

  describe('token generation', () => {
    it('should generate unique CSRF tokens', () => {
      // Act
      const token1 = csrfManager.generateToken();
      const token2 = csrfManager.generateToken();

      // Assert
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(typeof token1).toBe('string');
      expect(typeof token2).toBe('string');
      expect(token1).not.toBe(token2);
      expect(token1.length).toBeGreaterThanOrEqual(32);
      expect(token2.length).toBeGreaterThanOrEqual(32);
    });

    it('should use crypto.getRandomValues() for token generation', () => {
      // Arrange
      const originalCrypto = global.crypto;
      const mockGetRandomValues = jest.fn((array) => {
        // Fill the array with test data
        for (let i = 0; i < array.length; i++) {
          array[i] = i % 256;
        }
        return array;
      });
      global.crypto = {
        getRandomValues: mockGetRandomValues
      };

      // Create a new CSRF manager with the mocked crypto
      const testManager = new CSRFManager(mockConfig);

      // Act
      testManager.generateToken();

      // Assert
      expect(mockGetRandomValues).toHaveBeenCalled();

      // Cleanup
      global.crypto = originalCrypto;
      testManager.cleanup();
    });

    it('should generate tokens with proper entropy', () => {
      // Act
      const tokens = [];
      for (let i = 0; i < 100; i++) {
        tokens.push(csrfManager.generateToken());
      }

      // Assert - all tokens should be unique
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(100);
    });
  });

  describe('token storage and retrieval', () => {
    it('should store and retrieve CSRF tokens', () => {
      // Arrange
      const sessionId = 'session123';
      const token = csrfManager.generateToken();

      // Act
      csrfManager.storeToken(sessionId, token);
      const retrievedToken = csrfManager.getToken(sessionId);

      // Assert
      expect(retrievedToken).toBe(token);
    });

    it('should return null for non-existent session', () => {
      // Act
      const token = csrfManager.getToken('non-existent-session');

      // Assert
      expect(token).toBeNull();
    });

    it('should handle multiple sessions independently', () => {
      // Arrange
      const session1 = 'session1';
      const session2 = 'session2';
      const token1 = csrfManager.generateToken();
      const token2 = csrfManager.generateToken();

      // Act
      csrfManager.storeToken(session1, token1);
      csrfManager.storeToken(session2, token2);

      // Assert
      expect(csrfManager.getToken(session1)).toBe(token1);
      expect(csrfManager.getToken(session2)).toBe(token2);
      expect(token1).not.toBe(token2);
    });
  });

  describe('token validation', () => {
    it('should validate correct CSRF tokens', () => {
      // Arrange
      const sessionId = 'session123';
      const token = csrfManager.generateToken();
      csrfManager.storeToken(sessionId, token);

      // Act
      const isValid = csrfManager.validateToken(sessionId, token);

      // Assert
      expect(isValid).toBe(true);
    });

    it('should reject invalid CSRF tokens', () => {
      // Arrange
      const sessionId = 'session123';
      const validToken = csrfManager.generateToken();
      const invalidToken = 'invalid-token';
      csrfManager.storeToken(sessionId, validToken);

      // Act
      const isValid = csrfManager.validateToken(sessionId, invalidToken);

      // Assert
      expect(isValid).toBe(false);
    });

    it('should reject tokens for non-existent sessions', () => {
      // Arrange
      const token = csrfManager.generateToken();

      // Act
      const isValid = csrfManager.validateToken('non-existent-session', token);

      // Assert
      expect(isValid).toBe(false);
    });

    it('should use constant-time comparison for token validation', () => {
      // This test ensures we use cryptographically secure comparison
      const sessionId = 'session123';
      const token = csrfManager.generateToken();
      csrfManager.storeToken(sessionId, token);

      // Create a token that differs only in the last character
      const similarToken = token.slice(0, -1) + (token.slice(-1) === 'a' ? 'b' : 'a');

      // Act & Assert
      const startTime = Date.now();
      const result1 = csrfManager.validateToken(sessionId, token);
      const time1 = Date.now() - startTime;

      const startTime2 = Date.now();
      const result2 = csrfManager.validateToken(sessionId, similarToken);
      const time2 = Date.now() - startTime2;

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      
      // Timing should be similar (within reasonable bounds)
      // This is a basic check, real timing attacks are more sophisticated
      expect(Math.abs(time1 - time2)).toBeLessThan(10);
    });
  });

  describe('token expiration', () => {
    it('should expire tokens after configured time', async () => {
      // Arrange
      const shortExpiryConfig = { ...mockConfig, tokenExpiration: 50 }; // 50ms
      const shortManager = new CSRFManager(shortExpiryConfig);
      const sessionId = 'session123';
      const token = shortManager.generateToken();

      // Act
      shortManager.storeToken(sessionId, token);
      
      // Verify token is initially valid
      expect(shortManager.validateToken(sessionId, token)).toBe(true);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Assert token is expired
      expect(shortManager.validateToken(sessionId, token)).toBe(false);

      shortManager.cleanup();
    });

    it('should clean up expired tokens automatically', async () => {
      // Arrange
      const quickCleanupConfig = { 
        ...mockConfig, 
        tokenExpiration: 25, // 25ms
        cleanupInterval: 50   // 50ms
      };
      const quickManager = new CSRFManager(quickCleanupConfig);
      const sessionId = 'session123';
      const token = quickManager.generateToken();

      // Act
      quickManager.storeToken(sessionId, token);
      
      // Wait for cleanup to run
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Assert token is removed
      expect(quickManager.getToken(sessionId)).toBeNull();

      quickManager.cleanup();
    });
  });

  describe('token invalidation', () => {
    it('should invalidate specific tokens', () => {
      // Arrange
      const sessionId = 'session123';
      const token = csrfManager.generateToken();
      csrfManager.storeToken(sessionId, token);

      // Act
      csrfManager.invalidateToken(sessionId);

      // Assert
      expect(csrfManager.getToken(sessionId)).toBeNull();
      expect(csrfManager.validateToken(sessionId, token)).toBe(false);
    });

    it('should invalidate all tokens', () => {
      // Arrange
      const session1 = 'session1';
      const session2 = 'session2';
      const token1 = csrfManager.generateToken();
      const token2 = csrfManager.generateToken();
      
      csrfManager.storeToken(session1, token1);
      csrfManager.storeToken(session2, token2);

      // Act
      csrfManager.invalidateAllTokens();

      // Assert
      expect(csrfManager.getToken(session1)).toBeNull();
      expect(csrfManager.getToken(session2)).toBeNull();
      expect(csrfManager.validateToken(session1, token1)).toBe(false);
      expect(csrfManager.validateToken(session2, token2)).toBe(false);
    });
  });

  describe('token refresh', () => {
    it('should refresh tokens for existing sessions', () => {
      // Arrange
      const sessionId = 'session123';
      const oldToken = csrfManager.generateToken();
      csrfManager.storeToken(sessionId, oldToken);

      // Act
      const newToken = csrfManager.refreshToken(sessionId);

      // Assert
      expect(newToken).toBeDefined();
      expect(newToken).not.toBe(oldToken);
      expect(csrfManager.getToken(sessionId)).toBe(newToken);
      expect(csrfManager.validateToken(sessionId, newToken)).toBe(true);
      expect(csrfManager.validateToken(sessionId, oldToken)).toBe(false);
    });

    it('should return null when refreshing non-existent session', () => {
      // Act
      const newToken = csrfManager.refreshToken('non-existent-session');

      // Assert
      expect(newToken).toBeNull();
    });
  });

  describe('middleware integration', () => {
    it('should provide middleware for Express.js integration', () => {
      // Act
      const middleware = csrfManager.expressMiddleware();

      // Assert
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3); // (req, res, next)
    });

    it('should generate and set CSRF token in response', () => {
      // Arrange
      const middleware = csrfManager.expressMiddleware();
      const mockReq = { 
        session: { id: 'session123' },
        method: 'GET',
        secure: false,
        headers: {
          'x-forwarded-proto': 'http'
        }
      };
      const mockRes = {
        cookie: jest.fn(),
        locals: {}
      };
      const mockNext = jest.fn();

      // Act
      middleware(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.cookie).toHaveBeenCalledWith(
        mockConfig.cookieName,
        expect.any(String),
        expect.objectContaining({
          httpOnly: false,
          secure: false,
          sameSite: 'strict'
        })
      );
      expect(mockRes.locals.csrfToken).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });
});