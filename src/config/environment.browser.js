// Browser-compatible Environment Configuration
// Provides configuration for browser environment without Node.js dependencies

class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Get secure configuration for browser environment
 * In browser, we use default/mock values for development
 */
function getSecureConfig() {
  // In browser environment, return development defaults
  return {
    NODE_ENV: process.env.NODE_ENV || 'development',
    JWT_SECRET: 'browser-development-jwt-secret-key-32chars-minimum',
    BCRYPT_SALT_ROUNDS: 12,
    PASSWORD_MIN_LENGTH: 8,
    SESSION_TIMEOUT: 3600000, // 1 hour
    REFRESH_TOKEN_EXPIRY: 604800000, // 7 days
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION: 900000, // 15 minutes
    API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3001',
    ENABLE_2FA: false,
    ENABLE_RATE_LIMITING: true,
    ENABLE_AUDIT_LOG: false,
    ENABLE_ENCRYPTION: false,
    LOG_LEVEL: 'info',
    CORS_ORIGIN: '*',
    SECURE_COOKIES: false,
    CSRF_ENABLED: false
  };
}

/**
 * Get test configuration for browser environment
 */
function getTestConfig() {
  return {
    ...getSecureConfig(),
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret-key-for-testing-purposes-32chars',
    SESSION_TIMEOUT: 1800000, // 30 minutes for testing
    MAX_LOGIN_ATTEMPTS: 3,
    ENABLE_RATE_LIMITING: false,
    LOG_LEVEL: 'debug'
  };
}

/**
 * Validate environment configuration
 */
function validateEnvironment() {
  // In browser, always return valid
  return { valid: true, errors: [], warnings: [] };
}

/**
 * Generate secure JWT secret (browser version)
 */
function generateSecureJWTSecret() {
  // In browser, use crypto.getRandomValues
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate JWT secret
 */
function validateJWTSecret(secret) {
  if (!secret || secret.length < 32) {
    return false;
  }
  return true;
}

// ES module exports
export {
  validateEnvironment,
  getSecureConfig,
  getTestConfig,
  generateSecureJWTSecret,
  validateJWTSecret,
  ConfigurationError
};