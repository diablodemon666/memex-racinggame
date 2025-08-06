/**
 * HistoryManager.js - Race History and Analytics System
 * 
 * Tracks comprehensive race data, player performance metrics, betting outcomes,
 * and provides analytics for the Memex Racing game.
 */

import { MersenneTwister } from '../../utils/MersenneTwister.js';

export class HistoryManager {
    constructor() {
        this.raceHistory = [];
        this.playerHistory = new Map();
        this.bettingHistory = [];
        this.analyticsData = {
            totalRaces: 0,
            totalBets: 0,
            totalBetAmount: 0,
            averageRaceTime: 0,
            popularMaps: new Map(),
            powerUpUsage: new Map(),
            playerPerformance: new Map()
        };
        
        // Storage configuration
        this.config = {
            maxHistoryEntries: 1000,
            maxPlayerEntries: 500,
            maxBettingEntries: 2000,
            dataFolder: '/data/history',
            autoSaveInterval: 30000, // 30 seconds
            backupInterval: 300000 // 5 minutes
        };
        
        // File paths for persistent storage
        this.filePaths = {
            raceHistory: `${this.config.dataFolder}/race-history.json`,
            playerHistory: `${this.config.dataFolder}/player-history.json`,
            bettingHistory: `${this.config.dataFolder}/betting-history.json`,
            analytics: `${this.config.dataFolder}/analytics.json`
        };
        
        // Auto-save timer
        this.autoSaveTimer = null;
        this.backupTimer = null;
        
        console.log('[HistoryManager] History manager initialized');
        this.initialize();
    }

    /**
     * Initialize the history manager
     */
    async initialize() {
        try {
            await this.loadHistoryData();
            this.startAutoSave();
            console.log('[HistoryManager] Initialization complete');
        } catch (error) {
            console.error('[HistoryManager] Initialization failed:', error);
            this.initializeEmptyData();
        }
    }

    /**
     * Initialize empty data structures
     */
    initializeEmptyData() {
        this.raceHistory = [];
        this.playerHistory = new Map();
        this.bettingHistory = [];
        this.analyticsData = {
            totalRaces: 0,
            totalBets: 0,
            totalBetAmount: 0,
            averageRaceTime: 0,
            popularMaps: new Map(),
            powerUpUsage: new Map(),
            playerPerformance: new Map()
        };
    }

    /**
     * Record a completed race
     */
    recordRace(raceData) {
        const raceRecord = {
            id: this.generateRaceId(),
            timestamp: Date.now(),
            startTime: raceData.startTime,
            endTime: raceData.endTime,
            duration: raceData.endTime - raceData.startTime,
            map: raceData.map || 'unknown',
            players: this.processPlayerResults(raceData.players),
            winner: raceData.winner,
            totalPlayers: raceData.players?.length || 0,
            powerUpsUsed: raceData.powerUpsUsed || [],
            gameSettings: raceData.settings || {},
            phase: raceData.phase || 'completed',
            metadata: {
                version: '1.0.0',
                raceNumber: this.analyticsData.totalRaces + 1
            }
        };

        // Add race to history
        this.raceHistory.unshift(raceRecord);
        
        // Maintain max history size
        if (this.raceHistory.length > this.config.maxHistoryEntries) {
            this.raceHistory = this.raceHistory.slice(0, this.config.maxHistoryEntries);
        }

        // Update player histories
        this.updatePlayerHistories(raceRecord);
        
        // Update analytics
        this.updateAnalytics(raceRecord);
        
        console.log(`[HistoryManager] Race recorded: ${raceRecord.id}`);
        return raceRecord.id;
    }

    /**
     * Process player results for storage
     */
    processPlayerResults(players) {
        if (!players || !Array.isArray(players)) return [];
        
        return players.map((player, index) => ({
            id: player.id,
            name: player.name || player.username || `Player ${index + 1}`,
            position: index + 1,
            finishTime: player.finishTime || null,
            totalDistance: player.totalDistance || 0,
            skillsUsed: player.skillsUsed || [],
            boostersCollected: player.boostersCollected || 0,
            averageSpeed: player.averageSpeed || 0,
            timeStuck: player.timeStuck || 0,
            collisions: player.collisions || 0,
            performance: this.calculatePlayerPerformance(player, index)
        }));
    }

