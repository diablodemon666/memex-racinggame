/**
 * GameEngine.test.js - Comprehensive Unit Tests
 * 
 * Tests the core GameEngine functionality using TDD methodology
 * Covers initialization, scene management, resource cleanup, and configuration
 */

// Mock all Phaser.js dependencies
jest.mock('phaser', () => ({
  AUTO: 'AUTO',
  Scale: { 
    FIT: 'FIT', 
    CENTER_BOTH: 'CENTER_BOTH',
    RESIZE: 'RESIZE'
  },
  Game: jest.fn().mockImplementation((config) => ({
    config,
    scene: {
      add: jest.fn(),
      remove: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      get: jest.fn(),
      scenes: []
    },
    sound: {
      add: jest.fn(),
      play: jest.fn(),
      stop: jest.fn()
    },
    scale: {
      resize: jest.fn(),
      setGameSize: jest.fn()
    },
    canvas: document.createElement('canvas'),
    destroy: jest.fn(),
    isBooted: true,
    isRunning: false
  })),
  Math: { 
    Distance: { Between: jest.fn(() => 10) },
    Angle: { Between: jest.fn(() => 0) }
  }
}));

// Mock GameEngine dependencies
jest.mock('../../../src/game/engine/PhysicsManager', () => ({
  PhysicsManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(),
    update: jest.fn(),
    cleanup: jest.fn(),
    setTrackTemplateManager: jest.fn(),
    enableDebugMode: jest.fn(),
    disableDebugMode: jest.fn()
  }))
}));

jest.mock('../../../src/game/engine/RenderManager', () => ({
  RenderManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(),
    initializeScene: jest.fn(),
    update: jest.fn(),
    cleanup: jest.fn(),
    preloadAssets: jest.fn().mockResolvedValue(),
    loadCustomPlayerImages: jest.fn().mockResolvedValue(),
    createUI: jest.fn(),
    setDebugMode: jest.fn()
  }))
}));

jest.mock('../../../src/game/systems/ConfigManager', () => ({
  ConfigManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(),
    addEventListener: jest.fn(),
    loadConfiguration: jest.fn().mockResolvedValue({}),
    getConfiguration: jest.fn(() => ({})),
    getConfigValue: jest.fn(() => null),
    destroy: jest.fn()
  })),
  ConfigType: { 
    GAME_SETTINGS: 'game-settings',
    VISUAL_SETTINGS: 'visual-settings',
    AUDIO_SETTINGS: 'audio-settings'
  }
}));

jest.mock('../../../src/game/systems/CameraManager', () => ({
  CameraManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    update: jest.fn(),
    setTarget: jest.fn(),
    destroy: jest.fn()
  }))
}));

jest.mock('../../../src/game/systems/AIPlayerManager', () => ({
  AIPlayerManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    checkAndFillSlots: jest.fn(() => []),
    update: jest.fn(),
    destroy: jest.fn()
  }))
}));

jest.mock('../../../src/game/systems/TrackTemplateManager', () => ({
  TrackTemplateManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(),
    generateTrack: jest.fn().mockResolvedValue({}),
    destroy: jest.fn()
  }))
}));

import { GameEngine } from '../../../src/game/engine/GameEngine';
import { DOMHelpers, AsyncHelpers, GameHelpers, ValidationHelpers } from '../../utils/test-helpers';

