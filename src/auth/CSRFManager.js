// CSRF Protection System for Authentication Security
// TDD GREEN Phase - Minimal implementation to pass tests

class CSRFManager {
  constructor(config = {}) {
    this.config = {
      tokenLength: 32,
      tokenExpiration: 60 * 60 * 1000, // 1 hour
      cookieName: 'csrf-token',
      headerName: 'X-CSRF-Token',
      cleanupInterval: 10 * 60 * 1000, // 10 minutes
      ...config
    };
    
    // Storage for CSRF tokens
    this.tokens = new Map(); // sessionId -> { token, createdAt, expiresAt }
    
    // Start cleanup timer
    this.startCleanupTimer();
  }

  generateToken() {
    // Use crypto.getRandomValues() for cryptographically secure token generation
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint8Array(this.config.tokenLength);
      crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    } else {
      // Fallback for environments without crypto.getRandomValues
      throw new Error('crypto.getRandomValues() is not available');
    }
  }

  storeToken(sessionId, token) {
    const now = Date.now();
    const expiresAt = now + this.config.tokenExpiration;
    
    this.tokens.set(sessionId, {
      token: token,
      createdAt: now,
      expiresAt: expiresAt
    });
  }

  getToken(sessionId) {
    const tokenInfo = this.tokens.get(sessionId);
    if (!tokenInfo) {
      return null;
    }
    
    // Check if token has expired
    if (Date.now() > tokenInfo.expiresAt) {
      this.tokens.delete(sessionId);
      return null;
    }
    
    return tokenInfo.token;
  }

  validateToken(sessionId, providedToken) {
    const storedToken = this.getToken(sessionId);
    if (!storedToken) {
      return false;
    }
    
    // Use constant-time comparison to prevent timing attacks
    return this.constantTimeCompare(storedToken, providedToken);
  }

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

  invalidateToken(sessionId) {
    this.tokens.delete(sessionId);
  }

  invalidateAllTokens() {
    this.tokens.clear();
  }

  refreshToken(sessionId) {
    const existingTokenInfo = this.tokens.get(sessionId);
    if (!existingTokenInfo) {
      return null;
    }
    
    // Generate new token
    const newToken = this.generateToken();
    this.storeToken(sessionId, newToken);
    
    return newToken;
  }

  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredTokens();
    }, this.config.cleanupInterval);
  }

  cleanupExpiredTokens() {
    const now = Date.now();
    
    for (const [sessionId, tokenInfo] of this.tokens.entries()) {
      if (now > tokenInfo.expiresAt) {
        this.tokens.delete(sessionId);
      }
    }
  }

  cleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.tokens.clear();
  }

  // Express.js middleware integration
  expressMiddleware() {
    return (req, res, next) => {
      const sessionId = req.session?.id || req.sessionID;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session required for CSRF protection' });
      }
      
      // Generate token for GET requests or if no token exists
      if (req.method === 'GET' || !this.getToken(sessionId)) {
        const token = this.generateToken();
        this.storeToken(sessionId, token);
        
        // Set token in cookie
        res.cookie(this.config.cookieName, token, {
          httpOnly: false, // Client needs to read this for AJAX requests
          secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
          sameSite: 'strict',
          maxAge: this.config.tokenExpiration
        });
        
        // Make token available in templates
        res.locals.csrfToken = token;
      }
      
      // Validate token for state-changing requests
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        const providedToken = req.headers[this.config.headerName.toLowerCase()] || 
                            req.body._csrf || 
                            req.query._csrf;
        
        if (!providedToken || !this.validateToken(sessionId, providedToken)) {
          return res.status(403).json({ error: 'Invalid CSRF token' });
        }
      }
      
      next();
    };
  }

  // Statistics and monitoring
  getStats() {
    return {
      activeTokens: this.tokens.size,
      config: this.config
    };
  }

  getActiveTokens() {
    const active = [];
    const now = Date.now();
    
    for (const [sessionId, tokenInfo] of this.tokens.entries()) {
      if (now <= tokenInfo.expiresAt) {
        active.push({
          sessionId,
          createdAt: new Date(tokenInfo.createdAt),
          expiresAt: new Date(tokenInfo.expiresAt),
          remainingTime: tokenInfo.expiresAt - now
        });
      }
    }
    
    return active;
  }
}

module.exports = CSRFManager;