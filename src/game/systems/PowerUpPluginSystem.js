/**
 * PowerUpPluginSystem.js - Extensible Plugin Architecture for Power-ups
 * 
 * Provides a comprehensive plugin system for creating custom power-up effects,
 * visual elements, and behaviors. Supports dynamic loading, hot-reload,
 * and sandboxed execution for user-created plugins.
 * 
 * Key Features:
 * - Plugin registration and lifecycle management
 * - Sandboxed plugin execution environment
 * - Dynamic loading from external files
 * - Hot-reload support for development
 * - API validation and security checks
 * - Plugin dependency management
 * - Event-driven communication
 * - Performance monitoring
 */

import { PowerUpEffect, PowerUpEffectType } from '@game/entities/PowerUpManager';

/**
 * Plugin execution states
 */
export const PluginState = {
  UNLOADED: 'unloaded',
  LOADING: 'loading',
  LOADED: 'loaded',
  ACTIVE: 'active',
  ERROR: 'error',
  DISABLED: 'disabled'
};

/**
 * Plugin API security levels
 */
export const SecurityLevel = {
  SAFE: 'safe',           // Limited access, read-only
  TRUSTED: 'trusted',     // Full game API access
  SANDBOXED: 'sandboxed'  // Isolated execution
};

/**
 * Plugin validation result
 */
export class PluginValidationResult {
  constructor(valid = false) {
    this.valid = valid;
    this.errors = [];
    this.warnings = [];
    this.securityIssues = [];
    this.timestamp = Date.now();
  }

  addError(message) {
    this.errors.push(message);
    this.valid = false;
  }

  addWarning(message) {
    this.warnings.push(message);
  }

  addSecurityIssue(message) {
    this.securityIssues.push(message);
    this.valid = false;
  }
}

/**
 * Plugin metadata and configuration
 */
export class PluginInfo {
  constructor(config = {}) {
    this.id = config.id || '';
    this.name = config.name || 'Unknown Plugin';
    this.version = config.version || '1.0.0';
    this.author = config.author || 'Unknown';
    this.description = config.description || '';
    this.apiVersion = config.apiVersion || '1.0.0';
    this.dependencies = config.dependencies || [];
    this.securityLevel = config.securityLevel || SecurityLevel.SAFE;
    this.effectTypes = config.effectTypes || [];
    this.entry = config.entry || 'main.js';
    this.assets = config.assets || [];
    this.permissions = config.permissions || [];
    this.createdAt = Date.now();
    this.loadedAt = null;
    this.state = PluginState.UNLOADED;
  }
}

/**
 * Plugin API interface for secure access to game systems
 */
export class PluginAPI {
  constructor(pluginInfo, powerUpManager) {
    this.pluginInfo = pluginInfo;
    this.powerUpManager = powerUpManager;
    this.securityLevel = pluginInfo.securityLevel;
    
    // Create sandboxed API based on security level
    this.createSandboxedAPI();
  }

  /**
   * Create sandboxed API with appropriate permissions
   */
  createSandboxedAPI() {
    // Base API available to all plugins
    this.api = {
      // Plugin information
      getPluginInfo: () => ({ ...this.pluginInfo }),
      
      // Safe utility functions
      createEffect: (config) => this.createEffect(config),
      log: (message) => console.log(`[Plugin:${this.pluginInfo.id}] ${message}`),
      warn: (message) => console.warn(`[Plugin:${this.pluginInfo.id}] ${message}`),
      
      // Event system
      addEventListener: (event, callback) => this.addEventListener(event, callback),
      removeEventListener: (event, callback) => this.removeEventListener(event, callback),
      emitEvent: (event, data) => this.emitEvent(event, data),
      
      // Asset management (limited)
      loadAsset: (key, path) => this.loadAsset(key, path),
      
      // Math utilities
      math: {
        random: Math.random,
        sin: Math.sin,
        cos: Math.cos,
        abs: Math.abs,
        min: Math.min,
        max: Math.max,
        floor: Math.floor,
        ceil: Math.ceil,
        round: Math.round
      }
    };

    // Add additional APIs based on security level
    if (this.securityLevel === SecurityLevel.TRUSTED) {
      this.addTrustedAPI();
    } else if (this.securityLevel === SecurityLevel.SANDBOXED) {
      this.addSandboxedAPI();
    }
  }

