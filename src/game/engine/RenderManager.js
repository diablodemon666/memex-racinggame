/**
 * RenderManager.js - Rendering System for Memex Racing
 * 
 * Handles all visual rendering including:
 * - Pixel art sprite creation and management
 * - Track generation and map rendering
 * - Visual effects and UI elements
 * - Asset loading and caching
 * 
 * Extracted from claudeweb's rendering and graphics systems.
 * Updated to integrate with modular map generators.
 */

import { MapRotationManager } from '../maps/MapRotationManager.js';

/**
 * Render Manager Class
 * Manages all visual aspects of the game
 */
export class RenderManager {
  constructor(gameEngine) {
    this.gameEngine = gameEngine;
    
    // Initialize map rotation manager
    this.mapRotationManager = new MapRotationManager();
    
    // Visual configuration
    this.visualConfig = {
      playerSpriteSize: 128,
      tokenSpriteSize: 32,
      boosterSpriteSize: 32,
      skillSpriteSize: 32,
      playerScale: 0.25,
      effectDuration: 500,
    };

    // Map configurations
    this.mapConfigs = {
      classic: {
        name: "Classic Maze",
        description: "The original challenging maze",
        difficulty: "Medium",
        backgroundColor: 0x1a3a1a,
        trackColor: 0xffffff,
        generator: this.createClassicMazeTrack.bind(this)
      },
      speedway: {
        name: "Speed Circuit",
        description: "Wide tracks for high-speed racing",
        difficulty: "Easy",
        backgroundColor: 0x222222,
        trackColor: 0xffcc00,
        generator: this.createSpeedwayTrack.bind(this)
      },
      serpentine: {
        name: "Serpentine Path",
        description: "Winding snake-like track",
        difficulty: "Hard",
        backgroundColor: 0x0a0a2a,
        trackColor: 0x00ffff,
        generator: this.createSerpentineTrack.bind(this)
      },
      grid: {
        name: "Grid Lock",
        description: "City block style grid",
        difficulty: "Medium",
        backgroundColor: 0x2a2a2a,
        trackColor: 0xff00ff,
        generator: this.createGridTrack.bind(this)
      },
      spiral: {
        name: "Spiral Madness",
        description: "Hypnotic spiral track",
        difficulty: "Very Hard",
        backgroundColor: 0x2a0a0a,
        trackColor: 0xffff00,
        generator: this.createSpiralTrack.bind(this)
      },
      islands: {
        name: "Island Hopper",
        description: "Connected island tracks",
        difficulty: "Medium",
        backgroundColor: 0x0a2a2a,
        trackColor: 0x00ff00,
        generator: this.createIslandsTrack.bind(this)
      }
    };

    // Player colors
    this.playerColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
    
    // Custom player images storage
    this.customPlayerImages = {};
    
    console.log('[RenderManager] Initialized with visual systems');
  }

  /**
   * Initialize scene rendering
   */
  initializeScene(scene) {
    this.scene = scene;
    
    // Set background color based on current map
    const currentMapData = this.mapRotationManager.getCurrentMap();
    scene.cameras.main.setBackgroundColor(currentMapData.config.backgroundColor);
    
    // Display track
    const track = scene.add.image(960, 540, 'track');
    this.trackSprite = track;
    
    console.log('[RenderManager] Scene rendering initialized');
  }

  /**
   * Update rendering system
   */
  update(time, delta) {
    // Update visual effects, animations, etc.
    // This can be extended for particle effects, screen shake, etc.
  }

  /**
   * Preload all game assets
   */
  preloadAssets(scene) {
    // Create pixel art sprites
    this.createPixelSprites(scene);
    
    // Generate current map track using rotation manager
    this.mapRotationManager.generateCurrentTrack(scene);
    
    console.log('[RenderManager] Assets preloaded');
  }

