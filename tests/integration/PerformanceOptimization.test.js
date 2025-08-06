/**
 * PerformanceOptimization.test.js - Integration tests for performance optimizations
 */

import { PhysicsManager } from '../../src/game/engine/PhysicsManager';
import { SpatialGrid } from '../../src/game/engine/SpatialGrid';
import { GameEngine } from '../../src/game/engine/GameEngine';

// Mock GameEngine for isolated physics testing
class MockGameEngine {
  constructor() {
    this.players = [];
    this.boosters = [];
    this.mToken = null;
    this.configManager = {
      get: jest.fn().mockReturnValue({})
    };
  }
}

describe('Performance Optimization Integration Tests', () => {
  let mockGameEngine;
  let physicsManager;

  beforeEach(() => {
    mockGameEngine = new MockGameEngine();
    physicsManager = new PhysicsManager(mockGameEngine);
  });

  afterEach(() => {
    if (physicsManager) {
      physicsManager.cleanup();
    }
  });

  describe('Collision Detection Performance', () => {
    test('should handle 6 players with O(n) complexity using spatial grid', () => {
      // Create 6 players in a small area to trigger many potential collisions
      const players = [];
      for (let i = 0; i < 6; i++) {
        const player = physicsManager.createPlayerPhysics(i, {
          x: 500 + i * 50,
          y: 500 + i * 50
        });
        players.push(player);
      }
      mockGameEngine.players = players;

      // Measure collision detection performance
      const iterations = 100;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        physicsManager.spatialGrid.clear();
        physicsManager.collisionPairs.clear();

        // Simulate physics update collision detection
        players.forEach(player => {
          physicsManager.spatialGrid.insert(
            player, 
            player.x, 
            player.y, 
            physicsManager.collisionConfig.playerCollisionRadius
          );
        });

        physicsManager.performOptimizedCollisionDetection();
      }

      const end = performance.now();
      const avgTime = (end - start) / iterations;

      // Should be very fast (under 1ms per frame for 6 players)
      expect(avgTime).toBeLessThan(1);
      console.log(`Average collision detection time: ${avgTime.toFixed(3)}ms`);
    });

    test('should scale linearly with more players', () => {
      const playerCounts = [6, 12, 24];
      const timings = [];

      for (const playerCount of playerCounts) {
        const players = [];
        for (let i = 0; i < playerCount; i++) {
          const player = physicsManager.createPlayerPhysics(i, {
            x: 100 + (i % 10) * 100,
            y: 100 + Math.floor(i / 10) * 100
          });
          players.push(player);
        }
        mockGameEngine.players = players;

        const iterations = 50;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
          physicsManager.spatialGrid.clear();
          physicsManager.collisionPairs.clear();

          players.forEach(player => {
            physicsManager.spatialGrid.insert(
              player, 
              player.x, 
              player.y, 
              physicsManager.collisionConfig.playerCollisionRadius
            );
          });

          physicsManager.performOptimizedCollisionDetection();
        }

        const end = performance.now();
        const avgTime = (end - start) / iterations;
        timings.push(avgTime);

        console.log(`${playerCount} players: ${avgTime.toFixed(3)}ms`);
      }

      // Should scale sub-quadratically (better than O(n²))
      const ratio1 = timings[1] / timings[0]; // 12 vs 6 players
      const ratio2 = timings[2] / timings[1]; // 24 vs 12 players

      // If it were O(n²), ratios would be 4x each time
      // With spatial grid, should be much better
      expect(ratio1).toBeLessThan(3);
      expect(ratio2).toBeLessThan(3);
    });

    test('should avoid duplicate collision checks', () => {
      // Create players that would have collisions
      const players = [];
      for (let i = 0; i < 4; i++) {
        const player = physicsManager.createPlayerPhysics(i, {
          x: 500,
          y: 500
        });
        players.push(player);
      }
      mockGameEngine.players = players;

      // Spy on collision handling
      const collisionSpy = jest.spyOn(physicsManager, 'handlePlayerCollision');

      // Run collision detection
      physicsManager.spatialGrid.clear();
      physicsManager.collisionPairs.clear();

      players.forEach(player => {
        physicsManager.spatialGrid.insert(
          player, 
          player.x, 
          player.y, 
          physicsManager.collisionConfig.playerCollisionRadius
        );
      });

      physicsManager.performOptimizedCollisionDetection();

      // With 4 players in same position, should have 6 collision pairs (4C2)
      // But each pair should only be checked once
      expect(collisionSpy).toHaveBeenCalledTimes(6);
    });
  });

  describe('Memory Leak Prevention', () => {
    test('should properly clean up timers in GameEngine', () => {
      const gameEngine = new GameEngine({
        width: 800,
        height: 600
      });

      // Create some timers
      gameEngine.setTimeout('test1', () => {}, 1000);
      gameEngine.setInterval('test2', () => {}, 500);

      expect(gameEngine.activeTimers.size).toBe(1);
      expect(gameEngine.activeIntervals.size).toBe(1);

      // Cleanup should clear all timers
      gameEngine.cleanup();

      expect(gameEngine.activeTimers.size).toBe(0);
      expect(gameEngine.activeIntervals.size).toBe(0);
    });

    test('should clean up spatial grid resources', () => {
      const spatialGrid = new SpatialGrid(1920, 1080);

      // Add objects and cache entries
      spatialGrid.insert({ id: 1 }, 100, 100);
      spatialGrid.getNearbyObjects(100, 100); // Creates cache entries

      expect(spatialGrid.getStats().totalObjects).toBe(1);
      expect(spatialGrid.nearbyCache.size).toBeGreaterThan(0);

      // Clear should remove everything
      spatialGrid.clear();
      spatialGrid.clearCache();

      expect(spatialGrid.getStats().totalObjects).toBe(0);
      expect(spatialGrid.nearbyCache.size).toBe(0);
    });

    test('should prevent timer accumulation over multiple game cycles', () => {
      const gameEngine = new GameEngine({
        width: 800,
        height: 600
      });

      // Simulate multiple game cycles creating timers
      for (let i = 0; i < 10; i++) {
        gameEngine.setTimeout(`cycle-${i}`, () => {}, 1000);
      }

      // Should only have the last timer (others cleared by same name)
      expect(gameEngine.activeTimers.size).toBe(10);

      // But if we use the same name repeatedly, should replace
      for (let i = 0; i < 10; i++) {
        gameEngine.setTimeout('repeating-timer', () => {}, 1000);
      }

      // Should only have 11 timers (10 unique + 1 repeating)
      expect(gameEngine.activeTimers.size).toBe(11);

      gameEngine.cleanup();
    });
  });

  describe('Frame Rate Performance', () => {
    test('should maintain 60 FPS target with full game simulation', async () => {
      const gameEngine = new GameEngine({
        width: 1920,
        height: 1080
      });

      // Create full player complement
      const players = [];
      for (let i = 0; i < 6; i++) {
        const player = gameEngine.physicsManager.createPlayerPhysics(i, {
          x: 200 + i * 100,
          y: 200 + i * 100
        });
        players.push(player);
      }
      gameEngine.players = players;

      // Simulate 60 FPS for 1 second (60 frames)
      const targetFrameTime = 1000 / 60; // 16.67ms per frame
      const frameCount = 60;
      let totalFrameTime = 0;

      for (let frame = 0; frame < frameCount; frame++) {
        const frameStart = performance.now();

        // Simulate full frame update
        gameEngine.physicsManager.update(Date.now(), 16);

        const frameEnd = performance.now();
        const frameTime = frameEnd - frameStart;
        totalFrameTime += frameTime;

        // Each frame should be well under the target
        expect(frameTime).toBeLessThan(targetFrameTime);
      }

      const avgFrameTime = totalFrameTime / frameCount;
      console.log(`Average frame time: ${avgFrameTime.toFixed(3)}ms (target: ${targetFrameTime.toFixed(3)}ms)`);

      // Average should be well under target (leave room for other game systems)
      expect(avgFrameTime).toBeLessThan(targetFrameTime * 0.5);

      gameEngine.cleanup();
    });

    test('should handle worst-case collision scenarios efficiently', () => {
      // Create scenario where all players are clustered together
      const players = [];
      for (let i = 0; i < 6; i++) {
        const player = physicsManager.createPlayerPhysics(i, {
          x: 500 + Math.random() * 20, // Tight cluster
          y: 500 + Math.random() * 20
        });
        players.push(player);
      }
      mockGameEngine.players = players;

      // Measure worst-case performance
      const iterations = 100;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        physicsManager.update(Date.now(), 16);

        // Move players slightly to trigger continuous collision checks
        players.forEach(player => {
          player.x += (Math.random() - 0.5) * 2;
          player.y += (Math.random() - 0.5) * 2;
        });
      }

      const end = performance.now();
      const avgTime = (end - start) / iterations;

      // Even worst-case should be fast
      expect(avgTime).toBeLessThan(5);
      console.log(`Worst-case collision time: ${avgTime.toFixed(3)}ms`);
    });
  });

  describe('Resource Usage Optimization', () => {
    test('should limit spatial grid memory usage', () => {
      const spatialGrid = new SpatialGrid(1920, 1080, 64);

      // Fill with maximum reasonable object count
      const objectCount = 1000;
      for (let i = 0; i < objectCount; i++) {
        spatialGrid.insert(
          { id: i },
          Math.random() * 1920,
          Math.random() * 1080
        );
      }

      const stats = spatialGrid.getStats();
      
      // Grid should distribute objects reasonably
      expect(stats.averageObjectsPerCell).toBeLessThan(20);
      expect(stats.maxObjectsPerCell).toBeLessThan(50);

      // Cache should not grow excessively
      for (let i = 0; i < 100; i++) {
        spatialGrid.getNearbyObjects(
          Math.random() * 1920,
          Math.random() * 1080
        );
      }

      // Cache should be reasonable size (not every query cached)
      expect(spatialGrid.nearbyCache.size).toBeLessThan(1000);
    });

    test('should efficiently handle dynamic object movement', () => {
      const objects = [];
      for (let i = 0; i < 50; i++) {
        objects.push({
          id: i,
          x: Math.random() * 1920,
          y: Math.random() * 1080
        });
      }

      // Measure performance over many updates
      const iterations = 100;
      const start = performance.now();

      for (let iter = 0; iter < iterations; iter++) {
        physicsManager.spatialGrid.clear();

        // Move objects
        objects.forEach(obj => {
          obj.x += (Math.random() - 0.5) * 10;
          obj.y += (Math.random() - 0.5) * 10;
          obj.x = Math.max(0, Math.min(1920, obj.x));
          obj.y = Math.max(0, Math.min(1080, obj.y));
        });

        // Re-insert all objects
        objects.forEach(obj => {
          physicsManager.spatialGrid.insert(obj, obj.x, obj.y);
        });

        // Query nearby objects for each
        objects.forEach(obj => {
          physicsManager.spatialGrid.getNearbyObjects(obj.x, obj.y, 50);
        });
      }

      const end = performance.now();
      const avgTime = (end - start) / iterations;

      // Should handle dynamic updates efficiently
      expect(avgTime).toBeLessThan(10);
      console.log(`Dynamic object update time: ${avgTime.toFixed(3)}ms`);
    });
  });
});