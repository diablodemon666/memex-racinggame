/**
 * OBSOverlay.js - OBS WebSocket Integration for Memex Racing
 * 
 * Provides seamless integration with OBS Studio for streaming overlays,
 * scene control, and real-time race data broadcasting.
 * 
 * Key Features:
 * - OBS WebSocket 5.x connection management
 * - Real-time race data overlays
 * - Automated scene switching for races
 * - Camera control integration
 * - Betting information display
 * - Streamlined streamer experience
 */

import OBSWebSocket from 'obs-websocket-js';

/**
 * OBS Connection States
 */
export const OBSConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  AUTHENTICATED: 'authenticated',
  ERROR: 'error'
};

/**
 * OBS Scene Presets for Racing Game
 */
export const OBSScenePresets = {
  LOBBY: 'lobby',
  BETTING_PHASE: 'betting_phase',
  RACE_ACTIVE: 'race_active',
  RACE_FINISH: 'race_finish',
  LEADERBOARD: 'leaderboard',
  INTERMISSION: 'intermission'
};

/**
 * OBS Source Types for Overlay Management
 */
export const OBSSourceTypes = {
  BROWSER_SOURCE: 'browser_source',
  TEXT_SOURCE: 'text_gdiplus_v2',
  IMAGE_SOURCE: 'image_source',
  COLOR_SOURCE: 'color_source_v3'
};

export class OBSOverlay {
  constructor(gameEngine, config = {}) {
    this.gameEngine = gameEngine;
    this.obs = new OBSWebSocket();
    
    // Connection configuration
    this.config = {
      host: 'localhost',
      port: 4455,
      password: '', // Will be set via UI or environment
      autoReconnect: true,
      reconnectDelay: 5000,
      connectionTimeout: 30000,
      
      // Scene configuration
      autoSwitchScenes: true,
      createMissingScenes: true,
      createMissingSources: true,
      
      // Overlay settings
      overlayUrl: 'http://localhost:3000/streaming/overlay',
      overlayWidth: 1920,
      overlayHeight: 1080,
      overlayRefreshRate: 60,
      
      // Stream settings
      enableCameraControl: true,
      enableAutoRecord: false,
      enableAutoStream: false,
      
      ...config
    };

    // Connection state
    this.connectionState = OBSConnectionState.DISCONNECTED;
    this.isAuthenticated = false;
    this.obsVersion = null;
    this.availableScenes = [];
    this.currentScene = null;
    
    // Overlay management
    this.activeOverlays = new Map();
    this.overlayData = {
      raceData: null,
      bettingData: null,
      playerStats: null,
      leaderboard: null,
      tournamentData: null,
      tournamentBracket: null,
      tournamentStandings: null,
      tournamentMatchWinner: null,
      tournamentWinner: null,
      tournamentAnimation: null,
      timestamp: Date.now()
    };
    
    // Event handlers
    this.eventHandlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    
    // Performance tracking
    this.lastUpdateTime = 0;
    this.updateInterval = null;
    
    console.log('[OBSOverlay] OBS integration initialized');
    
    // Initialize OBS event handlers
    this.setupOBSEventHandlers();
  }

  /**
   * Connect to OBS WebSocket
   */
  async connect(host = this.config.host, port = this.config.port, password = this.config.password) {
    if (this.connectionState === OBSConnectionState.CONNECTING || 
        this.connectionState === OBSConnectionState.CONNECTED) {
      console.warn('[OBSOverlay] Already connected or connecting to OBS');
      return false;
    }

    try {
      console.log(`[OBSOverlay] Connecting to OBS at ${host}:${port}`);
      this.connectionState = OBSConnectionState.CONNECTING;
      this.emit('connection-state-changed', { state: this.connectionState });

      // Store connection details
      this.config.host = host;
      this.config.port = port;
      this.config.password = password;

      // Connect to OBS
      const connectionInfo = await this.obs.connect(`ws://${host}:${port}`, password, {
        rpcVersion: 1
      });

      this.connectionState = OBSConnectionState.CONNECTED;
      this.isAuthenticated = true;
      this.obsVersion = connectionInfo.obsWebSocketVersion;
      this.reconnectAttempts = 0;

      console.log(`[OBSOverlay] Connected to OBS v${connectionInfo.obsVersion} (WebSocket v${connectionInfo.obsWebSocketVersion})`);
      
      // Initialize OBS setup
      await this.initializeOBSSetup();
      
      this.connectionState = OBSConnectionState.AUTHENTICATED;
      this.emit('connection-state-changed', { state: this.connectionState, connectionInfo });
      this.emit('obs-connected', { connectionInfo });

      // Start update loop
      this.startUpdateLoop();

      return true;

    } catch (error) {
      console.error('[OBSOverlay] Failed to connect to OBS:', error);
      this.connectionState = OBSConnectionState.ERROR;
      this.emit('connection-state-changed', { state: this.connectionState, error });
      this.emit('obs-connection-failed', { error });
      
      // Schedule reconnection if enabled
      if (this.config.autoReconnect) {
        this.scheduleReconnection();
      }
      
      return false;
    }
  }

