/**
 * Maps Module Index
 * 
 * Exports all map generators and the map rotation manager
 * for use throughout the game system.
 */

export { ClassicMazeGenerator } from './ClassicMazeGenerator.js';
export { SpeedwayGenerator } from './SpeedwayGenerator.js';
export { SerpentineGenerator } from './SerpentineGenerator.js';
export { GridGenerator } from './GridGenerator.js';
export { SpiralGenerator } from './SpiralGenerator.js';
export { IslandsGenerator } from './IslandsGenerator.js';
export { MapRotationManager } from './MapRotationManager.js';

/**
 * Map generators array for easy iteration
 */
export const MAP_GENERATORS = [
  'ClassicMazeGenerator',
  'SpeedwayGenerator', 
  'SerpentineGenerator',
  'GridGenerator',
  'SpiralGenerator',
  'IslandsGenerator'
];

/**
 * Map keys for reference
 */
export const MAP_KEYS = [
  'classic',
  'speedway',
  'serpentine', 
  'grid',
  'spiral',
  'islands'
];