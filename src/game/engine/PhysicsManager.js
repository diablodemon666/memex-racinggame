/**
 * PhysicsManager.js - Physics System for Memex Racing
 * 
 * Handles all physics-related operations including:
 * - Random "blind horse" movement system
 * - Collision detection and resolution
 * - Track validation and stuck player handling
 * - Skill effects and player interactions
 * 
 * Extracted from claudeweb's movement and collision systems.
 */

import { MersenneTwister } from '@utils/MersenneTwister';
import { TrackTemplateManager } from '../systems/TrackTemplateManager';
import { SpatialGrid } from './SpatialGrid';

/**
 * Physics Manager Class
 * Manages all physics simulations and movement for the racing game
 */
export class PhysicsManager {
  constructor(gameEngine) {
    this.gameEngine = gameEngine;
    this.rng = new MersenneTwister(Date.now());
    
    // Track template manager for dynamic maps
    this.trackTemplateManager = null; // Will be set by GameEngine
    this.currentTrackCollisionData = null;
    this.useWhitePixelCollision = false;
    
    // Track data for collision detection (legacy)
    this.trackData = null;
    this.trackBitmap = null;
    this.validTrackPositions = [];
    
    // Stuck detection and analysis
    this.stuckPositions = {};
    
    // Spatial partitioning for optimized collision detection
    this.spatialGrid = new SpatialGrid(1920, 1080, 64);
    this.collisionPairs = new Set(); // Track collision pairs to avoid duplicates
    
    // Movement configuration
    this.movementConfig = {
      baseSpeedRange: { min: 1.2, max: 2.0 },
      directionChangeFrequency: 0.02, // 2% chance per frame
      directionChangeAmount: 0.3, // Max direction change in radians
      biorhythmVariation: 0.15, // Speed variation from biorhythm
      speedBoostOnEscape: 1.5,
      collisionSpeedReduction: 0.6,
      stuckThreshold: 5, // Pixels moved in 10 frames to be considered stuck
    };
    
    // Collision configuration
    this.collisionConfig = {
      playerCollisionRadius: 20,
      wallLookAheadDistance: 10,
      collisionBoxSize: 48,
      collisionBoxOffset: 40,
      toleranceRadius: 3,
    };
    
    // Skill types and their effects
    this.skillTypes = [
      { name: 'thunder', color: 0xffff00, icon: '⚡', duration: 3000 },
      { name: 'fire', color: 0xff4500, icon: '🔥', duration: 5000 },
      { name: 'bubble', color: 0x00bfff, icon: '🛡️', duration: 8000 },
      { name: 'magnet', color: 0xff1493, icon: '🧲', duration: 5000 },
      { name: 'teleport', color: 0x9400d3, icon: '🌀', duration: 0 }
    ];

    // Booster types and their effects
    this.boosterTypes = [
      { name: 'antenna', color: 0x00ff00, speedMultiplier: 1.5, duration: 5000 },
      { name: 'twitter', color: 0x1da1f2, speedMultiplier: 1.4, duration: 4500 },
      { name: 'memex', color: 0xff00ff, speedMultiplier: 1.6, duration: 5500 },
      { name: 'poo', color: 0x8b4513, speedMultiplier: 0.8, duration: 4000 },
      { name: 'toilet_paper', color: 0xffffff, speedMultiplier: 1.3, duration: 4000 },
      { name: 'toilet', color: 0x4169e1, speedMultiplier: 1.2, duration: 4000 },
      { name: 'banana', color: 0xffff00, speedMultiplier: 1.7, duration: 6000 },
      { name: 'king_kong', color: 0x800080, speedMultiplier: 2.0, duration: 7000 }
    ];

    console.log('[PhysicsManager] Initialized with movement and collision systems');
  }

  /**
   * Initialize physics system for the scene
   */
  initializePhysics(scene) {
    this.scene = scene;
    
    // Create track collision data
    this.createTrackCollisionData(scene);
    
    // Find valid track positions for spawning
    this.findValidTrackPositions();
    
    console.log('[PhysicsManager] Physics system initialized');
    console.log(`[PhysicsManager] Found ${this.validTrackPositions.length} valid track positions`);
  }

  /**
   * Main physics update loop
   */
  update(time, delta) {
    const players = this.gameEngine.players;
    
    // Clear spatial grid for this frame
    this.spatialGrid.clear();
    this.collisionPairs.clear();
    
    // Update all players with "blind horse" movement
    players.forEach((player, index) => {
      if (!player || player.paralyzed) return;
      
      this.updatePlayerMovement(player, index, time, delta);
      this.updatePlayerEffects(player, time);
      this.detectStuckPlayer(player, index, time);
      
      // Add player to spatial grid for collision detection
      this.spatialGrid.insert(player, player.x, player.y, this.collisionConfig.playerCollisionRadius);
    });
    
    // Perform optimized collision detection
    this.performOptimizedCollisionDetection();
  }

