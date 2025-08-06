/**
 * ConfigManager.js - Advanced Configuration Management System
 * 
 * Provides comprehensive configuration loading, validation, hot-reload, and schema support.
 * Designed to work with external JSON configuration files and support content creators.
 * 
 * Key Features:
 * - JSON schema validation for configuration integrity
 * - Hot-reload support with file watching for development
 * - Hierarchical configuration merging (default -> environment -> user)
 * - Type-safe configuration access with fallbacks
 * - Event-driven configuration updates
 * - Performance monitoring and validation reporting
 * - Integration with existing game systems
 */

import { LRUCache } from '@utils/LRUCache';

/**
 * Configuration Types
 */
export const ConfigType = {
  GAME_SETTINGS: 'game-settings',
  PLAYER_PREFERENCES: 'player-preferences', 
  TRACK_CONFIGURATIONS: 'track-configurations',
  POWER_UP_DEFINITIONS: 'power-up-definitions',
  AUDIO_SETTINGS: 'audio-settings',
  VISUAL_SETTINGS: 'visual-settings',
  MULTIPLAYER_SETTINGS: 'multiplayer-settings'
};

/**
 * Configuration States
 */
export const ConfigState = {
  UNLOADED: 'unloaded',
  LOADING: 'loading',
  LOADED: 'loaded',
  VALIDATING: 'validating',
  VALIDATED: 'validated',
  ERROR: 'error',
  HOT_RELOADING: 'hot_reloading'
};

/**
 * Validation Result
 */
export class ValidationResult {
  constructor(valid = false, errors = [], warnings = []) {
    this.valid = valid;
    this.errors = errors;
    this.warnings = warnings;
    this.timestamp = Date.now();
  }

  addError(message) {
    this.errors.push(message);
    this.valid = false;
  }

  addWarning(message) {
    this.warnings.push(message);
  }

  merge(other) {
    this.errors.push(...other.errors);
    this.warnings.push(...other.warnings);
    this.valid = this.valid && other.valid;
    return this;
  }
}

/**
 * Configuration Entry
 */
class ConfigEntry {
  constructor(type, data, metadata = {}) {
    this.type = type;
    this.data = data;
    this.metadata = {
      version: '1.0.0',
      loadedAt: Date.now(),
      lastModified: null,
      source: 'unknown',
      ...metadata
    };
    this.state = ConfigState.LOADED;
    this.validationResult = null;
    this.watchers = [];
  }

  updateData(newData, source = 'unknown') {
    this.data = { ...this.data, ...newData };
    this.metadata.lastModified = Date.now();
    this.metadata.source = source;
    this.state = ConfigState.LOADED;
  }

  setState(state, error = null) {
    this.state = state;
    if (error) {
      this.error = error;
    }
  }
}

/**
 * Comprehensive Configuration Management System
 */
export class ConfigManager {
  constructor(config = {}) {
    // Configuration with defaults
    this.config = {
      configDirectory: 'data/config',
      schemaDirectory: 'data/config/schemas',
      enableValidation: true,
      enableHotReload: process.env.NODE_ENV === 'development',
      enableCache: true,
      cacheSize: 50,
      autoLoad: true,
      validateOnLoad: true,
      watchFileChanges: true,
      reloadDelay: 500, // Debounce file changes
      maxRetryAttempts: 3,
      ...config
    };

    // Configuration registry
    this.configurations = new Map();
    this.schemas = new Map();
    
    // LRU Cache for processed configurations
    if (this.config.enableCache) {
      this.cache = new LRUCache(this.config.cacheSize, {
        onEvict: this.handleCacheEviction.bind(this)
      });
    }

    // File watchers for hot reload
    this.fileWatchers = new Map();
    this.watchDebounceTimers = new Map();
    
    // Event system for configuration changes
    this.eventListeners = new Map();
    
    // Statistics and metrics
    this.stats = {
      configurationsLoaded: 0,
      validationErrors: 0,
      hotReloads: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageLoadTimeMs: 0,
      totalLoadTimeMs: 0
    };

    // Default configurations (fallbacks)
    this.defaults = new Map();

    console.log('[ConfigManager] Initialized with config:', this.config);

    if (this.config.autoLoad) {
      this.loadDefaultConfigurations();
    }

    if (this.config.enableHotReload && this.config.watchFileChanges) {
      this.setupFileWatching();
    }
  }

