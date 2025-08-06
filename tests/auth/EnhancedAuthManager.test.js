// Enhanced Authentication Manager Tests
// Comprehensive test suite for enterprise authentication system

const EnhancedAuthManager = require('../../src/auth/EnhancedAuthManager');
const { jest } = require('@jest/globals');

// Mock dependencies
jest.mock('../../src/utils/MemoryRegistry', () => ({
  memoryRegistry: {
    cleanupScope: jest.fn(),
    registerInterval: jest.fn(),
    removeResource: jest.fn()
  }
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123')
}));

describe('EnhancedAuthManager', () => {
  let authManager;
  let mockConfig;

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock configuration
    mockConfig = {
      jwt: {
        secret: 'test-secret-key-must-be-long-enough-for-security',
        expiresIn: '1h',
        refreshExpiresIn: '7d'
      },
      session: {
        maxSessionsPerUser: 3,
        sessionTimeout: 24 * 60 * 60 * 1000
      },
      security: {
        environment: 'test',
        maxLoginAttempts: 3
      },
      storage: {
        encryption: false // Disable for testing
      },
      roles: {
        defaultRole: 'user'
      }
    };
    
    authManager = new EnhancedAuthManager(mockConfig);
  });

  afterEach(() => {
    if (authManager) {
      authManager.destroy();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      const defaultAuthManager = new EnhancedAuthManager();
      expect(defaultAuthManager).toBeDefined();
      expect(defaultAuthManager.isAuthenticated()).toBe(false);
      defaultAuthManager.destroy();
    });

    test('should initialize all subsystems', () => {
      expect(authManager.jwtManager).toBeDefined();
      expect(authManager.sessionManager).toBeDefined();
      expect(authManager.passwordResetManager).toBeDefined();
      expect(authManager.securityManager).toBeDefined();
      expect(authManager.roleManager).toBeDefined();
      expect(authManager.storageManager).toBeDefined();
      expect(authManager.passwordHasher).toBeDefined();
    });

    test('should setup event handlers correctly', () => {
      expect(authManager.listenerCount('sessionCreated')).toBeGreaterThan(0);
      expect(authManager.listenerCount('securityEvent')).toBeGreaterThan(0);
    });
  });

  describe('User Registration', () => {
    const validUserData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'SecurePass123!'
    };

    test('should register a new user successfully', async () => {
      const result = await authManager.register(validUserData);
      
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.username).toBe(validUserData.username);
      expect(result.user.email).toBe(validUserData.email);
      expect(result.session).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    test('should set user as authenticated after registration', async () => {
      await authManager.register(validUserData);
      
      expect(authManager.isAuthenticated()).toBe(true);
      expect(authManager.getCurrentUser()).toBeDefined();
      expect(authManager.getCurrentSession()).toBeDefined();
    });

    test('should assign default role to new user', async () => {
      const result = await authManager.register(validUserData);
      
      const userRoles = authManager.getUserRoles(result.user.id);
      expect(userRoles).toContain('user');
    });

    test('should reject registration with invalid username', async () => {
      const invalidData = { ...validUserData, username: 'ab' }; // Too short
      
      await expect(authManager.register(invalidData))
        .rejects.toThrow('Username must be at least 3 characters');
    });

    test('should reject registration with invalid email', async () => {
      const invalidData = { ...validUserData, email: 'invalid-email' };
      
      await expect(authManager.register(invalidData))
        .rejects.toThrow('Invalid email format');
    });

    test('should reject registration with weak password', async () => {
      const invalidData = { ...validUserData, password: 'weak' };
      
      await expect(authManager.register(invalidData))
        .rejects.toThrow('Password must be at least 8 characters');
    });

    test('should reject duplicate username', async () => {
      await authManager.register(validUserData);
      
      const duplicateData = { ...validUserData, email: 'different@example.com' };
      await expect(authManager.register(duplicateData))
        .rejects.toThrow('Username already exists');
    });

    test('should reject duplicate email', async () => {
      await authManager.register(validUserData);
      
      const duplicateData = { ...validUserData, username: 'differentuser' };
      await expect(authManager.register(duplicateData))
        .rejects.toThrow('Email already exists');
    });

    test('should emit userRegistered event', async () => {
      const eventSpy = jest.fn();
      authManager.on('userRegistered', eventSpy);
      
      await authManager.register(validUserData);
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.any(Object),
          session: expect.any(Object),
          tokens: expect.any(Object)
        })
      );
    });
  });

  describe('User Login', () => {
    const validUserData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'SecurePass123!'
    };

    beforeEach(async () => {
      // Register a user first
      await authManager.register(validUserData);
      await authManager.logout(); // Logout to test login
    });

    test('should login with valid credentials', async () => {
      const credentials = {
        username: validUserData.username,
        password: validUserData.password
      };
      
      const result = await authManager.login(credentials);
      
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.username).toBe(validUserData.username);
      expect(result.session).toBeDefined();
      expect(result.tokens).toBeDefined();
    });

    test('should set user as authenticated after login', async () => {
      const credentials = {
        username: validUserData.username,
        password: validUserData.password
      };
      
      await authManager.login(credentials);
      
      expect(authManager.isAuthenticated()).toBe(true);
      expect(authManager.getCurrentUser()).toBeDefined();
    });

    test('should reject login with invalid username', async () => {
      const credentials = {
        username: 'nonexistentuser',
        password: validUserData.password
      };
      
      await expect(authManager.login(credentials))
        .rejects.toThrow('Invalid username or password');
    });

    test('should reject login with invalid password', async () => {
      const credentials = {
        username: validUserData.username,
        password: 'wrongpassword'
      };
      
      await expect(authManager.login(credentials))
        .rejects.toThrow('Invalid username or password');
    });

    test('should emit userLoggedIn event', async () => {
      const eventSpy = jest.fn();
      authManager.on('userLoggedIn', eventSpy);
      
      const credentials = {
        username: validUserData.username,
        password: validUserData.password
      };
      
      await authManager.login(credentials);
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.any(Object),
          session: expect.any(Object),
          tokens: expect.any(Object)
        })
      );
    });

    test('should enforce rate limiting on login attempts', async () => {
      const credentials = {
        username: 'nonexistentuser',
        password: 'wrongpassword'
      };
      
      // Make multiple failed attempts
      for (let i = 0; i < mockConfig.security.maxLoginAttempts; i++) {
        try {
          await authManager.login(credentials, { ipAddress: '127.0.0.1' });
        } catch (error) {
          // Expected to fail
        }
      }
      
      // Next attempt should be rate limited
      await expect(authManager.login(credentials, { ipAddress: '127.0.0.1' }))
        .rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('User Logout', () => {
    const validUserData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'SecurePass123!'
    };

    beforeEach(async () => {
      await authManager.register(validUserData);
    });

    test('should logout successfully', async () => {
      const result = await authManager.logout();
      
      expect(result.success).toBe(true);
      expect(authManager.isAuthenticated()).toBe(false);
      expect(authManager.getCurrentUser()).toBe(null);
      expect(authManager.getCurrentSession()).toBe(null);
    });

    test('should emit userLoggedOut event', async () => {
      const eventSpy = jest.fn();
      authManager.on('userLoggedOut', eventSpy);
      
      await authManager.logout();
      
      expect(eventSpy).toHaveBeenCalled();
    });

    test('should logout from all devices when requested', async () => {
      const result = await authManager.logout({ logoutAllDevices: true });
      
      expect(result.success).toBe(true);
      expect(authManager.isAuthenticated()).toBe(false);
    });
  });

  describe('Token Management', () => {
    let userTokens;
    
    beforeEach(async () => {
      const validUserData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!'
      };
      
      const result = await authManager.register(validUserData);
      userTokens = result.tokens;
    });

    test('should validate valid token', async () => {
      const validation = await authManager.validateToken(userTokens.accessToken);
      
      expect(validation.valid).toBe(true);
      expect(validation.user).toBeDefined();
      expect(validation.session).toBeDefined();
    });

    test('should reject invalid token', async () => {
      const validation = await authManager.validateToken('invalid-token');
      
      expect(validation.valid).toBe(false);
      expect(validation.error).toBeDefined();
    });

    test('should refresh token successfully', async () => {
      const result = await authManager.refreshToken(userTokens.refreshToken);
      
      expect(result.success).toBe(true);
      expect(result.tokens).toBeDefined();
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.accessToken).not.toBe(userTokens.accessToken);
    });

    test('should reject refresh with invalid token', async () => {
      await expect(authManager.refreshToken('invalid-refresh-token'))
        .rejects.toThrow('Token refresh failed');
    });
  });

  describe('Password Reset', () => {
    const validUserData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'SecurePass123!'
    };

    beforeEach(async () => {
      await authManager.register(validUserData);
    });

    test('should request password reset', async () => {
      const result = await authManager.requestPasswordReset(validUserData.email);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('reset link will be sent');
    });

    test('should not reveal if email does not exist', async () => {
      const result = await authManager.requestPasswordReset('nonexistent@example.com');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('reset link will be sent');
    });

    // Note: Full password reset flow testing would require more complex setup
    // due to token generation and verification
  });

  describe('Role and Permission Management', () => {
    let userId;

    beforeEach(async () => {
      const validUserData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!'
      };
      
      const result = await authManager.register(validUserData);
      userId = result.user.id;
    });

    test('should check user permissions', () => {
      const hasPermission = authManager.hasPermission(userId, 'game.play');
      expect(typeof hasPermission).toBe('boolean');
    });

    test('should check user roles', () => {
      const hasRole = authManager.hasRole(userId, 'user');
      expect(hasRole).toBe(true);
    });

    test('should get user roles', () => {
      const roles = authManager.getUserRoles(userId);
      expect(Array.isArray(roles)).toBe(true);
      expect(roles).toContain('user');
    });

    test('should get user permissions', () => {
      const permissions = authManager.getUserPermissions(userId);
      expect(Array.isArray(permissions)).toBe(true);
    });
  });

  describe('Security Features', () => {
    beforeEach(async () => {
      const validUserData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!'
      };
      
      await authManager.register(validUserData);
    });

    test('should generate CSRF token', () => {
      const sessionId = authManager.getCurrentSession()?.id;
      const token = authManager.generateCSRFToken(sessionId);
      
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    test('should validate CSRF token', () => {
      const sessionId = authManager.getCurrentSession()?.id;
      const token = authManager.generateCSRFToken(sessionId);
      
      const isValid = authManager.validateCSRFToken(sessionId, token);
      expect(isValid).toBe(true);
    });

    test('should reject invalid CSRF token', () => {
      const sessionId = authManager.getCurrentSession()?.id;
      
      expect(() => {
        authManager.validateCSRFToken(sessionId, 'invalid-token');
      }).toThrow('Invalid CSRF token');
    });

    test('should get security headers', () => {
      const headers = authManager.getSecurityHeaders();
      
      expect(typeof headers).toBe('object');
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Frame-Options']).toBe('DENY');
    });
  });

  describe('Input Validation', () => {
    test('should validate registration data', () => {
      const validData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!'
      };
      
      const validated = authManager.validateRegistrationData(validData);
      
      expect(validated.username).toBe('testuser');
      expect(validated.email).toBe('test@example.com');
      expect(validated.password).toBe('SecurePass123!');
    });

    test('should validate login credentials', () => {
      const validCredentials = {
        username: 'testuser',
        password: 'SecurePass123!'
      };
      
      const validated = authManager.validateLoginCredentials(validCredentials);
      
      expect(validated.username).toBe('testuser');
      expect(validated.password).toBe('SecurePass123!');
    });

    test('should reject invalid input during validation', () => {
      expect(() => {
        authManager.validateRegistrationData({
          username: '', // Empty username
          email: 'test@example.com',
          password: 'SecurePass123!'
        });
      }).toThrow();
    });
  });

  describe('System Statistics', () => {
    test('should provide system statistics', () => {
      const stats = authManager.getSystemStats();
      
      expect(typeof stats).toBe('object');
      expect(stats.authentication).toBeDefined();
      expect(stats.jwt).toBeDefined();
      expect(stats.sessions).toBeDefined();
      expect(stats.security).toBeDefined();
      expect(stats.roles).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle initialization errors gracefully', () => {
      const invalidConfig = {
        jwt: {
          secret: 'short' // Too short for security
        }
      };
      
      expect(() => {
        new EnhancedAuthManager(invalidConfig);
      }).toThrow();
    });

    test('should clear state on authentication errors', async () => {
      const invalidData = {
        username: 'testuser',
        email: 'invalid-email', // Invalid email
        password: 'SecurePass123!'
      };
      
      try {
        await authManager.register(invalidData);
      } catch (error) {
        expect(authManager.isAuthenticated()).toBe(false);
        expect(authManager.getCurrentUser()).toBe(null);
      }
    });
  });

  describe('Memory Management', () => {
    test('should cleanup resources on destroy', () => {
      const destroySpy = jest.spyOn(authManager, 'destroy');
      
      authManager.destroy();
      
      expect(destroySpy).toHaveBeenCalled();
      expect(authManager.isAuthenticated()).toBe(false);
      expect(authManager.getCurrentUser()).toBe(null);
    });
  });

  describe('Event System', () => {
    test('should emit security events', async () => {
      const eventSpy = jest.fn();
      authManager.on('securityEvent', eventSpy);
      
      // Trigger a security event by attempting invalid login
      try {
        await authManager.login({
          username: 'nonexistent',
          password: 'wrong'
        });
      } catch (error) {
        // Expected to fail
      }
      
      // Security events are emitted asynchronously, so we might need to wait
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete user lifecycle', async () => {
      // Register
      const userData = {
        username: 'lifecycleuser',
        email: 'lifecycle@example.com',
        password: 'SecurePass123!'
      };
      
      const registerResult = await authManager.register(userData);
      expect(registerResult.success).toBe(true);
      expect(authManager.isAuthenticated()).toBe(true);
      
      // Logout
      await authManager.logout();
      expect(authManager.isAuthenticated()).toBe(false);
      
      // Login
      const loginResult = await authManager.login({
        username: userData.username,
        password: userData.password
      });
      expect(loginResult.success).toBe(true);
      expect(authManager.isAuthenticated()).toBe(true);
      
      // Token refresh
      const refreshResult = await authManager.refreshToken(loginResult.tokens.refreshToken);
      expect(refreshResult.success).toBe(true);
      
      // Final logout
      await authManager.logout();
      expect(authManager.isAuthenticated()).toBe(false);
    });
  });
});