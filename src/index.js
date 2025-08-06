/**
 * Memex Racing Game - Main Entry Point
 * 
 * This is the primary webpack entry point for the Memex Racing game.
 * It handles environment detection, basic error boundaries, and game initialization.
 */

import Phaser from 'phaser';
// Development configuration and utilities
import { 
  developmentConfig, 
  DevelopmentPerformanceMonitor, 
  HMRHandler, 
  devUtils 
} from '@config/development';
// Authentication integration
import loginIntegration from './auth/login-integration';
import { AuthGameBridge } from './game/systems/AuthGameBridge';
// Game scenes
import { PreloadScene } from './game/scenes/PreloadScene';
import { MainMenuScene } from './game/scenes/MainMenuScene';
import { LobbyScene } from './game/scenes/LobbyScene';
import { RaceScene } from './game/scenes/RaceScene';
// Multiplayer system
import { multiplayerEvents } from './multiplayer/MultiplayerEvents';
// UI System
import { initializeUI } from './ui';

// Environment detection
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
const gameVersion = process.env.VERSION || '0.1.0';

/**
 * Environment Configuration
 * Enhanced configuration using development module
 */
const currentConfig = isDevelopment ? developmentConfig : {
  debug: {
    enabled: false,
    verbose: false,
    showFPS: false,
    showMemory: false,
    logLevel: 'error',
  },
  hotReload: {
    enabled: false,
  },
  performance: {
    enabled: false,
  },
  game: {
    showPlayerDebugInfo: false,
    showStuckDetection: false,
  },
};

/**
 * Phaser Game Configuration
 * Configuration for the multiplayer racing game with scene management
 */
const gameConfig = {
  type: Phaser.AUTO,
  width: 1920,
  height: 1080,
  parent: 'game-container',
  backgroundColor: '#000000',
  pixelArt: true, // Always true for retro racing game
  antialias: false, // Better for pixel art
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 }, // Top-down racing game
      debug: currentConfig.debug.enabled,
    },
  },
  scene: [PreloadScene, MainMenuScene, LobbyScene, RaceScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  audio: {
    disableWebAudio: false
  }
};

/**
 * Enhanced authentication integration with AuthGameBridge
 * @param {Phaser.Game} game - Phaser game instance
 * @param {Object} uiManager - UI manager instance
 * @returns {Promise<{authGameBridge: AuthGameBridge|null, authResult: Object}>}
 */
async function initializeAuthIntegration(game, uiManager) {
  try {
    // Initialize login integration
    const authResult = await loginIntegration.initialize();
    
    // Create AuthGameBridge for centralized auth-game integration
    let authGameBridge = null;
    
    try {
      authGameBridge = new AuthGameBridge(game, loginIntegration.authManager);
      
      if (isDevelopment) {
        console.log('AuthGameBridge created successfully');
        // Make available for debugging
        window.authGameBridge = authGameBridge;
      }
    } catch (bridgeError) {
      console.error('Failed to create AuthGameBridge:', bridgeError);
      // Continue without AuthGameBridge
    }
    
    // Setup integration if authenticated
    if (authResult.isAuthenticated && authGameBridge) {
      try {
        // Initialize user context in AuthGameBridge
        await authGameBridge.initializeUserContext(authResult.user);
        
        // Integrate with Phaser scenes
        await loginIntegration.integrateWithPhaserScenes(game);
        
        // Setup game state handlers
        loginIntegration.setupGameStateHandlers(game, authGameBridge);
        
        // Update UI manager
        if (uiManager) {
          uiManager.setCurrentUser(authResult.user);
        }
        
        // Connect to multiplayer with authenticated user data
        try {
          const multiplayerManager = (await import('./multiplayer/MultiplayerManager')).MultiplayerManager;
          const instance = new multiplayerManager();
          await instance.connect(
            authResult.user.id,
            authResult.user.username,
            authResult.user
          );
          console.log('Multiplayer connected with authenticated user');
        } catch (multiplayerError) {
          console.warn('Failed to connect to multiplayer:', multiplayerError);
        }
        
        if (isDevelopment) {
          console.log('Enhanced auth integration completed for authenticated user:', authResult.user.username);
        }
      } catch (integrationError) {
        console.error('Failed to setup auth integration:', integrationError);
        // Clear auth state on integration failure
        if (authGameBridge) {
          authGameBridge.clearUserContext();
        }
        if (uiManager) {
          uiManager.setCurrentUser(null);
        }
      }
    } else if (!authResult.isAuthenticated) {
      // Clear any existing user data for unauthenticated users
      if (uiManager) {
        uiManager.setCurrentUser(null);
      }
      
      if (isDevelopment) {
        console.log('User not authenticated, continuing with guest mode');
      }
    }
    
    // Setup enhanced auth event listeners
    setupAuthEventListenersEnhanced(game, uiManager, authGameBridge);
    
    if (isDevelopment) {
      console.log('Auth integration initialized successfully');
    }
    
    return { authGameBridge, authResult };
    
  } catch (error) {
    console.error('Failed to initialize auth integration:', error);
    // Continue without auth integration
    return { authGameBridge: null, authResult: { isAuthenticated: false, user: null } };
  }
}

