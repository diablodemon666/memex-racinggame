/**
 * GameEngine.js - Core Game Engine for Memex Racing
 * 
 * Manages the main game loop, scene transitions, and global game state.
 * Extracted from the monolithic claudeweb implementation.
 */

import Phaser from 'phaser';
import { PhysicsManager } from './PhysicsManager';
import { RenderManager } from './RenderManager';
import { ConfigManager, ConfigType } from '../systems/ConfigManager';
import { CameraManager, CameraMode } from '../systems/CameraManager';
import { AIPlayerManager } from '../systems/AIPlayerManager';
import { TrackTemplateManager } from '../systems/TrackTemplateManager';
import { performanceMonitor } from '../../utils/PerformanceMonitor';

/**
 * Core Game Engine Class
 * Manages game lifecycle, scenes, and coordination between systems
 */
export class GameEngine {
  constructor(config = {}) {
    // Initialize configuration manager first
    this.configManager = new ConfigManager({
      enableHotReload: process.env.NODE_ENV === 'development',
      enableValidation: true,
      autoLoad: true,
      ...config.configManager
    });

    this.config = {
      width: 1920,
      height: 1080,
      maxPlayers: 6,
      raceTimeLimit: 300, // 5 minutes in seconds
      ...config
    };

    // Core systems
    this.physicsManager = new PhysicsManager(this);
    this.renderManager = new RenderManager(this);
    this.cameraManager = null; // Initialize after scene creation
    this.aiPlayerManager = new AIPlayerManager(this);
    this.trackTemplateManager = new TrackTemplateManager(this);
    
    // Game state
    this.gameState = {
      raceActive: false,
      bettingPhase: true,
      gameTime: this.config.raceTimeLimit,
      currentMap: 'classic',
      selectedMap: 'classic',
      racesUntilMapChange: 3,
      totalRaces: 0,
      debugMode: false,
      humanPlayerCount: 1, // Default to 1 for single player, will be updated by multiplayer
    };

    // Game objects
    this.players = [];
    this.boosters = [];
    this.skills = [];
    this.mToken = null;
    
    // Scene reference
    this.currentScene = null;
    
    // Event handlers
    this.eventHandlers = new Map();
    
    // Performance tracking
    this.performanceStats = {
      frameCount: 0,
      lastFPSCheck: Date.now(),
      currentFPS: 0,
    };
    
    // Timer management to prevent memory leaks
    this.activeTimers = new Map();
    this.activeIntervals = new Map();
    
    // Performance monitoring
    this.performanceMonitor = performanceMonitor;
    this.lastFrameTime = performance.now();

    this.initializeEngine();
  }

  /**
   * Initialize the game engine
   */
  async initializeEngine() {
    // Setup event system
    this.setupEventSystem();
    
    // Setup configuration event listeners
    this.setupConfigurationListeners();
    
    // Load initial configurations and apply them
    await this.loadAndApplyConfigurations();
    
    // Initialize track template manager
    await this.initializeTrackTemplateSystem();
    
    // Initialize Phaser configuration
    this.phaserConfig = this.createPhaserConfig();
    
    console.log('[GameEngine] Engine initialized with config:', this.config);
  }

  /**
   * Initialize track template system
   */
  async initializeTrackTemplateSystem() {
    try {
      // Set up connection between physics manager and track template manager
      this.physicsManager.setTrackTemplateManager(this.trackTemplateManager);
      
      // Initialize the track template manager
      await this.trackTemplateManager.initialize();
      
      console.log('[GameEngine] Track template system initialized');
    } catch (error) {
      console.error('[GameEngine] Failed to initialize track template system:', error);
    }
  }

  /**
   * Setup configuration event listeners for hot-reload
   */
  setupConfigurationListeners() {
    // Listen for configuration updates
    this.configManager.addEventListener('configurationUpdated', (data) => {
      console.log(`[GameEngine] Configuration updated: ${data.type}`);
      this.handleConfigurationUpdate(data);
    });

    this.configManager.addEventListener('configurationHotReloaded', (data) => {
      console.log(`[GameEngine] Configuration hot-reloaded: ${data.type}`);
      this.handleConfigurationHotReload(data);
    });

    this.configManager.addEventListener('configurationLoaded', (data) => {
      console.log(`[GameEngine] Configuration loaded: ${data.type}`);
    });
  }