  /**
   * Create pixel art sprites
   */
  createPixelSprites(scene) {
    const graphics = scene.add.graphics();
    
    // Create player sprites (128x128 for consistency)
    this.playerColors.forEach((color, i) => {
      graphics.fillStyle(color);
      // Larger sprite design for better visibility
      graphics.fillRect(32, 16, 64, 96);    // Body
      graphics.fillRect(16, 48, 96, 48);     // Wings/sides
      graphics.fillRect(48, 0, 32, 32);      // Head
      graphics.generateTexture(`player${i}`, this.visualConfig.playerSpriteSize, this.visualConfig.playerSpriteSize);
      graphics.clear();
    });
    
    // M Token (32x32)
    graphics.fillStyle(0xffd700);
    graphics.fillRect(8, 0, 16, 32);
    graphics.fillRect(0, 8, 32, 16);
    graphics.generateTexture('mtoken', this.visualConfig.tokenSpriteSize, this.visualConfig.tokenSpriteSize);
    graphics.clear();
    
    // Boosters (32x32)
    this.gameEngine.physicsManager.boosterTypes.forEach((booster) => {
      graphics.fillStyle(booster.color);
      graphics.fillCircle(16, 16, 12);
      graphics.generateTexture(`booster_${booster.name}`, this.visualConfig.boosterSpriteSize, this.visualConfig.boosterSpriteSize);
      graphics.clear();
    });
    
    // Skills base (32x32)
    graphics.fillStyle(0xffffff);
    graphics.fillRect(4, 4, 24, 24);
    graphics.generateTexture('skill_base', this.visualConfig.skillSpriteSize, this.visualConfig.skillSpriteSize);
    graphics.clear();
    
    graphics.destroy();
    
    console.log('[RenderManager] Pixel sprites created');
  }

  /**
   * Create player sprite with physics body
   */
  createPlayerSprite(index, position, isAI = false, aiData = null) {
    // Determine sprite key
    let spriteKey = `player${index}`;
    
    // Handle AI player sprites
    if (isAI && aiData && aiData.asset) {
      if (aiData.asset.type === 'default') {
        // Use AI player sprite from asset pool
        const aiSpriteKey = `ai_player_${aiData.asset.name}`;
        
        // Load the AI sprite if not already loaded
        if (!this.scene.textures.exists(aiSpriteKey) && aiData.asset.path) {
          try {
            // This would be loaded via AssetManager in production
            this.scene.load.image(aiSpriteKey, aiData.asset.path);
            this.scene.load.start();
          } catch (error) {
            console.warn(`[RenderManager] Failed to load AI sprite: ${aiData.asset.path}`, error);
          }
        }
        
        if (this.scene.textures.exists(aiSpriteKey)) {
          spriteKey = aiSpriteKey;
        }
      } else if (aiData.asset.type === 'generated') {
        // Create colored sprite for AI
        const aiCanvasKey = `ai_generated_${index}`;
        if (!this.scene.textures.exists(aiCanvasKey)) {
          const canvas = this.createColoredPlayerCanvas(aiData.asset.color || '#00FFFF');
          this.scene.textures.addCanvas(aiCanvasKey, canvas);
        }
        spriteKey = aiCanvasKey;
      }
    }
    
    // Check for custom image (human players)
    else if (this.customPlayerImages[index]) {
      const customKey = `custom_player${index}`;
      if (this.customPlayerImages[index] instanceof HTMLCanvasElement && !this.scene.textures.exists(customKey)) {
        this.scene.textures.addCanvas(customKey, this.customPlayerImages[index]);
      }
      if (this.scene.textures.exists(customKey)) {
        spriteKey = customKey;
      }
    }
    
    // Create sprite with physics
    const sprite = this.scene.physics.add.sprite(position.x, position.y, spriteKey);
    sprite.setScale(this.visualConfig.playerScale);
    sprite.setOrigin(0.5, 0.5);
    
    // Set physics body
    sprite.body.setSize(48, 48); // Smaller collision box for better navigation
    sprite.body.enable = true;
    sprite.body.setOffset(40, 40); // Center the collision box
    sprite.setVelocity(0, 0);
    
    // Add player name with AI indicator
    let displayName = isAI && aiData ? aiData.name : this.getPlayerName(index);
    
    // Add AI indicator if configured
    const aiConfig = this.gameEngine.configManager.get('ai-players.appearance', {});
    if (isAI && aiConfig.showAIIndicator) {
      const prefix = aiConfig.aiIndicatorText || '[AI]';
      displayName = `${prefix} ${displayName}`;
    }
    
    const isCurrentPlayer = index === this.gameEngine.currentPlayerIndex || 3; // Default to player 4
    const textColor = isAI ? (aiConfig.aiIndicatorColor || '#00FFFF') : 
                     (isCurrentPlayer ? '#ffff00' : '#ffffff');
    
    const nameText = this.scene.add.text(position.x, position.y + 20, displayName, {
      fontSize: isCurrentPlayer ? '14px' : '12px',
      fontFamily: 'Courier New',
      color: textColor,
      stroke: '#000000',
      strokeThickness: isCurrentPlayer ? 3 : 2
    }).setOrigin(0.5);
    
    return {
      sprite: sprite,
      nameText: nameText,
      body: sprite.body,
      setTexture: (key) => sprite.setTexture(key),
      setScale: (scale) => sprite.setScale(scale),
      setTint: (tint) => sprite.setTint(tint),
      clearTint: () => sprite.clearTint(),
    };
  }

