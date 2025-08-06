# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Memex Racing is a top-down multiplayer racing betting game where players cannot control races but instead bet on AI-controlled races. The game features retro pixel art style using 64x64 or 128x128 resolution sprites and supports up to 6 simultaneous players per race.

### Core Game Mechanics
- **Objective**: Players must reach the M token within 5 minutes or all players lose
- **Movement**: Random "blind horse" movement system (no pathfinding)
- **Starting**: All players start at the same random position on the track, slightly spread out
- **Goal Position**: M token spawns at a random position far from the starting point
- **Betting System**: Spectators place bets on automated AI races
- **Leaderboard**: Dual-factor ranking based on win rate percentage and total accumulated points

## Architecture & Tech Stack

### Recommended Technology Stack
- **Game Engine**: Phaser.js 3.x for 2D pixel art rendering and physics
- **Multiplayer Backend**: Socket.io + Express.js for real-time communication
- **Randomization**: Mersenne Twister algorithm for professional-grade randomness
- **Data Persistence**: JSON files or simple database for leaderboards and player stats
- **Frontend**: HTML5 Canvas with pixel-perfect rendering

### Core Systems Architecture

#### 1. Game State Management
```
GameState {
  - raceTimer: 5-minute countdown
  - playerPositions: real-time coordinates
  - tokenLocation: M token position
  - activeBoosts: current power-ups on map
  - skillCooldowns: player ability timers
}
```

#### 2. Randomization Framework
- **Multi-layer randomness**: Environmental chaos + individual character events
- **Gaussian distribution**: Natural performance variations instead of uniform randomness
- **Biorhythm system**: Performance fluctuation using sine waves (30-120 second cycles)
- **Anti-pattern detection**: Prevents predictable sequences

#### 3. Multiplayer Architecture
```
Client ←→ Socket.io ←→ Game Server ←→ Race Engine
                  ↕
            Betting System ←→ Leaderboard DB
```

## Development Commands

### Project Setup
```bash
npm install                    # Install dependencies
npm run dev                   # Start development server
npm run build                 # Build for production
npm start                     # Start production server
```

### Testing
```bash
npm test                      # Run all tests
npm run test:unit            # Unit tests only
npm run test:integration     # Integration tests
npm run test:multiplayer     # Multiplayer functionality tests
```

### Asset Management
```bash
npm run sprites:optimize     # Optimize pixel art sprites
npm run assets:validate      # Validate 64x64/128x128 dimensions
npm run foreground:setup     # Setup 4000x2000 foreground PNG
```

## Game Systems Implementation

### Random Speed Booster System
**Booster Types**: antenna booster, Twitter post, Memex Tag, Poo, Toilet paper, Toilet, Banana, King Kong
- **Duration**: 4-7 seconds speed enhancement
- **Spawn**: Random intervals with glowing pixel icons
- **Effects**: Screen shake, particle effects, speed lines

### Player Skill System (5 Random Skills)
1. **Thunder**: Paralyze 3 random opponents for 3 seconds
2. **Fire**: Burn 2 characters, causing slowdown
3. **Bubble Protection**: Bounce off other players for 8 seconds
4. **Magnetized Shoes**: Attract to nearby racers for 5 seconds (win condition if M token found)
5. **Random Teleport Twitch**: Teleport all players randomly on map

### Betting & Leaderboard Implementation
- **Weighted Algorithm**: Combines win rate consistency + volume scoring
- **Confidence Multipliers**: Higher risk = higher reward betting
- **Seasonal Resets**: Prevent score inflation over time
- **Real-time Updates**: WebSocket broadcasting for live betting odds

### Map System
- **Six Unique Maps**:
  1. Classic Maze (Original) - Medium difficulty, traditional maze layout
  2. Speed Circuit - Easy difficulty, wide tracks for high-speed racing
  3. Serpentine Path - Hard difficulty, winding snake-like track
  4. Grid Lock - Medium difficulty, city block style grid
  5. Spiral Madness - Very Hard, hypnotic spiral track
  6. Island Hopper - Medium difficulty, connected island tracks
