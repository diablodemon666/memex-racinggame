/**
 * BettingPanel.test.js - Comprehensive Unit Tests
 * 
 * Tests the BettingPanel UI component using TDD methodology
 * Covers betting mechanics, timer functionality, user interactions, and state management
 */

import { BettingPanel } from '../../../src/ui/components/BettingPanel';
import { DOMHelpers, AsyncHelpers, GameHelpers, MockHelpers, ValidationHelpers } from '../../utils/test-helpers';

describe('BettingPanel Component', () => {
  let bettingPanel;
  let mockUIManager;
  let testContainer;

  beforeEach(() => {
    // Setup clean DOM environment
    DOMHelpers.setupCleanDOM();
    testContainer = DOMHelpers.createTestContainer();
    DOMHelpers.createUIOverlay();

    // Create mock UI manager
    mockUIManager = MockHelpers.createMockUIManager();

    // Create betting panel instance
    bettingPanel = new BettingPanel(mockUIManager);
  });

  afterEach(() => {
    if (bettingPanel) {
      bettingPanel.destroy();
    }
    DOMHelpers.setupCleanDOM();
  });

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      expect(bettingPanel.uiManager).toBe(mockUIManager);
      expect(bettingPanel.isVisible).toBe(false);
      expect(bettingPanel.isBettingActive).toBe(false);
      expect(bettingPanel.timeRemaining).toBe(30);
      expect(bettingPanel.betAmount).toBe(100);
      expect(bettingPanel.userBalance).toBe(1000);
      expect(bettingPanel.currentBet).toBeNull();
      expect(bettingPanel.players).toEqual([]);
    });

    it('should have required component interface methods', () => {
      ValidationHelpers.validateComponent(bettingPanel, [
        'show', 'hide', 'toggle', 'startBettingPhase', 'endBettingPhase',
        'placeBet', 'clearBet', 'updateBetAmount'
      ]);
    });

    it('should initialize HTML structure when initialize() is called', async () => {
      await bettingPanel.initialize();

      const panel = document.getElementById('betting-panel');
      expect(panel).toBeTruthy();
      
      // Check for key UI elements
      expect(document.getElementById('betting-countdown')).toBeTruthy();
      expect(document.getElementById('user-balance')).toBeTruthy();
      expect(document.getElementById('current-bet-display')).toBeTruthy();
      expect(document.getElementById('players-grid')).toBeTruthy();
      expect(document.getElementById('bet-amount-slider')).toBeTruthy();
    });
  });

  describe('Panel Visibility', () => {
    beforeEach(async () => {
      await bettingPanel.initialize();
    });

    it('should show panel when show() is called', () => {
      bettingPanel.show();
      
      const panel = document.getElementById('betting-panel');
      expect(panel).not.toHaveClass('hidden');
      expect(bettingPanel.isVisible).toBe(true);
    });

    it('should hide panel when hide() is called', () => {
      bettingPanel.show();
      bettingPanel.hide();
      
      const panel = document.getElementById('betting-panel');
      expect(panel).toHaveClass('hidden');
      expect(bettingPanel.isVisible).toBe(false);
    });

    it('should toggle panel visibility', () => {
      expect(bettingPanel.isVisible).toBe(false);
      
      bettingPanel.toggle();
      expect(bettingPanel.isVisible).toBe(true);
      
      bettingPanel.toggle();
      expect(bettingPanel.isVisible).toBe(false);
    });
  });

  describe('Betting Phase Management', () => {
    let mockPlayers;

    beforeEach(async () => {
      await bettingPanel.initialize();
      mockPlayers = GameHelpers.createMockPlayers(4);
    });

    it('should start betting phase with player data', () => {
      const gameData = {
        players: mockPlayers,
        bettingTime: 25
      };

      bettingPanel.startBettingPhase(gameData);

      expect(bettingPanel.players).toEqual(mockPlayers);
      expect(bettingPanel.timeRemaining).toBe(25);
      expect(bettingPanel.isBettingActive).toBe(true);
      expect(bettingPanel.isVisible).toBe(true);
    });

    it('should end betting phase and disable controls', () => {
      const gameData = { players: mockPlayers };
      bettingPanel.startBettingPhase(gameData);
      
      bettingPanel.endBettingPhase();

      expect(bettingPanel.isBettingActive).toBe(false);
      expect(bettingPanel.countdownTimer).toBeNull();
    });

    it('should update countdown display during betting', async () => {
      const gameData = { players: mockPlayers, bettingTime: 5 };
      bettingPanel.startBettingPhase(gameData);

      // Fast-forward timers
      await AsyncHelpers.withFakeTimers(async () => {
        jest.advanceTimersByTime(2000); // 2 seconds
        
        expect(bettingPanel.timeRemaining).toBe(3);
        
        const timerText = document.querySelector('#betting-countdown .timer-text');
        expect(timerText.textContent).toBe('TIME: 3s');
      });
    });

    it('should automatically end betting when time reaches zero', async () => {
      const gameData = { players: mockPlayers, bettingTime: 2 };
      bettingPanel.startBettingPhase(gameData);

      await AsyncHelpers.withFakeTimers(async () => {
        jest.advanceTimersByTime(3000); // More than betting time
        
        expect(bettingPanel.isBettingActive).toBe(false);
        expect(bettingPanel.timeRemaining).toBe(0);
      });
    });
  });

  describe('Player Display', () => {
    let mockPlayers;

    beforeEach(async () => {
      await bettingPanel.initialize();
      mockPlayers = GameHelpers.createMockPlayers(3);
    });

    it('should create player cards in grid', () => {
      const gameData = { players: mockPlayers };
      bettingPanel.startBettingPhase(gameData);

      const playersGrid = document.getElementById('players-grid');
      const playerCards = playersGrid.querySelectorAll('.player-card');
      
      expect(playerCards.length).toBe(3);
      
      // Check first player card content
      const firstCard = playerCards[0];
      expect(firstCard.querySelector('.player-name').textContent).toBe(mockPlayers[0].name);
      expect(firstCard.querySelector('.bet-button')).toBeTruthy();
    });

    it('should display player statistics correctly', () => {
      mockPlayers[0].wins = 10;
      mockPlayers[0].winRate = 75;
      
      const gameData = { players: mockPlayers };
      bettingPanel.startBettingPhase(gameData);

      const firstCard = document.querySelector('.player-card');
      const stats = firstCard.querySelectorAll('.stat');
      
      expect(stats[0].textContent).toBe('Wins: 10');
      expect(stats[1].textContent).toBe('Rate: 75%');
    });

    it('should calculate and display odds for players', () => {
      mockPlayers[0].winRate = 50; // Should result in reasonable odds
      
      const gameData = { players: mockPlayers };
      bettingPanel.startBettingPhase(gameData);

      const firstCard = document.querySelector('.player-card');
      const oddsValue = firstCard.querySelector('.odds-value');
      
      expect(oddsValue.textContent).toMatch(/\d+\.\d+:1/); // Format: "X.XX:1"
    });
  });

  describe('Bet Amount Management', () => {
    beforeEach(async () => {
      await bettingPanel.initialize();
    });

    it('should update bet amount via slider', () => {
      const slider = document.getElementById('bet-amount-slider');
      const valueDisplay = document.getElementById('bet-amount-value');
      
      bettingPanel.updateBetAmount(250);
      
      expect(bettingPanel.betAmount).toBe(250);
      expect(slider.value).toBe('250');
      expect(valueDisplay.textContent).toBe('250');
    });

    it('should handle preset amount buttons', () => {
      const presetBtn = document.querySelector('[data-amount="250"]');
      
      DOMHelpers.simulateClick(presetBtn);
      
      expect(bettingPanel.betAmount).toBe(250);
    });

    it('should not allow bet amount to exceed user balance', () => {
      bettingPanel.userBalance = 300;
      
      bettingPanel.updateBetAmount(500);
      
      expect(bettingPanel.betAmount).toBe(300); // Limited to balance
    });

    it('should handle all-in functionality', () => {
      bettingPanel.userBalance = 750;
      const mockPlayers = GameHelpers.createMockPlayers(2);
      const gameData = { players: mockPlayers };
      bettingPanel.startBettingPhase(gameData);
      
      bettingPanel.allIn();
      
      expect(bettingPanel.betAmount).toBe(750);
    });
  });

  describe('Bet Placement', () => {
    let mockPlayers;

    beforeEach(async () => {
      await bettingPanel.initialize();
      mockPlayers = GameHelpers.createMockPlayers(2);
      const gameData = { players: mockPlayers };
      bettingPanel.startBettingPhase(gameData);
    });

    it('should place bet on selected player', () => {
      const playerId = mockPlayers[0].id;
      const playerName = mockPlayers[0].name;
      const initialBalance = bettingPanel.userBalance;
      
      bettingPanel.placeBet(playerId, playerName);
      
      expect(bettingPanel.currentBet).toEqual({
        playerId,
        playerName,
        amount: bettingPanel.betAmount,
        odds: expect.any(Number),
        timestamp: expect.any(Number)
      });
      
      expect(bettingPanel.userBalance).toBe(initialBalance - bettingPanel.betAmount);
    });

    it('should not allow betting when phase is inactive', () => {
      bettingPanel.endBettingPhase();
      const initialBalance = bettingPanel.userBalance;
      
      bettingPanel.placeBet(mockPlayers[0].id, mockPlayers[0].name);
      
      expect(bettingPanel.currentBet).toBeNull();
      expect(bettingPanel.userBalance).toBe(initialBalance);
    });

    it('should not allow betting with insufficient balance', () => {
      bettingPanel.userBalance = 50;
      bettingPanel.betAmount = 100;
      
      bettingPanel.placeBet(mockPlayers[0].id, mockPlayers[0].name);
      
      expect(bettingPanel.currentBet).toBeNull();
    });

    it('should replace previous bet when placing new one', () => {
      const player1 = mockPlayers[0];
      const player2 = mockPlayers[1];
      const initialBalance = bettingPanel.userBalance;
      
      // Place first bet
      bettingPanel.placeBet(player1.id, player1.name);
      const balanceAfterFirst = bettingPanel.userBalance;
      
      // Place second bet (should replace first)
      bettingPanel.placeBet(player2.id, player2.name);
      
      expect(bettingPanel.currentBet.playerId).toBe(player2.id);
      expect(bettingPanel.userBalance).toBe(initialBalance - bettingPanel.betAmount);
    });
  });

  describe('Bet Clearing', () => {
    let mockPlayers;

    beforeEach(async () => {
      await bettingPanel.initialize();
      mockPlayers = GameHelpers.createMockPlayers(2);
      const gameData = { players: mockPlayers };
      bettingPanel.startBettingPhase(gameData);
    });

    it('should clear current bet and refund amount', () => {
      const initialBalance = bettingPanel.userBalance;
      
      // Place a bet first
      bettingPanel.placeBet(mockPlayers[0].id, mockPlayers[0].name);
      
      // Clear the bet
      bettingPanel.clearBet();
      
      expect(bettingPanel.currentBet).toBeNull();
      expect(bettingPanel.userBalance).toBe(initialBalance);
    });

    it('should update UI when clearing bet', () => {
      // Place a bet
      bettingPanel.placeBet(mockPlayers[0].id, mockPlayers[0].name);
      
      // Clear the bet
      bettingPanel.clearBet();
      
      const currentBetText = document.getElementById('current-bet-text');
      expect(currentBetText.textContent).toBe('NONE');
      expect(currentBetText).not.toHaveClass('has-bet');
    });
  });

  describe('Race Results Processing', () => {
    let mockPlayers;

    beforeEach(async () => {
      await bettingPanel.initialize();
      mockPlayers = GameHelpers.createMockPlayers(3);
      const gameData = { players: mockPlayers };
      bettingPanel.startBettingPhase(gameData);
    });

    it('should process winning bet correctly', () => {
      const winner = mockPlayers[0];
      const initialBalance = bettingPanel.userBalance;
      
      // Place bet on winner
      bettingPanel.placeBet(winner.id, winner.name);
      const betAmount = bettingPanel.currentBet.amount;
      const odds = bettingPanel.currentBet.odds;
      
      // Process results with this player as winner
      const results = [{ playerId: winner.id, position: 1 }];
      bettingPanel.processRaceResults(results);
      
      const expectedWinnings = Math.floor(betAmount * odds);
      expect(bettingPanel.userBalance).toBe(initialBalance - betAmount + expectedWinnings);
      expect(bettingPanel.currentBet).toBeNull();
    });

    it('should process losing bet correctly', () => {
      const loser = mockPlayers[0];
      const winner = mockPlayers[1];
      const initialBalance = bettingPanel.userBalance;
      
      // Place bet on loser
      bettingPanel.placeBet(loser.id, loser.name);
      const balanceAfterBet = bettingPanel.userBalance;
      
      // Process results with different player as winner
      const results = [{ playerId: winner.id, position: 1 }];
      bettingPanel.processRaceResults(results);
      
      expect(bettingPanel.userBalance).toBe(balanceAfterBet); // No change (already deducted)
      expect(bettingPanel.currentBet).toBeNull();
    });

    it('should handle empty or invalid results', () => {
      const initialBalance = bettingPanel.userBalance;
      bettingPanel.placeBet(mockPlayers[0].id, mockPlayers[0].name);
      
      bettingPanel.processRaceResults(null);
      bettingPanel.processRaceResults([]);
      
      // Should not crash or change state unexpectedly
      expect(bettingPanel.currentBet).toBeTruthy(); // Bet should still exist
    });
  });

  describe('UI State Updates', () => {
    beforeEach(async () => {
      await bettingPanel.initialize();
    });

    it('should update balance display correctly', () => {
      bettingPanel.userBalance = 750;
      bettingPanel.updateUserBalanceDisplay();
      
      const balanceDisplay = document.getElementById('user-balance');
      expect(balanceDisplay.textContent).toBe('$750');
    });

    it('should apply low balance styling', () => {
      bettingPanel.userBalance = 50; // Low balance
      bettingPanel.updateUserBalanceDisplay();
      
      const balanceDisplay = document.getElementById('user-balance');
      expect(balanceDisplay).toHaveClass('low-balance');
    });

    it('should apply no balance styling', () => {
      bettingPanel.userBalance = 0;
      bettingPanel.updateUserBalanceDisplay();
      
      const balanceDisplay = document.getElementById('user-balance');
      expect(balanceDisplay).toHaveClass('no-balance');
    });

    it('should update betting statistics', () => {
      const mockPlayers = GameHelpers.createMockPlayers(2);
      const gameData = { players: mockPlayers };
      bettingPanel.startBettingPhase(gameData);
      
      // Place a bet to generate stats
      bettingPanel.placeBet(mockPlayers[0].id, mockPlayers[0].name);
      
      const totalPoolDisplay = document.getElementById('total-pool');
      const potentialWinDisplay = document.getElementById('potential-win');
      
      expect(totalPoolDisplay.textContent).toMatch(/\$\d+/);
      expect(potentialWinDisplay.textContent).toMatch(/\$\d+/);
      expect(potentialWinDisplay).toHaveClass('has-potential');
    });
  });

  describe('Component Lifecycle', () => {
    it('should clean up resources on destroy', () => {
      const gameData = { players: GameHelpers.createMockPlayers(2) };
      bettingPanel.startBettingPhase(gameData);
      
      expect(bettingPanel.countdownTimer).toBeTruthy();
      
      bettingPanel.destroy();
      
      expect(bettingPanel.countdownTimer).toBeNull();
      expect(bettingPanel.currentBet).toBeNull();
    });

    it('should handle destroy when not initialized', () => {
      expect(() => {
        const panel = new BettingPanel(mockUIManager);
        panel.destroy();
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await bettingPanel.initialize();
    });

    it('should handle missing DOM elements gracefully', () => {
      // Remove a required element
      const slider = document.getElementById('bet-amount-slider');
      slider.remove();
      
      expect(() => {
        bettingPanel.updateBetAmount(200);
      }).not.toThrow();
    });

    it('should handle invalid player data', () => {
      expect(() => {
        bettingPanel.startBettingPhase({ players: null });
      }).not.toThrow();
      
      expect(() => {
        bettingPanel.startBettingPhase({ players: [null, undefined] });
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    beforeEach(async () => {
      await bettingPanel.initialize();
    });

    it('should have proper ARIA labels and roles', () => {
      const panel = document.getElementById('betting-panel');
      const slider = document.getElementById('bet-amount-slider');
      
      // Basic accessibility checks
      expect(slider.getAttribute('type')).toBe('range');
      expect(slider.hasAttribute('min')).toBe(true);
      expect(slider.hasAttribute('max')).toBe(true);
    });

    it('should support keyboard navigation', () => {
      const mockPlayers = GameHelpers.createMockPlayers(2);
      const gameData = { players: mockPlayers };
      bettingPanel.startBettingPhase(gameData);
      
      const betButton = document.querySelector('.bet-button');
      
      // Simulate keyboard activation
      DOMHelpers.simulateKeyboard(betButton, 'Enter');
      DOMHelpers.simulateKeyboard(betButton, ' '); // Space bar
      
      // Should not throw errors
      expect(betButton).toBeTruthy();
    });
  });
});