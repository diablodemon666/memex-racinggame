# Tournament System - Memex Racing

A comprehensive tournament management system for the Memex Racing game, supporting various tournament formats, player registration, bracket management, and seamless integration with existing game systems.

## Overview

The tournament system consists of three core components:

- **BracketManager**: Handles tournament bracket creation, match scheduling, and progression logic
- **TournamentManager**: Manages tournament lifecycle, player registration, and system integration
- **TournamentStateManager**: Provides state persistence, recovery, and statistics tracking

## Features

### Tournament Formats
- **Single Elimination**: Traditional knockout tournament
- **Double Elimination**: Players get a second chance through loser's bracket (planned)
- **Round Robin**: All players compete against each other (planned)

### Tournament Capabilities
- Support for 4-64 players
- Configurable players per race (2-6)
- Automated bracket generation and seeding
- Real-time match progression
- Spectator support with betting integration
- Player registration with authentication
- Tournament statistics and leaderboards
- State persistence and recovery
- Match history tracking

### Integration Features
- Seamless integration with existing room management
- Compatible with current authentication system
- Uses existing race engine (5-minute races)
- Supports spectators and betting systems
- Handles player disconnections gracefully

## Quick Start

### Basic Tournament Creation

```javascript
import { tournamentManager } from './src/tournament/index.js';

// Initialize with existing systems
await tournamentManager.initialize();

// Create a tournament
const tournament = await tournamentManager.createTournament({
    name: "Weekly Racing Championship",
    format: "single_elimination",
    maxPlayers: 16,
    minPlayers: 4,
    raceTimeLimit: 300,
    playersPerRace: 4,
    bettingEnabled: true,
    prizePool: 1000
}, creatorId);

console.log(`Tournament created: ${tournament.tournament.tournamentId}`);
```

### Player Registration

```javascript
// Register a player
const registration = await tournamentManager.registerPlayer(tournamentId, {
    playerId: "player123",
    playerName: "SpeedRacer",
    email: "player@example.com"
});

console.log(`Player registered at position: ${registration.position}`);
```

### Tournament Monitoring

```javascript
// Listen for tournament events
multiplayerEvents.on('TOURNAMENT_STARTED', (data) => {
    console.log(`Tournament ${data.tournamentId} has started!`);
});

multiplayerEvents.on('TOURNAMENT_MATCH_COMPLETED', (data) => {
    console.log(`Match completed: ${data.match.winner.playerName} won!`);
});

multiplayerEvents.on('TOURNAMENT_COMPLETED', (data) => {
    console.log(`Tournament winner: ${data.winner.playerName}`);
});
```

## Architecture

### Component Relationships

```
TournamentManager (orchestration)
├── BracketManager (bracket logic)
├── TournamentStateManager (persistence)
├── AuthManager (authentication)
├── RoomManager (room integration)
└── GameEngine (race integration)
```

### Data Flow

1. **Tournament Creation**: TournamentManager validates config → BracketManager creates structure
2. **Player Registration**: TournamentManager handles auth → Updates participant list
3. **Tournament Start**: BracketManager generates first round → TournamentManager creates rooms
4. **Match Execution**: RoomManager handles race → GameEngine provides results
5. **Match Completion**: BracketManager processes results → TournamentManager advances players
6. **State Persistence**: TournamentStateManager saves all state changes

## API Reference

### TournamentManager

#### createTournament(config, creatorId)
Creates a new tournament with the specified configuration.

**Parameters:**
- `config` (Object): Tournament configuration
  - `name` (string): Tournament name
  - `format` (string): Tournament format ('single_elimination', 'double_elimination', 'round_robin')
  - `maxPlayers` (number): Maximum players (4-64)
  - `minPlayers` (number): Minimum players to start
  - `raceTimeLimit` (number): Race time limit in seconds
  - `playersPerRace` (number): Players per race (2-6)
  - `bettingEnabled` (boolean): Enable betting
  - `spectatorCount` (number): Max spectators
  - `prizePool` (number): Prize pool amount
- `creatorId` (string): ID of tournament creator

**Returns:** Tournament creation result with tournament data

#### registerPlayer(tournamentId, playerData)
Registers a player for the specified tournament.

**Parameters:**
- `tournamentId` (string): Tournament ID
- `playerData` (Object): Player registration data
  - `playerId` (string): Unique player ID
  - `playerName` (string): Player display name
  - `email` (string): Player email (optional)

**Returns:** Registration result with player position

#### startTournament(tournamentId)
Manually starts a tournament (if conditions are met).

#### cancelTournament(tournamentId, reason)
Cancels an active tournament.

#### getTournamentDetails(tournamentId, playerId)
Gets detailed tournament information for a player.

#### listActiveTournaments()
Returns list of all active tournaments.

### BracketManager

#### createTournament(config, players)
Creates tournament bracket structure.

#### startNextMatch()
Starts the next available match in the tournament.

#### completeMatch(matchId, raceResults)
Completes a match with race results.

#### getStatus()
Returns current tournament status and statistics.

### TournamentStateManager

#### saveTournamentState(tournament)
Saves tournament state to persistent storage.

#### loadTournamentState(tournamentId)
Loads tournament state from storage.

#### archiveTournament(tournament)
Archives completed tournament.

#### getPlayerStatistics(playerId)
Gets player tournament statistics.

#### getPlayerLeaderboard(options)
Gets tournament leaderboard.

## Configuration

### Default Tournament Settings

```javascript
const defaultSettings = {
    format: 'single_elimination',
    maxPlayers: 32,
    minPlayers: 4,
    raceTimeLimit: 300, // 5 minutes
    playersPerRace: 6,
    bettingEnabled: true,
    spectatorCount: 50,
    registrationTimeLimit: 600, // 10 minutes
    prizePool: 0
};
```

