// Environment Configuration Manager
// Validates and loads environment variables with proper defaults and security checks

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
// Try multiple paths to find the .env file
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env')
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    break;
  }
}

class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Environment configuration schema defining validation rules
 */
const ENV_SCHEMA = {
  NODE_ENV: {
    required: true,
    enum: ['development', 'production', 'test'],
    default: 'development'
  },
  JWT_SECRET: {
    required: true,
    minLength: 32,
    validation: 'secure',
    description: 'Cryptographically secure JWT signing secret'
  },
  BCRYPT_SALT_ROUNDS: {
    required: false,
    type: 'number',
    min: 10,
    max: 15,
    default: 12,
    description: 'bcrypt salt rounds for password hashing'
  },
  JWT_EXPIRES_IN: {
    required: false,
    default: '1h',
    description: 'JWT token expiration time'
  },
  JWT_REFRESH_EXPIRES_IN: {
    required: false,
    default: '7d',
    description: 'JWT refresh token expiration time'
  },
  DATABASE_URL: {
    required: false,
    format: 'url',
    description: 'Database connection URL'
  },
  REACT_APP_SERVER_URL: {
    required: false,
    format: 'url',
    default: 'http://localhost:3001',
    description: 'Server URL for client connections'
  }
};

/**
 * List of weak/common secrets that should be rejected
 */
const FORBIDDEN_JWT_SECRETS = [
  'default',
  'secret',
  'password',
  'memex-racing-default-secret-change-in-production',
  'development-secret-change-in-production',
  'test',
  '123456',
  'qwerty',
  'admin',
  'your-secret-key',
  'change-me',
  'jwt-secret'
];

/**
 * Validates JWT secret for security requirements
 * @param {string} secret - JWT secret to validate
 * @returns {string} - Validated secret
 * @throws {ConfigurationError} - If secret is invalid
 */
