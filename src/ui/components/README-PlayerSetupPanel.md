# PlayerSetupPanel Component

A modular UI component for player customization and race joining functionality in Memex Racing game.

## Overview

The PlayerSetupPanel component provides a comprehensive interface for players to:
- Set their display name (up to 12 characters)
- Upload and customize their player avatar
- Join races with automatic bet placement
- View current player assignment and map information
- Access keyboard shortcuts and help information

## Features

### Player Customization
- **Name Input**: Real-time name editing with character count limit
- **Image Upload**: Drag & drop or click to upload custom avatar
- **Auto Resize**: Images automatically resized to 128x128 pixels with pixelated rendering
- **Preview**: Live preview of uploaded image
- **Player Assignment**: Shows current player slot (P1-P6) with color coding

### Race Management
- **Join Race Button**: One-click joining with mandatory bet placement
- **Real-time Updates**: Changes apply instantly to the game character
- **Race Reset**: Automatic reset functionality for new races
- **Status Display**: Visual feedback for join status

### Information Display
- **Map Information**: Current track name and rotation countdown
- **Keyboard Shortcuts**: Help section with available controls
- **Preparation Tips**: Helpful information for new players

## Usage

### Basic Implementation

```javascript
import { PlayerSetupPanel } from './components/PlayerSetupPanel.js';

// Initialize with UIManager
const playerSetupPanel = new PlayerSetupPanel(uiManager);
await playerSetupPanel.initialize();
```

### Integration with UIManager

```javascript
// UIManager automatically handles PlayerSetupPanel
import { UIManager } from './UIManager.js';

const uiManager = new UIManager(game);
await uiManager.initialize();

// Access via UIManager
const playerState = uiManager.getPlayerSetupState();
```

## API Reference

### Constructor
```javascript
new PlayerSetupPanel(uiManager)
```

**Parameters:**
- `uiManager` (UIManager): The UI manager instance for integration

### Methods

#### `async initialize()`
Initialize the panel and create DOM elements.

#### `setCurrentPlayer(index)`
Set the current player index (0-5 for P1-P6).

**Parameters:**
- `index` (number): Player index (0-5)

#### `updateMapInfo(mapName, racesLeft)`
Update the displayed map information.

**Parameters:**
- `mapName` (string): Current map name
- `racesLeft` (number): Races until map rotation

#### `resetForNewRace()`
Reset the panel state for a new race (clears join status).

#### `getPlayerSetupState()`
Get the current player setup state.

**Returns:**
```javascript
{
  currentPlayerIndex: number,
  playerName: string,
  hasCustomImage: boolean,
  isJoined: boolean,
  mandatoryBetAmount: number
}
```

#### `show()` / `hide()` / `toggle()`
Control panel visibility.

### Events

The component emits events through the UIManager's game instance:

#### `playerUpdate`
Fired when player name or image changes.
```javascript
{
  playerId: number,
  type: 'name' | 'image',
  data: string | HTMLCanvasElement
}
```

#### `playerJoined`
Fired when player joins a race.
```javascript
{
  playerId: number,
  playerName: string,
  customImage: HTMLCanvasElement | null,
  betAmount: number
}
```

## Styling

The component uses CSS classes with the `.ui-panel.player-setup` namespace. Key classes:

- `.current-player-display` - Player assignment display
- `.player-name-input` - Name input field
- `.file-upload-btn` - Image upload button
- `.join-race-btn` - Race join button
- `.player-preview` - Image preview
- `.drag-over` - Drag and drop state

## Configuration

### Player Colors
```javascript
playerColors = [
  { name: 'RED', color: '#FF0000' },
  { name: 'GREEN', color: '#00FF00' },
  { name: 'BLUE', color: '#0000FF' },
  { name: 'YELLOW', color: '#FFFF00' },
  { name: 'MAGENTA', color: '#FF00FF' },
  { name: 'CYAN', color: '#00FFFF' }
]
```

### Default Settings
- Default player: P4 (Yellow)
- Mandatory bet: 100 coins
- Max name length: 12 characters
- Image size: 128x128 pixels
- Image limit: 5MB

## Integration with Game Engine

The component integrates with the game engine through event emission:

```javascript
// Player name change
this.uiManager.game.events.emit('playerUpdate', {
  playerId: this.currentPlayerIndex,
  type: 'name',
  data: playerName
});

// Player image upload
this.uiManager.game.events.emit('playerUpdate', {
  playerId: this.currentPlayerIndex,
  type: 'image',
  data: canvasElement
});

// Player joins race
this.uiManager.game.events.emit('playerJoined', {
  playerId: this.currentPlayerIndex,
  playerName: playerName,
  customImage: this.playerCustomImages[this.currentPlayerIndex],
  betAmount: this.mandatoryBetAmount
});
```

## Accessibility Features

- Keyboard navigation support
- Screen reader compatible
- Focus management
- Clear visual feedback
- Error handling with user-friendly messages

## Browser Compatibility

- Modern browsers with ES6+ support
- File API for image upload
- Canvas API for image processing
- Drag and Drop API for enhanced UX

## Demo

A complete demo is available at `src/ui/demo/player-setup-demo.html` showcasing all features and interactions.

## Dependencies

- UIManager integration
- CSS styles from `game-ui.css`
- HTML5 Canvas API
- File API
- Modern JavaScript (ES6+)

## Error Handling

The component includes comprehensive error handling for:
- Invalid image files
- File size limits
- Upload failures
- Canvas processing errors
- Network issues

All errors are displayed to users via the notification system.