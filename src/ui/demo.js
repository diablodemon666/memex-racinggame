/**
 * UI Demo - Test and demonstration of UI components
 * 
 * This file provides a demo/test interface for the UI system
 * Can be used for development and testing purposes
 */

import { createUIManager } from './UIManager';
import { UIUtils } from './index';

export class UIDemo {
    constructor() {
        this.uiManager = null;
        this.demoData = {
            players: [
                {
                    id: 'demo-1',
                    name: 'SpeedRacer',
                    username: 'SpeedRacer',
                    wins: 15,
                    races: 25,
                    winRate: 60,
                    avatar: '🏎️'
                },
                {
                    id: 'demo-2',
                    name: 'FastTrack',
                    username: 'FastTrack',
                    wins: 8,
                    races: 20,
                    winRate: 40,
                    avatar: '🏁'
                },
                {
                    id: 'demo-3',
                    name: 'TurboBoost',
                    username: 'TurboBoost',
                    wins: 22,
                    races: 30,
                    winRate: 73,
                    avatar: '⚡'
                },
                {
                    id: 'demo-4',
                    name: 'NitroKing',
                    username: 'NitroKing',
                    wins: 5,
                    races: 15,
                    winRate: 33,
                    avatar: '👑'
                }
            ],
            raceResults: [
                { playerId: 'demo-3', name: 'TurboBoost', time: 125.6, position: 1 },
                { playerId: 'demo-1', name: 'SpeedRacer', time: 128.2, position: 2 },
                { playerId: 'demo-2', name: 'FastTrack', time: 132.1, position: 3 },
                { playerId: 'demo-4', name: 'NitroKing', time: 145.8, position: 4 }
            ]
        };
    }

    /**
     * Initialize UI demo
     */
    async initialize() {
        // Create a mock game object for testing
        const mockGame = {
            scene: {
                getScene: () => null,
                getScenes: () => [],
                start: () => {}
            },
            loop: {
                actualFps: 60
            }
        };

        // Initialize UI Manager
        this.uiManager = createUIManager(mockGame);
        await this.uiManager.initialize();

        // Setup demo data
        this.setupDemoData();
        
        // Setup demo controls
        this.setupDemoControls();

        console.log('[UIDemo] Demo initialized successfully');
        return this.uiManager;
    }

    /**
     * Setup demo data in UI
     */
    setupDemoData() {
        // Set demo user
        this.uiManager.setCurrentUser({
            id: 'demo-user',
            username: 'DemoPlayer',
            name: 'Demo Player'
        });

        // Set demo room code
        this.uiManager.updateGameData({
            roomCode: UIUtils.generateRoomCode(),
            players: this.demoData.players
        });

        // Update leaderboard with demo players
        this.uiManager.leaderboardPanel.updatePlayerList(this.demoData.players);
    }