    /**
     * Calculate player performance metrics
     */
    calculatePlayerPerformance(player, position) {
        const baseScore = Math.max(0, 100 - (position * 15));
        const speedBonus = Math.min(20, (player.averageSpeed || 0) / 10);
        const skillBonus = (player.skillsUsed?.length || 0) * 5;
        const boosterBonus = (player.boostersCollected || 0) * 3;
        const stuckPenalty = Math.min(30, (player.timeStuck || 0) / 1000);
        
        return Math.max(0, baseScore + speedBonus + skillBonus + boosterBonus - stuckPenalty);
    }

    /**
     * Record betting data
     */
    recordBet(betData) {
        const betRecord = {
            id: this.generateBetId(),
            timestamp: Date.now(),
            raceId: betData.raceId,
            playerId: betData.playerId,
            playerName: betData.playerName,
            betAmount: betData.amount,
            odds: betData.odds,
            potentialWin: betData.amount * betData.odds,
            outcome: betData.outcome || 'pending', // pending, win, lose
            actualWin: betData.actualWin || 0,
            bettorId: betData.bettorId || 'anonymous',
            metadata: {
                bettingPhaseRemaining: betData.bettingPhaseRemaining || 0,
                totalBetsOnPlayer: betData.totalBetsOnPlayer || 0
            }
        };

        this.bettingHistory.unshift(betRecord);
        
        // Maintain max betting history size
        if (this.bettingHistory.length > this.config.maxBettingEntries) {
            this.bettingHistory = this.bettingHistory.slice(0, this.config.maxBettingEntries);
        }

        // Update betting analytics
        this.updateBettingAnalytics(betRecord);
        
        console.log(`[HistoryManager] Bet recorded: ${betRecord.id}`);
        return betRecord.id;
    }

    /**
     * Update player histories with race data
     */
    updatePlayerHistories(raceRecord) {
        raceRecord.players.forEach(player => {
            if (!this.playerHistory.has(player.id)) {
                this.playerHistory.set(player.id, {
                    id: player.id,
                    name: player.name,
                    totalRaces: 0,
                    totalWins: 0,
                    totalScore: 0,
                    bestPosition: Infinity,
                    averagePosition: 0,
                    averageFinishTime: 0,
                    skillUsageStats: new Map(),
                    favoriteMap: null,
                    performance: {
                        recent: [],
                        trend: 'stable',
                        peakPerformance: 0
                    },
                    firstRace: Date.now(),
                    lastRace: Date.now()
                });
            }

            const playerStats = this.playerHistory.get(player.id);
            
            // Update basic stats
            playerStats.totalRaces++;
            playerStats.totalScore += player.performance;
            playerStats.lastRace = raceRecord.timestamp;
            
            if (player.position === 1) {
                playerStats.totalWins++;
            }
            
            if (player.position < playerStats.bestPosition) {
                playerStats.bestPosition = player.position;
            }
            
            // Calculate rolling averages
            playerStats.averagePosition = ((playerStats.averagePosition * (playerStats.totalRaces - 1)) + player.position) / playerStats.totalRaces;
            
            if (player.finishTime) {
                playerStats.averageFinishTime = ((playerStats.averageFinishTime * (playerStats.totalRaces - 1)) + player.finishTime) / playerStats.totalRaces;
            }
            
            // Track skill usage
            if (player.skillsUsed) {
                player.skillsUsed.forEach(skill => {
                    const currentCount = playerStats.skillUsageStats.get(skill) || 0;
                    playerStats.skillUsageStats.set(skill, currentCount + 1);
                });
            }
            
            // Update performance trend
            playerStats.performance.recent.unshift(player.performance);
            if (playerStats.performance.recent.length > 10) {
                playerStats.performance.recent = playerStats.performance.recent.slice(0, 10);
            }
            
            if (player.performance > playerStats.performance.peakPerformance) {
                playerStats.performance.peakPerformance = player.performance;
            }
            
            // Calculate trend
            playerStats.performance.trend = this.calculatePerformanceTrend(playerStats.performance.recent);
        });
    }

