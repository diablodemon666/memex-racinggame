// Enhanced Authentication Configuration
// Enterprise-grade configuration for all authentication subsystems

// Use browser-compatible environment module when in browser
import { getSecureConfig, getTestConfig } from '../config/environment.browser.js';

/**
 * Get environment-appropriate configuration
 * Uses test config in test environment to prevent validation failures
 */
function getEnvironmentConfig() {
  // In test environment, use actual environment validation to test the validation logic
  // Only use getTestConfig when no JWT_SECRET is provided at all
  if (process.env.NODE_ENV === 'test' && !process.env.JWT_SECRET) {
    return getTestConfig();
  }
  return getSecureConfig();
}

/**
 * Get enhanced authentication configuration with lazy evaluation
 * This allows tests to modify environment before config is loaded
 */
function getAuthConfig() {
  // Load validated environment configuration at runtime
  const envConfig = getEnvironmentConfig();

  return {
  // Enhanced JWT Configuration
  jwt: {
    secret: envConfig.JWT_SECRET,
    expiresIn: envConfig.JWT_EXPIRES_IN,
    refreshExpiresIn: envConfig.JWT_REFRESH_EXPIRES_IN,
    algorithm: 'HS256',
    issuer: 'memex-racing-game',
    audience: 'memex-racing-users',
    maxTokensPerUser: 5,
    rateLimitWindow: 15 * 60 * 1000, // 15 minutes
    rateLimitMaxAttempts: 10
  },

  // Enhanced Session Management Configuration
  session: {
    maxSessionsPerUser: 5,
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
    inactivityTimeout: 2 * 60 * 60 * 1000, // 2 hours
    rememberMeTimeout: 30 * 24 * 60 * 60 * 1000, // 30 days
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    suspiciousActivityThreshold: 10,
    ipChangeDetection: true,
    userAgentChangeDetection: true,
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
    securityAuditInterval: 1 * 60 * 1000, // 1 minute
    cookieName: 'memex_session',
    cookieSecure: envConfig.NODE_ENV === 'production',
    cookieHttpOnly: true,
    cookieSameSite: 'strict'
  },

  // Production Security Configuration
  security: {
    environment: envConfig.NODE_ENV,
    isProduction: envConfig.NODE_ENV === 'production',
    
    // Rate limiting
    globalRateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 1000,
      skipSuccessfulRequests: false
    },
    
    authRateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 10,
      skipSuccessfulRequests: true
    },
    
    // CSRF protection
    csrf: {
      enabled: true,
      tokenLength: 32,
      cookieOptions: {
        httpOnly: true,
        secure: envConfig.NODE_ENV === 'production',
        sameSite: 'strict'
      }
    },
    
    // Security headers
    securityHeaders: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
    },
    
    // Threat detection
    threatDetection: {
      enabled: true,
      suspiciousThreshold: 10,
      autoBlockThreshold: 50,
      monitoringWindow: 60 * 60 * 1000, // 1 hour
      analysisInterval: 5 * 60 * 1000 // 5 minutes
    },
    
    // Audit configuration
    audit: {
      enabled: true,
      maxLogSize: 10000,
      retentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days
      sensitiveEvents: [
        'login_attempt',
        'password_reset',
        'session_created', 
        'security_violation',
        'admin_action'
      ]
    },
    
    // Input validation
    inputValidation: {
      maxStringLength: 1000,
      maxArrayLength: 100,
      maxObjectDepth: 5,
      allowedFileTypes: ['png', 'jpg', 'jpeg', 'gif'],
      maxFileSize: 5 * 1024 * 1024 // 5MB
    }
  },

  // Password Reset Configuration
  passwordReset: {
    tokenLength: 32,
    tokenExpiry: 60 * 60 * 1000, // 1 hour
    maxActiveTokensPerUser: 3,
    maxRequestsPerHour: 5,
    maxRequestsPerDay: 10,
    rateLimitWindow: 60 * 60 * 1000, // 1 hour
    requireEmailVerification: true,
    allowMultipleActiveTokens: false,
    cleanupInterval: 10 * 60 * 1000, // 10 minutes
    emailService: {
      enabled: false, // Set to true when email service is configured
      provider: 'mock',
      templates: {
        resetRequest: 'password-reset-request',
        resetSuccess: 'password-reset-success'
      }
    }
  },

  // Enhanced Password Configuration  
  password: {
    saltRounds: envConfig.BCRYPT_SALT_ROUNDS,
    minLength: 8,
    maxLength: 128, // Prevent DoS attacks
    requireSpecialChars: true,
    requireNumbers: true,
    requireUppercase: true,
    requireLowercase: true,
    preventCommonPasswords: true,
    preventUserInfoInPassword: true
  },

  // Role and Permission Management Configuration
  roles: {
    defaultRole: 'user',
    adminRole: 'admin',
    enableRoleInheritance: true,
    maxRoleDepth: 5,
    defaultTempDuration: 24 * 60 * 60 * 1000, // 24 hours
    maxTempDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
    auditEnabled: true,
    auditRetentionPeriod: 90 * 24 * 60 * 60 * 1000, // 90 days
    maxAuditLogSize: 10000,
    requirePermissionForRoleManagement: true,
    allowSelfRoleModification: false,
    cleanupInterval: 60 * 60 * 1000 // 1 hour
  },

  // Enhanced Storage Configuration
  storage: {
    encryption: true,
    keyPrefix: 'memex_racing_',
    algorithm: 'AES-256-GCM',
    keyDerivation: 'PBKDF2',
    iterations: 100000
  },

  // Backward Compatibility Configuration
  validation: {
    minPasswordLength: 8,
    requireSpecialChars: true,
    requireNumbers: true,
    requireUppercase: true,
    requireLowercase: true,
    maxLength: 128, // Prevent DoS attacks
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000 // 15 minutes
  },

  // Legacy Rate Limiting Configuration (for backward compatibility)
  rateLimiting: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 100, // per window
    skipSuccessfulRequests: true,
    skipFailedRequests: false
  },

  // Legacy CSRF Configuration (for backward compatibility)
  csrf: {
    enabled: true,
    cookieName: '_csrf',
    headerName: 'x-csrf-token',
    ignoreMethods: ['GET', 'HEAD', 'OPTIONS']
  },

  // Environment Information
  environment: {
    nodeEnv: envConfig.NODE_ENV,
    serverUrl: envConfig.REACT_APP_SERVER_URL,
    isDevelopment: envConfig.NODE_ENV === 'development',
    isProduction: envConfig.NODE_ENV === 'production',  
    isTest: envConfig.NODE_ENV === 'test'
  }
  };
}

// Create cached config instance
let authConfigCache = null;

/**
 * Clear cached configuration (useful for tests)
 */
function clearAuthConfigCache() {
  authConfigCache = null;
}

// Create a proxy that lazily loads the config
const authConfigProxy = new Proxy({}, {
  get(target, prop) {
    if (!authConfigCache) {
      authConfigCache = getAuthConfig();
    }
    return authConfigCache[prop];
  },
  has(target, prop) {
    if (!authConfigCache) {
      authConfigCache = getAuthConfig();
    }
    return prop in authConfigCache;
  },
  ownKeys(target) {
    if (!authConfigCache) {
      authConfigCache = getAuthConfig();
    }
    return Object.keys(authConfigCache);
  },
  getOwnPropertyDescriptor(target, prop) {
    if (!authConfigCache) {
      authConfigCache = getAuthConfig();
    }
    return Object.getOwnPropertyDescriptor(authConfigCache, prop);
  }
});

export default authConfigProxy;
export { getAuthConfig, clearAuthConfigCache };