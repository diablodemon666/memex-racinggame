/**
 * GameStateManager.js - Game State Synchronization for Memex Racing Game
 * 
 * Manages race phases, player position sync, timer management, and win condition handling
 * Handles real-time game state updates and race completion logic
 */

export class GameStateManager {
  constructor() {
    this.gameStates = new Map(); // roomId -> gameState
    this.playerStates = new Map(); // roomId -> Map(playerId -> playerState)
    this.raceTimers = new Map(); // roomId -> timer info
    this.raceResults = new Map(); // roomId -> race results
    
    console.log('[GameStateManager] Initialized game state management');
  }

  /**
   * Initialize a new race for a room
   * @param {string} roomId - Room ID
   * @param {Array} players - Array of player objects
   */
  initializeRace(roomId, players) {
    const gameState = {
      roomId,
      phase: 'starting', // starting, racing, finished
      startTime: Date.now(),
      raceTimer: 300000, // 5 minutes in milliseconds
      tokenPosition: this.generateTokenPosition(),
      startingPositions: this.generateStartingPositions(players.length),
      boosterPositions: this.generateBoosterPositions(),
      winCondition: 'reach_token', // reach_token, survive_timer
      isActive: true,
      lastUpdate: Date.now()
    };

    this.gameStates.set(roomId, gameState);
    
    // Initialize player states
    const playerStateMap = new Map();
    players.forEach((player, index) => {
      const startPos = gameState.startingPositions[index];
      playerStateMap.set(player.id, {
        playerId: player.id,
        username: player.username,
        isAI: player.isAI,
        position: { ...startPos },
        velocity: { x: 0, y: 0 },
        direction: 0,
        isAlive: true,
        hasFinished: false,
        finishTime: null,
        finishPosition: null,
        powerUps: [],
        skillCooldowns: {},
        lastUpdate: Date.now(),
        stuck: {
          counter: 0,
          lastPosition: { ...startPos },
          checkTime: Date.now()
        }
      });
    });
    
    this.playerStates.set(roomId, playerStateMap);
    
    // Set race timer
    this.raceTimers.set(roomId, {
      startTime: gameState.startTime,
      duration: gameState.raceTimer,
      endTime: gameState.startTime + gameState.raceTimer,
      isActive: true
    });
    
    console.log(`[GameStateManager] Initialized race for room ${roomId} with ${players.length} players`);
    
    // Transition to racing phase after brief delay
    setTimeout(() => {
      this.setRacePhase(roomId, 'racing');
    }, 3000); // 3 second countdown
  }

  /**
   * Update player state
   * @param {string} roomId - Room ID
   * @param {string} playerId - Player ID
   * @param {Object} stateUpdate - State update data
   */
  updatePlayerState(roomId, playerId, stateUpdate) {
    const playerStateMap = this.playerStates.get(roomId);
    
    if (!playerStateMap) {
      console.error(`[GameStateManager] No player states found for room: ${roomId}`);
      return;
    }

    const playerState = playerStateMap.get(playerId);
    
    if (!playerState) {
      console.error(`[GameStateManager] Player state not found: ${playerId} in room ${roomId}`);
      return;
    }

    // Update position and movement data
    if (stateUpdate.position) {
      playerState.position = { ...stateUpdate.position };
      
      // Update stuck detection
      this.updateStuckDetection(playerState, stateUpdate.position);
    }
    
    if (stateUpdate.velocity) {
      playerState.velocity = { ...stateUpdate.velocity };
    }
    
    if (stateUpdate.direction !== undefined) {
      playerState.direction = stateUpdate.direction;
    }
    
    playerState.lastUpdate = Date.now();
    
    // Check win condition
    this.checkWinCondition(roomId, playerId);
  }

  /**
   * Update stuck detection for player
   * @param {Object} playerState - Player state object
   * @param {Object} newPosition - New position
   */
  updateStuckDetection(playerState, newPosition) {
    const now = Date.now();
    const timeSinceCheck = now - playerState.stuck.checkTime;
    
    if (timeSinceCheck > 1000) { // Check every second
      const distance = Math.sqrt(
        Math.pow(newPosition.x - playerState.stuck.lastPosition.x, 2) +
        Math.pow(newPosition.y - playerState.stuck.lastPosition.y, 2)
      );
      
      if (distance < 5) { // Player hasn't moved much
        playerState.stuck.counter++;
        console.log(`[GameStateManager] Player ${playerState.username} stuck counter: ${playerState.stuck.counter}`);
      } else {
        playerState.stuck.counter = 0;
      }
      
      playerState.stuck.lastPosition = { ...newPosition };
      playerState.stuck.checkTime = now;
    }
  }

