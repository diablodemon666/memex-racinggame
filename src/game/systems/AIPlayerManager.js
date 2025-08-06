/**
 * AIPlayerManager.js - AI Player Management System for Memex Racing
 * 
 * Manages AI-controlled players that fill empty slots when not enough human players are online.
 * Features random selection from a pool of available player sprites.
 */

import { ConfigManager } from './ConfigManager';
import { AssetManager } from './AssetManager';

/**
 * AI Player Manager Class
 * Handles creation, management, and asset selection for AI players
 */
export class AIPlayerManager {
  constructor(gameEngine) {
    this.gameEngine = gameEngine;
    this.configManager = gameEngine.configManager;
    this.assetManager = null; // Will be set when available
    
    // AI player tracking
    this.aiPlayers = new Map(); // playerIndex -> AI player data
    this.availableAssets = [];
    this.usedAssets = new Set();
    
    // AI player names pool
    this.aiNamePool = [
      'RoboRacer', 'SpeedBot', 'TurboAI', 'CyberPilot', 'AutoDriver',
      'MechRunner', 'DigitalDash', 'ByteRacer', 'CodeRunner', 'PixelPilot',
      'CircuitRacer', 'NeuralNet', 'AlgoRider', 'DataDash', 'BinaryBolt',
      'QuantumQuick', 'LogicLap', 'SynthSpeed', 'VectorVroom', 'MatrixMover'
    ];
    this.usedNames = new Set();
    
    // Configuration
    this.config = {
      minHumanPlayers: 2,
      fillEmptySlots: true,
      showAIIndicator: true,
      randomizeAssets: true,
      aiSkillLevel: 'medium',
      replaceOnHumanJoin: true,
      ...this.configManager.get('ai-players', {})
    };
    
    // Initialize
    this.initialize();
  }
  
  /**
   * Initialize the AI player manager
   */
  async initialize() {
    console.log('[AIPlayerManager] Initializing AI player system');
    
    // Load available AI player assets
    await this.loadAvailableAssets();
    
    // Setup configuration listeners
    this.setupConfigListeners();
    
    console.log(`[AIPlayerManager] Initialized with ${this.availableAssets.length} available sprites`);
  }
  
  /**
   * Load available AI player sprite assets
   */
  async loadAvailableAssets() {
    try {
      // Get list of sprites from default player directory
      const defaultSprites = [
        'Smoking_pug.png',
        'chips bu.png',
        'cool_pug.png',
        'ice.png',
        'intern.png',
        'lv4pug.png',
        'pug banana toilet.png',
        'spike monster.png'
      ];
      
      // Filter out any that don't exist or can't be loaded
      this.availableAssets = [];
      for (const sprite of defaultSprites) {
        const assetPath = `sprites/players/default/${sprite}`;
        // Check if asset exists (would need actual file check in production)
        this.availableAssets.push({
          name: sprite.replace('.png', ''),
          path: assetPath,
          type: 'default'
        });
      }
      
      console.log(`[AIPlayerManager] Loaded ${this.availableAssets.length} AI player sprites`);
    } catch (error) {
      console.error('[AIPlayerManager] Error loading AI assets:', error);
      // Fallback to basic colored sprites if custom ones fail
      this.availableAssets = this.createFallbackAssets();
    }
  }
  
  /**
   * Create fallback colored sprite assets
   */
  createFallbackAssets() {
    const colors = ['red', 'blue', 'green', 'yellow', 'magenta', 'cyan'];
    return colors.map(color => ({
      name: `ai_${color}`,
      path: null, // Will use color generation
      type: 'generated',
      color: color
    }));
  }
  
  /**
   * Setup configuration change listeners
   */
  setupConfigListeners() {
    this.configManager.addEventListener('configurationUpdated', (event) => {
      if (event.type === 'ai-players') {
        this.config = {
          ...this.config,
          ...event.configuration
        };
        console.log('[AIPlayerManager] Configuration updated');
      }
    });
  }
  
  /**
   * Check if AI players are needed and add them
   * @param {number} currentHumanPlayers - Current number of human players
   * @param {number} maxPlayers - Maximum players allowed in game
   * @returns {Array} Array of AI player data to add
   */
  checkAndFillSlots(currentHumanPlayers, maxPlayers) {
    if (!this.config.fillEmptySlots) {
      return [];
    }
    
    const slotsToFill = Math.max(0, this.config.minHumanPlayers - currentHumanPlayers);
    const totalSlotsAvailable = maxPlayers - currentHumanPlayers;
    const aiPlayersToAdd = Math.min(slotsToFill, totalSlotsAvailable);
    
    console.log(`[AIPlayerManager] Human players: ${currentHumanPlayers}, Adding ${aiPlayersToAdd} AI players`);
    
    const aiPlayers = [];
    for (let i = 0; i < aiPlayersToAdd; i++) {
      const playerIndex = currentHumanPlayers + i;
      const aiPlayer = this.createAIPlayer(playerIndex);
      aiPlayers.push(aiPlayer);
    }
    
    return aiPlayers;
  }
  
