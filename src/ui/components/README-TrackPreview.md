# TrackPreview Component

## Overview

The `TrackPreview` component provides real-time preview functionality for the track editor in Memex Racing. It integrates with Phaser.js to show how tracks will look and play in the actual game, featuring test AI racers, collision detection visualization, and performance metrics.

## Features

### Real-time Track Rendering
- Live updates as users draw in the track editor
- Game-accurate rendering with background and template integration
- Pixel-perfect collision detection visualization
- Zoom controls for detailed inspection

### AI Test Racing
- 2-6 test AI racers with realistic movement patterns
- Integration with `AIPlayerManager` for authentic AI behavior
- Real-time path tracking and visualization
- Collision detection and stuck player handling

### Track Validation
- Automatic track analysis for racing viability
- Starting position detection and validation
- M token placement optimization
- Problematic area identification

### Performance Monitoring
- Real-time FPS counter and performance metrics
- Frame time analysis (update, physics, render)
- Memory usage optimization
- Responsive design for different screen sizes

## Architecture

### Dependencies
- `PhysicsManager` - For collision detection and player movement
- `RenderManager` - For game-accurate visual rendering
- `AIPlayerManager` - For test AI player creation and management
- `TrackEditor` - Parent component for track canvas integration

### Core Components

#### Preview Canvas System
```javascript
// Dual canvas setup for layered rendering
this.previewCanvas = null;     // Track rendering canvas
this.overlayCanvas = null;     // UI overlay canvas (players, indicators, etc.)
```

#### Physics Integration
```javascript
// Real physics simulation for test players
this.physicsManager = new PhysicsManager(mockGameEngine);
this.updatePlayerWithPhysics(player, index, currentTime, deltaTime);
```

#### Performance Monitoring
```javascript
// Real-time performance tracking
this.performanceMetrics = {
    frameTime: 0,
    updateTime: 0,
    renderTime: 0,
    physicsTime: 0
};
```

## Usage

### Basic Integration
```javascript
import { TrackPreview } from './TrackPreview.js';

// Initialize with track editor
const trackPreview = new TrackPreview(trackEditor);
await trackPreview.initialize();

// Show preview panel
trackPreview.show();

// Start real-time preview
trackPreview.togglePlayback();
```

### Event Integration
```javascript
// Listen for track editor changes
trackEditor.addEventListener('canvasUpdate', () => {
    if (trackPreview.isActive) {
        trackPreview.updatePreviewFromTrackEditor();
    }
});
```

### Settings Configuration
```javascript
// Configure preview settings
trackPreview.settings = {
    showCollisionBoxes: true,
    showValidTrack: false,
    showPlayerPaths: true,
    testPlayerCount: 4,
    animationSpeed: 1.0,
    enablePhysics: true
};
```

## API Reference

### Constructor
```javascript
new TrackPreview(trackEditor)
```
- `trackEditor` - Parent TrackEditor instance

### Methods

#### Core Methods
- `initialize()` - Initialize the preview system
- `show()` / `hide()` - Control panel visibility
- `toggle()` - Toggle panel visibility
- `destroy()` - Clean up resources

#### Preview Control
- `togglePlayback()` - Start/stop preview animation
- `resetPreview()` - Reset all preview state
- `updatePreviewFromTrackEditor()` - Sync with track editor changes

#### Settings
- `adjustZoom(delta)` - Adjust preview zoom level
- `resetPreviewPlayers()` - Reset test AI players
- `validateTrack()` - Run track validation

### Properties

#### State Properties
- `isVisible` - Panel visibility state
- `isActive` - Preview system active state
- `isPlaying` - Animation playback state

#### Configuration
- `settings` - Preview settings object
- `previewScale` - Display scale factor (0.1 - 1.0)
- `validationResults` - Track validation results

#### Performance
- `performanceMetrics` - Real-time performance data
- `actualFps` - Current frames per second

## Track Validation System

### Validation Criteria
1. **Overall Valid** - Track has sufficient racing area
2. **Valid Path** - Connected track areas for movement
3. **Starting Area** - Space for player starting positions
4. **Sufficient Space** - Adequate track coverage (5-80%)

### Validation Process
```javascript
validateTrack() {
    // Analyze track pixels
    const imageData = this.previewCtx.getImageData(...);
    
    // Calculate metrics
    const trackCoverage = validPixels / totalPixels;
    
    // Update validation results
    this.validationResults = {
        isValid: trackCoverage > 0.05 && trackCoverage < 0.8,
        hasValidPath: this.checkForValidPath(),
        hasStartingArea: this.findStartingArea() !== null,
        hasSufficientSpace: trackCoverage > 0.05
    };
}
```