  /**
   * Check win condition for player
   * @param {string} roomId - Room ID
   * @param {string} playerId - Player ID
   */
  checkWinCondition(roomId, playerId) {
    const gameState = this.gameStates.get(roomId);
    const playerStateMap = this.playerStates.get(roomId);
    
    if (!gameState || !playerStateMap || gameState.phase !== 'racing') {
      return;
    }

    const playerState = playerStateMap.get(playerId);
    
    if (!playerState || playerState.hasFinished) {
      return;
    }

    // Check if player reached M token
    const distance = Math.sqrt(
      Math.pow(playerState.position.x - gameState.tokenPosition.x, 2) +
      Math.pow(playerState.position.y - gameState.tokenPosition.y, 2)
    );

    if (distance < 32) { // Within token collision range
      this.recordWin(roomId, playerId);
    }
  }

  /**
   * Record player win
   * @param {string} roomId - Room ID
   * @param {string} playerId - Player ID
   */
  recordWin(roomId, playerId) {
    const gameState = this.gameStates.get(roomId);
    const playerStateMap = this.playerStates.get(roomId);
    
    if (!gameState || !playerStateMap) {
      return;
    }

    const playerState = playerStateMap.get(playerId);
    
    if (!playerState) {
      return;
    }

    const finishTime = Date.now() - gameState.startTime;
    
    playerState.hasFinished = true;
    playerState.finishTime = finishTime;
    playerState.finishPosition = 1; // Winner position
    
    console.log(`[GameStateManager] Player ${playerState.username} won the race in ${finishTime}ms`);
    
    // End the race immediately
    this.endRace(roomId, 'token_reached');
  }

  /**
   * Record race finish for timeout or other conditions
   * @param {string} roomId - Room ID
   * @param {string} playerId - Player ID
   * @param {number} finishTime - Finish time in milliseconds
   * @param {number} position - Finish position
   */
  recordFinish(roomId, playerId, finishTime, position) {
    const playerStateMap = this.playerStates.get(roomId);
    
    if (!playerStateMap) {
      return;
    }

    const playerState = playerStateMap.get(playerId);
    
    if (!playerState) {
      return;
    }

    playerState.hasFinished = true;
    playerState.finishTime = finishTime;
    playerState.finishPosition = position;
    
    console.log(`[GameStateManager] Player ${playerState.username} finished: position ${position}, time ${finishTime}ms`);
  }

  /**
   * Check if race is complete
   * @param {string} roomId - Room ID
   * @returns {Object|null} Race results if complete, null otherwise
   */
  checkRaceCompletion(roomId) {
    const gameState = this.gameStates.get(roomId);
    const playerStateMap = this.playerStates.get(roomId);
    
    if (!gameState || !playerStateMap || gameState.phase !== 'racing') {
      return null;
    }

    const players = Array.from(playerStateMap.values());
    
    // Check if someone reached the token
    const winner = players.find(p => p.hasFinished && p.finishPosition === 1);
    
    if (winner) {
      return this.generateRaceResults(roomId, 'winner_found');
    }

    // Check if timer expired
    const timer = this.raceTimers.get(roomId);
    if (timer && Date.now() >= timer.endTime) {
      return this.generateRaceResults(roomId, 'timeout');
    }

    return null;
  }

  /**
   * Get timeout results when timer expires
   * @param {string} roomId - Room ID
   * @returns {Object} Race results
   */
  getTimeoutResults(roomId) {
    return this.generateRaceResults(roomId, 'timeout');
  }

  /**
   * Generate race results
   * @param {string} roomId - Room ID
   * @param {string} endReason - Reason for race end
   * @returns {Object} Race results
   */
  generateRaceResults(roomId, endReason) {
    const gameState = this.gameStates.get(roomId);
    const playerStateMap = this.playerStates.get(roomId);
    
    if (!gameState || !playerStateMap) {
      return null;
    }

    const players = Array.from(playerStateMap.values());
    const timer = this.raceTimers.get(roomId);
    const totalTime = timer ? Date.now() - timer.startTime : 0;
    
    // Sort players by finish status and time
    const sortedPlayers = players.sort((a, b) => {
      if (a.hasFinished && !b.hasFinished) return -1;
      if (!a.hasFinished && b.hasFinished) return 1;
      if (a.hasFinished && b.hasFinished) {
        return a.finishTime - b.finishTime;
      }
      
      // For unfinished players, sort by distance to token
      const distanceA = Math.sqrt(
        Math.pow(a.position.x - gameState.tokenPosition.x, 2) +
        Math.pow(a.position.y - gameState.tokenPosition.y, 2)
      );
      const distanceB = Math.sqrt(
        Math.pow(b.position.x - gameState.tokenPosition.x, 2) +
        Math.pow(b.position.y - gameState.tokenPosition.y, 2)
      );
      
      return distanceA - distanceB;
    });

    const results = {
      roomId,
      endReason,
      totalTime,
      hasWinner: endReason === 'winner_found',
      players: sortedPlayers.map((player, index) => ({
        playerId: player.playerId,
        username: player.username,
        isAI: player.isAI,
        position: index + 1,
        finishTime: player.finishTime,
        hasFinished: player.hasFinished,
        finalPosition: { ...player.position },
        distanceToToken: Math.sqrt(
          Math.pow(player.position.x - gameState.tokenPosition.x, 2) +
          Math.pow(player.position.y - gameState.tokenPosition.y, 2)
        )
      })),
      tokenPosition: gameState.tokenPosition,
      timestamp: Date.now()
    };

    this.raceResults.set(roomId, results);
    console.log(`[GameStateManager] Generated race results for room ${roomId}: ${endReason}`);
    
    return results;
  }

