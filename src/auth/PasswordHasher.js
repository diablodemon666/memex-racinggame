// Password Hashing System for Authentication Security
// Implements crypto-based password hashing with security best practices

const crypto = require('crypto');
const { pbkdf2Sync, timingSafeEqual } = crypto;

class PasswordHasher {
  constructor(config = {}) {
    this.config = {
      saltRounds: 12, // High security default (requirements specify >= 12)
      maxPasswordLength: 128, // Prevent DoS attacks
      timingAttackPreventionDelay: 100, // Fixed delay to prevent timing attacks
      ...config
    };
    
    // Validate configuration
    if (this.config.saltRounds < 12) {
      throw new Error('Salt rounds must be at least 12 for security compliance');
    }
    
    if (this.config.saltRounds > 20) {
      console.warn('Salt rounds > 20 may cause performance issues. Consider reducing to 12-15.');
    }
  }

  /**
   * Hash a password using PBKDF2 with secure salt rounds
   * @param {string} password - Plain text password to hash
   * @returns {Promise<string>} - PBKDF2 hash of the password
   * @throws {Error} - If password is invalid or hashing fails
   */
  async hashPassword(password) {
    try {
      // Input validation
      if (!password || typeof password !== 'string') {
        throw new Error('Password must be a non-empty string');
      }
      
      if (password.length > this.config.maxPasswordLength) {
        throw new Error(`Password exceeds maximum length of ${this.config.maxPasswordLength} characters`);
      }
      
      // Generate salt and hash password using PBKDF2
      const salt = crypto.randomBytes(16);
      const iterations = Math.pow(2, this.config.saltRounds); // Convert salt rounds to iterations
      const hash = pbkdf2Sync(password, salt, iterations, 64, 'sha256');
      
      // Combine salt and hash for storage (similar to bcrypt format)
      const combined = `$pbkdf2$${this.config.saltRounds}$${salt.toString('base64')}$${hash.toString('base64')}`;
      
      return combined;
    } catch (error) {
      // Re-throw with context for debugging
      throw new Error(`Password hashing failed: ${error.message}`);
    }
  }

