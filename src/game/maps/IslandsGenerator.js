/**
 * IslandsGenerator.js - Island Hopper Map Generator
 * 
 * Generates connected island tracks with a teal background
 * and green track paths. Features circular islands connected
 * by bridges for unique navigation patterns.
 */

export class IslandsGenerator {
  static get config() {
    return {
      name: "Island Hopper",
      description: "Connected island tracks",
      difficulty: "Medium",
      backgroundColor: 0x0a2a2a,
      trackColor: 0x00ff00
    };
  }

  /**
   * Generate the islands track
   * @param {Phaser.Scene} scene - The Phaser scene
   * @returns {void}
   */
  static generate(scene) {
    const graphics = scene.add.graphics();
    const config = this.config;
    
    // Teal background
    graphics.fillStyle(config.backgroundColor);
    graphics.fillRect(0, 0, 1920, 1080);
    
    // Draw green island paths
    graphics.fillStyle(config.trackColor);
    
    // Create main connected islands
    graphics.fillCircle(300, 300, 150);   // Top left island
    graphics.fillCircle(800, 200, 120);   // Top middle island
    graphics.fillCircle(1300, 300, 140);  // Top right island
    graphics.fillCircle(1600, 500, 130);  // Right middle island
    graphics.fillCircle(1300, 780, 150);  // Bottom right island
    graphics.fillCircle(800, 880, 120);   // Bottom middle island
    graphics.fillCircle(300, 780, 140);   // Bottom left island
    graphics.fillCircle(600, 540, 100);   // Center left island
    graphics.fillCircle(1000, 540, 110);  // Center island
    graphics.fillCircle(1400, 540, 100);  // Center right island
    
    // Bridges connecting islands
    graphics.fillRect(300, 280, 500, 80);   // Top left to top middle
    graphics.fillRect(800, 180, 500, 80);   // Top middle to top right
    graphics.fillRect(1300, 300, 300, 80);  // Top right to right middle
    graphics.fillRect(1550, 500, 80, 280);  // Right middle to bottom right
    graphics.fillRect(1300, 750, 300, 80);  // Bottom right to right middle
    graphics.fillRect(800, 830, 500, 80);   // Bottom middle to bottom right
    graphics.fillRect(300, 750, 500, 80);   // Bottom left to bottom middle
    graphics.fillRect(250, 300, 80, 480);   // Left vertical connector
    graphics.fillRect(600, 500, 400, 80);   // Center horizontal bridge 1
    graphics.fillRect(1000, 500, 400, 80);  // Center horizontal bridge 2
    
    // Additional connecting paths for better circulation
    graphics.fillRect(450, 220, 80, 200);   // Upper connector
    graphics.fillRect(1150, 220, 80, 200);  // Upper right connector
    graphics.fillRect(450, 660, 80, 200);   // Lower connector
    graphics.fillRect(1150, 660, 80, 200);  // Lower right connector
    
    // Cross bridges for strategic routes
    graphics.fillRect(700, 350, 80, 340);   // Central vertical bridge
    graphics.fillRect(1100, 350, 80, 340);  // Right vertical bridge
    
    // Outer ring path
    graphics.fillRect(150, 150, 1620, 50);  // Top outer
    graphics.fillRect(150, 880, 1620, 50);  // Bottom outer
    graphics.fillRect(150, 150, 50, 780);   // Left outer
    graphics.fillRect(1720, 150, 50, 780);  // Right outer
    
    // Generate the texture
    graphics.generateTexture('track', 1920, 1080);
    graphics.destroy();
    
    console.log('[IslandsGenerator] Island hopper track generated');
  }
}