  /**
   * Disconnect from OBS WebSocket
   */
  async disconnect() {
    try {
      console.log('[OBSOverlay] Disconnecting from OBS');
      
      // Stop update loop
      this.stopUpdateLoop();
      
      // Clear active overlays
      this.activeOverlays.clear();
      
      // Disconnect from OBS
      if (this.obs && this.connectionState !== OBSConnectionState.DISCONNECTED) {
        await this.obs.disconnect();
      }
      
      this.connectionState = OBSConnectionState.DISCONNECTED;
      this.isAuthenticated = false;
      this.currentScene = null;
      this.availableScenes = [];
      
      this.emit('connection-state-changed', { state: this.connectionState });
      this.emit('obs-disconnected');
      
      console.log('[OBSOverlay] Disconnected from OBS');
      return true;
      
    } catch (error) {
      console.error('[OBSOverlay] Error disconnecting from OBS:', error);
      return false;
    }
  }

  /**
   * Initialize OBS setup with required scenes and sources
   */
  async initializeOBSSetup() {
    try {
      console.log('[OBSOverlay] Initializing OBS setup');
      
      // Get current scenes
      const sceneList = await this.obs.call('GetSceneList');
      this.availableScenes = sceneList.scenes.map(scene => scene.sceneName);
      this.currentScene = sceneList.currentProgramSceneName;
      
      console.log(`[OBSOverlay] Found ${this.availableScenes.length} scenes. Current: ${this.currentScene}`);
      
      // Create missing scenes if enabled
      if (this.config.createMissingScenes) {
        await this.createRequiredScenes();
      }
      
      // Setup overlay sources
      if (this.config.createMissingSources) {
        await this.createOverlaySources();
      }
      
      console.log('[OBSOverlay] OBS setup completed');
      this.emit('obs-setup-complete');
      
    } catch (error) {
      console.error('[OBSOverlay] Failed to initialize OBS setup:', error);
      throw error;
    }
  }

  /**
   * Create required scenes for racing game
   */
  async createRequiredScenes() {
    const requiredScenes = [
      { name: 'Memex Racing - Lobby', preset: OBSScenePresets.LOBBY },
      { name: 'Memex Racing - Betting', preset: OBSScenePresets.BETTING_PHASE },
      { name: 'Memex Racing - Race', preset: OBSScenePresets.RACE_ACTIVE },
      { name: 'Memex Racing - Finish', preset: OBSScenePresets.RACE_FINISH },
      { name: 'Memex Racing - Leaderboard', preset: OBSScenePresets.LEADERBOARD },
      { name: 'Memex Racing - Intermission', preset: OBSScenePresets.INTERMISSION }
    ];

    for (const scene of requiredScenes) {
      try {
        if (!this.availableScenes.includes(scene.name)) {
          await this.obs.call('CreateScene', { sceneName: scene.name });
          this.availableScenes.push(scene.name);
          console.log(`[OBSOverlay] Created scene: ${scene.name}`);
        }
      } catch (error) {
        console.warn(`[OBSOverlay] Failed to create scene ${scene.name}:`, error);
      }
    }
  }

