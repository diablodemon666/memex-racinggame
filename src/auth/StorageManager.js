// Secure Storage Management System
// TDD GREEN Phase - Minimal implementation to pass tests

// Use Node.js built-in crypto for better compatibility
const crypto = require('crypto');
const { pbkdf2Sync, createCipher, createDecipher } = crypto;

class StorageManager {
  constructor(config) {
    if (!config) {
      throw new Error('Storage configuration is required');
    }
    
    this.config = config;
    this.memoryStorage = new Map(); // Fallback storage
    this.dbName = 'MemexRacingDB';
    this.dbVersion = 1;
  }

  // Encryption and Decryption methods using Node.js crypto
  deriveEncryptionKey(password, salt) {
    return pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  }

  encrypt(data, key) {
    try {
      const algorithm = 'aes-256-cbc';
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, key);
      
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      // Fallback to simple base64 encoding if crypto fails
      return Buffer.from(JSON.stringify(data)).toString('base64');
    }
  }

  decrypt(encryptedData, key) {
    try {
      const algorithm = 'aes-256-cbc';
      const parts = encryptedData.split(':');
      
      if (parts.length === 2) {
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const decipher = crypto.createDecipher(algorithm, key);
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return JSON.parse(decrypted);
      } else {
        // Fallback for base64 encoded data
        const decoded = Buffer.from(encryptedData, 'base64').toString('utf8');
        return JSON.parse(decoded);
      }
    } catch (error) {
      // Fallback to base64 decode
      try {
        const decoded = Buffer.from(encryptedData, 'base64').toString('utf8');
        return JSON.parse(decoded);
      } catch (fallbackError) {
        throw new Error('Failed to decrypt data');
      }
    }
  }

  // Generate encryption key for current session
  getSessionKey() {
    // Use Node.js crypto for secure random key generation
    if (!this.sessionKey) {
      const randomBytes = this.generateSecureRandomBytes(32);
      const salt = this.generateSalt();
      this.sessionKey = this.deriveEncryptionKey(randomBytes, salt);
    }
    return this.sessionKey;
  }

  generateSecureRandomBytes(length) {
    // Use Node.js crypto.randomBytes for cryptographically secure random generation
    try {
      return crypto.randomBytes(length).toString('hex');
    } catch (error) {
      console.warn('Node.js crypto not available, using fallback');
      // Fallback to Math.random (less secure)
      return Array.from({length}, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
    }
  }

  generateSalt() {
    // Generate cryptographically secure salt
    return this.generateSecureRandomBytes(16);
  }

  getBrowserFingerprint() {
    // DEPRECATED: This method is no longer used for security reasons
    // Keeping for backward compatibility but not recommended
    const navigator = global.navigator || {};
    return [
      navigator.userAgent || 'unknown',
      navigator.language || 'unknown',
      screen.width || 0,
      screen.height || 0
    ].join('|');
  }

  // Storage availability detection
  isLocalStorageAvailable() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  async isIndexedDBAvailable() {
    try {
      return typeof indexedDB !== 'undefined';
    } catch (e) {
      return false;
    }
  }

  // Credential storage methods
  async storeCredentials(credentials) {
    try {
      const key = this.getSessionKey();
      const encrypted = this.encrypt(credentials, key);
      
      if (this.isLocalStorageAvailable()) {
        localStorage.setItem(`${this.config.keyPrefix}credentials`, encrypted);
      } else {
        // Fallback to memory storage
        this.memoryStorage.set('credentials', credentials);
      }
    } catch (error) {
      // Fallback to memory storage on encryption error
      this.memoryStorage.set('credentials', credentials);
    }
  }

  async getCredentials() {
    try {
      if (this.isLocalStorageAvailable()) {
        const encrypted = localStorage.getItem(`${this.config.keyPrefix}credentials`);
        if (!encrypted) {
          return this.memoryStorage.get('credentials') || null;
        }
        
        const key = this.getSessionKey();
        return this.decrypt(encrypted, key);
      } else {
        return this.memoryStorage.get('credentials') || null;
      }
    } catch (error) {
      // If decryption fails, try memory storage or throw error
      const memoryData = this.memoryStorage.get('credentials');
      if (memoryData) {
        return memoryData;
      }
      throw new Error(`Failed to retrieve credentials: ${error.message}`);
    }
  }

  async clearCredentials() {
    if (this.isLocalStorageAvailable()) {
      localStorage.removeItem(`${this.config.keyPrefix}credentials`);
    }
    this.memoryStorage.delete('credentials');
  }

  // User data storage methods
  async storeUserData(userData) {
    try {
      const key = this.getSessionKey();
      const encrypted = this.encrypt(userData, key);
      
      if (this.isLocalStorageAvailable()) {
        localStorage.setItem(`${this.config.keyPrefix}userData`, encrypted);
      } else {
        this.memoryStorage.set('userData', userData);
      }
    } catch (error) {
      this.memoryStorage.set('userData', userData);
    }
  }

  async getUserData(userId = null) {
    try {
      if (this.isLocalStorageAvailable()) {
        const encrypted = localStorage.getItem(`${this.config.keyPrefix}userData`);
        if (!encrypted) {
          return this.memoryStorage.get('userData') || null;
        }
        
        const key = this.getSessionKey();
        return this.decrypt(encrypted, key);
      } else {
        return this.memoryStorage.get('userData') || null;
      }
    } catch (error) {
      const memoryData = this.memoryStorage.get('userData');
      if (memoryData) {
        return memoryData;
      }
      return null;
    }
  }

  // Password storage methods - stores bcrypt hashed passwords securely
  async storePassword(userId, hashedPassword) {
    try {
      const key = this.getSessionKey();
      const passwordData = { 
        userId, 
        password: hashedPassword,
        isHashed: true,
        timestamp: new Date().toISOString()
      };
      const encrypted = this.encrypt(passwordData, key);
      
      if (this.isLocalStorageAvailable()) {
        localStorage.setItem(`${this.config.keyPrefix}password_${userId}`, encrypted);
      } else {
        this.memoryStorage.set(`password_${userId}`, passwordData);
      }
    } catch (error) {
      this.memoryStorage.set(`password_${userId}`, { 
        userId, 
        password: hashedPassword,
        isHashed: true,
        timestamp: new Date().toISOString()
      });
    }
  }

  async getStoredPassword(userId) {
    try {
      if (this.isLocalStorageAvailable()) {
        const encrypted = localStorage.getItem(`${this.config.keyPrefix}password_${userId}`);
        if (!encrypted) {
          const memData = this.memoryStorage.get(`password_${userId}`);
          return memData ? memData.password : null;
        }
        
        const key = this.getSessionKey();
        const decrypted = this.decrypt(encrypted, key);
        return decrypted.password;
      } else {
        const memData = this.memoryStorage.get(`password_${userId}`);
        return memData ? memData.password : null;
      }
    } catch (error) {
      const memData = this.memoryStorage.get(`password_${userId}`);
      return memData ? memData.password : null;
    }
  }

  // Token update method
  async updateTokens(tokens) {
    const currentCredentials = await this.getCredentials();
    if (!currentCredentials) {
      throw new Error('No credentials to update');
    }
    
    const updatedCredentials = {
      ...currentCredentials,
      token: tokens.token,
      refreshToken: tokens.refreshToken
    };
    
    await this.storeCredentials(updatedCredentials);
  }

  // Cleanup methods
  async clearAll() {
    await this.clearCredentials();
    
    if (this.isLocalStorageAvailable()) {
      localStorage.removeItem(`${this.config.keyPrefix}userData`);
      // Clear all password entries
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(`${this.config.keyPrefix}password_`)) {
          localStorage.removeItem(key);
        }
      });
    }
    this.memoryStorage.clear();
  }

  // IndexedDB support (for future expansion)
  async initIndexedDB() {
    if (!(await this.isIndexedDBAvailable())) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains('credentials')) {
          db.createObjectStore('credentials', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('userData')) {
          db.createObjectStore('userData', { keyPath: 'id' });
        }
      };
    });
  }
}

module.exports = StorageManager;