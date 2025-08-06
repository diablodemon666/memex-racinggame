# PresetManager Component

The PresetManager component provides comprehensive configuration preset management for the Memex Racing game. It allows users to save, load, import, export, and organize game configuration presets across different categories.

## Features

### 🎮 Core Functionality
- **Preset Categories**: Game Mode, Visual Theme, Difficulty, Track Setup, Player Config, Complete Config
- **CRUD Operations**: Create, read, update, and delete presets
- **Import/Export**: Save presets as JSON files and share with other users
- **Preview System**: Live preview of preset effects before applying
- **Configuration Integration**: Seamless integration with the ConfigManager system

### 🎨 User Interface
- **Tabbed Categories**: Easy navigation between different preset types
- **Modal Creation Dialog**: Form-based preset creation with validation
- **Responsive Design**: Works on desktop and mobile devices
- **Keyboard Shortcuts**: Quick access via 'R' key
- **Drag & Drop**: Support for importing preset files

### ⚙️ Technical Features
- **Validation**: Built-in preset data validation
- **Error Handling**: Comprehensive error handling and user feedback
- **Performance**: Efficient preset storage and retrieval
- **Extensibility**: Easy to add new preset categories and types

## Usage

### Basic Setup

```javascript
import { PresetManager } from './components/PresetManager';

// Initialize with UIManager
const presetManager = new PresetManager(uiManager);
await presetManager.initialize();

// Show the preset manager
presetManager.show();
```

### Integration with UIManager

The PresetManager is automatically integrated into the UIManager:

```javascript
// UIManager automatically creates and manages PresetManager
const uiManager = new UIManager(game);
await uiManager.initialize();

// Access via UIManager
uiManager.togglePanel('presetManager');
```

### Keyboard Shortcuts

- **R**: Toggle preset manager visibility
- **Escape**: Close preset manager and modals
- **Tab/Shift+Tab**: Navigate form controls
- **Enter**: Confirm actions in modals

## API Reference

### Constructor

```javascript
new PresetManager(uiManager)
```

**Parameters:**
- `uiManager` (UIManager): Reference to the main UI manager

### Methods

#### `initialize()`
Initializes the preset manager and loads default presets.

```javascript
await presetManager.initialize();
```

#### `show()`
Shows the preset manager panel.

```javascript
presetManager.show();
```

#### `hide()`
Hides the preset manager panel.

```javascript
presetManager.hide();
```

#### `toggle()`
Toggles preset manager visibility.

```javascript
presetManager.toggle();
```

#### `switchCategory(category)`
Switches to a different preset category.

```javascript
presetManager.switchCategory('visual-theme');
```

#### `createPresetObject(data)`
Creates a new preset object with metadata.

```javascript
const preset = presetManager.createPresetObject({
    name: 'My Preset',
    description: 'Custom racing settings',
    category: 'game-mode',
    config: { /* configuration data */ }
});
```

#### `applyPreset(preset)`
Applies a preset to the game configuration.

```javascript
await presetManager.applyPreset(preset);
```

#### `exportSelectedPreset()`
Exports the currently selected preset as a JSON file.

```javascript
await presetManager.exportSelectedPreset();
```

## Preset Categories

### 🏁 Game Mode
- **Description**: Racing game mode configurations
- **Config Types**: `game-settings`, `multiplayer-settings`
- **Use Cases**: Speed racing, endurance mode, tournament settings

### 🎨 Visual Theme
- **Description**: Visual appearance and UI themes
- **Config Types**: `visual-settings`, `audio-settings`
- **Use Cases**: Dark theme, retro mode, accessibility settings

### ⚡ Difficulty
- **Description**: Game difficulty and challenge settings
- **Config Types**: `game-settings`, `power-up-definitions`
- **Use Cases**: Easy mode, hardcore racing, balanced gameplay

