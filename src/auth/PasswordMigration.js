// Password Migration Utility for Existing Plaintext Passwords
// Safely migrates stored plaintext passwords to bcrypt hashes

const PasswordHasher = require('./PasswordHasher.js');
const StorageManager = require('./StorageManager.js');

class PasswordMigration {
  constructor(config = {}) {
    this.config = {
      batchSize: 10, // Process passwords in batches to prevent performance issues
      maxRetries: 3,
      logProgress: true,
      backupBeforeMigration: true,
      dryRun: false, // Set to true to test without making changes
      ...config
    };
    
    this.passwordHasher = new PasswordHasher(config.passwordHashing || {});
    this.storageManager = new StorageManager(config.storage || {});
    this.migrationLog = [];
  }

  /**
   * Migrate all plaintext passwords to hashed format
   * @returns {Promise<{success: boolean, migrated: number, errors: Array, log: Array}>}
   */
  async migrateAllPasswords() {
    const startTime = Date.now();
    let migrated = 0;
    let errors = [];
    
    try {
      this.log('Starting password migration process...', 'info');
      
      // Get all users from storage
      const users = this.getAllStoredUsers();
      this.log(`Found ${users.length} users to check for migration`, 'info');
      
      if (users.length === 0) {
        this.log('No users found for migration', 'info');
        return {
          success: true,
          migrated: 0,
          errors: [],
          log: this.migrationLog,
          duration: Date.now() - startTime
        };
      }
      
      // Create backup if enabled
      if (this.config.backupBeforeMigration && !this.config.dryRun) {
        await this.createBackup();
      }
      
      // Process users in batches
      const batches = this.createBatches(users, this.config.batchSize);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        this.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} users)`, 'info');
        
        const batchResults = await this.processBatch(batch);
        migrated += batchResults.migrated;
        errors = errors.concat(batchResults.errors);
        
        // Add small delay between batches to prevent overwhelming the system
        if (i < batches.length - 1) {
          await this.delay(100);
        }
      }
      
      const duration = Date.now() - startTime;
      this.log(`Migration completed: ${migrated} passwords migrated, ${errors.length} errors, ${duration}ms`, 'info');
      
      return {
        success: errors.length === 0,
        migrated: migrated,
        errors: errors,
        log: this.migrationLog,
        duration: duration
      };
      
    } catch (error) {
      this.log(`Migration failed: ${error.message}`, 'error');
      errors.push({
        type: 'MIGRATION_FAILURE',
        message: error.message,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: false,
        migrated: migrated,
        errors: errors,
        log: this.migrationLog,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Process a batch of users for password migration
   * @param {Array} users - Batch of users to process
   * @returns {Promise<{migrated: number, errors: Array}>}
   */
  async processBatch(users) {
    let migrated = 0;
    let errors = [];
    
    const promises = users.map(async (user) => {
      try {
        const result = await this.migrateUserPassword(user);
        if (result.migrated) {
          migrated++;
        }
        return result;
      } catch (error) {
        const errorInfo = {
          type: 'USER_MIGRATION_ERROR',
          userId: user.id,
          username: user.username,
          message: error.message,
          timestamp: new Date().toISOString()
        };
        errors.push(errorInfo);
        this.log(`Failed to migrate user ${user.username}: ${error.message}`, 'error');
        return { migrated: false, error: errorInfo };
      }
    });
    
    const results = await Promise.allSettled(promises);
    
    // Process results
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const user = users[index];
        const errorInfo = {
          type: 'PROMISE_REJECTION',
          userId: user.id,
          username: user.username,
          message: result.reason.message,
          timestamp: new Date().toISOString()
        };
        errors.push(errorInfo);
        this.log(`Promise rejected for user ${user.username}: ${result.reason.message}`, 'error');
      } else if (result.value.migrated) {
        migrated++;
      } else if (result.value.error) {
        errors.push(result.value.error);
      }
    });
    
    return { migrated, errors };
  }

  /**
   * Migrate a single user's password
   * @param {Object} user - User object with id and username
   * @returns {Promise<{migrated: boolean, reason: string}>}
   */
  async migrateUserPassword(user) {
    try {
      // Get stored password
      const storedPassword = await this.storageManager.getStoredPassword(user.id);
      
      if (!storedPassword) {
        this.log(`No stored password found for user ${user.username}`, 'warn');
        return { migrated: false, reason: 'NO_PASSWORD_FOUND' };
      }
      
      // Check if already hashed
      if (this.passwordHasher.isValidBcryptHash(storedPassword)) {
        this.log(`Password already hashed for user ${user.username}`, 'info');
        return { migrated: false, reason: 'ALREADY_HASHED' };
      }
      
      // Validate plaintext password (basic checks)
      if (!this.isValidPlaintextPassword(storedPassword)) {
        this.log(`Invalid plaintext password format for user ${user.username}`, 'warn');
        return { migrated: false, reason: 'INVALID_PLAINTEXT' };
      }
      
      if (this.config.dryRun) {
        this.log(`[DRY RUN] Would migrate password for user ${user.username}`, 'info');
        return { migrated: false, reason: 'DRY_RUN' };
      }
      
      // Hash the plaintext password
      const hashedPassword = await this.passwordHasher.hashPassword(storedPassword);
      
      // Store the hashed password
      await this.storageManager.storePassword(user.id, hashedPassword);
      
      this.log(`Successfully migrated password for user ${user.username}`, 'info');
      return { migrated: true, reason: 'SUCCESS' };
      
    } catch (error) {
      this.log(`Error migrating password for user ${user.username}: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Get all stored users from the system
   * @returns {Array} Array of user objects
   */
  getAllStoredUsers() {
    try {
      const users = localStorage.getItem('memex_racing_users');
      return users ? JSON.parse(users) : [];
    } catch (error) {
      this.log(`Error retrieving stored users: ${error.message}`, 'error');
      return [];
    }
  }

