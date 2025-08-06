/**
 * Development Configuration for Memex Racing Game
 * 
 * This module contains development-specific settings and utilities
 * for enhanced debugging, hot-reload support, and performance monitoring.
 */

/**
 * Development Environment Configuration
 */
export const developmentConfig = {
  // Debug settings
  debug: {
    enabled: true,
    verbose: true,
    showFPS: true,
    showMemory: true,
    showPhysicsDebug: false, // Enable in Phaser physics debug mode
    logLevel: 'verbose', // 'error', 'warn', 'info', 'verbose'
  },

  // Hot reload settings
  hotReload: {
    enabled: true,
    preserveGameState: true,
    reloadAssets: true,
    reloadSounds: true,
    reloadSprites: true,
  },

  // Performance monitoring
  performance: {
    enabled: true,
    trackFPS: true,
    trackMemory: true,
    trackGameObjects: true,
    logInterval: 5000, // Log performance stats every 5 seconds
    warningThresholds: {
      lowFPS: 30,
      highMemory: 100, // MB
      highGameObjects: 1000,
    },
  },

  // Asset management for development
  assets: {
    hotReload: true,
    validateDimensions: true, // Validate sprite dimensions (32x32, 64x64)
    logLoading: true,
    cacheInvalidation: true,
  },

  // Game-specific debug settings
  game: {
    showPlayerDebugInfo: true,
    showStuckDetection: true,
    showCollisionBoxes: false,
    showPathfinding: false,
    logRandomSeed: true,
    slowMotion: false, // Enable for debugging movement
    godMode: false, // Skip win conditions for testing
  },

  // Development UI
  ui: {
    showDebugPanel: true,
    showConsoleOverlay: false,
    showPerformanceOverlay: true,
    enableCheatCodes: true,
  },
};

/**
 * Performance Monitor Class
 * Tracks game performance metrics during development
 */
export class DevelopmentPerformanceMonitor {
  constructor() {
    this.stats = {
      fps: [],
      memory: [],
      gameObjects: [],
      startTime: Date.now(),
    };
    
    this.lastLogTime = Date.now();
    this.enabled = developmentConfig.performance.enabled;
    
    if (this.enabled) {
      this.startMonitoring();
    }
  }

  startMonitoring() {
    // FPS monitoring
    if (developmentConfig.performance.trackFPS) {
      this.fpsMonitor = setInterval(() => {
        if (window.game && window.game.loop) {
          const fps = window.game.loop.actualFps;
          this.stats.fps.push({ timestamp: Date.now(), value: fps });
          
          // Keep only last 100 samples
          if (this.stats.fps.length > 100) {
            this.stats.fps.shift();
          }
          
          // Warning for low FPS
          if (fps < developmentConfig.performance.warningThresholds.lowFPS) {
            console.warn(`[Performance] Low FPS detected: ${fps.toFixed(1)}`);
          }
        }
      }, 1000);
    }

    // Memory monitoring
    if (developmentConfig.performance.trackMemory && performance.memory) {
      this.memoryMonitor = setInterval(() => {
        const memoryMB = performance.memory.usedJSHeapSize / 1024 / 1024;
        this.stats.memory.push({ timestamp: Date.now(), value: memoryMB });
        
        // Keep only last 100 samples
        if (this.stats.memory.length > 100) {
          this.stats.memory.shift();
        }
        
        // Warning for high memory usage
        if (memoryMB > developmentConfig.performance.warningThresholds.highMemory) {
          console.warn(`[Performance] High memory usage: ${memoryMB.toFixed(1)}MB`);
        }
      }, 2000);
    }

    // Periodic logging
    this.logMonitor = setInterval(() => {
      this.logPerformanceStats();
    }, developmentConfig.performance.logInterval);
  }

  logPerformanceStats() {
    if (!this.enabled) return;

    const now = Date.now();
    const avgFPS = this.getAverageFPS();
    const currentMemory = this.getCurrentMemory();
    const uptime = (now - this.stats.startTime) / 1000;

    console.group('[Performance Stats]');
    console.log(`Uptime: ${uptime.toFixed(1)}s`);
    console.log(`Average FPS: ${avgFPS.toFixed(1)}`);
    console.log(`Current Memory: ${currentMemory.toFixed(1)}MB`);
    
    if (window.game && window.game.scene.scenes.length > 0) {
      const activeScene = window.game.scene.scenes.find(scene => scene.scene.isVisible());
      if (activeScene) {
        console.log(`Active Game Objects: ${activeScene.children.length}`);
      }
    }
    
    console.groupEnd();
  }

  getAverageFPS() {
    if (this.stats.fps.length === 0) return 0;
    const sum = this.stats.fps.reduce((acc, stat) => acc + stat.value, 0);
    return sum / this.stats.fps.length;
  }

