/**
 * RaceScene.js - Main Racing Scene for Memex Racing
 * 
 * Handles all game phases: betting (30s) → race (5min) → results → auto-reset
 * Manages the core racing gameplay with random movement, power-ups, and win conditions.
 */

import Phaser from 'phaser';
import { GameEngine } from '../engine/GameEngine';
import { AuthenticatedScene } from './AuthenticatedScene';
import { addMemoryManagement } from '../systems/SceneCleanupUtils.js';

export class RaceScene extends AuthenticatedScene {
    constructor() {
        super({ key: 'RaceScene' });
        
        // Game state
        this.gamePhase = 'betting'; // betting, racing, results, resetting
        this.gameTime = 300; // 5 minutes in seconds
        this.bettingTime = 30; // 30 seconds betting phase
        this.raceNumber = 1;
        
        // Game objects
        this.players = [];
        this.boosters = [];
        this.skills = [];
        this.mToken = null;
        this.trackData = null;
        this.validPositions = [];
        
        // UI elements
        this.timerText = null;
        this.phaseText = null;
        this.bettingPanel = null;
        this.leaderboardPanel = null;
        this.debugPanel = null;
        
        // Game data
        this.gameData = {};
        this.playerBets = {};
        this.playerStats = {};
        this.rng = null;
        
        // Debug mode
        this.debugMode = false;
        this.debugGraphics = null;
        
        // Track parameters
        this.currentMap = 'classic';
        this.trackWidth = 1920;
        this.trackHeight = 1080;
        
        // Performance tracking
        this.lastBoosterSpawn = 0;
        this.lastSkillSpawn = 0;
    }

    init(data) {
        this.gameData = data || {};
        console.log('[RaceScene] Initialized with game data:', this.gameData);
        
        // Initialize RNG with consistent seed for reproducible randomness
        this.rng = {
            seed: Date.now(),
            random: () => Math.random() // In real implementation, use Mersenne Twister
        };
        
        // Initialize player stats
        this.initializePlayerStats();
    }

    create() {
        // Call parent create for authentication setup
        super.create();
        
        // Add memory management to this scene
        addMemoryManagement(this);
        
        console.log('[RaceScene] Creating race scene with memory management');
        
        // Set background
        this.cameras.main.setBackgroundColor('#1a3a1a');
        
        // Create track
        this.createTrack();
        
        // Create debug graphics
        this.debugGraphics = this.add.graphics();
        this.debugGraphics.setDepth(1000);
        
        // Create UI
        this.createUI();
        
        // Setup input handlers
        this.setupInputHandlers();
        
        // Create game timers
        this.setupGameTimers();
        
        // Wait for assets to settle, then initialize game objects using managed timeout
        this.managedSetTimeout(() => {
            this.initializeGameObjects();
            this.startBettingPhase();
        }, 200);
        
        // Fade in
        this.cameras.main.fadeIn(500, 0, 0, 0);
        
        // Emit race scene ready event
        this.events.emit('RACE_SCENE_READY', this.gameData);
    }

    /**
     * Create the racing track
     */
    createTrack() {
        // Create track graphics
        const graphics = this.add.graphics();
        
        // Background
        graphics.fillStyle(0x1a3a1a);
        graphics.fillRect(0, 0, this.trackWidth, this.trackHeight);
        
        // Create maze-like track (simplified version of classic maze)
        graphics.fillStyle(0xffffff);
        
        // Main corridors
        graphics.fillRect(70, 170, 1780, 120);   // Top corridor
        graphics.fillRect(70, 480, 1780, 120);   // Middle corridor
        graphics.fillRect(70, 780, 1780, 120);   // Bottom corridor
        
        // Vertical connections
        graphics.fillRect(70, 170, 120, 730);    // Left edge
        graphics.fillRect(470, 270, 120, 330);   // Left-center
        graphics.fillRect(870, 270, 120, 530);   // Center
        graphics.fillRect(1270, 270, 120, 330);  // Right-center
        graphics.fillRect(1730, 170, 120, 730);  // Right edge
        
        // Cross connections
        graphics.fillRect(270, 330, 240, 90);    // Top-left bridge
        graphics.fillRect(670, 330, 240, 90);    // Top-center bridge
        graphics.fillRect(1070, 630, 240, 90);   // Bottom-right bridge
        
        // Generate texture for collision detection
        graphics.generateTexture('raceTrack', this.trackWidth, this.trackHeight);
        
        // Add track image to scene
        const trackImage = this.add.image(960, 540, 'raceTrack');
        
        // Create collision data
        this.createTrackCollisionData();
        
        graphics.destroy();
    }

    /**
     * Create track collision data for pathfinding
     */
    createTrackCollisionData() {
        // Create a simplified collision system
        const canvas = this.textures.createCanvas('trackCollision', this.trackWidth, this.trackHeight);
        const context = canvas.context;
        const trackImage = this.textures.get('raceTrack').getSourceImage();
        
        context.drawImage(trackImage, 0, 0);
        this.trackData = context.getImageData(0, 0, this.trackWidth, this.trackHeight);
        
        // Find valid track positions for spawning
        this.findValidTrackPositions();
    }

    /**
     * Find valid positions on the track
     */
    findValidTrackPositions() {
        this.validPositions = [];
        
        // Sample every 20 pixels for performance
        for (let x = 40; x < this.trackWidth - 40; x += 20) {
            for (let y = 40; y < this.trackHeight - 40; y += 20) {
                if (this.isPositionOnTrack(x, y)) {
                    this.validPositions.push({ x, y });
                }
            }
        }
        
        console.log(`[RaceScene] Found ${this.validPositions.length} valid track positions`);
    }

