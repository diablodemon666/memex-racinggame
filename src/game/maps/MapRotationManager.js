/**
 * MapRotationManager.js - Automatic Map Rotation System
 * 
 * Handles automatic map rotation every 3 races with preview functionality.
 * Manages the cycling through all 6 available maps and provides information
 * about current and next maps for the game UI.
 */

import { ClassicMazeGenerator } from './ClassicMazeGenerator.js';
import { SpeedwayGenerator } from './SpeedwayGenerator.js';
import { SerpentineGenerator } from './SerpentineGenerator.js';
import { GridGenerator } from './GridGenerator.js';
import { SpiralGenerator } from './SpiralGenerator.js';
import { IslandsGenerator } from './IslandsGenerator.js';

export class MapRotationManager {
  constructor() {
    // Map rotation configuration
    this.racesPerMap = 3;
    this.currentRaceCount = 0;
    this.currentMapIndex = 0;
    
    // Map generators registry
    this.mapGenerators = [
      ClassicMazeGenerator,
      SpeedwayGenerator,
      SerpentineGenerator,
      GridGenerator,
      SpiralGenerator,
      IslandsGenerator
    ];
    
    // Map keys for reference
    this.mapKeys = [
      'classic',
      'speedway',
      'serpentine',
      'grid',
      'spiral',
      'islands'
    ];
    
    console.log('[MapRotationManager] Initialized with automatic rotation every 3 races');
  }

  /**
   * Get current map information
   * @returns {Object} Current map data
   */
  getCurrentMap() {
    const generator = this.mapGenerators[this.currentMapIndex];
    return {
      key: this.mapKeys[this.currentMapIndex],
      generator: generator,
      config: generator.config,
      raceCount: this.currentRaceCount,
      racesRemaining: this.racesPerMap - this.currentRaceCount
    };
  }

  /**
   * Get next map information for preview
   * @returns {Object} Next map data
   */
  getNextMap() {
    const nextIndex = (this.currentMapIndex + 1) % this.mapGenerators.length;
    const generator = this.mapGenerators[nextIndex];
    return {
      key: this.mapKeys[nextIndex],
      generator: generator,
      config: generator.config
    };
  }

  /**
   * Get all available maps information
   * @returns {Array} Array of all map data
   */
  getAllMaps() {
    return this.mapGenerators.map((generator, index) => ({
      key: this.mapKeys[index],
      generator: generator,
      config: generator.config,
      isCurrent: index === this.currentMapIndex
    }));
  }

  /**
   * Advance to next race and check for map rotation
   * @returns {Object} Race advance result
   */
  advanceRace() {
    this.currentRaceCount++;
    
    const shouldRotate = this.currentRaceCount >= this.racesPerMap;
    const previousMap = this.getCurrentMap();
    
    if (shouldRotate) {
      this.rotateToNextMap();
    }
    
    const currentMap = this.getCurrentMap();
    
    return {
      raceNumber: this.getTotalRaces(),
      currentRaceOnMap: this.currentRaceCount,
      mapRotated: shouldRotate,
      previousMap: shouldRotate ? previousMap : null,
      currentMap: currentMap,
      nextMap: this.getNextMap()
    };
  }

  /**
   * Rotate to the next map in sequence
   * @returns {Object} Rotation result
   */
  rotateToNextMap() {
    const previousIndex = this.currentMapIndex;
    const previousMap = this.getCurrentMap();
    
    // Move to next map
    this.currentMapIndex = (this.currentMapIndex + 1) % this.mapGenerators.length;
    this.currentRaceCount = 0;
    
    const newMap = this.getCurrentMap();
    
    console.log(`[MapRotationManager] Rotated from ${previousMap.config.name} to ${newMap.config.name}`);
    
    return {
      rotated: true,
      previousMap: previousMap,
      newMap: newMap,
      newMapIndex: this.currentMapIndex
    };
  }

  /**
   * Generate current map track
   * @param {Phaser.Scene} scene - The Phaser scene
   */
  generateCurrentTrack(scene) {
    const currentMap = this.getCurrentMap();
    currentMap.generator.generate(scene);
    
    console.log(`[MapRotationManager] Generated track: ${currentMap.config.name} (Race ${this.currentRaceCount + 1}/${this.racesPerMap})`);
  }

  /**
   * Get rotation status display text
   * @returns {string} Status text for UI
   */
  getRotationStatusText() {
    const current = this.getCurrentMap();
    const next = this.getNextMap();
    
    return `Map: ${current.config.name} (${current.raceCount + 1}/${this.racesPerMap}) | Next: ${next.config.name}`;
  }

  /**
   * Get map preview information for results screen
   * @returns {Object} Preview information
   */
  getMapPreview() {
    const current = this.getCurrentMap();
    const next = this.getNextMap();
    const willRotate = current.raceCount + 1 >= this.racesPerMap;
    
    return {
      showPreview: willRotate,
      currentMap: current,
      nextMap: next,
      previewText: willRotate ? 
        `Next Track: ${next.config.name} - ${next.config.description}` :
        `Continuing: ${current.config.name} (${current.racesRemaining - 1} races remaining)`
    };
  }

  /**
   * Get total races played across all maps
   * @returns {number} Total race count
   */
  getTotalRaces() {
    return (this.currentMapIndex * this.racesPerMap) + this.currentRaceCount + 1;
  }

  /**
   * Get current rotation cycle number
   * @returns {number} Cycle number (how many full rotations completed)
   */
  getRotationCycle() {
    return Math.floor(this.getTotalRaces() / (this.mapGenerators.length * this.racesPerMap));
  }

  /**
   * Reset rotation manager (for game restart)
   */
  reset() {
    this.currentRaceCount = 0;
    this.currentMapIndex = 0;
    
    console.log('[MapRotationManager] Reset to starting map');
  }

  /**
   * Set specific map (for testing or special events)
   * @param {string} mapKey - Map key to set
   * @returns {boolean} Success status
   */
  setMap(mapKey) {
    const mapIndex = this.mapKeys.indexOf(mapKey);
    
    if (mapIndex === -1) {
      console.warn(`[MapRotationManager] Unknown map key: ${mapKey}`);
      return false;
    }
    
    this.currentMapIndex = mapIndex;
    this.currentRaceCount = 0;
    
    console.log(`[MapRotationManager] Manually set to map: ${this.getCurrentMap().config.name}`);
    return true;
  }

  /**
   * Get map statistics
   * @returns {Object} Map usage statistics
   */
  getStatistics() {
    return {
      totalRaces: this.getTotalRaces(),
      currentCycle: this.getRotationCycle(),
      racesPerMap: this.racesPerMap,
      totalMaps: this.mapGenerators.length,
      currentMapProgress: {
        name: this.getCurrentMap().config.name,
        raceCount: this.currentRaceCount,
        racesRemaining: this.racesPerMap - this.currentRaceCount
      }
    };
  }
}