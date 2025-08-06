/**
 * PerformanceProfiler.js - Advanced Performance Profiling and FPS Management
 * 
 * Provides comprehensive performance profiling, FPS tracking, bottleneck identification,
 * and frame rate optimization for consistent 60 FPS gameplay.
 */

export class PerformanceProfiler {
    constructor() {
        this.isEnabled = process.env.NODE_ENV === 'development';
        this.measurements = new Map();
        this.fpsHistory = [];
        this.frameTimings = [];
        this.maxHistorySize = 300; // 5 seconds at 60 FPS
        
        // Performance thresholds
        this.thresholds = {
            targetFPS: 60,
            minimumFPS: 50,
            frameTimeTarget: 16.67, // 1000ms / 60fps
            criticalFrameTime: 20,
            warningFrameTime: 18
        };
        
        // Frame timing tracking
        this.lastFrameTime = performance.now();
        this.smoothDelta = 16.67;
        this.deltaHistory = [];
        
        // Bottleneck detection
        this.bottlenecks = new Map();
        this.activeProfiles = new Map();
        
        // Performance statistics
        this.stats = {
            totalFrames: 0,
            droppedFrames: 0,
            averageFPS: 60,
            minFPS: 60,
            maxFPS: 60,
            frameTimeVariance: 0
        };
        
        this.initializeProfiler();
    }

    /**
     * Initialize the performance profiler
     */
    initializeProfiler() {
        if (!this.isEnabled) return;
        
        // Start frame timing
        this.startFrameTracking();
        
        console.log('[PerformanceProfiler] Initialized with 60 FPS target');
    }

    /**
     * Start tracking frame timings
     */
    startFrameTracking() {
        const trackFrame = (currentTime) => {
            const deltaTime = currentTime - this.lastFrameTime;
            this.lastFrameTime = currentTime;
            
            // Update frame statistics
            this.updateFrameStats(deltaTime);
            
            // Continue tracking
            requestAnimationFrame(trackFrame);
        };
        
        requestAnimationFrame(trackFrame);
    }

    /**
     * Update frame statistics
     */
    updateFrameStats(deltaTime) {
        this.stats.totalFrames++;
        
        // Calculate FPS
        const currentFPS = 1000 / deltaTime;
        this.fpsHistory.push(currentFPS);
        this.frameTimings.push(deltaTime);
        
        // Maintain history size
        if (this.fpsHistory.length > this.maxHistorySize) {
            this.fpsHistory.shift();
            this.frameTimings.shift();
        }
        
        // Update delta history for smoothing
        this.deltaHistory.push(deltaTime);
        if (this.deltaHistory.length > 10) {
            this.deltaHistory.shift();
        }
        
        // Calculate smooth delta
        this.smoothDelta = this.deltaHistory.reduce((a, b) => a + b, 0) / this.deltaHistory.length;
        
        // Update running statistics
        if (this.fpsHistory.length > 0) {
            this.stats.averageFPS = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
            this.stats.minFPS = Math.min(...this.fpsHistory);
            this.stats.maxFPS = Math.max(...this.fpsHistory);
            
            // Calculate frame time variance
            const avgFrameTime = this.frameTimings.reduce((a, b) => a + b, 0) / this.frameTimings.length;
            const variance = this.frameTimings.reduce((sum, time) => sum + Math.pow(time - avgFrameTime, 2), 0) / this.frameTimings.length;
            this.stats.frameTimeVariance = Math.sqrt(variance);
        }
        
        // Check for dropped frames
        if (deltaTime > this.thresholds.criticalFrameTime) {
            this.stats.droppedFrames++;
        }
        
        // Detect performance issues
        this.detectPerformanceIssues(currentFPS, deltaTime);
    }

    /**
     * Start profiling a specific section
     */
    startProfile(name) {
        if (!this.isEnabled) return;
        
        this.activeProfiles.set(name, {
            startTime: performance.now(),
            calls: (this.measurements.get(name)?.calls || 0) + 1
        });
    }

