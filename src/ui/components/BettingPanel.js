/**
 * BettingPanel.js - Betting Interface Component
 * 
 * Handles the 30-second betting phase with countdown timer, player odds display,
 * bet placement functionality, and current bet tracking.
 */

export class BettingPanel {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.isVisible = false;
        this.isBettingActive = false;
        this.countdownTimer = null;
        this.timeRemaining = 30; // 30 seconds betting phase
        
        // Betting state
        this.players = [];
        this.currentBet = null;
        this.betAmount = 100; // Default bet amount
        this.playerOdds = new Map();
        this.totalBets = new Map();
        this.userBalance = 1000; // Starting balance
        
        console.log('[BettingPanel] Betting panel initialized');
    }

    /**
     * Initialize the betting panel
     */
    async initialize() {
        this.createPanelContent();
        this.setupEventListeners();
        console.log('[BettingPanel] Panel initialized');
    }

    /**
     * Create betting panel content structure
     */
    createPanelContent() {
        const panel = document.getElementById('betting-panel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="panel-header">
                <div class="panel-title">
                    <span class="title-text">BETTING PHASE</span>
                    <div class="countdown-timer" id="betting-countdown">
                        <span class="timer-text">TIME: 30s</span>
                    </div>
                </div>
            </div>
            
            <div class="panel-body betting-content">
                <div class="betting-status" id="betting-status">
                    <div class="balance-display">
                        <span class="label">BALANCE:</span>
                        <span class="value" id="user-balance">$1000</span>
                    </div>
                    <div class="current-bet-display" id="current-bet-display">
                        <span class="label">CURRENT BET:</span>
                        <span class="value" id="current-bet-text">NONE</span>
                    </div>
                </div>
                
                <div class="players-grid" id="players-grid">
                    <!-- Player betting cards will be dynamically generated -->
                </div>
                
                <div class="betting-controls">
                    <div class="bet-amount-section">
                        <label for="bet-amount-slider">BET AMOUNT: $<span id="bet-amount-value">100</span></label>
                        <div class="slider-container">
                            <input type="range" id="bet-amount-slider" min="10" max="500" value="100" step="10">
                            <div class="slider-presets">
                                <button class="preset-btn" data-amount="50">$50</button>
                                <button class="preset-btn" data-amount="100">$100</button>
                                <button class="preset-btn" data-amount="250">$250</button>
                                <button class="preset-btn" data-amount="500">$500</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bet-actions">
                        <button class="action-btn clear-bet-btn" id="clear-bet-btn" disabled>
                            <span class="btn-icon">🚫</span>
                            CLEAR BET
                        </button>
                        <button class="action-btn all-in-btn" id="all-in-btn">
                            <span class="btn-icon">💰</span>
                            ALL IN
                        </button>
                    </div>
                </div>
                
                <div class="betting-stats" id="betting-stats">
                    <div class="stats-row">
                        <span class="stat-label">TOTAL POOL:</span>
                        <span class="stat-value" id="total-pool">$0</span>
                    </div>
                    <div class="stats-row">
                        <span class="stat-label">YOUR POTENTIAL WIN:</span>
                        <span class="stat-value" id="potential-win">$0</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Setup event listeners for betting interactions
     */
    setupEventListeners() {
        // Bet amount slider
        const betSlider = document.getElementById('bet-amount-slider');
        if (betSlider) {
            betSlider.addEventListener('input', (e) => {
                this.updateBetAmount(parseInt(e.target.value));
            });
        }

        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const amount = parseInt(e.target.dataset.amount);
                this.updateBetAmount(amount);
            });
        });

        // Clear bet button
        const clearBetBtn = document.getElementById('clear-bet-btn');
        if (clearBetBtn) {
            clearBetBtn.addEventListener('click', () => this.clearBet());
        }

        // All in button
        const allInBtn = document.getElementById('all-in-btn');
        if (allInBtn) {
            allInBtn.addEventListener('click', () => this.allIn());
        }
    }

    /**
     * Start betting phase with countdown
     */
    startBettingPhase(gameData) {
        this.players = gameData.players || [];
        this.timeRemaining = gameData.bettingTime || 30;
        this.isBettingActive = true;
        
        // Calculate initial odds
        this.calculateOdds();
        
        // Update players grid
        this.updatePlayersGrid();
        
        // Start countdown
        this.startCountdown();
        
        // Show the panel
        this.show();
        
        console.log('[BettingPanel] Betting phase started');
    }

    /**
     * End betting phase
     */
    endBettingPhase() {
        this.isBettingActive = false;
        this.stopCountdown();
        
        // Disable all betting controls
        this.disableBettingControls();
        
        console.log('[BettingPanel] Betting phase ended');
    }

    /**
     * Show betting panel
     */
    show() {
        const panel = document.getElementById('betting-panel');
        if (panel) {
            panel.classList.remove('hidden');
            this.isVisible = true;
        }
    }

    /**
     * Hide betting panel
     */
    hide() {
        const panel = document.getElementById('betting-panel');
        if (panel) {
            panel.classList.add('hidden');
            this.isVisible = false;
        }
    }

    /**
     * Toggle panel visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Get the DOM element for this component
     * Required for AnimationManager integration
     */
    getElement() {
        return document.getElementById('betting-panel');
    }

    /**
     * Start countdown timer
     */
    startCountdown() {
        this.stopCountdown(); // Clear any existing timer
        
        this.countdownTimer = setInterval(() => {
            this.timeRemaining -= 1;
            this.updateCountdownDisplay();
            
            if (this.timeRemaining <= 0) {
                this.endBettingPhase();
            }
        }, 1000);
    }

    /**
     * Stop countdown timer
     */
    stopCountdown() {
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }
    }

    /**
     * Update countdown display
     */
    updateCountdownDisplay() {
        const countdownElement = document.getElementById('betting-countdown');
        if (countdownElement) {
            const timerText = countdownElement.querySelector('.timer-text');
            if (timerText) {
                timerText.textContent = `TIME: ${this.timeRemaining}s`;
                
                // Add urgency styling
                if (this.timeRemaining <= 10) {
                    countdownElement.classList.add('urgent');
                } else if (this.timeRemaining <= 20) {
                    countdownElement.classList.add('warning');
                }
            }
        }
    }

    /**
     * Update players grid with betting options
     */
    updatePlayersGrid() {
        const grid = document.getElementById('players-grid');
        if (!grid) return;

        grid.innerHTML = '';

        this.players.forEach((player, index) => {
            const playerCard = this.createPlayerCard(player, index);
            grid.appendChild(playerCard);
        });
    }

    /**
     * Create player betting card
     */
    createPlayerCard(player, index) {
        const card = document.createElement('div');
        card.className = 'player-card';
        card.dataset.playerId = player.id || `player-${index}`;
        
        const odds = this.playerOdds.get(player.id) || this.calculatePlayerOdds(player);
        const totalBets = this.totalBets.get(player.id) || 0;
        const isSelected = this.currentBet && this.currentBet.playerId === player.id;
        
        if (isSelected) {
            card.classList.add('selected');
        }

        card.innerHTML = `
            <div class="player-info">
                <div class="player-avatar">
                    <span class="avatar-text">${(player.name || player.username || `P${index + 1}`).charAt(0).toUpperCase()}</span>
                </div>
                <div class="player-details">
                    <div class="player-name">${player.name || player.username || `Player ${index + 1}`}</div>
                    <div class="player-stats">
                        <span class="stat">Wins: ${player.wins || 0}</span>
                        <span class="stat">Rate: ${player.winRate || 0}%</span>
                    </div>
                </div>
            </div>
            
            <div class="betting-info">
                <div class="odds-display">
                    <span class="odds-label">ODDS</span>
                    <span class="odds-value">${odds.toFixed(2)}:1</span>
                </div>
                <div class="pool-display">
                    <span class="pool-label">POOL</span>
                    <span class="pool-value">$${totalBets}</span>
                </div>
            </div>
            
            <button class="bet-button" ${!this.isBettingActive ? 'disabled' : ''}>
                ${isSelected ? 'SELECTED' : 'BET ON'}
            </button>
        `;

        // Add click handler for betting
        const betButton = card.querySelector('.bet-button');
        if (betButton && this.isBettingActive) {
            betButton.addEventListener('click', () => {
                this.placeBet(player.id || `player-${index}`, player.name || `Player ${index + 1}`);
            });
        }

        return card;
    }

    /**
     * Calculate odds for all players
     */
    calculateOdds() {
        this.players.forEach(player => {
            const odds = this.calculatePlayerOdds(player);
            this.playerOdds.set(player.id, odds);
        });
    }

    /**
     * Calculate odds for a specific player
     */
    calculatePlayerOdds(player) {
        // Base odds calculation on win rate and total pool
        const baseWinRate = Math.max(player.winRate || 20, 5); // Minimum 5% chance
        const totalPool = Array.from(this.totalBets.values()).reduce((sum, amount) => sum + amount, 0);
        const playerPool = this.totalBets.get(player.id) || 0;
        
        // Basic odds calculation (simplified)
        let odds = (100 - baseWinRate) / baseWinRate;
        
        // Adjust based on betting pool (more bets = lower odds)
        if (totalPool > 0) {
            const poolRatio = playerPool / totalPool;
            odds *= (1 - poolRatio * 0.5); // Reduce odds if this player has lots of bets
        }
        
        return Math.max(odds, 1.1); // Minimum odds of 1.1:1
    }

    /**
     * Place bet on a player
     */
    placeBet(playerId, playerName) {
        if (!this.isBettingActive) {
            this.showNotification('Betting phase has ended!', 'error');
            return;
        }

        if (this.betAmount > this.userBalance) {
            this.showNotification('Insufficient balance!', 'error');
            return;
        }

        // Clear previous bet if exists
        if (this.currentBet) {
            this.clearBet();
        }

        // Place new bet
        this.currentBet = {
            playerId,
            playerName,
            amount: this.betAmount,
            odds: this.playerOdds.get(playerId) || 2.0,
            timestamp: Date.now()
        };

        // Update user balance
        this.userBalance -= this.betAmount;

        // Update total bets
        const currentTotal = this.totalBets.get(playerId) || 0;
        this.totalBets.set(playerId, currentTotal + this.betAmount);

        // Recalculate odds
        this.calculateOdds();

        // Update UI
        this.updateCurrentBetDisplay();
        this.updateUserBalanceDisplay();
        this.updatePlayersGrid();
        this.updateBettingStats();

        // Enable clear bet button
        const clearBtn = document.getElementById('clear-bet-btn');
        if (clearBtn) clearBtn.disabled = false;

        this.showNotification(`Bet placed on ${playerName}!`, 'success');
        console.log('[BettingPanel] Bet placed:', this.currentBet);
    }

    /**
     * Clear current bet
     */
    clearBet() {
        if (!this.currentBet) return;

        // Refund bet amount
        this.userBalance += this.currentBet.amount;

        // Update total bets
        const currentTotal = this.totalBets.get(this.currentBet.playerId) || 0;
        this.totalBets.set(this.currentBet.playerId, Math.max(0, currentTotal - this.currentBet.amount));

        // Clear bet
        this.currentBet = null;

        // Recalculate odds
        this.calculateOdds();

        // Update UI
        this.updateCurrentBetDisplay();
        this.updateUserBalanceDisplay();
        this.updatePlayersGrid();
        this.updateBettingStats();

        // Disable clear bet button
        const clearBtn = document.getElementById('clear-bet-btn');
        if (clearBtn) clearBtn.disabled = true;

        this.showNotification('Bet cleared!', 'info');
    }

    /**
     * All in bet
     */
    allIn() {
        if (!this.isBettingActive) {
            this.showNotification('Betting phase has ended!', 'error');
            return;
        }

        if (this.userBalance <= 0) {
            this.showNotification('No balance remaining!', 'error');
            return;
        }

        // Set bet amount to all remaining balance
        this.updateBetAmount(this.userBalance);
        this.showNotification('All in! Select a player to bet on.', 'info');
    }

    /**
     * Update bet amount
     */
    updateBetAmount(amount) {
        this.betAmount = Math.min(amount, this.userBalance);
        
        // Update slider
        const slider = document.getElementById('bet-amount-slider');
        if (slider) {
            slider.value = this.betAmount;
            slider.max = this.userBalance;
        }

        // Update display
        const valueDisplay = document.getElementById('bet-amount-value');
        if (valueDisplay) {
            valueDisplay.textContent = this.betAmount;
        }

        // Update potential win
        this.updateBettingStats();
    }

    /**
     * Update current bet display
     */
    updateCurrentBetDisplay() {
        const display = document.getElementById('current-bet-text');
        if (!display) return;

        if (this.currentBet) {
            display.textContent = `$${this.currentBet.amount} on ${this.currentBet.playerName}`;
            display.classList.add('has-bet');
        } else {
            display.textContent = 'NONE';
            display.classList.remove('has-bet');
        }
    }

    /**
     * Update user balance display
     */
    updateUserBalanceDisplay() {
        const balanceDisplay = document.getElementById('user-balance');
        if (balanceDisplay) {
            balanceDisplay.textContent = `$${this.userBalance}`;
            
            // Add styling based on balance
            balanceDisplay.classList.remove('low-balance', 'no-balance');
            if (this.userBalance <= 0) {
                balanceDisplay.classList.add('no-balance');
            } else if (this.userBalance <= 100) {
                balanceDisplay.classList.add('low-balance');
            }
        }
    }

    /**
     * Update betting statistics
     */
    updateBettingStats() {
        // Total pool
        const totalPool = Array.from(this.totalBets.values()).reduce((sum, amount) => sum + amount, 0);
        const totalPoolDisplay = document.getElementById('total-pool');
        if (totalPoolDisplay) {
            totalPoolDisplay.textContent = `$${totalPool}`;
        }

        // Potential win
        const potentialWinDisplay = document.getElementById('potential-win');
        if (potentialWinDisplay) {
            if (this.currentBet) {
                const potentialWin = Math.floor(this.currentBet.amount * this.currentBet.odds);
                potentialWinDisplay.textContent = `$${potentialWin}`;
                potentialWinDisplay.classList.add('has-potential');
            } else {
                potentialWinDisplay.textContent = '$0';
                potentialWinDisplay.classList.remove('has-potential');
            }
        }
    }

    /**
     * Disable betting controls when phase ends
     */
    disableBettingControls() {
        // Disable all buttons
        document.querySelectorAll('.bet-button').forEach(btn => {
            btn.disabled = true;
        });

        document.getElementById('clear-bet-btn')?.setAttribute('disabled', 'true');
        document.getElementById('all-in-btn')?.setAttribute('disabled', 'true');
        document.getElementById('bet-amount-slider')?.setAttribute('disabled', 'true');

        // Update countdown display
        const countdownElement = document.getElementById('betting-countdown');
        if (countdownElement) {
            const timerText = countdownElement.querySelector('.timer-text');
            if (timerText) {
                timerText.textContent = 'BETTING CLOSED';
            }
        }
    }

    /**
     * Process race results and determine winnings
     */
    processRaceResults(results) {
        if (!this.currentBet || !results || !results.length) return;

        const winnerData = results[0]; // First place winner
        const winnerId = winnerData.playerId || winnerData.id;

        if (winnerId === this.currentBet.playerId) {
            // User won!
            const winnings = Math.floor(this.currentBet.amount * this.currentBet.odds);
            this.userBalance += winnings;
            
            this.showNotification(`🎉 You won $${winnings}!`, 'success');
            console.log('[BettingPanel] User won bet:', { bet: this.currentBet, winnings });
        } else {
            // User lost
            this.showNotification(`😞 Better luck next time!`, 'error');
            console.log('[BettingPanel] User lost bet:', this.currentBet);
        }

        // Clear the bet
        this.currentBet = null;
        this.updateCurrentBetDisplay();
        this.updateUserBalanceDisplay();
    }

    /**
     * Show notification message
     */
    showNotification(message, type = 'info') {
        // Create or update notification element
        let notification = document.getElementById('betting-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'betting-notification';
            notification.className = 'notification';
            document.getElementById('betting-panel').appendChild(notification);
        }
        
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    /**
     * Get current betting state
     */
    getBettingState() {
        return {
            isActive: this.isBettingActive,
            timeRemaining: this.timeRemaining,
            currentBet: this.currentBet,
            userBalance: this.userBalance,
            totalPool: Array.from(this.totalBets.values()).reduce((sum, amount) => sum + amount, 0)
        };
    }

    /**
     * Destroy the betting panel
     */
    destroy() {
        this.stopCountdown();
        this.currentBet = null;
        console.log('[BettingPanel] Panel destroyed');
    }
}