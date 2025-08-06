/**
 * AuthGameBridge - Central integration between authentication and game systems
 * 
 * This class provides a secure bridge between the authentication system and Phaser.js game engine,
 * managing user context propagation, session state, and error handling across the game.
 */

class AuthGameBridge {
  constructor(game, authManager) {
    if (!game) {
      throw new Error('Game instance is required');
    }
    if (!authManager) {
      throw new Error('AuthManager instance is required');
    }

    this.game = game;
    this.authManager = authManager;
    this.userContext = null;
    this.isInitialized = false;
    
    // Performance monitoring
    this.performanceMetrics = {
      initializationTime: 0,
      lastUpdateTime: 0,
      contextUpdates: 0
    };

    // Setup auth manager event listeners
    this.setupAuthEventListeners();
  }

  /**
   * Initialize user context with validated and sanitized user data
   * @param {Object} userData - Raw user data from authentication system
   * @returns {Promise<void>}
   */
  async initializeUserContext(userData) {
    const startTime = Date.now();
    
    try {
      // Validate user data structure
      this.validateUserData(userData);
      
      // Sanitize user data to prevent XSS
      const sanitizedData = this.sanitizeUserData(userData);
      
      // Store in instance
      this.userContext = sanitizedData;
      this.isInitialized = true;
      
      // Store in Phaser game registry for scene access
      this.game.registry.set('userContext', sanitizedData);
      this.game.registry.set('isAuthenticated', true);
      
      // Propagate to all active scenes
      this.updateAllScenes(sanitizedData);
      
      // Emit initialization event
      this.game.registry.events.emit('auth-context-initialized', sanitizedData);
      
      // Update performance metrics
      this.performanceMetrics.initializationTime = Date.now() - startTime;
      this.performanceMetrics.lastUpdateTime = Date.now();
      
    } catch (error) {
      this.isInitialized = false;
      
      if (error.message.includes('Registry')) {
        throw new Error('Failed to store user context in game registry');
      }
      
      if (error.message.includes('Invalid user data structure')) {
        throw error; // Re-throw validation errors as-is
      }
      
      throw new Error('Failed to initialize user context');
    }
  }

  /**
   * Update user context with new data
   * @param {Object} userData - Updated user data
   * @returns {Promise<void>}
   */
  async updateUserContext(userData) {
    if (!this.isInitialized) {
      throw new Error('AuthGameBridge not initialized');
    }

    const sanitizedData = this.sanitizeUserData(userData);
    this.userContext = sanitizedData;
    
    // Update in game registry
    this.game.registry.set('userContext', sanitizedData);
    
    // Propagate to scenes
    this.updateAllScenes(sanitizedData);
    
    // Update metrics
    this.performanceMetrics.contextUpdates++;
    this.performanceMetrics.lastUpdateTime = Date.now();
  }

  /**
   * Clear user context on logout
   */
  clearUserContext() {
    this.userContext = null;
    this.isInitialized = false;
    
    // Clear from game registry
    this.game.registry.set('userContext', null);
    this.game.registry.set('isAuthenticated', false);
    
    // Notify scenes
    this.updateAllScenes(null);
    
    // Emit event
    this.game.registry.events.emit('auth-context-cleared');
  }

  /**
   * Get current user context (cached)
   * @returns {Object|null} User context or null if not authenticated
   */
  getUserContext() {
    return this.userContext;
  }

  /**
   * Update all active scenes with user context
   * @param {Object|null} userData - User data to propagate
   */
  updateAllScenes(userData) {
    try {
      const scenes = this.game.scene.getScenes();
      scenes.forEach(scene => {
        try {
          if (scene.events && typeof scene.events.emit === 'function') {
            scene.events.emit('auth-context-updated', userData);
          }
        } catch (sceneError) {
          // Log error but don't throw - individual scene errors shouldn't break the system
          console.warn(`[AuthGameBridge] Failed to update scene ${scene.sys?.key || 'unknown'}:`, sceneError);
        }
      });
    } catch (error) {
      console.warn('[AuthGameBridge] Failed to propagate context to scenes:', error);
    }
  }

  /**
   * Propagate user context to specific scene by name
   * @param {string} sceneName - Target scene name
   * @param {Object|null} userData - User data to propagate
   */
  propagateToScene(sceneName, userData) {
    try {
      const scene = this.game.scene.getScene(sceneName);
      if (scene && scene.events) {
        scene.events.emit('auth-context-updated', userData);
      }
    } catch (error) {
      console.warn(`[AuthGameBridge] Failed to propagate to scene ${sceneName}:`, error);
    }
  }