    /**
     * Calculate performance trend
     */
    calculatePerformanceTrend(recentPerformances) {
        if (recentPerformances.length < 3) return 'stable';
        
        const recent = recentPerformances.slice(0, 3);
        const older = recentPerformances.slice(3, 6);
        
        const recentAvg = recent.reduce((sum, perf) => sum + perf, 0) / recent.length;
        const olderAvg = older.length > 0 ? older.reduce((sum, perf) => sum + perf, 0) / older.length : recentAvg;
        
        const difference = recentAvg - olderAvg;
        
        if (difference > 5) return 'improving';
        if (difference < -5) return 'declining';
        return 'stable';
    }

    /**
     * Update general analytics data
     */
    updateAnalytics(raceRecord) {
        this.analyticsData.totalRaces++;
        
        // Update average race time
        const totalTime = (this.analyticsData.averageRaceTime * (this.analyticsData.totalRaces - 1)) + raceRecord.duration;
        this.analyticsData.averageRaceTime = totalTime / this.analyticsData.totalRaces;
        
        // Track popular maps
        const mapCount = this.analyticsData.popularMaps.get(raceRecord.map) || 0;
        this.analyticsData.popularMaps.set(raceRecord.map, mapCount + 1);
        
        // Track power-up usage
        if (raceRecord.powerUpsUsed) {
            raceRecord.powerUpsUsed.forEach(powerUp => {
                const usage = this.analyticsData.powerUpUsage.get(powerUp.type) || 0;
                this.analyticsData.powerUpUsage.set(powerUp.type, usage + 1);
            });
        }
        
        // Update player performance analytics
        raceRecord.players.forEach(player => {
            const perfData = this.analyticsData.playerPerformance.get(player.id) || {
                totalPerformance: 0,
                raceCount: 0,
                averagePerformance: 0
            };
            
            perfData.totalPerformance += player.performance;
            perfData.raceCount++;
            perfData.averagePerformance = perfData.totalPerformance / perfData.raceCount;
            
            this.analyticsData.playerPerformance.set(player.id, perfData);
        });
    }

    /**
     * Update betting analytics
     */
    updateBettingAnalytics(betRecord) {
        this.analyticsData.totalBets++;
        this.analyticsData.totalBetAmount += betRecord.betAmount;
    }

    /**
     * Get player statistics
     */
    getPlayerStats(playerId, timeframe = 'all') {
        const playerData = this.playerHistory.get(playerId);
        if (!playerData) return null;

        const stats = { ...playerData };
        
        // Calculate win rate
        stats.winRate = playerData.totalRaces > 0 ? (playerData.totalWins / playerData.totalRaces) * 100 : 0;
        
        // Get recent races based on timeframe
        if (timeframe !== 'all') {
            const races = this.getPlayerRaces(playerId, timeframe);
            stats.recentRaces = races;
            stats.recentWinRate = this.calculateWinRate(races);
        }
        
        return stats;
    }

    /**
     * Get races for a specific player
     */
    getPlayerRaces(playerId, timeframe = 'all') {
        let cutoffTime = 0;
        
        switch (timeframe) {
            case 'today':
                cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
                break;
            case 'week':
                cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                cutoffTime = Date.now() - (30 * 24 * 60 * 60 * 1000);
                break;
        }
        
        return this.raceHistory.filter(race => {
            return race.timestamp >= cutoffTime && 
                   race.players.some(player => player.id === playerId);
        });
    }

    /**
     * Calculate win rate from race results
     */
    calculateWinRate(races) {
        if (races.length === 0) return 0;
        
        const wins = races.filter(race => race.winner?.id === playerId).length;
        return (wins / races.length) * 100;
    }

    /**
     * Get comprehensive analytics report
     */
    getAnalyticsReport(timeframe = 'all') {
        const races = this.getRacesByTimeframe(timeframe);
        
        const report = {
            summary: {
                totalRaces: races.length,
                totalPlayers: new Set(races.flatMap(race => race.players.map(p => p.id))).size,
                averageRaceTime: this.calculateAverageRaceTime(races),
                averagePlayersPerRace: races.length > 0 ? races.reduce((sum, race) => sum + race.totalPlayers, 0) / races.length : 0
            },
            maps: this.getMapAnalytics(races),
            players: this.getTopPlayerAnalytics(races),
            powerUps: this.getPowerUpAnalytics(races),
            betting: this.getBettingAnalytics(timeframe),
            trends: this.getTrendAnalytics(races),
            performance: this.getPerformanceAnalytics(races)
        };
        
        return report;
    }