  /**
   * Load and apply all game configurations
   */
  async loadAndApplyConfigurations() {
    try {
      // Load game settings and apply to engine config
      const gameSettings = await this.configManager.loadConfiguration(ConfigType.GAME_SETTINGS);
      if (gameSettings) {
        this.applyGameSettings(gameSettings);
      }

      // Load visual settings for rendering
      const visualSettings = await this.configManager.loadConfiguration(ConfigType.VISUAL_SETTINGS);
      if (visualSettings) {
        this.applyVisualSettings(visualSettings);
      }

      // Load player preferences
      const playerPrefs = await this.configManager.loadConfiguration(ConfigType.PLAYER_PREFERENCES);
      if (playerPrefs) {
        this.applyPlayerPreferences(playerPrefs);
      }

      // Load track configurations
      const trackConfigs = await this.configManager.loadConfiguration(ConfigType.TRACK_CONFIGURATIONS);
      if (trackConfigs) {
        this.applyTrackConfigurations(trackConfigs);
      }

      // Load power-up definitions
      const powerUpDefs = await this.configManager.loadConfiguration(ConfigType.POWER_UP_DEFINITIONS);
      if (powerUpDefs) {
        this.applyPowerUpDefinitions(powerUpDefs);
      }

    } catch (error) {
      console.error('[GameEngine] Failed to load configurations:', error);
      // Continue with default configurations
    }
  }

  /**
   * Apply game settings configuration
   */
  applyGameSettings(gameSettings) {
    // Update engine configuration from game settings
    this.config.maxPlayers = gameSettings.game?.maxPlayers || this.config.maxPlayers;
    this.config.raceTimeLimit = gameSettings.game?.raceTimeLimit || this.config.raceTimeLimit;
    
    // Update game state
    this.gameState.gameTime = this.config.raceTimeLimit;
    
    // Apply physics settings
    if (gameSettings.physics) {
      this.physicsSettings = gameSettings.physics;
    }
    
    // Apply movement settings
    if (gameSettings.movement) {
      this.movementSettings = gameSettings.movement;
    }
    
    // Apply randomization settings
    if (gameSettings.randomization) {
      this.randomizationSettings = gameSettings.randomization;
    }
    
    // Apply debug settings
    if (gameSettings.debug) {
      this.gameState.debugMode = gameSettings.debug.enabled || false;
    }
    
    console.log('[GameEngine] Applied game settings configuration');
  }

  /**
   * Apply visual settings configuration
   */
  applyVisualSettings(visualSettings) {
    // Update display settings
    if (visualSettings.display) {
      if (visualSettings.display.resolution && !visualSettings.display.resolution.autoDetect) {
        this.config.width = visualSettings.display.resolution.width;
        this.config.height = visualSettings.display.resolution.height;
      }
    }
    
    // Store visual settings for render manager
    this.visualSettings = visualSettings;
    
    console.log('[GameEngine] Applied visual settings configuration');
  }

  /**
   * Apply player preferences configuration
   */
  applyPlayerPreferences(playerPrefs) {
    // Store player preferences for use by other systems
    this.playerPreferences = playerPrefs;
    
    console.log('[GameEngine] Applied player preferences configuration');
  }

  /**
   * Apply track configurations
   */
  applyTrackConfigurations(trackConfigs) {
    // Store track configurations
    this.trackConfigurations = trackConfigs;
    
    // Set initial map based on configuration
    const trackKeys = Object.keys(trackConfigs.tracks || {});
    if (trackKeys.length > 0) {
      this.gameState.currentMap = trackKeys[0];
      this.gameState.selectedMap = trackKeys[0];
    }
    
    console.log('[GameEngine] Applied track configurations');
  }

  /**
   * Apply power-up definitions
   */
  applyPowerUpDefinitions(powerUpDefs) {
    // Store power-up definitions
    this.powerUpDefinitions = powerUpDefs;
    
    console.log('[GameEngine] Applied power-up definitions');
  }

