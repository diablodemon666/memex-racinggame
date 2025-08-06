/**
 * UIManager.js - Main UI Controller for Memex Racing
 * 
 * Manages HTML overlay panels for player info, betting, leaderboard, and debug interfaces.
 * Synchronizes UI state with game state and handles user interactions.
 */

import { multiplayerEvents, MULTIPLAYER_EVENTS } from '../multiplayer/MultiplayerEvents';
import { InviteModal } from './components/InviteModal';
import { BettingPanel } from './components/BettingPanel';
import { LeaderboardPanel } from './components/LeaderboardPanel';
import { MapSelectionPanel } from './components/MapSelectionPanel';
import { PlayerSetupPanel } from './components/PlayerSetupPanel';
import { DebugPanel } from './components/DebugPanel';
import { AssetBrowser } from './components/AssetBrowser';
import { PresetManager } from './components/PresetManager';
import { PreviewSystem } from './components/PreviewSystem';
import { TrackEditor } from './components/TrackEditor';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { TournamentBracket } from './components/TournamentBracket';
import { TournamentLobby } from './components/TournamentLobby';
import { TournamentResults } from './components/TournamentResults';
import { HistoryManager } from '../game/systems/HistoryManager';
import { getAnimationManager, animations } from './animations';

export class UIManager {
    constructor(game) {
        this.game = game;
        this.isInitialized = false;
        this.currentGameState = 'menu'; // menu, lobby, betting, racing, finished
        
        // UI Components
        this.inviteModal = null;
        this.bettingPanel = null;
        this.leaderboardPanel = null;
        this.mapSelectionPanel = null;
        this.playerSetupPanel = null;
        this.debugPanel = null;
        this.assetBrowser = null;
        this.presetManager = null;
        this.previewSystem = null;
        this.trackEditor = null;
        this.analyticsPanel = null;
        this.tournamentBracket = null;
        this.tournamentLobby = null;
        this.tournamentResults = null;
        
        // Animation Manager
        this.animationManager = getAnimationManager();
        
        // History and Analytics
        this.historyManager = null;
        
        // Panel visibility states
        this.panelStates = {
            playerInfo: true,
            playerSetup: true,
            betting: false,
            leaderboard: false,
            debug: false,
            invite: false,
            mapSelection: false,
            assetBrowser: false,
            presetManager: false,
            previewSystem: false,
            trackEditor: false,
            analytics: false,
            tournamentBracket: false,
            tournamentLobby: false,
            tournamentResults: false
        };
        
        // Game state data
        this.gameData = {
            players: [],
            currentUser: null,
            roomCode: null,
            raceResults: [],
            leaderboard: [],
            bettingPhase: false,
            raceTimer: 0
        };
        
        console.log('[UIManager] UI Manager initialized');
    }

    /**
     * Initialize UI system and create all panels
     */
    async initialize() {
        try {
            // Create UI container elements
            this.createUIContainers();
            
            // Initialize history manager first
            this.historyManager = new HistoryManager();
            
            // Initialize components
            this.inviteModal = new InviteModal(this);
            this.bettingPanel = new BettingPanel(this);
            this.leaderboardPanel = new LeaderboardPanel(this);
            this.mapSelectionPanel = new MapSelectionPanel(this);
            this.playerSetupPanel = new PlayerSetupPanel(this);
            this.debugPanel = new DebugPanel(this);
            this.assetBrowser = new AssetBrowser(this);
            this.presetManager = new PresetManager(this);
            this.previewSystem = new PreviewSystem(this);
            this.trackEditor = new TrackEditor(this);
            this.analyticsPanel = new AnalyticsPanel(this, this.historyManager);
            this.tournamentBracket = new TournamentBracket(this);
            this.tournamentLobby = new TournamentLobby(this);
            this.tournamentResults = new TournamentResults(this);
            
            // Make debug panel globally accessible for debugging utilities
            if (typeof window !== 'undefined') {
                window.debugPanel = this.debugPanel;
                window.assetBrowser = this.assetBrowser;
                window.presetManager = this.presetManager;
                window.previewSystem = this.previewSystem;
                window.trackEditor = this.trackEditor;
                window.analyticsPanel = this.analyticsPanel;
                window.tournamentBracket = this.tournamentBracket;
                window.tournamentLobby = this.tournamentLobby;
                window.tournamentResults = this.tournamentResults;
                window.historyManager = this.historyManager;
            }
            
            // Setup event listeners
            this.setupEventListeners();
            this.setupMultiplayerEvents();
            this.setupMapSelectionEvents();
            
            // Initialize panels
            await this.initializeAllPanels();
            
            // Setup keyboard shortcuts
            this.setupKeyboardShortcuts();
            
            this.isInitialized = true;
            console.log('[UIManager] UI system initialized successfully');
            
        } catch (error) {
            console.error('[UIManager] Failed to initialize UI system:', error);
            throw error;
        }
    }

