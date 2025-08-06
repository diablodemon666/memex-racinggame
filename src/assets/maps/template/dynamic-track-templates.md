# Dynamic Track Template Creation Guide

## Overview
This guide explains how to create track templates for the dynamic map system in Memex Racing. Track templates use **white pixels for moveable areas** and **transparent pixels for walls**, and are randomly combined with background images each game.

## Track Template Format

### **Required Specifications**
- **Dimensions**: 4000 x 2000 pixels (exact)
- **Format**: PNG with transparency support
- **Color Depth**: 32-bit RGBA
- **File Size**: Keep under 2MB for performance

### **Color Coding System**
| Color | Purpose | Description |
|-------|---------|-------------|
| **White (#FFFFFF)** | **Track/Moveable Areas** | Where players can move |
| **Transparent** | **Walls/Obstacles** | Collision boundaries |
| Anti-aliasing | Avoided | Use hard edges for precise collision |

## Creating Track Templates

### **Method 1: Image Editor (Photoshop/GIMP/etc.)**

1. **Create New Document**
   - Dimensions: 4000 x 2000 pixels
   - Background: Transparent
   - Color Mode: RGB with Alpha

2. **Draw Track Areas**
   - Use pure white (#FFFFFF) color
   - Paint brush with hard edges (no anti-aliasing)
   - Minimum track width: 128 pixels for comfortable movement
   - Maximum track width: 400 pixels for variety

3. **Track Design Guidelines**
   - Ensure all track areas are connected
   - Avoid tiny isolated pockets (< 64x64 pixels)
   - Leave adequate spawn areas (200+ pixel diameter circles)
   - Plan for random M token placement

4. **Save File**
   - Format: PNG with transparency
   - Name: `[track-name].png` (lowercase, hyphens)
   - Place in: `maps/track-templates/`

### **Method 2: Programmatic Generation**

```javascript
// Example: Create simple oval track template
const canvas = document.createElement('canvas');
canvas.width = 4000;
canvas.height = 2000;
const ctx = canvas.getContext('2d');

// Start with transparent background
ctx.clearRect(0, 0, 4000, 2000);

// Draw white track areas
ctx.fillStyle = '#FFFFFF';

// Outer oval
ctx.beginPath();
ctx.ellipse(2000, 1000, 1800, 800, 0, 0, 2 * Math.PI);
ctx.fill();

// Inner oval (transparent - creates donut shape)
ctx.globalCompositeOperation = 'destination-out';
ctx.beginPath();
ctx.ellipse(2000, 1000, 1400, 600, 0, 0, 2 * Math.PI);
ctx.fill();
```

## Track Template Examples

### **1. Simple Oval (`simple-oval.png`)**
```
Features: ['oval', 'wide_track']
Difficulty: Easy
Description: Basic oval track perfect for beginners
Track Width: 200 pixels
```

### **2. Figure Eight (`figure-eight.png`)**
```
Features: ['crossover', 'loops']
Difficulty: Medium
Description: Two interconnected loops with crossover point
Track Width: 150 pixels
```

### **3. Maze Classic (`maze-classic.png`)**
```
Features: ['maze', 'multiple_paths', 'narrow_passages']
Difficulty: Hard
Description: Complex maze with multiple routes
Track Width: 100-150 pixels (varies)
```

### **4. Spiral Madness (`spiral-madness.png`)**
```
Features: ['spiral', 'tight_turns']
Difficulty: Very Hard
Description: Hypnotic spiral from outside to center
Track Width: 100 pixels
```

## Background Library

Your track templates will be randomly combined with background images from the `maps/backgrounds-library/` directory.

### **Background Requirements**
- **Dimensions**: 4000 x 2000 pixels
- **Format**: JPEG or PNG
- **Themes**: Space, nature, cyberpunk, aquatic, etc.
- **Style**: Avoid high contrast that interferes with white tracks

### **Example Backgrounds**
- `space-station.jpg` - Dark space theme with stars
- `desert-canyon.jpg` - Earth tones, natural landscape
- `neon-city.jpg` - Bright cyberpunk cityscape
- `underwater.jpg` - Blue aquatic environment
- `forest-canopy.jpg` - Green nature theme
- `volcanic-landscape.jpg` - Red/orange extreme environment

## Directory Structure

```
maps/
├── track-templates/        # Your white-track PNG files
│   ├── simple-oval.png
│   ├── figure-eight.png
│   ├── maze-classic.png
│   ├── spiral-madness.png
│   └── custom-track-01.png
│
└── backgrounds-library/    # Background images
    ├── space-station.jpg
    ├── desert-canyon.jpg
    ├── neon-city.jpg
    ├── underwater.jpg
    └── forest-canopy.jpg
```

## Testing Your Templates

### **1. Track Connectivity**
- All white areas should be connected
- Players must be able to reach any part of the track
- No isolated white pixels or tiny pockets

### **2. Track Width**
- Minimum 64 pixels for stuck detection to work
- Recommended 100-200 pixels for comfortable racing
- Test with 6 players spawning randomly

### **3. Performance**
- File size under 2MB
- No excessive detail that impacts collision detection
- Clean white pixels without anti-aliasing

### **4. Visual Clarity**
- White tracks must be visible on all background themes
- Good contrast between track and boundaries
- Clear navigation paths for random movement

## Dynamic Combination System

### **How It Works**
1. Each race, system randomly selects:
   - One track template from `track-templates/`
   - One background from `backgrounds-library/`
2. Background rendered first (behind everything)
3. Track template overlaid (with slight transparency)
4. Collision detection uses white pixels from template
5. Next race = new random combination

### **Benefits**
- **Variety**: 5 tracks × 6 backgrounds = 30 unique experiences
- **Easy Creation**: Just drop PNG files in folders
- **Modular**: Add tracks or backgrounds independently
- **Reusable**: Same track works with all backgrounds

## Configuration

Update `data/config/dynamic-maps.json` to control the system:

```json
{
  "dynamicMaps": {
    "enabled": true,
    "generatePerRace": true
  },
  "trackTemplates": {
    "colorFormat": {
      "trackColor": "#FFFFFF",
      "wallColor": "transparent"
    }
  }
}
```

## Tips for Great Templates

1. **Plan for Randomness**: Random movement works better with wider tracks and multiple paths
2. **Avoid Dead Ends**: Create loops and circuits rather than maze dead ends
3. **Test Early**: Create simple versions first, add complexity gradually
4. **Consider Themes**: Some templates work better with certain background themes
5. **Player Count**: Design for 6 players spawning randomly with AI support

## Troubleshooting

### **Players Getting Stuck**
- Increase minimum track width to 128+ pixels
- Remove sharp corners and narrow bottlenecks
- Add escape routes near tight areas

### **Poor Visibility**
- Ensure white tracks contrast well with all background themes
- Avoid overly complex patterns that confuse navigation
- Test combinations manually

### **Performance Issues**
- Reduce file size with PNG optimization
- Avoid excessive fine detail
- Keep templates under 2MB

## Submission Guidelines

When sharing custom templates:
1. Test with at least 3 different backgrounds
2. Verify all areas are reachable
3. Include metadata (difficulty, features)
4. Provide preview screenshots
5. Follow naming conventions

---

**Ready to create?** Start with a simple oval or rectangle, test it works, then gradually add more complex features. The dynamic system will automatically combine your templates with backgrounds for endless variety!