/**
 * TweenManager.test.js - Tests for Tween Manager
 * 
 * Tests the tween management functionality and memory cleanup
 */

import { TweenManager, createFadeIn, createFadeOut, createScaleBounce, createPulse } from '../../../src/game/systems/TweenManager.js';
import { memoryRegistry } from '../../../src/utils/MemoryRegistry.js';

// Mock Phaser scene
class MockScene {
    constructor(key = 'TestScene') {
        this.scene = { key };
        this.tweens = new MockTweenManager();
        this.add = new MockAddManager();
    }
}

class MockAddManager {
    circle(x, y, radius, color, alpha) {
        return new MockGameObject();
    }
}

class MockTweenManager {
    constructor() {
        this.activeTweens = new Set();
    }
    
    add(config) {
        const tween = new MockTween(config);
        this.activeTweens.add(tween);
        return tween;
    }
    
    createTimeline() {
        return new MockTimeline();
    }
}

class MockTween {
    constructor(config) {
        this.config = config;
        this.isPlaying = false;
        this.isPaused = false;
        this.isComplete = false;
        this.listeners = new Map();
        this._groupId = null;
    }
    
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }
    
    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }
    
    emit(event, ...args) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => callback(...args));
        }
    }
    
    play() {
        this.isPlaying = true;
        return this;
    }
    
    stop() {
        this.isPlaying = false;
        this.emit('stop');
        return this;
    }
    
    pause() {
        this.isPaused = true;
        return this;
    }
    
    resume() {
        this.isPaused = false;
        return this;
    }
    
    remove() {
        this.stop();
        return this;
    }
    
    complete() {
        this.isComplete = true;
        this.isPlaying = false;
        this.emit('complete');
    }
}

class MockTimeline extends MockTween {
    constructor() {
        super({});
        this.tweens = [];
    }
    
    add(config) {
        const tween = new MockTween(config);
        this.tweens.push(tween);
        return this;
    }
}

class MockGameObject {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.alpha = 1;
        this.scaleX = 1;
        this.scaleY = 1;
    }
}

