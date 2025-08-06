/**
 * Memex Racing - Streaming Overlay Script
 * 
 * Real-time overlay updates via WebSocket connection to the streaming API.
 */

class MemexRacingOverlay {
    constructor(config) {
        this.config = {
            socketUrl: 'http://localhost:3001',
            autoReconnect: true,
            reconnectDelay: 2000,
            maxReconnectAttempts: 10,
            subscriptions: ['race', 'betting', 'players', 'leaderboard'],
            updateRate: 30,
            enableAnimations: true,
            showDebug: false,
            ...config
        };

        // WebSocket connection
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;

        // Data storage
        this.data = {
            race: null,
            betting: null,
            players: null,
            leaderboard: null,
            camera: null,
            gameStatus: null
        };

        // UI elements
        this.elements = {};
        this.notifications = [];

        // Performance tracking
        this.stats = {
            fps: 0,
            latency: 0,
            updates: 0,
            lastUpdate: Date.now()
        };

        // Animation frame tracking
        this.animationFrame = null;
        this.lastFrameTime = 0;

        console.log('[MemexRacingOverlay] Initializing overlay system');
        this.initialize();
    }

    /**
     * Initialize overlay system
     */
    async initialize() {
        try {
            // Cache DOM elements
            this.cacheElements();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Connect to WebSocket
            await this.connect();
            
            // Start animation loop
            this.startAnimationLoop();
            
            console.log('[MemexRacingOverlay] Overlay system initialized successfully');
            
        } catch (error) {
            console.error('[MemexRacingOverlay] Failed to initialize:', error);
            this.showNotification('Failed to initialize overlay', 'error');
        }
    }