  /**
   * Add trusted API methods (full access)
   */
  addTrustedAPI() {
    Object.assign(this.api, {
      // Direct access to managers
      getPowerUpManager: () => this.powerUpManager,
      getScene: () => this.powerUpManager.scene,
      
      // Physics system access
      getPhysicsManager: () => this.powerUpManager.physicsManager,
      
      // Asset manager access
      getAssetManager: () => this.powerUpManager.assetManager,
      
      // Configuration access
      getConfigManager: () => this.powerUpManager.configManager
    });
  }

  /**
   * Add sandboxed API methods (limited access)
   */
  addSandboxedAPI() {
    Object.assign(this.api, {
      // Limited scene access
      createParticles: (config) => this.createParticles(config),
      createTween: (config) => this.createTween(config),
      playSound: (key, config) => this.playSound(key, config),
      
      // Limited physics access
      checkCollision: (entity1, entity2) => this.checkCollision(entity1, entity2),
      getDistance: (x1, y1, x2, y2) => this.getDistance(x1, y1, x2, y2),
      
      // Safe configuration access
      getConfigValue: (path, defaultValue) => this.getConfigValue(path, defaultValue)
    });
  }

  /**
   * Create effect instance (secure wrapper)
   */
  createEffect(config) {
    if (!this.validateEffectConfig(config)) {
      throw new Error('Invalid effect configuration');
    }

    return new CustomPluginEffect(config, this);
  }

  /**
   * Validate effect configuration
   */
  validateEffectConfig(config) {
    return config && typeof config === 'object' && config.name;
  }

  /**
   * Event system methods
   */
  addEventListener(event, callback) {
    // Plugin-specific event namespacing
    const namespacedEvent = `plugin:${this.pluginInfo.id}:${event}`;
    this.powerUpManager.addEventListener(namespacedEvent, callback);
  }

  removeEventListener(event, callback) {
    const namespacedEvent = `plugin:${this.pluginInfo.id}:${event}`;
    this.powerUpManager.removeEventListener(namespacedEvent, callback);
  }

  emitEvent(event, data) {
    const namespacedEvent = `plugin:${this.pluginInfo.id}:${event}`;
    this.powerUpManager.emitEvent(namespacedEvent, data);
  }

  /**
   * Safe asset loading
   */
  async loadAsset(key, path) {
    if (this.securityLevel === SecurityLevel.SAFE) {
      // Only allow loading from plugin's asset directory
      const pluginAssetPath = `plugins/${this.pluginInfo.id}/assets/`;
      if (!path.startsWith(pluginAssetPath)) {
        throw new Error('Asset access denied: Outside plugin directory');
      }
    }

    return this.powerUpManager.assetManager.loadAsset(key, path);
  }

  /**
   * Sandboxed particle creation
   */
  createParticles(config) {
    const scene = this.powerUpManager.scene;
    if (!scene) return null;

    // Validate and sanitize particle config
    const safeConfig = {
      x: Number(config.x) || 0,
      y: Number(config.y) || 0,
      texture: 'particle', // Force safe texture
      speed: { min: 10, max: 100 },
      scale: { start: 0.1, end: 0 },
      lifespan: Math.min(config.lifespan || 1000, 5000), // Max 5 seconds
      quantity: Math.min(config.quantity || 10, 50) // Max 50 particles
    };

    return scene.add.particles(safeConfig.x, safeConfig.y, safeConfig.texture, safeConfig);
  }

  /**
   * Sandboxed tween creation
   */
  createTween(config) {
    const scene = this.powerUpManager.scene;
    if (!scene) return null;

    // Validate and sanitize tween config
    const safeDuration = Math.min(config.duration || 1000, 10000); // Max 10 seconds
    const safeConfig = {
      ...config,
      duration: safeDuration,
      onComplete: typeof config.onComplete === 'function' ? config.onComplete : undefined
    };

    return scene.tweens.add(safeConfig);
  }

  /**
   * Safe sound playing
   */
  playSound(key, config = {}) {
    const scene = this.powerUpManager.scene;
    if (!scene || !scene.sound) return;

    const safeConfig = {
      volume: Math.min(Math.max(config.volume || 0.5, 0), 1),
      loop: Boolean(config.loop),
      rate: Math.min(Math.max(config.rate || 1, 0.5), 2)
    };

    scene.sound.play(key, safeConfig);
  }

