/**
 * TrackPreview.js - Real-time Track Preview Component
 * 
 * Provides real-time preview functionality for the track editor, showing:
 * - Live track rendering with game-accurate physics
 * - Test AI racers moving on the track
 * - Collision detection visualization
 * - Starting positions and M token placement
 * - Performance metrics and validation
 */

import { PhysicsManager } from '../../game/engine/PhysicsManager.js';
import { RenderManager } from '../../game/engine/RenderManager.js';
import { AIPlayerManager } from '../../game/systems/AIPlayerManager.js';

export class TrackPreview {
    constructor(trackEditor) {
        this.trackEditor = trackEditor;
        this.uiManager = trackEditor.uiManager;
        this.isVisible = false;
        this.isActive = false;
        this.isPlaying = false;
        
        // Preview canvas and context
        this.previewCanvas = null;
        this.previewCtx = null;
        this.overlayCanvas = null;
        this.overlayCtx = null;
        
        // Game engine components for preview
        this.physicsManager = null;
        this.renderManager = null;
        this.aiPlayerManager = null;
        
        // Preview state
        this.previewPlayers = [];
        this.mTokenPosition = null;
        this.startingPositions = [];
        this.validTrackPixels = [];
        this.previewScale = 0.2; // Scale for preview display
        
        // Animation and timing
        this.animationFrame = null;
        this.lastUpdateTime = 0;
        this.fps = 60;
        this.frameTime = 1000 / this.fps;
        this.fpsCounter = 0;
        this.actualFps = 0;
        
        // Preview settings
        this.settings = {
            showCollisionBoxes: true,
            showValidTrack: false,
            showHeatMap: false,
            showPlayerPaths: true,
            showStartingPositions: true,
            showMTokenZone: true,
            testPlayerCount: 4,
            animationSpeed: 1.0,
            enablePhysics: true
        };
        
        // Track validation results
        this.validationResults = {
            isValid: false,
            hasValidPath: false,
            hasStartingArea: false,
            hasSufficientSpace: false,
            hasProblematicAreas: false,
            metrics: {}
        };
        
        // Performance monitoring
        this.performanceMetrics = {
            frameTime: 0,
            updateTime: 0,
            renderTime: 0,
            physicsTime: 0,
            lastFpsUpdate: 0
        };
        
        console.log('[TrackPreview] Track preview system initialized');
    }

    /**
     * Initialize the track preview system
     */
    async initialize() {
        this.createPreviewPanel();
        this.setupEventListeners();
        await this.initializeGameComponents();
        this.setupPreviewCanvas();
        console.log('[TrackPreview] Track preview system ready');
    }

