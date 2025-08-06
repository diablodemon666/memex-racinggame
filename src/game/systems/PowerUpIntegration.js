/**
 * PowerUpIntegration.js - Integration Bridge for Power-up Systems
 * 
 * Provides seamless integration between the PowerUpManager, existing game systems,
 * and the Phaser.js game engine. Handles collision detection, visual effects,
 * audio management, and system coordination.
 * 
 * Key Features:
 * - Integration with existing Booster.js entities
 * - Collision detection with PhysicsManager
 * - Visual effects coordination with RenderManager
 * - Audio system integration
 * - Performance optimization
 * - Event bridging between systems
 * - Hot-reload coordination
 */

import { PowerUpManager } from '@game/entities/PowerUpManager';
import { PowerUpPluginSystem } from '@game/systems/PowerUpPluginSystem';
import { PowerUpEditor } from '@ui/components/PowerUpEditor';

/**
 * Integration states
 */
export const IntegrationState = {
  UNINITIALIZED: 'uninitialized',
  INITIALIZING: 'initializing',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ERROR: 'error'
};

/**
 * Power-up System Integration Manager
 */
export class PowerUpIntegration {
  constructor(gameEngine, config = {}) {
    this.gameEngine = gameEngine;
    this.scene = gameEngine.scene;
    
    this.config = {
      enableVisualEffects: true,
      enableAudioEffects: true,
      enableCollisionDetection: true,
      enableParticleEffects: true,
      maxParticles: 200,
      effectPoolSize: 50,
      collisionCheckInterval: 16, // ~60 FPS
      visualEffectQuality: 'high', // low, medium, high
      ...config
    };

    // System references
    this.powerUpManager = null;
    this.pluginSystem = null;
    this.editor = null;
    
    // Integration state
    this.state = IntegrationState.UNINITIALIZED;
    this.lastCollisionCheck = 0;
    
    // Effect pools for performance
    this.particlePool = [];
    this.tweenPool = [];
    this.soundEffects = new Map();
    
    // Performance tracking
    this.performanceMetrics = {
      collisionChecks: 0,
      effectsCreated: 0,
      particlesActive: 0,
      tweensActive: 0,
      averageFrameTime: 0,
      lastFrameTime: 0
    };

    // Event listeners
    this.eventListeners = [];

    console.log('[PowerUpIntegration] Integration manager created');
  }

  /**
   * Initialize the power-up integration system
   */
  async initialize() {
    if (this.state !== IntegrationState.UNINITIALIZED) {
      console.warn('[PowerUpIntegration] Already initialized');
      return;
    }

    this.state = IntegrationState.INITIALIZING;

    try {
      // Initialize PowerUpManager
      await this.initializePowerUpManager();

      // Initialize Plugin System
      await this.initializePluginSystem();

      // Initialize Editor (if in development mode)
      if (process.env.NODE_ENV === 'development') {
        await this.initializeEditor();
      }

      // Setup system integrations
      this.setupPhysicsIntegration();
      this.setupRenderIntegration();
      this.setupAudioIntegration();
      this.setupEventIntegration();

      // Initialize effect pools
      this.initializeEffectPools();

      this.state = IntegrationState.ACTIVE;
      console.log('[PowerUpIntegration] Successfully initialized');

    } catch (error) {
      this.state = IntegrationState.ERROR;
      console.error('[PowerUpIntegration] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize PowerUpManager
   */
  async initializePowerUpManager() {
    this.powerUpManager = new PowerUpManager(this.scene, {
      configManager: this.gameEngine.configManager,
      assetManager: this.gameEngine.assetManager,
      physicsManager: this.gameEngine.physicsManager,
      maxActivePowerUps: this.config.maxActivePowerUps || 8,
      spawnRate: this.config.spawnRate || 0.05,
      enableCustomPowerUps: true,
      enableValidation: true,
      enableHotReload: this.config.enableHotReload
    });

    // Load power-up definitions
    await this.powerUpManager.loadPowerUpDefinitions();

    console.log('[PowerUpIntegration] PowerUpManager initialized');
  }

  /**
   * Initialize Plugin System
   */
  async initializePluginSystem() {
    this.pluginSystem = new PowerUpPluginSystem(this.powerUpManager, {
      pluginDirectory: 'data/plugins/',
      enableHotReload: this.config.enableHotReload,
      enableSandbox: true
    });

    // Initialize and load built-in plugins
    await this.pluginSystem.initialize();

    console.log('[PowerUpIntegration] Plugin system initialized');
  }

  /**
   * Initialize Editor (development only)
   */
  async initializeEditor() {
    // Create editor container if it doesn't exist
    let editorContainer = document.getElementById('powerup-editor');
    if (!editorContainer) {
      editorContainer = document.createElement('div');
      editorContainer.id = 'powerup-editor';
      editorContainer.style.display = 'none';
      document.body.appendChild(editorContainer);
    }

    this.editor = new PowerUpEditor(editorContainer, {
      powerUpManager: this.powerUpManager,
      assetManager: this.gameEngine.assetManager,
      onSave: (powerUpData) => this.handleEditorSave(powerUpData),
      onCancel: () => this.handleEditorCancel()
    });

    // Add keyboard shortcut to open editor (Ctrl+P)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        this.openPowerUpEditor();
      }
    });

    console.log('[PowerUpIntegration] Power-up editor initialized');
  }