  /**
   * Update individual player movement with random behavior
   */
  updatePlayerMovement(player, index, time, delta) {
    // Initialize movement direction if not set
    if (player.moveDirection === undefined || player.moveDirection === null) {
      player.moveDirection = this.rng.random() * Math.PI * 2;
    }

    // Handle AI-specific movement decisions
    if (player.isAI) {
      this.updateAIDecisionMaking(player, time, delta);
    }

    // Random movement like blind horses
    const changeFrequency = player.isAI && player.aiData ? 
      this.movementConfig.directionChangeFrequency * 0.8 : // AI players change direction slightly less randomly
      this.movementConfig.directionChangeFrequency;
      
    if (this.rng.random() < changeFrequency) {
      player.moveDirection += (this.rng.random() - 0.5) * Math.PI * this.movementConfig.directionChangeAmount;
    }

    // Calculate movement with look-ahead collision detection
    const moveSpeed = player.currentSpeed * delta / 16;
    const lookAheadDistance = moveSpeed + this.collisionConfig.wallLookAheadDistance;
    
    const { canMove, hitWallAt } = this.checkMovementPath(player, lookAheadDistance);
    
    if (canMove) {
      // Move player
      player.x += Math.cos(player.moveDirection) * moveSpeed;
      player.y += Math.sin(player.moveDirection) * moveSpeed;
      player.currentSpeed = Math.min(
        player.currentSpeed + 0.05, 
        player.baseSpeed * player.speedMultiplier * 1.5
      );
      
      // Reset stuck counter on successful movement
      if (player.stuckCounter > 0) {
        player.stuckCounter = Math.max(0, player.stuckCounter - 2);
      }
    } else {
      // Partial movement if possible
      if (hitWallAt > 0.1) {
        const partialMove = moveSpeed * hitWallAt * 0.8;
        player.x += Math.cos(player.moveDirection) * partialMove;
        player.y += Math.sin(player.moveDirection) * partialMove;
      }
      
      // Find better direction
      const newDirection = this.findBestDirection(player.x, player.y, player.moveDirection);
      
      // Smooth direction change
      const directionDiff = newDirection - player.moveDirection;
      player.moveDirection += directionDiff * 0.3;
      
      // Reduce speed on wall hit
      player.currentSpeed = player.baseSpeed * player.speedMultiplier * this.movementConfig.collisionSpeedReduction;
      
      // Increment stuck counter
      player.stuckCounter = (player.stuckCounter || 0) + 1;
    }

    // Apply biorhythm performance variation
    const biorhythm = Math.sin(time * 0.0003 * player.biorhythmSpeed + player.biorhythmOffset);
    player.currentSpeed = player.baseSpeed * player.speedMultiplier * (1 + biorhythm * this.movementConfig.biorhythmVariation);

    // Update physics body position
    if (player.body) {
      player.body.updateFromGameObject();
    }

    // Update name text position
    if (player.nameText) {
      player.nameText.x = player.x;
      player.nameText.y = player.y + 20;
    }
  }

  /**
   * Check movement path for collisions
   */
  checkMovementPath(player, lookAheadDistance) {
    let canMove = true;
    let hitWallAt = 1.0;
    
    // Check multiple points along the movement path
    for (let checkDist = 5; checkDist <= lookAheadDistance; checkDist += 5) {
      const checkX = player.x + Math.cos(player.moveDirection) * checkDist;
      const checkY = player.y + Math.sin(player.moveDirection) * checkDist;
      
      if (!this.isPositionOnTrackWithTolerance(checkX, checkY, this.collisionConfig.toleranceRadius)) {
        canMove = false;
        hitWallAt = (checkDist - 5) / lookAheadDistance;
        break;
      }
    }
    
    return { canMove, hitWallAt };
  }

  /**
   * Set track template manager and load collision data
   * @param {TrackTemplateManager} templateManager - The track template manager
   */
  setTrackTemplateManager(templateManager) {
    this.trackTemplateManager = templateManager;
    console.log('[PhysicsManager] Track template manager set');
  }

  /**
   * Load collision data for current map combination
   * @param {Object} combination - Map combination from track template manager
   */
  async loadDynamicMapCollisionData(combination) {
    if (!this.trackTemplateManager || !combination) {
      console.warn('[PhysicsManager] Cannot load dynamic map - missing template manager or combination');
      return false;
    }

    try {
      // Load collision data for the track template
      this.currentTrackCollisionData = await this.trackTemplateManager.loadTemplateCollisionData(combination.template);
      this.useWhitePixelCollision = !combination.isLegacy;
      
      console.log(`[PhysicsManager] Loaded collision data for: ${combination.template.name} (white pixel mode: ${this.useWhitePixelCollision})`);
      return true;
    } catch (error) {
      console.error('[PhysicsManager] Failed to load dynamic map collision data:', error);
      this.useWhitePixelCollision = false;
      return false;
    }
  }