  /**
   * Handle authentication state changes
   * @param {Object} stateChange - Auth state change object
   */
  async handleAuthStateChange(stateChange) {
    try {
      switch (stateChange.type) {
        case 'login':
          await this.initializeUserContext(stateChange.user);
          break;
          
        case 'logout':
          this.clearUserContext();
          break;
          
        case 'session_expired':
          this.clearUserContext();
          break;
          
        case 'token_refresh':
          if (stateChange.user) {
            await this.updateUserContext(stateChange.user);
          }
          break;
          
        default:
          console.warn(`[AuthGameBridge] Unknown auth state change: ${stateChange.type}`);
      }
      
      // Always emit the state change event
      this.game.registry.events.emit('auth-state-changed', stateChange);
      
    } catch (error) {
      console.error('[AuthGameBridge] Error handling auth state change:', error);
      // Emit error event for error boundaries to handle
      this.game.registry.events.emit('auth-error', { type: stateChange.type, error });
    }
  }

  /**
   * Check if user has specific permission
   * @param {string} permission - Permission to check
   * @returns {boolean} True if user has permission
   */
  hasPermission(permission) {
    if (!this.isInitialized || !this.userContext) {
      return false;
    }
    
    return this.userContext.auth?.permissions?.includes(permission) || false;
  }

  /**
   * Check if user has all specified permissions
   * @param {Array<string>} permissions - Permissions to check
   * @returns {boolean} True if user has all permissions
   */
  hasPermissions(permissions) {
    if (!this.isInitialized || !this.userContext) {
      return false;
    }
    
    const userPermissions = this.userContext.auth?.permissions || [];
    return permissions.every(permission => userPermissions.includes(permission));
  }

  /**
   * Validate user data structure
   * @param {Object} userData - User data to validate
   * @throws {Error} If user data is invalid
   * @private
   */
  validateUserData(userData) {
    if (!userData || typeof userData !== 'object') {
      throw new Error('Invalid user data structure');
    }
    
    if (!userData.id || typeof userData.id !== 'string') {
      throw new Error('Invalid user data structure');
    }
    
    // Additional validation for required fields
    const requiredFields = ['username'];
    for (const field of requiredFields) {
      if (!userData[field]) {
        throw new Error('Invalid user data structure');
      }
    }
  }

  /**
   * Sanitize user data to prevent XSS attacks
   * @param {Object} userData - Raw user data
   * @returns {Object} Sanitized user data
   * @private
   */
  sanitizeUserData(userData) {
    const sanitized = JSON.parse(JSON.stringify(userData)); // Deep clone
    
    // Sanitize string fields that might be displayed in UI
    const stringFields = ['username', 'email'];
    stringFields.forEach(field => {
      if (sanitized[field] && typeof sanitized[field] === 'string') {
        sanitized[field] = this.sanitizeString(sanitized[field]);
      }
    });
    
    // Sanitize preferences
    if (sanitized.preferences) {
      Object.keys(sanitized.preferences).forEach(key => {
        if (typeof sanitized.preferences[key] === 'string') {
          sanitized.preferences[key] = this.sanitizeString(sanitized.preferences[key]);
        }
      });
    }
    
    return sanitized;
  }

  /**
   * Sanitize individual string to prevent XSS
   * @param {string} str - String to sanitize
   * @returns {string} Sanitized string
   * @private
   */
  sanitizeString(str) {
    return str
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Setup authentication manager event listeners
   * @private
   */
  setupAuthEventListeners() {
    if (this.authManager && typeof this.authManager.on === 'function') {
      this.authManager.on('login', (userData) => {
        this.handleAuthStateChange({ type: 'login', user: userData });
      });
      
      this.authManager.on('logout', () => {
        this.handleAuthStateChange({ type: 'logout' });
      });
      
      this.authManager.on('session_expired', () => {
        this.handleAuthStateChange({ type: 'session_expired' });
      });
      
      this.authManager.on('token_refresh', (userData) => {
        this.handleAuthStateChange({ type: 'token_refresh', user: userData });
      });
    }
  }

  /**
   * Get performance metrics for monitoring
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * Cleanup method for proper disposal
   */
  destroy() {
    // Remove auth manager listeners
    if (this.authManager && typeof this.authManager.off === 'function') {
      this.authManager.off('login');
      this.authManager.off('logout');
      this.authManager.off('session_expired');
      this.authManager.off('token_refresh');
    }
    
    // Clear context
    this.clearUserContext();
    
    // Clear references
    this.game = null;
    this.authManager = null;
  }
}

// Export for both CommonJS and ES modules
module.exports = { AuthGameBridge };

// Also support ES module import
if (typeof exports === 'object' && exports) {
  exports.AuthGameBridge = AuthGameBridge;
}