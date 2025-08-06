/**
 * AuthenticatedScene - Base scene class with authentication context
 * 
 * Provides standardized authentication handling for all game scenes.
 * All scenes that need user authentication should extend this class.
 */

import Phaser from 'phaser';

export class AuthenticatedScene extends Phaser.Scene {
  constructor(config) {
    super(config);
    
    // Authentication state
    this.userContext = null;
    this.isAuthenticated = false;
    
    // Event handler references for cleanup
    this._authContextHandler = null;
    this._authStateHandler = null;
  }

  /**
   * Enhanced create method with authentication setup
   * Child classes should call super.create() first
   */
  create() {
    try {
      // Get authentication context from game registry
      this.userContext = this.registry.get('userContext');
      this.isAuthenticated = this.registry.get('isAuthenticated') || false;
      
      // Setup authentication event listeners
      this.setupAuthEventListeners();
      
      // Call child-specific auth setup if available
      if (typeof this.onAuthContextReady === 'function') {
        this.onAuthContextReady(this.userContext, this.isAuthenticated);
      }
      
    } catch (error) {
      console.error(`[${this.scene.key}] Failed to setup authentication context:`, error);
      // Continue with null context
      this.userContext = null;
      this.isAuthenticated = false;
    }
  }

  /**
   * Setup authentication event listeners
   * @private
   */
  setupAuthEventListeners() {
    // Listen for auth context updates
    this._authContextHandler = (userData) => {
      this.userContext = userData;
      this.isAuthenticated = userData !== null;
      
      // Call child-specific handler if available
      if (typeof this.onUserContextUpdate === 'function') {
        this.onUserContextUpdate(userData);
      }
    };
    
    this.registry.events.on('auth-context-updated', this._authContextHandler);
    
    // Listen for auth state changes
    this._authStateHandler = (stateChange) => {
      // Call child-specific handler if available
      if (typeof this.onAuthStateChange === 'function') {
        this.onAuthStateChange(stateChange);
      }
      
      // Handle common state changes
      if (stateChange.type === 'logout' || stateChange.type === 'session_expired') {
        this.handleLogout();
      }
    };
    
    this.registry.events.on('auth-state-changed', this._authStateHandler);
  }

  /**
   * Get current user data
   * @returns {Object|null} User data or null if not authenticated
   */
  getUser() {
    return this.userContext;
  }

  /**
   * Get current user ID
   * @returns {string|null} User ID or null if not authenticated
   */
  getUserId() {
    return this.userContext?.id || null;
  }

  /**
   * Get current username
   * @returns {string|null} Username or null if not authenticated
   */
  getUsername() {
    return this.userContext?.username || null;
  }

  /**
   * Check if user has specific permission
   * @param {string} permission - Permission to check
   * @returns {boolean} True if user has permission
   */
  hasPermission(permission) {
    if (!this.isAuthenticated || !this.userContext) {
      return false;
    }
    
    const permissions = this.userContext.auth?.permissions;
    return Array.isArray(permissions) && permissions.includes(permission);
  }

  /**
   * Check if user has all specified permissions
   * @param {Array<string>} permissions - Permissions to check
   * @returns {boolean} True if user has all permissions
   */
  hasPermissions(permissions) {
    if (!this.isAuthenticated || !this.userContext) {
      return false;
    }
    
    const userPermissions = this.userContext.auth?.permissions;
    if (!Array.isArray(userPermissions)) {
      return false;
    }
    
    return permissions.every(permission => userPermissions.includes(permission));
  }

  /**
   * Get user statistics
   * @returns {Object|null} User statistics or null
   */
  getUserStats() {
    return this.userContext?.statistics || null;
  }

  /**
   * Get user level
   * @returns {number} User level or 0 if not available
   */
  getUserLevel() {
    return this.userContext?.statistics?.level || 0;
  }

  /**
   * Get user points
   * @returns {number} User points or 0 if not available
   */
  getUserPoints() {
    return this.userContext?.statistics?.totalPoints || 0;
  }

  /**
   * Get user preferences
   * @returns {Object|null} User preferences or null
   */
  getUserPreferences() {
    return this.userContext?.preferences || null;
  }

  /**
   * Check if sound is enabled for user
   * @returns {boolean} True if sound is enabled (default: true)
   */
  isSoundEnabled() {
    return this.userContext?.preferences?.soundEnabled ?? true;
  }

  /**
   * Get user's music volume setting
   * @returns {number} Music volume (0-1, default: 0.5)
   */
  getMusicVolume() {
    return this.userContext?.preferences?.musicVolume ?? 0.5;
  }

  /**
   * Get user's effects volume setting
   * @returns {number} Effects volume (0-1, default: 0.5)
   */
  getEffectsVolume() {
    return this.userContext?.preferences?.effectsVolume ?? 0.5;
  }

