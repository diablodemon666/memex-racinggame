// JWT Token Management System
// TDD GREEN Phase - Minimal implementation to pass tests

const jwt = require('jsonwebtoken');

class JWTManager {
  constructor(config) {
    if (!config || !config.secret) {
      throw new Error('JWT configuration with secret is required');
    }
    
    this.config = config;
    this.refreshTimer = null;
    
    // Token blacklist for invalidation mechanism
    this.blacklistedTokens = new Set();
    this.userTokens = new Map(); // userId -> Set of tokens
    
    // Start cleanup timer for expired blacklisted tokens
    this.startBlacklistCleanup();
  }

  async generateToken(userData) {
    try {
      // Generate main JWT token
      const payload = {
        ...userData,
        type: 'access'
      };
      
      const token = jwt.sign(payload, this.config.secret, {
        expiresIn: this.config.expiresIn,
        algorithm: this.config.algorithm
      });

      // Generate refresh token with longer expiry
      const refreshPayload = {
        id: userData.id,
        type: 'refresh'
      };
      
      const refreshToken = jwt.sign(refreshPayload, this.config.secret, {
        expiresIn: this.config.refreshExpiresIn,
        algorithm: this.config.algorithm
      });

      // Calculate expiry date
      const decoded = jwt.decode(token);
      const expiresAt = new Date(decoded.exp * 1000);

      // Track user tokens for invalidation
      if (!this.userTokens.has(userData.id)) {
        this.userTokens.set(userData.id, new Set());
      }
      this.userTokens.get(userData.id).add(token);
      this.userTokens.get(userData.id).add(refreshToken);

      return {
        token,
        refreshToken,
        expiresAt
      };
    } catch (error) {
      throw new Error(`Token generation failed: ${error.message}`);
    }
  }

  async verifyToken(token) {
    try {
      // Check if token is blacklisted first
      if (this.isTokenBlacklisted(token)) {
        throw new Error('Token has been invalidated');
      }
      
      const decoded = jwt.verify(token, this.config.secret, {
        algorithms: [this.config.algorithm]
      });
      return decoded;
    } catch (error) {
      if (error.message === 'Token has been invalidated') {
        throw error;
      } else if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else {
        throw new Error(`Token verification failed: ${error.message}`);
      }
    }
  }

  async refreshToken(refreshToken) {
    try {
      // Verify the refresh token
      const decoded = await this.verifyToken(refreshToken);
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token type');
      }

      // Generate new tokens (minimal user data from refresh token)
      const userData = {
        id: decoded.id
      };

      return await this.generateToken(userData);
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  parseTokenPayload(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      throw new Error(`Token parsing failed: ${error.message}`);
    }
  }

  scheduleAutoRefresh(token, refreshCallback) {
    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    try {
      const decoded = this.parseTokenPayload(token);
      if (!decoded || !decoded.exp) {
        throw new Error('Invalid token for auto-refresh scheduling');
      }

      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = decoded.exp - now;
      
      // Schedule refresh 5 minutes (300 seconds) before expiry
      const refreshThreshold = 300;
      const timeUntilRefresh = Math.max(0, (timeUntilExpiry - refreshThreshold) * 1000);

      this.refreshTimer = setTimeout(() => {
        refreshCallback();
      }, timeUntilRefresh);

    } catch (error) {
      throw new Error(`Auto-refresh scheduling failed: ${error.message}`);
    }
  }

  clearAutoRefresh() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // Token invalidation methods
  invalidateToken(token) {
    this.blacklistedTokens.add(token);
  }

  isTokenBlacklisted(token) {
    return this.blacklistedTokens.has(token);
  }

  clearBlacklist() {
    this.blacklistedTokens.clear();
  }

  invalidateAllUserTokens(userId) {
    const userTokens = this.userTokens.get(userId);
    if (userTokens) {
      for (const token of userTokens) {
        this.blacklistedTokens.add(token);
      }
    }
  }

  startBlacklistCleanup() {
    // Clean up expired blacklisted tokens every 10 minutes
    this.blacklistCleanupTimer = setInterval(() => {
      this.cleanupExpiredBlacklistedTokens();
    }, 10 * 60 * 1000);
  }

  cleanupExpiredBlacklistedTokens() {
    const now = Math.floor(Date.now() / 1000);
    const tokensToRemove = [];

    for (const token of this.blacklistedTokens) {
      try {
        // Try to decode without verification to check expiry
        const decoded = jwt.decode(token);
        if (decoded && decoded.exp && decoded.exp < now) {
          tokensToRemove.push(token);
        }
      } catch (error) {
        // If token can't be decoded, remove it from blacklist
        tokensToRemove.push(token);
      }
    }

    tokensToRemove.forEach(token => {
      this.blacklistedTokens.delete(token);
    });

    // Also clean up user token tracking
    for (const [userId, userTokens] of this.userTokens.entries()) {
      const validTokens = new Set();
      for (const token of userTokens) {
        try {
          const decoded = jwt.decode(token);
          if (decoded && decoded.exp && decoded.exp >= now) {
            validTokens.add(token);
          }
        } catch (error) {
          // Remove invalid tokens
        }
      }
      
      if (validTokens.size === 0) {
        this.userTokens.delete(userId);
      } else {
        this.userTokens.set(userId, validTokens);
      }
    }
  }

  getBlacklistStats() {
    return {
      totalBlacklisted: this.blacklistedTokens.size,
      blacklistedTokens: Array.from(this.blacklistedTokens),
      trackedUsers: this.userTokens.size
    };
  }

  cleanup() {
    this.clearAutoRefresh();
    
    if (this.blacklistCleanupTimer) {
      clearInterval(this.blacklistCleanupTimer);
      this.blacklistCleanupTimer = null;
    }
    
    this.blacklistedTokens.clear();
    this.userTokens.clear();
  }
}

module.exports = JWTManager;