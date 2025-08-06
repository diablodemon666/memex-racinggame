/**
 * Booster.js - Power-up Entity for Memex Racing Game
 * 
 * Power-up entity that provides speed boosts and visual effects.
 * Supports all booster types: antenna, twitter, memex, poo, toilet_paper, toilet, banana, king_kong
 */

import Phaser from 'phaser';

/**
 * Booster class extending Phaser Physics Arcade Sprite
 * Handles power-up collection, effects, and visual presentation
 */
export class Booster extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, config = {}) {
    // Use booster sprite or fallback to a colored circle
    const texture = config.texture || 'booster';
    super(scene, x, y, texture, config.frame);
    
    // Add to scene and enable physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Configure physics body
    this.body.setImmovable(true);
    this.body.setSize(32, 32); // Standard booster size
    
    // Booster properties
    this.boosterType = config.boosterType || this.getRandomBoosterType();
    this.speedMultiplier = this.boosterType.effects?.speedMultiplier || 1.5;
    this.duration = this.boosterType.effects?.duration || 4000;
    this.visualEffect = this.boosterType.effects?.visualEffect || 'default';
    this.glowColor = this.boosterType.glowColor || '#00ff00';
    
    // State management
    this.collected = false;
    this.active = true;
    this.spawnTime = scene.time.now;
    this.lifetime = config.lifetime || 30000; // 30 seconds default
    
    // Visual setup
    this.setupVisuals();
    this.setupAnimations();
    
    // Spawn effects
    this.showSpawnEffect();
    