  /**
   * Check if position is on track (supports both legacy and white pixel modes)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {boolean} True if position is on track
   */
  isPositionOnTrack(x, y) {
    // Use dynamic collision data if available
    if (this.useWhitePixelCollision && this.currentTrackCollisionData) {
      return this.trackTemplateManager.isPositionOnTrack(x, y, this.currentTrackCollisionData);
    }
    
    // Fallback to legacy collision detection
    return this.isPositionOnTrackLegacy(x, y);
  }

  /**
   * Legacy collision detection method
   */
  isPositionOnTrackLegacy(x, y) {
    // This would use the existing track bitmap logic
    // For now, return a simple check
    if (!this.trackData) {
      // Default: assume middle area is track
      return Math.abs(y - 1000) < 400 && x > 100 && x < 3900;
    }
    
    // Existing bitmap logic would go here
    return true;
  }

  /**
   * Update player effects (speed boosts, skills, etc.)
   */
  updatePlayerEffects(player, time) {
    // Update skill effect timers
    if (player.skillEffects) {
      for (const [skillName, effect] of Object.entries(player.skillEffects)) {
        if (effect.endTime && time > effect.endTime) {
          this.removeSkillEffect(player, skillName);
        }
      }
    }

    // Update booster effect timers
    if (player.boosterEffect && time > player.boosterEffect.endTime) {
      this.removeBoosterEffect(player);
    }
  }

  /**
   * Detect if player is stuck and handle appropriately
   */
  detectStuckPlayer(player, index, time) {
    // Track player positions for stuck detection
    if (!player.lastPositions) {
      player.lastPositions = [{ x: player.x, y: player.y, time: time }];
      return;
    }

    player.lastPositions.push({ x: player.x, y: player.y, time: time });
    if (player.lastPositions.length > 10) {
      player.lastPositions.shift();
    }

    // Check if player hasn't moved much in last 10 frames
    if (player.lastPositions.length >= 10) {
      const oldPos = player.lastPositions[0];
      const distanceMoved = Math.sqrt(
        Math.pow(player.x - oldPos.x, 2) + Math.pow(player.y - oldPos.y, 2)
      );

      if (distanceMoved < this.movementConfig.stuckThreshold) {
        this.handleStuckPlayer(player, index);
      }
    }
  }

  /**
   * Handle stuck player with progressive intervention levels
   */
  handleStuckPlayer(player, index) {
    player.stuckCounter++;
    
    // Log stuck position for analysis
    const posKey = `${Math.floor(player.x / 10)},${Math.floor(player.y / 10)}`;
    this.stuckPositions[posKey] = (this.stuckPositions[posKey] || 0) + 1;

    if (player.stuckCounter > 30 && player.stuckCounter <= 60) {
      // Level 1: Intelligent direction finding
      player.moveDirection = this.findBestDirection(player.x, player.y, player.moveDirection);
      player.currentSpeed = player.baseSpeed * this.movementConfig.speedBoostOnEscape;
      
      console.log(`[PhysicsManager] Level 1 stuck handling for player ${index + 1}`);
    } else if (player.stuckCounter > 60 && player.stuckCounter <= 120) {
      // Level 2: Local teleport to clear area
      this.teleportToNearbyValidPosition(player);
      console.log(`[PhysicsManager] Level 2 stuck handling for player ${index + 1}`);
    } else if (player.stuckCounter > 120) {
      // Level 3: Emergency teleport to random valid position
      this.emergencyTeleportPlayer(player);
      console.log(`[PhysicsManager] Level 3 emergency teleport for player ${index + 1}`);
    }
  }

  /**
   * Find the best direction to move when stuck
   */
  findBestDirection(x, y, currentDirection) {
    const testDistance = 20;
    const angleStep = Math.PI / 16; // 22.5 degrees
    let bestAngle = currentDirection;
    let maxClearDistance = 0;

    // Test all 16 directions
    for (let angle = 0; angle < Math.PI * 2; angle += angleStep) {
      let clearDistance = 0;
      
      // Check how far we can go in this direction
      for (let dist = 5; dist <= 50; dist += 5) {
        const testX = x + Math.cos(angle) * dist;
        const testY = y + Math.sin(angle) * dist;
        
        if (this.isPositionOnTrack(testX, testY)) {
          clearDistance = dist;
        } else {
          break;
        }
      }
      
      if (clearDistance > maxClearDistance) {
        maxClearDistance = clearDistance;
        bestAngle = angle;
      }
    }

    return maxClearDistance > 10 ? bestAngle : currentDirection + Math.PI;
  }

