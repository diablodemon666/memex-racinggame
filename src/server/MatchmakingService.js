/**
 * MatchmakingService.js - Quick Play Matchmaking for Memex Racing Game
 * 
 * Handles skill-based matching, finding available rooms, creating rooms when needed,
 * and balancing teams for optimal gameplay experience
 */

export class MatchmakingService {
  constructor(roomManager) {
    this.roomManager = roomManager;
    this.matchmakingQueue = new Map(); // playerId -> queueData
    this.playerStats = new Map(); // playerId -> stats
    this.matchmakingHistory = new Map(); // playerId -> recent matches
    
    // Matchmaking settings
    this.settings = {
      maxWaitTime: 30000, // 30 seconds max wait
      skillRange: 200, // Initial skill range for matching
      skillRangeExpansion: 50, // Expand range every 5 seconds
      maxSkillRange: 1000, // Maximum skill range
      preferredRoomSize: 4, // Preferred players per room
      minRoomSize: 2, // Minimum players to start
      maxRoomSize: 6 // Maximum players per room
    };
    
    console.log('[MatchmakingService] Initialized matchmaking service');
    
    // Start matchmaking loop
    this.startMatchmakingLoop();
  }

  /**
   * Find or create room for player (Quick Play)
   * @param {Object} player - Player object
   * @returns {Object|null} Room object or null
   */
  findOrCreateRoom(player) {
    try {
      // Get player skill level
      const playerSkill = this.getPlayerSkill(player.id);
      
      // First, try to find existing room
      const availableRoom = this.findSuitableRoom(player, playerSkill);
      
      if (availableRoom) {
        console.log(`[MatchmakingService] Found suitable room for ${player.username}: ${availableRoom.code}`);
        return availableRoom;
      }
      
      // No suitable room found, create new one
      const newRoom = this.createMatchmakingRoom(player);
      
      if (newRoom) {
        console.log(`[MatchmakingService] Created new room for ${player.username}: ${newRoom.code}`);
        return newRoom;
      }
      
      return null;
    } catch (error) {
      console.error('[MatchmakingService] Error in findOrCreateRoom:', error);
      return null;
    }
  }

  /**
   * Find suitable existing room for player
   * @param {Object} player - Player object
   * @param {number} playerSkill - Player skill level
   * @returns {Object|null} Suitable room or null
   */
  findSuitableRoom(player, playerSkill) {
    const availableRooms = this.roomManager.getAvailableRooms();
    
    // Filter rooms by skill compatibility and other criteria
    const suitableRooms = availableRooms.filter(room => {
      // Skip if room is full
      if (room.players.length >= room.maxPlayers) {
        return false;
      }
      
      // Skip if player was recently in this room
      if (this.wasRecentlyInRoom(player.id, room.id)) {
        return false;
      }
      
      // Check skill compatibility
      const roomSkillRange = this.getRoomSkillRange(room);
      if (roomSkillRange && !this.isSkillCompatible(playerSkill, roomSkillRange)) {
        return false;
      }
      
      // Check if room has space and is not about to start
      return room.status === 'waiting' && room.players.length < this.settings.maxRoomSize;
    });
    
    if (suitableRooms.length === 0) {
      return null;
    }
    
    // Sort by preference: rooms with fewer players first, then by skill compatibility
    suitableRooms.sort((a, b) => {
      const skillDiffA = Math.abs(this.getRoomAverageSkill(a) - playerSkill);
      const skillDiffB = Math.abs(this.getRoomAverageSkill(b) - playerSkill);
      
      // Prefer rooms with similar skill levels
      if (Math.abs(skillDiffA - skillDiffB) > 50) {
        return skillDiffA - skillDiffB;
      }
      
      // Then prefer rooms with fewer players (more room to grow)
      return a.players.length - b.players.length;
    });
    
    return suitableRooms[0];
  }

  /**
   * Create new room for matchmaking
   * @param {Object} player - Player object
   * @returns {Object|null} Created room or null
   */
  createMatchmakingRoom(player) {
    try {
      const roomOptions = {
        hostId: player.id,
        maxPlayers: this.settings.maxRoomSize,
        gameMode: 'racing',
        mapId: this.selectRandomMap(),
        isPrivate: false
      };
      
      return this.roomManager.createRoom(roomOptions);
    } catch (error) {
      console.error('[MatchmakingService] Error creating matchmaking room:', error);
      return null;
    }
  }

  /**
   * Add player to matchmaking queue
   * @param {Object} player - Player object
   */
  addToQueue(player) {
    const queueData = {
      player,
      joinTime: Date.now(),
      skillLevel: this.getPlayerSkill(player.id),
      searchRange: this.settings.skillRange,
      attempts: 0
    };
    
    this.matchmakingQueue.set(player.id, queueData);
    console.log(`[MatchmakingService] Added ${player.username} to matchmaking queue (skill: ${queueData.skillLevel})`);
  }

