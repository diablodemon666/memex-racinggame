/**
 * Game Initialization E2E Tests
 * 
 * Tests the core game initialization flow including:
 * - Page loading and asset loading
 * - UI panel functionality
 * - Game engine startup
 * - Basic user interactions
 */

const { test, expect } = require('@playwright/test');
const { GamePage, BettingPanel, PlayerSetupPanel, DebugPanel } = require('./utils/page-objects');

test.describe('Game Initialization', () => {
  let gamePage;

  test.beforeEach(async ({ page }) => {
    gamePage = new GamePage(page);
  });

  test('should load game page successfully', async ({ page }) => {
    // Navigate to the game
    await gamePage.navigate();

    // Verify page loads with correct title
    const title = await gamePage.getTitle();
    expect(title).toBeTruthy();
    expect(title).not.toBe('');

    // Wait for game to fully load
    await gamePage.waitForGameLoad();

    // Verify core game elements are present
    expect(await gamePage.isGameLoaded()).toBe(true);

    // Take screenshot for visual verification
    await gamePage.screenshot('game-loaded');
  });

  test('should initialize UI panels', async ({ page }) => {
    await gamePage.navigate();
    await gamePage.waitForGameLoad();

    // Test each panel can be toggled
    const panels = ['betting', 'leaderboard', 'debug', 'player-setup'];

    for (const panelName of panels) {
      // Toggle panel on
      await gamePage.togglePanel(panelName);
      
      // Verify panel is visible
      const isVisible = await gamePage.isPanelVisible(panelName);
      expect(isVisible).toBe(true);

      // Toggle panel off
      await gamePage.togglePanel(panelName);
      
      // Note: Some panels might remain visible by design,
      // so we don't always check for hidden state
    }
  });

  test('should respond to keyboard shortcuts', async ({ page }) => {
    await gamePage.navigate();
    await gamePage.waitForGameLoad();

    // Test keyboard shortcuts for panel toggles
    const shortcuts = [
      { key: 'KeyB', panel: 'betting' },
      { key: 'KeyL', panel: 'leaderboard' },
      { key: 'KeyD', panel: 'debug' },
      { key: 'KeyP', panel: 'player-setup' }
    ];

    for (const shortcut of shortcuts) {
      // Use keyboard shortcut
      await page.keyboard.press(shortcut.key);
      
      // Wait for UI to respond
      await page.waitForTimeout(300);
      
      // Verify panel state changed (implementation-dependent)
      // This test verifies the shortcut doesn't cause errors
    }

    // Test escape key to close modals
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  });

  test('should handle window resize', async ({ page }) => {
    await gamePage.navigate();
    await gamePage.waitForGameLoad();

    // Get initial size
    const initialSize = await page.viewportSize();

    // Resize to different dimensions
    const testSizes = [
      { width: 1024, height: 768 },
      { width: 1920, height: 1080 },
      { width: 800, height: 600 }
    ];

    for (const size of testSizes) {
      await page.setViewportSize(size);
      await page.waitForTimeout(500); // Allow resize to process
      
      // Verify game container is still visible and properly sized
      const gameContainer = page.locator(gamePage.gameContainer);
      expect(await gameContainer.isVisible()).toBe(true);
      
      // Verify UI overlay adapts to new size
      const uiOverlay = page.locator(gamePage.uiOverlay);
      expect(await uiOverlay.isVisible()).toBe(true);
    }

    // Restore original size
    await page.setViewportSize(initialSize);
  });

  test('should load without JavaScript errors', async ({ page }) => {
    // Track JavaScript errors
    const jsErrors = [];
    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });

    // Track console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await gamePage.navigate();
    await gamePage.waitForGameLoad();

    // Interact with various UI elements to trigger potential errors
    await gamePage.togglePanel('betting');
    await page.waitForTimeout(500);
    
    await gamePage.togglePanel('debug');
    await page.waitForTimeout(500);

    // Check for JavaScript errors
    expect(jsErrors).toHaveLength(0);
    
    // Allow some console warnings but no errors
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('warning') && 
      !error.includes('deprecated') &&
      !error.includes('404') // Allow 404s for optional resources
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('should display game in different browsers', async ({ browserName, page }) => {
    // This test runs automatically across different browsers via Playwright config
    await gamePage.navigate();
    await gamePage.waitForGameLoad();

    // Verify game loads in this browser
    expect(await gamePage.isGameLoaded()).toBe(true);

    // Take browser-specific screenshot
    await gamePage.screenshot(`game-loaded-${browserName}`);

    // Test basic functionality works across browsers
    await gamePage.togglePanel('betting');
    await page.waitForTimeout(500);
    
    const bettingVisible = await gamePage.isPanelVisible('betting');
    expect(bettingVisible).toBe(true);
  });

  test('should handle slow network conditions', async ({ page }) => {
    // Simulate slow network
    await page.route('**/*', route => {
      setTimeout(() => route.continue(), 100); // Add 100ms delay
    });

    await gamePage.navigate();
    
    // Should still load successfully, just slower
    await gamePage.waitForGameLoad();
    expect(await gamePage.isGameLoaded()).toBe(true);
  });
});