### Tournament Formats

#### Single Elimination
- Players are eliminated after losing one match
- Winners advance to next round
- Tournament ends when one player remains
- Fast-paced, shorter tournaments
- Suitable for 4-64 players

#### Double Elimination (Planned)
- Players get second chance through loser's bracket
- More matches, fairer elimination
- Longer tournament duration
- Better for competitive play

#### Round Robin (Planned)
- Every player competes against every other player
- Ranking based on wins/points
- Longest format but most comprehensive
- Best for smaller groups (4-16 players)

## Events

The tournament system emits various events through the existing multiplayer event system:

### Tournament Events
- `TOURNAMENT_CREATED`: Tournament created successfully
- `TOURNAMENT_STARTED`: Tournament has begun
- `TOURNAMENT_COMPLETED`: Tournament finished with winner
- `TOURNAMENT_CANCELLED`: Tournament was cancelled

### Player Events
- `TOURNAMENT_PLAYER_REGISTERED`: Player registered
- `TOURNAMENT_PLAYER_UNREGISTERED`: Player unregistered
- `TOURNAMENT_SPECTATOR_JOINED`: Spectator joined

### Match Events
- `TOURNAMENT_MATCH_STARTED`: Match began
- `TOURNAMENT_MATCH_COMPLETED`: Match finished
- `TOURNAMENT_ROUND_COMPLETED`: Tournament round finished

## Integration Guide

### With Authentication System

```javascript
import { authManager } from '../auth/AuthManager.js';
import { tournamentManager } from './src/tournament/index.js';

// Initialize tournament manager with auth
tournamentManager.authManager = authManager;
await tournamentManager.initialize();
```

### With Room Manager

```javascript
import { roomManager } from '../multiplayer/RoomManager.js';

// Tournament manager automatically integrates with room manager
// Rooms are created automatically for tournament matches
```

### With Game Engine

```javascript
import { gameEngine } from '../game/engine/GameEngine.js';

// Set game engine reference for race integration
tournamentManager.gameEngine = gameEngine;
```

## Storage and Persistence

### Local Storage Structure

```
memex_tournament_[tournamentId] - Active tournament state
memex_tournament_archive_[tournamentId] - Archived tournament
memex_tournament_history_[tournamentId] - Match history
memex_tournament_stats - Overall statistics
```

### Data Recovery

The system automatically recovers active tournaments on initialization:

```javascript
// Tournaments are restored from storage
await tournamentManager.initialize();

// Active tournaments continue from saved state
const activeTournaments = tournamentManager.listActiveTournaments();
```

## Statistics and Analytics

### Player Statistics
- Tournaments played/won
- Win rate percentage
- Average finish position
- Best tournament finish
- Favorite tournament format
- Total race time

### Tournament Analytics
- Popular tournament formats
- Average tournament duration
- Player participation trends
- Match completion rates

### Leaderboards

```javascript
// Get top tournament winners
const leaderboard = stateManager.getPlayerLeaderboard({
    limit: 10,
    sortBy: 'tournamentsWon'
});

// Get players with best win rate
const winRateLeaders = stateManager.getPlayerLeaderboard({
    limit: 10,
    sortBy: 'winRate'
});
```

## Error Handling

The tournament system includes comprehensive error handling:

### Common Errors
- Invalid tournament configuration
- Player already registered
- Tournament full
- Registration deadline passed
- Authentication failures
- Match completion errors

### Recovery Mechanisms
- State persistence prevents data loss
- Auto-save functionality
- Graceful degradation on failures
- Event-driven error propagation

## Performance Considerations

### Scalability
- Supports up to 5 concurrent tournaments
- Efficient bracket generation algorithms
- Cached state management
- Optimized storage operations

### Memory Management
- Automatic cleanup of completed tournaments
- LRU cache for frequently accessed data
- Garbage collection of unused objects
- Memory leak prevention

## Testing

### Unit Tests
```bash
npm test -- tournament/BracketManager.test.js
npm test -- tournament/TournamentManager.test.js
npm test -- tournament/TournamentStateManager.test.js
```

### Integration Tests
```bash
npm test -- tournament/integration.test.js
```

### Load Testing
```bash
npm run test:tournament:load
```

## Troubleshooting

### Common Issues

#### Tournament Won't Start
- Check minimum player count is met
- Verify registration deadline
- Ensure all players are authenticated

#### Match Not Progressing
- Check for active race in room manager
- Verify game engine integration
- Look for event listener errors

#### State Not Persisting
- Check browser storage limits
- Verify storage permissions
- Check for JSON serialization errors

### Debug Mode

```javascript
// Enable tournament debug logging
localStorage.setItem('tournament_debug', 'true');

// Check tournament status
console.log(tournamentManager.getStatistics());
console.log(bracketManager.getStatus());
```

## Future Enhancements

### Planned Features
- Double elimination brackets
- Round robin tournaments
- Swiss system tournaments
- Seeded brackets based on player ranking
- Tournament scheduling system
- Live tournament streaming integration
- Mobile tournament app
- Tournament replay system

### API Extensions
- REST API for external integrations
- Webhook support for tournament events
- Tournament template system
- Advanced analytics dashboard
- Tournament chat system

## Contributing

When contributing to the tournament system:

1. Follow existing code patterns from RoomManager and GameEngine
2. Use the established event system for communications
3. Include comprehensive error handling
4. Add unit tests for new functionality
5. Update documentation for API changes
6. Consider performance implications
7. Maintain backward compatibility

## License

This tournament system is part of the Memex Racing project and follows the same licensing terms.