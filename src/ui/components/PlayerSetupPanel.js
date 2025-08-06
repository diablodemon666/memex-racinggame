/**
 * PlayerSetupPanel.js - Player Customization and Setup Component
 * 
 * Handles player name input, image upload and preview, current player assignment display,
 * race joining functionality, and displays helpful tips and instructions.
 */

export class PlayerSetupPanel {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.isVisible = true; // Default visible
        
        // Player customization state
        this.currentPlayerIndex = 3; // Default to P4 (Yellow player)
        this.playerCustomImages = {};
        this.playerNames = {};
        this.playerPreviewCanvas = null;
        
        // Player colors mapping
        this.playerColors = [
            { name: 'RED', color: '#FF0000' },
            { name: 'GREEN', color: '#00FF00' },
            { name: 'BLUE', color: '#0000FF' },
            { name: 'YELLOW', color: '#FFFF00' },
            { name: 'MAGENTA', color: '#FF00FF' },
            { name: 'CYAN', color: '#00FFFF' }
        ];
        
        // UI state
        this.isJoined = false;
        this.mandatoryBetAmount = 100;
        
        console.log('[PlayerSetupPanel] Player setup panel initialized');
    }

    /**
     * Initialize the player setup panel
     */
    async initialize() {
        this.createPanelContent();
        this.setupEventListeners();
        this.updatePlayerDisplay();
        console.log('[PlayerSetupPanel] Panel initialized');
    }

    /**
     * Create player setup panel content structure
     */
    createPanelContent() {
        const panel = document.getElementById('player-setup-panel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="panel-header">
                <div class="panel-title">
                    <span class="title-text">PLAYER SETUP</span>
                    <div class="panel-controls">
                        <button class="control-btn toggle-btn" id="toggle-player-setup" title="Toggle">
                            ⚙️
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="panel-body player-setup-content">
                <div class="current-player-display" id="current-player-display">
                    YOUR PLAYER: P${this.currentPlayerIndex + 1} (${this.playerColors[this.currentPlayerIndex].name})
                </div>
                
                <div class="player-customization-section">
                    <div class="customization-container">
                        <div class="name-input-section">
                            <label for="player-name-input" class="input-label">PLAYER NAME:</label>
                            <input 
                                type="text" 
                                id="player-name-input" 
                                class="player-name-input" 
                                placeholder="Enter your name" 
                                maxlength="12"
                                value=""
                            >
                            <div class="input-hint">Max 12 characters</div>
                        </div>
                        
                        <div class="image-upload-section">
                            <label for="player-image-input" class="file-upload-btn">
                                <span class="btn-icon">📁</span>
                                UPLOAD YOUR IMAGE
                            </label>
                            <input type="file" id="player-image-input" accept="image/*" style="display: none;">
                            
                            <div class="image-preview-container">
                                <img id="player-preview" class="player-preview" style="display: none;">
                            </div>
                            
                            <div class="upload-hints">
                                <div class="hint-item">📷 Supports JPG, PNG, GIF</div>
                                <div class="hint-item">🔄 Auto-resized to 128x128 pixels</div>
                                <div class="hint-item">⚡ Changes apply instantly!</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="join-race-section">
                    <button id="join-race-btn" class="join-race-btn">
                        <span class="btn-icon">🏁</span>
                        JOIN RACE (${this.mandatoryBetAmount} COINS BET)
                    </button>
                    
                    <div class="join-status" id="join-status" style="display: none;">
                        <span class="status-icon">✅</span>
                        <span class="status-text">Ready to race!</span>
                    </div>
                </div>
                
                <div class="preparation-info">
                    <div class="info-header">RACE PREPARATION</div>
                    <div class="info-content">
                        <div class="info-item">
                            <span class="info-icon">⏱️</span>
                            <span class="info-text">30 seconds to prepare before race starts!</span>
                        </div>
                        <div class="info-item">
                            <span class="info-icon">🔄</span>
                            <span class="info-text">Watch your ${this.playerColors[this.currentPlayerIndex].name.toLowerCase()} player update in real-time!</span>
                        </div>
                    </div>
                </div>
                
                <div class="controls-help">
                    <div class="help-header">KEYBOARD CONTROLS</div>
                    <div class="help-content">
                        <div class="control-item">
                            <span class="key-badge">U</span>
                            <span class="control-desc">Unstick player if stuck</span>
                        </div>
                        <div class="control-item">
                            <span class="key-badge">D</span>
                            <span class="control-desc">Toggle debug mode</span>
                        </div>
                        <div class="control-item">
                            <span class="key-badge">M</span>
                            <span class="control-desc">Change map (between races)</span>
                        </div>
                    </div>
                </div>
                
                <div class="current-map-display" id="current-map-display">
                    <div class="map-info-header">CURRENT TRACK</div>
                    <div class="map-info-content">
                        <div class="map-name" id="map-name">Classic Maze</div>
                        <div class="map-rotation-info">
                            <span class="rotation-label">Races until rotation:</span>
                            <span class="rotation-count" id="races-left">3</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Setup event listeners for player setup interactions
     */
    setupEventListeners() {
        // Player name input
        const nameInput = document.getElementById('player-name-input');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.handleNameChange(e.target.value);
            });
            
            // Real-time character count
            nameInput.addEventListener('input', (e) => {
                this.updateCharacterCount(e.target.value);
            });
        }

        // Image upload
        const imageInput = document.getElementById('player-image-input');
        if (imageInput) {
            imageInput.addEventListener('change', (e) => {
                this.handleImageUpload(e.target.files[0]);
            });
        }

        // Join race button
        const joinBtn = document.getElementById('join-race-btn');
        if (joinBtn) {
            joinBtn.addEventListener('click', () => {
                this.handleJoinRace();
            });
        }

        // Toggle button
        const toggleBtn = document.getElementById('toggle-player-setup');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.toggle();
            });
        }

        // Drag and drop for image upload
        this.setupDragAndDrop();
    }

    /**
     * Setup drag and drop functionality for image upload
     */
    setupDragAndDrop() {
        const panel = document.getElementById('player-setup-panel');
        if (!panel) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            panel.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            panel.addEventListener(eventName, () => {
                panel.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            panel.addEventListener(eventName, () => {
                panel.classList.remove('drag-over');
            });
        });

        panel.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                this.handleImageUpload(files[0]);
            }
        });
    }

    /**
     * Handle player name change
     */
    handleNameChange(name) {
        const sanitizedName = name.trim().slice(0, 12);
        this.playerNames[this.currentPlayerIndex] = sanitizedName;
        
        // Update display immediately if game is running
        if (this.uiManager && this.uiManager.game) {
            this.notifyGameOfPlayerUpdate('name', sanitizedName);
        }
        
        this.showNotification(`Name updated: ${sanitizedName || 'P' + (this.currentPlayerIndex + 1)}`, 'success');
    }

    /**
     * Handle image upload
     */
    handleImageUpload(file) {
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            this.showNotification('Please select an image file', 'error');
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            this.showNotification('Image too large. Please select an image under 5MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            this.processImage(event.target.result);
        };
        reader.onerror = () => {
            this.showNotification('Failed to read image file', 'error');
        };
        reader.readAsDataURL(file);
    }

    /**
     * Process uploaded image - resize and create preview
     */
    processImage(imageDataUrl) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 128;
        canvas.height = 128;
        
        const img = new Image();
        img.onload = () => {
            // Clear canvas
            ctx.clearRect(0, 0, 128, 128);
            
            // Enable pixelated rendering
            ctx.imageSmoothingEnabled = false;
            
            // Calculate scaling to fit 128x128 while maintaining aspect ratio
            const scale = Math.min(128 / img.width, 128 / img.height);
            const width = img.width * scale;
            const height = img.height * scale;
            const x = (128 - width) / 2;
            const y = (128 - height) / 2;
            
            // Draw scaled image
            ctx.drawImage(img, x, y, width, height);
            
            // Get pixelated image data
            const pixelatedDataUrl = canvas.toDataURL('image/png');
            
            // Update preview
            this.updateImagePreview(pixelatedDataUrl);
            
            // Store the canvas for game integration
            this.playerCustomImages[this.currentPlayerIndex] = canvas;
            
            // Notify game if running
            if (this.uiManager && this.uiManager.game) {
                this.notifyGameOfPlayerUpdate('image', canvas);
            }
            
            this.showNotification('Image uploaded and applied!', 'success');
        };
        
        img.onerror = () => {
            this.showNotification('Failed to process image', 'error');
        };
        
        img.src = imageDataUrl;
    }

    /**
     * Update image preview display
     */
    updateImagePreview(dataUrl) {
        const preview = document.getElementById('player-preview');
        if (preview) {
            preview.src = dataUrl;
            preview.style.display = 'block';
            preview.style.imageRendering = 'pixelated';
            preview.style.width = '128px';
            preview.style.height = '128px';
        }
    }

    /**
     * Handle join race button click
     */
    handleJoinRace() {
        if (this.isJoined) {
            this.showNotification('You have already joined the race!', 'info');
            return;
        }
        
        const playerName = this.playerNames[this.currentPlayerIndex] || `P${this.currentPlayerIndex + 1}`;
        
        // Initialize player in leaderboard if needed
        this.initializePlayerInLeaderboard(playerName);
        
        // Mark as joined
        this.isJoined = true;
        
        // Update UI
        this.updateJoinStatus(true);
        
        // Notify game and other systems
        this.notifyGameOfJoin(playerName);
        
        this.showNotification(`${playerName} joined as Player ${this.currentPlayerIndex + 1} with a ${this.mandatoryBetAmount} coin bet!`, 'success');
    }

    /**
     * Initialize player in leaderboard system
     */
    initializePlayerInLeaderboard(playerName) {
        if (this.uiManager && this.uiManager.leaderboardPanel) {
            const playerData = {
                id: `player-${this.currentPlayerIndex}`,
                name: playerName,
                wins: 0,
                races: 0,
                score: 0,
                winRate: 0,
                earnings: 0,
                lastActive: Date.now(),
                avatar: '🏎️'
            };
            
            this.uiManager.leaderboardPanel.updatePlayerList([playerData]);
        }
    }

    /**
     * Update join status display
     */
    updateJoinStatus(joined) {
        const joinBtn = document.getElementById('join-race-btn');
        const joinStatus = document.getElementById('join-status');
        
        if (joinBtn) {
            if (joined) {
                joinBtn.textContent = '✅ JOINED - READY TO RACE';
                joinBtn.disabled = true;
                joinBtn.classList.add('joined');
            } else {
                joinBtn.innerHTML = `<span class="btn-icon">🏁</span>JOIN RACE (${this.mandatoryBetAmount} COINS BET)`;
                joinBtn.disabled = false;
                joinBtn.classList.remove('joined');
            }
        }
        
        if (joinStatus) {
            joinStatus.style.display = joined ? 'flex' : 'none';
        }
    }

    /**
     * Notify game of player updates
     */
    notifyGameOfPlayerUpdate(type, data) {
        // This would integrate with the game engine
        if (this.uiManager && this.uiManager.game && this.uiManager.game.events) {
            this.uiManager.game.events.emit('playerUpdate', {
                playerId: this.currentPlayerIndex,
                type: type,
                data: data
            });
        }
    }

    /**
     * Notify systems that player has joined
     */
    notifyGameOfJoin(playerName) {
        if (this.uiManager && this.uiManager.game && this.uiManager.game.events) {
            this.uiManager.game.events.emit('playerJoined', {
                playerId: this.currentPlayerIndex,
                playerName: playerName,
                customImage: this.playerCustomImages[this.currentPlayerIndex],
                betAmount: this.mandatoryBetAmount
            });
        }
    }

    /**
     * Update character count display
     */
    updateCharacterCount(value) {
        const hint = document.querySelector('.input-hint');
        if (hint) {
            const remaining = 12 - value.length;
            hint.textContent = `${remaining} characters remaining`;
            hint.style.color = remaining < 3 ? '#ff6b6b' : '#888';
        }
    }

    /**
     * Update current player display
     */
    updatePlayerDisplay() {
        const display = document.getElementById('current-player-display');
        if (display) {
            const playerColor = this.playerColors[this.currentPlayerIndex];
            display.textContent = `YOUR PLAYER: P${this.currentPlayerIndex + 1} (${playerColor.name})`;
            display.style.color = playerColor.color;
        }
        
        // Update help text color reference
        const infoText = document.querySelector('.info-text');
        if (infoText && infoText.textContent.includes('player update')) {
            const colorName = this.playerColors[this.currentPlayerIndex].name.toLowerCase();
            infoText.textContent = `Watch your ${colorName} player update in real-time!`;
        }
    }

    /**
     * Set current player index (P1-P6)
     */
    setCurrentPlayer(index) {
        if (index >= 0 && index < 6) {
            this.currentPlayerIndex = index;
            this.updatePlayerDisplay();
            this.isJoined = false; // Reset join status for new player
            this.updateJoinStatus(false);
            
            // Load existing data for this player
            const nameInput = document.getElementById('player-name-input');
            if (nameInput) {
                nameInput.value = this.playerNames[index] || '';
            }
            
            // Update image preview if exists
            if (this.playerCustomImages[index]) {
                const dataUrl = this.playerCustomImages[index].toDataURL();
                this.updateImagePreview(dataUrl);
            } else {
                const preview = document.getElementById('player-preview');
                if (preview) {
                    preview.style.display = 'none';
                }
            }
        }
    }

    /**
     * Update map information
     */
    updateMapInfo(mapName, racesLeft) {
        const mapNameEl = document.getElementById('map-name');
        const racesLeftEl = document.getElementById('races-left');
        
        if (mapNameEl) {
            mapNameEl.textContent = mapName;
        }
        
        if (racesLeftEl) {
            racesLeftEl.textContent = racesLeft;
        }
    }

    /**
     * Show player setup panel
     */
    show() {
        const panel = document.getElementById('player-setup-panel');
        if (panel) {
            panel.classList.remove('hidden');
            this.isVisible = true;
        }
    }

    /**
     * Hide player setup panel
     */
    hide() {
        const panel = document.getElementById('player-setup-panel');
        if (panel) {
            panel.classList.add('hidden');
            this.isVisible = false;
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
        return document.getElementById('player-setup-panel');
    }

    /**
     * Reset panel for new race
     */
    resetForNewRace() {
        this.isJoined = false;
        this.updateJoinStatus(false);
        this.showNotification('New race starting - join again to participate!', 'info');
    }

    /**
     * Get current player setup state
     */
    getPlayerSetupState() {
        return {
            currentPlayerIndex: this.currentPlayerIndex,
            playerName: this.playerNames[this.currentPlayerIndex] || `P${this.currentPlayerIndex + 1}`,
            hasCustomImage: !!this.playerCustomImages[this.currentPlayerIndex],
            isJoined: this.isJoined,
            mandatoryBetAmount: this.mandatoryBetAmount
        };
    }

    /**
     * Show notification message
     */
    showNotification(message, type = 'info') {
        // Create or update notification element
        let notification = document.getElementById('player-setup-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'player-setup-notification';
            notification.className = 'notification';
            document.getElementById('player-setup-panel').appendChild(notification);
        }
        
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    /**
     * Destroy the player setup panel
     */
    destroy() {
        // Clean up any intervals or listeners
        console.log('[PlayerSetupPanel] Panel destroyed');
    }
}