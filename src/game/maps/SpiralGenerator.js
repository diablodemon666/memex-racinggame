/**
 * SpiralGenerator.js - Spiral Madness Map Generator
 * 
 * Generates a hypnotic spiral track with a dark red background
 * and yellow track paths. Features a complex spiral pattern that
 * creates disorienting navigation challenges.
 */

export class SpiralGenerator {
  static get config() {
    return {
      name: "Spiral Madness",
      description: "Hypnotic spiral track",
      difficulty: "Very Hard",
      backgroundColor: 0x2a0a0a,
      trackColor: 0xffff00
    };
  }

  /**
   * Generate the spiral track
   * @param {Phaser.Scene} scene - The Phaser scene
   * @returns {void}
   */
  static generate(scene) {
    const graphics = scene.add.graphics();
    const config = this.config;
    
    // Dark red background
    graphics.fillStyle(config.backgroundColor);
    graphics.fillRect(0, 0, 1920, 1080);
    
    // Create the main spiral path
    const centerX = 960;
    const centerY = 540;
    const pathWidth = 100;
    
    // Set line style for spiral
    graphics.lineStyle(pathWidth, config.trackColor);
    graphics.beginPath();
    
    let prevX = centerX;
    let prevY = centerY;
    
    // Generate the spiral path
    for (let angle = 0; angle < Math.PI * 12; angle += 0.05) {
      const radius = angle * 40;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      // Ensure the spiral stays within bounds
      if (x > 50 && x < 1870 && y > 50 && y < 1030) {
        if (angle === 0) {
          graphics.moveTo(x, y);
        } else {
          graphics.lineTo(x, y);
        }
        prevX = x;
        prevY = y;
      }
    }
    
    graphics.strokePath();
    
    // Add entrance/exit paths with fill style
    graphics.fillStyle(config.trackColor);
    graphics.fillRect(centerX - pathWidth/2, centerY - pathWidth/2, pathWidth, 540);
    
    // Add secondary spiral for complexity
    graphics.lineStyle(60, config.trackColor);
    graphics.beginPath();
    
    for (let angle = Math.PI; angle < Math.PI * 8; angle += 0.08) {
      const radius = (angle - Math.PI) * 25 + 200;
      const x = centerX + Math.cos(-angle + Math.PI/2) * radius;
      const y = centerY + Math.sin(-angle + Math.PI/2) * radius;
      
      if (x > 100 && x < 1820 && y > 100 && y < 980) {
        if (angle === Math.PI) {
          graphics.moveTo(x, y);
        } else {
          graphics.lineTo(x, y);
        }
      }
    }
    
    graphics.strokePath();
    
    // Add connecting bridges
    graphics.fillStyle(config.trackColor);
    graphics.fillRect(400, 350, 200, 50);   // Upper left bridge
    graphics.fillRect(1320, 350, 200, 50);  // Upper right bridge
    graphics.fillRect(400, 680, 200, 50);   // Lower left bridge
    graphics.fillRect(1320, 680, 200, 50);  // Lower right bridge
    
    // Central hub
    graphics.fillCircle(centerX, centerY, 80);
    
    // Generate the texture
    graphics.generateTexture('track', 1920, 1080);
    graphics.destroy();
    
    console.log('[SpiralGenerator] Spiral madness track generated');
  }
}