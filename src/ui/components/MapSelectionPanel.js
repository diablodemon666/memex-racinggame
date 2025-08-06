/**
 * MapSelectionPanel.js - Map Selection Interface Component
 * 
 * Handles map preview display, selection state management, and integration
 * with the game's map rotation system between races.
 */

export class MapSelectionPanel {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.isVisible = false;
        this.isSelectionActive = false;
        
        // Map selection state
        this.selectedMap = 'classic';
        this.currentMap = 'classic';
        this.availableMaps = new Map();
        this.racesUntilRotation = 3;
        this.totalRaces = 0;
        this.mapRotationEnabled = true;
        
        // Map configurations from claudeweb
        this.MAPS = {
            classic: {
                name: "Classic Maze",
                description: "The original challenging maze",
                difficulty: "Medium",
                backgroundColor: 0x1a3a1a,
                trackColor: 0xffffff,
                generator: 'createClassicMazeTrack'
            },
            speedway: {
                name: "Speed Circuit",
                description: "Wide tracks for high-speed racing",
                difficulty: "Easy",
                backgroundColor: 0x222222,
                trackColor: 0xffcc00,
                generator: 'createSpeedwayTrack'
            },
            serpentine: {
                name: "Serpentine Path",
                description: "Winding snake-like track",
                difficulty: "Hard",
                backgroundColor: 0x0a0a2a,
                trackColor: 0x00ffff,
                generator: 'createSerpentineTrack'
            },
            grid: {
                name: "Grid Lock",
                description: "City block style grid",
                difficulty: "Medium",
                backgroundColor: 0x2a2a2a,
                trackColor: 0xff00ff,
                generator: 'createGridTrack'
            },
            spiral: {
                name: "Spiral Madness",
                description: "Hypnotic spiral track",
                difficulty: "Very Hard",
                backgroundColor: 0x2a0a0a,
                trackColor: 0xffff00,
                generator: 'createSpiralTrack'
            },
            islands: {
                name: "Island Hopper",
                description: "Connected island tracks",
                difficulty: "Medium",
                backgroundColor: 0x0a2a2a,
                trackColor: 0x00ff00,
                generator: 'createIslandsTrack'
            }
        };
        
