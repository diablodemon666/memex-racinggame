// TDD RED Phase - Write failing test for Rate Limiting System
const RateLimiter = require('../../src/auth/RateLimiter.js');

describe('RateLimiter', () => {
  let rateLimiter;
  const mockConfig = {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDuration: 15 * 60 * 1000, // 15 minutes
    cleanupInterval: 5 * 60 * 1000 // 5 minutes
  };

  beforeEach(() => {
    rateLimiter = new RateLimiter(mockConfig);
  });

  afterEach(() => {
    if (rateLimiter) {
      rateLimiter.cleanup();
    }
  });

  describe('instantiation', () => {
    it('should instantiate with valid config', () => {
      // Act & Assert
      expect(() => {
        const limiter = new RateLimiter(mockConfig);
        expect(limiter).toBeDefined();
      }).not.toThrow();
    });

    it('should throw error with invalid config', () => {
      // Arrange
      const invalidConfig = null;

      // Act & Assert
      expect(() => {
        new RateLimiter(invalidConfig);
      }).toThrow('RateLimiter configuration is required');
    });

    it('should use default config when not provided', () => {
      // Act
      const limiter = new RateLimiter({});

      // Assert
      expect(limiter.config.maxAttempts).toBeDefined();
      expect(limiter.config.windowMs).toBeDefined();
      expect(limiter.config.blockDuration).toBeDefined();
    });
  });

  describe('rate limiting functionality', () => {
    it('should allow requests within limit', async () => {
      // Arrange
      const identifier = 'user123';

      // Act
      const result1 = await rateLimiter.checkLimit(identifier);
      const result2 = await rateLimiter.checkLimit(identifier);
      const result3 = await rateLimiter.checkLimit(identifier);

      // Assert
      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result3.allowed).toBe(true);
      expect(result1.remainingAttempts).toBe(4);
      expect(result2.remainingAttempts).toBe(3);
      expect(result3.remainingAttempts).toBe(2);
    });

    it('should block requests after exceeding limit', async () => {
      // Arrange
      const identifier = 'user123';

      // Act - make 5 requests (maxAttempts)
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit(identifier);
      }
      
      // Try one more request
      const blockedResult = await rateLimiter.checkLimit(identifier);

      // Assert
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.remainingAttempts).toBe(0);
      expect(blockedResult.blockedUntil).toBeDefined();
      expect(blockedResult.blockedUntil).toBeInstanceOf(Date);
    });

    it('should track different identifiers separately', async () => {
      // Arrange
      const user1 = 'user123';
      const user2 = 'user456';

      // Act - exhaust attempts for user1
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit(user1);
      }
      
      const user1Blocked = await rateLimiter.checkLimit(user1);
      const user2Allowed = await rateLimiter.checkLimit(user2);

      // Assert
      expect(user1Blocked.allowed).toBe(false);
      expect(user2Allowed.allowed).toBe(true);
    });

    it('should reset attempts after time window expires', async () => {
      // This test requires time manipulation
      const identifier = 'user123';
      const shortWindowConfig = { ...mockConfig, windowMs: 100 }; // 100ms window
      const shortLimiter = new RateLimiter(shortWindowConfig);

      // Act - exhaust attempts
      for (let i = 0; i < 5; i++) {
        await shortLimiter.checkLimit(identifier);
      }
      
      const blockedResult = await shortLimiter.checkLimit(identifier);
      expect(blockedResult.allowed).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Manually unblock to test window reset (since block duration is longer)
      await shortLimiter.unblockIdentifier(identifier);
      
      const resetResult = await shortLimiter.checkLimit(identifier);

      // Assert
      expect(resetResult.allowed).toBe(true);
      expect(resetResult.remainingAttempts).toBe(4);

      shortLimiter.cleanup();
    });
  });

  describe('blocking functionality', () => {
    it('should block identifier immediately', async () => {
      // Arrange
      const identifier = 'user123';

      // Act
      await rateLimiter.blockIdentifier(identifier);
      const result = await rateLimiter.checkLimit(identifier);

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.blockedUntil).toBeDefined();
    });

    it('should unblock identifier', async () => {
      // Arrange
      const identifier = 'user123';
      await rateLimiter.blockIdentifier(identifier);

      // Act
      await rateLimiter.unblockIdentifier(identifier);
      const result = await rateLimiter.checkLimit(identifier);

      // Assert
      expect(result.allowed).toBe(true);
    });

    it('should check if identifier is blocked', async () => {
      // Arrange
      const identifier = 'user123';

      // Act & Assert - initially not blocked
      const initiallyBlocked = await rateLimiter.isBlocked(identifier);
      expect(initiallyBlocked).toBe(false);

      // Block the identifier
      await rateLimiter.blockIdentifier(identifier);
      const nowBlocked = await rateLimiter.isBlocked(identifier);
      expect(nowBlocked).toBe(true);
    });
  });

  describe('attempt recording', () => {
    it('should record failed attempts', async () => {
      // Arrange
      const identifier = 'user123';

      // Act
      await rateLimiter.recordFailedAttempt(identifier);
      await rateLimiter.recordFailedAttempt(identifier);
      const result = await rateLimiter.checkLimit(identifier);

      // Assert
      expect(result.remainingAttempts).toBe(2); // 5 - 2 failed attempts - 1 check = 2
    });

    it('should record successful attempts and reset counter', async () => {
      // Arrange
      const identifier = 'user123';
      await rateLimiter.recordFailedAttempt(identifier);
      await rateLimiter.recordFailedAttempt(identifier);

      // Act
      await rateLimiter.recordSuccessfulAttempt(identifier);
      const result = await rateLimiter.checkLimit(identifier);

      // Assert
      expect(result.remainingAttempts).toBe(4); // Reset to maxAttempts - 1
    });
  });

  describe('cleanup functionality', () => {
    it('should clean up expired entries', async () => {
      // Arrange
      const shortWindowConfig = { 
        ...mockConfig, 
        windowMs: 50, // 50ms window
        cleanupInterval: 25 // 25ms cleanup interval
      };
      const shortLimiter = new RateLimiter(shortWindowConfig);
      const identifier = 'user123';

      // Act
      await shortLimiter.recordFailedAttempt(identifier);
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = await shortLimiter.checkLimit(identifier);

      // Assert - should be reset after cleanup
      expect(result.remainingAttempts).toBe(4); // Fresh start

      shortLimiter.cleanup();
    });

    it('should stop cleanup timer on manual cleanup', () => {
      // Arrange & Act
      const limiter = new RateLimiter(mockConfig);
      const cleanupTimer = limiter.cleanupTimer;
      
      limiter.cleanup();

      // Assert
      expect(limiter.cleanupTimer).toBeNull();
    });
  });

  describe('IP-based rate limiting', () => {
    it('should support IP address identification', async () => {
      // Arrange
      const ipAddress = '192.168.1.1';

      // Act
      const result = await rateLimiter.checkLimit(ipAddress);

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.identifier).toBe(ipAddress);
    });

    it('should support combined user+IP identification', async () => {
      // Arrange
      const userIpCombo = 'user123|192.168.1.1';

      // Act
      const result = await rateLimiter.checkLimit(userIpCombo);

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.identifier).toBe(userIpCombo);
    });
  });
});