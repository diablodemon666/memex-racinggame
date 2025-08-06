/**
 * Ably Client for Serverless WebSocket Support
 * 
 * Provides real-time multiplayer functionality using Ably's pub/sub messaging
 * Perfect for serverless deployments on Vercel/Netlify
 */

import Ably from 'ably';

class AblyMultiplayerClient {
  constructor() {
    this.ably = null;
    this.channel = null;
    this.presence = null;
    this.playerId = null;
    this.roomId = null;
    this.callbacks = new Map();
  }

  /**
   * Initialize Ably connection with auth token
   */
  async connect(authToken, playerId) {
    try {
      this.playerId = playerId;
      
      // Initialize Ably with token authentication
      this.ably = new Ably.Realtime({
        authUrl: '/api/auth/ably-token',
        authHeaders: {
          'Authorization': `Bearer ${authToken}`
        },
        echoMessages: false,
        clientId: playerId
      });

      // Wait for connection
      await new Promise((resolve, reject) => {
        this.ably.connection.on('connected', () => {
          console.log('[Ably] Connected to Ably');
          resolve();
        });
        this.ably.connection.on('failed', reject);
      });

      return true;
    } catch (error) {
      console.error('[Ably] Connection failed:', error);
      throw error;
    }
  }

  /**
   * Join a game room
   */
  async joinRoom(roomId) {
    if (!this.ably) throw new Error('Not connected to Ably');
    
    this.roomId = roomId;
    
    // Subscribe to room channel
    this.channel = this.ably.channels.get(`room:${roomId}`);
    this.presence = this.channel.presence;

    // Setup message handlers
    this.setupMessageHandlers();
    
    // Enter presence
    await this.presence.enter({
      playerId: this.playerId,
      timestamp: Date.now()
    });

    // Get current room members
    const members = await this.presence.get();
    return members.map(member => member.data);
  }

  /**
   * Setup message handlers for game events
   */
  setupMessageHandlers() {
    // Game state updates
    this.channel.subscribe('gameState', (message) => {
      this.emit('gameStateUpdate', message.data);
    });

    // Player updates
    this.channel.subscribe('playerUpdate', (message) => {
      this.emit('playerUpdate', message.data);
    });

    // Race events
    this.channel.subscribe('raceStart', (message) => {
      this.emit('raceStart', message.data);
    });

    this.channel.subscribe('raceFinish', (message) => {
      this.emit('raceFinish', message.data);
    });

    // Betting events
    this.channel.subscribe('betPlaced', (message) => {
      this.emit('betPlaced', message.data);
    });

    this.channel.subscribe('bettingPhaseStart', (message) => {
      this.emit('bettingPhaseStart', message.data);
    });

    // Power-up events
    this.channel.subscribe('powerUpCollected', (message) => {
      this.emit('powerUpCollected', message.data);
    });

    this.channel.subscribe('skillActivated', (message) => {
      this.emit('skillActivated', message.data);
    });

    // Presence events
    this.presence.subscribe('enter', (member) => {
      this.emit('playerJoined', member.data);
    });

    this.presence.subscribe('leave', (member) => {
      this.emit('playerLeft', member.data);
    });
  }

  /**
   * Send game action to server
   */
  async sendAction(action, data) {
    if (!this.channel) throw new Error('Not in a room');

    try {
      // Send via serverless function
      const response = await fetch('/api/game/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          roomId: this.roomId,
          playerId: this.playerId,
          action,
          data
        })
      });

      if (!response.ok) {
        throw new Error(`Action failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[Ably] Send action failed:', error);
      throw error;
    }
  }

  /**
   * Update player position/state
   */
  async updatePlayerState(state) {
    return this.sendAction('updateState', state);
  }

  /**
   * Place a bet
   */
  async placeBet(targetPlayerId, amount) {
    return this.sendAction('placeBet', { targetPlayerId, amount });
  }

  /**
   * Activate skill
   */
  async activateSkill(skillType) {
    return this.sendAction('activateSkill', { skillType });
  }

  /**
   * Leave current room
   */
  async leaveRoom() {
    if (this.presence) {
      await this.presence.leave();
    }
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
      this.presence = null;
    }
    this.roomId = null;
  }

  /**
   * Disconnect from Ably
   */
  disconnect() {
    if (this.ably) {
      this.ably.close();
      this.ably = null;
    }
    this.callbacks.clear();
  }

  /**
   * Event emitter functionality
   */
  on(event, callback) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event).push(callback);
  }

  off(event, callback) {
    if (this.callbacks.has(event)) {
      const callbacks = this.callbacks.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.callbacks.has(event)) {
      this.callbacks.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[Ably] Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Get stored auth token
   */
  getAuthToken() {
    // This should be implemented based on your auth system
    return localStorage.getItem('authToken') || '';
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.ably && this.ably.connection.state === 'connected';
  }

  /**
   * Get current room members
   */
  async getRoomMembers() {
    if (!this.presence) return [];
    const members = await this.presence.get();
    return members.map(member => member.data);
  }
}

// Singleton instance
let ablyClient = null;

export function getAblyClient() {
  if (!ablyClient) {
    ablyClient = new AblyMultiplayerClient();
  }
  return ablyClient;
}

export { AblyMultiplayerClient };