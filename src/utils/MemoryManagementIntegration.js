/**
 * MemoryManagementIntegration.js - Application-wide Memory Management Setup
 * 
 * Provides easy integration of memory management across the entire Memex Racing application.
 * Sets up automatic cleanup, performance monitoring, and memory leak detection.
 */

import { memoryRegistry, detectMemoryLeaks } from './MemoryRegistry.js';
import { performanceMonitor, monitorMemoryUsage } from './PerformanceMonitor.js';

class MemoryManagementIntegration {
    constructor() {
        this.isInitialized = false;
        this.config = {
            enableAutoCleanup: true,
            enablePerformanceMonitoring: true,
            monitoringInterval: 30000, // 30 seconds
            autoCleanupOnUnload: true,
            memoryLeakDetectionThreshold: {
                critical: 3,
                warning: 1
            },
            enableConsoleLogging: true
        };
        
        console.log('[MemoryManagementIntegration] Initialized');
    }

    /**
     * Initialize memory management for the entire application
     * @param {Object} options - Configuration options
     */
    initialize(options = {}) {
        if (this.isInitialized) {
            console.warn('[MemoryManagementIntegration] Already initialized');
            return;
        }

        // Merge configuration
        this.config = { ...this.config, ...options };
        
        console.log('[MemoryManagementIntegration] Initializing with config:', this.config);

        // Setup automatic cleanup on page unload
        if (this.config.autoCleanupOnUnload) {
            this.setupAutoCleanup();
        }

        // Setup performance monitoring
        if (this.config.enablePerformanceMonitoring) {
            this.setupPerformanceMonitoring();
        }

        // Setup global error handling for memory issues
        this.setupErrorHandling();

        // Setup console logging
        if (this.config.enableConsoleLogging) {
            this.setupConsoleLogging();
        }

        // Expose global utilities
        this.exposeGlobalUtilities();

        this.isInitialized = true;
        console.log('[MemoryManagementIntegration] Memory management system initialized');
    }

    /**
     * Setup automatic cleanup on page unload
     * @private
     */
    setupAutoCleanup() {
        if (typeof window === 'undefined') {
            return; // Not in browser environment
        }

        const cleanup = () => {
            console.log('[MemoryManagementIntegration] Performing automatic cleanup');
            memoryRegistry.cleanupAll();
            performanceMonitor.destroy();
        };

        // Cleanup on various unload events
        window.addEventListener('beforeunload', cleanup);
        window.addEventListener('unload', cleanup);
        window.addEventListener('pagehide', cleanup);

        // Register cleanup function with memory registry
        memoryRegistry.enableAutoCleanup();

        console.log('[MemoryManagementIntegration] Auto-cleanup enabled');
    }

    /**
     * Setup performance monitoring
     * @private
     */
    setupPerformanceMonitoring() {
        // Start monitoring
        performanceMonitor.startMonitoring(this.config.monitoringInterval);

        // Setup memory leak detection
        performanceMonitor.onMemoryLeak((alert, measurement) => {
            console.error('🚨 MEMORY LEAK DETECTED 🚨');
            console.error(`Severity: ${alert.severity}`);
            console.error(`Message: ${alert.message}`);
            console.table(alert.data);

            // Attempt automatic cleanup for critical leaks
            if (alert.severity === 'critical' && this.config.enableAutoCleanup) {
                console.log('[MemoryManagementIntegration] Attempting automatic cleanup for critical memory leak');
                this.performEmergencyCleanup();
            }
        });

        // Setup performance alerts
        performanceMonitor.onPerformanceAlert((alert, measurement) => {
            console.warn('⚠️ PERFORMANCE ALERT ⚠️');
            console.warn(`Type: ${alert.type}`);
            console.warn(`Severity: ${alert.severity}`);
            console.warn(`Message: ${alert.message}`);
            
            if (alert.data) {
                console.table(alert.data);
            }
        });

        // Log periodic statistics
        performanceMonitor.onMeasurement((measurement) => {
            // Log summary every 10 measurements (reduce noise)
            if (measurement.timestamp % (this.config.monitoringInterval * 10) === 0) {
                this.logMemoryStatus();
            }
        });

        console.log('[MemoryManagementIntegration] Performance monitoring enabled');
    }