  getCurrentMemory() {
    if (this.stats.memory.length === 0) return 0;
    return this.stats.memory[this.stats.memory.length - 1].value;
  }

  stop() {
    if (this.fpsMonitor) clearInterval(this.fpsMonitor);
    if (this.memoryMonitor) clearInterval(this.memoryMonitor);
    if (this.logMonitor) clearInterval(this.logMonitor);
    this.enabled = false;
  }
}

/**
 * Hot Module Replacement Handler
 * Manages game state preservation during hot reloads
 */
export class HMRHandler {
  constructor() {
    this.gameState = null;
    this.preservedState = {};
  }

  setupHMR() {
    if (!module.hot) return;

    module.hot.accept((error) => {
      if (error) {
        console.error('[HMR] Error during hot reload:', error);
      } else {
        console.log('[HMR] Hot reload successful');
      }
    });

    // Preserve game state on disposal
    module.hot.dispose((data) => {
      this.preserveGameState(data);
    });

    // Restore game state if available
    if (module.hot.data) {
      this.restoreGameState(module.hot.data);
    }
  }

  preserveGameState(data) {
    if (!window.game) return;

    data.gameState = {
      timestamp: Date.now(),
      scenes: {},
      gameObjects: {},
      config: window.gameConfig,
    };

    // Preserve active scene data
    if (window.game.scene.scenes.length > 0) {
      const activeScene = window.game.scene.scenes.find(scene => scene.scene.isVisible());
      if (activeScene) {
        data.gameState.scenes.active = {
          key: activeScene.scene.key,
          players: this.extractPlayerData(activeScene),
          gameTime: activeScene.gameTime,
          raceActive: activeScene.raceActive,
        };
      }
    }

    console.log('[HMR] Game state preserved for hot reload');
  }

  restoreGameState(data) {
    if (!data.gameState) return;

    console.log('[HMR] Restoring game state from hot reload');
    this.preservedState = data.gameState;

    // Game state will be restored after new game instance is created
    setTimeout(() => {
      this.applyPreservedState();
    }, 1000);
  }

  extractPlayerData(scene) {
    // Extract player positions and states if available
    if (scene.players && Array.isArray(scene.players)) {
      return scene.players.map(player => ({
        index: player.index,
        x: player.x,
        y: player.y,
        name: player.nameText ? player.nameText.text : null,
      }));
    }
    return [];
  }

  applyPreservedState() {
    if (!this.preservedState || !window.game) return;

    console.log('[HMR] Applying preserved game state');
    // Implementation would depend on the game architecture
    // This is a placeholder for state restoration logic
  }
}

/**
 * Development Utilities
 */
export const devUtils = {
  // Add global debugging functions
  setupGlobalDebugFunctions() {
    if (typeof window === 'undefined') return;

    window.debugGame = {
      showCollisions: () => {
        if (window.game) {
          window.game.physics.world.drawDebug = !window.game.physics.world.drawDebug;
          console.log(`Collision debug: ${window.game.physics.world.drawDebug ? 'ON' : 'OFF'}`);
        }
      },
      
      toggleSlowMotion: () => {
        if (window.game) {
          const currentSpeed = window.game.loop.timeScale;
          window.game.loop.timeScale = currentSpeed === 1 ? 0.1 : 1;
          console.log(`Time scale: ${window.game.loop.timeScale}`);
        }
      },
      
      logGameState: () => {
        if (window.game && window.game.scene.scenes[0]) {
          const scene = window.game.scene.scenes[0];
          console.log('Current game state:', {
            sceneKey: scene.scene.key,
            gameObjects: scene.children.length,
            activePointers: scene.input.activePointer,
            cameras: scene.cameras.cameras.length,
          });
        }
      },
      
      getPerformanceReport: () => {
        if (window.performanceMonitor) {
          return {
            averageFPS: window.performanceMonitor.getAverageFPS(),
            currentMemory: window.performanceMonitor.getCurrentMemory(),
            uptime: (Date.now() - window.performanceMonitor.stats.startTime) / 1000,
          };
        }
        return null;
      },
    };

    console.log('[Dev Utils] Global debug functions available at window.debugGame');
  },

  // Asset hot reload
  async reloadAssets() {
    if (!window.game) return;

    try {
      const response = await fetch('/api/assets/reload');
      const result = await response.json();
      console.log('[Asset Reload]', result);
      
      // Trigger asset reload in game
      if (window.game.scene.scenes.length > 0) {
        window.game.scene.scenes.forEach(scene => {
          if (scene.load) {
            // Reload textures and sprites
            scene.load.start();
          }
        });
      }
    } catch (error) {
      console.error('[Asset Reload] Failed:', error);
    }
  },
};

export default developmentConfig;