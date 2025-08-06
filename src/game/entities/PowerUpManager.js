/**
 * PowerUpManager.js - Custom Power-up Management System
 * 
 * Comprehensive power-up system providing plugin architecture, dynamic loading,
 * custom effects, and extensibility for user-created power-ups.
 * 
 * Key Features:
 * - Plugin architecture for custom power-up effects
 * - Dynamic loading from configuration files
 * - Validation system for custom power-ups
 * - Visual and audio effect integration
 * - Duration and cooldown management
 * - Collision detection with players
 * - Hot-reload support for development
 * - Extensible effect system
 */

import Phaser from 'phaser';
import { Booster } from './Booster.js';
import { ConfigManager, ConfigType } from '@game/systems/ConfigManager';
import { AssetManager } from '@game/systems/AssetManager';

/**
 * Power-up effect types
 */
export const PowerUpEffectType = {
  SPEED_BOOST: 'speed_boost',
  PARALYSIS: 'paralysis',
  BURN: 'burn',
  PROTECTION: 'protection',
  MAGNETIC_ATTRACTION: 'magnetic_attraction',
  TELEPORT: 'teleport',
  CUSTOM: 'custom'
};

/**
 * Power-up states
 */
export const PowerUpState = {
  PENDING: 'pending',
  SPAWNING: 'spawning',
  ACTIVE: 'active',
  COLLECTED: 'collected',
  EXPIRED: 'expired',
  ERROR: 'error'
};

/**
 * Validation result for custom power-ups
 */
export class PowerUpValidationResult {
  constructor(valid = false) {
    this.valid = valid;
    this.errors = [];
    this.warnings = [];
    this.timestamp = Date.now();
  }

  addError(message) {
    this.errors.push(message);
    this.valid = false;
  }

  addWarning(message) {
    this.warnings.push(message);
  }

  hasErrors() {
    return this.errors.length > 0;
  }

  hasWarnings() {
    return this.warnings.length > 0;
  }
}

/**
 * Base class for power-up effects
 */
export class PowerUpEffect {
  constructor(config = {}) {
    this.name = config.name || 'Unknown Effect';
    this.type = config.type || PowerUpEffectType.CUSTOM;
    this.duration = config.duration || 5000;
    this.intensity = config.intensity || 1.0;
    this.config = config;
    this.active = false;
    this.startTime = 0;
  }

  /**
   * Apply effect to target(s)
   */
  apply(target, powerUpManager) {
    this.active = true;
    this.startTime = Date.now();
    console.log(`[PowerUpEffect] Applied ${this.name} to target`);
  }

  /**
   * Update effect (called each frame while active)
   */
  update(target, deltaTime) {
    if (!this.active) return false;

    const elapsed = Date.now() - this.startTime;
    if (elapsed >= this.duration) {
      this.remove(target);
      return false;
    }

    return true;
  }

  /**
   * Remove effect from target
   */
  remove(target) {
    this.active = false;
    console.log(`[PowerUpEffect] Removed ${this.name} from target`);
  }

  /**
   * Get effect progress (0-1)
   */
  getProgress() {
    if (!this.active) return 0;
    const elapsed = Date.now() - this.startTime;
    return Math.min(elapsed / this.duration, 1);
  }
}

/**
 * Speed boost effect implementation
 */
export class SpeedBoostEffect extends PowerUpEffect {
  constructor(config) {
    super({ type: PowerUpEffectType.SPEED_BOOST, name: 'Speed Boost', ...config });
    this.speedMultiplier = config.speedMultiplier || 1.5;
    this.originalSpeed = null;
  }

  apply(target, powerUpManager) {
    super.apply(target, powerUpManager);
    if (target.baseSpeed !== undefined) {
      this.originalSpeed = target.baseSpeed;
      target.baseSpeed *= this.speedMultiplier;
    }
    
    // Create visual effect
    this.createSpeedLines(target, powerUpManager.scene);
  }

