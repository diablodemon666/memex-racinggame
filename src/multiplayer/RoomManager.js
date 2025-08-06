/**
 * RoomManager.js - Room state management for Memex Racing
 * 
 * Manages player slots, AI filling, ready states, and auto-start logic
 * for multiplayer racing rooms.
 */

import { multiplayerEvents, MULTIPLAYER_EVENTS } from './MultiplayerEvents.js';

export class RoomManager {
    constructor() {
        this.roomData = null;
        this.players = new Map(); // playerId -> player data
        this.readyStates = new Map(); // playerId -> boolean
        this.aiPlayers = new Map(); // aiId -> ai player data
        
        // Configuration
        this.maxPlayers = 6;
        this.autoStartDelay = 5000; // 5 seconds after all ready
        this.fillWithAI = true;
        this.autoStartTimer = null;
        
        // Room state
        this.isStarting = false;
        this.isInGame = false;
        
        console.log('[RoomManager] Initialized');
        
        // Listen to multiplayer events
        this.setupEventListeners();
    }

    /**
     * Initialize room with data
     * @param {Object} roomData - Room configuration and state
     */
    initializeRoom(roomData) {
        this.roomData = roomData;
        this.maxPlayers = roomData.maxPlayers || 6;
        this.fillWithAI = roomData.fillWithAI !== false;
        
        // Initialize players from room data if any
        if (roomData.players) {
            this.players.clear();
            this.readyStates.clear();
            
            roomData.players.forEach(player => {
                this.players.set(player.playerId, player);
                this.readyStates.set(player.playerId, player.isReady || false);
            });
        }
        
        console.log(`[RoomManager] Room initialized: ${roomData.roomCode} with ${this.players.size} players`);
        
        // Fill remaining slots with AI if enabled
        if (this.fillWithAI) {
            this.fillEmptySlotsWithAI();
        }
        
        this.emitRoomUpdate();
    }

    /**
     * Add player to room
     * @param {Object} playerData - Player information
     * @returns {boolean} Success status
     */
    addPlayer(playerData) {
        if (this.players.size >= this.maxPlayers) {
            console.warn(`[RoomManager] Cannot add player - room is full (${this.maxPlayers})`);
            return false;
        }

        if (this.players.has(playerData.playerId)) {
            console.warn(`[RoomManager] Player ${playerData.playerId} already in room`);
            return false;
        }

        // Remove AI player if we're replacing one
        if (this.players.size + this.aiPlayers.size >= this.maxPlayers && this.aiPlayers.size > 0) {
            const aiPlayerToRemove = this.aiPlayers.keys().next().value;
            this.removeAIPlayer(aiPlayerToRemove);
        }

        this.players.set(playerData.playerId, {
            ...playerData,
            joinedAt: Date.now(),
            isReady: false,
            isAI: false
        });
        
        this.readyStates.set(playerData.playerId, false);
        
        console.log(`[RoomManager] Player ${playerData.playerName} joined room`);
        
        multiplayerEvents.emit(MULTIPLAYER_EVENTS.PLAYER_JOINED, {
            roomCode: this.roomData?.roomCode,
            player: playerData,
            totalPlayers: this.getTotalPlayerCount()
        });
        
        this.emitRoomUpdate();
        return true;
    }

    /**
     * Remove player from room
     * @param {string} playerId - Player ID to remove
     * @returns {boolean} Success status
     */
    removePlayer(playerId) {
        if (!this.players.has(playerId)) {
            console.warn(`[RoomManager] Player ${playerId} not found in room`);
            return false;
        }

        const playerData = this.players.get(playerId);
        this.players.delete(playerId);
        this.readyStates.delete(playerId);
        
        console.log(`[RoomManager] Player ${playerData.playerName} left room`);
        
        multiplayerEvents.emit(MULTIPLAYER_EVENTS.PLAYER_LEFT, {
            roomCode: this.roomData?.roomCode,
            player: playerData,
            totalPlayers: this.getTotalPlayerCount()
        });
        
        // Fill empty slot with AI if enabled
        if (this.fillWithAI && !this.isInGame) {
            this.fillEmptySlotsWithAI();
        }
        
        // Cancel auto-start if not enough ready players
        if (this.autoStartTimer && !this.canAutoStart()) {
            this.cancelAutoStart();
        }
        
        this.emitRoomUpdate();
        return true;
    }

