/**
 * MemoryLeakPrevention.test.js - Integration tests for memory leak prevention
 * 
 * Tests the complete memory management system across different components
 */

const { memoryRegistry, detectMemoryLeaks } = require('../../src/utils/MemoryRegistry.js');
const AuthManager = require('../../src/auth/AuthManager.js');

// Mock implementations for testing
class MockElement {
    constructor() {
        this.listeners = new Map();
    }
    
    addEventListener(event, handler, options) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(handler);
    }
    
    removeEventListener(event, handler) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(handler);
        }
    }
    
    getListenerCount(event) {
        return this.listeners.has(event) ? this.listeners.get(event).size : 0;
    }
}

class MockJWTManager {
    constructor(config) {
        this.config = config;
    }
    
    async generateToken(payload) {
        return {
            token: 'mock-token',
            refreshToken: 'mock-refresh-token'
        };
    }
    
    async verifyToken(token) {
        return { id: 'test-user', username: 'testuser' };
    }
    
    destroy() {
        // Mock cleanup
    }
}

class MockStorageManager {
    constructor(config) {
        this.config = config;
        this.storage = new Map();
    }
    
    async storeCredentials(credentials) {
        this.storage.set('credentials', credentials);
    }
    
    async getCredentials() {
        return this.storage.get('credentials');
    }
    
    async clearCredentials() {
        this.storage.delete('credentials');
    }
    
    async storeUserData(user) {
        this.storage.set('user', user);
    }
    
    async getUserData(userId) {
        return this.storage.get('user');
    }
    
    async updateTokens(tokens) {
        const credentials = this.storage.get('credentials') || {};
        this.storage.set('credentials', { ...credentials, ...tokens });
    }
    
    async storePassword(userId, password) {
        this.storage.set(`password_${userId}`, password);
    }
    
    async getStoredPassword(userId) {
        return this.storage.get(`password_${userId}`);
    }
    
    async clearAll() {
        this.storage.clear();
    }
    
    destroy() {
        this.storage.clear();
    }
}

// Mock require for browser compatibility
if (typeof require === 'undefined') {
    global.require = (path) => {
        if (path.includes('BrowserJWTManager')) {
            return MockJWTManager;
        }
        if (path.includes('StorageManager')) {
            return MockStorageManager;
        }
        if (path.includes('MemoryRegistry')) {
            return { memoryRegistry };
        }
        throw new Error(`Module ${path} not found`);
    };
}

