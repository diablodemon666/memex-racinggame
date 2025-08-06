/**
 * TournamentStateManager.js - Tournament state persistence for Memex Racing
 * 
 * Handles tournament save/load functionality, state recovery after disconnections,
 * match history tracking, and tournament statistics persistence.
 */

/**
 * Tournament state persistence and recovery manager
 */
export class TournamentStateManager {
    constructor() {
        // Storage configuration
        this.storagePrefix = 'memex_tournament_';
        this.storageType = 'localStorage'; // Could be extended to IndexedDB or server storage
        
        // State caching
        this.stateCache = new Map(); // tournamentId -> cached state
        this.saveQueue = new Set(); // tournamentIds pending save
        
        // Auto-save configuration
        this.autoSaveInterval = 30000; // 30 seconds
        this.autoSaveTimer = null;
        this.isDirty = false;
        
        // Statistics tracking
        this.statistics = {
            totalTournaments: 0,
            completedTournaments: 0,
            totalMatches: 0,
            totalPlayers: 0,
            averageTournamentDuration: 0,
            popularFormats: new Map(),
            playerStats: new Map() // playerId -> stats
        };
        
        console.log('[TournamentStateManager] Initialized');
    }

    /**
     * Initialize the state manager
     */
    async initialize() {
        try {
            // Load existing statistics
            await this.loadStatistics();
            
            // Start auto-save timer
            this.startAutoSave();
            
            console.log('[TournamentStateManager] Initialized successfully');
        } catch (error) {
            console.error('[TournamentStateManager] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Save tournament state
     * @param {Object} tournament - Tournament data to save
     */
    async saveTournamentState(tournament) {
        if (!tournament || !tournament.tournamentId) {
            throw new Error('Invalid tournament data for saving');
        }

        try {
            const tournamentId = tournament.tournamentId;
            const stateKey = `${this.storagePrefix}${tournamentId}`;
            
            // Prepare tournament data for storage
            const stateData = this.prepareTournamentForStorage(tournament);
            
            // Save to storage
            await this.saveToStorage(stateKey, stateData);
            
            // Update cache
            this.stateCache.set(tournamentId, stateData);
            
            // Mark as saved
            this.saveQueue.delete(tournamentId);
            
            console.log(`[TournamentStateManager] Tournament state saved: ${tournamentId}`);
            
        } catch (error) {
            console.error('[TournamentStateManager] Failed to save tournament state:', error);
            throw error;
        }
    }

    /**
     * Load tournament state
     * @param {string} tournamentId - Tournament ID to load
     * @returns {Object|null} Tournament data or null if not found
     */
    async loadTournamentState(tournamentId) {
        try {
            // Check cache first
            if (this.stateCache.has(tournamentId)) {
                return this.stateCache.get(tournamentId);
            }

            const stateKey = `${this.storagePrefix}${tournamentId}`;
            const stateData = await this.loadFromStorage(stateKey);
            
            if (stateData) {
                // Cache the loaded state
                this.stateCache.set(tournamentId, stateData);
                console.log(`[TournamentStateManager] Tournament state loaded: ${tournamentId}`);
                return stateData;
            }
            
            return null;
            
        } catch (error) {
            console.error('[TournamentStateManager] Failed to load tournament state:', error);
            return null;
        }
    }

    /**
     * Load all active tournaments
     * @returns {Array} Array of active tournament data
     */
    async loadActiveTournaments() {
        try {
            const activeTournaments = [];
            const keys = await this.getAllStorageKeys();
            
            for (const key of keys) {
                if (key.startsWith(this.storagePrefix) && !key.includes('_archive_') && !key.includes('_stats')) {
                    const tournamentData = await this.loadFromStorage(key);
                    
                    if (tournamentData && 
                        (tournamentData.status === 'active' || tournamentData.status === 'registration')) {
                        activeTournaments.push(tournamentData);
                    }
                }
            }
            
            console.log(`[TournamentStateManager] Loaded ${activeTournaments.length} active tournaments`);
            return activeTournaments;
            
        } catch (error) {
            console.error('[TournamentStateManager] Failed to load active tournaments:', error);
            return [];
        }
    }

    /**
     * Archive completed tournament
     * @param {Object} tournament - Tournament to archive
     */
    async archiveTournament(tournament) {
        try {
            const tournamentId = tournament.tournamentId;
            const archiveKey = `${this.storagePrefix}archive_${tournamentId}`;
            
            // Prepare archive data with additional metadata
            const archiveData = {
                ...this.prepareTournamentForStorage(tournament),
                archivedAt: Date.now(),
                archiveVersion: '1.0'
            };
            
            // Save to archive storage
            await this.saveToStorage(archiveKey, archiveData);
            
            // Remove from active storage
            const activeKey = `${this.storagePrefix}${tournamentId}`;
            await this.removeFromStorage(activeKey);
            
            // Remove from cache
            this.stateCache.delete(tournamentId);
            
            // Update statistics
            await this.updateStatistics(tournament);
            
            console.log(`[TournamentStateManager] Tournament archived: ${tournamentId}`);
            
        } catch (error) {
            console.error('[TournamentStateManager] Failed to archive tournament:', error);
            throw error;
        }
    }

    /**
     * Get archived tournament
     * @param {string} tournamentId - Tournament ID
     * @returns {Object|null} Archived tournament data
     */
    async getArchivedTournament(tournamentId) {
        try {
            const archiveKey = `${this.storagePrefix}archive_${tournamentId}`;
            return await this.loadFromStorage(archiveKey);
        } catch (error) {
            console.error('[TournamentStateManager] Failed to load archived tournament:', error);
            return null;
        }
    }

    /**
     * List archived tournaments
     * @param {Object} options - Filtering options
     * @returns {Array} Array of archived tournament summaries
     */
    async listArchivedTournaments(options = {}) {
        try {
            const { limit = 50, offset = 0, startDate, endDate, format } = options;
            const archives = [];
            const keys = await this.getAllStorageKeys();
            
            for (const key of keys) {
                if (key.startsWith(`${this.storagePrefix}archive_`)) {
                    const archiveData = await this.loadFromStorage(key);
                    
                    if (archiveData) {
                        // Apply filters
                        if (startDate && archiveData.createdAt < startDate) continue;
                        if (endDate && archiveData.createdAt > endDate) continue;
                        if (format && archiveData.config?.format !== format) continue;
                        
                        // Create summary data
                        archives.push({
                            tournamentId: archiveData.tournamentId,
                            name: archiveData.config?.name,
                            format: archiveData.config?.format,
                            playerCount: archiveData.registeredPlayers?.length || 0,
                            winner: archiveData.winner,
                            duration: archiveData.duration,
                            completedAt: archiveData.completedAt,
                            archivedAt: archiveData.archivedAt
                        });
                    }
                }
            }
            
            // Sort by completion date (newest first)
            archives.sort((a, b) => b.completedAt - a.completedAt);
            
            // Apply pagination
            const paginatedArchives = archives.slice(offset, offset + limit);
            
            console.log(`[TournamentStateManager] Listed ${paginatedArchives.length} archived tournaments`);
            return paginatedArchives;
            
        } catch (error) {
            console.error('[TournamentStateManager] Failed to list archived tournaments:', error);
            return [];
        }
    }

    /**
     * Save match history
     * @param {string} tournamentId - Tournament ID
     * @param {Object} matchData - Match data to save
     */
    async saveMatchHistory(tournamentId, matchData) {
        try {
            const historyKey = `${this.storagePrefix}history_${tournamentId}`;
            
            // Load existing history
            let history = await this.loadFromStorage(historyKey) || { matches: [] };
            
            // Add new match
            history.matches.push({
                ...matchData,
                savedAt: Date.now()
            });
            
            // Save updated history
            await this.saveToStorage(historyKey, history);
            
            console.log(`[TournamentStateManager] Match history saved: ${matchData.matchId}`);
            
        } catch (error) {
            console.error('[TournamentStateManager] Failed to save match history:', error);
        }
    }

    /**
     * Get match history for tournament
     * @param {string} tournamentId - Tournament ID
     * @returns {Array} Array of match history
     */
    async getMatchHistory(tournamentId) {
        try {
            const historyKey = `${this.storagePrefix}history_${tournamentId}`;
            const history = await this.loadFromStorage(historyKey);
            
            return history ? history.matches : [];
            
        } catch (error) {
            console.error('[TournamentStateManager] Failed to load match history:', error);
            return [];
        }
    }

    /**
     * Update and save tournament statistics
     * @param {Object} tournament - Completed tournament data
     */
    async updateStatistics(tournament) {
        try {
            // Update overall statistics
            this.statistics.totalTournaments++;
            this.statistics.completedTournaments++;
            this.statistics.totalPlayers += tournament.registeredPlayers?.length || 0;
            
            // Update average tournament duration
            if (tournament.duration) {
                const currentAvg = this.statistics.averageTournamentDuration;
                const count = this.statistics.completedTournaments;
                this.statistics.averageTournamentDuration = 
                    ((currentAvg * (count - 1)) + tournament.duration) / count;
            }
            
            // Update popular formats
            const format = tournament.config?.format;
            if (format) {
                const currentCount = this.statistics.popularFormats.get(format) || 0;
                this.statistics.popularFormats.set(format, currentCount + 1);
            }
            
            // Update player statistics
            if (tournament.registeredPlayers) {
                tournament.registeredPlayers.forEach(player => {
                    this.updatePlayerStatistics(player, tournament);
                });
            }
            
            // Save statistics
            await this.saveStatistics();
            
        } catch (error) {
            console.error('[TournamentStateManager] Failed to update statistics:', error);
        }
    }

    /**
     * Update individual player statistics
     * @param {Object} player - Player data
     * @param {Object} tournament - Tournament data
     */
    updatePlayerStatistics(player, tournament) {
        const playerId = player.playerId;
        let playerStats = this.statistics.playerStats.get(playerId) || {
            playerId,
            playerName: player.playerName,
            tournamentsPlayed: 0,
            tournamentsWon: 0,
            totalMatches: 0,
            matchesWon: 0,
            averageFinishPosition: 0,
            bestFinish: null,
            totalRaceTime: 0,
            favoriteFormat: null,
            lastPlayed: null
        };

        // Update basic stats
        playerStats.tournamentsPlayed++;
        playerStats.lastPlayed = tournament.completedAt;
        
        // Check if player won the tournament
        if (tournament.winner?.playerId === playerId) {
            playerStats.tournamentsWon++;
        }
        
        // Update match statistics from tournament stats
        if (player.tournamentStats) {
            playerStats.totalMatches += player.tournamentStats.matchesPlayed;
            playerStats.matchesWon += player.tournamentStats.matchesWon;
            playerStats.totalRaceTime += player.tournamentStats.totalRaceTime;
            
            // Update average finish position
            const totalPositions = playerStats.averageFinishPosition * (playerStats.tournamentsPlayed - 1);
            const newAverage = (totalPositions + player.tournamentStats.averageFinishPosition) / playerStats.tournamentsPlayed;
            playerStats.averageFinishPosition = newAverage;
        }
        
        // Update best finish
        const currentFinish = this.getPlayerFinishPosition(player, tournament);
        if (!playerStats.bestFinish || currentFinish < playerStats.bestFinish) {
            playerStats.bestFinish = currentFinish;
        }
        
        // Update favorite format
        const format = tournament.config?.format;
        if (format) {
            // Simple implementation - could be more sophisticated
            playerStats.favoriteFormat = format;
        }
        
        this.statistics.playerStats.set(playerId, playerStats);
    }

    /**
     * Get player's finish position in tournament
     * @param {Object} player - Player data
     * @param {Object} tournament - Tournament data
     * @returns {number} Finish position
     */
    getPlayerFinishPosition(player, tournament) {
        if (!tournament.finalStandings) {
            return tournament.registeredPlayers?.length || 999;
        }
        
        const standing = tournament.finalStandings.find(s => s.playerId === player.playerId);
        return standing ? standing.position : tournament.registeredPlayers?.length || 999;
    }

    /**
     * Get player statistics
     * @param {string} playerId - Player ID
     * @returns {Object|null} Player statistics
     */
    getPlayerStatistics(playerId) {
        return this.statistics.playerStats.get(playerId) || null;
    }

    /**
     * Get overall tournament statistics
     * @returns {Object} Tournament statistics
     */
    getOverallStatistics() {
        return {
            totalTournaments: this.statistics.totalTournaments,
            completedTournaments: this.statistics.completedTournaments,
            totalMatches: this.statistics.totalMatches,
            totalPlayers: this.statistics.totalPlayers,
            averageTournamentDuration: this.statistics.averageTournamentDuration,
            popularFormats: Object.fromEntries(this.statistics.popularFormats),
            uniquePlayers: this.statistics.playerStats.size
        };
    }

    /**
     * Get leaderboard of top players
     * @param {Object} options - Leaderboard options
     * @returns {Array} Top players leaderboard
     */
    getPlayerLeaderboard(options = {}) {
        const { limit = 10, sortBy = 'tournamentsWon' } = options;
        
        const players = Array.from(this.statistics.playerStats.values());
        
        // Sort based on criteria
        players.sort((a, b) => {
            switch (sortBy) {
                case 'tournamentsWon':
                    return b.tournamentsWon - a.tournamentsWon;
                case 'winRate':
                    const aWinRate = a.tournamentsPlayed > 0 ? a.tournamentsWon / a.tournamentsPlayed : 0;
                    const bWinRate = b.tournamentsPlayed > 0 ? b.tournamentsWon / b.tournamentsPlayed : 0;
                    return bWinRate - aWinRate;
                case 'averageFinish':
                    return a.averageFinishPosition - b.averageFinishPosition;
                case 'bestFinish':
                    return (a.bestFinish || 999) - (b.bestFinish || 999);
                default:
                    return b.tournamentsPlayed - a.tournamentsPlayed;
            }
        });
        
        return players.slice(0, limit);
    }

    // Storage utility methods

    /**
     * Prepare tournament data for storage
     * @param {Object} tournament - Tournament data
     * @returns {Object} Storage-ready tournament data
     */
    prepareTournamentForStorage(tournament) {
        return {
            tournamentId: tournament.tournamentId,
            config: tournament.config,
            status: tournament.status,
            registeredPlayers: tournament.registeredPlayers,
            spectators: tournament.spectators,
            bracket: tournament.bracket,
            currentRound: tournament.currentRound,
            totalRounds: tournament.totalRounds,
            currentMatch: tournament.currentMatch,
            stats: tournament.stats,
            createdAt: tournament.createdAt,
            startedAt: tournament.startedAt,
            completedAt: tournament.completedAt,
            duration: tournament.duration,
            winner: tournament.winner,
            finalStandings: tournament.finalStandings,
            registrationDeadline: tournament.registrationDeadline,
            version: '1.0',
            savedAt: Date.now()
        };
    }

    /**
     * Save data to storage
     * @param {string} key - Storage key
     * @param {Object} data - Data to save
     */
    async saveToStorage(key, data) {
        try {
            const serializedData = JSON.stringify(data);
            
            if (this.storageType === 'localStorage') {
                localStorage.setItem(key, serializedData);
            } else {
                // Could extend to other storage types
                throw new Error(`Unsupported storage type: ${this.storageType}`);
            }
            
        } catch (error) {
            console.error('[TournamentStateManager] Storage save failed:', error);
            throw error;
        }
    }

    /**
     * Load data from storage
     * @param {string} key - Storage key
     * @returns {Object|null} Loaded data
     */
    async loadFromStorage(key) {
        try {
            let serializedData;
            
            if (this.storageType === 'localStorage') {
                serializedData = localStorage.getItem(key);
            } else {
                throw new Error(`Unsupported storage type: ${this.storageType}`);
            }
            
            return serializedData ? JSON.parse(serializedData) : null;
            
        } catch (error) {
            console.error('[TournamentStateManager] Storage load failed:', error);
            return null;
        }
    }

    /**
     * Remove data from storage
     * @param {string} key - Storage key
     */
    async removeFromStorage(key) {
        try {
            if (this.storageType === 'localStorage') {
                localStorage.removeItem(key);
            } else {
                throw new Error(`Unsupported storage type: ${this.storageType}`);
            }
        } catch (error) {
            console.error('[TournamentStateManager] Storage removal failed:', error);
            throw error;
        }
    }

    /**
     * Get all storage keys
     * @returns {Array} Array of storage keys
     */
    async getAllStorageKeys() {
        try {
            if (this.storageType === 'localStorage') {
                const keys = [];
                for (let i = 0; i < localStorage.length; i++) {
                    keys.push(localStorage.key(i));
                }
                return keys.filter(key => key && key.startsWith(this.storagePrefix));
            } else {
                throw new Error(`Unsupported storage type: ${this.storageType}`);
            }
        } catch (error) {
            console.error('[TournamentStateManager] Failed to get storage keys:', error);
            return [];
        }
    }

    /**
     * Save statistics to storage
     */
    async saveStatistics() {
        try {
            const statsKey = `${this.storagePrefix}stats`;
            const statsData = {
                ...this.statistics,
                popularFormats: Object.fromEntries(this.statistics.popularFormats),
                playerStats: Object.fromEntries(this.statistics.playerStats),
                savedAt: Date.now()
            };
            
            await this.saveToStorage(statsKey, statsData);
            
        } catch (error) {
            console.error('[TournamentStateManager] Failed to save statistics:', error);
        }
    }

    /**
     * Load statistics from storage
     */
    async loadStatistics() {
        try {
            const statsKey = `${this.storagePrefix}stats`;
            const statsData = await this.loadFromStorage(statsKey);
            
            if (statsData) {
                this.statistics = {
                    ...statsData,
                    popularFormats: new Map(Object.entries(statsData.popularFormats || {})),
                    playerStats: new Map(Object.entries(statsData.playerStats || {}))
                };
                
                console.log('[TournamentStateManager] Statistics loaded successfully');
            }
            
        } catch (error) {
            console.error('[TournamentStateManager] Failed to load statistics:', error);
        }
    }

    /**
     * Start auto-save timer
     */
    startAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
        
        this.autoSaveTimer = setInterval(() => {
            if (this.isDirty) {
                this.performAutoSave();
            }
        }, this.autoSaveInterval);
        
        console.log('[TournamentStateManager] Auto-save started');
    }

    /**
     * Perform auto-save of cached states
     */
    async performAutoSave() {
        try {
            const savePromises = [];
            
            for (const [tournamentId, stateData] of this.stateCache.entries()) {
                if (this.saveQueue.has(tournamentId)) {
                    const stateKey = `${this.storagePrefix}${tournamentId}`;
                    savePromises.push(this.saveToStorage(stateKey, stateData));
                }
            }
            
            await Promise.all(savePromises);
            
            // Clear save queue
            this.saveQueue.clear();
            this.isDirty = false;
            
            console.log('[TournamentStateManager] Auto-save completed');
            
        } catch (error) {
            console.error('[TournamentStateManager] Auto-save failed:', error);
        }
    }

    /**
     * Queue tournament for auto-save
     * @param {string} tournamentId - Tournament ID
     */
    queueForSave(tournamentId) {
        this.saveQueue.add(tournamentId);
        this.isDirty = true;
    }

    /**
     * Clear all tournament data (use with caution)
     * @param {boolean} includeArchives - Whether to clear archives too
     */
    async clearAllData(includeArchives = false) {
        try {
            const keys = await this.getAllStorageKeys();
            const keysToRemove = keys.filter(key => {
                if (includeArchives) {
                    return key.startsWith(this.storagePrefix);
                } else {
                    return key.startsWith(this.storagePrefix) && !key.includes('_archive_');
                }
            });
            
            for (const key of keysToRemove) {
                await this.removeFromStorage(key);
            }
            
            // Clear caches
            this.stateCache.clear();
            this.saveQueue.clear();
            
            console.log(`[TournamentStateManager] Cleared ${keysToRemove.length} tournament records`);
            
        } catch (error) {
            console.error('[TournamentStateManager] Failed to clear data:', error);
            throw error;
        }
    }

    /**
     * Export tournament data for backup
     * @returns {Object} Exported tournament data
     */
    async exportData() {
        try {
            const keys = await this.getAllStorageKeys();
            const exportData = {
                tournaments: {},
                statistics: this.statistics,
                exportedAt: Date.now(),
                version: '1.0'
            };
            
            for (const key of keys) {
                const data = await this.loadFromStorage(key);
                if (data) {
                    exportData.tournaments[key] = data;
                }
            }
            
            return exportData;
            
        } catch (error) {
            console.error('[TournamentStateManager] Failed to export data:', error);
            throw error;
        }
    }

    /**
     * Import tournament data from backup
     * @param {Object} importData - Data to import
     */
    async importData(importData) {
        try {
            if (!importData || !importData.tournaments) {
                throw new Error('Invalid import data');
            }
            
            // Import tournaments
            for (const [key, data] of Object.entries(importData.tournaments)) {
                await this.saveToStorage(key, data);
            }
            
            // Import statistics if available
            if (importData.statistics) {
                this.statistics = {
                    ...importData.statistics,
                    popularFormats: new Map(Object.entries(importData.statistics.popularFormats || {})),
                    playerStats: new Map(Object.entries(importData.statistics.playerStats || {}))
                };
                await this.saveStatistics();
            }
            
            console.log('[TournamentStateManager] Data imported successfully');
            
        } catch (error) {
            console.error('[TournamentStateManager] Failed to import data:', error);
            throw error;
        }
    }

    /**
     * Stop auto-save and cleanup
     */
    cleanup() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
        
        this.stateCache.clear();
        this.saveQueue.clear();
        this.isDirty = false;
        
        console.log('[TournamentStateManager] Cleaned up');
    }

    /**
     * Destroy the state manager
     */
    destroy() {
        this.cleanup();
        console.log('[TournamentStateManager] Destroyed');
    }
}