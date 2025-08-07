/**
 * PreloadScene.js - Asset Loading Scene for Memex Racing
 * 
 * Handles loading all game assets and programmatically creates pixel art sprites
 * for the retro racing game aesthetic.
 */

import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PreloadScene' });
    }

    preload() {
        console.log('[PreloadScene] Starting asset preload...');
        
        // Create loading text
        const loadingText = this.add.text(960, 540, 'Loading...', {
            fontSize: '32px',
            fontFamily: 'Courier New',
            color: '#00ff00',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        // Add debug text to show what's loading
        const debugText = this.add.text(960, 640, '', {
            fontSize: '16px',
            fontFamily: 'Courier New',
            color: '#ffff00'
        }).setOrigin(0.5);

        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        
        // Progress bar background
        progressBox.fillStyle(0x222222);
        progressBox.fillRect(760, 580, 400, 50);
        
        // Progress bar fill
        progressBar.fillStyle(0x00ff00);

        // Update progress bar during loading
        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0x00ff00);
            progressBar.fillRect(760, 580, 400 * value, 50);
            
            // Update loading text with percentage
            const percentage = Math.round(value * 100);
            loadingText.setText(`Loading... ${percentage}%`);
        });
        
        // Track file loading
        this.load.on('fileprogress', (file) => {
            if (debugText) {
                debugText.setText(`Loading: ${file.key}`);
            }
        });

        this.load.on('complete', () => {
            console.log('[PreloadScene] Asset loading complete');
            loadingText.destroy();
            if (debugText) debugText.destroy();
            progressBar.destroy();
            progressBox.destroy();
        });

        // Create pixel art sprites programmatically
        this.createPixelSprites();
        
        // Load any external assets (sounds, etc.)
        this.loadExternalAssets();
    }

    create() {
        console.log('[PreloadScene] Create phase - transitioning to MainMenuScene');
        console.log('[PreloadScene] Environment:', process.env.NODE_ENV || 'production');
        console.log('[PreloadScene] Available textures:', Object.keys(this.textures.list));
        console.log('[PreloadScene] Available scenes:', this.scene.manager.keys);
        
        try {
            // Validate that MainMenuScene is available
            if (!this.scene.manager.keys.includes('MainMenuScene')) {
                console.error('[PreloadScene] MainMenuScene not found in scene manager!');
                console.log('[PreloadScene] Available scenes:', this.scene.manager.keys);
                throw new Error('MainMenuScene not found');
            }
            
            console.log('[PreloadScene] ✅ MainMenuScene found, starting transition...');
            
            // Add a small delay to ensure everything is ready
            this.time.delayedCall(100, () => {
                console.log('[PreloadScene] 🎬 Starting MainMenuScene transition...');
                
                // Fade out loading screen and transition to main menu
                this.cameras.main.fadeOut(500, 0, 0, 0);
                
                this.cameras.main.once('camerafadeoutcomplete', () => {
                    console.log('[PreloadScene] 🎭 Camera fade complete, starting MainMenuScene...');
                    this.scene.start('MainMenuScene');
                });
                
                // Fallback timeout in case fade doesn't complete
                this.time.delayedCall(1000, () => {
                    console.log('[PreloadScene] ⚠️ Fade timeout, forcing transition to MainMenuScene...');
                    this.scene.start('MainMenuScene');
                });
            });
            
        } catch (error) {
            console.error('[PreloadScene] ❌ Error in create phase:', error);
            console.error('[PreloadScene] Error stack:', error.stack);
            
            // Try direct transition if fade fails
            console.log('[PreloadScene] 🔄 Attempting direct transition to MainMenuScene...');
            this.time.delayedCall(500, () => {
                this.scene.start('MainMenuScene');
            });
        }
    }

    /**
     * Create pixel art sprites programmatically
     */
    createPixelSprites() {
        const graphics = this.add.graphics();
        
        // Player sprites (128x128 for consistency)
        const playerColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
        playerColors.forEach((color, i) => {
            graphics.clear();
            graphics.fillStyle(color);
            
            // Create retro racing car sprite
            graphics.fillRect(32, 16, 64, 96);    // Main body
            graphics.fillRect(16, 48, 96, 48);     // Wings/sides
            graphics.fillRect(48, 0, 32, 32);      // Front/head
            
            // Add some details
            graphics.fillStyle(0xffffff);
            graphics.fillRect(56, 8, 16, 16);      // Windscreen
            graphics.fillRect(40, 112, 48, 8);     // Spoiler
            
            graphics.generateTexture(`player${i}`, 128, 128);
        });
        
        // M Token sprite (32x32)
        graphics.clear();
        graphics.fillStyle(0xffd700);
        graphics.fillRect(8, 0, 16, 32);   // Vertical bar of M
        graphics.fillRect(0, 8, 32, 16);   // Horizontal bar of M
        graphics.fillRect(12, 4, 8, 8);    // Center highlight
        graphics.generateTexture('mtoken', 32, 32);
        
        // Booster sprites (32x32)
        const boosterTypes = [
            { name: 'antenna', color: 0x00ff00 },
            { name: 'twitter', color: 0x1da1f2 },
            { name: 'memex', color: 0xff00ff },
            { name: 'poo', color: 0x8b4513 },
            { name: 'toilet_paper', color: 0xffffff },
            { name: 'toilet', color: 0x4169e1 },
            { name: 'banana', color: 0xffff00 },
            { name: 'king_kong', color: 0x800080 }
        ];
        
        boosterTypes.forEach((booster) => {
            graphics.clear();
            graphics.fillStyle(booster.color);
            graphics.fillCircle(16, 16, 12);
            
            // Add some detail based on type
            graphics.fillStyle(0xffffff);
            switch(booster.name) {
                case 'antenna':
                    graphics.fillRect(14, 8, 4, 16);
                    break;
                case 'banana':
                    graphics.fillRect(12, 12, 8, 4);
                    break;
                case 'poo':
                    graphics.fillCircle(16, 12, 4);
                    break;
                default:
                    graphics.fillCircle(16, 16, 6);
            }
            
            graphics.generateTexture(`booster_${booster.name}`, 32, 32);
        });
        
        // Skill sprites (32x32)
        const skillTypes = [
            { name: 'thunder', color: 0xffff00 },
            { name: 'fire', color: 0xff4500 },
            { name: 'bubble', color: 0x00bfff },
            { name: 'magnet', color: 0xff1493 },
            { name: 'teleport', color: 0x9400d3 }
        ];
        
        skillTypes.forEach((skill) => {
            graphics.clear();
            graphics.fillStyle(0x333333);
            graphics.fillRect(4, 4, 24, 24);
            
            graphics.fillStyle(skill.color);
            graphics.fillRect(8, 8, 16, 16);
            
            // Add skill-specific icons
            graphics.fillStyle(0xffffff);
            switch(skill.name) {
                case 'thunder':
                    graphics.fillRect(14, 8, 4, 8);
                    graphics.fillRect(12, 12, 8, 4);
                    break;
                case 'fire':
                    graphics.fillRect(12, 10, 8, 12);
                    break;
                case 'bubble':
                    graphics.fillCircle(16, 16, 6);
                    break;
                case 'magnet':
                    graphics.fillRect(12, 10, 8, 8);
                    graphics.fillRect(10, 12, 12, 4);
                    break;
                case 'teleport':
                    graphics.fillCircle(16, 16, 8);
                    graphics.fillStyle(skill.color);
                    graphics.fillCircle(16, 16, 4);
                    break;
            }
            
            graphics.generateTexture(`skill_${skill.name}`, 32, 32);
        });
        
        // UI Elements
        graphics.clear();
        graphics.fillStyle(0x00ff00);
        graphics.fillRoundedRect(0, 0, 200, 50, 8);
        graphics.fillStyle(0x000000);
        graphics.fillRoundedRect(4, 4, 192, 42, 4);
        graphics.generateTexture('button_green', 200, 50);
        
        graphics.clear();
        graphics.fillStyle(0xff0000);
        graphics.fillRoundedRect(0, 0, 200, 50, 8);
        graphics.fillStyle(0x000000);
        graphics.fillRoundedRect(4, 4, 192, 42, 4);
        graphics.generateTexture('button_red', 200, 50);
        
        graphics.clear();
        graphics.fillStyle(0x0000ff);
        graphics.fillRoundedRect(0, 0, 200, 50, 8);
        graphics.fillStyle(0x000000);
        graphics.fillRoundedRect(4, 4, 192, 42, 4);
        graphics.generateTexture('button_blue', 200, 50);
        
        graphics.destroy();
    }

    /**
     * Load external assets (sounds, images, etc.)
     */
    loadExternalAssets() {
        // Use production-friendly paths (webpack will copy assets to /assets/)
        const soundPath = '/assets/sounds/';
        const iconPath = '/assets/ui/icons/';
        const spritePath = '/assets/sprites/';
        
        // Set loading to not fail on missing files
        this.load.on('filecomplete', (key, type, data) => {
            console.log(`[PreloadScene] Loaded: ${key} (${type})`);
        });
        
        this.load.on('loaderror', (file) => {
            console.warn(`[PreloadScene] Failed to load: ${file.src} - Continuing without this asset`);
            // Don't let missing assets break the game
        });
        
        // Try to load actual sprite assets if they exist
        try {
            // Load player sprites if available
            this.load.image('player_pug', `${spritePath}players/default/cool_pug.png`);
            this.load.image('player_smoking', `${spritePath}players/default/Smoking_pug.png`);
            this.load.image('player_ice', `${spritePath}players/default/ice.png`);
            this.load.image('player_intern', `${spritePath}players/default/intern.png`);
            this.load.image('player_lv4', `${spritePath}players/default/lv4pug.png`);
            this.load.image('player_spike', `${spritePath}players/default/spike monster.png`);
            
            // Load booster sprites
            this.load.image('booster_banana_real', `${spritePath}boosters/banana.png`);
            this.load.image('booster_toilet_real', `${spritePath}boosters/toilet-paper.png`);
            this.load.image('booster_poo_real', `${spritePath}boosters/shit2.png`);
            this.load.image('booster_diamond_real', `${spritePath}boosters/diamondfist.png`);
            this.load.image('booster_crik_real', `${spritePath}boosters/Crik-cutout2.png`);
            
            // Load skill sprites
            this.load.image('skill_thunder_real', `${spritePath}skills/thuner.png`);
            this.load.image('skill_fire_real', `${spritePath}skills/fire.png`);
            this.load.image('skill_bubble_real', `${spritePath}skills/bubble.png`);
            this.load.image('skill_magnet_real', `${spritePath}skills/magnet.png`);
            this.load.image('skill_teleport_real', `${spritePath}skills/teleport.png`);
            
            // Load M token
            this.load.image('mtoken_real', `${iconPath}M token.png`);
            
            // Load UI panel
            this.load.image('ui_panel', `${spritePath}ui/panels/1500x500.jpeg`);
        } catch (error) {
            console.warn('[PreloadScene] Error setting up asset loading:', error);
            // Continue with programmatically generated assets
        }
        
        // Engine/race sounds - these may not exist yet
        if (!this.cache.audio.exists('engine_loop')) {
            // Try to load but don't fail if missing
            this.load.audio('engine_loop', [`${soundPath}engine.mp3`, `${soundPath}engine.ogg`]);
            this.load.audio('booster_collect', [`${soundPath}booster.mp3`, `${soundPath}booster.ogg`]);
            this.load.audio('skill_activate', [`${soundPath}skill.mp3`, `${soundPath}skill.ogg`]);
            this.load.audio('race_start', [`${soundPath}start.mp3`, `${soundPath}start.ogg`]);
            this.load.audio('race_win', [`${soundPath}win.mp3`, `${soundPath}win.ogg`]);
        }
    }

    /**
     * Create custom player sprite from uploaded image
     * @param {string} key - Texture key
     * @param {HTMLCanvasElement} canvas - Canvas with custom image
     */
    createCustomPlayerSprite(key, canvas) {
        if (this.textures.exists(key)) {
            this.textures.remove(key);
        }
        this.textures.addCanvas(key, canvas);
    }

    /**
     * Get list of available player sprites
     * @returns {Array} Array of sprite keys
     */
    getPlayerSpriteKeys() {
        const keys = [];
        for (let i = 0; i < 6; i++) {
            keys.push(`player${i}`);
        }
        return keys;
    }

    /**
     * Get list of available booster sprites
     * @returns {Array} Array of booster data
     */
    getBoosterTypes() {
        return [
            { name: 'antenna', key: 'booster_antenna', speedMultiplier: 1.5 },
            { name: 'twitter', key: 'booster_twitter', speedMultiplier: 1.4 },
            { name: 'memex', key: 'booster_memex', speedMultiplier: 1.6 },
            { name: 'poo', key: 'booster_poo', speedMultiplier: 0.8 },
            { name: 'toilet_paper', key: 'booster_toilet_paper', speedMultiplier: 1.3 },
            { name: 'toilet', key: 'booster_toilet', speedMultiplier: 1.2 },
            { name: 'banana', key: 'booster_banana', speedMultiplier: 1.7 },
            { name: 'king_kong', key: 'booster_king_kong', speedMultiplier: 2.0 }
        ];
    }

    /**
     * Get list of available skill types
     * @returns {Array} Array of skill data
     */
    getSkillTypes() {
        return [
            { name: 'thunder', key: 'skill_thunder', duration: 3000, description: 'Paralyze 3 random opponents' },
            { name: 'fire', key: 'skill_fire', duration: 5000, description: 'Burn 2 characters, causing slowdown' },
            { name: 'bubble', key: 'skill_bubble', duration: 8000, description: 'Bounce off other players' },
            { name: 'magnet', key: 'skill_magnet', duration: 5000, description: 'Attract to nearby racers' },
            { name: 'teleport', key: 'skill_teleport', duration: 0, description: 'Teleport all players randomly' }
        ];
    }
}