    /**
     * Get races by timeframe
     */
    getRacesByTimeframe(timeframe) {
        let cutoffTime = 0;
        
        switch (timeframe) {
            case 'today':
                cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
                break;
            case 'week':
                cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                cutoffTime = Date.now() - (30 * 24 * 60 * 60 * 1000);
                break;
            default:
                return this.raceHistory;
        }
        
        return this.raceHistory.filter(race => race.timestamp >= cutoffTime);
    }

    /**
     * Get map analytics
     */
    getMapAnalytics(races) {
        const mapStats = new Map();
        
        races.forEach(race => {
            if (!mapStats.has(race.map)) {
                mapStats.set(race.map, {
                    name: race.map,
                    races: 0,
                    averageTime: 0,
                    totalTime: 0,
                    fastestTime: Infinity,
                    slowestTime: 0
                });
            }
            
            const stats = mapStats.get(race.map);
            stats.races++;
            stats.totalTime += race.duration;
            stats.averageTime = stats.totalTime / stats.races;
            
            if (race.duration < stats.fastestTime) {
                stats.fastestTime = race.duration;
            }
            if (race.duration > stats.slowestTime) {
                stats.slowestTime = race.duration;
            }
        });
        
        return Array.from(mapStats.values()).sort((a, b) => b.races - a.races);
    }

    /**
     * Get top player analytics
     */
    getTopPlayerAnalytics(races) {
        const playerStats = new Map();
        
        races.forEach(race => {
            race.players.forEach(player => {
                if (!playerStats.has(player.id)) {
                    playerStats.set(player.id, {
                        id: player.id,
                        name: player.name,
                        races: 0,
                        wins: 0,
                        totalPerformance: 0,
                        averagePosition: 0,
                        totalPosition: 0
                    });
                }
                
                const stats = playerStats.get(player.id);
                stats.races++;
                stats.totalPerformance += player.performance;
                stats.totalPosition += player.position;
                stats.averagePosition = stats.totalPosition / stats.races;
                
                if (player.position === 1) {
                    stats.wins++;
                }
            });
        });
        
        return Array.from(playerStats.values())
            .map(player => ({
                ...player,
                winRate: (player.wins / player.races) * 100,
                averagePerformance: player.totalPerformance / player.races
            }))
            .sort((a, b) => b.winRate - a.winRate)
            .slice(0, 10);
    }

    /**
     * Get power-up analytics
     */
    getPowerUpAnalytics(races) {
        const powerUpStats = new Map();
        
        races.forEach(race => {
            if (race.powerUpsUsed) {
                race.powerUpsUsed.forEach(powerUp => {
                    if (!powerUpStats.has(powerUp.type)) {
                        powerUpStats.set(powerUp.type, {
                            type: powerUp.type,
                            used: 0,
                            effectiveUse: 0
                        });
                    }
                    
                    const stats = powerUpStats.get(powerUp.type);
                    stats.used++;
                    
                    if (powerUp.effective) {
                        stats.effectiveUse++;
                    }
                });
            }
        });
        
        return Array.from(powerUpStats.values())
            .map(powerUp => ({
                ...powerUp,
                effectiveness: powerUp.used > 0 ? (powerUp.effectiveUse / powerUp.used) * 100 : 0
            }))
            .sort((a, b) => b.used - a.used);
    }

    /**
     * Get betting analytics
     */
    getBettingAnalytics(timeframe) {
        let cutoffTime = 0;
        
        switch (timeframe) {
            case 'today':
                cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
                break;
            case 'week':
                cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                cutoffTime = Date.now() - (30 * 24 * 60 * 60 * 1000);
                break;
        }
        
        const bets = this.bettingHistory.filter(bet => bet.timestamp >= cutoffTime);
        
        const totalBets = bets.length;
        const totalAmount = bets.reduce((sum, bet) => sum + bet.betAmount, 0);
        const winningBets = bets.filter(bet => bet.outcome === 'win');
        const totalWinnings = winningBets.reduce((sum, bet) => sum + bet.actualWin, 0);
        
        return {
            totalBets,
            totalAmount,
            winningBets: winningBets.length,
            winRate: totalBets > 0 ? (winningBets.length / totalBets) * 100 : 0,
            totalWinnings,
            netProfit: totalWinnings - totalAmount,
            averageBet: totalBets > 0 ? totalAmount / totalBets : 0,
            averageOdds: totalBets > 0 ? bets.reduce((sum, bet) => sum + bet.odds, 0) / totalBets : 0
        };
    }

