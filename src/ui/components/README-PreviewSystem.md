# PreviewSystem Component

## Overview

The PreviewSystem provides real-time preview capabilities for the Memex Racing game, allowing developers and content creators to see immediate visual feedback for any game customizations including assets, configurations, and game state changes.

## Features

### Real-time Preview Modes
- **Split-screen**: Side-by-side before/after comparison
- **Picture-in-picture**: Main view with overlay preview window
- **Overlay**: Blended before/after views

### Comparison Modes
- **Side-by-side**: Traditional left/right comparison
- **Before/after**: Toggle between original and modified states
- **Overlay**: Transparent overlay showing differences

### Preview Controls
- **Play/Pause**: Control real-time updates
- **Reset**: Clear all preview data
- **Speed Control**: Adjust animation and update speed (0.1x to 3.0x)

### Asset Integration
- **Live Asset Updates**: Automatically previews sprite changes (64x64, 128x128)
- **Hot Reload Support**: Integrates with AssetManager for development workflow
- **Dimension Validation**: Ensures sprites meet game requirements

### Configuration Preview
- **JSON Config Visualization**: Shows configuration changes in real-time
- **Schema Validation**: Displays validation results
- **Change Tracking**: Logs all configuration modifications

### Game State Preview
- **Live Game State**: Visualizes current game phase and player data
- **State Transitions**: Shows game state changes as they occur
- **Player Tracking**: Displays active players and game status

## Usage

### Basic Integration

```javascript
// In UIManager or game initialization
import { PreviewSystem } from './components/PreviewSystem.js';

const previewSystem = new PreviewSystem(uiManager);
await previewSystem.initialize();

// Connect managers for live updates
previewSystem.assetManager = assetManager;
previewSystem.configManager = configManager;
previewSystem.gameEngine = gameEngine;
```

### Manual Updates

```javascript
// Trigger asset preview
previewSystem.handleAssetUpdate('loaded', {
    key: 'player-sprite',
    type: 'image',
    width: 64,
    height: 64,
    url: '/path/to/sprite.png'
});

// Trigger config preview
previewSystem.handleConfigUpdate('updated', {
    type: 'game-settings',
    data: { playerSpeed: 120, maxPlayers: 6 },
    metadata: { lastModified: Date.now() }
});

// Trigger game state preview
previewSystem.handleGameStateUpdate({
    phase: 'racing',
    players: [{ id: '1', name: 'Player 1' }],
    timeRemaining: 240
});
```

### Keyboard Controls

- **V**: Toggle preview panel visibility
- **Escape**: Close all panels including preview

## Integration Points

### AssetManager Integration
The PreviewSystem automatically listens for:
- `assetLoaded` events
- `assetUpdated` events  
- `hotReload` events

### ConfigManager Integration
The PreviewSystem automatically listens for:
- `configUpdated` events
- `configValidated` events

### GameEngine Integration
The PreviewSystem automatically listens for:
- `stateChanged` events

## Canvas Rendering

The PreviewSystem uses HTML5 Canvas with pixel-perfect rendering for game assets:

- **Image Smoothing**: Disabled for crisp pixel art (64x64, 128x128)
- **Scaling**: Automatic fit-to-canvas with aspect ratio preservation
- **Grid Background**: Optional grid overlay for alignment reference
- **Performance**: Optimized for 60fps updates

## Configuration

### Default Settings
- **Preview Mode**: Split-screen
- **Comparison Mode**: Side-by-side
- **Animation Speed**: 1.0x
- **Auto-play**: Enabled when panel is visible

### Customization
All preview modes and settings can be changed through the UI controls or programmatically:

```javascript
previewSystem.setPreviewMode('picture-in-picture');
previewSystem.setComparisonMode('overlay');
previewSystem.setAnimationSpeed(2.0);
```

## Event System

### Update Listeners
Register for preview updates:

```javascript
previewSystem.onUpdate((updateData) => {
    console.log('Preview updated:', updateData);
});
```

### Change Queue
The system maintains a queue of changes that are processed during animation frames for smooth performance.

## Performance Considerations

- **Memory Management**: Automatic cleanup of old preview data
- **Canvas Optimization**: Efficient rendering with minimal redraws
- **Update Throttling**: 60fps update limit with configurable speed
- **Queue Management**: Batched updates prevent UI blocking

## Demo

A complete demo is available at `/src/ui/demo/preview-system-demo.html` demonstrating all features and integration patterns.

## CSS Classes

The PreviewSystem uses the following CSS classes defined in `game-ui.css`:

- `.ui-panel.preview-panel`: Main panel container
- `.preview-controls`: Control buttons and settings
- `.preview-container`: Canvas and viewport area
- `.preview-pane`: Individual before/after panes
- `.change-log`: Update history display

## Browser Compatibility

- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+
- **Canvas Support**: HTML5 Canvas with 2D context required
- **ES6 Features**: Classes, modules, async/await

## Development

### Testing
Run the demo file in a browser to test all functionality:
```bash
open src/ui/demo/preview-system-demo.html
```

### Debugging
The PreviewSystem is available globally as `window.previewSystem` when debug mode is enabled.

## Future Enhancements

- [ ] WebGL rendering for advanced effects
- [ ] Video recording of preview sessions
- [ ] Multi-file asset comparison
- [ ] Custom preview templates
- [ ] Integration with version control systems