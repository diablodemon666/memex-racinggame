/**
 * TweenManager.js - Centralized Tween Management with Memory Cleanup
 * 
 * Manages Phaser tweens with automatic cleanup to prevent memory leaks.
 * Provides a centralized API for creating, tracking, and cleaning up tweens
 * across different scenes and game objects.
 */

import { memoryRegistry } from '../../utils/MemoryRegistry.js';

export class TweenManager {
    constructor(scene) {
        this.scene = scene;
        this.tweens = new Map();
        this.tweenGroups = new Map();
        this.scope = `TweenManager_${scene.scene.key}`;
        
        // Track all created tweens for cleanup
        this.activeTweens = new Set();
        
        console.log(`[TweenManager] Initialized for scene: ${scene.scene.key}`);
    }

    /**
     * Create a managed tween with automatic cleanup
     * @param {Object} config - Tween configuration
     * @param {string} id - Optional unique identifier for the tween
     * @returns {Object} Tween object with cleanup utilities
     */
    createTween(config, id = null) {
        // Generate unique ID if not provided
        if (!id) {
            id = `tween_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        // Create the tween
        const tween = this.scene.tweens.add(config);
        
        // Store reference
        this.tweens.set(id, tween);
        this.activeTweens.add(tween);
        
        // Register with memory registry
        memoryRegistry.registerTween(id, tween, this.scope);
        
        // Add cleanup callbacks
        tween.on('complete', () => {
            this.removeTween(id);
        });
        
        tween.on('stop', () => {
            this.removeTween(id);
        });
        
        // Return enhanced tween object
        return {
            tween,
            id,
            stop: () => this.stopTween(id),
            pause: () => this.pauseTween(id),
            resume: () => this.resumeTween(id),
            destroy: () => this.removeTween(id)
        };
    }

    /**
     * Create a timeline with automatic cleanup
     * @param {Array} tweenConfigs - Array of tween configurations
     * @param {string} id - Optional unique identifier for the timeline
     * @returns {Object} Timeline object with cleanup utilities
     */
    createTimeline(tweenConfigs, id = null) {
        if (!id) {
            id = `timeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        const timeline = this.scene.tweens.createTimeline();
        
        // Add tweens to timeline
        tweenConfigs.forEach((config, index) => {
            timeline.add({
                ...config,
                offset: config.offset || index * 100 // Default stagger
            });
        });
        
        // Store reference
        this.tweens.set(id, timeline);
        this.activeTweens.add(timeline);
        
        // Register with memory registry
        memoryRegistry.registerTween(id, timeline, this.scope);
        
        // Add cleanup callbacks
        timeline.on('complete', () => {
            this.removeTween(id);
        });
        
        timeline.on('stop', () => {
            this.removeTween(id);
        });
        
        return {
            timeline,
            id,
            play: () => timeline.play(),
            stop: () => this.stopTween(id),
            pause: () => this.pauseTween(id),
            resume: () => this.resumeTween(id),
            destroy: () => this.removeTween(id)
        };
    }

    /**
     * Create a tween group for managing multiple related tweens
     * @param {string} groupId - Unique identifier for the group
     * @returns {Object} Group management utilities
     */
    createTweenGroup(groupId) {
        if (this.tweenGroups.has(groupId)) {
            console.warn(`[TweenManager] Group ${groupId} already exists`);
            return this.tweenGroups.get(groupId);
        }

        const group = {
            id: groupId,
            tweens: new Set(),
            add: (tween) => {
                group.tweens.add(tween);
                if (tween.id) {
                    // Track that this tween belongs to this group
                    const existingTween = this.tweens.get(tween.id);
                    if (existingTween) {
                        existingTween._groupId = groupId;
                    }
                }
            },
            stopAll: () => {
                group.tweens.forEach(tween => {
                    if (tween.tween && tween.tween.stop) {
                        tween.tween.stop();
                    }
                });
            },
            pauseAll: () => {
                group.tweens.forEach(tween => {
                    if (tween.tween && tween.tween.pause) {
                        tween.tween.pause();
                    }
                });
            },
            resumeAll: () => {
                group.tweens.forEach(tween => {
                    if (tween.tween && tween.tween.resume) {
                        tween.tween.resume();
                    }
                });
            },
            destroyAll: () => {
                group.tweens.forEach(tween => {
                    if (tween.destroy) {
                        tween.destroy();
                    }
                });
                group.tweens.clear();
                this.tweenGroups.delete(groupId);
            }
        };

        this.tweenGroups.set(groupId, group);
        return group;
    }

    /**
     * Stop a specific tween
     * @param {string} id - Tween ID
     */
    stopTween(id) {
        const tween = this.tweens.get(id);
        if (tween && tween.stop) {
            tween.stop();
        }
    }

    /**
     * Pause a specific tween
     * @param {string} id - Tween ID
     */
    pauseTween(id) {
        const tween = this.tweens.get(id);
        if (tween && tween.pause) {
            tween.pause();
        }
    }

    /**
     * Resume a specific tween
     * @param {string} id - Tween ID
     */
    resumeTween(id) {
        const tween = this.tweens.get(id);
        if (tween && tween.resume) {
            tween.resume();
        }
    }

    /**
     * Remove and cleanup a specific tween
     * @param {string} id - Tween ID
     */
    removeTween(id) {
        const tween = this.tweens.get(id);
        if (tween) {
            // Remove from active set
            this.activeTweens.delete(tween);
            
            // Remove from any groups
            if (tween._groupId) {
                const group = this.tweenGroups.get(tween._groupId);
                if (group) {
                    group.tweens.delete(tween);
                }
            }
            
            // Clean up the tween
            if (tween.remove) {
                tween.remove();
            } else if (tween.destroy) {
                tween.destroy();
            }
            
            // Remove from our tracking
            this.tweens.delete(id);
            
            // Remove from memory registry
            memoryRegistry.removeResource(id, 'tweens');
        }
    }

    /**
     * Stop all tweens in this manager
     */
    stopAllTweens() {
        console.log(`[TweenManager] Stopping all tweens for ${this.scope}`);
        
        for (const [id, tween] of this.tweens.entries()) {
            if (tween && tween.stop) {
                tween.stop();
            }
        }
    }

    /**
     * Pause all tweens in this manager
     */
    pauseAllTweens() {
        console.log(`[TweenManager] Pausing all tweens for ${this.scope}`);
        
        for (const [id, tween] of this.tweens.entries()) {
            if (tween && tween.pause) {
                tween.pause();
            }
        }
    }

    /**
     * Resume all tweens in this manager
     */
    resumeAllTweens() {
        console.log(`[TweenManager] Resuming all tweens for ${this.scope}`);
        
        for (const [id, tween] of this.tweens.entries()) {
            if (tween && tween.resume) {
                tween.resume();
            }
        }
    }

    /**
     * Get statistics about managed tweens
     * @returns {Object} Tween statistics
     */
    getStats() {
        return {
            activeTweens: this.tweens.size,
            tweenGroups: this.tweenGroups.size,
            scope: this.scope,
            tweenIds: Array.from(this.tweens.keys())
        };
    }

    /**
     * Clean up all tweens and destroy the manager
     */
    destroy() {
        console.log(`[TweenManager] Destroying TweenManager for ${this.scope}`);
        
        // Stop and clean up all tweens
        for (const [id, tween] of this.tweens.entries()) {
            if (tween) {
                if (tween.stop) {
                    tween.stop();
                }
                if (tween.remove) {
                    tween.remove();
                } else if (tween.destroy) {
                    tween.destroy();
                }
            }
        }
        
        // Clean up all groups
        for (const [groupId, group] of this.tweenGroups.entries()) {
            group.destroyAll();
        }
        
        // Clear all collections
        this.tweens.clear();
        this.tweenGroups.clear();
        this.activeTweens.clear();
        
        // Clean up memory registry resources for this scope
        memoryRegistry.cleanupScope(this.scope);
        
        console.log(`[TweenManager] TweenManager destroyed for ${this.scope}`);
    }
}

/**
 * Helper function to create fade in tween
 * @param {TweenManager} tweenManager - TweenManager instance
 * @param {Object} target - Target object to fade in
 * @param {number} duration - Fade duration in milliseconds
 * @param {Function} onComplete - Optional completion callback
 * @returns {Object} Managed tween
 */
export function createFadeIn(tweenManager, target, duration = 500, onComplete = null) {
    return tweenManager.createTween({
        targets: target,
        alpha: { from: 0, to: 1 },
        duration: duration,
        ease: 'Power2',
        onComplete: onComplete
    });
}

/**
 * Helper function to create fade out tween
 * @param {TweenManager} tweenManager - TweenManager instance
 * @param {Object} target - Target object to fade out
 * @param {number} duration - Fade duration in milliseconds
 * @param {Function} onComplete - Optional completion callback
 * @returns {Object} Managed tween
 */
export function createFadeOut(tweenManager, target, duration = 500, onComplete = null) {
    return tweenManager.createTween({
        targets: target,
        alpha: { from: 1, to: 0 },
        duration: duration,
        ease: 'Power2',
        onComplete: onComplete
    });
}

/**
 * Helper function to create scale bounce effect
 * @param {TweenManager} tweenManager - TweenManager instance
 * @param {Object} target - Target object to bounce
 * @param {number} scale - Target scale
 * @param {number} duration - Bounce duration in milliseconds
 * @returns {Object} Managed tween
 */
export function createScaleBounce(tweenManager, target, scale = 1.1, duration = 300) {
    return tweenManager.createTween({
        targets: target,
        scaleX: scale,
        scaleY: scale,
        duration: duration,
        ease: 'Back.easeOut',
        yoyo: true,
        repeat: 0
    });
}

/**
 * Helper function to create pulsing effect
 * @param {TweenManager} tweenManager - TweenManager instance
 * @param {Object} target - Target object to pulse
 * @param {number} minAlpha - Minimum alpha
 * @param {number} maxAlpha - Maximum alpha
 * @param {number} duration - Pulse duration in milliseconds
 * @returns {Object} Managed tween
 */
export function createPulse(tweenManager, target, minAlpha = 0.3, maxAlpha = 1, duration = 1000) {
    return tweenManager.createTween({
        targets: target,
        alpha: { from: maxAlpha, to: minAlpha },
        duration: duration,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1
    });
}

export default TweenManager;