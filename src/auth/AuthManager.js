// AuthManager - Main authentication system controller
// REFACTOR Phase - Improved structure and validation

const { memoryRegistry } = require('../utils/MemoryRegistry.js');

class AuthManager {
  constructor(config) {
    // Validate and store configuration
    this.config = this.validateAndNormalizeConfig(config);
    
    // Initialize state
    this.currentUser = null;
    this.isLoggedIn = false;
    this.tokenRefreshTimer = null;
    
    // Memory management scope
    this.memoryScope = 'AuthManager';
    
    // Initialize subsystems
    // Use browser-compatible JWT manager
    const JWTManager = require('./BrowserJWTManager.js');
    const StorageManager = require('./StorageManager.js');
    const PasswordHasher = require('./PasswordHasher.js');
    this.jwtManager = new JWTManager(this.config.jwt);
    this.storageManager = new StorageManager(this.config.storage);
    this.passwordHasher = new PasswordHasher(this.config.passwordHashing || {});
    
    console.log('[AuthManager] Initialized with memory management');
  }

  validateAndNormalizeConfig(config) {
    if (!config || typeof config !== 'object' || Object.keys(config).length === 0) {
      throw new Error('Invalid authentication configuration');
    }

    if (!config.jwt || !config.jwt.secret) {
      throw new Error('JWT configuration is required');
    }

    if (!config.storage) {
      throw new Error('Storage configuration is required');
    }

    // Return validated config with any normalizations
    return {
      ...config,
      jwt: {
        algorithm: 'HS256',
        ...config.jwt
      },
      storage: {
        encryption: true,
        keyPrefix: 'memex_racing_',
        ...config.storage
      }
    };
  }

  // Required authentication methods (minimal implementation)
  async register(userData) {
    try {
      // Validate registration data
      this.validateRegistrationData(userData);
      
      // Check for existing users
      await this.checkUserExists(userData);
      
      // Create user profile with default statistics
      const user = this.createUserProfile(userData);
      
      // Generate JWT tokens
      const tokens = await this.jwtManager.generateToken({
        id: user.id,
        username: user.username,
        email: user.email
      });
      
      // Hash password and store credentials and user data
      const hashedPassword = await this.passwordHasher.hashPassword(userData.password);
      await this.storeUserRegistration(user, tokens, hashedPassword);
      
      // Set authentication state
      this.currentUser = user;
      this.isLoggedIn = true;
      
      return {
        success: true,
        user: user,
        tokens: tokens
      };
      
    } catch (error) {
      // Clean up any partial state on error
      this.currentUser = null;
      this.isLoggedIn = false;
      await this.storageManager.clearAll();
      throw error;
    }
  }

  async login(credentials) {
    try {
      // Validate login credentials
      this.validateLoginCredentials(credentials);
      
      // Find user in registry
      const user = await this.findUserByCredentials(credentials);
      
      // Verify password against stored hash
      const storedPasswordHash = await this.storageManager.getStoredPassword(user.id);
      if (!storedPasswordHash) {
        throw new Error('Invalid username or password');
      }
      
      // Handle migration from plaintext passwords
      let isValidPassword = false;
      let needsMigration = false;
      
      if (this.passwordHasher.isValidBcryptHash(storedPasswordHash)) {
        // Password is already hashed - verify normally
        isValidPassword = await this.passwordHasher.verifyPassword(credentials.password, storedPasswordHash);
      } else {
        // Legacy plaintext password - verify and mark for migration
        isValidPassword = (storedPasswordHash === credentials.password);
        needsMigration = isValidPassword;
      }
      
      if (!isValidPassword) {
        throw new Error('Invalid username or password');
      }
      
      // Migrate plaintext password to hash if needed
      if (needsMigration) {
        const hashedPassword = await this.passwordHasher.hashPassword(credentials.password);
        await this.storageManager.storePassword(user.id, hashedPassword);
      }
      
      // Generate new tokens
      const tokens = await this.jwtManager.generateToken({
        id: user.id,
        username: user.username,
        email: user.email
      });
      
      // Update last login time
      user.profile.lastLoginAt = new Date().toISOString();
      
      // Store updated credentials and user data
      await this.updateUserLogin(user, tokens);
      
      // Set authentication state
      this.currentUser = user;
      this.isLoggedIn = true;
      
      // Start token refresh timer
      this.startTokenRefreshTimer();
      
      return {
        success: true,
        user: user,
        tokens: tokens
      };
      
    } catch (error) {
      // Clean up on error
      this.currentUser = null;
      this.isLoggedIn = false;
      throw error;
    }
  }

