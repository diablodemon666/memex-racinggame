/**
 * ClassicMazeGenerator.js - Classic Maze Map Generator
 * 
 * Generates the original challenging maze track with a dark green background
 * and white track paths. Features complex corridors, vertical connections,
 * bridges, dead ends, and branches for strategic navigation.
 */

export class ClassicMazeGenerator {
  static get config() {
    return {
      name: "Classic Maze",
      description: "The original challenging maze",
      difficulty: "Medium",
      backgroundColor: 0x1a3a1a,
      trackColor: 0xffffff
    };
  }

  /**
   * Generate the classic maze track
   * @param {Phaser.Scene} scene - The Phaser scene
   * @returns {void}
   */
  static generate(scene) {
    const graphics = scene.add.graphics();
    const config = this.config;
    
    // Dark green background
    graphics.fillStyle(config.backgroundColor);
    graphics.fillRect(0, 0, 1920, 1080);
    
    // Draw white maze paths
    graphics.fillStyle(config.trackColor);
    
    // Main corridors (made wider for better navigation)
    graphics.fillRect(70, 170, 1780, 120); // Top corridor
    graphics.fillRect(70, 480, 1780, 120); // Middle corridor
    graphics.fillRect(70, 780, 1780, 120); // Bottom corridor
    
    // Vertical connections (made wider)
    graphics.fillRect(70, 170, 120, 730);   // Left wall
    graphics.fillRect(270, 170, 120, 430);  // First vertical
    graphics.fillRect(470, 270, 120, 330);  // Second vertical
    graphics.fillRect(670, 170, 120, 430);  // Third vertical
    graphics.fillRect(870, 270, 120, 530);  // Fourth vertical
    graphics.fillRect(1070, 170, 120, 630); // Fifth vertical
    graphics.fillRect(1270, 270, 120, 330); // Sixth vertical
    graphics.fillRect(1470, 170, 120, 730); // Seventh vertical
    graphics.fillRect(1730, 170, 120, 730); // Right wall
    
    // Bridges (made wider)
    graphics.fillRect(270, 330, 240, 90);  // First bridge
    graphics.fillRect(670, 330, 240, 90);  // Second bridge
    graphics.fillRect(470, 630, 440, 90);  // Third bridge
    graphics.fillRect(1070, 380, 240, 90); // Fourth bridge
    graphics.fillRect(1270, 630, 240, 90); // Fifth bridge
    
    // Dead ends (made wider)
    graphics.fillRect(170, 330, 140, 90);  // Left dead end
    graphics.fillRect(1570, 330, 180, 90); // Right dead end
    graphics.fillRect(370, 700, 340, 90);  // Bottom left dead end
    graphics.fillRect(1170, 700, 340, 90); // Bottom right dead end
    
    // Branches (made wider)
    graphics.fillRect(570, 380, 120, 130);  // First branch
    graphics.fillRect(970, 280, 120, 130);  // Second branch
    graphics.fillRect(1370, 560, 120, 170); // Third branch
    
    // Generate the texture
    graphics.generateTexture('track', 1920, 1080);
    graphics.destroy();
    
    console.log('[ClassicMazeGenerator] Classic maze track generated');
  }
}