  /**
   * Create overlay sources for all scenes
   */
  async createOverlaySources() {
    const overlayConfigs = [
      {
        sourceName: 'Racing Game Overlay',
        sourceKind: OBSSourceTypes.BROWSER_SOURCE,
        settings: {
          url: this.config.overlayUrl,
          width: this.config.overlayWidth,
          height: this.config.overlayHeight,
          fps: this.config.overlayRefreshRate,
          restart_when_active: true,
          shutdown: true
        }
      },
      {
        sourceName: 'Race Timer',
        sourceKind: OBSSourceTypes.TEXT_SOURCE,
        settings: {
          text: '5:00',
          font: {
            face: 'Arial',
            size: 48,
            style: 'Bold'
          },
          color: 0xFFFFFF,
          outline: true,
          outline_size: 2,
          outline_color: 0x000000
        }
      },
      {
        sourceName: 'Betting Pool',
        sourceKind: OBSSourceTypes.TEXT_SOURCE,
        settings: {
          text: 'Total Pool: $0',
          font: {
            face: 'Arial',
            size: 32,
            style: 'Bold'
          },
          color: 0x00FF00,
          outline: true,
          outline_size: 2,
          outline_color: 0x000000
        }
      }
    ];

    for (const config of overlayConfigs) {
      try {
        // Check if source already exists
        const sourceExists = await this.checkSourceExists(config.sourceName);
        
        if (!sourceExists) {
          await this.obs.call('CreateSource', {
            sourceName: config.sourceName,
            sourceKind: config.sourceKind,
            sourceSettings: config.settings
          });
          
          console.log(`[OBSOverlay] Created source: ${config.sourceName}`);
        }
        
        // Add source to relevant scenes
        await this.addSourceToScenes(config.sourceName);
        
      } catch (error) {
        console.warn(`[OBSOverlay] Failed to create source ${config.sourceName}:`, error);
      }
    }
  }

