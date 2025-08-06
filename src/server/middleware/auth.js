/**
 * auth.js - Server-side Authentication Middleware
 * 
 * JWT validation middleware for Express routes and Socket.io connections
 * Provides secure authentication for the Memex Racing Game server
 */

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

/**
 * JWT Authentication Middleware for Express routes
 */
export const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required',
      code: 'NO_TOKEN'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.warn(`[Auth] Invalid JWT token: ${error.message}`);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
};

/**
 * Optional JWT Authentication - allows both authenticated and guest users
 */
export const optionalAuthenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null; // Guest user
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.warn(`[Auth] Invalid JWT token in optional auth: ${error.message}`);
    req.user = null; // Treat as guest
    next();
  }
};

/**
 * Socket.io Authentication Middleware
 */
export const authenticateSocket = (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      // Allow guest connections for racing game
      socket.user = {
        id: null,
        username: `Guest_${socket.id.slice(0, 6)}`,
        isGuest: true
      };
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = {
      ...decoded,
      isGuest: false
    };
    
    console.log(`[Auth] Socket authenticated: ${socket.user.username} (${socket.id})`);
    next();
  } catch (error) {
    console.warn(`[Auth] Socket authentication failed: ${error.message}`);
    
    // Allow as guest instead of rejecting connection
    socket.user = {
      id: null,
      username: `Guest_${socket.id.slice(0, 6)}`,
      isGuest: true
    };
    next();
  }
};

/**
 * Generate JWT token for authenticated users
 */
export const generateToken = (user) => {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role || 'player'
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h'
  });

  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh' }, 
    process.env.JWT_SECRET, 
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    }
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h'
  };
};

/**
 * Refresh JWT token
 */
export const refreshToken = (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      error: 'Refresh token required'
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }

    // Here you would typically fetch user from database
    // For now, we'll create a mock user object
    const user = {
      id: decoded.id,
      username: `User_${decoded.id}`,
      email: `user${decoded.id}@memex.racing`
    };

    const tokens = generateToken(user);
    
    res.json({
      success: true,
      data: tokens
    });
  } catch (error) {
    console.warn(`[Auth] Refresh token validation failed: ${error.message}`);
    res.status(401).json({
      success: false,
      error: 'Invalid refresh token'
    });
  }
};

/**
 * Admin role middleware
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }

  next();
};

/**
 * Rate limiting helper for authentication endpoints
 */
export const createAuthLimiter = () => {
  // This would integrate with express-rate-limit in a real implementation
  const attempts = new Map();
  
  return (req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress;
    const key = `${clientIp}:auth`;
    
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxAttempts = 5;
    
    if (!attempts.has(key)) {
      attempts.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const attempt = attempts.get(key);
    
    if (now > attempt.resetTime) {
      attempt.count = 1;
      attempt.resetTime = now + windowMs;
      return next();
    }
    
    if (attempt.count >= maxAttempts) {
      return res.status(429).json({
        success: false,
        error: 'Too many authentication attempts. Please try again later.',
        retryAfter: Math.ceil((attempt.resetTime - now) / 1000)
      });
    }
    
    attempt.count++;
    next();
  };
};

export default {
  authenticateJWT,
  optionalAuthenticateJWT,
  authenticateSocket,
  generateToken,
  refreshToken,
  requireAdmin,
  createAuthLimiter
};