    console.log(`[Booster] Created ${this.boosterType.name} at (${x}, ${y})`);
  }
  
  /**
   * Get random booster type based on spawn weights
   */
  getRandomBoosterType() {
    // Default booster types with spawn weights
    const boosterTypes = [
      {
        name: 'antenna_booster',
        displayName: 'Antenna Booster',
        effects: { speedMultiplier: 1.8, duration: 4500, visualEffect: 'signal_waves' },
        glowColor: '#00ff00',
        rarity: 'common',
        spawnWeight: 0.2
      },
      {
        name: 'twitter_post',
        displayName: 'Twitter Post',
        effects: { speedMultiplier: 1.6, duration: 5000, visualEffect: 'tweet_bubbles' },
        glowColor: '#1da1f2',
        rarity: 'common',
        spawnWeight: 0.15
      },
      {
        name: 'memex_tag',
        displayName: 'Memex Tag',
        effects: { speedMultiplier: 2.0, duration: 4000, visualEffect: 'data_stream' },
        glowColor: '#ff6b35',
        rarity: 'uncommon',
        spawnWeight: 0.12
      },
      {
        name: 'poo',
        displayName: 'Poo',
        effects: { speedMultiplier: 1.4, duration: 6000, visualEffect: 'stink_clouds' },
        glowColor: '#8b4513',
        rarity: 'common',
        spawnWeight: 0.1
      },
      {
        name: 'toilet_paper',
        displayName: 'Toilet Paper',
        effects: { speedMultiplier: 1.5, duration: 5500, visualEffect: 'paper_trail' },
        glowColor: '#ffffff',
        rarity: 'common',
        spawnWeight: 0.13
      },
      {
        name: 'toilet',
        displayName: 'Toilet',
        effects: { speedMultiplier: 2.5, duration: 3000, visualEffect: 'water_swirl' },
        glowColor: '#4169e1',
        rarity: 'rare',
        spawnWeight: 0.05
      },
      {
        name: 'banana',
        displayName: 'Banana',
        effects: { speedMultiplier: 1.7, duration: 4000, visualEffect: 'slip_lines' },
        glowColor: '#ffff00',
        rarity: 'common',
        spawnWeight: 0.15
      },
      {
        name: 'king_kong',
        displayName: 'King Kong',
        effects: { speedMultiplier: 3.0, duration: 2500, visualEffect: 'gorilla_roar' },
        glowColor: '#ff0000',
        rarity: 'legendary',
        spawnWeight: 0.02
      }
    ];
    
    // Weighted random selection
    const totalWeight = boosterTypes.reduce((sum, type) => sum + type.spawnWeight, 0);
    let random = Math.random() * totalWeight;
    
    for (const type of boosterTypes) {
      random -= type.spawnWeight;
      if (random <= 0) {
        return type;
      }
    }
    
    // Fallback to first type
    return boosterTypes[0];
  }
  
  /**
   * Setup visual appearance
   */
  setupVisuals() {
    // Set scale based on rarity
    const scaleMap = {
      'common': 1.0,
      'uncommon': 1.1,
      'rare': 1.2,
      'legendary': 1.3
    };
    this.setScale(scaleMap[this.boosterType.rarity] || 1.0);
    
    // Set tint based on booster type
    const glowColorHex = parseInt(this.glowColor.replace('#', '0x'));
    this.setTint(glowColorHex);
    
    // Create glow effect
    this.createGlowEffect();
    
    // Set depth for proper layering
    this.setDepth(10);
  }
  
  /**
   * Create glowing visual effect
   */
  createGlowEffect() {
    // Create outer glow ring
    this.glowRing = this.scene.add.circle(this.x, this.y, 25, parseInt(this.glowColor.replace('#', '0x')), 0.3);
    this.glowRing.setBlendMode(Phaser.BlendModes.ADD);
    this.glowRing.setDepth(9);
    
    // Create inner pulse
    this.glowPulse = this.scene.add.circle(this.x, this.y, 15, parseInt(this.glowColor.replace('#', '0x')), 0.5);
    this.glowPulse.setBlendMode(Phaser.BlendModes.ADD);
    this.glowPulse.setDepth(8);
  }
  
  /**
   * Setup animations
   */
  setupAnimations() {
    // Create floating animation
    this.scene.tweens.add({
      targets: this,
      y: this.y - 5,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    
    // Create rotation animation for some booster types
    if (['antenna_booster', 'memex_tag', 'king_kong'].includes(this.boosterType.name)) {
      this.scene.tweens.add({
        targets: this,
        rotation: Math.PI * 2,
        duration: 3000,
        repeat: -1,
        ease: 'Linear'
      });
    }
    
    // Pulsing glow animation
    if (this.glowRing) {
      this.scene.tweens.add({
        targets: [this.glowRing, this.glowPulse],
        scaleX: 1.2,
        scaleY: 1.2,
        alpha: 0.6,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
    
    // Special effects for legendary boosters
    if (this.boosterType.rarity === 'legendary') {
      this.createLegendaryEffect();
    }
  }
  
  /**
   * Create special effect for legendary boosters
   */
  createLegendaryEffect() {
    // Sparkling particles
    this.legendaryParticles = this.scene.add.particles(this.x, this.y, 'particle', {
      speed: { min: 10, max: 30 },
      scale: { start: 0.1, end: 0 },
      tint: [0xffd700, 0xff6b35, 0xff0000],
      lifespan: 1000,
      frequency: 200,
      quantity: 2
    });
    
    // Lightning effect for King Kong
    if (this.boosterType.name === 'king_kong') {
      this.createLightningEffect();
    }
  }
  
  /**
   * Create lightning effect for King Kong booster
   */
  createLightningEffect() {
    const createLightning = () => {
      if (!this.active) return;
      
      const lightning = this.scene.add.line(
        0, 0,
        this.x - 20, this.y - 30,
        this.x + 20, this.y + 30,
        0xffff00
      );
      lightning.setLineWidth(2);
      lightning.setAlpha(0.8);
      lightning.setBlendMode(Phaser.BlendModes.ADD);
      
      this.scene.time.delayedCall(100, () => {
        if (lightning) lightning.destroy();
      });
    };
    
    // Random lightning strikes
    this.lightningTimer = this.scene.time.addEvent({
      delay: 2000 + Math.random() * 3000,
      callback: createLightning,
      loop: true
    });
  }
  
  /**
   * Show spawn effect
   */
  showSpawnEffect() {
    // Scale up from 0
    this.setScale(0);
    this.scene.tweens.add({
      targets: this,
      scaleX: this.scale,
      scaleY: this.scale,
      duration: 300,
      ease: 'Back.easeOut'
    });
    
    // Spawn particles
    const spawnParticles = this.scene.add.particles(this.x, this.y, 'particle', {
      speed: { min: 30, max: 60 },
      scale: { start: 0.2, end: 0 },
      tint: parseInt(this.glowColor.replace('#', '0x')),
      lifespan: 500,
      quantity: 12
    });
    
    this.scene.time.delayedCall(800, () => {
      spawnParticles.destroy();
    });
    
    // Screen shake for rare+ boosters
    if (['rare', 'legendary'].includes(this.boosterType.rarity)) {
      this.scene.cameras.main.shake(200, 0.01);
    }
  }
  
  /**
   * Update method - handles lifetime and effects
   */
  update(time, delta) {
    if (!this.active) return;
    
    // Update glow positions
    if (this.glowRing) {
      this.glowRing.x = this.x;
      this.glowRing.y = this.y;
    }
    if (this.glowPulse) {
      this.glowPulse.x = this.x;
      this.glowPulse.y = this.y;
    }
    
    // Update particle positions
    if (this.legendaryParticles) {
      this.legendaryParticles.setPosition(this.x, this.y);
    }
    
    // Check lifetime
    if (time - this.spawnTime > this.lifetime) {
      this.expire();
    }
    
    // Lifetime warning effect (last 5 seconds)
    if (time - this.spawnTime > this.lifetime - 5000 && !this.warningStarted) {
      this.startExpirationWarning();
      this.warningStarted = true;
    }
  }
  
  /**
   * Start expiration warning effect
   */
  startExpirationWarning() {
    // Flashing effect
    this.scene.tweens.add({
      targets: this,
      alpha: 0.3,
      duration: 200,
      yoyo: true,
      repeat: -1,
      ease: 'Linear'
    });
    
    // Faster glow pulsing
    if (this.glowRing && this.glowPulse) {
      this.scene.tweens.killTweensOf([this.glowRing, this.glowPulse]);
      this.scene.tweens.add({
        targets: [this.glowRing, this.glowPulse],
        scaleX: 1.4,
        scaleY: 1.4,
        duration: 300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }
  
  /**
   * Handle collection by player
   */
  collect(player) {
    if (this.collected || !this.active) return false;
    
    this.collected = true;
    this.active = false;
    
    // Show collection effect
    this.showCollectionEffect(player);
    
    // Apply booster effect to player
    if (player && player.applyBooster) {
      player.applyBooster(this.boosterType);
    }
    
    // Screen shake based on booster power
    const shakePower = Math.min(0.05, this.speedMultiplier / 50);
    this.scene.cameras.main.shake(300, shakePower);
    
    // Audio effect (if audio system exists)
    this.playCollectionSound();
    
    console.log(`[Booster] ${this.boosterType.name} collected by ${player.name || 'Player'}`);
    
    // Remove after effect
    this.scene.time.delayedCall(500, () => {
      this.destroy();
    });
    
    return true;
  }
  
  /**
   * Show collection visual effect
   */
  showCollectionEffect(player) {
    // Explosion particles
    const explosionParticles = this.scene.add.particles(this.x, this.y, 'particle', {
      speed: { min: 50, max: 150 },
      scale: { start: 0.3, end: 0 },
      tint: parseInt(this.glowColor.replace('#', '0x')),
      lifespan: 800,
      quantity: 20
    });
    
    // Speed lines toward player
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const startX = this.x + Math.cos(angle) * 30;
      const startY = this.y + Math.sin(angle) * 30;
      
      const speedLine = this.scene.add.line(0, 0, startX, startY, player.x, player.y, parseInt(this.glowColor.replace('#', '0x')));
      speedLine.setLineWidth(2);
      speedLine.setAlpha(0.8);
      
      this.scene.tweens.add({
        targets: speedLine,
        alpha: 0,
        duration: 300,
        onComplete: () => speedLine.destroy()
      });
    }
    
    // Scale down animation
    this.scene.tweens.add({
      targets: this,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 300,
      ease: 'Back.easeIn'
    });
    
    // Clean up particles
    this.scene.time.delayedCall(1200, () => {
      explosionParticles.destroy();
    });
  }
  
  /**
   * Play collection sound effect
   */
  playCollectionSound() {
    // Map booster types to sound effects
    const soundMap = {
      'antenna_booster': 'beep',
      'twitter_post': 'tweet',
      'memex_tag': 'data',
      'poo': 'splat',
      'toilet_paper': 'unroll',
      'toilet': 'flush',
      'banana': 'slip',
      'king_kong': 'roar'
    };
    
    const soundKey = soundMap[this.boosterType.name] || 'collect';
    
    // Play sound if it exists
    if (this.scene.sound && this.scene.sound.get(soundKey)) {
      this.scene.sound.play(soundKey, { volume: 0.5 });
    }
  }
  
  /**
   * Expire the booster
   */
  expire() {
    if (!this.active) return;
    
    this.active = false;
    
    // Show expiration effect
    this.showExpirationEffect();
    
    // Remove after effect
    this.scene.time.delayedCall(800, () => {
      this.destroy();
    });
    
    console.log(`[Booster] ${this.boosterType.name} expired`);
  }
  
  /**
   * Show expiration visual effect
   */
  showExpirationEffect() {
    // Fade out with dissolve particles
    const dissolveParticles = this.scene.add.particles(this.x, this.y, 'particle', {
      speed: { min: 20, max: 40 },
      scale: { start: 0.2, end: 0 },
      tint: 0x666666,
      lifespan: 600,
      quantity: 15
    });
    
    // Fade out animation
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 0.8,
      scaleY: 0.8,
      duration: 600,
      ease: 'Power2.easeOut'
    });
    
    // Clean up particles
    this.scene.time.delayedCall(800, () => {
      dissolveParticles.destroy();
    });
  }
  
  /**
   * Get booster information for UI/debugging
   */
  getInfo() {
    return {
      type: this.boosterType.name,
      displayName: this.boosterType.displayName,
      speedMultiplier: this.speedMultiplier,
      duration: this.duration,
      rarity: this.boosterType.rarity,
      timeRemaining: Math.max(0, this.lifetime - (this.scene.time.now - this.spawnTime)),
      active: this.active,
      collected: this.collected
    };
  }
  
  /**
   * Static method to create booster at random position
   */
  static createAtRandomPosition(scene, physicsManager, config = {}) {
    if (!physicsManager) {
      console.warn('[Booster] No physics manager provided for random position');
      return null;
    }
    
    const position = physicsManager.getRandomValidPosition();
    return new Booster(scene, position.x, position.y, config);
  }
  
  /**
   * Cleanup when booster is destroyed
   */
  destroy() {
    // Clean up visual effects
    if (this.glowRing) {
      this.glowRing.destroy();
    }
    if (this.glowPulse) {
      this.glowPulse.destroy();
    }
    if (this.legendaryParticles) {
      this.legendaryParticles.destroy();
    }
    if (this.lightningTimer) {
      this.lightningTimer.destroy();
    }
    
    // Stop all tweens
    this.scene.tweens.killTweensOf(this);
    
    super.destroy();
  }
}