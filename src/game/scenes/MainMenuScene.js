/**
 * MainMenuScene.js - Main Menu Scene for Memex Racing
 * 
 * Provides the main menu interface with Quick Play, Create Room, and Join Room options.
 * Integrates with the authentication system and displays user information.
 */

import Phaser from 'phaser';
import { AuthenticatedScene } from './AuthenticatedScene';

export class MainMenuScene extends AuthenticatedScene {
    constructor() {
        super({ key: 'MainMenuScene' });
        this.selectedOption = 0; // For keyboard navigation
        this.menuOptions = [];
        this.userInfo = null;
    }

    create() {
        // Call parent create for authentication setup
        super.create();
        
        // Set retro background
        this.cameras.main.setBackgroundColor('#001122');
        
        // Add animated background elements
        this.createAnimatedBackground();
        
        // Main title
        const title = this.add.text(960, 200, 'MEMEX RACING', {
            fontSize: '96px',
            fontFamily: 'Courier New',
            color: '#00ff00',
            fontWeight: 'bold',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);
        
        // Subtitle
        const subtitle = this.add.text(960, 280, 'MULTIPLAYER BETTING GAME', {
            fontSize: '32px',
            fontFamily: 'Courier New',
            color: '#ffff00',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        // Animate title
        this.tweens.add({
            targets: title,
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // Create menu buttons
        this.createMenuButtons();
        
        // User info panel
        this.createUserInfoPanel();
        
        // Version info
        this.add.text(50, 1030, `Version: ${process.env.VERSION || '0.1.0'}`, {
            fontSize: '16px',
            fontFamily: 'Courier New',
            color: '#666666'
        });
        
        // Instructions
        this.add.text(960, 950, 'Use ARROW KEYS to navigate, ENTER to select, ESC for settings', {
            fontSize: '18px',
            fontFamily: 'Courier New',
            color: '#888888'
        }).setOrigin(0.5);
        
        // Setup input handlers
        this.setupInputHandlers();
        
        // Play ambient music if available
        this.playAmbientMusic();
        
        // Fade in
        this.cameras.main.fadeIn(500, 0, 0, 0);
        
        // Emit event for integration
        this.events.emit('MAIN_MENU_READY');
    }

    /**
     * Create animated background elements
     */
    createAnimatedBackground() {
        // Create moving stars/particles
        for (let i = 0; i < 50; i++) {
            const star = this.add.circle(
                Phaser.Math.Between(0, 1920),
                Phaser.Math.Between(0, 1080),
                Phaser.Math.Between(1, 3),
                0xffffff,
                Phaser.Math.FloatBetween(0.3, 0.8)
            );
            
            // Animate star movement
            this.tweens.add({
                targets: star,
                x: star.x + Phaser.Math.Between(-100, 100),
                y: star.y + Phaser.Math.Between(-100, 100),
                duration: Phaser.Math.Between(3000, 8000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            
            // Animate star twinkling
            this.tweens.add({
                targets: star,
                alpha: Phaser.Math.FloatBetween(0.1, 1),
                duration: Phaser.Math.Between(1000, 3000),
                yoyo: true,
                repeat: -1
            });
        }
        
        // Add racing track elements in background
        const trackGraphics = this.add.graphics();
        trackGraphics.lineStyle(4, 0x333333, 0.3);
        
        // Draw some track-like lines
        for (let i = 0; i < 5; i++) {
            const y = 200 + i * 150;
            trackGraphics.beginPath();
            trackGraphics.moveTo(0, y);
            trackGraphics.lineTo(1920, y);
            trackGraphics.strokePath();
        }
    }

    /**
     * Create main menu buttons
     */
    createMenuButtons() {
        const buttonY = 450;
        const buttonSpacing = 120;
        
        // Quick Play button
        const quickPlayButton = this.createMenuButton(960, buttonY, 'QUICK PLAY', 'button_green', () => {
            this.startQuickPlay();
        });
        
        // Create Room button
        const createRoomButton = this.createMenuButton(960, buttonY + buttonSpacing, 'CREATE ROOM', 'button_blue', () => {
            this.createRoom();
        });
        
        // Join Room button
        const joinRoomButton = this.createMenuButton(960, buttonY + buttonSpacing * 2, 'JOIN ROOM', 'button_blue', () => {
            this.showJoinRoomDialog();
        });
        
        // Settings button
        const settingsButton = this.createMenuButton(960, buttonY + buttonSpacing * 3, 'SETTINGS', 'button_red', () => {
            this.showSettings();
        });
        
        this.menuOptions = [quickPlayButton, createRoomButton, joinRoomButton, settingsButton];
        
        // Highlight first option
        this.highlightOption(0);
    }

    /**
     * Create a menu button
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {string} text - Button text
     * @param {string} spriteKey - Button sprite key
     * @param {Function} callback - Click callback
     * @returns {Object} Button object
     */
    createMenuButton(x, y, text, spriteKey, callback) {
        // Button background
        const button = this.add.image(x, y, spriteKey);
        button.setInteractive({ useHandCursor: true });
        button.setScale(1.5);
        
        // Button text
        const buttonText = this.add.text(x, y, text, {
            fontSize: '24px',
            fontFamily: 'Courier New',
            color: '#ffffff',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        // Hover effects
        button.on('pointerover', () => {
            button.setScale(1.6);
            buttonText.setColor('#ffff00');
            this.sound.play('ui_hover', { volume: 0.3 });
        });
        
        button.on('pointerout', () => {
            button.setScale(1.5);
            buttonText.setColor('#ffffff');
        });
        
        // Click handler
        button.on('pointerdown', () => {
            this.sound.play('ui_click', { volume: 0.5 });
            button.setScale(1.4);
            
            this.time.delayedCall(100, () => {
                button.setScale(1.5);
                callback();
            });
        });
        
        return { button, text: buttonText, callback };
    }

    /**
     * Create user info panel using AuthenticatedScene methods
     */
    createUserInfoPanel() {
        // Use AuthenticatedScene methods to get user info
        const userContext = this.getUser();
        if (userContext) {
            this.userInfo = {
                username: userContext.username,
                coins: userContext.statistics?.totalPoints || 1000,
                wins: userContext.statistics?.wins || 0,
                totalRaces: userContext.statistics?.gamesPlayed || 0
            };
            this.displayUserInfo();
        } else {
            this.displayGuestInfo();
        }
    }

    /**
     * Display authenticated user information
     */
    displayUserInfo() {
        const panelX = 1600;
        const panelY = 150;
        
        // User panel background
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x000000, 0.8);
        panelBg.fillRoundedRect(panelX - 150, panelY - 50, 300, 200, 10);
        panelBg.lineStyle(2, 0x00ff00);
        panelBg.strokeRoundedRect(panelX - 150, panelY - 50, 300, 200, 10);
        
        // User info text
        this.add.text(panelX, panelY - 20, `Welcome, ${this.userInfo.username || 'Player'}!`, {
            fontSize: '20px',
            fontFamily: 'Courier New',
            color: '#00ff00',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        this.add.text(panelX, panelY + 10, `Coins: ${this.userInfo.coins || 1000}`, {
            fontSize: '16px',
            fontFamily: 'Courier New',
            color: '#ffff00'
        }).setOrigin(0.5);
        
        this.add.text(panelX, panelY + 35, `Wins: ${this.userInfo.wins || 0}`, {
            fontSize: '16px',
            fontFamily: 'Courier New',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        this.add.text(panelX, panelY + 60, `Races: ${this.userInfo.totalRaces || 0}`, {
            fontSize: '16px',
            fontFamily: 'Courier New',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Logout button
        const logoutButton = this.add.text(panelX, panelY + 100, 'LOGOUT', {
            fontSize: '16px',
            fontFamily: 'Courier New',
            color: '#ff0000',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        logoutButton.setInteractive({ useHandCursor: true });
        logoutButton.on('pointerdown', () => {
            this.logout();
        });
    }

    /**
     * Display guest user information
     */
    displayGuestInfo() {
        const panelX = 1600;
        const panelY = 150;
        
        // Guest panel background
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x000000, 0.8);
        panelBg.fillRoundedRect(panelX - 150, panelY - 50, 300, 150, 10);
        panelBg.lineStyle(2, 0xff0000);
        panelBg.strokeRoundedRect(panelX - 150, panelY - 50, 300, 150, 10);
        
        this.add.text(panelX, panelY - 10, 'Playing as Guest', {
            fontSize: '18px',
            fontFamily: 'Courier New',
            color: '#ff0000',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        // Login button
        const loginButton = this.add.text(panelX, panelY + 30, 'LOGIN', {
            fontSize: '16px',
            fontFamily: 'Courier New',
            color: '#00ff00',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        loginButton.setInteractive({ useHandCursor: true });
        loginButton.on('pointerdown', () => {
            this.showLogin();
        });
        
        // Register button
        const registerButton = this.add.text(panelX, panelY + 60, 'REGISTER', {
            fontSize: '16px',
            fontFamily: 'Courier New',
            color: '#0000ff',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        registerButton.setInteractive({ useHandCursor: true });
        registerButton.on('pointerdown', () => {
            this.showRegister();
        });
    }

    /**
     * Setup input handlers for keyboard navigation
     */
    setupInputHandlers() {
        // Keyboard navigation
        this.input.keyboard.on('keydown-UP', () => {
            this.selectedOption = Math.max(0, this.selectedOption - 1);
            this.highlightOption(this.selectedOption);
            this.sound.play('ui_move', { volume: 0.2 });
        });
        
        this.input.keyboard.on('keydown-DOWN', () => {
            this.selectedOption = Math.min(this.menuOptions.length - 1, this.selectedOption + 1);
            this.highlightOption(this.selectedOption);
            this.sound.play('ui_move', { volume: 0.2 });
        });
        
        this.input.keyboard.on('keydown-ENTER', () => {
            this.selectOption(this.selectedOption);
        });
        
        this.input.keyboard.on('keydown-ESC', () => {
            this.showSettings();
        });
    }

    /**
     * Highlight selected menu option
     * @param {number} index - Option index
     */
    highlightOption(index) {
        this.menuOptions.forEach((option, i) => {
            if (i === index) {
                option.button.setScale(1.6);
                option.text.setColor('#ffff00');
            } else {
                option.button.setScale(1.5);
                option.text.setColor('#ffffff');
            }
        });
    }

    /**
     * Select menu option
     * @param {number} index - Option index
     */
    selectOption(index) {
        if (index >= 0 && index < this.menuOptions.length) {
            this.sound.play('ui_select', { volume: 0.5 });
            this.menuOptions[index].callback();
        }
    }

    /**
     * Start quick play mode
     */
    startQuickPlay() {
        console.log('[MainMenuScene] Starting Quick Play');
        
        // Create a single-player room
        const roomData = {
            roomId: `quick_${Date.now()}`,
            playerCount: 1,
            maxPlayers: 6,
            gameMode: 'quickplay',
            host: this.getUsername() || 'Guest'
        };
        
        // Transition to lobby with room data
        this.scene.start('LobbyScene', { roomData, isQuickPlay: true });
        
        // Emit event for multiplayer system
        this.events.emit('ROOM_CREATED', roomData);
    }

    /**
     * Create a new multiplayer room
     */
    createRoom() {
        console.log('[MainMenuScene] Creating Room');
        
        // Generate room code
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        const roomData = {
            roomId: roomCode,
            playerCount: 1,
            maxPlayers: 6,
            gameMode: 'multiplayer',
            host: this.getUsername() || 'Guest',
            created: Date.now()
        };
        
        // Transition to lobby
        this.scene.start('LobbyScene', { roomData, isHost: true });
        
        // Emit event for multiplayer system
        this.events.emit('ROOM_CREATED', roomData);
    }

    /**
     * Show join room dialog
     */
    showJoinRoomDialog() {
        console.log('[MainMenuScene] Showing Join Room Dialog');
        
        // Create modal background
        const modal = this.add.graphics();
        modal.fillStyle(0x000000, 0.8);
        modal.fillRect(0, 0, 1920, 1080);
        
        // Dialog box
        const dialogBg = this.add.graphics();
        dialogBg.fillStyle(0x000000, 0.9);
        dialogBg.fillRoundedRect(660, 390, 600, 300, 20);
        dialogBg.lineStyle(4, 0x00ff00);
        dialogBg.strokeRoundedRect(660, 390, 600, 300, 20);
        
        // Dialog title
        this.add.text(960, 450, 'JOIN ROOM', {
            fontSize: '32px',
            fontFamily: 'Courier New',
            color: '#00ff00',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        // Input field simulation (HTML input would be created in real implementation)
        const inputBg = this.add.graphics();
        inputBg.fillStyle(0x333333);
        inputBg.fillRoundedRect(760, 500, 400, 50, 8);
        inputBg.lineStyle(2, 0xffffff);
        inputBg.strokeRoundedRect(760, 500, 400, 50, 8);
        
        const inputText = this.add.text(960, 525, 'Enter Room Code...', {
            fontSize: '20px',
            fontFamily: 'Courier New',
            color: '#888888'
        }).setOrigin(0.5);
        
        // Buttons
        const joinButton = this.createMenuButton(860, 600, 'JOIN', 'button_green', () => {
            // In real implementation, get room code from input
            const roomCode = 'DEMO123';
            this.joinRoom(roomCode);
            this.closeDialog([modal, dialogBg, inputBg, inputText]);
        });
        
        const cancelButton = this.createMenuButton(1060, 600, 'CANCEL', 'button_red', () => {
            this.closeDialog([modal, dialogBg, inputBg, inputText]);
        });
        
        // Close dialog elements
        joinButton.elements = [modal, dialogBg, inputBg, inputText, joinButton.button, joinButton.text, cancelButton.button, cancelButton.text];
        cancelButton.elements = joinButton.elements;
    }

    /**
     * Join an existing room
     * @param {string} roomCode - Room code to join
     */
    joinRoom(roomCode) {
        console.log(`[MainMenuScene] Joining Room: ${roomCode}`);
        
        // In real implementation, validate room exists
        const roomData = {
            roomId: roomCode,
            playerCount: 2, // Example
            maxPlayers: 6,
            gameMode: 'multiplayer',
            host: 'SomePlayer'
        };
        
        // Transition to lobby
        this.scene.start('LobbyScene', { roomData, isHost: false });
        
        // Emit event for multiplayer system
        this.events.emit('PLAYER_JOINED', { roomId: roomCode, player: this.getUsername() || 'Guest' });
    }

    /**
     * Show settings menu
     */
    showSettings() {
        console.log('[MainMenuScene] Showing Settings');
        // In real implementation, create settings overlay
        // For now, just log
    }

    /**
     * Show login interface
     */
    showLogin() {
        console.log('[MainMenuScene] Showing Login');
        // Redirect to login page
        window.location.href = 'login.html';
    }

    /**
     * Show register interface
     */
    showRegister() {
        console.log('[MainMenuScene] Showing Register');
        // Redirect to login page with register tab
        window.location.href = 'login.html';
    }

    /**
     * Logout current user using AuthenticatedScene method
     */
    logout() {
        console.log('[MainMenuScene] Logging out');
        // Use AuthenticatedScene method to request logout
        this.requestLogout();
        // Refresh scene to show guest info
        this.scene.restart();
    }

    /**
     * Handle authentication context ready (override from AuthenticatedScene)
     */
    onAuthContextReady(userContext, isAuthenticated) {
        console.log('[MainMenuScene] Auth context ready:', { isAuthenticated, username: userContext?.username });
        // Refresh user info panel when auth context is ready
        this.refreshUserInfoPanel();
    }
    
    /**
     * Handle user context updates (override from AuthenticatedScene)
     */
    onUserContextUpdate(userData) {
        console.log('[MainMenuScene] User context updated:', userData?.username);
        // Refresh user info panel when user data changes
        this.refreshUserInfoPanel();
    }
    
    /**
     * Handle auth state changes (override from AuthenticatedScene)
     */
    onAuthStateChange(stateChange) {
        console.log('[MainMenuScene] Auth state changed:', stateChange.type);
        if (stateChange.type === 'logout' || stateChange.type === 'session_expired') {
            // Refresh scene to show guest info
            this.time.delayedCall(100, () => {
                this.scene.restart();
            });
        }
    }
    
    /**
     * Refresh user info panel
     */
    refreshUserInfoPanel() {
        // This would typically clear and recreate the user info panel
        // For now, just trigger a scene restart to refresh everything
        this.time.delayedCall(100, () => {
            this.scene.restart();
        });
    }

    /**
     * Play ambient music
     */
    playAmbientMusic() {
        if (this.sound.get('menu_music')) {
            this.sound.play('menu_music', { loop: true, volume: 0.3 });
        }
    }

    /**
     * Close dialog elements
     * @param {Array} elements - Elements to destroy
     */
    closeDialog(elements) {
        elements.forEach(element => {
            if (element && element.destroy) {
                element.destroy();
            }
        });
    }

    /**
     * Scene cleanup (enhanced with AuthenticatedScene cleanup)
     */
    destroy() {
        // Stop any playing sounds
        this.sound.stopAll();
        // Call parent destroy for auth cleanup
        super.destroy();
    }
}