### 🛣️ Track Setup
- **Description**: Track and map configurations
- **Config Types**: `track-configurations`
- **Use Cases**: Map rotations, custom track layouts, themed circuits

### 👤 Player Config
- **Description**: Player and AI configurations
- **Config Types**: `player-preferences`
- **Use Cases**: Default names, AI difficulty, control schemes

### 📦 Complete Config
- **Description**: Full game configuration packages
- **Config Types**: All configuration types
- **Use Cases**: Complete game setups, tournament packages, game modes

## Preset File Format

Preset files are JSON documents with the following structure:

```json
{
    "name": "Speed Demon Mode",
    "description": "High-speed racing with increased player speeds",
    "author": "Player Name",
    "tags": ["fast", "intense", "competitive"],
    "category": "game-mode",
    "version": "1.0.0",
    "config": {
        "game-settings": {
            "game": {
                "maxPlayers": 6,
                "raceTimeLimit": 180
            },
            "movement": {
                "baseSpeed": 200,
                "maxSpeed": 500
            }
        }
    },
    "exportedAt": 1703123456789
}
```

## Customization

### Adding New Categories

To add a new preset category:

1. Update the `presetCategories` object in the constructor:

```javascript
this.presetCategories['custom-category'] = {
    name: 'Custom Category',
    icon: '🔧',
    description: 'Custom configuration category',
    configTypes: [ConfigType.CUSTOM_SETTINGS],
    color: '#ff6600'
};
```

2. Add custom validation in `performCustomValidations`:

```javascript
case 'custom-category':
    this.validateCustomCategory(configData, result);
    break;
```

### Styling Customization

The preset manager uses CSS classes that can be customized:

- `.ui-panel.preset-manager`: Main panel container
- `.category-tab`: Category selection tabs
- `.preset-item`: Individual preset items
- `.preset-creation-modal`: Creation modal dialog

## Events

The PresetManager emits events through the UI event system:

```javascript
// Listen for preset events
uiManager.addEventListener('presetCreated', (data) => {
    console.log('Preset created:', data.preset.name);
});

uiManager.addEventListener('presetLoaded', (data) => {
    console.log('Preset applied:', data.preset.name);
});
```

## Error Handling

The PresetManager includes comprehensive error handling:

- **File Import Errors**: Invalid JSON, unsupported formats, size limits
- **Validation Errors**: Configuration validation failures
- **Storage Errors**: Local storage quota exceeded
- **Network Errors**: Failed configuration updates

All errors are displayed to the user via toast notifications and logged to the console.

## Demo

A complete demo is available at `src/ui/demo/preset-manager-demo.html` which demonstrates:

- All preset management features
- Integration with mock ConfigManager
- Keyboard shortcuts and interactions
- Import/export functionality
- Category switching and preset creation

## Browser Compatibility

The PresetManager supports:

- **Modern Browsers**: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- **Features Used**: ES6 modules, async/await, FileReader API, JSON parsing
- **Fallbacks**: Graceful degradation for unsupported features

## Performance Considerations

- **Memory Usage**: Presets are stored in memory for fast access
- **File Size Limits**: 1MB limit for imported preset files
- **Caching**: Efficient preset caching and retrieval
- **Cleanup**: Proper memory cleanup on component destruction

## Security

- **Input Validation**: All user inputs are validated and sanitized
- **File Validation**: Imported files are validated for format and content
- **XSS Prevention**: All dynamic content is properly escaped
- **Safe Parsing**: JSON parsing with error handling

## Troubleshooting

### Common Issues

1. **Preset Not Loading**: Check browser console for validation errors
2. **Import Fails**: Ensure file is valid JSON and under 1MB
3. **Export Not Working**: Check browser popup/download settings
4. **UI Not Responding**: Verify ConfigManager integration

### Debug Mode

Enable debug logging:

```javascript
// In browser console
localStorage.setItem('presetManager.debug', 'true');
location.reload();
```

This enables detailed logging of all preset operations and state changes.