    /**
     * Get trend analytics
     */
    getTrendAnalytics(races) {
        const sortedRaces = races.sort((a, b) => a.timestamp - b.timestamp);
        const recentRaces = sortedRaces.slice(-20); // Last 20 races
        const olderRaces = sortedRaces.slice(-40, -20); // Previous 20 races
        
        const recentAvgTime = this.calculateAverageRaceTime(recentRaces);
        const olderAvgTime = this.calculateAverageRaceTime(olderRaces);
        
        const recentAvgPlayers = recentRaces.length > 0 ? 
            recentRaces.reduce((sum, race) => sum + race.totalPlayers, 0) / recentRaces.length : 0;
        const olderAvgPlayers = olderRaces.length > 0 ? 
            olderRaces.reduce((sum, race) => sum + race.totalPlayers, 0) / olderRaces.length : 0;
        
        return {
            raceTimeTrend: recentAvgTime - olderAvgTime,
            participationTrend: recentAvgPlayers - olderAvgPlayers,
            activityTrend: recentRaces.length - olderRaces.length
        };
    }

    /**
     * Get performance analytics
     */
    getPerformanceAnalytics(races) {
        const allPerformances = races.flatMap(race => race.players.map(p => p.performance));
        const averagePerformance = allPerformances.reduce((sum, perf) => sum + perf, 0) / allPerformances.length;
        
        return {
            averagePerformance,
            maxPerformance: Math.max(...allPerformances),
            minPerformance: Math.min(...allPerformances),
            performanceDistribution: this.calculatePerformanceDistribution(allPerformances)
        };
    }

    /**
     * Calculate performance distribution
     */
    calculatePerformanceDistribution(performances) {
        const ranges = [
            { min: 0, max: 20, label: 'Poor' },
            { min: 20, max: 40, label: 'Below Average' },
            { min: 40, max: 60, label: 'Average' },
            { min: 60, max: 80, label: 'Good' },
            { min: 80, max: 100, label: 'Excellent' }
        ];
        
        return ranges.map(range => ({
            ...range,
            count: performances.filter(perf => perf >= range.min && perf < range.max).length,
            percentage: (performances.filter(perf => perf >= range.min && perf < range.max).length / performances.length) * 100
        }));
    }

    /**
     * Calculate average race time
     */
    calculateAverageRaceTime(races) {
        if (races.length === 0) return 0;
        return races.reduce((sum, race) => sum + race.duration, 0) / races.length;
    }

    /**
     * Export data to JSON or CSV format
     */
    exportData(format = 'json', timeframe = 'all') {
        const data = {
            raceHistory: this.getRacesByTimeframe(timeframe),
            playerStats: this.getPlayerStatsForExport(timeframe),
            bettingHistory: this.getBettingHistoryForExport(timeframe),
            analytics: this.getAnalyticsReport(timeframe),
            metadata: {
                exportTime: Date.now(),
                timeframe,
                format,
                version: '1.0.0'
            }
        };
        
        if (format === 'csv') {
            return this.exportToCSV(data);
        }
        
        return JSON.stringify(data, null, 2);
    }