/**
 * Enhanced authentication event listeners with AuthGameBridge integration
 * @param {Phaser.Game} game - Phaser game instance
 * @param {Object} uiManager - UI manager instance
 * @param {AuthGameBridge} authGameBridge - AuthGameBridge instance
 */
function setupAuthEventListenersEnhanced(game, uiManager, authGameBridge) {
  // Legacy fallback for window.authManager (backward compatibility)
  if (window.authManager) {
    window.authManager.on('login', async (userData) => {
      console.log('User logged in:', userData);
      
      // Use AuthGameBridge if available, otherwise fall back to legacy behavior
      if (authGameBridge) {
        authGameBridge.handleAuthStateChange({
          type: 'login',
          user: userData
        });
      }
      
      // Connect to multiplayer with authenticated user data
      if (window.SERVERLESS_MODE) {
        // Use Ably for serverless deployment
        const { getAblyMultiplayerManager } = await import('./multiplayer/AblyMultiplayerManager');
        const ablyManager = getAblyMultiplayerManager();
        
        // Get Ably token from auth endpoint
        const tokenResponse = await fetch('/api/auth/ably-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userData.token || localStorage.getItem('authToken')}`
          }
        });
        
        if (tokenResponse.ok) {
          const { token } = await tokenResponse.json();
          await ablyManager.connect(
            userData.id || userData.username || 'guest',
            userData.username || 'Guest',
            token
          );
          multiplayerEvents.multiplayerManager = ablyManager;
        }
      } else if (multiplayerEvents.multiplayerManager) {
        // Use existing Socket.io manager
        await multiplayerEvents.multiplayerManager.connect(
          userData.id || userData.username || 'guest',
          userData.username || 'Guest',
          userData
        );
      } else {
        multiplayerEvents.connect(userData.id || userData.username || 'guest');
      }
      
      // Update UI with user data
      if (uiManager) {
        uiManager.setCurrentUser(userData);
      }
      
      // Refresh main menu to show user info
      const mainMenuScene = game.scene.getScene('MainMenuScene');
      if (mainMenuScene && mainMenuScene.scene.isActive()) {
        mainMenuScene.scene.restart();
      }
    });
    
    window.authManager.on('logout', () => {
      console.log('User logged out');
      
      // Use AuthGameBridge if available
      if (authGameBridge) {
        authGameBridge.handleAuthStateChange({
          type: 'logout'
        });
      }
      
      // Disconnect from multiplayer
      multiplayerEvents.disconnect();
      
      // Clear UI user data
      if (uiManager) {
        uiManager.setCurrentUser(null);
      }
      
      // Return to main menu and refresh
      game.scene.start('MainMenuScene');
    });

    // Handle session expiration
    window.authManager.on('session_expired', () => {
      console.log('User session expired');
      
      if (authGameBridge) {
        authGameBridge.handleAuthStateChange({
          type: 'session_expired'
        });
      }
      
      // Disconnect from multiplayer
      multiplayerEvents.disconnect();
      
      // Clear UI user data
      if (uiManager) {
        uiManager.setCurrentUser(null);
      }
      
      // Return to main menu with session expired message
      game.scene.start('MainMenuScene');
      
      // Could show session expired notification here
      if (isDevelopment) {
        console.warn('Session expired - user returned to main menu');
      }
    });
  }
  
  // Enhanced AuthGameBridge event listeners
  if (authGameBridge) {
    // Listen for auth context changes from AuthGameBridge
    game.registry.events.on('auth-context-initialized', (userData) => {
      if (isDevelopment) {
        console.log('Auth context initialized:', userData.username);
      }
    });
    
    game.registry.events.on('auth-context-cleared', () => {
      if (isDevelopment) {
        console.log('Auth context cleared');
      }
    });
    
    game.registry.events.on('auth-error', (errorData) => {
      console.error('Authentication error:', errorData);
      
      // Handle auth errors gracefully
      if (errorData.type === 'session_expired') {
        // Show user-friendly session expired message
        // Could trigger a modal or notification here
      }
    });
  }
}

/**
 * Initialize multiplayer events system
 */
function initializeMultiplayerEvents(game) {
  try {
    // Setup scene transition handlers
    multiplayerEvents.on('ROOM_CREATED', (data) => {
      console.log('Room created, transitioning to lobby');
    });
    
    multiplayerEvents.on('GAME_STARTED', (data) => {
      console.log('Game started, transitioning to race');
    });
    
    multiplayerEvents.on('RACE_FINISHED', (data) => {
      console.log('Race finished');
    });
    
    // Make multiplayer events available globally for debugging
    if (isDevelopment) {
      window.multiplayerEvents = multiplayerEvents;
    }
    
    console.log('Multiplayer events system initialized');
  } catch (error) {
    console.error('Failed to initialize multiplayer events:', error);
  }
}

/**
 * Error Boundary System
 * Catches and handles initialization errors gracefully
 */
class GameErrorBoundary {
  constructor() {
    this.errors = [];
    this.setupErrorHandlers();
  }
  
