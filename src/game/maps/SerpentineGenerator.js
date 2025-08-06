/**
 * SerpentineGenerator.js - Serpentine Path Map Generator
 * 
 * Generates a winding snake-like track with a dark blue background
 * and cyan track paths. Features sinusoidal curves with connecting paths
 * and crossing points for complex navigation challenges.
 */

export class SerpentineGenerator {
  static get config() {
    return {
      name: "Serpentine Path",
      description: "Winding snake-like track",
      difficulty: "Hard",
      backgroundColor: 0x0a0a2a,
      trackColor: 0x00ffff
    };
  }

  /**
   * Generate the serpentine track
   * @param {Phaser.Scene} scene - The Phaser scene
   * @returns {void}
   */
  static generate(scene) {
    const graphics = scene.add.graphics();
    const config = this.config;
    
    // Dark blue background
    graphics.fillStyle(config.backgroundColor);
    graphics.fillRect(0, 0, 1920, 1080);
    
    // Draw cyan serpentine paths
    graphics.fillStyle(config.trackColor);
    
    // Create the main winding path using sine waves
    const pathWidth = 140;
    const amplitude = 300;
    const frequency = 0.003;
    
    // Main serpentine path
    for (let x = 50; x < 1870; x += 5) {
      const y = 540 + Math.sin(x * frequency) * amplitude;
      graphics.fillRect(x, y - pathWidth/2, 10, pathWidth);
    }
    
    // Add connecting paths at the ends for circulation
    graphics.fillRect(50, 240, 100, 600);   // Left connector
    graphics.fillRect(1770, 240, 100, 600); // Right connector
    
    // Add crossing paths for additional complexity
    graphics.fillRect(400, 340, 100, 400);  // First crossing
    graphics.fillRect(800, 340, 100, 400);  // Second crossing
    graphics.fillRect(1200, 340, 100, 400); // Third crossing
    graphics.fillRect(1600, 340, 100, 400); // Fourth crossing
    
    // Add secondary serpentine paths for variety
    for (let x = 200; x < 1720; x += 5) {
      const y1 = 340 + Math.sin((x + 400) * frequency * 1.5) * 150;
      const y2 = 740 + Math.sin((x - 200) * frequency * 1.2) * 120;
      
      if (y1 > 150 && y1 < 930) {
        graphics.fillRect(x, y1 - 40, 8, 80);
      }
      if (y2 > 150 && y2 < 930) {
        graphics.fillRect(x, y2 - 40, 8, 80);
      }
    }
    
    // Generate the texture
    graphics.generateTexture('track', 1920, 1080);
    graphics.destroy();
    
    console.log('[SerpentineGenerator] Serpentine path track generated');
  }
}