  /**
   * Teleport player to nearby valid position
   */
  teleportToNearbyValidPosition(player) {
    for (let radius = 20; radius <= 60; radius += 10) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        const newX = player.x + Math.cos(angle) * radius;
        const newY = player.y + Math.sin(angle) * radius;
        
        if (this.isPositionOnTrackWithTolerance(newX, newY, 5)) {
          player.x = newX;
          player.y = newY;
          player.moveDirection = angle;
          player.stuckCounter = 0;
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Emergency teleport to random valid position
   */
  emergencyTeleportPlayer(player) {
    if (this.validTrackPositions.length === 0) return;
    
    const safePosition = this.validTrackPositions[
      Math.floor(this.rng.random() * this.validTrackPositions.length)
    ];
    
    player.x = safePosition.x;
    player.y = safePosition.y;
    player.moveDirection = this.rng.random() * Math.PI * 2;
    player.stuckCounter = 0;
    
    // Create visual effect if scene is available
    if (this.scene) {
      this.gameEngine.renderManager.showTeleportEffect(player.x, player.y);
    }
  }

  /**
   * Create track collision data from rendered texture
   */
  createTrackCollisionData(scene) {
    const canvas = scene.textures.createCanvas('trackData', 1920, 1080);
    const context = canvas.context;
    const trackImage = scene.textures.get('track').getSourceImage();
    context.drawImage(trackImage, 0, 0);
    this.trackData = context.getImageData(0, 0, 1920, 1080);
    
    console.log('[PhysicsManager] Track collision data created');
  }

  /**
   * Find all valid track positions for spawning
   */
  findValidTrackPositions() {
    this.validTrackPositions = [];
    
    // Sample every 20 pixels for performance
    for (let x = 40; x < 1880; x += 20) {
      for (let y = 40; y < 1040; y += 20) {
        if (this.isPositionOnTrack(x, y)) {
          this.validTrackPositions.push({ x, y });
        }
      }
    }
    
    console.log(`[PhysicsManager] Found ${this.validTrackPositions.length} valid positions`);
  }

  /**
   * Check if position is on track
   */
  isPositionOnTrack(x, y) {
    if (!this.trackData || x < 0 || x >= 1920 || y < 0 || y >= 1080) return false;
    
    const pixelX = Math.floor(x);
    const pixelY = Math.floor(y);
    const index = (pixelY * 1920 + pixelX) * 4;
    
    const r = this.trackData.data[index];
    const g = this.trackData.data[index + 1];
    const b = this.trackData.data[index + 2];
    
    // Track is considered valid if brightness is above threshold
    const brightness = (r + g + b) / 3;
    return brightness > 150;
  }

  /**
   * Check position with tolerance for better collision detection
   */
  isPositionOnTrackWithTolerance(x, y, tolerance = 0) {
    const points = [
      { x: x, y: y },
      { x: x - tolerance, y: y },
      { x: x + tolerance, y: y },
      { x: x, y: y - tolerance },
      { x: x, y: y + tolerance }
    ];
    
    for (const point of points) {
      if (this.isPositionOnTrack(point.x, point.y)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get random valid position on track
   */
  getRandomValidPosition() {
    if (this.validTrackPositions.length === 0) {
      console.warn('[PhysicsManager] No valid track positions available');
      return { x: 960, y: 540 }; // Fallback to center
    }
    
    return this.validTrackPositions[
      Math.floor(this.rng.random() * this.validTrackPositions.length)
    ];
  }

  /**
   * Get farthest position from a start point
   */
  getFarthestPositionFromStart(startPos) {
    let farthestPos = this.validTrackPositions[0];
    let maxDistance = 0;
    
    for (const pos of this.validTrackPositions) {
      const dist = Math.sqrt(
        Math.pow(startPos.x - pos.x, 2) + Math.pow(startPos.y - pos.y, 2)
      );
      
      if (dist > maxDistance) {
        maxDistance = dist;
        farthestPos = pos;
      }
    }
    
    return farthestPos;
  }

  /**
   * Create player physics properties
   */
  createPlayerPhysics(index, position, isAI = false, aiData = null) {
    // Get AI behavior config if applicable
    const aiBehavior = isAI ? this.gameEngine.configManager.get('ai-players.behavior', {}) : {};
    
    // Adjust base speed for AI players based on skill level
    let speedModifier = 1.0;
    if (isAI && aiBehavior.performance) {
      speedModifier = aiBehavior.performance.speedModifier || 1.0;
    }
    
    const baseSpeed = (this.movementConfig.baseSpeedRange.min + 
                      this.rng.random() * (this.movementConfig.baseSpeedRange.max - this.movementConfig.baseSpeedRange.min)) * speedModifier;
    
    const player = {
      index: index,
      x: position.x,
      y: position.y,
      baseSpeed: baseSpeed,
      currentSpeed: 0,
      speedMultiplier: 1,
      moveDirection: this.rng.random() * Math.PI * 2,
      biorhythmSpeed: 0.5 + this.rng.random() * 1.5,
      biorhythmOffset: this.rng.random() * Math.PI * 2,
      lastPositions: [],
      stuckCounter: 0,
      
      // AI-specific properties
      isAI: isAI,
      aiData: aiData,
      aiReactionTime: isAI ? this.getAIReactionTime(aiBehavior) : 0,
      aiDecisionCooldown: 0,
      
      // Status effects
      paralyzed: false,
      hasBubble: false,
      magnetized: false,
      skillEffects: {},
      boosterEffect: null,
      
      // Physics body will be set by render manager
      body: null,
    };
    
    player.currentSpeed = player.baseSpeed;
    
    return player;
  }

  /**
   * Get AI reaction time based on skill level
   */
  getAIReactionTime(aiBehavior) {
    if (!aiBehavior.reactionTime) {
      return 150; // Default reaction time
    }
    
    const min = aiBehavior.reactionTime.min || 100;
    const max = aiBehavior.reactionTime.max || 300;
    
    // Add variability based on skill level
    const skillMultiplier = {
      'easy': 1.5,
      'medium': 1.0,
      'hard': 0.7,
      'expert': 0.5
    }[aiBehavior.skillLevel || 'medium'];
    
    return (min + this.rng.random() * (max - min)) * skillMultiplier;
  }

  /**
   * Apply booster effect to player
   */
  applyBooster(player, booster) {
    const boosterType = booster.boosterType;
    
    player.speedMultiplier = boosterType.speedMultiplier;
    player.boosterEffect = {
      type: boosterType.name,
      endTime: Date.now() + boosterType.duration
    };
    
    console.log(`[PhysicsManager] Applied ${boosterType.name} booster to player ${player.index + 1}`);
  }

  /**
   * Remove booster effect
   */
  removeBoosterEffect(player) {
    player.speedMultiplier = 1;
    player.boosterEffect = null;
  }

  /**
   * Activate skill effect
   */
  activateSkill(player, skill) {
    const skillType = skill.skillType;
    
    switch (skillType.name) {
      case 'thunder':
        this.activateThunderSkill(player);
        break;
      case 'fire':
        this.activateFireSkill(player);
        break;
      case 'bubble':
        this.activateBubbleSkill(player);
        break;
      case 'magnet':
        this.activateMagnetSkill(player);
        break;
      case 'teleport':
        this.activateTeleportSkill();
        break;
    }
    
    console.log(`[PhysicsManager] Activated ${skillType.name} skill for player ${player.index + 1}`);
  }

  /**
   * Thunder skill: Paralyze random players
   */
  activateThunderSkill(player) {
    const targets = this.gameEngine.players.filter(p => p !== player && !p.paralyzed);
    const numTargets = Math.min(3, targets.length);
    
    for (let i = 0; i < numTargets; i++) {
      const target = targets[Math.floor(this.rng.random() * targets.length)];
      target.paralyzed = true;
      target.skillEffects.thunder = {
        endTime: Date.now() + 3000
      };
      
      // Visual effect handled by render manager
    }
  }

  /**
   * Fire skill: Slow down players
   */
  activateFireSkill(player) {
    const targets = this.gameEngine.players
      .filter(p => p !== player)
      .sort(() => this.rng.random() - 0.5)
      .slice(0, 2);
    
    targets.forEach(target => {
      target.baseSpeed *= 0.5;
      target.skillEffects.fire = {
        endTime: Date.now() + 5000
      };
    });
  }

  /**
   * Bubble skill: Bounce protection
   */
  activateBubbleSkill(player) {
    player.hasBubble = true;
    player.skillEffects.bubble = {
      endTime: Date.now() + 8000
    };
  }

  /**
   * Magnet skill: Attraction to other players
   */
  activateMagnetSkill(player) {
    player.magnetized = true;
    player.skillEffects.magnet = {
      endTime: Date.now() + 5000
    };
  }

  /**
   * Teleport skill: Randomly teleport all players
   */
  activateTeleportSkill() {
    this.gameEngine.players.forEach(player => {
      const newPos = this.getRandomValidPosition();
      player.x = newPos.x;
      player.y = newPos.y;
      player.stuckCounter = 0;
      
      // Visual effect handled by render manager
    });
  }

  /**
   * Update AI decision making
   */
  updateAIDecisionMaking(player, time, delta) {
    // Update decision cooldown
    if (player.aiDecisionCooldown > 0) {
      player.aiDecisionCooldown -= delta;
      return;
    }
    
    // Get AI behavior config
    const aiBehavior = this.gameEngine.configManager.get('ai-players.behavior', {});
    const decisionMaking = aiBehavior.decisionMaking || {};
    
    // Check for nearby boosters
    if (decisionMaking.boosterPickupChance && this.rng.random() < decisionMaking.boosterPickupChance) {
      const nearbyBooster = this.findNearbyBooster(player);
      if (nearbyBooster) {
        // Slightly bias movement toward booster
        const angleToBooster = Math.atan2(
          nearbyBooster.y - player.y,
          nearbyBooster.x - player.x
        );
        player.moveDirection = this.lerpAngle(player.moveDirection, angleToBooster, 0.3);
      }
    }
    
    // Check for skill usage
    if (player.skills && player.skills.length > 0 && decisionMaking.skillUseChance) {
      if (this.rng.random() < decisionMaking.skillUseChance) {
        // AI might use a skill
        const randomSkill = player.skills[Math.floor(this.rng.random() * player.skills.length)];
        if (randomSkill && !randomSkill.used) {
          // Simulate skill activation (would need to be connected to actual skill system)
          console.log(`[PhysicsManager] AI player ${player.index} considering using ${randomSkill.type} skill`);
        }
      }
    }
    
    // Bias toward M token if configured
    if (decisionMaking.optimalPathBias && this.gameEngine.mToken) {
      const angleToToken = Math.atan2(
        this.gameEngine.mToken.y - player.y,
        this.gameEngine.mToken.x - player.x
      );
      player.moveDirection = this.lerpAngle(
        player.moveDirection, 
        angleToToken, 
        decisionMaking.optimalPathBias * 0.1
      );
    }
    
    // Set next decision time
    player.aiDecisionCooldown = player.aiReactionTime;
  }

  /**
   * Find nearby booster within range
   */
  findNearbyBooster(player) {
    const searchRadius = 150;
    for (const booster of this.gameEngine.boosters) {
      if (booster && booster.active) {
        const dist = Math.hypot(booster.x - player.x, booster.y - player.y);
        if (dist < searchRadius) {
          return booster;
        }
      }
    }
    return null;
  }

  /**
   * Lerp between two angles
   */
  lerpAngle(a, b, t) {
    const diff = b - a;
    const shortDiff = ((diff + Math.PI) % (2 * Math.PI)) - Math.PI;
    return a + shortDiff * t;
  }

  /**
   * Remove skill effect
   */
  removeSkillEffect(player, skillName) {
    switch (skillName) {
      case 'thunder':
        player.paralyzed = false;
        break;
      case 'fire':
        player.baseSpeed *= 2; // Restore original speed
        break;
      case 'bubble':
        player.hasBubble = false;
        break;
      case 'magnet':
        player.magnetized = false;
        break;
    }
    
    delete player.skillEffects[skillName];
  }

  /**
   * Perform optimized collision detection using spatial grid
   * Reduces complexity from O(n²) to O(n) by only checking nearby objects
   */
  performOptimizedCollisionDetection() {
    const players = this.gameEngine.players.filter(p => p && !p.paralyzed);
    
    // Check each player against nearby players only
    for (const player of players) {
      const nearbyObjects = this.spatialGrid.getNearbyObjects(
        player.x, 
        player.y, 
        this.collisionConfig.playerCollisionRadius
      );
      
      for (const otherPlayer of nearbyObjects) {
        if (otherPlayer === player) continue;
        
        // Create collision pair key to avoid duplicate checks
        const pairKey = player.index < otherPlayer.index 
          ? `${player.index}-${otherPlayer.index}`
          : `${otherPlayer.index}-${player.index}`;
          
        if (this.collisionPairs.has(pairKey)) continue;
        this.collisionPairs.add(pairKey);
        
        // Check actual collision distance
        const dx = player.x - otherPlayer.x;
        const dy = player.y - otherPlayer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < this.collisionConfig.playerCollisionRadius * 2) {
          this.handlePlayerCollision(player, otherPlayer);
        }
      }
    }
  }

  /**
   * Handle collision between two players
   */
  handlePlayerCollision(player1, player2) {
    // Bubble protection effect
    if (player1.hasBubble) {
      const angle = Math.atan2(player2.y - player1.y, player2.x - player1.x);
      player2.x += Math.cos(angle) * 20;
      player2.y += Math.sin(angle) * 20;
    }
    
    if (player2.hasBubble) {
      const angle = Math.atan2(player1.y - player2.y, player1.x - player2.x);
      player1.x += Math.cos(angle) * 20;
      player1.y += Math.sin(angle) * 20;
    }
    
    // Magnet effect
    if (player1.magnetized || player2.magnetized) {
      const midX = (player1.x + player2.x) / 2;
      const midY = (player1.y + player2.y) / 2;
      player1.x = midX - 10;
      player2.x = midX + 10;
      player1.y = midY;
      player2.y = midY;
    }
  }

  /**
   * Reset all players for new race
   */
  resetPlayers(players) {
    const newStartPosition = this.getRandomValidPosition();
    
    players.forEach((player, i) => {
      if (!player) return;
      
      // Same arrangement as initial creation
      const col = i % 3;
      const row = Math.floor(i / 3);
      const offsetX = (col - 1) * 30;
      const offsetY = row * 30 - 15;
      
      player.x = newStartPosition.x + offsetX;
      player.y = newStartPosition.y + offsetY;
      player.currentSpeed = player.baseSpeed;
      player.speedMultiplier = 1;
      player.paralyzed = false;
      player.hasBubble = false;
      player.magnetized = false;
      player.skillEffects = {};
      player.boosterEffect = null;
      player.moveDirection = this.rng.random() * Math.PI * 2;
      player.lastPositions = [];
      player.stuckCounter = 0;
      
      if (player.body) {
        player.body.setVelocity(0, 0);
      }
    });
  }

  /**
   * Get stuck positions for debugging
   */
  getStuckPositions() {
    return { ...this.stuckPositions };
  }

  /**
   * Clear stuck position data
   */
  clearStuckPositions() {
    this.stuckPositions = {};
  }

  /**
   * MULTIPLAYER SYNCHRONIZATION METHODS
   */

  /**
   * Sync player positions for multiplayer
   * @param {Array} playerStates - Array of player state objects from network
   */
  syncPlayerPositions(playerStates) {
    if (!Array.isArray(playerStates)) return;
    
    playerStates.forEach(playerState => {
      const player = this.gameEngine.players[playerState.id];
      if (player && !player.isCurrentPlayer) {
        // Update remote player position for interpolation
        player.updateRemotePosition(
          playerState.x,
          playerState.y,
          playerState.vx || 0,
          playerState.vy || 0
        );
        
        // Update other synchronized properties
        if (playerState.effects) {
          player.paralyzed = playerState.effects.paralyzed || false;
          player.hasBubble = playerState.effects.hasBubble || false;
          player.magnetized = playerState.effects.magnetized || false;
          player.speedMultiplier = playerState.effects.speedMultiplier || 1.0;
        }
      }
    });
  }

  /**
   * Get all player sync data for network transmission
   * @returns {Array} Array of player sync data objects
   */
  getAllPlayerSyncData() {
    return this.gameEngine.players
      .filter(player => player && player.getSyncData)
      .map(player => player.getSyncData());
  }

  /**
   * Handle remote player interpolation
   * @param {Object} player - Player object
   * @param {number} delta - Frame delta time
   */
  handleRemotePlayerInterpolation(player, delta) {
    if (player.isCurrentPlayer) return;
    
    // Smooth interpolation toward remote position
    const lerpFactor = Math.min(1.0, delta / 50); // Adjust based on network conditions
    
    // Position interpolation
    player.x = Phaser.Math.Linear(player.x, player.remotePosition.x, lerpFactor);
    player.y = Phaser.Math.Linear(player.y, player.remotePosition.y, lerpFactor);
    
    // Velocity interpolation for smoother movement prediction
    if (player.body) {
      const targetVx = player.remoteVelocity.x;
      const targetVy = player.remoteVelocity.y;
      
      player.body.velocity.x = Phaser.Math.Linear(player.body.velocity.x, targetVx, lerpFactor);
      player.body.velocity.y = Phaser.Math.Linear(player.body.velocity.y, targetVy, lerpFactor);
    }
  }

  /**
   * Create network-controlled player entity
   * @param {number} index - Player index
   * @param {Object} position - Starting position
   * @param {boolean} isCurrentPlayer - Whether this is the local player
   * @param {Object} networkData - Network player data
   */
  createNetworkPlayer(index, position, isCurrentPlayer = false, networkData = {}) {
    const player = this.createPlayerPhysics(index, position, false, null);
    
    // Set network properties
    player.isCurrentPlayer = isCurrentPlayer;
    player.networkId = networkData.networkId || index;
    player.name = networkData.name || `Player ${index + 1}`;
    
    // Initialize remote sync properties
    player.remotePosition = { x: position.x, y: position.y };
    player.remoteVelocity = { x: 0, y: 0 };
    player.lastSyncTime = 0;
    player.syncInterval = 50; // Sync every 50ms
    
    // Add network-specific update method
    player.updateRemotePosition = function(x, y, vx, vy) {
      this.remotePosition.x = x;
      this.remotePosition.y = y;
      this.remoteVelocity.x = vx;
      this.remoteVelocity.y = vy;
      this.lastSyncTime = Date.now();
    };
    
    // Add sync data getter
    player.getSyncData = function() {
      return {
        id: this.index,
        networkId: this.networkId,
        x: this.x,
        y: this.y,
        vx: this.body ? this.body.velocity.x : 0,
        vy: this.body ? this.body.velocity.y : 0,
        direction: this.moveDirection,
        speed: this.currentSpeed,
        effects: {
          paralyzed: this.paralyzed,
          hasBubble: this.hasBubble,
          magnetized: this.magnetized,
          speedMultiplier: this.speedMultiplier
        },
        timestamp: Date.now()
      };
    };
    
    return player;
  }

  /**
   * Update method with multiplayer support
   */
  updateMultiplayer(time, delta, networkEnabled = false) {
    const players = this.gameEngine.players;
    
    // Update all players
    players.forEach((player, index) => {
      if (!player) return;
      
      if (networkEnabled && !player.isCurrentPlayer) {
        // Handle remote player interpolation
        this.handleRemotePlayerInterpolation(player, delta);
        this.updatePlayerEffects(player, time);
      } else if (!player.paralyzed) {
        // Update local/AI player with full physics
        this.updatePlayerMovement(player, index, time, delta);
        this.updatePlayerEffects(player, time);
        this.detectStuckPlayer(player, index, time);
      }
    });
  }

  /**
   * Validate player state for network sync
   * @param {Object} playerState - Player state from network
   * @returns {boolean} Whether state is valid
   */
  validatePlayerState(playerState) {
    if (!playerState || typeof playerState.id !== 'number') return false;
    if (typeof playerState.x !== 'number' || typeof playerState.y !== 'number') return false;
    if (isNaN(playerState.x) || isNaN(playerState.y)) return false;
    
    // Check bounds
    const bounds = this.gameEngine.config;
    if (playerState.x < 0 || playerState.x > bounds.width) return false;
    if (playerState.y < 0 || playerState.y > bounds.height) return false;
    
    return true;
  }

  /**
   * Handle network player disconnect
   * @param {number} playerId - ID of disconnected player
   */
  handlePlayerDisconnect(playerId) {
    const player = this.gameEngine.players[playerId];
    if (player) {
      // Mark as disconnected but keep in game as AI
      player.isAI = true;
      player.isCurrentPlayer = false;
      player.name += ' (AI)';
      
      console.log(`[PhysicsManager] Player ${playerId} disconnected, converted to AI`);
    }
  }

  /**
   * Handle network player reconnect
   * @param {number} playerId - ID of reconnected player
   * @param {Object} playerData - Player data from network
   */
  handlePlayerReconnect(playerId, playerData) {
    const player = this.gameEngine.players[playerId];
    if (player) {
      // Restore as network player
      player.isAI = false;
      player.isCurrentPlayer = playerData.isCurrentPlayer || false;
      player.name = playerData.name || player.name.replace(' (AI)', '');
      
      // Sync position
      if (playerData.x !== undefined && playerData.y !== undefined) {
        player.x = playerData.x;
        player.y = playerData.y;
      }
      
      console.log(`[PhysicsManager] Player ${playerId} reconnected`);
    }
  }

  /**
   * Get network synchronization statistics
   * @returns {Object} Network sync stats
   */
  getNetworkStats() {
    const players = this.gameEngine.players.filter(p => p);
    const remotePlayers = players.filter(p => !p.isCurrentPlayer);
    
    return {
      totalPlayers: players.length,
      remotePlayers: remotePlayers.length,
      localPlayers: players.length - remotePlayers.length,
      averagePing: remotePlayers.reduce((sum, p) => {
        const ping = Date.now() - (p.lastSyncTime || 0);
        return sum + Math.min(ping, 1000); // Cap at 1 second
      }, 0) / Math.max(remotePlayers.length, 1),
      syncErrors: this.syncErrorCount || 0
    };
  }

  /**
   * Cleanup physics system
   */
  cleanup() {
    this.trackData = null;
    this.trackBitmap = null;
    this.validTrackPositions = [];
    this.stuckPositions = {};
    this.syncErrorCount = 0;
    
    // Clear spatial grid
    if (this.spatialGrid) {
      this.spatialGrid.clear();
      this.spatialGrid.clearCache();
    }
    
    // Clear collision tracking
    this.collisionPairs.clear();
    
    console.log('[PhysicsManager] Cleaned up physics system');
  }
}