    /**
     * Create main UI container elements in the DOM
     */
    createUIContainers() {
        const gameContainer = document.getElementById('game-container');
        if (!gameContainer) {
            throw new Error('Game container not found');
        }

        // Main UI overlay
        const uiOverlay = document.createElement('div');
        uiOverlay.id = 'ui-overlay';
        uiOverlay.className = 'ui-overlay';
        gameContainer.appendChild(uiOverlay);

        // Player info panel (top-left)
        const playerInfoPanel = document.createElement('div');
        playerInfoPanel.id = 'player-info-panel';
        playerInfoPanel.className = 'ui-panel player-info';
        uiOverlay.appendChild(playerInfoPanel);

        // Player setup panel (top-right)
        const playerSetupPanel = document.createElement('div');
        playerSetupPanel.id = 'player-setup-panel';
        playerSetupPanel.className = 'ui-panel player-setup';
        uiOverlay.appendChild(playerSetupPanel);

        // Betting panel (bottom-center)
        const bettingPanelDiv = document.createElement('div');
        bettingPanelDiv.id = 'betting-panel';
        bettingPanelDiv.className = 'ui-panel betting-panel hidden';
        uiOverlay.appendChild(bettingPanelDiv);

        // Leaderboard panel (bottom-right)
        const leaderboardPanelDiv = document.createElement('div');
        leaderboardPanelDiv.id = 'leaderboard-panel';
        leaderboardPanelDiv.className = 'ui-panel leaderboard-panel';
        uiOverlay.appendChild(leaderboardPanelDiv);

        // Debug panel (bottom-left)
        const debugPanel = document.createElement('div');
        debugPanel.id = 'debug-panel';
        debugPanel.className = 'ui-panel debug-panel hidden';
        uiOverlay.appendChild(debugPanel);

        // Invite modal container
        const inviteModalDiv = document.createElement('div');
        inviteModalDiv.id = 'invite-modal';
        inviteModalDiv.className = 'modal-overlay hidden';
        uiOverlay.appendChild(inviteModalDiv);

        // Map selection panel container
        const mapSelectionPanelDiv = document.createElement('div');
        mapSelectionPanelDiv.id = 'map-selection-panel';
        mapSelectionPanelDiv.className = 'modal-overlay hidden';
        uiOverlay.appendChild(mapSelectionPanelDiv);

        // Asset browser panel (center)
        const assetBrowserPanel = document.createElement('div');
        assetBrowserPanel.id = 'asset-browser-panel';
        assetBrowserPanel.className = 'ui-panel asset-browser hidden';
        uiOverlay.appendChild(assetBrowserPanel);

        // Preset manager panel (center)
        const presetManagerPanel = document.createElement('div');
        presetManagerPanel.id = 'preset-manager-panel';
        presetManagerPanel.className = 'ui-panel preset-manager hidden';
        uiOverlay.appendChild(presetManagerPanel);

        // Preview system panel (right side)
        const previewPanel = document.createElement('div');
        previewPanel.id = 'preview-panel';
        previewPanel.className = 'ui-panel preview-panel hidden';
        uiOverlay.appendChild(previewPanel);

        // Track editor panel (fullscreen overlay)
        const trackEditorPanel = document.createElement('div');
        trackEditorPanel.id = 'track-editor-panel';
        trackEditorPanel.className = 'modal-overlay track-editor hidden';
        uiOverlay.appendChild(trackEditorPanel);

        // Analytics panel (right side overlay)
        const analyticsPanel = document.createElement('div');
        analyticsPanel.id = 'analytics-panel';
        analyticsPanel.className = 'ui-panel analytics-panel hidden';
        uiOverlay.appendChild(analyticsPanel);

        // Tournament bracket panel (fullscreen overlay)
        const tournamentBracketPanel = document.createElement('div');
        tournamentBracketPanel.id = 'tournament-bracket-panel';
        tournamentBracketPanel.className = 'modal-overlay tournament-bracket hidden';
        uiOverlay.appendChild(tournamentBracketPanel);

        // Tournament lobby panel (fullscreen overlay)
        const tournamentLobbyPanel = document.createElement('div');
        tournamentLobbyPanel.id = 'tournament-lobby-panel';
        tournamentLobbyPanel.className = 'modal-overlay tournament-lobby hidden';
        uiOverlay.appendChild(tournamentLobbyPanel);

        // Tournament results panel (fullscreen overlay)
        const tournamentResultsPanel = document.createElement('div');
        tournamentResultsPanel.id = 'tournament-results-panel';
        tournamentResultsPanel.className = 'modal-overlay tournament-results hidden';
        uiOverlay.appendChild(tournamentResultsPanel);

        // Race timer display (top-center)
        const raceTimer = document.createElement('div');
        raceTimer.id = 'race-timer';
        raceTimer.className = 'race-timer hidden';
        uiOverlay.appendChild(raceTimer);

        console.log('[UIManager] UI containers created');
    }

