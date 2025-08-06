/**
 * Betting Workflow E2E Tests
 * 
 * Tests the complete betting user workflow including:
 * - Betting phase initialization
 * - Player selection and bet placement
 * - Bet management (clear, modify)
 * - Results processing and payouts
 */

const { test, expect } = require('@playwright/test');
const { GamePage, BettingPanel } = require('./utils/page-objects');

test.describe('Betting Workflow', () => {
  let gamePage;
  let bettingPanel;

  test.beforeEach(async ({ page, context }) => {
    gamePage = new GamePage(page);
    bettingPanel = new BettingPanel(page);
    
    await gamePage.navigate();
    await gamePage.waitForGameLoad();
    
    // Open betting panel
    await gamePage.togglePanel('betting');
    await bettingPanel.waitForReady();
  });

  test('should display betting interface correctly', async ({ page }) => {
    // Verify all betting elements are visible
    expect(await page.locator(bettingPanel.panel).isVisible()).toBe(true);
    expect(await page.locator(bettingPanel.userBalance).isVisible()).toBe(true);
    expect(await page.locator(bettingPanel.betAmountSlider).isVisible()).toBe(true);
    expect(await page.locator(bettingPanel.playersGrid).isVisible()).toBe(true);

    // Verify initial balance
    const initialBalance = await bettingPanel.getUserBalance();
    expect(initialBalance).toBeGreaterThan(0);

    // Verify no current bet initially
    const currentBet = await bettingPanel.getCurrentBet();
    expect(currentBet).toBeNull();

    // Take screenshot of betting interface
    await gamePage.screenshot('betting-interface');
  });

  test('should adjust bet amounts correctly', async ({ page }) => {
    const initialBalance = await bettingPanel.getUserBalance();

    // Test slider adjustment
    await bettingPanel.setBetAmount(250);
    
    let currentAmount = await page.locator(bettingPanel.betAmountValue).textContent();
    expect(currentAmount).toBe('250');

    // Test preset amounts
    await bettingPanel.usePresetAmount(100);
    currentAmount = await page.locator(bettingPanel.betAmountValue).textContent();
    expect(currentAmount).toBe('100');

    await bettingPanel.usePresetAmount(500);
    currentAmount = await page.locator(bettingPanel.betAmountValue).textContent();
    expect(currentAmount).toBe('500');

    // Test all-in functionality
    await bettingPanel.allIn();
    currentAmount = await page.locator(bettingPanel.betAmountValue).textContent();
    expect(parseInt(currentAmount)).toBe(initialBalance);

    // Verify slider updates with all-in
    const sliderValue = await page.locator(bettingPanel.betAmountSlider).inputValue();
    expect(parseInt(sliderValue)).toBe(initialBalance);
  });

  test('should prevent invalid bet amounts', async ({ page }) => {
    const initialBalance = await bettingPanel.getUserBalance();

    // Try to set bet amount higher than balance
    await bettingPanel.setBetAmount(initialBalance + 1000);
    
    // Should be capped at balance
    const currentAmount = await page.locator(bettingPanel.betAmountValue).textContent();
    expect(parseInt(currentAmount)).toBeLessThanOrEqual(initialBalance);

    // Try to set negative amount (if possible)
    await bettingPanel.setBetAmount(-100);
    
    // Should be reset to minimum valid amount
    const finalAmount = await page.locator(bettingPanel.betAmountValue).textContent();
    expect(parseInt(finalAmount)).toBeGreaterThan(0);
  });

  test('should display available players for betting', async ({ page }) => {
    // Get list of available players
    const players = await bettingPanel.getAvailablePlayers();
    
    // Should have at least one player available
    expect(players.length).toBeGreaterThan(0);

    // Verify each player has required information
    for (const player of players) {
      expect(player.name).toBeTruthy();
      expect(player.odds).toMatch(/\d+\.\d+:1/); // Format: "X.XX:1"
    }

    // Verify player cards are interactive
    const playerCards = page.locator('.player-card');
    const firstCard = playerCards.first();
    
    expect(await firstCard.isVisible()).toBe(true);
    
    const betButton = firstCard.locator('.bet-button');
    expect(await betButton.isVisible()).toBe(true);
    expect(await betButton.isEnabled()).toBe(true);
  });

  test('should place bets on players', async ({ page }) => {
    const initialBalance = await bettingPanel.getUserBalance();
    const players = await bettingPanel.getAvailablePlayers();
    
    // Skip if no players available
    if (players.length === 0) {
      test.skip('No players available for betting in this test run');
    }

    const firstPlayer = players[0];
    
    // Set bet amount
    await bettingPanel.setBetAmount(100);
    
    // Place bet on first player
    await bettingPanel.placeBetOnPlayer(firstPlayer.name);
    
    // Wait for bet processing
    await page.waitForTimeout(1000);
    
    // Verify bet was placed
    const currentBet = await bettingPanel.getCurrentBet();
    expect(currentBet).toBeTruthy();
    expect(currentBet).toContain(firstPlayer.name);
    expect(currentBet).toContain('$100');
    
    // Verify balance was deducted
    const newBalance = await bettingPanel.getUserBalance();
    expect(newBalance).toBe(initialBalance - 100);
    
    // Verify total pool updated
    const totalPool = await bettingPanel.getTotalPool();
    expect(totalPool).toBeGreaterThan(0);
    
    // Verify potential win is displayed
    const potentialWin = await bettingPanel.getPotentialWin();
    expect(potentialWin).toBeGreaterThan(100); // Should be more than bet due to odds
  });

  test('should clear bets correctly', async ({ page }) => {
    const initialBalance = await bettingPanel.getUserBalance();
    const players = await bettingPanel.getAvailablePlayers();
    
    if (players.length === 0) {
      test.skip('No players available for betting in this test run');
    }

    // Place a bet first
    await bettingPanel.setBetAmount(150);
    await bettingPanel.placeBetOnPlayer(players[0].name);
    
    // Verify bet was placed
    let currentBet = await bettingPanel.getCurrentBet();
    expect(currentBet).toBeTruthy();
    
    const balanceAfterBet = await bettingPanel.getUserBalance();
    expect(balanceAfterBet).toBe(initialBalance - 150);
    
    // Clear the bet
    await bettingPanel.clearBet();
    
    // Wait for clearing to process
    await page.waitForTimeout(500);
    
    // Verify bet was cleared
    currentBet = await bettingPanel.getCurrentBet();
    expect(currentBet).toBeNull();
    
    // Verify balance was refunded
    const finalBalance = await bettingPanel.getUserBalance();
    expect(finalBalance).toBe(initialBalance);
    
    // Verify potential win is reset
    const potentialWin = await bettingPanel.getPotentialWin();
    expect(potentialWin).toBe(0);
  });

  test('should replace previous bet when placing new one', async ({ page }) => {
    const initialBalance = await bettingPanel.getUserBalance();
    const players = await bettingPanel.getAvailablePlayers();
    
    if (players.length < 2) {
      test.skip('Need at least 2 players for bet replacement test');
    }

    // Place first bet
    await bettingPanel.setBetAmount(100);
    await bettingPanel.placeBetOnPlayer(players[0].name);
    
    // Verify first bet
    let currentBet = await bettingPanel.getCurrentBet();
    expect(currentBet).toContain(players[0].name);
    
    // Place second bet (should replace first)
    await bettingPanel.setBetAmount(200);
    await bettingPanel.placeBetOnPlayer(players[1].name);
    
    // Wait for bet processing
    await page.waitForTimeout(1000);
    
    // Verify second bet replaced first
    currentBet = await bettingPanel.getCurrentBet();
    expect(currentBet).toContain(players[1].name);
    expect(currentBet).toContain('$200');
    
    // Verify balance reflects only one bet
    const finalBalance = await bettingPanel.getUserBalance();
    expect(finalBalance).toBe(initialBalance - 200);
  });

  test('should handle betting countdown', async ({ page }) => {
    // This test depends on whether betting countdown is active
    // Check if countdown is running
    const initialTime = await bettingPanel.getTimeRemaining();
    
    if (initialTime > 0) {
      // Wait for some time and check if countdown decreased
      await page.waitForTimeout(2000);
      
      const newTime = await bettingPanel.getTimeRemaining();
      expect(newTime).toBeLessThan(initialTime);
      
      // Verify betting is still active while time remains
      expect(await bettingPanel.isBettingActive()).toBe(true);
    } else {
      // If no countdown active, verify betting state is consistent
      expect(await bettingPanel.isBettingActive()).toBe(false);
    }
  });

  test('should show visual feedback for betting actions', async ({ page }) => {
    const players = await bettingPanel.getAvailablePlayers();
    
    if (players.length === 0) {
      test.skip('No players available for betting feedback test');
    }

    // Place a bet and verify visual changes
    await bettingPanel.setBetAmount(100);
    await bettingPanel.placeBetOnPlayer(players[0].name);
    
    await page.waitForTimeout(500);
    
    // Check if selected player card has visual indication
    const selectedCard = page.locator('.player-card').filter({
      has: page.locator('.player-name', { hasText: players[0].name })
    });
    
    // The card might have a 'selected' class or different styling
    const cardClasses = await selectedCard.getAttribute('class');
    expect(cardClasses).toBeTruthy();
    
    // Check if current bet display has updated styling
    const currentBetDisplay = page.locator(bettingPanel.currentBet);
    const displayClasses = await currentBetDisplay.getAttribute('class');
    expect(displayClasses).toContain('has-bet');
    
    // Check if potential win display is highlighted
    const potentialWinDisplay = page.locator(bettingPanel.potentialWin);
    const winClasses = await potentialWinDisplay.getAttribute('class');
    expect(winClasses).toContain('has-potential');
  });

  test('should handle insufficient balance gracefully', async ({ page }) => {
    // Set bet amount to current balance
    const currentBalance = await bettingPanel.getUserBalance();
    await bettingPanel.setBetAmount(currentBalance);
    
    const players = await bettingPanel.getAvailablePlayers();
    if (players.length === 0) {
      test.skip('No players available for insufficient balance test');
    }

    // Place bet to use all balance
    await bettingPanel.placeBetOnPlayer(players[0].name);
    await page.waitForTimeout(500);
    
    // Verify balance is now 0 or very low
    const newBalance = await bettingPanel.getUserBalance();
    expect(newBalance).toBeLessThan(50);
    
    // Try to place another bet
    if (players.length > 1) {
      await bettingPanel.setBetAmount(100);
      await bettingPanel.placeBetOnPlayer(players[1].name);
      
      // Should not be able to place bet with insufficient funds
      // The current bet should still be the first one
      const currentBet = await bettingPanel.getCurrentBet();
      expect(currentBet).toContain(players[0].name);
    }
  });

  test('should persist betting state during panel toggles', async ({ page }) => {
    const players = await bettingPanel.getAvailablePlayers();
    
    if (players.length === 0) {
      test.skip('No players available for state persistence test');
    }

    // Place a bet
    await bettingPanel.setBetAmount(150);
    await bettingPanel.placeBetOnPlayer(players[0].name);
    
    const initialBet = await bettingPanel.getCurrentBet();
    const initialBalance = await bettingPanel.getUserBalance();
    
    // Close betting panel
    await gamePage.togglePanel('betting');
    await page.waitForTimeout(500);
    
    // Reopen betting panel
    await gamePage.togglePanel('betting');
    await bettingPanel.waitForReady();
    
    // Verify bet and balance are preserved
    const preservedBet = await bettingPanel.getCurrentBet();
    const preservedBalance = await bettingPanel.getUserBalance();
    
    expect(preservedBet).toBe(initialBet);
    expect(preservedBalance).toBe(initialBalance);
  });
});