describe('Memory Leak Prevention Integration', () => {
    beforeEach(() => {
        // Clean up before each test
        memoryRegistry.cleanupAll();
    });

    afterEach(() => {
        // Clean up after each test
        memoryRegistry.cleanupAll();
    });

    describe('AuthManager Memory Management', () => {
        test('should properly cleanup token refresh timers on logout', async () => {
            const config = {
                jwt: { secret: 'test-secret-very-long-and-secure-key' },
                storage: { encryption: true }
            };
            
            const authManager = new AuthManager(config);
            
            // Login to start token refresh timer
            const loginResult = await authManager.login({
                username: 'testuser',
                password: 'testpass'
            });
            
            // Verify timer is registered
            const statsAfterLogin = memoryRegistry.getMemoryStats();
            expect(statsAfterLogin.intervals).toBeGreaterThan(0);
            
            // Logout should cleanup timer
            await authManager.logout();
            
            const statsAfterLogout = memoryRegistry.getMemoryStats();
            expect(statsAfterLogout.intervals).toBe(0);
        });

        test('should cleanup all resources on destroy', async () => {
            const config = {
                jwt: { secret: 'test-secret-very-long-and-secure-key' },
                storage: { encryption: true }
            };
            
            const authManager = new AuthManager(config);
            
            // Register user and login
            await authManager.register({
                username: 'testuser',
                email: 'test@example.com',
                password: 'TestPass123!'
            });
            
            // Verify resources are registered
            const statsAfterLogin = memoryRegistry.getMemoryStats();
            expect(statsAfterLogin.intervals).toBeGreaterThan(0);
            
            // Destroy should cleanup everything
            authManager.destroy();
            
            const statsAfterDestroy = memoryRegistry.getMemoryStats();
            expect(statsAfterDestroy.intervals).toBe(0);
        });

        test('should handle destroy gracefully even with errors', () => {
            const config = {
                jwt: { secret: 'test-secret-very-long-and-secure-key' },
                storage: { encryption: true }
            };
            
            const authManager = new AuthManager(config);
            
            // Force an error state
            authManager.tokenRefreshTimer = 'invalid-timer';
            
            // Should not throw
            expect(() => {
                authManager.destroy();
            }).not.toThrow();
            
            // Should still cleanup scope
            const stats = memoryRegistry.getMemoryStats();
            expect(stats.total).toBe(0);
        });
    });

    describe('Cross-Component Memory Cleanup', () => {
        test('should cleanup resources from multiple components', () => {
            // Simulate multiple components registering resources
            const timer1 = setTimeout(() => {}, 10000);
            const timer2 = setTimeout(() => {}, 10000);
            const interval1 = setInterval(() => {}, 1000);
            const element = new MockElement();
            const handler = jest.fn();
            const mockSocket = {
                disconnect: jest.fn(),
                close: jest.fn()
            };
            
            element.addEventListener('click', handler);
            
            // Register resources from different components
            memoryRegistry.registerTimer('component1_timer', timer1, 'Component1');
            memoryRegistry.registerTimer('component2_timer', timer2, 'Component2');
            memoryRegistry.registerInterval('component1_interval', interval1, 'Component1');
            memoryRegistry.registerEventListener('component2_listener', element, 'click', handler, 'Component2');
            memoryRegistry.registerWebSocket('component1_socket', mockSocket, 'Component1');
            
            const statsBeforeCleanup = memoryRegistry.getMemoryStats();
            expect(statsBeforeCleanup.total).toBe(5);
            expect(statsBeforeCleanup.scopes).toBe(2);
            
            // Cleanup Component1 only
            memoryRegistry.cleanupScope('Component1');
            
            const statsAfterPartialCleanup = memoryRegistry.getMemoryStats();
            expect(statsAfterPartialCleanup.timers).toBe(1); // Component2 timer remains
            expect(statsAfterPartialCleanup.intervals).toBe(0); // Component1 interval cleaned
            expect(statsAfterPartialCleanup.eventListeners).toBe(1); // Component2 listener remains
            expect(statsAfterPartialCleanup.webSocketConnections).toBe(0); // Component1 socket cleaned
            
            // Cleanup Component2
            memoryRegistry.cleanupScope('Component2');
            
            const statsAfterFullCleanup = memoryRegistry.getMemoryStats();
            expect(statsAfterFullCleanup.total).toBe(0);
            expect(element.getListenerCount('click')).toBe(0);
            expect(mockSocket.disconnect).toHaveBeenCalled();
        });

        test('should detect memory leaks across components', () => {
            // Create resources that exceed thresholds in different components
            
            // Component1: Too many timers
            for (let i = 0; i < 60; i++) {
                const timer = setTimeout(() => {}, 10000);
                memoryRegistry.registerTimer(`component1_timer_${i}`, timer, 'Component1');
            }
            
            // Component2: Too many event listeners
            for (let i = 0; i < 110; i++) {
                const element = new MockElement();
                const handler = jest.fn();
                element.addEventListener('click', handler);
                memoryRegistry.registerEventListener(`component2_listener_${i}`, element, 'click', handler, 'Component2');
            }
            
            const leaks = detectMemoryLeaks();
            
            expect(leaks.length).toBe(2);
            
            const timerLeak = leaks.find(leak => leak.type === 'timers');
            expect(timerLeak).toBeTruthy();
            expect(timerLeak.count).toBe(60);
            expect(timerLeak.severity).toBe('critical');
            
            const listenerLeak = leaks.find(leak => leak.type === 'eventListeners');
            expect(listenerLeak).toBeTruthy();
            expect(listenerLeak.count).toBe(110);
            expect(listenerLeak.severity).toBe('warning');
        });
    });

    describe('Performance Monitoring', () => {
        test('should track memory usage over time', async () => {
            const measurements = [];
            
            // Take initial measurement
            measurements.push(memoryRegistry.getMemoryStats());
            
            // Create resources gradually
            for (let batch = 0; batch < 5; batch++) {
                for (let i = 0; i < 10; i++) {
                    const timer = setTimeout(() => {}, 5000);
                    memoryRegistry.registerTimer(`batch${batch}_timer${i}`, timer);
                }
                measurements.push(memoryRegistry.getMemoryStats());
            }
            
            // Verify increasing memory usage
            for (let i = 1; i < measurements.length; i++) {
                expect(measurements[i].timers).toBeGreaterThan(measurements[i - 1].timers);
                expect(measurements[i].total).toBeGreaterThan(measurements[i - 1].total);
            }
            
            // Final measurement should show 50 timers
            const finalMeasurement = measurements[measurements.length - 1];
            expect(finalMeasurement.timers).toBe(50);
            expect(finalMeasurement.total).toBe(50);
        });

        test('should monitor memory usage with periodic checks', (done) => {
            let checkCount = 0;
            const maxChecks = 5;
            const measurements = [];
            
            // Create some resources
            for (let i = 0; i < 20; i++) {
                const timer = setTimeout(() => {}, 10000);
                memoryRegistry.registerTimer(`monitor_timer_${i}`, timer);
            }
            
            // Periodic monitoring
            const monitor = setInterval(() => {
                checkCount++;
                const stats = memoryRegistry.getMemoryStats();
                measurements.push({
                    timestamp: Date.now(),
                    stats: stats
                });
                
                if (checkCount >= maxChecks) {
                    clearInterval(monitor);
                    
                    // Verify we collected measurements
                    expect(measurements.length).toBe(maxChecks);
                    
                    // All measurements should show consistent resource count
                    measurements.forEach(measurement => {
                        expect(measurement.stats.timers).toBe(20);
                    });
                    
                    done();
                }
            }, 50);
        });
    });

    describe('Error Recovery', () => {
        test('should handle cleanup failures gracefully', () => {
            // Create resource with problematic cleanup
            const badSocket = {
                disconnect: () => {
                    throw new Error('Disconnect failed');
                }
            };
            
            memoryRegistry.registerWebSocket('bad-socket', badSocket);
            
            // Should not throw despite cleanup error
            expect(() => {
                memoryRegistry.cleanupScope('global');
            }).not.toThrow();
            
            // Should still be removed from registry
            const stats = memoryRegistry.getMemoryStats();
            expect(stats.webSocketConnections).toBe(0);
        });

        test('should continue cleanup even if some resources fail', () => {
            const goodTimer = setTimeout(() => {}, 5000);
            const badSocket = {
                disconnect: () => {
                    throw new Error('Disconnect failed');
                }
            };
            const element = new MockElement();
            const handler = jest.fn();
            
            element.addEventListener('click', handler);
            
            memoryRegistry.registerTimer('good-timer', goodTimer, 'test-scope');
            memoryRegistry.registerWebSocket('bad-socket', badSocket, 'test-scope');
            memoryRegistry.registerEventListener('good-listener', element, 'click', handler, 'test-scope');
            
            expect(memoryRegistry.getMemoryStats().total).toBe(3);
            
            // Should cleanup successfully despite one failure
            expect(() => {
                memoryRegistry.cleanupScope('test-scope');
            }).not.toThrow();
            
            // Should cleanup the good resources
            const stats = memoryRegistry.getMemoryStats();
            expect(stats.total).toBe(0);
            expect(element.getListenerCount('click')).toBe(0);
        });
    });

    describe('Stress Testing', () => {
        test('should handle large numbers of resources efficiently', () => {
            const startTime = Date.now();
            const resourceCount = 1000;
            
            // Create many resources
            for (let i = 0; i < resourceCount; i++) {
                const timer = setTimeout(() => {}, 30000);
                const element = new MockElement();
                const handler = jest.fn();
                
                element.addEventListener('click', handler);
                
                memoryRegistry.registerTimer(`stress_timer_${i}`, timer, 'stress-test');
                memoryRegistry.registerEventListener(`stress_listener_${i}`, element, 'click', handler, 'stress-test');
            }
            
            const creationTime = Date.now() - startTime;
            console.log(`Created ${resourceCount * 2} resources in ${creationTime}ms`);
            
            const stats = memoryRegistry.getMemoryStats();
            expect(stats.timers).toBe(resourceCount);
            expect(stats.eventListeners).toBe(resourceCount);
            expect(stats.total).toBe(resourceCount * 2);
            
            // Cleanup should be fast
            const cleanupStartTime = Date.now();
            memoryRegistry.cleanupScope('stress-test');
            const cleanupTime = Date.now() - cleanupStartTime;
            
            console.log(`Cleaned up ${resourceCount * 2} resources in ${cleanupTime}ms`);
            
            const finalStats = memoryRegistry.getMemoryStats();
            expect(finalStats.total).toBe(0);
            
            // Both operations should complete quickly
            expect(creationTime).toBeLessThan(1000); // Less than 1 second
            expect(cleanupTime).toBeLessThan(500);   // Less than 0.5 seconds
        });
    });
});