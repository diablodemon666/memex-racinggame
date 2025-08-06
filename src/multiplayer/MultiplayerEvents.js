/**
 * MultiplayerEvents.js - Shared Event System for Memex Racing
 * 
 * Handles multiplayer events like PLAYER_JOINED, ROOM_CREATED, GAME_STARTED, RACE_FINISHED
 * Provides centralized event management across scenes and systems.
 */

export class MultiplayerEvents {
    constructor() {
        this.eventHandlers = new Map();
        this.isConnected = false;
        this.playerId = null;
        this.roomId = null;
        
        console.log('[MultiplayerEvents] Event system initialized');
    }

    /**
     * Add event listener
     * @param {string} eventName - Event name
     * @param {Function} handler - Event handler function
     */
    on(eventName, handler) {
        if (!this.eventHandlers.has(eventName)) {
            this.eventHandlers.set(eventName, []);
        }
        
        this.eventHandlers.get(eventName).push(handler);
        console.log(`[MultiplayerEvents] Added listener for: ${eventName}`);
    }

    /**
     * Remove event listener
     * @param {string} eventName - Event name
     * @param {Function} handler - Event handler function
     */
    off(eventName, handler) {
        if (this.eventHandlers.has(eventName)) {
            const handlers = this.eventHandlers.get(eventName);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
                console.log(`[MultiplayerEvents] Removed listener for: ${eventName}`);
            }
        }
    }

    /**
     * Emit event to all listeners
     * @param {string} eventName - Event name
     * @param {Object} data - Event data
     */
    emit(eventName, data = {}) {
        console.log(`[MultiplayerEvents] Emitting: ${eventName}`, data);
        
        if (this.eventHandlers.has(eventName)) {
            this.eventHandlers.get(eventName).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`[MultiplayerEvents] Error in ${eventName} handler:`, error);
                }
            });
        }
        
        // Also emit to socket if connected
        this.emitToSocket(eventName, data);
    }

    /**
     * Connect to multiplayer server
     * @param {string} playerId - Player ID
     */
    connect(playerId) {
        this.playerId = playerId;
        this.isConnected = true; // Simplified for now
        
        console.log(`[MultiplayerEvents] Connected as player: ${playerId}`);
        this.emit('MULTIPLAYER_CONNECTED', { playerId });
    }

    /**
     * Disconnect from multiplayer server
     */
    disconnect() {
        this.isConnected = false;
        this.playerId = null;
        this.roomId = null;
        
        console.log('[MultiplayerEvents] Disconnected from multiplayer');
        this.emit('MULTIPLAYER_DISCONNECTED');
    }

    /**
     * Join or create a room
     * @param {string} roomId - Room ID
     * @param {Object} roomData - Room data
     */
    joinRoom(roomId, roomData = {}) {
        this.roomId = roomId;
        
        console.log(`[MultiplayerEvents] Joining room: ${roomId}`);
        this.emit('ROOM_JOINED', { roomId, roomData, playerId: this.playerId });
    }

    /**
     * Leave current room
     */
    leaveRoom() {
        const oldRoomId = this.roomId;
        this.roomId = null;
        
        console.log(`[MultiplayerEvents] Left room: ${oldRoomId}`);
        this.emit('ROOM_LEFT', { roomId: oldRoomId, playerId: this.playerId });
    }

    /**
     * Handle player joining room
     * @param {Object} playerData - Player data
     */
    handlePlayerJoined(playerData) {
        console.log('[MultiplayerEvents] Player joined:', playerData);
        this.emit('PLAYER_JOINED', playerData);
    }

    /**
     * Handle player leaving room
     * @param {Object} playerData - Player data
     */
    handlePlayerLeft(playerData) {
        console.log('[MultiplayerEvents] Player left:', playerData);
        this.emit('PLAYER_LEFT', playerData);
    }

    /**
     * Handle room creation
     * @param {Object} roomData - Room data
     */
    handleRoomCreated(roomData) {
        console.log('[MultiplayerEvents] Room created:', roomData);
        this.emit('ROOM_CREATED', roomData);
    }

    /**
     * Handle game start
     * @param {Object} gameData - Game data
     */
    handleGameStarted(gameData) {
        console.log('[MultiplayerEvents] Game started:', gameData);
        this.emit('GAME_STARTED', gameData);
    }

    /**
     * Handle race finish
     * @param {Object} raceData - Race result data
     */
    handleRaceFinished(raceData) {
        console.log('[MultiplayerEvents] Race finished:', raceData);
        this.emit('RACE_FINISHED', raceData);
    }

    /**
     * Handle player ready state change
     * @param {Object} readyData - Ready state data
     */
    handlePlayerReady(readyData) {
        console.log('[MultiplayerEvents] Player ready state changed:', readyData);
        this.emit('PLAYER_READY_CHANGED', readyData);
    }

    /**
     * Set socket instance for real socket.io integration
     * @param {Object} socket - Socket.io client instance
     */
    setSocket(socket) {
        this.socket = socket;
    }

    /**
     * Emit event to socket (real socket.io integration)
     * @param {string} eventName - Event name
     * @param {Object} data - Event data
     */
    emitToSocket(eventName, data) {
        if (!this.isConnected || !this.socket) return;
        
        // Real socket.io implementation
        try {
            this.socket.emit(eventName, data);
            console.log(`[MultiplayerEvents] Emitted to socket: ${eventName}`, data);
        } catch (error) {
            console.error(`[MultiplayerEvents] Failed to emit to socket: ${eventName}`, error);
        }
    }

    /**
     * Setup socket event listeners (placeholder)
     */
    setupSocketListeners() {
        // In real implementation, this would setup socket.io listeners
        console.log('[MultiplayerEvents] Setting up socket listeners (placeholder)');
        
        // Example:
        // socket.on('PLAYER_JOINED', this.handlePlayerJoined.bind(this));
        // socket.on('PLAYER_LEFT', this.handlePlayerLeft.bind(this));
        // socket.on('ROOM_CREATED', this.handleRoomCreated.bind(this));
        // socket.on('GAME_STARTED', this.handleGameStarted.bind(this));
        // socket.on('RACE_FINISHED', this.handleRaceFinished.bind(this));
    }

    /**
     * Get current connection status
     * @returns {Object} Connection status
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            playerId: this.playerId,
            roomId: this.roomId,
            eventCount: this.eventHandlers.size
        };
    }

    /**
     * Get list of registered events
     * @returns {Array} Event names
     */
    getRegisteredEvents() {
        return Array.from(this.eventHandlers.keys());
    }

    /**
     * Clear all event handlers
     */
    clearAllHandlers() {
        this.eventHandlers.clear();
        console.log('[MultiplayerEvents] All event handlers cleared');
    }

    /**
     * Destroy the event system
     */
    destroy() {
        this.clearAllHandlers();
        this.disconnect();
        console.log('[MultiplayerEvents] Event system destroyed');
    }
}

// Create singleton instance
export const multiplayerEvents = new MultiplayerEvents();

// Export event constants
export const MULTIPLAYER_EVENTS = {
    PLAYER_JOINED: 'PLAYER_JOINED',
    PLAYER_LEFT: 'PLAYER_LEFT',
    ROOM_CREATED: 'ROOM_CREATED',
    ROOM_JOINED: 'ROOM_JOINED',
    ROOM_LEFT: 'ROOM_LEFT',
    GAME_STARTED: 'GAME_STARTED',
    RACE_FINISHED: 'RACE_FINISHED',
    PLAYER_READY_CHANGED: 'PLAYER_READY_CHANGED',
    MULTIPLAYER_CONNECTED: 'MULTIPLAYER_CONNECTED',
    MULTIPLAYER_DISCONNECTED: 'MULTIPLAYER_DISCONNECTED'
};