    /**
     * Create the preview panel HTML structure
     */
    createPreviewPanel() {
        // Create preview panel if it doesn't exist
        let previewPanel = document.getElementById('track-preview-panel');
        if (!previewPanel) {
            previewPanel = document.createElement('div');
            previewPanel.id = 'track-preview-panel';
            previewPanel.className = 'track-preview-panel';
            previewPanel.style.display = 'none';
            document.body.appendChild(previewPanel);
        }

        previewPanel.innerHTML = `
            <div class="preview-container">
                <div class="preview-header">
                    <div class="preview-title">
                        <span class="title-text pixel-text">TRACK PREVIEW</span>
                        <div class="preview-status">
                            <span class="status-indicator ${this.isActive ? 'active' : 'inactive'}"></span>
                            <span class="status-text">${this.isActive ? 'LIVE' : 'PAUSED'}</span>
                            <span class="fps-counter" id="fps-counter">0 FPS</span>
                        </div>
                    </div>
                    <div class="preview-controls-header">
                        <button class="control-btn" id="preview-play-pause" title="Play/Pause">
                            <span class="btn-icon">${this.isPlaying ? '⏸️' : '▶️'}</span>
                        </button>
                        <button class="control-btn" id="preview-reset" title="Reset Preview">🔄</button>
                        <button class="control-btn" id="preview-close" title="Close Preview">✕</button>
                    </div>
                </div>
                
                <div class="preview-body">
                    <div class="preview-main">
                        <div class="preview-viewport">
                            <canvas id="track-preview-canvas" class="preview-canvas"></canvas>
                            <canvas id="track-preview-overlay" class="preview-overlay-canvas"></canvas>
                            <div class="preview-info-overlay">
                                <div class="zoom-controls">
                                    <button class="zoom-btn" id="preview-zoom-in">🔍+</button>
                                    <span class="zoom-level" id="preview-zoom-level">20%</span>
                                    <button class="zoom-btn" id="preview-zoom-out">🔍-</button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="preview-sidebar">
                            <div class="sidebar-section">
                                <h4 class="section-title">PREVIEW SETTINGS</h4>
                                <div class="settings-grid">
                                    <label class="setting-item">
                                        <input type="checkbox" id="show-collision-boxes" ${this.settings.showCollisionBoxes ? 'checked' : ''}>
                                        <span class="setting-label">Collision Boxes</span>
                                    </label>
                                    <label class="setting-item">
                                        <input type="checkbox" id="show-valid-track" ${this.settings.showValidTrack ? 'checked' : ''}>
                                        <span class="setting-label">Valid Track Areas</span>
                                    </label>
                                    <label class="setting-item">
                                        <input type="checkbox" id="show-player-paths" ${this.settings.showPlayerPaths ? 'checked' : ''}>
                                        <span class="setting-label">Player Paths</span>
                                    </label>
                                    <label class="setting-item">
                                        <input type="checkbox" id="show-starting-positions" ${this.settings.showStartingPositions ? 'checked' : ''}>
                                        <span class="setting-label">Starting Positions</span>
                                    </label>
                                    <label class="setting-item">
                                        <input type="checkbox" id="show-mtoken-zone" ${this.settings.showMTokenZone ? 'checked' : ''}>
                                        <span class="setting-label">M Token Zone</span>
                                    </label>
                                </div>
                                
                                <div class="setting-group">
                                    <label class="setting-label">Test Players: <span id="player-count-value">${this.settings.testPlayerCount}</span></label>
                                    <input type="range" id="test-player-count" min="2" max="6" value="${this.settings.testPlayerCount}" class="setting-slider">
                                </div>
                                
                                <div class="setting-group">
                                    <label class="setting-label">Animation Speed: <span id="speed-value">${this.settings.animationSpeed}x</span></label>
                                    <input type="range" id="animation-speed" min="0.1" max="3.0" step="0.1" value="${this.settings.animationSpeed}" class="setting-slider">
                                </div>
                            </div>
                            
                            <div class="sidebar-section">
                                <h4 class="section-title">TRACK VALIDATION</h4>
                                <div class="validation-results" id="validation-results">
                                    <div class="validation-item">
                                        <span class="validation-label">Overall Valid:</span>
                                        <span class="validation-status unknown" id="validation-overall">Checking...</span>
                                    </div>
                                    <div class="validation-item">
                                        <span class="validation-label">Valid Path:</span>
                                        <span class="validation-status unknown" id="validation-path">Checking...</span>
                                    </div>
                                    <div class="validation-item">
                                        <span class="validation-label">Starting Area:</span>
                                        <span class="validation-status unknown" id="validation-start">Checking...</span>
                                    </div>
                                    <div class="validation-item">
                                        <span class="validation-label">Sufficient Space:</span>
                                        <span class="validation-status unknown" id="validation-space">Checking...</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="sidebar-section">
                                <h4 class="section-title">PERFORMANCE</h4>
                                <div class="performance-metrics" id="performance-metrics">
                                    <div class="metric-item">
                                        <span class="metric-label">FPS:</span>
                                        <span class="metric-value" id="metric-fps">0</span>
                                    </div>
                                    <div class="metric-item">
                                        <span class="metric-label">Frame Time:</span>
                                        <span class="metric-value" id="metric-frame-time">0ms</span>
                                    </div>
                                    <div class="metric-item">
                                        <span class="metric-label">Physics Time:</span>
                                        <span class="metric-value" id="metric-physics-time">0ms</span>
                                    </div>
                                    <div class="metric-item">
                                        <span class="metric-label">Render Time:</span>
                                        <span class="metric-value" id="metric-render-time">0ms</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Setup event listeners for preview controls
     */
    setupEventListeners() {
        // Play/Pause button
        const playPauseBtn = document.getElementById('preview-play-pause');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => this.togglePlayback());
        }

        // Reset button
        const resetBtn = document.getElementById('preview-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetPreview());
        }

        // Close button
        const closeBtn = document.getElementById('preview-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        // Zoom controls
        const zoomInBtn = document.getElementById('preview-zoom-in');
        const zoomOutBtn = document.getElementById('preview-zoom-out');
        
        if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.adjustZoom(0.1));
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.adjustZoom(-0.1));

        // Settings checkboxes
        const settingsCheckboxes = [
            'show-collision-boxes',
            'show-valid-track', 
            'show-player-paths',
            'show-starting-positions',
            'show-mtoken-zone'
        ];

        settingsCheckboxes.forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    const settingKey = id.replace('show-', '').replace(/-/g, '');
                    const settingMap = {
                        'collisionboxes': 'showCollisionBoxes',
                        'validtrack': 'showValidTrack',
                        'playerpaths': 'showPlayerPaths',
                        'startingpositions': 'showStartingPositions',
                        'mtokenzone': 'showMTokenZone'
                    };
                    this.settings[settingMap[settingKey]] = e.target.checked;
                });
            }
        });

        // Sliders
        const playerCountSlider = document.getElementById('test-player-count');
        if (playerCountSlider) {
            playerCountSlider.addEventListener('input', (e) => {
                this.settings.testPlayerCount = parseInt(e.target.value);
                document.getElementById('player-count-value').textContent = e.target.value;
                this.resetPreviewPlayers();
            });
        }

        const speedSlider = document.getElementById('animation-speed');
        if (speedSlider) {
            speedSlider.addEventListener('input', (e) => {
                this.settings.animationSpeed = parseFloat(e.target.value);
                document.getElementById('speed-value').textContent = e.target.value + 'x';
            });
        }

        // Listen for track editor changes
        if (this.trackEditor) {
            // Monitor canvas changes
            this.setupTrackChangeListener();
        }
    }

    /**
     * Setup listener for track editor canvas changes
     */
    setupTrackChangeListener() {
        // Create a mutation observer to watch for canvas changes
        const observer = new MutationObserver(() => {
            if (this.isActive) {
                this.updatePreviewFromTrackEditor();
            }
        });

        // Watch the track editor canvas
        if (this.trackEditor.canvas) {
            observer.observe(this.trackEditor.canvas, {
                attributes: true,
                childList: false,
                subtree: false
            });
        }

        // Also listen for manual updates
        setInterval(() => {
            if (this.isActive && this.trackEditor.previewCanvas) {
                this.updatePreviewFromTrackEditor();
            }
        }, 500); // Update every 500ms
    }

    /**
     * Initialize game engine components for preview
     */
    async initializeGameComponents() {
        try {
            // Create minimal game engine context for preview
            const mockGameEngine = {
                players: [],
                boosters: [],
                mToken: null,
                configManager: this.uiManager?.configManager || {
                    get: (key, defaultValue) => defaultValue
                }
            };

            // Initialize physics manager
            this.physicsManager = new PhysicsManager(mockGameEngine);
            
            // Initialize render manager
            this.renderManager = new RenderManager(mockGameEngine);
            
            // Initialize AI player manager
            this.aiPlayerManager = new AIPlayerManager(mockGameEngine);
            await this.aiPlayerManager.initialize();

            console.log('[TrackPreview] Game components initialized');
        } catch (error) {
            console.error('[TrackPreview] Failed to initialize game components:', error);
        }
    }

    /**
     * Setup preview canvas
     */
    setupPreviewCanvas() {
        this.previewCanvas = document.getElementById('track-preview-canvas');
        this.overlayCanvas = document.getElementById('track-preview-overlay');

        if (!this.previewCanvas || !this.overlayCanvas) {
            console.error('[TrackPreview] Preview canvases not found');
            return;
        }

        // Set canvas dimensions (scaled down from full track)
        const previewWidth = Math.floor(this.trackEditor.trackWidth * this.previewScale);
        const previewHeight = Math.floor(this.trackEditor.trackHeight * this.previewScale);

        this.previewCanvas.width = previewWidth;
        this.previewCanvas.height = previewHeight;
        this.overlayCanvas.width = previewWidth;
        this.overlayCanvas.height = previewHeight;

        this.previewCtx = this.previewCanvas.getContext('2d');
        this.overlayCtx = this.overlayCanvas.getContext('2d');

        // Disable image smoothing for pixel-perfect rendering
        this.previewCtx.imageSmoothingEnabled = false;
        this.overlayCtx.imageSmoothingEnabled = false;

        console.log(`[TrackPreview] Canvas setup complete: ${previewWidth}x${previewHeight}`);
    }

    /**
     * Update preview from track editor changes
     */
    updatePreviewFromTrackEditor() {
        if (!this.trackEditor.previewCanvas || !this.previewCtx) return;

        // Draw the track editor canvas to preview canvas (scaled)
        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        this.previewCtx.drawImage(
            this.trackEditor.previewCanvas,
            0, 0,
            this.trackEditor.previewCanvas.width,
            this.trackEditor.previewCanvas.height,
            0, 0,
            this.previewCanvas.width,
            this.previewCanvas.height
        );

        // Validate track and update positions
        this.validateTrack();
        this.updateStartingPositions();
        this.updateMTokenPosition();

        // Reset preview players if track changed significantly
        if (this.hasSignificantTrackChange()) {
            this.resetPreviewPlayers();
        }
    }

    /**
     * Validate the current track
     */
    validateTrack() {
        if (!this.previewCtx) return;

        const imageData = this.previewCtx.getImageData(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        const pixels = imageData.data;
        
        let validPixels = 0;
        let totalPixels = this.previewCanvas.width * this.previewCanvas.height;
        this.validTrackPixels = [];

        // Analyze track pixels
        for (let y = 0; y < this.previewCanvas.height; y++) {
            for (let x = 0; x < this.previewCanvas.width; x++) {
                const index = (y * this.previewCanvas.width + x) * 4;
                const r = pixels[index];
                const g = pixels[index + 1];
                const b = pixels[index + 2];
                const brightness = (r + g + b) / 3;

                // Track pixels are bright (white or near-white)
                if (brightness > 150) {
                    validPixels++;
                    this.validTrackPixels.push({ x: x * (1 / this.previewScale), y: y * (1 / this.previewScale) });
                }
            }
        }

        // Update validation results
        const trackCoverage = validPixels / totalPixels;
        this.validationResults = {
            isValid: trackCoverage > 0.05 && trackCoverage < 0.8,
            hasValidPath: this.checkForValidPath(),
            hasStartingArea: this.findStartingArea() !== null,
            hasSufficientSpace: trackCoverage > 0.05,
            hasProblematicAreas: false,
            metrics: {
                trackCoverage: trackCoverage,
                validPixels: validPixels,
                totalPixels: totalPixels
            }
        };

        this.updateValidationDisplay();
    }

    /**
     * Check if there's a valid path through the track
     */
    checkForValidPath() {
        // Simplified path validation - check for connected track areas
        if (this.validTrackPixels.length < 100) return false;
        
        // More sophisticated path finding could be implemented here
        return true;
    }

    /**
     * Find suitable starting area
     */
    findStartingArea() {
        if (this.validTrackPixels.length === 0) return null;

        // Find area with enough space for multiple players
        const requiredSpace = 100; // Minimum pixels needed
        const candidates = [];

        for (let i = 0; i < this.validTrackPixels.length; i += 50) {
            const pixel = this.validTrackPixels[i];
            let nearbyPixels = 0;
            
            // Count nearby valid pixels
            for (const otherPixel of this.validTrackPixels) {
                const distance = Math.sqrt(
                    Math.pow(pixel.x - otherPixel.x, 2) + 
                    Math.pow(pixel.y - otherPixel.y, 2)
                );
                if (distance < 50) nearbyPixels++;
            }

            if (nearbyPixels >= requiredSpace) {
                candidates.push({ ...pixel, density: nearbyPixels });
            }
        }

        return candidates.length > 0 ? candidates[0] : null;
    }

    /**
     * Update starting positions for preview players
     */
    updateStartingPositions() {
        const startingArea = this.findStartingArea();
        if (!startingArea) {
            this.startingPositions = [];
            return;
        }

        // Create starting positions in a formation
        this.startingPositions = [];
        for (let i = 0; i < this.settings.testPlayerCount; i++) {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const offsetX = (col - 1) * 30;
            const offsetY = row * 30 - 15;

            this.startingPositions.push({
                x: startingArea.x + offsetX,
                y: startingArea.y + offsetY
            });
        }
    }

    /**
     * Update M Token position
     */
    updateMTokenPosition() {
        if (this.validTrackPixels.length === 0) {
            this.mTokenPosition = null;
            return;
        }

        // Find position farthest from starting area
        const startingArea = this.findStartingArea();
        if (!startingArea) {
            this.mTokenPosition = this.validTrackPixels[Math.floor(Math.random() * this.validTrackPixels.length)];
            return;
        }

        let farthestPixel = this.validTrackPixels[0];
        let maxDistance = 0;

        for (const pixel of this.validTrackPixels) {
            const distance = Math.sqrt(
                Math.pow(startingArea.x - pixel.x, 2) + 
                Math.pow(startingArea.y - pixel.y, 2)
            );
            
            if (distance > maxDistance) {
                maxDistance = distance;
                farthestPixel = pixel;
            }
        }

        this.mTokenPosition = farthestPixel;
    }

    /**
     * Check if there was a significant track change
     */
    hasSignificantTrackChange() {
        // Simple change detection - could be more sophisticated
        return Date.now() - (this.lastTrackUpdate || 0) > 1000;
    }

    /**
     * Reset preview players
     */
    resetPreviewPlayers() {
        if (!this.startingPositions.length) return;

        this.previewPlayers = [];
        
        for (let i = 0; i < this.settings.testPlayerCount; i++) {
            const startPos = this.startingPositions[i] || this.startingPositions[0];
            
            // Create AI player data
            const aiPlayerData = this.aiPlayerManager ? 
                this.aiPlayerManager.createAIPlayer(i) : 
                { name: `TestAI${i + 1}`, index: i, isAI: true };

            // Create physics data
            const player = this.physicsManager ? 
                this.physicsManager.createPlayerPhysics(i, startPos, true, aiPlayerData) :
                {
                    index: i,
                    x: startPos.x,
                    y: startPos.y,
                    baseSpeed: 1.5,
                    currentSpeed: 1.5,
                    speedMultiplier: 1,
                    moveDirection: Math.random() * Math.PI * 2,
                    isAI: true,
                    name: aiPlayerData.name,
                    color: this.getPlayerColor(i),
                    path: []
                };

            this.previewPlayers.push(player);
        }

        console.log(`[TrackPreview] Reset ${this.previewPlayers.length} preview players`);
    }

    /**
     * Get player color for rendering
     */
    getPlayerColor(index) {
        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
        return colors[index % colors.length];
    }

    /**
     * Start preview animation loop
     */
    startAnimation() {
        if (this.animationFrame) return;

        const animate = (currentTime) => {
            const deltaTime = currentTime - this.lastUpdateTime;
            
            if (deltaTime >= this.frameTime / this.settings.animationSpeed) {
                this.updatePreview(currentTime, deltaTime);
                this.renderPreview(currentTime);
                this.updatePerformanceMetrics(currentTime, deltaTime);
                this.lastUpdateTime = currentTime;
            }

            this.animationFrame = requestAnimationFrame(animate);
        };

        this.animationFrame = requestAnimationFrame(animate);
        console.log('[TrackPreview] Animation started');
    }

    /**
     * Stop preview animation
     */
    stopAnimation() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
            console.log('[TrackPreview] Animation stopped');
        }
    }

    /**
     * Update preview simulation
     */
    updatePreview(currentTime, deltaTime) {
        if (!this.settings.enablePhysics || !this.previewPlayers.length) return;

        const updateStartTime = performance.now();

        // Update each preview player
        this.previewPlayers.forEach((player, index) => {
            if (this.physicsManager) {
                // Use actual physics simulation
                this.updatePlayerWithPhysics(player, index, currentTime, deltaTime);
            } else {
                // Simple movement simulation
                this.updatePlayerSimple(player, deltaTime);
            }

            // Record player path
            if (this.settings.showPlayerPaths) {
                player.path = player.path || [];
                player.path.push({ x: player.x, y: player.y, time: currentTime });
                
                // Limit path length
                if (player.path.length > 100) {
                    player.path.shift();
                }
            }
        });

        this.performanceMetrics.physicsTime = performance.now() - updateStartTime;
    }

    /**
     * Update player using physics manager
     */
    updatePlayerWithPhysics(player, index, currentTime, deltaTime) {
        // This would integrate with the actual physics manager
        // For now, we'll use simplified physics
        this.updatePlayerSimple(player, deltaTime);
    }

    /**
     * Simple player movement update
     */
    updatePlayerSimple(player, deltaTime) {
        // Random movement direction changes
        if (Math.random() < 0.02) {
            player.moveDirection += (Math.random() - 0.5) * Math.PI * 0.3;
        }

        // Calculate movement
        const moveSpeed = player.currentSpeed * deltaTime / 16;
        const newX = player.x + Math.cos(player.moveDirection) * moveSpeed;
        const newY = player.y + Math.sin(player.moveDirection) * moveSpeed;

        // Simple collision check
        if (this.isPositionValid(newX, newY)) {
            player.x = newX;
            player.y = newY;
        } else {
            // Change direction on collision
            player.moveDirection += Math.PI + (Math.random() - 0.5) * Math.PI * 0.5;
        }

        // Keep players in bounds
        player.x = Math.max(0, Math.min(this.trackEditor.trackWidth, player.x));
        player.y = Math.max(0, Math.min(this.trackEditor.trackHeight, player.y));
    }

    /**
     * Check if position is valid (on track)
     */
    isPositionValid(x, y) {
        if (!this.previewCtx) return true;

        const scaledX = Math.floor(x * this.previewScale);
        const scaledY = Math.floor(y * this.previewScale);

        if (scaledX < 0 || scaledX >= this.previewCanvas.width || 
            scaledY < 0 || scaledY >= this.previewCanvas.height) {
            return false;
        }

        const imageData = this.previewCtx.getImageData(scaledX, scaledY, 1, 1);
        const brightness = (imageData.data[0] + imageData.data[1] + imageData.data[2]) / 3;
        
        return brightness > 150; // Track pixels are bright
    }

    /**
     * Render the preview
     */
    renderPreview(currentTime) {
        if (!this.overlayCtx) return;

        const renderStartTime = performance.now();

        // Clear overlay
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

        // Render track visualizations
        if (this.settings.showStartingPositions) {
            this.renderStartingPositions();
        }

        if (this.settings.showMTokenZone) {
            this.renderMTokenZone();
        }

        if (this.settings.showValidTrack) {
            this.renderValidTrackAreas();
        }

        // Render players
        this.renderPreviewPlayers();

        // Render collision boxes
        if (this.settings.showCollisionBoxes) {
            this.renderCollisionBoxes();
        }

        this.performanceMetrics.renderTime = performance.now() - renderStartTime;
    }

    /**
     * Render starting positions
     */
    renderStartingPositions() {
        this.overlayCtx.strokeStyle = '#00ff00';
        this.overlayCtx.lineWidth = 2;
        this.overlayCtx.fillStyle = 'rgba(0, 255, 0, 0.2)';

        this.startingPositions.forEach((pos, index) => {
            const x = pos.x * this.previewScale;
            const y = pos.y * this.previewScale;
            const radius = 10;

            this.overlayCtx.beginPath();
            this.overlayCtx.arc(x, y, radius, 0, Math.PI * 2);
            this.overlayCtx.fill();
            this.overlayCtx.stroke();

            // Draw start number
            this.overlayCtx.fillStyle = '#00ff00';
            this.overlayCtx.font = '10px Courier New';
            this.overlayCtx.textAlign = 'center';
            this.overlayCtx.fillText((index + 1).toString(), x, y + 3);
        });
    }

    /**
     * Render M Token zone
     */
    renderMTokenZone() {
        if (!this.mTokenPosition) return;

        const x = this.mTokenPosition.x * this.previewScale;
        const y = this.mTokenPosition.y * this.previewScale;

        this.overlayCtx.strokeStyle = '#ffd700';
        this.overlayCtx.lineWidth = 3;
        this.overlayCtx.fillStyle = 'rgba(255, 215, 0, 0.3)';

        this.overlayCtx.beginPath();
        this.overlayCtx.arc(x, y, 15, 0, Math.PI * 2);
        this.overlayCtx.fill();
        this.overlayCtx.stroke();

        // Draw M
        this.overlayCtx.fillStyle = '#ffd700';
        this.overlayCtx.font = 'bold 12px Courier New';
        this.overlayCtx.textAlign = 'center';
        this.overlayCtx.fillText('M', x, y + 4);
    }

    /**
     * Render valid track areas
     */
    renderValidTrackAreas() {
        this.overlayCtx.fillStyle = 'rgba(0, 255, 255, 0.1)';
        
        // Sample and render valid areas
        for (let i = 0; i < this.validTrackPixels.length; i += 20) {
            const pixel = this.validTrackPixels[i];
            const x = pixel.x * this.previewScale;
            const y = pixel.y * this.previewScale;
            
            this.overlayCtx.fillRect(x - 1, y - 1, 2, 2);
        }
    }

    /**
     * Render preview players
     */
    renderPreviewPlayers() {
        this.previewPlayers.forEach((player, index) => {
            const x = player.x * this.previewScale;
            const y = player.y * this.previewScale;

            // Draw player path
            if (this.settings.showPlayerPaths && player.path && player.path.length > 1) {
                this.overlayCtx.strokeStyle = player.color + '40'; // Semi-transparent
                this.overlayCtx.lineWidth = 1;
                this.overlayCtx.beginPath();
                
                const firstPoint = player.path[0];
                this.overlayCtx.moveTo(firstPoint.x * this.previewScale, firstPoint.y * this.previewScale);
                
                for (let i = 1; i < player.path.length; i++) {
                    const point = player.path[i];
                    this.overlayCtx.lineTo(point.x * this.previewScale, point.y * this.previewScale);
                }
                
                this.overlayCtx.stroke();
            }

            // Draw player
            this.overlayCtx.fillStyle = player.color;
            this.overlayCtx.strokeStyle = '#ffffff';
            this.overlayCtx.lineWidth = 1;

            this.overlayCtx.beginPath();
            this.overlayCtx.arc(x, y, 4, 0, Math.PI * 2);
            this.overlayCtx.fill();
            this.overlayCtx.stroke();

            // Draw direction indicator
            const dirX = x + Math.cos(player.moveDirection) * 8;
            const dirY = y + Math.sin(player.moveDirection) * 8;
            
            this.overlayCtx.strokeStyle = player.color;
            this.overlayCtx.lineWidth = 2;
            this.overlayCtx.beginPath();
            this.overlayCtx.moveTo(x, y);
            this.overlayCtx.lineTo(dirX, dirY);
            this.overlayCtx.stroke();

            // Draw player name
            this.overlayCtx.fillStyle = '#ffffff';
            this.overlayCtx.font = '8px Courier New';
            this.overlayCtx.textAlign = 'center';
            this.overlayCtx.fillText(player.name || `P${index + 1}`, x, y - 8);
        });
    }

    /**
     * Render collision boxes
     */
    renderCollisionBoxes() {
        this.previewPlayers.forEach(player => {
            const x = player.x * this.previewScale;
            const y = player.y * this.previewScale;
            const size = 48 * this.previewScale; // Collision box size

            this.overlayCtx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            this.overlayCtx.lineWidth = 1;
            this.overlayCtx.strokeRect(x - size/2, y - size/2, size, size);
        });
    }

    /**
     * Update performance metrics display
     */
    updatePerformanceMetrics(currentTime, deltaTime) {
        this.fpsCounter++;
        
        if (currentTime - this.performanceMetrics.lastFpsUpdate >= 1000) {
            this.actualFps = this.fpsCounter;
            this.fpsCounter = 0;
            this.performanceMetrics.lastFpsUpdate = currentTime;
        }

        this.performanceMetrics.frameTime = deltaTime;

        // Update UI
        const fpsCounter = document.getElementById('fps-counter');
        if (fpsCounter) {
            fpsCounter.textContent = `${this.actualFps} FPS`;
        }

        const metricElements = {
            'metric-fps': this.actualFps,
            'metric-frame-time': Math.round(this.performanceMetrics.frameTime) + 'ms',
            'metric-physics-time': Math.round(this.performanceMetrics.physicsTime) + 'ms',
            'metric-render-time': Math.round(this.performanceMetrics.renderTime) + 'ms'
        };

        Object.entries(metricElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }

    /**
     * Update validation display
     */
    updateValidationDisplay() {
        const validationElements = {
            'validation-overall': this.validationResults.isValid,
            'validation-path': this.validationResults.hasValidPath,
            'validation-start': this.validationResults.hasStartingArea,
            'validation-space': this.validationResults.hasSufficientSpace
        };

        Object.entries(validationElements).forEach(([id, isValid]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = isValid ? 'Valid' : 'Invalid';
                element.className = `validation-status ${isValid ? 'valid' : 'invalid'}`;
            }
        });
    }

    /**
     * Toggle playback
     */
    togglePlayback() {
        this.isPlaying = !this.isPlaying;

        const playPauseBtn = document.getElementById('preview-play-pause');
        if (playPauseBtn) {
            const icon = playPauseBtn.querySelector('.btn-icon');
            if (icon) icon.textContent = this.isPlaying ? '⏸️' : '▶️';
        }

        this.updateStatusDisplay();

        if (this.isPlaying) {
            this.startAnimation();
        } else {
            this.stopAnimation();
        }
    }

    /**
     * Reset preview
     */
    resetPreview() {
        this.stopAnimation();
        this.resetPreviewPlayers();
        this.updatePreviewFromTrackEditor();
        
        if (this.overlayCtx) {
            this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        }

        if (this.isPlaying) {
            this.startAnimation();
        }
    }

    /**
     * Adjust zoom level
     */
    adjustZoom(delta) {
        this.previewScale = Math.max(0.1, Math.min(1.0, this.previewScale + delta));
        
        const zoomLevel = document.getElementById('preview-zoom-level');
        if (zoomLevel) {
            zoomLevel.textContent = Math.round(this.previewScale * 100) + '%';
        }

        // Resize canvases
        this.setupPreviewCanvas();
        this.updatePreviewFromTrackEditor();
    }

    /**
     * Update status display
     */
    updateStatusDisplay() {
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('.status-text');

        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${this.isActive && this.isPlaying ? 'active' : 'inactive'}`;
        }

