/**
 * PerformanceMonitor.js - Performance and Memory Usage Monitoring
 * 
 * Provides real-time monitoring of memory usage, performance metrics,
 * and automated memory leak detection for the Memex Racing game.
 */

import { memoryRegistry, detectMemoryLeaks } from './MemoryRegistry.js';

class PerformanceMonitor {
    constructor() {
        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.measurements = [];
        this.maxMeasurements = 1000; // Keep last 1000 measurements
        this.alertThresholds = {
            memoryLeakCount: 3,
            performanceDegradation: 0.3 // 30% degradation
        };
        this.callbacks = {
            memoryLeak: new Set(),
            performanceAlert: new Set(),
            measurement: new Set()
        };
        
        console.log('[PerformanceMonitor] Initialized');
    }

    /**
     * Start performance monitoring
     * @param {number} interval - Monitoring interval in milliseconds (default: 5000)
     */
    startMonitoring(interval = 5000) {
        if (this.isMonitoring) {
            console.warn('[PerformanceMonitor] Already monitoring');
            return;
        }

        console.log(`[PerformanceMonitor] Starting monitoring with ${interval}ms interval`);
        
        this.isMonitoring = true;
        this.monitoringInterval = setInterval(() => {
            this.takeMeasurement();
        }, interval);

        // Take initial measurement
        this.takeMeasurement();
    }