    /**
     * Export data to CSV format
     */
    exportToCSV(data) {
        const csvSections = [];
        
        // Race history CSV
        if (data.raceHistory && data.raceHistory.length > 0) {
            csvSections.push('Race History');
            csvSections.push('Race ID,Timestamp,Map,Duration (ms),Players,Winner,Power-ups Used');
            data.raceHistory.forEach(race => {
                const winner = race.players.find(p => p.position === 1);
                const powerUpsCount = race.powerUpsUsed ? race.powerUpsUsed.length : 0;
                csvSections.push(
                    `${race.id},${new Date(race.timestamp).toISOString()},${race.map},${race.duration},${race.totalPlayers},${winner ? winner.name : 'None'},${powerUpsCount}`
                );
            });
            csvSections.push('');
        }
        
        // Player statistics CSV
        if (data.playerStats && Object.keys(data.playerStats).length > 0) {
            csvSections.push('Player Statistics');
            csvSections.push('Player ID,Name,Total Races,Total Wins,Win Rate %,Best Position,Avg Position,Performance Trend');
            Object.entries(data.playerStats).forEach(([playerId, stats]) => {
                csvSections.push(
                    `${playerId},${stats.name},${stats.totalRaces},${stats.totalWins},${stats.winRate.toFixed(2)},${stats.bestPosition === Infinity ? 'N/A' : stats.bestPosition},${stats.averagePosition.toFixed(2)},${stats.performance.trend}`
                );
            });
            csvSections.push('');
        }
        
        // Betting history CSV
        if (data.bettingHistory && data.bettingHistory.length > 0) {
            csvSections.push('Betting History');
            csvSections.push('Bet ID,Timestamp,Race ID,Player Name,Bet Amount,Odds,Potential Win,Outcome,Actual Win');
            data.bettingHistory.forEach(bet => {
                csvSections.push(
                    `${bet.id},${new Date(bet.timestamp).toISOString()},${bet.raceId},${bet.playerName},${bet.betAmount},${bet.odds},${bet.potentialWin},${bet.outcome},${bet.actualWin}`
                );
            });
            csvSections.push('');
        }
        
        // Analytics summary CSV
        if (data.analytics && data.analytics.summary) {
            csvSections.push('Analytics Summary');
            csvSections.push('Metric,Value');
            csvSections.push(`Total Races,${data.analytics.summary.totalRaces}`);
            csvSections.push(`Total Players,${data.analytics.summary.totalPlayers}`);
            csvSections.push(`Average Race Time (ms),${Math.round(data.analytics.summary.averageRaceTime)}`);
            csvSections.push(`Average Players Per Race,${data.analytics.summary.averagePlayersPerRace.toFixed(2)}`);
            if (data.analytics.betting) {
                csvSections.push(`Total Bets,${data.analytics.betting.totalBets}`);
                csvSections.push(`Total Bet Amount,${data.analytics.betting.totalAmount}`);
                csvSections.push(`Betting Win Rate %,${data.analytics.betting.winRate.toFixed(2)}`);
            }
        }
        
        return csvSections.join('\n');
    }

    /**
     * Get player stats for export
     */
    getPlayerStatsForExport(timeframe) {
        const stats = {};
        this.playerHistory.forEach((playerData, playerId) => {
            stats[playerId] = this.getPlayerStats(playerId, timeframe);
        });
        return stats;
    }

    /**
     * Get betting history for export
     */
    getBettingHistoryForExport(timeframe) {
        let cutoffTime = 0;
        
        switch (timeframe) {
            case 'today':
                cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
                break;
            case 'week':
                cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                cutoffTime = Date.now() - (30 * 24 * 60 * 60 * 1000);
                break;
            default:
                return this.bettingHistory;
        }
        
        return this.bettingHistory.filter(bet => bet.timestamp >= cutoffTime);
    }

    /**
     * Load history data from persistent storage
     */
    async loadHistoryData() {
        try {
            // In a browser environment, use localStorage
            // In a Node.js environment, use file system
            if (typeof window !== 'undefined') {
                await this.loadFromLocalStorage();
            } else {
                await this.loadFromFileSystem();
            }
        } catch (error) {
            console.error('[HistoryManager] Failed to load history data:', error);
            throw error;
        }
    }

    /**
     * Load data from localStorage (browser environment)
     */
    async loadFromLocalStorage() {
        const raceData = localStorage.getItem('memex-race-history');
        const playerData = localStorage.getItem('memex-player-history');
        const bettingData = localStorage.getItem('memex-betting-history');
        const analyticsData = localStorage.getItem('memex-analytics');
        
        if (raceData) {
            this.raceHistory = JSON.parse(raceData);
        }
        
        if (playerData) {
            const playerMap = JSON.parse(playerData);
            this.playerHistory = new Map(Object.entries(playerMap));
        }
        
        if (bettingData) {
            this.bettingHistory = JSON.parse(bettingData);
        }
        
        if (analyticsData) {
            const analytics = JSON.parse(analyticsData);
            this.analyticsData = {
                ...this.analyticsData,
                ...analytics,
                popularMaps: new Map(analytics.popularMaps || []),
                powerUpUsage: new Map(analytics.powerUpUsage || []),
                playerPerformance: new Map(analytics.playerPerformance || [])
            };
        }
    }

