# Memex Racing Map Creation Guide

## Overview
This guide explains how to create custom maps for Memex Racing. Maps define the race tracks, boundaries, and special zones where players compete.

## Map Specifications

### Dimensions
- **Required Size**: 4000 x 2000 pixels
- **Format**: PNG with transparency support
- **Color Depth**: 24-bit RGB or 32-bit RGBA

### Color Coding System
Maps use specific colors to define different game elements:

| Color | Hex Code | Purpose |
|-------|----------|---------|
| Black | #000000 | Track/Valid movement areas |
| White | #FFFFFF | Walls/Boundaries |
| Gray | #808080 | Decorative elements (no collision) |

### Map Design Guidelines

1. **Track Width**: Minimum 128 pixels wide for comfortable racing
2. **Random Spawning**: Players spawn at random positions on the track, slightly spread out
3. **M Token Placement**: Automatically spawns at a random far position from players
4. **Complexity Levels**:
   - Easy: Wide tracks, minimal obstacles
   - Medium: Balanced mix of straights and turns
   - Hard: Tight corners, narrow passages
   - Very Hard: Complex mazes, multiple paths

## Creating a Map

### Method 1: Image Editor
1. Create a new 4000x2000 pixel image
2. Fill background with white (walls)
3. Draw tracks in black
4. Save as PNG

### Method 2: Programmatic Generation
Use any programming language to generate pixel data:
```javascript
// Example: Create a simple rectangular track
const canvas = createCanvas(4000, 2000);
const ctx = canvas.getContext('2d');

// Fill with walls (white)
ctx.fillStyle = '#FFFFFF';
ctx.fillRect(0, 0, 4000, 2000);

// Draw track (black)
ctx.fillStyle = '#000000';
ctx.fillRect(100, 100, 3800, 1800);

// No need for start/token areas - spawning is random
```

## Map Configuration
Each map needs an accompanying JSON configuration file:

```json
{
  "name": "Your Map Name",
  "difficulty": "medium",
  "author": "Your Name",
  "description": "Brief description of the map",
  "dimensions": {
    "width": 4000,
    "height": 2000
  },
  "features": ["multiple_paths", "narrow_passages", "open_areas"]
}
```

## Testing Your Map

1. **Collision Testing**: Ensure walls properly block movement
2. **Path Verification**: Ensure sufficient connected track areas for gameplay
3. **Width Testing**: Verify tracks are wide enough for stuck detection
4. **Performance**: Check for smooth gameplay at 60 FPS

## File Naming Convention
- Use lowercase with hyphens: `map-name.png`
- Include difficulty in name: `easy-speed-circuit.png`
- Configuration file: `map-name.json`

## Example Maps in This Folder
- `classic-maze.png` - Medium difficulty maze layout
- `speed-circuit.png` - Easy wide-track racing circuit

## Tips for Great Maps

1. **Balance Challenge and Fun**: Too hard frustrates, too easy bores
2. **Multiple Routes**: Give players choices, supports random movement
3. **Visual Clarity**: Clear distinction between track and walls
4. **Track Variety**: Create interesting paths for random movement
5. **Consider Stuck Areas**: Avoid tiny pockets where players get trapped

## Troubleshooting

### Players Getting Stuck
- Increase track width in problem areas
- Add escape routes near corners
- Smooth sharp angles

### M Token Unreachable
- Ensure clear path exists
- Test with different random seeds
- Add alternative routes

### Performance Issues
- Reduce decorative elements
- Optimize PNG compression
- Keep file size under 1MB

## Submission Guidelines
When sharing custom maps:
1. Include both PNG and JSON files
2. Test thoroughly with 6 players
3. Provide screenshots of gameplay
4. Credit any tools or assets used