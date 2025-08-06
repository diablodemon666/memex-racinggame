// TDD RED Phase - Write failing test for User Registration Flow
const AuthManager = require('../../src/auth/AuthManager.js');
const authConfig = require('../../src/auth/config.js');

describe('User Registration Flow', () => {
  let authManager;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      ...authConfig,
      jwt: {
        ...authConfig.jwt,
        secret: 'test-secret-key'
      }
    };
    
    authManager = new AuthManager(mockConfig);
    
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('registration validation', () => {
    it('should validate required fields', async () => {
      // Arrange
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!'
      };

      // Act & Assert
      expect(() => authManager.validateRegistrationData(userData)).not.toThrow();
      const isValid = authManager.validateRegistrationData(userData);
      expect(isValid).toBe(true);
    });

    it('should reject missing username', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!'
      };

      // Act & Assert
      expect(() => authManager.validateRegistrationData(userData)).toThrow('Username is required');
    });

    it('should reject invalid email', async () => {
      // Arrange
      const userData = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'SecurePass123!'
      };

      // Act & Assert
      expect(() => authManager.validateRegistrationData(userData)).toThrow('Invalid email format');
    });

    it('should reject weak password', async () => {
      // Arrange
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'weak'
      };

      // Act & Assert
      expect(() => authManager.validateRegistrationData(userData)).toThrow('Password does not meet security requirements');
    });

    it('should reject duplicate username', async () => {
      // Arrange
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!'
      };

      // First registration
      await authManager.register(userData);

      // Attempt duplicate registration
      const duplicateUserData = {
        username: 'testuser',
        email: 'different@example.com',
        password: 'AnotherPass123!'
      };

      // Act & Assert
      await expect(authManager.register(duplicateUserData)).rejects.toThrow('Username already exists');
    });

    it('should reject duplicate email', async () => {
      // Arrange
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!'
      };

      // First registration
      await authManager.register(userData);

      // Attempt duplicate registration
      const duplicateUserData = {
        username: 'differentuser',
        email: 'test@example.com',
        password: 'AnotherPass123!'
      };

      // Act & Assert
      await expect(authManager.register(duplicateUserData)).rejects.toThrow('Email already exists');
    });
  });

  describe('user profile creation', () => {
    it('should create user profile with default statistics', async () => {
      // Arrange
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!'
      };

      // Act
      const result = await authManager.register(userData);

      // Assert
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.username).toBe(userData.username);
      expect(result.user.email).toBe(userData.email);
      expect(result.user.id).toBeDefined();
      
      // Check default profile data
      expect(result.user.profile).toBeDefined();
      expect(result.user.profile.displayName).toBe(userData.username);
      expect(result.user.profile.createdAt).toBeDefined();
      
      // Check default statistics
      expect(result.user.statistics).toBeDefined();
      expect(result.user.statistics.gamesPlayed).toBe(0);
      expect(result.user.statistics.wins).toBe(0);
      expect(result.user.statistics.losses).toBe(0);
      expect(result.user.statistics.winRate).toBe(0);
      expect(result.user.statistics.totalPoints).toBe(0);
      expect(result.user.statistics.level).toBe(1);
    });

    it('should generate unique user ID', async () => {
      // Arrange
      const userData1 = {
        username: 'testuser1',
        email: 'test1@example.com',
        password: 'SecurePass123!'
      };
      
      const userData2 = {
        username: 'testuser2',
        email: 'test2@example.com',
        password: 'SecurePass123!'
      };

      // Act
      const result1 = await authManager.register(userData1);
      const result2 = await authManager.register(userData2);

      // Assert
      expect(result1.user.id).toBeDefined();
      expect(result2.user.id).toBeDefined();
      expect(result1.user.id).not.toBe(result2.user.id);
    });

    it('should set account status to active by default', async () => {
      // Arrange
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!'
      };

      // Act
      const result = await authManager.register(userData);

      // Assert
      expect(result.user.status).toBe('active');
      expect(result.user.isVerified).toBe(false); // Email verification would be separate
    });
  });

  describe('registration success flow', () => {
    it('should automatically log in user after successful registration', async () => {
      // Arrange
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!'
      };

      // Act
      const result = await authManager.register(userData);

      // Assert
      expect(result.success).toBe(true);
      expect(authManager.isAuthenticated()).toBe(true);
      expect(authManager.getCurrentUser()).toBeDefined();
      expect(authManager.getCurrentUser().username).toBe(userData.username);
    });

    it('should generate and store JWT tokens', async () => {
      // Arrange
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!'
      };

      // Act
      const result = await authManager.register(userData);

      // Assert
      expect(result.tokens).toBeDefined();
      expect(result.tokens.token).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(result.tokens.expiresAt).toBeDefined();
      expect(typeof result.tokens.token).toBe('string');
      expect(typeof result.tokens.refreshToken).toBe('string');
    });

    it('should store credentials securely', async () => {
      // Arrange
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!'
      };

      // Act
      await authManager.register(userData);

      // Assert - check that credentials are stored
      const storedCredentials = await authManager.storageManager.getCredentials();
      expect(storedCredentials).toBeDefined();
      expect(storedCredentials.username).toBe(userData.username);
      expect(storedCredentials.token).toBeDefined();
      expect(storedCredentials.refreshToken).toBeDefined();
    });

    it('should store user profile data', async () => {
      // Arrange
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!'
      };

      // Act
      await authManager.register(userData);

      // Assert - check that user data is stored
      const storedUserData = await authManager.storageManager.getUserData();
      expect(storedUserData).toBeDefined();
      expect(storedUserData.username).toBe(userData.username);
      expect(storedUserData.email).toBe(userData.email);
      expect(storedUserData.profile).toBeDefined();
      expect(storedUserData.statistics).toBeDefined();
    });
  });

  describe('registration error handling', () => {
    it('should handle registration validation errors gracefully', async () => {
      // Arrange
      const invalidUserData = {
        username: '',
        email: 'invalid-email',
        password: 'weak'
      };

      // Act & Assert
      await expect(authManager.register(invalidUserData)).rejects.toThrow();
      expect(authManager.isAuthenticated()).toBe(false);
      expect(authManager.getCurrentUser()).toBeNull();
    });

    it('should not store partial data on registration failure', async () => {
      // Arrange
      const invalidUserData = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'SecurePass123!'
      };

      // Act
      try {
        await authManager.register(invalidUserData);
      } catch (error) {
        // Expected to fail
      }

      // Assert
      const storedCredentials = await authManager.storageManager.getCredentials();
      const storedUserData = await authManager.storageManager.getUserData();
      
      expect(storedCredentials).toBeNull();
      expect(storedUserData).toBeNull();
    });

    it('should clean up on registration failure', async () => {
      // Arrange
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!'
      };

      // Mock storage failure
      const originalStoreCredentials = authManager.storageManager.storeCredentials;
      authManager.storageManager.storeCredentials = jest.fn().mockRejectedValue(new Error('Storage failed'));

      // Act & Assert
      await expect(authManager.register(userData)).rejects.toThrow();
      expect(authManager.isAuthenticated()).toBe(false);

      // Restore original method
      authManager.storageManager.storeCredentials = originalStoreCredentials;
    });
  });

  describe('password security', () => {
    it('should hash password before storage', async () => {
      // Arrange
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!'
      };

      // Act
      const result = await authManager.register(userData);

      // Assert - password should not be stored in plain text
      expect(result.user.password).toBeUndefined();
      
      // Check stored data doesn't contain plain password
      const storedUserData = await authManager.storageManager.getUserData();
      expect(storedUserData.password).toBeUndefined();
    });
  });
});