  remove(target) {
    super.remove(target);
    if (this.originalSpeed !== null && target.baseSpeed !== undefined) {
      target.baseSpeed = this.originalSpeed;
    }
    
    // Clean up visual effects
    if (this.speedLines) {
      this.speedLines.destroy();
    }
  }

  createSpeedLines(target, scene) {
    this.speedLines = scene.add.particles(target.x, target.y, 'particle', {
      speed: { min: 50, max: 100 },
      scale: { start: 0.2, end: 0 },
      tint: 0x00ff00,
      lifespan: 500,
      frequency: 100,
      quantity: 2
    });

    // Follow target
    this.speedLines.startFollow(target);
  }
}

/**
 * Paralysis effect implementation
 */
export class ParalysisEffect extends PowerUpEffect {
  constructor(config) {
    super({ type: PowerUpEffectType.PARALYSIS, name: 'Paralysis', ...config });
    this.originalCanMove = null;
  }

  apply(target, powerUpManager) {
    super.apply(target, powerUpManager);
    if (target.canMove !== undefined) {
      this.originalCanMove = target.canMove;
      target.canMove = false;
    }
    
    // Create paralysis visual effect
    this.createParalysisEffect(target, powerUpManager.scene);
  }

  remove(target) {
    super.remove(target);
    if (this.originalCanMove !== null && target.canMove !== undefined) {
      target.canMove = this.originalCanMove;
    }
    
    // Clean up visual effects
    if (this.paralysisEffect) {
      this.paralysisEffect.destroy();
    }
  }

  createParalysisEffect(target, scene) {
    this.paralysisEffect = scene.add.circle(target.x, target.y, 35, 0xffff00, 0.3);
    this.paralysisEffect.setStrokeStyle(2, 0xffff00);

    // Pulsing animation
    scene.tweens.add({
      targets: this.paralysisEffect,
      alpha: 0.1,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 500,
      yoyo: true,
      repeat: -1
    });

    // Follow target
    const followTween = scene.tweens.add({
      targets: this.paralysisEffect,
      x: target.x,
      y: target.y,
      duration: 0,
      repeat: -1,
      onUpdate: () => {
        this.paralysisEffect.x = target.x;
        this.paralysisEffect.y = target.y;
      }
    });
  }
}

/**
 * Main Power-up Management System
 */
export class PowerUpManager {
  constructor(scene, config = {}) {
    this.scene = scene;
    
    // Configuration
    this.config = {
      maxActivePowerUps: 8,
      spawnRate: 0.05,
      enableCustomPowerUps: true,
      enableValidation: true,
      enableHotReload: process.env.NODE_ENV === 'development',
      customPowerUpPath: 'data/config/custom-power-ups/',
      ...config
    };

    // Dependency injection
    this.configManager = config.configManager || new ConfigManager();
    this.assetManager = config.assetManager || new AssetManager(scene);
    this.physicsManager = config.physicsManager || null;

    // Power-up registry
    this.powerUpDefinitions = new Map();
    this.activePowerUps = new Map();
    this.spawnedPowerUps = [];
    this.activeEffects = new Map(); // Player ID -> [effects]
    
    // Effect plugins registry
    this.effectPlugins = new Map();
    this.customEffects = new Map();
    
    // Statistics
    this.stats = {
      totalSpawned: 0,
      totalCollected: 0,
      totalExpired: 0,
      customPowerUpsLoaded: 0,
      validationErrors: 0,
      hotReloads: 0
    };

    // Event callbacks
    this.eventCallbacks = {
      onPowerUpSpawned: [],
      onPowerUpCollected: [],
      onPowerUpExpired: [],
      onEffectApplied: [],
      onEffectRemoved: [],
      onValidationError: []
    };

    console.log('[PowerUpManager] Initialized with config:', this.config);

    // Initialize system
    this.initializeEffectPlugins();
    this.loadPowerUpDefinitions();

    if (this.config.enableHotReload) {
      this.setupHotReload();
    }
  }

