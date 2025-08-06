// Rate Limiting System for Authentication Security
// TDD GREEN Phase - Minimal implementation to pass tests

class RateLimiter {
  constructor(config) {
    if (!config) {
      throw new Error('RateLimiter configuration is required');
    }
    
    this.config = {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
      blockDuration: 15 * 60 * 1000, // 15 minutes
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
      ...config
    };
    
    // Storage for tracking attempts and blocks
    this.attempts = new Map(); // identifier -> { count, windowStart, lastAttempt }
    this.blocked = new Map();  // identifier -> { blockedUntil }
    
    // Start cleanup timer
    this.startCleanupTimer();
  }

  async checkLimit(identifier) {
    const now = Date.now();
    
    // Check if identifier is currently blocked
    if (await this.isBlocked(identifier)) {
      const blockInfo = this.blocked.get(identifier);
      return {
        allowed: false,
        remainingAttempts: 0,
        blockedUntil: blockInfo.blockedUntil,
        identifier: identifier
      };
    }
    
    // Get or initialize attempt tracking
    let attemptInfo = this.attempts.get(identifier);
    if (!attemptInfo) {
      attemptInfo = {
        count: 0,
        windowStart: now,
        lastAttempt: now
      };
    }
    
    // Check if we need to reset the window
    const windowExpired = (now - attemptInfo.windowStart) > this.config.windowMs;
    if (windowExpired) {
      attemptInfo = {
        count: 0,
        windowStart: now,
        lastAttempt: now
      };
    }
    
    // Increment attempt count
    attemptInfo.count++;
    attemptInfo.lastAttempt = now;
    this.attempts.set(identifier, attemptInfo);
    
    // Check if limit exceeded
    const remainingAttempts = Math.max(0, this.config.maxAttempts - attemptInfo.count);
    const limitExceeded = attemptInfo.count > this.config.maxAttempts;
    
    if (limitExceeded) {
      // Block the identifier
      await this.blockIdentifier(identifier);
      const blockInfo = this.blocked.get(identifier);
      
      return {
        allowed: false,
        remainingAttempts: 0,
        blockedUntil: blockInfo.blockedUntil,
        identifier: identifier
      };
    }
    
    return {
      allowed: true,
      remainingAttempts: remainingAttempts,
      identifier: identifier
    };
  }

  async blockIdentifier(identifier, duration = null) {
    const blockDuration = duration || this.config.blockDuration;
    const blockedUntil = new Date(Date.now() + blockDuration);
    
    this.blocked.set(identifier, {
      blockedUntil: blockedUntil,
      blockedAt: new Date()
    });
    
    // Reset attempt counter when blocked
    this.attempts.delete(identifier);
  }

  async unblockIdentifier(identifier) {
    this.blocked.delete(identifier);
  }

  async isBlocked(identifier) {
    const blockInfo = this.blocked.get(identifier);
    if (!blockInfo) {
      return false;
    }
    
    const now = Date.now();
    if (now > blockInfo.blockedUntil.getTime()) {
      // Block has expired, remove it
      this.blocked.delete(identifier);
      return false;
    }
    
    return true;
  }

  async recordFailedAttempt(identifier) {
    const now = Date.now();
    
    let attemptInfo = this.attempts.get(identifier);
    if (!attemptInfo) {
      attemptInfo = {
        count: 0,
        windowStart: now,
        lastAttempt: now
      };
    }
    
    // Check if window expired
    const windowExpired = (now - attemptInfo.windowStart) > this.config.windowMs;
    if (windowExpired) {
      attemptInfo = {
        count: 0,
        windowStart: now,
        lastAttempt: now
      };
    }
    
    attemptInfo.count++;
    attemptInfo.lastAttempt = now;
    this.attempts.set(identifier, attemptInfo);
    
    // Check if should be blocked
    if (attemptInfo.count >= this.config.maxAttempts) {
      await this.blockIdentifier(identifier);
    }
  }

  async recordSuccessfulAttempt(identifier) {
    // Reset attempts on successful login
    this.attempts.delete(identifier);
    // Also remove any blocks
    this.blocked.delete(identifier);
  }

  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.cleanupInterval);
  }

  cleanupExpiredEntries() {
    const now = Date.now();
    
    // Clean up expired attempt windows
    for (const [identifier, attemptInfo] of this.attempts.entries()) {
      const windowExpired = (now - attemptInfo.windowStart) > this.config.windowMs;
      if (windowExpired) {
        this.attempts.delete(identifier);
      }
    }
    
    // Clean up expired blocks
    for (const [identifier, blockInfo] of this.blocked.entries()) {
      if (now > blockInfo.blockedUntil.getTime()) {
        this.blocked.delete(identifier);
      }
    }
  }

  cleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.attempts.clear();
    this.blocked.clear();
  }

  // Statistics and monitoring methods
  getStats() {
    return {
      activeAttemptTracking: this.attempts.size,
      currentlyBlocked: this.blocked.size,
      config: this.config
    };
  }

  getBlockedIdentifiers() {
    const blocked = [];
    const now = Date.now();
    
    for (const [identifier, blockInfo] of this.blocked.entries()) {
      if (now <= blockInfo.blockedUntil.getTime()) {
        blocked.push({
          identifier,
          blockedUntil: blockInfo.blockedUntil,
          remainingTime: blockInfo.blockedUntil.getTime() - now
        });
      }
    }
    
    return blocked;
  }
}

module.exports = RateLimiter;