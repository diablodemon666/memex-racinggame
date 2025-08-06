/**
 * LobbyScene.js - Multiplayer Lobby Scene for Memex Racing
 * 
 * Displays room code, player slots (1-6), invite functionality, and ready states.
 * Manages the pre-game lobby where players gather before racing.
 */

import Phaser from 'phaser';
import { AuthenticatedScene } from './AuthenticatedScene';

export class LobbyScene extends AuthenticatedScene {
    constructor() {
        super({ key: 'LobbyScene' });
        this.roomData = null;
        this.playerSlots = [];
        this.isHost = false;
        this.isQuickPlay = false;
        this.readyStates = {}; // Track ready state for each player
        this.playerCount = 0;
        this.maxPlayers = 6;
        this.currentPlayer = null;
    }

    init(data) {
        this.roomData = data.roomData || {};
        this.isHost = data.isHost || false;
        this.isQuickPlay = data.isQuickPlay || false;
        this.maxPlayers = this.roomData.maxPlayers || 6;
        this.playerCount = this.roomData.playerCount || 1;
        
        console.log('[LobbyScene] Initialized with:', {
            roomId: this.roomData.roomId,
            isHost: this.isHost,
            isQuickPlay: this.isQuickPlay,
            playerCount: this.playerCount
        });
    }

