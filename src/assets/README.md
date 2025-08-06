# Game Assets Directory

This directory contains all visual and audio assets for Memex Racing Game.

## Directory Structure

```
assets/
├── sprites/          # Character and item sprites
│   ├── players/      # Player character sprites
│   ├── boosters/     # Power-up sprites
│   ├── skills/       # Skill icon sprites
│   └── tokens/       # Goal token sprites
├── maps/             # Map-related assets
│   ├── backgrounds/  # Map background images
│   ├── tracks/       # Track overlay images
│   └── foregrounds/  # Optional decorative overlays
├── sounds/           # Audio assets
│   ├── effects/      # Sound effects
│   ├── music/        # Background music
│   └── ambient/      # Ambient sounds
└── ui/               # User interface elements
    ├── panels/       # UI panels and borders
    ├── buttons/      # Button graphics
    └── icons/        # UI icons
```

## Detailed Asset Specifications

### 1. Player Sprites (`sprites/players/`)

**Requirements:**
- **Dimensions**: 32x32 pixels (required), 64x64 pixels (optional high-res version)
- **Format**: PNG with transparency
- **Color Palette**: 8-bit/16-bit retro aesthetic, bright contrasting colors
- **Naming Convention**: `player_[color/type]_[size].png` (e.g., `player_red_32.png`)

