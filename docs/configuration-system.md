# Configuration Management System

The Configuration Management System provides a comprehensive, type-safe, and extensible way to manage game settings, player preferences, track configurations, and power-up definitions for the Memex Racing game.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Configuration Types](#configuration-types)
4. [Usage Examples](#usage-examples)
5. [Hot Reload](#hot-reload)
6. [Schema Validation](#schema-validation)
7. [API Reference](#api-reference)
8. [Content Creator Guide](#content-creator-guide)

## Overview

The ConfigManager system offers:

- **External Configuration**: JSON files stored in `data/config/` directory
- **Hot Reload Support**: Automatic configuration reloading during development
- **Schema Validation**: JSON Schema validation to prevent configuration errors
- **Type Safety**: Structured access to configuration values with fallbacks
- **Event System**: React to configuration changes in real-time
- **Caching**: LRU cache for improved performance
- **Content Creator Support**: Easy customization for modders and content creators

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   GameEngine    │────│   ConfigManager  │────│ Configuration   │
│                 │    │                  │    │ Files (.json)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                       ┌──────────────────┐
                       │ Schema Validator │
                       │ (JSON Schema)    │
                       └──────────────────┘
```

### Core Components

1. **ConfigManager**: Main configuration management class
2. **ValidationResult**: Configuration validation results
3. **ConfigEntry**: Individual configuration data container
4. **JSON Schemas**: Validation rules for each configuration type

## Configuration Types

### Game Settings (`game-settings.json`)

Core game mechanics and behavior settings:

```json
{
  "game": {
    "maxPlayers": 6,
    "raceTimeLimit": 300,
    "simultaneousRaces": 3
  },
  "physics": {
    "gravity": 0,
    "friction": 0.8,
    "bounce": 0.2
  },
  "movement": {
    "baseSpeed": 100,
    "maxSpeed": 300,
    "stuckThreshold": 30
  },
  "randomization": {
    "mersenneTwisterEnabled": true,
    "biorhythmCycles": {
      "short": { "min": 30, "max": 60 }
    }
  }
}
```

### Player Preferences (`player-preferences.json`)

User-specific settings and preferences:

```json
{
  "display": {
    "resolution": "auto",
    "fullscreen": false,
    "pixelPerfect": true
  },
  "audio": {
    "masterVolume": 0.8,
    "musicVolume": 0.6,
    "sfxVolume": 0.8
  },
  "controls": {
    "keyBindings": {
      "pause": "Escape",
      "debugToggle": "F1"
    }
  }
}
```

### Track Configurations (`track-configurations.json`)

Track layouts, spawn points, and map-specific settings:

```json
{
  "tracks": {
    "classic_maze": {
      "name": "Classic Maze",
      "difficulty": "medium",
      "dimensions": { "width": 4000, "height": 2000 },
      "startingAreas": [
        { "x": 200, "y": 1000, "radius": 50 }
      ],
      "tokenSpawnAreas": [
        { "x": 3800, "y": 1000, "radius": 100, "weight": 0.4 }
      ]
    }
  }
}
```

### Power-up Definitions (`power-up-definitions.json`)

Booster and skill definitions with effects and spawn rates:

```json
{
  "boosters": {
    "antenna_booster": {
      "name": "Antenna Booster",
      "effects": {
        "speedMultiplier": 1.8,
        "duration": 4500
      },
      "spawnWeight": 0.2
    }
  },
  "skills": {
    "thunder": {
      "name": "Thunder",
      "cooldown": 45000,
      "effects": {
        "type": "paralysis",
        "targets": 3,
        "duration": 3000
      }
    }
  }
}
```

## Usage Examples

### Basic Configuration Access

```javascript
import { ConfigManager, ConfigType } from './src/game/systems/ConfigManager';

// Initialize configuration manager
const configManager = new ConfigManager({
  enableHotReload: true,
  enableValidation: true
});

// Load a configuration
const gameSettings = await configManager.loadConfiguration(ConfigType.GAME_SETTINGS);

// Access configuration values
const maxPlayers = configManager.getConfigValue(
  ConfigType.GAME_SETTINGS, 
  'game.maxPlayers', 
  6 // default value
);

// Get entire configuration
const playerPrefs = configManager.getConfiguration(ConfigType.PLAYER_PREFERENCES);
```

### GameEngine Integration

```javascript
// In your GameEngine class
export class GameEngine {
  constructor(config = {}) {
    this.configManager = new ConfigManager({
      enableHotReload: process.env.NODE_ENV === 'development',
      enableValidation: true
    });
    
    // Setup configuration listeners
    this.configManager.addEventListener('configurationUpdated', (data) => {
      this.handleConfigurationUpdate(data);
    });
  }

  // Easy access methods
  getGameSetting(path, defaultValue = null) {
    return this.configManager.getConfigValue(
      ConfigType.GAME_SETTINGS, 
      path, 
      defaultValue
    );
  }
  
  // Example usage
  initializePhysics() {
    const gravity = this.getGameSetting('physics.gravity', 0);
    const friction = this.getGameSetting('physics.friction', 0.8);
    
    // Apply physics settings...
  }
}
```

### Runtime Configuration Updates

```javascript
// Update configuration during runtime
await configManager.updateConfiguration(
  ConfigType.GAME_SETTINGS,
  {
    game: {
      maxPlayers: 8 // Increase max players
    }
  },
  {
    validate: true,    // Validate the update
    persist: false,    // Don't save to file
    merge: true        // Merge with existing config
  }
);

// Reload all configurations
await configManager.reloadAllConfigurations();
```

## Hot Reload

Hot reload automatically detects configuration file changes and reloads them without restarting the game.

### Enabling Hot Reload

```javascript
const configManager = new ConfigManager({
  enableHotReload: true,
  watchFileChanges: true,
  reloadDelay: 500 // Debounce file changes
});
```

### Hot Reload Events

```javascript
// Listen for hot reload events
configManager.addEventListener('configurationHotReloaded', (data) => {
  console.log(`Configuration ${data.type} was hot-reloaded`);
  
  // Handle the reload (e.g., update UI, restart systems)
  switch (data.type) {
    case ConfigType.VISUAL_SETTINGS:
      this.renderManager.applyVisualSettings();
      break;
    case ConfigType.GAME_SETTINGS:
      this.applyGameSettings();
      break;
  }
});
```

## Schema Validation

JSON Schema validation ensures configuration integrity and provides helpful error messages.

### Schema Structure

Each configuration type has a corresponding schema file in `data/config/schemas/`:

```
data/config/schemas/
├── game-settings.schema.json
├── player-preferences.schema.json
├── track-configurations.schema.json
└── power-up-definitions.schema.json
```

### Custom Validation

Beyond JSON Schema, custom validation rules are applied:

```javascript
// Custom game settings validation
validateGameSettings(config, result) {
  // Ensure maxSpeed > baseSpeed
  if (config.movement?.maxSpeed <= config.movement?.baseSpeed) {
    result.addError('maxSpeed must be greater than baseSpeed');
  }
  
  // Warn about performance settings
  if (config.performance?.targetFPS < 30) {
    result.addWarning('targetFPS below 30 may result in poor gameplay');
  }
}
```

### Validation Results

```javascript
const result = await configManager.validateConfiguration(
  ConfigType.GAME_SETTINGS, 
  configData
);

if (!result.valid) {
  console.error('Validation errors:', result.errors);
  console.warn('Validation warnings:', result.warnings);
}
```

## API Reference

### ConfigManager Class

#### Constructor

```javascript
new ConfigManager(options)
```

**Options:**
- `configDirectory`: Configuration files directory (default: 'data/config')
- `schemaDirectory`: Schema files directory (default: 'data/config/schemas')
- `enableValidation`: Enable schema validation (default: true)
- `enableHotReload`: Enable hot reload (default: development mode)
- `enableCache`: Enable LRU caching (default: true)
- `cacheSize`: Maximum cached configurations (default: 50)
- `autoLoad`: Automatically load default configurations (default: true)

#### Methods

##### `loadConfiguration(configType, options)`

Load a specific configuration type.

**Parameters:**
- `configType`: Configuration type constant
- `options`: Loading options (validate, useCache, enableHotReload, etc.)

**Returns:** Promise<Object> - Configuration data

##### `getConfiguration(configType)`

Get loaded configuration data.

**Parameters:**
- `configType`: Configuration type constant

**Returns:** Object|null - Configuration data or null if not found

##### `getConfigValue(configType, path, defaultValue)`

Get nested configuration value using dot notation.

**Parameters:**
- `configType`: Configuration type constant
- `path`: Dot-separated path (e.g., 'game.maxPlayers')
- `defaultValue`: Fallback value if path not found

**Returns:** Any - Configuration value or default

##### `updateConfiguration(configType, updates, options)`

Update configuration at runtime.

**Parameters:**
- `configType`: Configuration type constant
- `updates`: Object containing updates
- `options`: Update options (validate, persist, merge)

**Returns:** Promise<Object> - Updated configuration

##### `validateConfiguration(configType, configData)`

Validate configuration against schema.

**Parameters:**
- `configType`: Configuration type constant
- `configData`: Configuration data to validate

**Returns:** Promise<ValidationResult> - Validation results

##### Event Methods

- `addEventListener(eventType, listener)`: Add event listener
- `removeEventListener(eventType, listener)`: Remove event listener
- `emitEvent(eventType, data)`: Emit event (internal use)

#### Events

- `configurationLoaded`: Configuration loaded successfully
- `configurationUpdated`: Configuration updated at runtime
- `configurationHotReloaded`: Configuration hot-reloaded from file
- `allConfigurationsReloaded`: All configurations reloaded

### Configuration Types Constants

```javascript
import { ConfigType } from './ConfigManager';

ConfigType.GAME_SETTINGS          // 'game-settings'
ConfigType.PLAYER_PREFERENCES     // 'player-preferences'
ConfigType.TRACK_CONFIGURATIONS   // 'track-configurations'
ConfigType.POWER_UP_DEFINITIONS   // 'power-up-definitions'
ConfigType.AUDIO_SETTINGS         // 'audio-settings'
ConfigType.VISUAL_SETTINGS        // 'visual-settings'
ConfigType.MULTIPLAYER_SETTINGS   // 'multiplayer-settings'
```

## Content Creator Guide

The configuration system is designed to support content creators and modders.

### Creating Custom Tracks

1. **Edit track-configurations.json**:

```json
{
  "tracks": {
    "my_custom_track": {
      "name": "My Custom Track",
      "difficulty": "hard",
      "dimensions": { "width": 5000, "height": 2500 },
      "startingAreas": [
        { "x": 250, "y": 1250, "radius": 60 }
      ],
      "tokenSpawnAreas": [
        { "x": 4750, "y": 1250, "radius": 120, "weight": 1.0 }
      ],
      "boosterSpawns": {
        "maxActive": 10,
        "spawnRate": 0.07,
        "locations": [
          { "x": 1000, "y": 1250, "type": "speed" },
          { "x": 2500, "y": 1250, "type": "random" },
          { "x": 4000, "y": 1250, "type": "speed" }
        ]
      },
      "collisionData": "maps/tracks/my_custom_track_collision.png",
      "backgroundImage": "maps/backgrounds/my_custom_track.png",
      "foregroundImage": "maps/foregrounds/my_custom_track.png"
    }
  }
}
```

2. **Create collision and background images** in the specified paths
3. **Test your track** using the map selection system (press 'M' in game)

### Creating Custom Power-ups

1. **Edit power-up-definitions.json**:

```json
{
  "boosters": {
    "my_super_booster": {
      "name": "Super Speed Booster",
      "description": "Ultra-fast speed boost",
      "icon": "sprites/boosters/my_super_booster.png",
      "rarity": "legendary",
      "effects": {
        "speedMultiplier": 4.0,
        "duration": 2000,
        "visualEffect": "rainbow_trail"
      },
      "spawnWeight": 0.01,
      "glowColor": "#ff00ff"
    }
  }
}
```

2. **Add booster sprite** at the specified icon path
3. **Implement visual effect** (if custom effect needed)

### Tuning Game Balance

Modify game-settings.json to adjust game balance:

```json
{
  "movement": {
    "baseSpeed": 120,      // Increase base speed
    "maxSpeed": 400,       // Increase max speed
    "acceleration": 200    // Faster acceleration
  },
  "spawning": {
    "boosterSpawnRate": 0.08,  // More frequent boosters
    "maxActiveBoosters": 12    // More boosters on screen
  }
}
```

### Validation and Testing

1. **Use schema validation** to catch configuration errors
2. **Enable hot reload** for rapid iteration
3. **Test with multiple configurations** to ensure compatibility
4. **Monitor console** for validation warnings and errors

### Best Practices

1. **Always validate** your configurations
2. **Use meaningful names** for custom content
3. **Document your changes** in configuration comments (where supported)
4. **Test performance impact** of your changes
5. **Backup original files** before modifying

### Distribution

To share your custom configurations:

1. **Package configuration files** with your mod
2. **Include schema validation** in your distribution
3. **Provide installation instructions**
4. **Test on clean installations**

## Performance Considerations

- **Caching**: Configuration data is cached using LRU eviction
- **Lazy Loading**: Configurations are loaded on-demand
- **Debounced Hot Reload**: File changes are debounced to prevent excessive reloading
- **Memory Management**: Automatic cleanup of unused configurations

## Troubleshooting

### Common Issues

1. **Configuration not loading**
   - Check file path and naming
   - Verify JSON syntax
   - Check browser console for errors

2. **Validation errors**
   - Review schema requirements
   - Check data types and ranges
   - Use validation tools

3. **Hot reload not working**
   - Ensure `enableHotReload` is true
   - Check file permissions
   - Verify file watcher setup

4. **Performance issues**
   - Reduce cache size if memory is limited
   - Disable validation in production
   - Minimize configuration file sizes

### Debug Information

Enable debug logging:

```javascript
const configManager = new ConfigManager({
  logLevel: 'verbose'
});

// Get detailed statistics
const stats = configManager.getStats();
console.log('Configuration Statistics:', stats);
```

## Migration Guide

When updating configuration formats:

1. **Version your configurations** using the `version` field
2. **Provide migration utilities** for breaking changes
3. **Maintain backward compatibility** when possible
4. **Document breaking changes** clearly

---

This configuration system provides a solid foundation for managing game settings while supporting content creators and maintaining performance. The combination of schema validation, hot reload, and event-driven updates makes it suitable for both development and production environments.