  /**
   * Initialize built-in effect plugins
   */
  initializeEffectPlugins() {
    // Register built-in effects
    this.registerEffectPlugin(PowerUpEffectType.SPEED_BOOST, SpeedBoostEffect);
    this.registerEffectPlugin(PowerUpEffectType.PARALYSIS, ParalysisEffect);
    
    // Additional built-in effects can be added here
    console.log('[PowerUpManager] Built-in effect plugins initialized');
  }

  /**
   * Register a custom effect plugin
   */
  registerEffectPlugin(type, effectClass) {
    if (typeof effectClass !== 'function') {
      throw new Error(`Effect plugin must be a class constructor: ${type}`);
    }

    this.effectPlugins.set(type, effectClass);
    console.log(`[PowerUpManager] Registered effect plugin: ${type}`);
  }

  /**
   * Load power-up definitions from configuration
   */
  async loadPowerUpDefinitions() {
    try {
      // Load built-in power-up definitions
      const powerUpConfig = await this.configManager.loadConfiguration(ConfigType.POWER_UP_DEFINITIONS);
      
      if (powerUpConfig && powerUpConfig.boosters) {
        for (const [id, definition] of Object.entries(powerUpConfig.boosters)) {
          this.powerUpDefinitions.set(id, {
            ...definition,
            id,
            source: 'built-in',
            validated: true
          });
        }
      }

      if (powerUpConfig && powerUpConfig.skills) {
        for (const [id, definition] of Object.entries(powerUpConfig.skills)) {
          this.powerUpDefinitions.set(id, {
            ...definition,
            id,
            source: 'built-in',
            validated: true,
            isSkill: true
          });
        }
      }

      console.log(`[PowerUpManager] Loaded ${this.powerUpDefinitions.size} built-in power-up definitions`);

      // Load custom power-ups if enabled
      if (this.config.enableCustomPowerUps) {
        await this.loadCustomPowerUps();
      }

    } catch (error) {
      console.error('[PowerUpManager] Failed to load power-up definitions:', error);
    }
  }

  /**
   * Load custom power-up definitions
   */
  async loadCustomPowerUps() {
    try {
      // In a real implementation, this would scan a directory for custom files
      // For now, we'll demonstrate with a hypothetical custom power-up
      const customPowerUps = await this.loadCustomPowerUpFiles();

      for (const customPowerUp of customPowerUps) {
        const validationResult = this.validateCustomPowerUp(customPowerUp);
        
        if (validationResult.valid) {
          this.powerUpDefinitions.set(customPowerUp.id, {
            ...customPowerUp,
            source: 'custom',
            validated: true
          });
          this.stats.customPowerUpsLoaded++;
          console.log(`[PowerUpManager] Loaded custom power-up: ${customPowerUp.id}`);
        } else {
          this.stats.validationErrors++;
          console.error(`[PowerUpManager] Custom power-up validation failed: ${customPowerUp.id}`, validationResult.errors);
          this.emitEvent('onValidationError', { powerUp: customPowerUp, errors: validationResult.errors });
        }
      }

    } catch (error) {
      console.error('[PowerUpManager] Failed to load custom power-ups:', error);
    }
  }

  /**
   * Load custom power-up files (placeholder implementation)
   */
  async loadCustomPowerUpFiles() {
    // This would scan the custom power-up directory in a real implementation
    // For demonstration, return an example custom power-up
    return [
      {
        id: 'custom_rainbow_boost',
        name: 'Rainbow Boost',
        description: 'A colorful speed boost with rainbow trail',
        rarity: 'uncommon',
        effects: {
          speedMultiplier: 2.2,
          duration: 3500,
          visualEffect: 'rainbow_trail'
        },
        spawnWeight: 0.08,
        glowColor: '#ff69b4',
        customEffect: {
          type: 'rainbow_boost',
          trailColors: ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'],
          particleCount: 15
        }
      }
    ];
  }