## Performance Optimization

### Rendering Optimization
- Canvas image smoothing disabled for pixel art
- Efficient overlay rendering with minimal redraws
- Scaled preview canvas to reduce processing load

### Physics Optimization  
- Simplified collision detection for preview
- Reduced update frequency for non-critical systems
- Memory-efficient player path tracking

### Animation Loop
```javascript
const animate = (currentTime) => {
    const deltaTime = currentTime - this.lastUpdateTime;
    
    if (deltaTime >= this.frameTime / this.settings.animationSpeed) {
        this.updatePreview(currentTime, deltaTime);
        this.renderPreview(currentTime);
        this.updatePerformanceMetrics(currentTime, deltaTime);
        this.lastUpdateTime = currentTime;
    }
    
    this.animationFrame = requestAnimationFrame(animate);
};
```

## CSS Styling

The component uses the game's retro pixel art aesthetic with terminal green colors:

### Key Style Classes
- `.track-preview-panel` - Main preview panel
- `.preview-viewport` - Canvas container
- `.preview-sidebar` - Settings and metrics panel
- `.validation-status` - Track validation indicators
- `.metric-value` - Performance metric displays

### Responsive Design
- Desktop: Full sidebar with detailed controls
- Tablet: Simplified sidebar layout
- Mobile: Stacked layout with condensed controls

## Integration with Game Systems

### PhysicsManager Integration
```javascript
// Use actual physics for authentic preview
this.physicsManager.updatePlayerMovement(player, index, time, delta);
this.physicsManager.detectStuckPlayer(player, index, time);
```

### RenderManager Integration
```javascript
// Game-accurate rendering
this.renderManager.createPlayerSprite(index, position, true, aiData);
this.renderManager.showTeleportEffect(player.x, player.y);
```

### AIPlayerManager Integration
```javascript
// Authentic AI behavior
const aiPlayers = this.aiPlayerManager.checkAndFillSlots(0, testPlayerCount);
const aiPlayer = this.aiPlayerManager.createAIPlayer(index);
```

## Error Handling

### Graceful Degradation
- Fallback to simple movement if physics unavailable
- Mock AI players if AIPlayerManager fails to load
- Basic validation if advanced features fail

### Error Recovery
```javascript
try {
    this.physicsManager = new PhysicsManager(mockGameEngine);
} catch (error) {
    console.error('[TrackPreview] Physics initialization failed:', error);
    this.settings.enablePhysics = false;
}
```

## Testing and Demo

### Demo File
`track-preview-demo.html` provides a standalone demonstration of the TrackPreview system with:
- Simple track drawing interface
- System status monitoring
- Performance metrics display
- Full preview functionality

### Testing Considerations
- Cross-browser compatibility (Chrome, Firefox, Safari, Edge)
- Performance testing with complex tracks
- Memory leak prevention during long sessions
- Mobile device compatibility

## Future Enhancements

### Planned Features
1. **Replay System** - Record and playback test races
2. **Track Templates** - Pre-made track elements for quick building  
3. **Multi-lap Racing** - Extended test races with lap counting
4. **Custom AI Difficulty** - Adjustable AI skill levels for testing
5. **Export Options** - Save preview videos or screenshots

### Performance Improvements
1. **WebGL Rendering** - Hardware acceleration for complex tracks
2. **Worker Threads** - Background physics calculations
3. **Predictive Loading** - Pre-load common track elements
4. **Adaptive Quality** - Dynamic quality adjustment based on performance

## Troubleshooting

### Common Issues

#### Preview Not Updating
- Check if `trackPreview.isActive` is true
- Verify track editor canvas changes are triggering updates
- Ensure browser supports Canvas 2D context

#### Poor Performance
- Reduce `testPlayerCount` in settings
- Lower `animationSpeed` setting
- Check browser hardware acceleration

#### AI Players Not Moving
- Verify PhysicsManager initialization
- Check track validation results
- Ensure starting positions are valid

### Debug Information
```javascript
// Get comprehensive debug state
const debugInfo = trackPreview.getPreviewState();
console.log('[TrackPreview Debug]', debugInfo);
```

## Conclusion

The TrackPreview component provides a comprehensive real-time preview system that bridges the gap between track design and gameplay. By integrating authentic game physics, AI behavior, and performance monitoring, it enables users to create and validate tracks with confidence before committing to the full game experience.