/**
 * Track Template Generator for Memex Racing
 * 
 * Generates example track templates as PNG files with white tracks on transparent background.
 * Templates can be combined with any background image for variety.
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

/**
 * Base template generator class
 */
class TrackTemplateGenerator {
  constructor() {
    this.width = 4000;
    this.height = 2000;
    this.outputDir = path.join(__dirname, '../track-templates');
    this.trackColor = '#FFFFFF';
    this.minTrackWidth = 128;
    
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Create a new canvas with transparent background
   */
  createCanvas() {
    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');
    
    // Start with transparent background
    ctx.clearRect(0, 0, this.width, this.height);
    
    // Set track drawing style
    ctx.fillStyle = this.trackColor;
    ctx.strokeStyle = this.trackColor;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    return { canvas, ctx };
  }

  /**
   * Save canvas as PNG file
   */
  saveTemplate(canvas, filename) {
    const outputPath = path.join(this.outputDir, filename);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Generated: ${filename}`);
  }

  /**
   * Generate all example templates
   */
  generateAll() {
    console.log('Generating track templates...');
    
    this.generateSimpleOval();
    this.generateFigureEight();
    this.generateMazeClassic();
    this.generateSpiralMadness();
    this.generateGridCity();
    this.generateSpeedCircuit();
    
    console.log('All templates generated successfully!');
  }

  /**
   * Generate simple oval track
   */
  generateSimpleOval() {
    const { canvas, ctx } = this.createCanvas();
    
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const outerRadiusX = 1600;
    const outerRadiusY = 700;
    const innerRadiusX = 1200;
    const innerRadiusY = 500;
    
    // Draw outer oval
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, outerRadiusX, outerRadiusY, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    // Cut out inner oval to create track
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, innerRadiusX, innerRadiusY, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    this.saveTemplate(canvas, 'simple-oval.png');
  }

  /**
   * Generate figure-eight track
   */
  generateFigureEight() {
    const { canvas, ctx } = this.createCanvas();
    
    const centerY = this.height / 2;
    const loopRadius = 600;
    const trackWidth = 150;
    
    // Left loop center
    const leftX = this.width / 2 - 600;
    // Right loop center  
    const rightX = this.width / 2 + 600;
    
    ctx.lineWidth = trackWidth;
    
    // Draw left loop
    ctx.beginPath();
    ctx.arc(leftX, centerY, loopRadius, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Draw right loop
    ctx.beginPath();
    ctx.arc(rightX, centerY, loopRadius, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Draw crossover connection
    ctx.beginPath();
    ctx.moveTo(leftX + loopRadius - 50, centerY);
    ctx.lineTo(rightX - loopRadius + 50, centerY);
    ctx.stroke();
    
    this.saveTemplate(canvas, 'figure-eight.png');
  }

  /**
   * Generate classic maze track
   */
  generateMazeClassic() {
    const { canvas, ctx } = this.createCanvas();
    
    const cellSize = 200;
    const wallThickness = 50;
    const cols = Math.floor(this.width / cellSize);
    const rows = Math.floor(this.height / cellSize);
    
    // Create maze grid
    const maze = this.generateMazeGrid(cols, rows);
    
    // Draw maze paths
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (maze[row][col]) {
          const x = col * cellSize;
          const y = row * cellSize;
          ctx.fillRect(x + wallThickness/2, y + wallThickness/2, 
                      cellSize - wallThickness, cellSize - wallThickness);
        }
      }
    }
    
    // Ensure connectivity with main corridors
    ctx.fillRect(100, this.height/2 - 75, this.width - 200, 150);
    ctx.fillRect(this.width/2 - 75, 100, 150, this.height - 200);
    
    this.saveTemplate(canvas, 'maze-classic.png');
  }

  /**
   * Generate spiral track
   */
  generateSpiralMadness() {
    const { canvas, ctx } = this.createCanvas();
    
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const maxRadius = 900;
    const spiralTurns = 8;
    const trackWidth = 120;
    
    ctx.lineWidth = trackWidth;
    ctx.beginPath();
    
    let angle = 0;
    let radius = 50;
    const angleStep = 0.1;
    const radiusStep = maxRadius / (spiralTurns * 2 * Math.PI / angleStep);
    
    ctx.moveTo(centerX + radius, centerY);
    
    while (radius < maxRadius) {
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      ctx.lineTo(x, y);
      
      angle += angleStep;
      radius += radiusStep;
    }
    
    ctx.stroke();
    
    this.saveTemplate(canvas, 'spiral-madness.png');
  }

  /**
   * Generate grid city track
   */
  generateGridCity() {
    const { canvas, ctx } = this.createCanvas();
    
    const blockSize = 300;
    const streetWidth = 100;
    
    // Draw horizontal streets
    for (let y = streetWidth; y < this.height; y += blockSize) {
      ctx.fillRect(50, y, this.width - 100, streetWidth);
    }
    
    // Draw vertical streets
    for (let x = streetWidth; x < this.width; x += blockSize) {
      ctx.fillRect(x, 50, streetWidth, this.height - 100);
    }
    
    // Add some intersections and wider boulevards
    ctx.fillRect(50, this.height/2 - streetWidth, this.width - 100, streetWidth * 2);
    ctx.fillRect(this.width/2 - streetWidth, 50, streetWidth * 2, this.height - 100);
    
    this.saveTemplate(canvas, 'grid-city.png');
  }

  /**
   * Generate speed circuit
   */
  generateSpeedCircuit() {
    const { canvas, ctx } = this.createCanvas();
    
    const trackWidth = 200;
    const margin = 200;
    
    // Create rounded rectangle circuit
    const x = margin;
    const y = margin;
    const width = this.width - 2 * margin;
    const height = this.height - 2 * margin;
    const radius = 300;
    
    ctx.lineWidth = trackWidth;
    ctx.beginPath();
    ctx.roundRect(x + trackWidth/2, y + trackWidth/2, 
                  width - trackWidth, height - trackWidth, radius);
    ctx.stroke();
    
    this.saveTemplate(canvas, 'speed-circuit.png');
  }

  /**
   * Generate simple maze grid using recursive backtracking
   */
  generateMazeGrid(cols, rows) {
    const maze = Array(rows).fill().map(() => Array(cols).fill(false));
    
    // Simple pattern for demo - in production use proper maze algorithm
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Create corridors every few cells
        if (row % 3 === 1 || col % 3 === 1) {
          maze[row][col] = true;
        }
        // Add some random openings
        if (Math.random() > 0.7) {
          maze[row][col] = true;
        }
      }
    }
    
    return maze;
  }
}

/**
 * Background generator for testing
 */
class BackgroundGenerator {
  constructor() {
    this.width = 4000;
    this.height = 2000;
    this.outputDir = path.join(__dirname, '../backgrounds-library');
    
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generate example backgrounds
   */
  generateExampleBackgrounds() {
    console.log('Generating example backgrounds...');
    
    this.generateSpaceBackground();
    this.generateNatureBackground();
    this.generateCyberpunkBackground();
    
    console.log('Example backgrounds generated!');
  }

  /**
   * Generate space-themed background
   */
  generateSpaceBackground() {
    const { canvas, ctx } = this.createCanvas();
    
    // Dark space gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#000033');
    gradient.addColorStop(1, '#000066');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Add stars
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const size = Math.random() * 3 + 1;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fill();
    }
    
    this.saveBackground(canvas, 'space-station.jpg');
  }

  /**
   * Generate nature-themed background
   */
  generateNatureBackground() {
    const { canvas, ctx } = this.createCanvas();
    
    // Green gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#228B22');
    gradient.addColorStop(1, '#006400');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Add trees/vegetation
    ctx.fillStyle = '#32CD32';
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const size = Math.random() * 30 + 20;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fill();
    }
    
    this.saveBackground(canvas, 'forest-canopy.jpg');
  }

  /**
   * Generate cyberpunk-themed background
   */
  generateCyberpunkBackground() {
    const { canvas, ctx } = this.createCanvas();
    
    // Purple/pink gradient
    const gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
    gradient.addColorStop(0, '#2D1B69');
    gradient.addColorStop(0.5, '#FF00FF');
    gradient.addColorStop(1, '#00FFFF');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Add neon grid
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.3;
    
    // Vertical lines
    for (let x = 0; x < this.width; x += 200) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = 0; y < this.height; y += 200) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
    
    this.saveBackground(canvas, 'neon-city.jpg');
  }

  createCanvas() {
    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');
    return { canvas, ctx };
  }

  saveBackground(canvas, filename) {
    const outputPath = path.join(this.outputDir, filename);
    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.8 });
    fs.writeFileSync(outputPath, buffer);
    console.log(`Generated: ${filename}`);
  }
}

// Main execution
if (require.main === module) {
  const trackGenerator = new TrackTemplateGenerator();
  const backgroundGenerator = new BackgroundGenerator();
  
  console.log('=== Memex Racing Template Generator ===\n');
  
  trackGenerator.generateAll();
  console.log('');
  backgroundGenerator.generateExampleBackgrounds();
  
  console.log('\n=== Generation Complete ===');
  console.log('Track templates saved to: maps/track-templates/');
  console.log('Background images saved to: maps/backgrounds-library/');
  console.log('\nTo use: Just drop PNG templates and JPG backgrounds into the respective folders!');
}

module.exports = { TrackTemplateGenerator, BackgroundGenerator };