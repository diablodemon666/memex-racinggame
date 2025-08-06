/**
 * Map System Demo
 * 
 * Demonstrates the map rotation system and generator functionality
 */

import { MapRotationManager } from './MapRotationManager.js';
import { ClassicMazeGenerator, SpeedwayGenerator, SerpentineGenerator } from './index.js';

// Demo function to show map rotation
function demonstrateMapRotation() {
  console.log('=== Map Rotation System Demo ===\n');
  
  const manager = new MapRotationManager();
  
  // Show initial state
  console.log('Initial state:');
  console.log(`Current map: ${manager.getCurrentMap().config.name}`);
  console.log(`Status: ${manager.getRotationStatusText()}\n`);
  
  // Simulate racing through several races
  for (let race = 1; race <= 10; race++) {
    console.log(`--- Race ${race} ---`);
    
    const result = manager.advanceRace();
    
    console.log(`Current map: ${result.currentMap.config.name}`);
    console.log(`Race ${result.currentRaceOnMap}/${manager.racesPerMap} on this map`);
    
    if (result.mapRotated) {
      console.log(`🔄 MAP ROTATED! From ${result.previousMap.config.name} to ${result.currentMap.config.name}`);
    }
    
    const preview = manager.getMapPreview();
    console.log(`Preview: ${preview.previewText}`);
    console.log('');
  }
  
  // Show statistics
  console.log('=== Final Statistics ===');
  const stats = manager.getStatistics();
  console.log(`Total races: ${stats.totalRaces}`);
  console.log(`Current cycle: ${stats.currentCycle}`);
  console.log(`Current map: ${stats.currentMapProgress.name}`);
  console.log(`Races remaining on map: ${stats.currentMapProgress.racesRemaining}`);
}

// Demo function to show map configurations
function demonstrateMapConfigs() {
  console.log('\n=== Map Generator Configurations ===\n');
  
  const generators = [
    ClassicMazeGenerator,
    SpeedwayGenerator, 
    SerpentineGenerator
  ];
  
  generators.forEach(generator => {
    const config = generator.config;
    console.log(`${config.name}:`);
    console.log(`  Description: ${config.description}`);
    console.log(`  Difficulty: ${config.difficulty}`);
    console.log(`  Background: #${config.backgroundColor.toString(16).padStart(6, '0')}`);
    console.log(`  Track Color: #${config.trackColor.toString(16).padStart(6, '0')}`);
    console.log('');
  });
}

// Run demos if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateMapRotation();
  demonstrateMapConfigs();
}

export { demonstrateMapRotation, demonstrateMapConfigs };