    create() {
        // Call parent create for authentication setup
        super.create();
        
        // Set background
        this.cameras.main.setBackgroundColor('#001122');
        
        // Create animated background
        this.createLobbyBackground();
        
        // Main lobby title
        const title = this.add.text(960, 100, 'RACE LOBBY', {
            fontSize: '64px',
            fontFamily: 'Courier New',
            color: '#00ff00',
            fontWeight: 'bold',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        
        // Room info section
        this.createRoomInfoSection();
        
        // Player slots section
        this.createPlayerSlots();
        
        // Control buttons section
        this.createControlButtons();
        
        // Chat/message area (placeholder)
        this.createMessageArea();
        
        // Setup input handlers
        this.setupInputHandlers();
        
        // Initialize with current player
        this.initializeCurrentPlayer();
        
        // Auto-ready for quick play
        if (this.isQuickPlay) {
            this.setPlayerReady(0, true);
            // Auto-start after 3 seconds for quick play
            this.time.delayedCall(3000, () => {
                this.startGame();
            });
        }
        
        // Fade in
        this.cameras.main.fadeIn(500, 0, 0, 0);
        
        // Emit lobby ready event
        this.events.emit('LOBBY_READY', this.roomData);
    }

    /**
     * Create animated lobby background
     */
    createLobbyBackground() {
        // Racing track animation in background
        const track = this.add.graphics();
        track.lineStyle(8, 0x333333, 0.3);
        
        // Create scrolling track lines
        for (let i = 0; i < 10; i++) {
            const line = this.add.graphics();
            line.lineStyle(4, 0x444444, 0.5);
            line.beginPath();
            line.moveTo(0, 200 + i * 60);
            line.lineTo(1920, 200 + i * 60);
            line.strokePath();
            
            // Animate line movement
            this.tweens.add({
                targets: line,
                x: -100,
                duration: 3000 + i * 200,
                repeat: -1,
                ease: 'Linear'
            });
        }
        
        // Add floating racing elements
        for (let i = 0; i < 8; i++) {
            const car = this.add.circle(
                Phaser.Math.Between(-100, 1920),
                Phaser.Math.Between(200, 800),
                Phaser.Math.Between(3, 6),
                0x00ff00,
                0.4
            );
            
            this.tweens.add({
                targets: car,
                x: 2000,
                duration: Phaser.Math.Between(8000, 15000),
                repeat: -1,
                delay: i * 1000
            });
        }
    }

    /**
     * Create room information section
     */
    createRoomInfoSection() {
        const infoY = 180;
        
        // Room info background
        const infoBg = this.add.graphics();
        infoBg.fillStyle(0x000000, 0.8);
        infoBg.fillRoundedRect(660, infoY - 30, 600, 120, 10);
        infoBg.lineStyle(3, 0x00ff00);
        infoBg.strokeRoundedRect(660, infoY - 30, 600, 120, 10);
        
        // Room code (large and prominent)
        if (!this.isQuickPlay) {
            this.add.text(960, infoY, 'ROOM CODE', {
                fontSize: '20px',
                fontFamily: 'Courier New',
                color: '#888888'
            }).setOrigin(0.5);
            
            const roomCodeText = this.add.text(960, infoY + 30, this.roomData.roomId || 'UNKNOWN', {
                fontSize: '48px',
                fontFamily: 'Courier New',
                color: '#ffff00',
                fontWeight: 'bold',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5);
            
            // Make room code clickable to copy
            roomCodeText.setInteractive({ useHandCursor: true });
            roomCodeText.on('pointerdown', () => {
                this.copyRoomCode();
            });
        } else {
            this.add.text(960, infoY + 15, 'QUICK PLAY MODE', {
                fontSize: '36px',
                fontFamily: 'Courier New',
                color: '#ffff00',
                fontWeight: 'bold'
            }).setOrigin(0.5);
        }
        
        // Host information
        const hostText = this.isHost ? 'You are the host' : `Host: ${this.roomData.host || 'Unknown'}`;
        this.add.text(960, infoY + 70, hostText, {
            fontSize: '18px',
            fontFamily: 'Courier New',
            color: this.isHost ? '#00ff00' : '#ffffff'
        }).setOrigin(0.5);
    }

    /**
     * Create player slots (1-6 players)
     */
    createPlayerSlots() {
        const startY = 350;
        const slotHeight = 80;
        const slotWidth = 800;
        const centerX = 960;
        
        this.playerSlots = [];
        
        // Title
        this.add.text(centerX, startY - 40, 'PLAYERS', {
            fontSize: '28px',
            fontFamily: 'Courier New',
            color: '#00ff00',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        // Create 6 player slots
        for (let i = 0; i < this.maxPlayers; i++) {
            const slotY = startY + i * (slotHeight + 10);
            
            // Slot background
            const slotBg = this.add.graphics();
            const isEmpty = i >= this.playerCount;
            const bgColor = isEmpty ? 0x222222 : 0x004400;
            const borderColor = isEmpty ? 0x444444 : 0x00ff00;
            
            slotBg.fillStyle(bgColor, 0.8);
            slotBg.fillRoundedRect(centerX - slotWidth/2, slotY - slotHeight/2, slotWidth, slotHeight, 8);
            slotBg.lineStyle(2, borderColor);
            slotBg.strokeRoundedRect(centerX - slotWidth/2, slotY - slotHeight/2, slotWidth, slotHeight, 8);
            
            // Player number
            const playerNum = this.add.text(centerX - slotWidth/2 + 40, slotY, `P${i + 1}`, {
                fontSize: '24px',
                fontFamily: 'Courier New',
                color: isEmpty ? '#666666' : '#ffffff',
                fontWeight: 'bold'
            }).setOrigin(0.5);
            
            // Player info
            let playerName = 'Empty Slot';
            let playerStatus = '';
            
            if (!isEmpty) {
                if (i === 0) {
                    // Current player or host
                    playerName = this.isHost ? 'You (Host)' : 'Host';
                } else {
                    playerName = `Player ${i + 1}`;
                }
                
                // Ready status
                const isReady = this.readyStates[i] || false;
                playerStatus = isReady ? 'READY' : 'NOT READY';
            }
            
            const nameText = this.add.text(centerX - slotWidth/2 + 200, slotY - 15, playerName, {
                fontSize: '20px',
                fontFamily: 'Courier New',
                color: isEmpty ? '#666666' : '#ffffff',
                fontWeight: 'bold'
            });
            
            const statusText = this.add.text(centerX - slotWidth/2 + 200, slotY + 15, playerStatus, {
                fontSize: '16px',
                fontFamily: 'Courier New',
                color: isEmpty ? '#666666' : (playerStatus === 'READY' ? '#00ff00' : '#ffff00')
            });
            
            // Ready button (only for occupied slots and current player)
            let readyButton = null;
            if (!isEmpty && (i === 0 || this.isHost)) {
                readyButton = this.add.text(centerX + slotWidth/2 - 100, slotY, 'READY', {
                    fontSize: '18px',
                    fontFamily: 'Courier New',
                    color: '#00ff00',
                    fontWeight: 'bold',
                    backgroundColor: '#004400',
                    padding: { x: 15, y: 8 }
                }).setOrigin(0.5);
                
                readyButton.setInteractive({ useHandCursor: true });
                readyButton.on('pointerdown', () => {
                    this.togglePlayerReady(i);
                });
            }
            
            // Store slot reference
            this.playerSlots.push({
                index: i,
                background: slotBg,
                playerNum: playerNum,
                nameText: nameText,
                statusText: statusText,
                readyButton: readyButton,
                isEmpty: isEmpty
            });
        }
    }

    /**
     * Create control buttons
     */
    createControlButtons() {
        const buttonY = 920;
        
        // Invite Players button (only for host and not quick play)
        if (this.isHost && !this.isQuickPlay) {
            const inviteButton = this.createButton(600, buttonY, 'INVITE PLAYERS', 'button_blue', () => {
                this.showInviteDialog();
            });
        }
        
        // Start Game button (only for host)
        if (this.isHost) {
            this.startButton = this.createButton(960, buttonY, 'START GAME', 'button_green', () => {
                this.startGame();
            });
            
            // Initially disabled until conditions are met
            this.updateStartButton();
        }
        
        // Leave Room button
        const leaveButton = this.createButton(1320, buttonY, 'LEAVE ROOM', 'button_red', () => {
            this.leaveRoom();
        });
    }

    /**
     * Create a button
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {string} text - Button text
     * @param {string} spriteKey - Button sprite key
     * @param {Function} callback - Click callback
     * @returns {Object} Button object
     */
    createButton(x, y, text, spriteKey, callback) {
        const button = this.add.image(x, y, spriteKey);
        button.setInteractive({ useHandCursor: true });
        button.setScale(1.2);
        
        const buttonText = this.add.text(x, y, text, {
            fontSize: '18px',
            fontFamily: 'Courier New',
            color: '#ffffff',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        // Hover effects
        button.on('pointerover', () => {
            button.setScale(1.3);
            buttonText.setColor('#ffff00');
        });
        
        button.on('pointerout', () => {
            button.setScale(1.2);
            buttonText.setColor('#ffffff');
        });
        
        // Click handler
        button.on('pointerdown', () => {
            this.sound.play('ui_click', { volume: 0.5 });
            callback();
        });
        
        return { button, text: buttonText, callback };
    }

    /**
     * Create message/chat area
     */
    createMessageArea() {
        const messageY = 800;
        
        // Message area background
        const msgBg = this.add.graphics();
        msgBg.fillStyle(0x000000, 0.6);
        msgBg.fillRoundedRect(50, messageY - 50, 400, 100, 8);
        msgBg.lineStyle(2, 0x666666);
        msgBg.strokeRoundedRect(50, messageY - 50, 400, 100, 8);
        
        // Messages title
        this.add.text(70, messageY - 30, 'LOBBY MESSAGES', {
            fontSize: '16px',
            fontFamily: 'Courier New',
            color: '#888888'
        });
        
        // Sample messages
        this.messageText = this.add.text(70, messageY - 5, '', {
            fontSize: '14px',
            fontFamily: 'Courier New',
            color: '#ffffff',
            wordWrap: { width: 360 }
        });
        
        // Add initial message
        this.addMessage('Waiting for players...');
    }

    /**
     * Setup input handlers
     */
    setupInputHandlers() {
        // ESC to leave room
        this.input.keyboard.on('keydown-ESC', () => {
            this.leaveRoom();
        });
        
        // R to toggle ready
        this.input.keyboard.on('keydown-R', () => {
            this.togglePlayerReady(0); // Current player
        });
        
        // ENTER to start game (host only)
        if (this.isHost) {
            this.input.keyboard.on('keydown-ENTER', () => {
                if (this.canStartGame()) {
                    this.startGame();
                }
            });
        }
    }

    /**
     * Initialize current player using AuthenticatedScene methods
     */
    initializeCurrentPlayer() {
        // Get username from AuthenticatedScene
        const username = this.getUsername() || 'Guest';
        
        // Set current player as first slot
        this.currentPlayer = {
            index: 0,
            name: username,
            isHost: this.isHost,
            userId: this.getUserId()
        };
        
        // Update player slot to show authenticated username
        if (this.playerSlots[0]) {
            const displayName = this.isHost ? `${username} (Host)` : username;
            this.playerSlots[0].nameText.setText(displayName);
        }
    }

    /**
     * Toggle player ready state
     * @param {number} playerIndex - Player index
     */
    togglePlayerReady(playerIndex) {
        const currentState = this.readyStates[playerIndex] || false;
        this.setPlayerReady(playerIndex, !currentState);
    }

    /**
     * Set player ready state
     * @param {number} playerIndex - Player index
     * @param {boolean} ready - Ready state
     */
    setPlayerReady(playerIndex, ready) {
        this.readyStates[playerIndex] = ready;
        
        // Update UI
        const slot = this.playerSlots[playerIndex];
        if (slot && !slot.isEmpty) {
            const statusText = ready ? 'READY' : 'NOT READY';
            const statusColor = ready ? '#00ff00' : '#ffff00';
            
            slot.statusText.setText(statusText);
            slot.statusText.setColor(statusColor);
            
            if (slot.readyButton) {
                slot.readyButton.setText(ready ? 'CANCEL' : 'READY');
                slot.readyButton.setColor(ready ? '#ff0000' : '#00ff00');
            }
        }
        
        // Add message
        const playerName = playerIndex === 0 ? 'You' : `Player ${playerIndex + 1}`;
        this.addMessage(`${playerName} ${ready ? 'is ready!' : 'is not ready'}`);
        
        // Update start button
        this.updateStartButton();
        
        // Emit event
        this.events.emit('PLAYER_READY_CHANGED', {
            playerIndex,
            ready,
            roomId: this.roomData.roomId
        });
    }

    /**
     * Update start button state
     */
    updateStartButton() {
        if (!this.startButton || !this.isHost) return;
        
        const canStart = this.canStartGame();
        
        if (canStart) {
            this.startButton.button.setTint(0xffffff);
            this.startButton.text.setColor('#ffffff');
        } else {
            this.startButton.button.setTint(0x666666);
            this.startButton.text.setColor('#666666');
        }
    }

    /**
     * Check if game can be started
     * @returns {boolean} Can start game
     */
    canStartGame() {
        // Need at least 2 players (or 1 for quick play)
        const minPlayers = this.isQuickPlay ? 1 : 2;
        if (this.playerCount < minPlayers) return false;
        
        // All present players must be ready
        for (let i = 0; i < this.playerCount; i++) {
            if (!this.readyStates[i]) return false;
        }
        
        return true;
    }

    /**
     * Start the game
     */
    startGame() {
        if (!this.isHost) {
            console.warn('[LobbyScene] Only host can start game');
            return;
        }
        
        if (!this.canStartGame()) {
            this.addMessage('Cannot start: Not all players are ready!');
            return;
        }
        
        console.log('[LobbyScene] Starting game');
        this.addMessage('Starting race...');
        
        // Prepare game data
        const gameData = {
            roomId: this.roomData.roomId,
            playerCount: this.playerCount,
            players: this.getPlayerList(),
            gameMode: this.roomData.gameMode,
            isQuickPlay: this.isQuickPlay
        };
        
        // Fade out and transition to race scene
        this.cameras.main.fadeOut(1000, 0, 0, 0);
        
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('RaceScene', gameData);
        });
        
        // Emit game started event
        this.events.emit('GAME_STARTED', gameData);
    }

    /**
     * Show invite dialog
     */
    showInviteDialog() {
        // Create modal background
        const modal = this.add.graphics();
        modal.fillStyle(0x000000, 0.8);
        modal.fillRect(0, 0, 1920, 1080);
        
        // Dialog box
        const dialogBg = this.add.graphics();
        dialogBg.fillStyle(0x000000, 0.9);
        dialogBg.fillRoundedRect(660, 340, 600, 400, 20);
        dialogBg.lineStyle(4, 0x00ff00);
        dialogBg.strokeRoundedRect(660, 340, 600, 400, 20);
        
        // Title
        this.add.text(960, 400, 'INVITE PLAYERS', {
            fontSize: '32px',
            fontFamily: 'Courier New',
            color: '#00ff00',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        // Room code display
        this.add.text(960, 460, 'Share this room code:', {
            fontSize: '18px',
            fontFamily: 'Courier New',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        const roomCodeDisplay = this.add.text(960, 500, this.roomData.roomId, {
            fontSize: '48px',
            fontFamily: 'Courier New',
            color: '#ffff00',
            fontWeight: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);
        
        // Copy button
        const copyButton = this.createButton(960, 570, 'COPY CODE', 'button_blue', () => {
            this.copyRoomCode();
        });
        
        // Close button
        const closeButton = this.createButton(960, 650, 'CLOSE', 'button_red', () => {
            [modal, dialogBg, roomCodeDisplay, copyButton.button, copyButton.text, closeButton.button, closeButton.text].forEach(el => el.destroy());
        });
    }

    /**
     * Copy room code to clipboard
     */
    copyRoomCode() {
        // In real implementation, use navigator.clipboard.writeText()
        console.log(`[LobbyScene] Copying room code: ${this.roomData.roomId}`);
        this.addMessage('Room code copied to clipboard!');
        
        // Show temporary feedback
        const feedback = this.add.text(960, 300, 'COPIED!', {
            fontSize: '24px',
            fontFamily: 'Courier New',
            color: '#00ff00',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        this.tweens.add({
            targets: feedback,
            alpha: 0,
            y: 250,
            duration: 1000,
            onComplete: () => feedback.destroy()
        });
    }

    /**
     * Leave the room
     */
    leaveRoom() {
        console.log('[LobbyScene] Leaving room');
        
        // Emit leave event
        this.events.emit('PLAYER_LEFT', {
            roomId: this.roomData.roomId,
            playerId: this.currentPlayer?.index || 0
        });
        
        // Return to main menu
        this.scene.start('MainMenuScene');
    }

    /**
     * Add message to message area
     * @param {string} message - Message to add
     */
    addMessage(message) {
        const timestamp = new Date().toLocaleTimeString();
        const formattedMessage = `[${timestamp}] ${message}`;
        
        // Update message text (in real implementation, maintain message history)
        this.messageText.setText(formattedMessage);
        
        console.log(`[LobbyScene] ${formattedMessage}`);
    }

    /**
     * Get list of players for game
     * @returns {Array} Player list
     */
    getPlayerList() {
        const players = [];
        for (let i = 0; i < this.playerCount; i++) {
            players.push({
                index: i,
                name: i === 0 ? 'You' : `Player ${i + 1}`,
                isHost: i === 0 && this.isHost,
                ready: this.readyStates[i] || false
            });
        }
        return players;
    }

    /**
     * Handle new player joining
     * @param {Object} playerData - Player data
     */
    onPlayerJoined(playerData) {
        console.log('[LobbyScene] Player joined:', playerData);
        
        this.playerCount = Math.min(this.playerCount + 1, this.maxPlayers);
        this.addMessage(`${playerData.name || 'Player'} joined the room`);
        
        // Update UI
        this.updatePlayerSlots();
        this.updateStartButton();
    }

    /**
     * Handle player leaving
     * @param {Object} playerData - Player data
     */
    onPlayerLeft(playerData) {
        console.log('[LobbyScene] Player left:', playerData);
        
        this.playerCount = Math.max(this.playerCount - 1, 1);
        this.addMessage(`${playerData.name || 'Player'} left the room`);
        
        // Update UI
        this.updatePlayerSlots();
        this.updateStartButton();
    }

    /**
     * Update player slots display
     */
    updatePlayerSlots() {
        // Refresh all player slots based on current player count
        for (let i = 0; i < this.maxPlayers; i++) {
            const slot = this.playerSlots[i];
            if (!slot) continue;
            
            const isEmpty = i >= this.playerCount;
            const bgColor = isEmpty ? 0x222222 : 0x004400;
            const borderColor = isEmpty ? 0x444444 : 0x00ff00;
            
            // Update background
            slot.background.clear();
            slot.background.fillStyle(bgColor, 0.8);
            slot.background.fillRoundedRect(560, 350 + i * 90 - 40, 800, 80, 8);
            slot.background.lineStyle(2, borderColor);
            slot.background.strokeRoundedRect(560, 350 + i * 90 - 40, 800, 80, 8);
            
            // Update text colors
            const textColor = isEmpty ? '#666666' : '#ffffff';
            slot.playerNum.setColor(textColor);
            slot.nameText.setColor(textColor);
            slot.statusText.setColor(textColor);
            
            // Update text content
            if (isEmpty) {
                slot.nameText.setText('Empty Slot');
                slot.statusText.setText('');
                if (slot.readyButton) {
                    slot.readyButton.setVisible(false);
                }
            } else {
                const username = this.getUsername() || 'Guest';
                const playerName = i === 0 ? (this.isHost ? `${username} (Host)` : username) : `Player ${i + 1}`;
                slot.nameText.setText(playerName);
                const isReady = this.readyStates[i] || false;
                slot.statusText.setText(isReady ? 'READY' : 'NOT READY');
                slot.statusText.setColor(isReady ? '#00ff00' : '#ffff00');
                if (slot.readyButton) {
                    slot.readyButton.setVisible(true);
                }
            }
            
            slot.isEmpty = isEmpty;
        }
    }

    /**
     * Handle authentication context ready (override from AuthenticatedScene)
     */
    onAuthContextReady(userContext, isAuthenticated) {
        console.log('[LobbyScene] Auth context ready:', { isAuthenticated, username: userContext?.username });
        // Update current player info when auth context is ready
        this.initializeCurrentPlayer();
    }
    
    /**
     * Handle user context updates (override from AuthenticatedScene)
     */
    onUserContextUpdate(userData) {
        console.log('[LobbyScene] User context updated:', userData?.username);
        // Update player display when user data changes
        this.initializeCurrentPlayer();
    }
    
    /**
     * Handle auth state changes (override from AuthenticatedScene)
     */
    onAuthStateChange(stateChange) {
        console.log('[LobbyScene] Auth state changed:', stateChange.type);
        if (stateChange.type === 'logout' || stateChange.type === 'session_expired') {
            // Return to main menu on logout
            this.scene.start('MainMenuScene');
        }
    }
    
    /**
     * Scene cleanup (enhanced with AuthenticatedScene cleanup)
     */
    destroy() {
        this.sound.stopAll();
        // Call parent destroy for auth cleanup
        super.destroy();
    }
}