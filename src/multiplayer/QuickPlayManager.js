/**
 * QuickPlayManager.js - Auto-join functionality for Memex Racing
 * 
 * Handles quick play matchmaking by finding available rooms,
 * preferring rooms with more humans, and balancing skill levels.
 */

import { multiplayerManager } from './MultiplayerManager.js';
import { multiplayerEvents } from './MultiplayerEvents.js';

export class QuickPlayManager {
    constructor() {
        this.isSearching = false;
        this.searchStartTime = null;
        this.maxSearchTime = 30000; // 30 seconds
        this.retryAttempts = 0;
        this.maxRetryAttempts = 3;
        
        // Matchmaking preferences
        this.defaultPreferences = {
            preferMoreHumans: true,
            skillLevel: 'any',
            gameMode: 'standard',
            maxPing: 150,
            minPlayers: 2,
            avoidFullRooms: true,
            regionPreference: 'auto'
        };
        
        console.log('[QuickPlayManager] Initialized');
    }

    /**
     * Start quick play search
     * @param {Object} preferences - Player matchmaking preferences
     * @returns {Promise<Object>} Room data or error
     */
    async startQuickPlay(preferences = {}) {
        if (this.isSearching) {
            throw new Error('Already searching for a room');
        }

        if (!multiplayerManager.isConnected) {
            throw new Error('Not connected to multiplayer server');
        }

        const prefs = { ...this.defaultPreferences, ...preferences };
        
        this.isSearching = true;
        this.searchStartTime = Date.now();
        this.retryAttempts = 0;
        
        console.log('[QuickPlayManager] Starting quick play search with preferences:', prefs);
        
        multiplayerEvents.emit('QUICK_PLAY_SEARCH_STARTED', {
            preferences: prefs,
            maxSearchTime: this.maxSearchTime
        });

        try {
            const roomData = await this.findBestRoom(prefs);
            
            this.isSearching = false;
            console.log(`[QuickPlayManager] Quick play successful: ${roomData.roomCode}`);
            
            multiplayerEvents.emit('QUICK_PLAY_SUCCESS', {
                roomData,
                searchTime: Date.now() - this.searchStartTime
            });
            
            return roomData;
            
        } catch (error) {
            this.isSearching = false;
            console.error('[QuickPlayManager] Quick play failed:', error);
            
            multiplayerEvents.emit('QUICK_PLAY_FAILED', {
                error: error.message,
                searchTime: Date.now() - this.searchStartTime,
                retryAttempts: this.retryAttempts
            });
            
            throw error;
        }
    }

    /**
     * Cancel current quick play search
     */
    cancelQuickPlay() {
        if (!this.isSearching) {
            return;
        }

        this.isSearching = false;
        const searchTime = this.searchStartTime ? Date.now() - this.searchStartTime : 0;
        
        console.log('[QuickPlayManager] Quick play search cancelled');
        
        multiplayerEvents.emit('QUICK_PLAY_CANCELLED', {
            searchTime,
            retryAttempts: this.retryAttempts
        });
    }

    /**
     * Find the best available room for the player
     * @param {Object} preferences - Matchmaking preferences
     * @returns {Promise<Object>} Room data
     * @private
     */
    async findBestRoom(preferences) {
        const searchTimeout = setTimeout(() => {
            throw new Error('Quick play search timeout');
        }, this.maxSearchTime);

        try {
            // Step 1: Try to find existing rooms
            const availableRooms = await this.getAvailableRooms(preferences);
            
            if (availableRooms.length > 0) {
                const bestRoom = this.selectBestRoom(availableRooms, preferences);
                
                if (bestRoom) {
                    clearTimeout(searchTimeout);
                    return await multiplayerManager.joinRoom(bestRoom.roomCode);
                }
            }

            // Step 2: Create new room if no suitable rooms found
            console.log('[QuickPlayManager] No suitable rooms found, creating new room');
            
            const roomOptions = this.generateRoomOptions(preferences);
            clearTimeout(searchTimeout);
            
            return await multiplayerManager.createRoom(roomOptions);
            
        } catch (error) {
            clearTimeout(searchTimeout);
            
            // Retry logic
            if (this.retryAttempts < this.maxRetryAttempts && this.isSearching) {
                this.retryAttempts++;
                console.log(`[QuickPlayManager] Retrying search (attempt ${this.retryAttempts}/${this.maxRetryAttempts})`);
                
                // Wait a bit before retrying
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                if (this.isSearching) {
                    return await this.findBestRoom(preferences);
                }
            }
            
            throw error;
        }
    }