  /**
   * Setup physics integration
   */
  setupPhysicsIntegration() {
    if (!this.config.enableCollisionDetection) return;

    // Override existing collision detection for power-ups
    const originalUpdate = this.gameEngine.physicsManager.update.bind(this.gameEngine.physicsManager);
    
    this.gameEngine.physicsManager.update = (time, delta) => {
      // Run original physics update
      originalUpdate(time, delta);

      // Add power-up collision detection
      if (time - this.lastCollisionCheck >= this.config.collisionCheckInterval) {
        this.checkPowerUpCollisions();
        this.lastCollisionCheck = time;
      }
    };

    console.log('[PowerUpIntegration] Physics integration setup complete');
  }

  /**
   * Setup render integration
   */
  setupRenderIntegration() {
    if (!this.config.enableVisualEffects) return;

    // Integrate with RenderManager for visual effects
    if (this.gameEngine.renderManager) {
      // Add power-up layer to render pipeline
      this.gameEngine.renderManager.addRenderLayer('powerups', {
        depth: 15,
        blend: 'normal'
      });

      // Hook into render updates for visual effects
      this.gameEngine.renderManager.addEventListener('preRender', () => {
        this.updateVisualEffects();
      });
    }

    console.log('[PowerUpIntegration] Render integration setup complete');
  }

  /**
   * Setup audio integration
   */
  setupAudioIntegration() {
    if (!this.config.enableAudioEffects) return;

    // Preload power-up sound effects
    this.preloadAudioEffects();

    // Setup audio event listeners
    this.powerUpManager.addEventListener('onPowerUpCollected', (data) => {
      this.playPowerUpSound(data.powerUp.definition);
    });

    this.powerUpManager.addEventListener('onPowerUpSpawned', (data) => {
      this.playSpawnSound(data.definition);
    });

    console.log('[PowerUpIntegration] Audio integration setup complete');
  }

  /**
   * Setup event integration
   */
  setupEventIntegration() {
    // Bridge power-up events to game engine events
    const eventMappings = {
      'onPowerUpSpawned': 'powerup:spawned',
      'onPowerUpCollected': 'powerup:collected',
      'onPowerUpExpired': 'powerup:expired',
      'onEffectApplied': 'powerup:effect:applied',
      'onEffectRemoved': 'powerup:effect:removed'
    };

    Object.entries(eventMappings).forEach(([powerUpEvent, gameEvent]) => {
      this.powerUpManager.addEventListener(powerUpEvent, (data) => {
        this.gameEngine.emitEvent(gameEvent, data);
      });
    });

    // Setup UI integration events
    this.gameEngine.addEventListener('ui:toggle:powerup-editor', () => {
      this.togglePowerUpEditor();
    });

    console.log('[PowerUpIntegration] Event integration setup complete');
  }

  /**
   * Initialize effect pools for performance
   */
  initializeEffectPools() {
    // Pre-create particle emitters
    for (let i = 0; i < this.config.effectPoolSize; i++) {
      const particles = this.scene.add.particles(0, 0, 'particle', {
        speed: 0,
        scale: 0,
        lifespan: 0,
        quantity: 0
      });
      particles.setVisible(false);
      this.particlePool.push(particles);
    }

    console.log(`[PowerUpIntegration] Initialized effect pools (${this.config.effectPoolSize} effects)`);
  }