    /**
     * Set player ready state
     * @param {string} playerId - Player ID
     * @param {boolean} isReady - Ready state
     */
    setPlayerReady(playerId, isReady) {
        if (!this.players.has(playerId)) {
            console.warn(`[RoomManager] Cannot set ready state - player ${playerId} not found`);
            return;
        }

        const wasReady = this.readyStates.get(playerId);
        this.readyStates.set(playerId, isReady);
        
        // Update player data
        const playerData = this.players.get(playerId);
        playerData.isReady = isReady;
        
        console.log(`[RoomManager] Player ${playerData.playerName} ready state: ${isReady}`);
        
        multiplayerEvents.emit(MULTIPLAYER_EVENTS.PLAYER_READY_CHANGED, {
            roomCode: this.roomData?.roomCode,
            playerId,
            playerName: playerData.playerName,
            isReady,
            wasReady
        });
        
        // Check if we can auto-start
        if (isReady && !wasReady) {
            this.checkAutoStart();
        } else if (!isReady && this.autoStartTimer) {
            this.cancelAutoStart();
        }
        
        this.emitRoomUpdate();
    }

    /**
     * Fill empty slots with AI players
     */
    fillEmptySlotsWithAI() {
        const totalCurrentPlayers = this.players.size + this.aiPlayers.size;
        const slotsToFill = this.maxPlayers - totalCurrentPlayers;
        
        if (slotsToFill <= 0) {
            return;
        }

        // AI player names
        const aiNames = [
            'Speedster Bot',
            'Chaos Driver',
            'Lucky Racer',
            'Pixel Pilot',
            'Turbo AI',
            'Racing Machine'
        ];

        for (let i = 0; i < slotsToFill; i++) {
            const aiId = `ai_${Date.now()}_${i}`;
            const aiName = aiNames[this.aiPlayers.size % aiNames.length];
            
            const aiPlayer = {
                playerId: aiId,
                playerName: aiName,
                isAI: true,
                isReady: true,
                joinedAt: Date.now(),
                skillLevel: this.generateAISkillLevel(),
                personality: this.generateAIPersonality()
            };
            
            this.aiPlayers.set(aiId, aiPlayer);
            this.readyStates.set(aiId, true);
            
            console.log(`[RoomManager] Added AI player: ${aiName}`);
        }
        
        // Check auto-start after adding AI
        this.checkAutoStart();
    }

    /**
     * Remove AI player
     * @param {string} aiId - AI player ID
     */
    removeAIPlayer(aiId) {
        if (this.aiPlayers.has(aiId)) {
            const aiPlayer = this.aiPlayers.get(aiId);
            this.aiPlayers.delete(aiId);
            this.readyStates.delete(aiId);
            
            console.log(`[RoomManager] Removed AI player: ${aiPlayer.playerName}`);
        }
    }

    /**
     * Check if room can auto-start
     * @returns {boolean} Can auto-start status
     */
    canAutoStart() {
        if (this.isStarting || this.isInGame) {
            return false;
        }

        const totalPlayers = this.getTotalPlayerCount();
        if (totalPlayers < 2) {
            return false; // Need at least 2 players
        }

        // Check if all players are ready
        const allReady = Array.from(this.readyStates.values()).every(ready => ready);
        return allReady;
    }

    /**
     * Check and potentially start auto-start timer
     */
    checkAutoStart() {
        if (!this.canAutoStart()) {
            return;
        }

        if (this.autoStartTimer) {
            return; // Already counting down
        }

        console.log(`[RoomManager] All players ready - starting auto-start countdown (${this.autoStartDelay}ms)`);
        
        multiplayerEvents.emit('AUTO_START_COUNTDOWN', {
            roomCode: this.roomData?.roomCode,
            countdown: this.autoStartDelay
        });
        
        this.autoStartTimer = setTimeout(() => {
            this.startGame();
        }, this.autoStartDelay);
    }

    /**
     * Cancel auto-start timer
     */
    cancelAutoStart() {
        if (this.autoStartTimer) {
            clearTimeout(this.autoStartTimer);
            this.autoStartTimer = null;
            
            console.log('[RoomManager] Auto-start cancelled');
            
            multiplayerEvents.emit('AUTO_START_CANCELLED', {
                roomCode: this.roomData?.roomCode
            });
        }
    }

    /**
     * Start the game
     */
    startGame() {
        if (this.isStarting || this.isInGame) {
            console.warn('[RoomManager] Game already starting or in progress');
            return;
        }

        if (!this.canAutoStart()) {
            console.warn('[RoomManager] Cannot start game - conditions not met');
            return;
        }

        this.isStarting = true;
        this.cancelAutoStart();
        
        // Prepare game start data
        const gameData = {
            roomCode: this.roomData?.roomCode,
            players: this.getAllPlayers(),
            startTime: Date.now() + 3000, // 3 second countdown
            gameSettings: this.roomData?.gameSettings || {}
        };
        
        console.log(`[RoomManager] Starting game with ${gameData.players.length} players`);
        
        multiplayerEvents.emit(MULTIPLAYER_EVENTS.GAME_STARTED, gameData);
        
        // Set game state after countdown
        setTimeout(() => {
            this.isInGame = true;
            this.isStarting = false;
        }, 3000);
    }

