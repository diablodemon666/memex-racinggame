/**
 * AssetManager.js - Advanced Asset Management System
 * 
 * Provides comprehensive asset loading, caching, validation, and hot-reload capabilities.
 * Features LRU cache eviction, sprite sheet support, and asset validation.
 * 
 * Key Features:
 * - Intelligent caching with LRU eviction
 * - Asset validation (dimensions, formats)
 * - Hot-reload support for development
 * - Sprite sheet management
 * - Progress tracking and error handling
 * - Memory usage optimization
 */

import { AssetValidator } from './AssetValidator';
import { LRUCache } from '@utils/LRUCache';
import { AssetState, AssetType } from './AssetTypes';

// Re-export for backward compatibility
export { AssetState, AssetType };

/**
 * Comprehensive Asset Management System
 */
export class AssetManager {
  constructor(scene = null, config = {}) {
    this.scene = scene;
    
    // Configuration with defaults
    this.config = {
      cacheSize: 100, // Max cached assets
      maxMemoryMB: 50, // Memory limit in MB
      validateAssets: true,
      enableHotReload: process.env.NODE_ENV === 'development',
      preloadCriticalAssets: true,
      compressionLevel: 'medium',
      retryAttempts: 3,
      timeoutMs: 10000,
      ...config
    };

    // Asset validator
    this.validator = new AssetValidator();
    
    // LRU Cache for asset storage
    this.cache = new LRUCache(this.config.cacheSize, {
      onEvict: this.handleCacheEviction.bind(this)
    });
    
    // Asset registry - tracks all assets and their states
    this.assetRegistry = new Map();
    
    // Loading queues
    this.loadingQueue = [];
    this.criticalQueue = [];
    this.backgroundQueue = [];
    
    // Statistics and metrics
    this.stats = {
      totalLoaded: 0,
      totalFailed: 0,
      cacheHits: 0,
      cacheMisses: 0,
      memoryUsageMB: 0,
      loadTimeMs: 0,
      hotReloads: 0
    };
    
    // Hot reload tracking
    this.hotReloadCallbacks = new Map();
    this.watchedAssets = new Set();
    
    // Sprite sheet definitions
    this.spriteSheets = new Map();
    
    console.log('[AssetManager] Initialized with config:', this.config);
    
    if (this.config.enableHotReload) {
      this.setupHotReload();
    }
  }

  /**
   * Set the Phaser scene reference
   */
  setScene(scene) {
    this.scene = scene;
    
    // Setup scene-specific asset handling
    if (scene && scene.load) {
      this.setupSceneIntegration();
    }
  }

  /**
   * Load a single asset with comprehensive options
   */
  async loadAsset(key, path, type = AssetType.IMAGE, options = {}) {
    const assetConfig = {
      key,
      path,
      type,
      critical: options.critical || false,
      validate: options.validate !== false,
      cache: options.cache !== false,
      hotReload: options.hotReload !== false,
      retryAttempts: options.retryAttempts || this.config.retryAttempts,
      timeout: options.timeout || this.config.timeoutMs,
      ...options
    };

    // Check if asset is already cached
    if (this.cache.has(key) && assetConfig.cache) {
      this.stats.cacheHits++;
      const cachedAsset = this.cache.get(key);
      this.updateAssetState(key, AssetState.CACHED);
      return cachedAsset;
    }

    this.stats.cacheMisses++;
    
    // Register asset
    this.registerAsset(key, assetConfig);
    
    // Add to appropriate queue
    if (assetConfig.critical) {
      this.criticalQueue.push(assetConfig);
    } else {
      this.backgroundQueue.push(assetConfig);
    }

    // Start loading process
    return this.processAssetLoading(assetConfig);
  }

