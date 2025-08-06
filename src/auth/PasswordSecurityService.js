/**
 * Password Security Service
 * Provides secure password hashing and verification with timing attack prevention
 */

const bcrypt = require('bcrypt');
const authConfig = require('./config');

/**
 * Custom error for password-related issues
 */
class PasswordSecurityError extends Error {
  constructor(message, code = 'PASSWORD_ERROR') {
    super(message);
    this.name = 'PasswordSecurityError';
    this.code = code;
  }
}

/**
 * Password Security Service
 * Handles all password hashing and verification operations
 */
class PasswordSecurityService {
  constructor(saltRounds = null) {
    // Use configured salt rounds or fallback to default
    this.saltRounds = saltRounds || authConfig.password.saltRounds;
    
    // Validate salt rounds
    if (this.saltRounds < 10) {
      throw new PasswordSecurityError(
        'Salt rounds must be at least 10 for security',
        'INVALID_SALT_ROUNDS'
      );
    }
    
    if (this.saltRounds > 15) {
      console.warn(`Warning: Salt rounds ${this.saltRounds} may cause performance issues`);
    }
  }

  /**
   * Validate password meets security requirements
   * @param {string} password - Plain text password to validate
   * @throws {PasswordSecurityError} - If password doesn't meet requirements
   */
  validatePasswordStrength(password) {
    const config = authConfig.password;
    const errors = [];

    if (!password || typeof password !== 'string') {
      throw new PasswordSecurityError('Password must be a non-empty string', 'INVALID_TYPE');
    }

    if (password.length < config.minLength) {
      errors.push(`Password must be at least ${config.minLength} characters long`);
    }

    if (password.length > config.maxLength) {
      errors.push(`Password must not exceed ${config.maxLength} characters`);
    }

    if (config.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (config.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (config.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (config.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common weak patterns
    const weakPatterns = [
      /(.)\1{2,}/, // Three or more repeated characters
      /123456|654321|qwerty|password|admin|login/, // Common sequences
      /^[0-9]+$/, // Only numbers
      /^[a-zA-Z]+$/ // Only letters
    ];

    for (const pattern of weakPatterns) {
      if (pattern.test(password.toLowerCase())) {
        errors.push('Password contains weak patterns');
        break;
      }
    }

    if (errors.length > 0) {
      throw new PasswordSecurityError(
        `Password validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`,
        'WEAK_PASSWORD'
      );
    }
  }

  /**
   * Hash a password using bcrypt
   * @param {string} plaintext - Plain text password to hash
   * @returns {Promise<string>} - Bcrypt hash
   * @throws {PasswordSecurityError} - If hashing fails
   */
  async hashPassword(plaintext) {
    try {
      // Validate password strength first
      this.validatePasswordStrength(plaintext);

      // Generate hash using bcrypt
      const hash = await bcrypt.hash(plaintext, this.saltRounds);
      
      // Verify the hash was created successfully
      if (!hash || typeof hash !== 'string' || hash.length < 50) {
        throw new Error('Hash generation produced invalid result');
      }

      return hash;
    } catch (error) {
      if (error instanceof PasswordSecurityError) {
        throw error;
      }
      
      throw new PasswordSecurityError(
        `Password hashing failed: ${error.message}`,
        'HASH_GENERATION_ERROR'
      );
    }
  }

  /**
   * Verify a password against a stored hash
   * Includes timing attack prevention
   * @param {string} plaintext - Plain text password to verify
   * @param {string} hash - Stored bcrypt hash
   * @returns {Promise<boolean>} - True if password matches
   */
  async verifyPassword(plaintext, hash) {
    try {
      // Always perform some operation to prevent timing attacks
      // even when inputs are invalid
      if (!plaintext || !hash) {
        // Perform dummy hash operation with consistent timing
        await bcrypt.hash('dummy-password-for-timing-consistency', this.saltRounds);
        return false;
      }

      // Validate input types
      if (typeof plaintext !== 'string' || typeof hash !== 'string') {
        // Perform dummy operation for timing consistency
        await bcrypt.hash('dummy-password-for-timing-consistency', this.saltRounds);
        return false;
      }

      // Verify hash format (bcrypt hashes start with $2a$, $2b$, or $2y$)
      if (!hash.match(/^\$2[aby]\$\d{2}\$.{53}$/)) {
        // Perform dummy operation for timing consistency
        await bcrypt.hash('dummy-password-for-timing-consistency', this.saltRounds);
        return false;
      }

      // Perform actual password verification
      const isValid = await bcrypt.compare(plaintext, hash);
      return isValid;

    } catch (error) {
      // Log error for debugging but don't expose details to caller
      console.error('Password verification error:', error.message);
      
      // Perform dummy operation to maintain consistent timing
      try {
        await bcrypt.hash('dummy-password-for-timing-consistency', this.saltRounds);
      } catch (dummyError) {
        // Ignore dummy operation errors
      }
      
      return false;
    }
  }

  /**
   * Change a user's password with proper verification
   * @param {string} currentPassword - Current plain text password
   * @param {string} currentHash - Current stored hash
   * @param {string} newPassword - New plain text password
   * @returns {Promise<string>} - New password hash
   * @throws {PasswordSecurityError} - If current password is wrong or new password is invalid
   */
  async changePassword(currentPassword, currentHash, newPassword) {
    // Verify current password
    const currentPasswordValid = await this.verifyPassword(currentPassword, currentHash);
    
    if (!currentPasswordValid) {
      throw new PasswordSecurityError(
        'Current password is incorrect',
        'INVALID_CURRENT_PASSWORD'
      );
    }

    // Ensure new password is different from current
    const samePassword = await this.verifyPassword(newPassword, currentHash);
    if (samePassword) {
      throw new PasswordSecurityError(
        'New password must be different from current password',
        'SAME_PASSWORD'
      );
    }

    // Generate hash for new password
    return await this.hashPassword(newPassword);
  }

  /**
   * Generate a secure random password
   * @param {number} length - Password length (default: 16)
   * @param {object} options - Password generation options
   * @returns {string} - Generated password
   */
  generateSecurePassword(length = 16, options = {}) {
    const defaults = {
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSpecialChars: true,
      excludeSimilar: true // Exclude similar-looking characters
    };

    const config = { ...defaults, ...options };
    
    let charset = '';
    
    if (config.includeLowercase) {
      charset += config.excludeSimilar ? 'abcdefghijkmnopqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
    }
    
    if (config.includeUppercase) {
      charset += config.excludeSimilar ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    }
    
    if (config.includeNumbers) {
      charset += config.excludeSimilar ? '23456789' : '0123456789';
    }
    
    if (config.includeSpecialChars) {
      charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    }

    if (charset.length === 0) {
      throw new PasswordSecurityError('No character sets enabled for password generation');
    }

    const crypto = require('crypto');
    let password = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      password += charset[randomIndex];
    }

    return password;
  }

  /**
   * Check if a password hash needs rehashing (e.g., salt rounds have increased)
   * @param {string} hash - Existing password hash
   * @returns {boolean} - True if rehashing is needed
   */
  needsRehash(hash) {
    try {
      return bcrypt.getRounds(hash) < this.saltRounds;
    } catch (error) {
      // If we can't determine rounds, assume rehashing is needed
      return true;
    }
  }

  /**
   * Get information about a password hash
   * @param {string} hash - Password hash to analyze
   * @returns {object} - Hash information
   */
  getHashInfo(hash) {
    try {
      return {
        algorithm: 'bcrypt',
        rounds: bcrypt.getRounds(hash),
        needsRehash: this.needsRehash(hash),
        isValid: hash.match(/^\$2[aby]\$\d{2}\$.{53}$/) !== null
      };
    } catch (error) {
      return {
        algorithm: 'unknown',
        rounds: null,
        needsRehash: true,
        isValid: false,
        error: error.message
      };
    }
  }

  /**
   * Benchmark password hashing performance
   * @param {number} iterations - Number of test iterations (default: 5)
   * @returns {Promise<object>} - Performance metrics
   */
  async benchmarkPerformance(iterations = 5) {
    const testPassword = 'TestPassword123!';
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = process.hrtime.bigint();
      await this.hashPassword(testPassword);
      const endTime = process.hrtime.bigint();
      
      const durationMs = Number(endTime - startTime) / 1_000_000;
      times.push(durationMs);
    }

    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    return {
      saltRounds: this.saltRounds,
      iterations,
      averageTimeMs: Math.round(avgTime),
      minTimeMs: Math.round(minTime),
      maxTimeMs: Math.round(maxTime),
      recommendation: avgTime > 1000 ? 'Consider reducing salt rounds for better performance' : 'Performance is acceptable'
    };
  }
}

module.exports = {
  PasswordSecurityService,
  PasswordSecurityError
};