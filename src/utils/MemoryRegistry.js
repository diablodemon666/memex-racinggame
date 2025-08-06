/**
 * MemoryRegistry.js - Memory Management Registry
 * 
 * Centralized system for tracking and cleaning up resources to prevent memory leaks.
 * Tracks timers, event listeners, Phaser tweens, and other resources that need cleanup.
 */

class MemoryRegistry {
    constructor() {
        this.timers = new Map();
        this.eventListeners = new Map();
        this.tweens = new Map();
        this.intervals = new Map();
        this.webSocketConnections = new Map();
        this.observers = new Map();
        
        // Scoped cleanup - allows cleanup by component or scene
        this.scopedResources = new Map();
        
        console.log('[MemoryRegistry] Initialized memory management system');
    }

    /**
     * Register a timer for cleanup
     * @param {string} id - Unique identifier for the timer
     * @param {number} timer - Timer ID from setTimeout
     * @param {string} scope - Optional scope for grouped cleanup
     */
    registerTimer(id, timer, scope = 'global') {
        // Clear existing timer if present
        if (this.timers.has(id)) {
            clearTimeout(this.timers.get(id));
        }
        
        this.timers.set(id, timer);
        this._addToScope(scope, 'timers', id);
        
        console.log(`[MemoryRegistry] Registered timer: ${id} (scope: ${scope})`);
    }

    /**
     * Register an interval for cleanup
     * @param {string} id - Unique identifier for the interval
     * @param {number} interval - Interval ID from setInterval
     * @param {string} scope - Optional scope for grouped cleanup
     */
    registerInterval(id, interval, scope = 'global') {
        // Clear existing interval if present
        if (this.intervals.has(id)) {
            clearInterval(this.intervals.get(id));
        }
        
        this.intervals.set(id, interval);
        this._addToScope(scope, 'intervals', id);
        
        console.log(`[MemoryRegistry] Registered interval: ${id} (scope: ${scope})`);
    }

    /**
     * Register an event listener for cleanup
     * @param {string} id - Unique identifier for the listener
     * @param {Element|Object} element - Element or object with the listener
     * @param {string} event - Event name
     * @param {Function} handler - Event handler function
     * @param {string} scope - Optional scope for grouped cleanup
     */
    registerEventListener(id, element, event, handler, scope = 'global') {
        // Remove existing listener if present
        if (this.eventListeners.has(id)) {
            const existing = this.eventListeners.get(id);
            existing.element.removeEventListener(existing.event, existing.handler);
        }
        
        const listenerData = { element, event, handler };
        this.eventListeners.set(id, listenerData);
        this._addToScope(scope, 'eventListeners', id);
        
        console.log(`[MemoryRegistry] Registered event listener: ${id} (${event}, scope: ${scope})`);
    }

    /**
     * Register a Phaser tween for cleanup
     * @param {string} id - Unique identifier for the tween
     * @param {Object} tween - Phaser tween object
     * @param {string} scope - Optional scope for grouped cleanup
     */
    registerTween(id, tween, scope = 'global') {
        // Clean up existing tween if present
        if (this.tweens.has(id)) {
            const existing = this.tweens.get(id);
            if (existing && existing.remove) {
                existing.remove();
            }
        }
        
        this.tweens.set(id, tween);
        this._addToScope(scope, 'tweens', id);
        
        console.log(`[MemoryRegistry] Registered tween: ${id} (scope: ${scope})`);
    }

    /**
     * Register a WebSocket connection for cleanup
     * @param {string} id - Unique identifier for the connection
     * @param {WebSocket|Socket} connection - WebSocket or Socket.io connection
     * @param {string} scope - Optional scope for grouped cleanup
     */
    registerWebSocket(id, connection, scope = 'global') {
        // Close existing connection if present
        if (this.webSocketConnections.has(id)) {
            const existing = this.webSocketConnections.get(id);
            if (existing && existing.disconnect) {
                existing.disconnect();
            } else if (existing && existing.close) {
                existing.close();
            }
        }
        
        this.webSocketConnections.set(id, connection);
        this._addToScope(scope, 'webSocketConnections', id);
        
        console.log(`[MemoryRegistry] Registered WebSocket: ${id} (scope: ${scope})`);
    }

    /**
     * Register an observer (MutationObserver, IntersectionObserver, etc.)
     * @param {string} id - Unique identifier for the observer
     * @param {Observer} observer - Observer instance
     * @param {string} scope - Optional scope for grouped cleanup
     */
    registerObserver(id, observer, scope = 'global') {
        // Disconnect existing observer if present
        if (this.observers.has(id)) {
            const existing = this.observers.get(id);
            if (existing && existing.disconnect) {
                existing.disconnect();
            }
        }
        
        this.observers.set(id, observer);
        this._addToScope(scope, 'observers', id);
        
        console.log(`[MemoryRegistry] Registered observer: ${id} (scope: ${scope})`);
    }

