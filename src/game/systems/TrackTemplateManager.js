/**
 * TrackTemplateManager.js - Dynamic Track Template System for Memex Racing
 * 
 * Manages random combinations of track templates (PNG with white tracks) 
 * and background images for varied gameplay experience.
 */

import { ConfigManager } from './ConfigManager';
import { AssetManager } from './AssetManager';

/**
 * Track Template Manager Class
 * Handles loading, caching, and random selection of track templates and backgrounds
 */
export class TrackTemplateManager {
  constructor(gameEngine) {
    this.gameEngine = gameEngine;
    this.configManager = gameEngine.configManager;
    this.assetManager = null; // Will be set when available
    
    // Track template data
    this.trackTemplates = [];
    this.backgroundLibrary = [];
    this.currentCombination = null;
    this.pixelDataCache = new Map();
    
    // Configuration
    this.config = {
      enabled: true,
      trackTemplateDir: 'maps/track-templates/',
      backgroundLibraryDir: 'maps/backgrounds-library/',
      cacheCollisionData: true,
      randomSeed: null,
      ...this.configManager.get('dynamic-maps', {})
    };
    
    // Performance tracking
    this.stats = {
      templatesLoaded: 0,
      backgroundsLoaded: 0,
      combinationsGenerated: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    
    this.initialize();
  }
  
  /**
   * Initialize the track template manager
   */
  async initialize() {
    console.log('[TrackTemplateManager] Initializing dynamic track system');
    
    if (!this.config.enabled) {
      console.log('[TrackTemplateManager] Dynamic maps disabled in configuration');
      return;
    }
    
    try {
      // Load available track templates and backgrounds
      await this.scanTrackTemplates();
      await this.scanBackgroundLibrary();
      
      // Setup configuration listeners
      this.setupConfigListeners();
      
      console.log(`[TrackTemplateManager] Initialized with ${this.trackTemplates.length} templates and ${this.backgroundLibrary.length} backgrounds`);
    } catch (error) {
      console.error('[TrackTemplateManager] Initialization failed:', error);
      this.config.enabled = false;
    }
  }
  
  /**
   * Scan for available track templates
   */
  async scanTrackTemplates() {
    // Default track templates (would be loaded dynamically in production)
    const defaultTemplates = [
      {
        id: 'simple-oval',
        name: 'Simple Oval',
        path: 'maps/track-templates/simple-oval.png',
        difficulty: 'easy',
        features: ['oval', 'wide_track'],
        dimensions: { width: 4000, height: 2000 }
      },
      {
        id: 'figure-eight',
        name: 'Figure Eight',
        path: 'maps/track-templates/figure-eight.png',
        difficulty: 'medium',
        features: ['crossover', 'loops'],
        dimensions: { width: 4000, height: 2000 }
      },
      {
        id: 'maze-classic',
        name: 'Classic Maze',
        path: 'maps/track-templates/maze-classic.png',
        difficulty: 'hard',
        features: ['maze', 'multiple_paths', 'narrow_passages'],
        dimensions: { width: 4000, height: 2000 }
      },
      {
        id: 'spiral-madness',
        name: 'Spiral Madness',
        path: 'maps/track-templates/spiral-madness.png',
        difficulty: 'very_hard',
        features: ['spiral', 'tight_turns'],
        dimensions: { width: 4000, height: 2000 }
      },
      {
        id: 'grid-city',
        name: 'Grid City',
        path: 'maps/track-templates/grid-city.png',
        difficulty: 'medium',
        features: ['grid', 'intersections'],
        dimensions: { width: 4000, height: 2000 }
      }
    ];
    
    this.trackTemplates = defaultTemplates;
    this.stats.templatesLoaded = this.trackTemplates.length;
    
    console.log(`[TrackTemplateManager] Loaded ${this.trackTemplates.length} track templates`);
  }
  
  /**
   * Scan for available background images
   */
  async scanBackgroundLibrary() {
    // Default background library (would be loaded dynamically in production)
    const defaultBackgrounds = [
      {
        id: 'space-station',
        name: 'Space Station',
        path: 'maps/backgrounds-library/space-station.jpg',
        theme: 'sci-fi',
        mood: 'futuristic'
      },
      {
        id: 'desert-canyon',
        name: 'Desert Canyon',
        path: 'maps/backgrounds-library/desert-canyon.jpg',
        theme: 'nature',
        mood: 'adventure'
      },
      {
        id: 'neon-city',
        name: 'Neon City',
        path: 'maps/backgrounds-library/neon-city.jpg',
        theme: 'cyberpunk',
        mood: 'energetic'
      },
      {
        id: 'underwater-depths',
        name: 'Underwater Depths',
        path: 'maps/backgrounds-library/underwater.jpg',
        theme: 'aquatic',
        mood: 'mysterious'
      },
      {
        id: 'forest-canopy',
        name: 'Forest Canopy',
        path: 'maps/backgrounds-library/forest.jpg',
        theme: 'nature',
        mood: 'peaceful'
      },
      {
        id: 'volcanic-landscape',
        name: 'Volcanic Landscape',
        path: 'maps/backgrounds-library/volcano.jpg',
        theme: 'extreme',
        mood: 'intense'
      }
    ];
    
    this.backgroundLibrary = defaultBackgrounds;
    this.stats.backgroundsLoaded = this.backgroundLibrary.length;
    
    console.log(`[TrackTemplateManager] Loaded ${this.backgroundLibrary.length} background images`);
  }
  
  /**
   * Setup configuration change listeners
   */
  setupConfigListeners() {
    this.configManager.addEventListener('configurationUpdated', (event) => {
      if (event.type === 'dynamic-maps') {
        this.config = {
          ...this.config,
          ...event.configuration
        };
        console.log('[TrackTemplateManager] Configuration updated');
      }
    });
  }
  
  /**
   * Generate a random track and background combination
   * @param {Object} options - Selection options
   * @returns {Object} Combined track and background data
   */
  generateRandomCombination(options = {}) {
    if (!this.config.enabled || this.trackTemplates.length === 0 || this.backgroundLibrary.length === 0) {
      console.warn('[TrackTemplateManager] Cannot generate combination - system disabled or no assets');
      return this.getFallbackCombination();
    }
    
    // Apply filters if specified
    let availableTemplates = this.trackTemplates;
    let availableBackgrounds = this.backgroundLibrary;
    
    // Filter by difficulty
    if (options.difficulty) {
      availableTemplates = availableTemplates.filter(t => t.difficulty === options.difficulty);
    }
    
    // Filter by theme
    if (options.theme) {
      availableBackgrounds = availableBackgrounds.filter(b => b.theme === options.theme);
    }
    
    // Fallback to all if filters are too restrictive
    if (availableTemplates.length === 0) availableTemplates = this.trackTemplates;
    if (availableBackgrounds.length === 0) availableBackgrounds = this.backgroundLibrary;
    
    // Random selection
    const randomTemplate = availableTemplates[Math.floor(Math.random() * availableTemplates.length)];
    const randomBackground = availableBackgrounds[Math.floor(Math.random() * availableBackgrounds.length)];
    
    const combination = {
      id: `${randomTemplate.id}_${randomBackground.id}_${Date.now()}`,
      template: randomTemplate,
      background: randomBackground,
      generatedAt: Date.now(),
      seed: this.config.randomSeed || Math.random()
    };
    
    this.currentCombination = combination;
    this.stats.combinationsGenerated++;
    
    console.log(`[TrackTemplateManager] Generated combination: ${randomTemplate.name} + ${randomBackground.name}`);
    
    return combination;
  }
  
  /**
   * Get fallback combination for when dynamic system is unavailable
   */
  getFallbackCombination() {
    return {
      id: 'fallback_classic',
      template: {
        id: 'classic',
        name: 'Classic Track',
        path: 'maps/tracks/classic_maze_collision.png',
        isLegacy: true,
        difficulty: 'medium'
      },
      background: {
        id: 'classic-bg',
        name: 'Classic Background',
        path: 'maps/backgrounds/classic_maze.png',
        isLegacy: true
      },
      isLegacy: true
    };
  }
  
  /**
   * Load and cache collision data for a track template
   * @param {Object} template - Track template data
   * @returns {Promise<ImageData>} Cached collision pixel data
   */
  async loadTemplateCollisionData(template) {
    const cacheKey = `collision_${template.id}`;
    
    // Check cache first
    if (this.pixelDataCache.has(cacheKey)) {
      this.stats.cacheHits++;
      return this.pixelDataCache.get(cacheKey);
    }
    
    this.stats.cacheMisses++;
    
    try {
      // In a real implementation, this would load the actual PNG file
      // For now, we'll create mock collision data
      const mockCollisionData = this.createMockCollisionData(template);
      
      // Cache the data if enabled
      if (this.config.cacheCollisionData) {
        this.pixelDataCache.set(cacheKey, mockCollisionData);
      }
      
      return mockCollisionData;
    } catch (error) {
      console.error(`[TrackTemplateManager] Failed to load collision data for ${template.id}:`, error);
      return this.createFallbackCollisionData();
    }
  }
  
  /**
   * Create mock collision data for development
   */
  createMockCollisionData(template) {
    const width = template.dimensions.width;
    const height = template.dimensions.height;
    
    // Create ImageData-like structure
    const data = new Uint8ClampedArray(width * height * 4);
    
    // Generate collision pattern based on template type
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        let isTrack = false;
        
        // Simple track generation based on template features
        if (template.features.includes('oval')) {
          const centerX = width / 2;
          const centerY = height / 2;
          const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
          isTrack = dist > 300 && dist < 800;
        } else if (template.features.includes('maze')) {
          // Simple maze pattern
          isTrack = (x % 100 < 50 && y % 100 < 50) && 
                   !(x % 200 < 100 && y % 200 < 100);
        } else {
          // Default: wide track across middle
          isTrack = Math.abs(y - height / 2) < 200;
        }
        
        if (isTrack) {
          // White pixel (track)
          data[index] = 255;     // R
          data[index + 1] = 255; // G
          data[index + 2] = 255; // B
          data[index + 3] = 255; // A
        } else {
          // Transparent (wall)
          data[index] = 0;       // R
          data[index + 1] = 0;   // G
          data[index + 2] = 0;   // B
          data[index + 3] = 0;   // A (transparent)
        }
      }
    }
    