  async logout() {
    try {
      // Clear token refresh timer using memory registry
      if (this.tokenRefreshTimer) {
        memoryRegistry.removeResource('auth_token_refresh', 'intervals');
        this.tokenRefreshTimer = null;
      }
      
      // Clear stored credentials
      await this.storageManager.clearCredentials();
      
      // Clear authentication state
      this.currentUser = null;
      this.isLoggedIn = false;
      
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      // Force clear state even on error
      this.currentUser = null;
      this.isLoggedIn = false;
      
      // Ensure timer cleanup even on error
      memoryRegistry.removeResource('auth_token_refresh', 'intervals');
      this.tokenRefreshTimer = null;
      
      throw error;
    }
  }

  async refreshToken() {
    try {
      const currentCredentials = await this.storageManager.getCredentials();
      if (!currentCredentials || !currentCredentials.refreshToken) {
        throw new Error('No refresh token available');
      }
      
      // Verify refresh token
      const decoded = await this.jwtManager.verifyToken(currentCredentials.refreshToken);
      
      // Generate new tokens
      const tokens = await this.jwtManager.generateToken({
        id: decoded.id,
        username: decoded.username,
        email: decoded.email
      });
      
      // Update stored credentials
      await this.storageManager.updateTokens(tokens);
      
      return {
        success: true,
        tokens: tokens
      };
    } catch (error) {
      // Token refresh failed, logout user
      await this.logout();
      throw error;
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return this.isLoggedIn;
  }

  // Registration helper methods
  validateRegistrationData(userData) {
    // Username validation
    if (!userData.username || typeof userData.username !== 'string' || userData.username.trim().length === 0) {
      throw new Error('Username is required');
    }
    
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(userData.username)) {
      throw new Error('Username must be 3-20 characters, letters, numbers, and underscores only');
    }
    
    // Email validation
    if (!userData.email || typeof userData.email !== 'string' || userData.email.trim().length === 0) {
      throw new Error('Email is required');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      throw new Error('Invalid email format');
    }
    
    // Password validation
    if (!userData.password || typeof userData.password !== 'string') {
      throw new Error('Password is required');
    }
    
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(userData.password)) {
      throw new Error('Password does not meet security requirements');
    }
    