    /**
     * Clean up resources by scope
     * @param {string} scope - Scope to clean up (e.g., 'AuthManager', 'RaceScene')
     */
    cleanupScope(scope) {
        console.log(`[MemoryRegistry] Cleaning up scope: ${scope}`);
        
        const scopeData = this.scopedResources.get(scope);
        if (!scopeData) {
            console.log(`[MemoryRegistry] No resources found for scope: ${scope}`);
            return;
        }

        let cleanedCount = 0;

        // Clean up timers
        if (scopeData.timers) {
            scopeData.timers.forEach(id => {
                if (this.timers.has(id)) {
                    clearTimeout(this.timers.get(id));
                    this.timers.delete(id);
                    cleanedCount++;
                }
            });
        }

        // Clean up intervals
        if (scopeData.intervals) {
            scopeData.intervals.forEach(id => {
                if (this.intervals.has(id)) {
                    clearInterval(this.intervals.get(id));
                    this.intervals.delete(id);
                    cleanedCount++;
                }
            });
        }

        // Clean up event listeners
        if (scopeData.eventListeners) {
            scopeData.eventListeners.forEach(id => {
                if (this.eventListeners.has(id)) {
                    const { element, event, handler } = this.eventListeners.get(id);
                    element.removeEventListener(event, handler);
                    this.eventListeners.delete(id);
                    cleanedCount++;
                }
            });
        }

        // Clean up tweens
        if (scopeData.tweens) {
            scopeData.tweens.forEach(id => {
                if (this.tweens.has(id)) {
                    const tween = this.tweens.get(id);
                    if (tween && tween.remove) {
                        tween.remove();
                    }
                    this.tweens.delete(id);
                    cleanedCount++;
                }
            });
        }

        // Clean up WebSocket connections
        if (scopeData.webSocketConnections) {
            scopeData.webSocketConnections.forEach(id => {
                if (this.webSocketConnections.has(id)) {
                    const connection = this.webSocketConnections.get(id);
                    if (connection && connection.disconnect) {
                        connection.disconnect();
                    } else if (connection && connection.close) {
                        connection.close();
                    }
                    this.webSocketConnections.delete(id);
                    cleanedCount++;
                }
            });
        }

        // Clean up observers
        if (scopeData.observers) {
            scopeData.observers.forEach(id => {
                if (this.observers.has(id)) {
                    const observer = this.observers.get(id);
                    if (observer && observer.disconnect) {
                        observer.disconnect();
                    }
                    this.observers.delete(id);
                    cleanedCount++;
                }
            });
        }

        // Remove scope from registry
        this.scopedResources.delete(scope);
        
        console.log(`[MemoryRegistry] Cleaned up ${cleanedCount} resources from scope: ${scope}`);
    }

    /**
     * Clean up all resources
     */
    cleanupAll() {
        console.log('[MemoryRegistry] Cleaning up all resources');
        
        let totalCleaned = 0;

        // Clean up all timers
        for (const [id, timer] of this.timers.entries()) {
            clearTimeout(timer);
            totalCleaned++;
        }
        this.timers.clear();

        // Clean up all intervals
        for (const [id, interval] of this.intervals.entries()) {
            clearInterval(interval);
            totalCleaned++;
        }
        this.intervals.clear();

        // Clean up all event listeners
        for (const [id, { element, event, handler }] of this.eventListeners.entries()) {
            element.removeEventListener(event, handler);
            totalCleaned++;
        }
        this.eventListeners.clear();

        // Clean up all tweens
        for (const [id, tween] of this.tweens.entries()) {
            if (tween && tween.remove) {
                tween.remove();
            }
            totalCleaned++;
        }
        this.tweens.clear();

        // Clean up all WebSocket connections
        for (const [id, connection] of this.webSocketConnections.entries()) {
            if (connection && connection.disconnect) {
                connection.disconnect();
            } else if (connection && connection.close) {
                connection.close();
            }
            totalCleaned++;
        }
        this.webSocketConnections.clear();

        // Clean up all observers
        for (const [id, observer] of this.observers.entries()) {
            if (observer && observer.disconnect) {
                observer.disconnect();
            }
            totalCleaned++;
        }
        this.observers.clear();

        // Clear scoped resources
        this.scopedResources.clear();
        
        console.log(`[MemoryRegistry] Cleaned up ${totalCleaned} total resources`);
    }

