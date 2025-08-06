/**
 * Skill.js - Skill Entity for Memex Racing Game
 * 
 * Skill entity that provides special abilities and effects.
 * Supports all skill types: thunder, fire, bubble, magnet, teleport
 */

import Phaser from 'phaser';

/**
 * Skill class extending Phaser Physics Arcade Sprite
 * Handles skill collection, activation, and visual presentation
 */
export class Skill extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, config = {}) {
    // Use skill sprite or fallback to a colored hexagon
    const texture = config.texture || 'skill';
    super(scene, x, y, texture, config.frame);
    
    // Add to scene and enable physics
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Configure physics body
    this.body.setImmovable(true);
    this.body.setSize(28, 28); // Slightly smaller than boosters
    
    // Skill properties
    this.skillType = config.skillType || this.getRandomSkillType();
    this.cooldown = this.skillType.cooldown || 45000;
    this.manaCost = this.skillType.manaCost || 0;
    this.effects = this.skillType.effects || {};
    this.icon = this.skillType.icon || '⚡';
    
    // State management
    this.collected = false;
    this.active = true;
    this.used = false;
    this.spawnTime = scene.time.now;
    this.lifetime = config.lifetime || 45000; // 45 seconds default (longer than boosters)
    
    // Visual setup
    this.setupVisuals();
    this.setupAnimations();
    
    // Spawn effects
    this.showSpawnEffect();
    