        console.log('[MapSelectionPanel] Map selection panel initialized');
    }

    /**
     * Initialize the map selection panel
     */
    async initialize() {
        this.createPanelContent();
        this.setupEventListeners();
        this.initializeMapPreviews();
        console.log('[MapSelectionPanel] Panel initialized');
    }

    /**
     * Create map selection panel content structure
     */
    createPanelContent() {
        const panel = document.getElementById('map-selection-panel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="map-selection-overlay">
                <div class="map-selection-modal">
                    <div class="panel-header">
                        <div class="panel-title">
                            <span class="title-text pixel-text">SELECT TRACK</span>
                            <div class="rotation-info">
                                <span class="rotation-text">Maps rotate every 3 races!</span>
                                <div class="race-counter">
                                    <span class="label">Races until rotation:</span>
                                    <span class="value" id="races-remaining">${this.racesUntilRotation}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="panel-body map-selection-content">
                        <div class="maps-grid" id="maps-grid">
                            <!-- Map options will be dynamically generated -->
                        </div>
                        
                        <div class="selection-info" id="selection-info">
                            <div class="selected-map-details">
                                <div class="map-name" id="selected-map-name">Classic Maze</div>
                                <div class="map-description" id="selected-map-description">The original challenging maze</div>
                                <div class="map-difficulty" id="selected-map-difficulty">
                                    <span class="difficulty-label">Difficulty:</span>
                                    <span class="difficulty-value">Medium</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="selection-controls">
                            <button class="action-btn confirm-btn" id="confirm-map-btn">
                                <span class="btn-icon">✓</span>
                                CONFIRM SELECTION
                            </button>
                            <button class="action-btn random-btn" id="random-map-btn">
                                <span class="btn-icon">🎲</span>
                                RANDOM MAP
                            </button>
                            <button class="action-btn cancel-btn" id="cancel-selection-btn">
                                <span class="btn-icon">✕</span>
                                CANCEL
                            </button>
                        </div>
                        
                        <div class="current-map-info" id="current-map-info">
                            <div class="info-row">
                                <span class="label">Current Track:</span>
                                <span class="value" id="current-map-name">Classic Maze</span>
                            </div>
                            <div class="info-row">
                                <span class="label">Total Races:</span>
                                <span class="value" id="total-races-count">${this.totalRaces}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Setup event listeners for map selection interactions
     */
    setupEventListeners() {
        // Confirm selection button
        const confirmBtn = document.getElementById('confirm-map-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.confirmSelection());
        }

        // Random map button
        const randomBtn = document.getElementById('random-map-btn');
        if (randomBtn) {
            randomBtn.addEventListener('click', () => this.selectRandomMap());
        }

        // Cancel button
        const cancelBtn = document.getElementById('cancel-selection-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hide());
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (!this.isVisible) return;
            
            switch(e.key) {
                case 'Enter':
                    this.confirmSelection();
                    break;
                case 'Escape':
                    this.hide();
                    break;
                case 'r':
                case 'R':
                    this.selectRandomMap();
                    break;
            }
        });

        // Close on overlay click
        const overlay = document.querySelector('.map-selection-overlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.hide();
                }
            });
        }
    }

    /**
     * Initialize map preview grid with clickable options
     */
    initializeMapPreviews() {
        const mapsGrid = document.getElementById('maps-grid');
        if (!mapsGrid) return;

        mapsGrid.innerHTML = '';

        Object.entries(this.MAPS).forEach(([mapKey, mapData]) => {
            const mapOption = this.createMapOption(mapKey, mapData);
            mapsGrid.appendChild(mapOption);
        });

        // Set initial selection
        this.updateSelectedMap(this.selectedMap);
    }

    /**
     * Create a map option element with preview
     */
    createMapOption(mapKey, mapData) {
        const mapOption = document.createElement('div');
        mapOption.className = 'map-option';
        mapOption.dataset.mapKey = mapKey;
        
        // Create preview canvas
        const previewCanvas = this.createMapPreview(mapKey, mapData);
        
        // Set selection state
        if (mapKey === this.selectedMap) {
            mapOption.classList.add('selected');
        }
        
        mapOption.innerHTML = `
            <div class="map-preview">
                ${previewCanvas.outerHTML}
            </div>
            <div class="map-info">
                <div class="map-title">${mapData.name}</div>
                <div class="map-difficulty-badge difficulty-${mapData.difficulty.toLowerCase().replace(' ', '-')}">
                    ${mapData.difficulty}
                </div>
            </div>
        `;
        
        // Add click handler
        mapOption.addEventListener('click', () => {
            this.selectMap(mapKey);
        });
        
        // Add hover effects
        mapOption.addEventListener('mouseenter', () => {
            this.previewMap(mapKey);
        });
        
        return mapOption;
    }

    /**
     * Create a mini preview canvas for a map
     */
    createMapPreview(mapKey, mapData) {
        const canvas = document.createElement('canvas');
        canvas.width = 180;
        canvas.height = 120;
        canvas.className = 'preview-canvas';
        
        const ctx = canvas.getContext('2d');
        
        // Draw background
        ctx.fillStyle = `#${mapData.backgroundColor.toString(16).padStart(6, '0')}`;
        ctx.fillRect(0, 0, 180, 120);
        
        // Draw track preview based on map type
        ctx.fillStyle = `#${mapData.trackColor.toString(16).padStart(6, '0')}`;
        
        this.drawMapPreview(ctx, mapKey);
        
        return canvas;
    }

    /**
     * Draw specific map preview patterns
     */
    drawMapPreview(ctx, mapKey) {
        switch(mapKey) {
            case 'classic':
                // Maze-like pattern
                ctx.fillRect(10, 20, 160, 10);
                ctx.fillRect(10, 50, 160, 10);
                ctx.fillRect(10, 80, 160, 10);
                ctx.fillRect(20, 20, 10, 80);
                ctx.fillRect(50, 30, 10, 50);
                ctx.fillRect(90, 20, 10, 60);
                ctx.fillRect(130, 30, 10, 50);
                ctx.fillRect(160, 20, 10, 80);
                break;
                
            case 'speedway':
                // Oval track
                ctx.fillRect(20, 10, 140, 20);
                ctx.fillRect(20, 90, 140, 20);
                ctx.fillRect(20, 10, 20, 100);
                ctx.fillRect(140, 10, 20, 100);
                // Inner obstacles
                ctx.fillRect(60, 45, 60, 10);
                ctx.fillRect(60, 65, 60, 10);
                break;
                
            case 'serpentine':
                // Winding path
                ctx.beginPath();
                ctx.moveTo(20, 60);
                for(let x = 20; x < 160; x += 10) {
                    ctx.lineTo(x, 60 + Math.sin(x * 0.1) * 30);
                }
                ctx.lineWidth = 12;
                ctx.stroke();
                break;
                
            case 'grid':
                // Grid pattern
                for(let x = 20; x < 160; x += 30) {
                    ctx.fillRect(x, 10, 10, 100);
                }
                for(let y = 20; y < 100; y += 30) {
                    ctx.fillRect(10, y, 160, 10);
                }
                break;
                
            case 'spiral':
                // Spiral pattern
                ctx.beginPath();
                for(let a = 0; a < Math.PI * 6; a += 0.1) {
                    const r = a * 8;
                    const x = 90 + Math.cos(a) * r;
                    const y = 60 + Math.sin(a) * r;
                    if(a === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.lineWidth = 8;
                ctx.stroke();
                break;
                
            case 'islands':
                // Connected islands
                ctx.fillCircle = function(x, y, r) {
                    this.beginPath();
                    this.arc(x, y, r, 0, Math.PI * 2);
                    this.fill();
                };
                ctx.fillCircle(40, 40, 20);
                ctx.fillCircle(140, 40, 20);
                ctx.fillCircle(90, 80, 20);
                ctx.fillRect(40, 35, 100, 10);
                ctx.fillRect(85, 40, 10, 40);
                break;
        }
    }

    /**
     * Show map selection panel
     */
    show() {
        const panel = document.getElementById('map-selection-panel');
        if (panel) {
            panel.style.display = 'block';
            this.isVisible = true;
            this.isSelectionActive = true;
            
            // Update current info
            this.updateCurrentMapInfo();
            
            // Trigger show event
            this.uiManager?.emit('mapSelectionShown');
        }
    }

    /**
     * Hide map selection panel
     */
    hide() {
        const panel = document.getElementById('map-selection-panel');
        if (panel) {
            panel.style.display = 'none';
            this.isVisible = false;
            this.isSelectionActive = false;
            
            // Trigger hide event
            this.uiManager?.emit('mapSelectionHidden');
        }
    }

    /**
     * Toggle panel visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Get the DOM element for this component
     * Required for AnimationManager integration
     */
    getElement() {
        return document.getElementById('map-selection-panel');
    }

    /**
     * Select a specific map
     */
    selectMap(mapKey) {
        if (!this.MAPS[mapKey]) {
            console.warn('[MapSelectionPanel] Invalid map key:', mapKey);
            return;
        }

        // Update selection
        this.selectedMap = mapKey;
        
        // Update UI
        this.updateSelectedMapVisual();
        this.updateSelectedMapInfo();
        
        console.log('[MapSelectionPanel] Map selected:', mapKey);
    }

    /**
     * Preview a map on hover (temporary visual feedback)
     */
    previewMap(mapKey) {
        if (!this.MAPS[mapKey]) return;
        
        // Update preview info without changing selection
        this.updateSelectedMapInfo(mapKey);
    }

    /**
     * Select a random map
     */
    selectRandomMap() {
        const mapKeys = Object.keys(this.MAPS);
        const randomIndex = Math.floor(Math.random() * mapKeys.length);
        const randomMapKey = mapKeys[randomIndex];
        
        this.selectMap(randomMapKey);
        this.showNotification(`Random map selected: ${this.MAPS[randomMapKey].name}`, 'info');
    }

    /**
     * Confirm the current selection
     */
    confirmSelection() {
        if (!this.isSelectionActive) return;
        
        const previousMap = this.currentMap;
        this.currentMap = this.selectedMap;
        
        // Update current map display
        this.updateCurrentMapInfo();
        
        // Trigger map change event
        this.uiManager?.emit('mapChanged', {
            previousMap,
            newMap: this.currentMap,
            mapData: this.MAPS[this.currentMap]
        });
        
        // Hide panel
        this.hide();
        
        this.showNotification(`Map changed to: ${this.MAPS[this.currentMap].name}`, 'success');
        console.log('[MapSelectionPanel] Map confirmed:', this.currentMap);
    }

    /**
     * Update visual selection state in the grid
     */
    updateSelectedMapVisual() {
        // Remove previous selection
        document.querySelectorAll('.map-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Add selection to current map
        const selectedOption = document.querySelector(`[data-map-key="${this.selectedMap}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
        }
    }

    /**
     * Update selected map information display
     */
    updateSelectedMapInfo(mapKey = null) {
        const key = mapKey || this.selectedMap;
        const mapData = this.MAPS[key];
        if (!mapData) return;
        
        const nameEl = document.getElementById('selected-map-name');
        const descEl = document.getElementById('selected-map-description');
        const difficultyEl = document.querySelector('.map-difficulty .difficulty-value');
        
        if (nameEl) nameEl.textContent = mapData.name;
        if (descEl) descEl.textContent = mapData.description;
        if (difficultyEl) {
            difficultyEl.textContent = mapData.difficulty;
            difficultyEl.className = `difficulty-value difficulty-${mapData.difficulty.toLowerCase().replace(' ', '-')}`;
        }
    }

    /**
     * Update current map information
     */
    updateCurrentMapInfo() {
        const currentMapNameEl = document.getElementById('current-map-name');
        const racesRemainingEl = document.getElementById('races-remaining');
        const totalRacesEl = document.getElementById('total-races-count');
        
        if (currentMapNameEl) {
            currentMapNameEl.textContent = this.MAPS[this.currentMap]?.name || 'Unknown';
        }
        
        if (racesRemainingEl) {
            racesRemainingEl.textContent = this.racesUntilRotation;
        }
        
        if (totalRacesEl) {
            totalRacesEl.textContent = this.totalRaces;
        }
    }

    /**
     * Update race statistics
     */
    updateRaceStats(raceData) {
        if (raceData) {
            this.totalRaces = raceData.totalRaces || this.totalRaces;
            this.racesUntilRotation = raceData.racesUntilRotation || this.racesUntilRotation;
        }
        
        this.updateCurrentMapInfo();
    }

    /**
     * Handle race completion and map rotation logic
     */
    onRaceCompleted() {
        this.totalRaces++;
        this.racesUntilRotation--;
        
        // Check for automatic rotation
        if (this.racesUntilRotation <= 0 && this.mapRotationEnabled) {
            this.racesUntilRotation = 3;
            
            // Show map selection after a delay
            setTimeout(() => {
                this.show();
            }, 2000);
        }
        
        this.updateCurrentMapInfo();
        
        console.log('[MapSelectionPanel] Race completed, rotation in:', this.racesUntilRotation);
    }

    /**
     * Get current map data
     */
    getCurrentMapData() {
        return {
            key: this.currentMap,
            data: this.MAPS[this.currentMap],
            racesUntilRotation: this.racesUntilRotation,
            totalRaces: this.totalRaces
        };
    }

    /**
     * Get selected map data
     */
    getSelectedMapData() {
        return {
            key: this.selectedMap,
            data: this.MAPS[this.selectedMap]
        };
    }

    /**
     * Set map rotation enabled/disabled
     */
    setMapRotationEnabled(enabled) {
        this.mapRotationEnabled = enabled;
        console.log('[MapSelectionPanel] Map rotation:', enabled ? 'enabled' : 'disabled');
    }

    /**
     * Show notification message
     */
    showNotification(message, type = 'info') {
        // Create or update notification element
        let notification = document.getElementById('map-selection-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'map-selection-notification';
            notification.className = 'notification';
            
            const panel = document.getElementById('map-selection-panel');
            if (panel) {
                panel.appendChild(notification);
            }
        }
        
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    /**
     * Get panel state for debugging
     */
    getState() {
        return {
            isVisible: this.isVisible,
            isSelectionActive: this.isSelectionActive,
            currentMap: this.currentMap,
            selectedMap: this.selectedMap,
            racesUntilRotation: this.racesUntilRotation,
            totalRaces: this.totalRaces,
            mapRotationEnabled: this.mapRotationEnabled
        };
    }

    /**
     * Destroy the map selection panel
     */
    destroy() {
        this.hide();
        console.log('[MapSelectionPanel] Panel destroyed');
    }
}