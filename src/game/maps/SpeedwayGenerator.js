/**
 * SpeedwayGenerator.js - Speed Circuit Map Generator
 * 
 * Generates wide tracks optimized for high-speed racing with a dark gray
 * background and yellow track paths. Features outer racing circuit with
 * inner obstacles and chicanes for strategic overtaking.
 */

export class SpeedwayGenerator {
  static get config() {
    return {
      name: "Speed Circuit",
      description: "Wide tracks for high-speed racing",
      difficulty: "Easy",
      backgroundColor: 0x222222,
      trackColor: 0xffcc00
    };
  }

  /**
   * Generate the speedway track
   * @param {Phaser.Scene} scene - The Phaser scene
   * @returns {void}
   */
  static generate(scene) {
    const graphics = scene.add.graphics();
    const config = this.config;
    
    // Dark gray background
    graphics.fillStyle(config.backgroundColor);
    graphics.fillRect(0, 0, 1920, 1080);
    
    // Draw yellow speedway paths
    graphics.fillStyle(config.trackColor);
    
    // Outer track perimeter
    graphics.fillRect(100, 100, 1720, 150);  // Top straight
    graphics.fillRect(100, 830, 1720, 150);  // Bottom straight
    graphics.fillRect(100, 100, 150, 880);   // Left straight
    graphics.fillRect(1670, 100, 150, 880);  // Right straight
    
    // Inner obstacles for strategic navigation
    graphics.fillRect(400, 400, 1120, 100);  // Top inner horizontal
    graphics.fillRect(400, 580, 1120, 100);  // Bottom inner horizontal
    graphics.fillRect(400, 400, 100, 280);   // Left connector
    graphics.fillRect(1420, 400, 100, 280);  // Right connector
    
    // Chicanes for overtaking opportunities
    graphics.fillRect(600, 250, 100, 150);   // First chicane top
    graphics.fillRect(800, 680, 100, 150);   // First chicane bottom
    graphics.fillRect(1020, 250, 100, 150);  // Second chicane top
    graphics.fillRect(1220, 680, 100, 150);  // Second chicane bottom
    
    // Additional racing lines
    graphics.fillRect(300, 300, 100, 480);   // Left side path
    graphics.fillRect(1520, 300, 100, 480);  // Right side path
    
    // Center bypass
    graphics.fillRect(700, 540, 520, 80);    // Center bypass lane
    
    // Generate the texture
    graphics.generateTexture('track', 1920, 1080);
    graphics.destroy();
    
    console.log('[SpeedwayGenerator] Speed circuit track generated');
  }
}