    /**
     * Stop performance monitoring
     */
    stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }

        console.log('[PerformanceMonitor] Stopping monitoring');
        
        this.isMonitoring = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }

    /**
     * Take a performance measurement
     * @returns {Object} Measurement data
     */
    takeMeasurement() {
        const timestamp = Date.now();
        
        // Memory statistics from registry
        const memoryStats = memoryRegistry.getMemoryStats();
        
        // Browser memory information (if available)
        const browserMemory = this.getBrowserMemoryInfo();
        
        // Performance metrics
        const performance = this.getPerformanceMetrics();
        
        // Memory leak detection
        const memoryLeaks = detectMemoryLeaks();
        
        const measurement = {
            timestamp,
            memory: {
                registry: memoryStats,
                browser: browserMemory,
                leaks: memoryLeaks
            },
            performance,
            alerts: this.generateAlerts(memoryStats, memoryLeaks, performance)
        };

        // Store measurement
        this.measurements.push(measurement);
        
        // Trim old measurements
        if (this.measurements.length > this.maxMeasurements) {
            this.measurements.shift();
        }

        // Emit callbacks
        this.callbacks.measurement.forEach(callback => {
            try {
                callback(measurement);
            } catch (error) {
                console.error('[PerformanceMonitor] Measurement callback error:', error);
            }
        });

        // Check for alerts
        if (measurement.alerts.length > 0) {
            this.handleAlerts(measurement.alerts, measurement);
        }

        return measurement;
    }

    /**
     * Get browser memory information
     * @private
     * @returns {Object} Browser memory info
     */
    getBrowserMemoryInfo() {
        const memory = {
            supported: false,
            usedJSHeapSize: null,
            totalJSHeapSize: null,
            jsHeapSizeLimit: null,
            usedPercent: null
        };

        // Check if performance.memory is available
        if (typeof performance !== 'undefined' && performance.memory) {
            memory.supported = true;
            memory.usedJSHeapSize = performance.memory.usedJSHeapSize;
            memory.totalJSHeapSize = performance.memory.totalJSHeapSize;
            memory.jsHeapSizeLimit = performance.memory.jsHeapSizeLimit;
            
            if (memory.totalJSHeapSize > 0) {
                memory.usedPercent = (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100;
            }
        }

        return memory;
    }

    /**
     * Get performance metrics
     * @private
     * @returns {Object} Performance metrics
     */
    getPerformanceMetrics() {
        const metrics = {
            navigationTiming: null,
            paintTiming: null,
            frameRate: null,
            timestamp: Date.now()
        };

        // Navigation timing
        if (typeof performance !== 'undefined' && performance.timing) {
            const timing = performance.timing;
            metrics.navigationTiming = {
                domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
                loadComplete: timing.loadEventEnd - timing.navigationStart,
                firstPaint: timing.responseStart - timing.navigationStart
            };
        }

        // Paint timing (modern browsers)
        if (typeof performance !== 'undefined' && performance.getEntriesByType) {
            const paintEntries = performance.getEntriesByType('paint');
            if (paintEntries.length > 0) {
                metrics.paintTiming = {};
                paintEntries.forEach(entry => {
                    metrics.paintTiming[entry.name] = entry.startTime;
                });
            }
        }

        // Estimate frame rate using requestAnimationFrame
        metrics.frameRate = this.estimateFrameRate();

        return metrics;
    }

    /**
     * Estimate current frame rate
     * @private
     * @returns {number|null} Estimated FPS
     */
    estimateFrameRate() {
        // This is a simplified estimation
        // In a real implementation, you'd track frame times over a period
        if (typeof requestAnimationFrame === 'undefined') {
            return null;
        }

        // Return a placeholder - real implementation would need frame timing
        return 60; // Assume 60 FPS for now
    }

    /**
     * Generate alerts based on measurements
     * @private
     * @param {Object} memoryStats - Memory statistics
     * @param {Array} memoryLeaks - Memory leak detections
     * @param {Object} performance - Performance metrics
     * @returns {Array} Array of alerts
     */
    generateAlerts(memoryStats, memoryLeaks, performance) {
        const alerts = [];

        // Memory leak alerts
        if (memoryLeaks.length >= this.alertThresholds.memoryLeakCount) {
            alerts.push({
                type: 'memory_leak',
                severity: 'critical',
                message: `${memoryLeaks.length} memory leaks detected`,
                data: memoryLeaks
            });
        }

        // High memory usage alert
        if (memoryStats.total > 1000) {
            alerts.push({
                type: 'high_memory_usage',
                severity: 'warning',
                message: `High memory usage: ${memoryStats.total} resources registered`,
                data: memoryStats
            });
        }

        // Browser memory alerts
        const browserMemory = this.getBrowserMemoryInfo();
        if (browserMemory.supported && browserMemory.usedPercent > 90) {
            alerts.push({
                type: 'browser_memory_high',
                severity: 'critical',
                message: `Browser memory usage: ${browserMemory.usedPercent.toFixed(1)}%`,
                data: browserMemory
            });
        }

        return alerts;
    }

    /**
     * Handle alerts
     * @private
     * @param {Array} alerts - Array of alerts
     * @param {Object} measurement - Full measurement data
     */
    handleAlerts(alerts, measurement) {
        alerts.forEach(alert => {
            console.warn(`[PerformanceMonitor] ${alert.severity.toUpperCase()}: ${alert.message}`);
            
            // Emit specific callbacks
            if (alert.type === 'memory_leak') {
                this.callbacks.memoryLeak.forEach(callback => {
                    try {
                        callback(alert, measurement);
                    } catch (error) {
                        console.error('[PerformanceMonitor] Memory leak callback error:', error);
                    }
                });
            } else {
                this.callbacks.performanceAlert.forEach(callback => {
                    try {
                        callback(alert, measurement);
                    } catch (error) {
                        console.error('[PerformanceMonitor] Performance alert callback error:', error);
                    }
                });
            }
        });
    }

    /**
     * Add callback for memory leak detection
     * @param {Function} callback - Callback function
     */
    onMemoryLeak(callback) {
        this.callbacks.memoryLeak.add(callback);
    }

    /**
     * Add callback for performance alerts
     * @param {Function} callback - Callback function
     */
    onPerformanceAlert(callback) {
        this.callbacks.performanceAlert.add(callback);
    }

    /**
     * Add callback for each measurement
     * @param {Function} callback - Callback function
     */
    onMeasurement(callback) {
        this.callbacks.measurement.add(callback);
    }

    /**
     * Remove callback
     * @param {string} type - Callback type ('memoryLeak', 'performanceAlert', 'measurement')
     * @param {Function} callback - Callback function to remove
     */
    removeCallback(type, callback) {
        if (this.callbacks[type]) {
            this.callbacks[type].delete(callback);
        }
    }

    /**
     * Get performance statistics
     * @param {number} timeRange - Time range in milliseconds (default: last hour)
     * @returns {Object} Performance statistics
     */
    getStatistics(timeRange = 3600000) { // 1 hour
        const cutoffTime = Date.now() - timeRange;
        const recentMeasurements = this.measurements.filter(m => m.timestamp >= cutoffTime);
        
        if (recentMeasurements.length === 0) {
            return null;
        }

        // Calculate statistics
        const memoryUsage = recentMeasurements.map(m => m.memory.registry.total);
        const browserMemoryUsage = recentMeasurements
            .map(m => m.memory.browser.usedPercent)
            .filter(usage => usage !== null);

        const stats = {
            timeRange: {
                start: Math.min(...recentMeasurements.map(m => m.timestamp)),
                end: Math.max(...recentMeasurements.map(m => m.timestamp)),
                measurements: recentMeasurements.length
            },
            memory: {
                registry: {
                    current: memoryUsage[memoryUsage.length - 1],
                    average: memoryUsage.reduce((a, b) => a + b, 0) / memoryUsage.length,
                    peak: Math.max(...memoryUsage),
                    minimum: Math.min(...memoryUsage)
                }
            },
            alerts: {
                total: recentMeasurements.reduce((total, m) => total + m.alerts.length, 0),
                byType: this.groupAlertsByType(recentMeasurements)
            }
        };

        // Add browser memory stats if available
        if (browserMemoryUsage.length > 0) {
            stats.memory.browser = {
                current: browserMemoryUsage[browserMemoryUsage.length - 1],
                average: browserMemoryUsage.reduce((a, b) => a + b, 0) / browserMemoryUsage.length,
                peak: Math.max(...browserMemoryUsage),
                minimum: Math.min(...browserMemoryUsage)
            };
        }

        return stats;
    }

    /**
     * Group alerts by type
     * @private
     * @param {Array} measurements - Array of measurements
     * @returns {Object} Alerts grouped by type
     */
    groupAlertsByType(measurements) {
        const alertCounts = {};
        
        measurements.forEach(measurement => {
            measurement.alerts.forEach(alert => {
                alertCounts[alert.type] = (alertCounts[alert.type] || 0) + 1;
            });
        });
        
        return alertCounts;
    }

    /**
     * Export measurements as CSV
     * @param {number} timeRange - Time range in milliseconds
     * @returns {string} CSV data
     */
    exportCSV(timeRange = 3600000) {
        const cutoffTime = Date.now() - timeRange;
        const recentMeasurements = this.measurements.filter(m => m.timestamp >= cutoffTime);
        
        if (recentMeasurements.length === 0) {
            return 'No data available';
        }

        // CSV headers
        const headers = [
            'timestamp',
            'registry_total',
            'registry_timers',
            'registry_intervals',
            'registry_eventListeners',
            'registry_tweens',
            'registry_webSocketConnections',
            'browser_usedJSHeapSize',
            'browser_totalJSHeapSize',
            'browser_usedPercent',
            'alerts_count',
            'memory_leaks_count'
        ];

        // CSV rows
        const rows = recentMeasurements.map(m => {
            return [
                new Date(m.timestamp).toISOString(),
                m.memory.registry.total,
                m.memory.registry.timers,
                m.memory.registry.intervals,
                m.memory.registry.eventListeners,
                m.memory.registry.tweens,
                m.memory.registry.webSocketConnections,
                m.memory.browser.usedJSHeapSize || '',
                m.memory.browser.totalJSHeapSize || '',
                m.memory.browser.usedPercent || '',
                m.alerts.length,
                m.memory.leaks.length
            ].join(',');
        });

        return [headers.join(','), ...rows].join('\n');
    }

    /**
     * Get current monitoring status
     * @returns {Object} Monitoring status
     */
    getStatus() {
        return {
            isMonitoring: this.isMonitoring,
            measurementCount: this.measurements.length,
            lastMeasurement: this.measurements.length > 0 ? this.measurements[this.measurements.length - 1].timestamp : null,
            callbackCounts: {
                memoryLeak: this.callbacks.memoryLeak.size,
                performanceAlert: this.callbacks.performanceAlert.size,
                measurement: this.callbacks.measurement.size
            }
        };
    }

    /**
     * Clear all measurements
     */
    clearMeasurements() {
        console.log('[PerformanceMonitor] Clearing all measurements');
        this.measurements = [];
    }

    /**
     * Destroy the performance monitor
     */
    destroy() {
        console.log('[PerformanceMonitor] Destroying performance monitor');
        
        this.stopMonitoring();
        this.clearMeasurements();
        
        // Clear all callbacks
        this.callbacks.memoryLeak.clear();
        this.callbacks.performanceAlert.clear();
        this.callbacks.measurement.clear();
    }
}

// Create and export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Utility functions for easy integration
export function monitorMemoryUsage(interval = 10000) {
    performanceMonitor.startMonitoring(interval);
    
    performanceMonitor.onMemoryLeak((alert, measurement) => {
        console.error(`🚨 Memory Leak Detected: ${alert.message}`);
        console.table(alert.data);
    });
    
    performanceMonitor.onPerformanceAlert((alert, measurement) => {
        console.warn(`⚠️ Performance Alert: ${alert.message}`);
    });
    
    return performanceMonitor;
}

export function logPerformanceStats(timeRange = 300000) { // 5 minutes
    const stats = performanceMonitor.getStatistics(timeRange);
    if (stats) {
        console.log('📊 Performance Statistics:');
        console.table(stats);
    } else {
        console.log('📊 No performance data available');
    }
}

export default PerformanceMonitor;