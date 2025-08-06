/**
 * PreviewSystem.js - Real-time Preview Component
 * 
 * Provides real-time preview capabilities for game changes including:
 * - Asset preview (sprites, maps, sounds)
 * - Configuration preview (game settings, track configurations)
 * - Split-screen/picture-in-picture preview
 * - Before/after comparisons
 * - Live updates as users make changes
 * - Preview controls (play/pause, reset, speed)
 */

export class PreviewSystem {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.isVisible = false;
        this.isPreviewActive = false;
        this.previewMode = 'split-screen'; // 'split-screen', 'picture-in-picture', 'overlay'
        this.comparisonMode = 'side-by-side'; // 'side-by-side', 'before-after', 'overlay'
        
        // Preview state
        this.currentPreview = null;
        this.previewData = {
            before: null,
            after: null,
            current: null
        };
        
        // Animation controls
        this.animationSpeed = 1.0;
        this.isPlaying = false;
        this.animationFrame = null;
        this.lastUpdateTime = 0;
        
        // Integration references
        this.assetManager = null;
        this.configManager = null;
        this.gameEngine = null;
        
        // Preview canvases
        this.previewCanvases = {
            before: null,
            after: null,
            live: null
        };
        
        // Update listeners
        this.updateListeners = new Set();
        this.changeQueue = [];
        
