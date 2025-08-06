/**
 * MToken.js - Win Condition Token for Memex Racing Game
 * 
 * The M Token is the win condition - players must reach it within 5 minutes.
 * It spawns at the farthest position from the starting point and provides visual feedback.
 */

import Phaser from 'phaser';

/**
 * MToken class extending Phaser Physics Arcade Sprite
 * Handles the win condition token with visual effects and collection logic
 */
export class MToken extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, config = {}) {
    // Use M token sprite or fallback to a gold circle
    const texture = config.texture || 'mtoken';
    super(scene, x, y, texture, config.frame);
    
    // Add to scene and enable physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Configure physics body
    this.body.setImmovable(true);
    this.body.setSize(40, 40); // Larger than boosters/skills
    this.body.setCircle(20); // Circular collision
    
    // Token properties
    this.tokenValue = config.tokenValue || 1000; // Points for reaching
    this.spawnTime = scene.time.now;
    this.collected = false;
    this.winner = null;
    
    // Visual properties
    this.glowIntensity = 0.8;
    this.pulseSpeed = 1.0;
    this.rotationSpeed = 1.0;
    
    // Distance tracking
    this.spawnDistance = config.spawnDistance || 0;
    this.minDistanceFromStart = config.minDistanceFromStart || 500;
    
    // Visual setup
    this.setupVisuals();
    this.setupAnimations();
    this.setupParticleEffects();
    
    // Spawn effects
    this.showSpawnEffect();
    
    // Set high depth for visibility
    this.setDepth(20);
    
