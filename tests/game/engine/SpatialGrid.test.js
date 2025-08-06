/**
 * SpatialGrid.test.js - Tests for the spatial grid collision optimization
 */

import { SpatialGrid } from '../../../src/game/engine/SpatialGrid';

describe('SpatialGrid', () => {
  let spatialGrid;
  const worldWidth = 1920;
  const worldHeight = 1080;
  const cellSize = 64;

  beforeEach(() => {
    spatialGrid = new SpatialGrid(worldWidth, worldHeight, cellSize);
  });

  afterEach(() => {
    spatialGrid.clear();
    spatialGrid.clearCache();
  });

  describe('Initialization', () => {
    test('should initialize with correct dimensions', () => {
      expect(spatialGrid.worldWidth).toBe(worldWidth);
      expect(spatialGrid.worldHeight).toBe(worldHeight);
      expect(spatialGrid.cellSize).toBe(cellSize);
      expect(spatialGrid.gridWidth).toBe(Math.ceil(worldWidth / cellSize));
      expect(spatialGrid.gridHeight).toBe(Math.ceil(worldHeight / cellSize));
    });

    test('should initialize empty grid', () => {
      const stats = spatialGrid.getStats();
      expect(stats.totalObjects).toBe(0);
      expect(stats.occupiedCells).toBe(0);
    });
  });

  describe('Cell Index Calculation', () => {
    test('should calculate correct cell index for coordinates', () => {
      // Top-left corner
      expect(spatialGrid.getCellIndex(0, 0)).toBe(0);
      
      // Different positions
      expect(spatialGrid.getCellIndex(64, 0)).toBe(1);
      expect(spatialGrid.getCellIndex(0, 64)).toBe(spatialGrid.gridWidth);
      expect(spatialGrid.getCellIndex(64, 64)).toBe(spatialGrid.gridWidth + 1);
    });

    test('should clamp coordinates to grid bounds', () => {
      // Out of bounds coordinates should be clamped
      const maxIndex = spatialGrid.gridWidth * spatialGrid.gridHeight - 1;
      expect(spatialGrid.getCellIndex(-100, -100)).toBe(0);
      expect(spatialGrid.getCellIndex(worldWidth + 100, worldHeight + 100)).toBe(maxIndex);
    });
  });

  describe('Object Insertion', () => {
    test('should insert object without radius', () => {
      const testObject = { id: 1, x: 100, y: 100 };
      spatialGrid.insert(testObject, 100, 100);
      
      const stats = spatialGrid.getStats();
      expect(stats.totalObjects).toBe(1);
      expect(stats.occupiedCells).toBe(1);
    });

    test('should insert object with radius spanning multiple cells', () => {
      const testObject = { id: 1, x: 64, y: 64 };
      const radius = 50; // Should span multiple cells
      
      spatialGrid.insert(testObject, 64, 64, radius);
      
      const stats = spatialGrid.getStats();
      expect(stats.totalObjects).toBeGreaterThan(1); // Object appears in multiple cells
      expect(stats.occupiedCells).toBeGreaterThan(1);
    });

    test('should handle multiple objects in same cell', () => {
      const obj1 = { id: 1 };
      const obj2 = { id: 2 };
      
      spatialGrid.insert(obj1, 50, 50);
      spatialGrid.insert(obj2, 55, 55); // Same cell
      
      const stats = spatialGrid.getStats();
      expect(stats.totalObjects).toBe(2);
      expect(stats.occupiedCells).toBe(1);
      expect(stats.maxObjectsPerCell).toBe(2);
    });
  });

  describe('Nearby Object Retrieval', () => {
    beforeEach(() => {
      // Set up test objects in a grid pattern
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          const obj = { id: i * 5 + j, x: i * 100, y: j * 100 };
          spatialGrid.insert(obj, i * 100, j * 100);
        }
      }
    });

    test('should retrieve nearby objects efficiently', () => {
      const nearbyObjects = spatialGrid.getNearbyObjects(200, 200);
      
      // Should include objects in the same and adjacent cells
      expect(nearbyObjects.length).toBeGreaterThan(0);
      expect(nearbyObjects.length).toBeLessThan(25); // Not all objects
    });

    test('should cache nearby cell calculations', () => {
      // First call should populate cache
      spatialGrid.getNearbyObjects(100, 100);
      expect(spatialGrid.nearbyCache.size).toBeGreaterThan(0);
      
      // Second call should use cache
      const cacheSize = spatialGrid.nearbyCache.size;
      spatialGrid.getNearbyObjects(100, 100);
      expect(spatialGrid.nearbyCache.size).toBe(cacheSize);
    });

    test('should handle objects with radius in nearby search', () => {
      const nearbyObjects = spatialGrid.getNearbyObjects(200, 200, 100);
      
      // Larger radius should return more objects
      const smallRadiusObjects = spatialGrid.getNearbyObjects(200, 200, 10);
      expect(nearbyObjects.length).toBeGreaterThanOrEqual(smallRadiusObjects.length);
    });
  });

  describe('Area-based Retrieval', () => {
    beforeEach(() => {
      // Insert objects at known positions
      spatialGrid.insert({ id: 1 }, 50, 50);
      spatialGrid.insert({ id: 2 }, 150, 150);
      spatialGrid.insert({ id: 3 }, 250, 250);
    });

    test('should retrieve objects within rectangular area', () => {
      const objects = spatialGrid.getObjectsInArea(0, 0, 100, 100);
      expect(objects.length).toBe(1);
      expect(objects[0].id).toBe(1);
    });

    test('should retrieve multiple objects in larger area', () => {
      const objects = spatialGrid.getObjectsInArea(0, 0, 200, 200);
      expect(objects.length).toBe(2);
      expect(objects.map(o => o.id)).toEqual(expect.arrayContaining([1, 2]));
    });
  });

  describe('Performance Optimization', () => {
    test('should clear grid efficiently', () => {
      // Fill grid with objects
      for (let i = 0; i < 100; i++) {
        spatialGrid.insert({ id: i }, Math.random() * worldWidth, Math.random() * worldHeight);
      }
      
      expect(spatialGrid.getStats().totalObjects).toBe(100);
      
      // Clear should be fast and complete
      const start = performance.now();
      spatialGrid.clear();
      const end = performance.now();
      
      expect(end - start).toBeLessThan(10); // Should be very fast
      expect(spatialGrid.getStats().totalObjects).toBe(0);
    });

    test('should provide meaningful statistics', () => {
      spatialGrid.insert({ id: 1 }, 100, 100);
      spatialGrid.insert({ id: 2 }, 100, 100); // Same cell
      spatialGrid.insert({ id: 3 }, 200, 200); // Different cell
      
      const stats = spatialGrid.getStats();
      expect(stats.totalObjects).toBe(3);
      expect(stats.occupiedCells).toBe(2);
      expect(stats.maxObjectsPerCell).toBe(2);
      expect(stats.averageObjectsPerCell).toBe(1.5);
    });
  });

  describe('Grid Resizing', () => {
    test('should resize grid when world dimensions change', () => {
      const originalGridWidth = spatialGrid.gridWidth;
      
      spatialGrid.resize(3840, 2160); // Double the dimensions
      
      expect(spatialGrid.worldWidth).toBe(3840);
      expect(spatialGrid.worldHeight).toBe(2160);
      expect(spatialGrid.gridWidth).toBeGreaterThan(originalGridWidth);
    });

    test('should not resize if dimensions are the same', () => {
      const originalGrid = spatialGrid.grid;
      
      spatialGrid.resize(worldWidth, worldHeight); // Same dimensions
      
      expect(spatialGrid.grid).toBe(originalGrid); // Should be same reference
    });
  });

  describe('Memory Management', () => {
    test('should clear cache when requested', () => {
      spatialGrid.getNearbyObjects(100, 100); // Populate cache
      expect(spatialGrid.nearbyCache.size).toBeGreaterThan(0);
      
      spatialGrid.clearCache();
      expect(spatialGrid.nearbyCache.size).toBe(0);
    });

    test('should handle large numbers of objects without memory issues', () => {
      const objectCount = 10000;
      
      // Insert many objects
      for (let i = 0; i < objectCount; i++) {
        spatialGrid.insert(
          { id: i }, 
          Math.random() * worldWidth, 
          Math.random() * worldHeight
        );
      }
      
      const stats = spatialGrid.getStats();
      expect(stats.totalObjects).toBe(objectCount);
      
      // Should be able to query efficiently
      const start = performance.now();
      spatialGrid.getNearbyObjects(worldWidth / 2, worldHeight / 2);
      const end = performance.now();
      
      expect(end - start).toBeLessThan(50); // Should be reasonably fast
    });
  });

  describe('Edge Cases', () => {
    test('should handle objects at world boundaries', () => {
      spatialGrid.insert({ id: 1 }, 0, 0);
      spatialGrid.insert({ id: 2 }, worldWidth - 1, worldHeight - 1);
      
      const stats = spatialGrid.getStats();
      expect(stats.totalObjects).toBe(2);
    });

    test('should handle negative coordinates gracefully', () => {
      spatialGrid.insert({ id: 1 }, -100, -100);
      
      const stats = spatialGrid.getStats();
      expect(stats.totalObjects).toBe(1);
    });

    test('should handle very large radius', () => {
      const largeRadius = Math.max(worldWidth, worldHeight);
      spatialGrid.insert({ id: 1 }, worldWidth / 2, worldHeight / 2, largeRadius);
      
      const stats = spatialGrid.getStats();
      expect(stats.totalObjects).toBeGreaterThan(0);
    });
  });
});