    console.log(`[Skill] Created ${this.skillType.name} at (${x}, ${y})`);
  }
  
  /**
   * Get random skill type based on rarity weights
   */
  getRandomSkillType() {
    // Default skill types with rarity weights
    const skillTypes = [
      {
        name: 'thunder',
        displayName: 'Thunder',
        description: 'Paralyze 3 random opponents for 3 seconds',
        icon: '⚡',
        cooldown: 45000,
        effects: {
          type: 'paralysis',
          targets: 3,
          duration: 3000,
          selectionMode: 'random',
          visualEffect: 'lightning_strike'
        },
        rarity: 'uncommon',
        color: 0xffff00
      },
      {
        name: 'fire',
        displayName: 'Fire',
        description: 'Burn 2 characters, causing slowdown',
        icon: '🔥',
        cooldown: 35000,
        effects: {
          type: 'burn',
          targets: 2,
          duration: 5000,
          speedReduction: 0.6,
          selectionMode: 'nearest',
          visualEffect: 'flame_aura'
        },
        rarity: 'common',
        color: 0xff4500
      },
      {
        name: 'bubble_protection',
        displayName: 'Bubble Protection',
        description: 'Bounce off other players for 8 seconds',
        icon: '🛡️',
        cooldown: 60000,
        effects: {
          type: 'protection',
          targets: 1,
          duration: 8000,
          bounceStrength: 2.0,
          selectionMode: 'self',
          visualEffect: 'bubble_shield'
        },
        rarity: 'rare',
        color: 0x00bfff
      },
      {
        name: 'magnetized_shoes',
        displayName: 'Magnetized Shoes',
        description: 'Attract to nearby racers for 5 seconds',
        icon: '🧲',
        cooldown: 40000,
        effects: {
          type: 'magnetic_attraction',
          targets: 'all_nearby',
          duration: 5000,
          attractionRadius: 100,
          attractionStrength: 1.5,
          selectionMode: 'self',
          visualEffect: 'magnetic_field'
        },
        rarity: 'uncommon',
        color: 0xff1493
      },
      {
        name: 'random_teleport_twitch',
        displayName: 'Random Teleport Twitch',
        description: 'Teleport all players randomly on map',
        icon: '🌀',
        cooldown: 90000,
        effects: {
          type: 'teleport',
          targets: 'all',
          duration: 0,
          teleportMode: 'random_safe',
          selectionMode: 'all',
          visualEffect: 'warp_effect'
        },
        rarity: 'legendary',
        color: 0x9400d3
      }
    ];
    
    // Rarity weights
    const rarityWeights = {
      'common': 0.5,
      'uncommon': 0.3,
      'rare': 0.15,
      'legendary': 0.05
    };
    
    // Weighted random selection
    const availableSkills = skillTypes.filter(skill => 
      Math.random() < rarityWeights[skill.rarity]
    );
    
    if (availableSkills.length === 0) {
      return skillTypes[1]; // Default to fire skill
    }
    
    return availableSkills[Math.floor(Math.random() * availableSkills.length)];
  }
  
  /**
   * Setup visual appearance
   */
  setupVisuals() {
    // Set scale based on rarity
    const scaleMap = {
      'common': 0.9,
      'uncommon': 1.0,
      'rare': 1.1,
      'legendary': 1.2
    };
    this.setScale(scaleMap[this.skillType.rarity] || 1.0);
    
    // Set tint based on skill type
    this.setTint(this.skillType.color);
    
    // Create hexagonal shape if no texture
    if (!this.texture || this.texture.key === '__MISSING') {
      this.createHexagonShape();
    }
    
    // Create aura effect
    this.createAuraEffect();
    
    // Set depth for proper layering
    this.setDepth(12);
  }
  
  /**
   * Create hexagonal shape for skills
   */
  createHexagonShape() {
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(this.skillType.color, 0.8);
    graphics.strokeStyle(0xffffff, 2);
    
    // Draw hexagon
    const radius = 16;
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      points.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      });
    }
    
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      graphics.lineTo(points[i].x, points[i].y);
    }
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
    
    // Position on skill
    graphics.x = this.x;
    graphics.y = this.y;
    this.hexagonShape = graphics;
  }
  
  /**
   * Create aura visual effect
   */
  createAuraEffect() {
    // Create outer aura ring
    this.auraRing = this.scene.add.circle(this.x, this.y, 30, this.skillType.color, 0.2);
    this.auraRing.setBlendMode(Phaser.BlendModes.ADD);
    this.auraRing.setDepth(11);
    
    // Create inner energy core
    this.energyCore = this.scene.add.circle(this.x, this.y, 12, this.skillType.color, 0.6);
    this.energyCore.setBlendMode(Phaser.BlendModes.ADD);
    this.energyCore.setDepth(13);
    
    // Create skill symbol/icon
    this.skillIcon = this.scene.add.text(this.x, this.y, this.skillType.icon, {
      fontSize: '16px',
      fill: '#ffffff',
      align: 'center'
    });
    this.skillIcon.setOrigin(0.5, 0.5);
    this.skillIcon.setDepth(14);
  }
  
  /**
   * Setup animations
   */
  setupAnimations() {
    // Floating animation
    this.scene.tweens.add({
      targets: this,
      y: this.y - 8,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    
    // Rotation animation
    this.scene.tweens.add({
      targets: this,
      rotation: Math.PI * 2,
      duration: 4000,
      repeat: -1,
      ease: 'Linear'
    });
    
    // Pulsing aura animation
    if (this.auraRing) {
      this.scene.tweens.add({
        targets: this.auraRing,
        scaleX: 1.3,
        scaleY: 1.3,
        alpha: 0.4,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
    
    // Energy core pulsing
    if (this.energyCore) {
      this.scene.tweens.add({
        targets: this.energyCore,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Power2.easeInOut'
      });
    }
    
    // Special effects for legendary skills
    if (this.skillType.rarity === 'legendary') {
      this.createLegendaryEffect();
    }
  }
  
  /**
   * Create special effect for legendary skills
   */
  createLegendaryEffect() {
    // Swirling energy particles
    this.legendaryParticles = this.scene.add.particles(this.x, this.y, 'particle', {
      speed: { min: 20, max: 40 },
      scale: { start: 0.15, end: 0 },
      tint: [this.skillType.color, 0xffffff, 0xffd700],
      lifespan: 1500,
      frequency: 150,
      quantity: 3,
      emitZone: {
        type: 'edge',
        source: new Phaser.Geom.Circle(0, 0, 25),
        quantity: 3
      }
    });
    
    // Lightning arcs for teleport skill
    if (this.skillType.name === 'random_teleport_twitch') {
      this.createLightningArcs();
    }
  }
  
  /**
   * Create lightning arcs for teleport skill
   */
  createLightningArcs() {
    const createArc = () => {
      if (!this.active) return;
      
      const angle = Math.random() * Math.PI * 2;
      const startRadius = 15;
      const endRadius = 35;
      
      const startX = this.x + Math.cos(angle) * startRadius;
      const startY = this.y + Math.sin(angle) * startRadius;
      const endX = this.x + Math.cos(angle) * endRadius;
      const endY = this.y + Math.sin(angle) * endRadius;
      
      const arc = this.scene.add.line(0, 0, startX, startY, endX, endY, 0x9400d3);
      arc.setLineWidth(2);
      arc.setAlpha(0.8);
      arc.setBlendMode(Phaser.BlendModes.ADD);
      
      this.scene.tweens.add({
        targets: arc,
        alpha: 0,
        duration: 200,
        onComplete: () => arc.destroy()
      });
    };
    
    // Random lightning arcs
    this.arcTimer = this.scene.time.addEvent({
      delay: 1000 + Math.random() * 2000,
      callback: createArc,
      loop: true
    });
  }
  
  /**
   * Show spawn effect
   */
  showSpawnEffect() {
    // Scale up from 0
    this.setScale(0);
    const targetScale = this.scale;
    this.scene.tweens.add({
      targets: this,
      scaleX: targetScale,
      scaleY: targetScale,
      duration: 400,
      ease: 'Back.easeOut'
    });
    
    // Burst particles
    const burstParticles = this.scene.add.particles(this.x, this.y, 'particle', {
      speed: { min: 40, max: 80 },
      scale: { start: 0.25, end: 0 },
      tint: this.skillType.color,
      lifespan: 600,
      quantity: 16
    });
    
    this.scene.time.delayedCall(1000, () => {
      burstParticles.destroy();
    });
    
    // Screen flash for rare+ skills
    if (['rare', 'legendary'].includes(this.skillType.rarity)) {
      this.scene.cameras.main.flash(300, 255, 255, 255, false, 0.1);
    }
  }
  
  /**
   * Update method - handles lifetime and effects
   */
  update(time, delta) {
    if (!this.active) return;
    
    // Update visual effect positions
    if (this.auraRing) {
      this.auraRing.x = this.x;
      this.auraRing.y = this.y;
    }
    if (this.energyCore) {
      this.energyCore.x = this.x;
      this.energyCore.y = this.y;
    }
    if (this.skillIcon) {
      this.skillIcon.x = this.x;
      this.skillIcon.y = this.y;
    }
    if (this.hexagonShape) {
      this.hexagonShape.x = this.x;
      this.hexagonShape.y = this.y;
    }
    
    // Update particle positions
    if (this.legendaryParticles) {
      this.legendaryParticles.setPosition(this.x, this.y);
    }
    
    // Check lifetime
    if (time - this.spawnTime > this.lifetime) {
      this.expire();
    }
    
    // Lifetime warning effect (last 8 seconds)
    if (time - this.spawnTime > this.lifetime - 8000 && !this.warningStarted) {
      this.startExpirationWarning();
      this.warningStarted = true;
    }
  }
  
  /**
   * Start expiration warning effect
   */
  startExpirationWarning() {
    // Flickering effect
    this.scene.tweens.add({
      targets: this,
      alpha: 0.4,
      duration: 250,
      yoyo: true,
      repeat: -1,
      ease: 'Linear'
    });
    
    // Faster aura pulsing
    if (this.auraRing) {
      this.scene.tweens.killTweensOf(this.auraRing);
      this.scene.tweens.add({
        targets: this.auraRing,
        scaleX: 1.5,
        scaleY: 1.5,
        duration: 400,
        yoyo: true,
        repeat: -1,
        ease: 'Power2.easeInOut'
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
    
    // Add skill to player's skill list
    if (player && player.skills) {
      player.skills.push({
        type: this.skillType.name,
        skillType: this.skillType,
        cooldown: this.cooldown,
        used: false,
        collectedAt: this.scene.time.now
      });
    }
    
    // Screen effect based on skill rarity
    const flashIntensity = {
      'common': 0.1,
      'uncommon': 0.15,
      'rare': 0.2,
      'legendary': 0.3
    }[this.skillType.rarity] || 0.1;
    
    this.scene.cameras.main.flash(400, 255, 255, 255, false, flashIntensity);
    
    // Audio effect
    this.playCollectionSound();
    
    console.log(`[Skill] ${this.skillType.name} collected by ${player.name || 'Player'}`);
    
    // Remove after effect
    this.scene.time.delayedCall(800, () => {
      this.destroy();
    });
    
    return true;
  }
  
  /**
   * Show collection visual effect
   */
  showCollectionEffect(player) {
    // Implosion particles
    const implosionParticles = this.scene.add.particles(this.x, this.y, 'particle', {
      speed: { min: 100, max: 200 },
      scale: { start: 0.4, end: 0 },
      tint: this.skillType.color,
      lifespan: 1000,
      quantity: 25,
      gravityY: -50
    });
    
    // Energy beam to player
    const energyBeam = this.scene.add.line(0, 0, this.x, this.y, player.x, player.y, this.skillType.color);
    energyBeam.setLineWidth(4);
    energyBeam.setAlpha(0.9);
    energyBeam.setBlendMode(Phaser.BlendModes.ADD);
    
    // Animate energy beam
    this.scene.tweens.add({
      targets: energyBeam,
      alpha: 0,
      duration: 400,
      ease: 'Power2.easeOut',
      onComplete: () => energyBeam.destroy()
    });
    
    // Skill icon flies to player
    if (this.skillIcon) {
      this.scene.tweens.add({
        targets: this.skillIcon,
        x: player.x,
        y: player.y - 30,
        scaleX: 0.5,
        scaleY: 0.5,
        alpha: 0,
        duration: 600,
        ease: 'Power2.easeOut'
      });
    }
    
    // Main skill object implodes
    this.scene.tweens.add({
      targets: this,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 400,
      ease: 'Power2.easeIn'
    });
    
    // Clean up particles
    this.scene.time.delayedCall(1500, () => {
      implosionParticles.destroy();
    });
  }
  
  /**
   * Play collection sound effect
   */
  playCollectionSound() {
    // Map skill types to sound effects
    const soundMap = {
      'thunder': 'thunder',
      'fire': 'fire',
      'bubble_protection': 'bubble',
      'magnetized_shoes': 'magnet',
      'random_teleport_twitch': 'teleport'
    };
    
    const soundKey = soundMap[this.skillType.name] || 'skill_collect';
    
    // Play sound if it exists
    if (this.scene.sound && this.scene.sound.get(soundKey)) {
      this.scene.sound.play(soundKey, { volume: 0.6 });
    }
  }
  
  /**
   * Activate skill effect (called when player uses the skill)
   */
  activate(player) {
    if (this.used) return false;
    
    this.used = true;
    
    // Show activation effect
    this.showActivationEffect(player);
    
    // Apply skill effect based on type
    this.applySkillEffect(player);
    
    console.log(`[Skill] ${this.skillType.name} activated by ${player.name || 'Player'}`);
    
    return true;
  }
  
  /**
   * Apply skill effect based on type
   */
  applySkillEffect(player) {
    const gameEngine = this.scene.gameEngine || this.scene;
    
    switch (this.effects.type) {
      case 'paralysis':
        this.applyParalysisEffect(gameEngine, player);
        break;
      case 'burn':
        this.applyBurnEffect(gameEngine, player);
        break;
      case 'protection':
        this.applyProtectionEffect(player);
        break;
      case 'magnetic_attraction':
        this.applyMagneticEffect(player);
        break;
      case 'teleport':
        this.applyTeleportEffect(gameEngine);
        break;
    }
  }
  
  /**
   * Apply paralysis effect
   */
  applyParalysisEffect(gameEngine, caster) {
    const targets = gameEngine.players
      .filter(p => p !== caster && !p.paralyzed)
      .sort(() => Math.random() - 0.5)
      .slice(0, this.effects.targets);
    
    targets.forEach(target => {
      target.paralyzed = true;
      this.showLightningStrike(target);
      
      // Remove effect after duration
      this.scene.time.delayedCall(this.effects.duration, () => {
        target.paralyzed = false;
      });
    });
  }
  
  /**
   * Apply burn effect
   */
  applyBurnEffect(gameEngine, caster) {
    const targets = gameEngine.players
      .filter(p => p !== caster)
      .sort((a, b) => {
        const distA = Phaser.Math.Distance.Between(caster.x, caster.y, a.x, a.y);
        const distB = Phaser.Math.Distance.Between(caster.x, caster.y, b.x, b.y);
        return distA - distB;
      })
      .slice(0, this.effects.targets);
    
    targets.forEach(target => {
      target.speedMultiplier *= this.effects.speedReduction;
      this.showFireEffect(target);
      
      // Remove effect after duration
      this.scene.time.delayedCall(this.effects.duration, () => {
        target.speedMultiplier = 1.0;
      });
    });
  }
  
  /**
   * Apply protection effect
   */
  applyProtectionEffect(player) {
    player.hasBubble = true;
    this.showBubbleShield(player);
    
    // Remove effect after duration
    this.scene.time.delayedCall(this.effects.duration, () => {
      player.hasBubble = false;
    });
  }
  
  /**
   * Apply magnetic effect
   */
  applyMagneticEffect(player) {
    player.magnetized = true;
    this.showMagneticField(player);
    
    // Remove effect after duration
    this.scene.time.delayedCall(this.effects.duration, () => {
      player.magnetized = false;
    });
  }
  
  /**
   * Apply teleport effect
   */
  applyTeleportEffect(gameEngine) {
    gameEngine.players.forEach(player => {
      if (gameEngine.physicsManager) {
        const newPos = gameEngine.physicsManager.getRandomValidPosition();
        this.showTeleportEffect(player, newPos);
        
        // Teleport after visual effect
        this.scene.time.delayedCall(300, () => {
          player.x = newPos.x;
          player.y = newPos.y;
          player.stuckCounter = 0;
        });
      }
    });
  }
  
  /**
   * Visual effect methods
   */
  showActivationEffect(player) {
    // Create activation burst
    const burst = this.scene.add.circle(player.x, player.y, 50, this.skillType.color, 0.6);
    burst.setBlendMode(Phaser.BlendModes.ADD);
    
    this.scene.tweens.add({
      targets: burst,
      scaleX: 2,
      scaleY: 2,
      alpha: 0,
      duration: 500,
      ease: 'Power2.easeOut',
      onComplete: () => burst.destroy()
    });
  }
  
  showLightningStrike(target) {
    const lightning = this.scene.add.line(0, 0, target.x, target.y - 100, target.x, target.y + 30, 0xffff00);
    lightning.setLineWidth(5);
    lightning.setBlendMode(Phaser.BlendModes.ADD);
    
    this.scene.time.delayedCall(150, () => lightning.destroy());
  }
  
  showFireEffect(target) {
    const fire = this.scene.add.particles(target.x, target.y, 'particle', {
      speed: 30,
      scale: { start: 0.3, end: 0 },
      tint: [0xff4500, 0xff6600, 0xff8800],
      lifespan: 1500,
      frequency: 100
    });
    
    this.scene.time.delayedCall(3000, () => fire.destroy());
  }
  
  showBubbleShield(player) {
    const bubble = this.scene.add.circle(player.x, player.y, 40, 0x00bfff, 0.3);
    bubble.setStrokeStyle(3, 0x00bfff);
    player.bubbleShield = bubble;
  }
  
  showMagneticField(player) {
    const field = this.scene.add.circle(player.x, player.y, 60, 0xff1493, 0.2);
    field.setStrokeStyle(2, 0xff1493, 0.8);
    player.magneticField = field;
  }
  
  showTeleportEffect(player, newPos) {
    // Disappear effect
    const disappear = this.scene.add.circle(player.x, player.y, 35, 0x9400d3, 0.8);
    this.scene.tweens.add({
      targets: disappear,
      scaleX: 0,
      scaleY: 0,
      duration: 300,
      onComplete: () => disappear.destroy()
    });
    
    // Appear effect
    this.scene.time.delayedCall(300, () => {
      const appear = this.scene.add.circle(newPos.x, newPos.y, 35, 0x9400d3, 0.8);
      this.scene.tweens.add({
        targets: appear,
        scaleX: 0,
        scaleY: 0,
        duration: 300,
        onComplete: () => appear.destroy()
      });
    });
  }
  
  /**
   * Expire the skill
   */
  expire() {
    if (!this.active) return;
    
    this.active = false;
    
    // Show expiration effect
    this.showExpirationEffect();
    
    // Remove after effect
    this.scene.time.delayedCall(1000, () => {
      this.destroy();
    });
    
    console.log(`[Skill] ${this.skillType.name} expired`);
  }
  
  /**
   * Show expiration visual effect
   */
  showExpirationEffect() {
    // Fade out with energy dissipation
    const dissipateParticles = this.scene.add.particles(this.x, this.y, 'particle', {
      speed: { min: 10, max: 30 },
      scale: { start: 0.15, end: 0 },
      tint: this.skillType.color,
      lifespan: 800,
      quantity: 12,
      alpha: { start: 0.8, end: 0 }
    });
    
    // Fade out animation
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 800,
      ease: 'Power2.easeOut'
    });
    
    // Clean up particles
    this.scene.time.delayedCall(1200, () => {
      dissipateParticles.destroy();
    });
  }
  
  /**
   * Get skill information for UI/debugging
   */
  getInfo() {
    return {
      type: this.skillType.name,
      displayName: this.skillType.displayName,
      description: this.skillType.description,
      cooldown: this.cooldown,
      effects: this.effects,
      rarity: this.skillType.rarity,
      timeRemaining: Math.max(0, this.lifetime - (this.scene.time.now - this.spawnTime)),
      active: this.active,
      collected: this.collected,
      used: this.used
    };
  }
  
  /**
   * Static method to create skill at random position
   */
  static createAtRandomPosition(scene, physicsManager, config = {}) {
    if (!physicsManager) {
      console.warn('[Skill] No physics manager provided for random position');
      return null;
    }
    
    const position = physicsManager.getRandomValidPosition();
    return new Skill(scene, position.x, position.y, config);
  }
  
  /**
   * Cleanup when skill is destroyed
   */
  destroy() {
    // Clean up visual effects
    if (this.auraRing) {
      this.auraRing.destroy();
    }
    if (this.energyCore) {
      this.energyCore.destroy();
    }
    if (this.skillIcon) {
      this.skillIcon.destroy();
    }
    if (this.hexagonShape) {
      this.hexagonShape.destroy();
    }
    if (this.legendaryParticles) {
      this.legendaryParticles.destroy();
    }
    if (this.arcTimer) {
      this.arcTimer.destroy();
    }
    
    // Stop all tweens
    this.scene.tweens.killTweensOf(this);
    
    super.destroy();
  }
}