  /**
   * Check if a source exists in OBS
   */
  async checkSourceExists(sourceName) {
    try {
      await this.obs.call('GetSourceSettings', { sourceName });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Add source to relevant scenes
   */
  async addSourceToScenes(sourceName) {
    const sceneMappings = {
      'Racing Game Overlay': ['Memex Racing - Race', 'Memex Racing - Betting'],
      'Race Timer': ['Memex Racing - Race', 'Memex Racing - Betting'],
      'Betting Pool': ['Memex Racing - Betting']
    };

    const scenes = sceneMappings[sourceName] || [];
    
    for (const sceneName of scenes) {
      try {
        if (this.availableScenes.includes(sceneName)) {
          await this.obs.call('CreateSceneSource', {
            sceneName,
            sourceName,
            sceneItemEnabled: true
          });
          console.log(`[OBSOverlay] Added ${sourceName} to scene ${sceneName}`);
        }
      } catch (error) {
        // Source might already exist in scene, which is fine
        if (!error.message.includes('already exists')) {
          console.warn(`[OBSOverlay] Failed to add ${sourceName} to ${sceneName}:`, error);
        }
      }
    }
  }

  /**
   * Switch to appropriate scene based on game state
   */
  async switchScene(gameState, tournamentMode = false) {
    if (!this.isAuthenticated || !this.config.autoSwitchScenes) {
      return;
    }

    let targetScene = null;

    if (tournamentMode) {
      // Tournament scene switching
      switch (gameState) {
        case 'tournament_registration':
          targetScene = 'Tournament - Registration';
          break;
        case 'tournament_bracket':
          targetScene = 'Tournament - Bracket Overview';
          break;
        case 'tournament_match_active':
          targetScene = 'Tournament - Match Active';
          break;
        case 'tournament_match_results':
          targetScene = 'Tournament - Match Results';
          break;
        case 'tournament_winner':
          targetScene = 'Tournament - Winner Ceremony';
          break;
        case 'tournament_finals':
          targetScene = 'Tournament - Finals';
          break;
        default:
          targetScene = 'Tournament - Bracket Overview';
      }
    } else {
      // Regular game scene switching
      switch (gameState) {
        case 'lobby':
          targetScene = 'Memex Racing - Lobby';
          break;
        case 'betting':
          targetScene = 'Memex Racing - Betting';
          break;
        case 'racing':
          targetScene = 'Memex Racing - Race';
          break;
        case 'finished':
          targetScene = 'Memex Racing - Finish';
          break;
        case 'leaderboard':
          targetScene = 'Memex Racing - Leaderboard';
          break;
        default:
          targetScene = 'Memex Racing - Intermission';
      }
    }

    if (targetScene && this.availableScenes.includes(targetScene) && targetScene !== this.currentScene) {
      try {
        await this.obs.call('SetCurrentProgramScene', { sceneName: targetScene });
        this.currentScene = targetScene;
        console.log(`[OBSOverlay] Switched to scene: ${targetScene}${tournamentMode ? ' (Tournament)' : ''}`);
        this.emit('scene-changed', { scene: targetScene, gameState, tournamentMode });
      } catch (error) {
        console.error(`[OBSOverlay] Failed to switch to scene ${targetScene}:`, error);
      }
    }
  }

  /**
   * Update overlay data
   */
  updateOverlayData(dataType, data) {
    this.overlayData[dataType] = data;
    this.overlayData.timestamp = Date.now();
    
    // Update text sources for specific data types
    this.updateTextSources(dataType, data);
    
    this.emit('overlay-data-updated', { dataType, data });
  }

  /**
   * Update OBS text sources with game data
   */
  async updateTextSources(dataType, data) {
    if (!this.isAuthenticated) return;

    try {
      switch (dataType) {
        case 'raceData':
          if (data && data.timeRemaining !== undefined) {
            const minutes = Math.floor(data.timeRemaining / 60);
            const seconds = data.timeRemaining % 60;
            const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            await this.updateTextSource('Race Timer', timeText);
          }
          break;
          
        case 'bettingData':
          if (data && data.totalPool !== undefined) {
            await this.updateTextSource('Betting Pool', `Total Pool: $${data.totalPool}`);
          }
          break;
          
        case 'tournamentData':
          if (data && data.tournament) {
            if (data.tournament.name) {
              await this.updateTextSource('Tournament Title', data.tournament.name);
            }
            if (data.tournament.currentRound && data.tournament.totalRounds) {
              await this.updateTextSource('Tournament Round', `Round ${data.tournament.currentRound} / ${data.tournament.totalRounds}`);
            }
          }
          break;
          
        case 'tournamentMatchWinner':
          if (data && data.winner && data.match) {
            await this.updateTextSource('Tournament Match Info', `Winner: ${data.winner.playerName}`);
          }
          break;
      }
    } catch (error) {
      console.warn(`[OBSOverlay] Failed to update text sources for ${dataType}:`, error);
    }
  }

  /**
   * Update a specific text source
   */
  async updateTextSource(sourceName, text) {
    try {
      await this.obs.call('SetSourceSettings', {
        sourceName,
        sourceSettings: { text }
      });
    } catch (error) {
      console.warn(`[OBSOverlay] Failed to update text source ${sourceName}:`, error);
    }
  }

  /**
   * Control camera through OBS integration
   */
  async controlCamera(cameraCommand) {
    if (!this.config.enableCameraControl || !this.gameEngine.cameraManager) {
      return;
    }

    const cameraManager = this.gameEngine.cameraManager;

    switch (cameraCommand.type) {
      case 'setMode':
        cameraManager.setMode(cameraCommand.mode, cameraCommand.options);
        break;
        
      case 'followPlayer':
        cameraManager.setMode('follow_player', { playerId: cameraCommand.playerId });
        break;
        
      case 'setPreset':
        const preset = cameraManager.getPreset(cameraCommand.presetName);
        if (preset) {
          preset.applyTo(cameraManager);
        }
        break;
        
      case 'setPosition':
        cameraManager.setPosition(cameraCommand.position, { smooth: true });
        break;
        
      case 'setZoom':
        cameraManager.setZoom(cameraCommand.zoom, { smooth: true });
        break;
    }

    this.emit('camera-controlled', { command: cameraCommand });
  }

  /**
   * Start recording if enabled
   */
  async startRecording() {
    if (!this.isAuthenticated || !this.config.enableAutoRecord) {
      return false;
    }

    try {
      const status = await this.obs.call('GetRecordStatus');
      if (!status.outputActive) {
        await this.obs.call('StartRecord');
        console.log('[OBSOverlay] Started recording');
        this.emit('recording-started');
        return true;
      }
    } catch (error) {
      console.error('[OBSOverlay] Failed to start recording:', error);
    }
    
    return false;
  }

  /**
   * Stop recording
   */
  async stopRecording() {
    if (!this.isAuthenticated) {
      return false;
    }

    try {
      const status = await this.obs.call('GetRecordStatus');
      if (status.outputActive) {
        await this.obs.call('StopRecord');
        console.log('[OBSOverlay] Stopped recording');
        this.emit('recording-stopped');
        return true;
      }
    } catch (error) {
      console.error('[OBSOverlay] Failed to stop recording:', error);
    }
    
    return false;
  }

  /**
   * Get current OBS status
   */
  async getOBSStatus() {
    if (!this.isAuthenticated) {
      return null;
    }

    try {
      const [sceneList, recordStatus, streamStatus] = await Promise.all([
        this.obs.call('GetSceneList'),
        this.obs.call('GetRecordStatus'),
        this.obs.call('GetStreamStatus')
      ]);

      return {
        connected: true,
        currentScene: sceneList.currentProgramSceneName,
        availableScenes: sceneList.scenes.map(s => s.sceneName),
        recording: recordStatus.outputActive,
        streaming: streamStatus.outputActive,
        obsVersion: this.obsVersion
      };
    } catch (error) {
      console.error('[OBSOverlay] Failed to get OBS status:', error);
      return null;
    }
  }

  /**
   * Setup OBS WebSocket event handlers
   */
  setupOBSEventHandlers() {
    this.obs.on('ConnectionClosed', () => {
      console.log('[OBSOverlay] OBS connection closed');
      this.connectionState = OBSConnectionState.DISCONNECTED;
      this.isAuthenticated = false;
      this.emit('connection-state-changed', { state: this.connectionState });
      this.emit('obs-disconnected');
      
      if (this.config.autoReconnect) {
        this.scheduleReconnection();
      }
    });

    this.obs.on('ConnectionError', (error) => {
      console.error('[OBSOverlay] OBS connection error:', error);
      this.connectionState = OBSConnectionState.ERROR;
      this.emit('connection-state-changed', { state: this.connectionState, error });
    });

    this.obs.on('CurrentProgramSceneChanged', (data) => {
      this.currentScene = data.sceneName;
      this.emit('scene-changed', { scene: data.sceneName });
    });

    this.obs.on('RecordStateChanged', (data) => {
      this.emit('recording-state-changed', { active: data.outputActive });
    });

    this.obs.on('StreamStateChanged', (data) => {
      this.emit('streaming-state-changed', { active: data.outputActive });
    });
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[OBSOverlay] Max reconnection attempts reached');
      this.emit('reconnection-failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    
    console.log(`[OBSOverlay] Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.connectionState === OBSConnectionState.DISCONNECTED || 
          this.connectionState === OBSConnectionState.ERROR) {
        this.connect(this.config.host, this.config.port, this.config.password);
      }
    }, delay);
  }

  /**
   * Start update loop for overlay data
   */
  startUpdateLoop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(() => {
      this.updateOverlayFromGame();
    }, 1000 / 30); // 30 FPS update rate
  }

  /**
   * Stop update loop
   */
  stopUpdateLoop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Update overlay data from game state
   */
  updateOverlayFromGame() {
    if (!this.gameEngine) return;

    const currentTime = Date.now();
    if (currentTime - this.lastUpdateTime < 33) return; // Throttle to ~30 FPS
    this.lastUpdateTime = currentTime;

    // Get race data
    const raceData = this.gameEngine.getRaceData?.();
    if (raceData) {
      this.updateOverlayData('raceData', raceData);
    }

    // Get betting data
    const bettingData = this.gameEngine.getBettingData?.();
    if (bettingData) {
      this.updateOverlayData('bettingData', bettingData);
    }

    // Get player stats
    const playerStats = this.gameEngine.getPlayerStats?.();
    if (playerStats) {
      this.updateOverlayData('playerStats', playerStats);
    }
  }

  /**
   * Get overlay data for external consumption
   */
  getOverlayData() {
    return { ...this.overlayData };
  }

  /**
   * Event system
   */
  on(eventName, handler) {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName).push(handler);
  }

  off(eventName, handler) {
    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(eventName, data = {}) {
    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[OBSOverlay] Event handler error for '${eventName}':`, error);
        }
      });
    }
  }

  /**
   * Destroy OBS overlay system
   */
  async destroy() {
    console.log('[OBSOverlay] Destroying OBS overlay system');
    
    this.stopUpdateLoop();
    await this.disconnect();
    
    this.eventHandlers.clear();
    this.activeOverlays.clear();
    this.overlayData = {};
    
    console.log('[OBSOverlay] OBS overlay system destroyed');
  }
}

export default OBSOverlay;