    /**
     * Check if position is on track
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean} Is on track
     */
    isPositionOnTrack(x, y) {
        if (x < 0 || x >= this.trackWidth || y < 0 || y >= this.trackHeight) return false;
        
        const pixelX = Math.floor(x);
        const pixelY = Math.floor(y);
        const index = (pixelY * this.trackWidth + pixelX) * 4;
        
        if (index >= this.trackData.data.length) return false;
        
        const r = this.trackData.data[index];
        const g = this.trackData.data[index + 1];
        const b = this.trackData.data[index + 2];
        
        // White pixels are track
        const brightness = (r + g + b) / 3;
        return brightness > 200;
    }

    /**
     * Create UI elements
     */
    createUI() {
        // Timer display
        this.timerText = this.add.text(960, 50, 'TIME: --:--', {
            fontSize: '48px',
            fontFamily: 'Courier New',
            color: '#00ff00',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        // Phase indicator
        this.phaseText = this.add.text(960, 110, 'PREPARING...', {
            fontSize: '32px',
            fontFamily: 'Courier New',
            color: '#ffff00',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);
        
        // Race number
        this.add.text(50, 50, `Race #${this.raceNumber}`, {
            fontSize: '24px',
            fontFamily: 'Courier New',
            color: '#ffffff'
        });
        
        // Create betting panel
        this.createBettingPanel();
        
        // Create leaderboard panel
        this.createLeaderboardPanel();
        
        // Create debug panel (initially hidden)
        this.createDebugPanel();
        
        // Instructions
        this.add.text(50, this.trackHeight - 50, 'Press D for debug, ESC to leave', {
            fontSize: '16px',
            fontFamily: 'Courier New',
            color: '#888888'
        });
    }

    /**
     * Create betting panel
     */
    createBettingPanel() {
        const panelX = this.trackWidth - 300;
        const panelY = 200;
        
        // Panel background
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x000000, 0.8);
        panelBg.fillRoundedRect(panelX - 150, panelY - 50, 300, 400, 10);
        panelBg.lineStyle(3, 0x00ff00);
        panelBg.strokeRoundedRect(panelX - 150, panelY - 50, 300, 400, 10);
        
        // Panel title
        const panelTitle = this.add.text(panelX, panelY - 20, 'BETTING', {
            fontSize: '24px',
            fontFamily: 'Courier New',
            color: '#00ff00',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        // Betting status
        this.bettingStatusText = this.add.text(panelX, panelY + 20, 'Place your bets!', {
            fontSize: '16px',
            fontFamily: 'Courier New',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Player bet options (simplified)
        let buttonY = panelY + 60;
        for (let i = 0; i < Math.min(6, this.gameData.playerCount || 1); i++) {
            const playerName = `P${i + 1}`;
            const betButton = this.add.text(panelX, buttonY, `Bet on ${playerName}`, {
                fontSize: '14px',
                fontFamily: 'Courier New',
                color: '#ffff00',
                backgroundColor: '#333333',
                padding: { x: 10, y: 5 }
            }).setOrigin(0.5);
            
            betButton.setInteractive({ useHandCursor: true });
            betButton.on('pointerdown', () => {
                this.placeBet(i);
            });
            
            buttonY += 30;
        }
        
        // Current bet display
        this.currentBetText = this.add.text(panelX, buttonY + 20, 'Your bet: None', {
            fontSize: '16px',
            fontFamily: 'Courier New',
            color: '#ffff00'
        }).setOrigin(0.5);
        
        this.bettingPanel = {
            background: panelBg,
            title: panelTitle,
            statusText: this.bettingStatusText,
            betText: this.currentBetText
        };
    }

    /**
     * Create leaderboard panel
     */
    createLeaderboardPanel() {
        const panelX = 200;
        const panelY = 200;
        
        // Panel background
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x000000, 0.8);
        panelBg.fillRoundedRect(panelX - 150, panelY - 50, 300, 350, 10);
        panelBg.lineStyle(3, 0x0000ff);
        panelBg.strokeRoundedRect(panelX - 150, panelY - 50, 300, 350, 10);
        
        // Panel title
        const panelTitle = this.add.text(panelX, panelY - 20, 'LEADERBOARD', {
            fontSize: '24px',
            fontFamily: 'Courier New',
            color: '#0000ff',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        // Leaderboard content
        this.leaderboardText = this.add.text(panelX, panelY + 20, 'No races completed yet', {
            fontSize: '14px',
            fontFamily: 'Courier New',
            color: '#ffffff'
        }).setOrigin(0.5, 0);
        
        this.leaderboardPanel = {
            background: panelBg,
            title: panelTitle,
            contentText: this.leaderboardText
        };
    }

    /**
     * Create debug panel
     */
    createDebugPanel() {
        const panelX = 200;
        const panelY = 700;
        
        // Panel background
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x000000, 0.9);
        panelBg.fillRoundedRect(panelX - 150, panelY - 50, 300, 250, 10);
        panelBg.lineStyle(3, 0xff0000);
        panelBg.strokeRoundedRect(panelX - 150, panelY - 50, 300, 250, 10);
        
        // Panel title
        const panelTitle = this.add.text(panelX, panelY - 20, 'DEBUG INFO', {
            fontSize: '20px',
            fontFamily: 'Courier New',
            color: '#ff0000',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        // Debug content
        this.debugText = this.add.text(panelX, panelY + 10, '', {
            fontSize: '12px',
            fontFamily: 'Courier New',
            color: '#ffffff'
        }).setOrigin(0.5, 0);
        
        this.debugPanel = {
            background: panelBg,
            title: panelTitle,
            contentText: this.debugText
        };
        
        // Initially hidden
        this.setDebugPanelVisible(false);
    }

    /**
     * Setup input handlers
     */
    setupInputHandlers() {
        // Debug mode toggle - using managed event listener
        this.managedAddKeyboardHandler('keydown-D', () => {
            this.debugMode = !this.debugMode;
            this.setDebugPanelVisible(this.debugMode);
            console.log(`[RaceScene] Debug mode: ${this.debugMode ? 'ON' : 'OFF'}`);
        });
        
        // ESC to return to lobby/menu - using managed event listener
        this.managedAddKeyboardHandler('keydown-ESC', () => {
            this.returnToLobby();
        });
        
        // Quick betting shortcuts (1-6 keys) - using managed event listeners
        for (let i = 1; i <= 6; i++) {
            this.managedAddKeyboardHandler(`keydown-${i}`, () => {
                if (this.gamePhase === 'betting') {
                    this.placeBet(i - 1);
                }
            });
        }
    }

    /**
     * Setup game timers
     */
    setupGameTimers() {
        // Main game timer (1 second intervals) - using managed timer
        this.managedAddTimerEvent({
            delay: 1000,
            callback: this.updateGameTimer,
            callbackScope: this,
            loop: true
        });
        
        // Booster spawn timer - using managed timer
        this.managedAddTimerEvent({
            delay: 3000,
            callback: this.maybeSpawnBooster,
            callbackScope: this,
            loop: true
        });
        
        // Skill spawn timer - using managed timer
        this.managedAddTimerEvent({
            delay: 8000,
            callback: this.maybeSpawnSkill,
            callbackScope: this,
            loop: true
        });
    }

    /**
     * Initialize game objects
     */
    initializeGameObjects() {
        console.log('[RaceScene] Initializing game objects');
        
        // Spawn players at random start position
        this.spawnPlayers();
        
        // Spawn M token at farthest position from start
        this.spawnMToken();
    }

    /**
     * Initialize player statistics
     */
    initializePlayerStats() {
        this.playerStats = {};
        const playerCount = this.gameData.playerCount || 1;
        
        for (let i = 0; i < playerCount; i++) {
            this.playerStats[i] = {
                name: `Player ${i + 1}`,
                wins: 0,
                totalRaces: 0,
                earnings: 0,
                currentBet: 0
            };
        }
    }

    /**
     * Spawn players at a shared starting position
     */
    spawnPlayers() {
        const playerCount = this.gameData.playerCount || 1;
        
        // Get random start position with enough space
        let startPosition = this.getRandomValidPosition();
        let attempts = 0;
        
        // Ensure space for all players
        while (attempts < 50) {
            const hasSpace = this.checkSpaceForPlayers(startPosition, playerCount);
            if (hasSpace) break;
            
            startPosition = this.getRandomValidPosition();
            attempts++;
        }
        
        console.log(`[RaceScene] Spawning ${playerCount} players at`, startPosition);
        
        // Create players
        for (let i = 0; i < playerCount; i++) {
            const player = this.createPlayer(i, startPosition);
            this.players.push(player);
        }
        
        // Show start position indicator
        this.showStartIndicator(startPosition);
    }

    /**
     * Create a single player
     * @param {number} index - Player index
     * @param {Object} startPos - Starting position
     * @returns {Object} Player object
     */
    createPlayer(index, startPos) {
        // Calculate offset position for this player
        const col = index % 3;
        const row = Math.floor(index / 3);
        const offsetX = (col - 1) * 40;
        const offsetY = row * 40 - 20;
        
        const playerPos = {
            x: startPos.x + offsetX,
            y: startPos.y + offsetY
        };
        
        // Create player sprite
        const player = this.physics.add.sprite(playerPos.x, playerPos.y, `player${index}`);
        player.setScale(0.25);
        player.setOrigin(0.5, 0.5);
        
        // Player properties
        player.index = index;
        player.baseSpeed = 1.2 + this.rng.random() * 0.8;
        player.currentSpeed = player.baseSpeed;
        player.speedMultiplier = 1;
        player.moveDirection = this.rng.random() * Math.PI * 2;
        player.stuckCounter = 0;
        player.lastPositions = [];
        
        // Status effects
        player.paralyzed = false;
        player.burning = false;
        player.hasBubble = false;
        player.magnetized = false;
        
        // Biorhythm for natural movement variation
        player.biorhythmSpeed = 0.5 + this.rng.random() * 1.5;
        player.biorhythmOffset = this.rng.random() * Math.PI * 2;
        
        // Physics setup
        player.body.setSize(48, 48);
        player.body.setOffset(40, 40);
        player.setVelocity(0, 0);
        
        // Player name tag
        const playerName = this.playerStats[index]?.name || `P${index + 1}`;
        const nameText = this.add.text(player.x, player.y + 25, playerName, {
            fontSize: '14px',
            fontFamily: 'Courier New',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        
        player.nameText = nameText;
        
        console.log(`[RaceScene] Created player ${index} at (${playerPos.x}, ${playerPos.y})`);
        
        return player;
    }

    /**
     * Spawn M token at farthest position from players
     */
    spawnMToken() {
        if (this.players.length === 0) return;
        
        const startPos = { x: this.players[0].x, y: this.players[0].y };
        const tokenPos = this.getFarthestPositionFromStart(startPos);
        
        this.mToken = this.physics.add.sprite(tokenPos.x, tokenPos.y, 'mtoken');
        this.mToken.setScale(1);
        
        // Add goal indicator
        const goalArrow = this.add.text(tokenPos.x, tokenPos.y - 40, '⬇', {
            fontSize: '32px',
            color: '#ffff00'
        }).setOrigin(0.5);
        
        this.managedCreateTween({
            targets: goalArrow,
            y: tokenPos.y - 50,
            duration: 1000,
            yoyo: true,
            repeat: -1
        });
        
        console.log('[RaceScene] M token spawned at', tokenPos);
    }

    /**
     * Start betting phase
     */
    startBettingPhase() {
        console.log('[RaceScene] Starting betting phase');
        
        this.gamePhase = 'betting';
        this.bettingTime = 30;
        
        this.phaseText.setText('BETTING PHASE');
        this.phaseText.setColor('#ffff00');
        
        this.bettingStatusText.setText('Place your bets!');
        
        // Enable betting UI
        this.setBettingUIEnabled(true);
    }

    /**
     * Start racing phase
     */
    startRacingPhase() {
        console.log('[RaceScene] Starting racing phase');
        
        this.gamePhase = 'racing';
        this.gameTime = 300; // 5 minutes
        
        this.phaseText.setText('RACE IN PROGRESS');
        this.phaseText.setColor('#00ff00');
        
        this.bettingStatusText.setText('Race in progress!');
        
        // Disable betting UI
        this.setBettingUIEnabled(false);
        
        // Show GO! message
        const goText = this.add.text(960, 540, 'GO!', {
            fontSize: '128px',
            fontFamily: 'Courier New',
            color: '#00ff00',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);
        
        this.managedCreateTween({
            targets: goText,
            scale: 1.5,
            alpha: 0,
            duration: 1000,
            onComplete: () => goText.destroy()
        });
        
        // Activate all players
        this.players.forEach(player => {
            player.active = true;
            player.stuckCounter = 0;
        });
    }

    /**
     * End race with results
     * @param {Object} winner - Winning player (optional)
     */
    endRace(winner = null) {
        console.log('[RaceScene] Ending race', winner ? `Winner: Player ${winner.index + 1}` : 'Time up');
        
        this.gamePhase = 'results';
        
        // Stop all player movement
        this.players.forEach(player => {
            player.active = false;
            player.setVelocity(0, 0);
        });
        
        // Show results
        this.showRaceResults(winner);
        
        // Update statistics
        this.updatePlayerStatistics(winner);
        
        // Schedule reset using managed timeout
        this.managedSetTimeout(() => {
            this.resetForNextRace();
        }, 5000);
        
        // Emit race finished event
        this.events.emit('RACE_FINISHED', {
            winner: winner ? winner.index : null,
            raceNumber: this.raceNumber,
            gameData: this.gameData
        });
    }

    /**
     * Update game state every frame
     */
    update(time, delta) {
        if (this.gamePhase !== 'racing' || this.players.length === 0) {
            return;
        }
        
        // Clear debug graphics
        if (this.debugGraphics) {
            this.debugGraphics.clear();
        }
        
        // Update all players
        this.updatePlayers(time, delta);
        
        // Check collisions
        this.checkCollisions();
        
        // Update debug info
        if (this.debugMode) {
            this.updateDebugInfo();
        }
        
        // Check for stuck players and spawn items
        this.updateGameSystems(time);
    }

    /**
     * Update all players with random movement
     * @param {number} time - Current time
     * @param {number} delta - Delta time
     */
    updatePlayers(time, delta) {
        this.players.forEach((player, index) => {
            if (!player || !player.active || player.paralyzed) return;
            
            // Random direction changes (blind horse movement)
            if (this.rng.random() < 0.02) {
                player.moveDirection += (this.rng.random() - 0.5) * Math.PI * 0.3;
            }
            
            // Calculate movement
            const moveSpeed = player.currentSpeed * delta / 16;
            const lookAheadDistance = moveSpeed + 10;
            
            // Check for walls ahead
            let canMove = true;
            for (let checkDist = 5; checkDist <= lookAheadDistance; checkDist += 5) {
                const checkX = player.x + Math.cos(player.moveDirection) * checkDist;
                const checkY = player.y + Math.sin(player.moveDirection) * checkDist;
                
                if (!this.isPositionOnTrack(checkX, checkY)) {
                    canMove = false;
                    break;
                }
            }
            
            if (canMove) {
                // Move player
                player.x += Math.cos(player.moveDirection) * moveSpeed;
                player.y += Math.sin(player.moveDirection) * moveSpeed;
                player.stuckCounter = Math.max(0, player.stuckCounter - 1);
            } else {
                // Find new direction when hitting wall
                player.moveDirection = this.findBestDirection(player.x, player.y, player.moveDirection);
                player.stuckCounter++;
                
                // Handle stuck players
                if (player.stuckCounter > 60) {
                    this.handleStuckPlayer(player);
                }
            }
            
            // Apply biorhythm
            const biorhythm = Math.sin(time * 0.0003 * player.biorhythmSpeed + player.biorhythmOffset);
            player.currentSpeed = player.baseSpeed * player.speedMultiplier * (1 + biorhythm * 0.15);
            
            // Update physics body
            if (player.body) {
                player.body.updateFromGameObject();
            }
            
            // Update name text position
            if (player.nameText) {
                player.nameText.x = player.x;
                player.nameText.y = player.y + 25;
            }
            
            // Track position history for stuck detection
            player.lastPositions.push({ x: player.x, y: player.y, time: time });
            if (player.lastPositions.length > 10) {
                player.lastPositions.shift();
            }
        });
    }

    /**
     * Check all collision types
     */
    checkCollisions() {
        // Token collision (win condition)
        if (this.mToken) {
            this.physics.overlap(this.players, this.mToken, this.handleTokenCollision, null, this);
        }
        
        // Booster collisions
        if (this.boosters.length > 0) {
            this.physics.overlap(this.players, this.boosters, this.handleBoosterCollision, null, this);
        }
        
        // Skill collisions
        if (this.skills.length > 0) {
            this.physics.overlap(this.players, this.skills, this.handleSkillCollision, null, this);
        }
        
        // Player-to-player collisions
        this.checkPlayerCollisions();
    }

    /**
     * Handle token collision (win condition)
     * @param {Object} player - Player that hit token
     * @param {Object} token - M token
     */
    handleTokenCollision(player, token) {
        if (this.gamePhase !== 'racing') return;
        
        console.log(`[RaceScene] Player ${player.index + 1} won the race!`);
        
        // Check for magnetized players (they have priority)
        const magnetizedPlayers = this.players.filter(p => p.magnetized);
        const winner = magnetizedPlayers.length > 0 ? magnetizedPlayers[0] : player;
        
        this.endRace(winner);
    }

    /**
     * Handle booster collision
     * @param {Object} player - Player that collected booster
     * @param {Object} booster - Booster object
     */
    handleBoosterCollision(player, booster) {
        console.log(`[RaceScene] Player ${player.index + 1} collected booster`);
        
        // Apply booster effect
        player.speedMultiplier = booster.speedMultiplier || 1.5;
        
        // Visual effect using managed tween
        this.managedCreateTween({
            targets: player,
            scaleX: 0.35,
            scaleY: 0.35,
            duration: 200,
            yoyo: true
        });
        
        // Remove effect after duration using managed timeout
        this.managedSetTimeout(() => {
            player.speedMultiplier = 1;
        }, 4000);
        
        // Remove booster
        booster.destroy();
        this.boosters = this.boosters.filter(b => b !== booster);
    }

    /**
     * Handle skill collision
     * @param {Object} player - Player that collected skill
     * @param {Object} skill - Skill object
     */
    handleSkillCollision(player, skill) {
        console.log(`[RaceScene] Player ${player.index + 1} collected skill: ${skill.skillType}`);
        
        this.activateSkill(player, skill.skillType);
        
        // Remove skill
        skill.destroy();
        this.skills = this.skills.filter(s => s !== skill);
    }

    /**
     * Activate a skill effect
     * @param {Object} player - Player who activated skill
     * @param {string} skillType - Type of skill
     */
    activateSkill(player, skillType) {
        switch (skillType) {
            case 'thunder':
                // Paralyze 3 random opponents
                const targets = this.players.filter(p => p !== player && p.active);
                for (let i = 0; i < Math.min(3, targets.length); i++) {
                    const target = targets[Math.floor(this.rng.random() * targets.length)];
                    if (!target.paralyzed) {
                        target.paralyzed = true;
                        target.setTint(0xffff00);
                        
                        this.managedSetTimeout(() => {
                            target.paralyzed = false;
                            target.clearTint();
                        }, 3000);
                    }
                }
                break;
                
            case 'fire':
                // Slow down 2 random opponents
                const burnTargets = this.players.filter(p => p !== player && p.active)
                    .sort(() => this.rng.random() - 0.5)
                    .slice(0, 2);
                    
                burnTargets.forEach(target => {
                    target.burning = true;
                    target.baseSpeed *= 0.5;
                    target.setTint(0xff4500);
                    
                    this.managedSetTimeout(() => {
                        target.burning = false;
                        target.baseSpeed *= 2;
                        target.clearTint();
                    }, 5000);
                });
                break;
                
            case 'bubble':
                // Protect player from collisions
                player.hasBubble = true;
                const bubble = this.add.circle(player.x, player.y, 30, 0x00bfff, 0.3);
                
                // Follow player
                const bubbleUpdate = this.time.addEvent({
                    delay: 16,
                    callback: () => {
                        if (bubble && player && player.active) {
                            bubble.x = player.x;
                            bubble.y = player.y;
                        }
                    },
                    repeat: 500
                });
                
                this.managedSetTimeout(() => {
                    player.hasBubble = false;
                    bubble.destroy();
                    bubbleUpdate.remove();
                }, 8000);
                break;
                
            case 'magnet':
                // Attract to nearby racers (win condition if M token found)
                player.magnetized = true;
                player.setTint(0xff1493);
                
                this.managedSetTimeout(() => {
                    player.magnetized = false;
                    player.clearTint();
                }, 5000);
                break;
                
            case 'teleport':
                // Teleport all players randomly
                this.players.forEach(p => {
                    if (p.active) {
                        const newPos = this.getRandomValidPosition();
                        p.x = newPos.x;
                        p.y = newPos.y;
                        p.stuckCounter = 0;
                        
                        // Visual effect
                        const effect = this.add.circle(newPos.x, newPos.y, 40, 0x9400d3, 0.5);
                        this.managedCreateTween({
                            targets: effect,
                            scale: 0,
                            alpha: 0,
                            duration: 500,
                            onComplete: () => effect.destroy()
                        });
                    }
                });
                break;
        }
    }

    /**
     * Check player-to-player collisions
     */
    checkPlayerCollisions() {
        for (let i = 0; i < this.players.length; i++) {
            for (let j = i + 1; j < this.players.length; j++) {
                const player1 = this.players[i];
                const player2 = this.players[j];
                
                if (player1 && player2 && player1.active && player2.active) {
                    const distance = Phaser.Math.Distance.Between(
                        player1.x, player1.y, player2.x, player2.y
                    );
                    
                    if (distance < 25) {
                        this.handlePlayerCollision(player1, player2);
                    }
                }
            }
        }
    }

    /**
     * Handle collision between two players
     * @param {Object} player1 - First player
     * @param {Object} player2 - Second player
     */
    handlePlayerCollision(player1, player2) {
        // Bubble protection
        if (player1.hasBubble) {
            const angle = Phaser.Math.Angle.Between(player1.x, player1.y, player2.x, player2.y);
            player2.x += Math.cos(angle) * 25;
            player2.y += Math.sin(angle) * 25;
        }
        
        if (player2.hasBubble) {
            const angle = Phaser.Math.Angle.Between(player2.x, player2.y, player1.x, player1.y);
            player1.x += Math.cos(angle) * 25;
            player1.y += Math.sin(angle) * 25;
        }
        
        // Magnetized attraction
        if (player1.magnetized || player2.magnetized) {
            const midX = (player1.x + player2.x) / 2;
            const midY = (player1.y + player2.y) / 2;
            
            player1.x = midX - 15;
            player1.y = midY;
            player2.x = midX + 15;
            player2.y = midY;
        }
    }

    /**
     * Update game timer and check time conditions
     */
    updateGameTimer() {
        if (this.gamePhase === 'betting') {
            this.bettingTime--;
            
            const minutes = Math.floor(this.bettingTime / 60);
            const seconds = this.bettingTime % 60;
            this.timerText.setText(`BETTING: ${minutes}:${seconds.toString().padStart(2, '0')}`);
            
            if (this.bettingTime <= 0) {
                this.startRacingPhase();
            }
        } else if (this.gamePhase === 'racing') {
            this.gameTime--;
            
            const minutes = Math.floor(this.gameTime / 60);
            const seconds = this.gameTime % 60;
            this.timerText.setText(`TIME: ${minutes}:${seconds.toString().padStart(2, '0')}`);
            
            if (this.gameTime <= 0) {
                this.endRace(); // Time up, no winner
            }
        }
    }

    /**
     * Maybe spawn a booster
     */
    maybeSpawnBooster() {
        if (this.gamePhase !== 'racing' || this.rng.random() > 0.7) return;
        
        const position = this.getRandomValidPosition();
        const boosterTypes = [
            { name: 'speed', speedMultiplier: 1.5, color: 0x00ff00 },
            { name: 'turbo', speedMultiplier: 2.0, color: 0xff0000 },
            { name: 'slow', speedMultiplier: 0.7, color: 0x8b4513 }
        ];
        
        const boosterType = boosterTypes[Math.floor(this.rng.random() * boosterTypes.length)];
        
        const booster = this.physics.add.sprite(position.x, position.y, 'booster_antenna');
        booster.setScale(0.6);
        booster.setTint(boosterType.color);
        booster.speedMultiplier = boosterType.speedMultiplier;
        
        // Glowing effect
        this.managedCreateTween({
            targets: booster,
            alpha: 0.5,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
        
        this.boosters.push(booster);
        
        // Auto-remove after 10 seconds using managed timeout
        this.managedSetTimeout(() => {
            if (booster && booster.active) {
                booster.destroy();
                this.boosters = this.boosters.filter(b => b !== booster);
            }
        }, 10000);
    }

    /**
     * Maybe spawn a skill
     */
    maybeSpawnSkill() {
        if (this.gamePhase !== 'racing' || this.rng.random() > 0.5) return;
        
        const position = this.getRandomValidPosition();
        const skillTypes = ['thunder', 'fire', 'bubble', 'magnet', 'teleport'];
        const skillType = skillTypes[Math.floor(this.rng.random() * skillTypes.length)];
        
        const skill = this.physics.add.sprite(position.x, position.y - 200, `skill_${skillType}`);
        skill.setScale(0.6);
        skill.skillType = skillType;
        skill.setVelocityY(100);
        
        this.skills.push(skill);
        
        // Auto-remove after 8 seconds using managed timeout
        this.managedSetTimeout(() => {
            if (skill && skill.active) {
                skill.destroy();
                this.skills = this.skills.filter(s => s !== skill);
            }
        }, 8000);
    }

    /**
     * Update various game systems
     * @param {number} time - Current time
     */
    updateGameSystems(time) {
        // Update player position tracking for stuck detection
        this.players.forEach(player => {
            if (player.lastPositions && player.lastPositions.length >= 10) {
                const oldPos = player.lastPositions[0];
                const distanceMoved = Phaser.Math.Distance.Between(
                    player.x, player.y, oldPos.x, oldPos.y
                );
                
                if (distanceMoved < 5) {
                    this.handleStuckPlayer(player);
                }
            }
        });
    }

    /**
     * Handle stuck players
     * @param {Object} player - Stuck player
     */
    handleStuckPlayer(player) {
        console.log(`[RaceScene] Handling stuck player ${player.index + 1}`);
        
        // Try to find new direction first
        const newDirection = this.findBestDirection(player.x, player.y, player.moveDirection);
        player.moveDirection = newDirection;
        
        // If still stuck after many attempts, teleport
        if (player.stuckCounter > 120) {
            const newPos = this.getRandomValidPosition();
            player.x = newPos.x;
            player.y = newPos.y;
            player.stuckCounter = 0;
            
            console.log(`[RaceScene] Teleported stuck player ${player.index + 1} to`, newPos);
        }
    }

    /**
     * Find best direction for player movement
     * @param {number} x - Current X position  
     * @param {number} y - Current Y position
     * @param {number} currentDirection - Current movement direction
     * @returns {number} Best direction angle
     */
    findBestDirection(x, y, currentDirection) {
        const testDistance = 30;
        const angleStep = Math.PI / 8; // 22.5 degrees
        let bestAngle = currentDirection;
        let maxClearDistance = 0;
        
        // Test 16 directions
        for (let angle = 0; angle < Math.PI * 2; angle += angleStep) {
            let clearDistance = 0;
            
            // Check how far we can go in this direction
            for (let dist = 5; dist <= 60; dist += 5) {
                const testX = x + Math.cos(angle) * dist;
                const testY = y + Math.sin(angle) * dist;
                
                if (this.isPositionOnTrack(testX, testY)) {
                    clearDistance = dist;
                } else {
                    break;
                }
            }
            
            if (clearDistance > maxClearDistance) {
                maxClearDistance = clearDistance;
                bestAngle = angle;
            }
        }
        
        // If no good direction found, try opposite of current
        if (maxClearDistance < 10) {
            return currentDirection + Math.PI;
        }
        
        return bestAngle;
    }

    /**
     * Get random valid position on track
     * @returns {Object} Position {x, y}
     */
    getRandomValidPosition() {
        if (this.validPositions.length === 0) {
            return { x: 960, y: 540 }; // Fallback to center
        }
        
        const randomIndex = Math.floor(this.rng.random() * this.validPositions.length);
        return this.validPositions[randomIndex];
    }

    /**
     * Get farthest position from start
     * @param {Object} startPos - Starting position
     * @returns {Object} Farthest position
     */
    getFarthestPositionFromStart(startPos) {
        let farthestPos = this.validPositions[0] || startPos;
        let maxDistance = 0;
        
        for (const pos of this.validPositions) {
            const distance = Phaser.Math.Distance.Between(startPos.x, startPos.y, pos.x, pos.y);
            if (distance > maxDistance) {
                maxDistance = distance;
                farthestPos = pos;
            }
        }
        
        return farthestPos;
    }

    /**
     * Check if there's space around position for multiple players
     * @param {Object} position - Center position
     * @param {number} playerCount - Number of players
     * @returns {boolean} Has enough space
     */
    checkSpaceForPlayers(position, playerCount) {
        // Check grid pattern around position
        for (let i = 0; i < playerCount; i++) {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const offsetX = (col - 1) * 40;
            const offsetY = row * 40 - 20;
            
            const testX = position.x + offsetX;
            const testY = position.y + offsetY;
            
            if (!this.isPositionOnTrack(testX, testY)) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Show start position indicator
     * @param {Object} position - Start position
     */
    showStartIndicator(position) {
        const indicator = this.add.circle(position.x, position.y, 50, 0x00ff00, 0.5);
        const text = this.add.text(position.x, position.y, 'START', {
            fontSize: '20px',
            fontFamily: 'Courier New',
            color: '#ffffff',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        this.managedCreateTween({
            targets: [indicator, text],
            alpha: 0,
            scale: 2,
            duration: 3000,
            onComplete: () => {
                indicator.destroy();
                text.destroy();
            }
        });
    }

    /**
     * Place bet on player
     * @param {number} playerIndex - Player to bet on
     */
    placeBet(playerIndex) {
        if (this.gamePhase !== 'betting') return;
        
        const betAmount = 100;
        this.playerBets.currentPlayer = playerIndex;
        this.playerBets.amount = betAmount;
        
        this.currentBetText.setText(`Your bet: P${playerIndex + 1} (${betAmount} coins)`);
        
        console.log(`[RaceScene] Bet placed on Player ${playerIndex + 1}`);
    }

    /**
     * Show race results
     * @param {Object} winner - Winning player
     */
    showRaceResults(winner) {
        let resultText = 'TIME UP! NO WINNER!';
        let resultColor = '#ff0000';
        
        if (winner) {
            const playerName = this.playerStats[winner.index]?.name || `Player ${winner.index + 1}`;
            resultText = `${playerName} WINS!`;
            resultColor = '#00ff00';
        }
        
        const resultsDisplay = this.add.text(960, 540, resultText, {
            fontSize: '72px',
            fontFamily: 'Courier New',
            color: resultColor,
            stroke: '#000000',
            strokeThickness: 6,
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        // Animate results using managed tween
        this.managedCreateTween({
            targets: resultsDisplay,
            scale: 1.2,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
        
        // Process betting results
        this.processBettingResults(winner);
        
        // Store for cleanup
        this.resultsDisplay = resultsDisplay;
    }

    /**
     * Process betting results
     * @param {Object} winner - Winning player
     */
    processBettingResults(winner) {
        if (!this.playerBets.currentPlayer === undefined) return;
        
        const betPlayer = this.playerBets.currentPlayer;
        const betAmount = this.playerBets.amount || 0;
        
        if (winner && betPlayer === winner.index) {
            // Player won their bet
            const payout = betAmount * 3;
            this.bettingStatusText.setText(`You won ${payout} coins!`);
            console.log(`[RaceScene] Player won bet: ${payout} coins`);
        } else {
            // Player lost their bet
            this.bettingStatusText.setText(`You lost ${betAmount} coins`);
            console.log(`[RaceScene] Player lost bet: ${betAmount} coins`);
        }
    }

    /**
     * Update player statistics
     * @param {Object} winner - Winning player
     */
    updatePlayerStatistics(winner) {
        // Update race count for all players
        Object.values(this.playerStats).forEach(stats => {
            stats.totalRaces++;
        });
        
        // Update winner stats
        if (winner && this.playerStats[winner.index]) {
            this.playerStats[winner.index].wins++;
        }
        
        // Update leaderboard display
        this.updateLeaderboardDisplay();
    }

    /**
     * Update leaderboard display
     */
    updateLeaderboardDisplay() {
        const sortedStats = Object.entries(this.playerStats)
            .map(([index, stats]) => ({
                index,
                ...stats,
                winRate: stats.totalRaces > 0 ? (stats.wins / stats.totalRaces * 100).toFixed(1) : '0.0'
            }))
            .sort((a, b) => b.wins - a.wins);
        
        let leaderboardText = '';
        sortedStats.slice(0, 6).forEach((stats, i) => {
            leaderboardText += `${i + 1}. ${stats.name}\n`;
            leaderboardText += `   Wins: ${stats.wins} (${stats.winRate}%)\n`;
        });
        
        this.leaderboardText.setText(leaderboardText || 'No races completed');
    }

    /**
     * Reset for next race
     */
    resetForNextRace() {
        console.log('[RaceScene] Resetting for next race');
        
        this.gamePhase = 'resetting';
        this.raceNumber++;
        
        // Clean up results display
        if (this.resultsDisplay) {
            this.resultsDisplay.destroy();
            this.resultsDisplay = null;
        }
        
        // Reset players
        this.resetPlayers();
        
        // Clear items
        this.clearGameItems();
        
        // Respawn M token
        this.spawnMToken();
        
        // Start new betting phase using managed timeout
        this.managedSetTimeout(() => {
            this.startBettingPhase();
        }, 1000);
        
        // Update race number display
        const raceNumText = this.children.list.find(child => 
            child.type === 'Text' && child.text && child.text.includes('Race #')
        );
        if (raceNumText) {
            raceNumText.setText(`Race #${this.raceNumber}`);
        }
    }

    /**
     * Reset all players to new starting position
     */
    resetPlayers() {
        // Get new start position
        let newStartPosition = this.getRandomValidPosition();
        let attempts = 0;
        
        while (attempts < 50) {
            const hasSpace = this.checkSpaceForPlayers(newStartPosition, this.players.length);
            if (hasSpace) break;
            
            newStartPosition = this.getRandomValidPosition();
            attempts++;
        }
        
        // Reset each player
        this.players.forEach((player, i) => {
            if (!player) return;
            
            // Calculate new position
            const col = i % 3;
            const row = Math.floor(i / 3);
            const offsetX = (col - 1) * 40;
            const offsetY = row * 40 - 20;
            
            player.x = newStartPosition.x + offsetX;
            player.y = newStartPosition.y + offsetY;
            
            // Reset player state
            player.currentSpeed = player.baseSpeed;
            player.speedMultiplier = 1;
            player.moveDirection = this.rng.random() * Math.PI * 2;
            player.stuckCounter = 0;
            player.lastPositions = [];
            
            // Clear status effects
            player.paralyzed = false;
            player.burning = false;
            player.hasBubble = false;
            player.magnetized = false;
            player.clearTint();
            player.setVelocity(0, 0);
            
            // Reset scale
            player.setScale(0.25);
            
            // Update name text
            if (player.nameText) {
                player.nameText.x = player.x;
                player.nameText.y = player.y + 25;
            }
        });
        
        // Show new start indicator
        this.showStartIndicator(newStartPosition);
    }

    /**
     * Clear all game items
     */
    clearGameItems() {
        // Clear boosters
        this.boosters.forEach(booster => {
            if (booster && booster.active) {
                booster.destroy();
            }
        });
        this.boosters = [];
        
        // Clear skills
        this.skills.forEach(skill => {
            if (skill && skill.active) {
                skill.destroy();
            }
        });
        this.skills = [];
    }

    /**
     * Set betting UI enabled state
     * @param {boolean} enabled - UI enabled state
     */
    setBettingUIEnabled(enabled) {
        // In a full implementation, this would enable/disable betting buttons
        console.log(`[RaceScene] Betting UI ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Set debug panel visibility
     * @param {boolean} visible - Panel visibility
     */
    setDebugPanelVisible(visible) {
        if (this.debugPanel) {
            this.debugPanel.background.setVisible(visible);
            this.debugPanel.title.setVisible(visible);
            this.debugPanel.contentText.setVisible(visible);
        }
    }

    /**
     * Update debug information
     */
    updateDebugInfo() {
        if (!this.debugMode || !this.debugText || this.players.length === 0) return;
        
        const player = this.players[0]; // Show info for first player
        
        let debugInfo = `Phase: ${this.gamePhase}\n`;
        debugInfo += `Time: ${this.gameTime}s\n`;
        debugInfo += `Players: ${this.players.length}\n`;
        debugInfo += `Boosters: ${this.boosters.length}\n`;
        debugInfo += `Skills: ${this.skills.length}\n`;
        
        if (player) {
            debugInfo += `\nPlayer 1:\n`;
            debugInfo += `Pos: ${Math.floor(player.x)}, ${Math.floor(player.y)}\n`;
            debugInfo += `Speed: ${player.currentSpeed.toFixed(2)}\n`;
            debugInfo += `Direction: ${player.moveDirection.toFixed(2)}\n`;
            debugInfo += `Stuck: ${player.stuckCounter}\n`;
            debugInfo += `On Track: ${this.isPositionOnTrack(player.x, player.y) ? 'Yes' : 'No'}`;
        }
        
        this.debugText.setText(debugInfo);
    }

    /**
     * Return to lobby/menu
     */
    returnToLobby() {
        console.log('[RaceScene] Returning to lobby');
        
        // Clean up
        this.sound.stopAll();
        
        // Return to appropriate scene
        if (this.gameData.isQuickPlay) {
            this.scene.start('MainMenuScene');
        } else {
            this.scene.start('LobbyScene', {
                roomData: this.gameData,
                isHost: this.gameData.isHost || false
            });
        }
    }

    /**
     * Scene cleanup
     */
    /**
     * Handle authentication context ready (override from AuthenticatedScene)
     */
    onAuthContextReady(userContext, isAuthenticated) {
        console.log('[RaceScene] Auth context ready:', { isAuthenticated, username: userContext?.username });
        // Update player identification in race
        this.updatePlayerIdentification();
    }
    
    /**
     * Handle user context updates (override from AuthenticatedScene)
     */
    onUserContextUpdate(userData) {
        console.log('[RaceScene] User context updated:', userData?.username);
        // Update player display when user data changes
        this.updatePlayerIdentification();
    }
    
    /**
     * Handle auth state changes (override from AuthenticatedScene)
     */
    onAuthStateChange(stateChange) {
        console.log('[RaceScene] Auth state changed:', stateChange.type);
        if (stateChange.type === 'logout' || stateChange.type === 'session_expired') {
            // Return to main menu on logout
            this.scene.start('MainMenuScene');
        }
    }
    
    /**
     * Update player identification with authenticated user data
     */
    updatePlayerIdentification() {
        const username = this.getUsername() || 'Guest';
        const userId = this.getUserId();
        
        // Update player data if available
        if (this.players && this.players.length > 0) {
            // Find the current player and update their identification
            const currentPlayer = this.players.find(p => p.isCurrentPlayer);
            if (currentPlayer) {
                currentPlayer.username = username;
                currentPlayer.userId = userId;
            }
        }
    }
    
    /**
     * Scene cleanup (enhanced with AuthenticatedScene cleanup)
     */
    destroy() {
        console.log('[RaceScene] Starting scene destruction with memory cleanup');
        
        // Stop all sounds
        this.sound.stopAll();
        
        // Clean up memory-managed resources
        if (this.memoryManager) {
            this.memoryManager.destroy();
        }
        
        // Clean up timers and tweens (fallback for any unmanaged resources)
        this.tweens.killAll();
        this.time.removeAllEvents();
        
        console.log('[RaceScene] Scene destroyed with memory cleanup');
        // Call parent destroy for auth cleanup
        super.destroy();
    }
}