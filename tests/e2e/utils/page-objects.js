/**
 * Page Object Models for E2E Testing
 * 
 * Provides high-level abstractions for interacting with application pages
 * Following the Page Object Model pattern for maintainable E2E tests
 */

/**
 * Base Page Object with common functionality
 */
class BasePage {
  constructor(page) {
    this.page = page;
  }

  /**
   * Navigate to a specific URL
   */
  async goto(url) {
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for element to be visible
   */
  async waitForVisible(selector, timeout = 10000) {
    await this.page.waitForSelector(selector, { state: 'visible', timeout });
  }

  /**
   * Wait for element to be hidden
   */
  async waitForHidden(selector, timeout = 10000) {
    await this.page.waitForSelector(selector, { state: 'hidden', timeout });
  }

  /**
   * Take a screenshot for debugging
   */
  async screenshot(name) {
    await this.page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
  }

  /**
   * Get the page title
   */
  async getTitle() {
    return await this.page.title();
  }

  /**
   * Check if element exists
   */
  async elementExists(selector) {
    return await this.page.locator(selector).count() > 0;
  }

  /**
   * Click element with retry logic
   */
  async clickWithRetry(selector, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        await this.page.click(selector);
        return;
      } catch (error) {
        if (i === retries - 1) throw error;
        await this.page.waitForTimeout(1000);
      }
    }
  }
}

/**
 * Main Game Page Object
 */
class GamePage extends BasePage {
  constructor(page) {
    super(page);
    
    // Main game elements
    this.gameContainer = '#game-container';
    this.uiOverlay = '#ui-overlay';
    this.loadingScreen = '.loading-screen';
    
    // UI Panel toggles
    this.bettingToggle = '#betting-btn';
    this.leaderboardToggle = '#leaderboard-btn';
    this.debugToggle = '#debug-btn';
    this.playerSetupToggle = '#player-setup-btn';
    this.mapSelectionToggle = '#map-selection-btn';
  }

  /**
   * Navigate to the main game page
   */
  async navigate() {
    await this.goto('http://localhost:8080');
  }

  /**
   * Wait for game to fully load
   */
  async waitForGameLoad() {
    // Wait for loading screen to disappear
    await this.waitForHidden(this.loadingScreen, 30000);
    
    // Wait for UI overlay to be visible
    await this.waitForVisible(this.uiOverlay);
    
    // Wait for game container to be ready
    await this.waitForVisible(this.gameContainer);
    
    // Give Phaser.js time to initialize
    await this.page.waitForTimeout(2000);
  }

  /**
   * Check if game has loaded successfully
   */
  async isGameLoaded() {
    return await this.elementExists(this.gameContainer) && 
           await this.elementExists(this.uiOverlay);
  }

  /**
   * Toggle a UI panel
   */
  async togglePanel(panelName) {
    const toggleSelector = `#${panelName}-btn`;
    await this.clickWithRetry(toggleSelector);
    await this.page.waitForTimeout(500); // Allow panel animation
  }

  /**
   * Check if a panel is visible
   */
  async isPanelVisible(panelName) {
    const panelSelector = `#${panelName}-panel`;
    const panel = this.page.locator(panelSelector);
    return await panel.isVisible();
  }

  /**
   * Use keyboard shortcut
   */
  async useKeyboardShortcut(key) {
    await this.page.keyboard.press(key);
    await this.page.waitForTimeout(200);
  }

  /**
   * Get current game phase from UI
   */
  async getCurrentPhase() {
    // This would need to be implemented based on how phase is displayed in UI
    const phaseIndicator = this.page.locator('.game-phase-indicator');
    if (await phaseIndicator.count() > 0) {
      return await phaseIndicator.textContent();
    }
    return 'unknown';
  }
}

/**
 * Betting Panel Page Object
 */
class BettingPanel extends BasePage {
  constructor(page) {
    super(page);
    
    // Betting panel elements
    this.panel = '#betting-panel';
    this.countdown = '#betting-countdown';
    this.userBalance = '#user-balance';
    this.currentBet = '#current-bet-text';
    this.playersGrid = '#players-grid';
    this.betAmountSlider = '#bet-amount-slider';
    this.betAmountValue = '#bet-amount-value';
    this.clearBetBtn = '#clear-bet-btn';
    this.allInBtn = '#all-in-btn';
    this.totalPool = '#total-pool';
    this.potentialWin = '#potential-win';
  }

  /**
   * Wait for betting panel to be ready
   */
  async waitForReady() {
    await this.waitForVisible(this.panel);
    await this.waitForVisible(this.playersGrid);
  }