    /**
     * Remove a specific resource by ID
     * @param {string} id - Resource ID to remove
     * @param {string} type - Resource type ('timers', 'eventListeners', etc.)
     */
    removeResource(id, type) {
        switch (type) {
            case 'timers':
                if (this.timers.has(id)) {
                    clearTimeout(this.timers.get(id));
                    this.timers.delete(id);
                }
                break;
            case 'intervals':
                if (this.intervals.has(id)) {
                    clearInterval(this.intervals.get(id));
                    this.intervals.delete(id);
                }
                break;
            case 'eventListeners':
                if (this.eventListeners.has(id)) {
                    const { element, event, handler } = this.eventListeners.get(id);
                    element.removeEventListener(event, handler);
                    this.eventListeners.delete(id);
                }
                break;
            case 'tweens':
                if (this.tweens.has(id)) {
                    const tween = this.tweens.get(id);
                    if (tween && tween.remove) {
                        tween.remove();
                    }
                    this.tweens.delete(id);
                }
                break;
            case 'webSocketConnections':
                if (this.webSocketConnections.has(id)) {
                    const connection = this.webSocketConnections.get(id);
                    if (connection && connection.disconnect) {
                        connection.disconnect();
                    } else if (connection && connection.close) {
                        connection.close();
                    }
                    this.webSocketConnections.delete(id);
                }
                break;
            case 'observers':
                if (this.observers.has(id)) {
                    const observer = this.observers.get(id);
                    if (observer && observer.disconnect) {
                        observer.disconnect();
                    }
                    this.observers.delete(id);
                }
                break;
        }
        
        console.log(`[MemoryRegistry] Removed ${type} resource: ${id}`);
    }

    /**
     * Get memory usage statistics
     * @returns {Object} Statistics about registered resources
     */
    getMemoryStats() {
        return {
            timers: this.timers.size,
            intervals: this.intervals.size,
            eventListeners: this.eventListeners.size,
            tweens: this.tweens.size,
            webSocketConnections: this.webSocketConnections.size,
            observers: this.observers.size,
            scopes: this.scopedResources.size,
            total: this.timers.size + this.intervals.size + this.eventListeners.size + 
                   this.tweens.size + this.webSocketConnections.size + this.observers.size
        };
    }

    /**
     * Add resource to scope tracking
     * @private
     */
    _addToScope(scope, type, id) {
        if (!this.scopedResources.has(scope)) {
            this.scopedResources.set(scope, {
                timers: new Set(),
                intervals: new Set(),
                eventListeners: new Set(),
                tweens: new Set(),
                webSocketConnections: new Set(),
                observers: new Set()
            });
        }
        
        this.scopedResources.get(scope)[type].add(id);
    }

    /**
     * Enable automatic cleanup on page unload
     */
    enableAutoCleanup() {
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => {
                this.cleanupAll();
            });
            
            window.addEventListener('unload', () => {
                this.cleanupAll();
            });
            
            console.log('[MemoryRegistry] Enabled automatic cleanup on page unload');
        }
    }

    /**
     * Destroy the memory registry
     */
    destroy() {
        this.cleanupAll();
        console.log('[MemoryRegistry] Memory registry destroyed');
    }
}

// Create and export singleton instance
export const memoryRegistry = new MemoryRegistry();

/**
 * Helper functions for easier resource management
 */

// Enhanced setTimeout with automatic registration
export function managedSetTimeout(callback, delay, scope = 'global') {
    const id = `timeout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timer = setTimeout(() => {
        callback();
        memoryRegistry.removeResource(id, 'timers');
    }, delay);
    
    memoryRegistry.registerTimer(id, timer, scope);
    return { id, timer };
}

// Enhanced setInterval with automatic registration
export function managedSetInterval(callback, delay, scope = 'global') {
    const id = `interval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const interval = setInterval(callback, delay);
    
    memoryRegistry.registerInterval(id, interval, scope);
    return { id, interval };
}

// Enhanced addEventListener with automatic registration
export function managedAddEventListener(element, event, handler, options, scope = 'global') {
    const id = `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    element.addEventListener(event, handler, options);
    memoryRegistry.registerEventListener(id, element, event, handler, scope);
    
    return { id, cleanup: () => memoryRegistry.removeResource(id, 'eventListeners') };
}

// Memory leak detection and reporting
export function detectMemoryLeaks() {
    const stats = memoryRegistry.getMemoryStats();
    const threshold = {
        timers: 50,
        intervals: 20,
        eventListeners: 100,
        tweens: 30,
        webSocketConnections: 10
    };
    
    const leaks = [];
    
    Object.keys(threshold).forEach(type => {
        if (stats[type] > threshold[type]) {
            leaks.push({
                type,
                count: stats[type],
                threshold: threshold[type],
                severity: stats[type] > threshold[type] * 2 ? 'critical' : 'warning'
            });
        }
    });
    
    if (leaks.length > 0) {
        console.warn('[MemoryRegistry] Potential memory leaks detected:', leaks);
        return leaks;
    }
    
    console.log('[MemoryRegistry] No memory leaks detected');
    return [];
}

export default memoryRegistry;