  /**
   * Create a new AI player
   * @param {number} playerIndex - The player slot index
   * @returns {Object} AI player data
   */
  createAIPlayer(playerIndex) {
    // Select random asset
    const asset = this.selectRandomAsset();
    
    // Generate unique name
    const name = this.generateAIName();
    
    const aiPlayerData = {
      index: playerIndex,
      isAI: true,
      name: name,
      asset: asset,
      skillLevel: this.config.aiSkillLevel,
      createdAt: Date.now(),
      stats: {
        racesPlayed: 0,
        wins: 0,
        totalBets: 0
      }
    };
    
    // Track this AI player
    this.aiPlayers.set(playerIndex, aiPlayerData);
    
    console.log(`[AIPlayerManager] Created AI player: ${name} with sprite: ${asset.name}`);
    
    return aiPlayerData;
  }
  
  /**
   * Select a random asset from available pool
   * @returns {Object} Selected asset data
   */
  selectRandomAsset() {
    if (!this.config.randomizeAssets || this.availableAssets.length === 0) {
      return this.createFallbackAssets()[0];
    }
    
    // Get unused assets
    const unusedAssets = this.availableAssets.filter(
      asset => !this.usedAssets.has(asset.name)
    );
    
    // If all assets are used, reset the used set
    if (unusedAssets.length === 0) {
      this.usedAssets.clear();
      return this.selectRandomAsset();
    }
    
    // Select random unused asset
    const randomIndex = Math.floor(Math.random() * unusedAssets.length);
    const selectedAsset = unusedAssets[randomIndex];
    
    // Mark as used
    this.usedAssets.add(selectedAsset.name);
    
    return selectedAsset;
  }
  
  /**
   * Generate a unique AI player name
   * @returns {string} Generated name
   */
  generateAIName() {
    // Get unused names
    const unusedNames = this.aiNamePool.filter(
      name => !this.usedNames.has(name)
    );
    
    // If all names used, add a number suffix
    if (unusedNames.length === 0) {
      const baseName = this.aiNamePool[Math.floor(Math.random() * this.aiNamePool.length)];
      let suffix = 2;
      let newName = `${baseName}${suffix}`;
      while (this.usedNames.has(newName)) {
        suffix++;
        newName = `${baseName}${suffix}`;
      }
      this.usedNames.add(newName);
      return newName;
    }
    
    // Select random unused name
    const randomIndex = Math.floor(Math.random() * unusedNames.length);
    const selectedName = unusedNames[randomIndex];
    this.usedNames.add(selectedName);
    
    return selectedName;
  }
  
  /**
   * Replace an AI player with a human player
   * @param {number} aiPlayerIndex - Index of AI player to replace
   * @param {Object} humanPlayerData - Human player data
   */
  replaceAIPlayer(aiPlayerIndex, humanPlayerData) {
    if (!this.config.replaceOnHumanJoin) {
      return false;
    }
    
    const aiPlayer = this.aiPlayers.get(aiPlayerIndex);
    if (!aiPlayer) {
      return false;
    }
    
    console.log(`[AIPlayerManager] Replacing AI player ${aiPlayer.name} with human player`);
    
    // Free up the used asset and name
    this.usedAssets.delete(aiPlayer.asset.name);
    this.usedNames.delete(aiPlayer.name);
    
    // Remove from tracking
    this.aiPlayers.delete(aiPlayerIndex);
    
    return true;
  }
  
  /**
   * Get AI player data by index
   * @param {number} playerIndex - Player index
   * @returns {Object|null} AI player data or null
   */
  getAIPlayer(playerIndex) {
    return this.aiPlayers.get(playerIndex) || null;
  }
  
  /**
   * Check if a player is AI controlled
   * @param {number} playerIndex - Player index
   * @returns {boolean} True if AI player
   */
  isAIPlayer(playerIndex) {
    return this.aiPlayers.has(playerIndex);
  }
  
  /**
   * Get all current AI players
   * @returns {Array} Array of AI player data
   */
  getAllAIPlayers() {
    return Array.from(this.aiPlayers.values());
  }
  
  /**
   * Reset AI players for new game
   */
  reset() {
    console.log('[AIPlayerManager] Resetting AI players');
    this.aiPlayers.clear();
    this.usedAssets.clear();
    this.usedNames.clear();
  }
  
  /**
   * Update AI player stats
   * @param {number} playerIndex - Player index
   * @param {Object} stats - Stats to update
   */
  updateAIPlayerStats(playerIndex, stats) {
    const aiPlayer = this.aiPlayers.get(playerIndex);
    if (aiPlayer) {
      aiPlayer.stats = {
        ...aiPlayer.stats,
        ...stats
      };
    }
  }
  
  /**
   * Get sprite path for AI player
   * @param {Object} aiPlayer - AI player data
   * @returns {string} Sprite path or color
   */
  getAIPlayerSprite(aiPlayer) {
    if (aiPlayer.asset.type === 'generated') {
      return aiPlayer.asset.color;
    }
    return aiPlayer.asset.path;
  }
}

export default AIPlayerManager;