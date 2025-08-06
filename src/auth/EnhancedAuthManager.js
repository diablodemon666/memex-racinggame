// Enhanced Authentication Manager
// Enterprise-grade authentication system integrating all security components

const { EventEmitter } = require('events');

// Conditional imports for browser/Node.js compatibility
let EnhancedJWTManager, SessionManager, PasswordResetManager, ProductionSecurityManager, UserRoleManager;
let StorageManager, PasswordHasher, memoryRegistry;

try {
  EnhancedJWTManager = require('./EnhancedJWTManager');
  SessionManager = require('./SessionManager');
  PasswordResetManager = require('./PasswordResetManager');
  ProductionSecurityManager = require('./ProductionSecurityManager');
  UserRoleManager = require('./UserRoleManager');
  StorageManager = require('./StorageManager');
  PasswordHasher = require('./PasswordHasher');
  memoryRegistry = require('../utils/MemoryRegistry').memoryRegistry;
} catch (error) {
  console.warn('[EnhancedAuthManager] Some dependencies not available, falling back to basic implementation');
  // Fallback to basic implementations
  EnhancedJWTManager = require('./BrowserJWTManager');
  StorageManager = require('./StorageManager');
  PasswordHasher = require('./PasswordHasher');
  memoryRegistry = { cleanupScope: () => {}, registerInterval: () => {}, removeResource: () => {} };
}

class EnhancedAuthManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = this.validateConfig(config);
    
    // Authentication state
    this.currentUser = null;
    this.isLoggedIn = false;
    this.currentSession = null;
    
    // Memory management
    this.memoryScope = 'EnhancedAuthManager';
    
    // Initialize subsystems
    this.initializeSubsystems();
    
    // Setup event handlers
    this.setupEventHandlers();
    
    console.log('[EnhancedAuthManager] Initialized with enterprise authentication features');
  }

  validateConfig(config) {
    return {
      // JWT Configuration
      jwt: {
        secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
        expiresIn: '1h',
        refreshExpiresIn: '7d',
        algorithm: 'HS256',
        ...config.jwt
      },
      
      // Session Configuration
      session: {
        maxSessionsPerUser: 5,
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
        inactivityTimeout: 2 * 60 * 60 * 1000, // 2 hours
        ...config.session
      },
      
      // Security Configuration
      security: {
        environment: process.env.NODE_ENV || 'development',
        maxLoginAttempts: 5,
        lockoutDuration: 15 * 60 * 1000, // 15 minutes
        ...config.security
      },
      
      // Storage Configuration
      storage: {
        encryption: true,
        keyPrefix: 'memex_racing_',
        ...config.storage
      },
      
      // Password Configuration
      password: {
        saltRounds: 12,
        minLength: 8,
        ...config.password
      },
      
      // Role Management
      roles: {
        defaultRole: 'user',
        enableRoleInheritance: true,
        ...config.roles
      },
      
      ...config
    };
  }

  initializeSubsystems() {
    try {
      // Initialize JWT Manager
      this.jwtManager = new EnhancedJWTManager(this.config.jwt);
      
      // Initialize Session Manager
      this.sessionManager = new SessionManager(this.config.session);
      
      // Initialize Password Reset Manager
      this.passwordResetManager = new PasswordResetManager();
      
      // Initialize Security Manager
      this.securityManager = new ProductionSecurityManager(this.config.security);
      
      // Initialize Role Manager
      this.roleManager = new UserRoleManager(this.config.roles);
      
      // Initialize Storage Manager
      this.storageManager = new StorageManager(this.config.storage);
      
      // Initialize Password Hasher
      this.passwordHasher = new PasswordHasher(this.config.password);
      
      console.log('[EnhancedAuthManager] All subsystems initialized successfully');
    } catch (error) {
      console.error('[EnhancedAuthManager] Failed to initialize subsystems:', error);
      throw new Error(`Authentication system initialization failed: ${error.message}`);
    }
  }

  setupEventHandlers() {
    // Session Manager Events
    this.sessionManager.on('sessionCreated', (data) => {
      this.emit('sessionCreated', data);
    });
    
    this.sessionManager.on('sessionInvalidated', (data) => {
      this.emit('sessionInvalidated', data);
    });
    
    this.sessionManager.on('securityViolation', (data) => {
      this.securityManager.recordSuspiciousActivity(
        data.sessionId, 
        'session_security_violation', 
        data
      );
      this.emit('securityViolation', data);
    });
    
    // Password Reset Events
    this.passwordResetManager.on('resetRequested', (data) => {
      this.emit('passwordResetRequested', data);
    });
    
    this.passwordResetManager.on('passwordReset', (data) => {
      // Invalidate all user sessions on password reset
      this.sessionManager.invalidateAllUserSessions(data.userId, 'password_reset');
      this.emit('passwordReset', data);
    });
    
    this.passwordResetManager.on('invalidateUserSessions', (data) => {
      this.sessionManager.invalidateAllUserSessions(data.userId, 'password_reset');
    });
    
    // Security Manager Events
    this.securityManager.on('identifierBlocked', (data) => {
      this.emit('securityThreatDetected', data);
    });
    
    this.securityManager.on('securityEvent', (data) => {
      this.emit('securityEvent', data);
    });
    
    // Role Manager Events
    this.roleManager.on('roleAssigned', (data) => {
      this.emit('userRoleChanged', { ...data, action: 'assigned' });
    });
    
    this.roleManager.on('roleRevoked', (data) => {
      this.emit('userRoleChanged', { ...data, action: 'revoked' });
    });
  }

  // Enhanced Registration
  async register(userData, options = {}) {
    try {
      // Security checks
      this.securityManager.checkRateLimit(
        options.ipAddress || 'unknown', 
        'auth'
      );
      
      // Input validation
      const validatedData = this.validateRegistrationData(userData);
      
      // Check for existing users
      await this.checkUserExists(validatedData);
      
      // Create user profile
      const user = await this.createUserProfile(validatedData);
      
      // Hash password
      const hashedPassword = await this.passwordHasher.hashPassword(validatedData.password);
      
      // Generate tokens
      const tokenData = await this.jwtManager.generateToken({
        id: user.id,
        username: user.username,
        email: user.email,
        roles: user.roles,
        permissions: user.permissions,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent
      });
      
      // Create session
      const session = await this.sessionManager.createSession(user, {
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        loginMethod: 'registration'
      });
      
      // Link token to session
      this.sessionManager.linkTokenToSession(tokenData.accessToken, session.id);
      
      // Store user data
      await this.storeUserRegistration(user, tokenData, hashedPassword);
      
      // Assign default role
      this.roleManager.assignRole(user.id, this.config.roles.defaultRole, {
        assignedBy: 'system',
        reason: 'registration'
      });
      
      // Set authentication state
      this.currentUser = user;
      this.currentSession = session;
      this.isLoggedIn = true;
      
      // Log successful registration
      this.securityManager.logSecurityEvent('user_registered', {
        userId: user.id,
        username: user.username,
        email: user.email,
        ipAddress: options.ipAddress
      });
      
      this.emit('userRegistered', {
        user,
        session,
        tokens: tokenData
      });
      
      return {
        success: true,
        user,
        session,
        tokens: tokenData
      };
      
    } catch (error) {
      // Clean up any partial state
      this.currentUser = null;
      this.currentSession = null;
      this.isLoggedIn = false;
      
      // Log failed registration
      this.securityManager.logSecurityEvent('registration_failed', {
        username: userData?.username,
        email: userData?.email,
        error: error.message,
        ipAddress: options.ipAddress
      });
      
      throw error;
    }
  }

  // Enhanced Login
  async login(credentials, options = {}) {
    try {
      // Security checks
      this.securityManager.checkRateLimit(
        options.ipAddress || 'unknown', 
        'auth'
      );
      
      // Check if IP is blocked
      if (this.securityManager.isBlocked(options.ipAddress)) {
        throw new Error('Access denied from this location');
      }
      
      // Validate credentials
      const validatedCredentials = this.validateLoginCredentials(credentials);
      
      // Find user
      const user = await this.findUserByCredentials(validatedCredentials);
      
      // Verify password
      await this.verifyUserPassword(user, validatedCredentials.password);
      
      // Load user roles and permissions
      await this.loadUserRolesAndPermissions(user);
      
      // Generate tokens
      const tokenData = await this.jwtManager.generateToken({
        id: user.id,
        username: user.username,
        email: user.email,
        roles: user.roles,
        permissions: user.permissions,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent
      });
      
      // Create session
      const session = await this.sessionManager.createSession(user, {
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        loginMethod: 'password',
        rememberMe: options.rememberMe || false
      });
      
      // Link token to session
      this.sessionManager.linkTokenToSession(tokenData.accessToken, session.id);
      
      // Update user login information
      user.profile.lastLoginAt = new Date().toISOString();
      await this.storageManager.storeUserData(user);
      
      // Set authentication state
      this.currentUser = user;
      this.currentSession = session;
      this.isLoggedIn = true;
      
      // Log successful login
      this.securityManager.logSecurityEvent('user_login', {
        userId: user.id,
        username: user.username,
        sessionId: session.id,
        ipAddress: options.ipAddress
      });
      
      this.emit('userLoggedIn', {
        user,
        session,
        tokens: tokenData
      });
      
      return {
        success: true,
        user,
        session,
        tokens: tokenData
      };
      
    } catch (error) {
      // Record failed login attempt
      await this.sessionManager.recordLoginAttempt(
        credentials?.username, 
        options.ipAddress, 
        false
      );
      
      // Log failed login
      this.securityManager.logSecurityEvent('login_failed', {
        username: credentials?.username,
        error: error.message,
        ipAddress: options.ipAddress
      });
      
      // Record suspicious activity
      this.securityManager.recordSuspiciousActivity(
        options.ipAddress || 'unknown',
        'failed_login',
        { username: credentials?.username, error: error.message }
      );
      
      throw error;
    }
  }

  // Enhanced Logout
  async logout(options = {}) {
    try {
      const userId = this.currentUser?.id;
      const sessionId = this.currentSession?.id;
      
      // Invalidate current session
      if (sessionId) {
        this.sessionManager.invalidateSession(sessionId, 'user_logout');
      }
      
      // Revoke all user tokens if requested
      if (options.logoutAllDevices && userId) {
        this.sessionManager.invalidateAllUserSessions(userId, 'logout_all_devices');
        this.jwtManager.revokeAllUserTokens(userId);
      }
      
      // Clear stored credentials
      await this.storageManager.clearCredentials();
      
      // Log logout
      if (userId) {
        this.securityManager.logSecurityEvent('user_logout', {
          userId,
          sessionId,
          logoutAllDevices: options.logoutAllDevices || false
        });
      }
      
      // Clear authentication state
      this.currentUser = null;
      this.currentSession = null;
      this.isLoggedIn = false;
      
      this.emit('userLoggedOut', {
        userId,
        sessionId,
        logoutAllDevices: options.logoutAllDevices
      });
      
      return { success: true };
      
    } catch (error) {
      // Force clear state even on error
      this.currentUser = null;
      this.currentSession = null;
      this.isLoggedIn = false;
      
      throw error;
    }
  }

  // Token Validation and Refresh
  async validateToken(token, options = {}) {
    try {
      // Verify JWT token
      const decoded = await this.jwtManager.verifyToken(token);
      
      // Get associated session
      const session = this.sessionManager.getSessionByToken(token);
      if (!session) {
        throw new Error('Session not found');
      }
      
      // Validate session
      await this.sessionManager.validateSession(session.id, options);
      
      return {
        valid: true,
        user: decoded,
        session
      };
      
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  async refreshToken(refreshToken) {
    try {
      // Refresh JWT token
      const tokenData = await this.jwtManager.refreshToken(refreshToken);
      
      // Update session token association
      const session = this.sessionManager.getSessionByToken(refreshToken);
      if (session) {
        this.sessionManager.linkTokenToSession(tokenData.accessToken, session.id);
      }
      
      return {
        success: true,
        tokens: tokenData
      };
      
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  // Password Reset Integration
  async requestPasswordReset(identifier, options = {}) {
    return await this.passwordResetManager.requestPasswordReset(identifier, options);
  }

  async verifyResetToken(token) {
    return await this.passwordResetManager.verifyResetToken(token);
  }

  async resetPassword(token, newPassword, options = {}) {
    return await this.passwordResetManager.resetPassword(token, newPassword, options);
  }

  // Role and Permission Management
  assignUserRole(userId, roleName, options = {}) {
    // Check if current user has permission to assign roles
    if (this.currentUser && !this.hasPermission(this.currentUser.id, 'admin.roles.manage')) {
      throw new Error('Insufficient permissions to assign roles');
    }
    
    return this.roleManager.assignRole(userId, roleName, {
      ...options,
      assignedBy: this.currentUser?.id || 'system',
      isAdminAssignment: true
    });
  }

  revokeUserRole(userId, roleName, options = {}) {
    // Check if current user has permission to revoke roles
    if (this.currentUser && !this.hasPermission(this.currentUser.id, 'admin.roles.manage')) {
      throw new Error('Insufficient permissions to revoke roles');
    }
    
    return this.roleManager.revokeRole(userId, roleName, {
      ...options,
      revokedBy: this.currentUser?.id || 'system',
      isAdminRevocation: true
    });
  }

  hasPermission(userId, permission) {
    return this.roleManager.hasPermission(userId, permission);
  }

  hasRole(userId, role) {
    return this.roleManager.hasRole(userId, role);
  }

  getUserRoles(userId) {
    return this.roleManager.getUserRoles(userId);
  }

  getUserPermissions(userId) {
    return this.roleManager.getUserPermissions(userId);
  }

  // Security Features
  generateCSRFToken(sessionId) {
    return this.securityManager.generateCSRFToken(sessionId);
  }

  validateCSRFToken(sessionId, token) {
    return this.securityManager.validateCSRFToken(sessionId, token);
  }

  getSecurityHeaders() {
    return this.securityManager.getSecurityHeaders();
  }

  // Validation Methods
  validateRegistrationData(userData) {
    const validated = {};
    
    // Validate username
    validated.username = this.securityManager.validateInput(
      userData.username, 
      'username', 
      { required: true }
    );
    
    // Validate email
    validated.email = this.securityManager.validateInput(
      userData.email, 
      'email', 
      { required: true }
    );
    
    // Validate password
    validated.password = this.securityManager.validateInput(
      userData.password, 
      'password', 
      { required: true }
    );
    
    return validated;
  }

  validateLoginCredentials(credentials) {
    const validated = {};
    
    validated.username = this.securityManager.validateInput(
      credentials.username, 
      'string', 
      { required: true, maxLength: 50 }
    );
    
    validated.password = this.securityManager.validateInput(
      credentials.password, 
      'string', 
      { required: true, maxLength: 128 }
    );
    
    return validated;
  }

  // User Management Methods
  async checkUserExists(userData) {
    const existingUsers = await this.getStoredUsers();
    
    if (existingUsers.some(user => user.username === userData.username)) {
      throw new Error('Username already exists');
    }
    
    if (existingUsers.some(user => user.email === userData.email)) {
      throw new Error('Email already exists');
    }
  }

  async createUserProfile(userData) {
    const { v4: uuidv4 } = require('uuid');
    const now = new Date();
    
    return {
      id: uuidv4(),
      username: userData.username,
      email: userData.email,
      status: 'active',
      isVerified: false,
      roles: [this.config.roles.defaultRole],
      permissions: [],
      
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

  async findUserByCredentials(credentials) {
    const users = await this.getStoredUsers();
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

  async verifyUserPassword(user, password) {
    const storedPasswordHash = await this.storageManager.getStoredPassword(user.id);
    if (!storedPasswordHash) {
      throw new Error('Invalid username or password');
    }
    
    // Handle migration from plaintext passwords
    let isValidPassword = false;
    let needsMigration = false;
    
    if (this.passwordHasher.isValidBcryptHash(storedPasswordHash)) {
      isValidPassword = await this.passwordHasher.verifyPassword(password, storedPasswordHash);
    } else {
      // Legacy plaintext password
      isValidPassword = (storedPasswordHash === password);
      needsMigration = isValidPassword;
    }
    
    if (!isValidPassword) {
      throw new Error('Invalid username or password');
    }
    
    // Migrate plaintext password if needed
    if (needsMigration) {
      const hashedPassword = await this.passwordHasher.hashPassword(password);
      await this.storageManager.storePassword(user.id, hashedPassword);
    }
    
    return true;
  }

  async loadUserRolesAndPermissions(user) {
    user.roles = this.roleManager.getUserRoles(user.id);
    user.permissions = this.roleManager.getUserPermissions(user.id);
    
    // Ensure user has at least default role
    if (user.roles.length === 0) {
      this.roleManager.assignRole(user.id, this.config.roles.defaultRole, {
        assignedBy: 'system',
        reason: 'default_role_assignment'
      });
      user.roles = [this.config.roles.defaultRole];
      user.permissions = this.roleManager.getUserPermissions(user.id);
    }
  }

  async storeUserRegistration(user, tokenData, hashedPassword) {
    // Store credentials
    const credentials = {
      username: user.username,
      token: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      userId: user.id
    };
    
    await this.storageManager.storeCredentials(credentials);
    await this.storageManager.storeUserData(user);
    await this.storageManager.storePassword(user.id, hashedPassword);
    
    // Add to user registry
    this.addUserToRegistry(user);
  }

  async getStoredUsers() {
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

  // State Management
  getCurrentUser() {
    return this.currentUser;
  }

  getCurrentSession() {
    return this.currentSession;
  }

  isAuthenticated() {
    return this.isLoggedIn && this.currentUser !== null;
  }

  // Statistics and Monitoring
  getSystemStats() {
    return {
      authentication: {
        currentUser: this.currentUser?.id || null,
        isLoggedIn: this.isLoggedIn,
        sessionActive: this.currentSession !== null
      },
      jwt: this.jwtManager.getTokenStats(),
      sessions: this.sessionManager.getSessionStats(),
      passwordResets: this.passwordResetManager.getResetStats(),
      security: this.securityManager.getSecurityStats(),
      roles: this.roleManager.getStats()
    };
  }

  // Initialize from storage
  async initializeFromStorage() {
    try {
      const credentials = await this.storageManager.getCredentials();
      if (!credentials || !credentials.token) {
        return false;
      }
      
      // Validate token and session
      const validation = await this.validateToken(credentials.token);
      if (!validation.valid) {
        await this.logout();
        return false;
      }
      
      // Load user data
      const user = await this.storageManager.getUserData(credentials.userId);
      if (!user) {
        await this.logout();
        return false;
      }
      
      // Load roles and permissions
      await this.loadUserRolesAndPermissions(user);
      
      // Set authentication state
      this.currentUser = user;
      this.currentSession = validation.session;
      this.isLoggedIn = true;
      
      return true;
      
    } catch (error) {
      await this.logout();
      return false;
    }
  }

  // Cleanup and destruction
  destroy() {
    console.log('[EnhancedAuthManager] Destroying authentication manager');
    
    try {
      // Clear authentication state
      this.currentUser = null;
      this.currentSession = null;
      this.isLoggedIn = false;
      
      // Cleanup subsystems
      if (this.jwtManager) {
        this.jwtManager.cleanup();
      }
      
      if (this.sessionManager) {
        this.sessionManager.destroy();
      }
      
      if (this.passwordResetManager) {
        this.passwordResetManager.destroy();
      }
      
      if (this.securityManager) {
        this.securityManager.destroy();
      }
      
      if (this.roleManager) {
        this.roleManager.destroy();
      }
      
      if (this.storageManager && typeof this.storageManager.destroy === 'function') {
        this.storageManager.destroy();
      }
      
      // Clean up memory registry
      memoryRegistry.cleanupScope(this.memoryScope);
      
      // Remove all event listeners
      this.removeAllListeners();
      
      console.log('[EnhancedAuthManager] Destroyed successfully');
      
    } catch (error) {
      console.error('[EnhancedAuthManager] Error during destruction:', error);
      // Force cleanup even on error
      memoryRegistry.cleanupScope(this.memoryScope);
      this.removeAllListeners();
    }
  }
}

module.exports = EnhancedAuthManager;