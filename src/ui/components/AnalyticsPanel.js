/**
 * AnalyticsPanel.js - Race Analytics Dashboard Component
 * 
 * Provides comprehensive analytics dashboard for race history, player performance,
 * betting statistics, and trend analysis for the Memex Racing game.
 */

export class AnalyticsPanel {
    constructor(uiManager, historyManager) {
        this.uiManager = uiManager;
        this.historyManager = historyManager;
        this.isVisible = false;
        this.currentTab = 'overview';
        this.timeframe = 'all';
        this.refreshInterval = null;
        
        // Chart configurations
        this.chartConfig = {
            colors: {
                primary: '#00ff00',
                secondary: '#ff6600',
                accent: '#ffff00',
                background: '#1a3a1a',
                text: '#ffffff'
            },
            animation: {
                duration: 300,
                easing: 'ease-in-out'
            }
        };
        
        console.log('[AnalyticsPanel] Analytics panel initialized');
    }

    /**
     * Initialize the analytics panel
     */
    async initialize() {
        this.createPanelContent();
        this.setupEventListeners();
        this.setupAutoRefresh();
        await this.loadAnalyticsData();
        console.log('[AnalyticsPanel] Panel initialized');
    }

    /**
     * Create analytics panel content structure
     */
    createPanelContent() {
        const panel = document.getElementById('analytics-panel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="panel-header">
                <div class="panel-title">
                    <span class="title-text">RACE ANALYTICS</span>
                    <div class="panel-controls">
                        <select id="timeframe-select" class="timeframe-selector">
                            <option value="all">All Time</option>
                            <option value="month">This Month</option>
                            <option value="week">This Week</option>
                            <option value="today">Today</option>
                        </select>
                        <button class="control-btn refresh-btn" id="refresh-analytics" title="Refresh Data">
                            🔄
                        </button>
                        <button class="control-btn export-btn" id="export-analytics" title="Export Data">
                            📊
                        </button>
                        <button class="control-btn csv-export-btn" id="export-csv" title="Export CSV">
                            📋
                        </button>
                        <button class="control-btn close-btn" id="close-analytics" title="Close">
                            ✕
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="panel-body analytics-content">
                <div class="analytics-tabs">
                    <button class="tab-btn active" data-tab="overview">Overview</button>
                    <button class="tab-btn" data-tab="players">Players</button>
                    <button class="tab-btn" data-tab="races">Races</button>
                    <button class="tab-btn" data-tab="betting">Betting</button>
                    <button class="tab-btn" data-tab="maps">Maps</button>
                    <button class="tab-btn" data-tab="trends">Trends</button>
                </div>
                
                <div class="analytics-tabs-content">
                    <!-- Overview Tab -->
                    <div class="tab-content active" id="overview-tab">
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-icon">🏁</div>
                                <div class="stat-content">
                                    <div class="stat-value" id="total-races">0</div>
                                    <div class="stat-label">Total Races</div>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon">👥</div>
                                <div class="stat-content">
                                    <div class="stat-value" id="total-players">0</div>
                                    <div class="stat-label">Active Players</div>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon">💰</div>
                                <div class="stat-content">
                                    <div class="stat-value" id="total-bets">0</div>
                                    <div class="stat-label">Total Bets</div>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon">⏱️</div>
                                <div class="stat-content">
                                    <div class="stat-value" id="avg-race-time">0s</div>
                                    <div class="stat-label">Avg Race Time</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="overview-charts">
                            <div class="chart-container">
                                <h3>Race Activity</h3>
                                <canvas id="activity-chart" width="400" height="200"></canvas>
                            </div>
                            <div class="chart-container">
                                <h3>Performance Distribution</h3>
                                <canvas id="performance-chart" width="400" height="200"></canvas>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Players Tab -->
                    <div class="tab-content" id="players-tab">
                        <div class="players-analytics">
                            <div class="top-players-section">
                                <h3>Top Performers</h3>
                                <div class="players-list" id="top-players-list">
                                    <!-- Top players will be dynamically generated -->
                                </div>
                            </div>
                            
                            <div class="player-stats-section">
                                <h3>Player Statistics</h3>
                                <div class="player-search">
                                    <input type="text" id="player-search" placeholder="Search player...">
                                    <button id="search-player-btn">🔍</button>
                                </div>
                                <div class="player-details" id="player-details">
                                    <div class="no-selection">Select a player to view detailed statistics</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Races Tab -->
                    <div class="tab-content" id="races-tab">
                        <div class="races-analytics">
                            <div class="race-filters">
                                <select id="race-map-filter">
                                    <option value="all">All Maps</option>
                                </select>
                                <select id="race-duration-filter">
                                    <option value="all">All Durations</option>
                                    <option value="quick">Quick (&lt; 2min)</option>
                                    <option value="normal">Normal (2-4min)</option>
                                    <option value="long">Long (&gt; 4min)</option>
                                </select>
                            </div>
                            
                            <div class="recent-races">
                                <h3>Recent Races</h3>
                                <div class="races-table" id="recent-races-table">
                                    <!-- Recent races table will be generated -->
                                </div>
                            </div>
                            
                            <div class="race-performance">
                                <h3>Race Performance Metrics</h3>
                                <canvas id="race-metrics-chart" width="600" height="300"></canvas>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Betting Tab -->
                    <div class="tab-content" id="betting-tab">
                        <div class="betting-analytics">
                            <div class="betting-stats-grid">
                                <div class="betting-stat-card">
                                    <div class="stat-value" id="total-bet-amount">$0</div>
                                    <div class="stat-label">Total Bet Amount</div>
                                </div>
                                <div class="betting-stat-card">
                                    <div class="stat-value" id="betting-win-rate">0%</div>
                                    <div class="stat-label">Overall Win Rate</div>
                                </div>
                                <div class="betting-stat-card">
                                    <div class="stat-value" id="total-winnings">$0</div>
                                    <div class="stat-label">Total Winnings</div>
                                </div>
                                <div class="betting-stat-card">
                                    <div class="stat-value" id="net-profit">$0</div>
                                    <div class="stat-label">Net Profit</div>
                                </div>
                            </div>
                            
                            <div class="betting-charts">
                                <div class="chart-container">
                                    <h3>Betting Volume</h3>
                                    <canvas id="betting-volume-chart" width="400" height="200"></canvas>
                                </div>
                                <div class="chart-container">
                                    <h3>Odds Distribution</h3>
                                    <canvas id="odds-distribution-chart" width="400" height="200"></canvas>
                                </div>
                            </div>
                            
                            <div class="recent-bets">
                                <h3>Recent Betting Activity</h3>
                                <div class="bets-table" id="recent-bets-table">
                                    <!-- Recent bets table will be generated -->
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Maps Tab -->
                    <div class="tab-content" id="maps-tab">
                        <div class="maps-analytics">
                            <div class="map-popularity">
                                <h3>Map Popularity</h3>
                                <div class="map-stats" id="map-stats">
                                    <!-- Map statistics will be generated -->
                                </div>
                            </div>
                            
                            <div class="map-performance">
                                <h3>Map Performance</h3>
                                <canvas id="map-performance-chart" width="600" height="300"></canvas>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Trends Tab -->
                    <div class="tab-content" id="trends-tab">
                        <div class="trends-analytics">
                            <div class="trend-indicators">
                                <div class="trend-card">
                                    <div class="trend-icon" id="activity-trend-icon">📈</div>
                                    <div class="trend-content">
                                        <div class="trend-value" id="activity-trend">+0%</div>
                                        <div class="trend-label">Activity Trend</div>
                                    </div>
                                </div>
                                <div class="trend-card">
                                    <div class="trend-icon" id="performance-trend-icon">📊</div>
                                    <div class="trend-content">
                                        <div class="trend-value" id="performance-trend">+0%</div>
                                        <div class="trend-label">Performance Trend</div>
                                    </div>
                                </div>
                                <div class="trend-card">
                                    <div class="trend-icon" id="betting-trend-icon">💹</div>
                                    <div class="trend-content">
                                        <div class="trend-value" id="betting-trend">+0%</div>
                                        <div class="trend-label">Betting Trend</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="trend-charts">
                                <div class="chart-container">
                                    <h3>Activity Over Time</h3>
                                    <canvas id="activity-trend-chart" width="600" height="250"></canvas>
                                </div>
                                <div class="chart-container">
                                    <h3>Performance Trends</h3>
                                    <canvas id="performance-trend-chart" width="600" height="250"></canvas>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Setup event listeners for analytics interactions
     */
    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Timeframe selection
        const timeframeSelect = document.getElementById('timeframe-select');
        if (timeframeSelect) {
            timeframeSelect.addEventListener('change', (e) => {
                this.setTimeframe(e.target.value);
            });
        }

        // Control buttons
        const refreshBtn = document.getElementById('refresh-analytics');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshAnalytics();
            });
        }

        const exportBtn = document.getElementById('export-analytics');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportAnalytics();
            });
        }

        const csvExportBtn = document.getElementById('export-csv');
        if (csvExportBtn) {
            csvExportBtn.addEventListener('click', () => {
                this.exportAnalyticsCSV();
            });
        }

        const closeBtn = document.getElementById('close-analytics');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hide();
            });
        }

        // Player search
        const playerSearch = document.getElementById('player-search');
        const searchBtn = document.getElementById('search-player-btn');
        if (playerSearch && searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.searchPlayer(playerSearch.value);
            });
            
            playerSearch.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.searchPlayer(playerSearch.value);
                }
            });
        }

        // Race filters
        const raceMapFilter = document.getElementById('race-map-filter');
        const raceDurationFilter = document.getElementById('race-duration-filter');
        
        if (raceMapFilter) {
            raceMapFilter.addEventListener('change', () => {
                this.updateRaceAnalytics();
            });
        }
        
        if (raceDurationFilter) {
            raceDurationFilter.addEventListener('change', () => {
                this.updateRaceAnalytics();
            });
        }
    }

    /**
     * Setup auto-refresh timer
     */
    setupAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        this.refreshInterval = setInterval(() => {
            if (this.isVisible) {
                this.refreshAnalytics();
            }
        }, 30000); // Refresh every 30 seconds
    }

    /**
     * Load and display analytics data
     */
    async loadAnalyticsData() {
        try {
            const analyticsReport = this.historyManager.getAnalyticsReport(this.timeframe);
            this.displayOverviewData(analyticsReport);
            this.displayPlayerData(analyticsReport);
            this.displayRaceData(analyticsReport);
            this.displayBettingData(analyticsReport);
            this.displayMapData(analyticsReport);
            this.displayTrendData(analyticsReport);
        } catch (error) {
            console.error('[AnalyticsPanel] Failed to load analytics data:', error);
            this.showError('Failed to load analytics data');
        }
    }

    /**
     * Display overview data
     */
    displayOverviewData(report) {
        // Update summary statistics
        document.getElementById('total-races').textContent = report.summary.totalRaces || 0;
        document.getElementById('total-players').textContent = report.summary.totalPlayers || 0;
        document.getElementById('total-bets').textContent = report.betting.totalBets || 0;
        
        const avgTime = Math.round(report.summary.averageRaceTime / 1000) || 0;
        document.getElementById('avg-race-time').textContent = `${avgTime}s`;

        // Create activity chart
        this.createActivityChart(report);
        
        // Create performance distribution chart
        this.createPerformanceChart(report);
    }

    /**
     * Create activity chart
     */
    createActivityChart(report) {
        const canvas = document.getElementById('activity-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const races = this.historyManager.getRacesByTimeframe(this.timeframe);
        
        // Group races by time period
        const timeData = this.groupRacesByTime(races);
        
        this.drawLineChart(ctx, timeData, {
            title: 'Race Activity Over Time',
            color: this.chartConfig.colors.primary,
            yLabel: 'Races'
        });
    }

    /**
     * Create performance distribution chart
     */
    createPerformanceChart(report) {
        const canvas = document.getElementById('performance-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        if (report.performance && report.performance.performanceDistribution) {
            this.drawBarChart(ctx, report.performance.performanceDistribution, {
                title: 'Performance Distribution',
                color: this.chartConfig.colors.secondary,
                yLabel: 'Players'
            });
        }
    }

    /**
     * Display player data
     */
    displayPlayerData(report) {
        const topPlayersList = document.getElementById('top-players-list');
        if (!topPlayersList) return;

        topPlayersList.innerHTML = '';

        if (report.players && report.players.length > 0) {
            report.players.forEach((player, index) => {
                const playerCard = this.createTopPlayerCard(player, index + 1);
                topPlayersList.appendChild(playerCard);
            });
        } else {
            topPlayersList.innerHTML = '<div class="no-data">No player data available</div>';
        }
    }

    /**
     * Create top player card
     */
    createTopPlayerCard(player, rank) {
        const card = document.createElement('div');
        card.className = 'top-player-card';
        card.dataset.playerId = player.id;
        
        // Add rank styling
        if (rank <= 3) {
            card.classList.add(`rank-${rank}`);
        }

        card.innerHTML = `
            <div class="player-rank">#${rank}</div>
            <div class="player-info">
                <div class="player-name">${player.name}</div>
                <div class="player-stats">
                    <span class="stat">Win Rate: ${player.winRate.toFixed(1)}%</span>
                    <span class="stat">Races: ${player.races}</span>
                    <span class="stat">Avg Performance: ${player.averagePerformance.toFixed(1)}</span>
                </div>
            </div>
            <div class="player-score">${player.averagePerformance.toFixed(0)}</div>
        `;

        // Add click handler for detailed view
        card.addEventListener('click', () => {
            this.showPlayerDetails(player.id);
        });

        return card;
    }

    /**
     * Display race data
     */
    displayRaceData(report) {
        this.updateRaceFilters(report);
        this.displayRecentRaces();
        this.createRaceMetricsChart(report);
    }

    /**
     * Update race filters
     */
    updateRaceFilters(report) {
        const mapFilter = document.getElementById('race-map-filter');
        if (!mapFilter) return;

        // Clear existing options except "All Maps"
        while (mapFilter.children.length > 1) {
            mapFilter.removeChild(mapFilter.lastChild);
        }

        // Add map options
        if (report.maps) {
            report.maps.forEach(map => {
                const option = document.createElement('option');
                option.value = map.name;
                option.textContent = `${map.name} (${map.races} races)`;
                mapFilter.appendChild(option);
            });
        }
    }

    /**
     * Display recent races
     */
    displayRecentRaces() {
        const racesTable = document.getElementById('recent-races-table');
        if (!racesTable) return;

        const races = this.historyManager.getRacesByTimeframe(this.timeframe).slice(0, 10);
        
        racesTable.innerHTML = `
            <div class="table-header">
                <div class="col-time">Time</div>
                <div class="col-map">Map</div>
                <div class="col-duration">Duration</div>
                <div class="col-players">Players</div>
                <div class="col-winner">Winner</div>
            </div>
        `;

        races.forEach(race => {
            const row = document.createElement('div');
            row.className = 'table-row';
            
            const duration = Math.round(race.duration / 1000);
            const winner = race.players.find(p => p.position === 1);
            
            row.innerHTML = `
                <div class="col-time">${this.formatTime(race.timestamp)}</div>
                <div class="col-map">${race.map}</div>
                <div class="col-duration">${duration}s</div>
                <div class="col-players">${race.totalPlayers}</div>
                <div class="col-winner">${winner ? winner.name : 'Unknown'}</div>
            `;
            
            racesTable.appendChild(row);
        });
    }

    /**
     * Display betting data
     */
    displayBettingData(report) {
        if (!report.betting) return;

        // Update betting statistics
        document.getElementById('total-bet-amount').textContent = `$${report.betting.totalAmount || 0}`;
        document.getElementById('betting-win-rate').textContent = `${(report.betting.winRate || 0).toFixed(1)}%`;
        document.getElementById('total-winnings').textContent = `$${report.betting.totalWinnings || 0}`;
        document.getElementById('net-profit').textContent = `$${report.betting.netProfit || 0}`;

        // Create betting charts
        this.createBettingVolumeChart(report);
        this.createOddsDistributionChart(report);
        this.displayRecentBets();
    }

    /**
     * Display map data
     */
    displayMapData(report) {
        const mapStats = document.getElementById('map-stats');
        if (!mapStats || !report.maps) return;

        mapStats.innerHTML = '';

        report.maps.forEach(map => {
            const mapCard = document.createElement('div');
            mapCard.className = 'map-stat-card';
            
            const avgTime = Math.round(map.averageTime / 1000);
            const fastestTime = Math.round(map.fastestTime / 1000);
            
            mapCard.innerHTML = `
                <div class="map-name">${map.name}</div>
                <div class="map-stats-grid">
                    <div class="map-stat">
                        <span class="label">Races:</span>
                        <span class="value">${map.races}</span>
                    </div>
                    <div class="map-stat">
                        <span class="label">Avg Time:</span>
                        <span class="value">${avgTime}s</span>
                    </div>
                    <div class="map-stat">
                        <span class="label">Fastest:</span>
                        <span class="value">${fastestTime}s</span>
                    </div>
                </div>
            `;
            
            mapStats.appendChild(mapCard);
        });

        // Create map performance chart
        this.createMapPerformanceChart(report);
    }

    /**
     * Display trend data
     */
    displayTrendData(report) {
        if (!report.trends) return;

        // Update trend indicators
        this.updateTrendIndicator('activity-trend', report.trends.activityTrend);
        this.updateTrendIndicator('performance-trend', report.trends.performanceTrend);
        this.updateTrendIndicator('betting-trend', report.trends.bettingTrend || 0);

        // Create trend charts
        this.createActivityTrendChart(report);
        this.createPerformanceTrendChart(report);
    }

    /**
     * Update trend indicator
     */
    updateTrendIndicator(elementId, trendValue) {
        const valueElement = document.getElementById(elementId);
        const iconElement = document.getElementById(elementId.replace('-trend', '-trend-icon'));
        
        if (!valueElement || !iconElement) return;

        const percentage = (trendValue * 100).toFixed(1);
        valueElement.textContent = `${percentage > 0 ? '+' : ''}${percentage}%`;
        
        // Update icon and styling
        if (trendValue > 0.05) {
            iconElement.textContent = '📈';
            valueElement.className = 'trend-value positive';
        } else if (trendValue < -0.05) {
            iconElement.textContent = '📉';
            valueElement.className = 'trend-value negative';
        } else {
            iconElement.textContent = '📊';
            valueElement.className = 'trend-value neutral';
        }
    }

    /**
     * Switch between analytics tabs
     */
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        this.currentTab = tabName;
        
        // Load tab-specific data if needed
        this.loadTabData(tabName);
    }

    /**
     * Load data for specific tab
     */
    loadTabData(tabName) {
        switch (tabName) {
            case 'races':
                this.updateRaceAnalytics();
                break;
            case 'betting':
                this.displayRecentBets();
                break;
            case 'trends':
                // Trends are loaded with main data
                break;
            default:
                // Other tabs are loaded with main data
                break;
        }
    }

    /**
     * Set timeframe and refresh data
     */
    setTimeframe(timeframe) {
        this.timeframe = timeframe;
        this.loadAnalyticsData();
    }

    /**
     * Refresh analytics data
     */
    refreshAnalytics() {
        this.loadAnalyticsData();
        this.showNotification('Analytics data refreshed', 'success');
    }

    /**
     * Export analytics data as JSON
     */
    exportAnalytics() {
        try {
            const exportData = this.historyManager.exportData('json', this.timeframe);
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `memex-racing-analytics-${timestamp}.json`;
            
            this.downloadFile(exportData, filename, 'application/json');
            this.showNotification('Analytics data exported successfully', 'success');
        } catch (error) {
            console.error('[AnalyticsPanel] Export failed:', error);
            this.showNotification('Failed to export analytics data', 'error');
        }
    }

    /**
     * Export analytics data as CSV
     */
    exportAnalyticsCSV() {
        try {
            const exportData = this.historyManager.exportData('csv', this.timeframe);
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `memex-racing-analytics-${timestamp}.csv`;
            
            this.downloadFile(exportData, filename, 'text/csv');
            this.showNotification('Analytics data exported as CSV successfully', 'success');
        } catch (error) {
            console.error('[AnalyticsPanel] CSV export failed:', error);
            this.showNotification('Failed to export analytics data as CSV', 'error');
        }
    }

    /**
     * Download file utility
     */
    downloadFile(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    }

    /**
     * Search for player
     */
    searchPlayer(searchTerm) {
        if (!searchTerm.trim()) return;
        
        // Find player in history
        let foundPlayer = null;
        this.historyManager.playerHistory.forEach((playerData, playerId) => {
            if (playerData.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                playerId.toLowerCase().includes(searchTerm.toLowerCase())) {
                foundPlayer = { id: playerId, ...playerData };
            }
        });
        
        if (foundPlayer) {
            this.showPlayerDetails(foundPlayer.id);
        } else {
            this.showNotification('Player not found', 'error');
        }
    }

    /**
     * Show detailed player statistics
     */
    showPlayerDetails(playerId) {
        const playerStats = this.historyManager.getPlayerStats(playerId, this.timeframe);
        const detailsContainer = document.getElementById('player-details');
        
        if (!playerStats || !detailsContainer) return;

        detailsContainer.innerHTML = `
            <div class="player-header">
                <div class="player-name">${playerStats.name}</div>
                <div class="player-id">ID: ${playerId}</div>
            </div>
            
            <div class="player-stats-grid">
                <div class="stat-item">
                    <span class="label">Total Races:</span>
                    <span class="value">${playerStats.totalRaces}</span>
                </div>
                <div class="stat-item">
                    <span class="label">Total Wins:</span>
                    <span class="value">${playerStats.totalWins}</span>
                </div>
                <div class="stat-item">
                    <span class="label">Win Rate:</span>
                    <span class="value">${playerStats.winRate.toFixed(1)}%</span>
                </div>
                <div class="stat-item">
                    <span class="label">Best Position:</span>
                    <span class="value">#${playerStats.bestPosition === Infinity ? 'N/A' : playerStats.bestPosition}</span>
                </div>
                <div class="stat-item">
                    <span class="label">Avg Position:</span>
                    <span class="value">#${playerStats.averagePosition.toFixed(1)}</span>
                </div>
                <div class="stat-item">
                    <span class="label">Performance Trend:</span>
                    <span class="value trend-${playerStats.performance.trend}">${playerStats.performance.trend}</span>
                </div>
            </div>
            
            <div class="player-performance-chart">
                <h4>Recent Performance</h4>
                <canvas id="player-performance-chart" width="400" height="150"></canvas>
            </div>
        `;

        // Create player performance chart
        this.createPlayerPerformanceChart(playerStats.performance.recent);
    }

    /**
     * Simple chart drawing utilities
     */
    drawLineChart(ctx, data, options) {
        const canvas = ctx.canvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (!data || data.length === 0) {
            ctx.fillStyle = this.chartConfig.colors.text;
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
            return;
        }
        
        const margin = 40;
        const chartWidth = canvas.width - 2 * margin;
        const chartHeight = canvas.height - 2 * margin;
        
        const maxValue = Math.max(...data.map(d => d.value));
        const xStep = chartWidth / (data.length - 1);
        
        // Draw chart lines and points
        ctx.strokeStyle = options.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        data.forEach((point, index) => {
            const x = margin + index * xStep;
            const y = margin + chartHeight - (point.value / maxValue) * chartHeight;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            
            // Draw point
            ctx.fillStyle = options.color;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
        });
        
        ctx.stroke();
        
        // Draw axes
        ctx.strokeStyle = this.chartConfig.colors.text;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(margin, margin);
        ctx.lineTo(margin, margin + chartHeight);
        ctx.lineTo(margin + chartWidth, margin + chartHeight);
        ctx.stroke();
    }

    drawBarChart(ctx, data, options) {
        const canvas = ctx.canvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (!data || data.length === 0) {
            ctx.fillStyle = this.chartConfig.colors.text;
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
            return;
        }
        
        const margin = 40;
        const chartWidth = canvas.width - 2 * margin;
        const chartHeight = canvas.height - 2 * margin;
        
        const maxValue = Math.max(...data.map(d => d.count));
        const barWidth = chartWidth / data.length - 10;
        
        // Draw bars
        data.forEach((item, index) => {
            const x = margin + index * (chartWidth / data.length) + 5;
            const barHeight = (item.count / maxValue) * chartHeight;
            const y = margin + chartHeight - barHeight;
            
            ctx.fillStyle = options.color;
            ctx.fillRect(x, y, barWidth, barHeight);
            
            // Draw labels
            ctx.fillStyle = this.chartConfig.colors.text;
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(item.label, x + barWidth / 2, margin + chartHeight + 15);
            ctx.fillText(item.count.toString(), x + barWidth / 2, y - 5);
        });
    }

    /**
     * Group races by time for charts
     */
    groupRacesByTime(races) {
        // Simple grouping by day for demo
        const grouped = new Map();
        
        races.forEach(race => {
            const date = new Date(race.timestamp).toDateString();
            grouped.set(date, (grouped.get(date) || 0) + 1);
        });
        
        return Array.from(grouped.entries()).map(([date, count]) => ({
            label: date,
            value: count
        }));
    }

    /**
     * Create various chart types
     */
    createBettingVolumeChart(report) {
        // Implementation for betting volume chart
        const canvas = document.getElementById('betting-volume-chart');
        if (canvas && report.betting) {
            const ctx = canvas.getContext('2d');
            // Simple implementation - would create betting volume over time chart
            this.drawSimpleMessage(ctx, 'Betting Volume Chart');
        }
    }

    createOddsDistributionChart(report) {
        // Implementation for odds distribution chart
        const canvas = document.getElementById('odds-distribution-chart');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            this.drawSimpleMessage(ctx, 'Odds Distribution Chart');
        }
    }

    createRaceMetricsChart(report) {
        // Implementation for race metrics chart
        const canvas = document.getElementById('race-metrics-chart');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            this.drawSimpleMessage(ctx, 'Race Metrics Chart');
        }
    }

    createMapPerformanceChart(report) {
        // Implementation for map performance chart
        const canvas = document.getElementById('map-performance-chart');
        if (canvas && report.maps) {
            const ctx = canvas.getContext('2d');
            const data = report.maps.map(map => ({
                label: map.name,
                value: map.races,
                count: map.races
            }));
            this.drawBarChart(ctx, data, {
                title: 'Map Performance',
                color: this.chartConfig.colors.accent,
                yLabel: 'Races'
            });
        }
    }

    createActivityTrendChart(report) {
        // Implementation for activity trend chart
        const canvas = document.getElementById('activity-trend-chart');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            this.drawSimpleMessage(ctx, 'Activity Trend Chart');
        }
    }

    createPerformanceTrendChart(report) {
        // Implementation for performance trend chart
        const canvas = document.getElementById('performance-trend-chart');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            this.drawSimpleMessage(ctx, 'Performance Trend Chart');
        }
    }

    createPlayerPerformanceChart(recentPerformances) {
        // Implementation for individual player performance chart
        const canvas = document.getElementById('player-performance-chart');
        if (canvas && recentPerformances) {
            const ctx = canvas.getContext('2d');
            const data = recentPerformances.map((perf, index) => ({
                label: `Race ${recentPerformances.length - index}`,
                value: perf
            }));
            this.drawLineChart(ctx, data, {
                color: this.chartConfig.colors.primary,
                yLabel: 'Performance'
            });
        }
    }

    drawSimpleMessage(ctx, message) {
        const canvas = ctx.canvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = this.chartConfig.colors.text;
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(message, canvas.width / 2, canvas.height / 2);
        ctx.font = '12px Arial';
        ctx.fillText('(Implementation pending)', canvas.width / 2, canvas.height / 2 + 20);
    }

    /**
     * Display recent bets
     */
    displayRecentBets() {
        const betsTable = document.getElementById('recent-bets-table');
        if (!betsTable) return;

        const bets = this.historyManager.getBettingHistoryForExport(this.timeframe).slice(0, 10);
        
        betsTable.innerHTML = `
            <div class="table-header">
                <div class="col-time">Time</div>
                <div class="col-player">Player</div>
                <div class="col-amount">Amount</div>
                <div class="col-odds">Odds</div>
                <div class="col-outcome">Outcome</div>
            </div>
        `;

        bets.forEach(bet => {
            const row = document.createElement('div');
            row.className = 'table-row';
            row.classList.add(bet.outcome);
            
            row.innerHTML = `
                <div class="col-time">${this.formatTime(bet.timestamp)}</div>
                <div class="col-player">${bet.playerName}</div>
                <div class="col-amount">$${bet.betAmount}</div>
                <div class="col-odds">${bet.odds.toFixed(2)}:1</div>
                <div class="col-outcome">${bet.outcome}</div>
            `;
            
            betsTable.appendChild(row);
        });
    }

    /**
     * Update race analytics with filters
     */
    updateRaceAnalytics() {
        const mapFilter = document.getElementById('race-map-filter');
        const durationFilter = document.getElementById('race-duration-filter');
        
        if (!mapFilter || !durationFilter) return;

        // Apply filters and update display
        this.displayRecentRaces();
    }

    /**
     * Format timestamp for display
     */
    formatTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return new Date(timestamp).toLocaleDateString();
    }

    /**
     * Show analytics panel
     */
    show() {
        const panel = document.getElementById('analytics-panel');
        if (panel) {
            panel.classList.remove('hidden');
            this.isVisible = true;
            this.loadAnalyticsData();
        }
    }

    /**
     * Hide analytics panel
     */
    hide() {
        const panel = document.getElementById('analytics-panel');
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
        return document.getElementById('analytics-panel');
    }

    /**
     * Show notification message
     */
    showNotification(message, type = 'info') {
        // Create or update notification element
        let notification = document.getElementById('analytics-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'analytics-notification';
            notification.className = 'notification';
            document.getElementById('analytics-panel').appendChild(notification);
        }
        
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    /**
     * Show error message
     */
    showError(message) {
        this.showNotification(message, 'error');
    }

    /**
     * Destroy the analytics panel
     */
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        
        console.log('[AnalyticsPanel] Panel destroyed');
    }
}