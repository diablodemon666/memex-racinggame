/**
 * Ably Multiplayer Manager
 * 
 * Replaces Socket.io with Ably for serverless WebSocket support
 * Maintains compatibility with existing game code
 */

import { getAblyClient } from '../../lib/serverless/ably-client';
import { multiplayerEvents, MULTIPLAYER_EVENTS } from './MultiplayerEvents';

export class AblyMultiplayerManager {
  constructor() {
    this.ablyClient = getAblyClient();
    this.currentRoom = null;
    this.playerId = null;
    this.isHost = false;
    this.connectionStatus = 'disconnected';
    
    this.setupEventHandlers();
  }

  /**
   * Connect to Ably with authentication
   */
  async connect(playerId, username, authToken) {
    try {
      this.playerId = playerId;
      
      // Update connection status
      this.connectionStatus = 'connecting';
      multiplayerEvents.emit(MULTIPLAYER_EVENTS.CONNECTION_STATUS, { 
        status: 'connecting' 
      });

      // Connect to Ably
      await this.ablyClient.connect(authToken, playerId);
      
      this.connectionStatus = 'connected';
      multiplayerEvents.emit(MULTIPLAYER_EVENTS.CONNECTED, {
        playerId,
        username
      });

      return true;
    } catch (error) {
      console.error('[AblyMultiplayer] Connection failed:', error);
      this.connectionStatus = 'error';
      multiplayerEvents.emit(MULTIPLAYER_EVENTS.CONNECTION_ERROR, error);
      throw error;
    }
  }

  /**
   * Create a new room
   */
  async createRoom(settings = {}) {
    try {
      const response = await fetch('/api/game/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        throw new Error('Failed to create room');
      }

      const { room } = await response.json();
      
      // Join the room channel
      await this.ablyClient.joinRoom(room.code);
      
      this.currentRoom = room;
      this.isHost = true;

      multiplayerEvents.emit(MULTIPLAYER_EVENTS.ROOM_CREATED, {
        roomCode: room.code,
        roomId: room.id
      });

      return room;
    } catch (error) {
      console.error('[AblyMultiplayer] Create room failed:', error);
      throw error;
    }
  }

  /**
   * Join an existing room
   */
  async joinRoom(roomCode) {
    try {
      // First, join via API to register
      const response = await fetch('/api/game/rooms', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({ roomCode })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to join room');
      }

      const { room } = await response.json();
      
      // Join the Ably channel
      await this.ablyClient.joinRoom(roomCode);
      
      this.currentRoom = room;
      this.isHost = room.host === this.playerId;

      multiplayerEvents.emit(MULTIPLAYER_EVENTS.JOINED_ROOM, {
        roomCode: room.code,
        players: room.players
      });

      return room;
    } catch (error) {
      console.error('[AblyMultiplayer] Join room failed:', error);
      throw error;
    }
  }

