// Browser-compatible JWT Manager (without Node.js dependencies)
// Uses simplified JWT implementation for browser environment

class BrowserJWTManager {
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

  // Simple Base64URL encoding/decoding
  base64UrlEncode(str) {
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  base64UrlDecode(str) {
    str = (str + '===').slice(0, str.length + (str.length % 4));
    return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  }

  // Create a simple JWT token (for demonstration purposes)
  async generateToken(userData) {
    try {
      const header = {
        typ: 'JWT',
        alg: 'HS256' // Simplified - in production use proper crypto
      };

      const now = Math.floor(Date.now() / 1000);
      const payload = {
        ...userData,
        type: 'access',
        iat: now,
        exp: now + 3600 // 1 hour expiry
      };

      // Create token parts
      const headerBase64 = this.base64UrlEncode(JSON.stringify(header));
      const payloadBase64 = this.base64UrlEncode(JSON.stringify(payload));
      
      // Simple signature (NOT secure - for demo only)
      const signature = this.base64UrlEncode(
        this.simpleHash(`${headerBase64}.${payloadBase64}.${this.config.secret}`)
      );

      const token = `${headerBase64}.${payloadBase64}.${signature}`;

      // Generate refresh token
      const refreshPayload = {
        id: userData.id,
        type: 'refresh',
        iat: now,
        exp: now + 604800 // 7 days
      };

      const refreshPayloadBase64 = this.base64UrlEncode(JSON.stringify(refreshPayload));
      const refreshSignature = this.base64UrlEncode(
        this.simpleHash(`${headerBase64}.${refreshPayloadBase64}.${this.config.secret}`)
      );
      
      const refreshToken = `${headerBase64}.${refreshPayloadBase64}.${refreshSignature}`;

      // Track user tokens
      if (!this.userTokens.has(userData.id)) {
        this.userTokens.set(userData.id, new Set());
      }
      this.userTokens.get(userData.id).add(token);
      this.userTokens.get(userData.id).add(refreshToken);

      return {
        token,
        refreshToken,
        expiresAt: new Date(payload.exp * 1000)
      };
    } catch (error) {
      throw new Error(`Token generation failed: ${error.message}`);
    }
  }

  // Simple hash function (NOT cryptographically secure - for demo only)
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  async verifyToken(token) {
    try {
      // Check if token is blacklisted first
      if (this.isTokenBlacklisted(token)) {
        throw new Error('Token has been invalidated');
      }
      
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      const [headerBase64, payloadBase64, signatureBase64] = parts;
      
      // Verify signature
      const expectedSignature = this.base64UrlEncode(
        this.simpleHash(`${headerBase64}.${payloadBase64}.${this.config.secret}`)
      );
      
      if (signatureBase64 !== expectedSignature) {
        throw new Error('Invalid token signature');
      }

      // Decode payload
      const payload = JSON.parse(this.base64UrlDecode(payloadBase64));
      
      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        throw new Error('Token has expired');
      }

      return payload;
    } catch (error) {
      if (error.message === 'Token has been invalidated' || 
          error.message === 'Token has expired' || 
          error.message === 'Invalid token') {
        throw error;
      }
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  async refreshToken(refreshToken) {
    try {
      // Verify the refresh token
      const decoded = await this.verifyToken(refreshToken);
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token type');
      }

      // Generate new tokens
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
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }
      
      const payload = JSON.parse(this.base64UrlDecode(parts[1]));
      return payload;
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
      
      // Schedule refresh 5 minutes before expiry
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
        const decoded = this.parseTokenPayload(token);
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
          const decoded = this.parseTokenPayload(token);
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

// Export for both module and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BrowserJWTManager;
} else {
  window.BrowserJWTManager = BrowserJWTManager;
}