  /**
   * Handle configuration updates during runtime
   */
  handleConfigurationUpdate(data) {
    switch (data.type) {
      case ConfigType.GAME_SETTINGS:
        const gameSettings = this.configManager.getConfiguration(ConfigType.GAME_SETTINGS);
        if (gameSettings) {
          this.applyGameSettings(gameSettings);
        }
        break;
        
      case ConfigType.VISUAL_SETTINGS:
        const visualSettings = this.configManager.getConfiguration(ConfigType.VISUAL_SETTINGS);
        if (visualSettings) {
          this.applyVisualSettings(visualSettings);
          // Notify render manager of visual changes
          if (this.renderManager && this.renderManager.applyVisualSettings) {
            this.renderManager.applyVisualSettings(visualSettings);
          }
        }
        break;
        
      case ConfigType.POWER_UP_DEFINITIONS:
        const powerUpDefs = this.configManager.getConfiguration(ConfigType.POWER_UP_DEFINITIONS);
        if (powerUpDefs) {
          this.applyPowerUpDefinitions(powerUpDefs);
        }
        break;
        
      // Handle other configuration types as needed
    }
    
    // Emit event for other systems
    this.emit('configuration-updated', data);
  }

  /**
   * Handle configuration hot-reload
   */
  handleConfigurationHotReload(data) {
    console.log(`[GameEngine] Hot-reloading configuration: ${data.type}`);
    
    // Handle the same way as regular updates
    this.handleConfigurationUpdate(data);
    
    // Additional hot-reload specific logic if needed
    this.emit('configuration-hot-reloaded', data);
  }