  /**
   * Leave current room
   */
  async leaveRoom() {
    if (!this.currentRoom) return;

    try {
      // Leave via API
      await fetch('/api/game/rooms', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({ roomCode: this.currentRoom.code })
      });

      // Leave Ably channel
      await this.ablyClient.leaveRoom();

      multiplayerEvents.emit(MULTIPLAYER_EVENTS.LEFT_ROOM, {
        roomCode: this.currentRoom.code
      });

      this.currentRoom = null;
      this.isHost = false;
    } catch (error) {
      console.error('[AblyMultiplayer] Leave room failed:', error);
    }
  }

  /**
   * Send player update
   */
  async updatePlayerState(state) {
    if (!this.currentRoom) return;

    try {
      await this.ablyClient.updatePlayerState(state);
    } catch (error) {
      console.error('[AblyMultiplayer] Update state failed:', error);
    }
  }

  /**
   * Place a bet
   */
  async placeBet(targetPlayerId, amount) {
    if (!this.currentRoom) return;

    try {
      const result = await this.ablyClient.placeBet(targetPlayerId, amount);
      return result;
    } catch (error) {
      console.error('[AblyMultiplayer] Place bet failed:', error);
      throw error;
    }
  }

  /**
   * Activate skill
   */
  async activateSkill(skillType) {
    if (!this.currentRoom) return;

    try {
      await this.ablyClient.activateSkill(skillType);
    } catch (error) {
      console.error('[AblyMultiplayer] Activate skill failed:', error);
    }
  }

  /**
   * Start betting phase (host only)
   */
  async startBettingPhase() {
    if (!this.isHost || !this.currentRoom) return;

    try {
      await fetch('/api/game/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          action: 'startBetting',
          roomId: this.currentRoom.code
        })
      });
    } catch (error) {
      console.error('[AblyMultiplayer] Start betting failed:', error);
    }
  }

  /**
   * Start race (host only)
   */
  async startRace() {
    if (!this.isHost || !this.currentRoom) return;

    try {
      await fetch('/api/game/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          action: 'startRace',
          roomId: this.currentRoom.code
        })
      });
    } catch (error) {
      console.error('[AblyMultiplayer] Start race failed:', error);
    }
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // Forward Ably events to MultiplayerEvents
    this.ablyClient.on('playerJoined', (data) => {
      multiplayerEvents.emit(MULTIPLAYER_EVENTS.PLAYER_JOINED, data);
    });

    this.ablyClient.on('playerLeft', (data) => {
      multiplayerEvents.emit(MULTIPLAYER_EVENTS.PLAYER_LEFT, data);
    });

    this.ablyClient.on('gameStateUpdate', (data) => {
      multiplayerEvents.emit(MULTIPLAYER_EVENTS.GAME_STATE_UPDATE, data);
    });

    this.ablyClient.on('playerUpdate', (data) => {
      multiplayerEvents.emit(MULTIPLAYER_EVENTS.PLAYER_UPDATE, data);
    });

    this.ablyClient.on('raceStart', (data) => {
      multiplayerEvents.emit(MULTIPLAYER_EVENTS.RACE_STARTED, data);
    });

    this.ablyClient.on('raceFinish', (data) => {
      multiplayerEvents.emit(MULTIPLAYER_EVENTS.RACE_FINISHED, data);
    });

    this.ablyClient.on('betPlaced', (data) => {
      multiplayerEvents.emit(MULTIPLAYER_EVENTS.BET_PLACED, data);
    });

    this.ablyClient.on('bettingPhaseStart', (data) => {
      multiplayerEvents.emit(MULTIPLAYER_EVENTS.BETTING_PHASE_START, data);
    });

    this.ablyClient.on('powerUpCollected', (data) => {
      multiplayerEvents.emit(MULTIPLAYER_EVENTS.POWER_UP_COLLECTED, data);
    });

    this.ablyClient.on('skillActivated', (data) => {
      multiplayerEvents.emit(MULTIPLAYER_EVENTS.SKILL_ACTIVATED, data);
    });
  }

  /**
   * Get auth token from storage
   */
  getAuthToken() {
    return localStorage.getItem('authToken') || '';
  }

  /**
   * Disconnect from Ably
   */
  disconnect() {
    if (this.currentRoom) {
      this.leaveRoom();
    }
    
    this.ablyClient.disconnect();
    this.connectionStatus = 'disconnected';
    
    multiplayerEvents.emit(MULTIPLAYER_EVENTS.DISCONNECTED);
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return this.connectionStatus;
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.ablyClient.isConnected();
  }

  /**
   * Get current room info
   */
  getCurrentRoom() {
    return this.currentRoom;
  }

  /**
   * Get room members
   */
  async getRoomMembers() {
    if (!this.currentRoom) return [];
    return await this.ablyClient.getRoomMembers();
  }
}

// Export singleton instance
let multiplayerManager = null;

export function getAblyMultiplayerManager() {
  if (!multiplayerManager) {
    multiplayerManager = new AblyMultiplayerManager();
  }
  return multiplayerManager;
}