describe('GameEngine', () => {
  let gameEngine;
  let mockConfig;

  beforeEach(() => {
    // Setup clean DOM environment
    DOMHelpers.setupCleanDOM();
    DOMHelpers.createTestContainer('game-container');

    // Create default configuration
    mockConfig = {
      width: 800,
      height: 600,
      backgroundColor: '#000000',
      parent: 'game-container',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0 },
          debug: false
        }
      }
    };

    // Create GameEngine instance
    gameEngine = new GameEngine(mockConfig);
  });

  afterEach(() => {
    if (gameEngine) {
      gameEngine.destroy();
    }
    DOMHelpers.setupCleanDOM();
  });

  describe('Initialization', () => {
    it('should initialize with provided configuration', () => {
      expect(gameEngine.config).toEqual(mockConfig);
      expect(gameEngine.isInitialized).toBe(false);
      expect(gameEngine.isDestroyed).toBe(false);
    });

    it('should have required component interface', () => {
      ValidationHelpers.validateComponent(gameEngine, [
        'initialize', 'start', 'stop', 'update', 'resize'
      ]);
    });

    it('should create manager instances during construction', () => {
      expect(gameEngine.physicsManager).toBeDefined();
      expect(gameEngine.renderManager).toBeDefined();
      expect(gameEngine.configManager).toBeDefined();
      expect(gameEngine.cameraManager).toBeDefined();
      expect(gameEngine.aiPlayerManager).toBeDefined();
      expect(gameEngine.trackTemplateManager).toBeDefined();
    });

    it('should initialize all managers when initialize() is called', async () => {
      await gameEngine.initialize();

      expect(gameEngine.isInitialized).toBe(true);
      expect(gameEngine.configManager.initialize).toHaveBeenCalled();
      expect(gameEngine.physicsManager.initialize).toHaveBeenCalled();
      expect(gameEngine.renderManager.initialize).toHaveBeenCalled();
      expect(gameEngine.trackTemplateManager.initialize).toHaveBeenCalled();
    });

    it('should not initialize twice', async () => {
      await gameEngine.initialize();
      const configManagerSpy = gameEngine.configManager.initialize;
      
      await gameEngine.initialize();

      // Should only be called once
      expect(configManagerSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock an initialization error
      gameEngine.configManager.initialize.mockRejectedValue(new Error('Config load failed'));

      await expect(gameEngine.initialize()).rejects.toThrow('Config load failed');
      expect(gameEngine.isInitialized).toBe(false);
    });
  });

  describe('Phaser Game Management', () => {
    beforeEach(async () => {
      await gameEngine.initialize();
    });

    it('should create Phaser game instance when started', () => {
      gameEngine.start();

      expect(gameEngine.game).toBeDefined();
      expect(gameEngine.game.config).toMatchObject(mockConfig);
      expect(gameEngine.isRunning).toBe(true);
    });

    it('should not start if not initialized', () => {
      const uninitializedEngine = new GameEngine(mockConfig);
      
      expect(() => uninitializedEngine.start()).toThrow('GameEngine must be initialized before starting');
    });

    it('should stop Phaser game instance', async () => {
      gameEngine.start();
      
      gameEngine.stop();

      expect(gameEngine.game.destroy).toHaveBeenCalled();
      expect(gameEngine.isRunning).toBe(false);
      expect(gameEngine.game).toBeNull();
    });

    it('should handle stop when not running', () => {
      expect(() => gameEngine.stop()).not.toThrow();
    });
  });

  describe('Scene Management', () => {
    beforeEach(async () => {
      await gameEngine.initialize();
      gameEngine.start();
    });

    it('should add scene to game', () => {
      const mockScene = { key: 'testScene' };
      
      gameEngine.addScene(mockScene);

      expect(gameEngine.game.scene.add).toHaveBeenCalledWith('testScene', mockScene, false);
    });

    it('should start scene', () => {
      gameEngine.startScene('testScene');

      expect(gameEngine.game.scene.start).toHaveBeenCalledWith('testScene');
    });

    it('should stop scene', () => {
      gameEngine.stopScene('testScene');

      expect(gameEngine.game.scene.stop).toHaveBeenCalledWith('testScene');
    });

    it('should get scene reference', () => {
      const mockScene = { key: 'testScene' };
      gameEngine.game.scene.get.mockReturnValue(mockScene);
      
      const scene = gameEngine.getScene('testScene');

      expect(scene).toBe(mockScene);
      expect(gameEngine.game.scene.get).toHaveBeenCalledWith('testScene');
    });
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
      await gameEngine.initialize();
    });

    it('should get configuration values', () => {
      const mockValue = 'test-value';
      gameEngine.configManager.getConfigValue.mockReturnValue(mockValue);
      
      const value = gameEngine.getConfigValue('test.key');

      expect(value).toBe(mockValue);
      expect(gameEngine.configManager.getConfigValue).toHaveBeenCalledWith('test.key');
    });

    it('should load configuration', async () => {
      const configType = 'game-settings';
      const mockConfig = { setting1: 'value1' };
      gameEngine.configManager.loadConfiguration.mockResolvedValue(mockConfig);

      const config = await gameEngine.loadConfiguration(configType);

      expect(config).toBe(mockConfig);
      expect(gameEngine.configManager.loadConfiguration).toHaveBeenCalledWith(configType);
    });

    it('should handle configuration load errors', async () => {
      gameEngine.configManager.loadConfiguration.mockRejectedValue(new Error('Load failed'));

      await expect(gameEngine.loadConfiguration('invalid-config')).rejects.toThrow('Load failed');
    });
  });

  describe('Update Loop', () => {
    beforeEach(async () => {
      await gameEngine.initialize();
    });

    it('should update all managers', () => {
      const deltaTime = 16.67; // ~60fps
      
      gameEngine.update(deltaTime);

      expect(gameEngine.physicsManager.update).toHaveBeenCalledWith(deltaTime);
      expect(gameEngine.renderManager.update).toHaveBeenCalledWith(deltaTime);
      expect(gameEngine.cameraManager.update).toHaveBeenCalledWith(deltaTime);
      expect(gameEngine.aiPlayerManager.update).toHaveBeenCalledWith(deltaTime);
    });

    it('should handle update when not running', () => {
      expect(() => gameEngine.update(16.67)).not.toThrow();
    });

    it('should track performance metrics', () => {
      const startTime = gameEngine.lastUpdateTime;
      
      gameEngine.update(16.67);

      expect(gameEngine.lastUpdateTime).toBeGreaterThan(startTime);
    });
  });

  describe('Resize Handling', () => {
    beforeEach(async () => {
      await gameEngine.initialize();
      gameEngine.start();
    });

    it('should resize game and managers', () => {
      const newWidth = 1024;
      const newHeight = 768;
      
      gameEngine.resize(newWidth, newHeight);

      expect(gameEngine.game.scale.setGameSize).toHaveBeenCalledWith(newWidth, newHeight);
      expect(gameEngine.config.width).toBe(newWidth);
      expect(gameEngine.config.height).toBe(newHeight);
    });

    it('should handle resize when not running', () => {
      gameEngine.stop();
      
      expect(() => gameEngine.resize(1024, 768)).not.toThrow();
    });
  });

  describe('Debug Mode', () => {
    beforeEach(async () => {
      await gameEngine.initialize();
    });

    it('should enable debug mode on all managers', () => {
      gameEngine.enableDebugMode();

      expect(gameEngine.isDebugMode).toBe(true);
      expect(gameEngine.physicsManager.enableDebugMode).toHaveBeenCalled();
      expect(gameEngine.renderManager.setDebugMode).toHaveBeenCalledWith(true);
    });

    it('should disable debug mode on all managers', () => {
      gameEngine.enableDebugMode();
      gameEngine.disableDebugMode();

      expect(gameEngine.isDebugMode).toBe(false);
      expect(gameEngine.physicsManager.disableDebugMode).toHaveBeenCalled();
      expect(gameEngine.renderManager.setDebugMode).toHaveBeenCalledWith(false);
    });

    it('should toggle debug mode', () => {
      expect(gameEngine.isDebugMode).toBe(false);
      
      gameEngine.toggleDebugMode();
      expect(gameEngine.isDebugMode).toBe(true);
      
      gameEngine.toggleDebugMode();
      expect(gameEngine.isDebugMode).toBe(false);
    });
  });

  describe('Asset Management', () => {
    beforeEach(async () => {
      await gameEngine.initialize();
    });

    it('should preload assets through render manager', async () => {
      const assets = ['texture1.png', 'sound1.mp3'];
      gameEngine.renderManager.preloadAssets.mockResolvedValue();

      await gameEngine.preloadAssets(assets);

      expect(gameEngine.renderManager.preloadAssets).toHaveBeenCalledWith(assets);
    });

    it('should load custom player images', async () => {
      const playerImages = [{ id: 'player1', url: 'player1.png' }];
      gameEngine.renderManager.loadCustomPlayerImages.mockResolvedValue();

      await gameEngine.loadCustomPlayerImages(playerImages);

      expect(gameEngine.renderManager.loadCustomPlayerImages).toHaveBeenCalledWith(playerImages);
    });

    it('should handle asset loading errors', async () => {
      gameEngine.renderManager.preloadAssets.mockRejectedValue(new Error('Asset load failed'));

      await expect(gameEngine.preloadAssets(['invalid.png'])).rejects.toThrow('Asset load failed');
    });
  });

  describe('AI Player Management', () => {
    beforeEach(async () => {
      await gameEngine.initialize();
    });

    it('should fill AI player slots', () => {
      const mockAIPlayers = GameHelpers.createMockPlayers(2);
      gameEngine.aiPlayerManager.checkAndFillSlots.mockReturnValue(mockAIPlayers);
      
      const aiPlayers = gameEngine.fillAIPlayerSlots(4);

      expect(aiPlayers).toBe(mockAIPlayers);
      expect(gameEngine.aiPlayerManager.checkAndFillSlots).toHaveBeenCalledWith(4);
    });

    it('should handle AI player creation errors', () => {
      gameEngine.aiPlayerManager.checkAndFillSlots.mockImplementation(() => {
        throw new Error('AI creation failed');
      });

      expect(() => gameEngine.fillAIPlayerSlots(4)).toThrow('AI creation failed');
    });
  });

  describe('Track Management', () => {
    beforeEach(async () => {
      await gameEngine.initialize();
    });

    it('should generate track through template manager', async () => {
      const trackConfig = { type: 'classic', difficulty: 'medium' };
      const mockTrack = { nodes: [], boundaries: [] };
      gameEngine.trackTemplateManager.generateTrack.mockResolvedValue(mockTrack);

      const track = await gameEngine.generateTrack(trackConfig);

      expect(track).toBe(mockTrack);
      expect(gameEngine.trackTemplateManager.generateTrack).toHaveBeenCalledWith(trackConfig);
    });

    it('should handle track generation errors', async () => {
      gameEngine.trackTemplateManager.generateTrack.mockRejectedValue(new Error('Track generation failed'));

      await expect(gameEngine.generateTrack({})).rejects.toThrow('Track generation failed');
    });
  });

  describe('State Management', () => {
    beforeEach(async () => {
      await gameEngine.initialize();
    });

    it('should get current game state', () => {
      const state = gameEngine.getGameState();

      expect(state).toEqual({
        isInitialized: true,
        isRunning: false,
        isDestroyed: false,
        isDebugMode: false,
        config: mockConfig,
        lastUpdateTime: expect.any(Number)
      });
    });

    it('should validate game state consistency', () => {
      gameEngine.start();
      
      const state = gameEngine.getGameState();
      
      expect(state.isRunning).toBe(true);
      expect(state.isInitialized).toBe(true);
      expect(state.isDestroyed).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle manager initialization failures', async () => {
      gameEngine.physicsManager.initialize.mockRejectedValue(new Error('Physics failed'));

      await expect(gameEngine.initialize()).rejects.toThrow('Physics failed');
      expect(gameEngine.isInitialized).toBe(false);
    });

    it('should handle game creation failures', async () => {
      await gameEngine.initialize();
      
      // Mock Phaser Game constructor to throw
      const Phaser = require('phaser');
      Phaser.Game.mockImplementation(() => {
        throw new Error('Phaser creation failed');
      });

      expect(() => gameEngine.start()).toThrow('Phaser creation failed');
    });

    it('should handle update loop errors gracefully', async () => {
      await gameEngine.initialize();
      gameEngine.physicsManager.update.mockImplementation(() => {
        throw new Error('Update failed');
      });

      // Should not crash the engine
      expect(() => gameEngine.update(16.67)).not.toThrow();
    });
  });

  describe('Resource Cleanup', () => {
    beforeEach(async () => {
      await gameEngine.initialize();
      gameEngine.start();
    });

    it('should destroy all resources when destroy() is called', () => {
      gameEngine.destroy();

      expect(gameEngine.game.destroy).toHaveBeenCalled();
      expect(gameEngine.configManager.destroy).toHaveBeenCalled();
      expect(gameEngine.physicsManager.cleanup).toHaveBeenCalled();
      expect(gameEngine.renderManager.cleanup).toHaveBeenCalled();
      expect(gameEngine.cameraManager.destroy).toHaveBeenCalled();
      expect(gameEngine.aiPlayerManager.destroy).toHaveBeenCalled();
      expect(gameEngine.trackTemplateManager.destroy).toHaveBeenCalled();
      
      expect(gameEngine.isDestroyed).toBe(true);
      expect(gameEngine.isRunning).toBe(false);
      expect(gameEngine.game).toBeNull();
    });

    it('should handle destroy when not initialized', () => {
      const uninitializedEngine = new GameEngine(mockConfig);
      
      expect(() => uninitializedEngine.destroy()).not.toThrow();
    });

    it('should not allow operations after destroy', () => {
      gameEngine.destroy();

      expect(() => gameEngine.start()).toThrow('GameEngine has been destroyed');
      expect(() => gameEngine.update(16.67)).toThrow('GameEngine has been destroyed');
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      await gameEngine.initialize();
    });

    it('should track update performance', () => {
      const startTime = performance.now();
      
      gameEngine.update(16.67);
      
      expect(gameEngine.lastUpdateTime).toBeGreaterThanOrEqual(startTime);
    });

    it('should provide performance metrics', () => {
      gameEngine.update(16.67);
      
      const metrics = gameEngine.getPerformanceMetrics();
      
      expect(metrics).toEqual({
        lastUpdateTime: expect.any(Number),
        averageFrameTime: expect.any(Number),
        fps: expect.any(Number),
        isRunning: gameEngine.isRunning
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete game lifecycle', async () => {
      // Initialize
      await gameEngine.initialize();
      expect(gameEngine.isInitialized).toBe(true);

      // Start
      gameEngine.start();
      expect(gameEngine.isRunning).toBe(true);

      // Update several frames
      for (let i = 0; i < 60; i++) {
        gameEngine.update(16.67);
      }

      // Resize
      gameEngine.resize(1024, 768);
      expect(gameEngine.config.width).toBe(1024);

      // Enable debug
      gameEngine.enableDebugMode();
      expect(gameEngine.isDebugMode).toBe(true);

      // Stop and destroy
      gameEngine.stop();
      gameEngine.destroy();
      
      expect(gameEngine.isDestroyed).toBe(true);
    });

    it('should handle rapid start/stop cycles', async () => {
      await gameEngine.initialize();

      for (let i = 0; i < 5; i++) {
        gameEngine.start();
        expect(gameEngine.isRunning).toBe(true);
        
        gameEngine.stop();
        expect(gameEngine.isRunning).toBe(false);
      }
    });

    it('should maintain manager synchronization', async () => {
      await gameEngine.initialize();
      gameEngine.start();

      // All managers should be properly connected
      expect(gameEngine.physicsManager.setTrackTemplateManager).toHaveBeenCalledWith(
        gameEngine.trackTemplateManager
      );

      // Update should maintain synchronization
      gameEngine.update(16.67);
      
      expect(gameEngine.physicsManager.update).toHaveBeenCalled();
      expect(gameEngine.renderManager.update).toHaveBeenCalled();
      expect(gameEngine.cameraManager.update).toHaveBeenCalled();
    });
  });
});