**Default Player Colors:**
- Player 1: Red (#FF0000)
- Player 2: Blue (#0000FF)
- Player 3: Green (#00FF00)
- Player 4: Yellow (#FFFF00)
- Player 5: Magenta (#FF00FF)
- Player 6: Cyan (#00FFFF)

**Custom Player Sprites:**
- Place in `sprites/players/custom/` directory
- Must follow same dimension requirements
- Automatically detected and available in-game

### 2. Booster Sprites (`sprites/boosters/`)

**Requirements:**
- **Dimensions**: 32x32 pixels
- **Format**: PNG with transparency
- **Visual Style**: Glowing pixel icons with particle effects

**Required Booster Types:**
1. `antenna_booster.png` - Antenna speed boost
2. `twitter_post.png` - Twitter post boost
3. `memex_tag.png` - Memex Tag boost
4. `poo.png` - Poo obstacle/boost
5. `toilet_paper.png` - Toilet paper boost
6. `toilet.png` - Toilet boost
7. `banana.png` - Banana slip boost
8. `king_kong.png` - King Kong power boost

**Visual Requirements:**
- Include subtle glow effect (2-3 pixel outer glow)
- Use bright, saturated colors for visibility
- Animation frames optional: `[name]_frame_[0-3].png`

### 3. Skill Icons (`sprites/skills/`)

**Requirements:**
- **Dimensions**: 32x32 pixels for in-game, 64x64 pixels for UI display
- **Format**: PNG with transparency
- **Visual Style**: Clear iconographic representation

**Required Skill Icons:**
1. `thunder.png` - Lightning bolt icon (paralyze ability)
2. `fire.png` - Flame icon (burn ability)
3. `bubble.png` - Protective bubble icon (bounce protection)
4. `magnet.png` - Magnet icon (magnetized shoes)
5. `teleport.png` - Swirl/portal icon (random teleport)

**Visual Guidelines:**
- Use distinct shapes for quick recognition
- Include ability state variants: `[skill]_active.png`, `[skill]_cooldown.png`
- Cooldown overlay should be semi-transparent gray

### 4. Token Sprites (`sprites/tokens/`)

**Requirements:**
- **Dimensions**: 64x64 pixels (larger for visibility)
- **Format**: PNG with transparency
- **Primary Token**: `m_token.png` - The goal "M" token

**Visual Specifications:**
- Bright, pulsing glow effect
- High contrast against all map backgrounds
- Animation frames: `m_token_frame_[0-7].png` for pulsing effect
- Must be instantly recognizable from a distance

### 5. Map Assets (`maps/`)

#### Backgrounds (`maps/backgrounds/`)
**Requirements:**
- **Dimensions**: 1920x1080 minimum, 4000x2000 recommended
- **Format**: PNG or JPEG
- **Style**: Top-down view, muted colors to not interfere with gameplay

**Map Types:**
1. `classic_maze_bg.png` - Traditional maze aesthetic
2. `speed_circuit_bg.png` - Racing track theme
3. `serpentine_path_bg.png` - Snake-like winding paths
4. `grid_lock_bg.png` - City block grid pattern
5. `spiral_madness_bg.png` - Hypnotic spiral design
6. `island_hopper_bg.png` - Connected islands theme

#### Track Overlays (`maps/tracks/`)
**Requirements:**
- **Dimensions**: Same as corresponding background
- **Format**: PNG with transparency
- **Purpose**: Define collision boundaries and valid movement areas

**Specifications:**
- Transparent areas = valid movement zones
- Non-transparent areas = walls/obstacles
- Use pure black (#000000) for walls
- Optional: Different opacity levels for different collision types

#### Foregrounds (`maps/foregrounds/`)
**Requirements:**
- **Dimensions**: 4000x2000 pixels
- **Format**: PNG with transparency
- **Primary File**: `Foreground.png` (required)

**Purpose:**
- Decorative overlay elements
- Does not affect collision
- Adds visual depth to the game

### 6. Sound Effects (`sounds/effects/`)

**Requirements:**
- **Format**: OGG Vorbis or MP3
- **Sample Rate**: 44.1kHz
- **Bit Depth**: 16-bit
- **Length**: 0.5-3 seconds for effects

**Required Sound Effects:**
1. `boost_collect.ogg` - Picking up a booster
2. `skill_activate_[skill].ogg` - Skill activation sounds
3. `player_collision.ogg` - Player collision sound
4. `countdown_[3-2-1-go].ogg` - Race countdown
5. `race_finish.ogg` - Victory sound
6. `teleport.ogg` - Teleportation effect
7. `stuck_escape.ogg` - Escaping stuck position

### 7. Music (`sounds/music/`)

**Requirements:**
- **Format**: OGG Vorbis or MP3
- **Sample Rate**: 44.1kHz
- **Bit Depth**: 16-bit
- **Style**: Retro chiptune or synthwave

**Required Tracks:**
1. `menu_theme.ogg` - Main menu music (loop)
2. `race_theme_[1-3].ogg` - In-race music variations (loop)
3. `victory_theme.ogg` - Post-race victory music

### 8. UI Elements (`ui/`)

#### Panels (`ui/panels/`)
**Requirements:**
- **Format**: PNG with transparency
- **Style**: Pixel art borders and backgrounds

**Required Elements:**
1. `leaderboard_panel.png` - Leaderboard background
2. `betting_panel.png` - Betting interface background
3. `skill_bar.png` - Player skill display bar

#### Buttons (`ui/buttons/`)
**Requirements:**
- **Dimensions**: Variable, maintain pixel grid
- **Format**: PNG with transparency
- **States**: `[button]_normal.png`, `[button]_hover.png`, `[button]_pressed.png`

#### Icons (`ui/icons/`)
**Requirements:**
- **Dimensions**: 16x16 or 32x32 pixels
- **Format**: PNG with transparency
- **Purpose**: UI indicators and status icons

## Asset Validation

All assets are validated by the AssetValidator system which checks:
- Correct dimensions (must be on pixel grid)
- Proper format and transparency
- Color palette compliance (no anti-aliasing for pixel art)
- File naming conventions

## Performance Guidelines

- Keep file sizes optimized (use PNG compression)
- Limit animation frames to maintain 60 FPS
- Use sprite sheets where possible for related assets
- Avoid excessive transparency layers

## Custom Asset Integration

To add custom assets:
1. Follow the specifications above exactly
2. Place in appropriate subdirectory
3. Use lowercase filenames with underscores
4. Test with AssetValidator before use
5. Hot-reload will automatically detect new assets during development