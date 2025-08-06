/**
 * SceneCleanupUtils.js - Scene Memory Management Utilities
 * 
 * Provides utilities for Phaser scenes to properly track and cleanup
 * event listeners, timers, tweens, and other resources to prevent memory leaks.
 */

import { memoryRegistry, managedAddEventListener, managedSetTimeout, managedSetInterval } from '../../utils/MemoryRegistry.js';
import { TweenManager } from './TweenManager.js';

export class SceneMemoryManager {
    constructor(scene) {
        this.scene = scene;
        this.sceneKey = scene.scene.key;
        this.scope = `Scene_${this.sceneKey}`;
        
        // Create tween manager for this scene
        this.tweenManager = new TweenManager(scene);
        
        // Track event listeners
        this.eventListeners = new Map();
        
        // Track timers and intervals
        this.timers = new Set();
        this.intervals = new Set();
        
        // Track input handlers
        this.inputHandlers = new Map();
        
        // Track physics groups and bodies
        this.physicsGroups = new Set();
        
        console.log(`[SceneMemoryManager] Initialized for scene: ${this.sceneKey}`);
        
        // Setup automatic cleanup on scene shutdown
        this.setupAutoCleanup();
    }

    /**
     * Add a managed event listener to a DOM element or Phaser object
     * @param {Object} target - Target object/element
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     * @param {Object} options - Event options
     * @returns {Object} Cleanup utilities
     */
    addEventListener(target, event, handler, options = {}) {
        const id = `${this.sceneKey}_listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Handle Phaser event emitters differently from DOM elements
        if (target && typeof target.on === 'function') {
            // Phaser EventEmitter
            target.on(event, handler);
            
            const cleanup = () => {
                if (target && typeof target.off === 'function') {
                    target.off(event, handler);
                }
                this.eventListeners.delete(id);
            };
            
            this.eventListeners.set(id, { target, event, handler, cleanup, type: 'phaser' });
            
            return { id, cleanup };
        } else {
            // DOM element
            const result = managedAddEventListener(target, event, handler, options, this.scope);
            this.eventListeners.set(result.id, { target, event, handler, cleanup: result.cleanup, type: 'dom' });
            
            return result;
        }
    }

    /**
     * Add a managed keyboard input handler
     * @param {string} keyCode - Key code (e.g., 'keydown-ESC')
     * @param {Function} handler - Key handler function
     * @returns {Object} Cleanup utilities
     */
    addKeyboardHandler(keyCode, handler) {
        const id = `${this.sceneKey}_key_${keyCode}_${Date.now()}`;
        
        this.scene.input.keyboard.on(keyCode, handler);
        
        const cleanup = () => {
            if (this.scene.input && this.scene.input.keyboard) {
                this.scene.input.keyboard.off(keyCode, handler);
            }
            this.inputHandlers.delete(id);
        };
        
        this.inputHandlers.set(id, { keyCode, handler, cleanup });
        
        return { id, cleanup };
    }

    /**
     * Add a managed pointer input handler
     * @param {string} event - Pointer event ('pointerdown', 'pointerup', etc.)
     * @param {Function} handler - Pointer handler function
     * @returns {Object} Cleanup utilities
     */
    addPointerHandler(event, handler) {
        const id = `${this.sceneKey}_pointer_${event}_${Date.now()}`;
        
        this.scene.input.on(event, handler);
        
        const cleanup = () => {
            if (this.scene.input) {
                this.scene.input.off(event, handler);
            }
            this.inputHandlers.delete(id);
        };
        
        this.inputHandlers.set(id, { event, handler, cleanup });
        
        return { id, cleanup };
    }

    /**
     * Create a managed timeout
     * @param {Function} callback - Callback function
     * @param {number} delay - Delay in milliseconds
     * @returns {Object} Timer utilities
     */
    setTimeout(callback, delay) {
        const result = managedSetTimeout(callback, delay, this.scope);
        this.timers.add(result.id);
        
        return result;
    }

    /**
     * Create a managed interval
     * @param {Function} callback - Callback function
     * @param {number} delay - Interval delay in milliseconds
     * @returns {Object} Interval utilities
     */
    setInterval(callback, delay) {
        const result = managedSetInterval(callback, delay, this.scope);
        this.intervals.add(result.id);
        
        return result;
    }

    /**
     * Create a managed Phaser timer event
     * @param {Object} config - Timer event configuration
     * @returns {Object} Timer event with cleanup
     */
    addTimerEvent(config) {
        const id = `${this.sceneKey}_timer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const timerEvent = this.scene.time.addEvent(config);
        
        const cleanup = () => {
            if (timerEvent && !timerEvent.hasDispatched) {
                timerEvent.remove();
            }
        };
        
        // Register with memory registry
        memoryRegistry.registerTimer(id, { remove: cleanup }, this.scope);
        
        return {
            id,
            timerEvent,
            cleanup
        };
    }

    /**
     * Track a physics group for cleanup
     * @param {Phaser.Physics.Arcade.Group} group - Physics group
     */
    trackPhysicsGroup(group) {
        this.physicsGroups.add(group);
    }

    /**
     * Get the tween manager for this scene
     * @returns {TweenManager} Tween manager instance
     */
    getTweenManager() {
        return this.tweenManager;
    }

