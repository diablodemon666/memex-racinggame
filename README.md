# Memex Racing Game

A chaotic multiplayer racing betting game with retro pixel art style where players bet on AI-controlled races. Features random "blind horse" movement, custom power-ups, and streaming integration.

![Game Status](https://img.shields.io/badge/status-in%20development-yellow)
![Platform](https://img.shields.io/badge/platform-web-blue)
![Players](https://img.shields.io/badge/players-1--6-green)

## 🎮 Game Overview

Memex Racing is a top-down racing game where:
- Players cannot control races directly - all movement is AI-driven
- Up to 6 players race to reach the M token within 5 minutes
- Random movement creates unpredictable, exciting races
- Spectators can bet on race outcomes
- Retro pixel art style with 32x32 and 64x64 sprites

## 🚀 Features

### Core Gameplay
- **6 Unique Maps**: From classic maze to spiral madness
- **Smart Movement System**: Multi-level stuck detection and resolution
- **Power-Up System**: 8 different boosters with unique effects
- **Skill System**: 5 special abilities including Thunder, Fire, Bubble Shield
- **Betting System**: Spectators can wager on race outcomes

### Technical Features
- **Debug Mode**: Press 'D' to view real-time diagnostics
- **Map Selection**: Press 'M' to choose tracks between races
- **Auto-Rotation**: Maps change every 3 races
- **Custom Images**: Upload your own character sprites
- **Heat Map Tracking**: Identifies problematic track areas

## 🛠️ Technology Stack

- **Game Engine**: Phaser.js 3.x
- **Language**: JavaScript/HTML5
- **Multiplayer**: Socket.io (planned)
- **Randomization**: Mersenne Twister algorithm
- **Rendering**: HTML5 Canvas with pixel-perfect scaling

## 📁 Project Structure

```
memex-racing/
├── src/                    # Source code (being modularized)
│   ├── game/              # Game engine and systems
│   ├── multiplayer/       # Networking code
│   ├── assets/            # Game assets
│   └── ui/                # User interface components
├── data/                  # External configurations
│   ├── config/            # Game settings
│   ├── sprites/           # Custom sprites
│   └── sounds/            # Custom audio
├── public/                # Static files
├── docs/                  # Documentation
├── tests/                 # Test suites
├── CLAUDE.md              # AI assistant guidelines
├── changelog.md           # Version history
├── todo.md                # Task tracking
└── claudeweb              # Current game (being refactored)
```

## 🎯 Getting Started

### Playing the Game
1. Open `claudeweb` in a modern web browser
2. Click "JOIN RACE" to enter as Player 4 (Yellow)
3. Upload a custom image for your character (optional)
4. Wait for the 30-second preparation phase
5. Watch your character race to the M token!

### Controls
- **M** - Open map selection
- **D** - Toggle debug mode
- **U** - Unstick your player manually

## 🔧 Development

The game is currently being refactored from a monolithic structure to a modular architecture. See `todo.md` for the current development roadmap.

### Planned Improvements
- External asset loading with hot-reload
- Advanced camera system for streaming
- OBS overlay integration
- Tournament bracket system
- Track editor
- Save/load race configurations

## 🎨 Asset Requirements

### Player Sprites
- **Format**: PNG with transparency
- **Dimensions**: 128x128 pixels (will be scaled to 32x32 in-game)
- **Quantity**: 6 sprites (player0 through player5)
- **Colors**: 
  - Player 0: Red (#FF0000)
  - Player 1: Green (#00FF00)
  - Player 2: Blue (#0000FF)
  - Player 3: Yellow (#FFFF00) - Default player
  - Player 4: Magenta (#FF00FF)
  - Player 5: Cyan (#00FFFF)
- **File naming**: `player0.png`, `player1.png`, etc.
- **Location**: `src/assets/sprites/players/default/`

### Booster Sprites
- **Format**: PNG with transparency
- **Dimensions**: 32x32 pixels
- **Required boosters** (8 total):
  - `antenna.png` - Green (#00FF00)
  - `twitter.png` - Twitter Blue (#1DA1F2)
  - `memex.png` - Magenta (#FF00FF)
  - `poo.png` - Brown (#8B4513)
  - `toilet_paper.png` - White (#FFFFFF)
  - `toilet.png` - Blue (#4169E1)
  - `banana.png` - Yellow (#FFFF00)
  - `king_kong.png` - Purple (#800080)
- **Location**: `src/assets/sprites/boosters/`

### Skill Icons
- **Format**: PNG with transparency
- **Dimensions**: 32x32 pixels
- **Required skills** (5 total):
  - `thunder.png` - Yellow (#FFFF00)
  - `fire.png` - Orange Red (#FF4500)
  - `bubble.png` - Deep Sky Blue (#00BFFF)
  - `magnet.png` - Deep Pink (#FF1493)
  - `teleport.png` - Dark Violet (#9400D3)
- **Location**: `src/assets/sprites/skills/`

### Game Tokens
- **Format**: PNG with transparency
- **Dimensions**: 32x32 pixels
- **Required**:
  - `m-token.png` - Gold (#FFD700)
- **Design**: Cross/plus shape representing the goal
- **Location**: `src/assets/sprites/tokens/`

### Map Assets

#### Backgrounds
- **Format**: PNG
- **Dimensions**: 1920x1080 pixels
- **Color depth**: 24-bit RGB
- **Required maps** (6 total):
  - `classic-maze-bg.png` - Dark Green (#1A3A1A)
  - `speed-circuit-bg.png` - Dark Gray (#222222)
  - `serpentine-path-bg.png` - Dark Blue (#0A0A2A)
  - `grid-lock-bg.png` - Gray (#2A2A2A)
  - `spiral-madness-bg.png` - Dark Red (#2A0A0A)
  - `island-hopper-bg.png` - Teal (#0A2A2A)
- **Location**: `src/assets/maps/backgrounds/`

#### Track Overlays
- **Format**: PNG with transparency
- **Dimensions**: 1920x1080 pixels
- **Track colors**:
  - Classic Maze: White (#FFFFFF)
  - Speed Circuit: Yellow (#FFCC00)
  - Serpentine Path: Cyan (#00FFFF)
  - Grid Lock: Magenta (#FF00FF)
  - Spiral Madness: Yellow (#FFFF00)
  - Island Hopper: Green (#00FF00)
- **Important**: Only track areas should be colored, rest transparent
- **Location**: `src/assets/maps/tracks/`

#### Foreground (Optional)
- **Format**: PNG with transparency
- **Dimensions**: 4000x2000 pixels
- **Purpose**: Decorative overlay elements
- **File name**: `foreground.png`
- **Location**: `src/assets/maps/foregrounds/`

### Audio Assets (Optional)
- **Format**: MP3, OGG, or WAV
- **Categories**:
  - **Sound Effects**: `src/assets/sounds/effects/`
    - `bounce.mp3` - Player collision sound
    - `boost-collect.mp3` - Booster pickup
    - `skill-activate.mp3` - Skill usage
    - `win.mp3` - Race victory
    - `countdown.mp3` - Race start countdown
  - **Background Music**: `src/assets/sounds/music/`
    - `menu-theme.mp3`
    - `race-theme.mp3`
  - **Ambient**: `src/assets/sounds/ambient/`
    - Per-map ambient sounds

### UI Elements
- **Format**: PNG with transparency
- **Required**:
  - **Panels**: `src/assets/ui/panels/`
    - `panel-border.png` - Green border (#00FF00)
    - `panel-bg.png` - Semi-transparent black
  - **Buttons**: `src/assets/ui/buttons/`
    - `button-normal.png` - Green (#00FF00)
    - `button-hover.png` - Bright green (#00AA00)
    - `button-pressed.png` - Dark green (#008800)
  - **Icons**: `src/assets/ui/icons/`
    - Various UI icons at 32x32 pixels

### Asset Directory Structure

```
src/assets/
├── sprites/
│   ├── players/
│   │   ├── default/
│   │   │   ├── player0.png (128x128, Red)
│   │   │   ├── player1.png (128x128, Green)
│   │   │   ├── player2.png (128x128, Blue)
│   │   │   ├── player3.png (128x128, Yellow)
│   │   │   ├── player4.png (128x128, Magenta)
│   │   │   └── player5.png (128x128, Cyan)
│   │   └── custom/         # User uploads go here
│   ├── boosters/
│   │   ├── antenna.png (32x32)
│   │   ├── twitter.png (32x32)
│   │   ├── memex.png (32x32)
│   │   ├── poo.png (32x32)
│   │   ├── toilet_paper.png (32x32)
│   │   ├── toilet.png (32x32)
│   │   ├── banana.png (32x32)
│   │   └── king_kong.png (32x32)
│   ├── skills/
│   │   ├── thunder.png (32x32)
│   │   ├── fire.png (32x32)
│   │   ├── bubble.png (32x32)
│   │   ├── magnet.png (32x32)
│   │   └── teleport.png (32x32)
│   └── tokens/
│       └── m-token.png (32x32)
├── maps/
│   ├── backgrounds/
│   │   ├── classic-maze-bg.png (1920x1080)
│   │   ├── speed-circuit-bg.png (1920x1080)
│   │   ├── serpentine-path-bg.png (1920x1080)
│   │   ├── grid-lock-bg.png (1920x1080)
│   │   ├── spiral-madness-bg.png (1920x1080)
│   │   └── island-hopper-bg.png (1920x1080)
│   ├── tracks/
│   │   ├── classic-maze-track.png (1920x1080, transparent)
│   │   ├── speed-circuit-track.png (1920x1080, transparent)
│   │   ├── serpentine-path-track.png (1920x1080, transparent)
│   │   ├── grid-lock-track.png (1920x1080, transparent)
│   │   ├── spiral-madness-track.png (1920x1080, transparent)
│   │   └── island-hopper-track.png (1920x1080, transparent)
│   └── foregrounds/
│       └── foreground.png (4000x2000, optional)
├── sounds/
│   ├── effects/
│   ├── music/
│   └── ambient/
└── ui/
    ├── panels/
    ├── buttons/
    └── icons/
```

### Asset Creation Guidelines

1. **Pixel Art Style**:
   - Use hard edges, no anti-aliasing
   - Limited color palette (8-16 colors per sprite)
   - Consistent pixel density across all assets

2. **Transparency**:
   - Use PNG format for all sprites
   - Ensure clean transparency (no semi-transparent edges)
   - Test on different backgrounds

3. **Track Design**:
   - Track width should be at least 100-140 pixels
   - Use solid colors for track areas
   - Transparent areas are walls/obstacles
   - Test collision detection after creation

4. **Performance**:
   - Optimize file sizes (use PNG compression)
   - Keep textures power-of-2 when possible
   - Batch similar assets into sprite sheets

5. **Naming Convention**:
   - Use lowercase with hyphens
   - Be descriptive but concise
   - Follow the exact names specified above

### Asset Validation

Run the asset validator to check all requirements:
```bash
npm run validate-assets
```

This will check:
- ✓ All required files exist
- ✓ Correct dimensions
- ✓ Proper format (PNG, transparency)
- ✓ File size optimization
- ✓ Naming conventions

### Custom Asset Guidelines

For custom player sprites:
1. Must be 128x128 pixels
2. Will be automatically scaled to 32x32 in-game
3. Should have clear, distinguishable features
4. Avoid thin lines (they may disappear when scaled)

For custom maps:
1. Background: Solid color or pattern
2. Track: High contrast with background
3. Test with collision detection
4. Ensure spawn areas are wide enough

## 📝 Documentation

- `CLAUDE.md` - Development guidelines and architecture details
- `changelog.md` - Detailed version history
- `todo.md` - Current task tracking and roadmap
- `docs/` - Additional documentation (coming soon)

## 🤝 Contributing

This project is under active development. Contributions are welcome! Please check `todo.md` for current tasks and priorities.

## 📄 License

[License information to be added]

## 🎮 Play Online

[Coming soon - link to hosted version]

---

**Note**: This game is inspired by horse racing mechanics but features unique "blind horse" movement where races are completely unpredictable and AI-driven, creating exciting betting opportunities for spectators.