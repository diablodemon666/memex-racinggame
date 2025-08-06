// AuthManager Password Security Integration Tests
// Tests for the integration of password hashing in AuthManager

const AuthManager = require('../../src/auth/AuthManager.js');
const PasswordHasher = require('../../src/auth/PasswordHasher.js');

// Mock localStorage and other browser APIs
const mockLocalStorage = {
  storage: new Map(),
  getItem: jest.fn().mockImplementation(function(key) {
    return this.storage.get(key) || null;
  }),
  setItem: jest.fn().mockImplementation(function(key, value) {
    this.storage.set(key, value);
  }),
  removeItem: jest.fn().mockImplementation(function(key) {
    this.storage.delete(key);
  }),
  clear: jest.fn().mockImplementation(function() {
    this.storage.clear();
  })
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

// Mock crypto.getRandomValues
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: jest.fn().mockImplementation((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    })
  },
  writable: true
});

// Mock screen for browser fingerprinting
Object.defineProperty(global, 'screen', {
  value: { width: 1920, height: 1080 },
  writable: true
});

// Mock navigator
Object.defineProperty(global, 'navigator', {
  value: {
    userAgent: 'test-agent',
    language: 'en-US'
  },
  writable: true
});

describe('AuthManager Password Security Integration', () => {
  let authManager;
  let passwordHasher;

  const validConfig = {
    jwt: {
      secret: 'test-secret-key-that-is-long-enough-for-security',
      expiresIn: '1h',
      refreshExpiresIn: '7d'
    },
    storage: {
      encryption: true,
      keyPrefix: 'memex_racing_test_'
    },
    passwordHashing: {
      saltRounds: 12 // Use production-level security for tests
    }
  };

  beforeEach(() => {
    // Clear localStorage
    mockLocalStorage.storage.clear();
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
    
    // Create fresh instances
    authManager = new AuthManager(validConfig);
    passwordHasher = new PasswordHasher();
  });

  describe('Password Hashing Integration', () => {
    it('should hash passwords during registration', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePassword123!'
      };

      const result = await authManager.register(userData);
      
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();

      // Verify password is hashed in storage
      const storedPassword = await authManager.storageManager.getStoredPassword(result.user.id);
      expect(storedPassword).toBeDefined();
      expect(storedPassword).not.toBe(userData.password); // Should not be plaintext
      expect(passwordHasher.isValidBcryptHash(storedPassword)).toBe(true);
    });

    it('should verify hashed passwords during login', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePassword123!'
      };

      // Register user first
      const registerResult = await authManager.register(userData);
      expect(registerResult.success).toBe(true);

      // Logout to clear state
      await authManager.logout();

      // Login with correct password
      const loginResult = await authManager.login({
        username: userData.username,
        password: userData.password
      });

      expect(loginResult.success).toBe(true);
      expect(loginResult.user).toBeDefined();
      expect(loginResult.tokens).toBeDefined();
    });

    it('should reject incorrect passwords', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePassword123!'
      };

      // Register user first
      await authManager.register(userData);
      await authManager.logout();

      // Try to login with wrong password
      await expect(authManager.login({
        username: userData.username,
        password: 'WrongPassword123!'
      })).rejects.toThrow('Invalid username or password');
    });
  });

  describe('Password Migration from Plaintext', () => {
    it('should migrate plaintext passwords during login', async () => {
      const userData = {
        username: 'legacyuser',
        email: 'legacy@example.com',
        password: 'LegacyPassword123!'
      };

      // Create user entry in registry
      const userId = 'legacy-user-id';
      const legacyUser = {
        id: userId,
        username: userData.username,
        email: userData.email,
        status: 'active',
        isVerified: false,
        profile: {
          displayName: userData.username,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        },
        statistics: {
          gamesPlayed: 0,
          wins: 0,
          losses: 0
        }
      };

      // Manually store legacy user data and plaintext password
      const users = [{ id: userId, username: userData.username, email: userData.email }];
      localStorage.setItem('memex_racing_users', JSON.stringify(users));
      
      // Store plaintext password (simulating legacy data)
      await authManager.storageManager.storePassword(userId, userData.password);
      await authManager.storageManager.storeUserData(legacyUser);

      // Login should migrate the password
      const loginResult = await authManager.login({
        username: userData.username,
        password: userData.password
      });

      expect(loginResult.success).toBe(true);

      // Verify password is now hashed
      const storedPassword = await authManager.storageManager.getStoredPassword(userId);
      expect(passwordHasher.isValidBcryptHash(storedPassword)).toBe(true);
      expect(storedPassword).not.toBe(userData.password);

      // Verify we can still login with the same password
      await authManager.logout();
      const secondLoginResult = await authManager.login({
        username: userData.username,
        password: userData.password
      });
      expect(secondLoginResult.success).toBe(true);
    });

    it('should handle corrupted plaintext passwords gracefully', async () => {
      const userData = {
        username: 'corruptuser',
        email: 'corrupt@example.com'
      };

      const userId = 'corrupt-user-id';
      const users = [{ id: userId, username: userData.username, email: userData.email }];
      localStorage.setItem('memex_racing_users', JSON.stringify(users));

      // Store corrupted password data
      await authManager.storageManager.storePassword(userId, null);

      await expect(authManager.login({
        username: userData.username,
        password: 'anypassword'
      })).rejects.toThrow('Invalid username or password');
    });
  });

  describe('Security Compliance', () => {
    it('should use bcrypt with minimum 12 salt rounds', async () => {
      const userData = {
        username: 'securitytest',
        email: 'security@example.com',
        password: 'SecurityTest123!'
      };

      const result = await authManager.register(userData);
      const storedPassword = await authManager.storageManager.getStoredPassword(result.user.id);
      
      // Parse the bcrypt hash to check salt rounds
      const hashInfo = passwordHasher.parseBcryptHash(storedPassword);
      expect(hashInfo.saltRounds).toBeGreaterThanOrEqual(12);
    });

    it('should prevent timing attacks in password verification', async () => {
      const userData = {
        username: 'timingtest',
        email: 'timing@example.com',
        password: 'TimingTest123!'
      };

      await authManager.register(userData);
      await authManager.logout();

      // Test multiple login attempts to check timing consistency
      const times = [];
      
      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();
        try {
          await authManager.login({
            username: userData.username,
            password: 'WrongPassword' + i
          });
        } catch (error) {
          // Expected to fail
        }
        times.push(Date.now() - startTime);
      }

      // All attempts should take roughly similar time (timing attack prevention)
      const avgTime = times.reduce((a, b) => a + b) / times.length;
      times.forEach(time => {
        // Allow 50% variance (timing attack prevention makes this less predictable)
        expect(Math.abs(time - avgTime)).toBeLessThan(avgTime * 0.5);
      });
    });

    it('should handle password length limits', async () => {
      const userData = {
        username: 'lengthtest',
        email: 'length@example.com',
        password: 'a'.repeat(200) // Exceeds max length
      };

      await expect(authManager.register(userData))
        .rejects.toThrow('Password exceeds maximum length');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle bcrypt errors gracefully', async () => {
      const userData = {
        username: 'errortest',
        email: 'error@example.com',
        password: 'ErrorTest123!'
      };

      // Mock bcrypt to throw an error
      const originalHashPassword = authManager.passwordHasher.hashPassword;
      authManager.passwordHasher.hashPassword = jest.fn().mockRejectedValue(
        new Error('Bcrypt error')
      );

      await expect(authManager.register(userData))
        .rejects.toThrow('Password hashing failed');

      // Restore original method
      authManager.passwordHasher.hashPassword = originalHashPassword;
    });

    it('should handle storage errors during password operations', async () => {
      const userData = {
        username: 'storagetest',
        email: 'storage@example.com',
        password: 'StorageTest123!'
      };

      // Mock storage to throw error
      const originalStorePassword = authManager.storageManager.storePassword;
      authManager.storageManager.storePassword = jest.fn().mockRejectedValue(
        new Error('Storage error')
      );

      await expect(authManager.register(userData))
        .rejects.toThrow('Storage error');

      // Restore original method
      authManager.storageManager.storePassword = originalStorePassword;
    });

    it('should handle null/undefined password inputs', async () => {
      const userData = {
        username: 'nulltest',
        email: 'null@example.com',
        password: null
      };

      await expect(authManager.register(userData))
        .rejects.toThrow('Password is required');
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain user authentication state across password migrations', async () => {
      const userData = {
        username: 'compattest',
        email: 'compat@example.com',
        password: 'CompatTest123!'
      };

      // Register user normally (with hashing)
      const registerResult = await authManager.register(userData);
      expect(registerResult.success).toBe(true);

      // User should be authenticated
      expect(authManager.isAuthenticated()).toBe(true);
      expect(authManager.getCurrentUser()).toBeDefined();

      // Login again should work
      await authManager.logout();
      const loginResult = await authManager.login({
        username: userData.username,
        password: userData.password
      });
      expect(loginResult.success).toBe(true);
    });

    it('should handle mixed plaintext and hashed passwords in storage', async () => {
      // This test simulates a scenario where some users have already migrated
      // and others still have plaintext passwords
      
      const hashedUser = {
        username: 'hasheduser',
        email: 'hashed@example.com',
        password: 'HashedUser123!'
      };

      const plaintextUser = {
        username: 'plaintextuser',
        email: 'plaintext@example.com',
        password: 'PlaintextUser123!'
      };

      // Register hashed user normally
      const hashedResult = await authManager.register(hashedUser);
      expect(hashedResult.success).toBe(true);

      // Manually create plaintext user (simulating legacy data)
      const plaintextUserId = 'plaintext-user-id';
      const users = JSON.parse(localStorage.getItem('memex_racing_users') || '[]');
      users.push({ 
        id: plaintextUserId, 
        username: plaintextUser.username, 
        email: plaintextUser.email 
      });
      localStorage.setItem('memex_racing_users', JSON.stringify(users));

      // Store plaintext password and user data
      await authManager.storageManager.storePassword(plaintextUserId, plaintextUser.password);
      await authManager.storageManager.storeUserData({
        id: plaintextUserId,
        username: plaintextUser.username,
        email: plaintextUser.email,
        profile: { displayName: plaintextUser.username }
      });

      // Both users should be able to login
      await authManager.logout();
      
      const hashedLogin = await authManager.login({
        username: hashedUser.username,
        password: hashedUser.password
      });
      expect(hashedLogin.success).toBe(true);

      await authManager.logout();

      const plaintextLogin = await authManager.login({
        username: plaintextUser.username,
        password: plaintextUser.password
      });
      expect(plaintextLogin.success).toBe(true);

      // After login, plaintext password should be migrated
      const migratedPassword = await authManager.storageManager.getStoredPassword(plaintextUserId);
      expect(passwordHasher.isValidBcryptHash(migratedPassword)).toBe(true);
    });
  });
});