/**
 * Player.js - Player Entity for Memex Racing Game
 * 
 * Player entity extending Phaser.Physics.Arcade.Sprite with "blind horse" random movement.
 * Players have NO direct control - they move randomly using AI algorithms.
 */

import Phaser from 'phaser';

/**
 * Player class extending Phaser Physics Arcade Sprite
 * Handles random movement, effects, and multiplayer synchronization
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, texture, frame, config = {}) {
    super(scene, x, y, texture, frame);
    
    // Add to scene and enable physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Configure physics body
    this.body.setCollideWorldBounds(true);
    this.body.setBounce(0.3);
    this.body.setDrag(50);
    
    // Player identification
    this.index = config.index || 0;
    this.name = config.name || `Player ${this.index + 1}`;
    this.isAI = config.isAI || false;
    this.isCurrentPlayer = config.isCurrentPlayer || false;
    this.aiData = config.aiData || null;
    
    // Movement properties - "blind horse" system
    this.baseSpeed = this.generateRandomSpeed(config);
    this.currentSpeed = this.baseSpeed;
    this.speedMultiplier = 1.0;
    this.moveDirection = Math.random() * Math.PI * 2; // Random initial direction
    
    // Biorhythm system for natural variation
    this.biorhythmSpeed = 0.5 + Math.random() * 1.5; // Cycle speed
    this.biorhythmOffset = Math.random() * Math.PI * 2; // Phase offset
    
    // Status effects
    this.paralyzed = false;
    this.hasBubble = false;
    this.magnetized = false;
    this.skills = [];
    
    // Position tracking for stuck detection
    this.lastPositions = [];
    this.stuckCounter = 0;
    this.lastStuckCheck = 0;
    
    // Name text display
    this.nameText = null;
    this.createNameText(scene);
    
    // AI specific properties
    if (this.isAI) {
      this.initializeAI(config);
    }
    
    // Multiplayer sync properties
    this.lastSyncTime = 0;
    this.syncInterval = 50; // Sync every 50ms for smooth gameplay
    this.remotePosition = { x: this.x, y: this.y };
    this.remoteVelocity = { x: 0, y: 0 };
    this.interpolationAlpha = 0;
    
    console.log(`[Player] Created ${this.isAI ? 'AI' : 'Human'} player: ${this.name}`);
  }
  
  /**
   * Generate random base speed with AI modifiers
   */
  generateRandomSpeed(config) {
    const baseRange = { min: 1.2, max: 2.0 };
    let speed = baseRange.min + Math.random() * (baseRange.max - baseRange.min);
    
    // Apply AI skill level modifiers
    if (this.isAI && config.aiData && config.aiData.skillLevel) {
      const skillModifiers = {
        'easy': 0.8,
        'medium': 1.0,
        'hard': 1.1,
        'expert': 1.2
      };
      speed *= skillModifiers[config.aiData.skillLevel] || 1.0;
    }
    
    return speed;
  }
  
  /**
   * Initialize AI-specific properties
   */
  initializeAI(config) {
    this.aiReactionTime = this.calculateAIReactionTime(config.aiData);
    this.aiDecisionCooldown = 0;
    this.aiLastDecision = 0;
    this.aiPathfindingBias = Math.random() * 0.3; // How much AI tries to optimize
  }
  
  /**
   * Calculate AI reaction time based on skill level
   */
  calculateAIReactionTime(aiData) {
    if (!aiData || !aiData.skillLevel) return 200;
    
    const reactionTimes = {
      'easy': 300,
      'medium': 200,
      'hard': 150,
      'expert': 100
    };
    
    const baseTime = reactionTimes[aiData.skillLevel] || 200;
    return baseTime + (Math.random() * 50 - 25); // Add some variability
  }
  
  /**
   * Create name text display
   */
  createNameText(scene) {
    this.nameText = scene.add.text(this.x, this.y + 25, this.name, {
      fontSize: '12px',
      fill: this.isCurrentPlayer ? '#00ff00' : (this.isAI ? '#ffaa00' : '#ffffff'),
      align: 'center',
      stroke: '#000000',
      strokeThickness: 2
    });
    this.nameText.setOrigin(0.5, 0.5);
  }
  
  /**
   * Main update method - handles "blind horse" random movement
   */
  updateMovement(delta) {
    if (this.paralyzed) {
      this.body.setVelocity(0, 0);
      this.updateNamePosition();
      return;
    }
    
    const time = this.scene.time.now;
    
    // Update AI decision making
    if (this.isAI) {
      this.updateAIDecisions(time, delta);
    }
    
    // Random direction changes (core "blind horse" behavior)
    this.applyRandomMovement(time, delta);
    
    // Apply biorhythm performance variation
    this.applyBiorhythm(time);
    
    // Check for stuck situations and handle
    this.handleStuckDetection(time);
    
    // Apply final movement
    this.applyMovementToBody(delta);
    
    // Update name text position
    this.updateNamePosition();
    
    // Handle multiplayer synchronization
    if (!this.isCurrentPlayer) {
      this.handleRemoteSync(delta);
    }
  }
  
  /**
   * Apply random movement changes (core blind horse logic)
   */
  applyRandomMovement(time, delta) {
    // Base random direction changes (2% chance per frame)
    const changeFrequency = this.isAI ? 0.015 : 0.02; // AI slightly more stable
    
    if (Math.random() < changeFrequency) {
      // Random direction change
      const maxChange = Math.PI * 0.3; // 30% of full circle max change
      this.moveDirection += (Math.random() - 0.5) * maxChange;
      
      // Normalize angle
      this.moveDirection = this.moveDirection % (Math.PI * 2);
    }
    
    // Gradual speed changes for more natural movement
    if (Math.random() < 0.01) { // 1% chance per frame
      const speedVariation = 0.1;
      this.currentSpeed += (Math.random() - 0.5) * speedVariation;
      this.currentSpeed = Math.max(0.5, Math.min(this.currentSpeed, 3.0));
    }
  }
  
  /**
   * Apply biorhythm performance variation
   */
  applyBiorhythm(time) {
    const biorhythm = Math.sin(time * 0.0003 * this.biorhythmSpeed + this.biorhythmOffset);
    const variation = 0.15; // 15% variation
    
    this.currentSpeed = this.baseSpeed * this.speedMultiplier * (1 + biorhythm * variation);
  }
  
  /**
   * Update AI decision making
   */
  updateAIDecisions(time, delta) {
    // Update decision cooldown
    if (this.aiDecisionCooldown > 0) {
      this.aiDecisionCooldown -= delta;
      return;
    }
    
    // AI might adjust direction slightly toward goals
    if (this.aiPathfindingBias > 0 && Math.random() < 0.05) {
      this.makeAIDecision(time);
      this.aiDecisionCooldown = this.aiReactionTime;
    }
  }
  
  /**
   * Make AI decision (slight bias toward objectives)
   */
  makeAIDecision(time) {
    const gameEngine = this.scene.gameEngine || this.scene;
    
    // Try to bias toward M token if it exists
    if (gameEngine.mToken && Math.random() < this.aiPathfindingBias) {
      const angleToToken = Math.atan2(
        gameEngine.mToken.y - this.y,
        gameEngine.mToken.x - this.x
      );
      
      // Very subtle bias toward token (only 10% influence)
      const influence = 0.1;
      this.moveDirection = this.lerpAngle(this.moveDirection, angleToToken, influence);
    }
    
    // Consider nearby boosters
    if (gameEngine.boosters && Math.random() < 0.3) {
      const nearbyBooster = this.findNearestBooster(gameEngine.boosters, 100);
      if (nearbyBooster) {
        const angleToBooster = Math.atan2(
          nearbyBooster.y - this.y,
          nearbyBooster.x - this.x
        );
        this.moveDirection = this.lerpAngle(this.moveDirection, angleToBooster, 0.2);
      }
    }
  }
  
  /**
   * Find nearest booster within range
   */
  findNearestBooster(boosters, maxDistance) {
    let nearest = null;
    let minDist = maxDistance;
    
    for (const booster of boosters) {
      if (!booster || !booster.active) continue;
      
      const dist = Phaser.Math.Distance.Between(this.x, this.y, booster.x, booster.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = booster;
      }
    }
    
    return nearest;
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
   * Handle stuck detection and recovery
   */
  handleStuckDetection(time) {
    // Only check every 100ms
    if (time - this.lastStuckCheck < 100) return;
    this.lastStuckCheck = time;
    
    // Track position history
    this.lastPositions.push({ x: this.x, y: this.y, time: time });
    if (this.lastPositions.length > 10) {
      this.lastPositions.shift();
    }
    
    // Check if stuck (moved less than 5 pixels in last second)
    if (this.lastPositions.length >= 10) {
      const oldPos = this.lastPositions[0];
      const distanceMoved = Phaser.Math.Distance.Between(
        this.x, this.y, oldPos.x, oldPos.y
      );
      
      if (distanceMoved < 5) {
        this.stuckCounter++;
        this.handleStuckRecovery();
      } else {
        this.stuckCounter = Math.max(0, this.stuckCounter - 1);
      }
    }
  }
  
  /**
   * Handle stuck recovery with progressive levels
   */
  handleStuckRecovery() {
    if (this.stuckCounter > 20 && this.stuckCounter <= 40) {
      // Level 1: Try new random direction
      this.moveDirection = Math.random() * Math.PI * 2;
      this.currentSpeed = this.baseSpeed * 1.5; // Speed boost
      
    } else if (this.stuckCounter > 40 && this.stuckCounter <= 80) {
      // Level 2: Small teleport
      const angle = Math.random() * Math.PI * 2;
      const distance = 30 + Math.random() * 20;
      this.x += Math.cos(angle) * distance;
      this.y += Math.sin(angle) * distance;
      this.stuckCounter = 0;
      
    } else if (this.stuckCounter > 80) {
      // Level 3: Emergency teleport
      this.emergencyTeleport();
      this.stuckCounter = 0;
    }
  }
  
  /**
   * Emergency teleport to safe position
   */
  emergencyTeleport() {
    const gameEngine = this.scene.gameEngine || this.scene;
    if (gameEngine.physicsManager) {
      const safePos = gameEngine.physicsManager.getRandomValidPosition();
      this.x = safePos.x;
      this.y = safePos.y;
      this.moveDirection = Math.random() * Math.PI * 2;
      
      // Visual effect
      this.scene.add.circle(this.x, this.y, 30, 0xff00ff, 0.5)
        .setBlendMode(Phaser.BlendModes.ADD);
    }
  }
  
  /**
   * Apply movement to physics body
   */
  applyMovementToBody(delta) {
    const moveSpeed = this.currentSpeed * delta / 16;
    
    const velocityX = Math.cos(this.moveDirection) * moveSpeed * 60;
    const velocityY = Math.sin(this.moveDirection) * moveSpeed * 60;
    
    this.body.setVelocity(velocityX, velocityY);
  }
  
  /**
   * Update name text position
   */
  updateNamePosition() {
    if (this.nameText) {
      this.nameText.x = this.x;
      this.nameText.y = this.y + 25;
    }
  }
  
  /**
   * Apply booster effect
   */
  applyBooster(boosterType) {
    if (!boosterType || !boosterType.effects) return;
    
    const effects = boosterType.effects;
    
    // Apply speed multiplier
    this.speedMultiplier = effects.speedMultiplier || 1.0;
    
    // Set duration
    if (effects.duration > 0) {
      this.scene.time.delayedCall(effects.duration, () => {
        this.speedMultiplier = 1.0;
      });
    }
    
    // Visual effects
    this.showBoosterEffect(boosterType);
    
    console.log(`[Player] ${this.name} collected ${boosterType.name}`);
  }
  
  /**
   * Show booster visual effect
   */
  showBoosterEffect(boosterType) {
    // Screen shake
    if (this.scene.cameras && this.scene.cameras.main) {
      this.scene.cameras.main.shake(200, 0.02);
    }
    
    // Particle effect
    const particles = this.scene.add.particles(this.x, this.y, 'particle', {
      speed: { min: 50, max: 100 },
      scale: { start: 0.3, end: 0 },
      tint: parseInt(boosterType.glowColor?.replace('#', '0x') || '0xffffff'),
      lifespan: 500,
      quantity: 8
    });
    
    // Auto-destroy particles
    this.scene.time.delayedCall(1000, () => {
      particles.destroy();
    });
  }
  
  /**
   * Activate skill effect
   */
  activateSkill(skillType) {
    if (!skillType || !skillType.effects) return;
    
    const effects = skillType.effects;
    
    switch (effects.type) {
      case 'paralysis':
        this.activateThunderSkill(effects);
        break;
      case 'burn':
        this.activateFireSkill(effects);
        break;
      case 'protection':
        this.activateBubbleSkill(effects);
        break;
      case 'magnetic_attraction':
        this.activateMagnetSkill(effects);
        break;
      case 'teleport':
        this.activateTeleportSkill(effects);
        break;
    }
    
    console.log(`[Player] ${this.name} activated ${skillType.name}`);
  }
  
  /**
   * Thunder skill - paralyze random players
   */
  activateThunderSkill(effects) {
    const gameEngine = this.scene.gameEngine || this.scene;
    const otherPlayers = gameEngine.players.filter(p => p !== this && !p.paralyzed);
    
    const numTargets = Math.min(effects.targets || 3, otherPlayers.length);
    
    for (let i = 0; i < numTargets; i++) {
      const target = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
      if (target) {
        target.paralyzed = true;
        
        // Show lightning effect
        this.showLightningEffect(target);
        
        // Remove effect after duration
        this.scene.time.delayedCall(effects.duration || 3000, () => {
          target.paralyzed = false;
        });
      }
    }
  }
  
  /**
   * Fire skill - burn and slow players
   */
  activateFireSkill(effects) {
    const gameEngine = this.scene.gameEngine || this.scene;
    const nearestPlayers = this.findNearestPlayers(gameEngine.players, effects.targets || 2);
    
    nearestPlayers.forEach(target => {
      if (target !== this) {
        target.speedMultiplier *= (effects.speedReduction || 0.6);
        
        // Show fire effect
        this.showFireEffect(target);
        
        // Remove effect after duration
        this.scene.time.delayedCall(effects.duration || 5000, () => {
          target.speedMultiplier = 1.0;
        });
      }
    });
  }
  
  /**
   * Bubble skill - protection effect
   */
  activateBubbleSkill(effects) {
    this.hasBubble = true;
    
    // Show bubble effect
    this.showBubbleEffect();
    
    // Remove effect after duration
    this.scene.time.delayedCall(effects.duration || 8000, () => {
      this.hasBubble = false;
    });
  }
  
  /**
   * Magnet skill - attraction effect
   */
  activateMagnetSkill(effects) {
    this.magnetized = true;
    
    // Show magnetic effect
    this.showMagneticEffect();
    
    // Remove effect after duration
    this.scene.time.delayedCall(effects.duration || 5000, () => {
      this.magnetized = false;
    });
  }
  
  /**
   * Teleport skill - teleport all players
   */
  activateTeleportSkill(effects) {
    const gameEngine = this.scene.gameEngine || this.scene;
    
    gameEngine.players.forEach(player => {
      if (player && gameEngine.physicsManager) {
        const newPos = gameEngine.physicsManager.getRandomValidPosition();
        player.x = newPos.x;
        player.y = newPos.y;
        player.stuckCounter = 0;
        
        // Show teleport effect
        this.showTeleportEffect(player);
      }
    });
  }
  
  /**
   * Find nearest players
   */
  findNearestPlayers(players, count) {
    return players
      .filter(p => p !== this)
      .sort((a, b) => {
        const distA = Phaser.Math.Distance.Between(this.x, this.y, a.x, a.y);
        const distB = Phaser.Math.Distance.Between(this.x, this.y, b.x, b.y);
        return distA - distB;
      })
      .slice(0, count);
  }
  
  /**
   * Visual effect methods
   */
  showLightningEffect(target) {
    const lightning = this.scene.add.line(0, 0, this.x, this.y, target.x, target.y, 0xffff00);
    lightning.setLineWidth(3);
    this.scene.time.delayedCall(100, () => lightning.destroy());
  }
  
  showFireEffect(target) {
    const fire = this.scene.add.particles(target.x, target.y, 'particle', {
      speed: 20,
      scale: { start: 0.2, end: 0 },
      tint: 0xff4500,
      lifespan: 1000
    });
    this.scene.time.delayedCall(2000, () => fire.destroy());
  }
  
  showBubbleEffect() {
    const bubble = this.scene.add.circle(this.x, this.y, 35, 0x00bfff, 0.3);
    bubble.setStrokeStyle(2, 0x00bfff);
    this.bubbleEffect = bubble;
  }
  
  showMagneticEffect() {
    const magnetic = this.scene.add.circle(this.x, this.y, 50, 0xff1493, 0.2);
    this.magneticEffect = magnetic;
  }
  
  showTeleportEffect(player) {
    const teleport = this.scene.add.circle(player.x, player.y, 40, 0x9400d3, 0.6);
    teleport.setBlendMode(Phaser.BlendModes.ADD);
    this.scene.time.delayedCall(500, () => teleport.destroy());
  }
  
  /**
   * Handle remote player synchronization
   */
  handleRemoteSync(delta) {
    // Interpolate toward remote position for smooth multiplayer
    const lerpFactor = delta / 100; // Adjust based on network latency
    
    this.x = Phaser.Math.Linear(this.x, this.remotePosition.x, lerpFactor);
    this.y = Phaser.Math.Linear(this.y, this.remotePosition.y, lerpFactor);
  }
  
  /**
   * Update remote position (called by multiplayer system)
   */
  updateRemotePosition(x, y, vx, vy) {
    this.remotePosition.x = x;
    this.remotePosition.y = y;
    this.remoteVelocity.x = vx;
    this.remoteVelocity.y = vy;
    this.lastSyncTime = this.scene.time.now;
  }
  
  /**
   * Get sync data for multiplayer
   */
  getSyncData() {
    return {
      id: this.index,
      x: this.x,
      y: this.y,
      vx: this.body.velocity.x,
      vy: this.body.velocity.y,
      direction: this.moveDirection,
      speed: this.currentSpeed,
      effects: {
        paralyzed: this.paralyzed,
        hasBubble: this.hasBubble,
        magnetized: this.magnetized,
        speedMultiplier: this.speedMultiplier
      }
    };
  }
  
  /**
   * Reset player for new race
   */
  reset() {
    // Reset position and movement
    this.currentSpeed = this.baseSpeed;
    this.speedMultiplier = 1.0;
    this.moveDirection = Math.random() * Math.PI * 2;
    this.body.setVelocity(0, 0);
    
    // Reset effects
    this.paralyzed = false;
    this.hasBubble = false;
    this.magnetized = false;
    
    // Reset tracking
    this.lastPositions = [];
    this.stuckCounter = 0;
    
    // Clean up visual effects
    if (this.bubbleEffect) {
      this.bubbleEffect.destroy();
      this.bubbleEffect = null;
    }
    if (this.magneticEffect) {
      this.magneticEffect.destroy();
      this.magneticEffect = null;
    }
    
    console.log(`[Player] ${this.name} reset for new race`);
  }
  
  /**
   * Cleanup when player is destroyed
   */
  destroy() {
    if (this.nameText) {
      this.nameText.destroy();
    }
    if (this.bubbleEffect) {
      this.bubbleEffect.destroy();
    }
    if (this.magneticEffect) {
      this.magneticEffect.destroy();
    }
    
    super.destroy();
  }
}