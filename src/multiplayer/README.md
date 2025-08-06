# Multiplayer System

This directory contains the multiplayer functionality for Memex Racing, implementing a complete client-side multiplayer system using Socket.io.

## Components

### MultiplayerManager.js
Main multiplayer client that handles:
- Connection to Socket.io server
- Room creation and joining
- Player synchronization
- Auto-join functionality
- Friend invitations

### RoomManager.js
Manages room state including:
- Player slot tracking (1-6 players)
- AI player filling for empty slots
- Ready state management
- Auto-start logic
- Game state transitions

### QuickPlayManager.js
Handles matchmaking and quick play:
- Find available rooms
- Prefer rooms with more human players
- Balance skill levels
- Create new rooms when needed
- Estimate wait times

### MultiplayerEvents.js
Centralized event system for:
- Event handling across components
- Socket.io integration
- Cross-component communication

## Usage Examples

### Basic Connection and Room Creation

```javascript
import { multiplayerManager, roomManager, multiplayerEvents, MULTIPLAYER_EVENTS } from './multiplayer/index.js';

// Connect to server
await multiplayerManager.connect('player-123', 'MyPlayerName');

// Listen for events
multiplayerEvents.on(MULTIPLAYER_EVENTS.PLAYER_JOINED, (data) => {
    console.log('Player joined:', data.player.playerName);
});

// Create a room
const roomData = await multiplayerManager.createRoom({
    maxPlayers: 6,
    isPrivate: false,
    fillWithAI: true
});

console.log(`Room created: ${roomData.roomCode}`);
```

### Quick Play

```javascript
import { quickPlayManager } from './multiplayer/index.js';

// Start quick play with preferences
try {
    const roomData = await quickPlayManager.startQuickPlay({
        preferMoreHumans: true,
        skillLevel: 'intermediate',
        gameMode: 'standard'
    });
    
    console.log(`Joined room: ${roomData.roomCode}`);
} catch (error) {
    console.error('Quick play failed:', error);
}
```

### Room Management

```javascript
// Set player ready
multiplayerManager.setReady(true);

// Listen for room updates
multiplayerEvents.on('ROOM_UPDATE', (roomData) => {
    console.log(`Room has ${roomData.totalPlayers} players`);
    console.log(`${roomData.readyPlayers} players are ready`);
    
    if (roomData.canStart) {
        console.log('Room can auto-start!');
    }
});

// Listen for game start
multiplayerEvents.on(MULTIPLAYER_EVENTS.GAME_STARTED, (gameData) => {
    console.log('Game starting with players:', gameData.players);
    // Start your game logic here
});
```

### Handling Disconnections

```javascript
multiplayerEvents.on(MULTIPLAYER_EVENTS.MULTIPLAYER_DISCONNECTED, () => {
    console.log('Disconnected from server');
    // Handle cleanup, show reconnection UI, etc.
});

// Graceful cleanup
window.addEventListener('beforeunload', () => {
    multiplayerManager.disconnect();
});
```

## Events

The system emits these key events:

- `MULTIPLAYER_CONNECTED` - Connected to server
- `MULTIPLAYER_DISCONNECTED` - Disconnected from server
- `PLAYER_JOINED` - Player joined current room
- `PLAYER_LEFT` - Player left current room
- `ROOM_CREATED` - Room was created
- `ROOM_JOINED` - Successfully joined a room
- `ROOM_LEFT` - Left a room
- `GAME_STARTED` - Game/race started
- `RACE_FINISHED` - Race completed
- `PLAYER_READY_CHANGED` - Player ready state changed

Additional events:
- `ROOM_UPDATE` - Room state changed
- `AUTO_START_COUNTDOWN` - Auto-start timer began
- `AUTO_START_CANCELLED` - Auto-start timer cancelled
- `QUICK_PLAY_SEARCH_STARTED` - Quick play search began
- `QUICK_PLAY_SUCCESS` - Quick play found a room
- `QUICK_PLAY_FAILED` - Quick play failed

## Room Codes

Room codes follow the format: 4 characters (e.g., "RACE-1234")
- Generated automatically by server
- Used for joining specific rooms
- Shareable with friends

## AI Players

When `fillWithAI` is enabled:
- Empty slots automatically filled with AI players
- AI players are always ready
- AI players have different skill levels and personalities
- Human players take priority over AI players

## Configuration

The system uses settings from `/data/config/multiplayer-settings.json`:
- Server connection details
- Room limits and timeouts
- Gameplay settings
- Security and anti-cheat options

## Integration Notes

- Requires Socket.io server running on configured port
- Compatible with existing Phaser.js game engine
- Events integrate with game scenes and UI components
- Supports reconnection and lag compensation
- Built-in rate limiting and security measures