function validateJWTSecret(secret) {
  if (!secret) {
    throw new ConfigurationError(
      'JWT_SECRET environment variable is required. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  if (typeof secret !== 'string') {
    throw new ConfigurationError('JWT_SECRET must be a string');
  }

  if (secret.length < 32) {
    throw new ConfigurationError(
      `JWT secret must be at least 32 characters long. Current length: ${secret.length}. ` +
      'Generate a secure secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  // Check against forbidden secrets (exact match, case-insensitive)
  const lowerSecret = secret.toLowerCase();
  if (FORBIDDEN_JWT_SECRETS.some(forbidden => lowerSecret === forbidden.toLowerCase())) {
    throw new ConfigurationError(
      'JWT secret appears to contain weak or default values. ' +
      'Use a cryptographically secure random string generated with: ' +
      'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  // Check for basic entropy (should not be all same character or simple patterns)
  const uniqueChars = new Set(secret).size;
  if (uniqueChars < 8) {
    throw new ConfigurationError(
      'JWT secret has insufficient entropy. Use a cryptographically secure random string.'
    );
  }

  return secret;
}

/**
 * Validates URL format
 * @param {string} url - URL to validate
 * @returns {boolean} - True if valid URL
 */
function isValidURL(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates a single environment variable according to schema
 * @param {string} key - Environment variable key
 * @param {any} value - Environment variable value
 * @param {object} schema - Validation schema for the variable
 * @returns {any} - Validated and coerced value
 */
function validateEnvVar(key, value, schema) {
  // Handle required variables
  if (schema.required && (value === undefined || value === null || value === '')) {
    throw new ConfigurationError(
      `${key} is required. ${schema.description || ''}`
    );
  }

  // Use default if value is missing
  if ((value === undefined || value === null || value === '') && schema.default !== undefined) {
    value = schema.default;
  }

  // Skip validation if value is still empty and not required
  if (!value && !schema.required) {
    return value;
  }

  // Type coercion
  if (schema.type === 'number') {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) {
      throw new ConfigurationError(`${key} must be a valid number`);
    }
    value = numValue;

    if (schema.min !== undefined && value < schema.min) {
      throw new ConfigurationError(`${key} must be at least ${schema.min}`);
    }
    if (schema.max !== undefined && value > schema.max) {
      throw new ConfigurationError(`${key} must be at most ${schema.max}`);
    }
  }

  // Enum validation
  if (schema.enum && !schema.enum.includes(value)) {
    throw new ConfigurationError(
      `${key} must be one of: ${schema.enum.join(', ')}. Current value: ${value}`
    );
  }

  // Length validation
  if (schema.minLength && value.length < schema.minLength) {
    throw new ConfigurationError(
      `${key} must be at least ${schema.minLength} characters long`
    );
  }

  // Format validation
  if (schema.format === 'url' && !isValidURL(value)) {
    throw new ConfigurationError(`${key} must be a valid URL`);
  }

  // Custom validation
  if (schema.validation === 'secure' && key === 'JWT_SECRET') {
    return validateJWTSecret(value);
  }

  return value;
}

/**
 * Validates all environment variables according to schema
 * @returns {object} - Validated configuration object
 */
function validateEnvironment() {
  const config = {};
  const errors = [];

  // Validate each schema entry
  for (const [key, schema] of Object.entries(ENV_SCHEMA)) {
    try {
      const value = process.env[key];
      config[key] = validateEnvVar(key, value, schema);
    } catch (error) {
      errors.push(`${key}: ${error.message}`);
    }
  }

  // Throw all validation errors at once
  if (errors.length > 0) {
    throw new ConfigurationError(
      `Environment validation failed:\n${errors.map(error => `  - ${error}`).join('\n')}`
    );
  }

  return config;
}

/**
 * Generates a cryptographically secure JWT secret
 * @returns {string} - 64-character hex string
 */
function generateSecureJWTSecret() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Gets secure configuration with validation
 * @returns {object} - Validated configuration object
 */
function getSecureConfig() {
  try {
    return validateEnvironment();
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error('\n❌ Configuration Error:');
      console.error(error.message);
      
      if (error.message.includes('JWT_SECRET')) {
        console.error('\n🔧 Quick Fix:');
        console.error('Add this to your .env file:');
        console.error(`JWT_SECRET=${generateSecureJWTSecret()}`);
      }
      
      console.error('\n📖 For more help, see the configuration documentation.');
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Validates environment in test mode with mock values
 * @returns {object} - Test configuration
 */
function getTestConfig() {
  // Provide test defaults that don't interfere with validation
  // Using a secure-looking test secret that passes validation
  const testEnv = {
    NODE_ENV: 'test',
    JWT_SECRET: 'secure-test-jwt-key-f7b2c9e1a8d5c4e6f3a7b9c2d1e4f6a8b5c7d2e9f1a6b3c8d5e2f7a4b1c6d9e3',
    BCRYPT_SALT_ROUNDS: '10', // Lower for faster tests
    JWT_EXPIRES_IN: '1h',
    JWT_REFRESH_EXPIRES_IN: '7d',
    REACT_APP_SERVER_URL: 'http://localhost:3001'
  };

  // Return test config directly without environment validation in test mode
  // This bypasses the strict validation that's meant for production
  return {
    NODE_ENV: testEnv.NODE_ENV,
    JWT_SECRET: testEnv.JWT_SECRET,
    BCRYPT_SALT_ROUNDS: parseInt(testEnv.BCRYPT_SALT_ROUNDS, 10),
    JWT_EXPIRES_IN: testEnv.JWT_EXPIRES_IN,
    JWT_REFRESH_EXPIRES_IN: testEnv.JWT_REFRESH_EXPIRES_IN,
    REACT_APP_SERVER_URL: testEnv.REACT_APP_SERVER_URL
  };
}

module.exports = {
  validateEnvironment,
  getSecureConfig,
  getTestConfig,
  generateSecureJWTSecret,
  validateJWTSecret,
  ConfigurationError,
  ENV_SCHEMA
};