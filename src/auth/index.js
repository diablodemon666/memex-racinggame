// Enhanced Authentication System Entry Point
// Provides centralized access to enterprise-grade authentication functionality

// Use wrapper for CommonJS modules
import AuthManager from './AuthManager.wrapper.js';

// For now, stub out other modules to get the game running
const EnhancedAuthManager = AuthManager; // Use regular AuthManager for now
const EnhancedJWTManager = null;
const SessionManager = null;
const PasswordResetManager = null;
const ProductionSecurityManager = null;
const UserRoleManager = null;
const JWTManager = null;
const StorageManager = null;
const AuthUI = null;
const LoginForm = null;
const RegisterForm = null;

// Import config
import authConfig from './config.js';

/**
 * Create enhanced authentication manager with enterprise features
 * @param {Object} customConfig - Optional configuration overrides
 * @returns {EnhancedAuthManager} Configured enhanced auth manager
 */
export function createEnhancedAuthManager(customConfig = {}) {
  const config = { ...authConfig, ...customConfig };
  return new EnhancedAuthManager(config);
}

/**
 * Create legacy authentication manager (for backward compatibility)
 * @param {Object} customConfig - Optional configuration overrides
 * @returns {AuthManager} Configured legacy auth manager
 */
export function createAuthManager(customConfig = {}) {
  const config = { ...authConfig, ...customConfig };
  return new AuthManager(config);
}

/**
 * Initialize enhanced authentication system with all components
 * @param {Object} options - Initialization options
 * @returns {Object} Complete authentication system
 */
export function initializeAuthSystem(options = {}) {
  const config = { ...authConfig, ...options.config };
  
  const authManager = new EnhancedAuthManager(config);
  const authUI = new AuthUI(config.ui || {});
  
  return {
    authManager,
    authUI,
    
    // Quick access to subsystems
    jwtManager: authManager.jwtManager,
    sessionManager: authManager.sessionManager,
    passwordResetManager: authManager.passwordResetManager,
    securityManager: authManager.securityManager,
    roleManager: authManager.roleManager,
    
    // Utility methods
    async login(credentials, requestOptions = {}) {
      return await authManager.login(credentials, requestOptions);
    },
    
    async register(userData, requestOptions = {}) {
      return await authManager.register(userData, requestOptions);
    },
    
    async logout(options = {}) {
      return await authManager.logout(options);
    },
    
    async requestPasswordReset(identifier, options = {}) {
      return await authManager.requestPasswordReset(identifier, options);
    },
    
    async resetPassword(token, newPassword, options = {}) {
      return await authManager.resetPassword(token, newPassword, options);
    },
    
    getCurrentUser() {
      return authManager.getCurrentUser();
    },
    
    isAuthenticated() {
      return authManager.isAuthenticated();
    },
    
    hasPermission(userId, permission) {
      return authManager.hasPermission(userId, permission);
    },
    
    hasRole(userId, role) {
      return authManager.hasRole(userId, role);
    },
    
    getSystemStats() {
      return authManager.getSystemStats();
    },
    
    destroy() {
      authManager.destroy();
      if (authUI.destroy) {
        authUI.destroy();
      }
    }
  };
}

// Export all components and functions
export {
  // Enhanced components (recommended)
  EnhancedAuthManager,
  EnhancedJWTManager,
  SessionManager,
  PasswordResetManager,
  ProductionSecurityManager,
  UserRoleManager,
  
  // Legacy components (backward compatibility)
  AuthManager,
  JWTManager,
  StorageManager,
  AuthUI,
  LoginForm,
  RegisterForm,
  
  // Configuration
  authConfig
};

// Export aliases for convenience
export const createAuth = createEnhancedAuthManager; // Alias for enhanced
export const initAuth = initializeAuthSystem; // Alias for full system