    /**
     * End profiling a specific section
     */
    endProfile(name) {
        if (!this.isEnabled) return;
        
        const profile = this.activeProfiles.get(name);
        if (!profile) return;
        
        const endTime = performance.now();
        const duration = endTime - profile.startTime;
        
        // Update measurements
        const existing = this.measurements.get(name) || {
            totalTime: 0,
            calls: 0,
            avgTime: 0,
            maxTime: 0,
            minTime: Infinity,
            samples: []
        };
        
        existing.totalTime += duration;
        existing.calls = profile.calls;
        existing.avgTime = existing.totalTime / existing.calls;
        existing.maxTime = Math.max(existing.maxTime, duration);
        existing.minTime = Math.min(existing.minTime, duration);
        
        // Keep last 100 samples for analysis
        existing.samples.push(duration);
        if (existing.samples.length > 100) {
            existing.samples.shift();
        }
        
        this.measurements.set(name, existing);
        this.activeProfiles.delete(name);
        
        // Check for bottlenecks
        this.checkBottleneck(name, duration);
    }

    /**
     * Profile a function call
     */
    profile(name, fn) {
        if (!this.isEnabled) return fn();
        
        this.startProfile(name);
        try {
            const result = fn();
            this.endProfile(name);
            return result;
        } catch (error) {
            this.endProfile(name);
            throw error;
        }
    }

    /**
     * Profile an async function call
     */
    async profileAsync(name, fn) {
        if (!this.isEnabled) return await fn();
        
        this.startProfile(name);
        try {
            const result = await fn();
            this.endProfile(name);
            return result;
        } catch (error) {
            this.endProfile(name);
            throw error;
        }
    }

    /**
     * Check for performance bottlenecks
     */
    checkBottleneck(name, duration) {
        const threshold = this.thresholds.frameTimeTarget * 0.1; // 10% of frame budget
        
        if (duration > threshold) {
            const bottleneck = this.bottlenecks.get(name) || {
                count: 0,
                totalTime: 0,
                maxTime: 0,
                lastOccurrence: 0
            };
            
            bottleneck.count++;
            bottleneck.totalTime += duration;
            bottleneck.maxTime = Math.max(bottleneck.maxTime, duration);
            bottleneck.lastOccurrence = Date.now();
            
            this.bottlenecks.set(name, bottleneck);
            
            if (bottleneck.count % 10 === 0) {
                console.warn(`[PerformanceProfiler] Bottleneck detected: ${name} (${duration.toFixed(2)}ms, ${bottleneck.count} occurrences)`);
            }
        }
    }

    /**
     * Detect performance issues
     */
    detectPerformanceIssues(currentFPS, deltaTime) {
        // Low FPS warning
        if (currentFPS < this.thresholds.minimumFPS) {
            console.warn(`[PerformanceProfiler] Low FPS detected: ${currentFPS.toFixed(1)} (target: ${this.thresholds.targetFPS})`);
        }
        
        // Frame time spike warning
        if (deltaTime > this.thresholds.warningFrameTime) {
            console.warn(`[PerformanceProfiler] Frame time spike: ${deltaTime.toFixed(2)}ms (target: ${this.thresholds.frameTimeTarget.toFixed(2)}ms)`);
        }
        
        // High variance warning
        if (this.stats.frameTimeVariance > 5) {
            console.warn(`[PerformanceProfiler] High frame time variance: ${this.stats.frameTimeVariance.toFixed(2)}ms`);
        }
    }

    /**
     * Get current FPS
     */
    getCurrentFPS() {
        if (this.fpsHistory.length === 0) return 60;
        return this.fpsHistory[this.fpsHistory.length - 1];
    }

    /**
     * Get smooth delta time for consistent updates
     */
    getSmoothDelta() {
        return Math.min(this.smoothDelta, this.thresholds.frameTimeTarget * 2); // Cap at 2x target
    }

    /**
     * Get performance statistics
     */
    getStats() {
        const recentFPS = this.fpsHistory.slice(-60); // Last second
        const recentAvg = recentFPS.length > 0 ? recentFPS.reduce((a, b) => a + b, 0) / recentFPS.length : 60;
        
        return {
            ...this.stats,
            recentFPS: recentAvg,
            smoothDelta: this.smoothDelta,
            measurements: Array.from(this.measurements.entries()).map(([name, data]) => ({
                name,
                ...data,
                percentOfFrame: (data.avgTime / this.thresholds.frameTimeTarget) * 100
            })),
            bottlenecks: Array.from(this.bottlenecks.entries()).map(([name, data]) => ({
                name,
                ...data,
                avgTime: data.totalTime / data.count
            }))
        };
    }

