/**
 * Login Integration Module
 * Handles authentication flow and redirects
 */

class LoginIntegration {
  constructor() {
    this.authManager = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      console.log('[LoginIntegration] Starting initialization...');
      
      // Import auth modules using ES modules
      const authModules = await import('./index.js');
      console.log('[LoginIntegration] Auth modules imported successfully');
      
      const { createAuthManager, authConfig } = authModules;
      
      // Create auth manager
      this.authManager = createAuthManager(authConfig);
      console.log('[LoginIntegration] Auth manager created');
      
      // Check authentication status
      const isAuthenticated = await this.authManager.initializeFromStorage();
      console.log('[LoginIntegration] Authentication status:', isAuthenticated);
      
      this.isInitialized = true;
      
      return {
        isAuthenticated,
        user: isAuthenticated ? this.authManager.getCurrentUser() : null
      };
    } catch (error) {
      console.error('[LoginIntegration] Initialization error:', error);
      console.error('[LoginIntegration] Error stack:', error.stack);
      
      // Return default state instead of throwing to allow game to continue
      this.isInitialized = true; // Mark as initialized even on error to prevent infinite retries
      return {
        isAuthenticated: false,
        user: null
      };
    }
  }

  // Check if user needs to login
  async requireAuth(requiredPermissions = []) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.authManager.isAuthenticated()) {
      // Redirect to login page with proper relative path
      window.location.href = 'login.html';
      return false;
    }

    // Check permissions if specified
    if (requiredPermissions.length > 0) {
      const hasAccess = await this.validateGameAccess(requiredPermissions);
      if (!hasAccess) {
        console.warn('[LoginIntegration] User lacks required permissions:', requiredPermissions);
        return false;
      }
    }
    
    return true;
  }

  // Get current user info
  getCurrentUser() {
    if (!this.authManager) {
      return null;
    }
    
    try {
      return this.authManager.getCurrentUser();
    } catch (error) {
      console.warn('[LoginIntegration] Error getting current user:', error);
      return null;
    }
  }

  // Logout and redirect
  async logout() {
    if (!this.authManager) {
      return;
    }
    
    await this.authManager.logout();
    // Use relative path for proper routing
    window.location.href = 'login.html';
  }

  // Display user info in game UI
  displayUserInfo(containerId = 'user-info') {
    const user = this.getCurrentUser();
    if (!user) {
      return;
    }
    
    const container = document.getElementById(containerId);
    if (!container) {
      return;
    }
    
    container.innerHTML = `
      <div class="user-display" style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        border: 2px solid #00ff00;
        padding: 10px 20px;
        border-radius: 8px;
        font-family: 'Courier New', monospace;
        color: #00ff00;
        z-index: 1000;
      ">
        <div style="display: flex; align-items: center; gap: 15px;">
          <span style="font-size: 14px; color: #00ffff;">PLAYER:</span>
          <span style="font-size: 16px; font-weight: bold;">${user.username}</span>
          <span style="color: #666;">|</span>
          <span style="font-size: 14px;">LVL ${user.statistics.level}</span>
          <span style="color: #666;">|</span>
          <button onclick="loginIntegration.logout()" style="
            background: none;
            border: 1px solid #ff0000;
            color: #ff0000;
            padding: 5px 10px;
            cursor: pointer;
            font-family: inherit;
            font-size: 12px;
            border-radius: 4px;
            transition: all 0.3s ease;
          " onmouseover="this.style.background='rgba(255,0,0,0.2)'" 
             onmouseout="this.style.background='none'">
            LOGOUT
          </button>
        </div>
        <div style="margin-top: 5px; font-size: 12px; color: #666;">
          Wins: ${user.statistics.wins} | Games: ${user.statistics.gamesPlayed}
        </div>
      </div>
    `;
  }

  // Integration with game scenes
  async integrateWithPhaser(scene) {
    if (!scene) {
      return;
    }
    
    // Check authentication
    const authStatus = await this.requireAuth();
    if (!authStatus) {
      return;
    }
    
    // Add user info to scene
    const user = this.getCurrentUser();
    if (user && scene.registry) {
      scene.registry.set('currentUser', user);
      scene.registry.set('isAuthenticated', true);
    }
    
    // Listen for logout events
    if (scene.events) {
      scene.events.on('logout-requested', () => {
        this.logout();
      });
    }
  }

  /**
   * Enhanced Phaser integration with comprehensive game state management
   * @param {Phaser.Game} game - Phaser game instance
   * @returns {Promise<void>}
   */
  async integrateWithPhaserScenes(game) {
    if (!game) {
      throw new Error('Game instance is required');
    }

    try {
      // Get current user data
      const isAuthenticated = this.authManager?.isAuthenticated() || false;
      const userData = isAuthenticated ? this.getCurrentUser() : null;

      // Store auth context in game registry
      game.registry.set('userContext', userData);
      game.registry.set('isAuthenticated', isAuthenticated);

      // Propagate context to all active scenes
      if (isAuthenticated && userData) {
        const scenes = game.scene.getScenes();
        scenes.forEach(scene => {
          try {
            if (scene.events && typeof scene.events.emit === 'function') {
              scene.events.emit('auth-context-updated', userData);
            }
          } catch (sceneError) {
            console.warn(`[LoginIntegration] Failed to update scene ${scene.sys?.key || 'unknown'}:`, sceneError);
          }
        });
      }

      // Emit global auth integration event
      game.events.emit('auth-integration-complete', { isAuthenticated, userData });

    } catch (error) {
      console.error('[LoginIntegration] Phaser integration error:', error);
      throw new Error('Failed to integrate with Phaser scenes');
    }
  }

  /**
   * Setup game state handlers for auth events
   * @param {Phaser.Game} game - Phaser game instance
   * @param {AuthGameBridge} authGameBridge - AuthGameBridge instance
   */
  setupGameStateHandlers(game, authGameBridge) {
    if (!game) {
      throw new Error('Game instance is required');
    }
    if (!authGameBridge) {
      throw new Error('AuthGameBridge instance is required');
    }

    if (!this.authManager) {
      console.warn('[LoginIntegration] No auth manager available for game state handlers');
      return;
    }

    // Setup auth event handlers
    this.authManager.on('login', (userData) => {
      authGameBridge.handleAuthStateChange({
        type: 'login',
        user: userData
      });
    });

    this.authManager.on('logout', () => {
      authGameBridge.handleAuthStateChange({
        type: 'logout'
      });
    });

    this.authManager.on('session_expired', () => {
      authGameBridge.handleAuthStateChange({
        type: 'session_expired'
      });
    });

    this.authManager.on('token_refresh', (userData) => {
      authGameBridge.handleAuthStateChange({
        type: 'token_refresh',
        user: userData
      });
    });
  }

  /**
   * Validate game access based on user permissions
   * @param {Array<string>} requiredPermissions - Required permissions for access
   * @returns {Promise<boolean>} True if user has access
   */
  async validateGameAccess(requiredPermissions = []) {
    try {
      // Check if user is authenticated
      if (!this.authManager?.isAuthenticated()) {
        return false;
      }

      // If no specific permissions required, allow access for authenticated users
      if (requiredPermissions.length === 0) {
        return true;
      }

      // Get user data and check permissions
      const user = this.getCurrentUser();
      if (!user || !user.auth || !user.auth.permissions) {
        return false;
      }

      // Check if user has all required permissions
      const userPermissions = user.auth.permissions;
      return requiredPermissions.every(permission => 
        userPermissions.includes(permission)
      );

    } catch (error) {
      console.error('[LoginIntegration] Error validating game access:', error);
      return false;
    }
  }

  /**
   * Setup authentication context for a specific scene
   * @param {Phaser.Scene} scene - Target scene
   * @returns {Promise<void>}
   */
  async setupSceneAuth(scene) {
    if (!scene) {
      throw new Error('Scene instance is required');
    }

    // Setup auth context update listener
    scene.events.on('auth-context-updated', (userData) => {
      if (scene.registry) {
        scene.registry.set('userContext', userData);
        scene.registry.set('isAuthenticated', userData !== null);
      }
    });

    // Setup logout request handler
    scene.events.on('logout-requested', () => {
      this.logout();
    });

    // Initialize with current auth state
    const isAuthenticated = this.authManager?.isAuthenticated() || false;
    const userData = isAuthenticated ? this.getCurrentUser() : null;
    
    if (scene.registry) {
      scene.registry.set('userContext', userData);
      scene.registry.set('isAuthenticated', isAuthenticated);
    }
  }

  /**
   * Get authenticated user or null
   * @returns {Object|null} User data or null
   */
  getAuthenticatedUser() {
    try {
      if (!this.authManager?.isAuthenticated()) {
        return null;
      }
      return this.getCurrentUser();
    } catch (error) {
      console.error('[LoginIntegration] Error getting authenticated user:', error);
      return null;
    }
  }

  // Update user statistics after game
  async updateGameStats(stats) {
    if (!this.authManager || !this.authManager.isAuthenticated()) {
      return;
    }
    
    const user = this.getCurrentUser();
    if (!user) {
      return;
    }
    
    // Update statistics
    if (stats.won) {
      user.statistics.wins++;
    } else {
      user.statistics.losses++;
    }
    
    user.statistics.gamesPlayed++;
    user.statistics.winRate = (user.statistics.wins / user.statistics.gamesPlayed) * 100;
    
    if (stats.points) {
      user.statistics.totalPoints += stats.points;
    }
    
    if (stats.time && (!user.statistics.bestTime || stats.time < user.statistics.bestTime)) {
      user.statistics.bestTime = stats.time;
    }
    
    // Calculate level based on points
    const newLevel = Math.floor(user.statistics.totalPoints / 1000) + 1;
    if (newLevel > user.statistics.level) {
      user.statistics.level = newLevel;
      // Could trigger level up animation/notification
    }
    
    // Save updated user data
    await this.authManager.storageManager.storeUserData(user);
  }
}

// Create singleton instance
const loginIntegration = new LoginIntegration();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = loginIntegration;
}

// Make available globally for browser
if (typeof window !== 'undefined') {
  window.loginIntegration = loginIntegration;
}