    return true;
  }

  async checkUserExists(userData) {
    // In a real app, this would check against a database
    // For now, we'll use localStorage to simulate existing users
    const existingUsers = this.getStoredUsers();
    
    // Check username
    if (existingUsers.some(user => user.username === userData.username)) {
      throw new Error('Username already exists');
    }
    
    // Check email
    if (existingUsers.some(user => user.email === userData.email)) {
      throw new Error('Email already exists');
    }
  }

  createUserProfile(userData) {
    const { v4: uuidv4 } = require('uuid');
    const now = new Date();
    
    return {
      id: uuidv4(),
      username: userData.username,
      email: userData.email,
      status: 'active',
      isVerified: false,
      profile: {
        displayName: userData.username,
        createdAt: now.toISOString(),
        lastLoginAt: now.toISOString(),
        avatar: null,
        preferences: {
          theme: 'dark',
          notifications: true,
          privacy: 'public'
        }
      },
      statistics: {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        totalPoints: 0,
        level: 1,
        achievements: [],
        bestTime: null,
        averageTime: null
      }
    };
  }

  async storeUserRegistration(user, tokens, hashedPassword) {
    // Store credentials
    const credentials = {
      username: user.username,
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      userId: user.id
    };
    
    await this.storageManager.storeCredentials(credentials);
    
    // Store user data (without password)
    await this.storageManager.storeUserData(user);
    
    // Store hashed password securely
    await this.storageManager.storePassword(user.id, hashedPassword);
    
    // Store user in the users registry
    this.addUserToRegistry(user);
  }

  getStoredUsers() {
    try {
      const users = localStorage.getItem('memex_racing_users');
      return users ? JSON.parse(users) : [];
    } catch (error) {
      return [];
    }
  }

  addUserToRegistry(user) {
    const users = this.getStoredUsers();
    const userForRegistry = {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.profile.createdAt
    };
    
    users.push(userForRegistry);
    localStorage.setItem('memex_racing_users', JSON.stringify(users));
  }

  // Login helper methods
  validateLoginCredentials(credentials) {
    if (!credentials.username || credentials.username.trim().length === 0) {
      throw new Error('Username is required');
    }
    
    if (!credentials.password || credentials.password.length === 0) {
      throw new Error('Password is required');
    }
    
    return true;
  }

  async findUserByCredentials(credentials) {
    const users = this.getStoredUsers();
    const user = users.find(u => u.username === credentials.username);
    
    if (!user) {
      throw new Error('Invalid username or password');
    }
    
    // Load full user data
    const fullUserData = await this.storageManager.getUserData(user.id);
    if (!fullUserData) {
      throw new Error('User data not found');
    }
    
    return fullUserData;
  }

  async updateUserLogin(user, tokens) {
    // Update credentials
    const credentials = {
      username: user.username,
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      userId: user.id
    };
    
    await this.storageManager.storeCredentials(credentials);
    
    // Update user data
    await this.storageManager.storeUserData(user);
  }

  startTokenRefreshTimer() {
    // Clear existing timer
    if (this.tokenRefreshTimer) {
      memoryRegistry.removeResource('auth_token_refresh', 'intervals');
      this.tokenRefreshTimer = null;
    }
    
    // Refresh token every 45 minutes (tokens expire in 1 hour)
    this.tokenRefreshTimer = setInterval(async () => {
      try {
        await this.refreshToken();
      } catch (error) {
        console.error('Token refresh failed:', error);
        // User will be logged out by refreshToken method
      }
    }, 45 * 60 * 1000); // 45 minutes
    
    // Register timer with memory management
    memoryRegistry.registerInterval('auth_token_refresh', this.tokenRefreshTimer, this.memoryScope);
  }

  // Initialize authentication state from storage
  async initializeFromStorage() {
    try {
      const credentials = await this.storageManager.getCredentials();
      if (!credentials || !credentials.token) {
        return false;
      }
      
      // Verify token is still valid
      const decoded = await this.jwtManager.verifyToken(credentials.token);
      
      // Load user data
      const user = await this.storageManager.getUserData(credentials.userId);
      if (!user) {
        throw new Error('User data not found');
      }
      
      // Set authentication state
      this.currentUser = user;
      this.isLoggedIn = true;
      
      // Start token refresh timer
      this.startTokenRefreshTimer();
      
      return true;
    } catch (error) {
      // Clear invalid state
      await this.logout();
      return false;
    }
  }

  /**
   * Destroy the AuthManager and cleanup all resources
   */
  destroy() {
    console.log('[AuthManager] Destroying AuthManager and cleaning up resources');
    
    try {
      // Clear token refresh timer
      if (this.tokenRefreshTimer) {
        memoryRegistry.removeResource('auth_token_refresh', 'intervals');
        this.tokenRefreshTimer = null;
      }
      
      // Clean up all resources in the AuthManager scope
      memoryRegistry.cleanupScope(this.memoryScope);
      
      // Clear authentication state
      this.currentUser = null;
      this.isLoggedIn = false;
      
      // Cleanup storage manager if it has a destroy method
      if (this.storageManager && typeof this.storageManager.destroy === 'function') {
        this.storageManager.destroy();
      }
      
      // Cleanup JWT manager if it has a destroy method
      if (this.jwtManager && typeof this.jwtManager.destroy === 'function') {
        this.jwtManager.destroy();
      }
      
      console.log('[AuthManager] AuthManager destroyed successfully');
    } catch (error) {
      console.error('[AuthManager] Error during destruction:', error);
      // Force cleanup even on error
      memoryRegistry.cleanupScope(this.memoryScope);
      this.currentUser = null;
      this.isLoggedIn = false;
      this.tokenRefreshTimer = null;
    }
  }
}

module.exports = AuthManager;