  /**
   * Validate custom power-up definition
   */
  validateCustomPowerUp(powerUpDef) {
    const result = new PowerUpValidationResult(true);

    // Required fields
    if (!powerUpDef.id) {
      result.addError('Power-up must have an id');
    }
    
    if (!powerUpDef.name) {
      result.addError('Power-up must have a name');
    }
    
    if (!powerUpDef.effects) {
      result.addError('Power-up must have effects definition');
    }

    // Validate effects
    if (powerUpDef.effects) {
      if (typeof powerUpDef.effects.speedMultiplier === 'number') {
        if (powerUpDef.effects.speedMultiplier <= 0 || powerUpDef.effects.speedMultiplier > 10) {
          result.addWarning('Speed multiplier should be between 0 and 10');
        }
      }

      if (typeof powerUpDef.effects.duration === 'number') {
        if (powerUpDef.effects.duration < 100 || powerUpDef.effects.duration > 60000) {
          result.addWarning('Duration should be between 100ms and 60 seconds');
        }
      }
    }

    // Validate rarity
    if (powerUpDef.rarity) {
      const validRarities = ['common', 'uncommon', 'rare', 'legendary'];
      if (!validRarities.includes(powerUpDef.rarity)) {
        result.addError(`Invalid rarity: ${powerUpDef.rarity}. Must be one of: ${validRarities.join(', ')}`);
      }
    }

    // Validate spawn weight
    if (typeof powerUpDef.spawnWeight === 'number') {
      if (powerUpDef.spawnWeight < 0 || powerUpDef.spawnWeight > 1) {
        result.addError('Spawn weight must be between 0 and 1');
      }
    }

    // Validate custom effect if present
    if (powerUpDef.customEffect) {
      const customValidation = this.validateCustomEffect(powerUpDef.customEffect);
      if (!customValidation.valid) {
        result.errors.push(...customValidation.errors);
        result.warnings.push(...customValidation.warnings);
      }
    }

    return result;
  }

  /**
   * Validate custom effect definition
   */
  validateCustomEffect(effectDef) {
    const result = new PowerUpValidationResult(true);

    if (!effectDef.type) {
      result.addError('Custom effect must have a type');
    }

    // Validate specific custom effect types
    switch (effectDef.type) {
      case 'rainbow_boost':
        if (!Array.isArray(effectDef.trailColors)) {
          result.addError('Rainbow boost must have trailColors array');
        }
        if (typeof effectDef.particleCount !== 'number') {
          result.addWarning('Rainbow boost should specify particleCount');
        }
        break;
      // Add more custom effect validations as needed
    }

    return result;
  }