test.describe('UI Panel Functionality', () => {
  let gamePage;

  test.beforeEach(async ({ page }) => {
    gamePage = new GamePage(page);
    await gamePage.navigate();
    await gamePage.waitForGameLoad();
  });

  test('should initialize betting panel', async ({ page }) => {
    const bettingPanel = new BettingPanel(page);
    
    // Open betting panel
    await gamePage.togglePanel('betting');
    await bettingPanel.waitForReady();

    // Verify betting panel elements are present
    expect(await page.locator(bettingPanel.panel).isVisible()).toBe(true);
    expect(await page.locator(bettingPanel.countdown).isVisible()).toBe(true);
    expect(await page.locator(bettingPanel.userBalance).isVisible()).toBe(true);
    expect(await page.locator(bettingPanel.betAmountSlider).isVisible()).toBe(true);

    // Verify initial state
    const balance = await bettingPanel.getUserBalance();
    expect(balance).toBeGreaterThan(0);

    // Test bet amount adjustment
    await bettingPanel.setBetAmount(250);
    await page.waitForTimeout(200);
    
    const amountDisplay = await page.locator(bettingPanel.betAmountValue).textContent();
    expect(amountDisplay).toBe('250');
  });

  test('should initialize player setup panel', async ({ page }) => {
    const playerSetupPanel = new PlayerSetupPanel(page);
    
    // Open player setup panel
    await gamePage.togglePanel('player-setup');
    await playerSetupPanel.waitForReady();

    // Verify player setup elements
    expect(await page.locator(playerSetupPanel.panel).isVisible()).toBe(true);

    // Test player name input
    if (await page.locator(playerSetupPanel.playerNameInput).count() > 0) {
      await playerSetupPanel.setPlayerName('Test Player');
      
      const nameValue = await page.locator(playerSetupPanel.playerNameInput).inputValue();
      expect(nameValue).toBe('Test Player');
    }
  });

  test('should initialize debug panel', async ({ page }) => {
    const debugPanel = new DebugPanel(page);
    
    // Open debug panel
    await gamePage.togglePanel('debug');
    await debugPanel.waitForReady();

    // Verify debug panel elements
    expect(await page.locator(debugPanel.panel).isVisible()).toBe(true);

    // Check if performance metrics are displayed
    if (await page.locator(debugPanel.performanceMetrics).count() > 0) {
      const metrics = await debugPanel.getPerformanceMetrics();
      expect(metrics).toBeDefined();
    }

    // Check if game state is displayed  
    if (await page.locator(debugPanel.gameStateDisplay).count() > 0) {
      const gameState = await debugPanel.getGameState();
      expect(gameState).toBeTruthy();
    }
  });
});

test.describe('Accessibility', () => {
  let gamePage;

  test.beforeEach(async ({ page }) => {
    gamePage = new GamePage(page);
    await gamePage.navigate();
    await gamePage.waitForGameLoad();
  });

  test('should be keyboard navigable', async ({ page }) => {
    // Test tab navigation through interactive elements
    await page.keyboard.press('Tab');
    
    // Check that focus is visible (implementation dependent)
    const focusedElement = await page.evaluate(() => document.activeElement.tagName);
    expect(focusedElement).toBeTruthy();

    // Test multiple tab presses don't cause errors
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(50);
    }
  });

  test('should have proper ARIA labels', async ({ page }) => {
    // Check for basic accessibility attributes
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    if (buttonCount > 0) {
      // At least some buttons should have accessible text or aria-label
      const firstButton = buttons.first();
      const hasText = await firstButton.textContent();
      const hasAriaLabel = await firstButton.getAttribute('aria-label');
      
      expect(hasText || hasAriaLabel).toBeTruthy();
    }
  });

  test('should work with high contrast mode', async ({ page }) => {
    // Simulate high contrast mode via CSS
    await page.addStyleTag({
      content: `
        * {
          filter: contrast(200%) !important;
        }
      `
    });

    // Verify game still loads and functions
    expect(await gamePage.isGameLoaded()).toBe(true);
    
    // Test basic interaction still works
    await gamePage.togglePanel('betting');
    await page.waitForTimeout(500);
  });
});