  /**
   * Remove player from matchmaking queue
   * @param {string} playerId - Player ID
   */
  removeFromQueue(playerId) {
    if (this.matchmakingQueue.has(playerId)) {
      const queueData = this.matchmakingQueue.get(playerId);
      this.matchmakingQueue.delete(playerId);
      console.log(`[MatchmakingService] Removed ${queueData.player.username} from matchmaking queue`);
    }
  }

  /**
   * Get player skill level
   * @param {string} playerId - Player ID
   * @returns {number} Skill level (0-1000)
   */
  getPlayerSkill(playerId) {
    const stats = this.playerStats.get(playerId);
    
    if (!stats) {
      // New player gets average skill
      return 500;
    }
    
    // Calculate skill based on win rate and games played
    const { wins, totalGames, averageFinishPosition } = stats;
    
    if (totalGames === 0) {
      return 500;
    }
    
    const winRate = wins / totalGames;
    const avgPosition = averageFinishPosition || 3.5; // Assume middle position if no data
    
    // Skill formula: base on win rate and average position
    let skill = 500; // Base skill
    skill += (winRate - 0.5) * 400; // Win rate contribution (-200 to +200)
    skill += (3.5 - avgPosition) * 100; // Position contribution (better position = higher skill)
    
    // Adjust for games played (more games = more reliable skill)
    const confidenceMultiplier = Math.min(totalGames / 10, 1); // Max confidence at 10 games
    skill = 500 + (skill - 500) * confidenceMultiplier;
    
    return Math.max(0, Math.min(1000, Math.round(skill)));
  }

  /**
   * Update player stats after game
   * @param {string} playerId - Player ID
   * @param {Object} gameResult - Game result data
   */
  updatePlayerStats(playerId, gameResult) {
    let stats = this.playerStats.get(playerId) || {
      wins: 0,
      totalGames: 0,
      totalFinishPosition: 0,
      averageFinishPosition: 0,
      bestFinishTime: null,
      recentGames: []
    };
    
    stats.totalGames++;
    stats.totalFinishPosition += gameResult.position;
    stats.averageFinishPosition = stats.totalFinishPosition / stats.totalGames;
    
    if (gameResult.position === 1) {
      stats.wins++;
    }
    
    if (gameResult.finishTime && (!stats.bestFinishTime || gameResult.finishTime < stats.bestFinishTime)) {
      stats.bestFinishTime = gameResult.finishTime;
    }
    
    // Keep track of recent games (last 10)
    stats.recentGames.unshift({
      position: gameResult.position,
      finishTime: gameResult.finishTime,
      timestamp: Date.now()
    });
    
    if (stats.recentGames.length > 10) {
      stats.recentGames.pop();
    }
    
    this.playerStats.set(playerId, stats);
    console.log(`[MatchmakingService] Updated stats for ${playerId}: skill ${this.getPlayerSkill(playerId)}`);
  }

  /**
   * Get room skill range
   * @param {Object} room - Room object
   * @returns {Object|null} Skill range {min, max, average}
   */
  getRoomSkillRange(room) {
    const humanPlayers = room.players.filter(p => !p.isAI);
    
    if (humanPlayers.length === 0) {
      return null;
    }
    
    const skills = humanPlayers.map(p => this.getPlayerSkill(p.id));
    
    return {
      min: Math.min(...skills),
      max: Math.max(...skills),
      average: skills.reduce((sum, skill) => sum + skill, 0) / skills.length
    };
  }

  /**
   * Get room average skill level
   * @param {Object} room - Room object
   * @returns {number} Average skill level
   */
  getRoomAverageSkill(room) {
    const skillRange = this.getRoomSkillRange(room);
    return skillRange ? skillRange.average : 500;
  }

  /**
   * Check if player skill is compatible with room
   * @param {number} playerSkill - Player skill level
   * @param {Object} roomSkillRange - Room skill range
   * @returns {boolean} Compatibility status
   */
  isSkillCompatible(playerSkill, roomSkillRange) {
    const tolerance = this.settings.skillRange;
    return playerSkill >= (roomSkillRange.min - tolerance) && 
           playerSkill <= (roomSkillRange.max + tolerance);
  }

  /**
   * Check if player was recently in room
   * @param {string} playerId - Player ID
   * @param {string} roomId - Room ID
   * @returns {boolean} Was recently in room
   */
  wasRecentlyInRoom(playerId, roomId) {
    const history = this.matchmakingHistory.get(playerId);
    
    if (!history) {
      return false;
    }
    
    const recentTime = Date.now() - 300000; // 5 minutes
    return history.some(entry => entry.roomId === roomId && entry.timestamp > recentTime);
  }