  /**
   * Get player name with fallback
   */
  getPlayerName(index) {
    // This would normally come from player data
    return `P${index + 1}`;
  }

  /**
   * Create colored canvas for AI players
   */
  createColoredPlayerCanvas(color) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // Convert hex color to RGB
    const hexColor = color.replace('#', '');
    const r = parseInt(hexColor.substr(0, 2), 16);
    const g = parseInt(hexColor.substr(2, 2), 16);
    const b = parseInt(hexColor.substr(4, 2), 16);
    
    // Draw pixel art player with AI styling
    const pixelSize = 8;
    const playerPattern = [
      [0,0,1,1,1,1,0,0],
      [0,1,2,2,2,2,1,0],
      [1,2,3,2,2,3,2,1],
      [1,2,2,2,2,2,2,1],
      [1,2,1,1,1,1,2,1],
      [0,1,2,2,2,2,1,0],
      [0,0,1,2,2,1,0,0],
      [0,0,1,1,1,1,0,0]
    ];
    
    // Draw with shading
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const value = playerPattern[y][x];
        if (value > 0) {
          const brightness = value / 3;
          const pr = Math.floor(r * brightness);
          const pg = Math.floor(g * brightness);
          const pb = Math.floor(b * brightness);
          
          ctx.fillStyle = `rgb(${pr}, ${pg}, ${pb})`;
          ctx.fillRect(
            x * pixelSize + 32,
            y * pixelSize + 32,
            pixelSize,
            pixelSize
          );
        }
      }
    }
    
    // Add AI marker (small circuit pattern)
    ctx.fillStyle = '#00FFFF';
    ctx.fillRect(96, 32, 16, 16);
    ctx.fillStyle = '#004444';
    ctx.fillRect(100, 36, 8, 8);
    
    return canvas;
  }

  /**
   * Create booster sprite
   */
  createBooster(scene) {
    const position = this.gameEngine.physicsManager.getRandomValidPosition();
    const boosterType = this.gameEngine.physicsManager.boosterTypes[
      Math.floor(Math.random() * this.gameEngine.physicsManager.boosterTypes.length)
    ];
    
    const booster = scene.physics.add.sprite(position.x, position.y, `booster_${boosterType.name}`);
    booster.setScale(0.6);
    booster.boosterType = boosterType;
    
    // Glowing animation
    scene.tweens.add({
      targets: booster,
      alpha: 0.5,
      duration: 500,
      yoyo: true,
      repeat: -1
    });
    
    return booster;
  }

  /**
   * Create skill sprite
   */
  createSkill(scene) {
    const position = this.gameEngine.physicsManager.getRandomValidPosition();
    const skillType = this.gameEngine.physicsManager.skillTypes[
      Math.floor(Math.random() * this.gameEngine.physicsManager.skillTypes.length)
    ];
    
    const skill = scene.physics.add.sprite(position.x, position.y - 200, 'skill_base');
    skill.setScale(0.6);
    skill.skillType = skillType;
    skill.setTint(skillType.color);
    skill.setVelocityY(100); // Drop from above
    
    // Auto-destroy after 5 seconds
    scene.time.delayedCall(5000, () => {
      if (skill && skill.active) {
        skill.destroy();
      }
    });
    
    return skill;
  }

  /**
   * Show booster collection effect
   */
  showBoosterEffect(player, booster) {
    const scene = this.scene;
    const currentScale = player.scaleX || this.visualConfig.playerScale;
    
    // Scale animation
    scene.tweens.add({
      targets: player,
      scaleX: currentScale * 1.5,
      scaleY: currentScale * 1.5,
      duration: 200,
      yoyo: true
    });
    
    // Particle effect
    const particles = scene.add.particles(player.x, player.y, 'booster_' + booster.boosterType.name, {
      speed: { min: 50, max: 100 },
      scale: { start: 0.3, end: 0 },
      lifespan: 300,
      quantity: 5
    });
    
    scene.time.delayedCall(300, () => particles.destroy());
  }

  /**
   * Show skill activation effect
   */
  showSkillEffect(player, skill) {
    const scene = this.scene;
    
    // Flash effect
    const flash = scene.add.circle(player.x, player.y, 50, skill.skillType.color, 0.5);
    scene.tweens.add({
      targets: flash,
      scale: 2,
      alpha: 0,
      duration: this.visualConfig.effectDuration,
      onComplete: () => flash.destroy()
    });
  }

  /**
   * Show teleport effect
   */
  showTeleportEffect(x, y) {
    const scene = this.scene;
    
    const teleportEffect = scene.add.circle(x, y, 30, 0xff00ff, 0.5);
    scene.tweens.add({
      targets: teleportEffect,
      scale: 2,
      alpha: 0,
      duration: this.visualConfig.effectDuration,
      onComplete: () => teleportEffect.destroy()
    });
  }

  /**
   * Create UI elements
   */
  createUI(scene) {
    // Timer text
    scene.timerText = scene.add.text(960, 50, 'TIME: 5:00', {
      fontSize: '48px',
      fontFamily: 'Courier New',
      color: '#00ff00',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);
    
    // Map name display with rotation status
    const rotationStatus = this.mapRotationManager.getRotationStatusText();
    scene.mapText = scene.add.text(960, 100, rotationStatus, {
      fontSize: '24px',
      fontFamily: 'Courier New',
      color: '#ffff00',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    
    console.log('[RenderManager] UI elements created');
  }

  /**
   * Load custom player images
   */
  loadCustomPlayerImages(scene) {
    // This would be called to load any custom player images
    // Implementation depends on how custom images are stored
    console.log('[RenderManager] Custom player images loaded');
  }

  /**
   * Load dynamic map visuals from track template combination
   * @param {Object} combination - Map combination data
   */
  async loadDynamicMapVisuals(combination) {
    if (!this.scene || !combination) {
      console.warn('[RenderManager] Cannot load dynamic map visuals - missing scene or combination');
      return false;
    }

    try {
      // Clear existing map visuals
      this.clearMapVisuals();

      // Load and composite the background + track template
      await this.compositeMapVisuals(combination);

      // Update map display name
      this.updateMapDisplayName(combination);

      console.log(`[RenderManager] Loaded dynamic map visuals: ${combination.template.name} + ${combination.background.name}`);
      return true;
    } catch (error) {
      console.error('[RenderManager] Failed to load dynamic map visuals:', error);
      return false;
    }
  }

  /**
   * Clear existing map visuals
   */
  clearMapVisuals() {
    // Remove existing map background and foreground
    if (this.scene.mapBackground) {
      this.scene.mapBackground.destroy();
      this.scene.mapBackground = null;
    }
    
    if (this.scene.mapForeground) {
      this.scene.mapForeground.destroy();
      this.scene.mapForeground = null;
    }

    if (this.scene.trackOverlay) {
      this.scene.trackOverlay.destroy();
      this.scene.trackOverlay = null;
    }
  }

  /**
   * Composite background image with track template
   * @param {Object} combination - Map combination data
   */
  async compositeMapVisuals(combination) {
    const scene = this.scene;

    // Create background image
    if (combination.background && combination.background.path) {
      // In production, this would load the actual image file
      // For now, create a mock background
      const backgroundKey = `bg_${combination.background.id}`;
      this.createMockBackground(scene, backgroundKey, combination.background);
      
      scene.mapBackground = scene.add.image(2000, 1000, backgroundKey);
      scene.mapBackground.setOrigin(0.5, 0.5);
      scene.mapBackground.setDepth(-100); // Behind everything
      scene.mapBackground.setScale(1);
    }

    // Create track overlay from template
    if (combination.template && combination.template.path) {
      // In production, this would load the actual PNG template
      // For now, create a mock track overlay
      const trackKey = `track_${combination.template.id}`;
      this.createMockTrackOverlay(scene, trackKey, combination.template);
      
      scene.trackOverlay = scene.add.image(2000, 1000, trackKey);
      scene.trackOverlay.setOrigin(0.5, 0.5);
      scene.trackOverlay.setDepth(-90); // Above background, below game objects
      scene.trackOverlay.setAlpha(0.8); // Slightly transparent for visual effect
    }
  }

  /**
   * Create mock background for development
   */
  createMockBackground(scene, key, backgroundData) {
    const graphics = scene.add.graphics();
    
    // Create background based on theme
    const colors = this.getThemeColors(backgroundData.theme || 'space');
    
    // Gradient background
    graphics.fillGradientStyle(colors.primary, colors.primary, colors.secondary, colors.secondary);
    graphics.fillRect(0, 0, 4000, 2000);
    
    // Add theme-specific elements
    if (backgroundData.theme === 'space') {
      // Add stars
      graphics.fillStyle(0xFFFFFF);
      for (let i = 0; i < 200; i++) {
        const x = Math.random() * 4000;
        const y = Math.random() * 2000;
        const size = Math.random() * 3 + 1;
        graphics.fillCircle(x, y, size);
      }
    } else if (backgroundData.theme === 'nature') {
      // Add trees/vegetation patterns
      graphics.fillStyle(0x228B22);
      for (let i = 0; i < 50; i++) {
        const x = Math.random() * 4000;
        const y = Math.random() * 2000;
        graphics.fillCircle(x, y, Math.random() * 20 + 10);
      }
    }
    
    graphics.generateTexture(key, 4000, 2000);
    graphics.destroy();
  }

  /**
   * Create mock track overlay for development
   */
  createMockTrackOverlay(scene, key, templateData) {
    const graphics = scene.add.graphics();
    
    // Set track color (white for visibility)
    graphics.fillStyle(0xFFFFFF);
    graphics.lineStyle(4, 0xFFFFFF, 1);
    
    // Generate track based on template features
    if (templateData.features.includes('oval')) {
      // Draw oval track
      const centerX = 2000;
      const centerY = 1000;
      const radiusX = 1500;
      const radiusY = 600;
      const thickness = 100;
      
      graphics.fillEllipse(centerX, centerY, radiusX * 2, radiusY * 2);
      graphics.fillStyle(0x000000, 0); // Transparent
      graphics.fillEllipse(centerX, centerY, (radiusX - thickness) * 2, (radiusY - thickness) * 2);
    } else if (templateData.features.includes('maze')) {
      // Draw maze pattern
      this.drawMazePattern(graphics);
    } else if (templateData.features.includes('spiral')) {
      // Draw spiral track
      this.drawSpiralPattern(graphics);
    } else {
      // Default: simple horizontal track
      graphics.fillRect(200, 900, 3600, 200);
    }
    
    graphics.generateTexture(key, 4000, 2000);
    graphics.destroy();
  }

  /**
   * Get theme colors for backgrounds
   */
  getThemeColors(theme) {
    const themes = {
      'space': { primary: 0x000033, secondary: 0x000066 },
      'sci-fi': { primary: 0x001122, secondary: 0x003344 },
      'nature': { primary: 0x228B22, secondary: 0x006400 },
      'cyberpunk': { primary: 0x2D1B69, secondary: 0xFF00FF },
      'aquatic': { primary: 0x006994, secondary: 0x0099CC },
      'extreme': { primary: 0x8B0000, secondary: 0xFF4500 }
    };
    
    return themes[theme] || themes['space'];
  }

  /**
   * Draw maze pattern for development
   */
  drawMazePattern(graphics) {
    // Simple maze pattern
    const cellSize = 100;
    for (let x = 0; x < 40; x++) {
      for (let y = 0; y < 20; y++) {
        if ((x + y) % 3 === 0 && Math.random() > 0.3) {
          graphics.fillRect(x * cellSize, y * cellSize, cellSize - 10, cellSize - 10);
        }
      }
    }
  }

  /**
   * Draw spiral pattern for development
   */
  drawSpiralPattern(graphics) {
    const centerX = 2000;
    const centerY = 1000;
    let radius = 50;
    let angle = 0;
    
    graphics.beginPath();
    graphics.moveTo(centerX, centerY);
    
    while (radius < 800) {
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      graphics.lineTo(x, y);
      
      angle += 0.1;
      radius += 1;
    }
    
    graphics.strokePath();
  }

  /**
   * Update map display name in UI
   */
  updateMapDisplayName(combination) {
    if (this.scene && this.scene.mapText) {
      const displayName = `${combination.template.name} (${combination.background.name})`;
      this.scene.mapText.setText(`Track: ${displayName}`);
    }
  }

  /**
   * Update timer display
   */
  updateTimerDisplay(timeRemaining) {
    if (this.scene && this.scene.timerText) {
      const minutes = Math.floor(timeRemaining / 60);
      const seconds = timeRemaining % 60;
      this.scene.timerText.setText(`TIME: ${minutes}:${seconds.toString().padStart(2, '0')}`);
    }
  }

  /**
   * Show win/lose message
   */
  showGameEndMessage(message, color = '#ffff00') {
    if (!this.scene) return;
    
    const text = this.scene.add.text(960, 540, message, {
      fontSize: '96px',
      fontFamily: 'Courier New',
      color: color,
      stroke: '#000000',
      strokeThickness: 8
    }).setOrigin(0.5);
    
    this.scene.tweens.add({
      targets: text,
      scale: 1.2,
      duration: 500,
      yoyo: true,
      repeat: -1
    });
    
    return text;
  }

  /**
   * Track Generation Functions
   */
  
  createClassicMazeTrack(scene) {
    const graphics = scene.add.graphics();
    const config = this.mapConfigs.classic;
    
    graphics.fillStyle(config.backgroundColor);
    graphics.fillRect(0, 0, 1920, 1080);
    
    graphics.fillStyle(config.trackColor);
    
    // Main corridors (made wider for better navigation)
    graphics.fillRect(70, 170, 1780, 120);
    graphics.fillRect(70, 480, 1780, 120);
    graphics.fillRect(70, 780, 1780, 120);
    
    // Vertical connections
    graphics.fillRect(70, 170, 120, 730);
    graphics.fillRect(270, 170, 120, 430);
    graphics.fillRect(470, 270, 120, 330);
    graphics.fillRect(670, 170, 120, 430);
    graphics.fillRect(870, 270, 120, 530);
    graphics.fillRect(1070, 170, 120, 630);
    graphics.fillRect(1270, 270, 120, 330);
    graphics.fillRect(1470, 170, 120, 730);
    graphics.fillRect(1730, 170, 120, 730);
    
    // Bridges
    graphics.fillRect(270, 330, 240, 90);
    graphics.fillRect(670, 330, 240, 90);
    graphics.fillRect(470, 630, 440, 90);
    graphics.fillRect(1070, 380, 240, 90);
    graphics.fillRect(1270, 630, 240, 90);
    
    graphics.generateTexture('track', 1920, 1080);
    graphics.destroy();
  }

  createSpeedwayTrack(scene) {
    const graphics = scene.add.graphics();
    const config = this.mapConfigs.speedway;
    
    graphics.fillStyle(config.backgroundColor);
    graphics.fillRect(0, 0, 1920, 1080);
    
    graphics.fillStyle(config.trackColor);
    
    // Outer track
    graphics.fillRect(100, 100, 1720, 150);  // Top
    graphics.fillRect(100, 830, 1720, 150);  // Bottom
    graphics.fillRect(100, 100, 150, 880);   // Left
    graphics.fillRect(1670, 100, 150, 880);  // Right
    
    // Inner obstacles
    graphics.fillRect(400, 400, 1120, 100);
    graphics.fillRect(400, 580, 1120, 100);
    graphics.fillRect(400, 400, 100, 280);
    graphics.fillRect(1420, 400, 100, 280);
    
    graphics.generateTexture('track', 1920, 1080);
    graphics.destroy();
  }

  createSerpentineTrack(scene) {
    const graphics = scene.add.graphics();
    const config = this.mapConfigs.serpentine;
    
    graphics.fillStyle(config.backgroundColor);
    graphics.fillRect(0, 0, 1920, 1080);
    
    graphics.fillStyle(config.trackColor);
    
    // Create winding path
    const pathWidth = 140;
    const amplitude = 300;
    const frequency = 0.003;
    
    for (let x = 50; x < 1870; x += 5) {
      const y = 540 + Math.sin(x * frequency) * amplitude;
      graphics.fillRect(x, y - pathWidth/2, 10, pathWidth);
    }
    
    // Add connecting paths
    graphics.fillRect(50, 240, 100, 600);
    graphics.fillRect(1770, 240, 100, 600);
    
    graphics.generateTexture('track', 1920, 1080);
    graphics.destroy();
  }

  createGridTrack(scene) {
    const graphics = scene.add.graphics();
    const config = this.mapConfigs.grid;
    
    graphics.fillStyle(config.backgroundColor);
    graphics.fillRect(0, 0, 1920, 1080);
    
    graphics.fillStyle(config.trackColor);
    
    // City block grid
    const blockSize = 200;
    const streetWidth = 100;
    
    // Horizontal streets
    for (let y = 100; y < 1000; y += blockSize) {
      graphics.fillRect(50, y, 1820, streetWidth);
    }
    
    // Vertical streets
    for (let x = 150; x < 1800; x += blockSize) {
      graphics.fillRect(x, 50, streetWidth, 980);
    }
    
    // Remove some intersections for variety
    graphics.fillStyle(config.backgroundColor);
    graphics.fillRect(350, 300, 100, 100);
    graphics.fillRect(750, 300, 100, 100);
    graphics.fillRect(550, 500, 100, 100);
    
    graphics.generateTexture('track', 1920, 1080);
    graphics.destroy();
  }

  createSpiralTrack(scene) {
    const graphics = scene.add.graphics();
    const config = this.mapConfigs.spiral;
    
    graphics.fillStyle(config.backgroundColor);
    graphics.fillRect(0, 0, 1920, 1080);
    
    // Create spiral path
    const centerX = 960;
    const centerY = 540;
    const pathWidth = 100;
    
    graphics.lineStyle(pathWidth, config.trackColor);
    graphics.beginPath();
    
    for (let angle = 0; angle < Math.PI * 12; angle += 0.05) {
      const radius = angle * 40;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      if (x > 50 && x < 1870 && y > 50 && y < 1030) {
        if (angle === 0) {
          graphics.moveTo(x, y);
        } else {
          graphics.lineTo(x, y);
        }
      }
    }
    
    graphics.strokePath();
    
    // Add entrance path
    graphics.fillStyle(config.trackColor);
    graphics.fillRect(centerX - pathWidth/2, centerY - pathWidth/2, pathWidth, 540);
    
    graphics.generateTexture('track', 1920, 1080);
    graphics.destroy();
  }

  createIslandsTrack(scene) {
    const graphics = scene.add.graphics();
    const config = this.mapConfigs.islands;
    
    graphics.fillStyle(config.backgroundColor);
    graphics.fillRect(0, 0, 1920, 1080);
    
    graphics.fillStyle(config.trackColor);
    
    // Create connected islands
    graphics.fillCircle(300, 300, 150);
    graphics.fillCircle(800, 200, 120);
    graphics.fillCircle(1300, 300, 140);
    graphics.fillCircle(1600, 500, 130);
    graphics.fillCircle(1300, 780, 150);
    graphics.fillCircle(800, 880, 120);
    graphics.fillCircle(300, 780, 140);
    graphics.fillCircle(600, 540, 100);
    graphics.fillCircle(1000, 540, 110);
    
    // Bridges connecting islands
    graphics.fillRect(300, 280, 500, 80);
    graphics.fillRect(800, 180, 500, 80);
    graphics.fillRect(1300, 300, 300, 80);
    graphics.fillRect(1550, 500, 80, 280);
    graphics.fillRect(1300, 750, 300, 80);
    graphics.fillRect(800, 830, 500, 80);
    graphics.fillRect(300, 750, 500, 80);
    graphics.fillRect(250, 300, 80, 480);
    graphics.fillRect(600, 500, 400, 80);
    
    graphics.generateTexture('track', 1920, 1080);
    graphics.destroy();
  }

  /**
   * Advance to next race and handle map rotation
   */
  advanceRace() {
    const rotationResult = this.mapRotationManager.advanceRace();
    
    if (rotationResult.mapRotated) {
      this.regenerateTrack();
      console.log(`[RenderManager] Map rotated to: ${rotationResult.currentMap.config.name}`);
    }
    
    return rotationResult;
  }

  /**
   * Regenerate track for map changes
   */
  regenerateTrack() {
    if (!this.scene) return;
    
    const currentMapData = this.mapRotationManager.getCurrentMap();
    
    // Clear existing track texture
    if (this.scene.textures.exists('track')) {
      this.scene.textures.remove('track');
    }
    
    // Generate new track using rotation manager
    this.mapRotationManager.generateCurrentTrack(this.scene);
    
    // Update background color
    this.scene.cameras.main.setBackgroundColor(currentMapData.config.backgroundColor);
    
    // Redraw track sprite
    if (this.trackSprite) {
      this.trackSprite.destroy();
    }
    this.trackSprite = this.scene.add.image(960, 540, 'track');
    
    // Update map text
    if (this.scene.mapText) {
      const rotationStatus = this.mapRotationManager.getRotationStatusText();
      this.scene.mapText.setText(rotationStatus);
    }
    
    console.log(`[RenderManager] Track regenerated for map: ${currentMapData.config.name}`);
  }

  /**
   * Store custom player image
   */
  setCustomPlayerImage(index, canvas) {
    this.customPlayerImages[index] = canvas;
    console.log(`[RenderManager] Custom image set for player ${index + 1}`);
  }

  /**
   * Get map rotation manager
   */
  getMapRotationManager() {
    return this.mapRotationManager;
  }

  /**
   * Get current map information
   */
  getCurrentMapInfo() {
    return this.mapRotationManager.getCurrentMap();
  }

  /**
   * Get next map preview information
   */
  getMapPreview() {
    return this.mapRotationManager.getMapPreview();
  }

  /**
   * Show map rotation preview on results screen
   */
  showMapRotationPreview(scene) {
    const preview = this.getMapPreview();
    
    if (preview.showPreview) {
      const previewText = scene.add.text(960, 200, preview.previewText, {
        fontSize: '32px',
        fontFamily: 'Courier New',
        color: '#00ff00',
        stroke: '#000000',
        strokeThickness: 3
      }).setOrigin(0.5);
      
      // Add difficulty indicator
      const difficultyText = scene.add.text(960, 240, `Difficulty: ${preview.nextMap.config.difficulty}`, {
        fontSize: '20px',
        fontFamily: 'Courier New',
        color: '#ffff00',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5);
      
      return { previewText, difficultyText };
    }
    
    return null;
  }

  /**
   * Cleanup rendering system
   */
  cleanup() {
    this.customPlayerImages = {};
    this.trackSprite = null;
    
    // Reset map rotation manager
    this.mapRotationManager.reset();
    
    console.log('[RenderManager] Rendering system cleaned up');
  }
}