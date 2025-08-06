/**
 * MultiplayerManager.js - Main multiplayer client using Socket.io
 * 
 * Handles connection to server, room management, and player synchronization
 * for the Memex Racing multiplayer system.
 */

import { io } from 'socket.io-client';
import { multiplayerEvents, MULTIPLAYER_EVENTS } from './MultiplayerEvents.js';
import { memoryRegistry } from '../utils/MemoryRegistry.js';

export class MultiplayerManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.playerId = null;
        this.playerName = null;
        this.currentRoom = null;
        
        // Memory management
        this.memoryScope = 'MultiplayerManager';
        this.connectionTimeouts = new Map();
        this.eventListeners = new Map();
        
        // Connection settings
        this.serverUrl = process.env.NODE_ENV === 'production' 
            ? 'ws://localhost:3001' 
            : 'ws://localhost:3001';
        
        this.connectionOptions = {
            timeout: 30000,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            transports: ['websocket', 'polling']
        };
        
        console.log('[MultiplayerManager] Initialized with memory management');
    }

    /**
     * Connect to multiplayer server with authenticated user data
     * @param {string} playerId - Unique player identifier (authenticated user ID)
     * @param {string} playerName - Display name for player (authenticated username)
     * @param {Object} userContext - Full authenticated user context
     * @returns {Promise<boolean>} Success status
     */
    async connect(playerId, playerName = null, userContext = null) {
        if (this.isConnected) {
            console.warn('[MultiplayerManager] Already connected');
            return true;
        }

        try {
            this.playerId = playerId;
            this.playerName = playerName || `Player_${playerId?.substring(0, 8) || 'Guest'}`;
            this.userContext = userContext;
            
            console.log(`[MultiplayerManager] Connecting to ${this.serverUrl} as ${this.playerName} (authenticated: ${!!userContext})`);
            
            // Enhanced auth data for multiplayer connection
            const authData = {
                playerId: this.playerId,
                playerName: this.playerName,
                isAuthenticated: !!userContext,
                userLevel: userContext?.statistics?.level || 0,
                userStats: userContext ? {
                    wins: userContext.statistics?.wins || 0,
                    gamesPlayed: userContext.statistics?.gamesPlayed || 0,
                    totalPoints: userContext.statistics?.totalPoints || 0
                } : null
            };
            
            this.socket = io(this.serverUrl, {
                ...this.connectionOptions,
                auth: authData
            });

            return new Promise((resolve, reject) => {
                const timeoutId = `connection_timeout_${Date.now()}`;
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, this.connectionOptions.timeout);
                
                // Register timeout with memory management
                memoryRegistry.registerTimer(timeoutId, timeout, this.memoryScope);

                this.socket.on('connect', () => {
                    // Clear timeout using memory registry
                    memoryRegistry.removeResource(timeoutId, 'timers');
                    this.isConnected = true;
                    
                    // Register socket connection with memory management
                    memoryRegistry.registerWebSocket('main_socket', this.socket, this.memoryScope);
                    
                    // Connect the socket to MultiplayerEvents
                    multiplayerEvents.setSocket(this.socket);
                    multiplayerEvents.connect(this.playerId);
                    
                    this.setupSocketListeners();
                    
                    console.log(`[MultiplayerManager] Connected with socket ID: ${this.socket.id}`);
                    multiplayerEvents.emit(MULTIPLAYER_EVENTS.MULTIPLAYER_CONNECTED, {
                        playerId: this.playerId,
                        playerName: this.playerName,
                        socketId: this.socket.id,
                        isAuthenticated: !!this.userContext,
                        userContext: this.userContext
                    });
                    
                    resolve(true);
                });

                this.socket.on('connect_error', (error) => {
                    // Clear timeout using memory registry
                    memoryRegistry.removeResource(timeoutId, 'timers');
                    console.error('[MultiplayerManager] Connection error:', error);
                    reject(error);
                });
            });

        } catch (error) {
            console.error('[MultiplayerManager] Failed to connect:', error);
            return false;
        }
    }

    /**
     * Disconnect from multiplayer server
     */
    disconnect() {
        if (!this.isConnected || !this.socket) {
            return;
        }

        console.log('[MultiplayerManager] Disconnecting from server and cleaning up resources');
        
        if (this.currentRoom) {
            this.leaveRoom();
        }

        // Clean up socket connection using memory registry
        memoryRegistry.removeResource('main_socket', 'webSocketConnections');
        
        // Clean up all event listeners and timeouts for this manager
        memoryRegistry.cleanupScope(this.memoryScope);
        
        // Disconnect socket
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.isConnected = false;
        this.currentRoom = null;
        
        // Clear local tracking
        this.connectionTimeouts.clear();
        this.eventListeners.clear();
        
        multiplayerEvents.disconnect();
        multiplayerEvents.emit(MULTIPLAYER_EVENTS.MULTIPLAYER_DISCONNECTED, {
            playerId: this.playerId
        });
    }

    /**
     * Create a new multiplayer room
     * @param {Object} roomOptions - Room configuration options
     * @returns {Promise<Object>} Room data including room code
     */
    async createRoom(roomOptions = {}) {
        if (!this.isConnected) {
            throw new Error('Not connected to server');
        }

        const defaultOptions = {
            maxPlayers: 6,
            isPrivate: false,
            gameMode: 'standard',
            mapSelection: 'random',
            raceTimeout: 300000, // 5 minutes
            autoStart: true,
            fillWithAI: true
        };

        const options = { ...defaultOptions, ...roomOptions };
        
        console.log('[MultiplayerManager] Creating room with options:', options);

        return new Promise((resolve, reject) => {
            const timeoutId = `room_creation_timeout_${Date.now()}`;
            const timeout = setTimeout(() => {
                reject(new Error('Room creation timeout'));
            }, 10000);
            
            // Register timeout with memory management
            memoryRegistry.registerTimer(timeoutId, timeout, this.memoryScope);

            this.socket.emit('create_room', {
                playerId: this.playerId,
                playerName: this.playerName,
                options
            });

            this.socket.once('room_created', (roomData) => {
                memoryRegistry.removeResource(timeoutId, 'timers');
                this.currentRoom = roomData;
                
                console.log(`[MultiplayerManager] Room created: ${roomData.roomCode}`);
                multiplayerEvents.handleRoomCreated(roomData);
                multiplayerEvents.joinRoom(roomData.roomCode, roomData);
                
                resolve(roomData);
            });

            this.socket.once('room_creation_failed', (error) => {
                memoryRegistry.removeResource(timeoutId, 'timers');
                console.error('[MultiplayerManager] Room creation failed:', error);
                reject(new Error(error.message || 'Room creation failed'));
            });
        });
    }

    /**
     * Join an existing room by room code
     * @param {string} roomCode - 4-character room code (e.g., "RACE-1234")
     * @returns {Promise<Object>} Room data
     */
    async joinRoom(roomCode) {
        if (!this.isConnected) {
            throw new Error('Not connected to server');
        }

        if (this.currentRoom) {
            await this.leaveRoom();
        }

        console.log(`[MultiplayerManager] Joining room: ${roomCode}`);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Room join timeout'));
            }, 10000);

            this.socket.emit('join_room', {
                roomCode,
                playerId: this.playerId,
                playerName: this.playerName
            });

            this.socket.once('room_joined', (roomData) => {
                clearTimeout(timeout);
                this.currentRoom = roomData;
                
                console.log(`[MultiplayerManager] Successfully joined room: ${roomCode}`);
                multiplayerEvents.joinRoom(roomCode, roomData);
                
                resolve(roomData);
            });

            this.socket.once('room_join_failed', (error) => {
                clearTimeout(timeout);
                console.error('[MultiplayerManager] Room join failed:', error);
                reject(new Error(error.message || 'Failed to join room'));
            });
        });
    }

    /**
     * Auto-join available room (quick play functionality)
     * @param {Object} preferences - Player preferences for matchmaking
     * @returns {Promise<Object>} Room data
     */
    async autoJoinRoom(preferences = {}) {
        if (!this.isConnected) {
            throw new Error('Not connected to server');
        }

        const defaultPreferences = {
            preferMoreHumans: true,
            skillLevel: 'any',
            gameMode: 'standard',
            maxWaitTime: 30000
        };

        const prefs = { ...defaultPreferences, ...preferences };
        
        console.log('[MultiplayerManager] Auto-joining room with preferences:', prefs);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Auto-join timeout'));
            }, prefs.maxWaitTime);

            this.socket.emit('auto_join', {
                playerId: this.playerId,
                playerName: this.playerName,
                preferences: prefs
            });

            this.socket.once('room_joined', (roomData) => {
                clearTimeout(timeout);
                this.currentRoom = roomData;
                
                console.log(`[MultiplayerManager] Auto-joined room: ${roomData.roomCode}`);
                multiplayerEvents.joinRoom(roomData.roomCode, roomData);
                
                resolve(roomData);
            });

            this.socket.once('auto_join_failed', (error) => {
                clearTimeout(timeout);
                console.error('[MultiplayerManager] Auto-join failed:', error);
                reject(new Error(error.message || 'Auto-join failed'));
            });
        });
    }

    /**
     * Invite friend to current room
     * @param {string} friendId - Friend's player ID
     * @returns {Promise<boolean>} Success status
     */
    async inviteFriend(friendId) {
        if (!this.isConnected || !this.currentRoom) {
            throw new Error('Not connected or not in a room');
        }

        console.log(`[MultiplayerManager] Inviting friend ${friendId} to room ${this.currentRoom.roomCode}`);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Invite timeout'));
            }, 10000);

            this.socket.emit('invite_friend', {
                friendId,
                roomCode: this.currentRoom.roomCode,
                inviterId: this.playerId,
                inviterName: this.playerName
            });

            this.socket.once('invite_sent', () => {
                clearTimeout(timeout);
                console.log(`[MultiplayerManager] Invite sent to ${friendId}`);
                resolve(true);
            });

            this.socket.once('invite_failed', (error) => {
                clearTimeout(timeout);
                console.error('[MultiplayerManager] Invite failed:', error);
                reject(new Error(error.message || 'Invite failed'));
            });
        });
    }

    /**
     * Leave current room
     * @returns {Promise<boolean>} Success status
     */
    async leaveRoom() {
        if (!this.currentRoom) {
            return true;
        }

        const roomCode = this.currentRoom.roomCode;
        console.log(`[MultiplayerManager] Leaving room: ${roomCode}`);

        return new Promise((resolve) => {
            this.socket.emit('leave_room', {
                roomCode,
                playerId: this.playerId
            });

            // Don't wait for server response, just clean up locally
            setTimeout(() => {
                this.currentRoom = null;
                multiplayerEvents.leaveRoom();
                console.log(`[MultiplayerManager] Left room: ${roomCode}`);
                resolve(true);
            }, 100);
        });
    }

    /**
     * Set player ready state
     * @param {boolean} isReady - Ready state
     */
    setReady(isReady = true) {
        if (!this.isConnected || !this.currentRoom) {
            return;
        }

        console.log(`[MultiplayerManager] Setting ready state: ${isReady}`);
        
        this.socket.emit('player_ready', {
            roomCode: this.currentRoom.roomCode,
            playerId: this.playerId,
            isReady
        });
    }

    /**
     * Send game state update during race
     * @param {Object} gameState - Current game state
     */
    sendGameState(gameState) {
        if (!this.isConnected || !this.currentRoom) {
            return;
        }

        this.socket.emit('game_state_update', {
            roomCode: this.currentRoom.roomCode,
            playerId: this.playerId,
            gameState,
            timestamp: Date.now()
        });
    }

    /**
     * Setup socket event listeners
     * @private
     */
    setupSocketListeners() {
        if (!this.socket) return;

        // Connection events
        this.socket.on('disconnect', (reason) => {
            console.log(`[MultiplayerManager] Disconnected: ${reason}`);
            this.isConnected = false;
            multiplayerEvents.emit(MULTIPLAYER_EVENTS.MULTIPLAYER_DISCONNECTED, { reason });
        });

        this.socket.on('reconnect', () => {
            console.log('[MultiplayerManager] Reconnected to server');
            this.isConnected = true;
            multiplayerEvents.emit(MULTIPLAYER_EVENTS.MULTIPLAYER_CONNECTED, {
                playerId: this.playerId,
                socketId: this.socket.id
            });
        });

        // Room events
        this.socket.on('player_joined', (data) => {
            console.log('[MultiplayerManager] Player joined room:', data);
            multiplayerEvents.handlePlayerJoined(data);
        });

        this.socket.on('player_left', (data) => {
            console.log('[MultiplayerManager] Player left room:', data);
            multiplayerEvents.handlePlayerLeft(data);
        });

        this.socket.on('player_ready_changed', (data) => {
            console.log('[MultiplayerManager] Player ready state changed:', data);
            multiplayerEvents.handlePlayerReady(data);
        });

        // Game events
        this.socket.on('game_started', (data) => {
            console.log('[MultiplayerManager] Game started:', data);
            multiplayerEvents.handleGameStarted(data);
        });

        this.socket.on('game_state_update', (data) => {
            // High frequency event, don't log
            multiplayerEvents.emit('GAME_STATE_UPDATE', data);
        });

        this.socket.on('race_finished', (data) => {
            console.log('[MultiplayerManager] Race finished:', data);
            multiplayerEvents.handleRaceFinished(data);
        });

        // Friend/invite events
        this.socket.on('friend_invite', (data) => {
            console.log('[MultiplayerManager] Received friend invite:', data);
            multiplayerEvents.emit('FRIEND_INVITE_RECEIVED', data);
        });

        // Error handling
        this.socket.on('error', (error) => {
            console.error('[MultiplayerManager] Socket error:', error);
            multiplayerEvents.emit('MULTIPLAYER_ERROR', { error });
        });
    }

    /**
     * Get current connection status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            playerId: this.playerId,
            playerName: this.playerName,
            currentRoom: this.currentRoom,
            socketId: this.socket?.id || null
        };
    }

    /**
     * Get room information
     * @returns {Object|null} Current room data
     */
    getCurrentRoom() {
        return this.currentRoom;
    }

    /**
     * Check if player is in a room
     * @returns {boolean} Room status
     */
    isInRoom() {
        return !!this.currentRoom;
    }

    /**
     * Destroy the multiplayer manager
     */
    destroy() {
        console.log('[MultiplayerManager] Destroying multiplayer manager');
        
        // Disconnect and cleanup
        this.disconnect();
        
        // Clean up any remaining resources in our scope
        memoryRegistry.cleanupScope(this.memoryScope);
        
        // Clear local state
        this.connectionTimeouts.clear();
        this.eventListeners.clear();
        this.playerId = null;
        this.playerName = null;
        this.userContext = null;
        
        console.log('[MultiplayerManager] Destroyed with full memory cleanup');
    }
}

// Create singleton instance
export const multiplayerManager = new MultiplayerManager();