  /**
   * Load all default configurations
   */
  async loadDefaultConfigurations() {
    const defaultConfigs = [
      ConfigType.GAME_SETTINGS,
      ConfigType.PLAYER_PREFERENCES,
      ConfigType.TRACK_CONFIGURATIONS,
      ConfigType.POWER_UP_DEFINITIONS
    ];

    console.log('[ConfigManager] Loading default configurations...');
    
    const loadPromises = defaultConfigs.map(configType => 
      this.loadConfiguration(configType).catch(error => {
        console.warn(`[ConfigManager] Failed to load ${configType}:`, error.message);
        return null;
      })
    );

    try {
      const results = await Promise.allSettled(loadPromises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
      const failed = results.filter(r => r.status === 'rejected' || !r.value).length;
      
      console.log(`[ConfigManager] Default configurations loaded: ${successful} successful, ${failed} failed`);
    } catch (error) {
      console.error('[ConfigManager] Error loading default configurations:', error);
    }
  }

  /**
   * Load a specific configuration
   */
  async loadConfiguration(configType, options = {}) {
    const loadOptions = {
      validate: this.config.validateOnLoad,
      useCache: this.config.enableCache,
      enableHotReload: this.config.enableHotReload,
      retryAttempts: this.config.maxRetryAttempts,
      ...options
    };

    // Check cache first
    const cacheKey = `${configType}_${JSON.stringify(loadOptions)}`;
    if (loadOptions.useCache && this.cache && this.cache.has(cacheKey)) {
      this.stats.cacheHits++;
      const cachedEntry = this.cache.get(cacheKey);
      this.configurations.set(configType, cachedEntry);
      this.emitEvent('configurationLoaded', { type: configType, source: 'cache' });
      return cachedEntry.data;
    }

    this.stats.cacheMisses++;
    const startTime = Date.now();

    try {
      // Load configuration file
      const configPath = this.getConfigurationPath(configType);
      const rawData = await this.loadConfigurationFile(configPath);
      
      // Create configuration entry
      const configEntry = new ConfigEntry(configType, rawData, {
        source: configPath,
        loadedAt: Date.now()
      });

      configEntry.setState(ConfigState.LOADED);

      // Validate if requested
      if (loadOptions.validate) {
        configEntry.setState(ConfigState.VALIDATING);
        const validationResult = await this.validateConfiguration(configType, rawData);
        configEntry.validationResult = validationResult;
        
        if (!validationResult.valid) {
          const errorMsg = `Configuration validation failed: ${validationResult.errors.join(', ')}`;
          configEntry.setState(ConfigState.ERROR, errorMsg);
          this.stats.validationErrors++;
          throw new Error(errorMsg);
        }
        
        configEntry.setState(ConfigState.VALIDATED);
      }

      // Store in registry
      this.configurations.set(configType, configEntry);
      
      // Cache if enabled
      if (loadOptions.useCache && this.cache) {
        this.cache.set(cacheKey, configEntry);
      }

      // Setup hot reload watching
      if (loadOptions.enableHotReload) {
        this.watchConfiguration(configType, configPath);
      }

      // Update statistics
      const loadTime = Date.now() - startTime;
      this.stats.configurationsLoaded++;
      this.stats.totalLoadTimeMs += loadTime;
      this.stats.averageLoadTimeMs = this.stats.totalLoadTimeMs / this.stats.configurationsLoaded;

      console.log(`[ConfigManager] Loaded configuration '${configType}' in ${loadTime}ms`);

      // Emit event
      this.emitEvent('configurationLoaded', { 
        type: configType, 
        source: 'file',
        loadTime,
        validated: loadOptions.validate
      });

      return configEntry.data;

    } catch (error) {
      console.error(`[ConfigManager] Failed to load configuration '${configType}':`, error);
      
      // Try fallback to default
      const defaultConfig = this.getDefaultConfiguration(configType);
      if (defaultConfig) {
        console.warn(`[ConfigManager] Using default configuration for '${configType}'`);
        return defaultConfig;
      }
      
      throw error;
    }
  }

  /**
   * Load configuration file
   */
  async loadConfigurationFile(path) {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      throw new Error(`Failed to load configuration file: ${path} - ${error.message}`);
    }
  }

