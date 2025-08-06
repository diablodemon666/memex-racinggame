# Memex Racing Game API Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Engine APIs](#core-engine-apis)
4. [Configuration System](#configuration-system)
5. [UI Component APIs](#ui-component-apis)
6. [Streaming & Tournament APIs](#streaming--tournament-apis)
7. [Multiplayer System](#multiplayer-system)
8. [Asset Management](#asset-management)
9. [Event System](#event-system)
10. [Integration Examples](#integration-examples)
11. [Customization Guide](#customization-guide)

---

## Overview

The Memex Racing Game is built with a modular architecture using Phaser.js 3.x as the core game engine. The system features:

- **Modular Design**: Separated into core engine, systems, UI components, and streaming integration
- **Configuration-Driven**: JSON-based configuration system with hot-reload support
- **Real-time Multiplayer**: Socket.io-based multiplayer with room management
- **Tournament System**: Complete bracket management with streaming integration
- **Asset Management**: Dynamic asset loading with validation and optimization
- **Streaming Ready**: OBS WebSocket integration and REST API for live streaming

---

## Architecture

### System Overview

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   UI Manager    │  │  Game Engine    │  │ Streaming API   │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ - MapSelection  │  │ - PhysicsManager│  │ - REST Endpoints│
│ - PlayerSetup   │  │ - RenderManager │  │ - WebSocket     │
│ - DebugPanel    │  │ - CameraManager │  │ - OBS Integration│
│ - AssetBrowser  │  │ - AIPlayerMgr   │  │ - Tournament UI │
│ - PresetManager │  │ - TrackTemplate │  │                 │
│ - PreviewSystem │  │ - ConfigManager │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                              │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Tournament Mgr  │  │ Multiplayer Mgr │  │  Asset Manager  │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ - BracketManager│  │ - RoomManager   │  │ - AssetLoader   │
│ - StateManager  │  │ - EventSystem   │  │ - AssetValidator│
│ - StreamingInteg│  │ - QuickPlay     │  │ - AssetTypes    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## Core Engine APIs

### GameEngine

The main orchestrator for the entire game system.

#### Constructor

```typescript
/**
 * @param {Object} config - Game engine configuration
 * @param {number} config.width - Game canvas width (default: 1920)
 * @param {number} config.height - Game canvas height (default: 1080)
 * @param {number} config.maxPlayers - Maximum players per race (default: 6)
 * @param {number} config.raceTimeLimit - Race time limit in seconds (default: 300)
 * @param {Object} config.configManager - Configuration manager options
 */
constructor(config = {})
```

#### Core Methods

```typescript
/**
 * Initialize and start the game engine
 * @returns {Phaser.Game} The Phaser game instance
 */
async start(): Promise<Phaser.Game>

/**
 * Stop the game engine and cleanup resources
 */
stop(): void

/**
 * Get current game state
 * @returns {Object} Current game state
 */
getGameState(): {
  raceActive: boolean;
  bettingPhase: boolean;
  gameTime: number;
  currentMap: string;
  debugMode: boolean;
  humanPlayerCount: number;
}

/**
 * Get performance statistics
 * @returns {Object} Performance metrics
 */
getPerformanceStats(): {
  frameCount: number;
  currentFPS: number;
  lastFPSCheck: number;
}

/**
 * Set human player count for multiplayer
 * @param {number} count - Number of human players (1-6)
 */
setHumanPlayerCount(count: number): void

/**
 * Generate new map combination using track templates
 */
async generateNewMapCombination(): Promise<void>
```

#### Configuration Access

```typescript
/**
 * Get configuration value using path notation
 * @param {string} configType - Configuration type (from ConfigType enum)
 * @param {string} path - Dot-notation path (e.g., 'game.maxPlayers')
 * @param {any} defaultValue - Default value if not found
 * @returns {any} Configuration value
 */
getConfigValue(configType: string, path: string, defaultValue?: any): any

/**
 * Get game setting value
 * @param {string} path - Path to setting
 * @param {any} defaultValue - Default value
 * @returns {any} Setting value
 */
getGameSetting(path: string, defaultValue?: any): any

/**
 * Update configuration at runtime
 * @param {string} configType - Configuration type
 * @param {Object} updates - Configuration updates
 * @param {Object} options - Update options
 */
async updateConfig(configType: string, updates: object, options?: object): Promise<object>
```

#### Camera Control

```typescript
/**
 * Set camera mode
 * @param {string} mode - Camera mode ('overview', 'follow_player', 'free')
 * @param {Object} options - Mode-specific options
 */
setCameraMode(mode: string, options?: object): void

/**
 * Follow specific player with camera
 * @param {number} playerId - Player index to follow
 * @param {Object} options - Follow options
 */
followPlayer(playerId: number, options?: object): void

/**
 * Move camera to specific position
 * @param {Object} position - Target position {x, y}
 * @param {number} zoom - Target zoom level
 * @param {Object} options - Transition options
 */
moveCameraTo(position: {x: number, y: number}, zoom: number, options?: object): Promise<void>

/**
 * Add camera preset
 * @param {string} name - Preset name
 * @param {Object} position - Position {x, y}
 * @param {number} zoom - Zoom level
 * @param {number} rotation - Rotation angle (default: 0)
 * @param {string} description - Preset description
 */
addCameraPreset(name: string, position: object, zoom: number, rotation?: number, description?: string): void
```

#### Event System

```typescript
/**
 * Add event listener
 * @param {string} eventName - Event name
 * @param {Function} handler - Event handler function
 */
on(eventName: string, handler: Function): void

/**
 * Remove event listener
 * @param {string} eventName - Event name
 * @param {Function} handler - Event handler function
 */
off(eventName: string, handler: Function): void

/**
 * Emit event
 * @param {string} eventName - Event name
 * @param {Object} data - Event data
 */
emit(eventName: string, data?: object): void
```

#### Available Events

- `preload-complete` - Asset preloading finished
- `scene-created` - Game scene initialized
- `scene-updated` - Game loop update (with time, delta)
- `players-spawned` - Players created and positioned
- `token-spawned` - M token placed on map
- `betting-phase-started` - Betting period begins
- `race-started` - Race begins
- `race-won` - Player reaches M token
- `race-timeout` - Race time limit reached
- `race-reset` - Race restarted for next round
- `configuration-updated` - Configuration changed
- `camera-mode-changed` - Camera mode switched
- `debug-toggled` - Debug mode toggled

---

### PhysicsManager

Handles all physics, collision detection, and player movement.

```typescript
/**
 * Initialize physics system
 * @param {GameEngine} gameEngine - Game engine instance
 */
initializePhysics(gameEngine: GameEngine): void

/**
 * Create player physics body
 * @param {number} index - Player index
 * @param {Object} position - Starting position {x, y}
 * @param {boolean} isAI - Whether player is AI controlled
 * @param {Object} aiData - AI player data
 * @returns {Object} Player physics object
 */
createPlayerPhysics(index: number, position: object, isAI: boolean, aiData?: object): object

/**
 * Get random valid spawn position
 * @returns {Object} Position {x, y}
 */
getRandomValidPosition(): {x: number, y: number}

/**
 * Get position farthest from start (for M token)
 * @param {Object} startPos - Starting position {x, y}
 * @returns {Object} Farthest position {x, y}
 */
getFarthestPositionFromStart(startPos: object): {x: number, y: number}

/**
 * Apply booster effect to player
 * @param {Object} player - Player object
 * @param {Object} booster - Booster object
 */
applyBooster(player: object, booster: object): void

/**
 * Activate skill effect
 * @param {Object} player - Player object
 * @param {Object} skill - Skill object
 */
activateSkill(player: object, skill: object): void

/**
 * Handle collision between players
 * @param {Object} player1 - First player
 * @param {Object} player2 - Second player
 */
handlePlayerCollision(player1: object, player2: object): void
```

---

### RenderManager

Manages all visual rendering, sprites, and UI elements.

```typescript
/**
 * Initialize rendering system
 * @param {GameEngine} gameEngine - Game engine instance
 */
initializeScene(gameEngine: GameEngine): void

/**
 * Preload game assets
 * @param {GameEngine} gameEngine - Game engine instance
 */
preloadAssets(gameEngine: GameEngine): void

/**
 * Create player sprite
 * @param {number} index - Player index
 * @param {Object} position - Position {x, y}
 * @param {boolean} isAI - Whether player is AI
 * @param {Object} aiData - AI player data
 * @returns {Object} Player sprite data
 */
createPlayerSprite(index: number, position: object, isAI: boolean, aiData?: object): object

/**
 * Create booster sprite
 * @param {GameEngine} gameEngine - Game engine instance
 * @returns {Object} Booster sprite
 */
createBooster(gameEngine: GameEngine): object

/**
 * Create skill sprite
 * @param {GameEngine} gameEngine - Game engine instance
 * @returns {Object} Skill sprite
 */
createSkill(gameEngine: GameEngine): object

/**
 * Show booster effect
 * @param {Object} player - Player object
 * @param {Object} booster - Booster object
 */
showBoosterEffect(player: object, booster: object): void

/**
 * Show skill effect
 * @param {Object} player - Player object
 * @param {Object} skill - Skill object
 */
showSkillEffect(player: object, skill: object): void

/**
 * Load dynamic map visuals
 * @param {Object} combination - Map combination data
 */
async loadDynamicMapVisuals(combination: object): Promise<void>
```

---

## Configuration System

### ConfigManager

Advanced configuration system with validation, hot-reload, and schema support.

#### Configuration Types

```typescript
export const ConfigType = {
  GAME_SETTINGS: 'game-settings',
  PLAYER_PREFERENCES: 'player-preferences',
  TRACK_CONFIGURATIONS: 'track-configurations',
  POWER_UP_DEFINITIONS: 'power-up-definitions',
  AUDIO_SETTINGS: 'audio-settings',
  VISUAL_SETTINGS: 'visual-settings',
  MULTIPLAYER_SETTINGS: 'multiplayer-settings'
}
```

#### Constructor

```typescript
/**
 * @param {Object} config - Configuration manager options
 * @param {string} config.configDirectory - Configuration files directory
 * @param {string} config.schemaDirectory - Schema files directory
 * @param {boolean} config.enableValidation - Enable JSON schema validation
 * @param {boolean} config.enableHotReload - Enable file watching for hot reload
 * @param {boolean} config.enableCache - Enable LRU caching
 * @param {number} config.cacheSize - Cache size limit
 * @param {boolean} config.autoLoad - Auto-load default configurations
 */
constructor(config?: object)
```

#### Core Methods

```typescript
/**
 * Load configuration file
 * @param {string} configType - Configuration type
 * @param {Object} options - Load options
 * @returns {Promise<Object>} Configuration data
 */
async loadConfiguration(configType: string, options?: object): Promise<object>

/**
 * Get configuration data
 * @param {string} configType - Configuration type
 * @returns {Object|null} Configuration data
 */
getConfiguration(configType: string): object | null

/**
 * Get configuration value with path notation
 * @param {string} configType - Configuration type
 * @param {string} path - Dot-notation path
 * @param {any} defaultValue - Default value
 * @returns {any} Configuration value
 */
getConfigValue(configType: string, path: string, defaultValue?: any): any

/**
 * Update configuration data
 * @param {string} configType - Configuration type
 * @param {Object} updates - Updates to apply
 * @param {Object} options - Update options
 * @returns {Promise<Object>} Updated configuration
 */
async updateConfiguration(configType: string, updates: object, options?: object): Promise<object>

/**
 * Validate configuration against schema
 * @param {string} configType - Configuration type
 * @param {Object} configData - Configuration data
 * @returns {Promise<ValidationResult>} Validation result
 */
async validateConfiguration(configType: string, configData: object): Promise<ValidationResult>
```

#### Event System

```typescript
/**
 * Add configuration event listener
 * @param {string} eventType - Event type
 * @param {Function} listener - Event listener
 */
addEventListener(eventType: string, listener: Function): void

/**
 * Remove configuration event listener
 * @param {string} eventType - Event type
 * @param {Function} listener - Event listener
 */
removeEventListener(eventType: string, listener: Function): void
```

#### Configuration Events

- `configurationLoaded` - Configuration file loaded
- `configurationUpdated` - Configuration updated at runtime
- `configurationHotReloaded` - Configuration hot-reloaded from file
- `allConfigurationsReloaded` - All configurations reloaded

#### Example Configuration Files

**game-settings.json**

```json
{
  "game": {
    "maxPlayers": 6,
    "raceTimeLimit": 300,
    "fillWithAI": true
  },
  "physics": {
    "baseSpeed": 100,
    "maxSpeed": 300,
    "acceleration": 50,
    "friction": 0.8
  },
  "movement": {
    "randomizationFactor": 0.5,
    "stuckDetectionFrames": 60,
    "unstuckTeleportRange": 100
  },
  "randomization": {
    "biorhythmCycles": {
      "short": { "min": 30, "max": 60 },
      "medium": { "min": 60, "max": 120 },
      "long": { "min": 120, "max": 300 }
    }
  },
  "debug": {
    "enabled": false,
    "showCollisionBoxes": false,
    "showDebugInfo": true
  }
}
```

**visual-settings.json**

```json
{
  "display": {
    "resolution": {
      "width": 1920,
      "height": 1080,
      "autoDetect": true
    },
    "pixelArt": true,
    "antialias": false
  },
  "camera": {
    "defaultMode": "overview",
    "followOffset": { "x": 0, "y": -50 },
    "zoomLimits": { "min": 0.5, "max": 2.0 },
    "transitionSpeed": 1000
  },
  "effects": {
    "particleEffects": true,
    "screenShake": true,
    "glowEffects": true
  }
}
```

---

## UI Component APIs

### UIManager

Central manager for all UI components and panels.

```typescript
/**
 * Initialize UI system
 */
async initialize(): Promise<void>

/**
 * Toggle panel visibility
 * @param {string} panelName - Panel name
 */
togglePanel(panelName: string): void

/**
 * Show specific panel
 * @param {string} panelName - Panel name
 */
showPanel(panelName: string): void

/**
 * Hide specific panel
 * @param {string} panelName - Panel name
 */
hidePanel(panelName: string): void

/**
 * Update game data
 * @param {Object} newData - New game data
 */
updateGameData(newData: object): void

/**
 * Set AssetManager reference
 * @param {AssetManager} assetManager - Asset manager instance
 */
setAssetManager(assetManager: AssetManager): void

/**
 * Set ConfigManager reference
 * @param {ConfigManager} configManager - Configuration manager instance
 */
setConfigManager(configManager: ConfigManager): void

/**
 * Set GameEngine reference
 * @param {GameEngine} gameEngine - Game engine instance
 */
setGameEngine(gameEngine: GameEngine): void
```

#### Available Panels

- `playerSetup` - Player configuration and sprite selection
- `mapSelection` - Map rotation and manual selection
- `betting` - Betting interface during betting phase
- `leaderboard` - Player rankings and statistics
- `debug` - Debug information and controls
- `assetBrowser` - Asset management and browsing
- `presetManager` - Configuration preset management
- `previewSystem` - Live game state preview
- `trackEditor` - Track template editor
- `analytics` - Game analytics and history
- `invite` - Multiplayer room invitation modal
- `tournamentLobby` - Tournament management interface
- `tournamentBracket` - Tournament bracket visualization
- `tournamentResults` - Tournament results display

#### Keyboard Shortcuts

- `I` - Toggle invite modal
- `P` - Toggle player setup panel
- `B` - Toggle betting panel
- `L` - Toggle leaderboard panel
- `M` - Toggle map selection
- `A` - Toggle asset browser
- `R` - Toggle preset manager
- `V` - Toggle preview system
- `E` - Toggle track editor
- `Y` - Toggle analytics panel
- `T` - Toggle tournament lobby
- `G` - Toggle tournament bracket
- `U` - Toggle tournament results
- `D` - Toggle debug panel
- `Escape` - Close all modals

### Individual Component APIs

#### MapSelectionPanel

```typescript
/**
 * Initialize map selection panel
 */
async initialize(): Promise<void>

/**
 * Update race statistics
 * @param {Object} raceData - Race completion data
 */
updateRaceStats(raceData: object): void

/**
 * Handle race completion for map rotation
 */
onRaceCompleted(): void

/**
 * Show/hide panel
 */
toggle(): void
```

#### PlayerSetupPanel

```typescript
/**
 * Set current player assignment
 * @param {number} playerIndex - Player index (0-5)
 */
setCurrentPlayer(playerIndex: number): void

/**
 * Update map information display
 * @param {string} mapName - Current map name
 * @param {number} racesLeft - Races until map change
 */
updateMapInfo(mapName: string, racesLeft: number): void

/**
 * Reset for new race
 */
resetForNewRace(): void

/**
 * Get current player setup state
 * @returns {Object} Player setup configuration
 */
getPlayerSetupState(): object
```

#### DebugPanel

```typescript
/**
 * Set current scene reference
 * @param {Phaser.Scene} scene - Phaser scene instance
 */
setCurrentScene(scene: Phaser.Scene): void

/**
 * Update current player data
 * @param {number} playerIndex - Current player index
 * @param {Array} players - All players array
 */
setCurrentPlayer(playerIndex: number, players: object[]): void

/**
 * Update stuck positions data
 * @param {Array} stuckPositions - Array of problematic positions
 */
updateStuckPositions(stuckPositions: object[]): void

/**
 * Update map information
 * @param {string} mapName - Current map name
 */
updateMapInfo(mapName: string): void
```

#### AssetBrowser

```typescript
/**
 * Set asset manager reference
 * @param {AssetManager} assetManager - Asset manager instance
 */
setAssetManager(assetManager: AssetManager): void

/**
 * Refresh asset listings
 */
async refreshAssets(): Promise<void>

/**
 * Load asset preview
 * @param {string} assetPath - Path to asset
 * @param {string} assetType - Asset type (sprite, sound, map)
 */
async loadAssetPreview(assetPath: string, assetType: string): Promise<void>
```

#### PresetManager

```typescript
/**
 * Save current configuration as preset
 * @param {string} presetName - Name for the preset
 * @param {string} description - Preset description
 * @returns {Promise<boolean>} Success status
 */
async savePreset(presetName: string, description?: string): Promise<boolean>

/**
 * Load configuration preset
 * @param {string} presetName - Preset name to load
 * @returns {Promise<boolean>} Success status
 */
async loadPreset(presetName: string): Promise<boolean>

/**
 * Delete configuration preset
 * @param {string} presetName - Preset name to delete
 * @returns {Promise<boolean>} Success status
 */
async deletePreset(presetName: string): Promise<boolean>

/**
 * Get list of available presets
 * @returns {Promise<Array>} List of preset objects
 */
async getPresetList(): Promise<object[]>
```

---

## Streaming & Tournament APIs

### StreamingAPI

REST API server for streaming data and external tool integration.

#### Endpoints

**Race Data**

```http
GET /api/race/current
```

Response:

```json
{
  "success": true,
  "data": {
    "isActive": true,
    "phase": "racing",
    "timeRemaining": 240,
    "raceNumber": 15,
    "currentMap": "classic",
    "players": [
      {
        "id": "player_1",
        "name": "Player 1",
        "position": { "x": 150, "y": 200 },
        "isActive": true,
        "effects": {
          "boosted": false,
          "magnetized": true,
          "bubbleProtected": false,
          "stunned": false
        },
        "distanceToToken": 450,
        "rank": 1
      }
    ],
    "mTokenPosition": { "x": 600, "y": 800 },
    "raceProgress": 65
  },
  "timestamp": 1647890123456
}
```

**Betting Data**

```http
GET /api/betting/current
```

Response:

```json
{
  "success": true,
  "data": {
    "isActive": true,
    "timeRemaining": 25,
    "totalPool": 2500,
    "playerOdds": [
      {
        "playerId": "player_1",
        "odds": 2.5,
        "playerName": "Player 1",
        "totalBets": 800
      }
    ],
    "recentBets": [
      {
        "playerId": "player_3",
        "playerName": "Player 3",
        "amount": 100,
        "odds": 4.2,
        "timestamp": 1647890120000
      }
    ]
  },
  "timestamp": 1647890123456
}
```

**Player Data**

```http
GET /api/players
GET /api/players/:playerId
```

**Leaderboard**

```http
GET /api/leaderboard
```

**Game Status**

```http
GET /api/game/status
```

**Camera Control**

```http
POST /api/camera/control
```

Request body:

```json
{
  "type": "setMode",
  "mode": "follow_player",
  "options": { "playerId": "player_1" }
}
```

```json
{
  "type": "setPosition",
  "position": { "x": 400, "y": 300 },
  "smooth": true
}
```

**Tournament Data**

```http
GET /api/tournament/current
GET /api/tournament/bracket
GET /api/tournament/standings
GET /api/tournament/match/:matchId
GET /api/tournament/commentary
```

**All Streaming Data**

```http
GET /api/streaming/all
```

#### Starting the Streaming API

```typescript
import { StreamingAPI } from './src/streaming/api/StreamingAPI.js';

const streamingAPI = new StreamingAPI(gameEngine, 3001);
await streamingAPI.start();
```

### TournamentManager

Comprehensive tournament system with bracket management.

#### Core Methods

```typescript
/**
 * Create a new tournament
 * @param {Object} tournamentConfig - Tournament configuration
 * @param {string} creatorId - Tournament creator ID
 * @returns {Promise<Object>} Tournament creation result
 */
async createTournament(tournamentConfig: object, creatorId: string): Promise<object>

/**
 * Register player for tournament
 * @param {string} tournamentId - Tournament ID
 * @param {Object} playerData - Player registration data
 * @returns {Promise<Object>} Registration result
 */
async registerPlayer(tournamentId: string, playerData: object): Promise<object>

/**
 * Start tournament when conditions are met
 * @param {string} tournamentId - Tournament ID
 */
async startTournament(tournamentId: string): Promise<void>

/**
 * Handle tournament match completion
 * @param {string} tournamentId - Tournament ID
 * @param {string} matchId - Match ID
 * @param {Object} results - Match results
 */
async handleMatchCompletion(tournamentId: string, matchId: string, results: object): Promise<void>

/**
 * Get tournament details
 * @param {string} tournamentId - Tournament ID
 * @param {string} playerId - Optional player ID for additional details
 * @returns {Object} Tournament details
 */
getTournamentDetails(tournamentId: string, playerId?: string): object

/**
 * List active tournaments
 * @returns {Array} Active tournaments
 */
listActiveTournaments(): object[]
```

#### Tournament Configuration

```typescript
const tournamentConfig = {
  name: "Memex Racing Championship",
  format: "single_elimination", // or "double_elimination", "round_robin"
  maxPlayers: 32,
  minPlayers: 8,
  raceTimeLimit: 300,
  playersPerRace: 6,
  bettingEnabled: true,
  spectatorCount: 100,
  registrationTimeLimit: 600, // seconds
  prizePool: 1000
};

const result = await tournamentManager.createTournament(tournamentConfig, "creator_id");
```

---

## Multiplayer System

### RoomManager

Manages multiplayer rooms and player connections.

```typescript
/**
 * Create or join a multiplayer room
 * @param {Object} roomConfig - Room configuration
 * @param {string} playerId - Player ID
 * @returns {Object} Room join result
 */
joinOrCreateRoom(roomConfig: object, playerId: string): object

/**
 * Leave multiplayer room
 * @param {string} roomCode - Room code
 * @param {string} playerId - Player ID
 */
leaveRoom(roomCode: string, playerId: string): void

/**
 * Start race in room
 * @param {string} roomCode - Room code
 */
startRace(roomCode: string): void

/**
 * Get room status
 * @param {string} roomCode - Room code
 * @returns {Object} Room status
 */
getRoomStatus(roomCode: string): object
```

### MultiplayerEvents

Event system for multiplayer communication.

```typescript
export const MULTIPLAYER_EVENTS = {
  ROOM_CREATED: 'room_created',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  GAME_STARTED: 'game_started',
  RACE_FINISHED: 'race_finished',
  TOURNAMENT_CREATED: 'tournament_created',
  TOURNAMENT_STARTED: 'tournament_started',
  TOURNAMENT_COMPLETED: 'tournament_completed'
};

// Usage
import { multiplayerEvents, MULTIPLAYER_EVENTS } from './src/multiplayer/MultiplayerEvents.js';

multiplayerEvents.on(MULTIPLAYER_EVENTS.PLAYER_JOINED, (data) => {
  console.log(`Player ${data.playerName} joined room ${data.roomCode}`);
});
```

---

## Asset Management

### AssetManager

Dynamic asset loading and management system.

```typescript
/**
 * Load asset dynamically
 * @param {string} assetPath - Path to asset
 * @param {string} assetType - Asset type
 * @param {Object} options - Load options
 * @returns {Promise<Object>} Loaded asset
 */
async loadAsset(assetPath: string, assetType: string, options?: object): Promise<object>

/**
 * Validate asset integrity
 * @param {string} assetPath - Path to asset
 * @param {string} assetType - Asset type
 * @returns {Promise<boolean>} Validation result
 */
async validateAsset(assetPath: string, assetType: string): Promise<boolean>

/**
 * Get asset information
 * @param {string} assetPath - Path to asset
 * @returns {Object} Asset metadata
 */
getAssetInfo(assetPath: string): object

/**
 * Preload assets for performance
 * @param {Array} assetList - List of assets to preload
 * @returns {Promise<void>} Preload completion
 */
async preloadAssets(assetList: string[]): Promise<void>
```

### Asset Types

```typescript
export const AssetTypes = {
  SPRITE: 'sprite',
  AUDIO: 'audio',
  MAP_BACKGROUND: 'map_background',
  MAP_FOREGROUND: 'map_foreground',
  TRACK_TEMPLATE: 'track_template',
  UI_ASSET: 'ui_asset',
  PARTICLE_EFFECT: 'particle_effect'
};
```

---

## Event System

### Core Events

The game engine uses a comprehensive event system for communication between components.

#### Game Events

```typescript
// Race lifecycle events
gameEngine.on('betting-phase-started', (data) => {
  console.log('Betting phase started:', data);
});

gameEngine.on('race-started', (data) => {
  console.log('Race started with', data.playerCount, 'players');
});

gameEngine.on('race-won', (data) => {
  console.log('Race won by:', data.winner.name);
});

gameEngine.on('race-timeout', (data) => {
  console.log('Race timed out');
});

// Configuration events
gameEngine.on('configuration-updated', (data) => {
  console.log('Configuration updated:', data.type);
});

// Camera events
gameEngine.on('camera-mode-changed', (data) => {
  console.log('Camera mode changed:', data.newMode);
});
```

#### UI Events

```typescript
// Panel state changes
uiManager.on('panel-toggled', (data) => {
  console.log('Panel toggled:', data.panelName, data.visible);
});

// Map selection
uiManager.on('map-changed', (data) => {
  console.log('Map changed to:', data.newMap);
});

// Player setup
uiManager.on('player-setup-changed', (data) => {
  console.log('Player setup updated:', data.playerIndex, data.settings);
});
```

#### Multiplayer Events

```typescript
// Room events
multiplayerEvents.on(MULTIPLAYER_EVENTS.ROOM_CREATED, (data) => {
  console.log('Room created:', data.roomCode);
});

multiplayerEvents.on(MULTIPLAYER_EVENTS.PLAYER_JOINED, (data) => {
  console.log('Player joined:', data.playerName);
});

// Tournament events
multiplayerEvents.on('TOURNAMENT_STARTED', (data) => {
  console.log('Tournament started:', data.tournamentId);
});
```

---

## Integration Examples

### Basic Game Setup

```typescript
import { GameEngine } from './src/game/engine/GameEngine.js';
import { UIManager } from './src/ui/UIManager.js';
import { StreamingAPI } from './src/streaming/api/StreamingAPI.js';

// Initialize game engine
const gameConfig = {
  width: 1920,
  height: 1080,
  maxPlayers: 6,
  raceTimeLimit: 300
};

const gameEngine = new GameEngine(gameConfig);

// Initialize UI
const uiManager = new UIManager(gameEngine);
await uiManager.initialize();

// Connect systems
uiManager.setGameEngine(gameEngine);
uiManager.setConfigManager(gameEngine.configManager);

// Start game
await gameEngine.start();

// Optional: Start streaming API
const streamingAPI = new StreamingAPI(gameEngine, 3001);
await streamingAPI.start();
```

### Configuration Management Example

```typescript
import { ConfigManager, ConfigType } from './src/game/systems/ConfigManager.js';

const configManager = new ConfigManager({
  enableValidation: true,
  enableHotReload: true,
  enableCache: true
});

// Load game settings
const gameSettings = await configManager.loadConfiguration(ConfigType.GAME_SETTINGS);

// Update configuration
await configManager.updateConfiguration(ConfigType.GAME_SETTINGS, {
  game: {
    maxPlayers: 8,
    raceTimeLimit: 240
  }
}, {
  validate: true,
  persist: true
});

// Listen for configuration changes
configManager.addEventListener('configurationUpdated', (data) => {
  console.log('Configuration updated:', data.type);
});
```

### Tournament Integration Example

```typescript
import { TournamentManager } from './src/tournament/TournamentManager.js';

const tournamentManager = new TournamentManager(authManager, gameEngine);
await tournamentManager.initialize();

// Create tournament
const tournamentConfig = {
  name: "Weekly Championship",
  format: "single_elimination",
  maxPlayers: 16,
  minPlayers: 4,
  bettingEnabled: true,
  prizePool: 500
};

const tournament = await tournamentManager.createTournament(
  tournamentConfig, 
  "organizer_id"
);

// Register players
await tournamentManager.registerPlayer(tournament.tournament.tournamentId, {
  playerId: "player_1",
  playerName: "Pro Racer",
  email: "player@example.com"
});

// Tournament will auto-start when conditions are met
```

### Custom UI Component Example

```typescript
class CustomPanel {
  constructor(uiManager) {
    this.uiManager = uiManager;
    this.isVisible = false;
    this.element = null;
  }

  async initialize() {
    // Create panel DOM element
    this.element = document.createElement('div');
    this.element.id = 'custom-panel';
    this.element.className = 'ui-panel custom-panel hidden';
    
    // Add to UI overlay
    const uiOverlay = document.getElementById('ui-overlay');
    uiOverlay.appendChild(this.element);
    
    // Setup content
    this.render();
    
    // Setup event listeners
    this.setupEventListeners();
  }

  render() {
    this.element.innerHTML = `
      <div class="panel-header">Custom Panel</div>
      <div class="panel-content">
        <p>Custom panel content here</p>
        <button id="custom-action-btn">Custom Action</button>
      </div>
    `;
  }

  setupEventListeners() {
    const actionBtn = this.element.querySelector('#custom-action-btn');
    actionBtn.addEventListener('click', () => {
      this.performCustomAction();
    });
  }

  toggle() {
    this.isVisible = !this.isVisible;
    this.element.classList.toggle('hidden', !this.isVisible);
  }

  show() {
    this.isVisible = true;
    this.element.classList.remove('hidden');
  }

  hide() {
    this.isVisible = false;
    this.element.classList.add('hidden');
  }

  performCustomAction() {
    // Custom functionality
    console.log('Custom action performed');
  }

  destroy() {
    if (this.element) {
      this.element.remove();
    }
  }
}

// Register with UI Manager
const customPanel = new CustomPanel(uiManager);
await customPanel.initialize();

// Add to UI Manager's panel system
uiManager.customPanel = customPanel;
```

---

## Customization Guide

### Adding New Configuration Types

1. **Define Configuration Type**

```typescript
// Add to ConfigType enum
export const ConfigType = {
  // ... existing types
  CUSTOM_SETTINGS: 'custom-settings'
};
```

2. **Create Configuration File**

```json
// data/config/custom-settings.json
{
  "customFeature": {
    "enabled": true,
    "options": {
      "setting1": "value1",
      "setting2": 42
    }
  }
}
```

3. **Create Schema (Optional)**

```json
// data/config/schemas/custom-settings.schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "customFeature": {
      "type": "object",
      "properties": {
        "enabled": { "type": "boolean" },
        "options": {
          "type": "object",
          "properties": {
            "setting1": { "type": "string" },
            "setting2": { "type": "integer", "minimum": 0 }
          }
        }
      },
      "required": ["enabled"]
    }
  }
}
```

4. **Add Custom Validation**

```typescript
// In ConfigManager.performCustomValidations()
case ConfigType.CUSTOM_SETTINGS:
  this.validateCustomSettings(configData, result);
  break;

validateCustomSettings(config, result) {
  if (config.customFeature?.options?.setting2 > 100) {
    result.addWarning('Setting2 value is very high');
  }
}
```

### Creating Custom Streaming Endpoints

```typescript
// Extend StreamingAPI class or add custom routes
streamingAPI.app.get('/api/custom/data', (req, res) => {
  try {
    const customData = {
      // Your custom data extraction logic
      customMetric: getCustomMetric(),
      timestamp: Date.now()
    };
    
    res.json({
      success: true,
      data: customData,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

### Adding Custom Tournament Formats

```typescript
// Create custom tournament format
class CustomTournamentFormat extends TournamentFormat {
  constructor() {
    super();
    this.formatName = 'custom_format';
  }

  generateBracket(players) {
    // Custom bracket generation logic
    return {
      rounds: this.createCustomRounds(players),
      totalRounds: this.calculateTotalRounds(players.length)
    };
  }

  createCustomRounds(players) {
    // Implementation specific to your format
  }
}

// Register format with TournamentManager
tournamentManager.config.supportedFormats.push('custom_format');
```

### Extending Asset Types

```typescript
// Add new asset type
export const AssetTypes = {
  // ... existing types
  CUSTOM_ASSET: 'custom_asset'
};

// Add validation logic to AssetValidator
validateCustomAsset(assetData, path) {
  const validation = new ValidationResult(true);
  
  // Custom validation logic
  if (!assetData.customProperty) {
    validation.addError('Custom property is required');
  }
  
  return validation;
}
```

### Performance Optimization Tips

1. **Configuration Caching**

```typescript
// Enable caching for frequently accessed configurations
const configManager = new ConfigManager({
  enableCache: true,
  cacheSize: 100 // Adjust based on memory constraints
});
```

2. **Asset Preloading**

```typescript
// Preload critical assets
const criticalAssets = [
  'sprites/players/default/player1.png',
  'sprites/tokens/M_token.png',
  'sounds/effects/boost.wav'
];

await assetManager.preloadAssets(criticalAssets);
```

3. **Event System Optimization**

```typescript
// Remove event listeners when no longer needed
gameEngine.off('race-finished', handleRaceFinished);

// Use once() for one-time event listeners
gameEngine.once('initialization-complete', () => {
  console.log('Game initialized');
});
```

---

This comprehensive API documentation provides developers with all the necessary information to understand, extend, and customize the Memex Racing game system. The modular architecture allows for easy integration of new features while maintaining system stability and performance.