/**
 * Production Configuration for Memex Racing Game
 * 
 * This module contains production-specific settings and fallbacks
 * for development utilities to ensure the game runs smoothly in production.
 */

/**
 * Production Environment Configuration
 */
export const productionConfig = {
  // Debug settings - minimal in production
  debug: {
    enabled: false,
    verbose: false,
    showFPS: false,
    showMemory: false,
    showPhysicsDebug: false,
    logLevel: 'error',
  },

  // Hot reload disabled in production
  hotReload: {
    enabled: false,
    preserveGameState: false,
    reloadAssets: false,
    reloadSounds: false,
    reloadSprites: false,
  },

  // Performance monitoring disabled in production
  performance: {
    enabled: false,
    trackFPS: false,
    trackMemory: false,
    trackGameObjects: false,
    logInterval: 30000, // Longer interval if enabled
    warningThresholds: {
      lowFPS: 20,
      highMemory: 200, // MB
      highGameObjects: 2000,
    },
  },

  // Asset management for production
  assets: {
    hotReload: false,
    validateDimensions: false,
    logLoading: false,
    cacheInvalidation: false,
  },

  // Game-specific debug settings disabled
  game: {
    showPlayerDebugInfo: false,
    showStuckDetection: false,
    showCollisionBoxes: false,
    showPathfinding: false,
    logRandomSeed: false,
    slowMotion: false,
    godMode: false,
  },

  // Production UI
  ui: {
    showDebugPanel: false,
    showConsoleOverlay: false,
    showPerformanceOverlay: false,
    enableCheatCodes: false,
  },
};

/**
 * Production Performance Monitor Class (Stub)
 * Provides minimal monitoring functionality in production
 */
export class ProductionPerformanceMonitor {
  constructor() {
    this.stats = {
      startTime: Date.now(),
    };
    this.enabled = false;
  }

  startMonitoring() {
    // No-op in production
  }

  logPerformanceStats() {
    // No-op in production
  }

  getAverageFPS() {
    return 0;
  }

  getCurrentMemory() {
    return 0;
  }

  stop() {
    // No-op in production
  }
}

/**
 * Production HMR Handler (Stub)
 * Provides fallback functionality when HMR is not available
 */
export class ProductionHMRHandler {
  constructor() {
    this.gameState = null;
    this.preservedState = {};
  }

  setupHMR() {
    // No-op in production
  }

  preserveGameState(data) {
    // No-op in production
  }

  restoreGameState(data) {
    // No-op in production
  }

  extractPlayerData(scene) {
    return [];
  }

  applyPreservedState() {
    // No-op in production
  }
}

/**
 * Production Development Utilities (Stub)
 */
export const productionDevUtils = {
  setupGlobalDebugFunctions() {
    // Minimal debug functions for production
    if (typeof window !== 'undefined') {
      window.debugGame = {
        getGameInfo: () => {
          if (window.game) {
            return {
              version: process.env.VERSION || '0.1.0',
              environment: 'production',
              activeScene: window.game.scene.scenes.find(s => s.scene.isActive())?.scene.key,
              timestamp: new Date().toISOString(),
            };
          }
          return null;
        },
        reloadPage: () => {
          window.location.reload();
        }
      };
    }
  },

  async reloadAssets() {
    // No-op in production
    console.log('[Production] Asset reload not available in production');
  },
};

export default productionConfig;