/**
 * security.js - Security Middleware for Memex Racing Game
 * 
 * Comprehensive security middleware including rate limiting, security headers,
 * input validation, and protection against common web vulnerabilities
 */

import helmet from 'helmet';

/**
 * Rate Limiting Implementation
 * Simple in-memory rate limiter for API endpoints
 */
class RateLimiter {
  constructor() {
    this.clients = new Map();
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }

  /**
   * Create rate limiting middleware
   */
  createLimiter(options = {}) {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes
      max = 100, // Maximum requests per window
      message = 'Too many requests, please try again later',
      keyGenerator = (req) => req.ip || req.connection.remoteAddress,
      skipSuccessfulRequests = false,
      skipFailedRequests = false
    } = options;

    return (req, res, next) => {
      const key = keyGenerator(req);
      const now = Date.now();
      const windowStart = now - windowMs;

      if (!this.clients.has(key)) {
        this.clients.set(key, []);
      }

      const requests = this.clients.get(key);
      
      // Remove old requests outside the window
      while (requests.length > 0 && requests[0].timestamp < windowStart) {
        requests.shift();
      }

      // Check if limit exceeded
      if (requests.length >= max) {
        const oldestRequest = requests[0];
        const resetTime = oldestRequest.timestamp + windowMs;
        
        res.set({
          'X-RateLimit-Limit': max,
          'X-RateLimit-Remaining': 0,
          'X-RateLimit-Reset': Math.ceil(resetTime / 1000),
          'Retry-After': Math.ceil((resetTime - now) / 1000)
        });

        console.warn(`[Security] Rate limit exceeded for ${key}`);
        
        return res.status(429).json({
          success: false,
          error: message,
          retryAfter: Math.ceil((resetTime - now) / 1000)
        });
      }

      // Add current request
      requests.push({
        timestamp: now,
        path: req.path,
        method: req.method
      });

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': max,
        'X-RateLimit-Remaining': Math.max(0, max - requests.length),
        'X-RateLimit-Reset': Math.ceil((now + windowMs) / 1000)
      });

      // Store response handler for conditional counting
      const originalSend = res.send;
      res.send = function(data) {
        const statusCode = res.statusCode;
        
        // Remove request from count if configured to skip
        if ((skipSuccessfulRequests && statusCode < 400) ||
            (skipFailedRequests && statusCode >= 400)) {
          requests.pop();
        }
        
        return originalSend.call(this, data);
      };

      next();
    };
  }

  /**
   * Cleanup old entries
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const [key, requests] of this.clients.entries()) {
      if (requests.length === 0 || 
          (now - requests[requests.length - 1].timestamp) > maxAge) {
        this.clients.delete(key);
      }
    }
  }

  /**
   * Destroy rate limiter
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clients.clear();
  }
}

const rateLimiter = new RateLimiter();

/**
 * Security Headers Middleware
 */
export const securityHeaders = (req, res, next) => {
  // Use Helmet for most security headers
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Required for Phaser.js and game engine
          "'unsafe-eval'",   // Required for Phaser.js dynamic code
          "blob:",
          "data:"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'" // Required for dynamic game UI
        ],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://cdn.jsdelivr.net" // For external assets if needed
        ],
        connectSrc: [
          "'self'",
          "ws://localhost:*",
          "wss://localhost:*",
          "http://localhost:*",
          "https://localhost:*",
          process.env.WEBSOCKET_URL || "ws://localhost:3001"
        ],
        fontSrc: [
          "'self'",
          "data:"
        ],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'", "blob:", "data:"],
        frameSrc: ["'none'"],
        workerSrc: ["'self'", "blob:"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : false
      }
    },
    crossOriginEmbedderPolicy: false, // Disable for WebRTC/WebSocket compatibility
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  })(req, res, () => {
    // Additional custom security headers
    res.set({
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin'
    });

    next();
  });
};

/**
 * Input Validation Middleware
 */
export const validateInput = (req, res, next) => {
  // Sanitize common XSS patterns
  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    }
    return value;
  };

  // Recursively sanitize object
  const sanitizeObject = (obj) => {
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }
    
    return sanitizeValue(obj);
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  // Check for suspicious patterns
  const requestString = JSON.stringify({
    body: req.body,
    query: req.query,
    headers: req.headers
  });

  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
    /onload=/i,
    /onerror=/i,
    /eval\s*\(/i,
    /expression\s*\(/i
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestString)) {
      console.warn(`[Security] Suspicious request pattern detected from ${req.ip}:`, {
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(400).json({
        success: false,
        error: 'Invalid request format'
      });
    }
  }

  next();
};

/**
 * Socket.io Security Middleware
 */
export const secureSocket = (socket, next) => {
  try {
    // Check origin for WebSocket connections
    const origin = socket.handshake.headers.origin;
    const allowedOrigins = getAllowedOrigins();
    
    if (origin && !allowedOrigins.includes(origin)) {
      console.warn(`[Security] WebSocket connection from unauthorized origin: ${origin}`);
      return next(new Error('Unauthorized origin'));
    }

    // Rate limiting for WebSocket connections
    const clientIp = socket.handshake.address;
    if (!isWebSocketRateLimited(clientIp)) {
      console.warn(`[Security] WebSocket rate limit exceeded for ${clientIp}`);
      return next(new Error('Rate limit exceeded'));
    }

    next();
  } catch (error) {
    console.error('[Security] WebSocket security check failed:', error);
    next(new Error('Security validation failed'));
  }
};

/**
 * Get allowed origins for CORS validation
 */
function getAllowedOrigins() {
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001'
  ];

  const productionOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : [];

  if (process.env.NODE_ENV === 'development') {
    return [...defaultOrigins, ...productionOrigins];
  }

  return productionOrigins.length > 0 ? productionOrigins : defaultOrigins;
}

/**
 * WebSocket Rate Limiting
 */
const wsConnections = new Map();

function isWebSocketRateLimited(clientIp) {
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxConnections = 10;

  if (!wsConnections.has(clientIp)) {
    wsConnections.set(clientIp, []);
  }

  const connections = wsConnections.get(clientIp);
  
  // Remove old connections
  while (connections.length > 0 && (now - connections[0]) > windowMs) {
    connections.shift();
  }

  if (connections.length >= maxConnections) {
    return false;
  }

  connections.push(now);
  return true;
}

/**
 * Rate Limiting Presets
 */
export const rateLimiters = {
  // Strict limiting for authentication endpoints
  auth: rateLimiter.createLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many authentication attempts. Please try again later.'
  }),

  // General API rate limiting
  api: rateLimiter.createLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests. Please try again later.'
  }),

  // Stricter limiting for sensitive endpoints
  sensitive: rateLimiter.createLimiter({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 10, // 10 requests per window
    message: 'Rate limit exceeded for sensitive endpoint.'
  }),

  // More lenient for streaming endpoints
  streaming: rateLimiter.createLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 200, // 200 requests per minute
    message: 'Streaming rate limit exceeded.'
  })
};

export default {
  securityHeaders,
  validateInput,
  secureSocket,
  rateLimiters,
  RateLimiter
};