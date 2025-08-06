// Enhanced JWT Manager with proper cryptographic signing and security features
// Enterprise-grade authentication system for Memex Racing game

const crypto = require('crypto');

class EnhancedJWTManager {
  constructor(config) {
    if (!config || !config.secret) {
      throw new Error('JWT configuration with secret is required');
    }
    
    this.config = this.validateConfig(config);
    this.refreshTimer = null;
    
    // Token blacklist for invalidation mechanism
    this.blacklistedTokens = new Set();
    this.userTokens = new Map(); // userId -> Set of tokens
    this.tokenMetadata = new Map(); // token -> metadata
    
    // Rate limiting for token operations
    this.rateLimiter = new Map(); // userId -> { count, resetTime }
    
    // Start cleanup timer for expired blacklisted tokens
    this.startBlacklistCleanup();
    
    console.log('[EnhancedJWTManager] Initialized with enterprise security features');
  }

  validateConfig(config) {
    const required = ['secret'];
    const missing = required.filter(key => !config[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required JWT configuration: ${missing.join(', ')}`);
    }

    // Validate secret strength
    if (config.secret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters for security');
    }

    return {
      algorithm: 'HS256',
      expiresIn: '1h',
      refreshExpiresIn: '7d',
      issuer: 'memex-racing-game',
      audience: 'memex-racing-users',
      maxTokensPerUser: 5,
      rateLimitWindow: 15 * 60 * 1000, // 15 minutes
      rateLimitMaxAttempts: 10,
      ...config
    };
  }

  // Enhanced token generation with proper HMAC signing
  async generateToken(userData) {
    try {
      // Rate limiting check
      this.checkRateLimit(userData.id);
      
      // Validate user data
      this.validateUserData(userData);
      
      const now = Math.floor(Date.now() / 1000);
      const tokenId = this.generateTokenId();
      
      // Create main access token
      const accessPayload = {
        jti: tokenId, // JWT ID for tracking
        sub: userData.id, // Subject (user ID)
        iss: this.config.issuer,
        aud: this.config.audience,
        iat: now,
        exp: now + this.parseExpiry(this.config.expiresIn),
        type: 'access',
        username: userData.username,
        email: userData.email,
        roles: userData.roles || ['user'],
        permissions: userData.permissions || [],
        sessionId: this.generateSessionId()
      };

      // Create refresh token
      const refreshPayload = {
        jti: this.generateTokenId(),
        sub: userData.id,
        iss: this.config.issuer,
        aud: this.config.audience,
        iat: now,
        exp: now + this.parseExpiry(this.config.refreshExpiresIn),
        type: 'refresh',
        tokenId: tokenId // Link to access token
      };

      // Sign tokens with HMAC
      const accessToken = this.signToken(accessPayload);
      const refreshToken = this.signToken(refreshPayload);

      // Store token metadata
      const metadata = {
        userId: userData.id,
        createdAt: new Date(),
        lastUsed: new Date(),
        userAgent: userData.userAgent || null,
        ipAddress: userData.ipAddress || null,
        sessionId: accessPayload.sessionId
      };

      this.tokenMetadata.set(accessToken, metadata);
      this.tokenMetadata.set(refreshToken, metadata);

      // Track user tokens and enforce limits
      this.trackUserToken(userData.id, accessToken);
      this.trackUserToken(userData.id, refreshToken);

      return {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresAt: new Date(accessPayload.exp * 1000),
        expiresIn: accessPayload.exp - now,
        sessionId: accessPayload.sessionId
      };
    } catch (error) {
      throw new Error(`Token generation failed: ${error.message}`);
    }
  }

  // Proper HMAC-SHA256 token signing
  signToken(payload) {
    // Create header
    const header = {
      typ: 'JWT',
      alg: this.config.algorithm
    };

    // Encode header and payload
    const headerBase64 = this.base64UrlEncode(JSON.stringify(header));
    const payloadBase64 = this.base64UrlEncode(JSON.stringify(payload));
    
    // Create signature with HMAC-SHA256
    const data = `${headerBase64}.${payloadBase64}`;
    const signature = crypto
      .createHmac('sha256', this.config.secret)
      .update(data)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return `${headerBase64}.${payloadBase64}.${signature}`;
  }

  // Enhanced token verification with security checks
  async verifyToken(token, options = {}) {
    try {
      // Basic format validation
      if (!token || typeof token !== 'string') {
        throw new Error('Token must be a non-empty string');
      }

      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      // Check if token is blacklisted
      if (this.isTokenBlacklisted(token)) {
        throw new Error('Token has been revoked');
      }

      const [headerBase64, payloadBase64, signatureBase64] = parts;
      
      // Verify signature
      const data = `${headerBase64}.${payloadBase64}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.config.secret)
        .update(data)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      
      if (!this.constantTimeCompare(signatureBase64, expectedSignature)) {
        throw new Error('Invalid token signature');
      }

      // Decode and validate header
      const header = JSON.parse(this.base64UrlDecode(headerBase64));
      if (header.alg !== this.config.algorithm) {
        throw new Error('Invalid token algorithm');
      }

      // Decode and validate payload
      const payload = JSON.parse(this.base64UrlDecode(payloadBase64));
      
      // Validate standard claims
      this.validateClaims(payload, options);
      
      // Update token metadata
      this.updateTokenUsage(token);

      return payload;
    } catch (error) {
      if (error.message.includes('Token has been revoked') || 
          error.message.includes('Token has expired') || 
          error.message.includes('Invalid token')) {
        throw error;
      }
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  // Validate JWT claims
  validateClaims(payload, options = {}) {
    const now = Math.floor(Date.now() / 1000);
    
    // Check expiration
    if (payload.exp && payload.exp < now) {
      throw new Error('Token has expired');
    }

    // Check not before
    if (payload.nbf && payload.nbf > now) {
      throw new Error('Token not yet valid');
    }

    // Check issued at (prevent future tokens)
    if (payload.iat && payload.iat > now + 60) { // 60 second clock skew tolerance
      throw new Error('Token issued in the future');
    }

    // Validate issuer
    if (payload.iss !== this.config.issuer) {
      throw new Error('Invalid token issuer');
    }

    // Validate audience
    if (payload.aud !== this.config.audience) {
      throw new Error('Invalid token audience');
    }

    // Additional validations based on options
    if (options.requiredType && payload.type !== options.requiredType) {
      throw new Error(`Invalid token type. Expected: ${options.requiredType}`);
    }

    if (options.requiredRoles && !this.hasRequiredRoles(payload.roles, options.requiredRoles)) {
      throw new Error('Insufficient permissions');
    }
  }

  // Enhanced token refresh with security checks
  async refreshToken(refreshToken) {
    try {
      // Verify the refresh token
      const decoded = await this.verifyToken(refreshToken, { requiredType: 'refresh' });
      
      // Check if original access token still exists
      const originalTokenId = decoded.tokenId;
      if (!originalTokenId) {
        throw new Error('Invalid refresh token: missing token reference');
      }

      // Revoke old tokens
      this.revokeUserTokensBySession(decoded.sub, decoded.sessionId);

      // Generate new tokens with limited user data
      const userData = {
        id: decoded.sub,
        username: decoded.username || null,
        email: decoded.email || null,
        roles: decoded.roles || ['user'],
        permissions: decoded.permissions || []
      };

      return await this.generateToken(userData);
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  // Token revocation methods
  revokeToken(token) {
    this.blacklistedTokens.add(token);
    
    // Remove from user tracking
    const metadata = this.tokenMetadata.get(token);
    if (metadata) {
      const userTokens = this.userTokens.get(metadata.userId);
      if (userTokens) {
        userTokens.delete(token);
      }
    }
    
    this.tokenMetadata.delete(token);
  }

  revokeAllUserTokens(userId) {
    const userTokens = this.userTokens.get(userId);
    if (userTokens) {
      for (const token of userTokens) {
        this.blacklistedTokens.add(token);
        this.tokenMetadata.delete(token);
      }
      this.userTokens.delete(userId);
    }
  }

  revokeUserTokensBySession(userId, sessionId) {
    const userTokens = this.userTokens.get(userId);
    if (userTokens) {
      const tokensToRevoke = [];
      for (const token of userTokens) {
        const metadata = this.tokenMetadata.get(token);
        if (metadata && metadata.sessionId === sessionId) {
          tokensToRevoke.push(token);
        }
      }
      
      tokensToRevoke.forEach(token => this.revokeToken(token));
    }
  }

  // Security utility methods
  constantTimeCompare(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }

  generateTokenId() {
    return crypto.randomBytes(16).toString('hex');
  }

  generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  }

  base64UrlEncode(str) {
    return Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  base64UrlDecode(str) {
    str = (str + '===').slice(0, str.length + (str.length % 4));
    return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
  }

  parseExpiry(expiry) {
    if (typeof expiry === 'number') {
      return expiry;
    }
    
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid expiry format: ${expiry}`);
    }
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    const multipliers = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400
    };
    
    return value * multipliers[unit];
  }

  // Rate limiting
  checkRateLimit(userId) {
    const now = Date.now();
    const userLimit = this.rateLimiter.get(userId);
    
    if (!userLimit) {
      this.rateLimiter.set(userId, {
        count: 1,
        resetTime: now + this.config.rateLimitWindow
      });
      return;
    }
    
    if (now > userLimit.resetTime) {
      // Reset window
      this.rateLimiter.set(userId, {
        count: 1,
        resetTime: now + this.config.rateLimitWindow
      });
      return;
    }
    
    if (userLimit.count >= this.config.rateLimitMaxAttempts) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    userLimit.count++;
  }

  // Token tracking and management
  trackUserToken(userId, token) {
    if (!this.userTokens.has(userId)) {
      this.userTokens.set(userId, new Set());
    }
    
    const userTokens = this.userTokens.get(userId);
    userTokens.add(token);
    
    // Enforce token limits per user
    if (userTokens.size > this.config.maxTokensPerUser) {
      // Remove oldest token
      const oldestToken = userTokens.values().next().value;
      this.revokeToken(oldestToken);
    }
  }

  updateTokenUsage(token) {
    const metadata = this.tokenMetadata.get(token);
    if (metadata) {
      metadata.lastUsed = new Date();
    }
  }

  // Validation helpers
  validateUserData(userData) {
    if (!userData || typeof userData !== 'object') {
      throw new Error('User data must be an object');
    }
    
    if (!userData.id) {
      throw new Error('User ID is required');
    }
    
    if (userData.username && typeof userData.username !== 'string') {
      throw new Error('Username must be a string');
    }
    
    if (userData.email && typeof userData.email !== 'string') {
      throw new Error('Email must be a string');
    }
  }

  hasRequiredRoles(userRoles, requiredRoles) {
    if (!Array.isArray(userRoles) || !Array.isArray(requiredRoles)) {
      return false;
    }
    
    return requiredRoles.some(role => userRoles.includes(role));
  }

  isTokenBlacklisted(token) {
    return this.blacklistedTokens.has(token);
  }

  parseTokenPayload(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }
      
      return JSON.parse(this.base64UrlDecode(parts[1]));
    } catch (error) {
      throw new Error(`Token parsing failed: ${error.message}`);
    }
  }

  // Cleanup and maintenance
  startBlacklistCleanup() {
    this.blacklistCleanupTimer = setInterval(() => {
      this.cleanupExpiredTokens();
    }, 10 * 60 * 1000); // Every 10 minutes
  }

  cleanupExpiredTokens() {
    const now = Math.floor(Date.now() / 1000);
    const tokensToRemove = [];

    // Clean up blacklisted tokens
    for (const token of this.blacklistedTokens) {
      try {
        const payload = this.parseTokenPayload(token);
        if (payload.exp && payload.exp < now) {
          tokensToRemove.push(token);
        }
      } catch (error) {
        tokensToRemove.push(token);
      }
    }

    tokensToRemove.forEach(token => {
      this.blacklistedTokens.delete(token);
    });

    // Clean up user token tracking
    for (const [userId, userTokens] of this.userTokens.entries()) {
      const validTokens = new Set();
      for (const token of userTokens) {
        try {
          const payload = this.parseTokenPayload(token);
          if (payload.exp && payload.exp >= now) {
            validTokens.add(token);
          } else {
            this.tokenMetadata.delete(token);
          }
        } catch (error) {
          this.tokenMetadata.delete(token);
        }
      }
      
      if (validTokens.size === 0) {
        this.userTokens.delete(userId);
      } else {
        this.userTokens.set(userId, validTokens);
      }
    }

    // Clean up rate limiter
    const currentTime = Date.now();
    for (const [userId, limit] of this.rateLimiter.entries()) {
      if (currentTime > limit.resetTime) {
        this.rateLimiter.delete(userId);
      }
    }
  }

  // Statistics and monitoring
  getTokenStats() {
    return {
      totalBlacklisted: this.blacklistedTokens.size,
      activeUsers: this.userTokens.size,
      totalActiveTokens: Array.from(this.userTokens.values())
        .reduce((sum, tokens) => sum + tokens.size, 0),
      rateLimitedUsers: this.rateLimiter.size
    };
  }

  // Cleanup resources
  cleanup() {
    if (this.blacklistCleanupTimer) {
      clearInterval(this.blacklistCleanupTimer);
      this.blacklistCleanupTimer = null;
    }
    
    this.blacklistedTokens.clear();
    this.userTokens.clear();
    this.tokenMetadata.clear();
    this.rateLimiter.clear();
  }
}

module.exports = EnhancedJWTManager;