    /**
     * Get list of available rooms from server
     * @param {Object} preferences - Search preferences
     * @returns {Promise<Array>} Available rooms
     * @private
     */
    async getAvailableRooms(preferences) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Get rooms timeout'));
            }, 10000);

            multiplayerManager.socket.emit('get_available_rooms', {
                preferences,
                playerId: multiplayerManager.playerId
            });

            multiplayerManager.socket.once('available_rooms', (rooms) => {
                clearTimeout(timeout);
                console.log(`[QuickPlayManager] Found ${rooms.length} available rooms`);
                resolve(rooms || []);
            });

            multiplayerManager.socket.once('get_rooms_failed', (error) => {
                clearTimeout(timeout);
                console.error('[QuickPlayManager] Failed to get available rooms:', error);
                resolve([]); // Return empty array instead of rejecting
            });
        });
    }

    /**
     * Select the best room from available options
     * @param {Array} rooms - Available rooms
     * @param {Object} preferences - Player preferences
     * @returns {Object|null} Best room or null
     * @private
     */
    selectBestRoom(rooms, preferences) {
        if (rooms.length === 0) {
            return null;
        }

        // Filter rooms based on preferences
        const filteredRooms = rooms.filter(room => {
            // Check if room has space
            if (room.totalPlayers >= room.maxPlayers) {
                return false;
            }

            // Check minimum players if specified
            if (preferences.minPlayers && room.humanPlayers < preferences.minPlayers - 1) {
                return false; // -1 because we'll be joining
            }

            // Check game mode
            if (preferences.gameMode !== 'any' && room.gameMode !== preferences.gameMode) {
                return false;
            }

            // Check ping if available
            if (preferences.maxPing && room.ping && room.ping > preferences.maxPing) {
                return false;
            }

            return true;
        });

        if (filteredRooms.length === 0) {
            return null;
        }

        // Score and sort rooms
        const scoredRooms = filteredRooms.map(room => ({
            ...room,
            score: this.calculateRoomScore(room, preferences)
        }));

        // Sort by score (highest first)
        scoredRooms.sort((a, b) => b.score - a.score);

        console.log(`[QuickPlayManager] Selected room ${scoredRooms[0].roomCode} with score ${scoredRooms[0].score}`);
        
        return scoredRooms[0];
    }

    /**
     * Calculate room score based on preferences
     * @param {Object} room - Room data
     * @param {Object} preferences - Player preferences
     * @returns {number} Room score
     * @private
     */
    calculateRoomScore(room, preferences) {
        let score = 0;

        // Base score for having players
        score += room.humanPlayers * 10;

        // Prefer rooms with more humans if specified
        if (preferences.preferMoreHumans) {
            score += room.humanPlayers * 5;
            score -= room.aiPlayers * 2; // Slight penalty for AI
        }

        // Prefer rooms closer to optimal size (4-5 players)
        const optimalSize = 4;
        const sizeDifference = Math.abs(room.totalPlayers - optimalSize);
        score -= sizeDifference * 3;

        // Bonus for rooms that are almost ready to start
        const readyRatio = room.readyPlayers / Math.max(room.totalPlayers, 1);
        score += readyRatio * 8;

        // Slight penalty for rooms that are starting soon (might miss it)
        if (room.isStarting) {
            score -= 5;
        }

        // Ping bonus (lower ping = higher score)
        if (room.ping) {
            score += Math.max(0, (200 - room.ping) / 10);
        }

        // Skill level matching
        if (preferences.skillLevel !== 'any' && room.averageSkillLevel) {
            const skillMatch = this.getSkillMatchScore(preferences.skillLevel, room.averageSkillLevel);
            score += skillMatch;
        }

        // Region preference bonus
        if (preferences.regionPreference === 'auto' || room.region === preferences.regionPreference) {
            score += 5;
        }

        // Game mode exact match bonus
        if (room.gameMode === preferences.gameMode) {
            score += 3;
        }

        return Math.max(0, score);
    }

    /**
     * Get skill level matching score
     * @param {string} playerSkill - Player's skill level
     * @param {string} roomSkill - Room's average skill level
     * @returns {number} Match score
     * @private
     */
    getSkillMatchScore(playerSkill, roomSkill) {
        const skillLevels = ['beginner', 'intermediate', 'advanced', 'expert'];
        const playerIndex = skillLevels.indexOf(playerSkill);
        const roomIndex = skillLevels.indexOf(roomSkill);
        
        if (playerIndex === -1 || roomIndex === -1) {
            return 0;
        }

        const difference = Math.abs(playerIndex - roomIndex);
        
        // Perfect match = 10 points, each level difference = -3 points
        return Math.max(0, 10 - (difference * 3));
    }

    /**
     * Generate room options for creating a new room
     * @param {Object} preferences - Player preferences
     * @returns {Object} Room options
     * @private
     */
    generateRoomOptions(preferences) {
        return {
            maxPlayers: 6,
            isPrivate: false,
            gameMode: preferences.gameMode || 'standard',
            mapSelection: 'random',
            raceTimeout: 300000, // 5 minutes
            autoStart: true,
            fillWithAI: true,
            skillLevel: preferences.skillLevel || 'any',
            region: preferences.regionPreference || 'auto'
        };
    }

    /**
     * Get estimated wait time for quick play
     * @param {Object} preferences - Search preferences
     * @returns {Promise<number>} Estimated wait time in milliseconds
     */
    async getEstimatedWaitTime(preferences = {}) {
        try {
            const prefs = { ...this.defaultPreferences, ...preferences };
            
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    resolve(15000); // Default 15 seconds if no response
                }, 5000);

                multiplayerManager.socket.emit('get_wait_time_estimate', {
                    preferences: prefs,
                    playerId: multiplayerManager.playerId
                });

                multiplayerManager.socket.once('wait_time_estimate', (data) => {
                    clearTimeout(timeout);
                    resolve(data.estimatedWaitTime || 15000);
                });
            });
        } catch (error) {
            console.error('[QuickPlayManager] Failed to get wait time estimate:', error);
            return 15000; // Default fallback
        }
    }

    /**
     * Get current search status
     * @returns {Object} Search status
     */
    getSearchStatus() {
        return {
            isSearching: this.isSearching,
            searchTime: this.searchStartTime ? Date.now() - this.searchStartTime : 0,
            retryAttempts: this.retryAttempts,
            maxSearchTime: this.maxSearchTime
        };
    }

    /**
     * Update search preferences during search
     * @param {Object} newPreferences - Updated preferences
     */
    updatePreferences(newPreferences) {
        if (this.isSearching) {
            console.log('[QuickPlayManager] Updating search preferences during active search');
            
            // Emit preference update
            multiplayerEvents.emit('QUICK_PLAY_PREFERENCES_UPDATED', {
                oldPreferences: this.defaultPreferences,
                newPreferences: { ...this.defaultPreferences, ...newPreferences }
            });
        }
        
        this.defaultPreferences = { ...this.defaultPreferences, ...newPreferences };
    }

    /**
     * Get room recommendations based on player history
     * @param {string} playerId - Player ID
     * @returns {Promise<Array>} Recommended rooms
     */
    async getRecommendedRooms(playerId) {
        try {
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    resolve([]);
                }, 5000);

                multiplayerManager.socket.emit('get_recommended_rooms', {
                    playerId
                });

                multiplayerManager.socket.once('recommended_rooms', (rooms) => {
                    clearTimeout(timeout);
                    resolve(rooms || []);
                });
            });
        } catch (error) {
            console.error('[QuickPlayManager] Failed to get recommended rooms:', error);
            return [];
        }
    }

    /**
     * Check if quick play is available
     * @returns {boolean} Availability status
     */
    isQuickPlayAvailable() {
        return multiplayerManager.isConnected && !multiplayerManager.isInRoom() && !this.isSearching;
    }

    /**
     * Destroy the quick play manager
     */
    destroy() {
        this.cancelQuickPlay();
        console.log('[QuickPlayManager] Destroyed');
    }
}

// Create singleton instance
export const quickPlayManager = new QuickPlayManager();