  /**
   * Check power-up collisions with players
   */
  checkPowerUpCollisions() {
    if (!this.powerUpManager || this.state !== IntegrationState.ACTIVE) return;

    const players = this.gameEngine.getPlayers();
    if (!players || players.length === 0) return;

    // Use PowerUpManager's collision detection
    this.powerUpManager.checkCollisions(players);
    this.performanceMetrics.collisionChecks++;
  }

  /**
   * Update visual effects
   */
  updateVisualEffects() {
    if (!this.config.enableVisualEffects) return;

    // Update particle positions and states
    let activeParticles = 0;
    for (const particles of this.particlePool) {
      if (particles.visible) {
        activeParticles++;
      }
    }

    this.performanceMetrics.particlesActive = activeParticles;

    // Manage particle count for performance
    if (activeParticles > this.config.maxParticles) {
      this.cullExcessParticles();
    }
  }

  /**
   * Cull excess particles for performance
   */
  cullExcessParticles() {
    let culled = 0;
    const targetCull = this.performanceMetrics.particlesActive - this.config.maxParticles;

    for (const particles of this.particlePool) {
      if (culled >= targetCull) break;
      
      if (particles.visible && particles.emitters.length === 0) {
        particles.setVisible(false);
        culled++;
      }
    }

    if (culled > 0) {
      console.log(`[PowerUpIntegration] Culled ${culled} excess particles for performance`);
    }
  }

  /**
   * Preload audio effects
   */
  preloadAudioEffects() {
    const audioEffects = [
      'powerup_collect_common',
      'powerup_collect_uncommon', 
      'powerup_collect_rare',
      'powerup_collect_legendary',
      'powerup_spawn',
      'powerup_expire',
      'effect_speed_boost',
      'effect_paralysis',
      'effect_rainbow'
    ];

    audioEffects.forEach(soundKey => {
      if (this.scene.sound.get(soundKey)) {
        this.soundEffects.set(soundKey, this.scene.sound.get(soundKey));
      }
    });

    console.log(`[PowerUpIntegration] Preloaded ${this.soundEffects.size} audio effects`);
  }

  /**
   * Play power-up collection sound
   */
  playPowerUpSound(powerUpDefinition) {
    if (!this.config.enableAudioEffects) return;

    const rarity = powerUpDefinition.rarity || 'common';
    const soundKey = `powerup_collect_${rarity}`;
    
    if (this.soundEffects.has(soundKey)) {
      this.soundEffects.get(soundKey).play({ volume: 0.7 });
    } else if (this.scene.sound.get('powerup_collect_common')) {
      this.scene.sound.play('powerup_collect_common', { volume: 0.5 });
    }
  }

  /**
   * Play power-up spawn sound
   */
  playSpawnSound(powerUpDefinition) {
    if (!this.config.enableAudioEffects) return;

    if (this.soundEffects.has('powerup_spawn')) {
      this.soundEffects.get('powerup_spawn').play({ volume: 0.3 });
    }
  }

  /**
   * Get particle emitter from pool
   */
  getParticleEmitter() {
    for (const particles of this.particlePool) {
      if (!particles.visible) {
        return particles;
      }
    }

    // All particles in use, return null or create new one
    console.warn('[PowerUpIntegration] Particle pool exhausted');
    return null;
  }

  /**
   * Return particle emitter to pool
   */
  returnParticleEmitter(particles) {
    if (particles) {
      particles.setVisible(false);
      particles.removeAll();
    }
  }

  /**
   * Open power-up editor
   */
  openPowerUpEditor() {
    if (this.editor) {
      this.editor.createNew();
      console.log('[PowerUpIntegration] Opened power-up editor');
    }
  }

  /**
   * Toggle power-up editor
   */
  togglePowerUpEditor() {
    if (this.editor) {
      const container = this.editor.container;
      if (container.style.display === 'none') {
        this.editor.show();
      } else {
        this.editor.hide();
      }
    }
  }

  /**
   * Handle editor save
   */
  handleEditorSave(powerUpData) {
    console.log('[PowerUpIntegration] Power-up saved from editor:', powerUpData.name);
    
    // Emit event for other systems
    this.gameEngine.emitEvent('powerup:editor:saved', powerUpData);
    
    // Hide editor
    if (this.editor) {
      this.editor.hide();
    }
  }

