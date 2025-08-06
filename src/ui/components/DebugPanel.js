/**
 * DebugPanel.js - Debug Interface Component
 * 
 * Provides comprehensive debugging information for development including:
 * - Real-time player position, direction, speed tracking
 * - Stuck counter and movement analytics
 * - Heat map data of problematic track areas
 * - Top 3 problem areas listing
 * - Last 10 positions tracking for better stuck detection
 * - Visual indicators and debugging overlays
 */

export class DebugPanel {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.isVisible = false;
        this.isActive = false;
        
        // Debug data tracking
        this.currentPlayer = null;
        this.currentPlayerIndex = 0;
        this.players = [];
        this.stuckPositions = {};
        this.heatMapData = new Map();
        this.debugGraphics = null;
        this.currentScene = null;
        
        // Update intervals
        this.updateInterval = null;
        this.updateFrequency = 100; // Update every 100ms for real-time feel
        
        // Debug settings
        this.showHeatMap = true;
        this.showMovementVector = true;
        this.showStuckIndicator = true;
        this.showPositionHistory = true;
        
        console.log('[DebugPanel] Debug panel initialized');
    }

    /**
     * Initialize the debug panel
     */
    async initialize() {
        this.createPanelContent();
        this.setupEventListeners();
        this.setupKeyboardToggle();
        console.log('[DebugPanel] Panel initialized');
    }

    /**
     * Create debug panel content structure
     */
    createPanelContent() {
        const panel = document.getElementById('debug-panel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="panel-header">
                <div class="panel-title">
                    <span class="title-text">DEBUG INFO</span>
                    <div class="debug-toggle" id="debug-active-indicator">
                        <span class="status-dot"></span>
                        <span class="status-text">INACTIVE</span>
                    </div>
                </div>
            </div>
            
            <div class="panel-body debug-content">
                <div class="debug-section player-tracking" id="player-tracking">
                    <div class="section-header">
                        <h4>CURRENT PLAYER TRACKING</h4>
                        <button class="toggle-btn" id="toggle-player-tracking" title="Toggle player tracking">👁️</button>
                    </div>
                    <div class="debug-grid">
                        <div class="debug-info">
                            <span class="label">Player:</span>
                            <span class="value" id="debug-player-name">P1</span>
                        </div>
                        <div class="debug-info">
                            <span class="label">Position:</span>
                            <span class="value" id="debug-position">0, 0</span>
                        </div>
                        <div class="debug-info">
                            <span class="label">Direction:</span>
                            <span class="value" id="debug-direction">0.00</span>
                        </div>
                        <div class="debug-info">
                            <span class="label">Speed:</span>
                            <span class="value" id="debug-speed">0.00</span>
                        </div>
                        <div class="debug-info">
                            <span class="label">Stuck Counter:</span>
                            <span class="value" id="debug-stuck-counter">0</span>
                        </div>
                        <div class="debug-info">
                            <span class="label">On Track:</span>
                            <span class="value" id="debug-on-track">YES</span>
                        </div>
                    </div>
                </div>

                <div class="debug-section map-analytics" id="map-analytics">
                    <div class="section-header">
                        <h4>MAP ANALYTICS</h4>
                        <button class="toggle-btn" id="toggle-heat-map" title="Toggle heat map">🗺️</button>
                    </div>
                    <div class="debug-info">
                        <span class="label">Current Map:</span>
                        <span class="value" id="debug-current-map">Classic Maze</span>
                    </div>
                    <div class="debug-info">
                        <span class="label">Problem Areas:</span>
                        <span class="value" id="debug-problem-count">0</span>
                    </div>
                </div>

                <div class="debug-section problem-areas" id="problem-areas">
                    <div class="section-header">
                        <h4>TOP PROBLEM AREAS</h4>
                        <button class="clear-btn" id="clear-stuck-data" title="Clear stuck data">🧹</button>
                    </div>
                    <div class="problem-list" id="problem-areas-list">
                        <div class="no-problems">No problem areas detected</div>
                    </div>
                </div>

                <div class="debug-section position-history" id="position-history">
                    <div class="section-header">
                        <h4>POSITION HISTORY (LAST 10)</h4>
                        <button class="toggle-btn" id="toggle-position-history" title="Toggle position tracking">📍</button>
                    </div>
                    <div class="position-list" id="position-history-list">
                        <div class="no-history">No position data</div>
                    </div>
                </div>

                <div class="debug-section visual-controls" id="visual-controls">
                    <div class="section-header">
                        <h4>VISUAL DEBUG CONTROLS</h4>
                    </div>
                    <div class="control-grid">
                        <label class="control-item">
                            <input type="checkbox" id="show-movement-vector" checked>
                            <span>Movement Vector</span>
                        </label>
                        <label class="control-item">
                            <input type="checkbox" id="show-heat-map" checked>
                            <span>Heat Map</span>
                        </label>
                        <label class="control-item">
                            <input type="checkbox" id="show-stuck-indicator" checked>
                            <span>Stuck Indicators</span>
                        </label>
                        <label class="control-item">
                            <input type="checkbox" id="show-collision-bounds" checked>
                            <span>Collision Bounds</span>
                        </label>
                    </div>
                </div>

                <div class="debug-section performance-info" id="performance-info">
                    <div class="section-header">
                        <h4>PERFORMANCE METRICS</h4>
                    </div>
                    <div class="debug-grid">
                        <div class="debug-info">
                            <span class="label">Update Rate:</span>
                            <span class="value" id="debug-update-rate">10 Hz</span>
                        </div>
                        <div class="debug-info">
                            <span class="label">Data Points:</span>
                            <span class="value" id="debug-data-points">0</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Setup event listeners for debug interactions
     */
    setupEventListeners() {
        // Clear stuck data button
        const clearBtn = document.getElementById('clear-stuck-data');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearStuckData());
        }

        // Visual control checkboxes
        const visualControls = {
            'show-movement-vector': (checked) => this.showMovementVector = checked,
            'show-heat-map': (checked) => this.showHeatMap = checked,
            'show-stuck-indicator': (checked) => this.showStuckIndicator = checked,
            'show-collision-bounds': (checked) => this.showCollisionBounds = checked
        };

        Object.entries(visualControls).forEach(([id, handler]) => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    handler(e.target.checked);
                    this.updateVisualDebugElements();
                });
            }
        });

        // Toggle buttons
        const toggleButtons = {
            'toggle-player-tracking': () => this.togglePlayerTracking(),
            'toggle-heat-map': () => this.toggleHeatMapDisplay(),
            'toggle-position-history': () => this.togglePositionHistory()
        };

        Object.entries(toggleButtons).forEach(([id, handler]) => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', handler);
            }
        });
    }

    /**
     * Setup keyboard toggle (D key)
     */
    setupKeyboardToggle() {
        // This will be handled by the UIManager's keyboard shortcuts
        // but we can add panel-specific shortcuts here if needed
    }

    /**
     * Show debug panel and start updates
     */
    show() {
        const panel = document.getElementById('debug-panel');
        if (panel) {
            panel.classList.remove('hidden');
            this.isVisible = true;
            this.startDebugUpdates();
            this.updateActiveIndicator(true);
        }
    }

    /**
     * Hide debug panel and stop updates
     */
    hide() {
        const panel = document.getElementById('debug-panel');
        if (panel) {
            panel.classList.add('hidden');
            this.isVisible = false;
            this.stopDebugUpdates();
            this.updateActiveIndicator(false);
            this.clearDebugGraphics();
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
        return document.getElementById('debug-panel');
    }

    /**
     * Start debug information updates
     */
    startDebugUpdates() {
        if (this.updateInterval) return;
        
        this.isActive = true;
        this.updateInterval = setInterval(() => {
            this.updateDebugInfo();
            this.updateVisualDebugElements();
        }, this.updateFrequency);
        
        console.log('[DebugPanel] Started debug updates');
    }

    /**
     * Stop debug information updates
     */
    stopDebugUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.isActive = false;
    }

    /**
     * Update debug active indicator
     */
    updateActiveIndicator(isActive) {
        const indicator = document.getElementById('debug-active-indicator');
        if (indicator) {
            const dot = indicator.querySelector('.status-dot');
            const text = indicator.querySelector('.status-text');
            
            if (isActive) {
                dot.classList.add('active');
                text.textContent = 'ACTIVE';
            } else {
                dot.classList.remove('active');
                text.textContent = 'INACTIVE';
            }
        }
    }

    /**
     * Set current game scene for debug graphics
     */
    setCurrentScene(scene) {
        this.currentScene = scene;
        if (scene && scene.add) {
            // Create debug graphics if they don't exist
            if (!this.debugGraphics) {
                this.debugGraphics = scene.add.graphics();
                this.debugGraphics.setDepth(1000); // Ensure it's on top
            }
        }
    }

    /**
     * Set current player for tracking
     */
    setCurrentPlayer(playerIndex, players) {
        this.currentPlayerIndex = playerIndex;
        this.players = players || [];
        this.currentPlayer = this.players[playerIndex];
    }

    /**
     * Update stuck positions data
     */
    updateStuckPositions(stuckPositions) {
        this.stuckPositions = { ...stuckPositions };
        this.updateProblemAreas();
    }

    /**
     * Update current map information
     */
    updateMapInfo(mapName) {
        const mapElement = document.getElementById('debug-current-map');
        if (mapElement) {
            mapElement.textContent = mapName;
        }
    }

    /**
     * Main debug information update function
     */
    updateDebugInfo() {
        if (!this.isVisible || !this.currentPlayer) return;

        const player = this.currentPlayer;

        // Update player tracking info
        this.updateElement('debug-player-name', `P${this.currentPlayerIndex + 1} (${player.nameText?.text || 'Player'})`);
        this.updateElement('debug-position', `${Math.floor(player.x)}, ${Math.floor(player.y)}`);
        this.updateElement('debug-direction', player.moveDirection ? player.moveDirection.toFixed(2) : 'N/A');
        this.updateElement('debug-speed', player.currentSpeed ? player.currentSpeed.toFixed(2) : 'N/A');
        this.updateElement('debug-stuck-counter', player.stuckCounter || 0);
        
        // Update track position status
        const onTrack = this.isPlayerOnTrack(player);
        const trackElement = document.getElementById('debug-on-track');
        if (trackElement) {
            trackElement.textContent = onTrack ? 'YES' : 'NO';
            trackElement.className = `value ${onTrack ? 'on-track' : 'off-track'}`;
        }

        // Update position history
        this.updatePositionHistory(player);

        // Update performance metrics
        const dataPoints = Object.keys(this.stuckPositions).length;
        this.updateElement('debug-data-points', dataPoints);
        this.updateElement('debug-update-rate', `${(1000 / this.updateFrequency).toFixed(1)} Hz`);
    }

    /**
     * Update visual debug elements on the game canvas
     */
    updateVisualDebugElements() {
        if (!this.debugGraphics || !this.currentPlayer || !this.isVisible) return;

        // Clear previous debug graphics
        this.debugGraphics.clear();

        const player = this.currentPlayer;

        // Draw movement vector
        if (this.showMovementVector && player.moveDirection !== undefined) {
            this.debugGraphics.lineStyle(3, 0x00ff00, 0.8);
            this.debugGraphics.beginPath();
            this.debugGraphics.moveTo(player.x, player.y);
            this.debugGraphics.lineTo(
                player.x + Math.cos(player.moveDirection) * 50,
                player.y + Math.sin(player.moveDirection) * 50
            );
            this.debugGraphics.strokePath();

            // Draw direction arrow
            const arrowSize = 8;
            const arrowX = player.x + Math.cos(player.moveDirection) * 50;
            const arrowY = player.y + Math.sin(player.moveDirection) * 50;
            this.debugGraphics.fillStyle(0x00ff00, 0.8);
            this.debugGraphics.fillTriangle(
                arrowX, arrowY,
                arrowX - arrowSize * Math.cos(player.moveDirection - Math.PI / 4), 
                arrowY - arrowSize * Math.sin(player.moveDirection - Math.PI / 4),
                arrowX - arrowSize * Math.cos(player.moveDirection + Math.PI / 4), 
                arrowY - arrowSize * Math.sin(player.moveDirection + Math.PI / 4)
            );
        }

        // Draw stuck indicator
        if (this.showStuckIndicator && player.stuckCounter > 0) {
            const intensity = Math.min(player.stuckCounter / 60, 1); // Max intensity at 60 frames
            const color = intensity > 0.5 ? 0xff0000 : 0xffff00;
            this.debugGraphics.fillStyle(color, 0.3 + intensity * 0.4);
            this.debugGraphics.fillCircle(player.x, player.y, 20 + intensity * 20);
            
            // Draw stuck counter text
            if (this.currentScene && this.currentScene.add) {
                const stuckText = this.currentScene.add.text(
                    player.x, 
                    player.y - 40, 
                    `STUCK: ${player.stuckCounter}`,
                    {
                        fontSize: '14px',
                        fontFamily: 'Courier New',
                        color: intensity > 0.5 ? '#ff0000' : '#ffff00',
                        backgroundColor: '#000000',
                        padding: { x: 4, y: 2 }
                    }
                ).setOrigin(0.5);
                
                // Auto-remove after short delay
                this.currentScene.time.delayedCall(this.updateFrequency - 10, () => {
                    if (stuckText && stuckText.destroy) {
                        stuckText.destroy();
                    }
                });
            }
        }

        // Draw heat map for stuck positions
        if (this.showHeatMap) {
            Object.entries(this.stuckPositions).forEach(([posKey, count]) => {
                if (count > 3) { // Only show significant problem areas
                    const [x, y] = posKey.split(',').map(n => parseInt(n) * 10);
                    const intensity = Math.min(count / 20, 1); // Max intensity at 20 stuck events
                    const radius = 15 + intensity * 15;
                    
                    this.debugGraphics.fillStyle(0xff0000, 0.2 + intensity * 0.3);
                    this.debugGraphics.fillCircle(x, y, radius);
                    
                    // Add count text for high-problem areas
                    if (count > 10 && this.currentScene && this.currentScene.add) {
                        const countText = this.currentScene.add.text(
                            x, y, count.toString(),
                            {
                                fontSize: '12px',
                                fontFamily: 'Courier New',
                                color: '#ffffff',
                                backgroundColor: '#ff0000',
                                padding: { x: 2, y: 1 }
                            }
                        ).setOrigin(0.5);
                        
                        // Auto-remove after short delay
                        this.currentScene.time.delayedCall(this.updateFrequency - 10, () => {
                            if (countText && countText.destroy) {
                                countText.destroy();
                            }
                        });
                    }
                }
            });
        }

        // Draw collision bounds
        if (this.showCollisionBounds && player.body) {
            this.debugGraphics.lineStyle(2, 0x00ffff, 0.6);
            this.debugGraphics.strokeRect(
                player.body.x, 
                player.body.y, 
                player.body.width, 
                player.body.height
            );
        }

        // Draw position history trail
        if (this.showPositionHistory && player.lastPositions && player.lastPositions.length > 1) {
            this.debugGraphics.lineStyle(2, 0xffff00, 0.4);
            this.debugGraphics.beginPath();
            
            player.lastPositions.forEach((pos, index) => {
                if (index === 0) {
                    this.debugGraphics.moveTo(pos.x, pos.y);
                } else {
                    this.debugGraphics.lineTo(pos.x, pos.y);
                }
            });
            
            this.debugGraphics.strokePath();
        }
    }

    /**
     * Update position history display
     */
    updatePositionHistory(player) {
        const historyList = document.getElementById('position-history-list');
        if (!historyList || !player.lastPositions) return;

        if (player.lastPositions.length === 0) {
            historyList.innerHTML = '<div class="no-history">No position data</div>';
            return;
        }

        const recentPositions = player.lastPositions.slice(-10).reverse();
        historyList.innerHTML = recentPositions.map((pos, index) => `
            <div class="position-item ${index === 0 ? 'current' : ''}">
                <span class="position-index">${10 - index}:</span>
                <span class="position-coords">(${Math.floor(pos.x)}, ${Math.floor(pos.y)})</span>
                <span class="position-time">${pos.time ? new Date(pos.time).toLocaleTimeString() : 'N/A'}</span>
            </div>
        `).join('');
    }

    /**
     * Update problem areas display
     */
    updateProblemAreas() {
        const problemList = document.getElementById('problem-areas-list');
        const problemCount = document.getElementById('debug-problem-count');
        
        if (!problemList) return;

        // Get top 3 problem areas
        const topProblems = Object.entries(this.stuckPositions)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .filter(([,count]) => count > 5); // Only show significant problems

        if (problemCount) {
            problemCount.textContent = topProblems.length;
        }

        if (topProblems.length === 0) {
            problemList.innerHTML = '<div class="no-problems">No significant problem areas detected</div>';
            return;
        }

        problemList.innerHTML = topProblems.map(([posKey, count], index) => {
            const [x, y] = posKey.split(',').map(n => parseInt(n) * 10);
            const severity = count > 20 ? 'high' : count > 10 ? 'medium' : 'low';
            
            return `
                <div class="problem-item severity-${severity}">
                    <div class="problem-rank">#${index + 1}</div>
                    <div class="problem-info">
                        <div class="problem-location">(${x}, ${y})</div>
                        <div class="problem-count">${count} incidents</div>
                    </div>
                    <div class="problem-actions">
                        <button class="teleport-btn" onclick="window.debugPanel?.teleportToPosition(${x}, ${y})" title="Teleport to location">📍</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Clear stuck data
     */
    clearStuckData() {
        this.stuckPositions = {};
        this.heatMapData.clear();
        this.updateProblemAreas();
        console.log('[DebugPanel] Cleared stuck data');
    }

    /**
     * Clear debug graphics
     */
    clearDebugGraphics() {
        if (this.debugGraphics) {
            this.debugGraphics.clear();
        }
    }

    /**
     * Toggle player tracking
     */
    togglePlayerTracking() {
        // Could cycle through different players or toggle different tracking modes
        console.log('[DebugPanel] Toggle player tracking');
    }

    /**
     * Toggle heat map display
     */
    toggleHeatMapDisplay() {
        this.showHeatMap = !this.showHeatMap;
        const checkbox = document.getElementById('show-heat-map');
        if (checkbox) {
            checkbox.checked = this.showHeatMap;
        }
    }

    /**
     * Toggle position history
     */
    togglePositionHistory() {
        this.showPositionHistory = !this.showPositionHistory;
        const checkbox = document.getElementById('show-position-history');
        if (checkbox) {
            checkbox.checked = this.showPositionHistory;
        }
    }

    /**
     * Teleport to specific position (debugging utility)
     */
    teleportToPosition(x, y) {
        if (this.currentPlayer && this.uiManager && this.uiManager.game) {
            this.currentPlayer.x = x;
            this.currentPlayer.y = y;
            this.currentPlayer.stuckCounter = 0;
            console.log(`[DebugPanel] Teleported player to (${x}, ${y})`);
        }
    }

    /**
     * Check if player is on track (placeholder - would need track collision data)
     */
    isPlayerOnTrack(player) {
        // This would integrate with the game's track collision detection
        // For now, return true as placeholder
        return true;
    }

    /**
     * Helper function to update DOM element text content
     */
    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    /**
     * Get current debug state
     */
    getDebugState() {
        return {
            isVisible: this.isVisible,
            isActive: this.isActive,
            currentPlayer: this.currentPlayerIndex,
            stuckPositions: Object.keys(this.stuckPositions).length,
            updateRate: 1000 / this.updateFrequency
        };
    }

    /**
     * Destroy the debug panel
     */
    destroy() {
        this.stopDebugUpdates();
        this.clearDebugGraphics();
        
        if (this.debugGraphics && this.debugGraphics.destroy) {
            this.debugGraphics.destroy();
        }
        
        console.log('[DebugPanel] Panel destroyed');
    }
}

// Make debug panel globally accessible for debugging utilities
if (typeof window !== 'undefined') {
    window.debugPanel = null;
}