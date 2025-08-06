/**
 * RoomManager.js - Server-side Room Management for Memex Racing Game
 * 
 * Handles room creation, player management, and AI player filling
 * Generates unique room codes and manages room lifecycle
 */

import { v4 as uuidv4 } from 'uuid';

export class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.roomCodes = new Set();
    
    // AI player templates
    this.aiPlayerTemplates = [
      { username: 'AI_Speedy', avatar: 'cool_pug' },
      { username: 'AI_Racer', avatar: 'chips_bu' },
      { username: 'AI_Flash', avatar: 'smoking_pug' },
      { username: 'AI_Turbo', avatar: 'ice' },
      { username: 'AI_Dash', avatar: 'intern' },
      { username: 'AI_Bolt', avatar: 'lv4pug' },
      { username: 'AI_Storm', avatar: 'pug_banana_toilet' },
      { username: 'AI_Wind', avatar: 'spike_monster' }
    ];
    
    console.log('[RoomManager] Initialized with AI templates:', this.aiPlayerTemplates.length);
  }

  /**
   * Create a new room with unique code
   * @param {Object} options - Room creation options
   * @returns {Object} Created room object
   */
  createRoom(options = {}) {
    const {
      hostId,
      maxPlayers = 6,
      gameMode = 'racing',
      mapId = 'classic',
      isPrivate = false
    } = options;

    const roomId = uuidv4();
    const roomCode = this.generateUniqueRoomCode();
    
    const room = {
      id: roomId,
      code: roomCode,
      hostId,
      maxPlayers: Math.min(Math.max(maxPlayers, 2), 6), // Between 2-6 players
      players: [],
      status: 'waiting', // waiting, racing, finished
      settings: {
        gameMode,
        mapId,
        isPrivate,
        raceTimer: 300000, // 5 minutes in milliseconds
        allowSpectators: true
      },
      createdAt: Date.now(),
      lastActivity: Date.now()
    };

    this.rooms.set(roomId, room);
    
    console.log(`[RoomManager] Created room: ${roomCode} (${roomId})`);
    return room;
  }

  /**
   * Generate unique 4-character room code
   * @returns {string} Room code like "RACE-1234"
   */
  generateUniqueRoomCode() {
    let attempts = 0;
    const maxAttempts = 100;
    
    while (attempts < maxAttempts) {
      // Generate 4-digit number
      const number = Math.floor(1000 + Math.random() * 9000);
      const code = `RACE-${number}`;
      
      if (!this.roomCodes.has(code)) {
        this.roomCodes.add(code);
        return code;
      }
      
      attempts++;
    }
    
    // Fallback to UUID-based code if all attempts failed
    const fallbackCode = `RACE-${uuidv4().slice(0, 4).toUpperCase()}`;
    this.roomCodes.add(fallbackCode);
    return fallbackCode;
  }

  /**
   * Add player to room
   * @param {string} roomId - Room ID
   * @param {Object} player - Player object
   * @returns {boolean} Success status
   */
  addPlayerToRoom(roomId, player) {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      console.error(`[RoomManager] Room not found: ${roomId}`);
      return false;
    }

    if (room.status !== 'waiting') {
      console.error(`[RoomManager] Room ${room.code} not accepting players (status: ${room.status})`);
      return false;
    }

    if (room.players.length >= room.maxPlayers) {
      console.error(`[RoomManager] Room ${room.code} is full`);
      return false;
    }

    // Check if player already in room
    if (room.players.find(p => p.id === player.id)) {
      console.error(`[RoomManager] Player ${player.id} already in room ${room.code}`);
      return false;
    }

    // Add player with default properties
    const roomPlayer = {
      ...player,
      isReady: false,
      isAI: false,
      joinedAt: Date.now(),
      position: null,
      score: 0
    };

    room.players.push(roomPlayer);
    room.lastActivity = Date.now();
    
    console.log(`[RoomManager] Added player ${player.username} to room ${room.code} (${room.players.length}/${room.maxPlayers})`);
    return true;
  }

  /**
   * Remove player from room
   * @param {string} roomId - Room ID
   * @param {string} playerId - Player ID
   * @returns {boolean} Success status
   */
  removePlayerFromRoom(roomId, playerId) {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      console.error(`[RoomManager] Room not found: ${roomId}`);
      return false;
    }

    const playerIndex = room.players.findIndex(p => p.id === playerId);
    
    if (playerIndex === -1) {
      console.error(`[RoomManager] Player ${playerId} not found in room ${room.code}`);
      return false;
    }

    const removedPlayer = room.players.splice(playerIndex, 1)[0];
    room.lastActivity = Date.now();
    
    // If host left, assign new host
    if (room.hostId === playerId && room.players.length > 0) {
      // Find first non-AI player
      const newHost = room.players.find(p => !p.isAI);
      if (newHost) {
        room.hostId = newHost.id;
        console.log(`[RoomManager] New host assigned in room ${room.code}: ${newHost.username}`);
      }
    }
    
    console.log(`[RoomManager] Removed player ${removedPlayer.username} from room ${room.code}`);
    return true;
  }

  /**
   * Fill remaining slots with AI players
   * @param {string} roomId - Room ID
   * @returns {number} Number of AI players added
   */
  fillWithAI(roomId) {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      console.error(`[RoomManager] Room not found: ${roomId}`);
      return 0;
    }

    const currentPlayerCount = room.players.length;
    const aiSlotsNeeded = room.maxPlayers - currentPlayerCount;
    
    if (aiSlotsNeeded <= 0) {
      return 0;
    }

    let addedAI = 0;
    const usedAITemplates = room.players
      .filter(p => p.isAI)
      .map(p => p.username);

    // Add AI players up to max capacity
    for (let i = 0; i < aiSlotsNeeded; i++) {
      // Find unused AI template
      const availableTemplates = this.aiPlayerTemplates.filter(
        template => !usedAITemplates.includes(template.username)
      );

      if (availableTemplates.length === 0) {
        console.warn(`[RoomManager] No more AI templates available for room ${room.code}`);
        break;
      }

      // Select random available template
      const templateIndex = Math.floor(Math.random() * availableTemplates.length);
      const template = availableTemplates[templateIndex];

      const aiPlayer = {
        id: `ai_${uuidv4().slice(0, 8)}`,
        username: template.username,
        avatar: template.avatar,
        isReady: true,
        isAI: true,
        joinedAt: Date.now(),
        position: null,
        score: 0,
        roomId: roomId
      };

      room.players.push(aiPlayer);
      usedAITemplates.push(template.username);
      addedAI++;
    }

    if (addedAI > 0) {
      room.lastActivity = Date.now();
      console.log(`[RoomManager] Added ${addedAI} AI players to room ${room.code} (${room.players.length}/${room.maxPlayers})`);
    }

    return addedAI;
  }

  /**
   * Update player ready state
   * @param {string} roomId - Room ID
   * @param {string} playerId - Player ID
   * @param {boolean} isReady - Ready state
   * @returns {boolean} Success status
   */
  updatePlayerReady(roomId, playerId, isReady) {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      console.error(`[RoomManager] Room not found: ${roomId}`);
      return false;
    }

    const player = room.players.find(p => p.id === playerId);
    
    if (!player) {
      console.error(`[RoomManager] Player ${playerId} not found in room ${room.code}`);
      return false;
    }

    player.isReady = isReady;
    room.lastActivity = Date.now();
    
    console.log(`[RoomManager] Player ${player.username} ready state: ${isReady} in room ${room.code}`);
    return true;
  }

  /**
   * Check if all players are ready
   * @param {string} roomId - Room ID
   * @returns {boolean} All players ready status
   */
  areAllPlayersReady(roomId) {
    const room = this.rooms.get(roomId);
    
    if (!room || room.players.length < 2) {
      return false;
    }

    return room.players.every(player => player.isReady);
  }

  /**
   * Reset all players ready state
   * @param {string} roomId - Room ID
   */
  resetPlayerReady(roomId) {
    const room = this.rooms.get(roomId);
    
    if (room) {
      room.players.forEach(player => {
        if (!player.isAI) {
          player.isReady = false;
        }
      });
      room.lastActivity = Date.now();
      console.log(`[RoomManager] Reset ready states for room ${room.code}`);
    }
  }

  /**
   * Set room status
   * @param {string} roomId - Room ID
   * @param {string} status - New status
   */
  setRoomStatus(roomId, status) {
    const room = this.rooms.get(roomId);
    
    if (room) {
      room.status = status;
      room.lastActivity = Date.now();
      console.log(`[RoomManager] Room ${room.code} status changed to: ${status}`);
    }
  }

  /**
   * Find room by code
   * @param {string} roomCode - Room code
   * @returns {Object|null} Room object or null
   */
  findRoomByCode(roomCode) {
    for (const room of this.rooms.values()) {
      if (room.code === roomCode) {
        return room;
      }
    }
    return null;
  }

  /**
   * Get room by ID
   * @param {string} roomId - Room ID
   * @returns {Object|null} Room object or null
   */
  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Get room data safe for client transmission
   * @param {string} roomId - Room ID
   * @returns {Object|null} Sanitized room data
   */
  getRoomData(roomId) {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return null;
    }

    return {
      id: room.id,
      code: room.code,
      hostId: room.hostId,
      maxPlayers: room.maxPlayers,
      status: room.status,
      settings: room.settings,
      players: room.players.map(player => ({
        id: player.id,
        username: player.username,
        avatar: player.avatar,
        isReady: player.isReady,
        isAI: player.isAI,
        score: player.score
      })),
      createdAt: room.createdAt
    };
  }

  /**
   * Get all rooms
   * @returns {Array} Array of all rooms
   */
  getAllRooms() {
    return Array.from(this.rooms.values());
  }

  /**
   * Get available rooms for matchmaking
   * @returns {Array} Array of available rooms
   */
  getAvailableRooms() {
    return Array.from(this.rooms.values()).filter(room =>
      room.status === 'waiting' &&
      room.players.length < room.maxPlayers &&
      !room.settings.isPrivate
    );
  }

  /**
   * Remove room
   * @param {string} roomId - Room ID
   * @returns {boolean} Success status
   */
  removeRoom(roomId) {
    const room = this.rooms.get(roomId);
    
    if (room) {
      this.roomCodes.delete(room.code);
      this.rooms.delete(roomId);
      console.log(`[RoomManager] Removed room: ${room.code}`);
      return true;
    }
    
    return false;
  }

  /**
   * Clean up old rooms
   * @param {number} maxAge - Maximum age in milliseconds (default: 1 hour)
   */
  cleanupOldRooms(maxAge = 3600000) {
    const now = Date.now();
    const roomsToRemove = [];

    for (const [roomId, room] of this.rooms.entries()) {
      if (now - room.lastActivity > maxAge && room.players.length === 0) {
        roomsToRemove.push(roomId);
      }
    }

    roomsToRemove.forEach(roomId => {
      this.removeRoom(roomId);
    });

    if (roomsToRemove.length > 0) {
      console.log(`[RoomManager] Cleaned up ${roomsToRemove.length} old rooms`);
    }
  }

  /**
   * Get statistics
   * @returns {Object} Room statistics
   */
  getStats() {
    return {
      totalRooms: this.rooms.size,
      activeRooms: this.getActiveRoomCount(),
      totalPlayers: this.getTotalPlayerCount(),
      averagePlayersPerRoom: this.rooms.size > 0 ? this.getTotalPlayerCount() / this.rooms.size : 0
    };
  }

  /**
   * Get room count
   * @returns {number} Total room count
   */
  getRoomCount() {
    return this.rooms.size;
  }

  /**
   * Get active room count (with players)
   * @returns {number} Active room count
   */
  getActiveRoomCount() {
    return Array.from(this.rooms.values()).filter(room => room.players.length > 0).length;
  }

  /**
   * Get total player count across all rooms
   * @returns {number} Total player count
   */
  getTotalPlayerCount() {
    return Array.from(this.rooms.values()).reduce((total, room) => total + room.players.length, 0);
  }
}