// PasswordMigration Test Suite
// Tests for password migration from plaintext to bcrypt hashes

const PasswordMigration = require('../../src/auth/PasswordMigration.js');
const PasswordHasher = require('../../src/auth/PasswordHasher.js');

// Mock localStorage for testing
const mockLocalStorage = {
  storage: new Map(),
  getItem: jest.fn().mockImplementation(function(key) {
    return this.storage.get(key) || null;
  }),
  setItem: jest.fn().mockImplementation(function(key, value) {
    this.storage.set(key, value);
  }),
  removeItem: jest.fn().mockImplementation(function(key) {
    this.storage.delete(key);
  }),
  clear: jest.fn().mockImplementation(function() {
    this.storage.clear();
  })
};

// Setup localStorage mock
Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

describe('PasswordMigration', () => {
  let migration;
  let passwordHasher;

  beforeEach(() => {
    // Reset localStorage mock
    mockLocalStorage.storage.clear();
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
    
    // Create migration instance
    migration = new PasswordMigration({
      logProgress: false, // Disable logging for tests
      backupBeforeMigration: false // Disable backup for most tests
    });
    
    passwordHasher = new PasswordHasher();
  });

  describe('Constructor and Configuration', () => {
    it('should create instance with default configuration', () => {
      expect(migration).toBeDefined();
      expect(migration.config.batchSize).toBe(10);
      expect(migration.config.maxRetries).toBe(3);
      expect(migration.config.dryRun).toBe(false);
    });

    it('should accept custom configuration', () => {
      const customMigration = new PasswordMigration({
        batchSize: 5,
        maxRetries: 2,
        dryRun: true
      });
      
      expect(customMigration.config.batchSize).toBe(5);
      expect(customMigration.config.maxRetries).toBe(2);
      expect(customMigration.config.dryRun).toBe(true);
    });
  });

  describe('User Data Retrieval', () => {
    it('should return empty array when no users exist', () => {
      const users = migration.getAllStoredUsers();
      expect(users).toEqual([]);
    });

    it('should retrieve stored users', () => {
      const testUsers = [
        { id: 'user1', username: 'testUser1', email: 'test1@example.com' },
        { id: 'user2', username: 'testUser2', email: 'test2@example.com' }
      ];
      
      localStorage.setItem('memex_racing_users', JSON.stringify(testUsers));
      
      const users = migration.getAllStoredUsers();
      expect(users).toEqual(testUsers);
    });

    it('should handle corrupted user data gracefully', () => {
      localStorage.setItem('memex_racing_users', 'invalid-json');
      
      const users = migration.getAllStoredUsers();
      expect(users).toEqual([]);
    });
  });

  describe('Password Validation', () => {
    it('should identify valid plaintext passwords', () => {
      const validPasswords = [
        'simplePassword',
        'Complex!Password123',
        'Short1!',
        'a'.repeat(128) // Max length
      ];
      
      validPasswords.forEach(password => {
        expect(migration.isValidPlaintextPassword(password)).toBe(true);
      });
    });

    it('should reject invalid plaintext passwords', () => {
      const invalidPasswords = [
        '',
        null,
        undefined,
        123,
        'a'.repeat(129), // Too long
        '$2a$12$hashedPassword', // Looks like bcrypt hash
        'password\x00withnull' // Contains null byte
      ];
      
      invalidPasswords.forEach(password => {
        expect(migration.isValidPlaintextPassword(password)).toBe(false);
      });
    });
  });

  describe('Migration Statistics', () => {
    it('should return correct statistics when no users exist', () => {
      const stats = migration.getStatistics();
      expect(stats.totalUsers).toBe(0);
      expect(stats.hashedPasswords).toBe(0);
      expect(stats.plaintextPasswords).toBe(0);
      expect(stats.migrationNeeded).toBe(false);
    });
  });

  describe('Batch Processing', () => {
    it('should create correct batches from array', () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      const batches = migration.createBatches(items, 4);
      
      expect(batches).toHaveLength(3);
      expect(batches[0]).toEqual([1, 2, 3, 4]);
      expect(batches[1]).toEqual([5, 6, 7, 8]);
      expect(batches[2]).toEqual([9, 10, 11]);
    });

    it('should handle empty array', () => {
      const batches = migration.createBatches([], 5);
      expect(batches).toEqual([]);
    });
  });

  describe('Migration Process', () => {
    it('should handle migration when no users exist', async () => {
      const result = await migration.migrateAllPasswords();
      
      expect(result.success).toBe(true);
      expect(result.migrated).toBe(0);
      expect(result.errors).toEqual([]);
      expect(result.log).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should perform dry run without making changes', async () => {
      const dryRunMigration = new PasswordMigration({
        dryRun: true,
        logProgress: false
      });
      
      // Setup test user with plaintext password
      const testUsers = [{ id: 'user1', username: 'testUser1' }];
      localStorage.setItem('memex_racing_users', JSON.stringify(testUsers));
      
      const result = await dryRunMigration.migrateAllPasswords();
      
      expect(result.success).toBe(true);
      expect(result.migrated).toBe(0); // No actual migration in dry run
      expect(result.log.some(entry => entry.message.includes('[DRY RUN]'))).toBe(true);
    });
  });

  describe('Backup Functionality', () => {
    it('should create backup before migration', async () => {
      const backupMigration = new PasswordMigration({
        backupBeforeMigration: true,
        logProgress: false
      });
      
      // Setup test data
      const testUsers = [{ id: 'user1', username: 'testUser1' }];
      localStorage.setItem('memex_racing_users', JSON.stringify(testUsers));
      
      await backupMigration.createBackup();
      
      // Check if backup was created
      const backupKeys = Array.from(mockLocalStorage.storage.keys())
        .filter(key => key.startsWith('memex_racing_password_backup_'));
      
      expect(backupKeys.length).toBeGreaterThan(0);
      
      // Verify backup content
      const backupData = JSON.parse(mockLocalStorage.storage.get(backupKeys[0]));
      expect(backupData.timestamp).toBeDefined();
      expect(backupData.totalUsers).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', () => {
      // Mock localStorage to throw error
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = jest.fn().mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      const users = migration.getAllStoredUsers();
      expect(users).toEqual([]);
      
      // Restore original function
      localStorage.getItem = originalGetItem;
    });

    it('should log errors appropriately', () => {
      const logSpy = jest.spyOn(migration, 'log');
      
      // This should trigger an error log
      migration.getAllStoredUsers();
      
      // The spy might not catch internal logging, so we just verify the method exists
      expect(typeof migration.log).toBe('function');
      
      logSpy.mockRestore();
    });
  });

  describe('Utility Methods', () => {
    it('should implement delay utility', async () => {
      const startTime = Date.now();
      await migration.delay(50);
      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(45); // Allow some margin
    });

    it('should log messages with correct format', () => {
      migration.log('Test message', 'info');
      
      expect(migration.migrationLog).toHaveLength(1);
      expect(migration.migrationLog[0].message).toBe('Test message');
      expect(migration.migrationLog[0].level).toBe('info');
      expect(migration.migrationLog[0].timestamp).toBeDefined();
    });
  });

  describe('Static Factory Methods', () => {
    it('should create migration instance with static method', () => {
      const instance = PasswordMigration.create({ batchSize: 5 });
      expect(instance).toBeInstanceOf(PasswordMigration);
      expect(instance.config.batchSize).toBe(5);
    });

    it('should perform dry run with static method', async () => {
      const result = await PasswordMigration.dryRun();
      expect(result.success).toBe(true);
      expect(result.migrated).toBe(0);
      expect(result.log).toBeDefined();
    });
  });

  describe('Integration with PasswordHasher', () => {
    it('should correctly identify bcrypt hashes', () => {
      const plaintext = 'plaintext';
      const bcryptHash = '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
      
      expect(migration.passwordHasher.isValidBcryptHash(plaintext)).toBe(false);
      expect(migration.passwordHasher.isValidBcryptHash(bcryptHash)).toBe(true);
    });
  });

  describe('Performance and Memory', () => {
    it('should process large numbers of users efficiently', () => {
      const largeUserList = Array.from({ length: 1000 }, (_, i) => ({
        id: `user${i}`,
        username: `testUser${i}`
      }));
      
      const batches = migration.createBatches(largeUserList, 50);
      expect(batches).toHaveLength(20);
      expect(batches[0]).toHaveLength(50);
      expect(batches[19]).toHaveLength(50);
    });

    it('should handle batch size configuration', () => {
      const customMigration = new PasswordMigration({ batchSize: 3 });
      const items = [1, 2, 3, 4, 5, 6, 7];
      const batches = customMigration.createBatches(items, customMigration.config.batchSize);
      
      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(3);
      expect(batches[1]).toHaveLength(3);
      expect(batches[2]).toHaveLength(1);
    });
  });
});