    /**
     * Cache DOM elements for performance
     */
    cacheElements() {
        this.elements = {
            // Race panel elements
            raceTimer: document.getElementById('race-timer'),
            raceNumber: document.getElementById('race-number'),
            currentMap: document.getElementById('current-map'),
            racePhase: document.getElementById('race-phase'),

            // Betting panel elements
            bettingTimer: document.getElementById('betting-timer'),
            totalPool: document.getElementById('total-pool'),
            bettingStatusText: document.getElementById('betting-status-text'),

            // Player data containers
            playerStandings: document.getElementById('player-standings'),
            livePlayers: document.getElementById('live-players'),
            topPlayers: document.getElementById('top-players'),

            // Camera panel elements
            cameraMode: document.getElementById('camera-mode'),
            cameraTarget: document.getElementById('camera-target'),

            // Activity feed
            activityFeed: document.getElementById('activity-feed'),

            // Connection status
            connectionStatus: document.getElementById('connection-status'),

            // Debug elements
            debugFps: document.getElementById('debug-fps'),
            debugLatency: document.getElementById('debug-latency'),
            debugUpdates: document.getElementById('debug-updates'),

            // Notification container
            notificationContainer: document.getElementById('notification-container')
        };

        console.log('[MemexRacingOverlay] DOM elements cached');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Keyboard shortcuts for debugging
        document.addEventListener('keydown', (event) => {
            if (event.ctrlKey && event.shiftKey) {
                switch (event.key) {
                    case 'D':
                        this.toggleDebug();
                        event.preventDefault();
                        break;
                    case 'R':
                        this.reconnect();
                        event.preventDefault();
                        break;
                    case 'C':
                        this.clearNotifications();
                        event.preventDefault();
                        break;
                }
            }
        });

        // Window visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseUpdates();
            } else {
                this.resumeUpdates();
            }
        });

        // Window focus/blur
        window.addEventListener('focus', () => {
            this.resumeUpdates();
        });

        window.addEventListener('blur', () => {
            this.pauseUpdates();
        });
    }

    /**
     * Connect to WebSocket server
     */
    async connect() {
        try {
            console.log(`[MemexRacingOverlay] Connecting to ${this.config.socketUrl}`);
            this.updateConnectionStatus('connecting');

            // Import Socket.IO client
            if (typeof io === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
                document.head.appendChild(script);
                
                await new Promise((resolve, reject) => {
                    script.onload = resolve;
                    script.onerror = reject;
                });
            }

            // Create socket connection
            this.socket = io(this.config.socketUrl, {
                path: '/streaming-socket',
                transports: ['websocket', 'polling'],
                autoConnect: true,
                reconnection: false // We'll handle reconnection manually
            });

            // Setup socket event handlers
            this.setupSocketHandlers();

            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 10000);

                this.socket.on('connect', () => {
                    clearTimeout(timeout);
                    this.onConnect();
                    resolve();
                });

                this.socket.on('connect_error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });

        } catch (error) {
            console.error('[MemexRacingOverlay] Connection failed:', error);
            this.onDisconnect();
            
            if (this.config.autoReconnect) {
                this.scheduleReconnect();
            }
            
            throw error;
        }
    }

    /**
     * Setup WebSocket event handlers
     */
    setupSocketHandlers() {
        this.socket.on('connect', () => {
            this.onConnect();
        });

        this.socket.on('disconnect', (reason) => {
            console.log(`[MemexRacingOverlay] Disconnected: ${reason}`);
            this.onDisconnect();
        });

        this.socket.on('initial-data', (response) => {
            console.log('[MemexRacingOverlay] Received initial data');
            this.handleInitialData(response);
        });

        // Data update handlers
        this.socket.on('race-update', (response) => {
            this.handleRaceUpdate(response);
        });

        this.socket.on('betting-update', (response) => {
            this.handleBettingUpdate(response);
        });

        this.socket.on('leaderboard-update', (response) => {
            this.handleLeaderboardUpdate(response);
        });

        this.socket.on('camera-update', (response) => {
            this.handleCameraUpdate(response);
        });

        this.socket.on('data-update', (response) => {
            this.handleDataUpdate(response);
        });

        // Control response handlers
        this.socket.on('subscription-confirmed', (response) => {
            console.log('[MemexRacingOverlay] Subscriptions confirmed:', response);
        });

        this.socket.on('camera-control-success', (response) => {
            console.log('[MemexRacingOverlay] Camera control successful:', response);
        });

        this.socket.on('camera-control-error', (response) => {
            console.error('[MemexRacingOverlay] Camera control error:', response);
            this.showNotification(`Camera error: ${response.error}`, 'error');
        });

        // Ping/pong for latency measurement
        this.socket.on('pong', (response) => {
            this.stats.latency = Date.now() - response.timestamp;
            this.updateDebugInfo();
        });

        // Error handling
        this.socket.on('error', (error) => {
            console.error('[MemexRacingOverlay] Socket error:', error);
            this.showNotification('Connection error', 'error');
        });
    }

    /**
     * Handle successful connection
     */
    onConnect() {
        console.log('[MemexRacingOverlay] Connected to streaming server');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.updateConnectionStatus('connected');
        
        // Subscribe to data streams
        this.socket.emit('subscribe', {
            streams: this.config.subscriptions,
            updateRate: this.config.updateRate
        });

        // Start ping timer for latency measurement
        this.startPingTimer();

        this.showNotification('Connected to game server', 'success');
    }

    /**
     * Handle disconnection
     */
    onDisconnect() {
        this.isConnected = false;
        this.updateConnectionStatus('disconnected');
        this.stopPingTimer();

        if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.scheduleReconnect();
        } else {
            this.showNotification('Disconnected from server', 'error');
        }
    }

    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        this.reconnectAttempts++;
        const delay = this.config.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
        
        console.log(`[MemexRacingOverlay] Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnect();
        }, delay);
    }

    /**
     * Attempt to reconnect
     */
    async reconnect() {
        if (this.isConnected) return;

        try {
            if (this.socket) {
                this.socket.disconnect();
                this.socket = null;
            }
            
            await this.connect();
        } catch (error) {
            console.error('[MemexRacingOverlay] Reconnection failed:', error);
        }
    }

    /**
     * Handle initial data response
     */
    handleInitialData(response) {
        this.data = { ...this.data, ...response.data };
        this.updateAllUI();
        console.log('[MemexRacingOverlay] Initial data processed');
    }

    /**
     * Handle race data update
     */
    handleRaceUpdate(response) {
        this.data.race = response.data;
        this.updateRaceUI();
        this.stats.updates++;
    }

    /**
     * Handle betting data update
     */
    handleBettingUpdate(response) {
        this.data.betting = response.data;
        this.updateBettingUI();
        this.stats.updates++;
    }

    /**
     * Handle leaderboard data update
     */
    handleLeaderboardUpdate(response) {
        this.data.leaderboard = response.data;
        this.updateLeaderboardUI();
        this.stats.updates++;
    }

    /**
     * Handle camera data update
     */
    handleCameraUpdate(response) {
        this.data.camera = response.data;
        this.updateCameraUI();
        this.stats.updates++;
    }

    /**
     * Handle general data update
     */
    handleDataUpdate(response) {
        Object.assign(this.data, response.data);
        this.updateAllUI();
        this.stats.updates++;
    }

    /**
     * Update all UI elements
     */
    updateAllUI() {
        this.updateRaceUI();
        this.updateBettingUI();
        this.updatePlayerStandingsUI();
        this.updateLivePlayersUI();
        this.updateLeaderboardUI();
        this.updateCameraUI();
    }

    /**
     * Update race UI elements
     */
    updateRaceUI() {
        const race = this.data.race;
        if (!race) return;

        // Update race timer
        if (this.elements.raceTimer && race.timeRemaining !== undefined) {
            const minutes = Math.floor(race.timeRemaining / 60);
            const seconds = race.timeRemaining % 60;
            const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            this.elements.raceTimer.textContent = timeText;

            // Add urgency styling
            this.elements.raceTimer.classList.toggle('urgent', race.timeRemaining <= 30);
        }

        // Update race information
        if (this.elements.raceNumber) {
            this.elements.raceNumber.textContent = race.raceNumber || '0';
        }

        if (this.elements.currentMap) {
            this.elements.currentMap.textContent = race.currentMap || 'Unknown';
        }

        if (this.elements.racePhase) {
            this.elements.racePhase.textContent = this.formatPhase(race.phase);
        }
    }

    /**
     * Update betting UI elements
     */
    updateBettingUI() {
        const betting = this.data.betting;
        if (!betting) return;

        // Update betting timer
        if (this.elements.bettingTimer && betting.timeRemaining !== undefined) {
            this.elements.bettingTimer.textContent = `${betting.timeRemaining}s`;
            
            // Add warning/urgent styling
            this.elements.bettingTimer.classList.toggle('warning', betting.timeRemaining <= 20);
            this.elements.bettingTimer.classList.toggle('urgent', betting.timeRemaining <= 10);
        }

        // Update total pool
        if (this.elements.totalPool) {
            this.elements.totalPool.textContent = `$${betting.totalPool || 0}`;
        }

        // Update betting status
        if (this.elements.bettingStatusText) {
            const statusText = betting.isActive ? 'Betting Open' : 'Betting Closed';
            this.elements.bettingStatusText.textContent = statusText;
            this.elements.bettingStatusText.classList.toggle('active', betting.isActive);
        }
    }

    /**
     * Update player standings UI
     */
    updatePlayerStandingsUI() {
        const race = this.data.race;
        if (!race || !race.players || !this.elements.playerStandings) return;

        // Sort players by rank
        const sortedPlayers = [...race.players].sort((a, b) => (a.rank || 999) - (b.rank || 999));

        this.elements.playerStandings.innerHTML = '';

        sortedPlayers.forEach((player, index) => {
            const standingElement = this.createPlayerStandingElement(player, index + 1);
            this.elements.playerStandings.appendChild(standingElement);
        });
    }

    /**
     * Create player standing element
     */
    createPlayerStandingElement(player, position) {
        const element = document.createElement('div');
        element.className = `player-standing ${this.getRankClass(position)}`;
        
        element.innerHTML = `
            <div class="standing-rank">${position}</div>
            <div class="standing-name">${player.name || `Player ${player.id}`}</div>
            <div class="standing-stats">
                <div class="standing-wins">Rank: ${player.rank || 'N/A'}</div>
                <div class="standing-rate">Distance: ${Math.round(player.distanceToToken || 0)}m</div>
            </div>
        `;

        return element;
    }

    /**
     * Update live players UI
     */
    updateLivePlayersUI() {
        const players = this.data.players;
        if (!players || !this.elements.livePlayers) return;

        this.elements.livePlayers.innerHTML = '';

        players.forEach(player => {
            const playerElement = this.createLivePlayerElement(player);
            this.elements.livePlayers.appendChild(playerElement);
        });
    }

    /**
     * Create live player element
     */
    createLivePlayerElement(player) {
        const element = document.createElement('div');
        element.className = `live-player ${player.isActive ? 'active' : ''}`;
        
        // Add effect classes
        if (player.effects) {
            if (player.effects.boosted) element.classList.add('boosted');
            if (player.effects.stunned) element.classList.add('stunned');
        }

        const effectsHtml = this.createEffectsHtml(player.effects);
        
        element.innerHTML = `
            <div class="player-name">${player.name || `Player ${player.id}`}</div>
            <div class="player-effects">${effectsHtml}</div>
            <div class="player-distance">${Math.round(player.distanceToToken || 0)}m</div>
        `;

        return element;
    }

    /**
     * Create effects HTML
     */
    createEffectsHtml(effects) {
        if (!effects) return '';

        let html = '';
        
        if (effects.boosted) html += '<div class="effect-icon boosted">B</div>';
        if (effects.magnetized) html += '<div class="effect-icon magnetized">M</div>';
        if (effects.bubbleProtected) html += '<div class="effect-icon bubble">S</div>';
        if (effects.stunned) html += '<div class="effect-icon stunned">X</div>';

        return html;
    }

    /**
     * Update leaderboard UI
     */
    updateLeaderboardUI() {
        const leaderboard = this.data.leaderboard;
        if (!leaderboard || !leaderboard.topPlayers || !this.elements.topPlayers) return;

        this.elements.topPlayers.innerHTML = '';

        leaderboard.topPlayers.slice(0, 10).forEach((player, index) => {
            const playerElement = this.createTopPlayerElement(player, index + 1);
            this.elements.topPlayers.appendChild(playerElement);
        });
    }

    /**
     * Create top player element
     */
    createTopPlayerElement(player, rank) {
        const element = document.createElement('div');
        element.className = `top-player rank-${rank}`;
        
        element.innerHTML = `
            <div class="player-rank">${rank}</div>
            <div class="player-info">
                <div class="player-name-lb">${player.name}</div>
                <div class="player-stats-lb">${player.wins} wins • ${player.winRate}% rate</div>
            </div>
        `;

        return element;
    }

    /**
     * Update camera UI
     */
    updateCameraUI() {
        const camera = this.data.camera;
        if (!camera) return;

        if (this.elements.cameraMode) {
            this.elements.cameraMode.textContent = this.formatCameraMode(camera.mode);
        }

        if (this.elements.cameraTarget) {
            this.elements.cameraTarget.textContent = camera.followTarget || 'None';
        }
    }

    /**
     * Start animation loop for smooth updates
     */
    startAnimationLoop() {
        const animate = (currentTime) => {
            // Calculate FPS
            if (this.lastFrameTime) {
                const deltaTime = currentTime - this.lastFrameTime;
                this.stats.fps = Math.round(1000 / deltaTime);
            }
            this.lastFrameTime = currentTime;

            // Update debug info periodically
            if (this.config.showDebug) {
                this.updateDebugInfo();
            }

            this.animationFrame = requestAnimationFrame(animate);
        };

        this.animationFrame = requestAnimationFrame(animate);
    }

    /**
     * Start ping timer for latency measurement
     */
    startPingTimer() {
        this.pingTimer = setInterval(() => {
            if (this.isConnected) {
                this.socket.emit('ping');
            }
        }, 5000);
    }

    /**
     * Stop ping timer
     */
    stopPingTimer() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }

    /**
     * Update connection status indicator
     */
    updateConnectionStatus(status) {
        if (!this.elements.connectionStatus) return;

        this.elements.connectionStatus.className = `connection-status ${status}`;
        
        const statusText = this.elements.connectionStatus.querySelector('.status-text');
        if (statusText) {
            switch (status) {
                case 'connected':
                    statusText.textContent = 'Connected';
                    break;
                case 'connecting':
                    statusText.textContent = 'Connecting...';
                    break;
                case 'disconnected':
                    statusText.textContent = 'Disconnected';
                    break;
                default:
                    statusText.textContent = 'Unknown';
            }
        }
    }

    /**
     * Update debug information
     */
    updateDebugInfo() {
        if (this.elements.debugFps) {
            this.elements.debugFps.textContent = this.stats.fps;
        }
        
        if (this.elements.debugLatency) {
            this.elements.debugLatency.textContent = `${this.stats.latency}ms`;
        }
        
        if (this.elements.debugUpdates) {
            this.elements.debugUpdates.textContent = this.stats.updates;
        }
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info', duration = 3000) {
        if (!this.elements.notificationContainer) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        this.elements.notificationContainer.appendChild(notification);
        this.notifications.push(notification);

        // Auto-remove notification
        setTimeout(() => {
            notification.classList.add('fadeOut');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                    const index = this.notifications.indexOf(notification);
                    if (index > -1) {
                        this.notifications.splice(index, 1);
                    }
                }
            }, 300);
        }, duration);
    }

    /**
     * Clear all notifications
     */
    clearNotifications() {
        this.notifications.forEach(notification => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
        this.notifications = [];
    }

    /**
     * Toggle debug panel
     */
    toggleDebug() {
        this.config.showDebug = !this.config.showDebug;
        const debugPanel = document.getElementById('debug-panel');
        if (debugPanel) {
            debugPanel.style.display = this.config.showDebug ? 'block' : 'none';
        }
    }

    /**
     * Pause updates when window is not visible
     */
    pauseUpdates() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    /**
     * Resume updates when window becomes visible
     */
    resumeUpdates() {
        if (!this.animationFrame) {
            this.startAnimationLoop();
        }
    }

    /**
     * Utility functions
     */
    formatPhase(phase) {
        const phases = {
            'waiting': 'Waiting',
            'betting': 'Betting Phase',
            'racing': 'Race Active',
            'finished': 'Race Finished'
        };
        return phases[phase] || phase;
    }

    formatCameraMode(mode) {
        const modes = {
            'overview': 'Overview',
            'follow_player': 'Following Player',
            'follow_action': 'Following Action',
            'free_cam': 'Free Camera',
            'spectator_1': 'Spectator View 1',
            'spectator_2': 'Spectator View 2',
            'spectator_3': 'Spectator View 3',
            'broadcast': 'Broadcast Mode'
        };
        return modes[mode] || mode;
    }

    getRankClass(position) {
        if (position === 1) return 'first';
        if (position === 2) return 'second';
        if (position === 3) return 'third';
        return '';
    }

    /**
     * Destroy overlay system
     */
    destroy() {
        console.log('[MemexRacingOverlay] Destroying overlay system');

        // Disconnect socket
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }

        // Clear timers
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        
        this.stopPingTimer();

        // Stop animation loop
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        // Clear notifications
        this.clearNotifications();

        console.log('[MemexRacingOverlay] Overlay system destroyed');
    }
}

// Initialize overlay when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Use configuration from global OVERLAY_CONFIG if available
    const config = window.OVERLAY_CONFIG || {};
    
    // Create and start overlay system
    window.memexOverlay = new MemexRacingOverlay(config);
    
    console.log('[MemexRacingOverlay] Overlay system started');
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.memexOverlay) {
        window.memexOverlay.destroy();
    }
});