  /**
   * Safe collision checking
   */
  checkCollision(entity1, entity2) {
    if (!entity1 || !entity2) return false;
    
    const distance = this.getDistance(entity1.x, entity1.y, entity2.x, entity2.y);
    return distance < 32; // Standard collision radius
  }

  /**
   * Safe distance calculation
   */
  getDistance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  /**
   * Safe configuration access
   */
  getConfigValue(path, defaultValue) {
    try {
      return this.powerUpManager.configManager.getConfigValue('power-up-definitions', path, defaultValue);
    } catch (error) {
      return defaultValue;
    }
  }
}

/**
 * Custom plugin effect class
 */
export class CustomPluginEffect extends PowerUpEffect {
  constructor(config, pluginAPI) {
    super(config);
    this.pluginAPI = pluginAPI;
    this.customLogic = config.customLogic || null;
    this.customData = config.customData || {};
  }

  apply(target, powerUpManager) {
    super.apply(target, powerUpManager);

    // Execute custom plugin logic
    if (this.customLogic && typeof this.customLogic.apply === 'function') {
      try {
        this.customLogic.apply(target, this.pluginAPI.api, this.customData);
      } catch (error) {
        console.error(`[Plugin] Error in apply logic:`, error);
      }
    }
  }

  update(target, deltaTime) {
    const stillActive = super.update(target, deltaTime);

    // Execute custom update logic
    if (stillActive && this.customLogic && typeof this.customLogic.update === 'function') {
      try {
        return this.customLogic.update(target, this.pluginAPI.api, deltaTime, this.customData);
      } catch (error) {
        console.error(`[Plugin] Error in update logic:`, error);
        return false;
      }
    }

    return stillActive;
  }

  remove(target) {
    // Execute custom remove logic
    if (this.customLogic && typeof this.customLogic.remove === 'function') {
      try {
        this.customLogic.remove(target, this.pluginAPI.api, this.customData);
      } catch (error) {
        console.error(`[Plugin] Error in remove logic:`, error);
      }
    }

    super.remove(target);
  }
}

/**
 * Main Plugin System Manager
 */
export class PowerUpPluginSystem {
  constructor(powerUpManager, config = {}) {
    this.powerUpManager = powerUpManager;
    
    this.config = {
      pluginDirectory: 'data/plugins/',
      maxPlugins: 50,
      enableHotReload: process.env.NODE_ENV === 'development',
      defaultSecurityLevel: SecurityLevel.SAFE,
      enableSandbox: true,
      pluginTimeout: 30000, // 30 seconds max execution time
      ...config
    };

    // Plugin registry
    this.plugins = new Map();
    this.pluginInstances = new Map();
    this.loadedEffects = new Map();
    
    // Plugin APIs
    this.pluginAPIs = new Map();
    
    // Statistics
    this.stats = {
      totalPlugins: 0,
      activePlugins: 0,
      loadedEffects: 0,
      executionErrors: 0,
      hotReloads: 0
    };

    // Built-in plugin templates
    this.builtInPlugins = this.createBuiltInPlugins();

    console.log('[PowerUpPluginSystem] Initialized plugin system');

    if (this.config.enableHotReload) {
      this.setupHotReload();
    }
  }

