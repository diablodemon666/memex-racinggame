/**
 * ModuleRegistry Tests
 * 
 * Tests for the core module registration and lifecycle management system.
 * Following TDD principles - these tests should fail initially.
 */

import { ModuleRegistry } from '../../src/core/ModuleRegistry.js';
import { Module } from '../../src/core/Module.js';

describe('ModuleRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new ModuleRegistry();
  });

  afterEach(() => {
    registry.destroy();
  });

  describe('Module Registration', () => {
    test('should register a module successfully', () => {
      const mockModule = new Module('testModule', {});
      
      expect(() => {
        registry.register(mockModule);
      }).not.toThrow();
      
      expect(registry.hasModule('testModule')).toBe(true);
    });

    test('should throw error when registering duplicate module', () => {
      const mockModule1 = new Module('testModule', {});
      const mockModule2 = new Module('testModule', {});
      
      registry.register(mockModule1);
      
      expect(() => {
        registry.register(mockModule2);
      }).toThrow('Module testModule is already registered');
    });

    test('should throw error when registering invalid module', () => {
      expect(() => {
        registry.register(null);
      }).toThrow('Invalid module provided');
      
      expect(() => {
        registry.register({});
      }).toThrow('Invalid module provided');
    });
  });

  describe('Module Initialization', () => {
    test('should initialize modules in correct dependency order', async () => {
      const initOrder = [];
      
      // Create modules with dependencies
      const moduleA = new Module('moduleA', {
        initialize: () => {
          initOrder.push('A');
          return Promise.resolve();
        }
      });
      
      const moduleB = new Module('moduleB', {
        dependencies: ['moduleA'],
        initialize: () => {
          initOrder.push('B');
          return Promise.resolve();
        }
      });
      
      const moduleC = new Module('moduleC', {
        dependencies: ['moduleB'],
        initialize: () => {
          initOrder.push('C');
          return Promise.resolve();
        }
      });
      
      // Register in random order
      registry.register(moduleC);
      registry.register(moduleA);
      registry.register(moduleB);
      
      await registry.initializeAll();
      
      expect(initOrder).toEqual(['A', 'B', 'C']);
    });

    test('should detect circular dependencies', () => {
      const moduleA = new Module('moduleA', {
        dependencies: ['moduleB']
      });
      
      const moduleB = new Module('moduleB', {
        dependencies: ['moduleA']
      });
      
      registry.register(moduleA);
      registry.register(moduleB);
      
      expect(registry.initializeAll()).rejects.toThrow('Circular dependency detected');
    });

    test('should handle missing dependencies', () => {
      const moduleA = new Module('moduleA', {
        dependencies: ['missingModule']
      });
      
      registry.register(moduleA);
      
      expect(registry.initializeAll()).rejects.toThrow('Missing dependency: missingModule');
    });

    test('should call lifecycle hooks in correct order', async () => {
      const lifecycleOrder = [];
      
      const mockModule = new Module('testModule', {
        preInit: () => {
          lifecycleOrder.push('preInit');
          return Promise.resolve();
        },
        initialize: () => {
          lifecycleOrder.push('initialize');
          return Promise.resolve();
        },
        postInit: () => {
          lifecycleOrder.push('postInit');
          return Promise.resolve();
        }
      });
      
      registry.register(mockModule);
      await registry.initializeAll();
      
      expect(lifecycleOrder).toEqual(['preInit', 'initialize', 'postInit']);
    });
  });

  describe('Module Management', () => {
    test('should retrieve registered module', () => {
      const mockModule = new Module('testModule', {});
      registry.register(mockModule);
      
      const retrieved = registry.getModule('testModule');
      expect(retrieved).toBe(mockModule);
    });

    test('should return null for non-existent module', () => {
      const retrieved = registry.getModule('nonExistent');
      expect(retrieved).toBeNull();
    });

    test('should list all registered modules', () => {
      const moduleA = new Module('moduleA', {});
      const moduleB = new Module('moduleB', {});
      
      registry.register(moduleA);
      registry.register(moduleB);
      
      const modules = registry.getAllModules();
      expect(modules).toHaveLength(2);
      expect(modules.map(m => m.name)).toContain('moduleA');
      expect(modules.map(m => m.name)).toContain('moduleB');
    });

    test('should handle module destruction properly', async () => {
      const destroyOrder = [];
      
      const moduleA = new Module('moduleA', {
        destroy: () => {
          destroyOrder.push('A');
          return Promise.resolve();
        }
      });
      
      const moduleB = new Module('moduleB', {
        dependencies: ['moduleA'],
        destroy: () => {
          destroyOrder.push('B');
          return Promise.resolve();
        }
      });
      
      registry.register(moduleA);
      registry.register(moduleB);
      
      await registry.initializeAll();
      await registry.destroy();
      
      // Should destroy in reverse dependency order
      expect(destroyOrder).toEqual(['B', 'A']);
    });
  });

  describe('Error Handling', () => {
    test('should handle initialization errors gracefully', async () => {
      const mockModule = new Module('failingModule', {
        initialize: () => {
          throw new Error('Initialization failed');
        }
      });
      
      registry.register(mockModule);
      
      await expect(registry.initializeAll()).rejects.toThrow('Initialization failed');
      
      // Registry should remain in valid state
      expect(registry.hasModule('failingModule')).toBe(true);
    });

    test('should continue initialization after non-critical errors', async () => {
      const initOrder = [];
      
      const moduleA = new Module('moduleA', {
        initialize: () => {
          initOrder.push('A');
          return Promise.resolve();
        }
      });
      
      const moduleB = new Module('moduleB', {
        initialize: () => {
          throw new Error('Non-critical error');
        },
        critical: false
      });
      
      const moduleC = new Module('moduleC', {
        initialize: () => {
          initOrder.push('C');
          return Promise.resolve();
        }
      });
      
      registry.register(moduleA);
      registry.register(moduleB);
      registry.register(moduleC);
      
      await registry.initializeAll();
      
      expect(initOrder).toEqual(['A', 'C']);
    });
  });

  describe('Performance', () => {
    test('should initialize modules within performance budget', async () => {
      // Create 50 lightweight modules to test performance
      for (let i = 0; i < 50; i++) {
        const module = new Module(`module${i}`, {
          initialize: () => Promise.resolve()
        });
        registry.register(module);
      }
      
      const startTime = performance.now();
      await registry.initializeAll();
      const endTime = performance.now();
      
      // Should initialize all modules within 100ms
      expect(endTime - startTime).toBeLessThan(100);
    });

    test('should handle large dependency graphs efficiently', async () => {
      // Create chain of dependencies: A <- B <- C <- ... <- Z
      let prevModuleName = null;
      const moduleNames = [];
      
      for (let i = 0; i < 26; i++) {
        const moduleName = `module${String.fromCharCode(65 + i)}`;
        moduleNames.push(moduleName);
        
        const module = new Module(moduleName, {
          dependencies: prevModuleName ? [prevModuleName] : [],
          initialize: () => Promise.resolve()
        });
        
        registry.register(module);
        prevModuleName = moduleName;
      }
      
      const startTime = performance.now();
      await registry.initializeAll();
      const endTime = performance.now();
      
      // Should resolve complex dependency graph within 50ms
      expect(endTime - startTime).toBeLessThan(50);
    });
  });
});