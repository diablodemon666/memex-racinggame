// Node.js script to generate example maps for Memex Racing
// Run with: node generate-example-maps.js

const fs = require('fs');
const { createCanvas } = require('canvas');

// Map dimensions
const WIDTH = 4000;
const HEIGHT = 2000;

// Color definitions
const COLORS = {
  TRACK: '#000000',      // Black - valid movement area
  WALL: '#FFFFFF',       // White - boundaries
  DECORATIVE: '#808080'  // Gray - visual elements
};

// Generate Classic Maze map
function generateClassicMaze() {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  
  // Fill with walls (white)
  ctx.fillStyle = COLORS.WALL;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  
  // Main track border
  ctx.fillStyle = COLORS.TRACK;
  ctx.fillRect(100, 100, WIDTH - 200, HEIGHT - 200);
  
  // Add maze walls
  ctx.fillStyle = COLORS.WALL;
  
  // Horizontal walls
  for (let i = 0; i < 5; i++) {
    const y = 400 + (i * 300);
    const gap = 200 + (i % 2) * 1600;
    
    // Left section
    ctx.fillRect(100, y, gap - 100, 100);
    // Right section
    ctx.fillRect(gap + 400, y, WIDTH - gap - 500, 100);
  }
  
  // Vertical walls
  for (let i = 0; i < 8; i++) {
    const x = 400 + (i * 400);
    const gapY = 300 + (i % 3) * 500;
    
    // Top section
    ctx.fillRect(x, 100, 100, gapY - 100);
    // Bottom section
    ctx.fillRect(x, gapY + 300, 100, HEIGHT - gapY - 400);
  }
  
  // No fixed start/token areas or booster zones - all spawning is random
  
  // Save the map
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('classic-maze.png', buffer);
  console.log('Generated classic-maze.png');
  
  // Create accompanying JSON
  const config = {
    name: "Classic Maze",
    difficulty: "medium",
    author: "Memex Racing Team",
    description: "A traditional maze layout with multiple paths for challenging gameplay",
    dimensions: { width: WIDTH, height: HEIGHT },
    tileSize: 32,
    spawning: {
      note: "Players and M token spawn randomly",
      maxPlayers: 6
    },
    features: ["multiple_paths", "dead_ends", "challenging_layout", "balanced_difficulty"]
  };
  
  fs.writeFileSync('classic-maze.json', JSON.stringify(config, null, 2));
}

// Generate Speed Circuit map
function generateSpeedCircuit() {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  
  // Fill with walls (white)
  ctx.fillStyle = COLORS.WALL;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  
  // Create oval track
  ctx.fillStyle = COLORS.TRACK;
  
  // Outer track boundary
  const centerX = WIDTH / 2;
  const centerY = HEIGHT / 2;
  const outerRadiusX = 1800;
  const outerRadiusY = 800;
  
  // Draw oval track using rectangle approximation
  // Top straight
  ctx.fillRect(centerX - outerRadiusX, 200, outerRadiusX * 2, 300);
  // Bottom straight
  ctx.fillRect(centerX - outerRadiusX, HEIGHT - 500, outerRadiusX * 2, 300);
  // Left curve
  ctx.fillRect(200, 200, 400, HEIGHT - 400);
  // Right curve
  ctx.fillRect(WIDTH - 600, 200, 400, HEIGHT - 400);
  
  // Connect curves with diagonals
  ctx.beginPath();
  ctx.moveTo(600, 200);
  ctx.lineTo(centerX - outerRadiusX, 200);
  ctx.lineTo(centerX - outerRadiusX, 500);
  ctx.lineTo(600, 500);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(WIDTH - 600, 200);
  ctx.lineTo(centerX + outerRadiusX, 200);
  ctx.lineTo(centerX + outerRadiusX, 500);
  ctx.lineTo(WIDTH - 600, 500);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(600, HEIGHT - 500);
  ctx.lineTo(centerX - outerRadiusX, HEIGHT - 500);
  ctx.lineTo(centerX - outerRadiusX, HEIGHT - 200);
  ctx.lineTo(600, HEIGHT - 200);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(WIDTH - 600, HEIGHT - 500);
  ctx.lineTo(centerX + outerRadiusX, HEIGHT - 500);
  ctx.lineTo(centerX + outerRadiusX, HEIGHT - 200);
  ctx.lineTo(WIDTH - 600, HEIGHT - 200);
  ctx.closePath();
  ctx.fill();
  
  // Inner barrier to create circuit
  ctx.fillStyle = COLORS.WALL;
  ctx.fillRect(centerX - 1200, 600, 2400, HEIGHT - 1200);
  
  // No fixed start/token areas or booster zones - all spawning is random
  
  // Save the map
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('speed-circuit.png', buffer);
  console.log('Generated speed-circuit.png');
  
  // Create accompanying JSON
  const config = {
    name: "Speed Circuit",
    difficulty: "easy",
    author: "Memex Racing Team",
    description: "Wide oval track perfect for high-speed racing with minimal obstacles",
    dimensions: { width: WIDTH, height: HEIGHT },
    tileSize: 32,
    spawning: {
      note: "Players and M token spawn randomly",
      maxPlayers: 6
    },
    features: ["wide_tracks", "high_speed", "simple_layout", "beginner_friendly"]
  };
  
  fs.writeFileSync('speed-circuit.json', JSON.stringify(config, null, 2));
}

// Check if canvas is available
try {
  console.log('Generating example maps...');
  generateClassicMaze();
  generateSpeedCircuit();
  console.log('Done! Maps generated successfully.');
} catch (error) {
  console.error('Error: This script requires the "canvas" package.');
  console.error('Install it with: npm install canvas');
  console.error('');
  console.error('Alternatively, you can create maps manually using any image editor.');
  console.error('Follow the specifications in README.md');
}