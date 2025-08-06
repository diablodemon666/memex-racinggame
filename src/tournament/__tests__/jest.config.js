/**
 * Jest Configuration for Tournament Tests
 * 
 * Specialized configuration for tournament system testing with
 * proper mocking, timeout handling, and test utilities
 */

module.exports = {
  // Inherit from root Jest config
  ...require('../../../jest.config.js'),
  
  // Tournament-specific test environment setup
  displayName: 'Tournament Tests',
  
  // Extended timeout for complex tournament scenarios
  testTimeout: 30000,
  
  // Tournament-specific setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/jest-setup.js',
    '<rootDir>/src/tournament/__tests__/setup/tournament-setup.js'
  ],
  
  // Additional module name mappings for tournament tests
  moduleNameMapping: {
    '^@tournament/(.*)$': '<rootDir>/src/tournament/$1',
    '^@tournament-test-utils/(.*)$': '<rootDir>/tests/utils/$1'
  },
  
  // Coverage configuration specific to tournament system
  collectCoverageFrom: [
    'src/tournament/**/*.js',
    '!src/tournament/**/*.test.js',
    '!src/tournament/**/__tests__/**',
    '!src/tournament/**/index.js'
  ],
  
  // Tournament test patterns
  testMatch: [
    '<rootDir>/src/tournament/__tests__/**/*.test.js'
  ],
  
  // Verbose output for tournament tests
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Handle large tournament scenarios
  maxWorkers: 2, // Limit workers for complex tests
  
  // Tournament-specific globals
  globals: {
    'TOURNAMENT_TEST_MODE': true,
    'MAX_TOURNAMENT_PLAYERS': 64,
    'DEFAULT_RACE_TIME': 300000,
    'TOURNAMENT_TIMEOUT': 30000
  }
};