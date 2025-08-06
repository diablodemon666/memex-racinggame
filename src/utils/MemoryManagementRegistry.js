/**
 * Memory Management Registry
 * Tracks and cleans up resources to prevent memory leaks
 * Handles timers, event listeners, Phaser tweens, and other resources
 */

/**
 * Memory Management Registry Class
 * Provides centralized resource tracking and cleanup
 */
class MemoryManagementRegistry {
  constructor() {
    // Resource tracking maps
    this.timers = new Map();
    this.intervals = new Map();
    this.eventListeners = new Map();
    this.phaserTweens = new Map();
    this.customCleanups = new Map();
    this.scopes = new Map(); // Track resources by scope
    
    // Performance monitoring
    this.stats = {
      timersCreated: 0,
      timersCleared: 0,
      intervalsCreated: 0,
      intervalsCleared: 0,
      listenersRegistered: 0,
      listenersRemoved: 0,
      tweensRegistered: 0,
      tweensCleared: 0,
      customCleanupsRegistered: 0,
      customCleanupsExecuted: 0
    };
    
    // Automatic cleanup on process exit
    this.registerProcessCleanup();
  }

  /**
   * Generate a unique resource ID
   * @param {string} prefix - ID prefix
   * @returns {string} - Unique ID
   */
  generateId(prefix = 'resource') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Register a timeout timer for cleanup tracking
   * @param {string} id - Unique identifier for the timer
   * @param {number} delay - Timeout delay in milliseconds
   * @param {Function} callback - Timer callback function
   * @param {string} scope - Optional scope for grouped cleanup
   * @returns {number} - Timer ID
   */
  registerTimeout(id, delay, callback, scope = null) {
    if (!id) {
      id = this.generateId('timeout');
    }

    // Clear existing timer with same ID
    this.clearTimeout(id);

    // Create new timeout
    const timerId = setTimeout(() => {
      try {
        callback();
      } finally {
        // Auto-remove from registry when completed
        this.timers.delete(id);
        if (scope) {
          this.removeFromScope(scope, 'timeout', id);
        }
      }
    }, delay);

    // Store timer reference
    this.timers.set(id, {
      type: 'timeout',
      timerId,
      delay,
      createdAt: Date.now(),
      scope
    });

    // Add to scope if specified
    if (scope) {
      this.addToScope(scope, 'timeout', id);
    }

    this.stats.timersCreated++;
    return timerId;
  }

  /**
   * Register an interval timer for cleanup tracking
   * @param {string} id - Unique identifier for the interval
   * @param {number} delay - Interval delay in milliseconds
   * @param {Function} callback - Interval callback function
   * @param {string} scope - Optional scope for grouped cleanup
   * @returns {number} - Interval ID
   */
  registerInterval(id, delay, callback, scope = null) {
    if (!id) {
      id = this.generateId('interval');
    }

    // Clear existing interval with same ID
    this.clearInterval(id);

    // Create new interval
    const intervalId = setInterval(callback, delay);

    // Store interval reference
    this.intervals.set(id, {
      type: 'interval',
      intervalId,
      delay,
      createdAt: Date.now(),
      scope
    });

    // Add to scope if specified
    if (scope) {
      this.addToScope(scope, 'interval', id);
    }

    this.stats.intervalsCreated++;
    return intervalId;
  }

  /**
   * Register an event listener for cleanup tracking
   * @param {string} id - Unique identifier for the listener
   * @param {EventTarget} element - Element to attach listener to
   * @param {string} event - Event type
   * @param {Function} handler - Event handler function
   * @param {object|boolean} options - Event listener options
   * @param {string} scope - Optional scope for grouped cleanup
   */
  registerEventListener(id, element, event, handler, options = false, scope = null) {
    if (!id) {
      id = this.generateId('listener');
    }

    // Remove existing listener with same ID
    this.removeEventListener(id);

    // Add event listener
    element.addEventListener(event, handler, options);

    // Store listener reference
    this.eventListeners.set(id, {
      type: 'eventListener',
      element,
      event,
      handler,
      options,
      createdAt: Date.now(),
      scope
    });

    // Add to scope if specified
    if (scope) {
      this.addToScope(scope, 'eventListener', id);
    }

    this.stats.listenersRegistered++;
  }

  /**
   * Register a Phaser tween for cleanup tracking
   * @param {string} id - Unique identifier for the tween
   * @param {object} tween - Phaser tween object
   * @param {string} scope - Optional scope for grouped cleanup
   */
  registerPhaserTween(id, tween, scope = null) {
    if (!id) {
      id = this.generateId('tween');
    }

    // Remove existing tween with same ID
    this.clearPhaserTween(id);

    // Store tween reference
    this.phaserTweens.set(id, {
      type: 'phaserTween',
      tween,
      createdAt: Date.now(),
      scope
    });

    // Add to scope if specified
    if (scope) {
      this.addToScope(scope, 'phaserTween', id);
    }

    this.stats.tweensRegistered++;
  }

