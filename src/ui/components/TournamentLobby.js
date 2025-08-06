/**
 * TournamentLobby.js - Tournament Lobby Interface Component
 * 
 * Tournament list browser, registration interface, creation form, player list,
 * seeding display, tournament info, countdown timer, and communication panel.
 */

export class TournamentLobby {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.isVisible = false;
        this.currentView = 'browse'; // browse, create, lobby, spectate
        
        // Tournament state
        this.availableTournaments = [];
        this.selectedTournament = null;
        this.userRegistration = null;
        this.refreshInterval = null;
        
        // Create tournament form state
        this.createForm = {
            name: '',
            format: 'single_elimination',
            maxPlayers: 16,
            minPlayers: 4,
            playersPerRace: 6,
            raceTimeLimit: 300,
            bettingEnabled: true,
            spectatorCount: 50,
            registrationTimeLimit: 600,
            prizePool: 0
        };
        
        // Chat state
        this.chatMessages = [];
        this.maxChatMessages = 50;
        
        console.log('[TournamentLobby] Tournament lobby component initialized');
    }

    /**
     * Initialize the tournament lobby panel
     */
    async initialize() {
        this.createPanelContent();
        this.setupEventListeners();
        this.loadAvailableTournaments();
        console.log('[TournamentLobby] Panel initialized');
    }

    /**
     * Create tournament lobby panel content structure
     */
    createPanelContent() {
        const panel = document.getElementById('tournament-lobby-panel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="tournament-lobby-overlay">
                <div class="tournament-lobby-modal">
                    <div class="panel-header">
                        <div class="panel-title">
                            <span class="title-text pixel-text">TOURNAMENT LOBBY</span>
                            <div class="lobby-nav">
                                <button class="nav-btn active" data-view="browse">
                                    <span class="nav-icon">🏆</span>
                                    BROWSE
                                </button>
                                <button class="nav-btn" data-view="create">
                                    <span class="nav-icon">➕</span>
                                    CREATE
                                </button>
                                <button class="nav-btn" data-view="my-tournaments">
                                    <span class="nav-icon">📋</span>
                                    MY TOURNAMENTS
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="panel-body lobby-content">
                        <!-- Browse Tournaments View -->
                        <div class="view-container browse-view" id="browse-view">
                            <div class="tournaments-filters">
                                <div class="filter-group">
                                    <label for="format-filter">FORMAT:</label>
                                    <select id="format-filter" class="filter-select">
                                        <option value="">ALL</option>
                                        <option value="single_elimination">SINGLE ELIMINATION</option>
                                        <option value="double_elimination">DOUBLE ELIMINATION</option>
                                        <option value="round_robin">ROUND ROBIN</option>
                                    </select>
                                </div>
                                <div class="filter-group">
                                    <label for="status-filter">STATUS:</label>
                                    <select id="status-filter" class="filter-select">
                                        <option value="">ALL</option>
                                        <option value="registration">REGISTRATION</option>
                                        <option value="active">ACTIVE</option>
                                        <option value="completed">COMPLETED</option>
                                    </select>
                                </div>
                                <button class="refresh-btn" id="refresh-tournaments-btn">
                                    <span class="btn-icon">🔄</span>
                                    REFRESH
                                </button>
                            </div>
                            
                            <div class="tournaments-list" id="tournaments-list">
                                <!-- Tournament items will be generated -->
                            </div>
                        </div>
                        
                        <!-- Create Tournament View -->
                        <div class="view-container create-view hidden" id="create-view">
                            <div class="create-tournament-form">
                                <div class="form-section">
                                    <h3 class="section-title pixel-text">TOURNAMENT SETTINGS</h3>
                                    
                                    <div class="form-row">
                                        <label for="tournament-name">NAME:</label>
                                        <input type="text" id="tournament-name" class="form-input" 
                                               placeholder="Enter tournament name" maxlength="50">
                                    </div>
                                    
                                    <div class="form-row">
                                        <label for="tournament-format">FORMAT:</label>
                                        <select id="tournament-format" class="form-select">
                                            <option value="single_elimination">SINGLE ELIMINATION</option>
                                            <option value="double_elimination">DOUBLE ELIMINATION</option>
                                            <option value="round_robin">ROUND ROBIN</option>
                                        </select>
                                    </div>
                                    
                                    <div class="form-row-group">
                                        <div class="form-row">
                                            <label for="max-players">MAX PLAYERS:</label>
                                            <input type="number" id="max-players" class="form-input" 
                                                   min="4" max="64" value="16">
                                        </div>
                                        <div class="form-row">
                                            <label for="min-players">MIN PLAYERS:</label>
                                            <input type="number" id="min-players" class="form-input" 
                                                   min="2" max="32" value="4">
                                        </div>
                                    </div>
                                    
                                    <div class="form-row-group">
                                        <div class="form-row">
                                            <label for="players-per-race">PLAYERS PER RACE:</label>
                                            <select id="players-per-race" class="form-select">
                                                <option value="2">2</option>
                                                <option value="3">3</option>
                                                <option value="4">4</option>
                                                <option value="5">5</option>
                                                <option value="6" selected>6</option>
                                            </select>
                                        </div>
                                        <div class="form-row">
                                            <label for="race-time-limit">RACE TIME (s):</label>
                                            <input type="number" id="race-time-limit" class="form-input" 
                                                   min="60" max="900" value="300">
                                        </div>
                                    </div>
                                    
                                    <div class="form-row-group">
                                        <div class="form-row">
                                            <label for="spectator-count">MAX SPECTATORS:</label>
                                            <input type="number" id="spectator-count" class="form-input" 
                                                   min="0" max="200" value="50">
                                        </div>
                                        <div class="form-row">
                                            <label for="registration-time">REGISTRATION TIME (min):</label>
                                            <input type="number" id="registration-time" class="form-input" 
                                                   min="1" max="60" value="10">
                                        </div>
                                    </div>
                                    
                                    <div class="form-row">
                                        <label class="checkbox-label">
                                            <input type="checkbox" id="betting-enabled" checked>
                                            <span class="checkbox-custom"></span>
                                            ENABLE BETTING
                                        </label>
                                    </div>
                                    
                                    <div class="form-row">
                                        <label for="prize-pool">PRIZE POOL ($):</label>
                                        <input type="number" id="prize-pool" class="form-input" 
                                               min="0" max="10000" value="0" step="10">
                                    </div>
                                </div>
                                
                                <div class="form-actions">
                                    <button class="action-btn create-btn" id="create-tournament-btn">
                                        <span class="btn-icon">🏆</span>
                                        CREATE TOURNAMENT
                                    </button>
                                    <button class="action-btn cancel-btn" id="cancel-create-btn">
                                        <span class="btn-icon">✕</span>
                                        CANCEL
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Tournament Lobby View -->
                        <div class="view-container lobby-view hidden" id="lobby-view">
                            <div class="tournament-header" id="tournament-header">
                                <!-- Tournament info will be populated -->
                            </div>
                            
                            <div class="lobby-main">
                                <div class="players-section">
                                    <div class="section-header">
                                        <h3 class="section-title">REGISTERED PLAYERS</h3>
                                        <div class="player-count" id="player-count">0 / 16</div>
                                    </div>
                                    
                                    <div class="players-grid" id="players-grid">
                                        <!-- Player cards will be generated -->
                                    </div>
                                    
                                    <div class="registration-actions" id="registration-actions">
                                        <!-- Registration buttons will appear here -->
                                    </div>
                                </div>
                                
                                <div class="chat-section">
                                    <div class="section-header">
                                        <h3 class="section-title">TOURNAMENT CHAT</h3>
                                        <div class="chat-controls">
                                            <button class="chat-control-btn" id="clear-chat-btn" title="Clear Chat">
                                                <span class="btn-icon">🗑️</span>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div class="chat-messages" id="chat-messages">
                                        <!-- Chat messages will be generated -->
                                    </div>
                                    
                                    <div class="chat-input-section">
                                        <input type="text" id="chat-input" class="chat-input" 
                                               placeholder="Type a message..." maxlength="200">
                                        <button class="send-btn" id="send-chat-btn">
                                            <span class="btn-icon">📤</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="countdown-section" id="countdown-section">
                                <!-- Countdown timer will appear here -->
                            </div>
                        </div>
                        
                        <!-- My Tournaments View -->
                        <div class="view-container my-tournaments-view hidden" id="my-tournaments-view">
                            <div class="my-tournaments-list" id="my-tournaments-list">
                                <!-- User's tournaments will be listed -->
                            </div>
                        </div>
                    </div>
                    
                    <div class="panel-footer">
                        <div class="footer-info">
                            <span class="online-count" id="online-count">0 players online</span>
                            <span class="active-tournaments" id="active-tournaments">0 active tournaments</span>
                        </div>
                        <button class="action-btn close-btn" id="close-lobby-btn">
                            <span class="btn-icon">✕</span>
                            CLOSE
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Setup event listeners for lobby interactions
     */
    setupEventListeners() {
        // Close button
        const closeBtn = document.getElementById('close-lobby-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        // Navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.closest('[data-view]').dataset.view;
                this.switchView(view);
            });
        });

        // Filter controls
        const formatFilter = document.getElementById('format-filter');
        const statusFilter = document.getElementById('status-filter');
        if (formatFilter) formatFilter.addEventListener('change', () => this.applyFilters());
        if (statusFilter) statusFilter.addEventListener('change', () => this.applyFilters());

        // Refresh button
        const refreshBtn = document.getElementById('refresh-tournaments-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadAvailableTournaments());
        }

        // Create tournament form
        this.setupCreateFormListeners();

        // Chat functionality
        this.setupChatListeners();

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (!this.isVisible) return;
            
            switch(e.key) {
                case 'Escape':
                    if (this.currentView === 'lobby') {
                        this.switchView('browse');
                    } else {
                        this.hide();
                    }
                    break;
                case 'Enter':
                    if (document.activeElement?.id === 'chat-input') {
                        this.sendChatMessage();
                    }
                    break;
            }
        });

        // Close on overlay click
        const overlay = document.querySelector('.tournament-lobby-overlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.hide();
                }
            });
        }
    }

    /**
     * Setup create tournament form listeners
     */
    setupCreateFormListeners() {
        // Create tournament button
        const createBtn = document.getElementById('create-tournament-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.createTournament());
        }

        // Cancel create button
        const cancelBtn = document.getElementById('cancel-create-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.switchView('browse'));
        }

        // Form validation
        const inputs = [
            'tournament-name', 'max-players', 'min-players', 
            'race-time-limit', 'spectator-count', 'registration-time', 'prize-pool'
        ];

        inputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('input', () => this.validateCreateForm());
            }
        });

        // Min/Max players validation
        const maxPlayersInput = document.getElementById('max-players');
        const minPlayersInput = document.getElementById('min-players');
        
        if (maxPlayersInput && minPlayersInput) {
            maxPlayersInput.addEventListener('input', () => {
                const maxVal = parseInt(maxPlayersInput.value);
                minPlayersInput.max = maxVal;
                if (parseInt(minPlayersInput.value) > maxVal) {
                    minPlayersInput.value = maxVal;
                }
            });
        }
    }

    /**
     * Setup chat listeners
     */
    setupChatListeners() {
        const sendBtn = document.getElementById('send-chat-btn');
        const chatInput = document.getElementById('chat-input');
        const clearBtn = document.getElementById('clear-chat-btn');

        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendChatMessage());
        }

        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendChatMessage();
                }
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearChat());
        }
    }

    /**
     * Show tournament lobby panel
     */
    show() {
        const panel = document.getElementById('tournament-lobby-panel');
        if (panel) {
            panel.style.display = 'block';
            this.isVisible = true;
            
            // Start refresh interval
            this.startRefreshInterval();
            
            // Load initial data
            this.loadAvailableTournaments();
            
            console.log('[TournamentLobby] Panel shown');
        }
    }

    /**
     * Hide tournament lobby panel
     */
    hide() {
        const panel = document.getElementById('tournament-lobby-panel');
        if (panel) {
            panel.style.display = 'none';
            this.isVisible = false;
            
            // Stop refresh interval
            this.stopRefreshInterval();
            
            console.log('[TournamentLobby] Panel hidden');
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
        return document.getElementById('tournament-lobby-panel');
    }

    /**
     * Switch between lobby views
     */
    switchView(viewName) {
        // Update navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

        // Show/hide view containers
        document.querySelectorAll('.view-container').forEach(container => {
            container.classList.add('hidden');
        });
        document.getElementById(`${viewName}-view`).classList.remove('hidden');

        this.currentView = viewName;

        // Load view-specific data
        switch (viewName) {
            case 'browse':
                this.loadAvailableTournaments();
                break;
            case 'create':
                this.resetCreateForm();
                break;
            case 'my-tournaments':
                this.loadMyTournaments();
                break;
        }

        console.log(`[TournamentLobby] Switched to ${viewName} view`);
    }

    /**
     * Load available tournaments
     */
    async loadAvailableTournaments() {
        try {
            // Get tournaments from tournament manager
            const tournamentManager = window.tournamentManager;
            if (tournamentManager) {
                this.availableTournaments = tournamentManager.listActiveTournaments();
            } else {
                // Demo data for development
                this.availableTournaments = this.generateDemoTournaments();
            }

            this.renderTournamentsList();
            this.updateFooterStats();
            
        } catch (error) {
            console.error('[TournamentLobby] Error loading tournaments:', error);
            this.showNotification('Failed to load tournaments', 'error');
        }
    }

    /**
     * Generate demo tournaments for development
     */
    generateDemoTournaments() {
        return [
            {
                tournamentId: 'demo-1',
                name: 'Speed Masters Championship',
                format: 'single_elimination',
                status: 'registration',
                currentPlayers: 12,
                maxPlayers: 16,
                createdAt: Date.now() - 300000,
                registrationDeadline: Date.now() + 300000,
                bettingEnabled: true,
                prizePool: 500
            },
            {
                tournamentId: 'demo-2',
                name: 'Racing Legends Cup',
                format: 'double_elimination',
                status: 'active',
                currentPlayers: 8,
                maxPlayers: 8,
                currentRound: 2,
                totalRounds: 4,
                bettingEnabled: true,
                prizePool: 1000
            },
            {
                tournamentId: 'demo-3',
                name: 'Weekly Round Robin',
                format: 'round_robin',
                status: 'registration',
                currentPlayers: 6,
                maxPlayers: 12,
                createdAt: Date.now() - 180000,
                registrationDeadline: Date.now() + 420000,
                bettingEnabled: false,
                prizePool: 0
            }
        ];
    }

    /**
     * Render tournaments list
     */
    renderTournamentsList() {
        const list = document.getElementById('tournaments-list');
        if (!list) return;

        list.innerHTML = '';

        const filteredTournaments = this.applyFilters();

        if (filteredTournaments.length === 0) {
            list.innerHTML = '<div class="no-tournaments">No tournaments found</div>';
            return;
        }

        filteredTournaments.forEach(tournament => {
            const tournamentEl = this.createTournamentListItem(tournament);
            list.appendChild(tournamentEl);
        });
    }

    /**
     * Create tournament list item
     */
    createTournamentListItem(tournament) {
        const timeRemaining = tournament.registrationDeadline - Date.now();
        const timeRemainingText = timeRemaining > 0 
            ? `${Math.ceil(timeRemaining / 60000)}m remaining`
            : 'Registration closed';

        const item = document.createElement('div');
        item.className = `tournament-item status-${tournament.status}`;
        item.innerHTML = `
            <div class="tournament-main-info">
                <div class="tournament-name">${tournament.name}</div>
                <div class="tournament-meta">
                    <span class="tournament-format format-${tournament.format.replace('_', '-')}">${tournament.format.replace('_', ' ').toUpperCase()}</span>
                    <span class="tournament-status status-${tournament.status}">${tournament.status.toUpperCase()}</span>
                </div>
            </div>
            
            <div class="tournament-details">
                <div class="detail-item">
                    <span class="detail-label">PLAYERS:</span>
                    <span class="detail-value">${tournament.currentPlayers}/${tournament.maxPlayers}</span>
                </div>
                ${tournament.status === 'registration' ? `
                <div class="detail-item">
                    <span class="detail-label">REGISTRATION:</span>
                    <span class="detail-value ${timeRemaining < 300000 ? 'urgent' : ''}">${timeRemainingText}</span>
                </div>
                ` : ''}
                ${tournament.currentRound ? `
                <div class="detail-item">
                    <span class="detail-label">ROUND:</span>
                    <span class="detail-value">${tournament.currentRound}/${tournament.totalRounds}</span>
                </div>
                ` : ''}
                <div class="detail-item">
                    <span class="detail-label">BETTING:</span>
                    <span class="detail-value">${tournament.bettingEnabled ? 'ENABLED' : 'DISABLED'}</span>
                </div>
                ${tournament.prizePool > 0 ? `
                <div class="detail-item">
                    <span class="detail-label">PRIZE:</span>
                    <span class="detail-value prize">$${tournament.prizePool}</span>
                </div>
                ` : ''}
            </div>
            
            <div class="tournament-actions">
                ${tournament.status === 'registration' ? `
                    <button class="action-btn join-btn" data-tournament-id="${tournament.tournamentId}">
                        <span class="btn-icon">🏁</span>
                        JOIN
                    </button>
                ` : ''}
                <button class="action-btn spectate-btn" data-tournament-id="${tournament.tournamentId}">
                    <span class="btn-icon">👁️</span>
                    SPECTATE
                </button>
                <button class="action-btn info-btn" data-tournament-id="${tournament.tournamentId}">
                    <span class="btn-icon">ℹ️</span>
                    INFO
                </button>
            </div>
        `;

        // Add event listeners
        const joinBtn = item.querySelector('.join-btn');
        const spectateBtn = item.querySelector('.spectate-btn');
        const infoBtn = item.querySelector('.info-btn');

        if (joinBtn) {
            joinBtn.addEventListener('click', () => this.joinTournament(tournament.tournamentId));
        }
        
        if (spectateBtn) {
            spectateBtn.addEventListener('click', () => this.spectateTournament(tournament.tournamentId));
        }
        
        if (infoBtn) {
            infoBtn.addEventListener('click', () => this.showTournamentInfo(tournament.tournamentId));
        }

        return item;
    }

    /**
     * Apply filters to tournament list
     */
    applyFilters() {
        const formatFilter = document.getElementById('format-filter')?.value;
        const statusFilter = document.getElementById('status-filter')?.value;

        return this.availableTournaments.filter(tournament => {
            if (formatFilter && tournament.format !== formatFilter) return false;
            if (statusFilter && tournament.status !== statusFilter) return false;
            return true;
        });
    }

    /**
     * Join tournament
     */
    async joinTournament(tournamentId) {
        try {
            const tournament = this.availableTournaments.find(t => t.tournamentId === tournamentId);
            if (!tournament) {
                this.showNotification('Tournament not found', 'error');
                return;
            }

            // Here you would call the tournament manager to register the player
            // For demo purposes, we'll simulate joining
            this.selectedTournament = tournament;
            this.userRegistration = {
                playerId: 'current-user',
                playerName: 'Player',
                registeredAt: Date.now(),
                seed: tournament.currentPlayers + 1
            };

            // Switch to lobby view
            this.switchView('lobby');
            this.loadTournamentLobby(tournamentId);
            
            this.showNotification(`Joined tournament: ${tournament.name}`, 'success');
            
        } catch (error) {
            console.error('[TournamentLobby] Error joining tournament:', error);
            this.showNotification('Failed to join tournament', 'error');
        }
    }

    /**
     * Spectate tournament
     */
    async spectateTournament(tournamentId) {
        try {
            const tournament = this.availableTournaments.find(t => t.tournamentId === tournamentId);
            if (!tournament) {
                this.showNotification('Tournament not found', 'error');
                return;
            }

            // Switch to spectator view (same as lobby but without join options)
            this.selectedTournament = tournament;
            this.switchView('lobby');
            this.loadTournamentLobby(tournamentId, true);
            
            this.showNotification(`Spectating tournament: ${tournament.name}`, 'info');
            
        } catch (error) {
            console.error('[TournamentLobby] Error spectating tournament:', error);
            this.showNotification('Failed to spectate tournament', 'error');
        }
    }

    /**
     * Show tournament info
     */
    showTournamentInfo(tournamentId) {
        const tournament = this.availableTournaments.find(t => t.tournamentId === tournamentId);
        if (!tournament) return;

        // You could open the tournament bracket panel here
        if (this.uiManager.tournamentBracket) {
            this.uiManager.tournamentBracket.setTournament(tournament);
            this.uiManager.tournamentBracket.show();
        }
    }

    /**
     * Load tournament lobby view
     */
    loadTournamentLobby(tournamentId, isSpectator = false) {
        if (!this.selectedTournament) return;

        this.updateTournamentHeader(isSpectator);
        this.loadRegisteredPlayers();
        this.setupRegistrationActions(isSpectator);
        this.loadChatMessages();
        this.startCountdownTimer();
    }

    /**
     * Update tournament header info
     */
    updateTournamentHeader(isSpectator) {
        const header = document.getElementById('tournament-header');
        if (!header || !this.selectedTournament) return;

        const tournament = this.selectedTournament;
        header.innerHTML = `
            <div class="tournament-title">
                <h2 class="tournament-name">${tournament.name}</h2>
                <div class="tournament-badges">
                    <span class="format-badge format-${tournament.format}">${tournament.format.replace('_', ' ').toUpperCase()}</span>
                    <span class="status-badge status-${tournament.status}">${tournament.status.toUpperCase()}</span>
                    ${isSpectator ? '<span class="spectator-badge">SPECTATOR</span>' : ''}
                </div>
            </div>
            <div class="tournament-stats">
                <div class="stat-item">
                    <span class="stat-label">PLAYERS:</span>
                    <span class="stat-value">${tournament.currentPlayers}/${tournament.maxPlayers}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">BETTING:</span>
                    <span class="stat-value">${tournament.bettingEnabled ? 'ENABLED' : 'DISABLED'}</span>
                </div>
                ${tournament.prizePool > 0 ? `
                <div class="stat-item">
                    <span class="stat-label">PRIZE POOL:</span>
                    <span class="stat-value prize">$${tournament.prizePool}</span>
                </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Load and display registered players
     */
    loadRegisteredPlayers() {
        const grid = document.getElementById('players-grid');
        const counter = document.getElementById('player-count');
        
        if (!grid || !this.selectedTournament) return;

        // Generate demo players
        const players = [];
        for (let i = 0; i < this.selectedTournament.currentPlayers; i++) {
            players.push({
                playerId: `player-${i + 1}`,
                playerName: `Player ${i + 1}`,
                seed: i + 1,
                registeredAt: Date.now() - Math.random() * 300000,
                isCurrentUser: i === 0 && this.userRegistration
            });
        }

        grid.innerHTML = '';
        
        players.forEach(player => {
            const playerEl = this.createPlayerCard(player);
            grid.appendChild(playerEl);
        });

        // Add empty slots
        const emptySlots = this.selectedTournament.maxPlayers - players.length;
        for (let i = 0; i < emptySlots; i++) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'player-card empty';
            emptyEl.innerHTML = `
                <div class="empty-slot">
                    <span class="empty-icon">➕</span>
                    <span class="empty-text">OPEN</span>
                </div>
            `;
            grid.appendChild(emptyEl);
        }

        if (counter) {
            counter.textContent = `${players.length} / ${this.selectedTournament.maxPlayers}`;
        }
    }

    /**
     * Create player card
     */
    createPlayerCard(player) {
        const card = document.createElement('div');
        card.className = `player-card ${player.isCurrentUser ? 'current-user' : ''}`;
        
        const timeAgo = Math.floor((Date.now() - player.registeredAt) / 60000);
        
        card.innerHTML = `
            <div class="player-avatar">
                <span class="avatar-text">${player.playerName.charAt(0).toUpperCase()}</span>
            </div>
            <div class="player-info">
                <div class="player-name">${player.playerName}</div>
                <div class="player-meta">
                    <span class="player-seed">Seed: ${player.seed}</span>
                    <span class="player-joined">${timeAgo}m ago</span>
                </div>
            </div>
            ${player.isCurrentUser ? '<div class="current-user-indicator">YOU</div>' : ''}
        `;

        return card;
    }

    /**
     * Setup registration action buttons
     */
    setupRegistrationActions(isSpectator) {
        const actions = document.getElementById('registration-actions');
        if (!actions) return;

        if (isSpectator) {
            actions.innerHTML = `
                <div class="spectator-info">
                    <span class="spectator-text">You are spectating this tournament</span>
                </div>
            `;
        } else if (this.userRegistration) {
            actions.innerHTML = `
                <button class="action-btn leave-tournament-btn" id="leave-tournament-btn">
                    <span class="btn-icon">🚪</span>
                    LEAVE TOURNAMENT
                </button>
                <button class="action-btn ready-btn" id="ready-btn">
                    <span class="btn-icon">✅</span>
                    READY
                </button>
            `;

            const leaveBtn = document.getElementById('leave-tournament-btn');
            if (leaveBtn) {
                leaveBtn.addEventListener('click', () => this.leaveTournament());
            }
        } else if (this.selectedTournament.status === 'registration') {
            actions.innerHTML = `
                <button class="action-btn join-tournament-btn" id="join-tournament-btn">
                    <span class="btn-icon">🏁</span>
                    JOIN TOURNAMENT
                </button>
            `;

            const joinBtn = document.getElementById('join-tournament-btn');
            if (joinBtn) {
                joinBtn.addEventListener('click', () => this.joinTournament(this.selectedTournament.tournamentId));
            }
        }
    }

    /**
     * Start countdown timer for tournament start
     */
    startCountdownTimer() {
        const section = document.getElementById('countdown-section');
        if (!section || !this.selectedTournament) return;

        if (this.selectedTournament.status === 'registration') {
            const timeRemaining = this.selectedTournament.registrationDeadline - Date.now();
            
            section.innerHTML = `
                <div class="countdown-timer">
                    <div class="countdown-label">TOURNAMENT STARTS IN:</div>
                    <div class="countdown-display" id="countdown-display">
                        ${this.formatCountdown(timeRemaining)}
                    </div>
                </div>
            `;

            // Update countdown every second
            const countdownInterval = setInterval(() => {
                const remaining = this.selectedTournament.registrationDeadline - Date.now();
                const display = document.getElementById('countdown-display');
                
                if (display) {
                    display.textContent = this.formatCountdown(remaining);
                    
                    if (remaining <= 0) {
                        clearInterval(countdownInterval);
                        display.textContent = 'STARTING...';
                    }
                }
            }, 1000);
        } else {
            section.innerHTML = '';
        }
    }

    /**
     * Format countdown time
     */
    formatCountdown(milliseconds) {
        if (milliseconds <= 0) return '00:00';
        
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Chat functionality
     */
    loadChatMessages() {
        // Load existing chat messages (demo data)
        this.chatMessages = [
            { playerId: 'system', playerName: 'SYSTEM', message: 'Tournament lobby opened', timestamp: Date.now() - 300000, type: 'system' },
            { playerId: 'player-1', playerName: 'Player 1', message: 'Good luck everyone!', timestamp: Date.now() - 120000, type: 'player' },
            { playerId: 'player-2', playerName: 'Player 2', message: 'Ready to race!', timestamp: Date.now() - 60000, type: 'player' }
        ];

        this.updateChatDisplay();
    }

    sendChatMessage() {
        const input = document.getElementById('chat-input');
        if (!input || !input.value.trim()) return;

        const message = {
            playerId: 'current-user',
            playerName: 'You',
            message: input.value.trim(),
            timestamp: Date.now(),
            type: 'player'
        };

        this.chatMessages.push(message);
        
        // Keep only recent messages
        if (this.chatMessages.length > this.maxChatMessages) {
            this.chatMessages.shift();
        }

        this.updateChatDisplay();
        input.value = '';
    }

    clearChat() {
        this.chatMessages = [];
        this.updateChatDisplay();
    }

    updateChatDisplay() {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        container.innerHTML = '';

        this.chatMessages.forEach(message => {
            const messageEl = document.createElement('div');
            messageEl.className = `chat-message type-${message.type}`;
            
            const timestamp = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            messageEl.innerHTML = `
                <div class="message-header">
                    <span class="sender-name">${message.playerName}</span>
                    <span class="message-time">${timestamp}</span>
                </div>
                <div class="message-content">${message.message}</div>
            `;

            container.appendChild(messageEl);
        });

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    /**
     * Create tournament functionality
     */
    validateCreateForm() {
        const name = document.getElementById('tournament-name')?.value.trim();
        const maxPlayers = parseInt(document.getElementById('max-players')?.value || 0);
        const minPlayers = parseInt(document.getElementById('min-players')?.value || 0);
        
        const createBtn = document.getElementById('create-tournament-btn');
        if (!createBtn) return;

        const isValid = name.length >= 3 && maxPlayers >= minPlayers && minPlayers >= 2;
        createBtn.disabled = !isValid;
    }

    resetCreateForm() {
        document.getElementById('tournament-name').value = '';
        document.getElementById('tournament-format').value = 'single_elimination';
        document.getElementById('max-players').value = '16';
        document.getElementById('min-players').value = '4';
        document.getElementById('players-per-race').value = '6';
        document.getElementById('race-time-limit').value = '300';
        document.getElementById('spectator-count').value = '50';
        document.getElementById('registration-time').value = '10';
        document.getElementById('betting-enabled').checked = true;
        document.getElementById('prize-pool').value = '0';
        
        this.validateCreateForm();
    }

    async createTournament() {
        try {
            const formData = {
                name: document.getElementById('tournament-name').value.trim(),
                format: document.getElementById('tournament-format').value,
                maxPlayers: parseInt(document.getElementById('max-players').value),
                minPlayers: parseInt(document.getElementById('min-players').value),
                playersPerRace: parseInt(document.getElementById('players-per-race').value),
                raceTimeLimit: parseInt(document.getElementById('race-time-limit').value),
                spectatorCount: parseInt(document.getElementById('spectator-count').value),
                registrationTimeLimit: parseInt(document.getElementById('registration-time').value) * 60,
                bettingEnabled: document.getElementById('betting-enabled').checked,
                prizePool: parseInt(document.getElementById('prize-pool').value)
            };

            // Here you would call the tournament manager
            // For demo purposes, we'll simulate creation
            const newTournament = {
                tournamentId: `tournament-${Date.now()}`,
                ...formData,
                status: 'registration',
                currentPlayers: 0,
                createdAt: Date.now(),
                registrationDeadline: Date.now() + formData.registrationTimeLimit * 1000
            };

            this.availableTournaments.unshift(newTournament);
            this.switchView('browse');
            this.renderTournamentsList();
            
            this.showNotification(`Tournament "${formData.name}" created successfully!`, 'success');
            
        } catch (error) {
            console.error('[TournamentLobby] Error creating tournament:', error);
            this.showNotification('Failed to create tournament', 'error');
        }
    }

    /**
     * Leave tournament
     */
    async leaveTournament() {
        if (!this.selectedTournament || !this.userRegistration) return;

        try {
            // Call tournament manager to unregister player
            this.userRegistration = null;
            this.selectedTournament.currentPlayers--;
            
            this.switchView('browse');
            this.showNotification('Left tournament', 'info');
            
        } catch (error) {
            console.error('[TournamentLobby] Error leaving tournament:', error);
            this.showNotification('Failed to leave tournament', 'error');
        }
    }

    /**
     * Load user's tournaments
     */
    loadMyTournaments() {
        const list = document.getElementById('my-tournaments-list');
        if (!list) return;

        // Demo data - in reality this would come from the tournament manager
        const myTournaments = this.availableTournaments.filter(t => 
            t.tournamentId.includes('demo') // Demo filter
        );

        list.innerHTML = '';

        if (myTournaments.length === 0) {
            list.innerHTML = '<div class="no-tournaments">You have not participated in any tournaments</div>';
            return;
        }

        myTournaments.forEach(tournament => {
            const item = this.createTournamentListItem(tournament);
            list.appendChild(item);
        });
    }

    /**
     * Start/stop refresh interval
     */
    startRefreshInterval() {
        this.stopRefreshInterval();
        this.refreshInterval = setInterval(() => {
            if (this.currentView === 'browse') {
                this.loadAvailableTournaments();
            }
        }, 30000); // Refresh every 30 seconds
    }

    stopRefreshInterval() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * Update footer statistics
     */
    updateFooterStats() {
        const onlineCount = document.getElementById('online-count');
        const activeTournaments = document.getElementById('active-tournaments');

        if (onlineCount) {
            // Demo data - would come from server
            onlineCount.textContent = `${Math.floor(Math.random() * 100) + 20} players online`;
        }

        if (activeTournaments) {
            const activeCount = this.availableTournaments.filter(t => t.status === 'active').length;
            activeTournaments.textContent = `${activeCount} active tournaments`;
        }
    }

    /**
     * Show notification message
     */
    showNotification(message, type = 'info') {
        // Create or update notification element
        let notification = document.getElementById('tournament-lobby-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'tournament-lobby-notification';
            notification.className = 'notification';
            
            const panel = document.getElementById('tournament-lobby-panel');
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
     * Destroy the tournament lobby panel
     */
    destroy() {
        this.hide();
        this.stopRefreshInterval();
        this.selectedTournament = null;
        this.userRegistration = null;
        this.chatMessages = [];
        console.log('[TournamentLobby] Panel destroyed');
    }
}