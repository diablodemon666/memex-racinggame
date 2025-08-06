# Game Scenes Documentation

This directory contains the four main game scenes for the Memex Racing multiplayer game.

## Scene Overview

### 1. PreloadScene.js
- **Purpose**: Handles asset loading and sprite creation
- **Features**: 
  - Programmatically creates pixel art sprites (players, boosters, skills, tokens)
  - Loads external audio/image assets
  - Shows loading progress bar
  - Transitions to MainMenuScene when complete

### 2. MainMenuScene.js
- **Purpose**: Main menu with authentication integration
- **Features**:
  - Quick Play button (single-player mode)
  - Create Room button (host multiplayer)
  - Join Room button (join existing room)
  - Settings panel
  - User info display (login/logout)
  - Keyboard navigation support

### 3. LobbyScene.js
- **Purpose**: Multiplayer lobby for room management
- **Features**:
  - Displays room code prominently
  - Shows 6 player slots with ready states
  - Invite players functionality
  - Host controls (start game when ready)
  - Real-time lobby messages
  - Auto-ready for quick play mode

### 4. RaceScene.js
- **Purpose**: Main racing game with all phases
- **Features**:
  - **Betting Phase** (30 seconds): Place bets on players
  - **Racing Phase** (5 minutes): Active gameplay with random movement
  - **Results Phase**: Show winner and betting payouts
  - **Auto-reset**: Automatically starts new race
  - Real-time leaderboard and statistics
  - Power-ups and skills system
  - Debug mode (press D key)

## Scene Flow

```
PreloadScene → MainMenuScene → LobbyScene → RaceScene
     ↑              ↑             ↑           ↓
     └──────────────┴─────────────┴───────────┘
```

## Integration Points

### Authentication System
- Scenes integrate with `loginIntegration` from `./auth/login-integration.js`
- User info is displayed in MainMenuScene
- Login/logout events trigger scene updates

### Multiplayer Events
- Uses `multiplayerEvents` system for cross-scene communication
- Key events: `PLAYER_JOINED`, `ROOM_CREATED`, `GAME_STARTED`, `RACE_FINISHED`
- Events are shared between scenes and can trigger transitions

### Game Engine Integration
- Scenes work with existing `GameEngine`, `PhysicsManager`, and `RenderManager`
- Race scene delegates complex game logic to engine systems
- Maintains compatibility with existing codebase

## Usage Examples

### Starting a Quick Play Game
```javascript
// From MainMenuScene
const roomData = {
  roomId: `quick_${Date.now()}`,
  playerCount: 1,
  gameMode: 'quickplay'
};
this.scene.start('LobbyScene', { roomData, isQuickPlay: true });
```

### Creating a Multiplayer Room
```javascript
// From MainMenuScene
const roomData = {
  roomId: 'ABC123',
  playerCount: 1,
  maxPlayers: 6,
  gameMode: 'multiplayer',
  host: 'PlayerName'
};
this.scene.start('LobbyScene', { roomData, isHost: true });
```

### Starting a Race
```javascript
// From LobbyScene
const gameData = {
  roomId: this.roomData.roomId,
  playerCount: this.playerCount,
  players: this.getPlayerList(),
  gameMode: this.roomData.gameMode
};
this.scene.start('RaceScene', gameData);
```

## Customization Points

### Adding New Player Sprites
- Upload custom images in MainMenuScene
- Images are automatically processed to 128x128 pixels
- Applied immediately to player character

### Adding New Power-ups
- Define in PreloadScene's `getBoosterTypes()` or `getSkillTypes()`
- Implement effects in RaceScene's `activateSkill()` method
- Add visual sprites in `createPixelSprites()`

### Adding New Maps
- Create track generation function in RaceScene
- Add collision detection setup
- Update track selection UI as needed

## Debug Features

### Debug Mode (Press D in RaceScene)
- Shows player position, speed, direction
- Displays stuck counter and movement analytics
- Shows performance metrics
- Highlights problematic areas on track

### Console Commands
- `window.game` - Access Phaser game instance
- `window.multiplayerEvents` - Access multiplayer event system
- `window.gameEngine` - Access game engine (when available)

## Event System

### Scene Events
Each scene emits specific events that can be listened to:

```javascript
// Example: Listen for race completion
this.events.on('RACE_FINISHED', (data) => {
  console.log('Race completed:', data);
  // Handle race completion
});
```

### Multiplayer Events
Cross-scene communication via multiplayer events:

```javascript
// Example: Handle player joining
multiplayerEvents.on('PLAYER_JOINED', (playerData) => {
  // Update UI to show new player
});
```

## Performance Considerations

- **Pixel Art**: All sprites use `pixelArt: true` for crisp rendering
- **Asset Management**: Sprites created programmatically to reduce file size
- **Memory**: Scenes properly clean up on destroy
- **Frame Rate**: Race scene targets 60 FPS with efficient collision detection

## Future Enhancements

- Socket.io integration for real multiplayer
- More detailed player customization
- Tournament mode with brackets
- Spectator mode for non-participating players
- Replay system for race playback
- Advanced betting with odds calculation