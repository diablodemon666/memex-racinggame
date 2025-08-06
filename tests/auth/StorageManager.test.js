// TDD RED Phase - Write failing test for Secure Storage Management
const StorageManager = require('../../src/auth/StorageManager.js');

// Mock IndexedDB for testing
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
const FDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');

global.indexedDB = new FDBFactory();
global.IDBKeyRange = FDBKeyRange;

describe('StorageManager', () => {
  let storageManager;
  const mockConfig = {
    encryption: true,
    keyPrefix: 'memex_racing_',
    algorithm: 'AES',
    keyDerivation: 'PBKDF2'
  };

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    storageManager = new StorageManager(mockConfig);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('instantiation', () => {
    it('should instantiate with valid config', () => {
      // Act & Assert
      expect(() => {
        const manager = new StorageManager(mockConfig);
        expect(manager).toBeDefined();
      }).not.toThrow();
    });

    it('should throw error with invalid config', () => {
      // Arrange
      const invalidConfig = null;

      // Act & Assert
      expect(() => {
        new StorageManager(invalidConfig);
      }).toThrow('Storage configuration is required');
    });
  });

  describe('encrypted credential storage', () => {
    it('should store and retrieve encrypted credentials', async () => {
      // Arrange
      const credentials = {
        username: 'testuser',
        password: 'securepassword123',
        token: 'jwt-token-here',
        refreshToken: 'refresh-token-here'
      };

      // Act
      await storageManager.storeCredentials(credentials);
      const retrieved = await storageManager.getCredentials();

      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved.username).toBe(credentials.username);
      expect(retrieved.password).toBe(credentials.password);
      expect(retrieved.token).toBe(credentials.token);
      expect(retrieved.refreshToken).toBe(credentials.refreshToken);
    });

    it('should encrypt data in localStorage', async () => {
      // Arrange
      const credentials = {
        username: 'testuser',
        password: 'securepassword123'
      };

      // Act
      await storageManager.storeCredentials(credentials);

      // Assert - verify data is encrypted in localStorage
      const rawStoredData = localStorage.getItem('memex_racing_credentials');
      expect(rawStoredData).toBeDefined();
      expect(rawStoredData).not.toContain('testuser');
      expect(rawStoredData).not.toContain('securepassword123');
    });

    it('should handle decryption of corrupted data gracefully', async () => {
      // Arrange
      const corruptedData = 'corrupted-encrypted-data';
      localStorage.setItem('memex_racing_credentials', corruptedData);

      // Act & Assert
      await expect(storageManager.getCredentials()).rejects.toThrow();
    });
  });

  describe('user data storage', () => {
    it('should store and retrieve user profile data', async () => {
      // Arrange
      const userData = {
        id: '12345',
        username: 'testuser',
        email: 'test@example.com',
        profile: {
          displayName: 'Test User',
          avatar: 'avatar.png'
        },
        statistics: {
          gamesPlayed: 10,
          wins: 5,
          winRate: 0.5
        }
      };

      // Act
      await storageManager.storeUserData(userData);
      const retrieved = await storageManager.getUserData();

      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(userData.id);
      expect(retrieved.username).toBe(userData.username);
      expect(retrieved.email).toBe(userData.email);
      expect(retrieved.profile).toEqual(userData.profile);
      expect(retrieved.statistics).toEqual(userData.statistics);
    });

    it('should return null when no user data exists', async () => {
      // Act
      const result = await storageManager.getUserData();

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('storage availability detection', () => {
    it('should detect localStorage availability', () => {
      // Act
      const available = storageManager.isLocalStorageAvailable();

      // Assert
      expect(available).toBe(true);
    });

    it('should detect IndexedDB availability', async () => {
      // Act
      const available = await storageManager.isIndexedDBAvailable();

      // Assert
      expect(available).toBe(true);
    });

    it('should handle storage unavailability gracefully', async () => {
      // Arrange - mock localStorage as unavailable
      const originalLocalStorage = global.localStorage;
      delete global.localStorage;

      // Act
      const available = storageManager.isLocalStorageAvailable();

      // Assert
      expect(available).toBe(false);

      // Cleanup
      global.localStorage = originalLocalStorage;
    });
  });

  describe('fallback mechanisms', () => {
    it('should fall back to memory storage when localStorage is unavailable', async () => {
      // Arrange
      const credentials = { username: 'testuser', password: 'password123' };
      
      // Mock localStorage as unavailable
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = jest.fn(() => {
        throw new Error('localStorage unavailable');
      });

      // Act
      await storageManager.storeCredentials(credentials);
      const retrieved = await storageManager.getCredentials();

      // Assert
      expect(retrieved).toEqual(credentials);

      // Cleanup
      localStorage.setItem = originalSetItem;
    });
  });

  describe('data cleanup', () => {
    it('should clear all stored authentication data', async () => {
      // Arrange
      const credentials = { username: 'testuser', password: 'password123' };
      const userData = { id: '123', username: 'testuser' };
      
      await storageManager.storeCredentials(credentials);
      await storageManager.storeUserData(userData);

      // Act
      await storageManager.clearAll();

      // Assert
      const retrievedCredentials = await storageManager.getCredentials();
      const retrievedUserData = await storageManager.getUserData();
      
      expect(retrievedCredentials).toBeNull();
      expect(retrievedUserData).toBeNull();
    });

    it('should clear only credentials', async () => {
      // Arrange
      const credentials = { username: 'testuser', password: 'password123' };
      const userData = { id: '123', username: 'testuser' };
      
      await storageManager.storeCredentials(credentials);
      await storageManager.storeUserData(userData);

      // Act
      await storageManager.clearCredentials();

      // Assert
      const retrievedCredentials = await storageManager.getCredentials();
      const retrievedUserData = await storageManager.getUserData();
      
      expect(retrievedCredentials).toBeNull();
      expect(retrievedUserData).toBeDefined();
    });
  });

  describe('encryption key management', () => {
    it('should generate consistent encryption keys', () => {
      // Arrange
      const password = 'master-password';
      const salt = 'consistent-salt';

      // Act
      const key1 = storageManager.deriveEncryptionKey(password, salt);
      const key2 = storageManager.deriveEncryptionKey(password, salt);

      // Assert
      expect(key1).toBe(key2);
      expect(key1).toBeDefined();
      expect(typeof key1).toBe('string');
    });

    it('should generate different keys with different passwords', () => {
      // Arrange
      const salt = 'consistent-salt';

      // Act
      const key1 = storageManager.deriveEncryptionKey('password1', salt);
      const key2 = storageManager.deriveEncryptionKey('password2', salt);

      // Assert
      expect(key1).not.toBe(key2);
    });

    it('should use strong PBKDF2 iterations (minimum 100,000)', () => {
      // Arrange
      const password = 'test-password';
      const salt = 'test-salt';
      const spyOnPBKDF2 = jest.spyOn(require('crypto-js'), 'PBKDF2');

      // Act
      storageManager.deriveEncryptionKey(password, salt);

      // Assert
      expect(spyOnPBKDF2).toHaveBeenCalledWith(password, salt, {
        keySize: 256/32,
        iterations: 100000
      });

      spyOnPBKDF2.mockRestore();
    });

    it('should use crypto.getRandomValues() for session key generation', () => {
      // Arrange
      const originalCrypto = global.crypto;
      const mockGetRandomValues = jest.fn((array) => {
        // Fill the array with test data
        for (let i = 0; i < array.length; i++) {
          array[i] = i % 256;
        }
        return array;
      });
      
      // Set up the mock before creating the StorageManager
      global.crypto = {
        getRandomValues: mockGetRandomValues
      };

      // Act - create a new storage manager and call the methods that should use crypto
      const testStorageManager = new StorageManager(mockConfig);
      const sessionKey = testStorageManager.getSessionKey(); // This should trigger crypto.getRandomValues

      // Assert
      expect(mockGetRandomValues).toHaveBeenCalled();
      expect(sessionKey).toBeDefined();
      expect(typeof sessionKey).toBe('string');

      // Cleanup
      global.crypto = originalCrypto;
    });

    it('should generate proper cryptographic salt', () => {
      // Arrange
      const originalCrypto = global.crypto;
      const mockGetRandomValues = jest.fn((array) => {
        // Fill the array with test data
        for (let i = 0; i < array.length; i++) {
          array[i] = i % 256;
        }
        return array;
      });
      
      // Set up the mock before creating the StorageManager
      global.crypto = {
        getRandomValues: mockGetRandomValues
      };

      // Act - create a new storage manager and directly call generateSalt
      const testStorageManager = new StorageManager(mockConfig);
      const salt = testStorageManager.generateSalt(); // This should trigger crypto.getRandomValues

      // Assert
      expect(mockGetRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
      expect(salt).toBeDefined();
      expect(typeof salt).toBe('string');
      expect(salt.length).toBeGreaterThan(0);

      // Cleanup
      global.crypto = originalCrypto;
    });

    it('should reject weak browser fingerprinting for session keys', () => {
      // This test ensures we don't use weak browser fingerprinting
      // Create different storage managers to get different session keys
      const storageManager1 = new StorageManager(mockConfig);
      const storageManager2 = new StorageManager(mockConfig);
      
      const sessionKey1 = storageManager1.getSessionKey();
      const sessionKey2 = storageManager2.getSessionKey();

      // Session keys should be different each time (using crypto random)
      expect(sessionKey1).not.toBe(sessionKey2);
    });
  });
});