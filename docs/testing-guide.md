# Testing Guide for Memex Racing Game

This comprehensive guide covers all aspects of testing for the Memex Racing Game project, including setup, best practices, and execution strategies.

## Table of Contents

1. [Overview](#overview)
2. [Testing Architecture](#testing-architecture)
3. [Unit Testing with Jest](#unit-testing-with-jest)
4. [End-to-End Testing with Playwright](#end-to-end-testing-with-playwright)
5. [Test Utilities and helpers](#test-utilities-and-helpers)
6. [Running Tests](#running-tests)
7. [Writing New Tests](#writing-new-tests)
8. [Debugging Tests](#debugging-tests)
9. [Best Practices](#best-practices)
10. [Continuous Integration](#continuous-integration)

## Overview

The Memex Racing Game uses a comprehensive testing strategy that includes:

- **Unit Tests**: Test individual components and functions in isolation
- **Integration Tests**: Test interactions between multiple components
- **End-to-End Tests**: Test complete user workflows in a real browser environment
- **Visual Regression Tests**: Ensure UI consistency across changes

### Technology Stack

- **Jest**: Unit and integration testing framework
- **Playwright**: End-to-end testing and browser automation
- **Custom Matchers**: Game-specific test assertions
- **Phaser.js Mocking**: Comprehensive game engine mocking utilities

## Testing Architecture

### Directory Structure

```
tests/
├── __mocks__/                  # Global mocks
│   └── fileMock.js            # File import mocks
├── setup/                     # Test configuration
│   ├── test-environment.js    # Global test environment setup
│   ├── jest-setup.js         # Jest-specific setup and utilities
│   └── custom-matchers.js    # Custom Jest matchers
├── utils/                     # Testing utilities
│   └── test-helpers.js       # Comprehensive testing helpers
├── unit/                      # Unit tests
│   ├── game/                 # Game system tests
│   │   ├── engine/           # GameEngine and managers
│   │   ├── systems/          # Game systems (physics, AI, etc.)
│   │   └── entities/         # Game entities (players, boosters)
│   ├── ui/                   # UI component tests
│   │   └── components/       # Individual UI component tests
│   ├── auth/                 # Authentication system tests
│   └── utils/                # Utility function tests
├── integration/              # Integration tests
│   ├── game-flow/           # Complete game flow tests
│   └── multiplayer/         # Multiplayer functionality tests
└── e2e/                     # End-to-end tests
    ├── setup/               # E2E test setup
    ├── utils/               # Page objects and E2E utilities
    └── *.spec.js           # E2E test specifications
```

### Test Configuration Files

- **`jest.config.js`**: Jest configuration (defined in package.json)
- **`playwright.config.js`**: Playwright configuration for E2E tests
- **`.eslintrc.js`**: Linting rules for test files

## Unit Testing with Jest

### Configuration

Jest is configured in `package.json` with the following key settings:

```json
{
  "testEnvironment": "jsdom",
  "setupFiles": ["jest-canvas-mock", "<rootDir>/tests/setup/test-environment.js"],
  "setupFilesAfterEnv": ["<rootDir>/tests/setup/jest-setup.js"],
  "moduleNameMapper": {
    "^@ui/(.*)$": "<rootDir>/src/ui/$1",
    "^@auth/(.*)$": "<rootDir>/src/auth/$1"
  }
}
```

### Writing Unit Tests

#### Basic Test Structure

```javascript
import { ComponentToTest } from '../../../src/path/to/component';
import { DOMHelpers, GameHelpers } from '../../utils/test-helpers';

describe('ComponentToTest', () => {
  let component;
  
  beforeEach(() => {
    DOMHelpers.setupCleanDOM();
    component = new ComponentToTest();
  });
  
  afterEach(() => {
    if (component) {
      component.destroy();
    }
    DOMHelpers.setupCleanDOM();
  });
  
  it('should initialize correctly', () => {
    expect(component).toBeDefined();
    expect(component.isInitialized).toBe(false);
  });
});
```

#### Testing UI Components

```javascript
describe('BettingPanel', () => {
  let bettingPanel;
  let mockUIManager;

  beforeEach(async () => {
    DOMHelpers.setupCleanDOM();
    DOMHelpers.createUIOverlay();
    
    mockUIManager = MockHelpers.createMockUIManager();
    bettingPanel = new BettingPanel(mockUIManager);
    
    await bettingPanel.initialize();
  });

  it('should place bet on player', () => {
    const mockPlayers = GameHelpers.createMockPlayers(3);
    bettingPanel.startBettingPhase({ players: mockPlayers });
    
    bettingPanel.placeBet(mockPlayers[0].id, mockPlayers[0].name);
    
    expect(bettingPanel.currentBet).toEqual({
      playerId: mockPlayers[0].id,
      playerName: mockPlayers[0].name,
      amount: expect.any(Number),
      odds: expect.any(Number),
      timestamp: expect.any(Number)
    });
  });
});
```

#### Testing Game Systems

```javascript
describe('GameEngine', () => {
  let gameEngine;

  beforeEach(async () => {
    const config = { width: 800, height: 600 };
    gameEngine = new GameEngine(config);
    await gameEngine.initialize();
  });

  it('should start game successfully', () => {
    gameEngine.start();
    
    expect(gameEngine.isRunning).toBe(true);
    expect(gameEngine.game).toBePhaserGameObject();
  });
});
```

### Custom Matchers

The project includes custom Jest matchers for game-specific testing:

```javascript
// UI-specific matchers
expect(element).toHaveClass('selected');
expect(element).toBeVisible();
expect(element).toBeHidden();

// Game-specific matchers
expect(gameObject).toBePhaserGameObject();
expect(scene).toBePhaserScene();
expect(player).toBeValidPlayer();
expect(gameState).toHaveValidGameState();

// Betting-specific matchers
expect(bettingState).toHaveValidBettingState();
expect(socket).toBeMockSocket();
```

## End-to-End Testing with Playwright

### Configuration

Playwright is configured to test across multiple browsers and devices:

```javascript
// playwright.config.js
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } }
  ],
  webServer: [
    { command: 'npm run dev', port: 8080 },
    { command: 'npm run server', port: 3001 }
  ]
});
```

### Page Object Model

E2E tests use the Page Object Model pattern for maintainable test code:

```javascript
// Page Object
class GamePage extends BasePage {
  constructor(page) {
    super(page);
    this.gameContainer = '#game-container';
    this.bettingToggle = '#betting-btn';
  }
  
  async navigate() {
    await this.goto('http://localhost:8080');
  }
  
  async waitForGameLoad() {
    await this.waitForVisible(this.gameContainer);
  }
  
  async togglePanel(panelName) {
    await this.clickWithRetry(`#${panelName}-btn`);
  }
}

// Test usage
test('should load game', async ({ page }) => {
  const gamePage = new GamePage(page);
  await gamePage.navigate();
  await gamePage.waitForGameLoad();
  
  expect(await gamePage.isGameLoaded()).toBe(true);
});
```

### Writing E2E Tests

#### Basic E2E Test Structure

```javascript
const { test, expect } = require('@playwright/test');
const { GamePage, BettingPanel } = require('./utils/page-objects');

test.describe('Feature Name', () => {
  let gamePage;

  test.beforeEach(async ({ page }) => {
    gamePage = new GamePage(page);
    await gamePage.navigate();
    await gamePage.waitForGameLoad();
  });

  test('should perform user workflow', async ({ page }) => {
    // Test implementation
  });
});
```

#### Testing User Workflows

```javascript
test('should complete betting workflow', async ({ page }) => {
  const bettingPanel = new BettingPanel(page);
  
  // Open betting panel
  await gamePage.togglePanel('betting');
  await bettingPanel.waitForReady();
  
  // Place bet
  const players = await bettingPanel.getAvailablePlayers();
  await bettingPanel.setBetAmount(100);
  await bettingPanel.placeBetOnPlayer(players[0].name);
  
  // Verify bet was placed
  const currentBet = await bettingPanel.getCurrentBet();
  expect(currentBet).toContain(players[0].name);
});
```

## Test Utilities and Helpers

### DOM Helpers

```javascript
import { DOMHelpers } from '../utils/test-helpers';

// Setup clean DOM environment
DOMHelpers.setupCleanDOM();

// Create test container
const container = DOMHelpers.createTestContainer();

// Create UI overlay structure
DOMHelpers.createUIOverlay();

// Simulate user interactions
DOMHelpers.simulateClick(element);
DOMHelpers.simulateInput(input, 'test value');
DOMHelpers.simulateKeyboard(element, 'Enter');
```

### Game Helpers

```javascript
import { GameHelpers } from '../utils/test-helpers';

// Create mock game objects
const mockGame = GameHelpers.createMockGame();
const mockPlayers = GameHelpers.createMockPlayers(4);
const mockGameState = GameHelpers.createMockGameState('betting');

// Create mock race results
const results = GameHelpers.createMockRaceResults(players);
```

### Async Helpers

```javascript
import { AsyncHelpers } from '../utils/test-helpers';

// Wait for conditions
await AsyncHelpers.waitFor(() => element.isVisible());
await AsyncHelpers.waitForElement('.loading-complete');

// Run with fake timers
await AsyncHelpers.withFakeTimers(async () => {
  component.startTimer();
  jest.advanceTimersByTime(1000);
});
```

## Running Tests

### Available Test Scripts

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in headed mode
npm run test:e2e:headed

# Run all tests (unit + E2E)
npm run test:all
```

### Test Execution Options

#### Unit Tests with Jest

```bash
# Run specific test file
npm test BettingPanel.test.js

# Run tests matching pattern
npm test --testNamePattern="betting"

# Run tests with debug output
DEBUG=true npm test

# Run tests with coverage threshold
npm run test:coverage
```

#### E2E Tests with Playwright

```bash
# Run specific test
npx playwright test betting-workflow.spec.js

# Run tests in specific browser
npx playwright test --project=chromium

# Run tests in debug mode
npx playwright test --debug

# Run tests with trace recording
npx playwright test --trace=on
```

## Writing New Tests

### Before Writing Tests

1. **Understand the Component**: Review the component's purpose, interface, and dependencies
2. **Identify Test Cases**: List all scenarios including happy path, edge cases, and error conditions
3. **Choose Test Type**: Determine if unit, integration, or E2E testing is most appropriate
4. **Review Existing Tests**: Look at similar components for patterns and conventions

### Test-Driven Development (TDD)

Follow the Red-Green-Refactor cycle:

1. **Red**: Write a failing test that describes the desired behavior
2. **Green**: Write the minimum code to make the test pass
3. **Refactor**: Improve the code while keeping tests passing

```javascript
// Red: Write failing test
it('should calculate player odds correctly', () => {
  const player = { winRate: 75 };
  const odds = bettingPanel.calculatePlayerOdds(player);
  expect(odds).toBeCloseTo(0.33, 2); // 25/75 = 0.33
});

// Green: Implement minimum functionality
calculatePlayerOdds(player) {
  return (100 - player.winRate) / player.winRate;
}

// Refactor: Improve implementation
calculatePlayerOdds(player) {
  const baseWinRate = Math.max(player.winRate || 20, 5);
  return Math.max((100 - baseWinRate) / baseWinRate, 1.1);
}
```

### Test Naming Conventions

Use descriptive test names that explain the scenario:

```javascript
// Good test names
describe('BettingPanel', () => {
  describe('when placing a bet', () => {
    it('should deduct bet amount from user balance', () => {});
    it('should update current bet display', () => {});
    it('should calculate potential winnings', () => {});
  });
  
  describe('when bet amount exceeds balance', () => {
    it('should prevent bet placement', () => {});
    it('should show insufficient funds message', () => {});
  });
});
```

## Debugging Tests

### Jest Debugging

#### Using VS Code Debugger

1. Add breakpoints in test files
2. Run test with Node.js debugger:

```bash
node --inspect-brk node_modules/.bin/jest --runInBand --testNamePattern="test name"
```

#### Console Debugging

```javascript
// Enable debug output in tests
process.env.TEST_DEBUG = 'true';

// Add debug logging
console.log('Debug info:', component.state);

// Use Jest debug utilities
console.log(prettyFormat(component));
```

### Playwright Debugging

#### Debug Mode

```bash
# Run single test in debug mode
npx playwright test --debug betting-workflow.spec.js

# Run with headed browser
npx playwright test --headed

# Record trace for later analysis
npx playwright test --trace=on
```

#### Screenshots and Videos

```javascript
// Take screenshot for debugging
await page.screenshot({ path: 'debug-screenshot.png' });

// Record video (configured in playwright.config.js)
use: { video: 'retain-on-failure' }
```

### Common Debugging Scenarios

#### Test Timeouts

```javascript
// Increase timeout for specific test
test('slow operation', async ({ page }) => {
  test.setTimeout(60000); // 60 seconds
  
  // Test implementation
});

// Wait for specific conditions
await page.waitForSelector('.element', { timeout: 30000 });
```

#### DOM Element Not Found

```javascript
// Wait for element to appear
await page.waitForSelector('.element', { state: 'visible' });

// Check if element exists
const elementCount = await page.locator('.element').count();
console.log(`Found ${elementCount} elements`);

// Use more specific selectors
await page.locator('[data-testid="specific-element"]').click();
```

## Best Practices

### General Testing Principles

1. **Test Behavior, Not Implementation**: Focus on what the component does, not how it does it
2. **Write Independent Tests**: Each test should be able to run in isolation
3. **Use Descriptive Names**: Test names should clearly describe the scenario
4. **Keep Tests Simple**: One test should verify one behavior
5. **Mock External Dependencies**: Use mocks to isolate the component under test

### Unit Test Best Practices

```javascript
// Good: Test behavior
it('should hide panel when hide() is called', () => {
  panel.hide();
  expect(panel.isVisible).toBe(false);
});

// Bad: Test implementation details
it('should call addClass with "hidden" class', () => {
  const spy = jest.spyOn(element, 'addClass');
  panel.hide();
  expect(spy).toHaveBeenCalledWith('hidden');
});
```

### E2E Test Best Practices

```javascript
// Good: Use Page Object Model
const gamePage = new GamePage(page);
await gamePage.toggleBettingPanel();

// Bad: Direct DOM manipulation
await page.click('#betting-btn');

// Good: Wait for meaningful states
await page.waitForSelector('[data-testid="betting-active"]');

// Bad: Fixed timeouts
await page.waitForTimeout(3000);
```

### Performance Considerations

1. **Parallel Execution**: Run tests in parallel when possible
2. **Selective Testing**: Use test patterns to run only relevant tests during development
3. **Resource Cleanup**: Always clean up resources in afterEach/afterAll hooks
4. **Efficient Mocking**: Mock expensive operations like network requests and file I/O

### Test Data Management

```javascript
// Use factory functions for test data
const createMockPlayer = (overrides = {}) => ({
  id: 'player-1',
  name: 'Test Player',
  wins: 5,
  winRate: 62.5,
  ...overrides
});

// Create realistic test scenarios
const createBettingScenario = () => ({
  players: [
    createMockPlayer({ id: 'player-1', winRate: 75 }),
    createMockPlayer({ id: 'player-2', winRate: 60 }),
    createMockPlayer({ id: 'player-3', winRate: 45 })
  ],
  userBalance: 1000,
  bettingTime: 30
});
```

## Continuous Integration

### GitHub Actions Configuration

```yaml
name: Tests
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: test-results/
```

### Pre-commit Hooks

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.js": ["eslint --fix", "npm test -- --findRelatedTests"]
  }
}
```

### Coverage Requirements

```javascript
// jest.config.js
module.exports = {
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

## Troubleshooting

### Common Issues and Solutions

#### Jest Issues

1. **Module Resolution Errors**
   ```bash
   # Clear Jest cache
   npx jest --clearCache
   
   # Check module name mapping in jest.config.js
   ```

2. **Canvas/WebGL Errors**
   ```javascript
   // Ensure jest-canvas-mock is properly setup
   setupFiles: ["jest-canvas-mock"]
   ```

3. **Async Test Failures**
   ```javascript
   // Use proper async/await
   it('should handle async operation', async () => {
     await expect(asyncFunction()).resolves.toBe(expectedValue);
   });
   ```

#### Playwright Issues

1. **Browser Launch Failures**
   ```bash
   # Reinstall browsers
   npx playwright install --with-deps
   ```

2. **Element Not Found**
   ```javascript
   // Wait for elements properly
   await page.waitForSelector('.selector', { state: 'visible' });
   ```

3. **Test Flakiness**
   ```javascript
   // Use proper waiting strategies
   await page.waitForLoadState('networkidle');
   await page.waitForFunction(() => window.gameLoaded);
   ```

### Getting Help

1. **Documentation**: Check Jest and Playwright official documentation
2. **Stack Overflow**: Search for similar issues
3. **GitHub Issues**: Check the project's issue tracker
4. **Debug Logs**: Enable debug logging for detailed information

## Conclusion

This testing framework provides comprehensive coverage for the Memex Racing Game, ensuring reliability and maintainability. By following these guidelines and best practices, you can contribute to a robust and well-tested codebase.

Remember to:

- Write tests for new features and bug fixes
- Keep tests up-to-date with code changes
- Run tests before committing changes
- Use the appropriate testing level (unit, integration, E2E) for each scenario
- Focus on testing user-visible behavior rather than implementation details

For questions or suggestions about the testing framework, please refer to the project's contribution guidelines or open an issue on the project repository.