  /**
   * Get countdown time remaining
   */
  async getTimeRemaining() {
    const countdownText = await this.page.locator(`${this.countdown} .timer-text`).textContent();
    const match = countdownText.match(/(\d+)s/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Get user balance
   */
  async getUserBalance() {
    const balanceText = await this.page.locator(this.userBalance).textContent();
    const match = balanceText.match(/\$(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Get available players for betting
   */
  async getAvailablePlayers() {
    const playerCards = this.page.locator('.player-card');
    const count = await playerCards.count();
    const players = [];
    
    for (let i = 0; i < count; i++) {
      const card = playerCards.nth(i);
      const name = await card.locator('.player-name').textContent();
      const odds = await card.locator('.odds-value').textContent();
      
      players.push({ name, odds });
    }
    
    return players;
  }

  /**
   * Place bet on a player
   */
  async placeBetOnPlayer(playerName) {
    const playerCard = this.page.locator('.player-card').filter({
      has: this.page.locator('.player-name', { hasText: playerName })
    });
    
    await playerCard.locator('.bet-button').click();
    await this.page.waitForTimeout(500); // Wait for bet to process
  }

  /**
   * Set bet amount using slider
   */
  async setBetAmount(amount) {
    await this.page.locator(this.betAmountSlider).fill(amount.toString());
    await this.page.waitForTimeout(200);
  }

  /**
   * Use preset bet amount
   */
  async usePresetAmount(amount) {
    await this.page.locator(`[data-amount="${amount}"]`).click();
    await this.page.waitForTimeout(200);
  }

  /**
   * Clear current bet
   */
  async clearBet() {
    await this.page.locator(this.clearBetBtn).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Place all-in bet
   */
  async allIn() {
    await this.page.locator(this.allInBtn).click();
    await this.page.waitForTimeout(200);
  }

  /**
   * Check if betting is active
   */
  async isBettingActive() {
    const timeRemaining = await this.getTimeRemaining();
    return timeRemaining > 0;
  }

  /**
   * Get current bet information
   */
  async getCurrentBet() {
    const betText = await this.page.locator(this.currentBet).textContent();
    return betText === 'NONE' ? null : betText;
  }

  /**
   * Get total betting pool
   */
  async getTotalPool() {
    const poolText = await this.page.locator(this.totalPool).textContent();
    const match = poolText.match(/\$(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Get potential winnings
   */
  async getPotentialWin() {
    const winText = await this.page.locator(this.potentialWin).textContent();
    const match = winText.match(/\$(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }
}

/**
 * Player Setup Panel Page Object
 */
class PlayerSetupPanel extends BasePage {
  constructor(page) {
    super(page);
    
    // Player setup elements
    this.panel = '#player-setup-panel';
    this.playerNameInput = '#player-name-input';
    this.avatarSelector = '.avatar-selector';
    this.readyButton = '#ready-button';
    this.playerList = '.player-list';
    this.roomCode = '#room-code';
    this.inviteButton = '#invite-button';
  }

  /**
   * Wait for player setup panel to be ready
   */
  async waitForReady() {
    await this.waitForVisible(this.panel);
  }

  /**
   * Set player name
   */
  async setPlayerName(name) {
    await this.page.locator(this.playerNameInput).fill(name);
  }

  /**
   * Select avatar
   */
  async selectAvatar(avatarIndex = 0) {
    const avatars = this.page.locator(`${this.avatarSelector} .avatar-option`);
    await avatars.nth(avatarIndex).click();
  }

  /**
   * Mark player as ready
   */
  async markReady() {
    await this.page.locator(this.readyButton).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Get room code
   */
  async getRoomCode() {
    return await this.page.locator(this.roomCode).textContent();
  }

  /**
   * Get list of players in room
   */
  async getPlayerList() {
    const playerItems = this.page.locator(`${this.playerList} .player-item`);
    const count = await playerItems.count();
    const players = [];
    
    for (let i = 0; i < count; i++) {
      const item = playerItems.nth(i);
      const name = await item.locator('.player-name').textContent();
      const ready = await item.locator('.ready-indicator').isVisible();
      
      players.push({ name, ready });
    }
    
    return players;
  }

  /**
   * Send invite
   */
  async sendInvite() {
    await this.page.locator(this.inviteButton).click();
  }
}

/**
 * Debug Panel Page Object
 */
class DebugPanel extends BasePage {
  constructor(page) {
    super(page);
    
    // Debug panel elements
    this.panel = '#debug-panel';
    this.performanceMetrics = '.performance-metrics';
    this.gameStateDisplay = '.game-state-display';
    this.logOutput = '.log-output';
    this.clearLogsButton = '#clear-logs-btn';
  }

  /**
   * Wait for debug panel to be ready
   */
  async waitForReady() {
    await this.waitForVisible(this.panel);
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics() {
    const metricsText = await this.page.locator(this.performanceMetrics).textContent();
    // Parse FPS, memory usage, etc. from the display
    return {
      fps: this.extractMetric(metricsText, 'FPS'),
      memory: this.extractMetric(metricsText, 'Memory')
    };
  }

  /**
   * Extract metric value from text
   */
  extractMetric(text, metricName) {
    const regex = new RegExp(`${metricName}:\\s*(\\d+(?:\\.\\d+)?)`);
    const match = text.match(regex);
    return match ? parseFloat(match[1]) : 0;
  }

  /**
   * Get current game state
   */
  async getGameState() {
    return await this.page.locator(this.gameStateDisplay).textContent();
  }

  /**
   * Get recent log entries
   */
  async getLogEntries() {
    const logItems = this.page.locator(`${this.logOutput} .log-entry`);
    const count = await logItems.count();
    const logs = [];
    
    for (let i = 0; i < count; i++) {
      const entry = await logItems.nth(i).textContent();
      logs.push(entry);
    }
    
    return logs;
  }

  /**
   * Clear debug logs
   */
  async clearLogs() {
    await this.page.locator(this.clearLogsButton).click();
  }
}

// Export all page objects
module.exports = {
  BasePage,
  GamePage,
  BettingPanel,
  PlayerSetupPanel,
  DebugPanel
};