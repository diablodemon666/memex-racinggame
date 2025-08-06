/**
 * LRUCache.js - Least Recently Used Cache Implementation
 * 
 * High-performance LRU cache with configurable eviction policies
 * and memory management for optimal asset caching.
 */

/**
 * Cache Node for doubly linked list
 */
class CacheNode {
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.prev = null;
    this.next = null;
    this.accessCount = 1;
    this.createdAt = Date.now();
    this.lastAccessed = Date.now();
  }
}

/**
 * LRU Cache Implementation with Advanced Features
 */
export class LRUCache {
  constructor(capacity = 100, options = {}) {
    this.capacity = capacity;
    this.options = {
      onEvict: null,           // Callback when item is evicted
      onSet: null,             // Callback when item is set
      onGet: null,             // Callback when item is accessed
      trackStats: true,        // Track access statistics
      allowStale: false,       // Allow stale entries
      maxAge: 0,              // Max age in milliseconds (0 = no expiry)
      updateAgeOnGet: true,    // Update age on access
      ...options
    };
    
    // Internal storage
    this.cache = new Map();
    this.size = 0;
    
    // Doubly linked list for LRU tracking
    this.head = new CacheNode('__head__', null);
    this.tail = new CacheNode('__tail__', null);
    this.head.next = this.tail;
    this.tail.prev = this.head;
    
    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      expired: 0,
      totalAccesses: 0
    };
    
    // Memory tracking
    this.memoryUsage = 0;
    this.maxMemory = options.maxMemory || 0; // 0 = unlimited
    
