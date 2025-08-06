/**
 * GridGenerator.js - Grid Lock Map Generator
 * 
 * Generates a city block style grid track with a gray background
 * and magenta track paths. Features a systematic grid layout with
 * blocked intersections for strategic route planning.
 */

export class GridGenerator {
  static get config() {
    return {
      name: "Grid Lock",
      description: "City block style grid",
      difficulty: "Medium",
      backgroundColor: 0x2a2a2a,
      trackColor: 0xff00ff
    };
  }

  /**
   * Generate the grid track
   * @param {Phaser.Scene} scene - The Phaser scene
   * @returns {void}
   */
  static generate(scene) {
    const graphics = scene.add.graphics();
    const config = this.config;
    
    // Gray background
    graphics.fillStyle(config.backgroundColor);
    graphics.fillRect(0, 0, 1920, 1080);
    
    // Draw magenta grid paths
    graphics.fillStyle(config.trackColor);
    
    // Create city block style grid
    const blockSize = 200;
    const streetWidth = 100;
    
    // Horizontal streets (running east-west)
    for (let y = 100; y < 1000; y += blockSize) {
      graphics.fillRect(50, y, 1820, streetWidth);
    }
    
    // Vertical streets (running north-south)
    for (let x = 150; x < 1800; x += blockSize) {
      graphics.fillRect(x, 50, streetWidth, 980);
    }
    
    // Remove some intersections to create variety and obstacles
    graphics.fillStyle(config.backgroundColor);
    
    // Strategic intersection blocks
    graphics.fillRect(350, 300, 100, 100);   // Block intersection (2,2)
    graphics.fillRect(750, 300, 100, 100);   // Block intersection (4,2)
    graphics.fillRect(550, 500, 100, 100);   // Block intersection (3,3)
    graphics.fillRect(950, 500, 100, 100);   // Block intersection (5,3)
    graphics.fillRect(1150, 300, 100, 100);  // Block intersection (6,2)
    graphics.fillRect(1350, 700, 100, 100);  // Block intersection (7,4)
    
    // Additional strategic blocks
    graphics.fillRect(550, 100, 100, 100);   // Block intersection (3,1)
    graphics.fillRect(1150, 700, 100, 100);  // Block intersection (6,4)
    graphics.fillRect(350, 700, 100, 100);   // Block intersection (2,4)
    
    // Restore magenta color for additional features
    graphics.fillStyle(config.trackColor);
    
    // Add diagonal shortcuts
    graphics.fillRect(675, 425, 150, 50);    // Diagonal shortcut 1
    graphics.fillRect(1075, 625, 150, 50);   // Diagonal shortcut 2
    graphics.fillRect(475, 225, 50, 150);    // Vertical shortcut 1
    graphics.fillRect(875, 825, 50, 150);    // Vertical shortcut 2
    
    // Generate the texture
    graphics.generateTexture('track', 1920, 1080);
    graphics.destroy();
    
    console.log('[GridGenerator] Grid lock track generated');
  }
}