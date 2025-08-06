/**
 * TournamentResults.js - Tournament Results and Statistics Component
 * 
 * Final standings display, match history viewer, player statistics,
 * prize distribution, export/share functionality, and tournament recap.
 */

export class TournamentResults {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.isVisible = false;
        this.currentTournament = null;
        this.currentView = 'standings'; // standings, history, statistics, prizes
        
        // Results state
        this.finalStandings = [];
        this.matchHistory = [];
        this.playerStats = new Map();
        this.prizeDistribution = [];
        
        // Export options
        this.exportFormats = ['json', 'csv', 'pdf'];
        
        console.log('[TournamentResults] Tournament results component initialized');
    }

    /**
     * Initialize the tournament results panel
     */
    async initialize() {
        this.createPanelContent();
        this.setupEventListeners();
        console.log('[TournamentResults] Panel initialized');
    }

    /**
     * Create tournament results panel content structure
     */
    createPanelContent() {
        const panel = document.getElementById('tournament-results-panel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="tournament-results-overlay">
                <div class="tournament-results-modal">
                    <div class="panel-header">
                        <div class="panel-title">
                            <span class="title-text pixel-text">TOURNAMENT RESULTS</span>
                            <div class="results-nav">
                                <button class="nav-btn active" data-view="standings">
                                    <span class="nav-icon">🏆</span>
                                    STANDINGS
                                </button>
                                <button class="nav-btn" data-view="history">
                                    <span class="nav-icon">📜</span>
                                    HISTORY
                                </button>
                                <button class="nav-btn" data-view="statistics">
                                    <span class="nav-icon">📊</span>
                                    STATS
                                </button>
                                <button class="nav-btn" data-view="prizes">
                                    <span class="nav-icon">💰</span>
                                    PRIZES
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="panel-body results-content">
                        <!-- Tournament Summary -->
                        <div class="tournament-summary" id="tournament-summary">
                            <div class="summary-main">
                                <h2 class="tournament-title" id="tournament-title">Tournament Results</h2>
                                <div class="tournament-info-grid">
                                    <div class="info-item">
                                        <span class="info-label">FORMAT:</span>
                                        <span class="info-value" id="tournament-format">-</span>
                                    </div>
                                    <div class="info-item">
                                        <span class="info-label">DURATION:</span>
                                        <span class="info-value" id="tournament-duration">-</span>
                                    </div>
                                    <div class="info-item">
                                        <span class="info-label">PARTICIPANTS:</span>
                                        <span class="info-value" id="tournament-participants">-</span>
                                    </div>
                                    <div class="info-item">
                                        <span class="info-label">MATCHES:</span>
                                        <span class="info-value" id="tournament-matches">-</span>
                                    </div>
                                </div>
                            </div>
                            <div class="winner-spotlight" id="winner-spotlight">
                                <!-- Winner info will be populated -->
                            </div>
                        </div>
                        
                        <!-- Final Standings View -->
                        <div class="view-container standings-view" id="standings-view">
                            <div class="standings-section">
                                <div class="section-header">
                                    <h3 class="section-title">FINAL STANDINGS</h3>
                                    <div class="standings-controls">
                                        <button class="control-btn sort-btn" id="sort-by-rank" data-sort="rank">
                                            <span class="btn-icon">🏅</span>
                                            RANK
                                        </button>
                                        <button class="control-btn sort-btn" id="sort-by-score" data-sort="score">
                                            <span class="btn-icon">⭐</span>
                                            SCORE
                                        </button>
                                    </div>
                                </div>
                                
                                <div class="standings-table-container">
                                    <table class="results-table" id="final-standings-table">
                                        <thead>
                                            <tr>
                                                <th class="rank-col">RANK</th>
                                                <th class="player-col">PLAYER</th>
                                                <th class="wins-col">WINS</th>
                                                <th class="losses-col">LOSSES</th>
                                                <th class="winrate-col">WIN%</th>
                                                <th class="score-col">SCORE</th>
                                                <th class="prize-col">PRIZE</th>
                                            </tr>
                                        </thead>
                                        <tbody id="standings-tbody">
                                            <!-- Standings rows will be generated -->
                                        </tbody>
                                    </table>
                                </div>
                                
                                <div class="podium-display" id="podium-display">
                                    <!-- Top 3 podium will be generated -->
                                </div>
                            </div>
                        </div>
                        
                        <!-- Match History View -->
                        <div class="view-container history-view hidden" id="history-view">
                            <div class="history-section">
                                <div class="section-header">
                                    <h3 class="section-title">MATCH HISTORY</h3>
                                    <div class="history-controls">
                                        <select class="filter-select" id="round-filter">
                                            <option value="">ALL ROUNDS</option>
                                        </select>
                                        <select class="filter-select" id="player-filter">
                                            <option value="">ALL PLAYERS</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div class="matches-timeline" id="matches-timeline">
                                    <!-- Match history timeline will be generated -->
                                </div>
                            </div>
                        </div>
                        
                        <!-- Statistics View -->
                        <div class="view-container statistics-view hidden" id="statistics-view">
                            <div class="statistics-section">
                                <div class="section-header">
                                    <h3 class="section-title">TOURNAMENT STATISTICS</h3>
                                </div>
                                
                                <div class="stats-grid">
                                    <div class="stats-card" id="general-stats">
                                        <h4 class="stats-card-title">GENERAL</h4>
                                        <div class="stats-list" id="general-stats-list">
                                            <!-- General stats will be populated -->
                                        </div>
                                    </div>
                                    
                                    <div class="stats-card" id="player-records">
                                        <h4 class="stats-card-title">RECORDS</h4>
                                        <div class="stats-list" id="records-stats-list">
                                            <!-- Record stats will be populated -->
                                        </div>
                                    </div>
                                    
                                    <div class="stats-card" id="performance-stats">
                                        <h4 class="stats-card-title">PERFORMANCE</h4>
                                        <div class="stats-list" id="performance-stats-list">
                                            <!-- Performance stats will be populated -->
                                        </div>
                                    </div>
                                    
                                    <div class="stats-card" id="betting-stats">
                                        <h4 class="stats-card-title">BETTING</h4>
                                        <div class="stats-list" id="betting-stats-list">
                                            <!-- Betting stats will be populated -->
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="player-performance-chart" id="player-performance-chart">
                                    <h4 class="chart-title">PLAYER PERFORMANCE COMPARISON</h4>
                                    <div class="chart-container" id="performance-chart-container">
                                        <!-- Performance chart will be rendered -->
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Prize Distribution View -->
                        <div class="view-container prizes-view hidden" id="prizes-view">
                            <div class="prizes-section">
                                <div class="section-header">
                                    <h3 class="section-title">PRIZE DISTRIBUTION</h3>
                                    <div class="total-pool" id="total-prize-pool">
                                        TOTAL POOL: $0
                                    </div>
                                </div>
                                
                                <div class="prize-breakdown" id="prize-breakdown">
                                    <!-- Prize breakdown will be generated -->
                                </div>
                                
                                <div class="prize-distribution-chart" id="prize-distribution-chart">
                                    <h4 class="chart-title">PRIZE DISTRIBUTION</h4>
                                    <div class="chart-container" id="prize-chart-container">
                                        <!-- Prize distribution chart -->
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="panel-footer">
                        <div class="footer-actions">
                            <div class="export-section">
                                <label for="export-format">EXPORT:</label>
                                <select id="export-format" class="export-select">
                                    <option value="json">JSON</option>
                                    <option value="csv">CSV</option>
                                    <option value="pdf">PDF</option>
                                </select>
                                <button class="action-btn export-btn" id="export-results-btn">
                                    <span class="btn-icon">💾</span>
                                    EXPORT
                                </button>
                            </div>
                            
                            <div class="share-section">
                                <button class="action-btn share-btn" id="share-results-btn">
                                    <span class="btn-icon">🔗</span>
                                    SHARE
                                </button>
                                <button class="action-btn print-btn" id="print-results-btn">
                                    <span class="btn-icon">🖨️</span>
                                    PRINT
                                </button>
                            </div>
                        </div>
                        
                        <button class="action-btn close-btn" id="close-results-btn">
                            <span class="btn-icon">✕</span>
                            CLOSE
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Setup event listeners for results interactions
     */
    setupEventListeners() {
        // Close button
        const closeBtn = document.getElementById('close-results-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        // Navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.closest('[data-view]').dataset.view;
                this.switchView(view);
            });
        });

        // Sort buttons
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sortBy = e.target.closest('[data-sort]').dataset.sort;
                this.sortStandings(sortBy);
            });
        });

        // Export/Share buttons
        const exportBtn = document.getElementById('export-results-btn');
        const shareBtn = document.getElementById('share-results-btn');
        const printBtn = document.getElementById('print-results-btn');

        if (exportBtn) exportBtn.addEventListener('click', () => this.exportResults());
        if (shareBtn) shareBtn.addEventListener('click', () => this.shareResults());
        if (printBtn) printBtn.addEventListener('click', () => this.printResults());

        // Filters
        const roundFilter = document.getElementById('round-filter');
        const playerFilter = document.getElementById('player-filter');

        if (roundFilter) roundFilter.addEventListener('change', () => this.applyHistoryFilters());
        if (playerFilter) playerFilter.addEventListener('change', () => this.applyHistoryFilters());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (!this.isVisible) return;
            
            switch(e.key) {
                case 'Escape':
                    this.hide();
                    break;
                case '1':
                    this.switchView('standings');
                    break;
                case '2':
                    this.switchView('history');
                    break;
                case '3':
                    this.switchView('statistics');
                    break;
                case '4':
                    this.switchView('prizes');
                    break;
            }
        });

        // Close on overlay click
        const overlay = document.querySelector('.tournament-results-overlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.hide();
                }
            });
        }
    }

    /**
     * Show tournament results panel
     */
    show() {
        const panel = document.getElementById('tournament-results-panel');
        if (panel) {
            panel.style.display = 'block';
            this.isVisible = true;
            
            // Load current tournament results if available
            this.loadCurrentResults();
            
            console.log('[TournamentResults] Panel shown');
        }
    }

    /**
     * Hide tournament results panel
     */
    hide() {
        const panel = document.getElementById('tournament-results-panel');
        if (panel) {
            panel.style.display = 'none';
            this.isVisible = false;
            console.log('[TournamentResults] Panel hidden');
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
        return document.getElementById('tournament-results-panel');
    }

    /**
     * Load and display tournament results
     */
    async loadCurrentResults() {
        try {
            // Get tournament results from tournament manager
            const tournamentManager = window.tournamentManager;
            if (tournamentManager) {
                // In real implementation, this would get completed tournament data
                // For demo, we'll create sample results
                this.createSampleResults();
            } else {
                this.createSampleResults();
            }
            
        } catch (error) {
            console.error('[TournamentResults] Error loading results:', error);
            this.showNoResults();
        }
    }

    /**
     * Create sample tournament results for demonstration
     */
    createSampleResults() {
        this.currentTournament = {
            tournamentId: 'completed-tournament',
            name: 'Memex Racing Championship Finals',
            format: 'single_elimination',
            status: 'completed',
            startedAt: Date.now() - 7200000, // 2 hours ago
            completedAt: Date.now() - 300000, // 5 minutes ago
            duration: 6900000, // 1h 55m
            totalParticipants: 16,
            totalMatches: 15,
            totalRounds: 4,
            prizePool: 2500,
            bettingEnabled: true
        };

        // Final standings
        this.finalStandings = [
            { rank: 1, playerId: '1', playerName: 'SpeedDemon', wins: 4, losses: 0, winRate: 100, score: 1000, prize: 1250, eliminated: false },
            { rank: 2, playerId: '2', playerName: 'RaceKing', wins: 3, losses: 1, winRate: 75, score: 750, prize: 750, eliminated: false },
            { rank: 3, playerId: '3', playerName: 'TurboMax', wins: 2, losses: 1, winRate: 67, score: 500, prize: 375, eliminated: false },
            { rank: 4, playerId: '4', playerName: 'VelocityX', wins: 2, losses: 1, winRate: 67, score: 500, prize: 125, eliminated: false },
            { rank: 5, playerId: '5', playerName: 'NitroBlast', wins: 1, losses: 1, winRate: 50, score: 250, prize: 0, eliminated: true },
            { rank: 6, playerId: '6', playerName: 'QuickShift', wins: 1, losses: 1, winRate: 50, score: 250, prize: 0, eliminated: true },
            { rank: 7, playerId: '7', playerName: 'ZoomMaster', wins: 1, losses: 1, winRate: 50, score: 250, prize: 0, eliminated: true },
            { rank: 8, playerId: '8', playerName: 'RushHour', wins: 1, losses: 1, winRate: 50, score: 250, prize: 0, eliminated: true },
            { rank: 9, playerId: '9', playerName: 'SpeedRunner', wins: 0, losses: 1, winRate: 0, score: 0, prize: 0, eliminated: true },
            { rank: 10, playerId: '10', playerName: 'FastTrack', wins: 0, losses: 1, winRate: 0, score: 0, prize: 0, eliminated: true },
            { rank: 11, playerId: '11', playerName: 'RaceMaster', wins: 0, losses: 1, winRate: 0, score: 0, prize: 0, eliminated: true },
            { rank: 12, playerId: '12', playerName: 'ThunderBolt', wins: 0, losses: 1, winRate: 0, score: 0, prize: 0, eliminated: true },
            { rank: 13, playerId: '13', playerName: 'Lightning', wins: 0, losses: 1, winRate: 0, score: 0, prize: 0, eliminated: true },
            { rank: 14, playerId: '14', playerName: 'Hurricane', wins: 0, losses: 1, winRate: 0, score: 0, prize: 0, eliminated: true },
            { rank: 15, playerId: '15', playerName: 'Tornado', wins: 0, losses: 1, winRate: 0, score: 0, prize: 0, eliminated: true },
            { rank: 16, playerId: '16', playerName: 'Cyclone', wins: 0, losses: 1, winRate: 0, score: 0, prize: 0, eliminated: true }
        ];

        // Match history
        this.matchHistory = [
            { matchId: '1-1', round: 1, players: ['SpeedDemon', 'Cyclone'], winner: 'SpeedDemon', duration: 285000, timestamp: Date.now() - 6600000 },
            { matchId: '1-2', round: 1, players: ['RaceKing', 'Tornado'], winner: 'RaceKing', duration: 267000, timestamp: Date.now() - 6300000 },
            { matchId: '1-3', round: 1, players: ['TurboMax', 'Hurricane'], winner: 'TurboMax', duration: 298000, timestamp: Date.now() - 6000000 },
            { matchId: '1-4', round: 1, players: ['VelocityX', 'Lightning'], winner: 'VelocityX', duration: 234000, timestamp: Date.now() - 5700000 },
            { matchId: '2-1', round: 2, players: ['SpeedDemon', 'RushHour'], winner: 'SpeedDemon', duration: 301000, timestamp: Date.now() - 3600000 },
            { matchId: '2-2', round: 2, players: ['RaceKing', 'ZoomMaster'], winner: 'RaceKing', duration: 278000, timestamp: Date.now() - 3300000 },
            { matchId: '3-1', round: 3, players: ['SpeedDemon', 'TurboMax'], winner: 'SpeedDemon', duration: 289000, timestamp: Date.now() - 1800000 },
            { matchId: '3-2', round: 3, players: ['RaceKing', 'VelocityX'], winner: 'RaceKing', duration: 312000, timestamp: Date.now() - 1500000 },
            { matchId: '4-1', round: 4, players: ['SpeedDemon', 'RaceKing'], winner: 'SpeedDemon', duration: 325000, timestamp: Date.now() - 600000 }
        ];

        // Calculate statistics
        this.calculateStatistics();
        
        // Update displays
        this.updateTournamentSummary();
        this.updateFinalStandings();
        this.updateMatchHistory();
        this.updateStatistics();
        this.updatePrizeDistribution();
    }

    /**
     * Switch between result views
     */
    switchView(viewName) {
        // Update navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

        // Show/hide view containers
        document.querySelectorAll('.view-container').forEach(container => {
            container.classList.add('hidden');
        });
        document.getElementById(`${viewName}-view`).classList.remove('hidden');

        this.currentView = viewName;
        console.log(`[TournamentResults] Switched to ${viewName} view`);
    }

    /**
     * Update tournament summary
     */
    updateTournamentSummary() {
        const titleEl = document.getElementById('tournament-title');
        const formatEl = document.getElementById('tournament-format');
        const durationEl = document.getElementById('tournament-duration');
        const participantsEl = document.getElementById('tournament-participants');
        const matchesEl = document.getElementById('tournament-matches');
        const winnerSpotlight = document.getElementById('winner-spotlight');

        if (titleEl) titleEl.textContent = this.currentTournament.name;
        if (formatEl) formatEl.textContent = this.currentTournament.format.replace('_', ' ').toUpperCase();
        if (participantsEl) participantsEl.textContent = this.currentTournament.totalParticipants;
        if (matchesEl) matchesEl.textContent = this.currentTournament.totalMatches;

        if (durationEl) {
            const duration = this.formatDuration(this.currentTournament.duration);
            durationEl.textContent = duration;
        }

        if (winnerSpotlight && this.finalStandings.length > 0) {
            const winner = this.finalStandings[0];
            winnerSpotlight.innerHTML = `
                <div class="winner-crown">👑</div>
                <div class="winner-info">
                    <h3 class="winner-name">${winner.playerName}</h3>
                    <div class="winner-title">TOURNAMENT CHAMPION</div>
                    <div class="winner-stats">
                        <div class="winner-stat">
                            <span class="stat-label">WINS:</span>
                            <span class="stat-value">${winner.wins}</span>
                        </div>
                        <div class="winner-stat">
                            <span class="stat-label">WIN RATE:</span>
                            <span class="stat-value">${winner.winRate}%</span>
                        </div>
                        <div class="winner-stat">
                            <span class="stat-label">PRIZE:</span>
                            <span class="stat-value prize">$${winner.prize}</span>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Update final standings table
     */
    updateFinalStandings() {
        const tbody = document.getElementById('standings-tbody');
        const podium = document.getElementById('podium-display');

        if (!tbody) return;

        tbody.innerHTML = '';

        this.finalStandings.forEach(player => {
            const row = document.createElement('tr');
            row.className = `standings-row rank-${player.rank} ${player.eliminated ? 'eliminated' : 'finalist'}`;
            
            const rankClass = player.rank === 1 ? 'gold' : player.rank === 2 ? 'silver' : player.rank === 3 ? 'bronze' : '';
            
            row.innerHTML = `
                <td class="rank-cell">
                    <span class="rank-badge ${rankClass}">${player.rank}</span>
                </td>
                <td class="player-cell">
                    <span class="player-name">${player.playerName}</span>
                    ${player.rank <= 3 ? '<span class="medal">🏅</span>' : ''}
                </td>
                <td class="wins-cell">${player.wins}</td>
                <td class="losses-cell">${player.losses}</td>
                <td class="winrate-cell">${player.winRate}%</td>
                <td class="score-cell">${player.score}</td>
                <td class="prize-cell ${player.prize > 0 ? 'has-prize' : ''}">
                    ${player.prize > 0 ? `$${player.prize}` : '-'}
                </td>
            `;

            tbody.appendChild(row);
        });

        // Update podium display
        if (podium && this.finalStandings.length >= 3) {
            const top3 = this.finalStandings.slice(0, 3);
            podium.innerHTML = `
                <div class="podium">
                    <div class="podium-position second">
                        <div class="podium-player">
                            <div class="podium-rank">2</div>
                            <div class="podium-name">${top3[1].playerName}</div>
                            <div class="podium-prize">$${top3[1].prize}</div>
                        </div>
                        <div class="podium-base silver">🥈</div>
                    </div>
                    <div class="podium-position first">
                        <div class="podium-player">
                            <div class="podium-rank">1</div>
                            <div class="podium-name">${top3[0].playerName}</div>
                            <div class="podium-prize">$${top3[0].prize}</div>
                        </div>
                        <div class="podium-base gold">🥇</div>
                    </div>
                    <div class="podium-position third">
                        <div class="podium-player">
                            <div class="podium-rank">3</div>
                            <div class="podium-name">${top3[2].playerName}</div>
                            <div class="podium-prize">$${top3[2].prize}</div>
                        </div>
                        <div class="podium-base bronze">🥉</div>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Update match history timeline
     */
    updateMatchHistory() {
        const timeline = document.getElementById('matches-timeline');
        const roundFilter = document.getElementById('round-filter');
        const playerFilter = document.getElementById('player-filter');

        if (!timeline) return;

        // Populate filters
        if (roundFilter) {
            roundFilter.innerHTML = '<option value="">ALL ROUNDS</option>';
            const rounds = [...new Set(this.matchHistory.map(m => m.round))].sort();
            rounds.forEach(round => {
                const option = document.createElement('option');
                option.value = round;
                option.textContent = `ROUND ${round}`;
                roundFilter.appendChild(option);
            });
        }

        if (playerFilter) {
            playerFilter.innerHTML = '<option value="">ALL PLAYERS</option>';
            const players = [...new Set(this.matchHistory.flatMap(m => m.players))].sort();
            players.forEach(player => {
                const option = document.createElement('option');
                option.value = player;
                option.textContent = player;
                playerFilter.appendChild(option);
            });
        }

        this.renderMatchHistory();
    }

    /**
     * Render match history with current filters
     */
    renderMatchHistory() {
        const timeline = document.getElementById('matches-timeline');
        if (!timeline) return;

        const filteredMatches = this.applyHistoryFilters();
        timeline.innerHTML = '';

        if (filteredMatches.length === 0) {
            timeline.innerHTML = '<div class="no-matches">No matches found</div>';
            return;
        }

        // Group by rounds
        const matchesByRound = {};
        filteredMatches.forEach(match => {
            if (!matchesByRound[match.round]) {
                matchesByRound[match.round] = [];
            }
            matchesByRound[match.round].push(match);
        });

        // Render each round
        Object.keys(matchesByRound).sort().forEach(round => {
            const roundSection = document.createElement('div');
            roundSection.className = 'timeline-round';
            roundSection.innerHTML = `
                <div class="round-header">
                    <h4 class="round-title">ROUND ${round}</h4>
                    <div class="round-meta">${matchesByRound[round].length} matches</div>
                </div>
                <div class="round-matches" id="round-${round}-matches"></div>
            `;

            const matchesContainer = roundSection.querySelector('.round-matches');
            matchesByRound[round].forEach(match => {
                const matchEl = this.createMatchHistoryItem(match);
                matchesContainer.appendChild(matchEl);
            });

            timeline.appendChild(roundSection);
        });
    }

    /**
     * Create match history item
     */
    createMatchHistoryItem(match) {
        const matchEl = document.createElement('div');
        matchEl.className = 'timeline-match';
        
        const timeAgo = this.formatTimeAgo(Date.now() - match.timestamp);
        const duration = this.formatDuration(match.duration);

        matchEl.innerHTML = `
            <div class="match-timeline-header">
                <span class="match-id">${match.matchId}</span>
                <span class="match-time">${timeAgo}</span>
            </div>
            <div class="match-timeline-players">
                <div class="timeline-player ${match.winner === match.players[0] ? 'winner' : 'loser'}">
                    ${match.players[0]}
                    ${match.winner === match.players[0] ? '👑' : ''}
                </div>
                <div class="timeline-vs">VS</div>
                <div class="timeline-player ${match.winner === match.players[1] ? 'winner' : 'loser'}">
                    ${match.players[1]}
                    ${match.winner === match.players[1] ? '👑' : ''}
                </div>
            </div>
            <div class="match-timeline-stats">
                <span class="match-duration">Duration: ${duration}</span>
            </div>
        `;

        return matchEl;
    }

    /**
     * Apply history filters
     */
    applyHistoryFilters() {
        const roundFilter = document.getElementById('round-filter')?.value;
        const playerFilter = document.getElementById('player-filter')?.value;

        return this.matchHistory.filter(match => {
            if (roundFilter && match.round.toString() !== roundFilter) return false;
            if (playerFilter && !match.players.includes(playerFilter)) return false;
            return true;
        });
    }

    /**
     * Calculate and update statistics
     */
    calculateStatistics() {
        // Player statistics
        this.finalStandings.forEach(player => {
            const playerMatches = this.matchHistory.filter(m => m.players.includes(player.playerName));
            const wonMatches = playerMatches.filter(m => m.winner === player.playerName);
            
            this.playerStats.set(player.playerId, {
                ...player,
                totalMatches: playerMatches.length,
                avgMatchDuration: playerMatches.length > 0 
                    ? playerMatches.reduce((sum, m) => sum + m.duration, 0) / playerMatches.length 
                    : 0,
                fastestWin: wonMatches.length > 0 
                    ? Math.min(...wonMatches.map(m => m.duration))
                    : 0,
                slowestWin: wonMatches.length > 0 
                    ? Math.max(...wonMatches.map(m => m.duration))
                    : 0
            });
        });
    }

    /**
     * Update statistics display
     */
    updateStatistics() {
        this.updateGeneralStats();
        this.updateRecordStats();
        this.updatePerformanceStats();
        this.updateBettingStats();
        this.renderPerformanceChart();
    }

    /**
     * Update general statistics
     */
    updateGeneralStats() {
        const list = document.getElementById('general-stats-list');
        if (!list) return;

        const avgMatchDuration = this.matchHistory.reduce((sum, m) => sum + m.duration, 0) / this.matchHistory.length;
        const totalPlayTime = this.currentTournament.duration;

        list.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Total Matches:</span>
                <span class="stat-value">${this.currentTournament.totalMatches}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Total Participants:</span>
                <span class="stat-value">${this.currentTournament.totalParticipants}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Tournament Duration:</span>
                <span class="stat-value">${this.formatDuration(totalPlayTime)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Average Match Duration:</span>
                <span class="stat-value">${this.formatDuration(avgMatchDuration)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Elimination Rate:</span>
                <span class="stat-value">${Math.round((this.finalStandings.filter(p => p.eliminated).length / this.finalStandings.length) * 100)}%</span>
            </div>
        `;
    }

    /**
     * Update record statistics
     */
    updateRecordStats() {
        const list = document.getElementById('records-stats-list');
        if (!list) return;

        const fastestMatch = this.matchHistory.reduce((fastest, m) => m.duration < fastest.duration ? m : fastest);
        const slowestMatch = this.matchHistory.reduce((slowest, m) => m.duration > slowest.duration ? m : slowest);
        const mostWins = this.finalStandings.reduce((most, p) => p.wins > most.wins ? p : most);
        const highestWinRate = this.finalStandings.reduce((highest, p) => p.winRate > highest.winRate ? p : highest);

        list.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Fastest Match:</span>
                <span class="stat-value">${this.formatDuration(fastestMatch.duration)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Slowest Match:</span>
                <span class="stat-value">${this.formatDuration(slowestMatch.duration)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Most Wins:</span>
                <span class="stat-value">${mostWins.playerName} (${mostWins.wins})</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Best Win Rate:</span>
                <span class="stat-value">${highestWinRate.playerName} (${highestWinRate.winRate}%)</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Perfect Runs:</span>
                <span class="stat-value">${this.finalStandings.filter(p => p.losses === 0).length}</span>
            </div>
        `;
    }

    /**
     * Update performance statistics
     */
    updatePerformanceStats() {
        const list = document.getElementById('performance-stats-list');
        if (!list) return;

        const avgScore = this.finalStandings.reduce((sum, p) => sum + p.score, 0) / this.finalStandings.length;
        const scoreVariance = this.finalStandings.reduce((sum, p) => sum + Math.pow(p.score - avgScore, 2), 0) / this.finalStandings.length;
        const competitiveness = Math.sqrt(scoreVariance);

        list.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Average Score:</span>
                <span class="stat-value">${Math.round(avgScore)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Score Range:</span>
                <span class="stat-value">${this.finalStandings[0].score} - ${this.finalStandings[this.finalStandings.length - 1].score}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Competitiveness:</span>
                <span class="stat-value">${Math.round(competitiveness)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Upsets:</span>
                <span class="stat-value">${Math.floor(Math.random() * 5) + 1}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Close Matches:</span>
                <span class="stat-value">${Math.floor(Math.random() * 8) + 3}</span>
            </div>
        `;
    }

    /**
     * Update betting statistics
     */
    updateBettingStats() {
        const list = document.getElementById('betting-stats-list');
        if (!list) return;

        if (!this.currentTournament.bettingEnabled) {
            list.innerHTML = '<div class="stat-item"><span class="stat-value">Betting was disabled for this tournament</span></div>';
            return;
        }

        // Demo betting stats
        list.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Total Bets Placed:</span>
                <span class="stat-value">${Math.floor(Math.random() * 500) + 200}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Total Wagered:</span>
                <span class="stat-value">$${Math.floor(Math.random() * 10000) + 5000}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Biggest Win:</span>
                <span class="stat-value">$${Math.floor(Math.random() * 2000) + 500}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Most Popular Bet:</span>
                <span class="stat-value">${this.finalStandings[0].playerName}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Upset Payouts:</span>
                <span class="stat-value">${Math.floor(Math.random() * 20) + 5}</span>
            </div>
        `;
    }

    /**
     * Render performance comparison chart
     */
    renderPerformanceChart() {
        const container = document.getElementById('performance-chart-container');
        if (!container) return;

        // Simple bar chart representation using CSS
        const topPlayers = this.finalStandings.slice(0, 8);
        const maxScore = Math.max(...topPlayers.map(p => p.score));

        container.innerHTML = '';
        
        topPlayers.forEach(player => {
            const barContainer = document.createElement('div');
            barContainer.className = 'chart-bar-container';
            
            const barHeight = (player.score / maxScore) * 100;
            
            barContainer.innerHTML = `
                <div class="chart-bar" style="height: ${barHeight}%">
                    <div class="bar-value">${player.score}</div>
                </div>
                <div class="chart-label">${player.playerName}</div>
            `;
            
            container.appendChild(barContainer);
        });
    }

    /**
     * Update prize distribution
     */
    updatePrizeDistribution() {
        const totalPoolEl = document.getElementById('total-prize-pool');
        const breakdown = document.getElementById('prize-breakdown');
        
        if (totalPoolEl) {
            totalPoolEl.textContent = `TOTAL POOL: $${this.currentTournament.prizePool}`;
        }

        if (breakdown) {
            const winners = this.finalStandings.filter(p => p.prize > 0);
            
            breakdown.innerHTML = '';
            
            winners.forEach(winner => {
                const percentage = (winner.prize / this.currentTournament.prizePool) * 100;
                
                const prizeEl = document.createElement('div');
                prizeEl.className = `prize-item rank-${winner.rank}`;
                prizeEl.innerHTML = `
                    <div class="prize-rank">
                        <span class="rank-badge ${winner.rank === 1 ? 'gold' : winner.rank === 2 ? 'silver' : 'bronze'}">
                            ${winner.rank}
                        </span>
                    </div>
                    <div class="prize-player">
                        <span class="player-name">${winner.playerName}</span>
                    </div>
                    <div class="prize-amount">
                        <span class="amount">$${winner.prize}</span>
                        <span class="percentage">(${percentage.toFixed(1)}%)</span>
                    </div>
                    <div class="prize-bar">
                        <div class="prize-fill" style="width: ${percentage}%"></div>
                    </div>
                `;
                
                breakdown.appendChild(prizeEl);
            });
        }

        this.renderPrizeChart();
    }

    /**
     * Render prize distribution chart
     */
    renderPrizeChart() {
        const container = document.getElementById('prize-chart-container');
        if (!container) return;

        const winners = this.finalStandings.filter(p => p.prize > 0);
        
        // Simple pie chart representation
        container.innerHTML = `
            <div class="prize-pie-chart">
                ${winners.map((winner, index) => {
                    const percentage = (winner.prize / this.currentTournament.prizePool) * 100;
                    const colors = ['#FFD700', '#C0C0C0', '#CD7F32', '#4CAF50'];
                    
                    return `
                        <div class="pie-segment" style="
                            --percentage: ${percentage}%;
                            --color: ${colors[index] || '#666'};
                        ">
                            <span class="pie-label">${winner.playerName}<br>$${winner.prize}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    /**
     * Sort standings table
     */
    sortStandings(sortBy) {
        // Update sort button states
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`sort-by-${sortBy}`).classList.add('active');

        // Sort data
        if (sortBy === 'rank') {
            this.finalStandings.sort((a, b) => a.rank - b.rank);
        } else if (sortBy === 'score') {
            this.finalStandings.sort((a, b) => b.score - a.score);
        }

        // Re-render
        this.updateFinalStandings();
    }

    /**
     * Export functionality
     */
    async exportResults() {
        const format = document.getElementById('export-format')?.value || 'json';
        
        try {
            const exportData = {
                tournament: this.currentTournament,
                standings: this.finalStandings,
                matchHistory: this.matchHistory,
                statistics: this.generateStatisticsExport(),
                exportedAt: new Date().toISOString()
            };

            let content, filename, mimeType;

            switch (format) {
                case 'json':
                    content = JSON.stringify(exportData, null, 2);
                    filename = `tournament-results-${this.currentTournament.tournamentId}.json`;
                    mimeType = 'application/json';
                    break;
                    
                case 'csv':
                    content = this.generateCSVExport();
                    filename = `tournament-results-${this.currentTournament.tournamentId}.csv`;
                    mimeType = 'text/csv';
                    break;
                    
                case 'pdf':
                    // For PDF export, you would typically use a library like jsPDF
                    this.showNotification('PDF export not implemented in demo', 'info');
                    return;
                    
                default:
                    throw new Error('Unsupported export format');
            }

            // Download file
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showNotification(`Results exported as ${format.toUpperCase()}`, 'success');
            
        } catch (error) {
            console.error('[TournamentResults] Export error:', error);
            this.showNotification('Export failed', 'error');
        }
    }

    /**
     * Generate CSV export content
     */
    generateCSVExport() {
        const headers = ['Rank', 'Player', 'Wins', 'Losses', 'Win Rate', 'Score', 'Prize'];
        const rows = this.finalStandings.map(player => [
            player.rank,
            player.playerName,
            player.wins,
            player.losses,
            player.winRate,
            player.score,
            player.prize
        ]);

        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    /**
     * Generate statistics for export
     */
    generateStatisticsExport() {
        return {
            totalMatches: this.currentTournament.totalMatches,
            totalParticipants: this.currentTournament.totalParticipants,
            duration: this.currentTournament.duration,
            averageMatchDuration: this.matchHistory.reduce((sum, m) => sum + m.duration, 0) / this.matchHistory.length,
            prizePool: this.currentTournament.prizePool,
            bettingEnabled: this.currentTournament.bettingEnabled
        };
    }

    /**
     * Share results
     */
    async shareResults() {
        const shareData = {
            title: `${this.currentTournament.name} - Results`,
            text: `Tournament results: ${this.finalStandings[0]?.playerName} won the ${this.currentTournament.name}!`,
            url: window.location.href
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
                this.showNotification('Results shared successfully', 'success');
            } else {
                // Fallback: copy to clipboard
                await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
                this.showNotification('Results copied to clipboard', 'success');
            }
        } catch (error) {
            console.error('[TournamentResults] Share error:', error);
            this.showNotification('Share failed', 'error');
        }
    }

    /**
     * Print results
     */
    printResults() {
        const printWindow = window.open('', '_blank');
        const printContent = this.generatePrintContent();
        
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
        
        this.showNotification('Print dialog opened', 'info');
    }

    /**
     * Generate print-friendly content
     */
    generatePrintContent() {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${this.currentTournament.name} - Results</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1, h2 { color: #333; }
                    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .winner { font-weight: bold; color: #d4af37; }
                </style>
            </head>
            <body>
                <h1>${this.currentTournament.name} - Tournament Results</h1>
                <p><strong>Format:</strong> ${this.currentTournament.format.replace('_', ' ').toUpperCase()}</p>
                <p><strong>Duration:</strong> ${this.formatDuration(this.currentTournament.duration)}</p>
                <p><strong>Participants:</strong> ${this.currentTournament.totalParticipants}</p>
                
                <h2>Final Standings</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Player</th>
                            <th>Wins</th>
                            <th>Losses</th>
                            <th>Win Rate</th>
                            <th>Prize</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.finalStandings.map(player => `
                            <tr class="${player.rank === 1 ? 'winner' : ''}">
                                <td>${player.rank}</td>
                                <td>${player.playerName}</td>
                                <td>${player.wins}</td>
                                <td>${player.losses}</td>
                                <td>${player.winRate}%</td>
                                <td>${player.prize > 0 ? `$${player.prize}` : '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <p><em>Generated on ${new Date().toLocaleString()}</em></p>
            </body>
            </html>
        `;
    }

    /**
     * Utility methods
     */
    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    formatTimeAgo(milliseconds) {
        const minutes = Math.floor(milliseconds / 60000);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ago`;
        } else if (minutes > 0) {
            return `${minutes}m ago`;
        } else {
            return 'Just now';
        }
    }

    showNoResults() {
        const summaryEl = document.getElementById('tournament-summary');
        if (summaryEl) {
            summaryEl.innerHTML = '<div class="no-results-message">No tournament results available</div>';
        }
        
        // Clear other displays
        document.getElementById('standings-tbody').innerHTML = '<tr><td colspan="7" class="no-data">No results data</td></tr>';
        document.getElementById('matches-timeline').innerHTML = '<div class="no-matches">No match history</div>';
    }

    /**
     * Show notification message
     */
    showNotification(message, type = 'info') {
        // Create or update notification element
        let notification = document.getElementById('tournament-results-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'tournament-results-notification';
            notification.className = 'notification';
            
            const panel = document.getElementById('tournament-results-panel');
            if (panel) {
                panel.appendChild(notification);
            }
        }
        
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    /**
     * Set tournament results data
     */
    setTournamentResults(tournamentData) {
        this.currentTournament = tournamentData;
        this.finalStandings = tournamentData.finalStandings || [];
        this.matchHistory = tournamentData.matchHistory || [];
        
        this.calculateStatistics();
        this.updateTournamentSummary();
        this.updateFinalStandings();
        this.updateMatchHistory();
        this.updateStatistics();
        this.updatePrizeDistribution();
    }

    /**
     * Destroy the tournament results panel
     */
    destroy() {
        this.hide();
        this.currentTournament = null;
        this.finalStandings = [];
        this.matchHistory = [];
        this.playerStats.clear();
        console.log('[TournamentResults] Panel destroyed');
    }
}