    /**
     * Setup global error handling for memory-related issues
     * @private
     */
    setupErrorHandling() {
        if (typeof window === 'undefined') {
            return;
        }

        // Catch unhandled errors that might be memory-related
        window.addEventListener('error', (event) => {
            const error = event.error;
            if (error && (
                error.message.includes('out of memory') ||
                error.message.includes('Maximum call stack') ||
                error.message.includes('memory')
            )) {
                console.error('[MemoryManagementIntegration] Memory-related error detected:', error);
                this.logMemoryStatus();
                
                // Attempt cleanup
                if (this.config.enableAutoCleanup) {
                    this.performEmergencyCleanup();
                }
            }
        });

        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            if (event.reason && typeof event.reason === 'string' && 
                event.reason.toLowerCase().includes('memory')) {
                console.error('[MemoryManagementIntegration] Memory-related promise rejection:', event.reason);
                this.logMemoryStatus();
            }
        });

        console.log('[MemoryManagementIntegration] Error handling enabled');
    }

    /**
     * Setup console logging for memory management
     * @private
     */
    setupConsoleLogging() {
        // Override console methods to detect potential memory issues
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        console.log = (...args) => {
            originalLog.apply(console, args);
            this.checkForMemoryKeywords(args.join(' '));
        };

        console.error = (...args) => {
            originalError.apply(console, args);
            this.checkForMemoryKeywords(args.join(' '));
        };

        console.warn = (...args) => {
            originalWarn.apply(console, args);
            this.checkForMemoryKeywords(args.join(' '));
        };

        // Add memory status command
        if (typeof window !== 'undefined') {
            window.memoryStatus = () => this.logMemoryStatus();
            window.memoryCleanup = () => this.performEmergencyCleanup();
            window.memoryExport = () => this.exportMemoryReport();
        }
    }

    /**
     * Check console output for memory-related keywords
     * @private
     * @param {string} message - Console message
     */
    checkForMemoryKeywords(message) {
        const memoryKeywords = [
            'memory leak',
            'out of memory',
            'memory usage',
            'heap size',
            'garbage collect',
            'too many listeners',
            'maximum listeners'
        ];

        const lowerMessage = message.toLowerCase();
        if (memoryKeywords.some(keyword => lowerMessage.includes(keyword))) {
            // Detected potential memory issue in console
            setTimeout(() => {
                this.logMemoryStatus();
            }, 100);
        }
    }

    /**
     * Expose global utilities for debugging
     * @private
     */
    exposeGlobalUtilities() {
        if (typeof window === 'undefined') {
            return;
        }

        // Global memory management utilities
        window.MemexMemory = {
            status: () => this.logMemoryStatus(),
            cleanup: (scope) => scope ? memoryRegistry.cleanupScope(scope) : this.performEmergencyCleanup(),
            stats: () => memoryRegistry.getMemoryStats(),
            detect: () => detectMemoryLeaks(),
            export: () => this.exportMemoryReport(),
            monitor: {
                start: (interval) => performanceMonitor.startMonitoring(interval),
                stop: () => performanceMonitor.stopMonitoring(),
                stats: (timeRange) => performanceMonitor.getStatistics(timeRange)
            }
        };

        console.log('[MemoryManagementIntegration] Global utilities exposed as window.MemexMemory');
    }

    /**
     * Perform emergency cleanup
     */
    performEmergencyCleanup() {
        console.log('[MemoryManagementIntegration] Performing emergency cleanup');
        
        const beforeStats = memoryRegistry.getMemoryStats();
        
        // Clean up all scopes
        memoryRegistry.cleanupAll();
        
        // Force garbage collection if available
        if (typeof window !== 'undefined' && window.gc) {
            try {
                window.gc();
                console.log('[MemoryManagementIntegration] Forced garbage collection');
            } catch (error) {
                console.warn('[MemoryManagementIntegration] Could not force garbage collection:', error);
            }
        }
        
        const afterStats = memoryRegistry.getMemoryStats();
        
        console.log('[MemoryManagementIntegration] Emergency cleanup completed');
        console.log('Before:', beforeStats);
        console.log('After:', afterStats);
        console.log('Cleaned:', beforeStats.total - afterStats.total, 'resources');
    }

    /**
     * Log current memory status
     */
    logMemoryStatus() {
        const registryStats = memoryRegistry.getMemoryStats();
        const memoryLeaks = detectMemoryLeaks();
        const performanceStats = performanceMonitor.getStatistics(300000); // 5 minutes
        
        console.group('🧠 Memory Status Report');
        
        console.log('📊 Registry Statistics:');
        console.table(registryStats);
        
        if (memoryLeaks.length > 0) {
            console.log('🚨 Memory Leaks Detected:');
            console.table(memoryLeaks);
        } else {
            console.log('✅ No memory leaks detected');
        }
        
        if (performanceStats) {
            console.log('📈 Performance Statistics (last 5 minutes):');
            console.table(performanceStats);
        }
        
        // Browser memory info
        if (typeof performance !== 'undefined' && performance.memory) {
            const browserMemory = {
                'Used JS Heap (MB)': (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2),
                'Total JS Heap (MB)': (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2),
                'JS Heap Limit (MB)': (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2),
                'Usage %': ((performance.memory.usedJSHeapSize / performance.memory.totalJSHeapSize) * 100).toFixed(2)
            };
            console.log('🌐 Browser Memory:');
            console.table(browserMemory);
        }
        
        console.groupEnd();
    }

    /**
     * Export comprehensive memory report
     * @returns {Object} Memory report
     */
    exportMemoryReport() {
        const report = {
            timestamp: new Date().toISOString(),
            registry: memoryRegistry.getMemoryStats(),
            leaks: detectMemoryLeaks(),
            performance: performanceMonitor.getStatistics(),
            browser: null,
            config: this.config
        };

        // Add browser memory info if available
        if (typeof performance !== 'undefined' && performance.memory) {
            report.browser = {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
                usagePercent: (performance.memory.usedJSHeapSize / performance.memory.totalJSHeapSize) * 100
            };
        }

        console.log('[MemoryManagementIntegration] Memory report generated');
        console.log('Download report:', JSON.stringify(report, null, 2));
        
        return report;
    }

    /**
     * Get current status
     * @returns {Object} Integration status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            config: this.config,
            memoryRegistry: memoryRegistry.getMemoryStats(),
            performanceMonitor: performanceMonitor.getStatus()
        };
    }

    /**
     * Destroy the integration
     */
    destroy() {
        console.log('[MemoryManagementIntegration] Destroying memory management integration');
        
        // Stop monitoring
        performanceMonitor.destroy();
        
        // Clean up all resources
        memoryRegistry.cleanupAll();
        
        // Clear global utilities
        if (typeof window !== 'undefined') {
            delete window.MemexMemory;
            delete window.memoryStatus;
            delete window.memoryCleanup;
            delete window.memoryExport;
        }
        
        this.isInitialized = false;
        console.log('[MemoryManagementIntegration] Destroyed');
    }
}

// Create and export singleton instance
export const memoryManagementIntegration = new MemoryManagementIntegration();

// Easy initialization function
export function initializeMemoryManagement(options = {}) {
    memoryManagementIntegration.initialize(options);
    return memoryManagementIntegration;
}

// Emergency functions for global access
export function emergencyCleanup() {
    memoryManagementIntegration.performEmergencyCleanup();
}

export function getMemoryStatus() {
    memoryManagementIntegration.logMemoryStatus();
}

export default MemoryManagementIntegration;