  /**
   * Register a custom cleanup function
   * @param {string} id - Unique identifier for the cleanup
   * @param {Function} cleanupFunction - Function to call during cleanup
   * @param {string} scope - Optional scope for grouped cleanup
   */
  registerCustomCleanup(id, cleanupFunction, scope = null) {
    if (!id) {
      id = this.generateId('custom');
    }

    this.customCleanups.set(id, {
      type: 'customCleanup',
      cleanupFunction,
      createdAt: Date.now(),
      scope
    });

    // Add to scope if specified
    if (scope) {
      this.addToScope(scope, 'customCleanup', id);
    }

    this.stats.customCleanupsRegistered++;
  }

  /**
   * Clear a registered timeout
   * @param {string} id - Timer ID to clear
   */
  clearTimeout(id) {
    const timer = this.timers.get(id);
    if (timer && timer.type === 'timeout') {
      clearTimeout(timer.timerId);
      this.timers.delete(id);
      this.stats.timersCleared++;
      
      if (timer.scope) {
        this.removeFromScope(timer.scope, 'timeout', id);
      }
    }
  }

  /**
   * Clear a registered interval
   * @param {string} id - Interval ID to clear
   */
  clearInterval(id) {
    const interval = this.intervals.get(id);
    if (interval && interval.type === 'interval') {
      clearInterval(interval.intervalId);
      this.intervals.delete(id);
      this.stats.intervalsCleared++;
      
      if (interval.scope) {
        this.removeFromScope(interval.scope, 'interval', id);
      }
    }
  }

  /**
   * Remove a registered event listener
   * @param {string} id - Listener ID to remove
   */
  removeEventListener(id) {
    const listener = this.eventListeners.get(id);
    if (listener && listener.type === 'eventListener') {
      listener.element.removeEventListener(listener.event, listener.handler, listener.options);
      this.eventListeners.delete(id);
      this.stats.listenersRemoved++;
      
      if (listener.scope) {
        this.removeFromScope(listener.scope, 'eventListener', id);
      }
    }
  }

  /**
   * Clear a registered Phaser tween
   * @param {string} id - Tween ID to clear
   */
  clearPhaserTween(id) {
    const tweenData = this.phaserTweens.get(id);
    if (tweenData && tweenData.type === 'phaserTween') {
      const tween = tweenData.tween;
      
      // Handle different Phaser tween cleanup methods
      if (tween && typeof tween.remove === 'function') {
        tween.remove();
      } else if (tween && typeof tween.stop === 'function') {
        tween.stop();
      } else if (tween && typeof tween.destroy === 'function') {
        tween.destroy();
      }
      
      this.phaserTweens.delete(id);
      this.stats.tweensCleared++;
      
      if (tweenData.scope) {
        this.removeFromScope(tweenData.scope, 'phaserTween', id);
      }
    }
  }

  /**
   * Execute a custom cleanup function
   * @param {string} id - Cleanup ID to execute
   */
  executeCustomCleanup(id) {
    const cleanup = this.customCleanups.get(id);
    if (cleanup && cleanup.type === 'customCleanup') {
      try {
        cleanup.cleanupFunction();
        this.stats.customCleanupsExecuted++;
      } catch (error) {
        console.error(`Custom cleanup function failed for ID ${id}:`, error);
      }
      
      this.customCleanups.delete(id);
      
      if (cleanup.scope) {
        this.removeFromScope(cleanup.scope, 'customCleanup', id);
      }
    }
  }

  /**
   * Add resource to scope tracking
   * @param {string} scope - Scope name
   * @param {string} type - Resource type
   * @param {string} id - Resource ID
   */
  addToScope(scope, type, id) {
    if (!this.scopes.has(scope)) {
      this.scopes.set(scope, {
        timeout: new Set(),
        interval: new Set(),
        eventListener: new Set(),
        phaserTween: new Set(),
        customCleanup: new Set()
      });
    }
    
    this.scopes.get(scope)[type].add(id);
  }

  /**
   * Remove resource from scope tracking
   * @param {string} scope - Scope name
   * @param {string} type - Resource type
   * @param {string} id - Resource ID
   */
  removeFromScope(scope, type, id) {
    const scopeData = this.scopes.get(scope);
    if (scopeData && scopeData[type]) {
      scopeData[type].delete(id);
    }
  }