    /**
     * Get top bottlenecks
     */
    getTopBottlenecks(limit = 5) {
        return Array.from(this.bottlenecks.entries())
            .map(([name, data]) => ({
                name,
                ...data,
                avgTime: data.totalTime / data.count,
                impact: data.totalTime
            }))
            .sort((a, b) => b.impact - a.impact)
            .slice(0, limit);
    }

    /**
     * Generate performance report
     */
    generateReport() {
        const stats = this.getStats();
        const bottlenecks = this.getTopBottlenecks();
        
        const report = {
            summary: {
                averageFPS: stats.averageFPS.toFixed(1),
                minFPS: stats.minFPS.toFixed(1),
                maxFPS: stats.maxFPS.toFixed(1),
                frameTimeVariance: stats.frameTimeVariance.toFixed(2),
                droppedFrameRate: ((stats.droppedFrames / stats.totalFrames) * 100).toFixed(2),
                performance: stats.averageFPS >= this.thresholds.minimumFPS ? 'Good' : 'Poor'
            },
            bottlenecks: bottlenecks.map(b => ({
                name: b.name,
                avgTime: b.avgTime.toFixed(2) + 'ms',
                maxTime: b.maxTime.toFixed(2) + 'ms',
                occurrences: b.count,
                impact: 'High'
            })),
            measurements: stats.measurements
                .sort((a, b) => b.avgTime - a.avgTime)
                .slice(0, 10)
                .map(m => ({
                    name: m.name,
                    avgTime: m.avgTime.toFixed(2) + 'ms',
                    calls: m.calls,
                    percentOfFrame: m.percentOfFrame.toFixed(1) + '%'
                }))
        };
        
        return report;
    }

    /**
     * Log performance report to console
     */
    logReport() {
        if (!this.isEnabled) return;
        
        const report = this.generateReport();
        
        console.group('🎯 Performance Report');
        console.table(report.summary);
        
        if (report.bottlenecks.length > 0) {
            console.group('🚨 Top Bottlenecks');
            console.table(report.bottlenecks);
            console.groupEnd();
        }
        
        console.group('📊 Top Measurements');
        console.table(report.measurements);
        console.groupEnd();
        
        console.groupEnd();
    }

    /**
     * Reset all measurements and statistics
     */
    reset() {
        this.measurements.clear();
        this.bottlenecks.clear();
        this.fpsHistory = [];
        this.frameTimings = [];
        this.deltaHistory = [];
        
        this.stats = {
            totalFrames: 0,
            droppedFrames: 0,
            averageFPS: 60,
            minFPS: 60,
            maxFPS: 60,
            frameTimeVariance: 0
        };
        
        console.log('[PerformanceProfiler] Reset all measurements');
    }

    /**
     * Enable or disable profiling
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        if (enabled) {
            console.log('[PerformanceProfiler] Profiling enabled');
        } else {
            console.log('[PerformanceProfiler] Profiling disabled');
        }
    }

    /**
     * Destroy the profiler
     */
    destroy() {
        this.reset();
        console.log('[PerformanceProfiler] Destroyed');
    }
}

// Create singleton instance
export const performanceProfiler = new PerformanceProfiler();

// Utility functions for easy integration
export function profile(name, fn) {
    return performanceProfiler.profile(name, fn);
}

export function profileAsync(name, fn) {
    return performanceProfiler.profileAsync(name, fn);
}

export function startProfile(name) {
    performanceProfiler.startProfile(name);
}

export function endProfile(name) {
    performanceProfiler.endProfile(name);
}

export function getCurrentFPS() {
    return performanceProfiler.getCurrentFPS();
}

export function getSmoothDelta() {
    return performanceProfiler.getSmoothDelta();
}

export function logPerformanceReport() {
    performanceProfiler.logReport();
}

export default PerformanceProfiler;