  /**
   * Spawn a power-up at specified location
   */
  spawnPowerUp(x, y, powerUpId = null) {
    // Check if we've reached the maximum active power-ups
    if (this.spawnedPowerUps.length >= this.config.maxActivePowerUps) {
      return null;
    }

    // Select power-up type
    const definition = powerUpId ? 
      this.powerUpDefinitions.get(powerUpId) : 
      this.selectRandomPowerUp();

    if (!definition) {
      console.warn('[PowerUpManager] No valid power-up definition found');
      return null;
    }

    try {
      // Create booster entity with power-up definition
      const powerUp = new Booster(this.scene, x, y, {
        boosterType: definition,
        texture: 'booster', // Default texture
        frame: this.getFrameForPowerUp(definition)
      });

      // Register the power-up
      const powerUpInstance = {
        id: `powerup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        entity: powerUp,
        definition: definition,
        state: PowerUpState.ACTIVE,
        spawnTime: Date.now(),
        position: { x, y }
      };

      this.spawnedPowerUps.push(powerUpInstance);
      this.activePowerUps.set(powerUpInstance.id, powerUpInstance);

      // Update statistics
      this.stats.totalSpawned++;

      console.log(`[PowerUpManager] Spawned power-up: ${definition.name} at (${x}, ${y})`);

      // Emit event
      this.emitEvent('onPowerUpSpawned', powerUpInstance);

      return powerUpInstance;

    } catch (error) {
      console.error('[PowerUpManager] Failed to spawn power-up:', error);
      return null;
    }
  }

  /**
   * Select random power-up based on spawn weights
   */
  selectRandomPowerUp() {
    const availablePowerUps = Array.from(this.powerUpDefinitions.values())
      .filter(def => def.spawnWeight > 0 && !def.isSkill);

    if (availablePowerUps.length === 0) {
      return null;
    }

    // Weighted random selection
    const totalWeight = availablePowerUps.reduce((sum, def) => sum + def.spawnWeight, 0);
    let random = Math.random() * totalWeight;

    for (const definition of availablePowerUps) {
      random -= definition.spawnWeight;
      if (random <= 0) {
        return definition;
      }
    }

    // Fallback to first available
    return availablePowerUps[0];
  }

  /**
   * Get sprite frame for power-up
   */
  getFrameForPowerUp(definition) {
    // Map power-up types to sprite frames
    const frameMap = {
      'antenna_booster': 0,
      'twitter_post': 1,
      'memex_tag': 2,
      'poo': 3,
      'toilet_paper': 4,
      'toilet': 5,
      'banana': 6,
      'king_kong': 7
    };

    return frameMap[definition.id] || 0;
  }

  /**
   * Handle power-up collection by player
   */
  collectPowerUp(powerUpInstance, player) {
    if (!powerUpInstance || powerUpInstance.state !== PowerUpState.ACTIVE) {
      return false;
    }

    try {
      // Update state
      powerUpInstance.state = PowerUpState.COLLECTED;

      // Apply power-up effects
      this.applyPowerUpEffects(powerUpInstance.definition, player);

      // Remove from active lists
      this.removePowerUpInstance(powerUpInstance);

      // Update statistics
      this.stats.totalCollected++;

      console.log(`[PowerUpManager] Power-up collected: ${powerUpInstance.definition.name} by ${player.name || 'Player'}`);

      // Emit event
      this.emitEvent('onPowerUpCollected', { powerUp: powerUpInstance, player });

      return true;

    } catch (error) {
      console.error('[PowerUpManager] Failed to collect power-up:', error);
      return false;
    }
  }

  /**
   * Apply power-up effects to player
   */
  applyPowerUpEffects(definition, player) {
    const playerId = player.id || player.name || 'unknown';

    // Create effect based on definition
    let effect = null;

    if (definition.customEffect) {
      // Handle custom effects
      effect = this.createCustomEffect(definition.customEffect, definition);
    } else if (definition.effects) {
      // Handle standard effects
      if (definition.effects.speedMultiplier) {
        effect = new SpeedBoostEffect({
          speedMultiplier: definition.effects.speedMultiplier,
          duration: definition.effects.duration || 5000
        });
      }
    }

    if (effect) {
      // Apply the effect
      effect.apply(player, this);

      // Track active effects
      if (!this.activeEffects.has(playerId)) {
        this.activeEffects.set(playerId, []);
      }
      this.activeEffects.get(playerId).push(effect);

      console.log(`[PowerUpManager] Applied effect: ${effect.name} to player ${playerId}`);

      // Emit event
      this.emitEvent('onEffectApplied', { effect, player, definition });
    }
  }

  /**
   * Create custom effect instance
   */
  createCustomEffect(customEffectDef, powerUpDef) {
    switch (customEffectDef.type) {
      case 'rainbow_boost':
        return new RainbowBoostEffect({
          ...customEffectDef,
          duration: powerUpDef.effects?.duration || 5000
        });
      
      default:
        console.warn(`[PowerUpManager] Unknown custom effect type: ${customEffectDef.type}`);
        return null;
    }
  }

  /**
   * Update all active power-ups and effects
   */
  update(time, delta) {
    // Update spawned power-ups
    this.updateSpawnedPowerUps(time, delta);

    // Update active effects
    this.updateActiveEffects(time, delta);

    // Handle automatic spawning
    this.handleAutomaticSpawning(time);
  }

  /**
   * Update spawned power-ups
   */
  updateSpawnedPowerUps(time, delta) {
    for (let i = this.spawnedPowerUps.length - 1; i >= 0; i--) {
      const powerUpInstance = this.spawnedPowerUps[i];
      
      // Update the entity
      if (powerUpInstance.entity && powerUpInstance.entity.update) {
        powerUpInstance.entity.update(time, delta);
      }

      // Check if expired
      if (!powerUpInstance.entity.active) {
        this.expirePowerUp(powerUpInstance);
      }
    }
  }

  /**
   * Update active effects on players
   */
  updateActiveEffects(time, delta) {
    for (const [playerId, effects] of this.activeEffects) {
      for (let i = effects.length - 1; i >= 0; i--) {
        const effect = effects[i];
        
        // Update effect
        const stillActive = effect.update(null, delta); // Player reference would be needed here
        
        if (!stillActive) {
          // Remove expired effect
          effects.splice(i, 1);
          this.emitEvent('onEffectRemoved', { effect, playerId });
        }
      }

      // Clean up empty effect arrays
      if (effects.length === 0) {
        this.activeEffects.delete(playerId);
      }
    }
  }

  /**
   * Handle automatic power-up spawning
   */
  handleAutomaticSpawning(time) {
    if (!this.physicsManager || this.spawnedPowerUps.length >= this.config.maxActivePowerUps) {
      return;
    }

    // Check spawn rate
    if (Math.random() < this.config.spawnRate) {
      const position = this.physicsManager.getRandomValidPosition();
      if (position) {
        this.spawnPowerUp(position.x, position.y);
      }
    }
  }

  /**
   * Expire a power-up
   */
  expirePowerUp(powerUpInstance) {
    powerUpInstance.state = PowerUpState.EXPIRED;
    this.removePowerUpInstance(powerUpInstance);
    this.stats.totalExpired++;
    
    console.log(`[PowerUpManager] Power-up expired: ${powerUpInstance.definition.name}`);
    this.emitEvent('onPowerUpExpired', powerUpInstance);
  }

  /**
   * Remove power-up instance from tracking
   */
  removePowerUpInstance(powerUpInstance) {
    // Remove from spawned list
    const spawnedIndex = this.spawnedPowerUps.findIndex(p => p.id === powerUpInstance.id);
    if (spawnedIndex > -1) {
      this.spawnedPowerUps.splice(spawnedIndex, 1);
    }

    // Remove from active map
    this.activePowerUps.delete(powerUpInstance.id);
  }

  /**
   * Check collision between power-up and player
   */
  checkCollisions(players) {
    for (const powerUpInstance of this.spawnedPowerUps) {
      if (powerUpInstance.state !== PowerUpState.ACTIVE) continue;

      for (const player of players) {
        if (this.checkCollision(powerUpInstance.entity, player)) {
          // Attempt collection
          if (powerUpInstance.entity.collect(player)) {
            this.collectPowerUp(powerUpInstance, player);
          }
        }
      }
    }
  }

  /**
   * Check collision between two entities
   */
  checkCollision(entity1, entity2) {
    if (!entity1 || !entity2) return false;

    const distance = Phaser.Math.Distance.Between(
      entity1.x, entity1.y,
      entity2.x, entity2.y
    );

    return distance < 32; // Collision radius
  }

  /**
   * Get power-up definition by ID
   */
  getPowerUpDefinition(id) {
    return this.powerUpDefinitions.get(id);
  }

  /**
   * Get all power-up definitions
   */
  getAllPowerUpDefinitions() {
    return Array.from(this.powerUpDefinitions.values());
  }

  /**
   * Add custom power-up definition at runtime
   */
  addCustomPowerUp(definition) {
    const validationResult = this.validateCustomPowerUp(definition);
    
    if (!validationResult.valid) {
      throw new Error(`Invalid power-up definition: ${validationResult.errors.join(', ')}`);
    }

    this.powerUpDefinitions.set(definition.id, {
      ...definition,
      source: 'runtime',
      validated: true
    });

    console.log(`[PowerUpManager] Added runtime power-up: ${definition.id}`);
  }

  /**
   * Remove power-up definition
   */
  removePowerUpDefinition(id) {
    const removed = this.powerUpDefinitions.delete(id);
    if (removed) {
      console.log(`[PowerUpManager] Removed power-up definition: ${id}`);
    }
    return removed;
  }

  /**
   * Setup hot reload for development
   */
  setupHotReload() {
    if (this.configManager) {
      this.configManager.addEventListener('configurationHotReloaded', (data) => {
        if (data.type === ConfigType.POWER_UP_DEFINITIONS) {
          console.log('[PowerUpManager] Hot reloading power-up definitions...');
          this.loadPowerUpDefinitions();
          this.stats.hotReloads++;
        }
      });
    }

    console.log('[PowerUpManager] Hot reload system enabled');
  }

  /**
   * Event system methods
   */
  addEventListener(eventType, callback) {
    if (this.eventCallbacks[eventType]) {
      this.eventCallbacks[eventType].push(callback);
    }
  }

  removeEventListener(eventType, callback) {
    if (this.eventCallbacks[eventType]) {
      const index = this.eventCallbacks[eventType].indexOf(callback);
      if (index > -1) {
        this.eventCallbacks[eventType].splice(index, 1);
      }
    }
  }

  emitEvent(eventType, data) {
    if (this.eventCallbacks[eventType]) {
      this.eventCallbacks[eventType].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[PowerUpManager] Event callback error for '${eventType}':`, error);
        }
      });
    }
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    return {
      ...this.stats,
      activePowerUps: this.spawnedPowerUps.length,
      totalDefinitions: this.powerUpDefinitions.size,
      activeEffects: Array.from(this.activeEffects.values()).reduce((sum, effects) => sum + effects.length, 0),
      effectPlugins: this.effectPlugins.size
    };
  }

  /**
   * Clear all active power-ups and effects
   */
  clear() {
    // Remove all spawned power-ups
    for (const powerUpInstance of this.spawnedPowerUps) {
      if (powerUpInstance.entity) {
        powerUpInstance.entity.destroy();
      }
    }

    // Clear all tracking
    this.spawnedPowerUps = [];
    this.activePowerUps.clear();
    this.activeEffects.clear();

    console.log('[PowerUpManager] Cleared all active power-ups and effects');
  }

  /**
   * Destroy the power-up manager
   */
  destroy() {
    // Clear all active content
    this.clear();

    // Clear definitions and plugins
    this.powerUpDefinitions.clear();
    this.effectPlugins.clear();
    this.customEffects.clear();

    // Clear event callbacks
    for (const eventType of Object.keys(this.eventCallbacks)) {
      this.eventCallbacks[eventType] = [];
    }

    console.log('[PowerUpManager] Power-up manager destroyed');
  }
}