    /**
     * Create a managed tween (shortcut to tween manager)
     * @param {Object} config - Tween configuration
     * @param {string} id - Optional tween ID
     * @returns {Object} Managed tween
     */
    createTween(config, id = null) {
        return this.tweenManager.createTween(config, id);
    }

    /**
     * Setup automatic cleanup when scene shuts down
     * @private
     */
    setupAutoCleanup() {
        // Listen for scene shutdown events
        this.scene.events.on('shutdown', () => {
            this.cleanup();
        });
        
        this.scene.events.on('destroy', () => {
            this.destroy();
        });
    }

    /**
     * Clean up all managed resources
     */
    cleanup() {
        console.log(`[SceneMemoryManager] Cleaning up resources for scene: ${this.sceneKey}`);
        
        let cleanedCount = 0;
        
        // Clean up event listeners
        for (const [id, listenerData] of this.eventListeners.entries()) {
            listenerData.cleanup();
            cleanedCount++;
        }
        this.eventListeners.clear();
        
        // Clean up input handlers
        for (const [id, handlerData] of this.inputHandlers.entries()) {
            handlerData.cleanup();
            cleanedCount++;
        }
        this.inputHandlers.clear();
        
        // Clean up physics groups
        for (const group of this.physicsGroups) {
            if (group && group.destroy) {
                group.destroy(true); // Destroy children too
            }
            cleanedCount++;
        }
        this.physicsGroups.clear();
        
        // Clean up tween manager
        if (this.tweenManager) {
            this.tweenManager.destroy();
            cleanedCount++;
        }
        
        // Clean up all resources in the scene scope
        memoryRegistry.cleanupScope(this.scope);
        
        console.log(`[SceneMemoryManager] Cleaned up ${cleanedCount} resources for scene: ${this.sceneKey}`);
    }

    /**
     * Destroy the scene memory manager
     */
    destroy() {
        console.log(`[SceneMemoryManager] Destroying memory manager for scene: ${this.sceneKey}`);
        
        this.cleanup();
        
        // Clear references
        this.scene = null;
        this.tweenManager = null;
        
        console.log(`[SceneMemoryManager] Memory manager destroyed for scene: ${this.sceneKey}`);
    }

    /**
     * Get memory usage statistics for this scene
     * @returns {Object} Memory statistics
     */
    getMemoryStats() {
        return {
            sceneKey: this.sceneKey,
            scope: this.scope,
            eventListeners: this.eventListeners.size,
            inputHandlers: this.inputHandlers.size,
            timers: this.timers.size,
            intervals: this.intervals.size,
            physicsGroups: this.physicsGroups.size,
            tweenStats: this.tweenManager ? this.tweenManager.getStats() : null
        };
    }
}

/**
 * Mixin to add memory management to existing Phaser scenes
 * @param {Phaser.Scene} scene - Scene to enhance
 * @returns {Object} Enhanced scene with memory management methods
 */
export function addMemoryManagement(scene) {
    // Don't add if already present
    if (scene.memoryManager) {
        return scene;
    }
    
    const memoryManager = new SceneMemoryManager(scene);
    scene.memoryManager = memoryManager;
    
    // Add convenience methods to scene
    scene.managedAddEventListener = memoryManager.addEventListener.bind(memoryManager);
    scene.managedSetTimeout = memoryManager.setTimeout.bind(memoryManager);
    scene.managedSetInterval = memoryManager.setInterval.bind(memoryManager);
    scene.managedAddTimerEvent = memoryManager.addTimerEvent.bind(memoryManager);
    scene.managedAddKeyboardHandler = memoryManager.addKeyboardHandler.bind(memoryManager);
    scene.managedAddPointerHandler = memoryManager.addPointerHandler.bind(memoryManager);
    scene.managedCreateTween = memoryManager.createTween.bind(memoryManager);
    scene.managedTrackPhysicsGroup = memoryManager.trackPhysicsGroup.bind(memoryManager);
    
    return scene;
}

/**
 * Helper function to enhance a scene's create method with memory management
 * @param {Phaser.Scene} scene - Scene to enhance
 * @param {Function} originalCreate - Original create method
 * @returns {Function} Enhanced create method
 */
export function enhanceSceneCreate(scene, originalCreate) {
    return function(...args) {
        // Add memory management first
        addMemoryManagement(scene);
        
        // Call original create method
        const result = originalCreate.apply(scene, args);
        
        console.log(`[SceneCleanupUtils] Enhanced scene ${scene.scene.key} with memory management`);
        
        return result;
    };
}

/**
 * Helper function to enhance a scene's destroy method with memory cleanup
 * @param {Phaser.Scene} scene - Scene to enhance
 * @param {Function} originalDestroy - Original destroy method (optional)
 * @returns {Function} Enhanced destroy method
 */
export function enhanceSceneDestroy(scene, originalDestroy = null) {
    return function(...args) {
        // Clean up memory management first
        if (scene.memoryManager) {
            scene.memoryManager.destroy();
        }
        
        // Call original destroy method if it exists
        if (originalDestroy && typeof originalDestroy === 'function') {
            return originalDestroy.apply(scene, args);
        }
    };
}

export default SceneMemoryManager;