    /**
     * Initialize all UI panels
     */
    async initializeAllPanels() {
        // Initialize player info panel
        this.updatePlayerInfoPanel();
        
        // Initialize other panels
        await this.inviteModal.initialize();
        await this.bettingPanel.initialize();
        await this.leaderboardPanel.initialize();
        await this.mapSelectionPanel.initialize();
        await this.playerSetupPanel.initialize();
        await this.debugPanel.initialize();
        await this.assetBrowser.initialize();
        await this.presetManager.initialize();
        await this.previewSystem.initialize();
        await this.trackEditor.initialize();
        await this.analyticsPanel.initialize();
        await this.tournamentBracket.initialize();
        await this.tournamentLobby.initialize();
        await this.tournamentResults.initialize();
        
        console.log('[UIManager] All panels initialized');
    }

    /**
     * Setup general event listeners
     */
    setupEventListeners() {
        // Window resize handler
        window.addEventListener('resize', () => this.handleResize());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => this.handleKeyDown(event));
        
        // Panel toggle buttons
        this.setupPanelToggleButtons();
    }

    /**
     * Setup multiplayer event listeners
     */
    setupMultiplayerEvents() {
        multiplayerEvents.on(MULTIPLAYER_EVENTS.ROOM_CREATED, (data) => {
            this.handleRoomCreated(data);
        });
        
        multiplayerEvents.on(MULTIPLAYER_EVENTS.PLAYER_JOINED, (data) => {
            this.handlePlayerJoined(data);
        });
        
        multiplayerEvents.on(MULTIPLAYER_EVENTS.PLAYER_LEFT, (data) => {
            this.handlePlayerLeft(data);
        });
        
        multiplayerEvents.on(MULTIPLAYER_EVENTS.GAME_STARTED, (data) => {
            this.handleGameStarted(data);
        });
        
        multiplayerEvents.on(MULTIPLAYER_EVENTS.RACE_FINISHED, (data) => {
            this.handleRaceFinished(data);
        });
    }

    /**
     * Setup map selection event listeners
     */
    setupMapSelectionEvents() {
        // Listen for map change events from the map selection panel
        if (this.mapSelectionPanel) {
            // Set up custom event listener on UIManager to handle map changes
            this.emit = (eventName, data) => {
                if (eventName === 'mapChanged') {
                    this.onMapChanged(data);
                }
            };
        }
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        const shortcuts = {
            'KeyI': () => this.togglePanel('invite'),
            'KeyB': () => this.togglePanel('betting'),
            'KeyL': () => this.togglePanel('leaderboard'),
            'KeyP': () => this.togglePanel('playerSetup'),
            'KeyD': () => this.togglePanel('debug'),
            'KeyM': () => this.togglePanel('mapSelection'),
            'KeyA': () => this.togglePanel('assetBrowser'),
            'KeyR': () => this.togglePanel('presetManager'),
            'KeyV': () => this.togglePanel('previewSystem'),
            'KeyE': () => this.togglePanel('trackEditor'),
            'KeyY': () => this.togglePanel('analytics'),
            'KeyT': () => this.togglePanel('tournamentLobby'),
            'KeyG': () => this.togglePanel('tournamentBracket'),
            'KeyU': () => this.togglePanel('tournamentResults'),
            'Escape': () => this.closeAllModals()
        };

        document.addEventListener('keydown', (event) => {
            if (event.repeat) return;
            
            const shortcut = shortcuts[event.code];
            if (shortcut && !this.isInputFocused()) {
                event.preventDefault();
                shortcut();
            }
        });
    }

    /**
     * Setup panel toggle buttons
     */
    setupPanelToggleButtons() {
        // Create toggle buttons container
        const toggleContainer = document.createElement('div');
        toggleContainer.id = 'panel-toggles';
        toggleContainer.className = 'panel-toggles';
        
        const buttons = [
            { id: 'invite-btn', text: 'INVITE (I)', panel: 'invite' },
            { id: 'player-setup-btn', text: 'PLAYER (P)', panel: 'playerSetup' },
            { id: 'betting-btn', text: 'BETTING (B)', panel: 'betting' },
            { id: 'leaderboard-btn', text: 'LEADERBOARD (L)', panel: 'leaderboard' },
            { id: 'map-selection-btn', text: 'MAPS (M)', panel: 'mapSelection' },
            { id: 'asset-browser-btn', text: 'ASSETS (A)', panel: 'assetBrowser' },
            { id: 'preset-manager-btn', text: 'PRESETS (R)', panel: 'presetManager' },
            { id: 'preview-system-btn', text: 'PREVIEW (V)', panel: 'previewSystem' },
            { id: 'track-editor-btn', text: 'TRACK EDITOR (E)', panel: 'trackEditor' },
            { id: 'analytics-btn', text: 'ANALYTICS (Y)', panel: 'analytics' },
            { id: 'tournament-lobby-btn', text: 'TOURNAMENTS (T)', panel: 'tournamentLobby' },
            { id: 'tournament-bracket-btn', text: 'BRACKET (G)', panel: 'tournamentBracket' },
            { id: 'tournament-results-btn', text: 'RESULTS (U)', panel: 'tournamentResults' },
            { id: 'debug-btn', text: 'DEBUG (D)', panel: 'debug' }
        ];
        
        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.id = btn.id;
            button.className = 'toggle-btn';
            button.textContent = btn.text;
            button.addEventListener('click', () => this.togglePanel(btn.panel));
            toggleContainer.appendChild(button);
        });
        
        document.getElementById('ui-overlay').appendChild(toggleContainer);
    }

    /**
     * Toggle panel visibility with animations
     */
    async togglePanel(panelName) {
        if (!this.isInitialized) return;
        
        const wasVisible = this.panelStates[panelName];
        this.panelStates[panelName] = !this.panelStates[panelName];
        
        // Determine animation preset based on panel type
        const getAnimationPreset = (panel, isShowing) => {
            const modalPanels = ['invite', 'mapSelection', 'trackEditor', 'tournamentBracket', 'tournamentLobby', 'tournamentResults'];
            const sidePanels = ['playerSetup', 'leaderboard', 'analytics'];
            const bottomPanels = ['betting', 'debug'];
            
            if (modalPanels.includes(panel)) {
                return isShowing ? 'zoomIn' : 'zoomOut';
            } else if (sidePanels.includes(panel)) {
                return isShowing ? 'slideInRight' : 'slideOutRight';
            } else if (bottomPanels.includes(panel)) {
                return isShowing ? 'slideInBottom' : 'slideOutBottom';
            }
            return isShowing ? 'fadeIn' : 'fadeOut';
        };
        
        const animationPreset = getAnimationPreset(panelName, !wasVisible);
        
        switch (panelName) {
            case 'invite':
                await this.animatePanel(this.inviteModal, animationPreset);
                this.inviteModal.toggle();
                break;
            case 'playerSetup':
                await this.animatePanel(this.playerSetupPanel, animationPreset);
                this.playerSetupPanel.toggle();
                break;
            case 'betting':
                await this.animatePanel(this.bettingPanel, animationPreset);
                this.bettingPanel.toggle();
                break;
            case 'leaderboard':
                await this.animatePanel(this.leaderboardPanel, animationPreset);
                this.leaderboardPanel.toggle();
                break;
            case 'mapSelection':
                await this.animatePanel(this.mapSelectionPanel, animationPreset);
                this.mapSelectionPanel.toggle();
                break;
            case 'debug':
                await this.animatePanel(this.debugPanel, animationPreset);
                this.debugPanel.toggle();
                break;
            case 'assetBrowser':
                await this.animatePanel(this.assetBrowser, animationPreset);
                this.assetBrowser.toggle();
                break;
            case 'presetManager':
                await this.animatePanel(this.presetManager, animationPreset);
                this.presetManager.toggle();
                break;
            case 'previewSystem':
                await this.animatePanel(this.previewSystem, animationPreset);
                this.previewSystem.toggle();
                break;
            case 'trackEditor':
                await this.animatePanel(this.trackEditor, animationPreset);
                this.trackEditor.toggle();
                break;
            case 'analytics':
                await this.animatePanel(this.analyticsPanel, animationPreset);
                this.analyticsPanel.toggle();
                break;
            case 'tournamentBracket':
                await this.animatePanel(this.tournamentBracket, animationPreset);
                this.tournamentBracket.toggle();
                break;
            case 'tournamentLobby':
                await this.animatePanel(this.tournamentLobby, animationPreset);
                this.tournamentLobby.toggle();
                break;
            case 'tournamentResults':
                await this.animatePanel(this.tournamentResults, animationPreset);
                this.tournamentResults.toggle();
                break;
        }
        
        console.log(`[UIManager] Toggled ${panelName} panel:`, this.panelStates[panelName]);
    }
    
    /**
     * Animate a panel component
     */
    async animatePanel(panelComponent, animationPreset) {
        if (!panelComponent || !panelComponent.getElement) return;
        
        const element = panelComponent.getElement();
        if (!element) return;
        
        try {
            if (animationPreset.includes('Out')) {
                await this.animationManager.animatePreset(element, animationPreset, { duration: 300 });
            } else {
                element.style.display = 'block';
                await this.animationManager.animatePreset(element, animationPreset, { duration: 400 });
            }
        } catch (error) {
            console.warn(`[UIManager] Animation failed for panel:`, error);
        }
    }

    /**
     * Set AssetManager reference for asset browser integration
     */
    setAssetManager(assetManager) {
        if (this.assetBrowser) {
            this.assetBrowser.setAssetManager(assetManager);
            console.log('[UIManager] AssetManager connected to AssetBrowser');
        }
        // Also connect to PreviewSystem for live asset updates
        if (this.previewSystem) {
            this.previewSystem.assetManager = assetManager;
            console.log('[UIManager] AssetManager connected to PreviewSystem');
        }
    }

    /**
     * Set ConfigManager reference for preview system integration
     */
    setConfigManager(configManager) {
        if (this.previewSystem) {
            this.previewSystem.configManager = configManager;
            console.log('[UIManager] ConfigManager connected to PreviewSystem');
        }
    }

    /**
     * Set GameEngine reference for preview system integration
     */
    setGameEngine(gameEngine) {
        if (this.previewSystem) {
            this.previewSystem.gameEngine = gameEngine;
            console.log('[UIManager] GameEngine connected to PreviewSystem');
        }
    }

    /**
     * Show specific panel
     */
    showPanel(panelName) {
        if (!this.panelStates[panelName]) {
            this.togglePanel(panelName);
        }
    }

    /**
     * Hide specific panel
     */
    hidePanel(panelName) {
        if (this.panelStates[panelName]) {
            this.togglePanel(panelName);
        }
    }

    /**
     * Close all modal panels
     */
    closeAllModals() {
        this.inviteModal.hide();
        this.mapSelectionPanel.hide();
        this.assetBrowser.hide();
        this.presetManager.hide();
        this.previewSystem.hide();
        this.trackEditor.hide();
        this.tournamentBracket.hide();
        this.tournamentLobby.hide();
        this.tournamentResults.hide();
        this.panelStates.invite = false;
        this.panelStates.mapSelection = false;
        this.panelStates.assetBrowser = false;
        this.panelStates.presetManager = false;
        this.panelStates.previewSystem = false;
        this.panelStates.trackEditor = false;
        this.panelStates.tournamentBracket = false;
        this.panelStates.tournamentLobby = false;
        this.panelStates.tournamentResults = false;
    }

    /**
     * Update player info panel
     */
    updatePlayerInfoPanel() {
        const panel = document.getElementById('player-info-panel');
        if (!panel) return;
        
        const user = this.gameData.currentUser || { username: 'Guest', id: 'guest' };
        const roomCode = this.gameData.roomCode || 'No Room';
        const playerCount = this.gameData.players.length;
        
        panel.innerHTML = `
            <div class="panel-header">PLAYER INFO</div>
            <div class="player-details">
                <div class="detail-row">
                    <span class="label">Player:</span>
                    <span class="value">${user.username}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Room:</span>
                    <span class="value">${roomCode}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Players:</span>
                    <span class="value">${playerCount}/6</span>
                </div>
                <div class="detail-row">
                    <span class="label">Status:</span>
                    <span class="value status-${this.currentGameState}">${this.currentGameState.toUpperCase()}</span>
                </div>
            </div>
        `;
    }



    /**
     * Handle room created event
     */
    handleRoomCreated(data) {
        this.gameData.roomCode = data.roomCode || data.roomId;
        this.currentGameState = 'lobby';
        this.updatePlayerInfoPanel();
        this.showPanel('invite');
    }

    /**
     * Handle player joined event
     */
    handlePlayerJoined(data) {
        if (!this.gameData.players.find(p => p.id === data.playerId)) {
            this.gameData.players.push(data);
        }
        this.updatePlayerInfoPanel();
        this.leaderboardPanel.updatePlayerList(this.gameData.players);
    }

    /**
     * Handle player left event
     */
    handlePlayerLeft(data) {
        this.gameData.players = this.gameData.players.filter(p => p.id !== data.playerId);
        this.updatePlayerInfoPanel();
        this.leaderboardPanel.updatePlayerList(this.gameData.players);
    }

    /**
     * Handle game started event
     */
    handleGameStarted(data) {
        this.currentGameState = 'betting';
        this.gameData.bettingPhase = true;
        this.updatePlayerInfoPanel();
        this.showPanel('betting');
        this.bettingPanel.startBettingPhase(data);
    }

    /**
     * Handle race finished event
     */
    handleRaceFinished(data) {
        this.currentGameState = 'finished';
        this.gameData.bettingPhase = false;
        this.gameData.raceResults = data.results || [];
        this.updatePlayerInfoPanel();
        this.hidePanel('betting');
        this.showPanel('leaderboard');
        this.leaderboardPanel.updateResults(data.results);
    }

    /**
     * Handle window resize
     */
    handleResize() {
        // Update panel positions and sizes if needed
        console.log('[UIManager] Window resized');
    }

    /**
     * Handle key down events
     */
    handleKeyDown(event) {
        // Global key handlers can be added here
    }

    /**
     * Check if an input element is currently focused
     */
    isInputFocused() {
        const activeElement = document.activeElement;
        return activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.contentEditable === 'true'
        );
    }

    /**
     * Update game state data
     */
    updateGameData(newData) {
        this.gameData = { ...this.gameData, ...newData };
        this.updatePlayerInfoPanel();
    }

    /**
     * Set current user
     */
    setCurrentUser(userData) {
        this.gameData.currentUser = userData;
        this.updatePlayerInfoPanel();
    }

    /**
     * Show race timer
     */
    showRaceTimer(timeRemaining) {
        const timer = document.getElementById('race-timer');
        if (timer) {
            timer.classList.remove('hidden');
            timer.textContent = `TIME: ${Math.ceil(timeRemaining / 1000)}s`;
        }
    }

    /**
     * Hide race timer
     */
    hideRaceTimer() {
        const timer = document.getElementById('race-timer');
        if (timer) {
            timer.classList.add('hidden');
        }
    }

    /**
     * Show map selection panel
     */
    showMapSelection() {
        this.showPanel('mapSelection');
    }

    /**
     * Handle map change event from map selection panel
     */
    onMapChanged(mapData) {
        // Emit event to game engine to regenerate track
        if (this.game && this.game.events) {
            this.game.events.emit('mapChanged', mapData);
        }
        console.log('[UIManager] Map changed to:', mapData.newMap);
    }

    /**
     * Update map selection panel with race statistics
     */
    updateMapSelectionStats(raceData) {
        if (this.mapSelectionPanel) {
            this.mapSelectionPanel.updateRaceStats(raceData);
        }
    }

    /**
     * Handle race completion for map rotation
     */
    onRaceCompleted(raceData = null) {
        if (this.mapSelectionPanel) {
            this.mapSelectionPanel.onRaceCompleted();
        }
        
        // Record race data in history manager
        if (raceData && this.historyManager) {
            try {
                const raceId = this.historyManager.recordRace(raceData);
                console.log(`[UIManager] Race recorded in history: ${raceId}`);
                
                // Update analytics panel if visible
                if (this.analyticsPanel && this.analyticsPanel.isVisible) {
                    this.analyticsPanel.refreshAnalytics();
                }
            } catch (error) {
                console.error('[UIManager] Failed to record race data:', error);
            }
        }
        
        // Reset player setup for new race
        if (this.playerSetupPanel) {
            this.playerSetupPanel.resetForNewRace();
        }
    }

    /**
     * Record betting data in history manager
     */
    recordBet(betData) {
        if (this.historyManager) {
            try {
                const betId = this.historyManager.recordBet(betData);
                console.log(`[UIManager] Bet recorded in history: ${betId}`);
                
                // Update analytics panel if visible
                if (this.analyticsPanel && this.analyticsPanel.isVisible) {
                    this.analyticsPanel.refreshAnalytics();
                }
                
                return betId;
            } catch (error) {
                console.error('[UIManager] Failed to record bet data:', error);
                return null;
            }
        }
        return null;
    }

    /**
     * Update player setup panel with current player assignment
     */
    setCurrentPlayer(playerIndex) {
        if (this.playerSetupPanel) {
            this.playerSetupPanel.setCurrentPlayer(playerIndex);
        }
    }

    /**
     * Update map information in player setup
     */
    updatePlayerSetupMapInfo(mapName, racesLeft) {
        if (this.playerSetupPanel) {
            this.playerSetupPanel.updateMapInfo(mapName, racesLeft);
        }
    }

    /**
     * Update debug panel with current scene
     */
    setDebugScene(scene) {
        if (this.debugPanel) {
            this.debugPanel.setCurrentScene(scene);
        }
    }

    /**
     * Update debug panel with current player data
     */
    updateDebugPlayer(playerIndex, players) {
        if (this.debugPanel) {
            this.debugPanel.setCurrentPlayer(playerIndex, players);
        }
    }

    /**
     * Update debug panel with stuck positions data
     */
    updateDebugStuckPositions(stuckPositions) {
        if (this.debugPanel) {
            this.debugPanel.updateStuckPositions(stuckPositions);
        }
    }

    /**
     * Update debug panel with current map information
     */
    updateDebugMapInfo(mapName) {
        if (this.debugPanel) {
            this.debugPanel.updateMapInfo(mapName);
        }
    }

    /**
     * Get player setup state
     */
    getPlayerSetupState() {
        if (this.playerSetupPanel) {
            return this.playerSetupPanel.getPlayerSetupState();
        }
        return null;
    }

    /**
     * Show race countdown animation
     */
    async showRaceCountdown(seconds = 3) {
        const countdownDiv = document.createElement('div');
        countdownDiv.className = 'race-countdown';
        countdownDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 120px;
            font-weight: bold;
            color: #00ff00;
            text-shadow: 0 0 30px #00ff00;
            z-index: 10000;
            pointer-events: none;
        `;
        
        document.getElementById('ui-overlay').appendChild(countdownDiv);
        
        for (let i = seconds; i > 0; i--) {
            countdownDiv.textContent = i;
            countdownDiv.className = 'race-countdown countdown-number';
            await this.animationManager.animatePreset(countdownDiv, 'bounceIn', { duration: 800 });
            
            if (i > 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
                await this.animationManager.animatePreset(countdownDiv, 'zoomOut', { duration: 200 });
            }
        }
        
        // Show GO!
        countdownDiv.textContent = 'GO!';
        countdownDiv.style.color = '#ffff00';
        countdownDiv.style.textShadow = '0 0 50px #ffff00';
        await this.animationManager.animatePreset(countdownDiv, 'rubberBand', { duration: 1000 });
        await this.animationManager.animatePreset(countdownDiv, 'zoomOut', { duration: 500 });
        
        countdownDiv.remove();
    }
    
    /**
     * Show winner celebration animation
     */
    async showWinnerCelebration(winnerName) {
        const celebrationDiv = document.createElement('div');
        celebrationDiv.className = 'winner-celebration-container';
        celebrationDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            pointer-events: none;
            background: radial-gradient(circle, rgba(0,255,0,0.1) 0%, transparent 70%);
        `;
        
        const winnerText = document.createElement('div');
        winnerText.className = 'winner-text';
        winnerText.innerHTML = `
            <div class="winner-label" style="font-size: 40px; color: #ffff00; margin-bottom: 20px;">WINNER!</div>
            <div class="winner-name" style="font-size: 60px; color: #00ff00; font-weight: bold;">${winnerName}</div>
        `;
        winnerText.style.cssText = `
            text-align: center;
            text-shadow: 0 0 30px currentColor;
        `;
        
        celebrationDiv.appendChild(winnerText);
        document.getElementById('ui-overlay').appendChild(celebrationDiv);
        
        // Animate winner text
        await this.animationManager.animatePreset(winnerText, 'bounceIn', { duration: 1000 });
        
        // Create confetti effect
        this.createConfettiEffect(celebrationDiv);
        
        // Pulse animation
        await this.animationManager.animate(winnerText, {
            properties: { 
                transform: ['scale(1)', 'scale(1.2)', 'scale(1)']
            },
            duration: 2000,
            easing: 'easeInOutQuad',
            loop: true,
            loopCount: 3
        });
        
        // Fade out
        await this.animationManager.animatePreset(celebrationDiv, 'fadeOut', { duration: 1000 });
        celebrationDiv.remove();
    }
    
    /**
     * Create confetti particle effect
     */
    createConfettiEffect(container) {
        const colors = ['#00ff00', '#ffff00', '#ff00ff', '#00ffff', '#ff0000'];
        const confettiCount = 50;
        
        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti-piece';
            confetti.style.cssText = `
                position: absolute;
                width: 10px;
                height: 10px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                left: ${Math.random() * 100}%;
                top: -10px;
                opacity: 0.8;
                transform: rotate(${Math.random() * 360}deg);
                pointer-events: none;
            `;
            
            container.appendChild(confetti);
            
            // Animate confetti falling
            this.animationManager.animate(confetti, {
                properties: {
                    transform: [
                        `translateY(0) rotate(0deg)`,
                        `translateY(${window.innerHeight + 20}px) rotate(${720 + Math.random() * 360}deg)`
                    ],
                    opacity: [0.8, 0]
                },
                duration: 3000 + Math.random() * 2000,
                easing: 'linear',
                delay: Math.random() * 1000
            });
        }
    }
    
    /**
     * Show power-up collection animation
     */
    async showPowerUpCollected(powerUpName, playerElement) {
        if (!playerElement) return;
        
        const powerUpDiv = document.createElement('div');
        powerUpDiv.className = 'power-up-notification';
        powerUpDiv.textContent = `+${powerUpName}`;
        powerUpDiv.style.cssText = `
            position: absolute;
            font-size: 20px;
            font-weight: bold;
            color: #00ffff;
            text-shadow: 0 0 10px #00ffff;
            pointer-events: none;
            z-index: 5000;
        `;
        
        // Position near player
        const rect = playerElement.getBoundingClientRect();
        powerUpDiv.style.left = `${rect.left + rect.width / 2}px`;
        powerUpDiv.style.top = `${rect.top - 20}px`;
        
        document.getElementById('ui-overlay').appendChild(powerUpDiv);
        
        // Animate floating up and fading
        await this.animationManager.animate(powerUpDiv, {
            properties: {
                transform: ['translateY(0)', 'translateY(-50px)'],
                opacity: [1, 0]
            },
            duration: 1500,
            easing: 'easeOutQuad'
        });
        
        powerUpDiv.remove();
    }
    
    /**
     * Show skill activation animation
     */
    async showSkillActivation(skillName, screenEffect = true) {
        const skillDiv = document.createElement('div');
        skillDiv.className = 'skill-activation';
        skillDiv.textContent = skillName.toUpperCase();
        skillDiv.style.cssText = `
            position: fixed;
            top: 20%;
            left: 50%;
            transform: translateX(-50%);
            font-size: 48px;
            font-weight: bold;
            color: #ff00ff;
            text-shadow: 0 0 30px #ff00ff;
            z-index: 9000;
            pointer-events: none;
        `;
        
        document.getElementById('ui-overlay').appendChild(skillDiv);
        
        // Animate skill text
        await this.animationManager.animatePreset(skillDiv, 'zoomIn', { duration: 300 });
        
        // Screen effect based on skill type
        if (screenEffect) {
            await this.createScreenFlash(this.getSkillColor(skillName));
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.animationManager.animatePreset(skillDiv, 'fadeOut', { duration: 500 });
        
        skillDiv.remove();
    }
    
    /**
     * Get skill color based on name
     */
    getSkillColor(skillName) {
        const skillColors = {
            'thunder': '#ffff00',
            'fire': '#ff4500',
            'bubble': '#00bfff',
            'magnet': '#ff00ff',
            'teleport': '#00ff00'
        };
        return skillColors[skillName.toLowerCase()] || '#ffffff';
    }
    
    /**
     * Create screen flash effect
     */
    async createScreenFlash(color = '#ffffff') {
        const flashDiv = document.createElement('div');
        flashDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: ${color};
            opacity: 0;
            z-index: 8999;
            pointer-events: none;
        `;
        
        document.getElementById('ui-overlay').appendChild(flashDiv);
        
        await this.animationManager.animate(flashDiv, {
            properties: {
                opacity: [0, 0.3, 0]
            },
            duration: 300,
            easing: 'easeInOutQuad'
        });
        
        flashDiv.remove();
    }
    
    /**
     * Destroy UI system
     */
    destroy() {
        if (this.inviteModal) this.inviteModal.destroy();
        if (this.playerSetupPanel) this.playerSetupPanel.destroy();
        if (this.bettingPanel) this.bettingPanel.destroy();
        if (this.leaderboardPanel) this.leaderboardPanel.destroy();
        if (this.mapSelectionPanel) this.mapSelectionPanel.destroy();
        if (this.debugPanel) this.debugPanel.destroy();
        if (this.presetManager) this.presetManager.destroy();
        if (this.trackEditor) this.trackEditor.destroy();
        if (this.tournamentBracket) this.tournamentBracket.destroy();
        if (this.tournamentLobby) this.tournamentLobby.destroy();
        if (this.tournamentResults) this.tournamentResults.destroy();
        
        // Destroy animation manager
        if (this.animationManager) {
            this.animationManager.destroy();
        }
        
        const uiOverlay = document.getElementById('ui-overlay');
        if (uiOverlay) {
            uiOverlay.remove();
        }
        
        console.log('[UIManager] UI system destroyed');
    }
}

// Export singleton instance
let uiManagerInstance = null;

export function createUIManager(game) {
    if (!uiManagerInstance) {
        uiManagerInstance = new UIManager(game);
    }
    return uiManagerInstance;
}

export function getUIManager() {
    return uiManagerInstance;
}