    console.log(`[MToken] Created M Token at (${x}, ${y}) with spawn distance: ${this.spawnDistance}`);
  }
  
  /**
   * Setup visual appearance
   */
  setupVisuals() {
    // Make token golden and prominent
    this.setTint(0xffd700); // Gold color
    this.setScale(1.5); // Larger than other items
    
    // Create golden glow effect
    this.createGoldenGlow();
    
    // Create M symbol if no texture available
    if (!this.texture || this.texture.key === '__MISSING') {
      this.createMSymbol();
    }
    
    // Create distance rings for visual feedback
    this.createDistanceRings();
  }
  
  /**
   * Create golden glow effect
   */
  createGoldenGlow() {
    // Outer glow ring
    this.outerGlow = this.scene.add.circle(this.x, this.y, 60, 0xffd700, 0.3);
    this.outerGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.outerGlow.setDepth(18);
    
    // Inner glow ring
    this.innerGlow = this.scene.add.circle(this.x, this.y, 35, 0xffff00, 0.5);
    this.innerGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.innerGlow.setDepth(19);
    
    // Core light
    this.coreLight = this.scene.add.circle(this.x, this.y, 20, 0xffffff, 0.8);
    this.coreLight.setBlendMode(Phaser.BlendModes.ADD);
    this.coreLight.setDepth(21);
  }
  
  /**
   * Create M symbol if no texture
   */
  createMSymbol() {
    // Create a stylized M using graphics
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(0xffd700, 1);
    graphics.strokeStyle(0xffffff, 3);
    
    // Draw M shape
    const width = 30;
    const height = 35;
    const x = -width / 2;
    const y = -height / 2;
    
    graphics.beginPath();
    graphics.moveTo(x, y + height);
    graphics.lineTo(x, y);
    graphics.lineTo(x + width / 4, y + height / 3);
    graphics.lineTo(x + width / 2, y);
    graphics.lineTo(x + 3 * width / 4, y + height / 3);
    graphics.lineTo(x + width, y);
    graphics.lineTo(x + width, y + height);
    graphics.lineTo(x + 3 * width / 4, y + height);
    graphics.lineTo(x + width / 2, y + 2 * height / 3);
    graphics.lineTo(x + width / 4, y + height);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
    
    // Position on token
    graphics.x = this.x;
    graphics.y = this.y;
    graphics.setDepth(22);
    this.mSymbol = graphics;
  }
  
  /**
   * Create distance indicator rings
   */
  createDistanceRings() {
    this.distanceRings = [];
    
    // Create 3 concentric rings that expand outward
    for (let i = 0; i < 3; i++) {
      const ring = this.scene.add.circle(
        this.x, this.y, 
        80 + (i * 30), 
        0xffd700, 
        0.1 - (i * 0.02)
      );
      ring.setStrokeStyle(2, 0xffd700, 0.3 - (i * 0.1));
      ring.setBlendMode(Phaser.BlendModes.ADD);
      ring.setDepth(17 - i);
      this.distanceRings.push(ring);
    }
  }
  
  /**
   * Setup animations
   */
  setupAnimations() {
    // Floating animation
    this.scene.tweens.add({
      targets: this,
      y: this.y - 10,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    
    // Rotation animation
    this.scene.tweens.add({
      targets: this,
      rotation: Math.PI * 2,
      duration: 6000,
      repeat: -1,
      ease: 'Linear'
    });
    
    // Pulsing glow animation
    this.animateGlow();
    
    // Distance ring animation
    this.animateDistanceRings();
    
    // Scale pulsing for prominence
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.6,
      scaleY: 1.6,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Power2.easeInOut'
    });
  }
  
  /**
   * Animate glow effects
   */
  animateGlow() {
    // Outer glow pulsing
    this.scene.tweens.add({
      targets: this.outerGlow,
      scaleX: 1.4,
      scaleY: 1.4,
      alpha: 0.5,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    
    // Inner glow pulsing
    this.scene.tweens.add({
      targets: this.innerGlow,
      scaleX: 1.2,
      scaleY: 1.2,
      alpha: 0.7,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Power2.easeInOut'
    });
    
    // Core light flickering
    this.scene.tweens.add({
      targets: this.coreLight,
      alpha: 0.6,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Power2.easeInOut'
    });
  }
  
  /**
   * Animate distance rings
   */
  animateDistanceRings() {
    this.distanceRings.forEach((ring, index) => {
      // Expanding ripple effect
      this.scene.tweens.add({
        targets: ring,
        scaleX: 1.5,
        scaleY: 1.5,
        alpha: 0,
        duration: 2000 + (index * 300),
        repeat: -1,
        ease: 'Power2.easeOut',
        delay: index * 600
      });
    });
  }
  
  /**
   * Setup particle effects
   */
  setupParticleEffects() {
    // Golden sparkle particles
    this.sparkleParticles = this.scene.add.particles(this.x, this.y, 'particle', {
      speed: { min: 20, max: 50 },
      scale: { start: 0.2, end: 0 },
      tint: [0xffd700, 0xffff00, 0xffffff],
      lifespan: 2000,
      frequency: 300,
      quantity: 2,
      gravityY: -20
    });
    
    // Energy wisps circling the token
    this.createEnergyWisps();
    
    // Victory beam (vertical light beam)
    this.createVictoryBeam();
  }
  
  /**
   * Create circling energy wisps
   */
  createEnergyWisps() {
    this.energyWisps = [];
    
    for (let i = 0; i < 4; i++) {
      const wisp = this.scene.add.circle(this.x, this.y, 3, 0xffffff, 0.8);
      wisp.setBlendMode(Phaser.BlendModes.ADD);
      wisp.setDepth(23);
      
      // Circular motion around token
      const radius = 45;
      const startAngle = (i / 4) * Math.PI * 2;
      
      this.scene.tweens.add({
        targets: wisp,
        x: this.x + Math.cos(startAngle) * radius,
        y: this.y + Math.sin(startAngle) * radius,
        duration: 0,
        onComplete: () => {
          // Continuous circular motion
          this.scene.tweens.add({
            targets: wisp,
            rotation: Math.PI * 2,
            duration: 4000 + (i * 500),
            repeat: -1,
            ease: 'Linear',
            onUpdate: () => {
              const angle = startAngle + wisp.rotation;
              wisp.x = this.x + Math.cos(angle) * radius;
              wisp.y = this.y + Math.sin(angle) * radius;
            }
          });
        }
      });
      
      this.energyWisps.push(wisp);
    }
  }
  
  /**
   * Create victory beam effect
   */
  createVictoryBeam() {
    // Vertical light beam shooting upward
    this.victoryBeam = this.scene.add.rectangle(
      this.x, this.y - 200,
      8, 400,
      0xffd700, 0.6
    );
    this.victoryBeam.setBlendMode(Phaser.BlendModes.ADD);
    this.victoryBeam.setDepth(16);
    
    // Beam pulsing animation
    this.scene.tweens.add({
      targets: this.victoryBeam,
      alpha: 0.3,
      width: 12,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }
  
  /**
   * Show spawn effect
   */
  showSpawnEffect() {
    // Scale up from 0 with dramatic effect
    this.setScale(0);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 800,
      ease: 'Elastic.easeOut'
    });
    
    // Explosion particles
    const explosionParticles = this.scene.add.particles(this.x, this.y, 'particle', {
      speed: { min: 100, max: 200 },
      scale: { start: 0.4, end: 0 },
      tint: [0xffd700, 0xffff00, 0xffffff],
      lifespan: 1500,
      quantity: 30
    });
    
    // Screen flash
    this.scene.cameras.main.flash(600, 255, 215, 0, false, 0.3);
    
    // Screen shake
    this.scene.cameras.main.shake(500, 0.02);
    
    // Clean up explosion particles
    this.scene.time.delayedCall(2000, () => {
      explosionParticles.destroy();
    });
    
    // Audio effect (if available)
    this.playSpawnSound();
  }
  
  /**
   * Play spawn sound effect
   */
  playSpawnSound() {
    if (this.scene.sound && this.scene.sound.get('token_spawn')) {
      this.scene.sound.play('token_spawn', { volume: 0.8 });
    }
  }
  
  /**
   * Update method - handles animations and effects
   */
  update(time, delta) {
    if (this.collected) return;
    
    // Update visual effect positions to follow token
    this.updateEffectPositions();
    
    // Update particle systems
    if (this.sparkleParticles) {
      this.sparkleParticles.setPosition(this.x, this.y);
    }
    
    // Intensity increases over time (more urgent as time passes)
    const timeElapsed = time - this.spawnTime;
    const urgencyFactor = Math.min(1.5, 1 + (timeElapsed / 300000)); // Max 1.5x after 5 minutes
    this.updateUrgency(urgencyFactor);
  }
  
  /**
   * Update positions of all visual effects
   */
  updateEffectPositions() {
    // Update glow positions
    if (this.outerGlow) {
      this.outerGlow.x = this.x;
      this.outerGlow.y = this.y;
    }
    if (this.innerGlow) {
      this.innerGlow.x = this.x;
      this.innerGlow.y = this.y;
    }
    if (this.coreLight) {
      this.coreLight.x = this.x;
      this.coreLight.y = this.y;
    }
    if (this.mSymbol) {
      this.mSymbol.x = this.x;
      this.mSymbol.y = this.y;
    }
    if (this.victoryBeam) {
      this.victoryBeam.x = this.x;
      this.victoryBeam.y = this.y - 200;
    }
    
    // Update distance rings
    this.distanceRings.forEach(ring => {
      ring.x = this.x;
      ring.y = this.y;
    });
  }
  
  /**
   * Update urgency effects as time passes
   */
  updateUrgency(factor) {
    // Increase particle frequency
    if (this.sparkleParticles && factor > 1.2) {
      this.sparkleParticles.frequency = Math.max(100, 300 / factor);
    }
    
    // Increase glow intensity
    if (this.outerGlow && factor > 1.3) {
      this.outerGlow.alpha = Math.min(0.6, 0.3 * factor);
    }
    
    // Make victory beam more prominent
    if (this.victoryBeam && factor > 1.4) {
      this.victoryBeam.alpha = Math.min(0.9, 0.6 * factor);
    }
  }
  
  /**
   * Handle collection by player
   */
  collect(player) {
    if (this.collected) return false;
    
    this.collected = true;
    this.winner = player;
    
    // Show victory effect
    this.showVictoryEffect(player);
    
    // Stop all regular animations
    this.scene.tweens.killTweensOf(this);
    
    // Victory sound
    this.playVictorySound();
    
    console.log(`[MToken] M Token collected by ${player.name || 'Player'}! Victory!`);
    
    // Notify game engine of victory
    const gameEngine = this.scene.gameEngine || this.scene;
    if (gameEngine.emit) {
      gameEngine.emit('race-won', { 
        winner: player, 
        token: this,
        tokenValue: this.tokenValue,
        spawnDistance: this.spawnDistance
      });
    }
    
    // Keep token visible for victory celebration
    return true;
  }
  
  /**
   * Show victory visual effect
   */
  showVictoryEffect(player) {
    // Massive explosion of golden particles
    const victoryExplosion = this.scene.add.particles(this.x, this.y, 'particle', {
      speed: { min: 150, max: 300 },
      scale: { start: 0.6, end: 0 },
      tint: [0xffd700, 0xffff00, 0xffffff],
      lifespan: 3000,
      quantity: 50,
      gravityY: -100
    });
    
    // Victory beam intensifies
    if (this.victoryBeam) {
      this.scene.tweens.add({
        targets: this.victoryBeam,
        width: 30,
        alpha: 1,
        height: 800,
        duration: 1000,
        ease: 'Power2.easeOut'
      });
    }
    
    // All glow effects intensify
    [this.outerGlow, this.innerGlow, this.coreLight].forEach(glow => {
      if (glow) {
        this.scene.tweens.add({
          targets: glow,
          scaleX: 3,
          scaleY: 3,
          alpha: 1,
          duration: 1500,
          ease: 'Power2.easeOut'
        });
      }
    });
    
    // Winner celebration effect
    this.createWinnerCelebration(player);
    
    // Screen effects
    this.scene.cameras.main.flash(1000, 255, 215, 0, false, 0.5);
    this.scene.cameras.main.shake(1000, 0.03);
    
    // Clean up explosion particles
    this.scene.time.delayedCall(4000, () => {
      victoryExplosion.destroy();
    });
  }
  
  /**
   * Create winner celebration effect
   */
  createWinnerCelebration(player) {
    // Golden aura around winner
    const winnerAura = this.scene.add.circle(player.x, player.y, 60, 0xffd700, 0.4);
    winnerAura.setBlendMode(Phaser.BlendModes.ADD);
    winnerAura.setDepth(25);
    
    // Pulsing winner aura
    this.scene.tweens.add({
      targets: winnerAura,
      scaleX: 2,
      scaleY: 2,
      alpha: 0.1,
      duration: 2000,
      ease: 'Power2.easeOut',
      onComplete: () => winnerAura.destroy()
    });
    
    // Victory particles around winner
    const winnerParticles = this.scene.add.particles(player.x, player.y, 'particle', {
      speed: { min: 50, max: 100 },
      scale: { start: 0.3, end: 0 },
      tint: 0xffd700,
      lifespan: 2000,
      frequency: 100,
      quantity: 5
    });
    
    // Victory text
    const victoryText = this.scene.add.text(player.x, player.y - 50, 'VICTORY!', {
      fontSize: '32px',
      fill: '#ffd700',
      stroke: '#ffffff',
      strokeThickness: 3,
      align: 'center'
    });
    victoryText.setOrigin(0.5, 0.5);
    victoryText.setDepth(26);
    
    // Animate victory text
    this.scene.tweens.add({
      targets: victoryText,
      y: player.y - 80,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0,
      duration: 2000,
      ease: 'Power2.easeOut',
      onComplete: () => victoryText.destroy()
    });
    
    // Clean up winner effects
    this.scene.time.delayedCall(3000, () => {
      winnerParticles.destroy();
    });
  }
  
  /**
   * Play victory sound effect
   */
  playVictorySound() {
    if (this.scene.sound && this.scene.sound.get('victory')) {
      this.scene.sound.play('victory', { volume: 1.0 });
    }
  }
  
  /**
   * Get distance from a point
   */
  getDistanceFrom(x, y) {
    return Phaser.Math.Distance.Between(this.x, this.y, x, y);
  }
  
  /**
   * Get token information for UI/debugging
   */
  getInfo() {
    return {
      position: { x: this.x, y: this.y },
      spawnDistance: this.spawnDistance,
      tokenValue: this.tokenValue,
      collected: this.collected,
      winner: this.winner ? this.winner.name : null,
      timeAlive: this.scene.time.now - this.spawnTime
    };
  }
  
  /**
   * Static method to create token at farthest position from start
   */
  static createAtFarthestPosition(scene, startPosition, physicsManager, config = {}) {
    if (!physicsManager) {
      console.warn('[MToken] No physics manager provided for positioning');
      return null;
    }
    
    const farthestPosition = physicsManager.getFarthestPositionFromStart(startPosition);
    const distance = Phaser.Math.Distance.Between(
      startPosition.x, startPosition.y,
      farthestPosition.x, farthestPosition.y
    );
    
    config.spawnDistance = distance;
    config.minDistanceFromStart = config.minDistanceFromStart || 500;
    
    // Ensure minimum distance
    if (distance < config.minDistanceFromStart) {
      console.warn(`[MToken] Spawn distance (${distance}) below minimum (${config.minDistanceFromStart})`);
    }
    
    return new MToken(scene, farthestPosition.x, farthestPosition.y, config);
  }
  
  /**
   * Cleanup when token is destroyed
   */
  destroy() {
    // Clean up all visual effects
    if (this.outerGlow) this.outerGlow.destroy();
    if (this.innerGlow) this.innerGlow.destroy();
    if (this.coreLight) this.coreLight.destroy();
    if (this.mSymbol) this.mSymbol.destroy();
    if (this.victoryBeam) this.victoryBeam.destroy();
    if (this.sparkleParticles) this.sparkleParticles.destroy();
    
    // Clean up distance rings
    this.distanceRings.forEach(ring => ring.destroy());
    
    // Clean up energy wisps
    this.energyWisps.forEach(wisp => wisp.destroy());
    
    // Stop all tweens
    this.scene.tweens.killTweensOf(this);
    
    super.destroy();
  }
}