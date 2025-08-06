# DebugPanel Component

The DebugPanel is a comprehensive debugging interface component that provides real-time player tracking, stuck position analysis, heat map visualization, and various debugging utilities for the Memex Racing game.

## Features

### Real-Time Player Tracking
- **Position Display**: Shows current player X, Y coordinates in real-time
- **Direction Indicator**: Current movement direction in radians
- **Speed Monitoring**: Current speed value
- **Stuck Counter**: Tracks how long a player has been stuck
- **Track Status**: Indicates whether player is on a valid track position

### Map Analytics
- **Current Map Display**: Shows the name of the active map
- **Problem Area Counter**: Number of problematic track areas detected

### Top Problem Areas
- **Heat Map Analysis**: Identifies the top 3 areas where players get stuck most frequently
- **Severity Classification**: High, medium, low severity based on stuck frequency
- **Position Coordinates**: Exact X, Y coordinates of problem areas
- **Incident Count**: Number of times players got stuck at each location
- **Teleport Utility**: Quick teleport to problem areas for investigation

### Position History Tracking
- **Last 10 Positions**: Shows the most recent 10 player positions
- **Timestamp Information**: When each position was recorded
- **Movement Analysis**: Helps identify movement patterns and stuck behavior

### Visual Debug Controls
- **Movement Vector**: Shows player movement direction with arrow overlay
- **Heat Map**: Visual representation of stuck positions on the game canvas
- **Stuck Indicators**: Visual alerts when players are stuck
- **Collision Bounds**: Display collision boxes for debugging physics

### Performance Metrics
- **Update Rate**: Shows how frequently debug data is updated
- **Data Points**: Number of tracked stuck positions
- **Real-time Updates**: 10Hz update frequency for responsive debugging

## Usage

### Basic Integration

```javascript
// In your game scene (e.g., RaceScene.js)
import { getUIManager } from '../ui/UIManager';

class RaceScene extends Phaser.Scene {
    create() {
        // Get the UI manager instance
        this.uiManager = getUIManager();
        
        // Set the current scene for debug graphics
        this.uiManager.setDebugScene(this);
        
        // Initialize players array
        this.players = [];
        this.currentPlayerIndex = 0;
        this.stuckPositions = {};
        
        // Update debug panel with initial player data
        this.uiManager.updateDebugPlayer(this.currentPlayerIndex, this.players);
        this.uiManager.updateDebugMapInfo('Classic Maze');
    }
    
    update() {
        // Update stuck positions data
        this.uiManager.updateDebugStuckPositions(this.stuckPositions);
        
        // Update current player data if it changes
        this.uiManager.updateDebugPlayer(this.currentPlayerIndex, this.players);
    }
}
```

### Advanced Usage

```javascript
// Example of how to track stuck positions
handleStuckPlayer(player, index) {
    // Increment stuck counter
    player.stuckCounter++;
    
    // Log stuck position for heat map analysis
    const posKey = `${Math.floor(player.x / 10)},${Math.floor(player.y / 10)}`;
    this.stuckPositions[posKey] = (this.stuckPositions[posKey] || 0) + 1;
    
    // Update debug panel with new stuck data
    this.uiManager.updateDebugStuckPositions(this.stuckPositions);
    
    // Handle stuck resolution logic...
}

// Example of position tracking for movement analysis
trackPlayerPosition(player, time) {
    if (!player.lastPositions) {
        player.lastPositions = [];
    }
    
    // Add current position to history
    player.lastPositions.push({ 
        x: player.x, 
        y: player.y, 
        time: time 
    });
    
    // Keep only last 10 positions
    if (player.lastPositions.length > 10) {
        player.lastPositions.shift();
    }
}
```

## Keyboard Shortcuts

- **D Key**: Toggle debug panel visibility (handled by UIManager)
- **Panel Controls**: Various buttons within the panel for specific functions

## API Reference

### UIManager Integration Methods

#### `setDebugScene(scene)`
Sets the current Phaser scene for debug graphics rendering.
- `scene`: Phaser scene instance

#### `updateDebugPlayer(playerIndex, players)`
Updates the debug panel with current player data.
- `playerIndex`: Index of the player being tracked
- `players`: Array of all player objects

#### `updateDebugStuckPositions(stuckPositions)`
Updates the heat map with stuck position data.
- `stuckPositions`: Object mapping position keys to stuck counts

#### `updateDebugMapInfo(mapName)`
Updates the current map information.
- `mapName`: Name of the current map

### DebugPanel Methods

#### `show()` / `hide()` / `toggle()`
Control panel visibility.

#### `clearStuckData()`
Clears all stuck position data and resets heat map.

#### `teleportToPosition(x, y)`
Debug utility to teleport current player to specific coordinates.

#### `getDebugState()`
Returns current debug panel state for external inspection.

## Visual Debug Elements

The debug panel renders several visual elements directly on the game canvas:

### Movement Vector
- **Green Arrow**: Shows current movement direction
- **Length**: Indicates movement speed
- **Real-time**: Updates every frame when debug mode is active

### Heat Map Overlay
- **Red Circles**: Indicate stuck positions
- **Intensity**: Opacity and size based on stuck frequency
- **Labels**: Show stuck count for high-problem areas

### Stuck Indicators
- **Yellow/Red Circles**: Around stuck players
- **Text Labels**: Show stuck counter values
- **Dynamic**: Color changes based on stuck severity

### Collision Bounds
- **Cyan Rectangles**: Show physics body boundaries
- **Debug Aid**: Helps debug collision detection issues

## Performance Considerations

- **Update Frequency**: 10Hz (100ms intervals) for responsive feedback without performance impact
- **Conditional Rendering**: Visual elements only render when debug mode is active
- **Memory Management**: Position history limited to 10 entries per player
- **Graphics Clearing**: Debug graphics cleared and redrawn each frame

## Customization

The debug panel can be customized by modifying the DebugPanel class:

```javascript
// Adjust update frequency
this.updateFrequency = 200; // Update every 200ms instead of 100ms

// Modify visual settings
this.showHeatMap = false; // Disable heat map by default
this.showMovementVector = true; // Enable movement vectors

// Customize problem area detection
const minStuckCount = 5; // Minimum stuck events to show as problem area
```

## Troubleshooting

### Common Issues

1. **Debug Panel Not Showing**: Ensure UIManager is properly initialized and debug panel is toggled on with 'D' key
2. **No Visual Debug Elements**: Check that `setDebugScene()` has been called with the correct scene
3. **Stuck Data Not Updating**: Verify that `updateDebugStuckPositions()` is being called in the game loop
4. **Performance Issues**: Reduce update frequency or disable visual debug elements

### Debug Tips

1. **Use Problem Areas**: Focus on the top 3 problem areas to identify track design issues
2. **Monitor Position History**: Check if players are moving in circles or getting trapped
3. **Analyze Heat Map**: High-intensity areas indicate potential track improvements needed
4. **Test Teleport Function**: Use teleport buttons to quickly investigate problem areas

## Contributing

When adding new debug features:

1. Follow the existing component pattern
2. Add appropriate CSS styles to `game-ui.css`
3. Update the UIManager integration methods
4. Add visual debug elements that render on the game canvas
5. Ensure responsive design for mobile devices
6. Include performance considerations for real-time updates