    /**
     * Setup demo controls
     */
    setupDemoControls() {
        // Create demo control panel
        const demoControls = document.createElement('div');
        demoControls.id = 'demo-controls';
        demoControls.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            border: 2px solid #00ff00;
            border-radius: 8px;
            padding: 15px;
            z-index: 3000;
            font-family: 'Courier New', monospace;
            color: #00ff00;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        `;

        // Demo buttons
        const buttons = [
            { text: 'Start Betting', action: () => this.demoBettingPhase() },
            { text: 'Show Invite', action: () => this.demoInviteModal() },
            { text: 'Update Leaderboard', action: () => this.demoLeaderboardUpdate() },
            { text: 'Simulate Race', action: () => this.demoRaceResults() },
            { text: 'Show All Panels', action: () => this.showAllPanels() },
            { text: 'Hide All Panels', action: () => this.hideAllPanels() },
            { text: 'Test Notifications', action: () => this.testNotifications() }
        ];

        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.textContent = btn.text;
            button.style.cssText = `
                background: #00ff00;
                color: #000;
                border: none;
                border-radius: 4px;
                padding: 8px 12px;
                font-family: inherit;
                font-weight: bold;
                cursor: pointer;
                font-size: 12px;
                transition: background 0.2s ease;
            `;
            button.onmouseover = () => button.style.background = '#00cc00';
            button.onmouseout = () => button.style.background = '#00ff00';
            button.onclick = btn.action;
            demoControls.appendChild(button);
        });

        document.body.appendChild(demoControls);
    }

    /**
     * Demo betting phase
     */
    demoBettingPhase() {
        const gameData = {
            players: this.demoData.players,
            bettingTime: 30
        };
        
        this.uiManager.bettingPanel.startBettingPhase(gameData);
        console.log('[UIDemo] Started betting phase demo');
    }

    /**
     * Demo invite modal
     */
    demoInviteModal() {
        const roomCode = UIUtils.generateRoomCode();
        this.uiManager.inviteModal.show(roomCode);
        console.log('[UIDemo] Showed invite modal with room code:', roomCode);
    }

    /**
     * Demo leaderboard update
     */
    demoLeaderboardUpdate() {
        // Add some random wins to players
        this.demoData.players.forEach(player => {
            if (Math.random() > 0.5) {
                player.wins += 1;
                player.races += 1;
                player.winRate = Math.round((player.wins / player.races) * 100);
                player.score = (player.score || 0) + 100;
            }
        });

        this.uiManager.leaderboardPanel.updatePlayerList(this.demoData.players);
        console.log('[UIDemo] Updated leaderboard with new data');
    }

    /**
     * Demo race results
     */
    demoRaceResults() {
        // Shuffle results for demo
        const shuffledResults = [...this.demoData.raceResults].sort(() => Math.random() - 0.5);
        shuffledResults.forEach((result, index) => {
            result.position = index + 1;
        });

        this.uiManager.handleRaceFinished({ results: shuffledResults });
        this.uiManager.leaderboardPanel.updateResults(shuffledResults);
        
        console.log('[UIDemo] Simulated race results:', shuffledResults);
    }

    /**
     * Show all panels
     */
    showAllPanels() {
        this.uiManager.showPanel('betting');
        this.uiManager.showPanel('leaderboard');
        this.uiManager.showPanel('debug');
        this.uiManager.showPanel('invite');
        console.log('[UIDemo] Showed all panels');
    }

    /**
     * Hide all panels
     */
    hideAllPanels() {
        this.uiManager.hidePanel('betting');
        this.uiManager.hidePanel('leaderboard');
        this.uiManager.hidePanel('debug');
        this.uiManager.hidePanel('invite');
        console.log('[UIDemo] Hid all panels');
    }

    /**
     * Test notifications
     */
    testNotifications() {
        const notifications = [
            { message: 'Success notification test!', type: 'success' },
            { message: 'Error notification test!', type: 'error' },
            { message: 'Info notification test!', type: 'info' },
            { message: 'Default notification test!' }
        ];

        notifications.forEach((notif, index) => {
            setTimeout(() => {
                if (this.uiManager.bettingPanel) {
                    this.uiManager.bettingPanel.showNotification(notif.message, notif.type);
                }
                if (this.uiManager.leaderboardPanel) {
                    this.uiManager.leaderboardPanel.showNotification(notif.message, notif.type);
                }
                if (this.uiManager.inviteModal) {
                    this.uiManager.inviteModal.showNotification(notif.message, notif.type);
                }
            }, index * 1000);
        });

        console.log('[UIDemo] Testing notifications');
    }

    /**
     * Start automated demo cycle
     */
    startAutoDemoMode() {
        console.log('[UIDemo] Starting automated demo mode');
        
        let step = 0;
        const steps = [
            () => this.demoInviteModal(),
            () => this.demoBettingPhase(),
            () => this.demoLeaderboardUpdate(),
            () => this.demoRaceResults(),
            () => this.testNotifications()
        ];

        const interval = setInterval(() => {
            if (step >= steps.length) {
                step = 0;
            }
            
            steps[step]();
            step++;
        }, 10000); // Every 10 seconds

        // Stop after 2 minutes
        setTimeout(() => {
            clearInterval(interval);
            console.log('[UIDemo] Automated demo mode stopped');
        }, 120000);

        return interval;
    }

    /**
     * Get demo statistics
     */
    getStats() {
        return {
            isInitialized: !!this.uiManager,
            panelStates: this.uiManager ? this.uiManager.panelStates : null,
            gameData: this.uiManager ? this.uiManager.gameData : null,
            demoPlayers: this.demoData.players.length,
            demoResults: this.demoData.raceResults.length
        };
    }

    /**
     * Cleanup demo
     */
    destroy() {
        // Remove demo controls
        const demoControls = document.getElementById('demo-controls');
        if (demoControls) {
            demoControls.remove();
        }

        // Destroy UI manager
        if (this.uiManager) {
            this.uiManager.destroy();
        }

        console.log('[UIDemo] Demo destroyed');
    }
}

// Make demo available globally in development
if (process.env.NODE_ENV === 'development') {
    window.UIDemo = UIDemo;
    
    // Auto-initialize demo if requested
    if (window.location.search.includes('demo=ui')) {
        const demo = new UIDemo();
        demo.initialize().then(() => {
            window.uiDemo = demo;
            console.log('[UIDemo] Auto-initialized! Available at window.uiDemo');
            
            // Start auto demo mode if requested
            if (window.location.search.includes('auto=true')) {
                demo.startAutoDemoMode();
            }
        });
    }
}

export default UIDemo;