  /**
   * Load multiple assets with batching
   */
  async loadAssets(assetConfigs) {
    const loadPromises = assetConfigs.map(config => {
      if (typeof config === 'string') {
        // Simple path string
        const key = this.extractKeyFromPath(config);
        return this.loadAsset(key, config);
      } else {
        // Full configuration object
        return this.loadAsset(config.key, config.path, config.type, config);
      }
    });

    try {
      const results = await Promise.allSettled(loadPromises);
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`[AssetManager] Batch load complete: ${successful} successful, ${failed} failed`);
      
      return results.map(result => result.status === 'fulfilled' ? result.value : null);
    } catch (error) {
      console.error('[AssetManager] Batch loading error:', error);
      throw error;
    }
  }

  /**
   * Process individual asset loading
   */
  async processAssetLoading(assetConfig) {
    const { key, path, type, validate, retryAttempts } = assetConfig;
    
    this.updateAssetState(key, AssetState.LOADING);
    
    let attempts = 0;
    while (attempts < retryAttempts) {
      try {
        const startTime = Date.now();
        
        // Load the asset based on type
        let asset;
        switch (type) {
          case AssetType.IMAGE:
            asset = await this.loadImageAsset(path, assetConfig);
            break;
          case AssetType.SPRITE_SHEET:
            asset = await this.loadSpriteSheetAsset(path, assetConfig);
            break;
          case AssetType.AUDIO:
            asset = await this.loadAudioAsset(path, assetConfig);
            break;
          case AssetType.JSON:
            asset = await this.loadJSONAsset(path, assetConfig);
            break;
          case AssetType.CUSTOM_CANVAS:
            asset = await this.loadCustomCanvasAsset(path, assetConfig);
            break;
          default:
            throw new Error(`Unsupported asset type: ${type}`);
        }

        // Validate asset if required
        if (validate) {
          this.updateAssetState(key, AssetState.VALIDATING);
          const validationResult = await this.validator.validateAsset(asset, type, assetConfig);
          
          if (!validationResult.valid) {
            throw new Error(`Asset validation failed: ${validationResult.errors.join(', ')}`);
          }
        }

        // Store in cache
        if (assetConfig.cache) {
          this.cache.set(key, asset);
        }

        // Update statistics
        const loadTime = Date.now() - startTime;
        this.stats.totalLoaded++;
        this.stats.loadTimeMs += loadTime;
        this.updateMemoryUsage();

        this.updateAssetState(key, AssetState.LOADED);
        
        // Setup hot reload watching
        if (this.config.enableHotReload && assetConfig.hotReload) {
          this.watchAssetForChanges(key, path);
        }

        console.log(`[AssetManager] Loaded asset '${key}' in ${loadTime}ms`);
        return asset;

      } catch (error) {
        attempts++;
        console.warn(`[AssetManager] Load attempt ${attempts} failed for '${key}':`, error.message);
        
        if (attempts >= retryAttempts) {
          this.stats.totalFailed++;
          this.updateAssetState(key, AssetState.ERROR, error.message);
          throw error;
        }
        
        // Wait before retry
        await this.delay(Math.min(1000 * Math.pow(2, attempts), 5000));
      }
    }
  }

  /**
   * Load image asset
   */
  async loadImageAsset(path, config) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      const timeout = setTimeout(() => {
        img.onload = null;
        img.onerror = null;
        reject(new Error(`Image load timeout: ${path}`));
      }, config.timeout);

      img.onload = () => {
        clearTimeout(timeout);
        
        // Create canvas for pixel manipulation if needed
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        resolve({
          type: AssetType.IMAGE,
          image: img,
          canvas: canvas,
          width: img.width,
          height: img.height,
          path: path,
          memorySize: img.width * img.height * 4 // RGBA bytes
        });
      };

      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to load image: ${path}`));
      };

      img.src = path;
    });
  }

  /**
   * Load sprite sheet asset
   */
  async loadSpriteSheetAsset(path, config) {
    const imageAsset = await this.loadImageAsset(path, config);
    
    // Load sprite sheet configuration
    let spriteConfig;
    if (config.spriteConfig) {
      spriteConfig = config.spriteConfig;
    } else {
      // Try to load JSON config file
      const configPath = path.replace(/\.(png|jpg|jpeg)$/i, '.json');
      try {
        const configAsset = await this.loadJSONAsset(configPath, config);
        spriteConfig = configAsset.data;
      } catch (error) {
        // Use default grid configuration
        spriteConfig = {
          frameWidth: config.frameWidth || 32,
          frameHeight: config.frameHeight || 32,
          startFrame: config.startFrame || 0,
          endFrame: config.endFrame || -1
        };
      }
    }

    // Parse sprite sheet
    const sprites = this.parseSpriteSheet(imageAsset, spriteConfig);
    
    const spriteSheet = {
      ...imageAsset,
      type: AssetType.SPRITE_SHEET,
      config: spriteConfig,
      sprites: sprites,
      frameCount: sprites.length
    };

    // Store sprite sheet reference
    this.spriteSheets.set(config.key, spriteSheet);
    
    return spriteSheet;
  }

  /**
   * Load audio asset
   */
  async loadAudioAsset(path, config) {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      
      const timeout = setTimeout(() => {
        audio.oncanplaythrough = null;
        audio.onerror = null;
        reject(new Error(`Audio load timeout: ${path}`));
      }, config.timeout);

      audio.oncanplaythrough = () => {
        clearTimeout(timeout);
        resolve({
          type: AssetType.AUDIO,
          audio: audio,
          duration: audio.duration,
          path: path,
          memorySize: audio.duration * 44100 * 2 * 2 // Estimate for stereo 16-bit
        });
      };

      audio.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to load audio: ${path}`));
      };

      audio.src = path;
      audio.load();
    });
  }

  /**
   * Load JSON asset
   */
  async loadJSONAsset(path, config) {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        type: AssetType.JSON,
        data: data,
        path: path,
        memorySize: JSON.stringify(data).length * 2 // Rough estimate
      };
    } catch (error) {
      throw new Error(`Failed to load JSON: ${path} - ${error.message}`);
    }
  }

  /**
   * Load custom canvas asset (for player images)
   */
  async loadCustomCanvasAsset(canvas, config) {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('Custom canvas asset must be HTMLCanvasElement');
    }

    // Create a copy to avoid modifying original
    const copyCanvas = document.createElement('canvas');
    const copyCtx = copyCanvas.getContext('2d');
    copyCanvas.width = canvas.width;
    copyCanvas.height = canvas.height;
    copyCtx.drawImage(canvas, 0, 0);

    return {
      type: AssetType.CUSTOM_CANVAS,
      canvas: copyCanvas,
      width: canvas.width,
      height: canvas.height,
      path: config.key, // Use key as path for custom assets
      memorySize: canvas.width * canvas.height * 4
    };
  }

  /**
   * Parse sprite sheet into individual frames
   */
  parseSpriteSheet(imageAsset, config) {
    const sprites = [];
    const { canvas, width, height } = imageAsset;
    const { frameWidth, frameHeight, startFrame = 0, endFrame = -1 } = config;
    
    const cols = Math.floor(width / frameWidth);
    const rows = Math.floor(height / frameHeight);
    const totalFrames = cols * rows;
    
    const actualEndFrame = endFrame === -1 ? totalFrames - 1 : Math.min(endFrame, totalFrames - 1);
    
    for (let frame = startFrame; frame <= actualEndFrame; frame++) {
      const col = frame % cols;
      const row = Math.floor(frame / cols);
      
      const spriteCanvas = document.createElement('canvas');
      const spriteCtx = spriteCanvas.getContext('2d');
      spriteCanvas.width = frameWidth;
      spriteCanvas.height = frameHeight;
      
      spriteCtx.drawImage(
        canvas,
        col * frameWidth, row * frameHeight, frameWidth, frameHeight,
        0, 0, frameWidth, frameHeight
      );
      
      sprites.push({
        frame: frame,
        canvas: spriteCanvas,
        width: frameWidth,
        height: frameHeight,
        x: col * frameWidth,
        y: row * frameHeight
      });
    }
    
    return sprites;
  }

  /**
   * Get sprite from sprite sheet
   */
  getSprite(sheetKey, frameIndex) {
    const spriteSheet = this.spriteSheets.get(sheetKey);
    if (!spriteSheet) {
      throw new Error(`Sprite sheet not found: ${sheetKey}`);
    }
    
    if (frameIndex < 0 || frameIndex >= spriteSheet.sprites.length) {
      throw new Error(`Frame index out of range: ${frameIndex}`);
    }
    
    return spriteSheet.sprites[frameIndex];
  }

  /**
   * Load critical assets first
   */
  async loadCriticalAssets() {
    if (this.criticalQueue.length === 0) return;
    
    console.log(`[AssetManager] Loading ${this.criticalQueue.length} critical assets...`);
    
    const criticalPromises = this.criticalQueue.map(config => 
      this.processAssetLoading(config)
    );
    
    try {
      await Promise.all(criticalPromises);
      this.criticalQueue = [];
      console.log('[AssetManager] Critical assets loaded successfully');
    } catch (error) {
      console.error('[AssetManager] Critical asset loading failed:', error);
      throw error;
    }
  }

  /**
   * Load background assets (non-blocking)
   */
  loadBackgroundAssets() {
    if (this.backgroundQueue.length === 0) return;
    
    console.log(`[AssetManager] Starting background load of ${this.backgroundQueue.length} assets...`);
    
    // Process background assets with lower priority
    const processNext = () => {
      if (this.backgroundQueue.length === 0) return;
      
      const config = this.backgroundQueue.shift();
      this.processAssetLoading(config)
        .then(() => {
          // Continue with next asset
          setTimeout(processNext, 10); // Small delay to avoid blocking
        })
        .catch(error => {
          console.warn('[AssetManager] Background asset load failed:', error);
          setTimeout(processNext, 100); // Longer delay on error
        });
    };
    
    // Start processing
    processNext();
  }

  /**
   * Get asset from cache or registry
   */
  getAsset(key) {
    // Check cache first
    if (this.cache.has(key)) {
      this.stats.cacheHits++;
      return this.cache.get(key);
    }
    
    // Check if asset is registered but not cached
    const assetInfo = this.assetRegistry.get(key);
    if (assetInfo && assetInfo.state === AssetState.LOADED) {
      console.warn(`[AssetManager] Asset '${key}' was loaded but not cached`);
      return null;
    }
    
    console.warn(`[AssetManager] Asset not found: ${key}`);
    return null;
  }

  /**
   * Check if asset is loaded and available
   */
  isAssetLoaded(key) {
    const assetInfo = this.assetRegistry.get(key);
    return assetInfo && assetInfo.state === AssetState.LOADED;
  }

  /**
   * Get loading progress for all assets
   */
  getLoadingProgress() {
    const total = this.assetRegistry.size;
    if (total === 0) return { loaded: 0, total: 0, percentage: 100 };
    
    let loaded = 0;
    for (const [key, info] of this.assetRegistry) {
      if (info.state === AssetState.LOADED || info.state === AssetState.CACHED) {
        loaded++;
      }
    }
    
    return {
      loaded,
      total,
      percentage: Math.round((loaded / total) * 100)
    };
  }

  /**
   * Preload game assets based on current scene
   */
  async preloadGameAssets() {
    const gameAssets = [
      // Player sprites
      ...Array.from({ length: 6 }, (_, i) => ({
        key: `player${i}`,
        path: `assets/sprites/players/player${i}.png`,
        type: AssetType.IMAGE,
        critical: true,
        validate: true
      })),
      
      // Game tokens
      { key: 'mtoken', path: 'assets/sprites/tokens/mtoken.png', type: AssetType.IMAGE, critical: true },
      
      // Boosters
      { key: 'boosters', path: 'assets/sprites/boosters/boosters.png', type: AssetType.SPRITE_SHEET, 
        frameWidth: 32, frameHeight: 32, critical: false },
      
      // Skills
      { key: 'skills', path: 'assets/sprites/skills/skills.png', type: AssetType.SPRITE_SHEET,
        frameWidth: 32, frameHeight: 32, critical: false },
      
      // UI elements
      { key: 'ui_buttons', path: 'assets/ui/buttons/buttons.png', type: AssetType.SPRITE_SHEET,
        frameWidth: 64, frameHeight: 32, critical: false },
        
      // Audio assets
      { key: 'race_music', path: 'assets/sounds/music/race.mp3', type: AssetType.AUDIO, critical: false },
      { key: 'effects', path: 'assets/sounds/effects/effects.json', type: AssetType.JSON, critical: false }
    ];

    try {
      await this.loadAssets(gameAssets);
      console.log('[AssetManager] Game assets preloaded successfully');
    } catch (error) {
      console.error('[AssetManager] Game asset preloading failed:', error);
      throw error;
    }
  }

  /**
   * Setup hot reload system
   */
  setupHotReload() {
    // This would integrate with webpack's HMR or a file watcher
    console.log('[AssetManager] Hot reload system enabled');
    
    if (module.hot) {
      module.hot.accept('./AssetManager', () => {
        console.log('[AssetManager] Hot reloading asset manager...');
        this.handleHotReload();
      });
    }
  }

  /**
   * Watch asset for changes (development)
   */
  watchAssetForChanges(key, path) {
    if (!this.config.enableHotReload) return;
    
    this.watchedAssets.add(key);
    
    // In a real implementation, this would setup file watching
    console.log(`[AssetManager] Watching asset for changes: ${key}`);
  }

  /**
   * Handle hot reload of assets
   */
  async handleHotReload(changedAssets = []) {
    console.log('[AssetManager] Processing hot reload...');
    
    for (const assetKey of changedAssets) {
      if (this.watchedAssets.has(assetKey)) {
        const assetInfo = this.assetRegistry.get(assetKey);
        if (assetInfo) {
          this.updateAssetState(assetKey, AssetState.HOT_RELOADING);
          
          try {
            // Remove from cache
            this.cache.delete(assetKey);
            
            // Reload asset
            const newAsset = await this.processAssetLoading(assetInfo.config);
            
            // Notify callbacks
            const callbacks = this.hotReloadCallbacks.get(assetKey) || [];
            callbacks.forEach(callback => {
              try {
                callback(newAsset, assetKey);
              } catch (error) {
                console.error('[AssetManager] Hot reload callback error:', error);
              }
            });
            
            this.stats.hotReloads++;
            console.log(`[AssetManager] Hot reloaded asset: ${assetKey}`);
            
          } catch (error) {
            console.error(`[AssetManager] Hot reload failed for ${assetKey}:`, error);
            this.updateAssetState(assetKey, AssetState.ERROR, error.message);
          }
        }
      }
    }
  }

  /**
   * Register callback for hot reload events
   */
  onHotReload(assetKey, callback) {
    if (!this.hotReloadCallbacks.has(assetKey)) {
      this.hotReloadCallbacks.set(assetKey, []);
    }
    this.hotReloadCallbacks.get(assetKey).push(callback);
  }

  /**
   * Setup Phaser scene integration
   */
  setupSceneIntegration() {
    if (!this.scene || !this.scene.load) return;
    
    // Override scene's texture addition to use our cache
    const originalAddTexture = this.scene.textures.addCanvas;
    this.scene.textures.addCanvas = (key, canvas) => {
      // Store in our cache as well
      this.cache.set(key, {
        type: AssetType.CUSTOM_CANVAS,
        canvas: canvas,
        width: canvas.width,
        height: canvas.height,
        memorySize: canvas.width * canvas.height * 4
      });
      
      return originalAddTexture.call(this.scene.textures, key, canvas);
    };
    
    console.log('[AssetManager] Phaser scene integration setup complete');
  }

  /**
   * Register asset in the registry
   */
  registerAsset(key, config) {
    this.assetRegistry.set(key, {
      key,
      config,
      state: AssetState.PENDING,
      error: null,
      registeredAt: Date.now()
    });
  }

  /**
   * Update asset state
   */
  updateAssetState(key, state, error = null) {
    const assetInfo = this.assetRegistry.get(key);
    if (assetInfo) {
      assetInfo.state = state;
      assetInfo.error = error;
      assetInfo.updatedAt = Date.now();
    }
  }

  /**
   * Handle cache eviction
   */
  handleCacheEviction(key, asset) {
    console.log(`[AssetManager] Evicting asset from cache: ${key}`);
    
    // Clean up memory for complex assets
    if (asset.canvas) {
      const ctx = asset.canvas.getContext('2d');
      ctx.clearRect(0, 0, asset.canvas.width, asset.canvas.height);
    }
    
    this.updateMemoryUsage();
  }

  /**
   * Update memory usage statistics
   */
  updateMemoryUsage() {
    let totalMemory = 0;
    
    for (const [key, asset] of this.cache.entries()) {
      if (asset.memorySize) {
        totalMemory += asset.memorySize;
      }
    }
    
    this.stats.memoryUsageMB = totalMemory / (1024 * 1024);
    
    // Trigger aggressive cleanup if memory limit exceeded
    if (this.stats.memoryUsageMB > this.config.maxMemoryMB) {
      this.performMemoryCleanup();
    }
  }

  /**
   * Perform memory cleanup
   */
  performMemoryCleanup() {
    console.warn(`[AssetManager] Memory limit exceeded (${this.stats.memoryUsageMB.toFixed(1)}MB), performing cleanup...`);
    
    // Force evict least recently used assets
    const targetMemory = this.config.maxMemoryMB * 0.8; // Target 80% of limit
    while (this.stats.memoryUsageMB > targetMemory && this.cache.size > 0) {
      this.cache.evictLRU();
      this.updateMemoryUsage();
    }
    
    console.log(`[AssetManager] Memory cleanup complete. Usage: ${this.stats.memoryUsageMB.toFixed(1)}MB`);
  }

  /**
   * Extract key from file path
   */
  extractKeyFromPath(path) {
    return path.split('/').pop().split('.')[0];
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      registeredAssets: this.assetRegistry.size,
      watchedAssets: this.watchedAssets.size,
      averageLoadTime: this.stats.totalLoaded > 0 ? 
        Math.round(this.stats.loadTimeMs / this.stats.totalLoaded) : 0,
      hitRate: this.stats.cacheHits + this.stats.cacheMisses > 0 ? 
        Math.round((this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100) : 0
    };
  }

  /**
   * Clear all cached assets
   */
  clearCache() {
    this.cache.clear();
    this.updateMemoryUsage();
    console.log('[AssetManager] Cache cleared');
  }

  /**
   * Cleanup and destroy asset manager
   */
  destroy() {
    // Clear all caches and references
    this.cache.clear();
    this.assetRegistry.clear();
    this.spriteSheets.clear();
    this.hotReloadCallbacks.clear();
    this.watchedAssets.clear();
    
    // Clear queues
    this.loadingQueue = [];
    this.criticalQueue = [];
    this.backgroundQueue = [];
    
    console.log('[AssetManager] Asset manager destroyed');
  }
}

export default AssetManager;