/**
 * MemoryRegistry.test.js - Tests for Memory Management Registry
 * 
 * Tests the memory registry functionality and memory leak detection
 */

const { memoryRegistry, managedSetTimeout, managedSetInterval, managedAddEventListener, detectMemoryLeaks } = require('../../src/utils/MemoryRegistry.js');

// Mock DOM elements for testing
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

describe('MemoryRegistry', () => {
    beforeEach(() => {
        // Clean up before each test
        memoryRegistry.cleanupAll();
    });

    afterEach(() => {
        // Clean up after each test
        memoryRegistry.cleanupAll();
    });

    describe('Timer Management', () => {
        test('should register and cleanup timers', (done) => {
            const callback = jest.fn();
            const timer = setTimeout(callback, 50);
            
            memoryRegistry.registerTimer('test-timer', timer);
            
            const stats = memoryRegistry.getMemoryStats();
            expect(stats.timers).toBe(1);
            
            // Cleanup timer
            memoryRegistry.removeResource('test-timer', 'timers');
            
            const statsAfter = memoryRegistry.getMemoryStats();
            expect(statsAfter.timers).toBe(0);
            
            // Timer should be cleared - wait longer than timeout to verify
            setTimeout(() => {
                expect(callback).not.toHaveBeenCalled();
                done();
            }, 100);
        });

        test('should cleanup timer by scope', () => {
            const timer1 = setTimeout(() => {}, 1000);
            const timer2 = setTimeout(() => {}, 1000);
            
            memoryRegistry.registerTimer('timer1', timer1, 'scope1');
            memoryRegistry.registerTimer('timer2', timer2, 'scope2');
            
            expect(memoryRegistry.getMemoryStats().timers).toBe(2);
            
            // Cleanup only scope1
            memoryRegistry.cleanupScope('scope1');
            
            const stats = memoryRegistry.getMemoryStats();
            expect(stats.timers).toBe(1);
            
            // Cleanup remaining
            memoryRegistry.cleanupScope('scope2');
            expect(memoryRegistry.getMemoryStats().timers).toBe(0);
        });
    });

    describe('Interval Management', () => {
        test('should register and cleanup intervals', () => {
            const callback = jest.fn();
            const interval = setInterval(callback, 10);
            
            memoryRegistry.registerInterval('test-interval', interval);
            
            const stats = memoryRegistry.getMemoryStats();
            expect(stats.intervals).toBe(1);
            
            // Cleanup interval
            memoryRegistry.removeResource('test-interval', 'intervals');
            
            const statsAfter = memoryRegistry.getMemoryStats();
            expect(statsAfter.intervals).toBe(0);
        });

        test('should replace existing intervals with same ID', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            
            const interval1 = setInterval(callback1, 100);
            const interval2 = setInterval(callback2, 100);
            
            memoryRegistry.registerInterval('same-id', interval1);
            memoryRegistry.registerInterval('same-id', interval2); // Should replace first
            
            const stats = memoryRegistry.getMemoryStats();
            expect(stats.intervals).toBe(1);
            
            // Cleanup
            memoryRegistry.removeResource('same-id', 'intervals');
        });
    });

    describe('Event Listener Management', () => {
        test('should register and cleanup event listeners', () => {
            const element = new MockElement();
            const handler = jest.fn();
            
            element.addEventListener('click', handler);
            memoryRegistry.registerEventListener('test-listener', element, 'click', handler);
            
            expect(element.getListenerCount('click')).toBe(1);
            expect(memoryRegistry.getMemoryStats().eventListeners).toBe(1);
            
            // Cleanup listener
            memoryRegistry.removeResource('test-listener', 'eventListeners');
            
            expect(element.getListenerCount('click')).toBe(0);
            expect(memoryRegistry.getMemoryStats().eventListeners).toBe(0);
        });

        test('should cleanup event listeners by scope', () => {
            const element1 = new MockElement();
            const element2 = new MockElement();
            const handler1 = jest.fn();
            const handler2 = jest.fn();
            
            element1.addEventListener('click', handler1);
            element2.addEventListener('click', handler2);
            
            memoryRegistry.registerEventListener('listener1', element1, 'click', handler1, 'scope1');
            memoryRegistry.registerEventListener('listener2', element2, 'click', handler2, 'scope2');
            
            expect(memoryRegistry.getMemoryStats().eventListeners).toBe(2);
            
            // Cleanup scope1
            memoryRegistry.cleanupScope('scope1');
            
            expect(element1.getListenerCount('click')).toBe(0);
            expect(element2.getListenerCount('click')).toBe(1);
            expect(memoryRegistry.getMemoryStats().eventListeners).toBe(1);
        });
    });

    describe('WebSocket Management', () => {
        test('should register and cleanup WebSocket connections', () => {
            const mockSocket = {
                disconnect: jest.fn(),
                close: jest.fn()
            };
            
            memoryRegistry.registerWebSocket('test-socket', mockSocket);
            
            expect(memoryRegistry.getMemoryStats().webSocketConnections).toBe(1);
            
            // Cleanup socket
            memoryRegistry.removeResource('test-socket', 'webSocketConnections');
            
            expect(mockSocket.disconnect).toHaveBeenCalled();
            expect(memoryRegistry.getMemoryStats().webSocketConnections).toBe(0);
        });

        test('should handle WebSocket with close method', () => {
            const mockSocket = {
                close: jest.fn()
            };
            
            memoryRegistry.registerWebSocket('test-socket', mockSocket);
            memoryRegistry.removeResource('test-socket', 'webSocketConnections');
            
            expect(mockSocket.close).toHaveBeenCalled();
        });
    });

    describe('Scope Management', () => {
        test('should cleanup all resources in a scope', () => {
            const timer = setTimeout(() => {}, 1000);
            const interval = setInterval(() => {}, 1000);
            const element = new MockElement();
            const handler = jest.fn();
            const mockSocket = { disconnect: jest.fn() };
            
            element.addEventListener('click', handler);
            
            memoryRegistry.registerTimer('timer1', timer, 'testScope');
            memoryRegistry.registerInterval('interval1', interval, 'testScope');
            memoryRegistry.registerEventListener('listener1', element, 'click', handler, 'testScope');
            memoryRegistry.registerWebSocket('socket1', mockSocket, 'testScope');
            
            const stats = memoryRegistry.getMemoryStats();
            expect(stats.timers).toBe(1);
            expect(stats.intervals).toBe(1);
            expect(stats.eventListeners).toBe(1);
            expect(stats.webSocketConnections).toBe(1);
            
            // Cleanup entire scope
            memoryRegistry.cleanupScope('testScope');
            
            const statsAfter = memoryRegistry.getMemoryStats();
            expect(statsAfter.timers).toBe(0);
            expect(statsAfter.intervals).toBe(0);
            expect(statsAfter.eventListeners).toBe(0);
            expect(statsAfter.webSocketConnections).toBe(0);
            
            expect(element.getListenerCount('click')).toBe(0);
            expect(mockSocket.disconnect).toHaveBeenCalled();
        });

        test('should not affect other scopes when cleaning up', () => {
            const timer1 = setTimeout(() => {}, 1000);
            const timer2 = setTimeout(() => {}, 1000);
            
            memoryRegistry.registerTimer('timer1', timer1, 'scope1');
            memoryRegistry.registerTimer('timer2', timer2, 'scope2');
            
            memoryRegistry.cleanupScope('scope1');
            
            expect(memoryRegistry.getMemoryStats().timers).toBe(1);
            
            memoryRegistry.cleanupScope('scope2');
            expect(memoryRegistry.getMemoryStats().timers).toBe(0);
        });
    });

    describe('Helper Functions', () => {
        test('managedSetTimeout should create and register timer', (done) => {
            const callback = jest.fn(() => {
                expect(callback).toHaveBeenCalled();
                // Timer should be automatically removed after execution
                setTimeout(() => {
                    expect(memoryRegistry.getMemoryStats().timers).toBe(0);
                    done();
                }, 10);
            });
            
            const result = managedSetTimeout(callback, 50, 'testScope');
            
            expect(result.id).toBeTruthy();
            expect(result.timer).toBeTruthy();
            expect(memoryRegistry.getMemoryStats().timers).toBe(1);
        });

        test('managedSetInterval should create and register interval', () => {
            const callback = jest.fn();
            
            const result = managedSetInterval(callback, 100, 'testScope');
            
            expect(result.id).toBeTruthy();
            expect(result.interval).toBeTruthy();
            expect(memoryRegistry.getMemoryStats().intervals).toBe(1);
            
            // Cleanup
            memoryRegistry.removeResource(result.id, 'intervals');
        });

        test('managedAddEventListener should create and register listener', () => {
            const element = new MockElement();
            const handler = jest.fn();
            
            const result = managedAddEventListener(element, 'click', handler, {}, 'testScope');
            
            expect(result.id).toBeTruthy();
            expect(result.cleanup).toBeInstanceOf(Function);
            expect(memoryRegistry.getMemoryStats().eventListeners).toBe(1);
            expect(element.getListenerCount('click')).toBe(1);
        });
    });

    describe('Memory Leak Detection', () => {
        test('should detect memory leaks when thresholds exceeded', () => {
            // Create resources that exceed thresholds (threshold for timers is 50, critical is 2x = 100)
            for (let i = 0; i < 120; i++) {
                const timer = setTimeout(() => {}, 10000);
                memoryRegistry.registerTimer(`timer${i}`, timer);
            }
            
            const leaks = detectMemoryLeaks();
            
            expect(leaks.length).toBeGreaterThan(0);
            const timerLeak = leaks.find(leak => leak.type === 'timers');
            expect(timerLeak).toBeTruthy();
            expect(timerLeak.count).toBe(120);
            expect(timerLeak.severity).toBe('critical');
        });

        test('should not detect leaks when under thresholds', () => {
            // Create small number of resources
            const timer = setTimeout(() => {}, 1000);
            memoryRegistry.registerTimer('timer1', timer);
            
            const leaks = detectMemoryLeaks();
            
            expect(leaks.length).toBe(0);
        });

        test('should classify leak severity correctly', () => {
            // Create moderate number of timers (warning level)
            for (let i = 0; i < 70; i++) {
                const timer = setTimeout(() => {}, 1000);
                memoryRegistry.registerTimer(`timer${i}`, timer);
            }
            
            const leaks = detectMemoryLeaks();
            const timerLeak = leaks.find(leak => leak.type === 'timers');
            
            expect(timerLeak.severity).toBe('warning');
            
            // Add more to reach critical level
            for (let i = 70; i < 120; i++) {
                const timer = setTimeout(() => {}, 1000);
                memoryRegistry.registerTimer(`timer${i}`, timer);
            }
            
            const leaks2 = detectMemoryLeaks();
            const timerLeak2 = leaks2.find(leak => leak.type === 'timers');
            
            expect(timerLeak2.severity).toBe('critical');
        });
    });

    describe('Error Handling', () => {
        test('should handle cleanup of non-existent resources gracefully', () => {
            expect(() => {
                memoryRegistry.removeResource('non-existent', 'timers');
            }).not.toThrow();
            
            expect(() => {
                memoryRegistry.cleanupScope('non-existent-scope');
            }).not.toThrow();
        });

        test('should handle cleanup of resources without proper methods', () => {
            const badSocket = {}; // No disconnect or close method
            
            memoryRegistry.registerWebSocket('bad-socket', badSocket);
            
            expect(() => {
                memoryRegistry.removeResource('bad-socket', 'webSocketConnections');
            }).not.toThrow();
        });
    });

    describe('Statistics', () => {
        test('should provide accurate memory statistics', () => {
            const timer = setTimeout(() => {}, 1000);
            const interval = setInterval(() => {}, 1000);
            const element = new MockElement();
            const handler = jest.fn();
            const mockSocket = { disconnect: jest.fn() };
            
            element.addEventListener('click', handler);
            
            memoryRegistry.registerTimer('timer1', timer);
            memoryRegistry.registerInterval('interval1', interval);
            memoryRegistry.registerEventListener('listener1', element, 'click', handler);
            memoryRegistry.registerWebSocket('socket1', mockSocket);
            
            const stats = memoryRegistry.getMemoryStats();
            
            expect(stats.timers).toBe(1);
            expect(stats.intervals).toBe(1);
            expect(stats.eventListeners).toBe(1);
            expect(stats.webSocketConnections).toBe(1);
            expect(stats.total).toBe(4);
            expect(stats.scopes).toBe(1); // All registered to 'global' scope
        });
    });
});