  /**
   * Clean up all resources, optionally filtered by scope
   * @param {string} scope - Optional scope to limit cleanup to
   */
  cleanup(scope = null) {
    if (scope) {
      this.cleanupScope(scope);
    } else {
      this.cleanupAll();
    }
  }

  /**
   * Clean up resources for a specific scope
   * @param {string} scope - Scope to clean up
   */
  cleanupScope(scope) {
    const scopeData = this.scopes.get(scope);
    if (!scopeData) return;

    // Clean up timeouts
    for (const id of scopeData.timeout) {
      this.clearTimeout(id);
    }

    // Clean up intervals
    for (const id of scopeData.interval) {
      this.clearInterval(id);
    }

    // Clean up event listeners
    for (const id of scopeData.eventListener) {
      this.removeEventListener(id);
    }

    // Clean up Phaser tweens
    for (const id of scopeData.phaserTween) {
      this.clearPhaserTween(id);
    }

    // Execute custom cleanups
    for (const id of scopeData.customCleanup) {
      this.executeCustomCleanup(id);
    }

    // Remove scope
    this.scopes.delete(scope);
  }

  /**
   * Clean up all registered resources
   */
  cleanupAll() {
    // Clear all timeouts
    for (const id of this.timers.keys()) {
      this.clearTimeout(id);
    }

    // Clear all intervals
    for (const id of this.intervals.keys()) {
      this.clearInterval(id);
    }

    // Remove all event listeners
    for (const id of this.eventListeners.keys()) {
      this.removeEventListener(id);
    }

    // Clear all Phaser tweens
    for (const id of this.phaserTweens.keys()) {
      this.clearPhaserTween(id);
    }

    // Execute all custom cleanups
    for (const id of this.customCleanups.keys()) {
      this.executeCustomCleanup(id);
    }

    // Clear scopes
    this.scopes.clear();
  }

  /**
   * Get memory management statistics
   * @returns {object} - Statistics object
   */
  getStats() {
    return {
      ...this.stats,
      currentResources: {
        timers: this.timers.size,
        intervals: this.intervals.size,
        eventListeners: this.eventListeners.size,
        phaserTweens: this.phaserTweens.size,
        customCleanups: this.customCleanups.size,
        scopes: this.scopes.size
      }
    };
  }

  /**
   * Get detailed information about registered resources
   * @param {string} scope - Optional scope filter
   * @returns {object} - Detailed resource information
   */
  getResourceInfo(scope = null) {
    const info = {
      timers: [],
      intervals: [],
      eventListeners: [],
      phaserTweens: [],
      customCleanups: []
    };

    // Collect timer info
    for (const [id, timer] of this.timers.entries()) {
      if (!scope || timer.scope === scope) {
        info.timers.push({
          id,
          delay: timer.delay,
          createdAt: timer.createdAt,
          scope: timer.scope,
          ageMs: Date.now() - timer.createdAt
        });
      }
    }

    // Collect interval info
    for (const [id, interval] of this.intervals.entries()) {
      if (!scope || interval.scope === scope) {
        info.intervals.push({
          id,
          delay: interval.delay,
          createdAt: interval.createdAt,
          scope: interval.scope,
          ageMs: Date.now() - interval.createdAt
        });
      }
    }

    // Collect event listener info
    for (const [id, listener] of this.eventListeners.entries()) {
      if (!scope || listener.scope === scope) {
        info.eventListeners.push({
          id,
          event: listener.event,
          createdAt: listener.createdAt,
          scope: listener.scope,
          ageMs: Date.now() - listener.createdAt
        });
      }
    }

    // Collect tween info
    for (const [id, tween] of this.phaserTweens.entries()) {
      if (!scope || tween.scope === scope) {
        info.phaserTweens.push({
          id,
          createdAt: tween.createdAt,
          scope: tween.scope,
          ageMs: Date.now() - tween.createdAt
        });
      }
    }

    // Collect custom cleanup info
    for (const [id, cleanup] of this.customCleanups.entries()) {
      if (!scope || cleanup.scope === scope) {
        info.customCleanups.push({
          id,
          createdAt: cleanup.createdAt,
          scope: cleanup.scope,
          ageMs: Date.now() - cleanup.createdAt
        });
      }
    }

    return info;
  }

  /**
   * Register process-level cleanup handlers
   */
  registerProcessCleanup() {
    const cleanup = () => {
      console.log('Cleaning up memory management registry...');
      this.cleanupAll();
    };

    // Handle different exit scenarios
    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception, cleaning up:', error);
      cleanup();
      process.exit(1);
    });
  }
}

// Create and export singleton instance
const memoryRegistry = new MemoryManagementRegistry();

module.exports = {
  MemoryManagementRegistry,
  memoryRegistry
};