    /**
     * Load data from file system (Node.js environment)
     */
    async loadFromFileSystem() {
        // This would be implemented for server-side usage
        // For now, we'll use localStorage approach
        console.warn('[HistoryManager] File system loading not implemented, using localStorage fallback');
        await this.loadFromLocalStorage();
    }

    /**
     * Save history data to persistent storage
     */
    async saveHistoryData() {
        try {
            if (typeof window !== 'undefined') {
                await this.saveToLocalStorage();
            } else {
                await this.saveToFileSystem();
            }
            console.log('[HistoryManager] History data saved successfully');
        } catch (error) {
            console.error('[HistoryManager] Failed to save history data:', error);
        }
    }

    /**
     * Save data to localStorage (browser environment)
     */
    async saveToLocalStorage() {
        localStorage.setItem('memex-race-history', JSON.stringify(this.raceHistory));
        
        const playerObj = {};
        this.playerHistory.forEach((value, key) => {
            playerObj[key] = value;
        });
        localStorage.setItem('memex-player-history', JSON.stringify(playerObj));
        
        localStorage.setItem('memex-betting-history', JSON.stringify(this.bettingHistory));
        
        const analyticsForStorage = {
            ...this.analyticsData,
            popularMaps: Array.from(this.analyticsData.popularMaps.entries()),
            powerUpUsage: Array.from(this.analyticsData.powerUpUsage.entries()),
            playerPerformance: Array.from(this.analyticsData.playerPerformance.entries())
        };
        localStorage.setItem('memex-analytics', JSON.stringify(analyticsForStorage));
    }

    /**
     * Save data to file system (Node.js environment)
     */
    async saveToFileSystem() {
        // This would be implemented for server-side usage
        console.warn('[HistoryManager] File system saving not implemented, using localStorage fallback');
        await this.saveToLocalStorage();
    }

    /**
     * Start auto-save timer
     */
    startAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
        
        this.autoSaveTimer = setInterval(() => {
            this.saveHistoryData();
        }, this.config.autoSaveInterval);
        
        // Also setup backup timer
        if (this.backupTimer) {
            clearInterval(this.backupTimer);
        }
        
        this.backupTimer = setInterval(() => {
            this.createBackup();
        }, this.config.backupInterval);
    }

    /**
     * Create backup of current data
     */
    createBackup() {
        const backupData = this.exportData('json', 'all');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        if (typeof window !== 'undefined') {
            localStorage.setItem(`memex-backup-${timestamp}`, backupData);
            
            // Keep only last 5 backups
            const keys = Object.keys(localStorage).filter(key => key.startsWith('memex-backup-'));
            if (keys.length > 5) {
                keys.sort().slice(0, -5).forEach(key => {
                    localStorage.removeItem(key);
                });
            }
        }
        
        console.log(`[HistoryManager] Backup created: ${timestamp}`);
    }

    /**
     * Generate unique race ID
     */
    generateRaceId() {
        return `race-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate unique bet ID
     */
    generateBetId() {
        return `bet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Clean up old data based on configuration
     */
    cleanupOldData() {
        const cutoffTime = Date.now() - (90 * 24 * 60 * 60 * 1000); // 90 days
        
        // Clean old race history
        this.raceHistory = this.raceHistory.filter(race => race.timestamp > cutoffTime);
        
        // Clean old betting history
        this.bettingHistory = this.bettingHistory.filter(bet => bet.timestamp > cutoffTime);
        
        // Clean inactive player histories
        this.playerHistory.forEach((playerData, playerId) => {
            if (playerData.lastRace < cutoffTime) {
                this.playerHistory.delete(playerId);
            }
        });
        
        console.log('[HistoryManager] Old data cleaned up');
    }

    /**
     * Destroy the history manager
     */
    destroy() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
        
        if (this.backupTimer) {
            clearInterval(this.backupTimer);
            this.backupTimer = null;
        }
        
        // Save data one final time
        this.saveHistoryData();
        
        console.log('[HistoryManager] History manager destroyed');
    }
}