/**
 * Custom Rainbow Boost Effect
 */
export class RainbowBoostEffect extends PowerUpEffect {
  constructor(config) {
    super({ type: 'rainbow_boost', name: 'Rainbow Boost', ...config });
    this.speedMultiplier = config.speedMultiplier || 2.2;
    this.trailColors = config.trailColors || ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'];
    this.particleCount = config.particleCount || 15;
    this.originalSpeed = null;
  }

  apply(target, powerUpManager) {
    super.apply(target, powerUpManager);
    
    if (target.baseSpeed !== undefined) {
      this.originalSpeed = target.baseSpeed;
      target.baseSpeed *= this.speedMultiplier;
    }
    
    // Create rainbow trail effect
    this.createRainbowTrail(target, powerUpManager.scene);
  }

  remove(target) {
    super.remove(target);
    
    if (this.originalSpeed !== null && target.baseSpeed !== undefined) {
      target.baseSpeed = this.originalSpeed;
    }
    
    // Clean up visual effects
    if (this.rainbowTrail) {
      this.rainbowTrail.destroy();
    }
  }

  createRainbowTrail(target, scene) {
    this.rainbowTrail = scene.add.particles(target.x, target.y, 'particle', {
      speed: { min: 30, max: 80 },
      scale: { start: 0.3, end: 0 },
      tint: this.trailColors.map(color => parseInt(color.replace('#', '0x'))),
      lifespan: 800,
      frequency: 50,
      quantity: this.particleCount
    });

    // Follow target
    this.rainbowTrail.startFollow(target);
  }
}

export default PowerUpManager;