describe('TweenManager', () => {
    let scene;
    let tweenManager;

    beforeEach(() => {
        scene = new MockScene();
        tweenManager = new TweenManager(scene);
        memoryRegistry.cleanupAll();
    });

    afterEach(() => {
        if (tweenManager) {
            tweenManager.destroy();
        }
        memoryRegistry.cleanupAll();
    });

    describe('Initialization', () => {
        test('should initialize with scene reference', () => {
            expect(tweenManager.scene).toBe(scene);
            expect(tweenManager.scope).toBe('TweenManager_TestScene');
            expect(tweenManager.tweens.size).toBe(0);
            expect(tweenManager.tweenGroups.size).toBe(0);
        });
    });

    describe('Tween Creation', () => {
        test('should create and register tween', () => {
            const target = new MockGameObject();
            const config = {
                targets: target,
                x: 100,
                duration: 1000
            };

            const result = tweenManager.createTween(config);

            expect(result.tween).toBeTruthy();
            expect(result.id).toBeTruthy();
            expect(result.stop).toBeInstanceOf(Function);
            expect(result.pause).toBeInstanceOf(Function);
            expect(result.resume).toBeInstanceOf(Function);
            expect(result.destroy).toBeInstanceOf(Function);

            expect(tweenManager.tweens.size).toBe(1);
            expect(tweenManager.activeTweens.size).toBe(1);
        });

        test('should create tween with custom ID', () => {
            const target = new MockGameObject();
            const config = { targets: target, x: 100 };
            const customId = 'my-custom-tween';

            const result = tweenManager.createTween(config, customId);

            expect(result.id).toBe(customId);
            expect(tweenManager.tweens.has(customId)).toBe(true);
        });

        test('should auto-remove tween on completion', () => {
            const target = new MockGameObject();
            const config = { targets: target, x: 100 };

            const result = tweenManager.createTween(config);
            const tween = result.tween;

            expect(tweenManager.tweens.size).toBe(1);

            // Simulate tween completion
            tween.complete();

            // Should be automatically removed
            expect(tweenManager.tweens.size).toBe(0);
            expect(tweenManager.activeTweens.size).toBe(0);
        });

        test('should auto-remove tween on stop', () => {
            const target = new MockGameObject();
            const config = { targets: target, x: 100 };

            const result = tweenManager.createTween(config);
            const tween = result.tween;

            expect(tweenManager.tweens.size).toBe(1);

            // Stop the tween
            tween.stop();

            // Should be automatically removed
            expect(tweenManager.tweens.size).toBe(0);
            expect(tweenManager.activeTweens.size).toBe(0);
        });
    });

    describe('Timeline Creation', () => {
        test('should create and register timeline', () => {
            const tweenConfigs = [
                { targets: new MockGameObject(), x: 100 },
                { targets: new MockGameObject(), y: 200 }
            ];

            const result = tweenManager.createTimeline(tweenConfigs);

            expect(result.timeline).toBeTruthy();
            expect(result.id).toBeTruthy();
            expect(result.play).toBeInstanceOf(Function);
            expect(result.stop).toBeInstanceOf(Function);

            expect(tweenManager.tweens.size).toBe(1);
            expect(tweenManager.activeTweens.size).toBe(1);
        });

        test('should create timeline with custom offsets', () => {
            const tweenConfigs = [
                { targets: new MockGameObject(), x: 100, offset: 0 },
                { targets: new MockGameObject(), y: 200, offset: 500 }
            ];

            const result = tweenManager.createTimeline(tweenConfigs, 'custom-timeline');

            expect(result.id).toBe('custom-timeline');
            expect(result.timeline.tweens.length).toBe(2);
        });
    });

    describe('Tween Groups', () => {
        test('should create tween group', () => {
            const group = tweenManager.createTweenGroup('test-group');

            expect(group.id).toBe('test-group');
            expect(group.add).toBeInstanceOf(Function);
            expect(group.stopAll).toBeInstanceOf(Function);
            expect(group.pauseAll).toBeInstanceOf(Function);
            expect(group.resumeAll).toBeInstanceOf(Function);
            expect(group.destroyAll).toBeInstanceOf(Function);

            expect(tweenManager.tweenGroups.has('test-group')).toBe(true);
        });

        test('should not create duplicate groups', () => {
            const group1 = tweenManager.createTweenGroup('same-id');
            const group2 = tweenManager.createTweenGroup('same-id');

            expect(group1).toBe(group2);
            expect(tweenManager.tweenGroups.size).toBe(1);
        });

        test('should add tweens to group', () => {
            const group = tweenManager.createTweenGroup('test-group');
            const tween = tweenManager.createTween({ targets: new MockGameObject(), x: 100 });

            group.add(tween);

            expect(group.tweens.size).toBe(1);
            expect(group.tweens.has(tween)).toBe(true);
        });

        test('should control all tweens in group', () => {
            const group = tweenManager.createTweenGroup('test-group');
            const tween1 = tweenManager.createTween({ targets: new MockGameObject(), x: 100 });
            const tween2 = tweenManager.createTween({ targets: new MockGameObject(), y: 200 });

            group.add(tween1);
            group.add(tween2);

            // Test stop all
            group.stopAll();
            expect(tween1.tween.isPlaying).toBe(false);
            expect(tween2.tween.isPlaying).toBe(false);

            // Test pause all
            tween1.tween.play();
            tween2.tween.play();
            group.pauseAll();
            expect(tween1.tween.isPaused).toBe(true);
            expect(tween2.tween.isPaused).toBe(true);

            // Test resume all
            group.resumeAll();
            expect(tween1.tween.isPaused).toBe(false);
            expect(tween2.tween.isPaused).toBe(false);
        });
    });

    describe('Tween Control', () => {
        test('should stop specific tween', () => {
            const tween = tweenManager.createTween({ targets: new MockGameObject(), x: 100 });
            
            tween.tween.play();
            expect(tween.tween.isPlaying).toBe(true);

            tweenManager.stopTween(tween.id);
            expect(tween.tween.isPlaying).toBe(false);
        });

        test('should pause and resume specific tween', () => {
            const tween = tweenManager.createTween({ targets: new MockGameObject(), x: 100 });
            
            tweenManager.pauseTween(tween.id);
            expect(tween.tween.isPaused).toBe(true);

            tweenManager.resumeTween(tween.id);
            expect(tween.tween.isPaused).toBe(false);
        });

        test('should remove specific tween', () => {
            const tween = tweenManager.createTween({ targets: new MockGameObject(), x: 100 });
            
            expect(tweenManager.tweens.size).toBe(1);

            tweenManager.removeTween(tween.id);

            expect(tweenManager.tweens.size).toBe(0);
            expect(tweenManager.activeTweens.size).toBe(0);
        });
    });

    describe('Bulk Operations', () => {
        test('should stop all tweens', () => {
            const tween1 = tweenManager.createTween({ targets: new MockGameObject(), x: 100 });
            const tween2 = tweenManager.createTween({ targets: new MockGameObject(), y: 200 });

            tween1.tween.play();
            tween2.tween.play();

            tweenManager.stopAllTweens();

            expect(tween1.tween.isPlaying).toBe(false);
            expect(tween2.tween.isPlaying).toBe(false);
        });

        test('should pause all tweens', () => {
            const tween1 = tweenManager.createTween({ targets: new MockGameObject(), x: 100 });
            const tween2 = tweenManager.createTween({ targets: new MockGameObject(), y: 200 });

            tweenManager.pauseAllTweens();

            expect(tween1.tween.isPaused).toBe(true);
            expect(tween2.tween.isPaused).toBe(true);
        });

        test('should resume all tweens', () => {
            const tween1 = tweenManager.createTween({ targets: new MockGameObject(), x: 100 });
            const tween2 = tweenManager.createTween({ targets: new MockGameObject(), y: 200 });

            tween1.tween.pause();
            tween2.tween.pause();

            tweenManager.resumeAllTweens();

            expect(tween1.tween.isPaused).toBe(false);
            expect(tween2.tween.isPaused).toBe(false);
        });
    });

    describe('Statistics', () => {
        test('should provide accurate statistics', () => {
            tweenManager.createTween({ targets: new MockGameObject(), x: 100 });
            tweenManager.createTween({ targets: new MockGameObject(), y: 200 });
            tweenManager.createTweenGroup('group1');

            const stats = tweenManager.getStats();

            expect(stats.activeTweens).toBe(2);
            expect(stats.tweenGroups).toBe(1);
            expect(stats.scope).toBe('TweenManager_TestScene');
            expect(stats.tweenIds.length).toBe(2);
        });
    });

    describe('Memory Management', () => {
        test('should register tweens with memory registry', () => {
            const tween = tweenManager.createTween({ targets: new MockGameObject(), x: 100 });

            const stats = memoryRegistry.getMemoryStats();
            expect(stats.tweens).toBe(1);
        });

        test('should cleanup all resources on destroy', () => {
            const tween1 = tweenManager.createTween({ targets: new MockGameObject(), x: 100 });
            const tween2 = tweenManager.createTween({ targets: new MockGameObject(), y: 200 });
            const group = tweenManager.createTweenGroup('test-group');

            expect(tweenManager.tweens.size).toBe(2);
            expect(tweenManager.tweenGroups.size).toBe(1);

            tweenManager.destroy();

            expect(tweenManager.tweens.size).toBe(0);
            expect(tweenManager.tweenGroups.size).toBe(0);
            expect(tweenManager.activeTweens.size).toBe(0);

            // Should also cleanup from memory registry
            const stats = memoryRegistry.getMemoryStats();
            expect(stats.tweens).toBe(0);
        });
    });

    describe('Helper Functions', () => {
        test('createFadeIn should create fade in tween', () => {
            const target = new MockGameObject();
            const callback = jest.fn();

            const result = createFadeIn(tweenManager, target, 500, callback);

            expect(result.tween).toBeTruthy();
            expect(result.tween.config.targets).toBe(target);
            expect(result.tween.config.alpha).toEqual({ from: 0, to: 1 });
            expect(result.tween.config.duration).toBe(500);
            expect(result.tween.config.onComplete).toBe(callback);
        });

        test('createFadeOut should create fade out tween', () => {
            const target = new MockGameObject();

            const result = createFadeOut(tweenManager, target, 300);

            expect(result.tween.config.alpha).toEqual({ from: 1, to: 0 });
            expect(result.tween.config.duration).toBe(300);
        });

        test('createScaleBounce should create scale bounce tween', () => {
            const target = new MockGameObject();

            const result = createScaleBounce(tweenManager, target, 1.2, 400);

            expect(result.tween.config.scaleX).toBe(1.2);
            expect(result.tween.config.scaleY).toBe(1.2);
            expect(result.tween.config.duration).toBe(400);
            expect(result.tween.config.yoyo).toBe(true);
        });

        test('createPulse should create pulsing tween', () => {
            const target = new MockGameObject();

            const result = createPulse(tweenManager, target, 0.5, 1, 1200);

            expect(result.tween.config.alpha).toEqual({ from: 1, to: 0.5 });
            expect(result.tween.config.duration).toBe(1200);
            expect(result.tween.config.repeat).toBe(-1);
            expect(result.tween.config.yoyo).toBe(true);
        });
    });

    describe('Error Handling', () => {
        test('should handle operations on non-existent tweens gracefully', () => {
            expect(() => {
                tweenManager.stopTween('non-existent');
                tweenManager.pauseTween('non-existent');
                tweenManager.resumeTween('non-existent');
                tweenManager.removeTween('non-existent');
            }).not.toThrow();
        });

        test('should handle destroy on already destroyed manager', () => {
            tweenManager.destroy();
            
            expect(() => {
                tweenManager.destroy();
            }).not.toThrow();
        });
    });
});