/**
 * LeaderboardPanel.js - Leaderboard Display Component
 * 
 * Shows player rankings with win rate, total score, and updates after each race.
 * Features dual-factor ranking based on consistency and volume scoring.
 */

export class LeaderboardPanel {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.isVisible = true; // Default visible
        this.players = [];
        this.raceHistory = [];
        this.sortBy = 'score'; // 'score', 'winRate', 'wins', 'races'
        this.sortOrder = 'desc'; // 'asc', 'desc'
        
        // Leaderboard configuration
        this.config = {
            maxDisplayPlayers: 10,
            updateInterval: 1000, // 1 second
            animationDuration: 500 // 0.5 seconds
        };
        
        console.log('[LeaderboardPanel] Leaderboard panel initialized');
    }

    /**
     * Initialize the leaderboard panel
     */
    async initialize() {
        this.createPanelContent();
        this.setupEventListeners();
        this.loadPlayerData();
        console.log('[LeaderboardPanel] Panel initialized');
    }

    /**
     * Create leaderboard panel content structure
     */
    createPanelContent() {
        const panel = document.getElementById('leaderboard-panel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="panel-header">
                <div class="panel-title">
                    <span class="title-text">LEADERBOARD</span>
                    <div class="panel-controls">
                        <button class="control-btn refresh-btn" id="refresh-leaderboard" title="Refresh">
                            🔄
                        </button>
                        <button class="control-btn toggle-btn" id="toggle-leaderboard" title="Toggle">
                            📊
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="panel-body leaderboard-content">
                <div class="leaderboard-filters">
                    <div class="sort-controls">
                        <label>SORT BY:</label>
                        <select id="sort-select">
                            <option value="score">Total Score</option>
                            <option value="winRate">Win Rate</option>
                            <option value="wins">Total Wins</option>
                            <option value="races">Races Played</option>
                        </select>
                        <button class="sort-order-btn" id="sort-order-btn" title="Toggle Sort Order">
                            ↓
                        </button>
                    </div>
                    
                    <div class="time-filter">
                        <label>PERIOD:</label>
                        <select id="time-filter">
                            <option value="all">All Time</option>
                            <option value="today">Today</option>
                            <option value="week">This Week</option>
                        </select>
                    </div>
                </div>
                
                <div class="leaderboard-table-container">
                    <div class="table-header">
                        <div class="rank-col">RANK</div>
                        <div class="player-col">PLAYER</div>
                        <div class="stats-col">STATS</div>
                        <div class="score-col">SCORE</div>
                    </div>
                    
                    <div class="table-body" id="leaderboard-table-body">
                        <!-- Player rows will be dynamically generated -->
                    </div>
                </div>
                
                <div class="leaderboard-summary" id="leaderboard-summary">
                    <div class="summary-item">
                        <span class="label">TOTAL PLAYERS:</span>
                        <span class="value" id="total-players">0</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">TOTAL RACES:</span>
                        <span class="value" id="total-races">0</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">LAST UPDATED:</span>
                        <span class="value" id="last-updated">Never</span>
                    </div>
                </div>
                
                <div class="recent-winners" id="recent-winners">
                    <div class="section-header">RECENT WINNERS</div>
                    <div class="winners-list" id="winners-list">
                        <!-- Recent winners will be displayed here -->
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Setup event listeners for leaderboard interactions
     */
    setupEventListeners() {
        // Sort controls
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.setSortBy(e.target.value);
            });
        }

        const sortOrderBtn = document.getElementById('sort-order-btn');
        if (sortOrderBtn) {
            sortOrderBtn.addEventListener('click', () => {
                this.toggleSortOrder();
            });
        }

        // Time filter
        const timeFilter = document.getElementById('time-filter');
        if (timeFilter) {
            timeFilter.addEventListener('change', (e) => {
                this.setTimeFilter(e.target.value);
            });
        }

        // Refresh button
        const refreshBtn = document.getElementById('refresh-leaderboard');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshLeaderboard();
            });
        }

        // Toggle button
        const toggleBtn = document.getElementById('toggle-leaderboard');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.toggle();
            });
        }
    }

    /**
     * Load initial player data
     */
    loadPlayerData() {
        // Load from localStorage or initialize empty
        const savedData = localStorage.getItem('memex-leaderboard');
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                this.players = data.players || [];
                this.raceHistory = data.raceHistory || [];
            } catch (error) {
                console.error('[LeaderboardPanel] Failed to load saved data:', error);
                this.initializeDefaultData();
            }
        } else {
            this.initializeDefaultData();
        }
        
        this.updateLeaderboard();
    }

    /**
     * Initialize with default/demo data
     */
    initializeDefaultData() {
        this.players = [
            {
                id: 'demo-1',
                name: 'SpeedDemon',
                wins: 25,
                races: 50,
                score: 2500,
                winRate: 50,
                lastActive: Date.now(),
                avatar: '🏎️'
            },
            {
                id: 'demo-2',
                name: 'RacingPro',
                wins: 18,
                races: 30,
                score: 2160,
                winRate: 60,
                lastActive: Date.now() - 3600000,
                avatar: '🏁'
            },
            {
                id: 'demo-3',
                name: 'FastAndFurious',
                wins: 22,
                races: 40,
                score: 2000,
                winRate: 55,
                lastActive: Date.now() - 7200000,
                avatar: '⚡'
            }
        ];
        
        this.raceHistory = [];
    }

    /**
     * Show leaderboard panel
     */
    show() {
        const panel = document.getElementById('leaderboard-panel');
        if (panel) {
            panel.classList.remove('hidden');
            this.isVisible = true;
        }
    }

    /**
     * Hide leaderboard panel
     */
    hide() {
        const panel = document.getElementById('leaderboard-panel');
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
        return document.getElementById('leaderboard-panel');
    }

    /**
     * Update player list from multiplayer events
     */
    updatePlayerList(players) {
        // Merge with existing player data
        players.forEach(newPlayer => {
            const existingIndex = this.players.findIndex(p => p.id === newPlayer.id);
            if (existingIndex >= 0) {
                // Update existing player
                this.players[existingIndex] = {
                    ...this.players[existingIndex],
                    ...newPlayer,
                    lastActive: Date.now()
                };
            } else {
                // Add new player
                this.players.push({
                    id: newPlayer.id,
                    name: newPlayer.name || newPlayer.username || 'Unknown',
                    wins: newPlayer.wins || 0,
                    races: newPlayer.races || 0,
                    score: newPlayer.score || 0,
                    winRate: newPlayer.winRate || 0,
                    lastActive: Date.now(),
                    avatar: newPlayer.avatar || '🏎️'
                });
            }
        });
        
        this.updateLeaderboard();
        this.saveData();
    }

    /**
     * Update leaderboard with race results
     */
    updateResults(raceResults) {
        if (!raceResults || !Array.isArray(raceResults)) return;
        
        // Record race in history
        const raceRecord = {
            timestamp: Date.now(),
            results: raceResults,
            raceId: Date.now().toString()
        };
        
        this.raceHistory.unshift(raceRecord);
        
        // Keep only last 100 races
        if (this.raceHistory.length > 100) {
            this.raceHistory = this.raceHistory.slice(0, 100);
        }
        
        // Update player statistics
        raceResults.forEach((result, position) => {
            const playerId = result.playerId || result.id;
            const player = this.players.find(p => p.id === playerId);
            
            if (player) {
                player.races = (player.races || 0) + 1;
                
                if (position === 0) { // Winner
                    player.wins = (player.wins || 0) + 1;
                    player.score = (player.score || 0) + this.calculateWinPoints(position, raceResults.length);
                } else {
                    // Participation points
                    player.score = (player.score || 0) + this.calculateParticipationPoints(position, raceResults.length);
                }
                
                // Recalculate win rate
                player.winRate = Math.round((player.wins / player.races) * 100);
                player.lastActive = Date.now();
            }
        });
        
        // Update display
        this.updateLeaderboard();
        this.updateRecentWinners();
        this.saveData();
        
        console.log('[LeaderboardPanel] Results updated:', raceResults);
    }

    /**
     * Calculate points for winning
     */
    calculateWinPoints(position, totalPlayers) {
        const basePoints = 100;
        const positionMultiplier = (totalPlayers - position) / totalPlayers;
        const playerCountBonus = Math.min(totalPlayers * 10, 50);
        
        return Math.floor(basePoints * positionMultiplier + playerCountBonus);
    }

    /**
     * Calculate points for participation
     */
    calculateParticipationPoints(position, totalPlayers) {
        const basePoints = 20;
        const positionMultiplier = Math.max(0.1, (totalPlayers - position) / totalPlayers);
        
        return Math.floor(basePoints * positionMultiplier);
    }

    /**
     * Update leaderboard display
     */
    updateLeaderboard() {
        const sortedPlayers = this.getSortedPlayers();
        this.renderPlayerRows(sortedPlayers);
        this.updateSummary();
        this.updateLastUpdated();
    }

    /**
     * Get sorted players based on current sort settings
     */
    getSortedPlayers() {
        const sorted = [...this.players].sort((a, b) => {
            let valueA = a[this.sortBy] || 0;
            let valueB = b[this.sortBy] || 0;
            
            // Special handling for different sort types
            if (this.sortBy === 'winRate' && a.races === 0) valueA = 0;
            if (this.sortBy === 'winRate' && b.races === 0) valueB = 0;
            
            if (this.sortOrder === 'desc') {
                return valueB - valueA;
            } else {
                return valueA - valueB;
            }
        });
        
        return sorted.slice(0, this.config.maxDisplayPlayers);
    }

    /**
     * Render player rows in the leaderboard table
     */
    renderPlayerRows(players) {
        const tableBody = document.getElementById('leaderboard-table-body');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        players.forEach((player, index) => {
            const row = this.createPlayerRow(player, index + 1);
            tableBody.appendChild(row);
        });
        
        // Add animation class
        tableBody.classList.add('updating');
        setTimeout(() => {
            tableBody.classList.remove('updating');
        }, this.config.animationDuration);
    }

    /**
     * Create a player row element
     */
    createPlayerRow(player, rank) {
        const row = document.createElement('div');
        row.className = 'player-row';
        row.dataset.playerId = player.id;
        
        // Add rank styling
        if (rank === 1) row.classList.add('rank-1');
        else if (rank === 2) row.classList.add('rank-2');
        else if (rank === 3) row.classList.add('rank-3');
        
        // Calculate time since last active
        const timeSinceActive = this.getTimeSinceActive(player.lastActive);
        const isOnline = timeSinceActive < 300000; // 5 minutes
        
        row.innerHTML = `
            <div class="rank-col">
                <span class="rank-number">${rank}</span>
                ${rank <= 3 ? `<span class="rank-medal">${this.getRankMedal(rank)}</span>` : ''}
            </div>
            
            <div class="player-col">
                <div class="player-info">
                    <span class="player-avatar">${player.avatar || '🏎️'}</span>
                    <div class="player-details">
                        <span class="player-name">${player.name}</span>
                        <span class="player-status ${isOnline ? 'online' : 'offline'}">
                            ${isOnline ? '🟢 Online' : '🔴 Offline'}
                        </span>
                    </div>
                </div>
            </div>
            
            <div class="stats-col">
                <div class="stat-item">
                    <span class="stat-label">W/R:</span>
                    <span class="stat-value win-rate">${player.winRate || 0}%</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Races:</span>
                    <span class="stat-value">${player.races || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Wins:</span>
                    <span class="stat-value wins">${player.wins || 0}</span>
                </div>
            </div>
            
            <div class="score-col">
                <span class="score-value">${player.score || 0}</span>
                <span class="score-label">pts</span>
            </div>
        `;
        
        return row;
    }

    /**
     * Get rank medal emoji
     */
    getRankMedal(rank) {
        switch (rank) {
            case 1: return '🥇';
            case 2: return '🥈';
            case 3: return '🥉';
            default: return '';
        }
    }

    /**
     * Get time since last active in a readable format
     */
    getTimeSinceActive(lastActive) {
        return Date.now() - (lastActive || 0);
    }

    /**
     * Update leaderboard summary statistics
     */
    updateSummary() {
        const totalPlayersEl = document.getElementById('total-players');
        const totalRacesEl = document.getElementById('total-races');
        
        if (totalPlayersEl) {
            totalPlayersEl.textContent = this.players.length;
        }
        
        if (totalRacesEl) {
            totalRacesEl.textContent = this.raceHistory.length;
        }
    }

    /**
     * Update recent winners display
     */
    updateRecentWinners() {
        const winnersListEl = document.getElementById('winners-list');
        if (!winnersListEl) return;
        
        winnersListEl.innerHTML = '';
        
        const recentRaces = this.raceHistory.slice(0, 5);
        
        recentRaces.forEach(race => {
            if (race.results && race.results.length > 0) {
                const winner = race.results[0];
                const player = this.players.find(p => p.id === (winner.playerId || winner.id));
                
                if (player) {
                    const winnerEl = document.createElement('div');
                    winnerEl.className = 'winner-item';
                    winnerEl.innerHTML = `
                        <span class="winner-avatar">${player.avatar || '🏎️'}</span>
                        <span class="winner-name">${player.name}</span>
                        <span class="winner-time">${this.formatTimestamp(race.timestamp)}</span>
                    `;
                    winnersListEl.appendChild(winnerEl);
                }
            }
        });
        
        if (recentRaces.length === 0) {
            winnersListEl.innerHTML = '<div class="no-winners">No recent races</div>';
        }
    }

    /**
     * Format timestamp for display
     */
    formatTimestamp(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    }

    /**
     * Update last updated timestamp
     */
    updateLastUpdated() {
        const lastUpdatedEl = document.getElementById('last-updated');
        if (lastUpdatedEl) {
            lastUpdatedEl.textContent = new Date().toLocaleTimeString();
        }
    }

    /**
     * Set sort criteria
     */
    setSortBy(sortBy) {
        this.sortBy = sortBy;
        this.updateLeaderboard();
        console.log('[LeaderboardPanel] Sort by:', sortBy);
    }

    /**
     * Toggle sort order
     */
    toggleSortOrder() {
        this.sortOrder = this.sortOrder === 'desc' ? 'asc' : 'desc';
        
        const sortOrderBtn = document.getElementById('sort-order-btn');
        if (sortOrderBtn) {
            sortOrderBtn.textContent = this.sortOrder === 'desc' ? '↓' : '↑';
            sortOrderBtn.title = `Sort ${this.sortOrder === 'desc' ? 'Descending' : 'Ascending'}`;
        }
        
        this.updateLeaderboard();
    }

    /**
     * Set time filter
     */
    setTimeFilter(timeFilter) {
        // Implementation for filtering by time period
        // For now, just log the change
        console.log('[LeaderboardPanel] Time filter:', timeFilter);
    }

    /**
     * Refresh leaderboard data
     */
    refreshLeaderboard() {
        this.updateLeaderboard();
        this.showNotification('Leaderboard refreshed!', 'success');
    }

    /**
     * Save leaderboard data to localStorage
     */
    saveData() {
        try {
            const data = {
                players: this.players,
                raceHistory: this.raceHistory,
                lastSaved: Date.now()
            };
            
            localStorage.setItem('memex-leaderboard', JSON.stringify(data));
        } catch (error) {
            console.error('[LeaderboardPanel] Failed to save data:', error);
        }
    }

    /**
     * Show notification message
     */
    showNotification(message, type = 'info') {
        // Create or update notification element
        let notification = document.getElementById('leaderboard-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'leaderboard-notification';
            notification.className = 'notification';
            document.getElementById('leaderboard-panel').appendChild(notification);
        }
        
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    /**
     * Get current leaderboard state
     */
    getLeaderboardState() {
        return {
            players: this.players,
            raceHistory: this.raceHistory,
            sortBy: this.sortBy,
            sortOrder: this.sortOrder,
            totalPlayers: this.players.length,
            totalRaces: this.raceHistory.length
        };
    }

    /**
     * Destroy the leaderboard panel
     */
    destroy() {
        this.saveData();
        console.log('[LeaderboardPanel] Panel destroyed');
    }
}