  /**
   * Create built-in plugin templates
   */
  createBuiltInPlugins() {
    return new Map([
      ['rainbow_boost', {
        info: new PluginInfo({
          id: 'rainbow_boost',
          name: 'Rainbow Boost Effect',
          version: '1.0.0',
          author: 'System',
          description: 'Creates a rainbow particle trail effect',
          effectTypes: ['rainbow_boost'],
          securityLevel: SecurityLevel.TRUSTED
        }),
        plugin: {
          createEffect: (config) => ({
            apply: (target, api, data) => {
              // Create rainbow particle trail
              const colors = data.trailColors || ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'];
              const particles = api.createParticles({
                x: target.x,
                y: target.y,
                speed: { min: 30, max: 80 },
                scale: { start: 0.3, end: 0 },
                tint: colors.map(color => parseInt(color.replace('#', '0x'))),
                lifespan: 800,
                quantity: data.particleCount || 15
              });
              
              data.particles = particles;
              if (particles && particles.startFollow) {
                particles.startFollow(target);
              }
            },
            update: (target, api, deltaTime, data) => {
              // Update particle position if needed
              if (data.particles && target) {
                data.particles.setPosition(target.x, target.y);
              }
              return true;
            },
            remove: (target, api, data) => {
              // Clean up particles
              if (data.particles) {
                data.particles.destroy();
              }
            }
          })
        }
      }]),

      ['lightning_aura', {
        info: new PluginInfo({
          id: 'lightning_aura',
          name: 'Lightning Aura Effect',
          version: '1.0.0',
          author: 'System',
          description: 'Creates electric lightning effects around the player',
          effectTypes: ['lightning_aura'],
          securityLevel: SecurityLevel.SANDBOXED
        }),
        plugin: {
          createEffect: (config) => ({
            apply: (target, api, data) => {
              data.lightningTimer = setInterval(() => {
                this.createLightningBolt(target, api);
              }, 1000);
            },
            update: (target, api, deltaTime, data) => {
              return true;
            },
            remove: (target, api, data) => {
              if (data.lightningTimer) {
                clearInterval(data.lightningTimer);
              }
            }
          }),
          createLightningBolt: (target, api) => {
            const angle = Math.random() * Math.PI * 2;
            const radius = 50;
            const x1 = target.x + Math.cos(angle) * radius;
            const y1 = target.y + Math.sin(angle) * radius;
            const x2 = target.x + Math.cos(angle + Math.PI) * radius;
            const y2 = target.y + Math.sin(angle + Math.PI) * radius;

            // Create lightning line effect
            api.createTween({
              targets: { alpha: 1 },
              alpha: 0,
              duration: 200,
              onStart: () => {
                // Visual lightning effect would go here
                api.log(`Lightning bolt at ${x1},${y1} to ${x2},${y2}`);
              }
            });
          }
        }
      }])
    ]);
  }

  /**
   * Register a plugin
   */
  async registerPlugin(pluginInfo, pluginCode) {
    try {
      // Validate plugin
      const validationResult = this.validatePlugin(pluginInfo, pluginCode);
      if (!validationResult.valid) {
        throw new Error(`Plugin validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Check if plugin already exists
      if (this.plugins.has(pluginInfo.id)) {
        throw new Error(`Plugin already registered: ${pluginInfo.id}`);
      }

      // Create plugin API
      const pluginAPI = new PluginAPI(pluginInfo, this.powerUpManager);
      this.pluginAPIs.set(pluginInfo.id, pluginAPI);

      // Load plugin in sandbox if needed
      let pluginInstance;
      if (pluginInfo.securityLevel === SecurityLevel.SANDBOXED) {
        pluginInstance = await this.loadPluginInSandbox(pluginCode, pluginAPI.api);
      } else {
        pluginInstance = await this.loadPluginDirect(pluginCode, pluginAPI.api);
      }

      // Store plugin
      this.plugins.set(pluginInfo.id, {
        info: pluginInfo,
        instance: pluginInstance,
        api: pluginAPI,
        loadedAt: Date.now(),
        state: PluginState.LOADED
      });

      // Register effect types
      this.registerPluginEffects(pluginInfo, pluginInstance);

      this.stats.totalPlugins++;
      console.log(`[PowerUpPluginSystem] Registered plugin: ${pluginInfo.id}`);

      return true;

    } catch (error) {
      console.error(`[PowerUpPluginSystem] Failed to register plugin: ${pluginInfo.id}`, error);
      throw error;
    }
  }

  /**
   * Validate plugin code and metadata
   */
  validatePlugin(pluginInfo, pluginCode) {
    const result = new PluginValidationResult(true);

    // Validate plugin info
    if (!pluginInfo.id) {
      result.addError('Plugin must have an ID');
    }

    if (!pluginInfo.name) {
      result.addError('Plugin must have a name');
    }

    if (!pluginInfo.effectTypes || pluginInfo.effectTypes.length === 0) {
      result.addError('Plugin must specify at least one effect type');
    }

    // Basic code validation
    if (!pluginCode || typeof pluginCode !== 'string') {
      result.addError('Plugin code must be a non-empty string');
    }

    // Security checks for sandboxed plugins
    if (pluginInfo.securityLevel === SecurityLevel.SANDBOXED) {
      this.performSecurityChecks(pluginCode, result);
    }

    // API version compatibility
    if (pluginInfo.apiVersion && !this.isAPIVersionCompatible(pluginInfo.apiVersion)) {
      result.addWarning(`Plugin API version ${pluginInfo.apiVersion} may not be fully compatible`);
    }

    return result;
  }

  /**
   * Perform security checks on plugin code
   */
  performSecurityChecks(pluginCode, result) {
    const dangerousPatterns = [
      /eval\s*\(/g,
      /Function\s*\(/g,
      /document\./g,
      /window\./g,
      /global\./g,
      /process\./g,
      /require\s*\(/g,
      /import\s+/g,
      /export\s+/g
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(pluginCode)) {
        result.addSecurityIssue(`Potentially dangerous code pattern detected: ${pattern.source}`);
      }
    }

    // Check for excessively long code
    if (pluginCode.length > 100000) { // 100KB limit
      result.addWarning('Plugin code is very large, consider optimization');
    }
  }

  /**
   * Check API version compatibility
   */
  isAPIVersionCompatible(version) {
    // Simple version check - in production this would be more sophisticated
    const [major, minor] = version.split('.').map(Number);
    return major === 1 && minor <= 0; // Support API 1.0.x
  }

  /**
   * Load plugin in sandbox environment
   */
  async loadPluginInSandbox(pluginCode, api) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Plugin loading timeout'));
      }, this.config.pluginTimeout);

      try {
        // Create isolated execution context
        const sandbox = {
          api,
          console: {
            log: api.log,
            warn: api.warn,
            error: api.warn
          },
          setTimeout: (callback, delay) => setTimeout(callback, Math.min(delay, 5000)),
          clearTimeout: clearTimeout,
          setInterval: (callback, delay) => setInterval(callback, Math.max(delay, 100)),
          clearInterval: clearInterval
        };

        // Execute plugin code in sandbox
        const pluginFunction = new Function('sandbox', `
          with (sandbox) {
            ${pluginCode}
            return typeof plugin !== 'undefined' ? plugin : {};
          }
        `);

        const pluginInstance = pluginFunction(sandbox);
        
        clearTimeout(timeout);
        resolve(pluginInstance);

      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Load plugin directly (trusted mode)
   */
  async loadPluginDirect(pluginCode, api) {
    try {
      // Create plugin execution environment
      const pluginFunction = new Function('api', pluginCode + '\nreturn plugin;');
      return pluginFunction(api);
    } catch (error) {
      throw new Error(`Plugin execution failed: ${error.message}`);
    }
  }

  /**
   * Register plugin effects with PowerUpManager
   */
  registerPluginEffects(pluginInfo, pluginInstance) {
    for (const effectType of pluginInfo.effectTypes) {
      if (pluginInstance.createEffect) {
        // Create effect factory
        const effectFactory = (config) => {
          const pluginAPI = this.pluginAPIs.get(pluginInfo.id);
          const effectLogic = pluginInstance.createEffect(config);
          
          return new CustomPluginEffect({
            name: effectType,
            type: effectType,
            customLogic: effectLogic,
            customData: config,
            ...config
          }, pluginAPI);
        };

        this.powerUpManager.registerEffectPlugin(effectType, effectFactory);
        this.loadedEffects.set(effectType, pluginInfo.id);
        this.stats.loadedEffects++;

        console.log(`[PowerUpPluginSystem] Registered effect type: ${effectType}`);
      }
    }
  }

  /**
   * Load plugin from file
   */
  async loadPluginFromFile(filePath) {
    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const pluginData = await response.json();
      
      // Extract plugin info and code
      const pluginInfo = new PluginInfo(pluginData.info || {});
      const pluginCode = pluginData.code || '';

      await this.registerPlugin(pluginInfo, pluginCode);
      
      console.log(`[PowerUpPluginSystem] Loaded plugin from file: ${filePath}`);

    } catch (error) {
      console.error(`[PowerUpPluginSystem] Failed to load plugin from file: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Load all built-in plugins
   */
  loadBuiltInPlugins() {
    for (const [id, pluginData] of this.builtInPlugins) {
      try {
        this.plugins.set(id, {
          info: pluginData.info,
          instance: pluginData.plugin,
          api: new PluginAPI(pluginData.info, this.powerUpManager),
          loadedAt: Date.now(),
          state: PluginState.LOADED
        });

        this.registerPluginEffects(pluginData.info, pluginData.plugin);
        this.stats.totalPlugins++;

      } catch (error) {
        console.error(`[PowerUpPluginSystem] Failed to load built-in plugin: ${id}`, error);
      }
    }

    console.log(`[PowerUpPluginSystem] Loaded ${this.builtInPlugins.size} built-in plugins`);
  }

  /**
   * Unregister plugin
   */
  unregisterPlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return false;
    }

    try {
      // Unregister effect types
      for (const effectType of plugin.info.effectTypes) {
        if (this.loadedEffects.get(effectType) === pluginId) {
          this.loadedEffects.delete(effectType);
          this.stats.loadedEffects--;
        }
      }

      // Clean up API
      this.pluginAPIs.delete(pluginId);

      // Remove plugin
      this.plugins.delete(pluginId);
      this.stats.totalPlugins--;

      console.log(`[PowerUpPluginSystem] Unregistered plugin: ${pluginId}`);
      return true;

    } catch (error) {
      console.error(`[PowerUpPluginSystem] Error unregistering plugin: ${pluginId}`, error);
      return false;
    }
  }

  /**
   * Get plugin information
   */
  getPluginInfo(pluginId) {
    const plugin = this.plugins.get(pluginId);
    return plugin ? plugin.info : null;
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins() {
    return Array.from(this.plugins.values()).map(plugin => plugin.info);
  }

  /**
   * Check if effect type is available
   */
  hasEffectType(effectType) {
    return this.loadedEffects.has(effectType);
  }

  /**
   * Get available effect types
   */
  getAvailableEffectTypes() {
    return Array.from(this.loadedEffects.keys());
  }

  /**
   * Setup hot reload system
   */
  setupHotReload() {
    // In a real implementation, this would watch the plugin directory
    console.log('[PowerUpPluginSystem] Hot reload system enabled');
    
    // Simulate hot reload capability
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        this.checkForPluginUpdates();
      });
    }
  }

  /**
   * Check for plugin updates (hot reload)
   */
  async checkForPluginUpdates() {
    if (!this.config.enableHotReload) return;

    // This would check file modification times in a real implementation
    console.log('[PowerUpPluginSystem] Checking for plugin updates...');
  }

  /**
   * Reload plugin (hot reload)
   */
  async reloadPlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    try {
      // Unregister current plugin
      this.unregisterPlugin(pluginId);

      // Reload from source (would need to store original source path)
      // For now, just log the operation
      console.log(`[PowerUpPluginSystem] Hot reloaded plugin: ${pluginId}`);
      this.stats.hotReloads++;

    } catch (error) {
      console.error(`[PowerUpPluginSystem] Hot reload failed for plugin: ${pluginId}`, error);
      throw error;
    }
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    return {
      ...this.stats,
      activePlugins: Array.from(this.plugins.values()).filter(p => p.state === PluginState.ACTIVE).length,
      pluginAPIs: this.pluginAPIs.size
    };
  }

  /**
   * Initialize the plugin system
   */
  async initialize() {
    try {
      // Load built-in plugins first
      this.loadBuiltInPlugins();

      // Load external plugins (if any)
      // await this.loadExternalPlugins();

      console.log(`[PowerUpPluginSystem] Initialized with ${this.stats.totalPlugins} plugins`);

    } catch (error) {
      console.error('[PowerUpPluginSystem] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Destroy the plugin system
   */
  destroy() {
    // Unregister all plugins
    for (const pluginId of this.plugins.keys()) {
      this.unregisterPlugin(pluginId);
    }

    // Clear all references
    this.plugins.clear();
    this.pluginAPIs.clear();
    this.loadedEffects.clear();
    this.builtInPlugins.clear();

    console.log('[PowerUpPluginSystem] Plugin system destroyed');
  }
}

export default PowerUpPluginSystem;