  /**
   * Record player room history
   * @param {string} playerId - Player ID
   * @param {string} roomId - Room ID
   */
  recordRoomHistory(playerId, roomId) {
    let history = this.matchmakingHistory.get(playerId) || [];
    
    history.unshift({
      roomId,
      timestamp: Date.now()
    });
    
    // Keep only last 10 entries
    if (history.length > 10) {
      history = history.slice(0, 10);
    }
    
    this.matchmakingHistory.set(playerId, history);
  }

  /**
   * Select random map for matchmaking
   * @returns {string} Map ID
   */
  selectRandomMap() {
    const maps = [
      'classic',
      'speedway',
      'serpentine',
      'grid',
      'spiral',
      'islands'
    ];
    
    return maps[Math.floor(Math.random() * maps.length)];
  }

  /**
   * Start matchmaking processing loop
   */
  startMatchmakingLoop() {
    setInterval(() => {
      this.processMatchmakingQueue();
    }, 5000); // Process every 5 seconds
  }

  /**
   * Process matchmaking queue
   */
  processMatchmakingQueue() {
    if (this.matchmakingQueue.size === 0) {
      return;
    }
    
    const now = Date.now();
    const queuedPlayers = Array.from(this.matchmakingQueue.values());
    
    // Sort by wait time (longest waiting first)
    queuedPlayers.sort((a, b) => a.joinTime - b.joinTime);
    
    for (const queueData of queuedPlayers) {
      const waitTime = now - queueData.joinTime;
      
      // Expand search range over time
      if (waitTime > 5000) { // After 5 seconds
        queueData.searchRange = Math.min(
          queueData.searchRange + this.settings.skillRangeExpansion,
          this.settings.maxSkillRange
        );
      }
      
      // Force match after max wait time
      if (waitTime > this.settings.maxWaitTime) {
        const room = this.findOrCreateRoom(queueData.player);
        if (room) {
          this.removeFromQueue(queueData.player.id);
          console.log(`[MatchmakingService] Force matched ${queueData.player.username} after ${waitTime}ms wait`);
        }
      }
    }
  }

  /**
   * Get matchmaking statistics
   * @returns {Object} Matchmaking stats
   */
  getStats() {
    const queuedPlayers = Array.from(this.matchmakingQueue.values());
    const totalWaitTime = queuedPlayers.reduce((total, data) => {
      return total + (Date.now() - data.joinTime);
    }, 0);
    
    const averageWaitTime = queuedPlayers.length > 0 ? totalWaitTime / queuedPlayers.length : 0;
    
    return {
      queueSize: this.matchmakingQueue.size,
      averageWaitTime,
      totalPlayersTracked: this.playerStats.size,
      averageSkillLevel: this.getAverageSkillLevel(),
      skillDistribution: this.getSkillDistribution()
    };
  }

  /**
   * Get average skill level of all players
   * @returns {number} Average skill level
   */
  getAverageSkillLevel() {
    if (this.playerStats.size === 0) {
      return 500;
    }
    
    const skills = Array.from(this.playerStats.keys()).map(playerId => 
      this.getPlayerSkill(playerId)
    );
    
    return skills.reduce((sum, skill) => sum + skill, 0) / skills.length;
  }

  /**
   * Get skill level distribution
   * @returns {Object} Skill distribution by ranges
   */
  getSkillDistribution() {
    const distribution = {
      novice: 0,    // 0-300
      beginner: 0,  // 300-500
      average: 0,   // 500-700
      skilled: 0,   // 700-900
      expert: 0     // 900-1000
    };
    
    Array.from(this.playerStats.keys()).forEach(playerId => {
      const skill = this.getPlayerSkill(playerId);
      
      if (skill < 300) distribution.novice++;
      else if (skill < 500) distribution.beginner++;
      else if (skill < 700) distribution.average++;
      else if (skill < 900) distribution.skilled++;
      else distribution.expert++;
    });
    
    return distribution;
  }

  /**
   * Clean up old player data
   * @param {number} maxAge - Maximum age in milliseconds (default: 7 days)
   */
  cleanupOldData(maxAge = 604800000) {
    const now = Date.now();
    
    // Clean up matchmaking history
    for (const [playerId, history] of this.matchmakingHistory.entries()) {
      const recentHistory = history.filter(entry => now - entry.timestamp < maxAge);
      
      if (recentHistory.length === 0) {
        this.matchmakingHistory.delete(playerId);
      } else {
        this.matchmakingHistory.set(playerId, recentHistory);
      }
    }
    
    // Clean up player stats for inactive players
    for (const [playerId, stats] of this.playerStats.entries()) {
      const lastGameTime = stats.recentGames.length > 0 ? stats.recentGames[0].timestamp : 0;
      
      if (now - lastGameTime > maxAge) {
        this.playerStats.delete(playerId);
      }
    }
  }
}