- **Map Selection**: Press 'M' between races, visual previews with difficulty ratings
- **Automatic Rotation**: Maps rotate every 3 races with counter display
- **Adaptive Systems**: Collision detection and stuck handling adapt to each map

## File Structure Guidelines

```
src/
├── game/
│   ├── engine/           # Phaser.js game engine setup
│   ├── systems/          # Core game systems
│   │   ├── movement.js   # Random movement AI
│   │   ├── boosters.js   # Power-up system
│   │   ├── skills.js     # Player abilities
│   │   └── randomizer.js # Multi-layer randomization
│   ├── entities/         # Game objects
│   │   ├── player.js     # Player character
│   │   ├── token.js      # M token logic
│   │   └── powerups.js   # Collectible items
│   └── scenes/           # Game scenes
├── multiplayer/
│   ├── server.js         # Socket.io server
│   ├── gameroom.js       # Room management
│   └── betting.js        # Betting system logic
├── assets/
│   ├── sprites/          # 64x64 & 128x128 pixel art
│   ├── sounds/           # Audio effects
│   └── maps/             # Race track layouts
└── ui/
    ├── leaderboard.js    # Ranking system UI
    ├── betting.js        # Betting interface
    └── hud.js            # Game HUD elements
```

## Critical Implementation Details

### Movement System
- **No Pathfinding**: Use pure randomization with momentum
- **Collision Detection**: Pixel-perfect collision for 64x64 sprites with tolerance-based checking
- **Speed Variation**: Gaussian randomness for natural feel with reduced biorhythm variations
- **Wall Boundaries**: Transparent areas define valid movement zones
- **Multi-Level Stuck Handling**:
  - Level 1 (30-60 frames): Intelligently finds the best escape direction
  - Level 2 (60-120 frames): Teleports to nearby clear area
  - Level 3 (120+ frames): Emergency teleport with visual effect
- **Smart Direction Finding**: Tests 16 directions for optimal path when stuck
- **Improved Collision**: Look-ahead detection, partial movement, 96x96 collision boxes

### Visual Requirements
- **Resolution**: Strict 64x64 or 128x128 sprite dimensions
- **Color Palette**: Limited 8-bit/16-bit aesthetic
- **Foreground**: 4000x2000 PNG named "Foreground" in assets/
- **Contrast**: Bright colors for visibility during fast gameplay

### Multiplayer Considerations
- **Real-time Sync**: 60 FPS game state updates via Socket.io
- **Lag Compensation**: Predictive movement with server reconciliation
- **Room Capacity**: Maximum 6 players per race
- **Spectator Mode**: Betting interface for non-racing players

### Randomization Philosophy
- **Chaos Theory**: Small initial differences create vastly different outcomes
- **Fractal Generation**: Self-similar track sections with chaotic properties
- **Multi-source Entropy**: Player behavior as randomness input
- **Adaptive Probabilities**: Dynamic weight adjustments during races

## Performance Targets
- **Frame Rate**: Consistent 60 FPS pixel rendering
- **Latency**: Sub-50ms multiplayer response time
- **Memory**: Efficient sprite caching for 64x64 assets
- **Bandwidth**: Optimized real-time game state synchronization

## Testing Strategy
- **Unit Tests**: Individual system components (movement, skills, boosters)
- **Integration Tests**: Multiplayer room functionality and betting system
- **Load Testing**: 6-player concurrent races with multiple spectators
- **Randomness Validation**: Statistical analysis of movement patterns
- **Visual Regression**: Pixel-perfect sprite rendering across browsers

## Debug Features
- **Debug Mode**: Press 'D' to toggle debug information
  - Real-time player position, direction, speed, and stuck counter
  - Heat map display of problematic areas where players frequently get stuck
  - Visual indicators for movement direction and stuck status
  - Top 3 problem areas listing with occurrence count
  - Last 10 positions tracking for better stuck detection