# Memex Racing Game Server

Socket.io-based multiplayer server for the Memex Racing game. Handles real-time multiplayer functionality, room management, matchmaking, and game state synchronization.

## Features

- **Real-time Multiplayer**: Socket.io WebSocket connections for low-latency gameplay
- **Room Management**: Create/join rooms with unique codes (e.g., "RACE-1234")
- **Matchmaking**: Skill-based quick play matching system
- **AI Players**: Automatic AI filling when rooms need more players
- **Game State Sync**: Real-time position updates and race management
- **Health Monitoring**: Built-in health check and statistics endpoints

## Architecture

### Core Components

1. **index.js** - Main server entry point with Socket.io handlers
2. **RoomManager.js** - Room lifecycle and player management
3. **GameStateManager.js** - Race state synchronization and win condition handling
4. **MatchmakingService.js** - Quick play matchmaking with skill-based matching

## API Endpoints

### HTTP Endpoints

- `GET /health` - Server health check and basic stats
- `GET /stats` - Detailed server statistics

### Socket.io Events

#### Client → Server Events

| Event | Description | Data |
|-------|-------------|------|
| `REGISTER_PLAYER` | Register player with username/avatar | `{username, avatar}` |
| `CREATE_ROOM` | Create new private room | `{maxPlayers?, gameMode?, mapId?}` |
| `JOIN_ROOM` | Join room by code | `{roomCode}` |
| `QUICK_PLAY` | Find/create room via matchmaking | None |
| `PLAYER_READY` | Toggle ready state | `{isReady}` |
| `GAME_UPDATE` | Send position/movement data | `{position, velocity, direction}` |
| `RACE_FINISHED` | Report race completion | `{finishTime, position}` |
| `LEAVE_ROOM` | Leave current room | None |

#### Server → Client Events

| Event | Description | Data |
|-------|-------------|------|
| `PLAYER_REGISTERED` | Confirm player registration | `{playerId, username, avatar}` |
| `ROOM_CREATED` | Room successfully created | `{room, playerId}` |
| `ROOM_JOINED` | Successfully joined room | `{room, playerId}` |
| `PLAYER_JOINED` | Another player joined room | `{player, room}` |
| `PLAYER_LEFT` | Player left room | `{playerId, username, room}` |
| `PLAYER_READY_CHANGED` | Player ready state changed | `{playerId, isReady, room}` |
| `GAME_STARTED` | Race has begun | `{roomId, players, mapId, startTime}` |
| `PLAYER_UPDATE` | Real-time player position | `{playerId, position, velocity, direction}` |
| `PLAYER_FINISHED` | Player completed race | `{playerId, username, finishTime, position}` |
| `RACE_FINISHED` | Race completed with results | `{roomId, results, timestamp}` |
| `RACE_TIMEOUT` | Race timed out (no winner) | `{roomId, results, message}` |
| `ROOM_RESET` | Room ready for next race | `{room}` |
| `ERROR` | Error occurred | `{message}` |

## Configuration

### Environment Variables

```bash
PORT=3001                    # Server port (default: 3001)
CLIENT_URL=http://localhost:3000  # Client URL for CORS
NODE_ENV=development         # Environment (development/production)
```

### Game Settings

- **Max Players per Room**: 6
- **Race Timer**: 5 minutes (300,000ms)
- **Room Code Format**: "RACE-####" (4 digits)
- **Matchmaking Wait Time**: 30 seconds max
- **AI Player Pool**: 8 different AI personalities

## Usage

### Starting the Server

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm run production

# Debug mode
npm run debug

# Standard start
npm start
```

### Health Check

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600,
  "rooms": 5,
  "connections": 12
}
```

### Server Statistics

```bash
curl http://localhost:3001/stats
```

Response:
```json
{
  "rooms": [
    {
      "id": "room-uuid",
      "playerCount": 4,
      "status": "racing",
      "createdAt": 1704110400000
    }
  ],
  "totalPlayers": 12,
  "activeRooms": 3
}
```

## Room Management

### Room Lifecycle

1. **Creation**: Player creates room → gets unique code
2. **Joining**: Other players join via code or matchmaking
3. **Waiting**: Players mark ready, AI fills remaining slots
4. **Racing**: 5-minute race with real-time sync
5. **Results**: Winner announced or timeout occurs
6. **Reset**: Room returns to waiting state

### Room Codes

- Format: `RACE-####` (e.g., "RACE-1234")
- 4-digit random numbers
- Unique across all active rooms
- Cleaned up when rooms are destroyed

## Matchmaking System

### Skill-Based Matching

- **Skill Range**: 0-1000 points
- **New Players**: Start at 500 (average)
- **Skill Factors**: Win rate, average finish position, games played
- **Search Expansion**: Gradually expand skill range if no matches found

### Queue Processing

- **Processing Interval**: Every 5 seconds
- **Max Wait Time**: 30 seconds
- **Search Range**: Starts at ±200 skill points, expands over time
- **Fallback**: Create new room if no suitable matches

## AI Players

### AI Personalities

- AI_Speedy (cool_pug)
- AI_Racer (chips_bu)  
- AI_Flash (smoking_pug)
- AI_Turbo (ice)
- AI_Dash (intern)
- AI_Bolt (lv4pug)
- AI_Storm (pug_banana_toilet)
- AI_Wind (spike_monster)

### AI Behavior

- Always ready immediately
- Follow same movement rules as human players
- Can win/lose races normally
- Help fill rooms to maintain engagement

## Error Handling

### Connection Issues

- Graceful disconnection handling
- Room cleanup on player leave
- Automatic reconnection support
- Timeout management

### Race Issues

- Stuck player detection and teleportation
- Network lag compensation
- State desynchronization recovery
- Emergency race termination

## Performance

### Optimization Features

- Efficient room/player lookup (Map-based)
- Minimal data transmission (only changed states)
- Automatic cleanup of old rooms/data
- Connection pooling and rate limiting

### Monitoring

- Real-time connection count
- Room/player statistics
- Memory usage tracking
- Error rate monitoring

## Development

### Adding New Features

1. **New Events**: Add to both client and server event handlers
2. **New Game Modes**: Extend GameStateManager with mode-specific logic
3. **New Maps**: Add map configuration to room settings
4. **New Matchmaking Rules**: Modify MatchmakingService criteria

### Testing

```bash
# Run basic server tests
npm test

# Manual testing with curl
curl -X GET http://localhost:3001/health
curl -X GET http://localhost:3001/stats
```

### Debugging

- Use `npm run debug` for Node.js inspector
- Check browser Network tab for WebSocket traffic
- Monitor server logs for connection/disconnection events
- Use `/stats` endpoint to track room states

## Production Deployment

### Requirements

- Node.js 16+
- Port 3001 available
- WebSocket support
- CORS configured for client domain

### Deployment Steps

1. Set environment variables
2. Install dependencies: `npm install`
3. Start server: `npm run production`
4. Configure reverse proxy (nginx/Apache)
5. Set up monitoring and logging
6. Configure firewall for WebSocket traffic

### Scaling Considerations

- Use Redis for multi-server session sharing
- Implement horizontal scaling with cluster mode
- Add database persistence for player stats
- Consider CDN for static assets
- Monitor WebSocket connection limits