    /**
     * End the current game
     * @param {Object} raceResults - Race results data
     */
    endGame(raceResults) {
        if (!this.isInGame) {
            console.warn('[RoomManager] No game in progress');
            return;
        }

        this.isInGame = false;
        this.isStarting = false;
        
        // Reset ready states for next game
        this.readyStates.forEach((_, playerId) => {
            this.readyStates.set(playerId, false);
        });
        
        console.log('[RoomManager] Game ended');
        
        multiplayerEvents.emit(MULTIPLAYER_EVENTS.RACE_FINISHED, {
            roomCode: this.roomData?.roomCode,
            results: raceResults,
            nextGameIn: 10000 // 10 seconds until next game can start
        });
        
        this.emitRoomUpdate();
    }

    /**
     * Get all players (human + AI)
     * @returns {Array} All players
     */
    getAllPlayers() {
        const allPlayers = [];
        
        // Add human players
        this.players.forEach(player => {
            allPlayers.push({
                ...player,
                isReady: this.readyStates.get(player.playerId)
            });
        });
        
        // Add AI players
        this.aiPlayers.forEach(aiPlayer => {
            allPlayers.push({
                ...aiPlayer,
                isReady: this.readyStates.get(aiPlayer.playerId)
            });
        });
        
        return allPlayers;
    }

    /**
     * Get total player count
     * @returns {number} Total players
     */
    getTotalPlayerCount() {
        return this.players.size + this.aiPlayers.size;
    }

    /**
     * Get human player count
     * @returns {number} Human players only
     */
    getHumanPlayerCount() {
        return this.players.size;
    }

    /**
     * Get ready player count
     * @returns {number} Ready players
     */
    getReadyPlayerCount() {
        return Array.from(this.readyStates.values()).filter(ready => ready).length;
    }

    /**
     * Generate AI skill level
     * @returns {string} Skill level
     * @private
     */
    generateAISkillLevel() {
        const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
        const weights = [0.3, 0.4, 0.2, 0.1]; // More beginners/intermediate
        
        const random = Math.random();
        let sum = 0;
        
        for (let i = 0; i < levels.length; i++) {
            sum += weights[i];
            if (random <= sum) {
                return levels[i];
            }
        }
        
        return 'intermediate';
    }

    /**
     * Generate AI personality traits
     * @returns {Object} Personality traits
     * @private
     */
    generateAIPersonality() {
        const traits = {
            aggression: Math.random(), // 0-1, how aggressive in racing
            consistency: Math.random(), // 0-1, how consistent performance is
            riskTaking: Math.random(), // 0-1, how likely to take risks
            adaptability: Math.random() // 0-1, how well adapts to situations
        };
        
        return traits;
    }

    /**
     * Emit room update to all listeners
     * @private
     */
    emitRoomUpdate() {
        const roomUpdate = {
            roomCode: this.roomData?.roomCode,
            players: this.getAllPlayers(),
            totalPlayers: this.getTotalPlayerCount(),
            humanPlayers: this.getHumanPlayerCount(),
            readyPlayers: this.getReadyPlayerCount(),
            maxPlayers: this.maxPlayers,
            isStarting: this.isStarting,
            isInGame: this.isInGame,
            canStart: this.canAutoStart()
        };
        
        multiplayerEvents.emit('ROOM_UPDATE', roomUpdate);
    }

    /**
     * Setup event listeners
     * @private
     */
    setupEventListeners() {
        multiplayerEvents.on(MULTIPLAYER_EVENTS.ROOM_JOINED, (data) => {
            if (data.roomData) {
                this.initializeRoom(data.roomData);
            }
        });
        
        multiplayerEvents.on(MULTIPLAYER_EVENTS.ROOM_LEFT, () => {
            this.cleanup();
        });
        
        multiplayerEvents.on(MULTIPLAYER_EVENTS.MULTIPLAYER_DISCONNECTED, () => {
            this.cleanup();
        });
    }

    /**
     * Get room status information
     * @returns {Object} Room status
     */
    getStatus() {
        return {
            roomCode: this.roomData?.roomCode,
            totalPlayers: this.getTotalPlayerCount(),
            humanPlayers: this.getHumanPlayerCount(),
            aiPlayers: this.aiPlayers.size,
            readyPlayers: this.getReadyPlayerCount(),
            maxPlayers: this.maxPlayers,
            isStarting: this.isStarting,
            isInGame: this.isInGame,
            canStart: this.canAutoStart(),
            hasAutoStartTimer: !!this.autoStartTimer
        };
    }

    /**
     * Cleanup room manager
     */
    cleanup() {
        this.cancelAutoStart();
        this.players.clear();
        this.readyStates.clear();
        this.aiPlayers.clear();
        this.roomData = null;
        this.isStarting = false;
        this.isInGame = false;
        
        console.log('[RoomManager] Cleaned up');
    }

    /**
     * Destroy the room manager
     */
    destroy() {
        this.cleanup();
        console.log('[RoomManager] Destroyed');
    }
}

// Create singleton instance
export const roomManager = new RoomManager();