  /**
   * Validate configuration against schema
   */
  async validateConfiguration(configType, configData) {
    if (!this.config.enableValidation) {
      return new ValidationResult(true);
    }

    try {
      // Load schema if not cached
      let schema = this.schemas.get(configType);
      if (!schema) {
        schema = await this.loadSchema(configType);
        this.schemas.set(configType, schema);
      }

      // Perform validation using JSON Schema
      const validationResult = this.validateAgainstSchema(configData, schema);
      
      // Additional custom validations
      this.performCustomValidations(configType, configData, validationResult);
      
      return validationResult;
      
    } catch (error) {
      console.error(`[ConfigManager] Schema validation error for '${configType}':`, error);
      const result = new ValidationResult(false);
      result.addError(`Schema validation failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Load JSON schema for configuration type
   */
  async loadSchema(configType) {
    const schemaPath = `${this.config.schemaDirectory}/${configType}.schema.json`;
    
    try {
      const response = await fetch(schemaPath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const schema = await response.json();
      console.log(`[ConfigManager] Loaded schema for '${configType}'`);
      return schema;
    } catch (error) {
      console.warn(`[ConfigManager] Could not load schema for '${configType}':`, error.message);
      return null; // Schema is optional
    }
  }

  /**
   * Validate data against JSON schema
   */
  validateAgainstSchema(data, schema) {
    const result = new ValidationResult(true);
    
    if (!schema) {
      result.addWarning('No schema available for validation');
      return result;
    }

    // Basic JSON Schema validation (simplified - in production use ajv or similar)
    try {
      this.validateSchemaProperties(data, schema, '', result);
    } catch (error) {
      result.addError(`Schema validation error: ${error.message}`);
    }

    return result;
  }

  /**
   * Validate schema properties recursively
   */
  validateSchemaProperties(data, schema, path, result) {
    // Required properties check
    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in data)) {
          result.addError(`Missing required property: ${path}${requiredProp}`);
        }
      }
    }

    // Type validation
    if (schema.type && typeof data !== schema.type && schema.type !== 'object' && schema.type !== 'array') {
      if (!(schema.type === 'integer' && Number.isInteger(data))) {
        result.addError(`Invalid type for ${path}: expected ${schema.type}, got ${typeof data}`);
      }
    }

    // Range validation for numbers
    if (typeof data === 'number') {
      if (schema.minimum !== undefined && data < schema.minimum) {
        result.addError(`Value ${data} at ${path} is below minimum ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && data > schema.maximum) {
        result.addError(`Value ${data} at ${path} is above maximum ${schema.maximum}`);
      }
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(data)) {
      result.addError(`Value ${data} at ${path} is not one of allowed values: ${schema.enum.join(', ')}`);
    }

    // Pattern validation for strings
    if (typeof data === 'string' && schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(data)) {
        result.addError(`String ${data} at ${path} does not match pattern ${schema.pattern}`);
      }
    }