  /**
   * Create backup of current password data
   * @returns {Promise<void>}
   */
  async createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupKey = `memex_racing_password_backup_${timestamp}`;
      
      // Get all password data
      const users = this.getAllStoredUsers();
      const passwordData = {};
      
      for (const user of users) {
        try {
          const password = await this.storageManager.getStoredPassword(user.id);
          if (password) {
            passwordData[user.id] = {
              username: user.username,
              password: password,
              isHashed: this.passwordHasher.isValidBcryptHash(password)
            };
          }
        } catch (error) {
          this.log(`Error backing up password for user ${user.username}: ${error.message}`, 'warn');
        }
      }
      
      // Store backup
      localStorage.setItem(backupKey, JSON.stringify({
        timestamp: new Date().toISOString(),
        totalUsers: users.length,
        passwordCount: Object.keys(passwordData).length,
        data: passwordData
      }));
      
      this.log(`Backup created: ${backupKey} (${Object.keys(passwordData).length} passwords)`, 'info');
    } catch (error) {
      this.log(`Failed to create backup: ${error.message}`, 'error');
      throw new Error(`Backup creation failed: ${error.message}`);
    }
  }

  /**
   * Check if a string looks like a valid plaintext password
   * @param {string} password - Password to validate
   * @returns {boolean} - True if looks like valid plaintext
   */
  isValidPlaintextPassword(password) {
    if (!password || typeof password !== 'string') {
      return false;
    }
    
    // Basic checks - not empty, reasonable length, not obviously corrupted
    return password.length > 0 && 
           password.length <= 128 && 
           !password.includes('\x00') && // No null bytes
           !password.startsWith('$2'); // Not a bcrypt hash
  }

  /**
   * Create batches from array
   * @param {Array} items - Items to batch
   * @param {number} batchSize - Size of each batch
   * @returns {Array} Array of batches
   */
  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Log migration progress and events
   * @param {string} message - Log message
   * @param {string} level - Log level (info, warn, error)
   */
  log(message, level = 'info') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level,
      message: message
    };
    
    this.migrationLog.push(logEntry);
    
    if (this.config.logProgress) {
      const prefix = level.toUpperCase().padEnd(5);
      console.log(`[MIGRATION ${prefix}] ${message}`);
    }
  }

  /**
   * Utility method to add delay
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get migration statistics
   * @returns {Object} Migration statistics
   */
  getStatistics() {
    const users = this.getAllStoredUsers();
    let hashedCount = 0;
    let plaintextCount = 0;
    let errorCount = 0;
    
    users.forEach(user => {
      try {
        const password = localStorage.getItem(`memex_racing_password_${user.id}`);
        if (password) {
          const decrypted = this.storageManager.decrypt(password, this.storageManager.getSessionKey());
          if (this.passwordHasher.isValidBcryptHash(decrypted.password)) {
            hashedCount++;
          } else {
            plaintextCount++;
          }
        }
      } catch (error) {
        errorCount++;
      }
    });
    
    return {
      totalUsers: users.length,
      hashedPasswords: hashedCount,
      plaintextPasswords: plaintextCount,
      errors: errorCount,
      migrationNeeded: plaintextCount > 0
    };
  }

  /**
   * Static method to create migration instance with default config
   * @param {Object} config - Configuration options
   * @returns {PasswordMigration} Migration instance
   */
  static create(config = {}) {
    return new PasswordMigration(config);
  }

  /**
   * Static method to run a quick dry-run migration check
   * @param {Object} config - Configuration options
   * @returns {Promise<Object>} Migration preview results
   */
  static async dryRun(config = {}) {
    const migration = new PasswordMigration({ ...config, dryRun: true, logProgress: false });
    return await migration.migrateAllPasswords();
  }
}

module.exports = PasswordMigration;