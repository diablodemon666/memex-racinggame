/**
 * Test Environment Setup
 * Configures global test environment with proper mocking and setup
 */

// Load test environment variables
require('dotenv').config({ path: '.env.test' });

// Set NODE_ENV to test if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// Ensure JWT_SECRET is available for tests
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-32-chars-minimum-length-required-for-security-validation';
}

/**
 * Setup crypto mocking for consistent test behavior
 */
function setupCryptoMocks() {
  // Mock crypto.getRandomValues for consistent random generation in tests
  const mockGetRandomValues = jest.fn((array) => {
    // Fill with predictable values for testing
    for (let i = 0; i < array.length; i++) {
      array[i] = (i * 37) % 256; // Predictable but varied pattern
    }
    return array;
  });

  // Mock crypto.randomBytes for Node.js crypto module
  const mockRandomBytes = jest.fn((size) => {
    const buffer = Buffer.alloc(size);
    for (let i = 0; i < size; i++) {
      buffer[i] = (i * 37) % 256;
    }
    return buffer;
  });

  // Setup global crypto mock for browser crypto API
  Object.defineProperty(global, 'crypto', {
    value: { 
      getRandomValues: mockGetRandomValues,
      randomBytes: mockRandomBytes
    },
    writable: true,
    configurable: true
  });

  // Setup Node.js crypto module mock
  jest.doMock('crypto', () => ({
    randomBytes: mockRandomBytes,
    createHash: jest.requireActual('crypto').createHash,
    createHmac: jest.requireActual('crypto').createHmac,
    pbkdf2Sync: jest.requireActual('crypto').pbkdf2Sync,
    randomInt: jest.fn((min, max) => Math.floor(Math.random() * (max - min)) + min)
  }));

  return { mockGetRandomValues, mockRandomBytes };
}

/**
 * Setup request/response mocking for HTTP tests
 */
function setupHTTPMocks() {
  // Mock request object with proper headers
  const mockRequest = {
    headers: {
      'x-forwarded-proto': 'https',
      'x-csrf-token': 'test-csrf-token',
      'user-agent': 'jest-test-runner',
      'accept': 'application/json',
      'content-type': 'application/json'
    },
    secure: false,
    get: jest.fn((header) => mockRequest.headers[header.toLowerCase()]),
    body: {},
    query: {},
    params: {},
    method: 'GET',
    url: '/test',
    ip: '127.0.0.1'
  };

  // Mock response object
  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    get: jest.fn(),
    locals: {}
  };

  return { mockRequest, mockResponse };
}

/**
 * Setup Phaser mocking for game-related tests
 */
function setupPhaserMocks() {
  // Mock Phaser game object
  const mockPhaserGame = {
    scene: {
      add: jest.fn(),
      remove: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      get: jest.fn()
    },
    sound: {
      add: jest.fn(),
      play: jest.fn(),
      stop: jest.fn()
    },
    tweens: {
      add: jest.fn(() => ({
        remove: jest.fn(),
        stop: jest.fn(),
        destroy: jest.fn()
      }))
    },
    time: {
      addEvent: jest.fn(() => ({
        remove: jest.fn(),
        destroy: jest.fn()
      }))
    }
  };

  // Mock Phaser scene
  const mockPhaserScene = {
    add: {
      sprite: jest.fn(),
      image: jest.fn(),
      text: jest.fn()
    },
    physics: {
      add: {
        sprite: jest.fn()
      }
    },
    tweens: mockPhaserGame.tweens,
    time: mockPhaserGame.time,
    game: mockPhaserGame
  };

  return { mockPhaserGame, mockPhaserScene };
}

/**
 * Setup localStorage mocking for browser storage tests
 */
function setupLocalStorageMocks() {
  const localStorageMock = {
    store: new Map(),
    getItem(key) {
      return this.store.get(key) || null;
    },
    setItem(key, value) {
      this.store.set(key, String(value));
    },
    removeItem(key) {
      this.store.delete(key);
    },
    clear() {
      this.store.clear();
    },
    get length() {
      return this.store.size;
    },
    key(index) {
      const keys = Array.from(this.store.keys());
      return keys[index] || null;
    }
  };

  Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true
  });

  return localStorageMock;
}

/**
 * Setup console mocking to reduce test noise
 */
function setupConsoleMocks() {
  if (process.env.SUPPRESS_CONSOLE_ERRORS !== 'false') {
    // Suppress console errors and warnings during tests unless explicitly disabled
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  }

  // Always suppress debug logs
  jest.spyOn(console, 'debug').mockImplementation(() => {});
}

/**
 * Setup timer mocking for more reliable timer tests
 */
function setupTimerMocks() {
  // Enable fake timers for consistent timer behavior
  jest.useFakeTimers();

  // Provide helper to advance timers
  global.advanceTimers = (ms) => {
    jest.advanceTimersByTime(ms);
  };

  // Provide helper to run all pending timers
  global.runAllTimers = () => {
    jest.runAllTimers();
  };
}

/**
 * Global test cleanup function
 */
function cleanupAfterTest() {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Reset fake timers if they were used
  if (jest.isMockFunction(setTimeout)) {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  }
  
  // Clear localStorage
  if (global.localStorage) {
    global.localStorage.clear();
  }
  
  // Reset environment variables to test defaults
  if (process.env.NODE_ENV === 'test') {
    process.env.JWT_SECRET = 'test-jwt-secret-32-chars-minimum-length-required-for-security-validation';
  }
}

/**
 * Main setup function to initialize all test infrastructure
 */
function setupTestEnvironment() {
  const cryptoMocks = setupCryptoMocks();
  const httpMocks = setupHTTPMocks();
  const phaserMocks = setupPhaserMocks();
  const localStorageMock = setupLocalStorageMocks();
  
  setupConsoleMocks();
  // setupTimerMocks(); // Commented out as it can interfere with individual tests
  
  // Make mocks available globally for tests
  global.testMocks = {
    crypto: cryptoMocks,
    http: httpMocks,
    phaser: phaserMocks,
    localStorage: localStorageMock
  };

  // Setup global cleanup
  global.cleanupAfterTest = cleanupAfterTest;

  return global.testMocks;
}

// Initialize test environment when loaded as setup file
// Removed automatic initialization to prevent issues when imported

module.exports = {
  setupTestEnvironment,
  setupCryptoMocks,
  setupHTTPMocks,
  setupPhaserMocks,
  setupLocalStorageMocks,
  setupConsoleMocks,
  setupTimerMocks,
  cleanupAfterTest
};