  /**
   * Create Phaser game configuration
   */
  createPhaserConfig() {
    return {
      type: Phaser.AUTO,
      width: this.config.width,
      height: this.config.height,
      parent: 'game-container',
      pixelArt: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0 },
          debug: this.gameState.debugMode
        }
      },
      scene: {
        preload: this.preloadScene.bind(this),
        create: this.createScene.bind(this),
        update: this.updateScene.bind(this)
      }
    };
  }

  /**
   * Start the game engine
   */
  start() {
    if (this.game) {
      console.warn('[GameEngine] Game already started');
      return;
    }

    this.game = new Phaser.Game(this.phaserConfig);
    
    // Store reference for debugging
    if (process.env.NODE_ENV === 'development') {
      window.gameEngine = this;
      window.game = this.game;
    }
    
    console.log('[GameEngine] Game started successfully');
    return this.game;
  }

  /**
   * Stop the game engine
   */
  stop() {
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
    }
    
    // Clean up systems
    this.physicsManager.cleanup();
    this.renderManager.cleanup();
    
    if (this.cameraManager) {
      this.cameraManager.destroy();
    }
    
    console.log('[GameEngine] Game stopped');
  }

  /**
   * Phaser preload scene
   */
  preloadScene() {
    console.log('[GameEngine] Preload scene');
    
    // Delegate to render manager for asset loading
    this.renderManager.preloadAssets(this);
    
    // Load custom player images if they exist
    this.loadCustomPlayerImages();
    
    this.emit('preload-complete');
  }

  /**
   * Phaser create scene
   */
  createScene() {
    console.log('[GameEngine] Create scene');
    this.currentScene = this;
    
    // Initialize render system
    this.renderManager.initializeScene(this);
    
    // Initialize physics system
    this.physicsManager.initializePhysics(this);
    
    // Initialize camera system
    this.initializeCameraSystem();
    
    // Create initial game state
    this.initializeGameObjects();
    
    // Setup UI
    this.createUI();
    
    // Setup input handlers
    this.setupInputHandlers();
    
    // Start game loop timers
    this.setupGameTimers();
    
    this.emit('scene-created');
  }

  /**
   * Phaser update loop
   */
  updateScene(time, delta) {
    // Update performance stats
    this.updatePerformanceStats();
    
    // Always update camera system for smooth operation
    if (this.cameraManager) {
      this.cameraManager.update(time, delta);
    }
    
    // Only update game logic if race is active
    if (!this.gameState.raceActive || this.players.length === 0) {
      return;
    }
    
    // Update physics system
    this.physicsManager.update(time, delta);
    
    // Update render system
    this.renderManager.update(time, delta);
    
    // Check game conditions
    this.checkGameConditions();
    
    // Update debug information
    if (this.gameState.debugMode) {
      this.updateDebugInfo();
    }
    
    this.emit('scene-updated', { time, delta });
  }

  /**
   * Initialize camera system
   */
  initializeCameraSystem() {
    try {
      // Get camera configuration from visual settings
      const cameraConfig = this.getVisualSetting('camera', {});
      
      // Create camera manager with configuration
      this.cameraManager = new CameraManager(this, cameraConfig);
      
      // Initialize with current scene
      this.cameraManager.initialize(this);
      
      // Setup camera event listeners
      this.setupCameraEventListeners();
      
      console.log('[GameEngine] Camera system initialized successfully');
      this.emit('camera-system-initialized', { cameraManager: this.cameraManager });
      
    } catch (error) {
      console.error('[GameEngine] Failed to initialize camera system:', error);
      // Continue without camera system - fallback to default Phaser camera
    }
  }

  /**
   * Setup camera event listeners
   */
  setupCameraEventListeners() {
    if (!this.cameraManager) return;

    // Listen for camera mode changes
    this.cameraManager.on('mode-changed', (data) => {
      console.log(`[GameEngine] Camera mode changed: ${data.oldMode} -> ${data.newMode}`);
      this.emit('camera-mode-changed', data);
    });

    // Listen for camera transitions
    this.cameraManager.on('transition-complete', (data) => {
      this.emit('camera-transition-complete', data);
    });

    // Update UI when camera info changes
    this.cameraManager.on('position-changed', (data) => {
      this.emit('camera-position-changed', data);
    });

    this.cameraManager.on('zoom-changed', (data) => {
      this.emit('camera-zoom-changed', data);
    });
  }

  /**
   * Initialize game objects
   */
  initializeGameObjects() {
    // This will be called after physics and render systems are ready
    this.time.delayedCall(200, async () => {
      // Generate new map combination for this race
      await this.generateNewMapCombination();
      
      this.spawnPlayers();
      this.spawnMToken();
      this.startBettingPhase();
    });
  }

  /**
   * Generate new map combination using track templates
   */
  async generateNewMapCombination() {
    try {
      // Generate random combination of track template + background
      const combination = this.trackTemplateManager.generateRandomCombination();
      
      // Load collision data for physics
      await this.physicsManager.loadDynamicMapCollisionData(combination);
      
      // Update render manager with new combination
      await this.renderManager.loadDynamicMapVisuals(combination);
      
      // Emit event for UI updates
      this.emit('map-combination-generated', {
        trackName: combination.template.name,
        backgroundName: combination.background.name,
        combination: combination
      });
      
      console.log(`[GameEngine] Generated new map: ${combination.template.name} + ${combination.background.name}`);
    } catch (error) {
      console.error('[GameEngine] Failed to generate map combination:', error);
      // Fallback to legacy map system if needed
    }
  }

  /**
   * Get current human player count
   * @returns {number} Number of human players
   */
  getHumanPlayerCount() {
    // In a multiplayer game, this would check connected players
    // For now, return from game state or config
    return this.gameState.humanPlayerCount || 1;
  }

  /**
   * Set human player count (called by multiplayer system)
   * @param {number} count - Number of human players
   */
  setHumanPlayerCount(count) {
    this.gameState.humanPlayerCount = Math.max(1, Math.min(count, this.config.maxPlayers));
    console.log(`[GameEngine] Human player count set to: ${this.gameState.humanPlayerCount}`);
  }

  /**
   * Spawn players at random start position
   */
  spawnPlayers() {
    const startPosition = this.physicsManager.getRandomValidPosition();
    
    // Get current human player count (from multiplayer system or config)
    const humanPlayerCount = this.getHumanPlayerCount();
    
    // Check if we need AI players
    const aiPlayers = this.aiPlayerManager.checkAndFillSlots(humanPlayerCount, this.config.maxPlayers);
    
    // Create human players first
    for (let i = 0; i < humanPlayerCount; i++) {
      const player = this.createPlayer(i, startPosition, false);
      this.players.push(player);
    }
    
    // Create AI players
    for (const aiPlayerData of aiPlayers) {
      const player = this.createPlayer(aiPlayerData.index, startPosition, true, aiPlayerData);
      this.players.push(player);
    }
    
    this.emit('players-spawned', { 
      startPosition, 
      playerCount: this.players.length,
      humanCount: humanPlayerCount,
      aiCount: aiPlayers.length
    });
  }

  /**
   * Create a single player
   */
  createPlayer(index, startPosition, isAI = false, aiData = null) {
    // Arrange players in formation
    const col = index % 3;
    const row = Math.floor(index / 3);
    const offsetX = (col - 1) * 30;
    const offsetY = row * 30 - 15;
    
    const playerPos = {
      x: startPosition.x + offsetX,
      y: startPosition.y + offsetY
    };

    // Create player with AI data if applicable
    const player = this.physicsManager.createPlayerPhysics(index, playerPos, isAI, aiData);
    const playerSprite = this.renderManager.createPlayerSprite(index, playerPos, isAI, aiData);
    
    // Combine physics and render data
    Object.assign(player, playerSprite, {
      isAI: isAI,
      aiData: aiData,
      name: aiData ? aiData.name : `Player ${index + 1}`
    });
    
    return player;
  }

  /**
   * Spawn M token at farthest position from start
   */
  spawnMToken() {
    if (!this.players.length) return;
    
    const startPos = { x: this.players[0].x, y: this.players[0].y };
    const tokenPosition = this.physicsManager.getFarthestPositionFromStart(startPos);
    
    this.mToken = this.physics.add.sprite(tokenPosition.x, tokenPosition.y, 'mtoken');
    this.mToken.setScale(1);
    
    this.emit('token-spawned', { position: tokenPosition });
  }

  /**
   * Start betting phase
   */
  startBettingPhase() {
    this.gameState.bettingPhase = true;
    this.gameState.raceActive = false;
    
    // 30 second countdown
    let countdown = 30;
    const countdownInterval = setInterval(() => {
      countdown--;
      this.emit('betting-countdown', { countdown });
      
      if (countdown <= 0) {
        this.clearInterval('betting-countdown');
        this.startRace();
      }
    }, 1000);
    
    // Store interval for proper cleanup
    this.activeIntervals.set('betting-countdown', countdownInterval);
    
    this.emit('betting-phase-started');
  }

  /**
   * Start the race
   */
  startRace() {
    this.gameState.bettingPhase = false;
    this.gameState.raceActive = true;
    this.gameState.gameTime = this.config.raceTimeLimit;
    
    // Ensure all players are active
    this.players.forEach((player, idx) => {
      if (player) {
        player.active = true;
        player.stuckCounter = 0;
      }
    });
    
    this.emit('race-started');
  }

  /**
   * Check game conditions (win/lose)
   */
  checkGameConditions() {
    // Check for token collision
    this.physics.overlap(this.players, this.mToken, this.handleTokenCollision.bind(this), null, this);
    
    // Check for booster collisions
    this.physics.overlap(this.players, this.boosters, this.handleBoosterCollision.bind(this), null, this);
    
    // Check for skill collisions
    this.physics.overlap(this.players, this.skills, this.handleSkillCollision.bind(this), null, this);
    
    // Check player collisions
    this.checkPlayerCollisions();
  }

  /**
   * Handle token collision (win condition)
   */
  handleTokenCollision(player, token) {
    if (!this.gameState.raceActive) return;
    
    this.gameState.raceActive = false;
    
    // Determine winner (magnetized players have priority)
    const magnetizedPlayers = this.players.filter(p => p.magnetized);
    const winner = magnetizedPlayers.length > 0 ? magnetizedPlayers[0] : player;
    
    this.emit('race-won', { winner, player, token });
    
    // Schedule race reset
    this.time.delayedCall(5000, () => this.resetRace());
  }

  /**
   * Handle booster collision
   */
  handleBoosterCollision(player, booster) {
    this.physicsManager.applyBooster(player, booster);
    this.renderManager.showBoosterEffect(player, booster);
    
    // Remove booster
    booster.destroy();
    this.boosters = this.boosters.filter(b => b !== booster);
    
    this.emit('booster-collected', { player, booster });
  }

  /**
   * Handle skill collision
   */
  handleSkillCollision(player, skill) {
    this.physicsManager.activateSkill(player, skill);
    this.renderManager.showSkillEffect(player, skill);
    
    // Remove skill
    skill.destroy();
    this.skills = this.skills.filter(s => s !== skill);
    
    this.emit('skill-collected', { player, skill });
  }

  /**
   * Check player-to-player collisions
   */
  checkPlayerCollisions() {
    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) {
        if (this.players[i] && this.players[j]) {
          const distance = Phaser.Math.Distance.Between(
            this.players[i].x, this.players[i].y,
            this.players[j].x, this.players[j].y
          );
          
          if (distance < 20) {
            this.physicsManager.handlePlayerCollision(this.players[i], this.players[j]);
          }
        }
      }
    }
  }

  /**
   * Reset race for next round
   */
  resetRace() {
    this.gameState.gameTime = this.config.raceTimeLimit;
    this.gameState.raceActive = false;
    this.gameState.totalRaces++;
    this.gameState.racesUntilMapChange--;
    
    // Reset players
    this.physicsManager.resetPlayers(this.players);
    
    // Clear items
    this.clearGameItems();
    
    // Respawn objects
    this.spawnMToken();
    
    this.emit('race-reset');
    
    // Start new betting phase
    this.startBettingPhase();
  }

  /**
   * Clear boosters and skills
   */
  clearGameItems() {
    this.boosters.forEach(b => b.destroy());
    this.skills.forEach(s => s.destroy());
    this.boosters = [];
    this.skills = [];
  }

  /**
   * Setup input handlers
   */
  setupInputHandlers() {
    // Debug mode toggle
    this.input.keyboard.on('keydown-D', () => {
      this.gameState.debugMode = !this.gameState.debugMode;
      this.physics.world.debugGraphic.visible = this.gameState.debugMode;
      this.emit('debug-toggled', { enabled: this.gameState.debugMode });
    });
    
    // Manual unstuck
    this.input.keyboard.on('keydown-U', () => {
      // Implementation handled by physics manager
      this.emit('manual-unstuck');
    });
    
    // Map selection
    this.input.keyboard.on('keydown-M', () => {
      if (!this.gameState.raceActive) {
        this.emit('map-selection-requested');
      }
    });
  }

  /**
   * Timer management methods to prevent memory leaks
   */
  
  /**
   * Create a managed timeout
   */
  setTimeout(name, callback, delay) {
    // Clear existing timer if it exists
    this.clearTimeout(name);
    
    const timerId = setTimeout(() => {
      callback();
      this.activeTimers.delete(name);
    }, delay);
    
    this.activeTimers.set(name, timerId);
    return timerId;
  }
  
  /**
   * Create a managed interval
   */
  setInterval(name, callback, delay) {
    // Clear existing interval if it exists
    this.clearInterval(name);
    
    const intervalId = setInterval(callback, delay);
    this.activeIntervals.set(name, intervalId);
    return intervalId;
  }
  
  /**
   * Clear a managed timeout
   */
  clearTimeout(name) {
    const timerId = this.activeTimers.get(name);
    if (timerId) {
      clearTimeout(timerId);
      this.activeTimers.delete(name);
    }
  }
  
  /**
   * Clear a managed interval
   */
  clearInterval(name) {
    const intervalId = this.activeIntervals.get(name);
    if (intervalId) {
      clearInterval(intervalId);
      this.activeIntervals.delete(name);
    }
  }
  
  /**
   * Clear all managed timers and intervals
   */
  clearAllTimers() {
    // Clear all timeouts
    for (const [name, timerId] of this.activeTimers) {
      clearTimeout(timerId);
    }
    this.activeTimers.clear();
    
    // Clear all intervals
    for (const [name, intervalId] of this.activeIntervals) {
      clearInterval(intervalId);
    }
    this.activeIntervals.clear();
    
    console.log('[GameEngine] All timers cleared');
  }
  
  /**
   * Engine cleanup - call this when destroying the engine
   */
  cleanup() {
    // Clear all timers to prevent memory leaks
    this.clearAllTimers();
    
    // Cleanup physics manager
    if (this.physicsManager) {
      this.physicsManager.cleanup();
    }
    
    // Clear event handlers
    this.eventHandlers.clear();
    
    console.log('[GameEngine] Engine cleaned up');
  }

  /**
   * Setup game timers
   */
  setupGameTimers() {
    // Main game timer
    this.time.addEvent({
      delay: 1000,
      callback: this.updateGameTimer.bind(this),
      loop: true
    });
    
    // Booster spawn timer
    this.time.addEvent({
      delay: 3000,
      callback: this.spawnBooster.bind(this),
      loop: true
    });
    
    // Skill spawn timer  
    this.time.addEvent({
      delay: 8000,
      callback: this.spawnSkill.bind(this),
      loop: true
    });
  }

  /**
   * Update game timer
   */
  updateGameTimer() {
    if (!this.gameState.raceActive) return;
    
    this.gameState.gameTime--;
    
    if (this.gameState.gameTime <= 0) {
      this.gameState.raceActive = false;
      this.emit('race-timeout');
      
      // Schedule reset
      this.time.delayedCall(5000, () => this.resetRace());
    }
    
    this.emit('timer-updated', { timeRemaining: this.gameState.gameTime });
  }

  /**
   * Spawn booster
   */
  spawnBooster() {
    if (!this.gameState.raceActive) return;
    
    const booster = this.renderManager.createBooster(this);
    this.boosters.push(booster);
    
    this.emit('booster-spawned', { booster });
  }

  /**
   * Spawn skill
   */
  spawnSkill() {
    if (!this.gameState.raceActive) return;
    
    const skill = this.renderManager.createSkill(this);
    this.skills.push(skill);
    
    this.emit('skill-spawned', { skill });
  }

  /**
   * Create UI elements
   */
  createUI() {
    this.renderManager.createUI(this);
  }

  /**
   * Load custom player images
   */
  loadCustomPlayerImages() {
    // Implementation delegated to render manager
    this.renderManager.loadCustomPlayerImages(this);
  }

  /**
   * Update performance statistics
   */
  updatePerformanceStats() {
    this.performanceStats.frameCount++;
    const now = Date.now();
    
    if (now - this.performanceStats.lastFPSCheck >= 1000) {
      this.performanceStats.currentFPS = this.performanceStats.frameCount;
      this.performanceStats.frameCount = 0;
      this.performanceStats.lastFPSCheck = now;
    }
  }

  /**
   * Update debug information
   */
  updateDebugInfo() {
    const debugInfo = {
      fps: this.performanceStats.currentFPS,
      players: this.players.length,
      boosters: this.boosters.length,
      skills: this.skills.length,
      gameTime: this.gameState.gameTime,
    };

    // Add camera debug information
    if (this.cameraManager && this.gameState.debugMode) {
      debugInfo.camera = this.cameraManager.getCameraInfo();
    }

    this.emit('debug-info-updated', debugInfo);
  }

  /**
   * Event system setup
   */
  setupEventSystem() {
    this.eventHandlers = new Map();
  }

  /**
   * Emit an event
   */
  emit(eventName, data = {}) {
    if (this.eventHandlers.has(eventName)) {
      this.eventHandlers.get(eventName).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[GameEngine] Error in event handler for ${eventName}:`, error);
        }
      });
    }
    
    // Log events in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[GameEngine] Event: ${eventName}`, data);
    }
  }

  /**
   * Add event listener
   */
  on(eventName, handler) {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName).push(handler);
  }

  /**
   * Remove event listener
   */
  off(eventName, handler) {
    if (this.eventHandlers.has(eventName)) {
      const handlers = this.eventHandlers.get(eventName);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Get current game state
   */
  getGameState() {
    return { ...this.gameState };
  }

  /**
   * Get performance stats
   */
  getPerformanceStats() {
    return { ...this.performanceStats };
  }

  /**
   * Get configuration value using path notation
   */
  getConfigValue(configType, path, defaultValue = null) {
    return this.configManager.getConfigValue(configType, path, defaultValue);
  }

  /**
   * Get game setting value
   */
  getGameSetting(path, defaultValue = null) {
    return this.getConfigValue(ConfigType.GAME_SETTINGS, path, defaultValue);
  }

  /**
   * Get visual setting value
   */
  getVisualSetting(path, defaultValue = null) {
    return this.getConfigValue(ConfigType.VISUAL_SETTINGS, path, defaultValue);
  }

  /**
   * Get player preference value
   */
  getPlayerPreference(path, defaultValue = null) {
    return this.getConfigValue(ConfigType.PLAYER_PREFERENCES, path, defaultValue);
  }

  /**
   * Get track configuration
   */
  getTrackConfig(trackId = null) {
    const configs = this.configManager.getConfiguration(ConfigType.TRACK_CONFIGURATIONS);
    if (!configs || !configs.tracks) return null;
    
    if (trackId) {
      return configs.tracks[trackId] || null;
    }
    
    return configs;
  }

  /**
   * Get power-up definition
   */
  getPowerUpDefinition(type, id = null) {
    const configs = this.configManager.getConfiguration(ConfigType.POWER_UP_DEFINITIONS);
    if (!configs) return null;
    
    if (type === 'booster' && configs.boosters) {
      return id ? configs.boosters[id] : configs.boosters;
    }
    
    if (type === 'skill' && configs.skills) {
      return id ? configs.skills[id] : configs.skills;
    }
    
    return configs;
  }

  /**
   * Update configuration at runtime
   */
  async updateConfig(configType, updates, options = {}) {
    return await this.configManager.updateConfiguration(configType, updates, options);
  }

  /**
   * Reload all configurations
   */
  async reloadConfigurations() {
    const result = await this.configManager.reloadAllConfigurations();
    
    // Re-apply all configurations
    await this.loadAndApplyConfigurations();
    
    return result;
  }

  /**
   * Get configuration manager statistics
   */
  getConfigStats() {
    return this.configManager.getStats();
  }

  /**
   * Camera system utility methods
   */

  /**
   * Get camera manager instance
   */
  getCameraManager() {
    return this.cameraManager;
  }

  /**
   * Set camera mode
   */
  setCameraMode(mode, options = {}) {
    if (this.cameraManager) {
      this.cameraManager.setMode(mode, options);
    }
  }

  /**
   * Get current camera information
   */
  getCameraInfo() {
    return this.cameraManager ? this.cameraManager.getCameraInfo() : null;
  }

  /**
   * Follow specific player with camera
   */
  followPlayer(playerId, options = {}) {
    if (this.cameraManager && this.players[playerId]) {
      this.cameraManager.setMode(CameraMode.FOLLOW_PLAYER, { 
        playerId, 
        ...options 
      });
    }
  }

  /**
   * Transition camera to specific position
   */
  moveCameraTo(position, zoom, options = {}) {
    if (this.cameraManager) {
      return this.cameraManager.transitionTo(position, zoom, options);
    }
  }

  /**
   * Add camera preset
   */
  addCameraPreset(name, position, zoom, rotation = 0, description = '') {
    if (this.cameraManager) {
      // Create a simple preset object
      const preset = {
        name,
        position: { ...position },
        zoom,
        rotation,
        description,
        createdAt: Date.now(),
        applyTo: (camera, transitionType = 'ease_in_out', duration = 1000) => {
          return camera.transitionTo(position, zoom, {
            transitionType,
            duration,
            rotation
          });
        }
      };
      this.cameraManager.addPreset(preset);
    }
  }

  /**
   * Cleanup method that includes configuration manager
   */
  destroy() {
    // Stop the game engine
    this.stop();
    
    // Destroy configuration manager
    if (this.configManager) {
      this.configManager.destroy();
    }
    
    console.log('[GameEngine] Game engine destroyed');
  }
}