        if (statusText) {
            statusText.textContent = this.isActive && this.isPlaying ? 'LIVE' : 'PAUSED';
        }
    }

    /**
     * Show preview panel
     */
    show() {
        const panel = document.getElementById('track-preview-panel');
        if (panel) {
            panel.style.display = 'block';
            this.isVisible = true;
            this.isActive = true;
            this.updateStatusDisplay();
            this.updatePreviewFromTrackEditor();
            this.resetPreviewPlayers();
            
            if (this.isPlaying) {
                this.startAnimation();
            }
        }
    }

    /**
     * Hide preview panel
     */
    hide() {
        const panel = document.getElementById('track-preview-panel');
        if (panel) {
            panel.style.display = 'none';
            this.isVisible = false;
            this.isActive = false;
            this.stopAnimation();
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
        return document.getElementById('track-preview-panel') || document.getElementById('preview-panel');
    }

    /**
     * Get preview state for debugging
     */
    getPreviewState() {
        return {
            isVisible: this.isVisible,
            isActive: this.isActive,
            isPlaying: this.isPlaying,
            playerCount: this.previewPlayers.length,
            validationResults: this.validationResults,
            performanceMetrics: this.performanceMetrics,
            settings: this.settings
        };
    }

    /**
     * Cleanup and destroy preview system
     */
    destroy() {
        this.stopAnimation();
        this.hide();
        
        // Clear references
        this.previewPlayers = [];
        this.validTrackPixels = [];
        this.startingPositions = [];
        this.mTokenPosition = null;

        console.log('[TrackPreview] Track preview system destroyed');
    }
}