    console.log(`[LRUCache] Initialized with capacity: ${capacity}`);
  }

  /**
   * Get value from cache
   */
  get(key) {
    const node = this.cache.get(key);
    
    if (!node) {
      this.stats.misses++;
      this.stats.totalAccesses++;
      return undefined;
    }
    
    // Check if expired
    if (this.isExpired(node)) {
      this.delete(key);
      this.stats.expired++;
      this.stats.misses++;
      this.stats.totalAccesses++;
      return undefined;
    }
    
    // Update access information
    node.accessCount++;
    node.lastAccessed = Date.now();
    
    // Move to front (most recently used)
    this.moveToFront(node);
    
    // Update statistics
    this.stats.hits++;
    this.stats.totalAccesses++;
    
    // Trigger callback
    if (this.options.onGet) {
      this.options.onGet(key, node.value);
    }
    
    return node.value;
  }

  /**
   * Set value in cache
   */
  set(key, value, options = {}) {
    const nodeOptions = {
      maxAge: options.maxAge || this.options.maxAge,
      ...options
    };
    
    // Check if key already exists
    const existingNode = this.cache.get(key);
    if (existingNode) {
      // Update existing node
      existingNode.value = value;
      existingNode.lastAccessed = Date.now();
      existingNode.accessCount++;
      
      // Update memory usage
      this.updateMemoryUsage(key, value, existingNode.value);
      
      // Move to front
      this.moveToFront(existingNode);
      
      this.stats.sets++;
      
      if (this.options.onSet) {
        this.options.onSet(key, value, false); // false = update
      }
      
      return this;
    }
    
    // Create new node
    const newNode = new CacheNode(key, value);
    if (nodeOptions.maxAge) {
      newNode.maxAge = nodeOptions.maxAge;
    }
    
    // Add to cache
    this.cache.set(key, newNode);
    this.addToFront(newNode);
    this.size++;
    
    // Update memory usage
    this.updateMemoryUsage(key, value);
    
    // Check capacity and evict if necessary
    this.enforceCapacity();
    
    // Check memory limit
    this.enforceMemoryLimit();
    
    this.stats.sets++;
    
    if (this.options.onSet) {
      this.options.onSet(key, value, true); // true = new
    }
    
    return this;
  }

  /**
   * Check if key exists in cache
   */
  has(key) {
    const node = this.cache.get(key);
    
    if (!node) {
      return false;
    }
    
    // Check if expired
    if (this.isExpired(node)) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Delete key from cache
   */
  delete(key) {
    const node = this.cache.get(key);
    
    if (!node) {
      return false;
    }
    
    // Remove from cache and list
    this.cache.delete(key);
    this.removeFromList(node);
    this.size--;
    
    // Update memory usage
    this.updateMemoryUsage(key, null, node.value);
    
    // Trigger eviction callback
    if (this.options.onEvict) {
      this.options.onEvict(key, node.value);
    }
    
    return true;
  }

  /**
   * Clear all entries
   */
  clear() {
    // Trigger eviction callbacks for all items
    if (this.options.onEvict) {
      for (const [key, node] of this.cache) {
        this.options.onEvict(key, node.value);
      }
    }
    
    this.cache.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.size = 0;
    this.memoryUsage = 0;
    
    console.log('[LRUCache] Cache cleared');
  }

  /**
   * Get all keys
   */
  keys() {
    const keys = [];
    let current = this.head.next;
    
    while (current !== this.tail) {
      keys.push(current.key);
      current = current.next;
    }
    
    return keys;
  }

  /**
   * Get all values
   */
  values() {
    const values = [];
    let current = this.head.next;
    
    while (current !== this.tail) {
      values.push(current.value);
      current = current.next;
    }
    
    return values;
  }

  /**
   * Get all entries
   */
  entries() {
    const entries = [];
    let current = this.head.next;
    
    while (current !== this.tail) {
      entries.push([current.key, current.value]);
      current = current.next;
    }
    
    return entries;
  }

  /**
   * Iterate over cache entries
   */
  forEach(callback, thisArg) {
    let current = this.head.next;
    let index = 0;
    
    while (current !== this.tail) {
      callback.call(thisArg, current.value, current.key, index++);
      current = current.next;
    }
  }

  /**
   * Evict least recently used item
   */
  evictLRU() {
    if (this.size === 0) {
      return null;
    }
    
    const lru = this.tail.prev;
    if (lru === this.head) {
      return null;
    }
    
    const key = lru.key;
    const value = lru.value;
    
    this.delete(key);
    this.stats.evictions++;
    
    return { key, value };
  }

  /**
   * Evict most recently used item
   */
  evictMRU() {
    if (this.size === 0) {
      return null;
    }
    
    const mru = this.head.next;
    if (mru === this.tail) {
      return null;
    }
    
    const key = mru.key;
    const value = mru.value;
    
    this.delete(key);
    this.stats.evictions++;
    
    return { key, value };
  }

  /**
   * Prune expired entries
   */
  prune() {
    const expired = [];
    let current = this.head.next;
    
    while (current !== this.tail) {
      const next = current.next;
      
      if (this.isExpired(current)) {
        expired.push(current.key);
        this.delete(current.key);
      }
      
      current = next;
    }
    
    this.stats.expired += expired.length;
    
    return expired;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.totalAccesses > 0 ? 
      (this.stats.hits / this.stats.totalAccesses) * 100 : 0;
    
    return {
      ...this.stats,
      size: this.size,
      capacity: this.capacity,
      memoryUsage: this.memoryUsage,
      hitRate: Math.round(hitRate * 100) / 100,
      utilizationRate: Math.round((this.size / this.capacity) * 100),
      averageAccessCount: this.getAverageAccessCount()
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      expired: 0,
      totalAccesses: 0
    };
  }

  /**
   * Get cache info for debugging
   */
  getDebugInfo() {
    const info = {
      size: this.size,
      capacity: this.capacity,
      memoryUsage: this.memoryUsage,
      stats: this.getStats(),
      entries: []
    };
    
    let current = this.head.next;
    let position = 0;
    
    while (current !== this.tail) {
      info.entries.push({
        position: position++,
        key: current.key,
        accessCount: current.accessCount,
        age: Date.now() - current.createdAt,
        timeSinceAccess: Date.now() - current.lastAccessed,
        expired: this.isExpired(current)
      });
      current = current.next;
    }
    
    return info;
  }

  /**
   * Check if node is expired
   */
  isExpired(node) {
    if (!this.options.maxAge && !node.maxAge) {
      return false;
    }
    
    const maxAge = node.maxAge || this.options.maxAge;
    const age = Date.now() - node.createdAt;
    
    return age > maxAge;
  }

  /**
   * Move node to front of list (most recently used)
   */
  moveToFront(node) {
    this.removeFromList(node);
    this.addToFront(node);
  }

  /**
   * Add node to front of list
   */
  addToFront(node) {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next.prev = node;
    this.head.next = node;
  }

  /**
   * Remove node from list
   */
  removeFromList(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  /**
   * Enforce capacity limit
   */
  enforceCapacity() {
    while (this.size > this.capacity) {
      this.evictLRU();
    }
  }

  /**
   * Enforce memory limit
   */
  enforceMemoryLimit() {
    if (this.maxMemory <= 0) return;
    
    while (this.memoryUsage > this.maxMemory && this.size > 0) {
      this.evictLRU();
    }
  }

  /**
   * Update memory usage tracking
   */
  updateMemoryUsage(key, newValue, oldValue = null) {
    // Simple estimation - can be overridden for more accurate tracking
    if (oldValue !== null) {
      // Removing old value
      this.memoryUsage -= this.estimateSize(oldValue);
    }
    
    if (newValue !== null) {
      // Adding new value
      this.memoryUsage += this.estimateSize(newValue);
      this.memoryUsage += key.length * 2; // Rough string size estimate
    }
  }

  /**
   * Estimate object size in bytes
   */
  estimateSize(obj) {
    if (obj === null || obj === undefined) return 0;
    
    if (typeof obj === 'string') {
      return obj.length * 2; // UTF-16
    }
    
    if (typeof obj === 'number') {
      return 8;
    }
    
    if (typeof obj === 'boolean') {
      return 4;
    }
    
    if (obj.memorySize) {
      return obj.memorySize; // Custom size property
    }
    
    if (obj instanceof HTMLCanvasElement) {
      return obj.width * obj.height * 4; // RGBA
    }
    
    if (obj instanceof HTMLImageElement) {
      return obj.width * obj.height * 4;
    }
    
    // Rough estimate for objects
    try {
      return JSON.stringify(obj).length * 2;
    } catch (e) {
      return 1000; // Default estimate
    }
  }

  /**
   * Get average access count
   */
  getAverageAccessCount() {
    if (this.size === 0) return 0;
    
    let totalAccess = 0;
    let current = this.head.next;
    
    while (current !== this.tail) {
      totalAccess += current.accessCount;
      current = current.next;
    }
    
    return Math.round(totalAccess / this.size);
  }

  /**
   * Get least recently used items
   */
  getLRUItems(count = 5) {
    const items = [];
    let current = this.tail.prev;
    let collected = 0;
    
    while (current !== this.head && collected < count) {
      items.push({
        key: current.key,
        accessCount: current.accessCount,
        age: Date.now() - current.createdAt,
        timeSinceAccess: Date.now() - current.lastAccessed
      });
      current = current.prev;
      collected++;
    }
    
    return items;
  }

  /**
   * Get most recently used items
   */
  getMRUItems(count = 5) {
    const items = [];
    let current = this.head.next;
    let collected = 0;
    
    while (current !== this.tail && collected < count) {
      items.push({
        key: current.key,
        accessCount: current.accessCount,
        age: Date.now() - current.createdAt,
        timeSinceAccess: Date.now() - current.lastAccessed
      });
      current = current.next;
      collected++;
    }
    
    return items;
  }
}

export default LRUCache;