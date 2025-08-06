/**
 * ConfigManager.test.js - Comprehensive tests for Configuration Management System
 * 
 * Tests all aspects of the ConfigManager including:
 * - Configuration loading and validation
 * - Hot-reload functionality
 * - Schema validation
 * - Event system
 * - Cache management
 * - Error handling
 */

import { ConfigManager, ConfigType, ConfigState, ValidationResult } from '../../src/game/systems/ConfigManager';

// Mock fetch for testing
global.fetch = jest.fn();

// Mock LRUCache
jest.mock('../../src/utils/LRUCache', () => ({
  LRUCache: jest.fn().mockImplementation((size, options) => ({
    has: jest.fn().mockReturnValue(false),
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    size: 0,
    keys: jest.fn().mockReturnValue([]),
    entries: jest.fn().mockReturnValue([])
  }))
}));

describe('ConfigManager', () => {
  let configManager;
  let mockConfig;

  beforeEach(() => {
    // Reset fetch mock
    fetch.mockClear();
    
    // Mock successful configuration
    mockConfig = {
      version: '1.0.0',
      game: {
        maxPlayers: 6,
        raceTimeLimit: 300
      },
      physics: {
        gravity: 0,
        friction: 0.8
      }
    };

    configManager = new ConfigManager({
      enableHotReload: false,
      enableValidation: false,
      autoLoad: false
    });
  });

  afterEach(() => {
    configManager.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(configManager.config.configDirectory).toBe('data/config');
      expect(configManager.config.enableValidation).toBe(false);
      expect(configManager.configurations).toBeInstanceOf(Map);
      expect(configManager.schemas).toBeInstanceOf(Map);
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        configDirectory: 'custom/config',
        enableValidation: true,
        cacheSize: 100
      };

      const manager = new ConfigManager(customConfig);
      expect(manager.config.configDirectory).toBe('custom/config');
      expect(manager.config.enableValidation).toBe(true);
      expect(manager.config.cacheSize).toBe(100);
      
      manager.destroy();
    });
  });

  describe('Configuration Loading', () => {
    it('should load configuration successfully', async () => {
      // Mock successful fetch
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConfig)
      });

      const result = await configManager.loadConfiguration(ConfigType.GAME_SETTINGS);
      
      expect(fetch).toHaveBeenCalledWith('data/config/game-settings.json');
      expect(result).toEqual(mockConfig);
      expect(configManager.configurations.has(ConfigType.GAME_SETTINGS)).toBe(true);
    });

    it('should handle network errors gracefully', async () => {
      // Mock network error
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        configManager.loadConfiguration(ConfigType.GAME_SETTINGS)
      ).rejects.toThrow('Failed to load configuration');
    });

    it('should handle HTTP errors', async () => {
      // Mock 404 error
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(
        configManager.loadConfiguration(ConfigType.GAME_SETTINGS)
      ).rejects.toThrow('HTTP 404: Not Found');
    });

    it('should handle invalid JSON', async () => {
      // Mock invalid JSON response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      await expect(
        configManager.loadConfiguration(ConfigType.GAME_SETTINGS)
      ).rejects.toThrow('Failed to load configuration file');
    });
  });

  describe('Configuration Retrieval', () => {
    beforeEach(async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConfig)
      });
      await configManager.loadConfiguration(ConfigType.GAME_SETTINGS);
    });

    it('should retrieve loaded configuration', () => {
      const config = configManager.getConfiguration(ConfigType.GAME_SETTINGS);
      expect(config).toEqual(mockConfig);
    });

    it('should return null for non-existent configuration', () => {
      const config = configManager.getConfiguration('non-existent');
      expect(config).toBeNull();
    });

    it('should retrieve nested configuration values', () => {
      const maxPlayers = configManager.getConfigValue(
        ConfigType.GAME_SETTINGS, 
        'game.maxPlayers'
      );
      expect(maxPlayers).toBe(6);
    });

    it('should return default value for non-existent path', () => {
      const value = configManager.getConfigValue(
        ConfigType.GAME_SETTINGS,
        'non.existent.path',
        'default'
      );
      expect(value).toBe('default');
    });
  });

  describe('Schema Validation', () => {
    let validationManager;

    beforeEach(() => {
      validationManager = new ConfigManager({
        enableValidation: true,
        autoLoad: false
      });
    });

    afterEach(() => {
      validationManager.destroy();
    });

    it('should validate configuration against schema', async () => {
      const mockSchema = {
        type: 'object',
        required: ['version', 'game'],
        properties: {
          version: { type: 'string' },
          game: {
            type: 'object',
            required: ['maxPlayers'],
            properties: {
              maxPlayers: { type: 'integer', minimum: 1, maximum: 10 }
            }
          }
        }
      };

      // Mock schema loading
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockConfig)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSchema)
        });

      const result = await validationManager.loadConfiguration(ConfigType.GAME_SETTINGS);
      expect(result).toEqual(mockConfig);
    });

    it('should reject invalid configuration', async () => {
      const invalidConfig = {
        version: '1.0.0',
        // Missing required 'game' property
      };

      const mockSchema = {
        type: 'object',
        required: ['version', 'game']
      };

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(invalidConfig)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSchema)
        });

      await expect(
        validationManager.loadConfiguration(ConfigType.GAME_SETTINGS)
      ).rejects.toThrow('Configuration validation failed');
    });
  });

  describe('Custom Validations', () => {
    let validationManager;

    beforeEach(() => {
      validationManager = new ConfigManager({
        enableValidation: true,
        autoLoad: false
      });
    });

    afterEach(() => {
      validationManager.destroy();
    });

    it('should perform custom game settings validation', () => {
      const result = new ValidationResult(true);
      const invalidConfig = {
        movement: {
          baseSpeed: 100,
          maxSpeed: 50 // Invalid: maxSpeed < baseSpeed
        }
      };

      validationManager.validateGameSettings(invalidConfig, result);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('maxSpeed must be greater than baseSpeed');
    });

    it('should validate track configurations', () => {
      const result = new ValidationResult(true);
      const invalidTrackConfig = {
        tracks: {
          testTrack: {
            // Missing required startingAreas
            tokenSpawnAreas: []
          }
        }
      };

      validationManager.validateTrackConfigurations(invalidTrackConfig, result);
      expect(result.valid).toBe(false);
      expect(result.errors.some(err => err.includes('starting area'))).toBe(true);
    });

    it('should validate power-up definitions', () => {
      const result = new ValidationResult(true);
      const config = {
        spawning: {
          rarityWeights: {
            common: 0.5,
            uncommon: 0.3,
            rare: 0.1,
            legendary: 0.05 // Sum = 0.95, should warn
          }
        }
      };

      validationManager.validatePowerUpDefinitions(config, result);
      expect(result.warnings.some(warn => warn.includes('Rarity weights sum'))).toBe(true);
    });
  });

  describe('Configuration Updates', () => {
    beforeEach(async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConfig)
      });
      await configManager.loadConfiguration(ConfigType.GAME_SETTINGS);
    });

    it('should update configuration with merge', async () => {
      const updates = {
        game: {
          maxPlayers: 8,
          newProperty: 'test'
        }
      };

      const result = await configManager.updateConfiguration(
        ConfigType.GAME_SETTINGS,
        updates,
        { validate: false, merge: true }
      );

      expect(result.game.maxPlayers).toBe(8);
      expect(result.game.raceTimeLimit).toBe(300); // Preserved from original
      expect(result.game.newProperty).toBe('test');
    });

    it('should replace configuration without merge', async () => {
      const replacement = {
        version: '2.0.0',
        game: {
          maxPlayers: 4
        }
      };

      const result = await configManager.updateConfiguration(
        ConfigType.GAME_SETTINGS,
        replacement,
        { validate: false, merge: false }
      );

      expect(result).toEqual(replacement);
      expect(result.physics).toBeUndefined(); // Original data lost
    });

    it('should emit update event', async () => {
      const eventListener = jest.fn();
      configManager.addEventListener('configurationUpdated', eventListener);

      const updates = { game: { maxPlayers: 8 } };
      await configManager.updateConfiguration(
        ConfigType.GAME_SETTINGS,
        updates,
        { validate: false }
      );

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ConfigType.GAME_SETTINGS,
          updates
        })
      );
    });
  });

  describe('Event System', () => {
    it('should add and remove event listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      configManager.addEventListener('test-event', listener1);
      configManager.addEventListener('test-event', listener2);

      configManager.emitEvent('test-event', { data: 'test' });

      expect(listener1).toHaveBeenCalledWith({ data: 'test' });
      expect(listener2).toHaveBeenCalledWith({ data: 'test' });

      configManager.removeEventListener('test-event', listener1);
      configManager.emitEvent('test-event', { data: 'test2' });

      expect(listener1).toHaveBeenCalledTimes(1); // Not called again
      expect(listener2).toHaveBeenCalledTimes(2); // Called again
    });

    it('should handle event listener errors gracefully', () => {
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const normalListener = jest.fn();

      configManager.addEventListener('test-event', errorListener);
      configManager.addEventListener('test-event', normalListener);

      // Should not throw, should continue to other listeners
      expect(() => {
        configManager.emitEvent('test-event', {});
      }).not.toThrow();

      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe('Hot Reload', () => {
    let hotReloadManager;

    beforeEach(() => {
      hotReloadManager = new ConfigManager({
        enableHotReload: true,
        autoLoad: false,
        watchFileChanges: false // Disable actual file watching for tests
      });
    });

    afterEach(() => {
      hotReloadManager.destroy();
    });

    it('should setup file watching when enabled', () => {
      expect(hotReloadManager.config.enableHotReload).toBe(true);
      expect(hotReloadManager.fileWatchers).toBeInstanceOf(Map);
    });

    it('should handle hot reload events', async () => {
      // Setup initial configuration
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConfig)
      });
      await hotReloadManager.loadConfiguration(ConfigType.GAME_SETTINGS);

      const hotReloadListener = jest.fn();
      hotReloadManager.addEventListener('configurationHotReloaded', hotReloadListener);

      // Simulate hot reload
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ...mockConfig,
          game: { ...mockConfig.game, maxPlayers: 8 }
        })
      });

      await hotReloadManager.handleConfigurationChange(
        ConfigType.GAME_SETTINGS,
        'data/config/game-settings.json'
      );

      // Allow debounce to complete
      await new Promise(resolve => setTimeout(resolve, 600));

      expect(hotReloadListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ConfigType.GAME_SETTINGS
        })
      );
    });
  });

  describe('Statistics and Metrics', () => {
    it('should track loading statistics', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConfig)
      });

      await configManager.loadConfiguration(ConfigType.GAME_SETTINGS);

      const stats = configManager.getStats();
      expect(stats.configurationsLoaded).toBe(1);
      expect(stats.cacheMisses).toBe(1);
      expect(stats.averageLoadTimeMs).toBeGreaterThan(0);
    });

    it('should track validation errors', async () => {
      const validationManager = new ConfigManager({
        enableValidation: true,
        autoLoad: false
      });

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ invalid: 'config' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            type: 'object',
            required: ['version']
          })
        });

      try {
        await validationManager.loadConfiguration(ConfigType.GAME_SETTINGS);
      } catch (error) {
        // Expected to fail
      }

      const stats = validationManager.getStats();
      expect(stats.validationErrors).toBe(1);
      
      validationManager.destroy();
    });
  });

  describe('Cache Management', () => {
    it('should use cache when enabled', async () => {
      const cacheManager = new ConfigManager({
        enableCache: true,
        autoLoad: false
      });

      // Mock cache hit
      cacheManager.cache.has.mockReturnValue(true);
      cacheManager.cache.get.mockReturnValue({
        data: mockConfig,
        state: ConfigState.LOADED
      });

      const result = await cacheManager.loadConfiguration(ConfigType.GAME_SETTINGS);
      
      expect(result).toEqual(mockConfig);
      expect(fetch).not.toHaveBeenCalled(); // Should not fetch if cached
      
      cacheManager.destroy();
    });

    it('should clear cache when requested', () => {
      configManager.cache = {
        clear: jest.fn()
      };

      configManager.clearCache();
      expect(configManager.cache.clear).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing configuration gracefully', () => {
      const config = configManager.getConfiguration('non-existent');
      expect(config).toBeNull();
    });

    it('should provide fallback values for missing config paths', () => {
      const value = configManager.getConfigValue(
        'non-existent',
        'some.path',
        'fallback'
      );
      expect(value).toBe('fallback');
    });

    it('should handle configuration loading retries', async () => {
      const retryManager = new ConfigManager({
        maxRetryAttempts: 3,
        autoLoad: false
      });

      // Mock failing then succeeding
      fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockConfig)
        });

      const result = await retryManager.loadConfiguration(ConfigType.GAME_SETTINGS);
      expect(result).toEqual(mockConfig);
      expect(fetch).toHaveBeenCalledTimes(3);
      
      retryManager.destroy();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources on destroy', () => {
      const manager = new ConfigManager();
      
      // Add some data
      manager.configurations.set('test', {});
      manager.schemas.set('test', {});
      
      manager.destroy();
      
      expect(manager.configurations.size).toBe(0);
      expect(manager.schemas.size).toBe(0);
    });

    it('should clear debounce timers on destroy', () => {
      const manager = new ConfigManager({ enableHotReload: true });
      
      // Add a mock timer
      const mockTimer = setTimeout(() => {}, 1000);
      manager.watchDebounceTimers.set('test', mockTimer);
      
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      manager.destroy();
      
      expect(clearTimeoutSpy).toHaveBeenCalledWith(mockTimer);
      expect(manager.watchDebounceTimers.size).toBe(0);
      
      clearTimeoutSpy.mockRestore();
    });
  });
});

describe('ValidationResult', () => {
  it('should create valid result by default', () => {
    const result = new ValidationResult(true);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('should add errors and invalidate result', () => {
    const result = new ValidationResult(true);
    result.addError('Test error');
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Test error');
  });

  it('should add warnings without invalidating result', () => {
    const result = new ValidationResult(true);
    result.addWarning('Test warning');
    
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('Test warning');
  });

  it('should merge multiple validation results', () => {
    const result1 = new ValidationResult(true);
    result1.addWarning('Warning 1');
    
    const result2 = new ValidationResult(false);
    result2.addError('Error 1');
    result2.addWarning('Warning 2');
    
    result1.merge(result2);
    
    expect(result1.valid).toBe(false);
    expect(result1.errors).toContain('Error 1');
    expect(result1.warnings).toContain('Warning 1');
    expect(result1.warnings).toContain('Warning 2');
  });
});