        console.log('[PreviewSystem] Preview system initialized');
    }

    /**
     * Initialize the preview system
     */
    async initialize() {
        this.createPreviewContent();
        this.setupEventListeners();
        this.setupIntegrations();
        this.setupAutoRefresh();
        console.log('[PreviewSystem] Preview system ready');
    }

    /**
     * Create preview panel content structure
     */
    createPreviewContent() {
        const panel = document.getElementById('preview-panel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="panel-header">
                <div class="panel-title">
                    <span class="title-text">REAL-TIME PREVIEW</span>
                    <div class="preview-status" id="preview-status">
                        <span class="status-indicator ${this.isPreviewActive ? 'active' : 'inactive'}"></span>
                        <span class="status-text">${this.isPreviewActive ? 'LIVE' : 'PAUSED'}</span>
                    </div>
                </div>
            </div>
            
            <div class="panel-body preview-content">
                <div class="preview-controls" id="preview-controls">
                    <div class="mode-controls">
                        <label class="control-label">PREVIEW MODE:</label>
                        <select id="preview-mode-select" class="control-select">
                            <option value="split-screen">Split Screen</option>
                            <option value="picture-in-picture">Picture-in-Picture</option>
                            <option value="overlay">Overlay</option>
                        </select>
                    </div>
                    
                    <div class="comparison-controls">
                        <label class="control-label">COMPARISON:</label>
                        <select id="comparison-mode-select" class="control-select">
                            <option value="side-by-side">Side by Side</option>
                            <option value="before-after">Before/After</option>
                            <option value="overlay">Overlay</option>
                        </select>
                    </div>
                    
                    <div class="playback-controls">
                        <button class="control-btn play-pause-btn" id="play-pause-btn">
                            <span class="btn-icon">${this.isPlaying ? '⏸️' : '▶️'}</span>
                            ${this.isPlaying ? 'PAUSE' : 'PLAY'}
                        </button>
                        <button class="control-btn reset-btn" id="reset-btn">
                            <span class="btn-icon">🔄</span>
                            RESET
                        </button>
                        
                        <div class="speed-control">
                            <label for="speed-slider">SPEED: <span id="speed-value">1.0x</span></label>
                            <input type="range" id="speed-slider" min="0.1" max="3.0" step="0.1" value="1.0">
                        </div>
                    </div>
                </div>
                
                <div class="preview-container" id="preview-container">
                    <div class="preview-viewport split-screen" id="preview-viewport">
                        <!-- Before/Current view -->
                        <div class="preview-pane before-pane" id="before-pane">
                            <div class="pane-header">
                                <span class="pane-title">BEFORE / CURRENT</span>
                                <div class="pane-info" id="before-info">
                                    <span class="info-text">No preview loaded</span>
                                </div>
                            </div>
                            <div class="pane-content">
                                <canvas class="preview-canvas" id="before-canvas" width="400" height="300"></canvas>
                                <div class="preview-overlay" id="before-overlay">
                                    <div class="overlay-message">PREVIEW READY</div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- After/Live view -->
                        <div class="preview-pane after-pane" id="after-pane">
                            <div class="pane-header">
                                <span class="pane-title">AFTER / LIVE</span>
                                <div class="pane-info" id="after-info">
                                    <span class="info-text">Live updates enabled</span>
                                </div>
                            </div>
                            <div class="pane-content">
                                <canvas class="preview-canvas" id="after-canvas" width="400" height="300"></canvas>
                                <div class="preview-overlay" id="after-overlay">
                                    <div class="overlay-message">LIVE PREVIEW</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="preview-details" id="preview-details">
                    <div class="details-section">
                        <h4 class="section-title">PREVIEW INFORMATION</h4>
                        <div class="info-grid" id="preview-info-grid">
                            <div class="info-item">
                                <span class="info-label">TYPE:</span>
                                <span class="info-value" id="preview-type">None</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">SOURCE:</span>
                                <span class="info-value" id="preview-source">None</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">DIMENSIONS:</span>
                                <span class="info-value" id="preview-dimensions">N/A</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">LAST UPDATE:</span>
                                <span class="info-value" id="last-update">Never</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="details-section">
                        <h4 class="section-title">CHANGE LOG</h4>
                        <div class="change-log" id="change-log">
                            <div class="log-entry">
                                <span class="log-time">Ready</span>
                                <span class="log-message">Preview system initialized</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Initialize canvases
        this.initializePreviews();
    }

    /**
     * Initialize preview canvases
     */
    initializePreviews() {
        this.previewCanvases.before = document.getElementById('before-canvas');
        this.previewCanvases.after = document.getElementById('after-canvas');
        
        if (this.previewCanvases.before && this.previewCanvases.after) {
            // Setup canvas contexts
            this.previewCanvases.beforeCtx = this.previewCanvases.before.getContext('2d');
            this.previewCanvases.afterCtx = this.previewCanvases.after.getContext('2d');
            
            // Enable image smoothing for pixel art
            this.previewCanvases.beforeCtx.imageSmoothingEnabled = false;
            this.previewCanvases.afterCtx.imageSmoothingEnabled = false;
            
            // Set initial background
            this.clearCanvas(this.previewCanvases.beforeCtx);
            this.clearCanvas(this.previewCanvases.afterCtx);
        }
    }

    /**
     * Setup event listeners for preview controls
     */
    setupEventListeners() {
        // Preview mode selection
        const previewModeSelect = document.getElementById('preview-mode-select');
        if (previewModeSelect) {
            previewModeSelect.addEventListener('change', (e) => {
                this.setPreviewMode(e.target.value);
            });
        }

        // Comparison mode selection
        const comparisonModeSelect = document.getElementById('comparison-mode-select');
        if (comparisonModeSelect) {
            comparisonModeSelect.addEventListener('change', (e) => {
                this.setComparisonMode(e.target.value);
            });
        }

        // Play/Pause button
        const playPauseBtn = document.getElementById('play-pause-btn');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                this.togglePlayback();
            });
        }

        // Reset button
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetPreview();
            });
        }

        // Speed control
        const speedSlider = document.getElementById('speed-slider');
        if (speedSlider) {
            speedSlider.addEventListener('input', (e) => {
                this.setAnimationSpeed(parseFloat(e.target.value));
            });
        }
    }

    /**
     * Setup integrations with AssetManager and ConfigManager
     */
    setupIntegrations() {
        // Try to get references to existing managers
        if (this.uiManager && this.uiManager.scene) {
            const scene = this.uiManager.scene;
            
            // Get AssetManager reference
            if (scene.assetManager) {
                this.assetManager = scene.assetManager;
                this.setupAssetManagerIntegration();
            }
            
            // Get ConfigManager reference
            if (scene.configManager) {
                this.configManager = scene.configManager;
                this.setupConfigManagerIntegration();
            }
            
            // Get GameEngine reference
            if (scene.gameEngine) {
                this.gameEngine = scene.gameEngine;
                this.setupGameEngineIntegration();
            }
        }
        
        console.log('[PreviewSystem] Integrations setup complete');
    }

    /**
     * Setup AssetManager integration for live asset updates
     */
    setupAssetManagerIntegration() {
        if (!this.assetManager) return;
        
        // Listen for asset changes
        if (this.assetManager.on) {
            this.assetManager.on('assetLoaded', (assetData) => {
                this.handleAssetUpdate('loaded', assetData);
            });
            
            this.assetManager.on('assetUpdated', (assetData) => {
                this.handleAssetUpdate('updated', assetData);
            });
            
            this.assetManager.on('hotReload', (assetData) => {
                this.handleAssetUpdate('hotReload', assetData);
            });
        }
        
        console.log('[PreviewSystem] AssetManager integration active');
    }

    /**
     * Setup ConfigManager integration for configuration changes
     */
    setupConfigManagerIntegration() {
        if (!this.configManager) return;
        
        // Listen for config changes
        if (this.configManager.on) {
            this.configManager.on('configUpdated', (configData) => {
                this.handleConfigUpdate('updated', configData);
            });
            
            this.configManager.on('configValidated', (configData) => {
                this.handleConfigUpdate('validated', configData);
            });
        }
        
        console.log('[PreviewSystem] ConfigManager integration active');
    }

    /**
     * Setup GameEngine integration for live game state
     */
    setupGameEngineIntegration() {
        if (!this.gameEngine) return;
        
        // Listen for game state changes
        if (this.gameEngine.on) {
            this.gameEngine.on('stateChanged', (gameState) => {
                this.handleGameStateUpdate(gameState);
            });
        }
        
        console.log('[PreviewSystem] GameEngine integration active');
    }

    /**
     * Setup auto-refresh for live updates
     */
    setupAutoRefresh() {
        // Start the animation loop for live updates
        this.startAnimationLoop();
    }

    /**
     * Handle asset updates from AssetManager
     */
    handleAssetUpdate(type, assetData) {
        if (!assetData) return;
        
        this.addChangeLogEntry(`Asset ${type}: ${assetData.key || 'Unknown'}`);
        
        // Queue the asset for preview update
        this.queuePreviewUpdate({
            type: 'asset',
            action: type,
            data: assetData,
            timestamp: Date.now()
        });
        
        // If this is a sprite update and dimensions are valid for the game
        if (assetData.type === 'image' && (assetData.width === 64 || assetData.width === 128) && 
            (assetData.height === 64 || assetData.height === 128)) {
            this.previewAsset(assetData);
        }
    }

    /**
     * Handle configuration updates from ConfigManager
     */
    handleConfigUpdate(type, configData) {
        if (!configData) return;
        
        this.addChangeLogEntry(`Config ${type}: ${configData.type || 'Unknown'}`);
        
        // Queue the config for preview update
        this.queuePreviewUpdate({
            type: 'config',
            action: type,
            data: configData,
            timestamp: Date.now()
        });
        
        this.previewConfig(configData);
    }

    /**
     * Handle game state updates
     */
    handleGameStateUpdate(gameState) {
        if (!gameState) return;
        
        this.addChangeLogEntry(`Game State: ${gameState.phase || 'Updated'}`);
        
        // Queue the state for preview update
        this.queuePreviewUpdate({
            type: 'gameState',
            action: 'update',
            data: gameState,
            timestamp: Date.now()
        });
    }

    /**
     * Queue a preview update
     */
    queuePreviewUpdate(updateData) {
        this.changeQueue.push(updateData);
        
        // Process immediately if preview is active
        if (this.isPreviewActive && this.isPlaying) {
            this.processChangeQueue();
        }
    }

    /**
     * Process queued changes
     */
    processChangeQueue() {
        if (this.changeQueue.length === 0) return;
        
        const updates = [...this.changeQueue];
        this.changeQueue = [];
        
        updates.forEach(update => {
            this.applyPreviewUpdate(update);
        });
    }

    /**
     * Apply a single preview update
     */
    applyPreviewUpdate(update) {
        switch (update.type) {
            case 'asset':
                this.updateAssetPreview(update.data);
                break;
            case 'config':
                this.updateConfigPreview(update.data);
                break;
            case 'gameState':
                this.updateGameStatePreview(update.data);
                break;
        }
    }

    /**
     * Preview an asset (sprite, map, etc.)
     */
    async previewAsset(assetData) {
        if (!assetData) return;
        
        try {
            // Update preview info
            this.updatePreviewInfo('Asset', assetData.key || 'Unknown', 
                `${assetData.width || 'N/A'}x${assetData.height || 'N/A'}`);
            
            // Load the asset for preview
            if (assetData.url || assetData.path) {
                const img = new Image();
                img.onload = () => {
                    this.drawImageToCanvas(img, this.previewCanvases.afterCtx, 'Asset Preview');
                };
                img.src = assetData.url || assetData.path;
            }
            
        } catch (error) {
            console.error('[PreviewSystem] Error previewing asset:', error);
            this.addChangeLogEntry(`Error: ${error.message}`, 'error');
        }
    }

    /**
     * Preview a configuration change
     */
    previewConfig(configData) {
        if (!configData) return;
        
        try {
            // Update preview info
            this.updatePreviewInfo('Config', configData.type || 'Unknown', 'Configuration');
            
            // Draw configuration visualization
            this.drawConfigToCanvas(configData, this.previewCanvases.afterCtx);
            
        } catch (error) {
            console.error('[PreviewSystem] Error previewing config:', error);
            this.addChangeLogEntry(`Error: ${error.message}`, 'error');
        }
    }

    /**
     * Update asset preview
     */
    updateAssetPreview(assetData) {
        this.previewAsset(assetData);
    }

    /**
     * Update configuration preview
     */
    updateConfigPreview(configData) {
        this.previewConfig(configData);
    }

    /**
     * Update game state preview
     */
    updateGameStatePreview(gameState) {
        // Draw game state visualization
        this.drawGameStateToCanvas(gameState, this.previewCanvases.afterCtx);
    }

    /**
     * Draw image to canvas with scaling and centering
     */
    drawImageToCanvas(img, ctx, label = '') {
        if (!img || !ctx) return;
        
        const canvas = ctx.canvas;
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        
        // Clear canvas
        this.clearCanvas(ctx);
        
        // Calculate scaling to fit the image in the canvas
        const scale = Math.min(canvasWidth / img.width, canvasHeight / img.height);
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        
        // Center the image
        const x = (canvasWidth - scaledWidth) / 2;
        const y = (canvasHeight - scaledHeight) / 2;
        
        // Draw the image
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        
        // Draw label if provided
        if (label) {
            ctx.fillStyle = '#00ff00';
            ctx.font = '12px Courier New';
            ctx.fillText(label, 10, 20);
        }
    }

    /**
     * Draw configuration visualization to canvas
     */
    drawConfigToCanvas(configData, ctx) {
        if (!ctx) return;
        
        this.clearCanvas(ctx);
        
        // Draw config visualization (simple text representation)
        ctx.fillStyle = '#00ff00';
        ctx.font = '14px Courier New';
        
        const lines = [
            `Config Type: ${configData.type || 'Unknown'}`,
            `Status: ${configData.state || 'Unknown'}`,
            `Keys: ${Object.keys(configData.data || {}).length}`,
            `Last Modified: ${new Date(configData.metadata?.lastModified || Date.now()).toLocaleTimeString()}`
        ];
        
        lines.forEach((line, index) => {
            ctx.fillText(line, 10, 30 + (index * 20));
        });
        
        // Draw simple visualization
        ctx.strokeStyle = '#00ff00';
        ctx.strokeRect(50, 120, 300, 100);
        ctx.fillText('Configuration Data', 150, 180);
    }

    /**
     * Draw game state visualization to canvas
     */
    drawGameStateToCanvas(gameState, ctx) {
        if (!ctx) return;
        
        this.clearCanvas(ctx);
        
        // Draw game state visualization
        ctx.fillStyle = '#00ff00';
        ctx.font = '14px Courier New';
        
        const lines = [
            `Phase: ${gameState.phase || 'Unknown'}`,
            `Players: ${gameState.players?.length || 0}`,
            `Time: ${gameState.timeRemaining || 'N/A'}`,
            `State: ${gameState.status || 'Unknown'}`
        ];
        
        lines.forEach((line, index) => {
            ctx.fillText(line, 10, 30 + (index * 20));
        });
        
        // Draw simple game visualization
        ctx.strokeStyle = '#00ff00';
        ctx.strokeRect(50, 120, 300, 100);
        ctx.fillText('Game State', 170, 180);
    }

    /**
     * Clear canvas with background
     */
    clearCanvas(ctx) {
        if (!ctx) return;
        
        const canvas = ctx.canvas;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid pattern
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.1)';
        ctx.lineWidth = 1;
        
        for (let x = 0; x < canvas.width; x += 20) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        
        for (let y = 0; y < canvas.height; y += 20) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }

    /**
     * Set preview mode
     */
    setPreviewMode(mode) {
        this.previewMode = mode;
        
        const viewport = document.getElementById('preview-viewport');
        if (viewport) {
            viewport.className = `preview-viewport ${mode}`;
        }
        
        this.addChangeLogEntry(`Preview mode: ${mode}`);
        console.log('[PreviewSystem] Preview mode set to:', mode);
    }

    /**
     * Set comparison mode
     */
    setComparisonMode(mode) {
        this.comparisonMode = mode;
        
        const viewport = document.getElementById('preview-viewport');
        if (viewport) {
            viewport.classList.add(`comparison-${mode}`);
        }
        
        this.addChangeLogEntry(`Comparison mode: ${mode}`);
        console.log('[PreviewSystem] Comparison mode set to:', mode);
    }

    /**
     * Toggle playback
     */
    togglePlayback() {
        this.isPlaying = !this.isPlaying;
        
        const playPauseBtn = document.getElementById('play-pause-btn');
        if (playPauseBtn) {
            const icon = playPauseBtn.querySelector('.btn-icon');
            const text = playPauseBtn.childNodes[playPauseBtn.childNodes.length - 1];
            
            if (icon) icon.textContent = this.isPlaying ? '⏸️' : '▶️';
            if (text) text.textContent = this.isPlaying ? 'PAUSE' : 'PLAY';
        }
        
        this.updatePreviewStatus();
        this.addChangeLogEntry(`Playback ${this.isPlaying ? 'started' : 'paused'}`);
        
        if (this.isPlaying) {
            this.processChangeQueue();
        }
    }

    /**
     * Reset preview
     */
    resetPreview() {
        // Clear canvases
        if (this.previewCanvases.beforeCtx) {
            this.clearCanvas(this.previewCanvases.beforeCtx);
        }
        if (this.previewCanvases.afterCtx) {
            this.clearCanvas(this.previewCanvases.afterCtx);
        }
        
        // Reset data
        this.previewData = { before: null, after: null, current: null };
        this.changeQueue = [];
        
        // Update UI
        this.updatePreviewInfo('None', 'None', 'N/A');
        this.addChangeLogEntry('Preview reset');
        
        console.log('[PreviewSystem] Preview reset');
    }

    /**
     * Set animation speed
     */
    setAnimationSpeed(speed) {
        this.animationSpeed = Math.max(0.1, Math.min(3.0, speed));
        
        const speedValue = document.getElementById('speed-value');
        if (speedValue) {
            speedValue.textContent = `${this.animationSpeed.toFixed(1)}x`;
        }
        
        this.addChangeLogEntry(`Speed: ${this.animationSpeed.toFixed(1)}x`);
    }

    /**
     * Start animation loop
     */
    startAnimationLoop() {
        const animate = (currentTime) => {
            if (currentTime - this.lastUpdateTime >= (1000 / (60 * this.animationSpeed))) {
                if (this.isPlaying) {
                    this.processChangeQueue();
                }
                this.lastUpdateTime = currentTime;
            }
            
            this.animationFrame = requestAnimationFrame(animate);
        };
        
        this.animationFrame = requestAnimationFrame(animate);
    }

    /**
     * Stop animation loop
     */
    stopAnimationLoop() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    /**
     * Update preview information display
     */
    updatePreviewInfo(type, source, dimensions) {
        const typeElement = document.getElementById('preview-type');
        const sourceElement = document.getElementById('preview-source');
        const dimensionsElement = document.getElementById('preview-dimensions');
        const lastUpdateElement = document.getElementById('last-update');
        
        if (typeElement) typeElement.textContent = type;
        if (sourceElement) sourceElement.textContent = source;
        if (dimensionsElement) dimensionsElement.textContent = dimensions;
        if (lastUpdateElement) lastUpdateElement.textContent = new Date().toLocaleTimeString();
    }

    /**
     * Update preview status indicator
     */
    updatePreviewStatus() {
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('.status-text');
        
        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${this.isPreviewActive && this.isPlaying ? 'active' : 'inactive'}`;
        }
        
        if (statusText) {
            statusText.textContent = this.isPreviewActive && this.isPlaying ? 'LIVE' : 'PAUSED';
        }
    }

    /**
     * Add entry to change log
     */
    addChangeLogEntry(message, type = 'info') {
        const changeLog = document.getElementById('change-log');
        if (!changeLog) return;
        
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.innerHTML = `
            <span class="log-time">${new Date().toLocaleTimeString()}</span>
            <span class="log-message">${message}</span>
        `;
        
        // Add to top of log
        changeLog.insertBefore(entry, changeLog.firstChild);
        
        // Limit log entries to 50
        while (changeLog.children.length > 50) {
            changeLog.removeChild(changeLog.lastChild);
        }
    }

    /**
     * Show preview panel
     */
    show() {
        const panel = document.getElementById('preview-panel');
        if (panel) {
            panel.classList.remove('hidden');
            this.isVisible = true;
            this.isPreviewActive = true;
            this.updatePreviewStatus();
            this.addChangeLogEntry('Preview panel opened');
        }
    }

    /**
     * Hide preview panel
     */
    hide() {
        const panel = document.getElementById('preview-panel');
        if (panel) {
            panel.classList.add('hidden');
            this.isVisible = false;
            this.isPreviewActive = false;
            this.updatePreviewStatus();
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
        return document.getElementById('preview-panel');
    }

    /**
     * Get preview system state
     */
    getPreviewState() {
        return {
            isVisible: this.isVisible,
            isActive: this.isPreviewActive,
            isPlaying: this.isPlaying,
            mode: this.previewMode,
            comparisonMode: this.comparisonMode,
            speed: this.animationSpeed,
            queueLength: this.changeQueue.length
        };
    }

    /**
     * Register update listener
     */
    onUpdate(callback) {
        this.updateListeners.add(callback);
    }

    /**
     * Unregister update listener
     */
    offUpdate(callback) {
        this.updateListeners.delete(callback);
    }

    /**
     * Notify update listeners
     */
    notifyUpdateListeners(data) {
        this.updateListeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('[PreviewSystem] Error in update listener:', error);
            }
        });
    }

    /**
     * Destroy the preview system
     */
    destroy() {
        this.stopAnimationLoop();
        this.updateListeners.clear();
        this.changeQueue = [];
        this.previewData = { before: null, after: null, current: null };
        console.log('[PreviewSystem] Preview system destroyed');
    }
}