test.describe('Betting Edge Cases', () => {
  let gamePage;
  let bettingPanel;

  test.beforeEach(async ({ page }) => {
    gamePage = new GamePage(page);
    bettingPanel = new BettingPanel(page);
    
    await gamePage.navigate();
    await gamePage.waitForGameLoad();
    await gamePage.togglePanel('betting');
    await bettingPanel.waitForReady();
  });

  test('should handle rapid bet changes', async ({ page }) => {
    const players = await bettingPanel.getAvailablePlayers();
    
    if (players.length < 2) {
      test.skip('Need at least 2 players for rapid change test');
    }

    // Rapidly change bet amounts and players
    for (let i = 0; i < 5; i++) {
      const amount = 50 + (i * 25);
      const playerIndex = i % players.length;
      
      await bettingPanel.setBetAmount(amount);
      await page.waitForTimeout(100);
      
      await bettingPanel.placeBetOnPlayer(players[playerIndex].name);
      await page.waitForTimeout(200);
    }
    
    // Verify final state is consistent
    const finalBet = await bettingPanel.getCurrentBet();
    expect(finalBet).toBeTruthy();
    
    const finalBalance = await bettingPanel.getUserBalance();
    expect(finalBalance).toBeGreaterThanOrEqual(0);
  });

  test('should handle betting when no players available', async ({ page }) => {
    // This test simulates a scenario where no players are available for betting
    // It depends on the specific implementation of player availability
    
    const players = await bettingPanel.getAvailablePlayers();
    
    if (players.length === 0) {
      // Verify appropriate messaging is displayed
      const playersGrid = page.locator(bettingPanel.playersGrid);
      const gridContent = await playersGrid.textContent();
      
      // Should display some indication of no players available
      expect(gridContent.toLowerCase()).toMatch(/no.*players|waiting|empty/);
      
      // Betting controls should be disabled or show appropriate state
      const betSlider = page.locator(bettingPanel.betAmountSlider);
      const isSliderDisabled = await betSlider.isDisabled();
      
      // Either slider is disabled OR there's clear messaging about waiting for players
      expect(isSliderDisabled || gridContent.includes('waiting')).toBe(true);
    } else {
      test.skip('Players are available, skipping no-players test');
    }
  });

  test('should maintain UI responsiveness during betting', async ({ page }) => {
    // Test that UI remains responsive during betting operations
    const players = await bettingPanel.getAvailablePlayers();
    
    if (players.length === 0) {
      test.skip('No players available for responsiveness test');
    }

    // Measure response times for UI interactions
    const startTime = Date.now();
    
    await bettingPanel.setBetAmount(200);
    const sliderTime = Date.now() - startTime;
    
    const betStartTime = Date.now();
    await bettingPanel.placeBetOnPlayer(players[0].name);
    const betTime = Date.now() - betStartTime;
    
    // UI should respond within reasonable time (less than 2 seconds)
    expect(sliderTime).toBeLessThan(2000);
    expect(betTime).toBeLessThan(2000);
    
    // Interface should remain interactive
    expect(await page.locator(bettingPanel.betAmountSlider).isEnabled()).toBe(true);
    expect(await page.locator(bettingPanel.clearBetBtn).isEnabled()).toBe(true);
  });
});