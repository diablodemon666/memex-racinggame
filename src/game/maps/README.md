# Maps System Documentation

## Overview

The Maps system provides procedural track generation and automatic map rotation for the Memex Racing game. It features 6 unique map generators with different difficulty levels and visual themes.

## Map Generators

### 1. ClassicMazeGenerator
- **Difficulty**: Medium
- **Theme**: Dark green background with white paths
- **Features**: Complex maze with corridors, bridges, dead ends, and strategic branches
- **Best For**: Strategic navigation and pathfinding challenges

### 2. SpeedwayGenerator  
- **Difficulty**: Easy
- **Theme**: Dark gray background with yellow paths
- **Features**: Wide oval track with inner obstacles and chicanes
- **Best For**: High-speed racing with overtaking opportunities

### 3. SerpentineGenerator
- **Difficulty**: Hard  
- **Theme**: Dark blue background with cyan paths
- **Features**: Winding snake-like paths with crossing points
- **Best For**: Navigation skill testing with sinusoidal curves

### 4. GridGenerator
- **Difficulty**: Medium
- **Theme**: Gray background with magenta paths
- **Features**: City block grid with blocked intersections
- **Best For**: Strategic route planning and urban navigation

### 5. SpiralGenerator
- **Difficulty**: Very Hard
- **Theme**: Dark red background with yellow paths  
- **Features**: Hypnotic spiral patterns with connecting bridges
- **Best For**: Disorienting challenges and complex pathfinding

### 6. IslandsGenerator
- **Difficulty**: Medium
- **Theme**: Teal background with green paths
- **Features**: Connected circular islands with bridge networks
- **Best For**: Unique navigation patterns and strategic island hopping

## Map Rotation System

### Automatic Rotation
- Maps rotate every **3 races** automatically
- No manual selection available (automatic only)
- Cycles through all 6 maps in sequence
- Provides next map preview during results screens

### Rotation Manager Features
- Track race count per map
- Preview next map information
- Display rotation status in UI
- Reset functionality for game restart
- Statistics tracking

## Integration

### RenderManager Integration
The RenderManager has been updated to work with the new map system:

```javascript
// Generate current map track
this.mapRotationManager.generateCurrentTrack(scene);

// Advance race and handle rotation
const rotationResult = this.advanceRace();

// Get current map information
const currentMap = this.getCurrentMapInfo();
```

### Usage in Game Scenes
```javascript
import { MapRotationManager } from './maps/MapRotationManager.js';

// Initialize rotation manager
const mapManager = new MapRotationManager();

// Generate track for current map
mapManager.generateCurrentTrack(scene);

// Advance to next race
const result = mapManager.advanceRace();
if (result.mapRotated) {
  // Handle map change
  console.log(`Rotated to: ${result.currentMap.config.name}`);
}
```

## File Structure

```
src/game/maps/
├── ClassicMazeGenerator.js    # Classic maze track
├── SpeedwayGenerator.js       # High-speed circuit
├── SerpentineGenerator.js     # Winding snake paths
├── GridGenerator.js           # City block grid
├── SpiralGenerator.js         # Hypnotic spiral
├── IslandsGenerator.js        # Connected islands
├── MapRotationManager.js      # Rotation management
├── index.js                   # Module exports
└── README.md                  # This documentation
```

## Technical Details

### Track Generation
- All tracks are generated at **1920x1080** resolution
- Uses Phaser graphics API for procedural generation
- Creates 'track' texture that can be used by game objects
- Proper collision detection through pixel-perfect checking

### Map Configuration
Each generator provides a static `config` object with:
- `name`: Display name
- `description`: Short description  
- `difficulty`: Difficulty level
- `backgroundColor`: Hex background color
- `trackColor`: Hex track color

### Performance
- Maps are generated once per rotation
- Textures are cached by Phaser
- Efficient procedural generation using graphics primitives
- No external image files required

## Future Enhancements

Potential additions to the map system:
- Dynamic weather effects per map
- Map-specific power-up spawning patterns
- Seasonal map variations
- Player voting for next map
- Custom map editor integration