  /**
   * End race manually
   * @param {string} roomId - Room ID
   * @param {string} reason - End reason
   */
  endRace(roomId, reason) {
    const gameState = this.gameStates.get(roomId);
    
    if (gameState) {
      gameState.phase = 'finished';
      gameState.isActive = false;
      gameState.lastUpdate = Date.now();
    }

    const timer = this.raceTimers.get(roomId);
    if (timer) {
      timer.isActive = false;
    }

    console.log(`[GameStateManager] Race ended for room ${roomId}: ${reason}`);
  }

  /**
   * Set race phase
   * @param {string} roomId - Room ID
   * @param {string} phase - New phase
   */
  setRacePhase(roomId, phase) {
    const gameState = this.gameStates.get(roomId);
    
    if (gameState) {
      gameState.phase = phase;
      gameState.lastUpdate = Date.now();
      console.log(`[GameStateManager] Race phase changed to ${phase} for room ${roomId}`);
    }
  }

  /**
   * Get game state for room
   * @param {string} roomId - Room ID
   * @returns {Object|null} Game state
   */
  getGameState(roomId) {
    return this.gameStates.get(roomId) || null;
  }

  /**
   * Get player states for room
   * @param {string} roomId - Room ID
   * @returns {Map|null} Player states map
   */
  getPlayerStates(roomId) {
    return this.playerStates.get(roomId) || null;
  }

  /**
   * Get remaining time for race
   * @param {string} roomId - Room ID
   * @returns {number} Remaining time in milliseconds
   */
  getRemainingTime(roomId) {
    const timer = this.raceTimers.get(roomId);
    
    if (!timer || !timer.isActive) {
      return 0;
    }

    return Math.max(0, timer.endTime - Date.now());
  }

  /**
   * Cleanup race data
   * @param {string} roomId - Room ID
   */
  cleanupRace(roomId) {
    this.gameStates.delete(roomId);
    this.playerStates.delete(roomId);
    this.raceTimers.delete(roomId);
    this.raceResults.delete(roomId);
    
    console.log(`[GameStateManager] Cleaned up race data for room ${roomId}`);
  }

  /**
   * Generate token position
   * @returns {Object} Token position {x, y}
   */
  generateTokenPosition() {
    // Generate position away from starting area
    const angle = Math.random() * Math.PI * 2;
    const distance = 400 + Math.random() * 600; // 400-1000 pixels from center
    
    return {
      x: 400 + Math.cos(angle) * distance,
      y: 300 + Math.sin(angle) * distance
    };
  }

  /**
   * Generate starting positions for players
   * @param {number} playerCount - Number of players
   * @returns {Array} Array of starting positions
   */
  generateStartingPositions(playerCount) {
    const positions = [];
    const centerX = 400;
    const centerY = 300;
    const spreadRadius = 50;

    for (let i = 0; i < playerCount; i++) {
      const angle = (i / playerCount) * Math.PI * 2;
      const radius = Math.random() * spreadRadius;
      
      positions.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      });
    }

    return positions;
  }

  /**
   * Generate booster positions on map
   * @returns {Array} Array of booster positions
   */
  generateBoosterPositions() {
    const positions = [];
    const boosterCount = 8 + Math.floor(Math.random() * 4); // 8-12 boosters

    for (let i = 0; i < boosterCount; i++) {
      positions.push({
        x: 100 + Math.random() * 600,
        y: 100 + Math.random() * 400,
        type: this.getRandomBoosterType(),
        id: `booster_${i}`,
        isActive: true
      });
    }

    return positions;
  }

  /**
   * Get random booster type
   * @returns {string} Booster type
   */
  getRandomBoosterType() {
    const types = [
      'antenna_booster',
      'twitter_post',
      'memex_tag',
      'poo',
      'toilet_paper',
      'toilet',
      'banana',
      'king_kong'
    ];
    
    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * Get statistics
   * @returns {Object} Game state statistics
   */
  getStats() {
    return {
      activeRaces: this.gameStates.size,
      totalPlayerStates: Array.from(this.playerStates.values()).reduce(
        (total, playerMap) => total + playerMap.size, 0
      ),
      activeTimers: Array.from(this.raceTimers.values()).filter(t => t.isActive).length,
      completedRaces: this.raceResults.size
    };
  }
}