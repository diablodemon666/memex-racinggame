// PasswordHasher Test Suite
// Comprehensive tests for password hashing security implementation

const PasswordHasher = require('../../src/auth/PasswordHasher.js');

describe('PasswordHasher', () => {
  let passwordHasher;

  beforeEach(() => {
    passwordHasher = new PasswordHasher();
  });

  describe('Constructor and Configuration', () => {
    it('should create instance with default configuration', () => {
      expect(passwordHasher).toBeDefined();
      expect(passwordHasher.config.saltRounds).toBe(12);
      expect(passwordHasher.config.maxPasswordLength).toBe(128);
      expect(passwordHasher.config.timingAttackPreventionDelay).toBe(100);
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        saltRounds: 14,
        maxPasswordLength: 256,
        timingAttackPreventionDelay: 200
      };
      const customHasher = new PasswordHasher(customConfig);
      
      expect(customHasher.config.saltRounds).toBe(14);
      expect(customHasher.config.maxPasswordLength).toBe(256);
      expect(customHasher.config.timingAttackPreventionDelay).toBe(200);
    });

    it('should enforce minimum salt rounds security requirement', () => {
      expect(() => {
        new PasswordHasher({ saltRounds: 10 });
      }).toThrow('Salt rounds must be at least 12 for security compliance');
    });

    it('should warn about excessive salt rounds', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      new PasswordHasher({ saltRounds: 25 });
      expect(consoleSpy).toHaveBeenCalledWith(
        'Salt rounds > 20 may cause performance issues. Consider reducing to 12-15.'
      );
      consoleSpy.mockRestore();
    });
  });

  describe('Password Hashing', () => {
    it('should hash a valid password', async () => {
      const password = 'TestPassword123!';
      const hash = await passwordHasher.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(50);
      expect(hash.startsWith('$2')).toBe(true); // bcrypt hash format
    });

    it('should create different hashes for same password (salt uniqueness)', async () => {
      const password = 'TestPassword123!';
      const hash1 = await passwordHasher.hashPassword(password);
      const hash2 = await passwordHasher.hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
      expect(hash1.length).toBe(hash2.length);
    });

    it('should reject null or undefined password', async () => {
      await expect(passwordHasher.hashPassword(null))
        .rejects.toThrow('Password must be a non-empty string');
      
      await expect(passwordHasher.hashPassword(undefined))
        .rejects.toThrow('Password must be a non-empty string');
    });

    it('should reject non-string password', async () => {
      await expect(passwordHasher.hashPassword(123))
        .rejects.toThrow('Password must be a non-empty string');
      
      await expect(passwordHasher.hashPassword({}))
        .rejects.toThrow('Password must be a non-empty string');
    });

    it('should reject password exceeding maximum length', async () => {
      const longPassword = 'a'.repeat(200);
      await expect(passwordHasher.hashPassword(longPassword))
        .rejects.toThrow('Password exceeds maximum length of 128 characters');
    });

    it('should hash passwords with special characters', async () => {
      const passwords = [
        'Test@123!',
        'Пароль123',
        '测试密码123',
        'emoji🔒pass123',
        'spaces in password 123!'
      ];

      for (const password of passwords) {
        const hash = await passwordHasher.hashPassword(password);
        expect(hash).toBeDefined();
        expect(passwordHasher.isValidBcryptHash(hash)).toBe(true);
      }
    });
  });

  describe('Password Verification', () => {
    it('should verify correct password', async () => {
      const password = 'TestPassword123!';
      const hash = await passwordHasher.hashPassword(password);
      const isValid = await passwordHasher.verifyPassword(password, hash);
      
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await passwordHasher.hashPassword(password);
      const isValid = await passwordHasher.verifyPassword(wrongPassword, hash);
      
      expect(isValid).toBe(false);
    });

    it('should reject null or undefined inputs', async () => {
      const hash = await passwordHasher.hashPassword('TestPassword123!');
      
      await expect(passwordHasher.verifyPassword(null, hash))
        .rejects.toThrow('Password must be a non-empty string');
      
      await expect(passwordHasher.verifyPassword('password', null))
        .rejects.toThrow('Hash must be a non-empty string');
    });

    it('should reject invalid hash format', async () => {
      const password = 'TestPassword123!';
      const invalidHash = 'not-a-valid-hash';
      
      await expect(passwordHasher.verifyPassword(password, invalidHash))
        .rejects.toThrow('Invalid bcrypt hash format');
    });

    it('should handle timing attack prevention', async () => {
      const password = 'TestPassword123!';
      const hash = await passwordHasher.hashPassword(password);
      
      const startTime = Date.now();
      await passwordHasher.verifyPassword(password, hash);
      const duration = Date.now() - startTime;
      
      // Should take at least the minimum delay time
      expect(duration).toBeGreaterThanOrEqual(95); // Allow some margin
    });

    it('should return false for corrupted hash without throwing', async () => {
      const password = 'TestPassword123!';
      const corruptedHash = '$2a$12$corrupted.hash.that.is.invalid';
      
      const isValid = await passwordHasher.verifyPassword(password, corruptedHash);
      expect(isValid).toBe(false);
    });
  });

  describe('Hash Validation and Parsing', () => {
    it('should correctly identify valid bcrypt hashes', () => {
      const validHashes = [
        '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW',
        '$2b$10$N9qo8uLOickgx2ZMRZoMye1234567890123456789012345678',
        '$2y$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
      ];

      validHashes.forEach(hash => {
        expect(passwordHasher.isValidBcryptHash(hash)).toBe(true);
      });
    });

    it('should reject invalid bcrypt hashes', () => {
      const invalidHashes = [
        'plaintext-password',
        '$1$invalid$format',
        '$2a$invalid',
        '',
        null,
        undefined,
        123,
        '$2a$12$tooshort'
      ];

      invalidHashes.forEach(hash => {
        expect(passwordHasher.isValidBcryptHash(hash)).toBe(false);
      });
    });

    it('should parse bcrypt hash information', () => {
      const hash = '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
      const parsed = passwordHasher.parseBcryptHash(hash);
      
      expect(parsed.version).toBe('2a');
      expect(parsed.saltRounds).toBe(12);
      expect(parsed.saltAndHash).toBe('R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW');
    });

    it('should throw on invalid hash parsing', () => {
      expect(() => {
        passwordHasher.parseBcryptHash('invalid-hash');
      }).toThrow('Invalid bcrypt hash format');
    });
  });

  describe('Rehashing Requirements', () => {
    it('should detect when rehashing is needed for lower salt rounds', () => {
      // Simulate hash with lower salt rounds
      const oldHash = '$2a$10$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
      expect(passwordHasher.needsRehash(oldHash)).toBe(true);
    });

    it('should not require rehashing for current salt rounds', () => {
      const currentHash = '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
      expect(passwordHasher.needsRehash(currentHash)).toBe(false);
    });

    it('should require rehashing for invalid hashes', () => {
      expect(passwordHasher.needsRehash('plaintext')).toBe(true);
      expect(passwordHasher.needsRehash('')).toBe(true);
      expect(passwordHasher.needsRehash(null)).toBe(true);
    });
  });

  describe('Password Migration', () => {
    it('should migrate plaintext password to hash', async () => {
      const plaintextPassword = 'PlaintextPassword123!';
      const result = await passwordHasher.migratePassword(plaintextPassword);
      
      expect(result.hash).toBeDefined();
      expect(result.needsMigration).toBe(true);
      expect(result.migrationTimestamp).toBeDefined();
      expect(passwordHasher.isValidBcryptHash(result.hash)).toBe(true);
      
      // Verify the migrated hash works
      const isValid = await passwordHasher.verifyPassword(plaintextPassword, result.hash);
      expect(isValid).toBe(true);
    });
  });

  describe('Utility Methods', () => {
    it('should generate valid salt', async () => {
      const salt = await passwordHasher.generateSalt();
      expect(salt).toBeDefined();
      expect(typeof salt).toBe('string');
      expect(salt.length).toBeGreaterThan(20);
    });

    it('should return configuration information', () => {
      const config = passwordHasher.getConfig();
      expect(config.saltRounds).toBe(12);
      expect(config.maxPasswordLength).toBe(128);
      expect(config.version).toBeDefined();
    });

    it('should handle delay utility', async () => {
      const startTime = Date.now();
      await passwordHasher.delay(50);
      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(45); // Allow some margin
    });
  });

  describe('Batch Operations', () => {
    it('should hash multiple passwords in batch', async () => {
      const passwords = ['Pass1!', 'Pass2!', 'Pass3!'];
      const results = await passwordHasher.batchHashPasswords(passwords);
      
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.originalIndex).toBe(index);
        expect(result.hash).toBeDefined();
        expect(passwordHasher.isValidBcryptHash(result.hash)).toBe(true);
      });
    });

    it('should handle batch errors gracefully', async () => {
      const passwords = ['ValidPass1!', null, 'ValidPass2!'];
      const results = await passwordHasher.batchHashPasswords(passwords);
      
      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toContain('Password must be a non-empty string');
      expect(results[2].success).toBe(true);
    });

    it('should reject non-array input for batch operations', async () => {
      await expect(passwordHasher.batchHashPasswords('not-an-array'))
        .rejects.toThrow('Passwords must be an array');
    });
  });

  describe('Factory Methods', () => {
    it('should create secure instance with static method', () => {
      const secureHasher = PasswordHasher.createSecure();
      expect(secureHasher).toBeInstanceOf(PasswordHasher);
      expect(secureHasher.config.saltRounds).toBe(12);
      expect(secureHasher.config.maxPasswordLength).toBe(128);
    });

    it('should create development instance with warning', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const devHasher = PasswordHasher.createDevelopment();
      
      expect(devHasher).toBeInstanceOf(PasswordHasher);
      expect(devHasher.config.saltRounds).toBe(4);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Using development password hasher - NOT FOR PRODUCTION'
      );
      consoleSpy.mockRestore();
    });
  });

  describe('Security Compliance', () => {
    it('should use salt rounds >= 12 as per requirements', () => {
      expect(passwordHasher.config.saltRounds).toBeGreaterThanOrEqual(12);
    });

    it('should implement timing attack prevention', async () => {
      const password = 'TestPassword123!';
      const hash = await passwordHasher.hashPassword(password);
      
      // Test multiple verification attempts to ensure consistent timing
      const times = [];
      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();
        await passwordHasher.verifyPassword(password, hash);
        times.push(Date.now() - startTime);
      }
      
      // All attempts should take at least the minimum delay
      times.forEach(time => {
        expect(time).toBeGreaterThanOrEqual(95);
      });
    });

    it('should handle password length limits to prevent DoS', async () => {
      const maxLength = passwordHasher.config.maxPasswordLength;
      const borderlinePassword = 'a'.repeat(maxLength);
      const tooLongPassword = 'a'.repeat(maxLength + 1);
      
      // Should accept password at max length
      const hash = await passwordHasher.hashPassword(borderlinePassword);
      expect(hash).toBeDefined();
      
      // Should reject password over max length
      await expect(passwordHasher.hashPassword(tooLongPassword))
        .rejects.toThrow('Password exceeds maximum length');
    });
  });
});