    // Recursive validation for objects
    if (schema.type === 'object' && schema.properties && typeof data === 'object') {
      for (const [prop, propSchema] of Object.entries(schema.properties)) {
        if (prop in data) {
          this.validateSchemaProperties(data[prop], propSchema, `${path}${prop}.`, result);
        }
      }
    }
  }

  /**
   * Perform custom validations specific to each configuration type
   */
  performCustomValidations(configType, configData, result) {
    switch (configType) {
      case ConfigType.GAME_SETTINGS:
        this.validateGameSettings(configData, result);
        break;
      case ConfigType.TRACK_CONFIGURATIONS:
        this.validateTrackConfigurations(configData, result);
        break;
      case ConfigType.POWER_UP_DEFINITIONS:
        this.validatePowerUpDefinitions(configData, result);
        break;
      // Add more custom validations as needed
    }
  }

  /**
   * Custom validation for game settings
   */
  validateGameSettings(config, result) {
    // Validate physics consistency
    if (config.movement?.maxSpeed <= config.movement?.baseSpeed) {
      result.addError('maxSpeed must be greater than baseSpeed');
    }
    
    // Validate performance targets
    if (config.performance?.targetFPS < 30) {
      result.addWarning('targetFPS below 30 may result in poor gameplay experience');
    }
    
    // Validate randomization settings
    if (config.randomization?.biorhythmCycles) {
      const cycles = config.randomization.biorhythmCycles;
      if (cycles.short?.max >= cycles.medium?.min) {
        result.addWarning('Biorhythm cycle ranges may overlap');
      }
    }
  }

  /**
   * Custom validation for track configurations
   */
  validateTrackConfigurations(config, result) {
    if (config.tracks) {
      for (const [trackId, track] of Object.entries(config.tracks)) {
        // Validate spawn areas
        if (!track.startingAreas || track.startingAreas.length === 0) {
          result.addError(`Track ${trackId} must have at least one starting area`);
        }
        
        if (!track.tokenSpawnAreas || track.tokenSpawnAreas.length === 0) {
          result.addError(`Track ${trackId} must have at least one token spawn area`);
        }
        
        // Validate dimensions
        if (track.dimensions) {
          if (track.dimensions.width < 1000 || track.dimensions.height < 500) {
            result.addWarning(`Track ${trackId} dimensions may be too small for optimal gameplay`);
          }
        }
      }
    }
  }

  /**
   * Custom validation for power-up definitions
   */
  validatePowerUpDefinitions(config, result) {
    // Validate spawn weights sum to reasonable values
    if (config.spawning?.rarityWeights) {
      const weights = config.spawning.rarityWeights;
      const totalWeight = weights.common + weights.uncommon + weights.rare + weights.legendary;
      if (Math.abs(totalWeight - 1.0) > 0.01) {
        result.addWarning(`Rarity weights sum to ${totalWeight}, should sum to 1.0`);
      }
    }
    
    // Validate booster effects
    if (config.boosters) {
      for (const [boosterId, booster] of Object.entries(config.boosters)) {
        if (booster.effects?.speedMultiplier > 5) {
          result.addWarning(`Booster ${boosterId} has very high speed multiplier (${booster.effects.speedMultiplier})`);
        }
        
        if (booster.effects?.duration < 1000) {
          result.addWarning(`Booster ${boosterId} has very short duration (${booster.effects.duration}ms)`);
        }
      }
    }
  }

  /**
   * Get configuration data
   */
  getConfiguration(configType) {
    const entry = this.configurations.get(configType);
    if (entry && entry.state === ConfigState.VALIDATED || entry.state === ConfigState.LOADED) {
      return entry.data;
    }
    
    // Return default if available
    const defaultConfig = this.getDefaultConfiguration(configType);
    if (defaultConfig) {
      console.warn(`[ConfigManager] Using default configuration for '${configType}'`);
      return defaultConfig;
    }
    
    console.error(`[ConfigManager] Configuration not found: ${configType}`);
    return null;
  }

  /**
   * Get configuration value with path notation (e.g., 'game.maxPlayers')
   */
  getConfigValue(configType, path, defaultValue = null) {
    const config = this.getConfiguration(configType);
    if (!config) return defaultValue;
    
    return this.getNestedValue(config, path, defaultValue);
  }

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path, defaultValue = null) {
    return path.split('.').reduce((current, key) => {
      return (current && current[key] !== undefined) ? current[key] : defaultValue;
    }, obj);
  }

  /**
   * Update configuration data
   */
  async updateConfiguration(configType, updates, options = {}) {
    const updateOptions = {
      validate: true,
      persist: false,
      merge: true,
      ...options
    };

    try {
      const entry = this.configurations.get(configType);
      if (!entry) {
        throw new Error(`Configuration not found: ${configType}`);
      }

      // Merge or replace data
      const newData = updateOptions.merge ? 
        this.deepMerge(entry.data, updates) : 
        updates;

      // Validate if requested
      if (updateOptions.validate) {
        const validationResult = await this.validateConfiguration(configType, newData);
        if (!validationResult.valid) {
          throw new Error(`Update validation failed: ${validationResult.errors.join(', ')}`);
        }
      }

      // Update entry
      entry.updateData(newData, 'runtime_update');
      
      // Clear cache for this configuration
      if (this.cache) {
        const cacheKeys = Array.from(this.cache.keys()).filter(key => 
          key.startsWith(`${configType}_`)
        );
        cacheKeys.forEach(key => this.cache.delete(key));
      }

      // Persist to file if requested
      if (updateOptions.persist) {
        await this.persistConfiguration(configType, newData);
      }

      console.log(`[ConfigManager] Updated configuration '${configType}'`);

      // Emit event
      this.emitEvent('configurationUpdated', { 
        type: configType, 
        updates,
        persisted: updateOptions.persist
      });

      return newData;

    } catch (error) {
      console.error(`[ConfigManager] Failed to update configuration '${configType}':`, error);
      throw error;
    }
  }

  /**
   * Deep merge two objects
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.deepMerge(target[key] || {}, value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Persist configuration to file
   */
  async persistConfiguration(configType, data) {
    // In a real implementation, this would write to the file system
    // For now, we'll just log the operation
    console.log(`[ConfigManager] Would persist configuration ${configType} to file`);
    
    // This would typically involve:
    // 1. Format the data as pretty JSON
    // 2. Write to the appropriate file path
    // 3. Update file watchers if necessary
    
    return true;
  }

  /**
   * Setup file watching for hot reload
   */
  setupFileWatching() {
    console.log('[ConfigManager] File watching enabled for hot reload');
    
    // In a real implementation, this would use fs.watch or chokidar
    // For now, we simulate file watching behavior
    
    if (typeof window !== 'undefined' && window.addEventListener) {
      // Setup visibility change listener as a proxy for file changes
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.checkForConfigurationChanges();
        }
      });
    }
  }

  /**
   * Watch specific configuration for changes
   */
  watchConfiguration(configType, filePath) {
    if (!this.config.enableHotReload) return;
    
    console.log(`[ConfigManager] Watching configuration '${configType}' at ${filePath}`);
    
    // Store watcher info
    this.fileWatchers.set(configType, {
      filePath,
      lastModified: Date.now(),
      debounceTimer: null
    });
  }

  /**
   * Check for configuration file changes
   */
  async checkForConfigurationChanges() {
    if (!this.config.enableHotReload) return;
    
    for (const [configType, watchInfo] of this.fileWatchers) {
      try {
        // In a real implementation, this would check file modification time
        // For demonstration, we'll randomly trigger hot reload
        if (Math.random() < 0.1) { // 10% chance
          await this.handleConfigurationChange(configType, watchInfo.filePath);
        }
      } catch (error) {
        console.error(`[ConfigManager] Error checking file changes for ${configType}:`, error);
      }
    }
  }

  /**
   * Handle configuration file change
   */
  async handleConfigurationChange(configType, filePath) {
    // Debounce rapid file changes
    const existingTimer = this.watchDebounceTimers.get(configType);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const debounceTimer = setTimeout(async () => {
      try {
        console.log(`[ConfigManager] Hot reloading configuration '${configType}'`);
        
        const entry = this.configurations.get(configType);
        if (entry) {
          entry.setState(ConfigState.HOT_RELOADING);
        }

        // Reload configuration
        await this.loadConfiguration(configType, { 
          useCache: false,
          validate: true 
        });

        this.stats.hotReloads++;
        console.log(`[ConfigManager] Hot reload completed for '${configType}'`);

        // Emit hot reload event
        this.emitEvent('configurationHotReloaded', { 
          type: configType,
          filePath
        });

      } catch (error) {
        console.error(`[ConfigManager] Hot reload failed for '${configType}':`, error);
        
        if (entry) {
          entry.setState(ConfigState.ERROR, error.message);
        }
      }
      
      this.watchDebounceTimers.delete(configType);
    }, this.config.reloadDelay);

    this.watchDebounceTimers.set(configType, debounceTimer);
  }

  /**
   * Get configuration file path
   */
  getConfigurationPath(configType) {
    return `${this.config.configDirectory}/${configType}.json`;
  }

  /**
   * Get default configuration
   */
  getDefaultConfiguration(configType) {
    return this.defaults.get(configType) || null;
  }

  /**
   * Set default configuration
   */
  setDefaultConfiguration(configType, defaultConfig) {
    this.defaults.set(configType, defaultConfig);
  }

  /**
   * Event system methods
   */
  addEventListener(eventType, listener) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType).push(listener);
  }

  removeEventListener(eventType, listener) {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emitEvent(eventType, data) {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`[ConfigManager] Event listener error for '${eventType}':`, error);
        }
      });
    }
  }

  /**
   * Handle cache eviction
   */
  handleCacheEviction(key, configEntry) {
    console.log(`[ConfigManager] Evicting configuration from cache: ${key}`);
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    return {
      ...this.stats,
      configurationsInMemory: this.configurations.size,
      schemasLoaded: this.schemas.size,
      watchedFiles: this.fileWatchers.size,
      cacheSize: this.cache ? this.cache.size : 0,
      eventListeners: Array.from(this.eventListeners.entries()).reduce((acc, [type, listeners]) => {
        acc[type] = listeners.length;
        return acc;
      }, {})
    };
  }

  /**
   * Reload all configurations
   */
  async reloadAllConfigurations() {
    console.log('[ConfigManager] Reloading all configurations...');
    
    const configTypes = Array.from(this.configurations.keys());
    const reloadPromises = configTypes.map(configType =>
      this.loadConfiguration(configType, { useCache: false, validate: true })
        .catch(error => {
          console.error(`[ConfigManager] Failed to reload ${configType}:`, error);
          return null;
        })
    );

    const results = await Promise.allSettled(reloadPromises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value).length;

    console.log(`[ConfigManager] Reload completed: ${successful} successful, ${failed} failed`);
    
    this.emitEvent('allConfigurationsReloaded', { successful, failed });
    
    return { successful, failed };
  }

  /**
   * Clear all cached configurations
   */
  clearCache() {
    if (this.cache) {
      this.cache.clear();
      console.log('[ConfigManager] Configuration cache cleared');
    }
  }

  /**
   * Destroy config manager
   */
  destroy() {
    // Clear all timers
    for (const timer of this.watchDebounceTimers.values()) {
      clearTimeout(timer);
    }
    this.watchDebounceTimers.clear();

    // Clear caches and references
    this.configurations.clear();
    this.schemas.clear();
    this.fileWatchers.clear();
    this.eventListeners.clear();
    this.defaults.clear();
    
    if (this.cache) {
      this.cache.clear();
    }

    console.log('[ConfigManager] Configuration manager destroyed');
  }
}

export default ConfigManager;