  /**
   * Verify a password against its hash with timing attack protection
   * @param {string} password - Plain text password to verify
   * @param {string} hash - PBKDF2 hash to compare against
   * @returns {Promise<boolean>} - True if password matches hash
   * @throws {Error} - If inputs are invalid
   */
  async verifyPassword(password, hash) {
    try {
      // Input validation
      if (!password || typeof password !== 'string') {
        throw new Error('Password must be a non-empty string');
      }
      
      if (!hash || typeof hash !== 'string') {
        throw new Error('Hash must be a non-empty string');
      }
      
      // Add fixed delay to prevent timing attacks
      const startTime = Date.now();
      
      let isValid = false;
      
      // Check if it's a PBKDF2 hash or legacy bcrypt hash
      if (hash.startsWith('$pbkdf2$')) {
        isValid = this.verifyPBKDF2Hash(password, hash);
      } else if (this.isValidBcryptHash(hash)) {
        // Legacy bcrypt hash - should be migrated
        console.warn('Legacy bcrypt hash detected, should be migrated to PBKDF2');
        isValid = false; // Force migration by returning false
      } else {
        // Handle plaintext passwords for migration
        isValid = (password === hash);
      }
      
      // Ensure minimum processing time to prevent timing attacks
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < this.config.timingAttackPreventionDelay) {
        await this.delay(this.config.timingAttackPreventionDelay - elapsedTime);
      }
      
      return isValid;
    } catch (error) {
      // Always delay on error to prevent timing attacks
      await this.delay(this.config.timingAttackPreventionDelay);
      
      throw new Error(`Password verification failed: ${error.message}`);
    }
  }

  /**
   * Verify a password against a PBKDF2 hash
   * @param {string} password - Plain text password
   * @param {string} hash - PBKDF2 hash in format $pbkdf2$saltRounds$salt$hash
   * @returns {boolean} - True if password matches
   */
  verifyPBKDF2Hash(password, hash) {
    try {
      // Parse PBKDF2 hash format: $pbkdf2$saltRounds$salt$hash
      const parts = hash.split('$');
      if (parts.length !== 5 || parts[0] !== '' || parts[1] !== 'pbkdf2') {
        throw new Error('Invalid PBKDF2 hash format');
      }
      
      const saltRounds = parseInt(parts[2]);
      const salt = Buffer.from(parts[3], 'base64');
      const expectedHash = Buffer.from(parts[4], 'base64');
      
      // Compute hash with same parameters
      const iterations = Math.pow(2, saltRounds);
      const computedHash = pbkdf2Sync(password, salt, iterations, 64, 'sha256');
      
      // Use timing-safe comparison
      return timingSafeEqual(expectedHash, computedHash);
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if a hash needs to be rehashed (e.g., salt rounds changed)
   * @param {string} hash - Hash to check (PBKDF2 or bcrypt)
   * @returns {boolean} - True if hash should be updated
   */
  needsRehash(hash) {
    try {
      if (!hash || typeof hash !== 'string') {
        return true; // Invalid hash needs rehashing
      }
      
      if (hash.startsWith('$pbkdf2$')) {
        // PBKDF2 hash - check salt rounds
        const parts = hash.split('$');
        if (parts.length !== 5) return true;
        const saltRounds = parseInt(parts[2]);
        return saltRounds < this.config.saltRounds;
      } else if (this.isValidBcryptHash(hash)) {
        // Bcrypt hash - should be migrated to PBKDF2
        return true;
      } else {
        // Plaintext password - definitely needs hashing
        return true;
      }
    } catch (error) {
      // If we can't parse the hash, it needs rehashing
      return true;
    }
  }

  /**
   * Migrate a plaintext password to hashed format
   * @param {string} plaintextPassword - Original plaintext password
   * @returns {Promise<{hash: string, needsMigration: boolean}>} - Migration result
   */
  async migratePassword(plaintextPassword) {
    try {
      const hash = await this.hashPassword(plaintextPassword);
      return {
        hash: hash,
        needsMigration: true,
        migrationTimestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Password migration failed: ${error.message}`);
    }
  }

  /**
   * Validate if a string is a valid bcrypt hash
   * @param {string} hash - Hash to validate
   * @returns {boolean} - True if valid bcrypt hash format
   */
  isValidBcryptHash(hash) {
    if (!hash || typeof hash !== 'string') {
      return false;
    }
    
    // Bcrypt hash format: $version$rounds$salt+hash
    const bcryptRegex = /^\$2[abyxz]?\$\d{1,2}\$[./0-9A-Za-z]{53}$/;
    return bcryptRegex.test(hash);
  }

  /**
   * Parse bcrypt hash to extract information
   * @param {string} hash - Bcrypt hash to parse
   * @returns {object} - Parsed hash information
   */
  parseBcryptHash(hash) {
    if (!this.isValidBcryptHash(hash)) {
      throw new Error('Invalid bcrypt hash format');
    }
    
    const parts = hash.split('$');
    return {
      version: parts[1],
      saltRounds: parseInt(parts[2], 10),
      saltAndHash: parts[3]
    };
  }

  /**
   * Generate a secure random salt (for advanced use cases)
   * @returns {Promise<string>} - Generated salt
   */
  async generateSalt() {
    try {
      return await bcrypt.genSalt(this.config.saltRounds);
    } catch (error) {
      throw new Error(`Salt generation failed: ${error.message}`);
    }
  }

  /**
   * Get configuration information (for debugging/monitoring)
   * @returns {object} - Current configuration
   */
  getConfig() {
    return {
      saltRounds: this.config.saltRounds,
      maxPasswordLength: this.config.maxPasswordLength,
      version: this.getVersion()
    };
  }

  /**
   * Get bcrypt version information
   * @returns {string} - Bcrypt version
   */
  getVersion() {
    try {
      return require('bcrypt/package.json').version;
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Utility method to add delay (for timing attack prevention)
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Batch hash multiple passwords (for bulk operations)
   * @param {string[]} passwords - Array of passwords to hash
   * @returns {Promise<{hash: string, originalIndex: number}[]>} - Array of hashed passwords
   */
  async batchHashPasswords(passwords) {
    if (!Array.isArray(passwords)) {
      throw new Error('Passwords must be an array');
    }
    
    const results = [];
    for (let i = 0; i < passwords.length; i++) {
      try {
        const hash = await this.hashPassword(passwords[i]);
        results.push({
          hash: hash,
          originalIndex: i,
          success: true
        });
      } catch (error) {
        results.push({
          error: error.message,
          originalIndex: i,
          success: false
        });
      }
    }
    
    return results;
  }

  /**
   * Create password hasher with default secure configuration
   * @returns {PasswordHasher} - Configured password hasher instance
   */
  static createSecure() {
    return new PasswordHasher({
      saltRounds: 12,
      maxPasswordLength: 128,
      timingAttackPreventionDelay: 100
    });
  }

  /**
   * Create password hasher for development (faster but less secure)
   * @returns {PasswordHasher} - Configured password hasher instance
   */
  static createDevelopment() {
    console.warn('Using development password hasher - NOT FOR PRODUCTION');
    return new PasswordHasher({
      saltRounds: 4, // Faster for testing
      maxPasswordLength: 128,
      timingAttackPreventionDelay: 10
    });
  }
}

module.exports = PasswordHasher;