  /**
   * Handle editor cancel
   */
  handleEditorCancel() {
    console.log('[PowerUpIntegration] Power-up editor cancelled');
    
    if (this.editor) {
      this.editor.hide();
    }
  }

  /**
   * Update integration (called from game loop)
   */
  update(time, delta) {
    if (this.state !== IntegrationState.ACTIVE) return;

    const frameStartTime = performance.now();

    // Update PowerUpManager
    if (this.powerUpManager) {
      this.powerUpManager.update(time, delta);
    }

    // Update performance metrics
    const frameTime = performance.now() - frameStartTime;
    this.performanceMetrics.lastFrameTime = frameTime;
    this.performanceMetrics.averageFrameTime = 
      (this.performanceMetrics.averageFrameTime * 0.9) + (frameTime * 0.1);

    // Performance monitoring
    if (frameTime > 16) { // More than 1 frame at 60 FPS
      console.warn(`[PowerUpIntegration] Slow frame detected: ${frameTime.toFixed(2)}ms`);
    }
  }

  /**
   * Spawn power-up at position
   */
  spawnPowerUpAt(x, y, powerUpId = null) {
    if (this.powerUpManager && this.state === IntegrationState.ACTIVE) {
      return this.powerUpManager.spawnPowerUp(x, y, powerUpId);
    }
    return null;
  }

  /**
   * Get power-up statistics
   */
  getStats() {
    const stats = {
      integration: {
        state: this.state,
        performance: this.performanceMetrics
      },
      powerUpManager: this.powerUpManager ? this.powerUpManager.getStats() : null,
      pluginSystem: this.pluginSystem ? this.pluginSystem.getStats() : null
    };

    return stats;
  }

  /**
   * Pause power-up system
   */
  pause() {
    this.state = IntegrationState.PAUSED;
    console.log('[PowerUpIntegration] Power-up system paused');
  }

  /**
   * Resume power-up system
   */
  resume() {
    if (this.state === IntegrationState.PAUSED) {
      this.state = IntegrationState.ACTIVE;
      console.log('[PowerUpIntegration] Power-up system resumed');
    }
  }

  /**
   * Clear all active power-ups
   */
  clearAllPowerUps() {
    if (this.powerUpManager) {
      this.powerUpManager.clear();
    }

    // Return all particles to pool
    for (const particles of this.particlePool) {
      this.returnParticleEmitter(particles);
    }

    console.log('[PowerUpIntegration] Cleared all power-ups');
  }

  /**
   * Add custom power-up definition
   */
  addCustomPowerUp(powerUpData) {
    if (this.powerUpManager) {
      return this.powerUpManager.addCustomPowerUp(powerUpData);
    }
    throw new Error('PowerUpManager not initialized');
  }

  /**
   * Load plugin from file
   */
  async loadPlugin(filePath) {
    if (this.pluginSystem) {
      return this.pluginSystem.loadPluginFromFile(filePath);
    }
    throw new Error('Plugin system not initialized');
  }

  /**
   * Get available effect types
   */
  getAvailableEffectTypes() {
    if (this.pluginSystem) {
      return this.pluginSystem.getAvailableEffectTypes();
    }
    return [];
  }

  /**
   * Hot reload power-up definitions
   */
  async hotReloadPowerUps() {
    if (this.powerUpManager) {
      await this.powerUpManager.loadPowerUpDefinitions();
      console.log('[PowerUpIntegration] Hot reloaded power-up definitions');
    }
  }

  /**
   * Destroy integration system
   */
  destroy() {
    // Clear event listeners
    this.eventListeners.forEach(listener => {
      document.removeEventListener(listener.event, listener.handler);
    });

    // Destroy subsystems
    if (this.powerUpManager) {
      this.powerUpManager.destroy();
    }

    if (this.pluginSystem) {
      this.pluginSystem.destroy();
    }

    if (this.editor) {
      this.editor.destroy();
    }

    // Clear effect pools
    this.particlePool.forEach(particles => particles.destroy());
    this.particlePool = [];
    this.soundEffects.clear();

    this.state = IntegrationState.UNINITIALIZED;
    console.log('[PowerUpIntegration] Integration system destroyed');
  }
}

export default PowerUpIntegration;