    return { data, width, height };
  }
  
  /**
   * Create fallback collision data
   */
  createFallbackCollisionData() {
    return this.createMockCollisionData({
      id: 'fallback',
      dimensions: { width: 4000, height: 2000 },
      features: ['oval']
    });
  }
  
  /**
   * Check if a position is on the track (white pixel)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {ImageData} collisionData - Collision pixel data
   * @returns {boolean} True if position is on track
   */
  isPositionOnTrack(x, y, collisionData) {
    if (!collisionData || x < 0 || y < 0 || x >= collisionData.width || y >= collisionData.height) {
      return false;
    }
    
    const index = (Math.floor(y) * collisionData.width + Math.floor(x)) * 4;
    const alpha = collisionData.data[index + 3];
    
    // White pixel with full alpha = track (moveable area)
    return alpha > 128; // Allow for some anti-aliasing
  }
  
  /**
   * Get current combination
   */
  getCurrentCombination() {
    return this.currentCombination;
  }
  
  /**
   * Get system statistics
   */
  getStats() {
    return {
      ...this.stats,
      totalCombinations: this.trackTemplates.length * this.backgroundLibrary.length,
      cacheSize: this.pixelDataCache.size,
      enabled: this.config.enabled
    };
  }
  
  /**
   * Clear pixel data cache
   */
  clearCache() {
    this.pixelDataCache.clear();
    console.log('[TrackTemplateManager] Pixel data cache cleared');
  }
  
  /**
   * Get available track templates
   */
  getTrackTemplates() {
    return [...this.trackTemplates];
  }
  
  /**
   * Get available backgrounds
   */
  getBackgroundLibrary() {
    return [...this.backgroundLibrary];
  }
  
  /**
   * Add new track template
   */
  addTrackTemplate(template) {
    if (!template.id || this.trackTemplates.find(t => t.id === template.id)) {
      console.warn('[TrackTemplateManager] Invalid or duplicate template ID');
      return false;
    }
    
    this.trackTemplates.push(template);
    this.stats.templatesLoaded++;
    console.log(`[TrackTemplateManager] Added track template: ${template.name}`);
    return true;
  }
  
  /**
   * Add new background
   */
  addBackground(background) {
    if (!background.id || this.backgroundLibrary.find(b => b.id === background.id)) {
      console.warn('[TrackTemplateManager] Invalid or duplicate background ID');
      return false;
    }
    
    this.backgroundLibrary.push(background);
    this.stats.backgroundsLoaded++;
    console.log(`[TrackTemplateManager] Added background: ${background.name}`);
    return true;
  }
}

export default TrackTemplateManager;