  setupErrorHandlers() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.handleError('Runtime Error', event.error || event.message);
    });
    
    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError('Promise Rejection', event.reason);
    });
  }
  
  handleError(type, error) {
    const errorInfo = {
      type,
      message: error?.message || error,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: gameVersion,
    };
    
    this.errors.push(errorInfo);
    
    if (isDevelopment) {
      console.error(`[Game Error - ${type}]:`, errorInfo);
    }
    
    this.showErrorMessage(errorInfo);
  }
  
  showErrorMessage(errorInfo) {
    const gameContainer = document.getElementById('game-container');
    if (!gameContainer) return;
    
    // Don't show duplicate error messages
    if (gameContainer.querySelector('.error-message')) return;
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
      <h3>Game Error Occurred</h3>
      <p><strong>Type:</strong> ${errorInfo.type}</p>
      <p><strong>Message:</strong> ${errorInfo.message}</p>
      ${isDevelopment ? `<details><summary>Technical Details</summary><pre>${errorInfo.stack || 'No stack trace available'}</pre></details>` : ''}
      <button onclick="location.reload()" style="margin-top: 10px; padding: 5px 10px; background: #ff4444; color: white; border: none; cursor: pointer;">Reload Game</button>
    `;
    
    gameContainer.appendChild(errorDiv);
  }
}

/**
 * Game Initialization Function
 * Main initialization logic with error handling
 */
async function initializeGame() {
  try {
    if (isDevelopment) {
      console.log('Initializing Memex Racing Game...');
      console.log('Environment:', process.env.NODE_ENV);
      console.log('Version:', gameVersion);
      console.log('Config:', currentConfig);
    }
    
    // Create error boundary
    const errorBoundary = new GameErrorBoundary();
    
    // Initialize development tools
    let performanceMonitor = null;
    let hmrHandler = null;
    
    if (isDevelopment) {
      // Setup performance monitoring
      performanceMonitor = new DevelopmentPerformanceMonitor();
      window.performanceMonitor = performanceMonitor;
      
      // Setup hot module replacement
      hmrHandler = new HMRHandler();
      hmrHandler.setupHMR();
      
      // Setup global debug functions
      devUtils.setupGlobalDebugFunctions();
      
      console.log('Development tools initialized');
    }
    
    // Validate required DOM elements
    const gameContainer = document.getElementById('game-container');
    if (!gameContainer) {
      throw new Error('Game container element not found');
    }
    
    // Initialize Phaser game
    const game = new Phaser.Game(gameConfig);
    
    // Initialize UI system
    const uiManager = await initializeUI(game);
    
    // Initialize enhanced authentication integration
    const { authGameBridge, authResult } = await initializeAuthIntegration(game, uiManager);
    
    // Initialize multiplayer events system
    initializeMultiplayerEvents(game);
    
    // Store game instance globally for debugging
    if (isDevelopment) {
      window.game = game;
      window.uiManager = uiManager;
      window.gameConfig = currentConfig;
      window.hmrHandler = hmrHandler;
      if (authGameBridge) {
        window.authGameBridge = authGameBridge;
      }
      console.log('Game instance created successfully');
      console.log('Game available at window.game for debugging');
      console.log('UI Manager available at window.uiManager for debugging');
      console.log('Debug functions available at window.debugGame');
      if (authGameBridge) {
        console.log('AuthGameBridge available at window.authGameBridge for debugging');
      }
      if (authResult.isAuthenticated) {
        console.log('Game initialized with authenticated user:', authResult.user.username);
      } else {
        console.log('Game initialized in guest mode');
      }
    }
    
    return { 
      game, 
      uiManager, 
      errorBoundary, 
      performanceMonitor, 
      hmrHandler, 
      authGameBridge, 
      authResult 
    };
    
  } catch (error) {
    console.error('Failed to initialize game:', error);
    
    // Show fallback error message
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
      gameContainer.innerHTML = `
        <div class="error-message">
          <h2>Game Initialization Failed</h2>
          <p>${error.message}</p>
          <button onclick="location.reload()">Reload Page</button>
        </div>
      `;
    }
    
    throw error;
  }
}

/**
 * Hot Module Replacement Support
 * Preserves game state during development
 */
if (isDevelopment && module.hot) {
  module.hot.accept((error) => {
    if (error) {
      console.error('HMR Error:', error);
    }
  });
  
  // Preserve game state across hot reloads
  if (module.hot.data) {
    console.log('Hot reload detected - preserving game state');
  }
  
  module.hot.dispose((data) => {
    // Store game state for next reload
    if (window.game) {
      data.gameState = {
        scene: window.game.scene.active,
        timestamp: Date.now(),
      };
    }
  });
}

/**
 * Application Entry Point
 * Starts when DOM is ready
 */
function startApplication() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGame);
  } else {
    initializeGame();
  }
}

// Export for testing and module integration
export {
  initializeGame,
  gameConfig,
  currentConfig as CONFIG,
  GameErrorBoundary,
  isDevelopment,
  isProduction,
  gameVersion,
};

// Start the application
startApplication();