  /**
   * Get user's preferred player color
   * @returns {string} Player color (default: #ffffff)
   */
  getPlayerColor() {
    return this.userContext?.preferences?.playerColor ?? '#ffffff';
  }

  /**
   * Check if user is authenticated
   * @returns {boolean} True if authenticated
   */
  requireAuth(requiredPermissions = []) {
    if (!this.isAuthenticated) {
      return false;
    }
    
    if (requiredPermissions.length > 0) {
      return this.hasPermissions(requiredPermissions);
    }
    
    return true;
  }

  /**
   * Require authentication or redirect to auth
   * @param {Array<string>} requiredPermissions - Required permissions
   * @returns {boolean} True if authenticated and has permissions
   */
  requireAuthOrRedirect(requiredPermissions = []) {
    if (!this.requireAuth(requiredPermissions)) {
      this.redirectToAuth();
      return false;
    }
    return true;
  }

  /**
   * Redirect to authentication (override in child classes if needed)
   */
  redirectToAuth() {
    if (typeof this.handleAuthRedirect === 'function') {
      this.handleAuthRedirect();
    } else {
      // Default behavior - redirect to login page
      window.location.href = '/login.html';
    }
  }

  /**
   * Request logout from the authentication system
   */
  requestLogout() {
    this.events.emit('logout-requested');
  }

  /**
   * Handle logout event (override in child classes if needed)
   */
  handleLogout() {
    if (typeof this.onLogout === 'function') {
      this.onLogout();
    }
  }

  /**
   * Display user info in scene (utility method)
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} style - Text style options
   * @returns {Phaser.GameObjects.Text|null} Text object or null
   */
  displayUserInfo(x = 10, y = 10, style = {}) {
    if (!this.userContext) {
      return null;
    }

    const defaultStyle = {
      fontSize: '16px',
      fontFamily: 'Courier New',
      color: '#ffffff',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: { x: 10, y: 5 },
      ...style
    };

    const userText = `${this.userContext.username} | LVL ${this.getUserLevel()} | ${this.getUserPoints()} PTS`;
    return this.add.text(x, y, userText, defaultStyle);
  }

  /**
   * Apply user preferences to scene (utility method)
   */
  applyUserPreferences() {
    if (!this.userContext?.preferences) {
      return;
    }

    const preferences = this.userContext.preferences;

    // Apply sound settings if scene has sound capability
    if (this.sound) {
      this.sound.mute = !preferences.soundEnabled;
      
      // Apply volume settings to specific sound types if available
      if (preferences.musicVolume !== undefined && this.sound.get) {
        // Apply to background music if it exists
        const bgMusic = this.sound.get('background_music');
        if (bgMusic) {
          bgMusic.setVolume(preferences.musicVolume);
        }
      }
    }

    // Call child-specific preference application if available
    if (typeof this.onUserPreferencesApplied === 'function') {
      this.onUserPreferencesApplied(preferences);
    }
  }

  /**
   * Enhanced destroy method with auth cleanup
   */
  destroy() {
    // Remove auth event listeners
    if (this._authContextHandler) {
      this.registry.events.off('auth-context-updated', this._authContextHandler);
      this._authContextHandler = null;
    }
    
    if (this._authStateHandler) {
      this.registry.events.off('auth-state-changed', this._authStateHandler);
      this._authStateHandler = null;
    }

    // Clear auth context
    this.userContext = null;
    this.isAuthenticated = false;

    // Call parent destroy if it exists
    if (super.destroy && typeof super.destroy === 'function') {
      super.destroy();
    }
  }

  /**
   * Override-able lifecycle methods for child classes
   */

  /**
   * Called when auth context is ready (override in child classes)
   * @param {Object|null} userContext - User context data
   * @param {boolean} isAuthenticated - Authentication status
   */
  onAuthContextReady(userContext, isAuthenticated) {
    // Override in child classes
  }

  /**
   * Called when user context is updated (override in child classes)
   * @param {Object|null} userData - Updated user data
   */
  onUserContextUpdate(userData) {
    // Override in child classes
  }

  /**
   * Called when auth state changes (override in child classes)
   * @param {Object} stateChange - Auth state change data
   */
  onAuthStateChange(stateChange) {
    // Override in child classes
  }

  /**
   * Called when user preferences are applied (override in child classes)
   * @param {Object} preferences - User preferences
   */
  onUserPreferencesApplied(preferences) {
    // Override in child classes
  }

  /**
   * Called on logout (override in child classes)
   */
  onLogout() {
    // Override in child classes
  }

  /**
   * Called when auth redirect is needed (override in child classes)
   */
  handleAuthRedirect() {
    // Override in child classes
  }
}

// Export for both CommonJS and ES modules
module.exports = { AuthenticatedScene };

// Also support ES module import
if (typeof exports === 'object' && exports) {
  exports.AuthenticatedScene = AuthenticatedScene;
}